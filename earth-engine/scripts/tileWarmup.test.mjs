import test from 'node:test';
import assert from 'node:assert/strict';
import {
  overviewTileAt, overviewCover, overviewTileKey, introOverviewPlan,
  adjacentOverviewPlan, warmupProfile, tileUrl, createTileWarmup
} from '../src/tileWarmup.js';
import achievements from '../src/data/achievements.json' with {type:'json'};
import {earthStyle} from '../src/sources.js';

test('Web Mercator overview coordinates and nearest four-tile cover are valid', () => {
  const tile = overviewTileAt({lng:11.58, lat:48.14});
  assert.equal(tile.z, 11);
  assert.equal(tile.x, 1089);
  assert.equal(tile.y, 710);
  const cover = overviewCover({lng:11.58, lat:48.14});
  assert.equal(cover.length, 4);
  assert.equal(new Set(cover.map(overviewTileKey)).size, 4);
  assert.ok(cover.every(item => item.x >= 0 && item.x < 2048 && item.y >= 0 && item.y < 2048));
  assert.equal(overviewTileAt({lng:NaN,lat:0}), null);
});

test('intro and neighbor plans stay small and prioritize latest chronology', () => {
  const desktop = introOverviewPlan(achievements);
  const mobile = introOverviewPlan(achievements, {mobile:true});
  assert.ok(desktop.length <= 34);
  assert.ok(mobile.length <= 7);
  assert.equal(desktop[0] && overviewTileKey(desktop[0]), overviewTileKey(overviewTileAt(achievements[0].coordinates)));
  assert.equal(mobile[0] && overviewTileKey(mobile[0]), overviewTileKey(overviewTileAt(achievements[0].coordinates)));
  assert.ok(desktop.some(tile => tile.z === 14));
  assert.ok(adjacentOverviewPlan(achievements, 4).length <= 12);
  assert.ok(adjacentOverviewPlan(achievements, 4, {mobile:true}).length <= 6);
});

test('cacheable ESA overview is continuously below detail and NASA remains global fallback', () => {
  const style = earthStyle();
  assert.equal(style.sources['esa-overview'].maxzoom, 11);
  assert.equal(style.sources.esa.minzoom, 12);
  const ids = style.layers.map(layer => layer.id);
  assert.ok(ids.indexOf('nasa-imagery') < ids.indexOf('esa-overview-imagery'));
  assert.ok(ids.indexOf('esa-overview-imagery') < ids.indexOf('esa-imagery'));
  assert.equal(style.sources.nasa.minzoom, 0);
});

test('save-data/slow devices disable speculative transfer; mobile has a strict budget', () => {
  assert.equal(warmupProfile({saveData:true}).enabled, false);
  assert.equal(warmupProfile({effectiveType:'slow-2g'}).enabled, false);
  assert.equal(warmupProfile({deviceMemory:2}).enabled, false);
  const mobile = warmupProfile({coarsePointer:true});
  assert.equal(mobile.concurrency, 1);
  assert.ok(mobile.batchByteLimit <= 950_000);
  assert.ok(warmupProfile({}).concurrency <= 2);
});

test('tile requests use exact source URL, dedupe cached successes and stop at byte budget', async () => {
  const seen = [];
  const response = {
    ok:true, status:200, headers:{get:()=>'image/png'},
    blob:async()=>({size:150_000})
  };
  const prefetch = createTileWarmup({
    template:'https://example.test/{z}/{x}/{y}.png',
    fetcher:async (url, options)=>{seen.push({url, options});return response;},
    profile:{enabled:true,mobile:true,concurrency:1,sessionByteLimit:300_000,batchByteLimit:150_000}
  });
  const tiles = overviewCover({lng:13.4,lat:52.5});
  await prefetch.warm(tiles);
  assert.deepEqual(seen.map(request=>request.url), [tileUrl('https://example.test/{z}/{x}/{y}.png',tiles[0])]);
  assert.equal(seen[0].options.cache, 'force-cache');
  assert.equal(seen[0].options.priority, 'low');
  await prefetch.warm(tiles);
  assert.equal(seen.length, 2); // cached first tile is skipped
  assert.equal(prefetch.stats().bytes, 300_000);
  await prefetch.warm(tiles);
  assert.equal(seen.length, 2); // session cap reached
});

test('new predictions are additive and high-priority arrivals move ahead without cancelling work', async () => {
  const requests = [];
  let finishFirst;
  const prefetch = createTileWarmup({template:'https://example.test/{z}/{x}/{y}.png',
    profile:{enabled:true,concurrency:1,sessionByteLimit:1_000_000,batchByteLimit:1_000_000},
    fetcher:async(url,options)=>{
      requests.push({url,options});
      if (requests.length === 1) await new Promise(resolve => {finishFirst=resolve;});
      return {ok:true,headers:{get:()=>'image/webp'},blob:async()=>({size:1000})};
    }});
  const first = prefetch.warm([{z:11,x:1,y:1},{z:11,x:2,y:2}]);
  const next = prefetch.warm([{z:11,x:3,y:3},{z:11,x:1,y:1}],{priority:100});
  finishFirst();
  await Promise.all([first,next]);
  assert.deepEqual(requests.map(request=>request.url),['https://example.test/11/1/1.png','https://example.test/11/3/3.png','https://example.test/11/2/2.png']);
  assert.ok(requests.every(request=>!request.options.signal.aborted));
  assert.equal(prefetch.stats().completed,3);
});

test('hidden-page pause retains queued work, and explicit cancel settles callers', async () => {
  let requests=0;
  const prefetch=createTileWarmup({template:'https://example.test/{z}/{x}/{y}.png',
    profile:{enabled:true,concurrency:1,sessionByteLimit:1_000_000,batchByteLimit:1_000_000},
    fetcher:async()=>{requests++;return {ok:true,headers:{get:()=>'image/webp'},blob:async()=>({size:1000})};}});
  prefetch.pause();
  const queued=prefetch.warm([{z:11,x:1,y:1}]);
  assert.equal(requests,0);
  prefetch.resume();
  await queued;
  assert.equal(requests,1);
  prefetch.pause();
  const cancelled=prefetch.warm([{z:11,x:2,y:2}]);
  prefetch.cancel();
  await cancelled;
  assert.equal(prefetch.stats().queued,0);
});

test('independent landing images share the bounded priority queue without colliding with raster tiles', async () => {
  const fetched=[];
  const warmup=createTileWarmup({template:'https://example.org/{z}/{x}/{y}',
    urlForTile:item=>item.url??`https://example.org/${overviewTileKey(item)}`,
    fetcher:async url=>{fetched.push(url);return new Response(new Uint8Array(10),{headers:{'content-type':'image/webp'}});},
    profile:{enabled:true,concurrency:1,sessionByteLimit:1000,batchByteLimit:1000}});
  const image={key:'landing/14/100/100',url:'https://example.org/landing.webp'};
  await warmup.warm([image,{z:14,x:100,y:100},image]);
  assert.deepEqual(fetched,['https://example.org/landing.webp','https://example.org/14/100/100']);
  assert.equal(warmup.stats().completed,2);
  await warmup.warm([image]);
  assert.equal(fetched.length,2);
});
