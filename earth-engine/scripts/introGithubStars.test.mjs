import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {mountGithubStars} from '../src/githubStars.js';
import {LIVE_PROJECTS} from '../src/liveProjectsData.js';
import {GITHUB_STARS_URL} from '../src/githubStarsData.js';

const fanSource = readFileSync(new URL('../src/introProjectFan.js', import.meta.url), 'utf8')
  .replace(/^import .*;\n/gm, '').replace('export function mountIntroProjectFan', 'function mountIntroProjectFan');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const badgeMarkup = html.match(/<a class="intro-project-stars\b[^>]*>/)?.[0];
assert.ok(badgeMarkup, 'the entrance contains the native GitHub pennant');
const badgeAttrs = Object.fromEntries([...badgeMarkup.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
const settle = () => new Promise(resolve => setImmediate(resolve));
const endpoint = GITHUB_STARS_URL;
const snapshot = {full_name: 'batikanor/gralobe', stargazers_count: 126, verified_at: '2026-10-27T09:00:00Z'};
const reply = (count, verifiedAt = '2026-10-27T10:00:00Z') => ({ok: true,
  json: async () => ({full_name: 'batikanor/gralobe', stargazers_count: count, verified_at: verifiedAt})});

// Real fan and GitHub updater, with native nodes/events and a virtual clock.
// Multiple listeners on the same event matter when the fan disposes an updater
// during pagehide and recreates it during BFCache pageshow.
function fixture({storage = new Map(), startAt = '2026-10-27T10:00:00Z'} = {}) {
  const targets = [], requests = [], timers = new Map();
  let time = Date.parse(startAt), nextTimer = 0;
  class Target {
    constructor() {this.listeners = new Map();targets.push(this);}
    addEventListener(type, handler) {
      const list = this.listeners.get(type) || new Set();list.add(handler);this.listeners.set(type, list);
    }
    removeEventListener(type, handler) {this.listeners.get(type)?.delete(handler);}
    dispatch(type, values = {}) {
      const event = {type, target: this, detail: 0, defaultPrevented: false,
        preventDefault() {this.defaultPrevented = true;}, stopPropagation() {}, stopImmediatePropagation() {}, ...values};
      for (let node = this; node; node = node.parentElement) {
        for (const handler of [...(node.listeners.get(type) || [])]) {
          if (node.listeners.get(type)?.has(handler)) handler(event);
        }
      }
      return event;
    }
  }
  const host = new Target(), document = new Target();
  document.defaultView = host;document.visibilityState = 'visible';host.document = document;
  host.localStorage = {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)};
  host.setTimeout = (handler, delay) => {const id = ++nextTimer;timers.set(id, {handler, due: time + delay});return id;};
  host.clearTimeout = id => timers.delete(id);
  class Element extends Target {
    constructor(className = '') {
      super();this.className = className;this.dataset = {};this.children = [];this.attributes = new Map();
      this.ownerDocument = document;this.isConnected = true;this.textContent = '';this.title = '';
      this.style = {removeProperty() {}};
    }
    append(...children) {for (const child of children) {this.children.push(child);child.parentElement = this;}}
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
    getAttribute(name) {return this.attributes.get(name) ?? null;}
    querySelectorAll(selector) {
      return this.children.flatMap(child => [child, ...child.querySelectorAll('*')]).filter(child =>
        selector === '*' || [...selector.matchAll(/\.([\w-]+)/g)].every(([, name]) => child.className.split(' ').includes(name)) &&
        (!selector.includes('[data-project]') || child.dataset.project));
    }
    querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;}
  }
  const fan = new Element('intro-project-fan'), link = new Element();
  const cards = LIVE_PROJECTS.map((project, index) => {
    const node = new Element('intro-project-window');node.dataset.project = project.id;node.dataset.projectName = project.name;
    node.dataset.front = String(index === 0);
    const surface = new Element('intro-project-surface'), logo = new Element('intro-project-open');
    logo.setAttribute('href', `/?view=live-projects&project=${project.id}`);
    node.append(surface, logo);fan.append(node);return {node, surface, logo, project};
  });
  const stars = new Element(badgeAttrs.class), brand = new Element('stat-pennant-brand');
  const value = new Element('stat-pennant-value'), count = new Element('stat-pennant-number'), label = new Element('stat-pennant-label');
  for (const [name, attr] of Object.entries(badgeAttrs)) stars.setAttribute(name, attr);
  count.textContent = '…';label.textContent = 'stars';value.append(count);stars.append(brand, value, label);
  cards.find(card => card.project.id === 'gralobe').node.append(stars);
  document.getElementById = () => link;
  const fetcher = (url, options) => new Promise((resolve, reject) => requests.push({url, options, resolve, reject}));
  const context = vm.createContext({mountNpmDownloads: () => null,
    mountGithubStars: node => mountGithubStars(node, {fetch: fetcher, now: () => time, snapshot, endpoint}),
  });
  vm.runInContext(`${fanSource}\nthis.mount = mountIntroProjectFan;`, context);
  const mount = () => context.mount(fan, {link, window: host}), api = mount();
  const advance = async ms => {
    time += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.due <= time && timers.delete(id)) timer.handler();
    }
    await settle();
  };
  const listenerCount = () => targets.reduce((sum, target) => sum + [...target.listeners.values()].reduce((n, list) => n + list.size, 0), 0);
  return {api, mount, fan, host, document, link, cards, stars, brand, value, count, label, requests, timers, storage, advance, listenerCount};
}

test('the entrance fetches and refreshes GitHub stars without replacing pennant branding, links or fan selection', async () => {
  const f = fixture(), children = [...f.stars.children];
  try {
    assert.equal(f.requests.length, 1);
    assert.equal(f.requests[0].url, endpoint);
    assert.equal(f.requests[0].options.cache, 'no-cache');
    assert.equal(f.count.textContent, '126', 'the verified bundled snapshot is visible before the feed responds');
    f.requests[0].resolve(reply(126));await settle();
    assert.equal(f.count.textContent, '126');assert.equal(f.stars.dataset.githubState, 'fresh');
    f.api.select('cottbus');
    const selectedHref = f.link.getAttribute('href');
    await f.advance(120000);
    assert.equal(f.requests.length, 2, 'the entrance refreshes during a long visit');
    f.requests[1].resolve(reply(127, '2026-10-27T10:02:00Z'));await settle();
    assert.equal(f.count.textContent, '127');assert.match(f.stars.getAttribute('aria-label'), /127 GitHub stars/);
    assert.deepEqual(f.stars.children, children);assert.equal(f.stars.children[0], f.brand);
    assert.equal(f.label.textContent, 'stars');assert.equal(f.value.children[0], f.count);
    assert.equal(f.stars.getAttribute('href'), 'https://github.com/batikanor/gralobe');
    assert.equal(f.stars.getAttribute('target'), '_blank');
    assert.equal(f.stars.dispatch('click').defaultPrevented, false, 'the statistics anchor keeps native navigation');
    assert.equal(f.api.selectedId, 'cottbus');assert.equal(f.link.getAttribute('href'), selectedHref);
    assert.equal(f.cards.find(card => card.project.id === 'gralobe').logo.getAttribute('href'), '/?view=live-projects&project=gralobe');
  } finally {f.api.dispose();}
});

test('entrance BFCache and final pagehide abort old requests and ignore their late responses', async () => {
  const f = fixture();
  try {
    f.requests[0].resolve(reply(126));await settle();
    f.api.select('gralobe');await f.advance(120000);
    f.host.dispatch('pagehide', {persisted: true});
    assert.equal(f.requests[1].options.signal.aborted, true);assert.equal(f.timers.size, 0);
    f.host.dispatch('pageshow', {persisted: true});
    assert.equal(f.requests.length, 3, 'BFCache entry starts a fresh request');
    f.requests[2].resolve(reply(127, '2026-10-27T10:02:00Z'));await settle();
    f.requests[1].resolve(reply(999, '2026-10-27T10:02:00Z'));await settle();
    assert.equal(f.count.textContent, '127');assert.equal(f.api.selectedId, 'gralobe');
    await f.advance(120000);
    f.host.dispatch('pagehide', {persisted: false});
    assert.equal(f.requests[3].options.signal.aborted, true);assert.equal(f.listenerCount(), 0);assert.equal(f.timers.size, 0);
    f.requests[3].resolve(reply(999, '2026-10-27T10:04:00Z'));await settle();
    f.host.dispatch('pageshow', {persisted: true});f.host.dispatch('focus');
    assert.equal(f.count.textContent, '127');assert.equal(f.requests.length, 4);
  } finally {f.api.dispose();}
});

test('a detached entrance pennant is never overwritten by a late API response', async () => {
  const f = fixture();
  try {
    const pendingLabel = f.stars.getAttribute('aria-label'), pendingTitle = f.stars.title;
    f.stars.isConnected = false;
    f.requests[0].resolve(reply(999));await settle();
    assert.equal(f.count.textContent, '126');
    assert.equal(f.stars.getAttribute('aria-label'), pendingLabel);assert.equal(f.stars.title, pendingTitle);
  } finally {f.api.dispose();}
  assert.equal(f.listenerCount(), 0);assert.equal(f.timers.size, 0);
});

test('failed feed requests retain the verified count silently through disposal, remount and a new document', async () => {
  const f = fixture();
  let remounted, reloaded;
  const assertCount = (state, count) => {
    assert.equal(state.count.textContent, String(count));
    assert.doesNotMatch(state.stars.title, /unavailable|retr(?:y|ying)|refresh|verified/i);
    assert.doesNotMatch(state.stars.getAttribute('aria-label'), /unavailable|retr(?:y|ying)|refresh|verified/i);
    assert.match(state.stars.getAttribute('aria-label'), new RegExp(`${count} GitHub stars`));
  };
  try {
    f.requests[0].reject(new Error('Feed temporarily unreachable'));await settle();
    assertCount(f, 126);
    await f.advance(30000);
    f.requests[1].resolve(reply(127, '2026-10-27T10:00:30Z'));await settle();
    assertCount(f, 127);
    await f.advance(120000);
    f.requests[2].resolve({ok: false, status: 503});await settle();
    assertCount(f, 127);
    f.api.dispose();remounted = f.mount();
    assertCount(f, 127);
    reloaded = fixture({storage: f.storage, startAt: '2026-10-27T10:02:30Z'});
    assertCount(reloaded, 127);
    reloaded.requests[0].reject(new Error('Offline'));await settle();
    assertCount(reloaded, 127);
  } finally {f.api.dispose();remounted?.dispose();reloaded?.api.dispose();}
  assert.equal(f.listenerCount(), 0);assert.equal(f.timers.size, 0);
});
