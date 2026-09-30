import test from 'node:test';
import assert from 'node:assert/strict';
import achievements from '../src/data/achievements.json' with {type:'json'};
import {destinationPatch,destinationLandingManifest,validateDestinationLandings,destinationCamera,qualityPlanForEvent,allQualityPreparationPlan,destinationAssetBudget} from '../src/destinationImagery.js';
import {arrivalResourceUrl} from '../src/arrivalImagery.js';

const EARTH=40075016.68557849;
test('actual native full/half patches pass runtime geometry/provenance validator',()=>{
  assert.equal(Object.keys(destinationLandingManifest().events).length,30);
  assert.equal(Object.keys(destinationLandingManifest({reduced:true}).landings).length,29);
  for(const change of [
    p=>{p.url='/assets/random.webp'},p=>{p.width=4096},p=>{p.resolutionM/=2},
    p=>{p.source.license=''},p=>{p.coordinates.reverse()},p=>{p.bytes=4_000_001}
  ]){
    const manifest=structuredClone(destinationLandingManifest());change(Object.values(manifest.landings)[0]);
    assert.throws(()=>validateDestinationLandings(manifest));
  }
});
test('full and reduced arrival cameras never promise detail absent from native pixels',()=>{
  for(const reduced of [false,true])for(const event of achievements){
    const patch=destinationPatch(event.slug,{reduced});const camera=destinationCamera(event,{reduced});
    if(!patch){assert.equal(camera.zoom,13.8);continue;}
    const cssMetresPerPixel=EARTH*Math.cos(camera.center[1]*Math.PI/180)/(512*2**camera.zoom);
    assert.ok(patch.resolutionM/cssMetresPerPixel<=1.50001,event.slug);
    assert.ok(camera.zoom<=16.8);
  }
});
test('Tesla framing shows full factory while the achievement marker retains authored south venue point',()=>{
  const tesla=achievements.find(event=>event.slug==='tesla-gigathon-2026');
  const camera=destinationCamera(tesla);
  assert.deepEqual(camera.center,[13.79215,52.3951]);assert.equal(camera.zoom,16.6);
  assert.equal(tesla.coordinates.lat,52.391331);
});
test('desktop prepares all full photos; phone previews never downgrade selected quality',()=>{
  const desktop=allQualityPreparationPlan(achievements);
  const mobile=allQualityPreparationPlan(achievements,{mobile:true});
  assert.equal(desktop.filter(item=>item.key?.startsWith('orthophoto/')).length,29);
  assert.equal(mobile.filter(item=>item.key?.endsWith('/half')).length,29);
  assert.equal(mobile.filter(item=>item.key?.endsWith('/full')).length,3);
  for(const event of achievements.filter(event=>destinationPatch(event.slug))){
    const item=qualityPlanForEvent(event.slug)[0];assert.ok(item.key.endsWith('/full'));
    assert.equal(item.bytes,destinationPatch(event.slug).bytes);
    assert.equal(arrivalResourceUrl(item),item.url);
  }
  const total=plan=>plan.reduce((sum,item)=>sum+item.bytes,0);
  assert.ok(total(desktop)<64_000_000);assert.ok(total(mobile)<28_000_000);
  assert.equal(destinationAssetBudget().maxActiveDecodedRgbaBytes,16_777_216);
});
test('unavailable photography remains honest: no fabricated patch and broad fallback',()=>{
  assert.deepEqual(destinationAssetBudget().unsupported,['bachelors-thesis','tgu-perfect-gpa']);
  for(const slug of destinationAssetBudget().unsupported){assert.equal(destinationPatch(slug),null);}
});
