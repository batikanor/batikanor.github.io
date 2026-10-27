import { GITHUB_STARS_SNAPSHOT, GITHUB_STARS_URL } from './githubStarsData.js';

const mounts = new WeakMap();
const documents = new WeakMap();
const runtime = new Map();
const POLL_MS = 120000;
const MIN_ATTEMPT_MS = 15000;
const TIMEOUT_MS = 15000;
const STORAGE_PREFIX = 'batikanor:github-stars:';
const validRepo = value => typeof value === 'string' && /^[\w.-]+\/[\w.-]+$/.test(value);

function verifiedRecord(value, repo, now) {
  if (value?.full_name !== repo || !Number.isSafeInteger(value.stargazers_count) || value.stargazers_count < 0) return null;
  if (typeof value.verified_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value.verified_at)) return null;
  const time = Date.parse(value.verified_at);
  if (!Number.isFinite(time) || time > now + 300000 || new Date(time).toISOString().slice(0, 19) !== value.verified_at.slice(0, 19)) return null;
  return { full_name: repo, stargazers_count: value.stargazers_count, verified_at: value.verified_at };
}

function acceptRecord(state, value) {
  const record = verifiedRecord(value, state.repo, state.now());
  if (!record || (state.verifiedAt !== null && Date.parse(record.verified_at) <= state.verifiedAt)) return false;
  state.count = record.stargazers_count;
  state.verifiedAt = Date.parse(record.verified_at);
  state.record = record;
  return true;
}

function readStored(state) {
  try { return JSON.parse(state.storage?.getItem(`${STORAGE_PREFIX}${state.repo}`) ?? 'null'); }
  catch { return null; }
}

function persist(state) {
  if (!state.record) return;
  try { state.storage?.setItem(`${STORAGE_PREFIX}${state.repo}`, JSON.stringify(state.record)); }
  catch { /* A verified count remains useful when browser storage is blocked. */ }
}

function retryAfter(response, now) {
  if (response.status !== 403 && response.status !== 429) return 0;
  const retry = response.headers?.get?.('Retry-After');
  const seconds = retry == null || retry.trim() === '' ? NaN : Number(retry);
  const until = Number.isFinite(seconds) ? now + Math.max(0, seconds) * 1000 : Date.parse(retry);
  const reset = Number(response.headers?.get?.('X-RateLimit-Reset')) * 1000;
  return Math.max(now, Number.isFinite(until) ? until : 0, Number.isFinite(reset) ? reset : 0);
}

function createState(repo) {
  return {
    repo, members: new Set(), count: null, verifiedAt: null, record: null, lastAttempt: -Infinity,
    retryUntil: 0, failures: 0, status: 'loading', request: null, timer: null,
    queued: false, removers: [],
  };
}

function render(state) {
  const hasCount = state.count !== null;
  const formatted = hasCount ? state.count.toLocaleString('en-US') : '';
  const label = state.count === 1 ? 'star' : 'stars';
  const accessible = hasCount ? `${formatted} GitHub ${label} — view repository, opens in a new tab` : 'View repository on GitHub, opens in a new tab';
  for (const { node } of state.members) {
    if (node.isConnected === false) continue;
    const number = node.querySelector?.('.stat-pennant-number');
    const caption = node.querySelector?.('.stat-pennant-label');
    if (number) number.textContent = formatted;
    if (caption) caption.textContent = label;
    node.hidden = !hasCount;
    node.setAttribute?.('aria-label', accessible);
    node.title = '';
    node.removeAttribute?.('title');
    node.dataset.githubState = state.status;
    if (state.record) node.dataset.githubVerifiedAt = state.record.verified_at;
    else delete node.dataset.githubVerifiedAt;
  }
}

const visible = state => state.doc?.visibilityState !== 'hidden' && state.doc?.hidden !== true;
const allowedAt = state => Math.max(state.lastAttempt + MIN_ATTEMPT_MS, state.retryUntil);

function clearPoll(state) {
  if (state.timer !== null) state.cancel?.(state.timer);
  state.timer = null;
}

function schedule(state) {
  clearPoll(state);
  if (!state.members.size || !visible(state) || !state.schedule || state.request) return;
  const regular = state.failures ? state.retryUntil : state.lastAttempt + POLL_MS;
  const next = state.queued ? allowedAt(state) : Math.max(regular, allowedAt(state));
  state.timer = state.schedule(() => {
    state.timer = null;
    void refresh(state);
  }, Math.max(0, next - state.now()));
}

function refresh(state) {
  if (!state.members.size) return Promise.resolve();
  if (!validRepo(state.repo) || typeof state.fetcher !== 'function' || typeof state.endpoint !== 'string' || !state.endpoint) return Promise.resolve();
  if (state.request) return state.request.promise;
  if (!visible(state)) {
    state.queued = true;
    clearPoll(state);
    return Promise.resolve();
  }
  if (state.now() < allowedAt(state)) {
    state.queued = true;
    schedule(state);
    return Promise.resolve();
  }
  clearPoll(state);
  state.queued = false;
  state.lastAttempt = state.now();
  state.status = 'loading';
  render(state);
  const request = { controller: new AbortController(), timeout: null, cancel: state.cancel, promise: null };
  state.request = request;
  const active = () => state.request === request && state.members.size > 0;
  const fail = (retryUntil = 0) => {
    if (!active()) return;
    state.failures++;
    state.retryUntil = Math.max(retryUntil, state.now() + Math.min(300000, 30000 * 2 ** Math.min(state.failures - 1, 4)));
    state.status = state.count === null ? 'unavailable' : 'stale';
    render(state);
  };
  let timedOut = false;
  const timeout = state.schedule ? new Promise((_, reject) => {
    request.timeout = state.schedule(() => {
      timedOut = true;
      request.controller.abort();
      reject(new Error('GitHub statistics request timed out.'));
    }, TIMEOUT_MS);
  }) : null;
  const load = async () => {
    const response = await state.fetcher(state.endpoint, {
      signal: request.controller.signal, credentials: 'omit', cache: 'no-cache',
    });
    if (!active() || request.controller.signal.aborted) return null;
    if (!response.ok) {
      const error = new Error('GitHub statistics unavailable.');
      error.retryUntil = retryAfter(response, state.now());
      throw error;
    }
    const record = verifiedRecord(await response.json(), state.repo, state.now());
    if (!record) throw new Error('Invalid GitHub star count.');
    return record;
  };
  request.promise = (async () => {
    try {
      const record = await (timeout ? Promise.race([load(), timeout]) : load());
      if (!active() || request.controller.signal.aborted) return;
      acceptRecord(state, readStored(state));
      acceptRecord(state, record);
      persist(state);
      state.failures = 0;
      state.retryUntil = 0;
      state.status = 'fresh';
      render(state);
    } catch (error) {
      if (active() && (!request.controller.signal.aborted || timedOut)) fail(error?.retryUntil);
    } finally {
      if (request.timeout !== null) request.cancel?.(request.timeout);
      if (state.request === request) {
        state.request = null;
        schedule(state);
      }
    }
  })();
  return request.promise;
}

/** A single live GitHub request/poller feeds every matching badge in a document. */
export function mountGithubStars(node, {
  fetch: fetcher = globalThis.fetch,
  window: host = node?.ownerDocument?.defaultView ?? globalThis.window,
  document: doc = node?.ownerDocument ?? host?.document,
  now = Date.now,
  setTimeout: scheduleTimer = host?.setTimeout?.bind(host),
  clearTimeout: cancelTimer = host?.clearTimeout?.bind(host),
  snapshot = GITHUB_STARS_SNAPSHOT,
  endpoint = GITHUB_STARS_URL,
  storage,
} = {}) {
  if (!node) return null;
  if (mounts.has(node)) return mounts.get(node);
  const repo = node.dataset?.githubRepo;
  const scope = doc && (typeof doc === 'object' || typeof doc === 'function') ? doc : null;
  let states = scope ? documents.get(scope) : runtime;
  if (!states) { states = new Map(); documents.set(scope, states); }
  const key = validRepo(repo) ? repo : '';
  let state = states.get(key);
  if (!state) { state = createState(key); states.set(key, state); }
  if (!state.members.size) {
    let savedStorage = storage;
    if (savedStorage === undefined) {
      try { savedStorage = host?.localStorage; }
      catch { savedStorage = null; }
    }
    Object.assign(state, { fetcher, host, doc, now, endpoint, storage: savedStorage, schedule: scheduleTimer, cancel: cancelTimer });
    const listen = (target, type, handler) => {
      target?.addEventListener?.(type, handler);
      state.removers.push(() => target?.removeEventListener?.(type, handler));
    };
    const returned = () => { if (visible(state)) void refresh(state); else clearPoll(state); };
    listen(doc, 'visibilitychange', returned);
    listen(host, 'focus', returned);
    listen(host, 'online', returned);
    listen(host, 'pageshow', event => { if (event.persisted) returned(); });
  }
  acceptRecord(state, snapshot);
  acceptRecord(state, readStored(state));
  let disposed = false;
  const member = { node };
  const controller = {
    refresh() { return disposed ? Promise.resolve() : refresh(state); },
    dispose() {
      if (disposed) return;
      disposed = true;
      mounts.delete(node);
      state.members.delete(member);
      if (state.members.size) return;
      clearPoll(state);
      for (const remove of state.removers.splice(0)) remove();
      if (state.request) {
        const request = state.request;
        state.request = null;
        request.controller.abort();
        if (request.timeout !== null) request.cancel?.(request.timeout);
        request.timeout = null;
        // An interrupted request must not postpone a BFCache remount.
        state.lastAttempt = -Infinity;
      }
      state.queued = false;
    },
  };
  state.members.add(member);
  mounts.set(node, controller);
  render(state);
  if (!key || typeof fetcher !== 'function') {
    state.status = state.count === null ? 'unavailable' : 'stale';
    render(state);
  } else void refresh(state);
  return controller;
}
