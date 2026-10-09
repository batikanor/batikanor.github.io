import test from 'node:test';
import assert from 'node:assert/strict';
import {clampPanelRect, expandedPanelRect, largePanelRect, reserveJourneySpace, reserveReadingTopbar, resizePanelRect, createDetailPanel} from '../src/detailPanel.js';
import {getProject, renderProjectContent} from '../src/projectContent.js';

const desktopBounds = {
  left: 24, top: 72, right: 1176, bottom: 720,
  minWidth: 280, minHeight: 180,
};

test('dragged detail panel stays within the desktop work area without changing size', () => {
  const original = {x: 620, y: 130, width: 420, height: 350};
  assert.deepEqual(clampPanelRect(original, desktopBounds), original);
  assert.deepEqual(clampPanelRect({...original, x: -200, y: -100}, desktopBounds),
    {...original, x: desktopBounds.left, y: desktopBounds.top});
  assert.deepEqual(clampPanelRect({...original, x: 2000, y: 2000}, desktopBounds),
    {...original, x: desktopBounds.right - original.width,
      y: desktopBounds.bottom - original.height});
});

test('southeast resize grows down/right and respects minimum size and viewport edges', () => {
  const original = {x: 620, y: 130, width: 420, height: 350};
  assert.deepEqual(resizePanelRect(original, 80, 45, 'se', desktopBounds),
    {...original, width: 500, height: 395});
  assert.deepEqual(resizePanelRect(original, -1000, -1000, 'se', desktopBounds),
    {...original, width: desktopBounds.minWidth, height: desktopBounds.minHeight});
  assert.deepEqual(resizePanelRect(original, 1000, 1000, 'se', desktopBounds),
    {...original, width: desktopBounds.right - original.x,
      height: desktopBounds.bottom - original.y});
});

test('southwest resize keeps the right edge fixed while moving the left edge', () => {
  const original = {x: 620, y: 130, width: 420, height: 350};
  assert.deepEqual(resizePanelRect(original, -80, 45, 'sw', desktopBounds),
    {x: 540, y: 130, width: 500, height: 395});
  assert.deepEqual(resizePanelRect(original, 1000, -1000, 'sw', desktopBounds),
    {x: original.x + original.width - desktopBounds.minWidth,
      y: original.y, width: desktopBounds.minWidth,
      height: desktopBounds.minHeight});
  assert.deepEqual(resizePanelRect(original, -1000, 1000, 'sw', desktopBounds),
    {x: desktopBounds.left, y: original.y,
      width: original.x + original.width - desktopBounds.left,
      height: desktopBounds.bottom - original.y});
});

test('an undersized viewport wins over configured minimum dimensions', () => {
  const narrowBounds = {
    left: 12, top: 20, right: 228, bottom: 380,
    minWidth: 320, minHeight: 420,
  };
  const oversized = {x: -100, y: -100, width: 600, height: 600};
  const expected = {x: 12, y: 20, width: 216, height: 360};
  assert.deepEqual(clampPanelRect(oversized, narrowBounds), expected);
  assert.deepEqual(resizePanelRect(expected, 200, 200, 'se', narrowBounds), expected);
});

function panelFixture(t, {width = 1280, height = 900, safe = {}} = {}) {
  class Node {
    constructor(tag = 'div') {
      this.tag = tag;
      this.children = [];
      this.style = {};
      this.attributes = new Map();
      this.listeners = new Map();
      this.captures = new Set();
      this.classes = new Set();
      this.hidden = false;
      this.classList = {
        add: value => this.classes.add(value),
        remove: value => this.classes.delete(value),
        contains: value => this.classes.has(value),
        toggle: (value, on) => on ? this.classes.add(value) : this.classes.delete(value)
      };
    }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(' '); }
    set textContent(value) { this.text = String(value); this.children = []; }
    get textContent() { return (this.text ?? '') + this.children.map(node => node.textContent).join(''); }
    append(...nodes) {
      for (let node of nodes) {
        if (typeof node === 'string') {
          const text = new Node('#text'); text.textContent = node; node = text;
        }
        if (node.tag === '#fragment') { this.append(...node.children); continue; }
        node.parentElement = this;
        this.children.push(node);
      }
    }
    replaceChildren(...nodes) {
      for (const child of this.children) child.parentElement = null;
      this.children = []; this.text = ''; this.append(...nodes);
    }
    setAttribute(name, value) { this.attributes.set(name, String(value)); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    focus() { document.activeElement = this; }
    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
    }
    removeEventListener(type, callback) { this.listeners.get(type)?.delete(callback); }
    emit(type, fields = {}) {
      const event = {button: 0, pointerId: 1, clientX: 0, clientY: 0,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...fields};
      for (const callback of [...(this.listeners.get(type) ?? [])]) callback(event);
      return event;
    }
    setPointerCapture(id) { this.captures.add(id); }
    hasPointerCapture(id) { return this.captures.has(id); }
    releasePointerCapture(id) { this.captures.delete(id); }
    querySelectorAll(selector) {
      const matches = node => selector.startsWith('.')
        ? node.classes.has(selector.slice(1)) : selector.startsWith('#') ? node.id === selector.slice(1) : node.tag === selector;
      return this.children.flatMap(node => [
        ...(matches(node) ? [node] : []), ...node.querySelectorAll(selector)
      ]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  }
  const oldGlobals = Object.fromEntries(['document', 'window', 'requestAnimationFrame',
    'cancelAnimationFrame', 'ResizeObserver'].map(name => [name, globalThis[name]]));
  t.after(() => {
    for (const [name, value] of Object.entries(oldGlobals)) {
      if (value === undefined) delete globalThis[name]; else globalThis[name] = value;
    }
  });
  const viewport = {width, height};
  const frame = () => ({left: 13, top: 21, width: viewport.width, height: viewport.height,
    right: 13 + viewport.width, bottom: 21 + viewport.height});
  const app = new Node();
  app.getBoundingClientRect = frame;
  const topbar = new Node(); topbar.className = 'topbar';
  topbar.getBoundingClientRect = () => ({top: frame().top + (viewport.width <= 760 ? 12 : 24),
    bottom: frame().top + (viewport.width <= 760 ? 56 : 66), width: viewport.width - 24, height: 44});
  const journey = new Node(); journey.className = 'journey'; journey.id = 'journey';
  let railInset = 112;
  journey.getBoundingClientRect = () => journey.hidden ? {width: 0, height: 0, top: 0} :
    ({top: frame().bottom - railInset, width: viewport.width - 24, height: 60});
  const sources = new Node(); sources.className = 'sources';
  const root = new Node(); root.className = 'detail';
  root.getBoundingClientRect = () => {
    if (root.hidden) return {left: 0, top: 0, width: 0, height: 0};
    return {left: frame().left + parseFloat(root.style.left),
      top: frame().top + parseFloat(root.style.top),
      width: parseFloat(root.style.width), height: parseFloat(root.style.height)};
  };
  app.append(topbar, journey, sources, root);
  globalThis.document = {
    activeElement: null,
    createElement: tag => new Node(tag),
    createDocumentFragment: () => new Node('#fragment'),
    createTextNode: text => { const node = new Node('#text'); node.textContent = text; return node; }
  };
  const window = new Node();
  window.innerWidth = width; window.innerHeight = height;
  window.location = {href: 'https://batikanor.com/'};
  window.getComputedStyle = () => ({getPropertyValue: name => `${safe[name.replace('--detail-safe-', '')] ?? 0}px`});
  globalThis.window = window;
  const frames = new Map(); let frameId = 0;
  globalThis.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
  globalThis.cancelAnimationFrame = id => frames.delete(id);
  const observers = [];
  globalThis.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.observed = []; observers.push(this); }
    observe(node) { this.observed.push(node); }
  };
  let settled = 0;
  const panel = createDetailPanel(root, {onGeometrySettled: () => settled++});
  const flushFrames = () => {
    const pending = [...frames.values()]; frames.clear();
    for (const callback of pending) callback();
  };
  const resize = (nextWidth, nextHeight) => {
    viewport.width = window.innerWidth = nextWidth;
    viewport.height = window.innerHeight = nextHeight;
    window.emit('resize'); flushFrames();
  };
  const reachable = () => {
    const rect = panel.getRect(); const gutter = window.innerWidth <= 760 ? 8 : 12;
    assert.ok(rect.x >= gutter + (safe.left ?? 0));
    assert.ok(rect.y >= gutter + (safe.top ?? 0));
    assert.ok(rect.x + rect.width <= viewport.width - gutter - (safe.right ?? 0));
    assert.ok(rect.y + rect.height <= Math.min(viewport.height - gutter - (safe.bottom ?? 0), journey.hidden ? Infinity : viewport.height - railInset - 12), 'the chronology has a12px clear gap');
    assert.ok(rect.width > 0 && rect.height > 44, 'header and internal scroll space remain reachable');
  };
  return {root, app, panel, viewport, window, resize, flushFrames, observers, reachable, journey,
    setRailInset: value => { railInset = value; observers[0].callback(); flushFrames(); },
    settled: () => settled, node: tag => new Node(tag)};
}

test('project reading view is shorter, right-aligned and leaves the chronology clear', t => {
  const f = panelFixture(t);
  const scroll = f.panel.render();
  assert.equal(scroll, f.root.querySelector('.detail-scroll'));
  assert.deepEqual(f.panel.getRect(), {x: 372, y: 112, width: 896, height: 630});
  assert.equal(f.panel.isExpanded(), false);
  assert.equal(f.root.classList.contains('is-reading'), true);
  const toggle = f.root.querySelector('.detail-reset');
  assert.equal(toggle.textContent, '⛶ Expand');
  assert.equal(toggle.getAttribute('aria-label'), 'Expand project window');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  assert.equal(f.root.querySelector('.detail-drag-handle').disabled, false);
  f.reachable();
});

test('Expand uses the whole safe work area and Restore retains authored content and custom geometry', t => {
  const f = panelFixture(t);
  const scroll = f.panel.render();
  const host = f.node('div'); host.className = 'project-content-host'; scroll.append(host);
  const project = renderProjectContent(host, 'masters-thesis');
  assert.equal(project, getProject('masters-thesis'));
  const originalContent = host.textContent;
  const handle = f.root.querySelector('.detail-resize-right');
  handle.emit('keydown', {key: 'ArrowLeft', shiftKey: true});
  handle.emit('keydown', {key: 'ArrowUp'});
  const custom = f.panel.getRect();
  const toggle = f.root.querySelector('.detail-reset');
  toggle.emit('click');
  assert.equal(f.panel.isExpanded(), true);
  assert.deepEqual(f.panel.getRect(), {x: 12, y: 12, width: 1256, height: 764});
  assert.ok(f.panel.getRect().width > custom.width && f.panel.getRect().height > custom.height);
  assert.equal(toggle.textContent, '↙ Restore');
  assert.equal(toggle.getAttribute('aria-label'), 'Restore project window');
  f.reachable();
  toggle.emit('click');
  assert.equal(f.panel.isExpanded(), false);
  assert.deepEqual(f.panel.getRect(), custom);
  assert.equal(f.root.querySelector('.detail-scroll'), scroll);
  assert.equal(host.textContent, originalContent);
  handle.emit('keydown', {key: 'Home'});
  const reading = f.panel.getRect();
  toggle.emit('click'); toggle.emit('click');
  assert.deepEqual(f.panel.getRect(), reading, 'Restore returns the previous default reading view too');
});

test('initial keyboard corners resize immediately and cannot cover the chronology', t => {
  const f = panelFixture(t); f.panel.render();
  const right = f.root.querySelector('.detail-resize-right');
  const left = f.root.querySelector('.detail-resize-left');
  const initial = f.panel.getRect();
  right.emit('keydown', {key: 'ArrowRight'});
  assert.deepEqual(f.panel.getRect(), initial, 'the docked right edge remains within its gutter');
  left.emit('keydown', {key: 'ArrowLeft'});
  assert.deepEqual(f.panel.getRect(), {...initial, x: initial.x - 16, width: initial.width + 16});
  right.emit('keydown', {key: 'Home'});
  right.emit('keydown', {key: 'ArrowUp'});
  assert.equal(f.panel.getRect().height, initial.height - 16);
  f.root.querySelector('.detail-reset').emit('click');
  right.emit('keydown', {key: 'ArrowDown', shiftKey: true});
  assert.equal(f.panel.isExpanded(), true, 'a no-op resize at the reserved rail preserves Expand state');
  f.reachable();
  right.emit('keydown', {key: 'ArrowUp'});
  assert.equal(f.panel.isExpanded(), false);
  right.emit('keydown', {key: 'Home'});
  assert.deepEqual(f.panel.getRect(), initial);
});

test('pointer resizing captures one pointer and clamps every drag above the rail', t => {
  const f = panelFixture(t); f.panel.render();
  const handle = f.root.querySelector('.detail-resize-right');
  const initial = f.panel.getRect();
  handle.emit('pointerdown', {clientX: 1200, clientY: 800});
  handle.emit('pointermove', {clientX: 1000, clientY: 600, pointerId: 2});
  assert.deepEqual(f.panel.getRect(), initial, 'a second pointer cannot resize');
  handle.emit('pointermove', {clientX: 1100, clientY: 700});
  assert.deepEqual(f.panel.getRect(), {...initial, width: initial.width - 100, height: initial.height - 100});
  handle.emit('pointermove', {clientX: 5000, clientY: 5000});
  f.reachable();
  assert.equal(f.panel.getRect().y + f.panel.getRect().height, 776);
  handle.emit('pointerup');
  assert.equal(handle.captures.size, 0);
  assert.equal(handle.listeners.get('pointermove').size, 0);
});

test('short reading windows shrink directly at either corner without jumping above the topbar', t => {
  const f = panelFixture(t, {width: 568, height: 320});
  f.setRailInset(131); f.panel.render();
  const initial = f.panel.getRect();
  assert.equal(initial.y, 68); assert.equal(initial.height, 109);
  for (const [selector, dx] of [['.detail-resize-right', -24], ['.detail-resize-left', 24]]) {
    const handle = f.root.querySelector(selector);
    handle.emit('keydown', {key: 'Home'});
    handle.emit('pointerdown', {clientX: 400, clientY: 170});
    handle.emit('pointermove', {clientX: 400 + dx, clientY: 158});
    handle.emit('pointerup');
    const resized = f.panel.getRect();
    assert.equal(resized.y, initial.y);
    assert.equal(resized.height, initial.height - 12);
    assert.equal(resized.width, initial.width - 24);
    assert.equal(resized.x, initial.x + (dx > 0 ? dx : 0));
    assert.equal(handle.captures.size, 0);
    f.panel.reclamp(); assert.deepEqual(f.panel.getRect(), resized);
    const toggle = f.root.querySelector('.detail-reset');
    toggle.emit('click'); toggle.emit('click');
    assert.deepEqual(f.panel.getRect(), resized, 'Restore retains the small custom reading window');
    f.reachable();
  }
  const drag = f.root.querySelector('.detail-drag-handle');
  drag.emit('keydown', {key: 'Home'});
  drag.emit('pointerdown', {clientX: 400, clientY: 80});
  drag.emit('pointermove', {clientX: 390, clientY: 75}); drag.emit('pointerup');
  assert.deepEqual(f.panel.getRect(), {...initial, x: initial.x - 10, y: initial.y - 5},
    'the first drag also preserves the short reading height');
});

test('initial drag and keyboard movement are usable; double-click and Home reset the reading view', t => {
  const f = panelFixture(t); f.panel.render();
  const drag = f.root.querySelector('.detail-drag-handle');
  const initial = f.panel.getRect();
  drag.emit('pointerdown', {clientX: 500, clientY: 100});
  drag.emit('pointermove', {clientX: 460, clientY: 120});
  assert.deepEqual(f.panel.getRect(), {...initial, x: initial.x - 40, y: initial.y + 20});
  drag.emit('pointermove', {clientX: -5000, clientY: 5000}); f.reachable();
  drag.emit('pointercancel'); assert.equal(drag.captures.size, 0);
  drag.focus(); drag.emit('dblclick');
  assert.deepEqual(f.panel.getRect(), initial);
  assert.equal(document.activeElement, drag);
  drag.emit('keydown', {key: 'ArrowLeft'});
  assert.equal(f.panel.getRect().x, initial.x - 16);
  drag.emit('keydown', {key: 'Home'});
  assert.deepEqual(f.panel.getRect(), initial);
  assert.equal(f.root.querySelector('.detail-scroll').listeners.has('pointerdown'), false);
});

test('project switches can preserve an expanded or custom window, while ordinary opening resets', t => {
  const f = panelFixture(t); f.panel.render();
  f.root.querySelector('.detail-reset').emit('click');
  const expanded = f.panel.getRect();
  f.panel.render({preserveGeometry: true});
  assert.equal(f.panel.isExpanded(), true); assert.deepEqual(f.panel.getRect(), expanded);
  f.root.querySelector('.detail-reset').emit('click');
  f.root.querySelector('.detail-resize-right').emit('keydown', {key: 'ArrowLeft'});
  const custom = f.panel.getRect();
  f.panel.render({preserveGeometry: true});
  assert.deepEqual(f.panel.getRect(), custom);
  f.panel.render();
  assert.equal(f.root.classList.contains('is-reading'), true);
  assert.deepEqual(f.panel.getRect(), {x: 372, y: 112, width: 896, height: 630});
});

test('wrapping credits or chronology resizes every mode above the real rail, even when closed', t => {
  const f = panelFixture(t); f.panel.render();
  f.root.querySelector('.detail-reset').emit('click');
  f.setRailInset(200); f.reachable();
  assert.equal(f.panel.getRect().y + f.panel.getRect().height, 688);
  f.root.querySelector('.detail-reset').emit('click'); f.reachable();
  f.root.querySelector('.detail-drag-handle').emit('keydown', {key: 'ArrowDown', shiftKey: true});
  f.setRailInset(260); f.reachable();
  f.root.querySelector('.close-detail').emit('click');
  f.resize(390, 844); f.reachable();
  assert.ok(f.observers[0].observed.includes(f.journey));
  f.root.hidden = false; f.panel.reset();
  assert.equal(f.panel.getRect().width, 280); assert.equal(f.panel.getRect().x, 102);
});

test('short screens honor the safe rail area; hidden chronology reserves no space', t => {
  const safe = {top: 24, right: 14, bottom: 20, left: 10};
  const f = panelFixture(t, {width: 568, height: 320, safe}); f.panel.render();
  for (const [width, height] of [[568, 320], [390, 320], [320, 568], [390, 844]]) {
    f.resize(width, height); f.panel.render(); f.reachable();
    f.root.querySelector('.detail-reset').emit('click'); f.reachable();
  }
  f.journey.hidden = true; f.resize(568, 320); f.panel.render();
  const full = largePanelRect({left: 18, top: 32, readingTop: 68, right: 546, bottom: 292,
    viewportWidth: 568, viewportHeight: 320, minWidth: 280, minHeight: 180});
  assert.deepEqual(f.panel.getRect(), full);
});

test('default reading view at1280×633 clears the topbar as well as the chronology', t => {
  const f=panelFixture(t,{width:1280,height:633});f.panel.render();
  assert.deepEqual(f.panel.getRect(),{x:372,y:78,width:896,height:431});
  assert.ok(f.panel.getRect().y>=78);
  f.root.querySelector('.detail-reset').emit('click');
  assert.deepEqual(f.panel.getRect(),{x:12,y:12,width:1256,height:497});
  f.root.querySelector('.detail-reset').emit('click');
  assert.deepEqual(f.panel.getRect(),{x:372,y:78,width:896,height:431});
});
