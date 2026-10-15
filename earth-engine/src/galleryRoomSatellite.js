import {GALLERY_SATELLITE_DATA} from './galleryRoomSatelliteData.js';

export {GALLERY_SATELLITE_DATA};
export const GALLERY_SATELLITE_CACHE_SIZE = 3;

/** The orthographic globe's entire viewport must remain inside a detail patch. */
export function gallerySatellitePatch(latitude, longitude, zoom, aspect = 1) {
  if (![latitude, longitude, zoom, aspect].every(Number.isFinite) || zoom < 1 || aspect <= 0) return null;
  const latSpan = 1.23 * Math.max(1, 1 / aspect) / zoom * 180 / Math.PI;
  const lngSpan = 1.23 * Math.max(1, aspect) / zoom * 180 / Math.PI / Math.max(.1, Math.cos(latitude * Math.PI / 180));
  const candidates = GALLERY_SATELLITE_DATA.regions.flatMap(region => region.levels)
    .filter(level => zoom >= level.minimumZoom && longitude - lngSpan >= level.bounds[0]
      && latitude - latSpan >= level.bounds[1] && longitude + lngSpan <= level.bounds[2]
      && latitude + latSpan <= level.bounds[3]);
  const distance = level => Math.hypot(latitude - (level.bounds[1] + level.bounds[3]) / 2,
    (longitude - (level.bounds[0] + level.bounds[2]) / 2) * Math.cos(latitude * Math.PI / 180));
  return candidates.sort((a, b) => (a.level === 'city' ? 0 : 1) - (b.level === 'city' ? 0 : 1)
    || distance(a) - distance(b) || a.id.localeCompare(b.id))[0] ?? null;
}

export function gallerySatelliteProjectLevels(slug) {
  return GALLERY_SATELLITE_DATA.regions.find(region => region.slugs.includes(slug))?.levels ?? [];
}
