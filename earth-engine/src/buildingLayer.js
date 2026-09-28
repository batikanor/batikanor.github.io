import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';

// Official Bavarian LoD2 CityGML clipped and triangulated offline by
// scripts/build-bavaria-lod2.py. A local official DOP20 aerial-photo atlas is
// projected onto those roof planes; façades remain untextured standardized
// LoD2 surfaces, not photogrammetry or invented windows.
const ASSET_URL = `${import.meta.env.BASE_URL}data/garching-lod2-v1.bin`;
const ROOF_TEXTURE_URL = `${import.meta.env.BASE_URL}data/garching-roof-orthophoto-v1.webp`;
const ROOF_TEXTURE_META_URL = `${import.meta.env.BASE_URL}data/garching-roof-orthophoto-v1.json`;
const MAGIC = 'BLD2';
const GARCHING = [11.666954, 48.262269];
const EARTH_CIRCUMFERENCE_M = 40075016.68557849;
// The official LoD2 shapes are useful at neighbourhood scale, but their
// untextured walls become giant opaque blocks at venue/driver scale and can
// obscure an achievement. DOP20 is the more truthful close-range visual until
// a textured/collision-ready campus asset exists. The cut is intentional.
const MIN_CONTEXT_ZOOM = 15.5;
const MAX_CONTEXT_ZOOM = 18.5;

function readMesh(buffer) {
  const header = new DataView(buffer);
  const magic = String.fromCharCode(...new Uint8Array(buffer, 0, 4));
  if (magic !== MAGIC || header.getUint32(4, true) !== 1) throw new Error('Unknown Bavarian LoD2 asset format');
  const roofCount = header.getUint32(8, true);
  const wallCount = header.getUint32(12, true);
  const origin = [header.getFloat64(24, true), header.getFloat64(32, true)];
  if (Math.abs(origin[0] - GARCHING[0]) > 1e-6 || Math.abs(origin[1] - GARCHING[1]) > 1e-6) {
    throw new Error('Bavarian LoD2 venue origin does not match the current layer');
  }
  const floats = new Float32Array(buffer, 40);
  if (floats.length !== (roofCount + wallCount) * 3) throw new Error('Truncated Bavarian LoD2 asset');
  const make = (offset, count, color, roughness) => {
    const geometry = new THREE.BufferGeometry();
    // The view is kept alive by the fetched ArrayBuffer held in the layer.
    geometry.setAttribute('position', new THREE.BufferAttribute(floats.subarray(offset * 3, (offset + count) * 3), 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshStandardMaterial({
      color, roughness, metalness: 0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    });
    return new THREE.Mesh(geometry, material);
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
export function createBavariaBuildingLayer() {
  return {
    id: 'earth-engine-garching-lod2',
    type: 'custom',
    renderingMode: '3d',
    onAdd(map, gl) {
      this.map = map;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xe6e8e2, 0.82));
      const sun = new THREE.DirectionalLight(0xfff3e1, 1.35);
      sun.position.set(-180, 500, -90);
      this.scene.add(sun);
      this.renderer = new THREE.WebGLRenderer({canvas: map.getCanvas(), context: gl, antialias: true});
      this.renderer.autoClear = false;
      this.maximumTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      this.loaded = false;
      this.loading = false;
      this.textureLoading = false;
      this.failed = false;
      this.destroyed = false;
      this.onMoveEnd = () => {
        const zoom = map.getZoom();
        const center = map.getCenter();
        if (zoom >= MIN_CONTEXT_ZOOM && zoom < MAX_CONTEXT_ZOOM
          && Math.abs(center.lng - GARCHING[0]) <= 0.023
          && Math.abs(center.lat - GARCHING[1]) <= 0.017) this.load();
      };
      map.on('moveend', this.onMoveEnd);
    },
    async load() {
      if (this.loading || this.loaded || this.failed || this.destroyed) return;
      this.loading = true;
      try {
        const response = await fetch(ASSET_URL);
        if (!response.ok) throw new Error(`LoD2 fetch failed: ${response.status}`);
        this.buffer = await response.arrayBuffer();
        if (this.destroyed) return;
        const {roof, wall} = readMesh(this.buffer);
        this.scene.add(roof, wall);
        this.meshes = [roof, wall];
        this.loaded = true;
        this.map.triggerRepaint();
        // Context geometry arrives first. The larger atlas is a second lazy
        // request, so failed/slow image loading never removes real buildings.
        this.loadRoofTexture();
      } catch (error) {
        this.failed = true;
        console.warn('Official Bavaria LoD2 buildings unavailable; orthophoto remains visible.', error);
      } finally {
        this.loading = false;
      }
    },
    async loadRoofTexture() {
      if (this.textureLoading || this.destroyed || this.maximumTextureSize < 3840) return;
      this.textureLoading = true;
      let texture;
      try {
        const [response, loaded] = await Promise.all([
          fetch(ROOF_TEXTURE_META_URL),
          new THREE.TextureLoader().loadAsync(ROOF_TEXTURE_URL),
        ]);
        texture = loaded;
        if (!response.ok) throw new Error(`DOP20 atlas metadata fetch failed: ${response.status}`);
        const metadata = await response.json();
        if (this.destroyed) return;
        const roof = this.meshes?.[0];
        if (!roof) return;
        roof.geometry.setAttribute('uv', roofUvAttribute(roof.geometry.getAttribute('position'), metadata));
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
        // The orthophoto contains its actual sun/shadows; BasicMaterial avoids
        // brightening it a second time under the 3D scene's ambient lights.
        const material = new THREE.MeshBasicMaterial({
          map: texture, side: THREE.DoubleSide,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        });
        roof.material.dispose();
        roof.material = material;
        this.roofTexture = texture;
        this.map.triggerRepaint();
      } catch (error) {
        console.warn('Bavarian roof orthophoto unavailable; LoD2 geometry remains visible.', error);
      } finally {
        if (texture && texture !== this.roofTexture) texture.dispose();
        this.textureLoading = false;
      }
    },
    render(gl, args) {
      const zoom = this.map.getZoom();
      if (zoom < MIN_CONTEXT_ZOOM || zoom >= MAX_CONTEXT_ZOOM || args.defaultProjectionData?.projectionTransition > 0) return;
      const center = this.map.getCenter();
      if (Math.abs(center.lng - GARCHING[0]) > 0.023 || Math.abs(center.lat - GARCHING[1]) > 0.017) return;
      // A cinematic fly-through to the hero briefly crosses this zoom band.
      // Do not download 758 KB of contextual geometry if the final camera is
      // already heading to a close-up where the untextured layer is hidden.
      if (!this.loaded) {
        if (!this.failed && !this.map.isMoving()) this.load();
        return;
      }

      const merc = maplibregl.MercatorCoordinate.fromLngLat(GARCHING, 0);
      const scale = merc.meterInMercatorCoordinateUnits();
      // Local asset axes: +x east, +y up, +z north. MapLibre Mercator axes:
      // +x east, +y south, +z up. Rx(+90°) maps the local basis exactly.
      const local = new THREE.Matrix4()
        .makeTranslation(merc.x, merc.y, merc.z)
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
      this.camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(local);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    },
    onRemove() {
      this.destroyed = true;
      this.map?.off('moveend', this.onMoveEnd);
      for (const mesh of this.meshes ?? []) {
        mesh.geometry.dispose();
        mesh.material.dispose();
      }
      this.roofTexture?.dispose();
      this.renderer?.dispose();
      this.buffer = null;
    },
  };
}
