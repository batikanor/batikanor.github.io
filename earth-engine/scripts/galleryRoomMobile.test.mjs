import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createGalleryRoomPicker} from '../src/galleryRoomPicker.js';
import {sortAchievementsNewestFirst, getChronologyState} from '../src/chronology.js';
import {sortAchievementsByImportance} from '../src/achievementImportance.js';
import {readPortfolioRoute, portfolioUrl} from '../src/portfolioRoute.js';

const projects = JSON.parse(await readFile(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));
const recent = sortAchievementsNewestFirst(projects);
const source = await readFile(new URL('../src/galleryRoomMobile.js', import.meta.url), 'utf8');
const brandSource = await readFile(new URL('../src/brandLinks.js', import.meta.url), 'utf8');

// Actual controller and picker run against a DOM/event fixture. Media mounting
// and the optional globe are replaced; their real flow lifecycle is covered by
// galleryRoomMobileReading.test.mjs and galleryRoomGlobe.test.mjs respectively.
function fixture({href = 'https://staging.batikanor.com/', reducedMotion = false} = {}) {
  const frames = new Map(), observers = [], mutations = [], events = [], pushes = [], replaces = [], globeInstances = [], errors = [];
  let frameId = 0, content;
  class Target {
    constructor() {this.listeners = new Map();}
    addEventListener(type, callback, options) {
      if (options?.signal?.aborted) return;
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
      options?.signal?.addEventListener('abort', () => this.removeEventListener(type, callback), {once: true});
    }
    removeEventListener(type, callback) {this.listeners.get(type)?.delete(callback);}
    dispatch(type, details = {}) {
      const event = {target: this, preventDefault() {this.prevented = true;}, stopPropagation() {this.stopped = true;}, ...details};
      for (let target = this; target && !event.stopped; target = target.parentElement) {
        for (const callback of target.listeners?.get(type) ?? []) callback(event);
      }
      return event;
    }
  }
  const document = new Target();
  class Element extends Target {
    constructor(tag) {
      super();this.tagName = tag.toUpperCase();this.ownerDocument = document;this.children = [];this.attributes = new Map();
      this.dataset = {};this.style = {setProperty(name, value) {this[name] = value;}, removeProperty(name) {delete this[name];}};
      this.className = '';this.hidden = false;this.scrollTop = 0;this.scrollCalls = [];
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: (...names) => {this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' ');},
        remove: (...names) => {this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' ');},
        toggle: (name, force) => {const on = force ?? !this.classList.contains(name);this.classList[on ? 'add' : 'remove'](name);return on;}
      };
    }
    append(...children) {
      for (const child of children) {child.remove?.();this.children.push(child);child.parentElement = this;}
    }
    after(...children) {
      const parent = this.parentElement;if (!parent) return;
      for (const child of children) child.remove?.();
      parent.children.splice(parent.children.indexOf(this) + 1, 0, ...children);
      for (const child of children) child.parentElement = parent;
    }
    replaceChildren(...children) {for (const child of this.children) child.parentElement = null;this.children = [];this._text = '';this.append(...children);}
    set textContent(value) {this.replaceChildren();this._text = String(value);}
    get textContent() {return (this._text ?? '') + this.children.map(child => child.textContent).join('');}
    setAttribute(name, value) {this.attributes.set(name, String(value));}
    getAttribute(name) {return this.attributes.get(name) ?? null;}
    removeAttribute(name) {this.attributes.delete(name);}
    set hidden(value) {this._hidden = !!value;for (const observer of mutations) if (observer.target === this && !observer.disconnected) observer.callback();}
    get hidden() {return this._hidden;}
    contains(other) {for (let node = other; node; node = node.parentElement) if (node === this) return true;return false;}
    querySelector(selector) {
      return descendants(this).find(element => selector.startsWith('.') ? element.classList.contains(selector.slice(1))
        : selector.startsWith('#') ? element.id === selector.slice(1) : element.tagName.toLowerCase() === selector) ?? null;
    }
    closest(selectors) {
      return selectors.split(',').some(selector => selector.trim().toUpperCase() === this.tagName) ? this : this.parentElement?.closest(selectors) ?? null;
    }
    focus() {
      if (document.activeElement !== this && document.activeElement) document.dispatch('focusout', {target: document.activeElement});
      document.activeElement = this;this.focusCount = (this.focusCount ?? 0) + 1;document.dispatch('focusin', {target: this});
    }
    remove() {if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);this.parentElement = null;}
    scrollTo(options) {this.scrollCalls.push({...options});this.scrollTop = options.top;}
    getBoundingClientRect() {
      if (this.classList.contains('gallery-room-header')) return {top: 19, bottom: 47, left: 19, right: context.innerWidth - 19};
      if (this.classList.contains('gallery-room-mobile-flow')) return {top: 0, bottom: context.innerHeight, left: 0, right: context.innerWidth};
      if (this.dataset.gallerySurface) return {top: this.offset - content.flow.scrollTop, bottom: this.offset + 300 - content.flow.scrollTop};
      return {top: 0, bottom: 0, left: 0, right: 0};
    }
  }
  document.documentElement = new Element('html');document.documentElement.classList.add('gallery-pending', 'intro-active');
  document.body = new Element('body');document.activeElement = document.body;document.createElement = tag => new Element(tag);
  document.createElementNS = (_namespace, tag) => new Element(tag);
  const original = new Element('div');original.id = 'app';document.body.append(original);
  const descendants = host => host.children.flatMap(child => [child, ...descendants(child)]);
  document.getElementById = id => descendants(document.body).find(element => element.id === id) ?? null;
  const one = className => descendants(document.body).find(element => element.classList.contains(className));
  const all = className => descendants(document.body).filter(element => element.classList.contains(className));
  const window = new Target(), reduced = new Target();reduced.matches = reducedMotion;window.visualViewport = new Target();
  Object.assign(window.visualViewport, {height: 844, offsetTop: 0, scale: 1});document.defaultView = window;
  class IntersectionObserver {
    constructor(callback, options) {this.callback = callback;this.options = options;this.targets = new Set();observers.push(this);}
    observe(target) {this.targets.add(target);}
    disconnect() {this.disconnected = true;this.targets.clear();}
    reveal() {this.callback([{isIntersecting: true}]);}
  }
  class MutationObserver {
    constructor(callback) {this.callback = callback;mutations.push(this);}
    observe(target) {this.target = target;}
    disconnect() {this.disconnected = true;}
  }
  const context = vm.createContext({
    achievements: projects, sortAchievementsNewestFirst, getChronologyState, sortAchievementsByImportance, readPortfolioRoute, portfolioUrl,
    document, window, Element, AbortController, Event, IntersectionObserver, MutationObserver, innerWidth: 390, innerHeight: 844,
    location: {href}, matchMedia: () => reduced, console: {error: (...values) => errors.push(values)},
    addEventListener: (...args) => window.addEventListener(...args), dispatchEvent: event => {events.push(event.type);window.dispatch(event.type);},
    requestAnimationFrame: callback => {frames.set(++frameId, callback);return frameId;},cancelAnimationFrame: id => frames.delete(id),
    createGalleryRoomPicker,
    bindAchievementSummaryDownload() {},
    createGalleryRoomContent: options => {
      const {container, stations, onFocusSurface, onReturnToRoom} = options;
      const descriptors = new Map(stations.map(station => [station.slug, Object.fromEntries(['title', 'story', 'media-1', 'references'].map((kind, index) => {
        const element = new Element(kind === 'title' ? 'header' : 'article');element.dataset.gallerySurface = kind;element.offset = 92 + index * 420;
        element.dataset.gallerySlug = station.slug;
        return [kind, {slug: station.slug, kind, type: kind === 'media-1' ? 'media' : kind, element}];
      }))]));
      content = {options, stationSurfaces: descriptors, flow: container.parentElement, activeSlug: options.activeSlug,
        setActiveSlug(slug) {this.activeSlug = slug;container.replaceChildren(...Object.values(descriptors.get(slug)).map(item => item.element));},
        setFocusedSurface(kind) {this.focusKind = kind;},dispose() {this.disposed = true;},
        approach(kind) {onFocusSurface(descriptors.get(this.activeSlug)?.[kind]);},returnToRoom: onReturnToRoom};
      content.setActiveSlug(options.activeSlug);return content;
    },
    createGalleryRoomGlobe: ({container, initialSlug, onSelect}) => {
      const globe = {container, activeSlug: initialSlug, resizeCount: 0,
        setActive(slug) {this.activeSlug = slug;},resize() {this.resizeCount++;},dispose() {this.disposed = true;},
        choose: onSelect,getStats() {return {activeSlug: this.activeSlug};}};
      globeInstances.push(globe);return globe;
    }
  });
  context.history = {state: null,
    pushState(state, _title, url) {this.state = state;context.location.href = url.href ?? String(url);pushes.push({state, href: context.location.href});},
    replaceState(state, _title, url) {this.state = state;context.location.href = url.href ?? String(url);replaces.push({state, href: context.location.href});}};
  new vm.Script(brandSource.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).runInContext(context);
  new vm.Script(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).runInContext(context);
  return {context, document, window, original, frames, observers, mutations, events, pushes, replaces, globeInstances, errors, one, all, get content() {return content;},
    tick() {const callbacks = [...frames.values()];frames.clear();callbacks.forEach(callback => callback(0));},
    pop(href, state) {context.location.href = href;context.history.state = state;window.dispatch('popstate', {state});}};
}

test('deferred native gallery prepares readable cards without a room renderer, focus theft or input', async () => {
  const f = fixture(), beforeFocus = f.document.activeElement;
  const api = await f.context.startGalleryMobile({deferActivation: true});
  try {
    assert.equal(api.getStats().presentation, 'flow');assert.equal(api.getStats().active, false);assert.equal(api.root.inert, true);
    assert.equal(f.document.activeElement, beforeFocus);assert.equal(f.observers.length, 0);assert.equal(f.globeInstances.length, 0);
    assert.equal(f.content.options.presentation, 'flow');assert.equal(f.all('gallery-room-mobile-flow').length, 1);
    const dock = f.one('gallery-room-mobile-map'), host = f.one('gallery-room-mobile-content');
    assert.equal(host.children[1], dock);assert.equal(host.children[0].dataset.gallerySurface, 'title');
    f.one('gallery-room-arrow').dispatch('click');api.selectProject(recent[4].slug);f.content.approach('story');
    assert.equal(api.getStats().activeSlug, recent[0].slug);assert.equal(api.getStats().focusKind, null);assert.equal(f.pushes.length, 0);
    f.tick();f.tick();assert.deepEqual(f.events, ['gallery-room-ready']);assert.equal(api.getStats().frameCount, 2);
    assert.equal(api.getStats().render.calls, 0);assert.equal(api.getStats().render.triangles, 0);
    api.activate({eventSlug: recent[4].slug});assert.equal(api.getStats().activeSlug, recent[4].slug);
    assert.equal(host.children[1], dock);assert.equal(host.children[0].dataset.gallerySlug, recent[4].slug);
    assert.equal(api.root.inert, false);assert.equal(f.document.activeElement, api.flow);assert.equal(f.original.inert, true);
    assert.equal(f.document.documentElement.classList.contains('intro-active'), false);assert.equal(f.observers.length, 1);
    const focusCount = api.flow.focusCount;api.activate({eventSlug: recent[9].slug});assert.equal(api.flow.focusCount, focusCount);
    assert.equal(api.getStats().activeSlug, recent[4].slug);
  } finally {api.dispose();}
  assert.equal(f.frames.size, 0);assert.equal(f.context.window.__galleryRoom, undefined);
});

test('chronology resets forward reading and browser Back restores the exact prior scroll without extra history', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  try {
    const first = api.getStats().activeSlug;api.flow.scrollTop = 623;
    f.document.getElementById('gallery-next').dispatch('click');
    assert.equal(api.getStats().activeSlug, recent[1].slug);assert.equal(api.flow.scrollTop, 0);assert.equal(f.pushes.length, 1);
    const originalEntry = f.replaces.at(-1);assert.equal(originalEntry.state.galleryScrollTop, 623);
    api.flow.scrollTop = 988;f.pop(originalEntry.href, originalEntry.state);
    assert.equal(api.getStats().activeSlug, first);assert.equal(api.flow.scrollTop, 623);assert.equal(f.pushes.length, 1);
    const secondEntry = f.pushes[0];f.pop(secondEntry.href, secondEntry.state);
    assert.equal(api.getStats().activeSlug, recent[1].slug);assert.equal(api.flow.scrollTop, 0);
    const host = f.one('gallery-room-mobile-content');
    assert.equal(f.one('gallery-room-mobile-map').parentElement, host, 'the same globe remains inside the reading wall when project cards are replaced');
    assert.equal(host.children[1], f.one('gallery-room-mobile-map'), 'the map remains directly below the selected project title after Back');
    assert.equal(f.all('gallery-room-mobile-map').length, 1);
    assert.equal(f.content.stationSurfaces.get(first).story.element.parentElement, null, 'only the selected project is mounted');
  } finally {api.dispose();}
});

test('all mobile project walls keep the same map below the title through navigation, focus, sorting and Back', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  try {
    const host = f.one('gallery-room-mobile-content'), dock = f.one('gallery-room-mobile-map');
    const mount = f.one('gallery-room-globe-mount');
    const assertPlacement = () => {
      const surfaces = f.content.stationSurfaces.get(api.getStats().activeSlug);
      assert.deepEqual(host.children, [surfaces.title.element, dock, surfaces.story.element, surfaces['media-1'].element, surfaces.references.element]);
      assert.equal(api.flow.children.length, 1, 'the map has no separate trailing sibling');
      assert.equal(f.all('gallery-room-mobile-map').length, 1);assert.equal(f.all('gallery-room-globe-mount').length, 1);
      assert.equal(f.one('gallery-room-mobile-map'), dock);assert.equal(f.one('gallery-room-globe-mount'), mount);
    };
    assertPlacement();f.observers[0].reveal();const globe = api.globe;
    assert.equal(globe.container, mount);
    api.flow.scrollTop = 623;api.selectProject(recent[1].slug);const firstEntry = f.replaces.at(-1);
    for (const project of recent) {
      api.selectProject(project.slug);assertPlacement();
      assert.equal(api.globe, globe);assert.equal(globe.activeSlug, project.slug);
    }
    api.setSortMode('importance');assertPlacement();
    api.flow.scrollTop = 188;f.content.approach('story');assertPlacement();api.returnToRoom();assertPlacement();
    f.window.dispatch('resize');f.window.visualViewport.dispatch('resize');assertPlacement();
    f.pop(firstEntry.href, firstEntry.state);assertPlacement();
    assert.equal(api.flow.scrollTop, 623);assert.equal(api.globe, globe);assert.equal(globe.activeSlug, recent[0].slug);
    assert.equal(f.globeInstances.length, 1, 'the existing globe and listeners survive every project replacement');
  } finally {api.dispose();}
});

test('focus scrolls a full-width card below the header and return restores the first origin across next-card and resize', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  try {
    api.flow.scrollTop = 185;f.content.approach('story');
    assert.equal(api.getStats().focusOrigin, 185);assert.equal(api.getStats().focusKind, 'story');
    assert.equal(api.flow.scrollTop, 419, 'story top is offset below header and return controls');
    assert.equal(api.flow.scrollCalls.at(-1).behavior, 'smooth');
    assert.equal(f.one('gallery-room-return').hidden, false);
    const count = api.flow.scrollCalls.length;f.content.approach('story');
    assert.equal(api.flow.scrollCalls.length, count, 'a second click never restarts the same focus');
    api.flow.scrollTop = 454;f.content.approach('media-1');assert.equal(api.getStats().focusOrigin, 185);
    assert.equal(api.flow.scrollTop, 839);f.window.dispatch('resize');f.window.visualViewport.dispatch('resize');
    assert.equal(api.flow.scrollTop, 839, 'browser chrome/orientation does not refit a camera or reset reading');
    f.one('gallery-room-return').dispatch('click');assert.equal(api.flow.scrollTop, 185);assert.equal(api.getStats().focusKind, null);
    assert.equal(f.one('gallery-room-return').hidden, true);assert.equal(f.content.focusKind, null);
    f.one('gallery-room-return').dispatch('click');assert.equal(api.flow.scrollTop, 185);
  } finally {api.dispose();}
});

test('reduced motion focus is immediate and Escape restores reading without intercepting native arrow controls', async () => {
  const f = fixture({reducedMotion: true}), api = await f.context.startGalleryMobile();
  try {
    api.flow.scrollTop = 75;f.content.approach('references');assert.equal(api.flow.scrollCalls.at(-1).behavior, 'instant');
    const escaped = f.window.dispatch('keydown', {key: 'Escape', target: api.flow});assert.equal(escaped.prevented, true);assert.equal(api.flow.scrollTop, 75);
    const slug = api.getStats().activeSlug;
    f.window.dispatch('keydown', {key: 'ArrowRight', target: f.one('gallery-room-selector-button')});assert.equal(api.getStats().activeSlug, slug);
    f.window.dispatch('keydown', {key: 'ArrowRight', target: api.flow});assert.equal(api.getStats().activeSlug, recent[1].slug);
  } finally {api.dispose();}
});

test('Back restores an approached media card and its original Return position before reading continues', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  try {
    api.flow.scrollTop = 164;f.content.approach('media-1');api.flow.scrollTop = 871;
    api.selectProject(recent[2].slug);const prior = f.replaces.at(-1);
    assert.equal(prior.state.galleryFocus, 'media-1');assert.equal(prior.state.galleryFocusOrigin, 164);
    f.pop(prior.href, prior.state);
    assert.equal(api.getStats().focusKind, 'media-1');assert.equal(api.flow.scrollTop, 871);
    assert.equal(f.content.focusKind, 'media-1');api.returnToRoom();assert.equal(api.flow.scrollTop, 164);
  } finally {api.dispose();}
});

test('native importance picker keeps fractional stars, selection, focus and reading position while changing navigation order', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  try {
    api.selectProject(recent[4].slug);api.flow.scrollTop = 722;
    const current = api.getStats().activeSlug, toggle = f.one('gallery-room-sort-button');toggle.focus();toggle.dispatch('click');
    const important = sortAchievementsByImportance(recent);
    assert.equal(api.getStats().sortMode, 'importance');assert.equal(api.getStats().activeSlug, current);assert.equal(api.flow.scrollTop, 722);
    assert.equal(f.document.activeElement, toggle);assert.equal(f.all('gallery-room-picker-stars').length, 32);
    assert.equal(f.all('gallery-room-picker-star-fill').length, 160);
    assert.deepEqual([...api.getStats().projectOrder], important.map(project => project.slug));
    const index = important.findIndex(project => project.slug === current);
    assert.equal(f.one('gallery-room-current-number').textContent, String(index + 1));
    if (important[index + 1]) {f.document.getElementById('gallery-next').dispatch('click');assert.equal(api.getStats().activeSlug, important[index + 1].slug);}
  } finally {api.dispose();}
});

test('the shared globe creates lazily, follows navigation and cancels late reveals after disposal', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  try {
    assert.equal(f.globeInstances.length, 0);assert.equal(f.observers[0].options.root, api.flow);
    api.selectProject(recent[3].slug);f.observers[0].reveal();assert.equal(f.globeInstances.length, 1);
    assert.equal(api.globe.activeSlug, recent[3].slug);f.observers[0].reveal();assert.equal(f.globeInstances.length, 1);
    api.globe.choose(recent[8].slug);assert.equal(api.getStats().activeSlug, recent[8].slug);assert.equal(api.flow.scrollTop, 0);
    f.window.dispatch('resize');assert.equal(api.globe.resizeCount, 1);
  } finally {api.dispose();}
  assert.equal(f.globeInstances[0].disposed, true);f.observers[0].reveal();assert.equal(f.globeInstances.length, 1);
  const deferred = fixture(), prepared = await deferred.context.startGalleryMobile({deferActivation: true});prepared.activate();
  const observer = deferred.observers[0];prepared.dispose();observer.reveal();assert.equal(deferred.globeInstances.length, 0);
});

test('unlock starts one optional spatial handoff and a rejected handoff leaves native reading usable', async () => {
  const f = fixture();let handoffs = 0, reject;
  const api = await f.context.startGalleryMobile({onExploreRoom: () => {handoffs++;return new Promise((_resolve, fail) => {reject = fail;});}});
  try {
    const lock = f.document.getElementById('gallery-view-lock'), handoff = api.setViewLocked(false);lock.dispatch('click');lock.dispatch('click');
    assert.equal(handoffs, 1);assert.equal(lock.disabled, true);assert.equal(api.getStats().transitioning, true);
    reject(new Error('GPU unavailable'));await handoff;
    assert.equal(lock.disabled, false);assert.equal(api.getStats().transitioning, false);assert.equal(api.getStats().viewLocked, true);
    api.selectProject(recent[2].slug);assert.equal(api.getStats().activeSlug, recent[2].slug);assert.equal(f.errors.length, 1);
  } finally {api.dispose();}
});

test('the achievement chooser follows the iPhone/Android keyboard without moving reading or compensating pinch zoom', async () => {
  const f = fixture(), api = await f.context.startGalleryMobile();
  const visible = f.window.visualViewport, root = api.root;
  try {
    api.flow.scrollTop = 482;
    assert.equal(root.style['--gallery-mobile-keyboard'], '0px');assert.equal(root.style['--gallery-mobile-visual-height'], '844px');
    f.one('gallery-room-selector-button').dispatch('click');
    assert.equal(f.document.activeElement, f.one('gallery-room-picker-search'));
    visible.height = 430;visible.dispatch('resize');
    assert.equal(root.style['--gallery-mobile-keyboard'], '414px');assert.equal(root.style['--gallery-mobile-visual-height'], '430px');
    assert.equal(api.flow.scrollTop, 482, 'showing a keyboard never scrolls the project underneath');
    visible.offsetTop = 20;visible.dispatch('scroll');assert.equal(root.style['--gallery-mobile-keyboard'], '394px');
    visible.scale = 1.4;visible.height = 310;visible.dispatch('resize');
    assert.equal(root.style['--gallery-mobile-keyboard'], '0px');assert.equal(root.style['--gallery-mobile-visual-height'], '844px');
    visible.scale = 1;visible.height = 430;visible.dispatch('resize');assert.equal(root.style['--gallery-mobile-keyboard'], '394px');
    // Clicking outside can close a chooser before its hidden search loses focus.
    f.document.dispatch('pointerdown', {target: api.flow});
    assert.equal(f.one('gallery-room-picker').hidden, true);assert.equal(f.document.activeElement, f.one('gallery-room-picker-search'));
    assert.equal(root.style['--gallery-mobile-keyboard'], '0px', 'hidden picker observation clears compensation immediately');
    f.one('gallery-room-selector-button').dispatch('click');assert.equal(root.style['--gallery-mobile-keyboard'], '394px');
    api.flow.focus();assert.equal(root.style['--gallery-mobile-keyboard'], '0px');f.tick();assert.equal(root.style['--gallery-mobile-keyboard'], '0px');
    assert.equal(api.flow.scrollTop, 482);
  } finally {api.dispose();}
  assert.equal(root.style['--gallery-mobile-keyboard'], undefined);assert.equal(root.style['--gallery-mobile-visual-height'], undefined);
  assert.equal(f.mutations[0].disconnected, true);assert.equal(visible.listeners.get('scroll').size, 0);assert.equal(f.document.listeners.get('focusin').size, 0);
  visible.height = 300;visible.dispatch('resize');assert.equal(root.style['--gallery-mobile-keyboard'], undefined);
});

test('deep links, bare URL Back and BFCache retain the intended project and native scroll; disposal removes global listeners', async () => {
  const f = fixture({href: `https://staging.batikanor.com/#${recent[5].slug}`}), api = await f.context.startGalleryMobile();
  assert.equal(api.getStats().activeSlug, recent[5].slug);
  api.flow.scrollTop = 411;f.window.dispatch('pagehide', {persisted: true});
  assert.equal(api.getStats().disposed, false);assert.equal(f.replaces.at(-1).state.galleryScrollTop, 411);
  api.setSortMode('importance');f.pop('https://staging.batikanor.com/', null);
  assert.equal(api.getStats().activeSlug, recent[0].slug);assert.equal(api.getStats().sortMode, 'importance');
  const next = f.document.getElementById('gallery-next');api.dispose();api.dispose();next.dispatch('click');api.selectProject(recent[9].slug);
  assert.equal(api.getStats().activeSlug, recent[0].slug);assert.equal(f.frames.size, 0);
  assert.equal(f.window.listeners.get('popstate').size, 0);assert.equal(f.window.visualViewport.listeners.get('resize').size, 0);
  assert.equal(f.original.inert, false);assert.equal(f.document.body.classList.contains('gallery-room-active'), false);
});
