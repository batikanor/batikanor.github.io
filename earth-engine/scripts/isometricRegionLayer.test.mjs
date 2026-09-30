import assert from 'node:assert/strict';
import {readFileSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {test} from 'node:test';
import * as THREE from 'three';
import {
  chooseIsometricRegion,
  chooseRoofAtlasVersion,
  createIsometricRegionLayer,
  fetchChapterAsset,
  parseBld2,
  roofUvForAtlas,
  validateGroundImageMetadata,
  validateReducedAtlas,
} from '../src/isometricRegionLayer.js';

const data = new URL('../public/data/', import.meta.url);
const fixtureBytes = readFileSync(new URL('garching-lod2-v1.bin', data));
const fixture = fixtureBytes.buffer.slice(
  fixtureBytes.byteOffset, fixtureBytes.byteOffset + fixtureBytes.byteLength,
);
const atlas = JSON.parse(readFileSync(new URL('garching-roof-orthophoto-v1.json', data), 'utf8'));
const origin = [11.666954, 48.262269];

test('chapter asset loader retries a dropped connection but not a missing asset', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) throw new TypeError('temporary network failure');
      return new Response(new Uint8Array([1, 2, 3]));
    };
    const asset = await fetchChapterAsset('/chapter.bin', {
      signal: new AbortController().signal, maxBytes: 10, kind: 'arrayBuffer',
    });
    assert.equal(attempts, 2);
    assert.deepEqual([...new Uint8Array(asset)], [1, 2, 3]);
    attempts = 0;
    globalThis.fetch = async () => { attempts++; return new Response(null, {status: 404}); };
    await assert.rejects(fetchChapterAsset('/missing.bin', {
      signal: new AbortController().signal, maxBytes: 10,
    }), /HTTP 404/);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('chapter asset loader rejects oversized responses without retrying', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async () => { attempts++; return new Response(new Uint8Array(11)); };
    await assert.rejects(fetchChapterAsset('/oversized.bin', {
      signal: new AbortController().signal, maxBytes: 10, kind: 'arrayBuffer',
    }), /budget/);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('BLD2 decoder accepts an actual official LoD2 clip and keeps exact source vertices', () => {
  const result = parseBld2(fixture, origin);
  assert.equal(result.roofCount, 22137);
  assert.equal(result.wallCount, 41046);
  assert.deepEqual(result.origin, origin);
  assert.equal(result.positions.length, (result.roofCount + result.wallCount) * 3);
});

test('BLD2 decoder rejects a mismatched geodetic origin and corrupt payload', () => {
  assert.throws(() => parseBld2(fixture, [11.576, 48.137]), /origin/);
  assert.throws(() => parseBld2(fixture.slice(0, -4), origin), /Truncated/);
});

test('real roof vertices project inside their official Web-Mercator orthophoto atlas', () => {
  const {positions, roofCount} = parseBld2(fixture, origin);
  const uv = roofUvForAtlas(positions.subarray(0, roofCount * 3), origin, atlas);
  assert.equal(uv.length, roofCount * 2);
  assert.ok(uv.every(value => value >= 0 && value <= 1));
  assert.throws(() => roofUvForAtlas(positions.subarray(0, roofCount * 3), origin,
    {...atlas, origin_lonlat: [11.7, 48.2]}), /origin/);
});

for (const chapter of ['siemens', 'google']) {
  test(`${chapter} local Munich chapter and DOP20 atlas align without fabricated geometry`, () => {
    const bytes = readFileSync(new URL(`munich-${chapter}-lod2-v1.bin`, data));
    const metadata = JSON.parse(readFileSync(new URL(`munich-${chapter}-lod2-v1.json`, data), 'utf8'));
    const roofAtlas = JSON.parse(readFileSync(new URL(`munich-${chapter}-roof-dop20-v1.json`, data), 'utf8'));
    const mesh = parseBld2(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), metadata.origin);
    const uv = roofUvForAtlas(mesh.positions.subarray(0, mesh.roofCount * 3), metadata.origin, roofAtlas);
    assert.equal(mesh.roofCount / 3, metadata.roof_triangles);
    assert.equal(mesh.wallCount / 3, metadata.wall_triangles);
    assert.equal(uv.length, mesh.roofCount * 2);
    assert.match(metadata.credit, /Bayerische Vermessungsverwaltung/);
    assert.match(roofAtlas.credit, /Bayerische Vermessungsverwaltung/);
  });
}

test('Berlin State Library LoD2 and TrueDOP roof atlas align in the shared BLD2 pipeline', () => {
  const bytes = readFileSync(new URL('berlin-library-lod2-v1.bin', data));
  const metadata = JSON.parse(readFileSync(new URL('berlin-library-lod2-v1.json', data), 'utf8'));
  const roofAtlas = JSON.parse(readFileSync(new URL('berlin-library-roof-truedop20-v1.json', data), 'utf8'));
  const mesh = parseBld2(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), metadata.origin);
  const uv = roofUvForAtlas(mesh.positions.subarray(0, mesh.roofCount * 3), metadata.origin, roofAtlas);
  assert.equal((mesh.roofCount + mesh.wallCount) / 3, 10438);
  assert.equal(uv.length, mesh.roofCount * 2);
  assert.match(metadata.credit, /Geoportal Berlin/);
  assert.match(roofAtlas.credit, /Geoportal Berlin/);
});

for (const stem of [
  'munich-siemens-roof-dop20-v1',
  'munich-google-roof-dop20-v1',
  'berlin-library-roof-truedop20-v1',
]) {
  test(`${stem} has a verified half-resolution atlas for low-memory devices`, () => {
    const full = JSON.parse(readFileSync(new URL(`${stem}.json`, data), 'utf8'));
    const reduced = JSON.parse(readFileSync(new URL(`${stem}-half.json`, data), 'utf8'));
    assert.equal(validateReducedAtlas(full, reduced), reduced);
    const bytes = readFileSync(new URL(reduced.asset, data));
    assert.equal(bytes.length, reduced.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), reduced.sha256);
    assert.equal(statSync(new URL(full.asset, data)).size, full.bytes);
    assert.ok(reduced.bytes < full.bytes / 2, 'Reduced transfer should save at least 50%');
    assert.equal(chooseRoofAtlasVersion(full, reduced,
      {maxTextureSize: 4096, lowMemory: false}), full);
    assert.equal(chooseRoofAtlasVersion(full, reduced,
      {maxTextureSize: 4096, lowMemory: true}), reduced);
    assert.equal(chooseRoofAtlasVersion(full, reduced,
      {maxTextureSize: 1024, lowMemory: true}), null);
    assert.throws(() => validateReducedAtlas(full, {...reduced, source_asset_sha256: 'wrong'}),
      /does not match/);
  });
}

test('chapter selection is zoom/distance constrained and focusable', () => {
  const regions = [
    {id: 'munich', origin: [11.5758, 48.1453], radiusM: 250, minZoom: 15.5, maxZoom: 20.25},
    {id: 'berlin', origin: [13.3708, 52.5074], radiusM: 250, minZoom: 15.5, maxZoom: 20.25},
  ];
  assert.equal(chooseIsometricRegion(regions, {center: [11.5758, 48.1453], zoom: 17})?.id, 'munich');
  assert.equal(chooseIsometricRegion(regions, {center: [11.5758, 48.1453], zoom: 15}), null);
  assert.equal(chooseIsometricRegion(regions, {center: [11.5758, 48.1453], zoom: 21}), null);
  assert.equal(chooseIsometricRegion(regions, {center: [11.5758, 48.1453], zoom: 17}, 'berlin'), null);
  assert.equal(chooseIsometricRegion(regions, {center: [11.6, 48.2], zoom: 17}), null);
});

test('factory rejects duplicate or imaginary region descriptors before GL allocation', () => {
  const valid = {id: 'munich', origin: [11.5758, 48.1453], radiusM: 250, meshUrl: '/data/munich.bin'};
  assert.throws(() => createIsometricRegionLayer({regions: [valid, valid]}), /Duplicate/);
  assert.throws(() => createIsometricRegionLayer({regions: [{...valid, radiusM: 20000}]}), /radius/);
  const layer = createIsometricRegionLayer({regions: [valid]});
  assert.equal(layer.getEnabled(), true);
  layer.setEnabled(false);
  assert.equal(layer.getEnabled(), false);
  layer.setEnabled(true);
  layer.setFocus('munich');
  assert.throws(() => layer.setFocus('not-a-real-chapter'), /Unknown/);
});

test('speculative prefetch is deduplicated, compressed-only and disabled with city detail', async () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (typeof navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', {configurable: true, value: {}});
  }
  const originalConnection = Object.getOwnPropertyDescriptor(navigator, 'connection');
  const region = {id: 'nearby', origin: [11.5758, 48.1453], radiusM: 250,
    meshUrl: '/data/nearby.bin'};
  const layer = createIsometricRegionLayer({regions: [region]});
  const requests = [];
  try {
    globalThis.fetch = async (url, {signal}) => {
      requests.push({url, signal});
      return new Response(new Uint8Array([1, 2, 3]));
    };
    assert.equal(layer.prefetch('nearby'), false, 'map must exist first');
    layer.map = {triggerRepaint() {}};
    layer.destroyed = false;
    layer.maxTextureSize = 4096;
    assert.equal(layer.prefetch('missing'), false);
    Object.defineProperty(navigator, 'connection', {
      configurable: true, value: {saveData: true, effectiveType: '4g'},
    });
    assert.equal(layer.prefetch('nearby'), false, 'respect save-data before a request starts');
    delete navigator.connection;
    assert.equal(layer.prefetch('nearby'), true);
    assert.equal(layer.prefetch('nearby'), true);
    assert.equal(requests.length, 1, 'one compressed transfer, no mesh decode or GPU allocation');
    layer.setEnabled(false);
    assert.equal(layer.prefetch('nearby'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConnection) Object.defineProperty(navigator, 'connection', originalConnection);
    else delete navigator.connection;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});

test('transient mesh recovery is bounded and cancelled when detail is disabled', async () => {
  const region = {id: 'nearby', origin: [11.5758, 48.1453], radiusM: 250,
    meshUrl: '/data/nearby.bin'};
  const layer = createIsometricRegionLayer({regions: [region], recoveryDelayMs: 0});
  layer.map = {triggerRepaint() {}};
  layer.destroyed = false;
  let evaluations = 0;
  layer.evaluate = () => { evaluations++; };
  layer.scheduleRecovery(region, {retryable: false});
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(evaluations, 0, 'missing/invalid assets are not retried');
  layer.scheduleRecovery(region, {retryable: true});
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(evaluations, 1);
  layer.scheduleRecovery(region, {retryable: true});
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(evaluations, 1, 'one delayed recovery maximum');
  const second = createIsometricRegionLayer({regions: [region], recoveryDelayMs: 0});
  second.map = {triggerRepaint() {}};
  second.destroyed = false;
  second.evaluate = () => { evaluations++; };
  second.scheduleRecovery(region, new TypeError('network interrupted'));
  second.setEnabled(false);
  await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(evaluations, 1, 'detail toggle cancels recovery');
});

test('local ground imagery must be bounded, local and mobile-sized', () => {
  const region = {origin: [14.3315, 51.7734]};
  const metadata = {
    origin_lonlat: region.origin, width: 1536, height: 1536, bytes: 500000,
    coordinates: [
      [14.327, 51.777], [14.336, 51.777],
      [14.336, 51.770], [14.327, 51.770],
    ],
  };
  assert.equal(validateGroundImageMetadata(metadata, region), metadata);
  assert.throws(() => validateGroundImageMetadata({...metadata, width: 4096}, region), /texture budget/);
  assert.throws(() => validateGroundImageMetadata({...metadata, bytes: 8_000_000}, region), /transfer budget/);
  assert.throws(() => validateGroundImageMetadata({...metadata, coordinates: [[0, 0], ...metadata.coordinates.slice(1)]}, region), /corners/);
  assert.throws(() => validateGroundImageMetadata({...metadata, coordinates: [
    metadata.coordinates[0], metadata.coordinates[2], metadata.coordinates[1], metadata.coordinates[3],
  ]}, region), /corners/);
  assert.throws(() => validateGroundImageMetadata({...metadata, origin_lonlat: [14.326, 51.767]}, region), /origin/);
});

function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function atlasPayload(){return {metadata:atlas,chosen:atlas,imageBlob:new Blob(['source-photo'],{type:'image/webp'}),memoryConstrained:false};}
function officialFixture({withPhoto=true,textureLoader=null,onChange=null,id='quality-chapter'}={}) {
  const region={id,origin,radiusM:250,minZoom:15.5,maxZoom:20.25,meshUrl:'/data/actual.bin',
    ...(withPhoto?{roofAtlas:{metadataUrl:'/data/actual-photo.json',imageUrl:'/data/actual-photo.webp'}}:{})};
  const map={repaints:0,getCenter:()=>({lng:origin[0],lat:origin[1]}),getZoom:()=>17,
    isMoving:()=>false,triggerRepaint(){this.repaints++;},getLayer:()=>null,getSource:()=>null};
  const renderer={renders:0,resets:0,capabilities:{getMaxAnisotropy:()=>8},
    resetState(){this.resets++;},render(){this.renders++;}};
  const load=textureLoader??(async()=>new THREE.Texture({width:atlas.width,height:atlas.height,src:'decoded-source-photo'}));
  const layer=createIsometricRegionLayer({regions:[region],onChange,textureLoader:load});
  layer.map=map;layer.renderer=renderer;layer.scene=new THREE.Scene();layer.camera=new THREE.Camera();
  layer.destroyed=false;layer.maxTextureSize=4096;
  const active={region,model:new THREE.Matrix4(),meshes:null,texture:null,buffer:null,groundObjectUrl:null,
    atlasState:withPhoto?'pending':'not-required'};layer.active=active;
  const photo=deferred();
  const prepared={meshPromise:Promise.resolve(fixture),atlasPromise:photo.promise,abort:new AbortController()};
  return {layer,active,prepared,photo,map,renderer};
}
const projectionArgs={defaultProjectionData:{mainMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],projectionTransition:0}};

test('official photo chapters never render opaque gray roofs or walls while the atlas is pending',async()=>{
  const changes=[],fx=officialFixture({onChange:event=>changes.push(event)});
  await fx.layer.loadRegion(fx.active,fx.prepared);
  assert.equal(fx.layer.getStats().geometryLoaded,true);assert.equal(fx.layer.getStats().qualityReady,false);
  assert.equal(fx.layer.getStats().atlasState,'pending');assert.equal(fx.layer.hasTexturedContext(),false);
  assert.equal(fx.layer.hasRenderableContext(),false);
  assert.ok(fx.active.meshes.every(mesh=>mesh.visible===false));
  assert.equal(fx.layer.scene.children.filter(object=>object.isMesh).length,0,'ground photograph remains unobscured');
  fx.layer.render({},projectionArgs);assert.equal(fx.renderer.renders,0);
  assert.equal(changes.at(-1).loaded,false);assert.equal(changes.at(-1).geometryLoaded,true);
  fx.photo.resolve(null);await fx.active.roofTask;
  assert.equal(fx.layer.getStats().atlasState,'unavailable');assert.equal(fx.layer.hasRenderableContext(),false);
  fx.layer.releaseActive();
});

test('accepted official roof photography atomically reveals the surveyed meshes and signals quality readiness',async()=>{
  const changes=[],fx=officialFixture({onChange:event=>changes.push(event)});
  await fx.layer.loadRegion(fx.active,fx.prepared);fx.photo.resolve(atlasPayload());await fx.active.roofTask;
  assert.equal(fx.layer.hasTexturedContext(),true);assert.equal(fx.layer.hasRenderableContext(),true);
  assert.equal(fx.layer.hasTexturedContext('quality-chapter'),true);assert.equal(fx.layer.hasTexturedContext('elsewhere'),false);
  assert.equal(fx.layer.getStats().atlasState,'ready');assert.equal(fx.layer.getStats().activeRoofTextures,1);
  assert.equal(fx.layer.scene.children.filter(object=>object.isMesh).length,2);
  assert.ok(fx.active.meshes.every(mesh=>mesh.visible));
  const roof=fx.active.meshes[0];assert.equal(roof.material.map,fx.active.texture);
  assert.equal(roof.material.color.getHex(),0xffffff);assert.equal(roof.material.toneMapped,false,'source photo is not darkened by custom lighting');
  assert.equal(roof.geometry.getAttribute('uv').count,roof.geometry.getAttribute('position').count);
  assert.equal(changes.at(-1).loaded,true);assert.equal(changes.at(-1).qualityReady,true);assert.equal(changes.at(-1).textured,true);
  fx.layer.render({},projectionArgs);assert.equal(fx.renderer.renders,1);
  const texture=fx.active.texture,image=texture.image;let textureDisposals=0;
  texture.addEventListener('dispose',()=>textureDisposals++);fx.layer.releaseActive();
  assert.equal(textureDisposals,1);assert.equal(texture.image,null);assert.equal(image.src,'');
  assert.equal(fx.layer.hasTexturedContext(),false);assert.equal(fx.layer.getStats().activeRoofTextures,0);
  assert.equal(changes.at(-1).qualityReady,false);
});

test('failed or invalid roof photography never reveals plain gray official massing',async()=>{
  const originalWarn=console.warn;console.warn=()=>{};
  try {
    const transport=officialFixture();await transport.layer.loadRegion(transport.active,transport.prepared);
    transport.photo.reject(new TypeError('photo unavailable'));await transport.active.roofTask;
    assert.equal(transport.layer.getStats().atlasState,'error');assert.equal(transport.layer.hasRenderableContext(),false);
    assert.equal(transport.layer.scene.children.filter(object=>object.isMesh).length,0);transport.layer.releaseActive();
    let disposed=0;const badTexture=new THREE.Texture({width:17,height:19,src:'invalid-photo'});
    badTexture.addEventListener('dispose',()=>disposed++);
    const malformed=officialFixture({textureLoader:async()=>badTexture});
    await malformed.layer.loadRegion(malformed.active,malformed.prepared);malformed.photo.resolve(atlasPayload());await malformed.active.roofTask;
    assert.equal(malformed.layer.getStats().atlasState,'error');assert.equal(malformed.layer.getStats().activeRoofTextures,0);
    assert.ok(malformed.active.meshes.every(mesh=>!mesh.visible));assert.equal(disposed,1);assert.equal(badTexture.image,null);
    malformed.layer.releaseActive();
  } finally {console.warn=originalWarn;}
});

test('author-authenticated geometry-only chapters remain supported without falsely claiming photographic detail',async()=>{
  const fx=officialFixture({withPhoto:false});await fx.layer.loadRegion(fx.active,fx.prepared);
  assert.equal(fx.layer.getStats().atlasState,'not-required');assert.equal(fx.layer.hasRenderableContext(),true);
  assert.equal(fx.layer.hasTexturedContext(),false);assert.equal(fx.layer.getStats().activeRoofTextures,0);
  assert.equal(fx.layer.scene.children.filter(object=>object.isMesh).length,2);
  fx.layer.render({},projectionArgs);assert.equal(fx.renderer.renders,1);fx.layer.releaseActive();
});

test('late atlas decode after departure is disposed and cannot reveal or retain a previous city',async()=>{
  const decoder=deferred();let starts=0,disposals=0;
  const fx=officialFixture({textureLoader:()=>{starts++;return decoder.promise;}});
  await fx.layer.loadRegion(fx.active,fx.prepared);fx.photo.resolve(atlasPayload());
  await new Promise(resolve=>setTimeout(resolve,0));assert.equal(starts,1);assert.equal(fx.layer.getStats().atlasDecoding,1);
  const task=fx.active.roofTask;fx.layer.releaseActive();
  const late=new THREE.Texture({width:atlas.width,height:atlas.height,src:'late-photo'});
  late.addEventListener('dispose',()=>disposals++);decoder.resolve(late);await task;
  assert.equal(disposals,1);assert.equal(late.image,null);assert.equal(fx.layer.scene.children.length,0);
  assert.equal(fx.layer.getStats().activeRoofTextures,0);assert.equal(fx.layer.getStats().atlasDecoding,0);
  assert.equal(fx.layer.getStats().regionId,null);
});

test('rapid official navigation serializes non-abortable decodes and skips stale queued cities',async()=>{
  const firstDecode=deferred();let starts=0,running=0,maximum=0;
  const fx=officialFixture({textureLoader:async()=>{
    starts++;running++;maximum=Math.max(maximum,running);
    try {return starts===1?await firstDecode.promise:new THREE.Texture({width:atlas.width,height:atlas.height});}
    finally {running--;}
  }});
  await fx.layer.loadRegion(fx.active,fx.prepared);fx.photo.resolve(atlasPayload());
  await new Promise(resolve=>setTimeout(resolve,0));const firstTask=fx.active.roofTask;
  fx.layer.releaseActive();
  const createNext=id=>({region:{...fx.active.region,id},model:new THREE.Matrix4(),meshes:null,texture:null,buffer:null,groundObjectUrl:null,atlasState:'pending'});
  const second=createNext('queued-city'),third=createNext('current-city');
  fx.layer.active=second;await fx.layer.loadRegion(second,{...fx.prepared,atlasPromise:Promise.resolve(atlasPayload())});const secondTask=second.roofTask;
  fx.layer.releaseActive();fx.layer.active=third;
  await fx.layer.loadRegion(third,{...fx.prepared,atlasPromise:Promise.resolve(atlasPayload())});const thirdTask=third.roofTask;
  firstDecode.resolve(new THREE.Texture({width:atlas.width,height:atlas.height}));
  await Promise.all([firstTask,secondTask,thirdTask]);
  assert.equal(maximum,1);assert.equal(starts,2,'superseded queued city is not decoded');
  assert.equal(fx.layer.hasTexturedContext('current-city'),true);assert.equal(fx.layer.getStats().activeRoofTextures,1);
  assert.equal(fx.layer.scene.children.filter(object=>object.isMesh).length,2);fx.layer.releaseActive();
});
