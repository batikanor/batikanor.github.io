import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';

// Node has no CSS loader; test the actual module with its one CSS side effect omitted.
const source = (await readFile(new URL('../src/galleryRoomGlobe.js', import.meta.url), 'utf8'))
  .replace("import './galleryRoomGlobe.css';", '')
  .replace("'./galleryRoomSatellite.js'", JSON.stringify(new URL('../src/galleryRoomSatellite.js', import.meta.url).href))
  .replace("from 'three';", `from '${import.meta.resolve('three')}';`);
const {galleryGlobeCoordinate, galleryGlobeRotation, galleryGlobeYawTarget,
  galleryGlobeIsTap, pickGalleryGlobeMarker, clusterGalleryGlobeMarkers, pickGalleryGlobeCluster,
  galleryGlobeClusterTarget, GALLERY_GLOBE_MAX_ZOOM, GALLERY_GLOBE_PROJECT_ZOOM} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const projects = JSON.parse(await readFile(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));
const near = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${actual} differs from ${expected}`);

test('geographic cardinal directions and longitude seam agree with the Earth texture', () => {
  const geometry = new THREE.SphereGeometry(1, 72, 36);
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  for (const [latitude, longitude] of [[0, 0], [0, 90], [0, -90], [0, 180], [90, 0], [-90, 0], [50, 10]]) {
    const u = (longitude + 180) / 360, v = (latitude + 90) / 180;
    let closest = 0, distance = Infinity;
    for (let i = 0; i < uv.count; i++) {
      const candidate = Math.hypot(uv.getX(i) - u, uv.getY(i) - v);
      if (candidate < distance) {distance = candidate;closest = i;}
    }
    const expected = new THREE.Vector3().fromBufferAttribute(positions, closest).normalize();
    const actual = new THREE.Vector3(...galleryGlobeCoordinate(latitude, longitude));
    // Pole UVs have a half-segment offset, but their positions are still the pole.
    assert.ok(actual.distanceTo(expected) < 1e-6, `${latitude},${longitude} does not match UV geography`);
  }
  geometry.dispose();
});

test('all32 actual project coordinates round-trip without a fictional map position', () => {
  assert.equal(projects.length, 32);
  for (const project of projects) {
    const [x, y, z] = galleryGlobeCoordinate(project.coordinates.lat, project.coordinates.lng, 1.018);
    near(Math.hypot(x, y, z), 1.018);
    near(Math.asin(y / 1.018) * 180 / Math.PI, project.coordinates.lat);
    near(Math.atan2(-z, x) * 180 / Math.PI, project.coordinates.lng);
  }
});

test('active fly rotation centers every project on the front while north stays above it', () => {
  for (const project of projects) {
    const {pitch, yaw} = galleryGlobeRotation(project.coordinates.lat, project.coordinates.lng);
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'XYZ'));
    const point = new THREE.Vector3(...galleryGlobeCoordinate(project.coordinates.lat, project.coordinates.lng)).applyQuaternion(rotation);
    near(point.x, 0);near(point.y, 0);near(point.z, 1);
    assert.ok(new THREE.Vector3(0, 1, 0).applyQuaternion(rotation).y > 0);
  }
});

test('active flight takes the short longitude path across the map seam', () => {
  const current = 179 * Math.PI / 180, target = -179 * Math.PI / 180;
  near(galleryGlobeYawTarget(current, target) - current, 2 * Math.PI / 180);
  near(galleryGlobeYawTarget(-current, -target) + current, -2 * Math.PI / 180);
});

test('coincident projects cycle independently and rear-hemisphere markers cannot be picked', () => {
  const markers = [{slug: 'a', x: 50, y: 60}, {slug: 'b', x: 50, y: 60},
    {slug: 'c', x: 53, y: 62}, {slug: 'rear', x: 50, y: 60, visible: false}, {slug: 'distant', x: 80, y: 60}];
  const point = {x: 50, y: 60};
  assert.equal(pickGalleryGlobeMarker(markers, point).slug, 'a');
  assert.equal(pickGalleryGlobeMarker(markers, point, {previousSlug: 'a'}).slug, 'b');
  assert.equal(pickGalleryGlobeMarker(markers, point, {previousSlug: 'b'}).slug, 'c');
  assert.equal(pickGalleryGlobeMarker(markers, point, {previousSlug: 'c'}).slug, 'a');
  assert.equal(pickGalleryGlobeMarker(markers, {x: 0, y: 0}), null);
});

test('delayed dot activation preserves its repeat-pick position through the real selection flight', () => {
  const flightSource = source.slice(source.indexOf('  function advanceFlight(time)'), source.indexOf('  function focusCluster(cluster)'));
  const activateSource = source.slice(source.indexOf('  function setActive(slug,'), source.indexOf('  function resize()'));
  const context = vm.createContext({THREE, GALLERY_GLOBE_MAX_ZOOM, GALLERY_GLOBE_PROJECT_ZOOM,
    galleryGlobeRotation, galleryGlobeYawTarget, disposed: false, locations: projects, activeSlug: null,
    select: {}, live: {}, motion: {matches: true}, pitch: .4, yaw: -Math.PI / 2, zoom: 1,
    camera: new THREE.OrthographicCamera(-1.23, 1.23, 1.23, -1.23, .1, 10),
    window: {performance: {now: () => 155}}, hoverSlug: null, previousPick: null, flight: null,
    cancelGesture() {}, hideClusterList() {}, updateClusters() {}, requestRender() {}, setRotation() {},
    gallerySatelliteProjectLevels: () => [], ensureImagery() {}});
  new vm.Script(flightSource + activateSource).runInContext(context);
  const markers = projects.slice(0, 2).map(project => ({slug: project.slug, x: 110, y: 110}));
  const point = {x: 110, y: 110}, first = pickGalleryGlobeMarker(markers, point);
  context.previousPick = {...point, slug: first.slug};
  context.setActive(first.slug);
  assert.equal(pickGalleryGlobeMarker(markers, point, {previousSlug: context.previousPick?.slug}).slug,
    markers[1].slug, 'the delayed room commit retains the prior dot so another shared project can be reached');
  near(context.zoom, GALLERY_GLOBE_PROJECT_ZOOM);
  context.setActive(projects[2].slug);
  assert.equal(context.previousPick, null, 'external project navigation starts a fresh pick cycle');
});

test('phone hit radius accepts a near miss without reaching an unrelated geographic dot', () => {
  const markers = [{slug: 'near', x: 60, y: 60}, {slug: 'other', x: 80, y: 60}];
  assert.equal(pickGalleryGlobeMarker(markers, {x: 47, y: 60}, {radius: 13}).slug, 'near');
  assert.equal(pickGalleryGlobeMarker(markers, {x: 46, y: 60}, {radius: 13}), null);
});

test('a drag returning to its initial point and a cancelled touch never select a project', () => {
  assert.equal(galleryGlobeIsTap({x: 10, y: 10, dragged: true}, {x: 10, y: 10}), false);
  assert.equal(galleryGlobeIsTap({x: 10, y: 10, cancelled: true}, {x: 10, y: 10}), false);
  assert.equal(galleryGlobeIsTap({x: 10, y: 10}, {x: 16, y: 10}), false);
  assert.equal(galleryGlobeIsTap({x: 10, y: 10}, {x: 12, y: 11}), true);
});

test('screen clusters conserve visible events, aggregate neighbors, and split as zoom increases', () => {
  const markers = [{slug: 'a', x: 100, y: 100}, {slug: 'b', x: 112, y: 100},
    {slug: 'c', x: 124, y: 100, active: true}, {slug: 'separate', x: 190, y: 100},
    {slug: 'rear', x: 100, y: 100, visible: false}];
  const groups = clusterGalleryGlobeMarkers(markers, {radius: 14});
  assert.deepEqual(groups.map(group => group.count), [3, 1]);
  assert.equal(groups[0].id, 'a|b|c');assert.equal(groups[0].active, true);
  assert.equal(groups[0].x, 112);assert.equal(groups[0].y, 100);
  assert.equal(pickGalleryGlobeCluster(groups, {x: 114, y: 100}).id, 'a|b|c');
  assert.equal(pickGalleryGlobeCluster(groups, {x: 190, y: 100}), null, 'single dots retain individual picking');
  assert.equal(pickGalleryGlobeCluster(groups, {x: 140, y: 100}), null);
  const zoomed = clusterGalleryGlobeMarkers(markers.map(marker => ({...marker, x: marker.x * 3, y: marker.y * 3})), {radius: 14});
  assert.equal(zoomed.length, 4);assert.ok(zoomed.every(group => group.count === 1));
});

test('cluster targets use real geography, the short seam, and bounded zoom with a terminal choice', () => {
  const seam = [{coordinates: {lat: 10, lng: 179}}, {coordinates: {lat: 10, lng: -179}}];
  const target = galleryGlobeClusterTarget(seam, 1);
  near(Math.abs(target.longitude), 180);assert.ok(target.latitude > 10 && target.latitude < 10.01);
  assert.equal(target.zoom, 1.9);assert.equal(target.expand, false);
  const coincident = [{coordinates: {lat: 48.1, lng: 11.5}}, {coordinates: {lat: 48.1, lng: 11.5}}];
  assert.equal(galleryGlobeClusterTarget(coincident, 1).expand, false, 'first click visibly zooms even a collocated cluster');
  assert.equal(galleryGlobeClusterTarget(coincident, 1.9).expand, true, 'the next click exposes both projects');
  assert.equal(galleryGlobeClusterTarget(seam, GALLERY_GLOBE_MAX_ZOOM).zoom, GALLERY_GLOBE_MAX_ZOOM);
  assert.equal(galleryGlobeClusterTarget(seam, GALLERY_GLOBE_MAX_ZOOM).expand, true);
  assert.throws(() => galleryGlobeClusterTarget([]), TypeError);
});

test('a numbered cluster zooms without selecting a room, while collocated projects open choices', () => {
  const focusSource = source.slice(source.indexOf('  function focusCluster(cluster)'), source.indexOf('  function changeZoom(factor)'));
  const calls = [];
  const context = vm.createContext({locations: projects, zoom: 1, live: {}, galleryGlobeClusterTarget,
    cancelGesture() {}, flyTo: target => calls.push({kind: 'zoom', target}),
    showClusterList: cluster => calls.push({kind: 'choices', cluster}), hideClusterList() {},
    onSelect: slug => calls.push({kind: 'select', slug})});
  new vm.Script(focusSource).runInContext(context);
  const members = projects.slice(0, 3).map(project => ({slug: project.slug}));
  context.focusCluster({count: 3, members});
  assert.equal(calls.length, 1);assert.equal(calls[0].kind, 'zoom');assert.ok(calls[0].target.zoom > 1);
  context.zoom = GALLERY_GLOBE_MAX_ZOOM;context.focusCluster({count: 3, members});
  assert.deepEqual(calls.map(call => call.kind), ['zoom', 'zoom', 'choices']);
});

// Run actual DOM/event wiring and Three camera math without requiring a GPU in Node.
const rendererFixture = `export const globeFixtureRenderers = [];
class GlobeRendererFixture {
  constructor() { this.capabilities={getMaxAnisotropy:()=>1};this.info={render:{calls:0}};this.ratio=1;globeFixtureRenderers.push(this); }
  setClearColor() {} setPixelRatio(value) {this.ratio=value;} getPixelRatio() {return this.ratio;}
  setSize(width,height) {this.width=width;this.height=height;} render(scene,camera) {this.scene=scene;this.camera=camera;this.info.render.calls++;}
  dispose() {} forceContextLoss() {}
}\n`;
const {createGalleryRoomGlobe: createFixtureGlobe, globeFixtureRenderers} = await import(`data:text/javascript;base64,${Buffer.from(
  rendererFixture + source.replace('new THREE.WebGLRenderer(', 'new GlobeRendererFixture(')).toString('base64')}`);

function globeDocument(size = 336, {reducedMotion = true} = {}) {
  class Target {
    constructor() {this.listeners = new Map();}
    addEventListener(type, fn) {if (!this.listeners.has(type)) this.listeners.set(type, new Set());this.listeners.get(type).add(fn);}
    removeEventListener(type, fn) {this.listeners.get(type)?.delete(fn);}
    dispatch(type, values = {}) {
      const event = {target: this, preventDefault() {this.prevented = true;}, stopPropagation() {}, ...values};
      for (const fn of this.listeners.get(type) || []) fn(event);return event;
    }
  }
  const document = new Target();
  class Element extends Target {
    constructor(tag) {
      super();this.tagName = tag.toUpperCase();this.children = [];this.style = {};this.dataset = {};
      this.attributes = new Map();this.ownerDocument = document;this.parentElement = null;
      this.className = '';this.hidden = false;this.isConnected = true;this.textContent = '';
      this.classList = {contains: value => this.className.split(' ').includes(value),
        add: (...values) => {this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...values])].join(' ');},
        remove: (...values) => {this.className = this.className.split(' ').filter(value => !values.includes(value)).join(' ');}};
    }
    append(...children) {for (const child of children) {this.children.push(child);child.parentElement = this;}}
    replaceChildren(...children) {this.children.forEach(child => child.parentElement = null);this.children = [];this.append(...children);}
    get firstElementChild() {return this.children[0] || null;}
    setAttribute(key, value) {this.attributes.set(key, String(value));}
    getAttribute(key) {return this.attributes.get(key) ?? null;}
    removeAttribute(key) {this.attributes.delete(key);}
    contains(child) {for (let current = child; current; current = current.parentElement) if (current === this) return true;return false;}
    closest(selector) {for (let current = this; current; current = current.parentElement) if (selector === '[hidden]' && current.hidden) return current;return null;}
    focus() {document.activeElement = this;}
    getBoundingClientRect() {return {width: size, height: size, top: 0, left: 0};}
    setPointerCapture(id) {this.capture = id;}
    hasPointerCapture(id) {return this.capture === id;}
    releasePointerCapture() {this.capture = null;}
    remove() {if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this);this.parentElement = null;}
  }
  const observer = class {observe() {} disconnect() {}};
  const motion = new Target();motion.matches = reducedMotion;
  const window = new Target(), pending = new Map(), images = [];let nextFrame = 0, currentTime = 0;
  Object.assign(window, {matchMedia: () => motion, performance: {now: () => currentTime}, devicePixelRatio: 1,
    requestAnimationFrame(fn) {pending.set(++nextFrame, fn);return nextFrame;}, cancelAnimationFrame(id) {pending.delete(id);},
    ResizeObserver: observer, IntersectionObserver: observer, MutationObserver: observer,
    getComputedStyle: () => ({visibility: 'visible'}), Image: class extends Element {constructor() {super('img');images.push(this);}}});
  document.defaultView = window;document.createElement = tag => new Element(tag);
  document.documentElement = new Element('html');document.hidden = false;document.activeElement = null;
  const container = new Element('div');document.documentElement.append(container);
  return {container, document, window, pending, images,
    setSize(value) {size = value;},
    advanceTime(time) {currentTime = time;},
    tick(time) {currentTime = time;const callbacks = [...pending.values()];pending.clear();callbacks.forEach(fn => fn(time));},
    descendants: (host = container) => {const all = [];const visit = item => {for (const child of item.children) {all.push(child);visit(child);}};visit(host);return all;}};
}

test('native cluster, zoom, keyboard, chooser and reset wiring preserve the fixed phone viewport', () => {
  const fixture = globeDocument(188), selections = [];
  const globe = createFixtureGlobe({container: fixture.container, achievements: projects, onSelect: slug => selections.push(slug)});
  const find = className => fixture.descendants().find(element => element.classList.contains(className));
  const canvas = find('gallery-room-globe-canvas');
  const tools = fixture.descendants().filter(element => element.classList.contains('gallery-room-globe-tool'));
  tools[2].dispatch('click'); // Reset the initially selected regional view to inspect world clusters.
  const initial = globe.getStats();assert.equal(initial.zoom, 1);assert.ok(initial.clusters > 0);
  assert.equal(find('gallery-room-globe-locations').children.length, 32);
  const cluster = fixture.descendants().filter(element => element.classList.contains('gallery-room-globe-cluster'))
    .sort((a, b) => Number(b.textContent) - Number(a.textContent))[0];
  cluster.dispatch('click');assert.equal(globe.getStats().zoom, 1.9);assert.deepEqual(selections, []);
  assert.equal(globe.getStats().activeSlug, initial.activeSlug);
  assert.equal(globe.getStats().width, 188);assert.equal(globe.getStats().height, 188);
  tools[2].dispatch('click');assert.equal(globe.getStats().zoom, 1);
  canvas.dispatch('keydown', {key: '+'});assert.equal(globe.getStats().zoom, 1.5);
  fixture.container.dispatch('wheel', {deltaY: 120, target: canvas});assert.equal(globe.getStats().zoom, 1);

  const sameLocation = projects.find(project => projects.some(other => other.slug !== project.slug
    && other.coordinates.lat === project.coordinates.lat && other.coordinates.lng === project.coordinates.lng));
  globe.setActive(sameLocation.slug);
  for (let step = 0; step < 9; step++) tools[0].dispatch('click');
  assert.equal(globe.getStats().zoom, GALLERY_GLOBE_MAX_ZOOM);
  const currentCluster = fixture.descendants().find(element => element.classList.contains('gallery-room-globe-cluster')
    && element.getAttribute('aria-current') === 'location');
  assert.ok(currentCluster);currentCluster.dispatch('click');
  assert.equal(globe.getStats().clusterListOpen, true);assert.deepEqual(selections, []);
  const choices = fixture.descendants().filter(element => element.classList.contains('gallery-room-globe-cluster-item'));
  assert.ok(choices.length >= 2);assert.ok(choices.some(choice => choice.textContent === sameLocation.title));
  const chooserWheel = fixture.container.dispatch('wheel', {deltaY: 100, target: choices[0]});
  assert.equal(chooserWheel.prevented, undefined, 'the chooser scrolls without zooming its globe');
  const selected = choices[1].textContent;choices[1].dispatch('click');
  assert.equal(selections.length, 1);assert.equal(projects.find(project => project.slug === selections[0]).title, selected);
  assert.equal(globe.getStats().clusterListOpen, false);assert.equal(fixture.document.activeElement, canvas);
  canvas.dispatch('keydown', {key: 'Home'});assert.equal(globe.getStats().zoom, 1);
  const current = globe.getMarkerPositions().find(marker => marker.slug === sameLocation.slug);
  near(current.x, 94);near(current.y, 94);
  const count = selections.length;
  canvas.dispatch('pointerdown', {isPrimary: true, button: 0, pointerId: 1, clientX: 75, clientY: 75});
  canvas.dispatch('pointermove', {pointerId: 1, clientX: 95, clientY: 75});
  canvas.dispatch('pointerup', {pointerId: 1, clientX: 75, clientY: 75});
  assert.equal(selections.length, count, 'a drag that returns to its origin never selects an event');
  globe.dispose();assert.equal(fixture.container.children.length, 0);assert.equal(fixture.pending.size, 0);
});

test('animated zoom advances within the fixed canvas, preserves idle cluster nodes, and cancels on drag', () => {
  const fixture = globeDocument(), motion = fixture.window.matchMedia();
  const globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const tick = time => fixture.tick(time);
  const tools = fixture.descendants().filter(element => element.classList.contains('gallery-room-globe-tool'));
  tools[2].dispatch('click');
  const clusterNodes = () => fixture.descendants().filter(element => element.classList.contains('gallery-room-globe-cluster'));
  tick(0);const original = new Map(clusterNodes().map(button => [button.dataset.clusterId, button]));
  motion.matches = false;motion.dispatch('change');tick(40);
  for (const button of clusterNodes()) assert.equal(button, original.get(button.dataset.clusterId), 'an idle pulse preserves native button identity');
  tools[0].dispatch('click');assert.equal(globe.getStats().zoom, 1);
  tick(390);const intermediate = globe.getStats().zoom;assert.ok(intermediate > 1 && intermediate < 1.5);
  assert.equal(globe.getStats().width, 336);assert.equal(globe.getStats().height, 336);
  const canvas = fixture.descendants().find(element => element.classList.contains('gallery-room-globe-canvas'));
  canvas.dispatch('pointerdown', {isPrimary: true, button: 0, pointerId: 1, clientX: 126, clientY: 126});
  canvas.dispatch('pointercancel', {pointerId: 1});tick(900);
  near(globe.getStats().zoom, intermediate, 1e-12);
  tools[2].dispatch('click');motion.matches = true;motion.dispatch('change');
  assert.equal(globe.getStats().zoom, 1, 'turning on reduced motion finishes the pending reset immediately');
  globe.dispose();assert.equal(fixture.pending.size, 0);
});

function assertProjectCentered(globe, slug, size = 336) {
  const marker = globe.getMarkerPositions().find(item => item.slug === slug);
  assert.ok(marker?.visible, 'the real project location is visible');
  near(marker.x, size / 2);near(marker.y, size / 2);
  near(globe.getStats().zoom, GALLERY_GLOBE_PROJECT_ZOOM);
  assert.equal(globe.getStats().flying, false);
}

test('natural Earth texture keeps its original daylight colors across the entire globe', () => {
  const fixture = globeDocument(), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const image = fixture.images[0];assert.match(image.src, /^\/assets\/gallery\/satellite\/world\.jpg\?v=[0-9a-f]{12}$/);
  image.onload();fixture.tick(0);
  const {scene} = globeFixtureRenderers.at(-1), surface = scene.getObjectByName('gallery-globe-daylight-earth');
  assert.ok(surface.material.isMeshBasicMaterial, 'the natural map is evenly lit from every geographic angle');
  assert.equal(surface.material.toneMapped, false, 'renderer exposure cannot darken the day map');
  assert.equal(surface.material.color.getHex(), 0xffffff, 'the texture receives no teal or green color multiplier');
  assert.equal(surface.material.map.image, image);assert.equal(surface.material.map.colorSpace, THREE.SRGBColorSpace);
  let lights = 0;scene.traverse(node => {if (node.isLight) lights++;});
  assert.equal(lights, 0, 'no directional night side can darken map geography');
  assert.equal(globe.getStats().textureLoaded, true);globe.dispose();
});

test('city satellite LOD loads lazily, keeps a three-texture LRU and releases evicted and disposed GPU resources', () => {
  const fixture = globeDocument(), selections = [], loaded = new WeakSet();
  const globe = createFixtureGlobe({container: fixture.container, achievements: projects, onSelect: slug => selections.push(slug)});
  const decode = () => {
    for (const image of [...fixture.images]) if (image.onload && !loaded.has(image)) {loaded.add(image);image.onload();}
  };
  assert.equal(fixture.images.length, 3, 'initial load is world plus two active-city LOD images');
  assert.ok(fixture.images.every(image => image.src.startsWith('/assets/gallery/satellite/')), 'imagery requests never go to another host');
  decode();fixture.tick(0);assert.equal(globe.getStats().imagery, 'city-00-city');
  const firstPatch = globeFixtureRenderers.at(-1).scene.getObjectByName('gallery-satellite-city-00-city');
  assert.ok(firstPatch?.visible);assert.equal(firstPatch.material.toneMapped, false);
  assert.equal(firstPatch.material.color.getHex(), 0xffffff);
  const retired = {geometry: 0, material: 0, texture: 0};
  firstPatch.geometry.addEventListener('dispose', () => retired.geometry++);
  firstPatch.material.addEventListener('dispose', () => retired.material++);
  firstPatch.material.map.addEventListener('dispose', () => retired.texture++);
  for (const [index, project] of projects.slice(1, 12).entries()) {
    globe.setActive(project.slug);decode();fixture.tick((index+1)*40);
    assert.ok(globe.getStats().imagery.endsWith('-city'), 'arrival displays genuine city-scale detail');
    assert.ok(globe.getStats().detailTextures <= 3 && globe.getStats().detailRequests <= 3);
  }
  assert.deepEqual(retired, {geometry: 1, material: 1, texture: 1}, 'LRU evicts and disposes every original GPU object once');
  const scene = globeFixtureRenderers.at(-1).scene;
  const liveTextures = [];scene.traverse(node => {if (node.material?.map) liveTextures.push(node.material.map);});
  let disposedTextures = 0;liveTextures.forEach(texture => texture.addEventListener('dispose', () => disposedTextures++));
  globe.dispose();assert.equal(disposedTextures, liveTextures.length);
  assert.ok(fixture.images.every(image => image.onload === null && image.onerror === null));
  assert.equal(fixture.container.children.length, 0);assert.equal(fixture.pending.size, 0);
  assert.deepEqual(selections, []);
});

test('mobile world imagery is smaller and satellite failure falls back gracefully', () => {
  const fixture = globeDocument(188), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  assert.match(fixture.images[0].src, /^\/assets\/gallery\/satellite\/world-small\.jpg\?v=[0-9a-f]{12}$/);
  fixture.images[0].onload();fixture.images.slice(1).forEach(image => image.onerror());fixture.tick(0);
  assert.equal(globe.getStats().imagery, 'world');assert.equal(globe.getStats().textureLoaded, true);
  globe.dispose();
});

test('imagery credits open only on request, preserve linked attribution, and close without disrupting the map', () => {
  const fixture = globeDocument(112), selections = [];
  const globe = createFixtureGlobe({container: fixture.container, achievements: projects, onSelect: slug => selections.push(slug)});
  const find = className => fixture.descendants().find(element => element.classList.contains(className));
  const credit = find('gallery-room-globe-credit'), toggle = find('gallery-room-globe-credit-toggle');
  const canvas = find('gallery-room-globe-canvas'), initial = globe.getStats();
  assert.equal(credit.hidden, true);assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.tagName, 'BUTTON');assert.equal(toggle.title, 'Map imagery credits');
  assert.equal(toggle.getAttribute('aria-label'), 'Map imagery credits');
  assert.equal(toggle.getAttribute('aria-controls'), credit.id);
  assert.equal(credit.getAttribute('role'), 'region');
  assert.equal(credit.getAttribute('aria-label'), 'Map imagery credits');
  assert.ok(credit.title.includes('2016 & 2017') && credit.title.includes('Historical'));
  const links = credit.children.filter(node => node.tagName === 'A');
  assert.deepEqual(links.map(node => node.href), ['https://s2maps.eu', 'https://eox.at', 'https://creativecommons.org/licenses/by/4.0/']);
  assert.deepEqual(links.map(node => node.textContent), ['Sentinel-2 cloudless', 'EOX IT Services GmbH', 'CC BY 4.0']);
  assert.ok(links.every(node => node.target === '_blank' && node.rel === 'noopener noreferrer'));
  assert.equal(find('gallery-room-globe-credit-years').textContent, 'Contains modified Copernicus Sentinel data 2016 & 2017.');
  assert.equal(find('gallery-room-globe-credit-history').textContent, 'Historical imagery from 2016–17.');
  toggle.dispatch('click');assert.equal(credit.hidden, false);assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  fixture.document.dispatch('pointerdown', {target: links[0]});assert.equal(credit.hidden, false);
  const wheel = fixture.container.dispatch('wheel', {deltaY: 100, target: links[0]});
  assert.equal(wheel.prevented, undefined, 'credit text can scroll without zooming the globe');
  for (const key of ['activeSlug', 'zoom', 'width', 'height', 'detailRequests']) assert.equal(globe.getStats()[key], initial[key]);
  toggle.dispatch('click');assert.equal(credit.hidden, true);assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.dispatch('click');links[0].focus();
  const escape = fixture.document.dispatch('keydown', {key: 'Escape', target: links[0]});
  assert.equal(escape.prevented, true);assert.equal(credit.hidden, true);assert.equal(fixture.document.activeElement, toggle);
  toggle.dispatch('click');fixture.document.dispatch('pointerdown', {target: fixture.document.documentElement});
  assert.equal(credit.hidden, true, 'outside interaction dismisses the panel');
  toggle.dispatch('click');fixture.document.dispatch('pointerdown', {target: canvas});
  canvas.dispatch('pointerdown', {isPrimary: true, button: 0, pointerId: 8, clientX: 56, clientY: 56});
  canvas.dispatch('pointermove', {pointerId: 8, clientX: 70, clientY: 60});
  assert.equal(credit.hidden, true);assert.equal(globe.getStats().dragging, true, 'outside dismissal still allows globe dragging');
  canvas.dispatch('pointercancel', {pointerId: 8});
  assert.deepEqual(selections, []);
  globe.dispose();assert.equal(fixture.container.children.length, 0);assert.equal(fixture.pending.size, 0);
  for (const type of ['pointerdown', 'keydown']) assert.equal(fixture.document.listeners.get(type).size, 0, 'disposal removes panel document listeners');
});

test('selected marker and pulse keep their screen size from city zoom through maximum zoom while graticules hide', () => {
  const fixture = globeDocument(), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const tools = fixture.descendants().filter(node => node.classList.contains('gallery-room-globe-tool'));
  const canvas = fixture.descendants().find(node => node.classList.contains('gallery-room-globe-canvas'));
  for (let step = 0; step < 5; step++) {
    fixture.tick(step*40);const {scene} = globeFixtureRenderers.at(-1);
    let dots, pulse, grid;scene.traverse(node => {if (node.isInstancedMesh) dots=node;if (node.geometry?.type === 'RingGeometry') pulse=node;if (node.isLineSegments) grid=node;});
    const matrix = new THREE.Matrix4();dots.getMatrixAt(0, matrix);
    near(new THREE.Vector3().setFromMatrixScale(matrix).x * globe.getStats().zoom, .029, 1e-8);
    near(pulse.scale.x * globe.getStats().zoom, 1);assert.equal(grid.visible, false);
    tools[0].dispatch('click');
  }
  assert.equal(globe.getStats().zoom, GALLERY_GLOBE_MAX_ZOOM);
  canvas.dispatch('keydown', {key: 'Home'});fixture.tick(250);assert.equal(globe.getStats().zoom, 1);
  const {scene} = globeFixtureRenderers.at(-1);let grid;scene.traverse(node => {if(node.isLineSegments)grid=node;});assert.equal(grid.visible,true);
  globe.dispose();
});

test('larger responsive viewports preserve active geography, cluster clipping and manual zoom bounds', () => {
  const fixture = globeDocument(), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const tools = fixture.descendants().filter(element => element.classList.contains('gallery-room-globe-tool'));
  for (const size of [336, 280, 220, 188, 168, 144, 112, 180]) {
    fixture.setSize(size);globe.resize();assertProjectCentered(globe, projects[0].slug, size);
    assert.equal(globe.getStats().width, size);assert.equal(globe.getStats().height, size);
    const visible = globe.getMarkerPositions().filter(marker => marker.visible).map(marker => marker.slug).sort();
    assert.deepEqual(globe.getClusters().flatMap(cluster => cluster.members.map(marker => marker.slug)).sort(), visible);
    for (const cluster of globe.getClusters()) assert.ok(Math.hypot(cluster.x - size / 2, cluster.y - size / 2) <= size / 2 - 15 + 1e-8);
  }
  for (let step = 0; step < 12; step++) tools[0].dispatch('click');
  near(globe.getStats().zoom, GALLERY_GLOBE_MAX_ZOOM);assert.equal(globe.getStats().width, 180);
  tools[2].dispatch('click');near(globe.getStats().zoom, 1);assert.equal(globe.getStats().width, 180);
  globe.dispose();
});

test('initial selection and immediate route retarget fly into real project geography in a fixed viewport', () => {
  const fixture = globeDocument(188, {reducedMotion: false});
  const selections = [], globe = createFixtureGlobe({container: fixture.container, achievements: projects,
    onSelect: slug => selections.push(slug)});
  assert.equal(globe.getStats().zoom, 1);assert.equal(globe.getStats().flying, true);
  const route = projects.find(project => project.country === 'Japan');
  globe.setActive(route.slug); // The room resolves a deep link immediately after globe creation.
  fixture.tick(0);fixture.tick(700);
  assert.equal(globe.getStats().activeSlug, route.slug);assert.equal(globe.getStats().flying, true);
  assert.ok(globe.getStats().zoom < GALLERY_GLOBE_PROJECT_ZOOM);
  fixture.tick(2000);assertProjectCentered(globe, route.slug, 188);
  assert.equal(globe.getStats().width, 188);assert.equal(globe.getStats().height, 188);
  assert.deepEqual(selections, [], 'geographic flights never navigate the room');
  globe.dispose();assert.equal(fixture.pending.size, 0);
});

test('distant achievements pull out, rotate north-up on the short path, then settle at regional zoom', () => {
  const fixture = globeDocument(), motion = fixture.window.matchMedia();
  const globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const from = globe.getStats();motion.matches = false;motion.dispatch('change');
  const destination = projects.find(project => project.country === 'Japan');
  globe.setActive(destination.slug);
  near(globe.getStats().zoom, GALLERY_GLOBE_PROJECT_ZOOM);
  fixture.tick(200);const pullout = globe.getStats();
  assert.ok(pullout.zoom < GALLERY_GLOBE_PROJECT_ZOOM && pullout.zoom > 1);
  fixture.tick(700);const cruise = globe.getStats();
  assert.ok(cruise.zoom <= 1.2, 'distant rotation reveals the Earth before crossing continents');
  assert.ok(Math.abs(cruise.yaw - from.yaw) > .1);
  globe.resize();near(globe.getStats().zoom, cruise.zoom);
  fixture.tick(1400);assert.ok(globe.getStats().zoom > cruise.zoom, 'the destination eases back into view');
  fixture.tick(2000);assertProjectCentered(globe, destination.slug);
  const rotation = galleryGlobeRotation(destination.coordinates.lat, destination.coordinates.lng);
  near(globe.getStats().pitch, rotation.pitch);
  near(globe.getStats().yaw, galleryGlobeYawTarget(from.yaw, rotation.yaw));
  assert.equal(globe.getStats().width, 336);assert.equal(globe.getStats().height, 336);
  globe.dispose();
});

test('nearby, identical and seam-crossing project locations avoid a gratuitous world-view flight', () => {
  const fixture = globeDocument(), motion = fixture.window.matchMedia();
  const globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const nearby = projects.find(project => project.slug === 'pdm-kill-the-search-bar-2026');
  motion.matches = false;motion.dispatch('change');globe.setActive(nearby.slug);
  fixture.tick(300);near(globe.getStats().zoom, GALLERY_GLOBE_PROJECT_ZOOM);
  fixture.tick(1000);assertProjectCentered(globe, nearby.slug);
  motion.matches = true;motion.dispatch('change');globe.setActive('solana-ideathon-2024');
  const same = globe.getStats();motion.matches = false;motion.dispatch('change');
  globe.setActive('mdsi-bundesliga-2024');fixture.tick(1200);
  near(globe.getStats().pitch, same.pitch);near(globe.getStats().yaw, same.yaw);
  near(globe.getStats().zoom, same.zoom);
  fixture.tick(1600);assertProjectCentered(globe, 'mdsi-bundesliga-2024');globe.dispose();

  const seamFixture = globeDocument(), seamMotion = seamFixture.window.matchMedia();
  const seamProjects = [179, -179].map((lng, index) => ({...projects[0], slug: `seam-${index}`, coordinates: {lat: 0, lng}}));
  const seam = createFixtureGlobe({container: seamFixture.container, achievements: seamProjects});
  const startYaw = seam.getStats().yaw;
  seamMotion.matches = false;seamMotion.dispatch('change');seam.setActive('seam-1');
  seamFixture.tick(350);assert.ok(seam.getStats().zoom < GALLERY_GLOBE_PROJECT_ZOOM,
    'a two-degree move at city scale briefly reveals regional context');
  seamFixture.tick(1400);assertProjectCentered(seam, 'seam-1');
  near(seam.getStats().yaw - startYaw, -2 * Math.PI / 180);seam.dispose();
});

test('rapid project changes sample the live geographic flight instead of jumping back to its last frame', () => {
  const fixtures = [globeDocument(), globeDocument()];
  const globes = fixtures.map(fixture => createFixtureGlobe({container: fixture.container, achievements: projects}));
  const destination = projects.find(project => project.country === 'Japan');
  for (let index = 0; index < 2; index++) {
    const motion = fixtures[index].window.matchMedia();motion.matches = false;motion.dispatch('change');
    globes[index].setActive(destination.slug);fixtures[index].tick(400);
  }
  fixtures[0].advanceTime(480);fixtures[1].tick(480);
  globes[0].setActive(projects[1].slug);
  for (const key of ['pitch', 'yaw', 'zoom']) near(globes[0].getStats()[key], globes[1].getStats()[key]);
  for (const project of projects.slice(2, 8)) {
    const before = globes[0].getStats();globes[0].setActive(project.slug);
    for (const key of ['pitch', 'yaw', 'zoom']) near(globes[0].getStats()[key], before[key]);
  }
  fixtures[0].tick(2600);assertProjectCentered(globes[0], projects[7].slug);
  globes.forEach(globe => globe.dispose());fixtures.forEach(fixture => assert.equal(fixture.pending.size, 0));
});

test('selection releases held drags, duplicate activation preserves manual view, and explicit reselect recenters', () => {
  const fixture = globeDocument(), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const canvas = fixture.descendants().find(element => element.classList.contains('gallery-room-globe-canvas'));
  canvas.dispatch('pointerdown', {isPrimary: true, button: 0, pointerId: 7, clientX: 126, clientY: 126});
  canvas.dispatch('pointermove', {pointerId: 7, clientX: 180, clientY: 140});
  assert.equal(globe.getStats().dragging, true);assert.equal(canvas.hasPointerCapture(7), true);
  globe.setActive(projects[1].slug);
  assert.equal(globe.getStats().dragging, false);assert.equal(canvas.hasPointerCapture(7), false);
  assertProjectCentered(globe, projects[1].slug);
  canvas.dispatch('pointermove', {pointerId: 7, clientX: 220, clientY: 160});
  assertProjectCentered(globe, projects[1].slug);
  canvas.dispatch('keydown', {key: 'Home'});near(globe.getStats().zoom, 1);
  globe.setActive(projects[1].slug);near(globe.getStats().zoom, 1, 1e-12);
  globe.setActive(projects[1].slug, {recenter: true});assertProjectCentered(globe, projects[1].slug);
  globe.dispose();
});

test('reduced motion immediately settles every real project and a preference change finishes the wide phase', () => {
  const fixture = globeDocument(), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  for (const project of projects) {globe.setActive(project.slug);assertProjectCentered(globe, project.slug);}
  const motion = fixture.window.matchMedia();motion.matches = false;motion.dispatch('change');
  const destination = projects.find(project => project.country === 'Japan');
  globe.setActive(destination.slug);fixture.tick(500);
  assert.ok(globe.getStats().zoom < GALLERY_GLOBE_PROJECT_ZOOM);
  motion.matches = true;motion.dispatch('change');assertProjectCentered(globe, destination.slug);
  globe.dispose();
});

test('hidden and lost-context flights can retarget safely and disposal prevents later animation', () => {
  const fixture = globeDocument(), globe = createFixtureGlobe({container: fixture.container, achievements: projects});
  const motion = fixture.window.matchMedia();motion.matches = false;motion.dispatch('change');
  const canvas = fixture.descendants().find(element => element.classList.contains('gallery-room-globe-canvas'));
  globe.setActive(projects[1].slug);fixture.tick(350);
  fixture.document.hidden = true;fixture.document.dispatch('visibilitychange');
  fixture.advanceTime(500);globe.setActive(projects[11].slug);assert.equal(fixture.pending.size, 0);
  fixture.advanceTime(2500);fixture.document.hidden = false;fixture.document.dispatch('visibilitychange');
  fixture.tick(2500);assertProjectCentered(globe, projects[11].slug);
  globe.setActive(projects[0].slug);fixture.tick(2800);
  canvas.dispatch('webglcontextlost');fixture.advanceTime(3000);globe.setActive(projects[3].slug);
  assert.equal(fixture.pending.size, 0);assert.equal(globe.getStats().webgl, false);
  fixture.advanceTime(5000);canvas.dispatch('webglcontextrestored');fixture.tick(5000);
  assertProjectCentered(globe, projects[3].slug);assert.equal(globe.getStats().webgl, true);
  globe.setActive(projects[1].slug);assert.equal(globe.getStats().flying, true);
  globe.dispose();assert.equal(fixture.pending.size, 0);assert.equal(globe.getStats().flying, false);
  globe.setActive(projects[0].slug);fixture.tick(7000);assert.equal(fixture.pending.size, 0);
});
