import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createExhibitGameControls} from '../src/exhibitGameControls.js';

class Surface {
  constructor(tagName) { this.tagName = tagName; this.listeners = new Map(); }
  addEventListener(name, handler, capture) {
    const list = this.listeners.get(name) ?? [];
    list.push({handler, capture});
    this.listeners.set(name, list);
  }
  removeEventListener(name, handler, capture) {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter(item => item.handler !== handler || item.capture !== capture));
  }
  fire(name, values = {}) {
    const event = {target: this, pointerId: 1, button: 0, clientX: 200, clientY: 150,
      prevented: false, stopped: false, preventDefault() { this.prevented = true; },
      stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...values};
    for (const {handler} of this.listeners.get(name) ?? []) handler(event);
    return event;
  }
  listenerCount() { return [...this.listeners.values()].reduce((total, items) => total + items.length, 0); }
}

function fixture({disabled = [], attributes = {}} = {}) {
  const window = new Surface(), document = new Surface();
  document.defaultView = window;
  document.visibilityState = 'visible';
  // Any accidental creation of a button, marker or panel fails the fixture.
  document.createElement = () => { throw new Error('Physical games must not create UI'); };
  const canvas = new Surface('CANVAS'), attrs = new Map(Object.entries(attributes)), captures = new Set();
  canvas.ownerDocument = document;
  canvas.style = {cursor: ''};
  canvas.getAttribute = name => attrs.get(name) ?? null;
  canvas.setAttribute = (name, value) => attrs.set(name, value);
  canvas.removeAttribute = name => attrs.delete(name);
  canvas.getBoundingClientRect = () => ({left: 100, top: 50, width: 800, height: 600});
  canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => { captures.delete(id); canvas.fire('lostpointercapture', {pointerId: id}); };
  canvas.focus = () => { document.activeElement = canvas; };
  const map = {getCanvas: () => canvas, repaints: 0, triggerRepaint() { this.repaints++; }};
  for (const name of ['dragPan', 'scrollZoom', 'boxZoom', 'doubleClickZoom', 'touchZoomRotate', 'keyboard']) {
    map[name] = {enabled: !disabled.includes(name), enables: 0, disables: 0,
      isEnabled() { return this.enabled; }, enable() { this.enabled = true; this.enables++; },
      disable() { this.enabled = false; this.disables++; }};
  }
  let slug = 'tesla-logistics', allowed = true, scene, hit, startResult = true;
  const calls = {starts: [], stops: 0, clicks: [], inputs: [], resets: 0, picked: [], entered: [], exited: [], hovered: []};
  function makeScene() {
    return {active: false, gameIsActive() { return this.active; },
      startGame(value) { this.active = true; calls.starts.push(value); return startResult; },
      stopGame() { this.active = false; calls.stops++; }, resetGame() { calls.resets++; },
      gameInput(value) { calls.inputs.push({...value}); },
      gameHover(id) { calls.hovered.push(id); },
      gameClick(id, point) { calls.clicks.push({id, point}); },
      pickGameObject(point) { calls.picked.push(point); return hit === undefined ? {id: this.active ? 'crate-1' : '__start', point: [1, 2, 3]} : hit; }};
  }
  scene = makeScene();
  const controls = createExhibitGameControls({map, getScene: () => scene, getEvent: () => slug ? {slug} : null,
    canPlay: () => allowed, onStart: value => calls.entered.push(value), onExit: value => calls.exited.push(value)});
  const click = (values = {}) => { canvas.fire('pointerdown', values); return canvas.fire('pointerup', values); };
  const key = (code, values = {}) => canvas.fire('keydown', {code, ...values});
  const up = (code, values = {}) => document.fire('keyup', {target: canvas, code, ...values});
  return {controls, map, canvas, document, window, attrs, captures, calls, click, key, up,
    focus: () => canvas.focus(), setSlug: value => { slug = value; }, setAllowed: value => { allowed = value; },
    setHit: value => { hit = value; }, setStartResult: value => { startResult = value; },
    getScene: () => scene, replaceScene: () => { scene = makeScene(); }};
}

test('gameplay owns only the focused canvas; external keys stay native and key releases cannot leave movement held',()=>{
  const f=fixture();f.click();
  const outside={tagName:'DIV',closest:selector=>selector==='.exhibit-reader-dock'?{}:null};
  f.document.activeElement=outside;
  const before=f.calls.inputs.length;
  for(const code of ['KeyW','KeyA','KeyS','KeyD','KeyE','KeyR','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Escape']){
    const event=f.document.fire('keydown',{target:outside,code});
    assert.equal(event.prevented,false,`${code} stays with external UI`);
    assert.equal(f.key(code,{target:outside}).prevented,false);
  }
  assert.equal(f.calls.inputs.length,before);
  assert.equal(f.calls.resets,0);assert.equal(f.calls.stops,0);
  assert.deepEqual(f.controls.getStats().heldKeys,[]);
  assert.equal((f.document.listeners.get('keydown')??[]).length,0);
  f.focus();f.key('KeyW');f.document.activeElement=outside;
  assert.equal(f.up('KeyW',{target:outside}).prevented,false);
  assert.deepEqual(f.calls.inputs.at(-1),{x:0,z:0,activate:false});
  assert.deepEqual(f.controls.getStats().heldKeys,[]);
  f.controls.destroy();
});

test('clicking the actual 3D exhibit starts native play and passes physical object coordinates without a duplicate click', () => {
  const f = fixture();
  const down = f.canvas.fire('pointerdown');
  assert.equal(down.prevented, true);
  assert.equal(down.stopped, true);
  assert.equal(f.document.activeElement, f.canvas);
  assert.equal(f.captures.size, 1);
  assert.equal(f.calls.starts.length, 0);
  const up = f.canvas.fire('pointerup');
  assert.equal(up.prevented, true);
  assert.deepEqual(f.calls.starts, ['tesla-logistics']);
  assert.deepEqual(f.calls.entered, ['tesla-logistics']);
  assert.deepEqual(f.calls.picked, [{x: 100, y: 100}, {x: 100, y: 100}]);
  assert.equal(f.captures.size, 0);
  assert.equal(f.controls.getStats().activeSlug, 'tesla-logistics');
  assert.equal(f.attrs.get('data-exhibit-playing'), 'true');
  f.click();
  const click = f.canvas.fire('click');
  assert.equal(click.prevented, true);
  assert.equal(click.stopped, true);
  assert.deepEqual(f.calls.clicks, [{id: 'crate-1', point: [1, 2, 3]}]);
  assert.equal(f.calls.starts.length, 1);
  assert.deepEqual([f.controls.getStats().buttons, f.controls.getStats().panels, f.controls.getStats().markers], [0, 0, 0]);
  f.controls.destroy();
});

test('a stationary tap keeps its dock intent when a moving actor crosses the release point',()=>{
  const f=fixture();f.click();
  f.setHit({id:'dock-0',point:[4,.1,2]});f.canvas.fire('pointerdown');
  f.setHit({id:'actor',point:[4,.5,2]});f.canvas.fire('pointerup');
  assert.deepEqual(f.calls.clicks,[{id:'dock-0',point:[4,.1,2]}]);
  f.controls.destroy();
});

test('the first exhibit tap survives focus moving from a popup button to the canvas', () => {
  const f = fixture(), popupButton = new Surface('BUTTON');
  f.document.activeElement = popupButton;
  f.canvas.focus = () => {
    // Native blur does not bubble, but the window's capture listener still sees it.
    f.window.fire('blur', {target: popupButton, relatedTarget: f.canvas});
    f.document.activeElement = f.canvas;
  };
  const down = f.canvas.fire('pointerdown');
  assert.equal(down.prevented, true);
  assert.equal(f.controls.getStats().pointerActive, true);
  assert.equal(f.captures.size, 1);
  f.canvas.fire('pointerup');
  assert.deepEqual(f.calls.starts, ['tesla-logistics']);
  assert.equal(f.controls.getStats().active, true);
  assert.equal(f.controls.getStats().pointerActive, false);
  f.key('KeyW');
  f.window.fire('blur');
  assert.deepEqual(f.controls.getStats().heldKeys, []);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.key('KeyA');
  f.canvas.fire('blur');
  assert.deepEqual(f.controls.getStats().heldKeys, []);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.controls.destroy();
});

test('compatibility clicks from physical presses do not reach map markers; independent map clicks remain available', () => {
  const f = fixture();
  f.click();
  assert.equal(f.canvas.fire('click').prevented, true);
  assert.equal(f.canvas.fire('click').prevented, false);
  f.click();
  assert.equal(f.canvas.fire('click', {clientX: 700, clientY: 500}).prevented, false);
  f.click();
  assert.equal(f.canvas.fire('click', {target: new Surface('BUTTON')}).prevented, false);
  assert.equal(f.canvas.fire('click').prevented, true);
  f.setHit(null);
  f.canvas.fire('pointerdown');
  f.canvas.fire('pointerup');
  assert.equal(f.canvas.fire('click').prevented, false);
  f.controls.destroy();
});

test('physical hover highlights objects and restores the cursor without consuming map gestures or creating copy', () => {
  const f = fixture();
  const move = f.canvas.fire('pointermove');
  assert.equal(move.prevented, false);
  assert.equal(move.stopped, false);
  assert.equal(f.canvas.style.cursor, 'pointer');
  assert.deepEqual(f.calls.hovered, ['__start']);
  f.canvas.fire('pointermove');
  assert.equal(f.calls.hovered.length, 1, 'unchanged hover has no duplicate update');
  f.click();
  f.canvas.fire('pointermove');
  assert.equal(f.calls.hovered.at(-1), 'crate-1');
  f.setHit({id: '__floor', point: [0, 0, 0]});
  f.canvas.fire('pointermove');
  assert.equal(f.calls.hovered.at(-1), null);
  assert.equal(f.canvas.style.cursor, '');
  f.setHit({id: 'crate-1', point: [0, 0, 0]});
  f.canvas.fire('pointermove');
  f.canvas.fire('pointerleave');
  assert.equal(f.calls.hovered.at(-1), null);
  assert.equal(f.canvas.style.cursor, '');
  f.canvas.fire('pointermove');
  f.controls.close();
  assert.equal(f.canvas.style.cursor, '');
  f.controls.destroy();
});

test('only relevant canvas hits own gestures, preserving wheel/pinch zoom and the original handler states', () => {
  const f = fixture({disabled: ['boxZoom', 'keyboard']});
  f.setHit(null);
  assert.equal(f.canvas.fire('pointerdown').prevented, false);
  assert.equal(f.map.dragPan.isEnabled(), true);
  f.setHit({id: '__start', point: [0, 0, 0]});
  for (const values of [{button: 2}, {isPrimary: false}, {ctrlKey: true}, {target: new Surface('BUTTON')}, {clientX: 99}]) {
    assert.equal(f.canvas.fire('pointerdown', values).prevented, false);
  }
  f.click();
  assert.equal(f.map.dragPan.isEnabled(), false);
  assert.equal(f.map.doubleClickZoom.isEnabled(), false);
  assert.equal(f.map.scrollZoom.isEnabled(), true);
  assert.equal(f.map.touchZoomRotate.isEnabled(), true);
  f.controls.close();
  assert.equal(f.map.dragPan.isEnabled(), true);
  assert.equal(f.map.doubleClickZoom.isEnabled(), true);
  assert.equal(f.map.boxZoom.isEnabled(), false);
  assert.equal(f.map.keyboard.isEnabled(), false);
  assert.equal(f.map.scrollZoom.disables, 0);
  assert.equal(f.map.touchZoomRotate.disables, 0);
  f.controls.close();
  assert.equal(f.map.dragPan.enables, 1);
  f.controls.destroy();
});

test('dragging, pointer cancellation and stale project presses never launch a game or retain gesture locks', () => {
  const f = fixture();
  f.canvas.fire('pointerdown');
  f.canvas.fire('pointermove', {clientX: 216});
  f.canvas.fire('pointerup', {clientX: 216});
  assert.equal(f.calls.starts.length, 0);
  assert.equal(f.map.dragPan.isEnabled(), true);
  f.canvas.fire('pointerdown', {pointerId: 2});
  f.canvas.fire('pointercancel', {pointerId: 2});
  assert.equal(f.controls.getStats().pointerActive, false);
  assert.equal(f.captures.size, 0);
  f.canvas.fire('pointerdown');
  f.setSlug('satellite');
  f.canvas.fire('pointerup');
  assert.equal(f.calls.starts.length, 0);
  assert.equal(f.map.dragPan.isEnabled(), true);
  f.controls.destroy();
});

test('WASD/arrows use continuous normalized input; activation, reset and Escape operate entirely on canvas', () => {
  const f = fixture();
  assert.equal(f.key('KeyW').prevented, false);
  f.focus();
  assert.equal(f.key('KeyW').prevented, true);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: -1, activate: false});
  f.key('KeyD');
  assert.ok(Math.abs(f.calls.inputs.at(-1).x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(f.calls.inputs.at(-1).z + Math.SQRT1_2) < 1e-12);
  f.up('KeyD');
  f.key('ArrowDown');
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.up('ArrowDown');
  f.key('Space');
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: -1, activate: true});
  const inputCount = f.calls.inputs.length;
  f.key('Space', {repeat: true});
  assert.equal(f.calls.inputs.length, inputCount);
  f.up('Space');
  f.key('KeyR');
  f.key('KeyR', {repeat: true});
  assert.equal(f.calls.resets, 1);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.key('Escape');
  assert.equal(f.calls.stops, 1);
  assert.deepEqual(f.calls.exited, ['tesla-logistics']);
  assert.equal(f.map.keyboard.isEnabled(), true);
  assert.equal(f.controls.getStats().active, false);
  f.controls.destroy();
});

test('Enter begins play without accidentally activating an object; UI shortcuts and key releases remain safe', () => {
  const f = fixture();
  f.focus();
  assert.equal(f.key('KeyE').prevented, false);
  assert.equal(f.key('KeyW', {ctrlKey: true}).prevented, false);
  assert.equal(f.key('KeyW', {metaKey: true}).prevented, false);
  assert.equal(f.key('Enter').prevented, true);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.key('KeyW');
  const input = new Surface('INPUT');
  f.document.activeElement = input;
  assert.equal(f.key('KeyD', {target: input}).prevented, false);
  const release = f.up('KeyW', {target: input});
  assert.equal(release.prevented, false);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.focus();
  f.key('KeyA');
  f.window.fire('blur');
  assert.deepEqual(f.controls.getStats().heldKeys, []);
  assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
  f.controls.destroy();
});

test('sync closes on project/scene replacement, disallowed play, a hidden page or externally ended play', () => {
  for (const change of [f => f.setSlug('satellite'), f => f.replaceScene(), f => f.setAllowed(false),
    f => { f.document.visibilityState = 'hidden'; }, f => { f.getScene().active = false; }]) {
    const f = fixture();
    f.click();
    f.key('KeyW');
    change(f);
    f.controls.sync();
    f.controls.sync();
    assert.equal(f.controls.getStats().active, false);
    assert.equal(f.calls.stops, 1);
    assert.deepEqual(f.calls.inputs.at(-1), {x: 0, z: 0, activate: false});
    assert.equal(f.map.dragPan.isEnabled(), true);
    f.controls.destroy();
  }
});

test('lazy scene loads can fail or finish after cancellation without resurrecting stale input or locks', async () => {
  const f = fixture();
  let resolve;
  f.setStartResult(new Promise(done => { resolve = done; }));
  f.click();
  f.key('KeyW');
  f.controls.close();
  const inputs = f.calls.inputs.length;
  resolve(true);
  await Promise.resolve();
  assert.equal(f.calls.inputs.length, inputs);
  assert.equal(f.controls.getStats().active, false);
  let reject;
  f.setStartResult(new Promise((_, fail) => { reject = fail; }));
  f.click();
  reject(new Error('network failure'));
  await Promise.resolve();
  assert.equal(f.controls.getStats().active, false);
  assert.equal(f.map.dragPan.isEnabled(), true);
  f.setStartResult(false);
  f.click();
  assert.equal(f.controls.getStats().active, false);
  assert.equal(f.map.dragPan.isEnabled(), true);
  f.controls.destroy();
});

test('destroy removes every listener and restores only accessibility attributes that it owns', () => {
  const f = fixture();
  assert.equal(f.attrs.get('tabindex'), '0');
  f.click();
  f.key('KeyW');
  f.controls.destroy();
  f.controls.destroy();
  assert.equal(f.canvas.listenerCount() + f.document.listenerCount() + f.window.listenerCount(), 0);
  assert.equal(f.attrs.has('tabindex'), false);
  assert.equal(f.attrs.has('aria-label'), false);
  assert.equal(f.attrs.has('data-exhibit-playing'), false);
  assert.equal(f.map.dragPan.isEnabled(), true);
  assert.equal(f.controls.getStats().active, false);
  const accessible = fixture({attributes: {'tabindex': '-1', 'aria-label': 'Portfolio map'}});
  accessible.controls.destroy();
  assert.equal(accessible.attrs.get('tabindex'), '-1');
  assert.equal(accessible.attrs.get('aria-label'), 'Portfolio map');
  const source = readFileSync(new URL('../src/exhibitGameControls.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /createElement|innerHTML|insertAdjacentHTML|Marker|\.textContent/);
});
