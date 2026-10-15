import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {overviewCameraPlan, roomWalkingVector} from '../src/galleryRoomCamera.js';
import {createGalleryRoomScene} from '../src/galleryRoomScene.js';
import {renderGalleryRoomDom} from '../src/galleryRoomDomView.js';
import {sortAchievementsNewestFirst} from '../src/chronology.js';
import {createRoomJumpState,stepRoomJump} from '../src/galleryRoomJump.js';

const source = await readFile(new URL('../src/galleryRoom.js', import.meta.url), 'utf8');
const renderSource = source.slice(source.indexOf('  function render(time)'), source.indexOf('  function dispose()'));
assert.ok(renderSource.includes('function render(time)'), 'test exercises the current integrated render function');
const projects = sortAchievementsNewestFirst(JSON.parse(await readFile(
  new URL('../src/data/achievements.json', import.meta.url), 'utf8')));
const physicalRoom = createGalleryRoomScene({scene: new THREE.Scene(), projects});
const station = physicalRoom.stations.get(projects[0].slug);

function fixture(width, height, heldKeys = []) {
  physicalRoom.resize({width,height});
  const plan = overviewCameraPlan(station, {width, height}, 50);
  const camera = new THREE.PerspectiveCamera(50, width / height, .08, 170);
  camera.position.fromArray(plan.position);
  const lookTarget = new THREE.Vector3(...plan.target);
  camera.lookAt(lookTarget);
  let webglDraws = 0, cssDraws = 0, scheduled = 0;
  const context = vm.createContext({
    THREE, overviewCameraPlan, roomWalkingVector,
    document: {hidden: false}, active: true, viewLocked: false, disposed: false, raf: 0, lastTime: 1000 - 1000 / 60,
    animation: null, frameCount: 2, needsRender: false, keys: new Set(heldKeys), tapKeys:new Set(),
    jumpState:createRoomJumpState(),jumpQueued:false,stepRoomJump,adoptWalkStation(){},
    camera, lookTarget, currentStation: () => station, viewport: () => ({width, height}),
    slug: station.slug, root: {dataset: {}, classList: {add() {}}},
    room: {walkBounds:physicalRoom.walkBounds,update() {}}, cssRenderer: {render() {cssDraws++;}}, cssScene: new THREE.Scene(), scene: {},
    cssCamera: new THREE.PerspectiveCamera(), renderGalleryRoomDom,
    renderer: {render() {webglDraws++;}, info: {render: {calls: 20, triangles: 10_000}}},
    requestAnimationFrame: () => ++scheduled,
    dispatchEvent() {}, Event
  });
  new vm.Script(renderSource).runInContext(context);
  return {context, plan, get draws() {return {webglDraws, cssDraws, scheduled};}};
}

test('S from a fitted Room view moves backward at portrait, threshold and desktop sizes', () => {
  for (const [width, height] of [[390, 844], [701, 900], [568, 320], [1280, 900]]) {
    const f = fixture(width, height, ['s']);
    const before = f.context.camera.position.clone();
    f.context.render(1000);
    const delta = f.context.camera.position.clone().sub(before);
    assert.ok(delta.z > 0 && delta.length() < .09,
      `${width}×${height} should move backward by one frame, delta=${delta.toArray()}`);
    assert.equal(f.draws.webglDraws, 1);
  }
});

test('walking remains inside the complete corridor without snapping an overview pose', () => {
  const f = fixture(1280, 900, ['d']);
  const limit = physicalRoom.walkBounds.max[0] - .4;
  f.context.camera.position.x = limit - .01;
  f.context.render(1000);
  assert.equal(f.context.camera.position.x, limit);
  assert.ok(f.context.camera.position.z >= 1.15);
  assert.ok(f.context.camera.position.z <= Math.max(station.bounds.max[2], f.plan.position[2] + 2));
});

test('a key released between animation frames still moves once and never drifts afterward',()=>{
  const f=fixture(1280,900);
  const before=f.context.camera.position.clone();
  f.context.tapKeys.add('w');
  f.context.render(1000);
  const delta=f.context.camera.position.clone().sub(before);
  assert.ok(delta.z<0&&delta.length()>.08&&delta.length()<.09);
  assert.equal(f.context.tapKeys.size,0);
  assert.equal(f.context.keys.size,0);
  const after=f.context.camera.position.clone();
  f.context.render(1016.7);
  assert.deepEqual(f.context.camera.position.toArray(),after.toArray());
});

test('the locked render path blocks stale held and tapped movement while allowing the vertical jump',()=>{
  const f=fixture(1280,900,['w','d']),before=f.context.camera.position.clone();
  const sight=f.context.lookTarget.clone().sub(before);
  f.context.viewLocked=true;f.context.tapKeys.add('s');f.context.jumpQueued=true;
  f.context.render(1000);
  assert.equal(f.context.camera.position.x,before.x);assert.equal(f.context.camera.position.z,before.z);
  assert.ok(f.context.camera.position.y>before.y,'Space retains its independent vertical motion');
  assert.ok(f.context.lookTarget.clone().sub(f.context.camera.position).distanceTo(sight)<1e-10);
  assert.equal(f.context.jumpState.grounded,false);assert.equal(f.context.jumpQueued,false);
});

test('idle room keeps its lightweight scheduler but performs no repeated GPU or CSS3D draws', () => {
  const f = fixture(1280, 900);
  f.context.render(1000); f.context.render(1016.7);
  assert.deepEqual(f.draws, {webglDraws: 0, cssDraws: 0, scheduled: 2});
  f.context.needsRender = true;
  f.context.render(1033.4);
  assert.equal(f.draws.webglDraws, 1);
  assert.equal(f.draws.cssDraws, 1);
  f.context.document.hidden = true;
  f.context.render(1050.1);
  assert.equal(f.draws.scheduled, 3, 'hidden document does not schedule another frame');
});

test.after(() => physicalRoom.dispose());
