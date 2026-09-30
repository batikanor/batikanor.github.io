import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';

// Official Bavarian LoD2 CityGML clipped and triangulated offline by
// scripts/build-bavaria-lod2.py. A local official DOP20 aerial-photo atlas is
// projected onto those roof planes; façades remain untextured standardized
// LoD2 surfaces, not photogrammetry or invented windows.
const BASE_URL = import.meta.env?.BASE_URL ?? '/';
const ASSET_URL = `${BASE_URL}data/garching-lod2-v1.bin`;
const ROOF_TEXTURE_URL = `${BASE_URL}data/garching-roof-orthophoto-v1.webp`;
const ROOF_TEXTURE_META_URL = `${BASE_URL}data/garching-roof-orthophoto-v1.json`;
const MAGIC = 'BLD2';
const GARCHING = [11.666954, 48.262269];
const EARTH_CIRCUMFERENCE_M = 40075016.68557849;
// The official LoD2 shapes are useful at neighbourhood scale, but their
// untextured walls become giant opaque blocks at venue/driver scale and can
// obscure an achievement. DOP20 is the more truthful close-range visual until
// a textured/collision-ready campus asset exists. The cut is intentional.
const MIN_CONTEXT_ZOOM = 15.5;
const MAX_CONTEXT_ZOOM = 18.5;
const MAX_MESH_BYTES = 2_000_000;
const MAX_ATLAS_BYTES = 3_000_000;

export function isBavariaContextCamera({center, zoom}) {
  const lng = Array.isArray(center) ? center[0] : center?.lng;
  const lat = Array.isArray(center) ? center[1] : center?.lat;
  return Number.isFinite(zoom) && zoom >= MIN_CONTEXT_ZOOM && zoom < MAX_CONTEXT_ZOOM
    && Number.isFinite(lng) && Number.isFinite(lat)
    && Math.abs(lng - GARCHING[0]) <= .023 && Math.abs(lat - GARCHING[1]) <= .017;
}

function lowMemoryDevice() {
  const memory = globalThis.navigator?.deviceMemory;
  return !!globalThis.navigator?.connection?.saveData
    || (Number.isFinite(memory) ? memory <= 4
      : globalThis.matchMedia?.('(pointer: coarse)')?.matches === true);
}

/** No 75 MiB roof texture on phones; photographic ground remains unobstructed. */
export function bavariaRoofAtlasFitsBudget(metadata, {maxTextureSize, lowMemory = false}) {
  return !lowMemory && Number.isFinite(maxTextureSize) && maxTextureSize >= 3840
    && metadata?.width === 3840 && metadata?.height === 3840
    && Number.isInteger(metadata.bytes) && metadata.bytes > 0 && metadata.bytes <= MAX_ATLAS_BYTES
    && metadata.width * metadata.height * 4 * 4 / 3 <= 96_000_000;
}

function readMesh(buffer) {
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 40 || buffer.byteLength > MAX_MESH_BYTES) {
    throw new Error('Bavarian LoD2 asset exceeds its bounded mesh budget');
  }
  const header = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== MAGIC || header.getUint32(4, true) !== 1) throw new Error('Unknown Bavarian LoD2 asset format');
  const roofCount = header.getUint32(8, true);
  const wallCount = header.getUint32(12, true);
  if (!roofCount || !wallCount || roofCount % 3 || wallCount % 3) throw new Error('Invalid Bavarian LoD2 triangles');
  const origin = [header.getFloat64(24, true), header.getFloat64(32, true)];
  if (Math.abs(origin[0] - GARCHING[0]) > 1e-6 || Math.abs(origin[1] - GARCHING[1]) > 1e-6) {
    throw new Error('Bavarian LoD2 venue origin does not match the current layer');
  }
  const floats = new Float32Array(buffer, 40);
  if (floats.length !== (roofCount + wallCount) * 3) throw new Error('Truncated Bavarian LoD2 asset');
  for (let index = 0; index < floats.length; index += 3) {
    if (!Number.isFinite(floats[index]) || !Number.isFinite(floats[index + 1]) || !Number.isFinite(floats[index + 2])
      || Math.abs(floats[index]) > 1000 || Math.abs(floats[index + 2]) > 1000
      || floats[index + 1] < 400 || floats[index + 1] > 600) throw new Error('Invalid surveyed Bavarian LoD2 vertex');
  }
  const make = (offset, count, color, roughness) => {
    const geometry = new THREE.BufferGeometry();
    // The view is kept alive by the fetched ArrayBuffer held in the layer.
    geometry.setAttribute('position', new THREE.BufferAttribute(floats.subarray(offset * 3, (offset + count) * 3), 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    // Do not obscure the actual aerial roof with an opaque gray placeholder.
    // The source geometry becomes visible only after its photograph is accepted.
    mesh.visible = false;
    return mesh;
  };
  return {
    roof: make(0, roofCount, 0x898f8d, 0.91),
    wall: make(roofCount, wallCount, 0xc6c3b7, 0.94),
  };
}

function roofUvAttribute(positions, metadata) {
  const [originLon, originLat] = metadata.origin_lonlat;
  const [minX, minY, maxX, maxY] = metadata.source_tile_bounds_xyxy;
  const zoom = metadata.source_tile_zoom;
  const tileSize = 256;
  const tiles = 2 ** zoom;
  const tileMetres = EARTH_CIRCUMFERENCE_M * Math.cos(originLat * Math.PI / 180) / tiles;
  const originX = (originLon + 180) / 360 * tiles;
  const originY = (1 - Math.asinh(Math.tan(originLat * Math.PI / 180)) / Math.PI) / 2 * tiles;
  const width = (maxX - minX + 1) * tileSize;
  const height = (maxY - minY + 1) * tileSize;
  if (!Number.isInteger(zoom) || zoom !== 18 || width !== metadata.width || height !== metadata.height
    || width > 4096 || height > 4096
    || Math.abs(originLon - GARCHING[0]) > 1e-8 || Math.abs(originLat - GARCHING[1]) > 1e-8) {
    throw new Error('Bavarian roof atlas does not match the official LoD2 geometry');
  }
  const uv = new Float32Array(positions.count * 2);
  for (let index = 0; index < positions.count; index++) {
    const east = positions.getX(index);
    const north = positions.getZ(index);
    const u = ((originX - minX) + east / tileMetres) / (maxX - minX + 1);
    const v = 1 - ((originY - minY) - north / tileMetres) / (maxY - minY + 1);
    if (u < 0 || u > 1 || v < 0 || v > 1) {
      throw new Error(`Official LoD2 roof ${index} is outside its DOP20 atlas`);
    }
    uv[2 * index] = u;
    uv[2 * index + 1] = v;
  }
  return new THREE.BufferAttribute(uv, 2);
}

/**
 * A small, independently loadable MapLibre custom layer for real Bavarian
 * LoD2 roof/wall surfaces around the Garching drive venue. Add after the
 * style loads; it deliberately fetches nothing outside this local chapter.
 */
export function createBavariaBuildingLayer({onChange = null, fetcher = globalThis.fetch,
  rendererFactory = null, textureLoaderFactory = () => new THREE.TextureLoader(),
  lowMemory = lowMemoryDevice} = {}) {
  let enabled = true;
  let generation = 0;
  const notify = layer => {
    if (typeof onChange !== 'function') return;
    try {onChange(layer.getStats());}
    catch (error) {console.warn('Bavaria context update callback failed.', error);}
  };
  async function fetchAsset(url, signal, maxBytes, kind) {
    const response = await fetcher(url, {signal, cache:'force-cache'});
    if (!response.ok) throw new Error(`Bavaria asset HTTP ${response.status}`);
    if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Bavaria asset exceeds transfer budget');
    const value = kind === 'buffer' ? await response.arrayBuffer()
      : kind === 'json' ? await response.text() : await response.blob();
    const bytes = kind === 'buffer' ? value.byteLength
      : kind === 'json' ? new TextEncoder().encode(value).byteLength : value.size;
    if (bytes > maxBytes) throw new Error('Bavaria asset exceeds transfer budget');
    return kind === 'json' ? JSON.parse(value) : value;
  }
  return {
    id: 'earth-engine-garching-lod2', type: 'custom', renderingMode: '3d',
    isEligible() {
      return !!this.map && isBavariaContextCamera({center:this.map.getCenter(), zoom:this.map.getZoom()});
    },
    getLoaded() {return enabled && !!this.loaded && !!this.roofTexture && this.isEligible();},
    getStats() {
      return {enabled, loaded:this.getLoaded(), geometryReady:!!this.loaded, textured:!!this.roofTexture,
        loading:!!this.loading, textureLoading:!!this.textureLoading,
        meshBytes:this.buffer?.byteLength ?? 0,
        textureBytes:this.roofTexture ? 3840 * 3840 * 4 * 4 / 3 : 0};
    },
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) this.releaseActive();
      else this.evaluate();
      this.map?.triggerRepaint();
    },
    releaseActive() {
      generation++;
      this.abort?.abort();
      this.abort = null;
      const hadResources = this.loaded || this.loading || this.textureLoading || this.roofTexture;
      for (const mesh of this.meshes ?? []) {
        this.scene?.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose();
      }
      this.roofTexture?.dispose();
      this.roofTexture = null;
      this.meshes = null;
      this.buffer = null;
      this.loaded = this.loading = this.textureLoading = this.failed = false;
      if (hadResources) {notify(this); this.map?.triggerRepaint();}
    },
    releaseOutsideRegion() {
      if (!enabled || !this.isEligible()) {
        if (this.loaded || this.loading || this.textureLoading || this.abort) this.releaseActive();
        return true;
      }
      return false;
    },
    evaluate() {
      if (this.destroyed || !this.map || this.releaseOutsideRegion() || this.map.isMoving()) return;
      if (!this.loaded && !this.loading && !this.failed) void this.load();
    },
    onAdd(map, gl) {
      this.map = map;
      this.destroyed = false;
      this.loaded = this.loading = this.textureLoading = this.failed = false;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xe6e8e2, .82));
      const sun = new THREE.DirectionalLight(0xfff3e1, 1.35);
      sun.position.set(-180, 500, -90); this.scene.add(sun);
      this.renderer = rendererFactory ? rendererFactory(map, gl)
        : new THREE.WebGLRenderer({canvas:map.getCanvas(), context:gl, antialias:true});
      this.renderer.autoClear = false;
      this.maximumTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.onMoveEnd = () => this.evaluate();
      // Release as soon as the camera leaves; load only at its settled framing.
      this.onMove = () => this.releaseOutsideRegion();
      map.on('move', this.onMove); map.on('moveend', this.onMoveEnd);
      this.evaluate();
    },
    async load() {
      if (!enabled || this.loading || this.loaded || this.failed || this.destroyed
        || !this.isEligible() || this.map.isMoving()) return;
      const token = generation;
      const abort = this.abort = new AbortController();
      this.loading = true; notify(this);
      try {
        const buffer = await fetchAsset(ASSET_URL, abort.signal, MAX_MESH_BYTES, 'buffer');
        if (abort.signal.aborted || this.destroyed || token !== generation || !this.isEligible()) return;
        const {roof, wall} = readMesh(buffer);
        this.buffer = buffer; this.meshes = [roof, wall]; this.scene.add(roof, wall);
        this.loaded = true; notify(this); this.map.triggerRepaint();
        // Geometry may be prepared independently, but an untextured mass must
        // never mask the higher-fidelity ground image or signal quality readiness.
        void this.loadRoofTexture(token, abort);
      } catch (error) {
        if (!abort.signal.aborted && !this.destroyed && token === generation) {
          this.failed = true;
          console.warn('Official Bavaria LoD2 buildings unavailable; orthophoto remains visible.', error);
        }
      } finally {
        if (token === generation) {this.loading = false; notify(this);}
      }
    },
    async loadRoofTexture(token = generation, abort = this.abort) {
      const constrained = typeof lowMemory === 'function' ? lowMemory() : !!lowMemory;
      if (constrained || this.textureLoading || this.destroyed || !enabled
        || !this.loaded || !abort || abort.signal.aborted || this.maximumTextureSize < 3840) return;
      this.textureLoading = true; notify(this);
      const meshes = this.meshes;
      let texture;
      let objectUrl;
      const current = () => !abort.signal.aborted && !this.destroyed && enabled
        && token === generation && this.meshes === meshes && this.isEligible();
      try {
        const metadata = await fetchAsset(ROOF_TEXTURE_META_URL, abort.signal, 16_000, 'json');
        if (!current() || !bavariaRoofAtlasFitsBudget(metadata,
          {maxTextureSize:this.maximumTextureSize, lowMemory:constrained})) return;
        // Validate the source alignment before allocating/decoding the atlas.
        const roof = meshes[0];
        const uv = roofUvAttribute(roof.geometry.getAttribute('position'), metadata);
        const blob = await fetchAsset(ROOF_TEXTURE_URL, abort.signal, MAX_ATLAS_BYTES, 'blob');
        if (!current()) return;
        if (blob.size !== metadata.bytes) throw new Error('Bavarian roof image bytes differ from metadata');
        objectUrl = URL.createObjectURL(blob);
        texture = await textureLoaderFactory().loadAsync(objectUrl);
        if (!current()) return;
        if (texture.image.width !== metadata.width || texture.image.height !== metadata.height) {
          throw new Error('Bavarian roof image dimensions differ from metadata');
        }
        roof.geometry.setAttribute('uv', uv);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        const material = new THREE.MeshBasicMaterial({map:texture, side:THREE.DoubleSide,
          polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1});
        roof.material.dispose(); roof.material = material;
        this.roofTexture = texture;
        // Install the real source-aligned roof and reveal both source surfaces
        // atomically; pending, unavailable or failed atlases remain invisible.
        for (const mesh of meshes) mesh.visible = true;
        notify(this); this.map.triggerRepaint();
      } catch (error) {
        if (current()) console.warn('Bavarian roof orthophoto unavailable; photographic ground remains unobstructed.', error);
      } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        if (texture && texture !== this.roofTexture) texture.dispose();
        if (token === generation) {this.textureLoading = false; notify(this);}
      }
    },
    render(gl, args) {
      if (!enabled || this.destroyed || !this.map
        || this.releaseOutsideRegion() || !this.getLoaded()
        || !args.defaultProjectionData?.mainMatrix
        || args.defaultProjectionData.projectionTransition > 0) return;
      // Surveyed vertices retain absolute source elevation. Do not flatten the
      // DEM behind this chapter without also normalizing its model heights.
      const merc = maplibregl.MercatorCoordinate.fromLngLat(GARCHING, 0);
      const scale = merc.meterInMercatorCoordinateUnits();
      const local = new THREE.Matrix4().makeTranslation(merc.x, merc.y, merc.z)
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
      this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(local);
      this.renderer.resetState(); this.renderer.render(this.scene, this.camera);
    },
    onRemove() {
      this.destroyed = true;
      this.map?.off('move', this.onMove); this.map?.off('moveend', this.onMoveEnd);
      this.releaseActive(); this.renderer?.dispose();
      this.renderer = this.scene = this.camera = this.map = null;
    },
  };
}
