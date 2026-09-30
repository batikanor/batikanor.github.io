import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {distanceMetres} from './geo.js';

// Regional LoD2 chapters, not a second synthetic world. All positions in a
// BLD2 asset are Mercator-local metres relative to its WGS84 origin: +x east,
// +y source elevation, +z north. The source's actual roof/wall triangles are
// retained. A georeferenced aerial-photo atlas only colours those roofs.
const EARTH_CIRCUMFERENCE_M = 40_075_016.68557849;
const MAX_MESH_BYTES = 8_000_000;
const MAX_COMPRESSED_ATLAS_BYTES = 10_000_000;
const MAX_GROUND_IMAGE_BYTES = 4_000_000;
const MAX_TEXTURE_DIMENSION = 4096;
const MIPMAP_STORAGE_FACTOR = 4 / 3;
const DEFAULT_MIN_ZOOM = 15.5;
const DEFAULT_MAX_ZOOM = 20.25;
const RENDER_RADIUS_PADDING_M = 550;
// Keep only compressed, same-origin chapter payloads warm. GPU meshes/textures
// are still released when a visitor leaves a city.
const MAX_WARM_CHAPTERS = 3;
const FETCH_RETRIES = 2;
const RECOVERY_DELAY_MS = 1500;
const MAX_RECOVERY_ATTEMPTS = 1;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameOrigin(a, b) {
  return Array.isArray(a) && Array.isArray(b) && a.length === 2 && b.length === 2
    && Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
}

function normalizeRegion(region) {
  assert(region && typeof region.id === 'string' && /^[a-z0-9-]+$/.test(region.id), 'Isometric region needs a stable kebab-case id');
  assert(Array.isArray(region.origin) && region.origin.length === 2
    && Number.isFinite(region.origin[0]) && Number.isFinite(region.origin[1])
    && Math.abs(region.origin[0]) <= 180 && Math.abs(region.origin[1]) < 85,
  `${region.id}: invalid WGS84 origin`);
  assert(Number.isFinite(region.radiusM) && region.radiusM > 0 && region.radiusM <= 1500,
    `${region.id}: invalid local asset radius`);
  assert(typeof region.meshUrl === 'string' && region.meshUrl.length > 0,
    `${region.id}: missing BLD2 asset URL`);
  if (region.roofAtlas) {
    assert(typeof region.roofAtlas.imageUrl === 'string' && typeof region.roofAtlas.metadataUrl === 'string',
      `${region.id}: roof atlas requires image and metadata URLs`);
  }
  if (region.groundImage) {
    assert(typeof region.groundImage.imageUrl === 'string'
      && typeof region.groundImage.metadataUrl === 'string',
    `${region.id}: ground image requires image and metadata URLs`);
  }
  const minZoom = region.minZoom ?? DEFAULT_MIN_ZOOM;
  const maxZoom = region.maxZoom ?? DEFAULT_MAX_ZOOM;
  assert(Number.isFinite(minZoom) && Number.isFinite(maxZoom) && minZoom >= 12
    && maxZoom > minZoom && maxZoom <= 22, `${region.id}: invalid zoom range`);
  return Object.freeze({
    ...region,
    origin: Object.freeze([...region.origin]),
    minZoom,
    maxZoom,
    roofAtlas: region.roofAtlas ? Object.freeze({...region.roofAtlas}) : null,
    groundImage: region.groundImage ? Object.freeze({...region.groundImage}) : null,
  });
}

/** Keep a local orthophoto bounded and correctly georeferenced before adding it to MapLibre. */
export function validateGroundImageMetadata(metadata, region) {
  assert(sameOrigin(metadata?.origin_lonlat, region.origin), 'Ground image origin differs from chapter');
  assert(Number.isInteger(metadata.width) && Number.isInteger(metadata.height)
    && metadata.width > 0 && metadata.height > 0
    && metadata.width <= 2048 && metadata.height <= 2048,
  'Ground image exceeds the 2048-pixel mobile texture budget');
  assert(Number.isInteger(metadata.bytes) && metadata.bytes > 0
    && metadata.bytes <= MAX_GROUND_IMAGE_BYTES, 'Ground image exceeds transfer budget');
  assert(Array.isArray(metadata.coordinates) && metadata.coordinates.length === 4
    && metadata.coordinates.every(point => Array.isArray(point) && point.length === 2
      && point.every(Number.isFinite)
      && Math.abs(point[0]) <= 180 && Math.abs(point[1]) < 85
      && distanceMetres(point, region.origin) <= 2000),
  'Ground image has invalid local WGS84 corners');
  const [topLeft, topRight, bottomRight, bottomLeft] = metadata.coordinates;
  const corners = metadata.coordinates;
  const crosses = corners.map((point, index) => {
    const next = corners[(index + 1) % 4];
    const after = corners[(index + 2) % 4];
    return (next[0] - point[0]) * (after[1] - next[1])
      - (next[1] - point[1]) * (after[0] - next[0]);
  });
  assert(topRight[0] > topLeft[0] && bottomRight[0] > bottomLeft[0]
    && topLeft[1] > bottomLeft[1] && topRight[1] > bottomRight[1]
    && crosses.every(cross => cross < -1e-12),
  'Ground image corners must be a clockwise top-left to bottom-left quadrilateral');
  return metadata;
}

/** Strictly decode the small, offline-authored BLD2 v1 payload. */
export function parseBld2(buffer, expectedOrigin) {
  assert(buffer instanceof ArrayBuffer, 'BLD2 input must be an ArrayBuffer');
  assert(buffer.byteLength >= 40 && buffer.byteLength <= MAX_MESH_BYTES, 'BLD2 asset exceeds local mesh budget');
  const header = new DataView(buffer);
  assert(String.fromCharCode(...new Uint8Array(buffer, 0, 4)) === 'BLD2' && header.getUint32(4, true) === 1,
    'Unknown BLD2 signature or version');
  const roofCount = header.getUint32(8, true);
  const wallCount = header.getUint32(12, true);
  assert(roofCount > 0 && wallCount > 0 && roofCount % 3 === 0 && wallCount % 3 === 0,
    'BLD2 roof/wall counts must be non-empty triangles');
  assert(buffer.byteLength === 40 + (roofCount + wallCount) * 12,
    'Truncated or overlong BLD2 positions');
  const origin = [header.getFloat64(24, true), header.getFloat64(32, true)];
  assert(sameOrigin(origin, expectedOrigin), 'BLD2 origin differs from region WGS84 origin');
  const positions = new Float32Array(buffer, 40, (roofCount + wallCount) * 3);
  // Reject wildly misprojected or malformed geometry before handing it to GL.
  for (let offset = 0; offset < positions.length; offset += 3) {
    assert(Number.isFinite(positions[offset]) && Number.isFinite(positions[offset + 1])
      && Number.isFinite(positions[offset + 2])
      && Math.abs(positions[offset]) <= 2500 && Math.abs(positions[offset + 2]) <= 2500
      && positions[offset + 1] > -500 && positions[offset + 1] < 9000,
    `Invalid BLD2 vertex at ${offset / 3}`);
  }
  return {roofCount, wallCount, origin, positions};
}

/** Map a Web-Mercator XYZ aerial atlas onto the *source* roof vertices. */
export function roofUvForAtlas(roofPositions, origin, metadata) {
  assert(sameOrigin(metadata?.origin_lonlat, origin), 'Roof atlas origin differs from BLD2 origin');
  const zoom = metadata.source_tile_zoom;
  const bounds = metadata.source_tile_bounds_xyxy;
  assert(Number.isInteger(zoom) && zoom >= 14 && zoom <= 22
    && Array.isArray(bounds) && bounds.length === 4 && bounds.every(Number.isInteger),
  'Invalid roof atlas Web-Mercator tile grid');
  const [minX, minY, maxX, maxY] = bounds;
  const width = (maxX - minX + 1) * 256;
  const height = (maxY - minY + 1) * 256;
  assert(width > 0 && height > 0 && width <= MAX_TEXTURE_DIMENSION && height <= MAX_TEXTURE_DIMENSION
    && width === metadata.width && height === metadata.height,
  'Roof atlas dimensions disagree with XYZ tile bounds');
  assert(roofPositions.length % 3 === 0, 'Roof atlas requires XYZ vertex positions');
  const tiles = 2 ** zoom;
  const latitude = origin[1] * Math.PI / 180;
  const tileMetres = EARTH_CIRCUMFERENCE_M * Math.cos(latitude) / tiles;
  const originX = (origin[0] + 180) / 360 * tiles;
  const originY = (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 * tiles;
  const uv = new Float32Array(roofPositions.length / 3 * 2);
  for (let index = 0; index < roofPositions.length / 3; index++) {
    const east = roofPositions[index * 3];
    const north = roofPositions[index * 3 + 2];
    const u = ((originX - minX) + east / tileMetres) / (maxX - minX + 1);
    const v = 1 - ((originY - minY) - north / tileMetres) / (maxY - minY + 1);
    assert(Number.isFinite(u) && Number.isFinite(v) && u >= -1e-4 && u <= 1 + 1e-4
      && v >= -1e-4 && v <= 1 + 1e-4,
    `Roof vertex ${index} falls outside its real orthophoto atlas`);
    uv[index * 2] = Math.max(0, Math.min(1, u));
    uv[index * 2 + 1] = Math.max(0, Math.min(1, v));
  }
  return uv;
}

/** Return only the closest in-range chapter; never fetch every city at once. */
export function chooseIsometricRegion(regions, camera, focusId = null) {
  const {center, zoom} = camera;
  if (!center || !Number.isFinite(zoom)) return null;
  const candidates = regions.filter(region => (!focusId || region.id === focusId)
    && zoom >= region.minZoom && zoom < region.maxZoom)
    .map(region => ({region, distance: distanceMetres(center, region.origin)}))
    .filter(item => item.distance <= item.region.radiusM + RENDER_RADIUS_PADDING_M)
    .sort((a, b) => a.distance - b.distance);
  return candidates[0]?.region ?? null;
}

function makeMesh(positionArray, colour, roughness) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({
    color: colour, roughness, metalness: 0, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false; // Camera matrix is supplied by MapLibre.
  return mesh;
}

function lowMemoryDevice() {
  const memory = typeof navigator === 'undefined' ? undefined : navigator.deviceMemory;
  const connection = typeof navigator === 'undefined' ? undefined : navigator.connection;
  if (connection?.saveData || /^(slow-2g|2g)$/.test(connection?.effectiveType ?? '')) return true;
  // Chromium exposes deviceMemory; Safari often does not. When it is unknown,
  // a coarse primary pointer is a conservative proxy for a phone/tablet GPU.
  return Number.isFinite(memory) ? memory <= 4
    : typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

/** Speculation is optional; an explicitly selected chapter always loads. */
function canPrefetchChapter() {
  const connection = typeof navigator === 'undefined' ? undefined : navigator.connection;
  return !lowMemoryDevice() && !/^(slow-2g|2g|3g)$/.test(connection?.effectiveType ?? '');
}

function isTransientAssetError(error) {
  return error?.retryable === true || error instanceof TypeError;
}

function atlasFitsBudget(metadata, maxTextureSize, budgetBytes) {
  return metadata && Number.isInteger(metadata.width) && Number.isInteger(metadata.height)
    && metadata.width > 0 && metadata.height > 0
    && metadata.width <= maxTextureSize && metadata.height <= maxTextureSize
    && Number.isInteger(metadata.bytes) && metadata.bytes > 0
    && metadata.bytes <= MAX_COMPRESSED_ATLAS_BYTES
    // WebGL mipmaps add roughly one third to decoded RGBA storage. Account for
    // them rather than accepting a 51 MB Berlin atlas under a nominal 64 MB cap.
    && metadata.width * metadata.height * 4 * MIPMAP_STORAGE_FACTOR <= budgetBytes;
}

/** Select original detail where safe, or the same-source 2× offline downsample. */
export function chooseRoofAtlasVersion(full, reduced, {maxTextureSize, lowMemory = false}) {
  const budget = lowMemory ? 32_000_000 : 96_000_000;
  if (atlasFitsBudget(full, maxTextureSize, budget)) return full;
  if (atlasFitsBudget(reduced, maxTextureSize, budget)) return reduced;
  return null; // Truthful plain LoD2 geometry is the final fallback.
}

function reducedAtlasUrl(url, extension) {
  assert(url.endsWith(extension), `Roof atlas URL must end in ${extension}`);
  return `${url.slice(0, -extension.length)}-half${extension}`;
}

function waitForRetry(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const timer = setTimeout(done, ms);
    function done() { signal.removeEventListener('abort', cancel); resolve(); }
    function cancel() { clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener('abort', cancel, {once: true});
  });
}

/** Retry only temporary transport/server failures, not missing or invalid assets. */
export async function fetchChapterAsset(url, {signal, maxBytes, kind = 'blob'} = {}) {
  for (let attempt = 0; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {signal});
      if (!response.ok) {
        const error = new Error(`Chapter asset HTTP ${response.status}`);
        error.retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        throw error;
      }
      const advertised = Number(response.headers.get('content-length'));
      if (advertised > maxBytes) throw new Error('Chapter asset exceeds transfer budget');
      const result = kind === 'arrayBuffer' ? await response.arrayBuffer()
        : kind === 'json' ? await response.text() : await response.blob();
      const actualBytes = kind === 'arrayBuffer' ? result.byteLength
        : kind === 'json' ? new TextEncoder().encode(result).byteLength : result.size;
      if (actualBytes > maxBytes) {
        throw new Error('Chapter asset exceeds transfer budget');
      }
      return kind === 'json' ? JSON.parse(result) : result;
    } catch (error) {
      if (signal.aborted || attempt === FETCH_RETRIES || error.retryable === false) throw error;
      // Fetch's TypeError is commonly a dropped connection. It is safe to
      // retry same-origin immutable release assets; a 404 is not retried.
      if (error.retryable !== true && !(error instanceof TypeError)) throw error;
      await waitForRetry(250 * 2 ** attempt, signal);
    }
  }
}

/** The smaller file must be a traceable resampling of this exact source atlas. */
export function validateReducedAtlas(full, reduced) {
  assert(reduced && reduced.source_asset === full.asset
    && reduced.source_asset_sha256 === full.sha256
    && reduced.asset === full.asset.replace(/\.webp$/, '-half.webp')
    && reduced.source_metadata === full.asset.replace(/\.webp$/, '.json')
    && sameOrigin(reduced.origin_lonlat, full.origin_lonlat)
    && reduced.source_tile_zoom === full.source_tile_zoom
    && JSON.stringify(reduced.source_tile_bounds_xyxy) === JSON.stringify(full.source_tile_bounds_xyxy)
    && reduced.width * 2 === full.width && reduced.height * 2 === full.height,
  'Reduced roof atlas does not match its official-data source');
  return reduced;
}

/**
 * One MapLibre custom layer for small, *actual-data* LoD2 chapters. Add after
 * the style loads and before achievement symbols; the normal satellite map
 * remains the ground and fallback. This layer never owns the camera or DOM.
 *
 * Region descriptor:
 * {id, origin:[lon,lat], radiusM, meshUrl,
 *  roofAtlas?:{imageUrl,metadataUrl}, groundImage?:{imageUrl,metadataUrl},
 *  credit?, minZoom?, maxZoom?}
 * Optional `onChange({regionId,credit,loaded,textured})` fires on activation,
 * resource upgrade and teardown so the host can refresh its attribution.
 *
 * `setFocus(id|null)` optionally links the current portfolio achievement to
 * its own chapter. Null allows whichever region is nearest the camera. Do not
 * use this method to fly the camera; the host can ease to ~60° pitch and
 * 40–45° bearing at ~z17.3, retaining normal controls and labels.
 */
export function createIsometricRegionLayer({regions, onChange = null,
  recoveryDelayMs = RECOVERY_DELAY_MS} = {}) {
  assert(Array.isArray(regions) && regions.length > 0, 'Isometric layer needs one or more actual-data regions');
  assert(onChange == null || typeof onChange === 'function', 'Isometric onChange must be a callback');
  assert(Number.isFinite(recoveryDelayMs) && recoveryDelayMs >= 0,
    'Isometric recovery delay must be nonnegative');
  const chapters = regions.map(normalizeRegion);
  assert(new Set(chapters.map(region => region.id)).size === chapters.length, 'Duplicate isometric region id');
  let focusId = null;
  let enabled = true;
  let recoveryTimer = null;
  const recoveryAttempts = new Map();
  const warm = new Map();
  const cancelRecovery = () => {
    if (recoveryTimer != null) clearTimeout(recoveryTimer);
    recoveryTimer = null;
  };
  const discardWarm = (id, {onlyPending = false} = {}) => {
    const entry = warm.get(id);
    if (!entry || onlyPending && entry.settled) return;
    entry.abort.abort();
    warm.delete(id);
  };
  const notifyChange = layer => {
    if (!onChange) return;
    try {
      onChange({
        regionId: layer.getActiveRegionId(),
        credit: layer.getActiveAttribution(),
        loaded: !!layer.active?.meshes,
        textured: !!layer.active?.texture,
      });
    } catch (error) {
      console.warn('Isometric region update callback failed.', error);
    }
  };

  return {
    id: 'earth-engine-isometric-regions',
    type: 'custom',
    renderingMode: '3d',
    setEnabled(next) {
      enabled = !!next;
      if (!this.map) return;
      if (!enabled) {
        cancelRecovery();
        recoveryAttempts.clear();
        this.releaseActive();
        for (const id of [...warm.keys()]) discardWarm(id);
        this.map.triggerRepaint();
      } else if (!this.map.isMoving()) this.evaluate();
    },
    getEnabled() { return enabled; },
    setFocus(id = null) {
      assert(id == null || chapters.some(region => region.id === id), `Unknown isometric region: ${id}`);
      const changed = focusId !== id;
      focusId = id;
      if (changed) {
        cancelRecovery();
        recoveryAttempts.clear();
        if (this.active && this.active.region.id !== id) this.releaseActive();
        // A rapid chronology click should not leave the previous city
        // downloading during the new flight. Completed entries remain warm.
        for (const key of [...warm.keys()]) {
          if (key !== id) discardWarm(key, {onlyPending: true});
        }
      }
      if (!this.map || !enabled) return;
      if (id) this.prepareRegion(chapters.find(region => region.id === id));
      // A null focus normally precedes a flight to a non-chapter event. Do
      // not immediately reactivate the city we are in before that flight.
      if (id && !this.map.isMoving()) this.evaluate();
    },
    /** Warm only compressed bytes for one likely next chapter, not GPU textures. */
    prefetch(id) {
      const region = chapters.find(candidate => candidate.id === id);
      if (!region || !enabled || !this.map || this.destroyed || !canPrefetchChapter()) return false;
      this.prepareRegion(region);
      return true;
    },
    getActiveRegionId() { return this.active?.region.id ?? null; },
    getActiveAttribution() { return this.active?.region.credit ?? null; },
    onAdd(map, gl) {
      this.map = map;
      this.destroyed = false;
      this.active = null;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xe9edf0, 0.92));
      const daylight = new THREE.DirectionalLight(0xfff7e9, 1.18);
      daylight.position.set(-170, 550, 210);
      this.scene.add(daylight);
      this.renderer = new THREE.WebGLRenderer({canvas: map.getCanvas(), context: gl, antialias: true});
      this.renderer.autoClear = false;
      this.maxTextureSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), MAX_TEXTURE_DIMENSION);
      this.onMoveEnd = () => this.evaluate();
      map.on('moveend', this.onMoveEnd);
      this.evaluate();
    },
    prepareRegion(region) {
      if (!region || !enabled || this.destroyed || !this.map) return null;
      const existing = warm.get(region.id);
      if (existing && !existing.failed) {
        warm.delete(region.id);
        warm.set(region.id, existing);
        return existing;
      }
      if (existing) discardWarm(region.id);
      while (warm.size >= MAX_WARM_CHAPTERS) discardWarm(warm.keys().next().value);
      const abort = new AbortController();
      const entry = {region, abort, settled: false, failed: false};
      const roofAtlas = region.roofAtlas;
      entry.meshPromise = fetchChapterAsset(region.meshUrl,
        {signal: abort.signal, maxBytes: MAX_MESH_BYTES, kind: 'arrayBuffer'});
      entry.atlasPromise = roofAtlas ? (async () => {
        const metadata = await fetchChapterAsset(roofAtlas.metadataUrl,
          {signal: abort.signal, maxBytes: 16_000, kind: 'json'});
        const memoryConstrained = lowMemoryDevice();
        let chosen = chooseRoofAtlasVersion(metadata, null,
          {maxTextureSize: this.maxTextureSize, lowMemory: memoryConstrained});
        let imageUrl = roofAtlas.imageUrl;
        if (!chosen) {
          const reduced = validateReducedAtlas(metadata,
            await fetchChapterAsset(reducedAtlasUrl(roofAtlas.metadataUrl, '.json'),
              {signal: abort.signal, maxBytes: 16_000, kind: 'json'}));
          chosen = chooseRoofAtlasVersion(metadata, reduced,
            {maxTextureSize: this.maxTextureSize, lowMemory: memoryConstrained});
          if (!chosen) return null;
          imageUrl = reducedAtlasUrl(imageUrl, '.webp');
        }
        const imageBlob = await fetchChapterAsset(imageUrl,
          {signal: abort.signal, maxBytes: MAX_COMPRESSED_ATLAS_BYTES});
        if (imageBlob.size !== chosen.bytes) throw new Error('Roof atlas image byte count differs from metadata');
        return {metadata, chosen, imageBlob, memoryConstrained};
      })() : Promise.resolve(null);
      entry.groundPromise = region.groundImage ? (async () => {
        // Ground imagery is useful even before the rooftop atlas is decoded.
        // Begin both same-origin requests together instead of serializing a
        // metadata round trip ahead of the larger image transfer.
        const [rawMetadata, imageBlob] = await Promise.all([
          fetchChapterAsset(region.groundImage.metadataUrl,
            {signal: abort.signal, maxBytes: 16_000, kind: 'json'}),
          fetchChapterAsset(region.groundImage.imageUrl,
            {signal: abort.signal, maxBytes: MAX_GROUND_IMAGE_BYTES}),
        ]);
        const metadata = validateGroundImageMetadata(rawMetadata, region);
        if (imageBlob.size !== metadata.bytes) {
          throw new Error('Ground image byte count differs from metadata');
        }
        return {metadata, imageBlob};
      })() : Promise.resolve(null);
      // Attach handlers immediately: a prefetched asset can fail before the
      // camera arrives and before loadRegion awaits either promise.
      for (const promise of [entry.meshPromise, entry.atlasPromise]) {
        promise.catch(() => { entry.failed = true; });
      }
      // A photo failure must not prevent the sourced building geometry from
      // activating; the existing global satellite layer remains underneath.
      entry.groundPromise.catch(() => { entry.failed = true; });
      Promise.allSettled([entry.meshPromise, entry.atlasPromise, entry.groundPromise])
        .then(() => { entry.settled = true; });
      warm.set(region.id, entry);
      return entry;
    },
    evaluate() {
      if (this.destroyed || !this.map || this.map.isMoving()) return;
      if (!enabled) {
        this.releaseActive();
        return;
      }
      const center = this.map.getCenter();
      const region = chooseIsometricRegion(chapters,
        {center: [center.lng, center.lat], zoom: this.map.getZoom()}, focusId);
      if (region?.id === this.active?.region.id) return;
      const previousId = this.active?.region.id;
      this.releaseActive();
      if (previousId && previousId !== region?.id) discardWarm(previousId, {onlyPending: true});
      if (!region) {
        this.map.triggerRepaint();
        return;
      }
      const merc = maplibregl.MercatorCoordinate.fromLngLat(region.origin, 0);
      const scale = merc.meterInMercatorCoordinateUnits();
      const model = new THREE.Matrix4()
        .makeTranslation(merc.x, merc.y, merc.z)
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
      const active = {region, model, meshes: null, texture: null, buffer: null, groundObjectUrl: null};
      this.active = active;
      notifyChange(this);
      const prepared = this.prepareRegion(region);
      void this.loadRegion(active, prepared);
      if (region.groundImage) void this.loadGroundImage(active, prepared);
    },
    scheduleRecovery(region, error) {
      if (!isTransientAssetError(error) || this.destroyed || !enabled || !this.map) return;
      const attempts = recoveryAttempts.get(region.id) ?? 0;
      if (attempts >= MAX_RECOVERY_ATTEMPTS) return;
      recoveryAttempts.set(region.id, attempts + 1);
      // Keep a single bounded recovery pending. Changing destination, turning
      // detail off, or removing the custom layer cancels it immediately.
      cancelRecovery();
      const scheduledFocus = focusId;
      recoveryTimer = setTimeout(() => {
        recoveryTimer = null;
        if (this.destroyed || !enabled || focusId !== scheduledFocus) return;
        this.evaluate();
      }, recoveryDelayMs);
    },
    async loadRegion(active, prepared) {
      try {
        const buffer = await prepared.meshPromise;
        if (this.destroyed || this.active !== active) return;
        const {roofCount, wallCount, positions} = parseBld2(buffer, active.region.origin);
        active.buffer = buffer; // Typed geometry views keep the one payload alive.
        const roof = makeMesh(positions.subarray(0, roofCount * 3), 0x969a98, 0.95);
        const wall = makeMesh(positions.subarray(roofCount * 3, (roofCount + wallCount) * 3), 0xc5c3ba, 0.96);
        active.meshes = [roof, wall];
        this.scene.add(roof, wall);
        recoveryAttempts.delete(active.region.id);
        this.map.triggerRepaint();
        notifyChange(this);
        if (active.region.roofAtlas) void this.loadRoofAtlas(active, prepared);
      } catch (error) {
        if (prepared.abort.signal.aborted || this.destroyed || this.active !== active) return;
        console.warn(`${active.region.id} official isometric buildings unavailable; satellite map remains visible.`, error);
        const region = active.region;
        this.releaseActive();
        discardWarm(region.id);
        this.scheduleRecovery(region, error);
      }
    },
    async loadRoofAtlas(active, prepared) {
      let texture = null;
      try {
        const atlas = await prepared.atlasPromise;
        if (!atlas) return;
        if (this.destroyed || this.active !== active) return;
        const roof = active.meshes?.[0];
        if (!roof) return;
        const uv = roofUvForAtlas(roof.geometry.getAttribute('position').array,
          active.region.origin, atlas.metadata);
        const objectUrl = URL.createObjectURL(atlas.imageBlob);
        try {
          texture = await new THREE.TextureLoader().loadAsync(objectUrl);
        } finally {
          URL.revokeObjectURL(objectUrl);
        }
        if (this.destroyed || this.active !== active) return;
        if (texture.image.width !== atlas.chosen.width || texture.image.height !== atlas.chosen.height) {
          throw new Error('Roof image dimensions differ from its georeferenced atlas metadata');
        }
        roof.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(atlas.memoryConstrained ? 2 : 8,
          this.renderer.capabilities.getMaxAnisotropy());
        const material = new THREE.MeshBasicMaterial({
          map: texture, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });
        roof.material.dispose();
        roof.material = material;
        active.texture = texture;
        this.map.triggerRepaint();
        notifyChange(this);
      } catch (error) {
        if (prepared.abort.signal.aborted || this.destroyed || this.active !== active) return;
        console.warn(`${active.region.id} georeferenced roof texture unavailable; official LoD2 geometry remains.`, error);
      } finally {
        if (texture && texture !== active.texture) texture.dispose();
      }
    },
    async loadGroundImage(active, prepared) {
      try {
        const ground = await prepared.groundPromise;
        if (!ground || this.destroyed || this.active !== active) return;
        const objectUrl = URL.createObjectURL(ground.imageBlob);
        active.groundObjectUrl = objectUrl;
        const sourceId = 'earth-engine-local-orthophoto';
        const layerId = 'earth-engine-local-orthophoto';
        // An image source, unlike a raster tile source, makes exactly one
        // small local transfer. Add it below the existing custom 3D chapter.
        this.map.addSource(sourceId, {
          type: 'image', url: objectUrl, coordinates: ground.metadata.coordinates,
        });
        this.map.addLayer({
          id: layerId, type: 'raster', source: sourceId,
          minzoom: active.region.minZoom, maxzoom: active.region.maxZoom,
          paint: {'raster-fade-duration': 200},
        }, this.id);
        this.map.triggerRepaint();
      } catch (error) {
        if (prepared.abort.signal.aborted || this.destroyed || this.active !== active) return;
        this.removeGroundImage(active);
        console.warn(`${active.region.id} local orthophoto unavailable; global satellite imagery remains.`, error);
      }
    },
    removeGroundImage(active) {
      if (!active.groundObjectUrl) return;
      const id = 'earth-engine-local-orthophoto';
      if (this.map?.getLayer(id)) this.map.removeLayer(id);
      if (this.map?.getSource(id)) this.map.removeSource(id);
      URL.revokeObjectURL(active.groundObjectUrl);
      active.groundObjectUrl = null;
    },
    render(gl, args) {
      const active = this.active;
      if (!enabled || !active?.meshes || !this.map || !args.defaultProjectionData?.mainMatrix
        || args.defaultProjectionData.projectionTransition > 0) return;
      if (focusId && focusId !== active.region.id) return;
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      if (zoom < active.region.minZoom || zoom >= active.region.maxZoom
        || distanceMetres([center.lng, center.lat], active.region.origin)
          > active.region.radiusM + RENDER_RADIUS_PADDING_M) return;
      this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(active.model);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    },
    releaseActive() {
      const active = this.active;
      if (!active) return;
      this.active = null;
      this.removeGroundImage(active);
      for (const mesh of active.meshes ?? []) {
        this.scene?.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      active.texture?.dispose();
      active.buffer = null;
      notifyChange(this);
    },
    onRemove() {
      this.destroyed = true;
      cancelRecovery();
      recoveryAttempts.clear();
      this.map?.off('moveend', this.onMoveEnd);
      this.releaseActive();
      for (const id of [...warm.keys()]) discardWarm(id);
      this.renderer?.dispose();
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.map = null;
    },
  };
}
