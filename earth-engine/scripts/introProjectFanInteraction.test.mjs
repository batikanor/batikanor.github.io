import test from 'node:test';
import assert from 'node:assert/strict';
import {mountIntroProjectFan} from '../src/introProjectFan.js';
import {LIVE_PROJECTS} from '../src/liveProjectsData.js';

// A small native-event fixture keeps capture/bubbling, link default behavior,
// pointer capture and retained DOM identity observable without a browser shim.
function fixture({width = 280, captureThrows = false} = {}) {
  const targets = [];
  class Target {
    constructor() {this.listeners = new Map();this.parentElement = null;targets.push(this);}
    addEventListener(type, callback, options = {}) {
      const capture = typeof options === 'boolean' ? options : !!options.capture;
      const list = this.listeners.get(type) || [];
      if (!list.some(item => item.callback === callback && item.capture === capture)) {
        list.push({callback, capture, once: !!options.once, passive: !!options.passive});
        this.listeners.set(type, list);
      }
    }
    removeEventListener(type, callback, options = {}) {
      const capture = typeof options === 'boolean' ? options : !!options.capture;
      this.listeners.set(type, (this.listeners.get(type) || [])
        .filter(item => item.callback !== callback || item.capture !== capture));
    }
    dispatch(type, values = {}) {
      const event = {type, target: this, bubbles: true, cancelable: true, detail: 1,
        pointerId: 7, pointerType: 'mouse', isPrimary: true, button: 0,
        buttons: type === 'pointerup' ? 0 : 1, clientX: 200, clientY: 100,
        defaultPrevented: false, stopped: false, immediate: false,
        preventDefault() {if (this.cancelable && !this.passive) this.defaultPrevented = true;},
        stopPropagation() {this.stopped = true;},
        stopImmediatePropagation() {this.stopped = true;this.immediate = true;}, ...values};
      const path = [];for (let node = this; node; node = node.parentElement) path.push(node);
      const invoke = (node, capture) => {
        event.currentTarget = node;
        for (const item of [...(node.listeners.get(type) || [])]) {
          if (item.capture !== capture) continue;
          event.passive = item.passive;item.callback(event);event.passive = false;
          if (item.once) node.removeEventListener(type, item.callback, {capture});
          if (event.immediate) break;
        }
      };
      for (const node of [...path].reverse()) {invoke(node, true);if (event.stopped) return event;}
      for (const node of path) {invoke(node, false);if (event.stopped || !event.bubbles) break;}
      return event;
    }
  }
  const host = new Target(), document = new Target();document.parentElement = host;
  document.defaultView = host;document.activeElement = null;host.document = document;
  const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  class Element extends Target {
    constructor(tag, className = '') {
      super();this.tagName = tag.toUpperCase();this.className = className;
      this.children = [];this.dataset = {};this.attributes = new Map();this.ownerDocument = document;
      this.captured = new Set();this.captureLog = [];this.clientWidth = width;
      this.disabled = false;this.style = {setProperty(name, value) {this[name] = String(value);},
        removeProperty(name) {delete this[name];}};
      this.classList = {contains: name => this.className.split(/\s+/).includes(name),
        add: name => {if (!this.classList.contains(name)) this.className += ' ' + name;},
        remove: name => {this.className = this.className.split(/\s+/).filter(c => c !== name).join(' ');},
        toggle: (name, force) => {const on = force ?? !this.classList.contains(name);
          this.classList[on ? 'add' : 'remove'](name);return on;}};
    }
    append(...children) {for (const child of children) {this.children.push(child);child.parentElement = this;}}
    setAttribute(name, value) {this.attributes.set(name, String(value));if (name.startsWith('data-')) this.dataset[dataKey(name)] = String(value);}
    getAttribute(name) {return name.startsWith('data-') ? this.dataset[dataKey(name)] ?? null : this.attributes.get(name) ?? null;}
    removeAttribute(name) {this.attributes.delete(name);if (name.startsWith('data-')) delete this.dataset[dataKey(name)];}
    matches(selector) {
      return selector.split(',').some(part => {
        part = part.trim();const tag = /^[a-z]+/i.exec(part)?.[0];
        if (tag && tag.toUpperCase() !== this.tagName) return false;
        for (const [, name] of part.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(name)) return false;
        for (const [, name, value] of part.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)) {
          const actual = this.getAttribute(name);if (actual == null || value != null && actual !== value) return false;
        }
        return true;
      });
    }
    querySelectorAll(selector) {return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child => child.matches(selector));}
    querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
    closest(selector) {for (let node = this; node instanceof Element; node = node.parentElement) if (node.matches(selector)) return node;return null;}
    contains(child) {for (let node = child; node; node = node.parentElement) if (node === this) return true;return false;}
    focus() {document.activeElement = this;}
    setPointerCapture(id) {if (captureThrows) throw Error('capture unavailable');this.captured.add(id);this.captureLog.push(['set', id]);}
    hasPointerCapture(id) {return this.captured.has(id);}
    releasePointerCapture(id) {this.captured.delete(id);this.captureLog.push(['release', id]);}
    getBoundingClientRect() {return {left: 0, top: 0, width: this.clientWidth, height: 260, right: this.clientWidth, bottom: 260};}
  }
  const fan = new Element('div', 'intro-project-fan');fan.parentElement = document;
  const link = new Element('a');link.setAttribute('href', '/?view=live-projects');
  const cards = LIVE_PROJECTS.map((project, index) => {
    const node = new Element('div', 'intro-project-window');
    node.dataset.project = project.id;node.dataset.projectName = project.name;
    node.dataset.front = String(index === 0);node.dataset.slot = String(index === 0 ? 3 : index - 1);
    const surface = new Element('button', 'intro-project-surface');surface.dataset.selectProject = project.id;
    surface.setAttribute('aria-pressed', String(index === 0));
    const header = new Element('div', 'intro-project-header'), body = new Element('div', 'intro-project-body');
    const logo = new Element('a', 'intro-project-open'), logoChild = new Element('span', 'intro-project-logo-copy');
    logo.setAttribute('href', `/?view=live-projects&project=${project.id}`);logo.append(logoChild);body.append(logo);
    const domain = new Element('a', 'intro-project-domain');domain.setAttribute('href', project.url);
    node.append(surface, header, body, domain);fan.append(node);
    return {node, surface, header, body, logo, logoChild, domain, project};
  });
  document.getElementById = id => id === 'intro-live-projects' ? link : id === 'intro-project-fan' ? fan : null;
  const listenerCount = () => targets.reduce((n, target) => n + [...target.listeners.values()].reduce((sum, items) => sum + items.length, 0), 0);
  const mount = () => mountIntroProjectFan(fan, {link, window: host});
  const start = (target = cards[0].surface, values = {}) => target.dispatch('pointerdown', values);
  const move = (dx, dy = 0, values = {}) => fan.dispatch('pointermove', {clientX: 200 + dx, clientY: 100 + dy, ...values});
  const finish = (values = {}) => host.dispatch('pointerup', values);
  return {host, document, fan, link, cards, mount, listenerCount, start, move, finish, Element};
}

function selected(f, api, id) {
  assert.equal(api.selectedId, id);
  assert.deepEqual(f.cards.filter(card => card.node.dataset.front === 'true').map(card => card.project.id), [id]);
  assert.deepEqual(f.cards.filter(card => card.surface.getAttribute('aria-pressed') === 'true').map(card => card.project.id), [id]);
  assert.deepEqual(f.cards.map(card => Number(card.node.dataset.slot)).sort(), [0, 1, 2, 3]);
  assert.equal(f.cards.find(card => card.project.id === id).node.dataset.slot, '3');
  assert.equal(new URL(f.link.getAttribute('href'), 'https://staging.batikanor.com/').searchParams.get('project'), id);
  assert.equal(f.link.getAttribute('aria-label'), `Explore live projects — ${f.cards.find(c => c.project.id === id).project.name}`);
}

test('selection normalizes all four cards and CTA while retaining DOM, links and native focus', () => {
  const f = fixture(), original = [...f.fan.children], anchors = f.cards.flatMap(c => [c.logo, c.domain]);
  const api = mountIntroProjectFan(f.fan), count = f.listenerCount();
  assert.equal(f.mount(), api, 'mounting the same fan reuses one controller');assert.equal(f.listenerCount(), count);
  f.cards[1].logo.focus();
  for (const {project} of f.cards) {
    assert.equal(api.select(project.id), true);selected(f, api, project.id);
    assert.deepEqual(f.fan.children, original);assert.equal(f.document.activeElement, f.cards[1].logo);
    assert.deepEqual(f.cards.flatMap(c => [c.logo, c.domain]), anchors);
  }
  assert.equal(api.select('unknown'), false);selected(f, api, 'gralobe');
  assert.equal(api.select('gralobe'), true);assert.equal(f.listenerCount(), count);api.dispose();
  assert.equal(mountIntroProjectFan(null), null);
});

test('a bare-card button selects while logo, nested logo content and URL keep native navigation defaults', () => {
  const f = fixture(), api = f.mount();
  f.cards[2].surface.dispatch('click');selected(f, api, 'cottbus');
  for (const target of [f.cards[1].logo, f.cards[1].logoChild, f.cards[1].domain]) {
    assert.equal(target.dispatch('click').defaultPrevented, false, 'native anchors navigate instead of selecting');
    selected(f, api, 'cottbus');
  }
  f.cards[3].surface.dispatch('click', {ctrlKey: true});selected(f, api, 'cottbus');api.dispose();
});

test('horizontal touch movement claims only after intent, cycles repeatedly and reverses without navigation', () => {
  const f = fixture(), api = f.mount();
  f.start(f.cards[0].logo, {pointerType: 'touch'});
  assert.equal(f.move(-7, 0, {pointerType: 'touch'}).defaultPrevented, false);selected(f, api, 'maptheory');
  assert.equal(f.fan.captureLog.length, 0, 'native pan is available before intent');
  assert.equal(f.move(-40, 1, {pointerType: 'touch'}).defaultPrevented, true);selected(f, api, 'space-cottbus');
  assert.equal(f.fan.hasPointerCapture(7), true);
  f.move(-83, 1, {pointerType: 'touch'});selected(f, api, 'cottbus');
  f.move(-126, 1, {pointerType: 'touch'});selected(f, api, 'gralobe');
  f.move(-168, 1, {pointerType: 'touch'});selected(f, api, 'maptheory');
  f.move(-42, 1, {pointerType: 'touch'});selected(f, api, 'space-cottbus');
  f.move(42, 1, {pointerType: 'touch'});selected(f, api, 'gralobe');
  f.finish({pointerType: 'touch'});assert.equal(f.fan.hasPointerCapture(7), false);
  for (const target of [f.cards[0].surface, f.cards[0].logo, f.cards[0].domain]) {
    assert.equal(target.dispatch('click').defaultPrevented, true, 'the moved pointer cannot click through to an action');
    selected(f, api, 'gralobe');
  }
  api.dispose();
});

test('held mouse drag continues outside the fan, and unavailable capture still finishes safely', () => {
  for (const captureThrows of [false, true]) {
    const f = fixture({captureThrows}), api = f.mount();f.start();
    const outside = f.host.dispatch('pointermove', {clientX: 117, clientY: 101, buttons: 1});
    assert.equal(outside.defaultPrevented, true);selected(f, api, 'cottbus');
    f.finish();assert.equal(f.fan.hasPointerCapture(7), false);
    assert.equal(f.cards[1].logo.dispatch('click').defaultPrevented, true);
    f.start();f.move(-42, 0, {buttons: 0});selected(f, api, 'cottbus');
    assert.equal(f.fan.hasPointerCapture(7), false, 'a released mouse is never interpreted as held dragging');
    api.dispose();
  }
});

test('vertical page movement, pinch and diagonal movement preserve native pan and suppress moved-pointer clicks', () => {
  for (const [dx, dy] of [[2, 40], [10, 12], [0, -35]]) {
    const f = fixture(), api = f.mount();f.start(f.cards[0].logo, {pointerType: 'touch'});
    assert.equal(f.move(dx, dy, {pointerType: 'touch'}).defaultPrevented, false);
    f.move(-90, dy, {pointerType: 'touch'});selected(f, api, 'maptheory');
    assert.equal(f.fan.captureLog.length, 0);f.finish({pointerType: 'touch'});
    assert.equal(f.cards[0].logo.dispatch('click').defaultPrevented, true);api.dispose();
  }
  const f = fixture(), api = f.mount();f.start(f.cards[0].surface, {pointerType: 'touch'});f.move(-42, 0, {pointerType: 'touch'});
  const second = f.host.dispatch('pointerdown', {pointerId: 8, pointerType: 'touch', isPrimary: false});
  assert.equal(second.defaultPrevented, false, 'the second pinch contact remains native');
  assert.equal(f.fan.hasPointerCapture(7), false);f.move(-126, 0, {pointerType: 'touch'});selected(f, api, 'space-cottbus');
  assert.equal(f.cards[1].domain.dispatch('click').defaultPrevented, true);api.dispose();
});

test('a tap remains a tap and a new primary activation clears an earlier swipe guard', () => {
  const f = fixture(), api = f.mount();f.start(f.cards[2].surface);f.move(3, 2);f.finish();
  f.cards[2].surface.dispatch('click');selected(f, api, 'cottbus');
  f.start();f.move(-42);f.finish();selected(f, api, 'gralobe');
  f.start(f.cards[1].logo);f.finish();assert.equal(f.cards[1].logo.dispatch('click').defaultPrevented, false);
  selected(f, api, 'gralobe');
  f.start();f.move(-42);f.finish();
  f.start(f.cards[1].domain, {ctrlKey: true});
  assert.equal(f.cards[1].domain.dispatch('click', {ctrlKey: true}).defaultPrevented, false,
    'a fresh modified URL activation remains a normal browser action');
  api.dispose();
});

test('a displaced release with no move event cannot turn into a native link click or card selection', () => {
  for (const release of [{clientX: 160, clientY: 100}, {clientX: 200, clientY: 140}]) {
    const f = fixture(), api = f.mount();f.start(f.cards[2].logo, {pointerType: 'touch'});
    assert.equal(f.finish({...release, pointerType: 'touch'}).defaultPrevented, false,
      'release does not retroactively claim native panning');
    selected(f, api, 'maptheory');assert.equal(f.fan.captureLog.length, 0);
    assert.equal(f.cards[2].logo.dispatch('click').defaultPrevented, true);
    assert.equal(f.cards[2].surface.dispatch('click').defaultPrevented, true);selected(f, api, 'maptheory');
    assert.equal(f.cards[2].logo.dispatch('click', {detail: 0}).defaultPrevented, false,
      'keyboard activation remains available after the guarded pointer release');
    api.dispose();
  }
});

test('secondary, non-primary and modified pointers cannot start browsing', () => {
  for (const values of [{button: 2, buttons: 2}, {isPrimary: false}, {ctrlKey: true}, {metaKey: true}, {altKey: true}, {shiftKey: true}]) {
    const f = fixture(), api = f.mount();const down = f.start(f.cards[0].surface, values);
    assert.equal(down.defaultPrevented, false);assert.equal(f.move(-100).defaultPrevented, false);
    f.finish();selected(f, api, 'maptheory');assert.equal(f.fan.captureLog.length, 0);api.dispose();
  }
});

test('modifier changes and extra mouse buttons cancel an active drag without additional browsing', () => {
  for (const values of [{ctrlKey: true}, {metaKey: true}, {altKey: true}, {shiftKey: true}, {buttons: 3}, {buttons: 2}]) {
    const f = fixture(), api = f.mount();f.start();f.move(-42);selected(f, api, 'space-cottbus');
    assert.equal(f.move(-126, 0, values).defaultPrevented, false);
    assert.equal(f.fan.hasPointerCapture(7), false);f.move(-168);selected(f, api, 'space-cottbus');
    assert.equal(f.cards[2].domain.dispatch('click').defaultPrevented, true);api.dispose();
  }
});

test('unrelated pointer identities cannot move or finish an existing drag', () => {
  const f = fixture(), api = f.mount();f.start();
  f.move(-100, 0, {pointerId: 91});f.finish({pointerId: 91});selected(f, api, 'maptheory');
  f.move(-42);selected(f, api, 'space-cottbus');f.finish();api.dispose();
});

test('pointer cancellation, capture loss, resize, blur and explicit cancel clear dragging without click-through', () => {
  for (const end of [f => f.fan.dispatch('pointercancel'), f => f.fan.dispatch('lostpointercapture'),
    f => f.host.dispatch('resize'), f => f.host.dispatch('blur'), (f, api) => api.cancelGesture()]) {
    const f = fixture(), api = f.mount();f.start();f.move(-42);selected(f, api, 'space-cottbus');end(f, api);
    assert.equal(f.fan.hasPointerCapture(7), false);assert.equal(f.fan.dataset.dragging, 'false');
    assert.equal(f.fan.style['--fan-pull-x'], undefined);f.move(-126);selected(f, api, 'space-cottbus');
    assert.equal(f.cards[2].logo.dispatch('click').defaultPrevented, true);api.dispose();
  }
});

test('keyboard surface actions browse and focus deliberately while native link and Enter/Space defaults survive a swipe', () => {
  const f = fixture(), api = f.mount();f.start();f.move(-42);f.finish();
  for (const target of [f.cards[2].logo, f.cards[2].domain]) {
    target.focus();assert.equal(target.dispatch('keydown', {key: 'ArrowRight'}).defaultPrevented, false);
    assert.equal(target.dispatch('click', {detail: 0}).defaultPrevented, false);selected(f, api, 'space-cottbus');
  }
  f.cards[2].surface.focus();
  assert.equal(f.cards[2].surface.dispatch('keydown', {key: 'Enter'}).defaultPrevented, false);
  f.cards[2].surface.dispatch('click', {detail: 0});selected(f, api, 'cottbus');
  for (const [index, key, id] of [[2, 'ArrowRight', 'gralobe'], [3, 'ArrowLeft', 'cottbus'], [2, 'Home', 'maptheory'], [0, 'End', 'gralobe']]) {
    assert.equal(f.cards[index].surface.dispatch('keydown', {key}).defaultPrevented, true);selected(f, api, id);
    assert.equal(f.document.activeElement, f.cards.find(c => c.project.id === id).surface);
  }
  assert.equal(f.cards[0].surface.dispatch('keydown', {key: ' ', detail: 0}).defaultPrevented, false);
  assert.equal(f.cards[0].surface.dispatch('keydown', {key: 'ArrowRight', ctrlKey: true}).defaultPrevented, false);
  api.dispose();
});

test('BFCache page hiding cancels gestures while final pagehide/dispose clean all listeners and permit remount', () => {
  const f = fixture(), api = f.mount(), count = f.listenerCount();assert.ok(count > 0);
  f.start();f.move(-42);f.host.dispatch('pagehide', {persisted: true});
  assert.equal(f.fan.hasPointerCapture(7), false);assert.equal(f.listenerCount(), count);
  f.start(f.cards[2].surface);f.finish();f.cards[2].surface.dispatch('click');selected(f, api, 'cottbus');
  f.host.dispatch('pagehide', {persisted: false});assert.equal(f.listenerCount(), 0);
  f.cards[0].surface.dispatch('click');assert.equal(api.selectedId, 'cottbus');api.dispose();api.dispose();
  const fresh = f.mount();assert.notEqual(fresh, api);assert.equal(f.listenerCount(), count);selected(f, fresh, 'cottbus');
  f.cards[3].surface.dispatch('click');selected(f, fresh, 'gralobe');fresh.dispose();assert.equal(f.listenerCount(), 0);
});

test('the fan prevents browser image dragging without intercepting native link clicks', () => {
  const f = fixture(), api = f.mount();
  assert.equal(f.cards[0].logoChild.dispatch('dragstart').defaultPrevented, true);
  assert.equal(f.cards[0].logo.dispatch('click').defaultPrevented, false);api.dispose();
});
