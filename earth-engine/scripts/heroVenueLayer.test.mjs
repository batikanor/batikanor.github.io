import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {createHeroVenueLayer, HERO_VENUE_EVENT, HERO_VENUE_LOCATION} from '../src/heroVenueLayer.js';
import {getProject} from '../src/projectContent.js';
import {selectAchievementSignContent} from '../src/achievementSigns.js';
import {distanceMetres} from '../src/geo.js';

const args = {defaultProjectionData: {mainMatrix: [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], projectionTransition: 0}};

function canvasFixture() {
  const canvases = [];
  const canvasFactory = (width, height) => {
    const calls = [];
    let font = '10px Arial';
    const context = {calls, get font() { return font; }, set font(value) { font = value; },
      fillRect(...values) { calls.push(['fillRect', ...values]); },
      strokeRect(...values) { calls.push(['strokeRect', ...values]); },
      measureText(text) { return {width: text.length * Number(font.match(/(\d+)px/)[1]) * .52}; },
      fillText(text, ...values) { calls.push(['text', text, ...values]); }};
    const canvas = {width, height, context, getContext: kind => kind === '2d' ? context : null};
    canvases.push(canvas);
    return canvas;
  };
  return {canvases, canvasFactory};
}

function fixture() {
  const canvas = canvasFixture();
  const map = {zoom: 20, bearing: 42, pitch: 54, center: {lng: HERO_VENUE_LOCATION[0], lat: HERO_VENUE_LOCATION[1]}, repaints: 0,
    getZoom() { return this.zoom; }, getBearing() { return this.bearing; }, getPitch() { return this.pitch; },
    getCenter() { return this.center; }, queryTerrainElevation() { return 7; },
    triggerRepaint() { this.repaints++; }};
  const renderer = {renders: 0, disposals: 0, resetState() {},
    render(scene) { this.renders++; scene.updateMatrixWorld(true); }, dispose() { this.disposals++; }};
  const events = [];
  const layer = createHeroVenueLayer({rendererFactory: () => renderer,
    signCanvasFactory: canvas.canvasFactory, onScan: event => events.push(event)});
  return {layer, map, renderer, events, ...canvas};
}

function signsFor(layer) {
  let signs = null;
  layer.scene?.traverse(object => { if (object.userData.authored) signs = object; });
  return signs;
}

function ownedResources(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), instances = [];
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of object.userData.materials ?? []) materials.add(material);
    for (const texture of object.userData.textures ?? []) textures.add(texture);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      if (material.map) textures.add(material.map);
      if (material.bumpMap) textures.add(material.bumpMap);
    }
    if (object.isInstancedMesh) instances.push(object);
  });
  return {geometries, materials, textures, instances};
}

test('Hero signs allocate only at activation, stay single, and release between destinations', () => {
  const {layer, map, canvases} = fixture();
  assert.equal(layer.getSignContent(), null);
  assert.deepEqual(layer.getSignPositions(), []);
  assert.equal(layer.getExhibitFocus(), null);
  layer.onAdd(map, {});
  layer.render({}, args);
  assert.equal(canvases.length, 0, 'intro/inactive radar must not decode sign canvases');
  assert.equal(signsFor(layer), null);
  layer.setActive(true);
  const first = signsFor(layer);
  assert.ok(first);
  assert.equal(canvases.length, 2);
  layer.setActive(true);
  layer.render({}, args);
  assert.equal(signsFor(layer), first);
  assert.equal(canvases.length, 2, 'no allocation in repeated activation/render');
  layer.setActive(false);
  assert.equal(signsFor(layer), null);
  assert.equal(layer.getSignContent(), null);
  assert.deepEqual(layer.getSignPositions(), []);
  assert.equal(layer.getExhibitFocus(), null);
  layer.setActive(true);
  assert.equal(canvases.length, 4);
  assert.notEqual(signsFor(layer), first);
  layer.onRemove();
});

test('activation before MapLibre onAdd defers canvases until the scene exists', () => {
  const {layer, map, canvases} = fixture();
  layer.setActive(true);
  assert.equal(canvases.length, 0);
  layer.onAdd(map, {});
  assert.equal(canvases.length, 2);
  layer.onRemove();
});

test('the two Hero panels use itemized source notes and do not duplicate the radar', () => {
  const {layer, map, canvases} = fixture();
  layer.onAdd(map, {});
  layer.setActive(true);
  const signs = signsFor(layer);
  const project = getProject(HERO_VENUE_EVENT);
  assert.deepEqual(layer.getSignContent(), selectAchievementSignContent(project));
  assert.equal(layer.getSignContent(), signs.userData.content);
  assert.equal(layer.getSignContent().title, project.title);
  assert.equal(layer.getSignContent().source, 'portfolio-exhibit-notes');
  assert.deepEqual(layer.getSignContent().summaryItems, project.exhibitNotes.overview);
  assert.deepEqual(layer.getSignContent().detailItems, project.exhibitNotes.details);
  assert.notEqual(layer.getSignContent().summary, project.shortDescription);
  let radars = 0;
  layer.scene.traverse(object => { if (object.name === 'Protective Radar · Garching') radars++; });
  assert.equal(radars, 1);
  assert.deepEqual(signs.userData.panels.map(panel => panel.head.position.toArray()), [[-8.55,3.4,.6], [8.55,3.4,.6]]);
  for (const canvas of canvases) {
    assert.equal(canvas.width, 1024);
    assert.equal(canvas.height, 640);
  }
  assert.equal(signs.userData.textureBytes, 5_242_880);
  assert.equal(signs.userData.textures.length, 2);
  for (const texture of signs.userData.textures) {
    assert.equal(texture.repeat.x, 1, 'east/up/south Hero does not need the other scene basis U reversal');
    assert.equal(texture.offset.x, 0);
  }
  let draws = 0, triangles = 0;
  signs.traverse(object => {
    if (!object.isMesh) return;
    draws++;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3
      * (object.isInstancedMesh ? object.count : 1);
  });
  assert.equal(draws, 5);
  assert.equal(triangles, 92);
  assert.ok(signs.userData.panels.every(panel => !panel.layout.overflow));
  // Compact note markers stay outside the physical game's 6.65m footprint.
  assert.ok(Math.hypot(8.55,.6)-Math.hypot(1.71,.985*Math.sin(35*Math.PI/180)+.071)>6.65);
  layer.onRemove();
});

test('public camera events orient visible game signs without native canvas allocations', async () => {
  const {layer, map, renderer, canvases} = fixture();
  layer.onAdd(map, {});
  layer.setActive(true);
  const signs = signsFor(layer);
  const calls = canvases.map(canvas => canvas.context.calls.length);
  const textures = [...signs.userData.textures];
  assert.deepEqual(layer.getSignPositions(),[],'idle scene has no reading markers');
  await layer.startGame(HERO_VENUE_EVENT);
  const repaints = map.repaints;
  layer.render({}, args);
  assert.equal(signs.userData.signState.readable, true);
  assert.equal(signs.userData.signState.opacity, 1);
  assert.equal(map.repaints, repaints);
  map.bearing = 90;
  map.pitch = 65;
  layer.render({}, args);
  for (const panel of signs.userData.panels) {
    assert.equal(panel.head.rotation.y, Math.PI * 1.5);
    assert.ok(Math.abs(panel.head.rotation.x + 25 * Math.PI / 180) < 1e-9);
  }
  map.center = {lng: HERO_VENUE_LOCATION[0] + .01, lat: HERO_VENUE_LOCATION[1]};
  layer.render({}, args);
  assert.equal(signs.visible, false);
  assert.equal(map.repaints, repaints);
  assert.deepEqual(signs.userData.textures, textures);
  assert.deepEqual(canvases.map(canvas => canvas.context.calls.length), calls);
  assert.equal(canvases.length, 2);
  const renders = renderer.renders;
  map.zoom = 16;
  layer.render({}, args);
  layer.render({}, {defaultProjectionData: {projectionTransition: 1}});
  assert.equal(renderer.renders, renders);
  layer.onRemove();
});

test('Hero game signs preserve the original radar projection, positive-up lighting and metre-scale positions', async () => {
  const {layer, map} = fixture();
  layer.onAdd(map, {});
  layer.setActive(true);
  await layer.startGame(HERO_VENUE_EVENT);layer.render({}, args);
  const signs = signsFor(layer), positions = layer.getSignPositions();
  assert.deepEqual(layer.getExhibitFocus(), HERO_VENUE_LOCATION);
  layer.getExhibitFocus()[0] = 0;
  assert.deepEqual(layer.getExhibitFocus(), HERO_VENUE_LOCATION, 'coordinate getter must not mutate siting');
  assert.equal(positions.length, 2);
  for (const [index, panel] of signs.userData.panels.entries()) {
    assert.ok(positions[index][1] < HERO_VENUE_LOCATION[1], 'positive Hero z remains south in the original scene basis');
    assert.ok(Math.abs(distanceMetres(positions[index], HERO_VENUE_LOCATION) - Math.hypot(8.55, .6)) < .02);
    const world = panel.head.getWorldPosition(new THREE.Vector3());
    assert.equal(panel.plane.matrixWorld.determinant(), 1, 'existing radar world basis must stay unreflected');
    assert.equal(panel.material.side, THREE.DoubleSide, 'Hero text must survive original projection winding');
    const projected = new THREE.Vector4(world.x, world.y, world.z, 1).applyMatrix4(layer.camera.projectionMatrix);
    const ground = maplibregl.MercatorCoordinate.fromLngLat(positions[index], 7 + .06 + 3.4);
    assert.ok(Math.abs(projected.x - ground.x) < 1e-12);
    assert.ok(Math.abs(projected.y - ground.y) < 1e-12);
    assert.ok(Math.abs(projected.z - ground.z) < 1e-10);
  }
  // The unchanged original Hero projection reproduces radar positions exactly.
  const origin = maplibregl.MercatorCoordinate.fromLngLat(HERO_VENUE_LOCATION, 7 + .06);
  const scale = origin.meterInMercatorCoordinateUnits();
  const previous = new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z)
    .multiply(new THREE.Matrix4().makeRotationZ(Math.PI))
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(new THREE.Matrix4().makeScale(-scale, scale, scale));
  const oldPoint = new THREE.Vector4(2,3,4,1).applyMatrix4(previous);
  const newPoint = new THREE.Vector4(2,3,4,1).applyMatrix4(layer.camera.projectionMatrix);
  assert.deepEqual(newPoint.toArray(), oldPoint.toArray());
  const lights = layer.scene.children.filter(object => object.isLight);
  assert.ok(lights.every(light => light.position.y > 0));
  assert.deepEqual(lights.map(light => light.position.toArray()), [[0,1,0], [-20,55,18], [15,20,-15]]);
  layer.onRemove();
});

test('inactive/remove disposal collects every nested texture/material/instance exactly once', () => {
  const {layer, map, renderer} = fixture();
  layer.onAdd(map, {});
  layer.setActive(true);
  const signs = signsFor(layer);
  // Ownership may include textures/materials that are temporarily not on a mesh.
  const extraTexture = new THREE.Texture({width: 2, height: 2});
  const extraMaterial = new THREE.MeshBasicMaterial();
  signs.userData.panels[0].head.userData.textures = [extraTexture];
  signs.userData.panels[0].head.userData.materials = [extraMaterial];
  const resources = ownedResources(signs);
  let geometries = 0, materials = 0, textures = 0, instances = 0;
  resources.geometries.forEach(resource => resource.addEventListener('dispose', () => geometries++));
  resources.materials.forEach(resource => resource.addEventListener('dispose', () => materials++));
  resources.textures.forEach(resource => resource.addEventListener('dispose', () => textures++));
  resources.instances.forEach(resource => resource.addEventListener('dispose', () => instances++));
  layer.setActive(false);
  assert.equal(geometries, resources.geometries.size);
  assert.equal(materials, resources.materials.size);
  assert.equal(textures, resources.textures.size);
  assert.equal(instances, resources.instances.length);
  assert.equal(signs.children.length, 0);
  resources.textures.forEach(texture => assert.equal(texture.image, null));
  layer.setActive(false);
  layer.onRemove();
  layer.onRemove();
  assert.equal(textures, resources.textures.size, 'no double-disposal after deactivation then removal');
  assert.equal(instances, resources.instances.length);
  assert.equal(renderer.disposals, 1);
  assert.equal(layer.getSignContent(), null);
  assert.deepEqual(layer.getSignPositions(), []);
  layer.render({}, args);
});

test('direct removal releases active signs and radar instance buffers without an inactive transition', () => {
  const {layer, map} = fixture();
  layer.onAdd(map, {});
  layer.setActive(true);
  const resources = ownedResources(layer.scene), signs = signsFor(layer);
  let instances = 0, textures = 0;
  resources.instances.forEach(resource => resource.addEventListener('dispose', () => instances++));
  resources.textures.forEach(resource => resource.addEventListener('dispose', () => textures++));
  layer.onRemove();
  assert.equal(instances, resources.instances.length);
  assert.equal(textures, resources.textures.size);
  assert.equal(signs.children.length, 0);
  assert.equal(layer.scene, null);
});

test('finite user-triggered scan behavior survives sign activation and cancellation', () => {
  const {layer, map, events} = fixture();
  layer.onAdd(map, {});
  assert.equal(layer.triggerScan(), false);
  layer.setActive(true);
  map.zoom = 19;
  assert.equal(layer.triggerScan(), false);
  map.zoom = 20;
  assert.equal(layer.triggerScan(), true);
  assert.deepEqual(layer.getScanState(), {phase: 'scanning'});
  layer.render({}, args);
  assert.deepEqual(events[0], {phase: 'scanning'});
  layer.setActive(false);
  assert.deepEqual(layer.getScanState(), {phase: 'idle'});
  assert.deepEqual(events.at(-1), {phase: 'idle'});
  assert.equal(signsFor(layer), null);
  layer.onRemove();
});

test('headless activation has authored reader data but never creates textures in render', () => {
  const map = fixture().map;
  const renderer = {resetState() {}, render() {}, dispose() {}};
  const layer = createHeroVenueLayer({rendererFactory: () => renderer});
  layer.onAdd(map, {});
  layer.setActive(true);
  assert.equal(signsFor(layer), null);
  assert.equal(layer.getSignContent().title, getProject(HERO_VENUE_EVENT).title);
  layer.render({}, args);
  assert.equal(signsFor(layer), null);
  layer.onRemove();
});

test('denied native canvas never blocks the radar/story or retries allocation in render', () => {
  const map = fixture().map;
  let attempts = 0, renders = 0;
  const renderer = {resetState() {}, render() { renders++; }, dispose() {}};
  const layer = createHeroVenueLayer({rendererFactory: () => renderer,
    signCanvasFactory: () => { attempts++; throw new Error('Native canvas blocked'); }});
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    layer.onAdd(map, {});
    assert.doesNotThrow(() => layer.setActive(true));
    assert.equal(attempts, 1);
    layer.render({}, args);
    layer.setActive(true);
    layer.render({}, args);
    assert.equal(attempts, 1);
    assert.equal(renders, 2);
    assert.equal(layer.getSignContent().title, getProject(HERO_VENUE_EVENT).title);
    assert.deepEqual(layer.getSignPositions(),[],'idle denied-canvas scene has no reading markers');
    assert.equal(signsFor(layer), null);
    layer.setActive(false);
    layer.setActive(true);
    assert.equal(attempts, 2, 'a later explicit activation may retry restored browser capabilities');
  } finally {
    layer.onRemove();
    console.warn = originalWarn;
  }
});


test('the existing Hero console only exposes a game target after a valid current frame, without extra geometry',()=>{
  const {layer,map}=fixture();map.getCanvas=()=>({clientWidth:1200,clientHeight:800});layer.onAdd(map,{});layer.setActive(true);
  assert.equal(layer.getGameScreenPosition(),null);layer.render({},args);const point=layer.getGameScreenPosition();assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.equal(layer.getGameScreenPosition(),point);
  layer.render({}, {defaultProjectionData:{mainMatrix:args.defaultProjectionData.mainMatrix,projectionTransition:1}});assert.equal(layer.getGameScreenPosition(),null);layer.render({},args);assert.ok(layer.getGameScreenPosition());
  layer.setActive(false);assert.equal(layer.getGamePosition(),null);assert.equal(layer.getGameScreenPosition(),null);layer.setActive(true);assert.equal(layer.getGameScreenPosition(),null);layer.onRemove();
});

test('physical Hero game shows source signs only during real game renders and releases each owned resource once',async()=>{
  const {layer,map,renderer,canvases}=fixture();
  function watchResources(root){
    const owned=ownedResources(root),resources=new Set([...owned.geometries,...owned.materials,...owned.textures,...owned.instances]);
    const counts=new Map([...resources].map(resource=>[resource,0]));
    for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
    return expected=>{assert.ok(counts.size>0);for(const [resource,count]of counts)assert.equal(count,expected,`${resource.type??resource.constructor.name} disposal count`);};
  }
  try{
    layer.onAdd(map,{});layer.setActive(true);layer.render({},args);
    const signs=signsFor(layer),content=layer.getSignContent(),textures=[...signs.userData.textures];
    const radar=layer.scene.getObjectByName('Protective Radar · Garching'),originalResources=watchResources(layer.scene);
    assert.ok(radar&&radar.visible);
    assert.equal(signs.visible,false);
    assert.equal(await layer.startGame(HERO_VENUE_EVENT),true);
    let gameRoot;layer.scene.traverse(object=>{if(object.userData.isExhibitGame)gameRoot=object;});
    assert.ok(gameRoot);
    assert.ok(gameRoot.getObjectByName('finite-completion-sparks')?.isInstancedMesh,'test observes real game instance ownership');
    const gameResources=watchResources(gameRoot);
    for(let frame=0;frame<3;frame++){
      layer.render({},args);
      assert.equal(signs.visible,true,`frame ${frame}: source signs belong only inside the active game`);
      assert.equal(radar.visible,false,'original radar stays hidden while its physical game plays');
      assert.equal(layer.getSignContent(),content,'game never rewrites project/sign copy');
      assert.equal(canvases.length,2,'play creates no extra text canvases');
    }
    originalResources(0);gameResources(0);
    layer.stopGame();layer.render({},args);
    assert.equal(signsFor(layer),signs);
    assert.equal(signs.visible,false);
    assert.equal(layer.getSignContent(),content);
    assert.deepEqual(signs.userData.textures,textures);
    assert.equal(layer.scene.getObjectByName('Protective Radar · Garching'),radar);
    assert.equal(radar.visible,true);
    assert.equal(gameRoot.parent,null);
    gameResources(1);originalResources(0);
    layer.stopGame();gameResources(1);
    layer.onRemove();layer.onRemove();
    originalResources(1);gameResources(1);
    assert.ok(textures.every(texture=>texture.image===null));
    assert.equal(renderer.disposals,1);
  }finally{if(layer.scene)layer.onRemove();}
});
