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

export function overviewTileKey({z, x, y}) { return `${z}/${x}/${y}`; }

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
export function createTileWarmup({template, fetcher = fetch, profile = warmupProfile()}) {
  if (!template || typeof fetcher !== 'function') throw new TypeError('Tile warmup needs a URL template and fetcher');
  const warmed = new Set();
  const controllers = new Set();
  const metrics = {requests:0, completed:0, bytes:0, failures:0, aborted:0};
  let generation = 0;

  function cancel() {
    generation++;
    for (const controller of controllers) controller.abort();
    controllers.clear();
  }

  async function warm(tiles, {maxBytes = profile.batchByteLimit} = {}) {
    cancel();
    if (!profile.enabled || !Array.isArray(tiles) || !tiles.length) return {...metrics};
    const current = generation;
    const pending = tiles.filter(tile => !warmed.has(overviewTileKey(tile)));
    let offset = 0;
    let batchBytes = 0;
    async function worker() {
      while (current === generation && offset < pending.length
        && batchBytes < maxBytes && metrics.bytes < profile.sessionByteLimit) {
        const tile = pending[offset++];
        const key = overviewTileKey(tile);
        const controller = new AbortController();
        controllers.add(controller);
        const timeout = setTimeout(() => controller.abort(), 5000);
        metrics.requests++;
        try {
          const response = await fetcher(tileUrl(template, tile), {
            mode:'cors', credentials:'same-origin', cache:'force-cache', priority:'low', signal:controller.signal
          });
          if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) {
            throw new Error(`ESA overview returned ${response.status}`);
          }
          const data = await response.blob();
          if (current !== generation) break;
          warmed.add(key);
          metrics.completed++;
          metrics.bytes += data.size;
          batchBytes += data.size;
        } catch (error) {
          if (controller.signal.aborted) metrics.aborted++;
          else metrics.failures++;
        } finally {
          clearTimeout(timeout);
          controllers.delete(controller);
        }
      }
    }
    await Promise.all(Array.from({length:Math.min(profile.concurrency, pending.length)}, worker));
    return {...metrics};
  }

  return {warm, cancel, profile, stats:() => ({...metrics, cachedTiles:warmed.size})};
}
