/**
 * Optional Earth-only CacheStorage acceleration; the normal HTTP path is the
 * fallback. Never delay the intro/map on service-worker installation.
 */
// Official Terrarium XYZ endpoint, verified from current Mapterhorn TileJSON.
export const MAPTERHORN_CACHE_TILE = 'https://tiles.mapterhorn.com/{z}/{x}/{y}.webp';
export const PERSISTENT_CACHE_PROTOCOL = 'earth-cache-v1';

export function persistentCacheVersion(input) {
  // A hashed Vite runtime URL changes with the release. The token is safe in
  // the worker URL/cache name and contains no user URL/query-string data.
  const text = String(input);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return `release-${(hash >>> 0).toString(36)}`;
}

export function persistentCacheProfile({saveData = false, effectiveType = '', deviceMemory,
  coarsePointer = false} = {}) {
  const disabled = saveData || /^(?:slow-2g|2g)$/.test(effectiveType);
  const mobile = disabled || coarsePointer || effectiveType === '3g'
    || Number.isFinite(deviceMemory) && deviceMemory <= 4;
  return {enabled:true, speculative:!disabled, mobile, saveData:disabled};
}

export function createPersistentCache({version = import.meta.url,
  profile = persistentCacheProfile({
    saveData:globalThis.navigator?.connection?.saveData,
    effectiveType:globalThis.navigator?.connection?.effectiveType,
    deviceMemory:globalThis.navigator?.deviceMemory,
    coarsePointer:globalThis.matchMedia?.('(pointer: coarse)')?.matches
  }), navigatorObject = globalThis.navigator, locationObject = globalThis.location,
  channelFactory = () => new MessageChannel(), registrationTimeoutMs = 3000,
  messageTimeoutMs = 1500} = {}) {
  const container = navigatorObject?.serviceWorker;
  const release = persistentCacheVersion(version);
  const queued = [];
  let worker = null;
  let disposed = false;
  let generation = 0;
  let failure = null;
  let lastStats = {available:false, queued:0};
  let registration = null;
  let flushing = null;
  const listenerCleanups = new Set();
  const observedWorkers = new Set();
  const activationWaiters = new Set();
  const isSecure = locationObject?.protocol === 'https:'
    || locationObject?.protocol === 'http:' && /^(?:localhost|127\.0\.0\.1|\[::1\])$/.test(locationObject.hostname);
  const state = () => ({...lastStats, available:!!worker, queued:queued.length, release, failure});

  function message(type, data = {}) {
    if (!worker || disposed) return Promise.resolve(state());
    return new Promise(resolve => {
      let channel;
      let timeout;
      const done = result => {
        clearTimeout(timeout);
        channel?.port1.close();
        channel?.port2.close();
        if (result) lastStats = {...result, available:result.available !== false};
        resolve(result ? {...result, available:result.available !== false && !!worker && !disposed, failure} : state());
      };
      try {
        channel = channelFactory();
        timeout = setTimeout(() => done(null), messageTimeoutMs);
        channel.port1.onmessage = event => done(event.data);
        worker.postMessage({protocol:PERSISTENT_CACHE_PROTOCOL, type, ...data}, [channel.port2]);
      } catch {done(null);}
    });
  }

  function flush() {
    if (!worker || disposed) return Promise.resolve();
    if (flushing) return flushing;
    flushing = (async () => {
      await message('configure', {mobile:profile.mobile, saveData:profile.saveData});
      while (queued.length && !disposed && worker) {
        const item = queued.shift();
        if (item.generation === generation) await message('prefetch', item.data);
      }
    })().finally(() => {
      flushing = null;
      if (queued.length && worker && !disposed) void flush();
    });
    return flushing;
  }

  function expected(candidate) {
    if (!candidate) return false;
    try {
      const url = new URL(candidate.scriptURL, locationObject.href);
      return url.origin === locationObject.origin && url.pathname === '/earth-cache-sw.js'
        && url.searchParams.size === 1 && url.searchParams.get('v') === release;
    } catch {return false;}
  }

  function listen(target, type, listener) {
    if (typeof target?.addEventListener !== 'function') return;
    target.addEventListener(type, listener);
    listenerCleanups.add(() => target.removeEventListener(type, listener));
  }

  function adopt(candidate, {active = false} = {}) {
    if (disposed || !expected(candidate) || candidate.state === 'redundant'
      || candidate.state && candidate.state !== 'activated' || !candidate.state && !active) return false;
    if (worker === candidate) return true; // statechange + controllerchange must not flush twice.
    worker = candidate;
    failure = null;
    lastStats.available = true;
    for (const done of [...activationWaiters]) done();
    void flush();
    return true;
  }

  function observeRegistration() {
    if (disposed || !registration) return;
    adopt(registration.active, {active:true});
    for (const candidate of [registration.installing, registration.waiting, registration.active]) {
      if (!expected(candidate) || observedWorkers.has(candidate)) continue;
      observedWorkers.add(candidate);
      // Keep this observer after the bounded ready timeout. A slow first
      // install must recover on activation without reloading the page.
      listen(candidate, 'statechange', () => {
        if (disposed) return;
        if (candidate === worker && candidate.state === 'redundant') {worker = null; failure = 'not-ready';}
        adopt(candidate);
        adopt(registration.active, {active:true});
      });
      adopt(candidate);
    }
  }

  async function install() {
    if (!profile.enabled || !isSecure || !container || disposed) {failure = 'unsupported'; return state();}
    try {
      const existing = await container.getRegistration?.('/');
      if (disposed) return state();
      if (existing && [existing.active, existing.waiting, existing.installing].filter(Boolean)
        .some(candidate => new URL(candidate.scriptURL, locationObject.href).pathname !== '/earth-cache-sw.js')) {
        failure = 'another-service-worker';
        return state(); // Do not replace another site's offline/application worker.
      }
      registration = await container.register(`/earth-cache-sw.js?v=${release}`, {scope:'/', updateViaCache:'none'});
      if (disposed) return state();
      listen(registration, 'updatefound', observeRegistration);
      listen(container, 'controllerchange', () => {
        observeRegistration();
        adopt(container.controller, {active:true});
      });
      observeRegistration();
      if (!worker) {
        failure = 'not-ready';
        await new Promise(resolve => {
          const timer = setTimeout(done, registrationTimeoutMs);
          function done() {clearTimeout(timer); activationWaiters.delete(done); resolve();}
          activationWaiters.add(done);
          if (worker || disposed) done();
        });
      }
    } catch {if (!disposed) failure = 'unavailable';}
    return state();
  }

  const installation = install();
  // Includes blocked registration/private browsing: callers may observe ready,
  // but startup must not await it. Time out independently of browser promises.
  const ready = Promise.race([installation, new Promise(resolve => {
    const timer = setTimeout(() => resolve(state()), registrationTimeoutMs);
    installation.finally(() => clearTimeout(timer));
  })]);

  function prefetch(urls, {priority = 'idle', replace = false} = {}) {
    if (disposed || !profile.enabled || !profile.speculative || !Array.isArray(urls)) return Promise.resolve(state());
    if (replace) cancel();
    const data = {urls:[...new Set(urls.filter(url => typeof url === 'string'))].slice(0,768),
      priority:priority === 'urgent' ? 'urgent' : 'idle', replace:false,
      saveData:!!navigatorObject?.connection?.saveData || profile.saveData};
    if (!data.urls.length) return Promise.resolve(state());
    if (worker) return message('prefetch', data);
    // Bounded queue while installation is pending. Preserve urgent predictions.
    const item = {data, generation};
    if (data.priority === 'urgent') queued.unshift(item); else queued.push(item);
    if (queued.length > 8) queued.pop();
    return Promise.resolve(state());
  }

  function cancel() {
    generation++;
    queued.length = 0;
    if (worker) void message('cancel');
  }

  function dispose() {
    cancel();
    disposed = true;
    worker = null;
    for (const cleanup of listenerCleanups) cleanup();
    listenerCleanups.clear();
    observedWorkers.clear();
    for (const done of [...activationWaiters]) done();
  }
  return {ready, prefetch, cancel, dispose, profile, stats:() => message('stats'), snapshot:state};
}
