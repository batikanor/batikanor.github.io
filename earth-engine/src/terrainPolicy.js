/**
 * Terrain is regional context, not a prerequisite for a venue chapter.
 *
 * City miniatures use an authored local ground plane. Loading high-zoom DEM
 * behind those chapters both competes for the network and offsets that plane
 * from its buildings. Keep terrain for World/regional exploration, pause it
 * at a local closeup, and preserve the user's ON/OFF preference separately.
 */
export const TERRAIN_CLOSEUP_MIN_ZOOM = 15.5;
export const HILLSHADE_MAX_ZOOM = 12;

// Checked against Mapterhorn's actual centre-tile responses on 2026-09-30:
// z12 succeeds here, while z16 returns 404 (Hong Kong/Beykoz also lack z13;
// Rome lacks z14; Helsinki still has z14). Its TileJSON advertises
// global bounds but does not describe these regional high-zoom coverage gaps.
// This is a conservative fallback level, not a claim about an entire city.
const TERRAIN_GAPS = Object.freeze({
  'hong-kong-talent-engage-eurotech-healthtech-2026': Object.freeze({
    id: 'hong-kong-venue', maxNativeZoom: 12,
  }),
  'ethrome-2025': Object.freeze({id: 'rome-ostiense', maxNativeZoom: 12}),
  'huawei-tech-arena-finland-2025': Object.freeze({id: 'helsinki-venue', maxNativeZoom: 12}),
  'bachelors-thesis': Object.freeze({id: 'beykoz-campus', maxNativeZoom: 12}),
  'tgu-perfect-gpa': Object.freeze({id: 'beykoz-campus', maxNativeZoom: 12}),
});

export function terrainGapForEvent(eventSlug) {
  return Object.hasOwn(TERRAIN_GAPS, eventSlug) ? TERRAIN_GAPS[eventSlug] : null;
}

export function hasTerrainGap(eventSlug) {
  return terrainGapForEvent(eventSlug) !== null;
}

/**
 * Return a rendering policy without modifying map state or user preferences.
 * `terrain-coarse` must be a separate raster-dem source capped at z12, with
 * the same Mapterhorn encoding and URL as the normal terrain source.
 *
 * localScene means an authored chapter is selected, not that data has arrived:
 * missing/slow optional assets must not bring back expensive DEM requests.
 */
export function terrainPolicy({
  enabled = true, driving = false, localScene = false, zoom = 0,
  eventSlug = null,
} = {}) {
  const gap = terrainGapForEvent(eventSlug);
  const localCloseup = !!localScene && Number.isFinite(zoom)
    && zoom >= TERRAIN_CLOSEUP_MIN_ZOOM;
  const reason = driving ? 'driving' : localCloseup ? 'local-scene' : null;
  const paused = !!enabled && reason !== null;
  const showTerrain = !!enabled && !reason;
  return Object.freeze({
    showTerrain,
    source: showTerrain ? gap ? 'terrain-coarse' : 'terrain' : null,
    maxNativeZoom: showTerrain ? gap?.maxNativeZoom ?? 16 : null,
    paused,
    reason: paused ? reason : null,
    hillshadeVisible: showTerrain && Number.isFinite(zoom)
      && zoom >= 5 && zoom < HILLSHADE_MAX_ZOOM,
  });
}
