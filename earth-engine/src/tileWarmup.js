/**
 * Bounded HTTP-cache warmup for the *cacheable* ESA overview tiles. This is
 * deliberately not a second hidden MapLibre map: it neither allocates WebGL
 * textures nor downloads high-zoom imagery for every achievement.
 */
export const OVERVIEW_ZOOM = 11;
export const DETAIL_ZOOM = 14;

export function overviewTileAt({lng, lat}, zoom = OVERVIEW_ZOOM) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const n = 2 ** zoom;
  const safeLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const x = (lng + 180) / 360 * n;
  const radians = safeLat * Math.PI / 180;
  const y = (1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2 * n;
  return {z: zoom, x: Math.floor(x) % n, y: Math.min(n - 1, Math.max(0, Math.floor(y))), fx:x-Math.floor(x), fy:y-Math.floor(y)};
}

export function overviewTileKey({z, x, y, key}) { return key ?? `${z}/${x}/${y}`; }

/** Center tile plus its nearest horizontal/vertical neighbors: four tiles. */
export function overviewCover(coordinates, zoom = OVERVIEW_ZOOM) {
  const center = overviewTileAt(coordinates, zoom);
  if (!center) return [];
  const n = 2 ** zoom;
  const adjacentX = (center.x + (center.fx < .5 ? -1 : 1) + n) % n;
  const adjacentY = Math.min(n - 1, Math.max(0, center.y + (center.fy < .5 ? -1 : 1)));
  return [
    {z:zoom,x:center.x,y:center.y},
    {z:zoom,x:adjacentX,y:center.y},
    {z:zoom,x:center.x,y:adjacentY},
    {z:zoom,x:adjacentX,y:adjacentY}
  ].filter((tile, index, tiles) => tiles.findIndex(other => overviewTileKey(other) === overviewTileKey(tile)) === index);
}

function uniqueTiles(tiles, maxTiles) {
  const seen = new Set();
  return tiles.filter(tile => {
    const key = overviewTileKey(tile);
    if (seen.has(key) || seen.size >= maxTiles) return false;
    seen.add(key);
    return true;
  });
}

/** Predictable, inspectable budget: broad z11 cover, tiny sharp z14 centre. */
export function introOverviewPlan(achievements, {mobile = false} = {}) {
  const events = Array.isArray(achievements) ? achievements : [];
  const priority = events.slice(0, mobile ? 1 : 2).flatMap(event => overviewCover(event.coordinates));
  const sharp = events.slice(0, mobile ? 1 : 2).flatMap(event => mobile
    ? [overviewTileAt(event.coordinates, DETAIL_ZOOM)]
    : overviewCover(event.coordinates, DETAIL_ZOOM)).filter(Boolean);
  const centerTiles = events.map(event => overviewTileAt(event.coordinates)).filter(Boolean);
  return uniqueTiles([...priority, ...sharp, ...centerTiles], mobile ? 7 : 34);
}

/** Warm one likely arrival and its nearest chronology neighbor, not the world. */
export function adjacentOverviewPlan(achievements, index, {mobile = false} = {}) {
  const events = Array.isArray(achievements) ? achievements : [];
  if (!events.length || index < 0 || index >= events.length) return [];
  const next = events[index + 1];
  const previous = events[index - 1];
  const tiles = [
    ...(next ? overviewCover(next.coordinates) : []),
    ...(next ? mobile ? [overviewTileAt(next.coordinates, DETAIL_ZOOM)] : overviewCover(next.coordinates, DETAIL_ZOOM) : []),
    ...(previous ? mobile ? [overviewTileAt(previous.coordinates)] : overviewCover(previous.coordinates) : [])
  ].filter(Boolean);
  return uniqueTiles(tiles, mobile ? 6 : 12);
}

export function warmupProfile({saveData = false, effectiveType = '', deviceMemory, coarsePointer = false} = {}) {
  if (saveData || /(?:^|slow-)2g$/.test(effectiveType) || Number.isFinite(deviceMemory) && deviceMemory <= 2) {
    return {enabled:false, mobile:true, concurrency:0, sessionByteLimit:0, batchByteLimit:0};
  }
  const mobile = coarsePointer || effectiveType === '3g' || Number.isFinite(deviceMemory) && deviceMemory <= 4;
  return mobile
    ? {enabled:true, mobile:true, concurrency:1, sessionByteLimit:3_000_000, batchByteLimit:950_000}
    : {enabled:true, mobile:false, concurrency:2, sessionByteLimit:12_000_000, batchByteLimit:5_000_000};
}

export function tileUrl(template, tile) {
  return template.replaceAll('{z}', String(tile.z)).replaceAll('{x}', String(tile.x)).replaceAll('{y}', String(tile.y));
}

/** Fetches populate the browser HTTP cache; MapLibre then uses the same URLs. */
export function createTileWarmup({template, urlForTile = tile => tileUrl(template,tile), fetcher = fetch, profile = warmupProfile()}) {
  if (!template || typeof fetcher !== 'function') throw new TypeError('Tile warmup needs a URL template and fetcher');
  const warmed = new Set();
  const controllers = new Set();
  const jobs = new Map();
  const metrics = {requests:0, completed:0, bytes:0, failures:0, aborted:0, skipped:0};
  let generation = 0;
  let running = 0;
  let paused = false;
  let sequence = 0;

  function cancel() {
    generation++;
    for (const controller of controllers) controller.abort();
    controllers.clear();
    for (const job of jobs.values()) job.resolve();
    jobs.clear();
  }

  function pump() {
    if (paused || !profile.enabled) return;
    while (running < profile.concurrency) {
      const job = [...jobs.values()].filter(item => !item.started)
        .sort((a,b) => b.priority-a.priority || a.order-b.order)[0];
      if (!job) return;
      if (metrics.bytes >= profile.sessionByteLimit || job.batches.every(batch => batch.bytes >= batch.maxBytes)) {
        jobs.delete(job.key); metrics.skipped++; job.resolve(); continue;
      }
      job.started = true;
      running++;
      const current = generation;
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 8000);
      metrics.requests++;
      void (async () => {
        try {
          const response = await fetcher(urlForTile(job.tile), {
            mode:'cors', credentials:'same-origin', cache:'force-cache', priority:'low', signal:controller.signal
          });
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error(`Imagery returned ${response.status}`);
          const data = await response.blob();
          if (current !== generation) return;
          warmed.add(job.key);
          metrics.completed++;
          metrics.bytes += data.size;
          for (const batch of job.batches) batch.bytes += data.size;
        } catch {
          if (controller.signal.aborted) metrics.aborted++;
          else metrics.failures++;
        } finally {
          clearTimeout(timeout);
          controllers.delete(controller);
          if (jobs.get(job.key) === job) jobs.delete(job.key);
          running--;
          job.resolve();
          pump();
        }
      })();
    }
  }

  /** Additive priority queue: hovering must not erase all-destination work. */
  async function warm(tiles, {maxBytes = profile.batchByteLimit, priority = 0} = {}) {
    if (!profile.enabled || !Array.isArray(tiles) || !tiles.length) return {...metrics};
    const batch = {bytes:0,maxBytes};
    const pending = [];
    const seen = new Set();
    for (const tile of tiles) {
      const key = overviewTileKey(tile);
      if (warmed.has(key) || seen.has(key)) continue;
      seen.add(key);
      let job = jobs.get(key);
      if (!job) {
        let resolve;
        const promise = new Promise(done => {resolve = done;});
        job = {tile,key,priority,order:sequence++,batches:[],promise,resolve,started:false};
        jobs.set(key,job);
      }
      job.priority = Math.max(job.priority,priority);
      job.batches.push(batch);
      pending.push(job.promise);
    }
    pump();
    await Promise.all(pending);
    return {...metrics};
  }

  return {warm, cancel, pause:() => {paused=true;}, resume:() => {paused=false;pump();}, profile,
    stats:() => ({...metrics, cachedTiles:warmed.size, queued:Math.max(0,jobs.size-running), inFlight:running, paused})};
}
