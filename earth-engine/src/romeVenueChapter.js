import {distanceMetres} from './geo.js';

// Deliberately different from the surveyed Munich/Berlin LoD2 chapters:
// Lazio's real 2020 orthophoto supplies the close ground, OSM supplies mapped
// footprint/level tags, and the venue's four floors come from its owner. Flat
// roofs / 3m-per-level heights are only an explicitly illustrative massing.
const ID = 'rome-ostiense';
const VENUE = [12.4791336, 41.8678291];
const MIN_ZOOM = 16.5;
const MAX_DISTANCE_M = 460;
const MAX_METADATA_BYTES = 8_000;
const MAX_GEOMETRY_BYTES = 110_000;
const MAX_IMAGE_BYTES = 850_000;
const FETCH_RETRIES = 2;
const LAYERS = [`${ID}-footprints`, `${ID}-massing`, `${ID}-ground`];

function lowBandwidthDevice() {
  const memory = typeof navigator === 'undefined' ? undefined : navigator.deviceMemory;
  const saveData = typeof navigator !== 'undefined' && navigator.connection?.saveData;
  return !!(saveData
    || (Number.isFinite(memory) ? memory <= 4
      : typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches));
}

/** Pure selector for tests; the larger image still decodes to only 10.2 MiB. */
export function chooseRomeImage(metadata, {mobile = false} = {}) {
  const product = metadata?.ground?.products?.[mobile ? '800' : '1600'];
  if (!product || !Number.isInteger(product.bytes) || product.bytes <= 0
    || product.bytes > (mobile ? 250_000 : MAX_IMAGE_BYTES)
    || !Number.isInteger(product.decoded_rgba_bytes)
    || product.decoded_rgba_bytes > (mobile ? 3_000_000 : 11_000_000)
    || !/^rome-ostiense-agea2020-(800|1600)-v1\.webp$/.test(product.asset)) {
    throw new Error('Rome imagery exceeds the venue chapter budget');
  }
  return product;
}

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new Error('Rome chapter fetch aborted')); return; }
    const timer = setTimeout(done, ms);
    function done() { signal.removeEventListener('abort', cancel); resolve(); }
    function cancel() { clearTimeout(timer); reject(new Error('Rome chapter fetch aborted')); }
    signal.addEventListener('abort', cancel, {once: true});
  });
}

/** Retry only temporary transport/server failures; never retry invalid data. */
export async function fetchRomeAsset(url, maxBytes, signal) {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {signal});
      if (!response.ok) {
        const error = new Error(`Rome chapter HTTP ${response.status}`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw error;
      }
      const advertised = Number(response.headers.get('content-length'));
      if (advertised > maxBytes) throw new Error('Rome chapter asset exceeds byte budget');
      const blob = await response.blob();
      if (blob.size > maxBytes) throw new Error('Rome chapter asset exceeds byte budget');
      return blob;
    } catch (error) {
      if (signal.aborted || attempt === FETCH_RETRIES || error.retryable === false) throw error;
      if (error.retryable !== true && !(error instanceof TypeError)) throw error;
      await waitForRetry(250 * 2 ** attempt, signal);
    }
  }
}

function validateMetadata(metadata) {
  if (metadata?.id !== 'rome-ostiense-v1'
    || !Array.isArray(metadata.image_corners_lonlat)
    || metadata.image_corners_lonlat.length !== 4
    || metadata.image_corners_lonlat.some(pair => !Array.isArray(pair) || pair.length !== 2
      || !Number.isFinite(pair[0]) || !Number.isFinite(pair[1])
      || Math.abs(pair[0] - VENUE[0]) > 0.01 || Math.abs(pair[1] - VENUE[1]) > 0.01)
    || metadata.buildings?.license !== 'ODbL 1.0'
    || metadata.ground?.license !== 'CC BY 4.0') {
    throw new Error('Rome chapter provenance/coverage is invalid');
  }
  return metadata;
}

function validateBuildings(collection, metadata) {
  if (collection?.type !== 'FeatureCollection'
    || !Array.isArray(collection.features)
    || collection.features.length !== metadata.buildings.features
    || collection.features.length > 250
    || !collection.features.some(feature => feature.properties?.venue === true)) {
    throw new Error('Rome chapter footprints are missing or malformed');
  }
  return collection;
}

/**
 * One fixed-source, MapLibre-pitched venue miniature. The chapter stays inert
 * on the homepage; explicitly focusing Rome prefetches its bounded assets
 * during the camera flight. A superseding focus cancels pending fetches. The
 * public project popup and its media remain entirely owned by main.js.
 */
export function createRomeVenueChapter({baseUrl = import.meta.env?.BASE_URL ?? '/', onChange = null} = {}) {
  let map = null;
  let focused = false;
  let enabled = true;
  let active = null;
  let hasLayers = false;
  let objectUrl = null;

  const report = () => onChange?.({visible: hasLayers});
  const dataUrl = name => `${baseUrl}data/${name}`;

  function removeLayers() {
    if (map) {
      for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [`${ID}-buildings`, `${ID}-image`]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    }
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    if (hasLayers) { hasLayers = false; report(); }
  }

  function release() {
    active?.abort.abort();
    active = null;
    removeLayers();
  }

  function isEligible() {
    if (!map || !focused || !enabled || map.isMoving()) return false;
    const c = map.getCenter();
    return map.getZoom() >= MIN_ZOOM && map.getZoom() <= 20.5
      && distanceMetres([c.lng, c.lat], VENUE) <= MAX_DISTANCE_M;
  }

  function mount(entry) {
    if (active !== entry || !entry.data || !isEligible() || hasLayers) return;
    let pendingUrl = null;
    try {
      const {metadata, imageBlob, buildings} = entry.data;
      pendingUrl = URL.createObjectURL(imageBlob);
      map.addSource(`${ID}-image`, {
        type: 'image', url: pendingUrl, coordinates: metadata.image_corners_lonlat,
      });
      objectUrl = pendingUrl;
      pendingUrl = null;
      map.addLayer({
        id: `${ID}-ground`, type: 'raster', source: `${ID}-image`, minzoom: MIN_ZOOM,
        paint: {'raster-fade-duration': 220, 'raster-opacity': 0.99},
      }, 'earth-engine-car');
      map.addSource(`${ID}-buildings`, {type: 'geojson', data: buildings});
      // Missing heights stay mapped outlines, never invented city blocks.
      map.addLayer({
        id: `${ID}-footprints`, type: 'line', source: `${ID}-buildings`, minzoom: MIN_ZOOM,
        paint: {'line-color': '#293d40', 'line-opacity': 0.58,
          'line-width': ['interpolate', ['linear'], ['zoom'], 16.5, 0.55, 19, 1.2]},
      }, 'earth-engine-car');
      map.addLayer({
        id: `${ID}-massing`, type: 'fill-extrusion', source: `${ID}-buildings`, minzoom: MIN_ZOOM,
        filter: ['>', ['get', 'height_m'], 0],
        paint: {
          'fill-extrusion-height': ['get', 'height_m'],
          'fill-extrusion-base': 0,
          'fill-extrusion-color': ['get', 'material_color'],
          'fill-extrusion-opacity': 0.9,
          'fill-extrusion-vertical-gradient': true,
        },
      }, 'earth-engine-car');
      hasLayers = true;
      report();
    } catch (error) {
      console.warn('Rome isometric miniature unavailable; geographic map remains usable.', error);
      release();
    } finally {
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    }
  }

  async function load(entry) {
    try {
      const metadataBlob = await fetchRomeAsset(dataUrl('rome-ostiense-v1.json'),
        MAX_METADATA_BYTES, entry.abort.signal);
      const metadata = validateMetadata(JSON.parse(await metadataBlob.text()));
      const product = chooseRomeImage(metadata, {mobile: lowBandwidthDevice()});
      const [imageBlob, geometryBlob] = await Promise.all([
        fetchRomeAsset(dataUrl(product.asset), product.bytes, entry.abort.signal),
        fetchRomeAsset(dataUrl(metadata.buildings.asset), MAX_GEOMETRY_BYTES, entry.abort.signal),
      ]);
      if (imageBlob.size !== product.bytes || geometryBlob.size !== metadata.buildings.bytes) {
        throw new Error('Rome chapter bytes differ from source manifest');
      }
      const buildings = validateBuildings(JSON.parse(await geometryBlob.text()), metadata);
      if (active !== entry || entry.abort.signal.aborted) return;
      // Keep at most one validated, compressed chapter warm until moveend.
      // Completing the fetch during a flight must not strand the active entry.
      entry.data = {metadata, imageBlob, buildings};
      mount(entry);
    } catch (error) {
      if (entry.abort.signal.aborted || active !== entry) return;
      console.warn('Rome isometric miniature unavailable; geographic map remains usable.', error);
      release();
    }
  }

  function prepare() {
    if (!map || !focused || !enabled || active) return;
    active = {abort: new AbortController(), data: null};
    void load(active);
  }

  function evaluate() {
    if (!map || map.isMoving()) return;
    if (!focused || !enabled) { release(); return; }
    if (!isEligible()) { removeLayers(); return; }
    prepare();
    mount(active);
  }

  return {
    onAdd(nextMap) {
      map = nextMap;
      map.on('moveend', evaluate);
      prepare();
      evaluate();
    },
    setFocus(slug) {
      focused = slug === 'ethrome-2025';
      if (!focused) release();
      else { prepare(); evaluate(); }
    },
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) release();
      else { prepare(); evaluate(); }
    },
    isVisible() { return hasLayers; },
    destroy() { if (map) map.off('moveend', evaluate); release(); map = null; },
  };
}
