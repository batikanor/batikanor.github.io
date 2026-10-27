import test from 'node:test';
import assert from 'node:assert/strict';
import { mountGithubStars } from '../src/githubStars.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
const reply = (count = 121, repo = 'batikanor/gralobe', verifiedAt = '2026-10-27T09:00:00Z') => ({
  ok: true, status: 200, json: async () => ({ full_name: repo, stargazers_count: count, verified_at: verifiedAt }),
});
const record = (count, verifiedAt = '2026-10-27T08:00:00Z', repo = 'batikanor/gralobe') => ({ full_name: repo, stargazers_count: count, verified_at: verifiedAt });
const STORAGE_KEY = 'batikanor:github-stars:batikanor/gralobe';
const FEED_URL = 'https://stats.example.test/github/batikanor/gralobe.json';
const memoryStorage = value => {
  const data = new Map(value === undefined ? [] : [[STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value)]]);
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, stored) => data.set(key, stored) };
};
function target() {
  const listeners = new Map();
  return {
    listeners,
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(handler); },
    removeEventListener(type, handler) { listeners.get(type)?.delete(handler); },
    emit(type, event = {}) { for (const handler of listeners.get(type) ?? []) handler(event); },
    get listenerCount() { return [...listeners.values()].reduce((sum, handlers) => sum + handlers.size, 0); },
  };
}
function fixture({ timers = true, snapshot = null, storage = memoryStorage() } = {}) {
  let time = Date.UTC(2026, 9, 27, 9), sequence = 0;
  const tasks = new Map(), requests = [];
  const doc = Object.assign(target(), { hidden: false, visibilityState: 'visible' });
  const host = Object.assign(target(), { document: doc });
  if (timers) Object.assign(host, {
    setTimeout(callback, delay) { const id = ++sequence; tasks.set(id, { callback, at: time + delay }); return id; },
    clearTimeout(id) { tasks.delete(id); },
  });
  doc.defaultView = host;
  const fetcher = (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject }));
  const options = { fetch: fetcher, window: host, document: doc, now: () => time, snapshot, storage, endpoint: FEED_URL };
  const badges = [];
  function badge(repo = 'batikanor/gralobe') {
    const number = { textContent: '120' }, label = { textContent: 'stars' }, brand = {};
    const attributes = new Map([['title', 'Old retry information']]);
    const node = {
      ownerDocument: doc, dataset: { githubRepo: repo }, title: 'Old retry information', isConnected: true,
      href: `https://github.com/${repo}`, children: [brand, number, label],
      querySelector: selector => selector === '.stat-pennant-number' ? number : selector === '.stat-pennant-label' ? label : null,
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name),
      set textContent(value) { throw new Error(`Existing pennant replaced: ${value}`); },
    };
    const controller = mountGithubStars(node, options);
    const result = { node, number, label, brand, attributes, controller };
    badges.push(result); return result;
  }
  async function tick(milliseconds) {
    const end = time + milliseconds;
    let runs = 0;
    while (true) {
      const next = [...tasks.entries()].filter(([, task]) => task.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      assert.ok(++runs < 100, 'timers must not spin');
      time = next[1].at; tasks.delete(next[0]); next[1].callback(); await settle();
    }
    time = end; await settle();
  }
  return { doc, host, requests, tasks, options, storage, badge, tick, now: () => time,
    reply: (count, repo) => reply(count, repo, new Date(time).toISOString()),
    dispose: () => badges.forEach(item => item.controller.dispose()) };
}

test('fetches the shared feed, hides unverified historical markup, and preserves native pennant nodes', async () => {
  const f = fixture(), b = f.badge();
  const children = b.node.children;
  assert.equal(b.number.textContent, '');
  assert.equal(b.node.hidden, true);
  assert.equal(b.node.title, '');
  assert.equal(b.attributes.has('title'), false);
  assert.equal(f.requests[0].url, FEED_URL);
  assert.equal(f.requests[0].options.credentials, 'omit');
  assert.equal(f.requests[0].options.cache, 'no-cache');
  f.requests[0].resolve(reply(1234)); await settle();
  assert.equal(b.number.textContent, '1,234');
  assert.equal(b.node.hidden, false);
  assert.equal(b.node.dataset.githubState, 'fresh');
  assert.equal(b.node.dataset.githubVerifiedAt, '2026-10-27T09:00:00Z');
  assert.equal(b.node.title, '');
  assert.match(b.attributes.get('aria-label'), /1,234 GitHub stars/);
  assert.equal(b.node.children, children);
  assert.equal(children[0], b.brand);
  assert.equal(b.node.href, 'https://github.com/batikanor/gralobe');
  f.dispose(); assert.equal(f.tasks.size, 0);
});

test('idempotent mounts and concurrent badges share requests, polling and cleanup', async () => {
  const f = fixture(), a = f.badge(), b = f.badge();
  assert.equal(mountGithubStars(a.node, f.options), a.controller);
  assert.equal(f.requests.length, 1);
  assert.equal(f.doc.listenerCount, 1);
  assert.equal(f.host.listenerCount, 3);
  f.requests[0].resolve(reply(1)); await settle();
  assert.equal(a.number.textContent, '1'); assert.equal(b.number.textContent, '1');
  assert.equal(a.label.textContent, 'star');
  assert.equal(f.tasks.size, 1);
  a.controller.dispose(); assert.equal(f.tasks.size, 1);
  await f.tick(120000); assert.equal(f.requests.length, 2);
  f.requests[1].resolve(f.reply(130)); await settle();
  assert.equal(b.number.textContent, '130');
  assert.equal(a.number.textContent, '1', 'disposed badges do not receive later writes');
  b.controller.dispose();
  assert.equal(f.tasks.size, 0); assert.equal(f.doc.listenerCount, 0); assert.equal(f.host.listenerCount, 0);
});

test('polls only while visible and coalesces visibility, focus and online returns for 15 seconds', async () => {
  const f = fixture(), b = f.badge();
  f.requests[0].resolve(reply()); await settle();
  await f.tick(10000);
  f.host.emit('focus'); f.host.emit('online'); f.doc.emit('visibilitychange');
  assert.equal(f.requests.length, 1);
  await f.tick(4999); assert.equal(f.requests.length, 1);
  await f.tick(1); assert.equal(f.requests.length, 2);
  f.requests[1].resolve(f.reply(122)); await settle();
  f.doc.hidden = true; f.doc.visibilityState = 'hidden'; f.doc.emit('visibilitychange');
  assert.equal(f.tasks.size, 0);
  await f.tick(240000); assert.equal(f.requests.length, 2);
  f.doc.hidden = false; f.doc.visibilityState = 'visible';
  f.doc.emit('visibilitychange'); f.host.emit('focus'); f.host.emit('online');
  assert.equal(f.requests.length, 3);
  f.requests[2].resolve(f.reply(123)); await settle();
  assert.equal(b.number.textContent, '123'); f.dispose();
});

test('initial API, identity and count failures leave the entire unverified badge hidden', async () => {
  for (const response of [reply(3, 'someone/gralobe'), reply('125'), reply(-1), reply(1.5), reply(Number.MAX_SAFE_INTEGER + 1), { ok: false, status: 500 }]) {
    const f = fixture(), b = f.badge();
    f.requests[0].resolve(response); await settle();
    assert.equal(b.number.textContent, '');
    assert.equal(b.node.hidden, true);
    assert.equal(b.node.dataset.githubState, 'unavailable');
    assert.equal(b.node.title, '');
    assert.doesNotMatch(b.attributes.get('aria-label'), /unavailable|retry|verified|loading/i); f.dispose();
  }
  const f = fixture(), b = f.badge('invalid');
  await b.controller.refresh();
  f.host.emit('focus'); f.host.emit('online'); f.doc.emit('visibilitychange');
  await f.tick(300000);
  assert.equal(f.requests.length, 0); assert.equal(b.node.hidden, true);
  assert.equal(f.tasks.size, 0); f.dispose();
});

test('refreshing and later failure silently retain verified data with ordinary link text', async () => {
  const f = fixture(), b = f.badge();
  f.requests[0].resolve(reply(125)); await settle();
  await f.tick(15000); const pending = b.controller.refresh();
  assert.equal(b.number.textContent, '125'); assert.equal(b.node.hidden, false);
  f.requests[1].reject(new Error('offline')); await pending;
  assert.equal(b.number.textContent, '125');
  assert.equal(b.node.dataset.githubState, 'stale');
  assert.equal(b.node.title, '');
  assert.equal(b.attributes.get('aria-label'), '125 GitHub stars — view repository, opens in a new tab');
  assert.equal(b.node.dataset.githubVerifiedAt, '2026-10-27T09:00:00Z');
  await f.tick(30000); assert.equal(f.requests.length, 3);
  f.requests[2].resolve(f.reply(126)); await settle();
  assert.equal(b.number.textContent, '126'); assert.equal(b.node.dataset.githubState, 'fresh'); f.dispose();
});

test('honors Retry-After seconds/date and GitHub rate-reset headers despite return events', async () => {
  for (const [status, headers, wait] of [
    [429, { 'Retry-After': '90' }, 90000],
    [403, { 'X-RateLimit-Reset': String((Date.UTC(2026, 9, 27, 9) + 180000) / 1000) }, 180000],
    [429, { 'Retry-After': 'Tue, 27 Oct 2026 09:02:00 GMT' }, 120000],
  ]) {
    const f = fixture(), b = f.badge();
    f.requests[0].resolve({ ok: false, status, headers: { get: key => headers[key] ?? null } }); await settle();
    f.host.emit('focus'); f.host.emit('online');
    await f.tick(wait - 1); assert.equal(f.requests.length, 1);
    assert.equal(b.node.title, '');
    assert.equal(b.node.hidden, true);
    await f.tick(1); assert.equal(f.requests.length, 2); f.dispose();
  }
});

test('network retries back off to a bounded five minutes', async () => {
  const f = fixture(); f.badge();
  for (const delay of [30000, 60000, 120000, 240000, 300000, 300000]) {
    f.requests.at(-1).reject(new Error('network')); await settle();
    const count = f.requests.length;
    await f.tick(delay - 1); assert.equal(f.requests.length, count);
    await f.tick(1); assert.equal(f.requests.length, count + 1);
  }
  f.dispose();
});

test('timeout recovers hung requests and ignores a late old response', async () => {
  const f = fixture(), b = f.badge();
  await f.tick(15000);
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(b.node.hidden, true);
  await f.tick(30000); assert.equal(f.requests.length, 2);
  f.requests[1].resolve(f.reply(127)); await settle();
  f.requests[0].resolve(reply(999)); await settle();
  assert.equal(b.number.textContent, '127'); f.dispose();
});

test('last unmount aborts and remount immediately retries interrupted work, reusing verified results', async () => {
  const f = fixture(), a = f.badge();
  a.controller.dispose();
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.tasks.size, 0);
  const b = f.badge(); assert.equal(f.requests.length, 2);
  f.requests[0].resolve(reply(999)); await settle();
  assert.equal(b.node.hidden, true);
  f.requests[1].resolve(reply(128)); await settle();
  b.controller.dispose();
  const c = f.badge(); assert.equal(c.number.textContent, '128');
  assert.equal(f.requests.length, 2);
  await f.tick(15000); assert.equal(f.requests.length, 3);
  f.requests[2].resolve(f.reply(129)); await settle();
  assert.equal(c.number.textContent, '129'); f.dispose();
});

test('document scopes stay independent and no host means no global Node timers', async () => {
  const first = fixture({ timers: false }), second = fixture({ timers: false });
  const a = first.badge(), b = second.badge();
  assert.equal(first.requests.length, 1); assert.equal(second.requests.length, 1);
  first.requests[0].resolve(reply(0)); second.requests[0].resolve(reply(132)); await settle();
  assert.equal(a.number.textContent, '0'); assert.equal(b.number.textContent, '132');
  assert.equal(first.tasks.size, 0); assert.equal(second.tasks.size, 0);
  first.dispose(); second.dispose();
  const count = { textContent: '' }, node = {
    dataset: { githubRepo: 'batikanor/gralobe' },
    querySelector: selector => selector === '.stat-pennant-number' ? count : null,
  };
  const controller = mountGithubStars(node, { window: null, document: {}, snapshot: null, storage: null, fetch: async () => reply(133) });
  await settle(); assert.equal(count.textContent, '133', 'hostless mount completes without installing Node timers');
  controller.dispose();
});

test('a real bundled snapshot is visible immediately and remains through a failed refresh', async () => {
  const snapshot = record(127), f = fixture({ snapshot }), b = f.badge();
  assert.equal(b.node.hidden, false);
  assert.equal(b.number.textContent, '127');
  assert.equal(b.node.dataset.githubVerifiedAt, snapshot.verified_at);
  assert.equal(b.attributes.get('aria-label'), '127 GitHub stars — view repository, opens in a new tab');
  f.requests[0].reject(new Error('feed unavailable')); await settle();
  assert.equal(b.number.textContent, '127'); assert.equal(b.node.hidden, false);
  assert.equal(b.node.title, '');
  assert.doesNotMatch(b.attributes.get('aria-label'), /retry|unavailable|refresh|verified|2026/i);
  f.dispose();
});

test('newer cache and feed timestamps take priority even when their star counts decrease', async () => {
  const storage = memoryStorage(record(126, '2026-10-27T08:30:00Z'));
  const f = fixture({ snapshot: record(200), storage }), b = f.badge();
  assert.equal(b.number.textContent, '126', 'newer cache wins over a larger older snapshot');
  f.requests[0].resolve(reply(125, 'batikanor/gralobe', '2026-10-27T08:45:00Z')); await settle();
  assert.equal(b.number.textContent, '125');
  assert.equal(b.node.dataset.githubVerifiedAt, '2026-10-27T08:45:00Z');
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), record(125, '2026-10-27T08:45:00Z'));
  await f.tick(15000); const pending = b.controller.refresh();
  f.requests[1].resolve(reply(999, 'batikanor/gralobe', '2026-10-27T08:40:00Z')); await pending;
  assert.equal(b.number.textContent, '125', 'an older feed cannot regress a newer verified source');
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), record(125, '2026-10-27T08:45:00Z'));
  f.dispose();
});

test('older cached data cannot replace a newer seed and external cache updates cannot be overwritten by older feed data', async () => {
  const storage = memoryStorage(record(999, '2026-10-27T07:00:00Z'));
  const f = fixture({ snapshot: record(127), storage }), b = f.badge();
  assert.equal(b.number.textContent, '127');
  storage.setItem(STORAGE_KEY, JSON.stringify(record(129, '2026-10-27T08:50:00Z')));
  f.requests[0].resolve(reply(128, 'batikanor/gralobe', '2026-10-27T08:30:00Z')); await settle();
  assert.equal(b.number.textContent, '129');
  assert.equal(b.node.dataset.githubVerifiedAt, '2026-10-27T08:50:00Z');
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), record(129, '2026-10-27T08:50:00Z'));
  f.dispose();
});

test('corrupt, wrong-repository, invalid-date and implausibly future stored or feed data stay hidden', async () => {
  for (const value of [
    '{broken JSON', record(999, '2026-10-27T08:00:00Z', 'another/repo'),
    record(999, '2026-10-27T09:05:01Z'), record(999, '2026-02-30T08:00:00Z'),
    record(999, 'not-a-date'), { full_name: 'batikanor/gralobe', stargazers_count: 999 },
  ]) {
    const f = fixture({ storage: memoryStorage(value) }), b = f.badge();
    assert.equal(b.node.hidden, true);
    f.requests[0].resolve({ ok: true, json: async () => value }); await settle();
    assert.equal(b.node.hidden, true);
    assert.equal(b.number.textContent, '');
    assert.equal(b.node.title, '');
    f.dispose();
  }
});

test('blocked localStorage getter, reads and writes never hide a usable snapshot or fetched count', async () => {
  for (const mode of ['getter', 'read', 'write']) {
    const storage = memoryStorage();
    if (mode === 'read') storage.getItem = () => { throw new Error('blocked'); };
    if (mode === 'write') storage.setItem = () => { throw new Error('quota'); };
    const f = fixture({ snapshot: record(127), storage });
    if (mode === 'getter') {
      f.options.storage = undefined;
      Object.defineProperty(f.host, 'localStorage', { get() { throw new Error('blocked getter'); } });
    }
    const b = f.badge(); assert.equal(b.number.textContent, '127');
    f.requests[0].resolve(reply(128)); await settle();
    assert.equal(b.number.textContent, '128'); assert.equal(b.node.hidden, false);
    f.dispose();
  }
});

test('last verified source survives a full page runtime through localStorage without changing its timestamp', async () => {
  const storage = memoryStorage(), first = fixture({ storage }), initial = first.badge();
  first.requests[0].resolve(reply(129, 'batikanor/gralobe', '2026-10-27T08:55:37Z')); await settle();
  assert.equal(initial.number.textContent, '129');
  first.dispose();
  const second = fixture({ storage }), restored = second.badge();
  assert.equal(restored.number.textContent, '129'); assert.equal(restored.node.hidden, false);
  assert.equal(restored.node.dataset.githubVerifiedAt, '2026-10-27T08:55:37Z');
  second.requests[0].reject(new Error('offline')); await settle();
  assert.equal(restored.number.textContent, '129');
  assert.equal(restored.node.dataset.githubVerifiedAt, '2026-10-27T08:55:37Z');
  second.dispose();
});
