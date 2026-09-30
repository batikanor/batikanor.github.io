import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {arrivalManifest, arrivalTileUrl, resolveArrivalRequest, allArrivalPlan, arrivalPlanForEvent, arrivalAssetBudget} from '../src/arrivalImagery.js';
import {overviewTileAt, overviewTileKey} from '../src/tileWarmup.js';
import achievements from '../src/data/achievements.json' with {type:'json'};

test('every authored point has real overview and sharp local imagery, within a 10 MB total budget', () => {
  assert.equal(arrivalAssetBudget().destinations,achievements.length);
  assert.ok(arrivalAssetBudget().bytes < 10_000_000);
  assert.ok(arrivalAssetBudget().bytes < arrivalAssetBudget().sourceBytes / 3);
  assert.equal(arrivalManifest.license,'CC-BY-4.0');
  for (const event of achievements) {
    const group = arrivalManifest.events[event.slug];
    assert.equal(group.overview.length,9);
    assert.equal(group.detail.length,9);
    for (const zoom of [11,14]) assert.ok(arrivalTileUrl(overviewTileAt(event.coordinates,zoom)));
    assert.equal(arrivalPlanForEvent(event.slug).length,18);
  }
});

test('map and prefetch resolve the identical fingerprinted local resource; unknown geography/provider is untouched', () => {
  const tile = overviewTileAt(achievements[0].coordinates,14);
  const remote = `https://wmts.terrascope.be/?LAYER=esa-worldcover-s2rgbnir-10m-2021-v2_tcc&TILEMATRIX=${tile.z}&TILECOL=${tile.x}&TILEROW=${tile.y}`;
  assert.equal(resolveArrivalRequest(remote),arrivalTileUrl(tile));
  assert.equal(resolveArrivalRequest(remote.replace('v2_tcc','v2_fcc')),remote.replace('v2_tcc','v2_fcc'));
  assert.equal(resolveArrivalRequest('https://example.org/tile.jpg'),'https://example.org/tile.jpg');
  assert.equal(arrivalTileUrl({z:11,x:0,y:0}),null);
});

test('additive all-destination plans prioritize first stop and dedupe shared city geography', () => {
  for (const mobile of [false,true]) {
    const plan = allArrivalPlan(achievements,{mobile});
    assert.equal(overviewTileKey(plan[0]),arrivalManifest.events[achievements[0].slug].overview[0]);
    assert.equal(plan.length,new Set(plan.map(overviewTileKey)).size);
    assert.equal(plan.length,Object.keys(arrivalManifest.tiles).length);
  }
});

test('every packaged tile has a verified derivation hash and real byte count', async () => {
  for (const tile of Object.values(arrivalManifest.tiles)) {
    const bytes = await readFile(new URL(`../public${tile.url}`,import.meta.url));
    assert.equal(bytes.length,tile.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),tile.sha256);
    assert.match(tile.sourceSha256,/^[a-f0-9]{64}$/);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
  }
});

test('independent landing preparation reaches every project within the mobile byte budget', async () => {
  const {allArrivalPreparationPlan,landingPlanForEvent,arrivalResourceUrl}=await import('../src/arrivalImagery.js');
  for(const mobile of [false,true]){
    const plan=allArrivalPreparationPlan(achievements,{mobile});
    const keys=new Set(plan.map(overviewTileKey));
    assert.equal(keys.size,plan.length);
    assert.ok(plan.reduce((sum,item)=>sum+item.bytes,0)<(mobile?12_000_000:24_000_000));
    for(const event of achievements){
      const [landing]=landingPlanForEvent(event.slug);
      assert.ok(landing && keys.has(landing.key));
      assert.match(arrivalResourceUrl(landing),/^\/assets\/arrival\/landing-14-\d+-\d+-[a-f0-9]{12}\.webp$/);
    }
    if(mobile)assert.ok(plan.filter(item=>!item.key).every(item=>item.z===11));
  }
});
