import * as THREE from 'three';
import {createExhibitGameAttachment} from './exhibitGameAttachment.js';
import * as maplibregl from 'maplibre-gl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {distanceMetres,sampleTerrainElevation} from './geo.js';
import {getProject} from './projectContent.js';
import {createAchievementSigns, updateAchievementSigns, selectAchievementSignContent, ACHIEVEMENT_GAME_SIGN_POSITIONS} from './achievementSigns.js';

// Visually sited on the open lawn adjoining Unternehmertum's paved access area
// in Bavarian DOP20 imagery, ~19 m from the curated car start. The event's
// supplied coordinate identifies the venue, not an empty patch of land. This
// art-installation siting is illustrative and has not been ground-surveyed.
export const HERO_VENUE_LOCATION = Object.freeze([11.666695, 48.262270]);
export const HERO_VENUE_EVENT = 'european-defense-tech-2025-munich';

const TAU = Math.PI * 2;
const SCAN_DURATION_MS = 4300;
const SCAN_CONTACT_MS = 1550;
const RADAR_REST_YAW = THREE.MathUtils.degToRad(75); // Present the dish toward the paved eastern approach.
const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Dispose all owned resources, including nested sign texture/instance ownership. */
function disposeOwnedScene(root) {
  if (!root) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const owned of object.userData.materials ?? []) materials.add(owned);
    for (const owned of object.userData.textures ?? []) textures.add(owned);
    for (const mat of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!mat) continue;
      materials.add(mat);
      if (mat.map) textures.add(mat.map);
      if (mat.bumpMap) textures.add(mat.bumpMap);
    }
    if (object.isInstancedMesh) object.dispose();
  });
  for (const geometry of geometries) geometry.dispose();
  for (const mat of materials) mat.dispose();
  for (const texture of textures) { texture.dispose(); texture.image = null; }
  root.clear();
  root.userData = {};
}

// The existing Hero basis has x=east and z=south. Convert the actual visual
// positions through public Mercator APIs, rather than borrowing the other
// achievement layer's x=east/z=north convention.
function heroLocalCoordinate(position, [east, south]) {
  const anchor = maplibregl.MercatorCoordinate.fromLngLat(position);
  const scale = anchor.meterInMercatorCoordinateUnits();
  const coordinate = new maplibregl.MercatorCoordinate(anchor.x + east * scale, anchor.y + south * scale).toLngLat();
  return [coordinate.lng, coordinate.lat];
}

function material(color, metalness, roughness, options = {}) {
  return new THREE.MeshStandardMaterial({color, metalness, roughness, ...options});
}

function makeConcreteTexture() {
  if (typeof document === 'undefined') return null;
  // Small procedural aggregate map, not a downloaded satellite/stock asset.
  // The repeat is subtle enough to read as cast concrete even at 1:1 scale.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) return null;
  const pixels = ctx.createImageData(256, 256);
  let seed = 0x5af335d;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    const broad = 6 * Math.sin(x / 21) * Math.sin(y / 29);
    const grain = (random() - 0.5) * 26;
    const chip = random() < 0.007 ? 28 : 0;
    const value = Math.max(0, Math.min(255, 172 + broad + grain - chip));
    pixels.data[i] = value;
    pixels.data[i + 1] = value + 2;
    pixels.data[i + 2] = value - 1;
    pixels.data[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.anisotropy = 2;
  return texture;
}

function addMesh(parent, geometry, mat, xyz = [0, 0, 0], rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(...xyz);
  mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function cylinderBetween(parent, from, to, radius, mat, radialSegments = 10) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const length = a.distanceTo(b);
  const mesh = addMesh(parent, new THREE.CylinderGeometry(radius, radius, length, radialSegments), mat);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return mesh;
}

function horizontalRing(parent, radius, thickness, y, mat, segments = 80) {
  return addMesh(parent, new THREE.TorusGeometry(radius, thickness, 8, segments), mat, [0, y, 0], [Math.PI / 2, 0, 0]);
}

function makeShadowMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {uOpacity: {value: 0.42}},
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform float uOpacity; void main(){float d=length(vUv-0.5)*2.0; float a=pow(max(1.0-d,0.0),2.5)*uOpacity; gl_FragColor=vec4(0.02,0.035,0.035,a);}'
  });
}

function makePlaqueTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 280;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#142125';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#a3b9b9';
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, 984, 240);
  ctx.fillStyle = '#d9e4df';
  ctx.font = '600 76px Arial, sans-serif';
  ctx.fillText('PROTECTIVE RADAR', 58, 122);
  ctx.fillStyle = '#9bb5b5';
  ctx.font = '36px Arial, sans-serif';
  ctx.fillText('GARCHING · DETECTION CONCEPT / 2025', 60, 194);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

/**
 * Build one metre-scale, physically legible installation rather than a generic
 * oversized map pin. The structure is a 10.8 m diameter raised platform with
 * an open-frame shelter, 2.2 m class dish, motor, feed and field instrument.
 * It is intentionally restrained: no missiles, target locks or combat effects.
 */
export function buildProtectiveRadar() {
  const root = new THREE.Group();
  root.name = 'Protective Radar · Garching';

  const concrete = material(0x8d9591, 0.04, 0.92);
  const concreteTexture = makeConcreteTexture();
  if (concreteTexture) {
    concrete.map = concreteTexture;
    concrete.bumpMap = concreteTexture;
    concrete.bumpScale = 0.012;
  }
  const edgeConcrete = material(0x555f5f, 0.11, 0.77);
  const brushedSteel = material(0xb2bebd, 0.68, 0.34);
  const darkSteel = material(0x28383d, 0.62, 0.43);
  const satinSteel = material(0x627c80, 0.58, 0.38);
  const copper = material(0xb99769, 0.68, 0.32);
  const palePaint = material(0xd6ddda, 0.22, 0.43);
  const blueGlass = material(0x7bafb5, 0.24, 0.14, {transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide});
  const softEmission = new THREE.MeshStandardMaterial({color: 0x86c9cf, emissive: 0x75c7cc, emissiveIntensity: 0.95, metalness: 0.25, roughness: 0.34});
  const contactMaterial = new THREE.MeshBasicMaterial({color: 0xf3d2a1, transparent: true, opacity: 0, depthWrite: false});
  const scanMaterial = new THREE.MeshBasicMaterial({color: 0x83c7ca, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false});
  const pulseMaterial = new THREE.MeshBasicMaterial({color: 0xc0e4e5, transparent: true, opacity: 0, depthWrite: false});

  // Ground contact: a soft shadow prevents the model from hovering over the
  // orthophoto while remaining compatible with MapLibre's shared GL context.
  addMesh(root, new THREE.PlaneGeometry(13.8, 13.8), makeShadowMaterial(), [0, 0.012, 0], [-Math.PI / 2, 0, 0]);
  addMesh(root, new THREE.CylinderGeometry(5.32, 5.48, 0.24, 72), edgeConcrete, [0, 0.13, 0]);
  addMesh(root, new THREE.CylinderGeometry(5.18, 5.18, 0.035, 72), concrete, [0, 0.267, 0]);
  horizontalRing(root, 5.13, 0.024, 0.295, copper);
  horizontalRing(root, 3.91, 0.018, 0.296, edgeConcrete);

  // Drain and service channels are physically plausible, rather than neon
  // decoration. Repetition is instanced: one draw call for 12 channels.
  const channelGeometry = new THREE.BoxGeometry(0.105, 0.008, 0.77);
  const channels = new THREE.InstancedMesh(channelGeometry, darkSteel, 12);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 12; i++) {
    const angle = i * TAU / 12;
    dummy.position.set(Math.sin(angle) * 4.48, 0.293, Math.cos(angle) * 4.48);
    dummy.rotation.set(0, angle, 0);
    dummy.updateMatrix();
    channels.setMatrixAt(i, dummy.matrix);
  }
  channels.instanceMatrix.needsUpdate = true;
  root.add(channels);

  // Open protective shelter: a shallow dome of real steel ribs with faint,
  // segmented weather glazing. Its fine frame reads at close range and leaves
  // the radar's silhouette unobscured from every camera bearing.
  const shelter = new THREE.Group();
  shelter.position.y = 0.30;
  root.add(shelter);
  const domeRadius = 3.84;
  const domeHeight = 3.68;
  const ribGeometries = [];
  for (let i = 0; i < 12; i++) {
    const az = i * TAU / 12;
    const pts = [];
    for (let j = 0; j <= 14; j++) {
      const theta = (j / 14) * Math.PI / 2;
      const r = domeRadius * Math.cos(theta);
      pts.push(new THREE.Vector3(Math.sin(az) * r, domeHeight * Math.sin(theta), Math.cos(az) * r));
    }
    ribGeometries.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.028, 6, false));
  }
  const combinedRibs = mergeGeometries(ribGeometries, false);
  for (const g of ribGeometries) g.dispose();
  addMesh(shelter, combinedRibs, brushedSteel);
  horizontalRing(shelter, domeRadius, 0.07, 0.03, darkSteel);
  horizontalRing(shelter, domeRadius * Math.cos(Math.PI / 6), 0.018, domeHeight * Math.sin(Math.PI / 6), brushedSteel);
  horizontalRing(shelter, domeRadius * Math.cos(Math.PI / 3), 0.017, domeHeight * Math.sin(Math.PI / 3), brushedSteel);
  addMesh(shelter, new THREE.SphereGeometry(0.14, 18, 10), copper, [0, domeHeight, 0]);

  // Only alternating bays receive translucent panels. The other half is
  // visibly open, avoiding a solid cartoon bubble and expensive transmission.
  const panelGeometry = new THREE.SphereGeometry(domeRadius - 0.025, 8, 12, 0, TAU / 12, 0.03, Math.PI / 2 - 0.08);
  for (let i = 0; i < 12; i += 2) {
    const panel = addMesh(shelter, panelGeometry, blueGlass);
    panel.rotation.y = i * TAU / 12 + 0.016;
  }

  // Concrete foundation and compact precision pedestal.
  addMesh(root, new THREE.CylinderGeometry(1.53, 1.71, 0.19, 40), darkSteel, [0, 0.39, 0]);
  horizontalRing(root, 1.50, 0.018, 0.50, copper, 48);
  addMesh(root, new THREE.CylinderGeometry(0.63, 0.86, 0.64, 32), edgeConcrete, [0, 0.77, 0]);
  addMesh(root, new THREE.CylinderGeometry(0.42, 0.50, 0.35, 24), satinSteel, [0, 1.26, 0]);
  addMesh(root, new THREE.CylinderGeometry(0.14, 0.18, 1.22, 20), brushedSteel, [0, 1.91, 0]);
  addMesh(root, new THREE.CylinderGeometry(0.35, 0.32, 0.24, 24), darkSteel, [0, 2.54, 0]);

  const radarHead = new THREE.Group();
  radarHead.position.set(0, 2.55, 0);
  root.add(radarHead);
  const tiltedDish = new THREE.Group();
  tiltedDish.rotation.x = -0.17;
  radarHead.add(tiltedDish);
  // A machined shallow paraboloid (radius 1.08 m), not a flattened sphere.
  const dishVertices = [];
  const dishIndices = [];
  const radialBands = 10;
  const circumference = 48;
  for (let band = 0; band <= radialBands; band++) {
    const r = 1.08 * band / radialBands;
    for (let step = 0; step <= circumference; step++) {
      const phi = TAU * step / circumference;
      dishVertices.push(Math.sin(phi) * r, Math.cos(phi) * r, -0.30 + 0.27 * (r / 1.08) ** 2);
    }
  }
  for (let band = 0; band < radialBands; band++) for (let step = 0; step < circumference; step++) {
    const a = band * (circumference + 1) + step;
    const b = a + circumference + 1;
    // Front-facing (+z) winding: the feed horn sits on this side.
    dishIndices.push(a, a + 1, b, b, a + 1, b + 1);
  }
  const dishGeometry = new THREE.BufferGeometry();
  dishGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dishVertices, 3));
  dishGeometry.setIndex(dishIndices);
  dishGeometry.computeVertexNormals();
  addMesh(tiltedDish, dishGeometry, palePaint);
  addMesh(tiltedDish, new THREE.CylinderGeometry(0.22, 0.22, 0.30, 24), satinSteel, [0, 0, -0.46], [Math.PI / 2, 0, 0]);
  horizontalRing(tiltedDish, 1.08, 0.022, 0, brushedSteel); // Reoriented to dish plane below.
  const rim = tiltedDish.children.at(-1);
  rim.rotation.set(0, 0, 0);
  rim.position.z = -0.03;
  const feed = addMesh(tiltedDish, new THREE.CylinderGeometry(0.12, 0.17, 0.33, 18), darkSteel, [0, 0, 0.64], [Math.PI / 2, 0, 0]);
  feed.name = 'Radar feed horn';
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3;
    cylinderBetween(tiltedDish, [Math.sin(a) * 0.78, Math.cos(a) * 0.78, -0.12], [0, 0, 0.64], 0.014, brushedSteel, 6);
  }
  // Mechanical rear braces visibly connect the moving dish to its motor.
  cylinderBetween(radarHead, [-0.37, -0.15, -0.28], [-0.53, -0.69, -0.36], 0.045, satinSteel);
  cylinderBetween(radarHead, [0.37, -0.15, -0.28], [0.53, -0.69, -0.36], 0.045, satinSteel);

  // Four shelter support shoes and eight grounding bolts are instanced.
  const shoeGeometry = new THREE.CylinderGeometry(0.12, 0.16, 0.32, 12);
  const shoes = new THREE.InstancedMesh(shoeGeometry, darkSteel, 12);
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12;
    dummy.position.set(Math.sin(a) * domeRadius, 0.43, Math.cos(a) * domeRadius);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    shoes.setMatrixAt(i, dummy.matrix);
  }
  shoes.instanceMatrix.needsUpdate = true;
  root.add(shoes);

  // Low, mountable field-console for the actual user action. A small bronze
  // control ring is visible from the car's approach without becoming a pin.
  const consoleGroup = new THREE.Group();
  consoleGroup.position.set(2.96, 0.30, -2.38);
  consoleGroup.rotation.y = -0.44;
  root.add(consoleGroup);
  addMesh(consoleGroup, new THREE.BoxGeometry(0.44, 0.78, 0.36), darkSteel, [0, 0.39, 0]);
  addMesh(consoleGroup, new THREE.BoxGeometry(0.56, 0.07, 0.46), brushedSteel, [0, 0.81, 0]);
  addMesh(consoleGroup, new THREE.PlaneGeometry(0.35, 0.23), softEmission, [0, 0.852, 0], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 3; i++) addMesh(consoleGroup, new THREE.BoxGeometry(0.052, 0.01, 0.05), copper, [-0.13 + i * 0.13, 0.856, 0.14]);

  // A restrained interpretive plaque; one 1024x280 canvas texture, generated
  // locally, no network request. It explains why this object exists.
  const plaque = new THREE.Group();
  plaque.position.set(3.16, 0.35, 2.14);
  plaque.rotation.y = 1.06; // Faces the paved approach east/north of the lawn.
  root.add(plaque);
  addMesh(plaque, new THREE.BoxGeometry(2.45, 0.12, 0.13), darkSteel, [0, 0.30, 0]);
  for (const x of [-1.03, 1.03]) addMesh(plaque, new THREE.CylinderGeometry(0.045, 0.05, 0.53, 10), brushedSteel, [x, 0.02, 0]);
  const plaqueTexture = makePlaqueTexture();
  if (plaqueTexture) addMesh(plaque, new THREE.PlaneGeometry(2.34, 0.64), new THREE.MeshBasicMaterial({map: plaqueTexture, side: THREE.DoubleSide}), [0, 0.30, 0.072]);

  // Scanning is a quiet spatial visualization, not an aggressive target lock.
  const scanGroup = new THREE.Group();
  scanGroup.position.y = 0.55;
  root.add(scanGroup);
  const sweep = addMesh(scanGroup, new THREE.CircleGeometry(3.55, 52, 0, Math.PI / 7), scanMaterial, [0, 0, 0], [-Math.PI / 2, 0, 0]);
  const pulse = horizontalRing(root, 1, 0.055, 0.52, pulseMaterial, 72);
  const contact = addMesh(root, new THREE.SphereGeometry(0.09, 16, 10), contactMaterial, [1.3, 1.27, -1.25]);
  addMesh(root, new THREE.SphereGeometry(0.15, 16, 10), softEmission, [0, 1.46, 0]);
  const shieldMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {uAlpha: {value: 0}},
    vertexShader: 'varying vec3 vNormal; varying vec3 vView; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz); gl_Position=projectionMatrix*p;}',
    fragmentShader: 'varying vec3 vNormal; varying vec3 vView; uniform float uAlpha; void main(){float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.3); gl_FragColor=vec4(0.44,0.77,0.80,uAlpha*(0.08+0.92*rim));}'
  });
  const shield = addMesh(root, new THREE.SphereGeometry(3.91, 40, 18, 0, TAU, 0, Math.PI / 2), shieldMaterial, [0, 0.31, 0]);
  shield.scale.y = domeHeight / 3.91;
  const wire = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(3.55, 3.55, 0.008, 56)), new THREE.LineBasicMaterial({color: 0x729499, transparent: true, opacity: 0.32}));
  wire.position.y = 0.54;
  root.add(wire);

  function updateScan(elapsedMs, motionReduced = false) {
    const duration = motionReduced ? 900 : SCAN_DURATION_MS;
    const elapsed = Math.max(0, elapsedMs);
    const t = Math.min(1, elapsed / duration);
    const active = elapsed < duration;
    radarHead.rotation.y = RADAR_REST_YAW + (active && !motionReduced ? t * TAU * 2 : 0);
    sweep.rotation.z = active && !motionReduced ? t * TAU * 2 : 0;
    scanMaterial.opacity = active ? 0.22 * Math.sin(Math.PI * t) : 0;
    contactMaterial.opacity = active && elapsed >= (motionReduced ? 150 : SCAN_CONTACT_MS) ? Math.min(0.94, (elapsed - (motionReduced ? 150 : SCAN_CONTACT_MS)) / 260) * Math.min(1, (duration - elapsed) / 650) : 0;
    pulse.scale.setScalar(active ? 0.35 + t * 4.55 : 1);
    pulseMaterial.opacity = active ? 0.75 * (1 - t) : 0;
    const shieldStart = motionReduced ? 150 : SCAN_CONTACT_MS;
    const shieldAge = Math.max(0, elapsed - shieldStart);
    const shieldRise = Math.min(1, shieldAge / (motionReduced ? 150 : 950));
    shield.scale.y = (domeHeight / 3.91) * (0.18 + 0.82 * shieldRise);
    shieldMaterial.uniforms.uAlpha.value = active && elapsed >= shieldStart
      ? 0.32 * Math.min(1, shieldAge / 400) * Math.min(1, (duration - elapsed) / 750)
      : 0;
    return active;
  }
  updateScan(SCAN_DURATION_MS);

  function dispose() {
    disposeOwnedScene(root);
  }
  return {root, updateScan, dispose};
}

/**
 * MapLibre custom layer contract:
 *   const venue = createHeroVenueLayer({lngLat: [lng,lat], onScan: event => ...});
 *   map.addLayer(venue);
 *   venue.setActive(true);        // show only when this venue is selected
 *   venue.triggerScan();          // start a finite, user-initiated interaction
 *   venue.getScanState();         // {phase:'idle'|'scanning'|'contact'|'complete'}
 *   venue.getSignContent();       // existing authored title/summary/detail, or null
 *   venue.getSignPositions();     // two native sign locations, or [] when inactive
 *   venue.getExhibitFocus();      // the illustrative radar siting, never the event pin
 * The layer does not modify the map's camera or DOM. It renders on the map's
 * shared WebGL context and disposes resources when removed.
 */
export function createHeroVenueLayer({lngLat = HERO_VENUE_LOCATION, onScan = () => {},
  rendererFactory = null, signCanvasFactory = null} = {}) {
  const position = [...lngLat];
  const project = getProject(HERO_VENUE_EVENT);
  const signContent = selectAchievementSignContent(project);
  let phase = 'idle';
  let scanStart = 0;
  let contactReported = false;
  let visible = false;
  let structure = null;
  let signs = null;
  let signsUnavailable = false;
  let world = null;

  function releaseSigns() {
    if (!signs) return;
    world?.remove(signs);
    disposeOwnedScene(signs);
    signs = null;
  }

  function ensureSigns() {
    if (!visible || !world || signs || signsUnavailable) return;
    // In non-DOM/headless environments the authored content remains available
    // without manufacturing a texture. Browser canvas creation is synchronous,
    // exclusively at activation, never in render or an intro preload loop.
    if (!signCanvasFactory && !globalThis.document?.createElement) return;
    try {
      // Hero already uses the original east/up/south texture basis; the other
      // achievement court's east/up/north U reversal would mirror our text.
      signs = createAchievementSigns(project, {canvasFactory: signCanvasFactory, mirrorU: false});
      // Keep the original radar's projection/lighting intact. Its projection
      // winding differs from a standalone Three scene, so only the new text
      // planes need two-sided rasterization. Heads face the public camera,
      // avoiding mirrored reverse-side text without altering the radar basis.
      for (const panel of signs.userData.panels) {
        panel.material.side = THREE.DoubleSide;
        panel.material.needsUpdate = true;
      }
      world.add(signs);
      signs.visible=game.isActive();
    } catch (error) {
      // A browser denying 2D canvas must not prevent the existing radar/story
      // from working. Reader content still uses the actual authored project.
      signsUnavailable = true;
      console.warn('Native project signs unavailable; authored project content remains accessible.', error);
    }
  }
  const gamePointVector=new THREE.Vector4(),gamePoint={x:0,y:0};let gameProjectionReady=false;
  const game=createExhibitGameAttachment({getSlug:()=>visible?HERO_VENUE_EVENT:null,getHost:()=>world,
    getDemo:()=>structure?[structure.root]:[],getSigns:()=>signs?.userData.panels?.map(panel=>panel.head)??[],getProjection:()=>layer.camera?.projectionMatrix,
    getCanvas:()=>layer.map?.getCanvas(),canRender:()=>visible&&gameProjectionReady,
    transformInput:input=>{const yaw=(layer.map?.getBearing?.()??0)*Math.PI/180;
      return {x:input.x*Math.cos(yaw)-input.z*Math.sin(yaw),z:input.x*Math.sin(yaw)+input.z*Math.cos(yaw),activate:input.activate};},
    onRepaint:()=>layer.map?.triggerRepaint(),onActiveChange:active=>{if(structure)structure.root.visible=!active;if(signs)signs.visible=active;}
  });
  const layer = {
    id: 'earth-engine-hero-venue',
    type: 'custom',
    renderingMode: '3d',
    setActive(next) {
      visible = !!next;gameProjectionReady=false;
      if(!visible)game.stop();
      if (visible) ensureSigns();
      else { releaseSigns(); signsUnavailable = false; }
      if (!visible && phase === 'scanning') { phase = 'idle'; onScan({phase}); }
      this.map?.triggerRepaint();
    },
    triggerScan() {
      if(game.isActive())game.stop();
      if (!visible || !this.map || this.map.getZoom() < 19.5) return false;
      const center = this.map.getCenter();
      if (distanceMetres([center.lng, center.lat], position) > 75) return false;
      scanStart = performance.now();
      contactReported = false;
      phase = 'scanning';
      onScan({phase});
      this.map.triggerRepaint();
      return true;
    },
    getGamePosition() { return visible ? heroLocalCoordinate(position,[2.96,-2.38]) : null; },
    getGameScreenPosition() {
      if(!visible||!gameProjectionReady||!this.camera||!this.map)return null;
      const canvas=this.map.getCanvas(),width=canvas.clientWidth,height=canvas.clientHeight;
      if(!(width>0&&height>0))return null;
      gamePointVector.set(2.96,1.16,-2.38,1).applyMatrix4(this.camera.projectionMatrix);
      if(!(gamePointVector.w>0))return null;
      gamePoint.x=(gamePointVector.x/gamePointVector.w+1)*width/2;
      gamePoint.y=(1-gamePointVector.y/gamePointVector.w)*height/2;
      return gamePoint;
    },
    getScanState() { return {phase}; },
    startGame(slug){phase='idle';return game.start(slug);},
    stopGame(){game.stop();},
    resetGame(){game.reset();},
    gameIsActive(){return game.isActive();},
    gameClick(id,point){return game.click(id,point);},
    gameHover(id){game.hover(id);},
    gameInput(input){game.input(input);},
    pickGameObject(point){return game.pick(point);},
    getGameStats(){return game.getStats();},
    getSignContent() { return visible ? signs?.userData.content ?? signContent : null; },
    getSignPositions() { return visible&&game.isActive() ? ACHIEVEMENT_GAME_SIGN_POSITIONS.map(([east,,south])=>heroLocalCoordinate(position,[east,south])) : []; },
    getExhibitFocus() { return visible ? [...position] : null; },
    onAdd(map, gl) {
      game.revive();
      this.map = map;
      this.camera = new THREE.Camera();
      this.scene = new THREE.Scene();
      world = new THREE.Group();
      this.scene.add(world);
      structure = buildProtectiveRadar();
      world.add(structure.root);
      const sky = new THREE.HemisphereLight(0xe7f1ef, 0x606b68, 2.1);
      this.scene.add(sky);
      const sun = new THREE.DirectionalLight(0xfff3dd, 2.35);
      sun.position.set(-20, 55, 18);
      this.scene.add(sun);
      const fill = new THREE.DirectionalLight(0xa4bec5, 0.85);
      fill.position.set(15, 20, -15);
      this.scene.add(fill);
      this.renderer = rendererFactory ? rendererFactory(map, gl)
        : new THREE.WebGLRenderer({canvas: map.getCanvas(), context: gl, antialias: true});
      this.renderer.autoClear = false;
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;
      ensureSigns();
    },
    render(gl, args) {
      gameProjectionReady=false;
      if (!visible || !this.map || !structure || !this.renderer
        || !args.defaultProjectionData?.mainMatrix || this.map.getZoom() < 17
        || args.defaultProjectionData.projectionTransition > 0) return;
      if (signs) {
        const center = this.map.getCenter();
        updateAchievementSigns(signs, {visible: game.isActive(), zoom: this.map.getZoom(),
          distanceM: distanceMetres([center.lng, center.lat], position),
          // Convert public camera bearing to Hero's z=south basis, while the
          // shared panel implementation uses z=north. Poles remain stationary.
          bearing: 180 - (this.map.getBearing?.() ?? 42), pitch: this.map.getPitch?.() ?? 54});
      }
      const now = performance.now();
      game.render(now);
      if (phase === 'scanning') {
        const elapsed = now - scanStart;
        const motionReduced = reducedMotion();
        const contactTime = motionReduced ? 150 : SCAN_CONTACT_MS;
        if (!contactReported && elapsed >= contactTime) {
          contactReported = true;
          onScan({phase: 'contact'});
        }
        const stillActive = structure.updateScan(elapsed, motionReduced);
        if (stillActive) this.map.triggerRepaint();
        else {
          phase = 'complete';
          onScan({phase});
        }
      } else if (phase === 'idle') structure.updateScan(SCAN_DURATION_MS);
      const elevation = sampleTerrainElevation(this.map,position) ?? 0;
      const origin = maplibregl.MercatorCoordinate.fromLngLat(position, elevation + 0.06);
      const scale = origin.meterInMercatorCoordinateUnits();
      const model = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .multiply(new THREE.Matrix4().makeRotationZ(Math.PI))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeScale(-scale, scale, scale));
      this.camera.projectionMatrix = new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix).multiply(model);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);gameProjectionReady=true;
    },
    onRemove() {
      game.destroy();
      gameProjectionReady=false;releaseSigns();
      structure?.dispose();
      this.scene?.clear();
      this.renderer?.dispose();
      structure = null;
      world = null;
      signsUnavailable = false;
      visible = false;
      phase = 'idle';
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.map = null;
    }
  };
  return layer;
}
