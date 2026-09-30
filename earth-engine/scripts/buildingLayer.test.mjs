import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {
  createBavariaBuildingLayer, isBavariaContextCamera, bavariaRoofAtlasFitsBudget,
} from '../src/buildingLayer.js';

const mesh = await readFile(new URL('../public/data/garching-lod2-v1.bin', import.meta.url));
const atlas = await readFile(new URL('../public/data/garching-roof-orthophoto-v1.webp', import.meta.url));
const metadata = JSON.parse(await readFile(new URL('../public/data/garching-roof-orthophoto-v1.json', import.meta.url)));
const origin = {lng:11.666954, lat:48.262269};
const turn = () => new Promise(resolve => setTimeout(resolve, 0));
async function until(predicate) {
  for (let tries = 0; tries < 100; tries++) {if (predicate()) return; await turn();}
  assert.fail('Timed out waiting for controlled layer state');
}
function setup(options = {}) {
  const calls = [];
  const handlers = new Map();
  let zoom = 2, center = {lng:12, lat:27}, moving = false;
  let disposed = false;
  let draws = 0;
  const map = {
    on(name, handler) {if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(handler);},
    off(name, handler) {handlers.get(name)?.delete(handler);},
    getCenter:() => center, getZoom:() => zoom, isMoving:() => moving,
    triggerRepaint() {}, getCanvas:() => ({}),
  };
  const renderer = {capabilities:{getMaxAnisotropy:() => 8}, resetState() {}, render() {draws++;},
    dispose() {disposed = true;}};
  const responses = async url => url.endsWith('.bin')
    ? new Response(mesh, {headers:{'content-type':'application/octet-stream'}})
    : url.endsWith('.json') ? new Response(JSON.stringify(metadata), {headers:{'content-type':'application/json'}})
      : new Response(atlas, {headers:{'content-type':'image/webp'}});
  const layer = createBavariaBuildingLayer({lowMemory:true, rendererFactory:() => renderer,
    fetcher:async (url, request) => {calls.push({url, request}); return options.fetcher ? options.fetcher(url, request) : responses(url);},
    ...options, ...(options.fetcher ? {fetcher:async (url, request) => {
      calls.push({url, request}); return options.fetcher(url, request, responses);
    }} : {}),
  });
  layer.onAdd(map, {MAX_TEXTURE_SIZE:0x0D33, getParameter:() => options.maxTextureSize ?? 4096});
  const emit = name => {for (const handler of handlers.get(name) ?? []) handler();};
  return {layer, calls, map, responses, handlers, disposed:() => disposed, draws:() => draws,
    render() {layer.render({}, {defaultProjectionData:{mainMatrix:new THREE.Matrix4().elements, projectionTransition:0}});},
    camera(nextZoom, nextCenter = origin, isMoving = false) {zoom = nextZoom; center = nextCenter; moving = isMoving; emit('move'); if (!moving) emit('moveend');},
  };
}

test('context covers only the actual settled neighbourhood zoom band', () => {
  assert.equal(isBavariaContextCamera({center:origin, zoom:16.4}), true);
  for (const zoom of [2,15.49,18.5,20.23,NaN]) assert.equal(isBavariaContextCamera({center:origin, zoom}), false);
  assert.equal(isBavariaContextCamera({center:{lng:14.3,lat:51.77},zoom:16.8}), false);
});

test('mobile and small GPUs do not allocate the 75 MiB full roof atlas', () => {
  assert.equal(bavariaRoofAtlasFitsBudget(metadata,{maxTextureSize:4096}), true);
  assert.equal(bavariaRoofAtlasFitsBudget(metadata,{maxTextureSize:4096,lowMemory:true}), false);
  assert.equal(bavariaRoofAtlasFitsBudget(metadata,{maxTextureSize:2048}), false);
  assert.equal(bavariaRoofAtlasFitsBudget({...metadata,bytes:4_000_000},{maxTextureSize:4096}), false);
});

test('loads only after moveend, uses cache-compatible fetch and releases GPU on departure', async () => {
  const state = setup();
  assert.equal(state.calls.length, 0);
  state.camera(16.4,origin,true);
  assert.equal(state.calls.length, 0);
  state.camera(16.4);
  await until(() => state.layer.getStats().geometryReady);
  assert.equal(state.calls.length, 1); // geometry only on a constrained phone
  assert.equal(state.calls[0].request.cache, 'force-cache');
  assert.equal(state.layer.getStats().meshBytes, mesh.length);
  assert.equal(state.layer.getLoaded(), false); // no photographic atlas accepted on this phone
  assert.equal(state.layer.getStats().textured, false);
  assert.ok(state.layer.meshes.every(mesh => mesh.visible === false));
  state.render();assert.equal(state.draws(), 0); // do not mask the source ground photograph
  let geometryDisposals = 0, materialDisposals = 0;
  for (const item of state.layer.meshes) {
    item.geometry.addEventListener('dispose', () => geometryDisposals++);
    item.material.addEventListener('dispose', () => materialDisposals++);
  }
  state.camera(20.23); // hidden hero closeup should not retain campus GPU data
  assert.equal(state.layer.getStats().meshBytes, 0);
  assert.equal(state.layer.getLoaded(), false);
  assert.equal(geometryDisposals, 2); assert.equal(materialDisposals, 2);
  state.camera(16.4);
  await until(() => state.layer.getStats().geometryReady);
  assert.equal(state.calls.length, 2); // SW/browser caches reuse the same URL
  state.layer.onRemove();
  assert.equal(state.disposed(), true);
  assert.equal(state.handlers.get('move').size, 0);
  assert.equal(state.handlers.get('moveend').size, 0);
});

test('city detail disable aborts pending transfer; ignored abort cannot install stale geometry', async () => {
  let finish;
  const state = setup({fetcher:() => new Promise(resolve => {finish = resolve;})});
  state.camera(16.4);
  assert.equal(state.layer.loading, true);
  state.layer.setEnabled(false);
  assert.equal(state.calls[0].request.signal.aborted, true);
  finish(new Response(mesh)); await turn(); await turn();
  assert.equal(state.layer.getLoaded(), false);
  assert.equal(state.layer.buffer, null);
  assert.equal(state.layer.meshes, null);
  state.layer.onRemove();
});

test('desktop atlas is disposed exactly once when camera leaves', async () => {
  const texture = new THREE.Texture({width:3840,height:3840});
  let disposals = 0;
  texture.addEventListener('dispose', () => disposals++);
  const state = setup({lowMemory:false,textureLoaderFactory:() => ({loadAsync:async () => texture})});
  state.camera(16.4);
  await until(() => state.layer.getStats().textured);
  assert.equal(state.calls.length, 3);
  assert.equal(state.layer.getStats().textureBytes, 78_643_200);
  assert.equal(state.layer.getLoaded(), true);
  assert.ok(state.layer.meshes.every(mesh => mesh.visible === true));
  state.render();assert.equal(state.draws(), 1);
  state.camera(16.8,{lng:14.3,lat:51.7});
  assert.equal(state.layer.getStats().textureBytes, 0);
  assert.equal(disposals, 1);
  state.layer.onRemove();
  assert.equal(disposals, 1);
});

test('late old atlas decode is discarded without resetting a new arrival loading state', async () => {
  const finishes = [];
  const state = setup({lowMemory:false, textureLoaderFactory:() => ({loadAsync:() => new Promise(resolve => finishes.push(resolve))})});
  state.camera(16.4); await until(() => finishes.length === 1);
  state.camera(2); state.camera(16.4); await until(() => finishes.length === 2);
  const oldTexture = new THREE.Texture({width:3840,height:3840});
  let discarded = 0; oldTexture.addEventListener('dispose', () => discarded++);
  finishes[0](oldTexture); await turn();
  assert.equal(discarded, 1);
  assert.equal(state.layer.textureLoading, true);
  assert.equal(state.layer.roofTexture, null);
  assert.equal(state.layer.getLoaded(), false);
  assert.ok(state.layer.meshes.every(mesh => mesh.visible === false));
  state.render();assert.equal(state.draws(), 0);
  finishes[1](new THREE.Texture({width:3840,height:3840}));
  await until(() => state.layer.getStats().textured);
  state.layer.onRemove();
});

test('HTTP errors leave satellite fallback usable and a later visit can retry', async () => {
  let first = true;
  const state = setup({fetcher:async (url, request, responses) => {
    if (first) {first = false; return new Response('temporary',{status:503});}
    return responses(url);
  }});
  state.camera(16.4); await until(() => state.layer.failed);
  assert.equal(state.layer.getLoaded(), false);
  state.camera(2); state.camera(16.4);
  await until(() => state.layer.getStats().geometryReady);
  state.layer.onRemove();
});

test('pending photographic atlas never draws gray source roofs or reports visual readiness', async () => {
  let finishDecode;
  const changes=[];
  const state=setup({lowMemory:false,onChange:stats=>changes.push(stats),
    textureLoaderFactory:()=>({loadAsync:()=>new Promise(resolve=>{finishDecode=resolve;})})});
  state.camera(16.4);await until(()=>typeof finishDecode==='function');
  assert.equal(state.layer.getStats().geometryReady,true);
  assert.equal(state.layer.getStats().textureLoading,true);
  assert.equal(state.layer.getLoaded(),false);
  assert.ok(changes.length>0 && changes.every(stats=>stats.loaded===false));
  assert.ok(state.layer.meshes.every(mesh=>mesh.visible===false));
  state.render();state.render();assert.equal(state.draws(),0);
  assert.equal(state.calls.length,3); // rendering never starts an additional source request
  finishDecode(new THREE.Texture({width:3840,height:3840}));
  await until(()=>state.layer.getLoaded());
  assert.ok(state.layer.meshes.every(mesh=>mesh.visible===true));
  assert.ok(changes.some(stats=>stats.loaded===true && stats.textured===true));
  state.render();assert.equal(state.draws(),1);
  state.layer.onRemove();
});

test('a small GPU leaves native ground photography unobstructed without downloading the unusable atlas', async () => {
  const state=setup({lowMemory:false,maxTextureSize:2048});
  state.camera(16.4);await until(()=>state.layer.getStats().geometryReady);
  assert.equal(state.calls.length,1);
  assert.equal(state.layer.getStats().textureLoading,false);
  assert.equal(state.layer.getStats().textureBytes,0);
  assert.equal(state.layer.getLoaded(),false);
  assert.ok(state.layer.meshes.every(mesh=>mesh.visible===false));
  state.render();assert.equal(state.draws(),0);
  state.layer.onRemove();
});

test('unavailable or invalid atlas never hides the sharper aerial-photo ground', async t => {
  t.mock.method(console,'warn',()=>{});
  for (const mode of ['http-error','invalid-budget','wrong-image-bytes','decode-error','wrong-decode-dimensions']) {
    let textureDisposals=0;
    const state=setup({lowMemory:false,
      fetcher:async(url,request,responses)=>{
        if(url.endsWith('.json') && mode==='http-error')return new Response('missing photograph',{status:503});
        if(url.endsWith('.json') && mode==='invalid-budget')return new Response(JSON.stringify({...metadata,width:8192,height:8192}));
        if(url.endsWith('.webp') && mode==='wrong-image-bytes')return new Response('truncated photograph');
        return responses(url);
      },
      textureLoaderFactory:()=>({loadAsync:async()=>{
        if(mode==='decode-error')throw new Error('Image decode failed');
        const texture=new THREE.Texture({width:mode==='wrong-decode-dimensions'?2048:3840,height:3840});
        texture.addEventListener('dispose',()=>textureDisposals++);
        return texture;
      }})});
    state.camera(16.4);
    await until(()=>state.layer.getStats().geometryReady && !state.layer.loading && !state.layer.textureLoading);
    assert.equal(state.layer.getLoaded(),false,mode);
    assert.equal(state.layer.getStats().textured,false,mode);
    assert.equal(state.layer.getStats().textureBytes,0,mode);
    assert.ok(state.layer.meshes.every(mesh=>mesh.visible===false),mode);
    state.render();assert.equal(state.draws(),0,mode);
    assert.equal(textureDisposals,mode==='wrong-decode-dimensions'?1:0,mode);
    state.layer.onRemove();
    assert.equal(state.layer.getStats().meshBytes,0,mode);
  }
});
