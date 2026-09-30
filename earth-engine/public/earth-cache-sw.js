/*
 * Earth-only, bounded asset cache. No app shell, HTML, auth, media embeds,
 * opaque responses or no-store provider data ever enter this cache.
 * Registered with a release-specific ?v= token; origin already isolates
 * staging, production and localhost in the browser's CacheStorage.
 */
'use strict';
const PROTOCOL = 'earth-cache-v1';
const CACHE_PREFIX = 'batikan-earth-map-v1-';
const release = new URL(self.location.href).searchParams.get('v');
const VALID_RELEASE = /^[a-z0-9-]{4,80}$/.test(release || '');
const CACHE_NAME = CACHE_PREFIX + (VALID_RELEASE ? release : 'disabled');
const ASSET_LIMIT = 10_000_000;
const DAY = 86_400_000;
const STORED = 'x-earth-cache-stored';
const SIZE = 'x-earth-cache-bytes';
const TTL = 'x-earth-cache-ttl';
const MAX_QUEUE = 768;
const POLICY_URL = new URL('/__earth-cache-policy-v1', self.location.origin).href;
const MOBILE_LIMITS = {bytes:48_000_000, entries:512, concurrency:1, prefetchBytes:24_000_000};
let limits = {bytes:96_000_000, entries:768, concurrency:2, prefetchBytes:64_000_000};
let policyLoaded = false;
let index = null;
let cachePromise = null;
let commitTail = Promise.resolve();
let pumping = null;
let reservedBytes = 0;
const pending = [];
const flights = new Map();
const metrics = {hits:0, misses:0, stored:0, failures:0, evictions:0, prefetchBytes:0};

function resourcePolicy(input) {
  const url = new URL(typeof input === 'string' ? input : input.url, self.location.origin);
  if (url.protocol !== 'https:' && url.origin !== self.location.origin) return null;
  if (url.username || url.password || url.hash) return null;
  if (url.origin === self.location.origin) {
    if (url.search) return null; // Release manifest, analytics and request variants are never cached.
    if (/^\/assets\/arrival\/(?:esa|landing)-\d+-\d+-\d+-[a-f0-9]{8,64}\.webp$/.test(url.pathname)) {
      return {kind:'image', ttl:7 * DAY};
    }
    // Owned, source-audited destination orthophotos. Require the precise
    // coordinate-bearing authoring filename, one of the two bounded sizes,
    // and its 12-digit content fingerprint; never widen this to arbitrary
    // JPEG/WebP photographs. The Lands Department logo is a required credit
    // artifact, not a project photograph, and has one exact reviewed hash.
    const ortho = url.pathname.match(/^\/assets\/destination-orthophotos\/ortho-([a-z]+(?:-[a-z]+)*)-(\d{1,3}p\d{6})-(\d{1,2}p\d{6})-(?:2048|1024)-[a-f0-9]{12}\.webp$/);
    if (ortho && Number(ortho[2].replace('p','.')) <= 180
      && Number(ortho[3].replace('p','.')) < 85) {
      return {kind:'image', ttl:7 * DAY};
    }
    if (url.pathname === '/assets/destination-orthophotos/lands-department-logo-97fc83e2643b.jpg') {
      return {kind:'image', ttl:7 * DAY};
    }
    if (/^\/(?:data|assets\/isometric)\/[a-z0-9-]+-v\d+(?:-half)?\.(?:bin|json|geojson|webp)$/.test(url.pathname)) {
      return {kind:/\.webp$/.test(url.pathname) ? 'image' : /\.bin$/.test(url.pathname) ? 'mesh' : 'metadata', ttl:7 * DAY};
    }
    return null;
  }
  if (url.origin === 'https://wmts.terrascope.be' && url.pathname === '/') {
    const p = url.searchParams;
    const allowed = new Set(['SERVICE','REQUEST','VERSION','LAYER','STYLE','FORMAT','TILEMATRIXSET','TILEMATRIX','TILECOL','TILEROW','TIME']);
    if ([...p.keys()].some(key => !allowed.has(key)) || p.size !== allowed.size
      || p.get('SERVICE') !== 'WMTS' || p.get('REQUEST') !== 'GetTile'
      || p.get('VERSION') !== '1.0.0' || p.get('STYLE') !== 'default'
      || p.get('LAYER') !== 'esa-worldcover-s2rgbnir-10m-2021-v2_tcc'
      || p.get('TILEMATRIXSET') !== 'EPSG:3857' || p.get('FORMAT') !== 'image/png'
      || p.get('TIME') !== '2021-01-01') return null;
    const z = Number(p.get('TILEMATRIX')), x = Number(p.get('TILECOL')), y = Number(p.get('TILEROW'));
    if (![z,x,y].every(Number.isInteger) || z < 6 || z > 14 || x < 0 || y < 0 || x >= 2 ** z || y >= 2 ** z) return null;
    return {kind:'image', ttl:DAY};
  }
  if (url.origin === 'https://wmtsod1.bayernwolke.de' && !url.search) {
    const match = url.pathname.match(/^\/wmts\/by_dop\/smerc\/(\d+)\/(\d+)\/(\d+)$/);
    if (!match) return null;
    const [z,x,y] = match.slice(1).map(Number);
    if (z < 12 || z > 19 || x >= 2 ** z || y >= 2 ** z) return null;
    return {kind:'image', ttl:DAY};
  }
  if (url.origin === 'https://tiles.mapterhorn.com' && !url.search) {
    const match = url.pathname.match(/^\/(\d+)\/(\d+)\/(\d+)\.webp$/);
    if (!match) return null; // TileJSON is mutable provider configuration, not a DEM payload.
    const [z,x,y] = match.slice(1).map(Number);
    if (![z,x,y].every(Number.isInteger) || z < 0 || z > 16 || x < 0 || y < 0
      || x >= 2 ** z || y >= 2 ** z) return null;
    return {kind:'image', ttl:DAY};
  }
  // NASA explicitly sends no-store. Do not bypass it with CacheStorage.
  // Other providers remain on their ordinary browser/network path.
  return null;
}

function usableRequest(request) {
  return VALID_RELEASE && request.method === 'GET' && request.mode !== 'navigate'
    && request.cache !== 'no-store' && !request.headers.has('range')
    && !request.headers.has('authorization') && resourcePolicy(request);
}

function usableResponse(response, policy) {
  if (!response || response.status !== 200 || response.type === 'opaque' || response.type === 'opaqueredirect') return false;
  if (/\b(?:no-store|private|no-cache)\b/i.test(response.headers.get('cache-control') || '')) return false;
  const vary = response.headers.get('vary') || '';
  if (vary.split(',').some(value => !['origin','accept-encoding',''].includes(value.trim().toLowerCase()))) return false;
  const type = response.headers.get('content-type') || '';
  if (policy.kind === 'image') return /^image\/(?:png|jpeg|webp)\b/i.test(type);
  if (policy.kind === 'mesh') return /^(?:application\/octet-stream|binary\/octet-stream)\b/i.test(type);
  return /^(?:application\/(?:json|geo\+json)|text\/json)\b/i.test(type);
}

function serialCommit(operation) {
  const result = commitTail.then(operation);
  commitTail = result.catch(() => {});
  return result;
}

async function openCache() {
  if (!cachePromise) cachePromise = caches.open(CACHE_NAME).catch(error => {cachePromise = null; throw error;});
  return cachePromise;
}

async function loadPolicy(cache) {
  if (policyLoaded) return;
  const saved = await cache.match(POLICY_URL);
  if (saved) {
    try {
      const policy = JSON.parse(new TextDecoder().decode(await readBounded(saved, 1024)));
      if (policy.version === 1 && policy.tier === 'mobile') limits = {...MOBILE_LIMITS};
    } catch { /* Ignore corrupt/obsolete metadata without making assets unavailable. */ }
  }
  policyLoaded = true;
}

async function saveMobilePolicy(cache) {
  // Synthetic, same-cache bookkeeping only; never fetched or served to pages.
  // A mobile tier is sticky until the next release, including worker restart.
  await cache.put(new Request(POLICY_URL), new Response(JSON.stringify({version:1,tier:'mobile'}),
    {headers:{'content-type':'application/json'}}));
}

async function loadIndex() {
  if (index) return index;
  const cache = await openCache();
  await loadPolicy(cache);
  const next = new Map();
  for (const request of await cache.keys()) {
    if (request.url === POLICY_URL) continue; // Policy is not an asset/TTL/byte record.
    const response = await cache.match(request);
    const stored = Number(response?.headers.get(STORED));
    const bytes = Number(response?.headers.get(SIZE));
    const ttl = Number(response?.headers.get(TTL));
    const policy = resourcePolicy(request);
    if (!policy || !Number.isFinite(stored) || stored <= 0 || !Number.isInteger(bytes)
      || bytes <= 0 || bytes > ASSET_LIMIT || !Number.isFinite(ttl) || ttl <= 0
      || ttl > policy.ttl || Date.now() - stored >= ttl) {
      await cache.delete(request);
      continue;
    }
    next.set(request.url, {stored, bytes, ttl, touched:stored});
  }
  index = next;
  return index;
}

async function trim(cache, additionalBytes = 0, additionalEntries = 0) {
  const records = await loadIndex();
  let bytes = [...records.values()].reduce((total, value) => total + value.bytes, 0);
  for (const [url, record] of [...records.entries()].sort((a,b) => a[1].touched - b[1].touched)) {
    if (bytes + additionalBytes <= limits.bytes && records.size + additionalEntries <= limits.entries) break;
    await cache.delete(url);
    records.delete(url);
    bytes -= record.bytes;
    metrics.evictions++;
  }
}

async function cachedResponse(request) {
  try {
    await serialCommit(() => loadIndex());
    const record = index.get(request.url);
    if (!record) return null;
    const policy = resourcePolicy(request);
    if (Date.now() - record.stored >= record.ttl) {
      await serialCommit(async () => {await (await openCache()).delete(request.url); index.delete(request.url);});
      return null;
    }
    const response = await (await openCache()).match(request);
    if (response) {record.touched = Date.now(); metrics.hits++; return response;}
    index.delete(request.url);
  } catch { /* Private browsing/quota denial must not affect the map. */ }
  return null;
}

async function readBounded(response, maxBytes, onBytes) {
  const advertised = Number(response.headers.get('content-length'));
  if (advertised > maxBytes) throw new Error('Asset exceeds bounded cache budget');
  if (!response.body?.getReader) {
    const data = await response.arrayBuffer();
    onBytes?.(data.byteLength);
    if (data.byteLength > maxBytes) throw new Error('Asset exceeds bounded cache budget');
    return new Uint8Array(data);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      onBytes?.(value.byteLength);
      if (bytes > maxBytes) throw new Error('Asset exceeds bounded cache budget');
      chunks.push(value);
    }
  } catch (error) {void reader.cancel().catch(() => {}); throw error;}
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {data.set(chunk, offset); offset += chunk.byteLength;}
  return data;
}

async function persist(request, response, maxBytes, onBytes) {
  const policy = resourcePolicy(request);
  if (!usableResponse(response, policy)) return 0;
  const data = await readBounded(response, maxBytes, onBytes);
  if (!data.byteLength) return 0;
  const headers = new Headers(response.headers);
  headers.delete('content-encoding'); // fetch has already decoded the body.
  headers.delete('content-length');
  const maxAge = response.headers.get('cache-control')?.match(/(?:^|,)\s*max-age\s*=\s*"?(\d+)/i);
  const ageSeconds = Math.max(0, Number(response.headers.get('age')) || 0);
  const ttl = Math.min(policy.ttl, maxAge ? Math.max(0, Number(maxAge[1]) - ageSeconds) * 1000 : policy.ttl);
  if (ttl <= 0) return 0;
  headers.set(TTL, String(ttl));
  headers.set(STORED, String(Date.now()));
  headers.set(SIZE, String(data.byteLength));
  const saved = new Response(data, {status:200, headers});
  await serialCommit(async () => {
    const cache = await openCache();
    await loadIndex();
    if (index.has(request.url)) {await cache.delete(request.url); index.delete(request.url);}
    await trim(cache, data.byteLength, 1);
    try {await cache.put(request, saved.clone());}
    catch (error) {
      // Quota is shared with the origin. Release our own oldest entries once,
      // never request durable storage or remove another application's caches.
      const before = limits.bytes;
      limits.bytes = Math.min(before, Math.max(ASSET_LIMIT, Math.floor(before / 2)));
      await trim(cache, data.byteLength, 1);
      await cache.put(request, saved);
    }
    index.set(request.url, {stored:Date.now(), touched:Date.now(), ttl, bytes:data.byteLength});
    metrics.stored++;
  });
  return data.byteLength;
}

function networkFlight(request, {speculative = false, clientId = null, maxBytes = ASSET_LIMIT} = {}) {
  const existing = flights.get(request.url);
  if (existing && !existing.abort.signal.aborted) {
    if (!speculative) existing.demand = true;
    if (clientId) existing.clients.add(clientId);
    return existing;
  }
  const abort = new AbortController();
  const entry = {abort, demand:!speculative, clients:new Set(clientId ? [clientId] : []), bytes:0, downloaded:0};
  const timeout = speculative ? setTimeout(() => {if (!entry.demand) abort.abort();}, 8000) : null;
  const url = new URL(request.url);
  // Nonfingerprinted vN chapter files are namespaced on disk per release;
  // do not populate that new namespace from a previous release's HTTP cache.
  const refreshChapter = url.origin === self.location.origin
    && !url.pathname.startsWith('/assets/arrival/')
    && !url.pathname.startsWith('/assets/destination-orthophotos/');
  entry.response = fetch(new Request(request, {signal:abort.signal, cache:refreshChapter ? 'reload' : request.cache}));
  entry.work = entry.response.then(response => {
    if (speculative && !entry.demand && !usableResponse(response, resourcePolicy(request))) {
      abort.abort(); return 0; // Never download an opaque/no-store/error body speculatively.
    }
    return persist(request, response.clone(), maxBytes, bytes => {entry.downloaded += bytes;});
  })
    .then(bytes => {entry.bytes = bytes; return bytes;})
    .catch(() => {if (speculative && !entry.demand) abort.abort(); metrics.failures++; return 0;})
    .finally(() => {clearTimeout(timeout); if (flights.get(request.url) === entry) flights.delete(request.url);});
  flights.set(request.url, entry);
  return entry;
}

function cancelClient(clientId) {
  for (let i = pending.length - 1; i >= 0; i--) if (pending[i].clientId === clientId) pending.splice(i, 1);
  for (const entry of flights.values()) {
    entry.clients.delete(clientId);
    if (!entry.demand && !entry.clients.size) entry.abort.abort();
  }
}

async function pump() {
  if (pumping) return pumping;
  pumping = (async () => {
    // Browser may restart an activated worker without an activate event. Load
    // the durable conservative tier before deciding speculative concurrency.
    await serialCommit(() => loadIndex()).catch(() => {});
    async function run() {
      while (pending.length) {
        if (limits.prefetchBytes - metrics.prefetchBytes - reservedBytes < 4096) break;
        const item = pending.shift();
        const request = new Request(item.url, {mode:'cors', credentials:'omit', cache:'force-cache', priority:'low'});
        if (await cachedResponse(request)) continue;
        const available = limits.prefetchBytes - metrics.prefetchBytes - reservedBytes;
        if (available < 4096) {pending.unshift(item); break;}
        const reservation = Math.min(ASSET_LIMIT, available);
        reservedBytes += reservation;
        try {
          const entry = networkFlight(request, {speculative:true, clientId:item.clientId, maxBytes:reservation});
          await entry.work;
          metrics.prefetchBytes += entry.downloaded;
        } finally {reservedBytes -= reservation;}
      }
    }
    await Promise.all(Array.from({length:limits.concurrency}, run));
  })().finally(() => {pumping = null;});
  return pumping;
}

function summary() {
  return {...metrics, release, queued:pending.length, inFlight:flights.size,
    diskBytes:index ? [...index.values()].reduce((sum, record) => sum + record.bytes, 0) : 0,
    entries:index?.size || 0, limits:{...limits}};
}

self.addEventListener('install', event => {if (VALID_RELEASE) event.waitUntil(self.skipWaiting());});
self.addEventListener('activate', event => {
  if (!VALID_RELEASE) return;
  event.waitUntil((async () => {
    for (const name of await caches.keys().catch(() => [])) if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    await serialCommit(async () => {await loadIndex(); await trim(await openCache());}).catch(() => {});
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (!usableRequest(event.request)) return;
  let completion = Promise.resolve();
  const responsePromise = (async () => {
    const response = await cachedResponse(event.request);
    if (response) return response;
    metrics.misses++;
    const entry = networkFlight(event.request);
    completion = entry.work;
    return (await entry.response).clone();
  })();
  event.respondWith(responsePromise);
  // Register synchronously; Safari rejects a first waitUntil after dispatch.
  event.waitUntil(responsePromise.then(() => completion).catch(() => {}));
});
self.addEventListener('message', event => {
  if (!VALID_RELEASE || event.data?.protocol !== PROTOCOL || !event.source?.id) return;
  try {if (new URL(event.source.url).origin !== self.location.origin) return;} catch {return;}
  const {type} = event.data;
  const reply = value => {try {event.ports?.[0]?.postMessage(value);} catch { /* Closed page. */ }};
  event.waitUntil((async () => {
    if (type === 'configure') {
      // Clients may choose only stricter budgets than the desktop defaults.
      const mobile = event.data.mobile === true || event.data.saveData === true;
      await serialCommit(async () => {
        const cache = await openCache();
        await loadPolicy(cache);
        if (mobile) limits = {...MOBILE_LIMITS};
        await loadIndex();
        await trim(cache);
        // Free our own excess bytes first, so a tight origin quota does not
        // prevent the tiny durable tier record from being written.
        if (mobile) await saveMobilePolicy(cache).catch(() => {});
      }).catch(() => {if (mobile) limits = {...MOBILE_LIMITS};});
    } else if (type === 'stats') {
      // In-memory counters reset with worker lifetime, but disk totals must
      // reflect persistent entries rather than reporting a misleading zero.
      await serialCommit(async () => {await loadIndex(); await trim(await openCache());}).catch(() => {});
    } else if (type === 'cancel') cancelClient(event.source.id);
    else if (type === 'prefetch') {
      if (event.data.saveData === true || self.navigator?.connection?.saveData === true) {reply({...summary(), skipped:'save-data'}); return;}
      if (event.data.replace === true) cancelClient(event.source.id);
      const urls = Array.isArray(event.data.urls) ? event.data.urls.slice(0,MAX_QUEUE) : [];
      const urgent = event.data.priority === 'urgent';
      const urgentItems = [];
      for (const input of urls) {
        if (typeof input !== 'string' || !resourcePolicy(input)) continue;
        const url = new URL(input, self.location.origin).href;
        if (flights.has(url)) {flights.get(url).clients.add(event.source.id); continue;}
        const present = pending.findIndex(item => item.url === url && item.clientId === event.source.id);
        if (present >= 0) {if (!urgent) continue; pending.splice(present,1);}
        const item = {url, clientId:event.source.id};
        if (urgent) urgentItems.push(item); else if (pending.length < MAX_QUEUE) pending.push(item);
      }
      if (urgentItems.length) {pending.unshift(...urgentItems); pending.length = Math.min(pending.length,MAX_QUEUE);}
      reply(summary());
      await pump();
      return;
    }
    reply(summary());
  })().catch(() => reply({...summary(), available:false})));
});
