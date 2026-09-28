/**
 * Semantic level of the map's DOM markers. These are geographic display levels,
 * not claims about the native resolution of the underlying imagery.
 *
 * A 100 km scale bar in central Europe corresponds roughly to zoom 7. The
 * previous country → city transition at 7.3 left Germany as one label there.
 * City markers now begin at 5.0 so a whole-country framing can include Munich
 * and Berlin above the bottom-center chronology without reverting to GERMANY.
 * Achievement points take over at 9.8 (the GeoJSON layer's current minzoom).
 */
export const MARKER_ZOOM = Object.freeze({
  regionToCountry: 3.8,
  countryToCity: 5.0,
  cityToAchievement: 9.8
});

export function markerLevelForZoom(zoom) {
  if (!Number.isFinite(zoom)) throw new TypeError('zoom must be finite');
  if (zoom < MARKER_ZOOM.regionToCountry) return 'region';
  if (zoom < MARKER_ZOOM.countryToCity) return 'country';
  if (zoom < MARKER_ZOOM.cityToAchievement) return 'city';
  return 'achievement';
}

/**
 * Return the weighted centre of locations on the sphere as [longitude, latitude].
 * Use one point per distinct city for region labels: nine achievements in Munich
 * should not pull the label nine times harder than a single Hong Kong or Nara
 * achievement. Supply weight only when a different editorial meaning is intended.
 * This handles the antimeridian correctly, unlike averaging degrees directly.
 */
export function geographicCentroid(points) {
  if (!Array.isArray(points) || points.length === 0) throw new TypeError('points must be a non-empty array');
  let x = 0, y = 0, z = 0;
  for (const point of points) {
    const {lng, lat, weight = 1} = point ?? {};
    if (!Number.isFinite(lng) || lng < -180 || lng > 180 || !Number.isFinite(lat) || lat < -90 || lat > 90)
      throw new TypeError('each point needs valid lng and lat');
    if (!Number.isFinite(weight) || weight <= 0) throw new TypeError('point weight must be positive and finite');
    const lambda = lng * Math.PI / 180;
    const phi = lat * Math.PI / 180;
    x += weight * Math.cos(phi) * Math.cos(lambda);
    y += weight * Math.cos(phi) * Math.sin(lambda);
    z += weight * Math.sin(phi);
  }
  const horizontal = Math.hypot(x, y);
  if (Math.hypot(horizontal, z) < 1e-12) throw new RangeError('centroid is undefined for cancelling antipodal points');
  return [Math.atan2(y, x) * 180 / Math.PI, Math.atan2(z, horizontal) * 180 / Math.PI];
}

/**
 * Deterministic screen-space declutter for the current semantic level.
 * A maplibre Marker is a DOM element, so MapLibre's symbol collision system
 * cannot suppress overlaps for us. Pass *all* candidate markers at the current
 * level and their current projected positions. A selected marker can be given a
 * high priority; otherwise more important/larger city groups win. This returns
 * the accepted candidate records in their original order without mutating them.
 *
 * Candidate: {id, x, y, width, height, priority}. x/y is marker centre in px.
 */
export function declutterMarkers(candidates, {padding = 8} = {}) {
  if (!Array.isArray(candidates)) throw new TypeError('candidates must be an array');
  if (!Number.isFinite(padding) || padding < 0) throw new TypeError('padding must be non-negative');
  const ranked = candidates.map((candidate, index) => {
    const {x, y, width, height, priority = 0} = candidate ?? {};
    if (![x, y, width, height, priority].every(Number.isFinite) || width <= 0 || height <= 0)
      throw new TypeError('candidate needs finite x/y/width/height/priority and positive dimensions');
    return {candidate, index, priority, box:{left:x-width/2-padding, right:x+width/2+padding, top:y-height/2-padding, bottom:y+height/2+padding}};
  }).sort((a,b)=>b.priority-a.priority || a.index-b.index);
  const accepted=[];
  for (const item of ranked) {
    const overlap=accepted.some(other=>
      item.box.left<other.box.right && item.box.right>other.box.left &&
      item.box.top<other.box.bottom && item.box.bottom>other.box.top);
    if (!overlap) accepted.push(item);
  }
  return accepted.sort((a,b)=>a.index-b.index).map(item=>item.candidate);
}
