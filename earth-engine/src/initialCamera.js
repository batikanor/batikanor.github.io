export const ISOMETRIC_CAMERA = Object.freeze({zoom:16.8, pitch:49, bearing:42});

/**
 * Avoid a globe-to-street tile waterfall on an explicit achievement deep link.
 * Desktop's normal homepage and all World/CV views still start on the Earth.
 * `worldCamera` is returned unchanged so the World button keeps its meaning.
 */
export function initialMapCamera(route, achievements, worldCamera,
  {fastStart = false, isometricEventSlugs = new Set()} = {}) {
  if (route?.view || !Array.isArray(achievements)) return worldCamera;
  const event = route?.eventSlug
    ? achievements.find(candidate => candidate.slug === route.eventSlug)
    : fastStart ? achievements[0] : null;
  const lng = event?.coordinates?.lng;
  const lat = event?.coordinates?.lat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return worldCamera;
  // Starting an authored 3D chapter at its final framing lets the single
  // active mesh begin loading on style.load, before the popup-offset fly.
  if (route?.eventSlug && isometricEventSlugs.has(route.eventSlug)) {
    return {center:[lng, lat], ...ISOMETRIC_CAMERA};
  }
  // Else remain within the regional imagery's native z14 ceiling. The short
  // flyTo supplies the venue's final pitch/bearing.
  return {center:[lng, lat], zoom:13.8, pitch:0, bearing:0};
}

/** Save bandwidth and avoid a CPU-heavy globe flight on constrained devices. */
export function preferLocalStart({deviceMemory, saveData = false, coarsePointer = false, reducedMotion = false}) {
  return !!(saveData || coarsePointer || reducedMotion
    || Number.isFinite(deviceMemory) && deviceMemory <= 4);
}
