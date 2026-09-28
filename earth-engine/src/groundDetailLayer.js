import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {distanceMetres} from './geo.js';

// REJECTED ART STUDY: kept for comparison, intentionally not integrated into
// main.js. At the strength needed to see it, the procedural micrograin reads
// as synthetic speckle and does not recover overzoomed DOP20 image detail.
// See design/ground-detail-study.md before reusing this layer.
// An optional *material-detail* experiment, not replacement ortho-imagery.
// The polygons below are deliberately conservative, hand-traced ground-only
// masks against the official BVV DOP20 z19 tiles 279134–135 / 181677–678.
// They encode only grass and paved area, never pixels or colours from imagery.
// Re-survey before publication; even accurate image registration cannot prove
// that a curb, tree, or route remains the same today.
export const GARCHING_GROUND_ORIGIN = Object.freeze([11.666695, 48.262270]);
const TILE_ZOOM = 19;
const TILE_PIXEL_ORIGIN = [219.156025, 199.936087];
const EXTENT_METRES = 80;
const HALF_EXTENT = EXTENT_METRES / 2;
const GRID_DIVISIONS = 16;
const MASK_RESOLUTION = 256;
const EARTH_CIRCUMFERENCE_METRES = 40_075_016.686;
const PIXEL_METRES = EARTH_CIRCUMFERENCE_METRES * Math.cos(GARCHING_GROUND_ORIGIN[1] * Math.PI / 180)
  / (2 ** TILE_ZOOM * 256);

// Native 256 px z19 Web-Mercator mosaic coordinates, measured from the NW
// corner of tile 279134/181677. Region borders sit safely *inside* the image
// surface boundaries to keep the soft blend away from roofs and path edges.
const LAWN = [
  [108, 165], [130, 159], [259, 159], [260, 220], [250, 230],
  [231, 233], [205, 231], [165, 224], [115, 212], [107, 192],
];
const ACCESS_PAVING = [
  [292, 149], [325, 151], [328, 205], [323, 237],
  [309, 251], [269, 244], [274, 215], [281, 181],
];
const SOUTH_PATH = [
  [239, 249], [275, 252], [315, 266], [365, 287], [385, 297],
  [385, 312], [356, 303], [310, 282], [272, 270], [239, 267],
];

function nativePixelToMetres([pixelX, pixelY]) {
  return [
    (pixelX - TILE_PIXEL_ORIGIN[0]) * PIXEL_METRES,
    (TILE_PIXEL_ORIGIN[1] - pixelY) * PIXEL_METRES,
  ];
}

function drawRegion(context, polygon, color) {
  context.beginPath();
  polygon.forEach((pixel, index) => {
    const [east, north] = nativePixelToMetres(pixel);
    const x = (east + HALF_EXTENT) / EXTENT_METRES * MASK_RESOLUTION;
    const y = (HALF_EXTENT - north) / EXTENT_METRES * MASK_RESOLUTION;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.fillStyle = color;
  context.fill();
}

function createRegionMask() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = MASK_RESOLUTION;
  const context = canvas.getContext('2d');
  // ~0.8 m feather on both sides of the hand-traced polygon. A small blur is
  // more honest than a hard vector curb over an orthophoto from another date.
  context.filter = 'blur(3px)';
  drawRegion(context, LAWN, '#ff0000');
  drawRegion(context, ACCESS_PAVING, '#00ff00');
  drawRegion(context, SOUTH_PATH, '#00ff00');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = 2;
  return texture;
}

function createGroundMesh(mask) {
  const positions = new Float32Array((GRID_DIVISIONS + 1) ** 2 * 3);
  const indices = [];
  for (let northIndex = 0; northIndex <= GRID_DIVISIONS; northIndex++) {
    const north = -HALF_EXTENT + northIndex * EXTENT_METRES / GRID_DIVISIONS;
    for (let eastIndex = 0; eastIndex <= GRID_DIVISIONS; eastIndex++) {
      const east = -HALF_EXTENT + eastIndex * EXTENT_METRES / GRID_DIVISIONS;
      const offset = (northIndex * (GRID_DIVISIONS + 1) + eastIndex) * 3;
      positions[offset] = east;
      positions[offset + 1] = 0.04;
      positions[offset + 2] = north;
      if (northIndex < GRID_DIVISIONS && eastIndex < GRID_DIVISIONS) {
        const a = northIndex * (GRID_DIVISIONS + 1) + eastIndex;
        const b = a + 1;
        const c = a + GRID_DIVISIONS + 1;
        indices.push(a, c, b, b, c, c + 1); // local +y front face
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);

  const material = new THREE.ShaderMaterial({
    uniforms: {uRegions: {value: mask}, uStrength: {value: 2.0}},
    vertexShader: `
      varying vec2 vMetres;
      varying vec2 vRegionUv;
      void main() {
        vMetres = position.xz;
        vRegionUv = (position.xz + vec2(${HALF_EXTENT.toFixed(1)})) / ${EXTENT_METRES.toFixed(1)};
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uRegions;
      uniform float uStrength;
      varying vec2 vMetres;
      varying vec2 vRegionUv;
      float hash21(vec2 p) {
        p = fract(p * vec2(0.1031, 0.1030));
        p += dot(p, p.yx + 33.33);
        return fract((p.x + p.y) * p.x);
      }
      void main() {
        vec3 region = texture2D(uRegions, vRegionUv).rgb;
        float patchEdge = 1.0 - smoothstep(35.5, 39.5, max(abs(vMetres.x), abs(vMetres.y)));
        float grass = region.r * patchEdge;
        float paving = region.g * patchEdge;
        if (grass + paving < 0.004) discard;

        // Stationary, world-metre microvariation. The 5–9 grains/m band
        // adds a visual spatial-frequency layer without inventing DOP colour.
        // No external textures, screen-coordinate noise, glow, or animation.
        float fine = hash21(floor(vMetres * 8.3));
        float broad = hash21(floor(vMetres * 2.7));
        float pebble = smoothstep(0.84, 0.98, fine) * broad;
        float tuft = smoothstep(0.81, 0.98, hash21(floor(vMetres * vec2(5.1, 7.7))));

        // Transparent pigment over the real orthophoto: grass stays grass,
        // light concrete stays light concrete, shadows and route stay visible.
        vec3 grassInk = mix(vec3(0.075, 0.095, 0.054), vec3(0.56, 0.58, 0.39), fine * 0.60 + tuft * 0.40);
        vec3 pavingInk = mix(vec3(0.12, 0.14, 0.13), vec3(0.70, 0.70, 0.66), fine * 0.82 + pebble * 0.18);
        float alphaGrass = grass * (0.022 + 0.078 * tuft + 0.037 * (1.0 - broad));
        float alphaPaving = paving * (0.025 + 0.077 * pebble + 0.022 * (1.0 - fine));
        float alpha = min(0.30, (alphaGrass + alphaPaving) * uStrength);
        vec3 pigment = (grassInk * alphaGrass + pavingInk * alphaPaving) / max(0.0001, alphaGrass + alphaPaving);
        gl_FragColor = vec4(pigment, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  return mesh;
}

function sampleTerrain(map, mesh) {
  const base = map.queryTerrainElevation(GARCHING_GROUND_ORIGIN);
  if (map.getTerrain() && base == null) return null;
  const originHeight = base ?? 0;
  const position = mesh.geometry.attributes.position;
  const radians = Math.PI / 180;
  const metresPerLatDegree = 6_371_008.8 * radians;
  const metresPerLngDegree = metresPerLatDegree * Math.cos(GARCHING_GROUND_ORIGIN[1] * radians);
  for (let index = 0; index < position.count; index++) {
    const east = position.getX(index);
    const north = position.getZ(index);
    const lngLat = [
      GARCHING_GROUND_ORIGIN[0] + east / metresPerLngDegree,
      GARCHING_GROUND_ORIGIN[1] + north / metresPerLatDegree,
    ];
    const elevation = map.queryTerrainElevation(lngLat) ?? originHeight;
    position.setY(index, elevation - originHeight + 0.04);
  }
  position.needsUpdate = true;
  return originHeight;
}

/**
 * Optional MapLibre custom layer. Add *before* the car and radar custom layers:
 *   const ground = createGarchingGroundDetailLayer();
 *   map.addLayer(ground, 'earth-engine-car');
 *   ground.setActive(activeEvent?.slug === HERO_VENUE_EVENT);
 * It is inactive by default, draws only at z >= 19.5 within 130 m of Garching,
 * owns no camera/DOM, and is intentionally not wired into main.js yet.
 */
export function createGarchingGroundDetailLayer() {
  let active = false;
  let mesh;
  let mask;
  let terrainHeight = null;
  let terrainSampleTime = 0;
  return {
    id: 'earth-engine-garching-ground-detail',
    type: 'custom',
    renderingMode: '3d',
    setActive(next) {
      active = !!next;
      this.map?.triggerRepaint();
    },
    onAdd(map, gl) {
      this.map = map;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      mask = createRegionMask();
      mesh = createGroundMesh(mask);
      this.scene.add(mesh);
      this.renderer = new THREE.WebGLRenderer({canvas: map.getCanvas(), context: gl, antialias: true});
      this.renderer.autoClear = false;
    },
    render(gl, args) {
      if (!active || this.map.getZoom() < 19.5 || args.defaultProjectionData?.projectionTransition > 0) return;
      const center = this.map.getCenter();
      if (distanceMetres([center.lng, center.lat], GARCHING_GROUND_ORIGIN) > 130) return;
      const now = performance.now();
      if (terrainHeight == null || now - terrainSampleTime > 2000) {
        terrainSampleTime = now;
        terrainHeight = sampleTerrain(this.map, mesh);
      }
      if (terrainHeight == null) return;
      const origin = maplibregl.MercatorCoordinate.fromLngLat(GARCHING_GROUND_ORIGIN, terrainHeight);
      const scale = origin.meterInMercatorCoordinateUnits();
      const model = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
      this.camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix)
        .multiply(model);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
    },
    onRemove() {
      mesh?.geometry.dispose();
      mesh?.material.dispose();
      mask?.dispose();
      this.renderer?.dispose();
      mesh = null;
      mask = null;
      this.renderer = null;
      this.scene = null;
      this.map = null;
    },
  };
}
