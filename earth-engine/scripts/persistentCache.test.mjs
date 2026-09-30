import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createPersistentCache, persistentCacheVersion, persistentCacheProfile, MAPTERHORN_CACHE_TILE} from '../src/persistentCache.js';

const source = await readFile(new URL('../public/earth-cache-sw.js', import.meta.url), 'utf8');
const origin = 'https://staging.batikanor.com';
const asset = name => `${origin}/data/${name}-v1.bin`;
const photo = `${origin}/assets/arrival/esa-11-1089-710-d012a90f.webp`;
const destinationPhoto = `${origin}/assets/destination-orthophotos/ortho-bavaria-11p535300-48p178600-2048-5e1e26255771.webp`;
const destinationMobilePhoto = destinationPhoto.replace('-2048-5e1e26255771', '-1024-b913bdc276eb');
const landsDepartmentLogo = `${origin}/assets/destination-orthophotos/lands-department-logo-97fc83e2643b.jpg`;
const esa = 'https://wmts.terrascope.be/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=esa-worldcover-s2rgbnir-10m-2021-v2_tcc&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX=11&TILECOL=1089&TILEROW=710&TIME=2021-01-01';

function setup({fetcher, cacheFailure = false, release = 'release-test', initialCaches = [], cacheStore = null} = {}) {
  const handlers = {};
  const named = cacheStore || new Map(initialCaches.map(name => [name, new Map()]));
  let calls = 0, claims = 0;
  let clock = Date.now();
  class WorkerDate extends Date {static now() {return clock;}}
  const caches = {
    keys:async()=>[...named.keys()],
    delete:async name=>named.delete(name),
    open:async name=>{
      if (cacheFailure) throw new Error('Denied storage');
      if (!named.has(name)) named.set(name,new Map());
      const entries = named.get(name);
      return {
        keys:async()=>[...entries.keys()].map(url=>new Request(url)),
        match:async input=>entries.get(typeof input === 'string' ? input : input.url)?.clone(),
        put:async (request,response)=>{entries.set(request.url,response.clone());},
        delete:async input=>entries.delete(typeof input === 'string' ? input : input.url)
      };
    }
  };
  const context = vm.createContext({self:{location:new URL(`${origin}/earth-cache-sw.js?v=${release}`),
    navigator:{},clients:{claim:async()=>{claims++;}},skipWaiting:async()=>{},
    addEventListener:(name,handler)=>{handlers[name]=handler;}},
    fetch:async request=>{calls++;return fetcher ? fetcher(request) : new Response(new Uint8Array([1,2,3]),
      {headers:{'content-type':request.url.includes('.webp') || request.url.startsWith('https://wmts.') ? 'image/webp' : 'application/octet-stream'}});},
    caches, URL, Request, Response, Headers, AbortController, TextDecoder, Uint8Array, Date:WorkerDate, setTimeout, clearTimeout, console});
  vm.runInContext(source,context);
  async function activate() {
    const promises=[];handlers.activate({waitUntil:promise=>promises.push(promise)});await Promise.all(promises);
  }
  async function fetchUrl(url, options = {}) {
    const promises=[];
    let response;
    handlers.fetch({request:new Request(url, options),waitUntil:promise=>promises.push(promise),respondWith:promise=>{response=promise;}});
    if (!response) return {intercepted:false};
    const value=await response;
    await Promise.all(promises);
    return {intercepted:true,response:value};
  }
  function send(type,data={}) {
    const promises=[];
    let reply;
    handlers.message({data:{protocol:'earth-cache-v1',type,...data},source:{id:'visitor',url:origin+'/'},
      ports:[{postMessage:value=>{reply=value;}}],waitUntil:promise=>promises.push(promise)});
    return {get reply(){return reply;},done:Promise.all(promises)};
  }
  return {context,activate,fetchUrl,send,named,calls:()=>calls,claims:()=>claims,
    tick:ms=>{clock+=ms;},policy:url=>vm.runInContext(`resourcePolicy(${JSON.stringify(url)})`,context),
    stats:()=>vm.runInContext('summary()',context)};
}

test('persistent cache profiles respect Save Data, 2G and constrained phones', () => {
  assert.equal(persistentCacheProfile({saveData:true}).speculative,false);
  assert.equal(persistentCacheProfile({effectiveType:'slow-2g'}).speculative,false);
  assert.equal(persistentCacheProfile({deviceMemory:4}).mobile,true);
  assert.equal(persistentCacheProfile({}).speculative,true);
  assert.equal(persistentCacheProfile({saveData:true}).enabled,true); // demand cache still useful
  assert.equal(persistentCacheVersion('/assets/main-a.js'),persistentCacheVersion('/assets/main-a.js'));
  assert.notEqual(persistentCacheVersion('/assets/main-a.js'),persistentCacheVersion('/assets/main-b.js'));
});

test('strict allowlist contains sourced meshes/atlases/arrival tiles, never HTML or private URLs', () => {
  const worker=setup();
  for (const url of [asset('munich-google-lod2'),photo,esa,
    `${origin}/assets/isometric/cottbus-climathon-2025-roof-truedop20-v1-half.webp`,
    `${origin}/data/rome-ostiense-buildings-v1.geojson`,
    'https://wmtsod1.bayernwolke.de/wmts/by_dop/smerc/15/17430/11370']) assert.ok(worker.policy(url),url);
  for (const url of [origin+'/',origin+'/cv/',origin+'/assets/earth-current.json',
    origin+'/assets/main-ab12.js',origin+'/photos/personal.webp',asset('munich')+'?token=secret',
    'https://evil.test/data/munich-lod2-v1.bin',esa.replace('TILECOL=1089','TILECOL=999999'),
    esa+'&user=abc',esa.replace('TIME=2021-01-01','TIME=2026-01-01'),
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/2004-01-01/GoogleMapsCompatible_Level8/3/2/4.jpg']) assert.equal(worker.policy(url),null,url);
});

test('activation removes only older Earth release caches and claims current pages', async () => {
  const worker=setup({initialCaches:['batikan-earth-map-v1-release-old','unrelated-site-cache']});
  await worker.activate();
  assert.equal(worker.named.has('batikan-earth-map-v1-release-old'),false);
  assert.equal(worker.named.has('unrelated-site-cache'),true);
  assert.equal(worker.claims(),1);
});

test('same release serves repeat map assets from disk without another fetch; TTL is enforced', async () => {
  const worker=setup();await worker.activate();
  const first=await worker.fetchUrl(asset('munich-lod2'));
  const next=await worker.fetchUrl(asset('munich-lod2'));
  assert.deepEqual([...new Uint8Array(await next.response.arrayBuffer())],[1,2,3]);
  assert.equal(first.intercepted,true);assert.equal(worker.calls(),1);assert.equal(worker.stats().hits,1);
  worker.tick(8*86_400_000);
  await worker.fetchUrl(asset('munich-lod2'));
  assert.equal(worker.calls(),2);
});

test('no-store, private, no-cache, opaque, errors and incorrect MIME are never stored', async () => {
  const cases=[{'cache-control':'no-store'},{'cache-control':'private, max-age=10'},
    {'cache-control':'no-cache'},{'content-type':'text/html'},{vary:'Cookie'}];
  for (const headers of cases) {
    const worker=setup({fetcher:async()=>new Response('secret',{headers:{'content-type':'application/octet-stream',...headers}})});
    await worker.fetchUrl(asset('munich'));await worker.fetchUrl(asset('munich'));
    assert.equal(worker.calls(),2);assert.equal(worker.stats().entries,0);
  }
  const failed=setup({fetcher:async()=>new Response('not found',{status:404})});
  await failed.fetchUrl(asset('munich'));assert.equal(failed.stats().entries,0);
  const opaque=setup();
  assert.equal(vm.runInContext("usableResponse({status:200,type:'opaque'}, {kind:'image'})",opaque.context),false);
});

test('private browsing storage denial does not interfere with the normal fetch', async () => {
  const worker=setup({cacheFailure:true});await worker.activate();
  const result=await worker.fetchUrl(asset('munich'));
  assert.equal(result.response.status,200);assert.equal(worker.claims(),1);
  assert.equal(worker.calls(),1);
});

test('Range/no-store/authorization requests never pass through the persistent cache', async () => {
  const worker=setup();
  for (const options of [{headers:{range:'bytes=0-5'}},{cache:'no-store'},{headers:{authorization:'Bearer abc'}}]) {
    assert.equal((await worker.fetchUrl(asset('munich'),options)).intercepted,false);
  }
  assert.equal((await worker.fetchUrl(origin+'/')).intercepted,false);
  assert.equal(worker.calls(),0);
});

test('an asset over 10 MB is served but not persisted', async () => {
  const worker=setup({fetcher:async()=>new Response('tiny test body',{
    headers:{'content-type':'application/octet-stream','content-length':'11000000'}})});
  assert.equal((await worker.fetchUrl(asset('munich'))).response.status,200);
  assert.equal(worker.stats().entries,0);
});

test('bounded LRU eviction never exceeds mobile disk/entry caps', async () => {
  const worker=setup({fetcher:async()=>new Response(new Uint8Array(1_000_000),{headers:{'content-type':'application/octet-stream'}})});
  await worker.send('configure',{mobile:true}).done;
  for (let i=0;i<51;i++) await worker.fetchUrl(asset(`chapter-${i}`));
  assert.ok(worker.stats().diskBytes<=48_000_000);assert.equal(worker.stats().entries,48);
  assert.ok(worker.stats().evictions>=3);
});

test('speculative queue skips Save Data and rejects non-map URLs', async () => {
  const worker=setup();
  await worker.send('prefetch',{urls:[photo],saveData:true}).done;
  assert.equal(worker.calls(),0);
  await worker.send('prefetch',{urls:[origin+'/cv/',origin+'/assets/earth-current.json',photo]}).done;
  assert.equal(worker.calls(),1);
  await worker.fetchUrl(photo);assert.equal(worker.calls(),1);
  assert.equal(worker.stats().prefetchBytes,3);
});

test('foreground demand joins a speculative download without duplicate transfer', async () => {
  let resolveFetch;
  const worker=setup({fetcher:()=>new Promise(resolve=>{resolveFetch=resolve;})});
  const preload=worker.send('prefetch',{urls:[photo]});
  while (!resolveFetch) await new Promise(resolve=>setTimeout(resolve,1));
  const demand=worker.fetchUrl(photo);
  while (!vm.runInContext(`flights.get(${JSON.stringify(photo)}).demand`,worker.context)) await new Promise(resolve=>setTimeout(resolve,1));
  await worker.send('cancel').done;
  resolveFetch(new Response('image',{headers:{'content-type':'image/webp'}}));
  const result=await demand;await preload.done;
  assert.equal(result.response.status,200);assert.equal(worker.calls(),1);
});

test('client gracefully handles unsupported/insecure hosts and does not replace unrelated SW', async () => {
  const unsupported=createPersistentCache({navigatorObject:{},locationObject:new URL('https://staging.batikanor.com')});
  assert.equal((await unsupported.ready).available,false);
  let registrations=0;
  const client=createPersistentCache({navigatorObject:{serviceWorker:{
    getRegistration:async()=>({active:{scriptURL:origin+'/offline-app.js'}}),register:async()=>{registrations++;}
  }},locationObject:new URL(origin)});
  assert.equal((await client.ready).failure,'another-service-worker');assert.equal(registrations,0);
  const insecure=createPersistentCache({navigatorObject:{serviceWorker:{}},locationObject:new URL('http://example.com')});
  assert.equal((await insecure.ready).failure,'unsupported');
});

test('client registration uses a release-specific URL, configures budget and flushes bounded queued work', async () => {
  const received=[];
  let allowRegistration;
  const registerGate = new Promise(resolve=>{allowRegistration=resolve;});
  const release=persistentCacheVersion('new-build');
  const active={scriptURL:`${origin}/earth-cache-sw.js?v=${release}`,postMessage:(data,ports)=>{
    received.push(data);ports[0].postMessage({release,entries:1});
  }};
  let options;
  const client=createPersistentCache({version:'new-build',profile:persistentCacheProfile({coarsePointer:true}),
    navigatorObject:{serviceWorker:{getRegistration:async()=>undefined,register:async (url,config)=>{options={url,config};await registerGate;return {active};}}},
    locationObject:new URL(origin),messageTimeoutMs:50});
  for (let i=0;i<12;i++) await client.prefetch([asset(`chapter-${i}`)]);
  allowRegistration();
  await client.ready;
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(options.url,`/earth-cache-sw.js?v=${release}`);assert.equal(options.config.updateViaCache,'none');
  assert.equal(received[0].type,'configure');assert.equal(received[0].mobile,true);
  assert.ok(received.filter(message=>message.type==='prefetch').length<=8);
  client.cancel();client.dispose();
  assert.equal(client.snapshot().available,false);
});

test('provider max-age is a ceiling, rather than extending external freshness to 24 hours', async () => {
  const worker=setup({fetcher:async()=>new Response('image',{headers:{'content-type':'image/png','cache-control':'public, max-age=60'}})});
  await worker.fetchUrl(esa);worker.tick(59_000);await worker.fetchUrl(esa);
  assert.equal(worker.calls(),1);
  worker.tick(2000);await worker.fetchUrl(esa);assert.equal(worker.calls(),2);
});

test('mobile speculation stops at its byte budget even while disk space remains', async () => {
  const worker=setup({fetcher:async()=>new Response(new Uint8Array(1_000_000),{headers:{'content-type':'application/octet-stream'}})});
  await worker.send('configure',{mobile:true}).done;
  await worker.send('prefetch',{urls:Array.from({length:36},(_,i)=>asset(`small-${i}`))}).done;
  assert.equal(worker.calls(),24);assert.equal(worker.stats().prefetchBytes,24_000_000);
  assert.equal(worker.stats().diskBytes,24_000_000);assert.equal(worker.stats().queued,12);
  await worker.fetchUrl(asset('small-35'));assert.equal(worker.calls(),25); // explicit user choice is not a preload
});

test('pending cancellation aborts only idle downloads; a later foreground fetch restarts cleanly', async () => {
  let finish;
  const worker=setup({fetcher:request=>new Promise((resolve,reject)=>{
    finish=()=>resolve(new Response('image',{headers:{'content-type':'image/webp'}}));
    request.signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')),{once:true});
  })});
  const preload=worker.send('prefetch',{urls:[photo]});
  while (!finish) await new Promise(resolve=>setTimeout(resolve,1));
  await worker.send('cancel').done;
  const demand=worker.fetchUrl(photo);
  while (worker.calls()<2) await new Promise(resolve=>setTimeout(resolve,1));
  finish();await preload.done;
  assert.equal((await demand).response.status,200);assert.equal(worker.calls(),2);
});

test('mobile record cap bounds many very small regional metadata payloads too', async () => {
  const worker=setup();await worker.send('configure',{mobile:true}).done;
  for (let i=0;i<519;i++) await worker.fetchUrl(asset(`tiny-${i}`));
  assert.equal(worker.stats().entries,512);assert.equal(worker.stats().evictions,7);
});

test('an unversioned/invalid worker is inert and never intercepts a map fetch', async () => {
  const worker=setup({release:'../../unsafe'});
  assert.equal((await worker.fetchUrl(photo)).intercepted,false);
  assert.equal(worker.calls(),0);
});


test('first chapter miss reloads HTTP cache; fingerprinted arrival imagery can reuse it', async () => {
  const seen=[];
  const worker=setup({fetcher:async request=>{seen.push({url:request.url,cache:request.cache});return new Response('asset',
    {headers:{'content-type':request.url.endsWith('.webp')?'image/webp':'application/octet-stream'}});}});
  await worker.fetchUrl(asset('fresh-chapter'));await worker.fetchUrl(photo);
  assert.equal(seen[0].cache,'reload');assert.equal(seen[1].cache,'default');
});


test('official Mapterhorn Terrarium DEM tiles are allowlisted, mutable TileJSON/invalid grids are not', async () => {
  const worker=setup({fetcher:async()=>new Response('DEM',{headers:{'content-type':'image/webp','cache-control':'public, max-age=604800'}})});
  const url=MAPTERHORN_CACHE_TILE.replace('{z}','16').replace('{x}','34875').replace('{y}','22741');
  assert.ok(worker.policy(url));
  assert.ok(worker.policy('https://tiles.mapterhorn.com/0/0/0.webp'));
  for (const invalid of ['https://tiles.mapterhorn.com/tilejson.json',
    'https://tiles.mapterhorn.com/17/34875/22741.webp','https://tiles.mapterhorn.com/13/9000/3000.webp',
    'https://tiles.mapterhorn.com/16/34875/22741.webp?token=abc',
    'https://tiles.mapterhorn.com:8443/16/34875/22741.webp',
    'https://gdi.berlin.de/services/wms/truedop_2026?service=WMS&request=GetMap']) assert.equal(worker.policy(invalid),null);
  await worker.send('prefetch',{urls:[url]}).done;await worker.fetchUrl(url);
  assert.equal(worker.calls(),1);assert.equal(worker.stats().hits,1);
  worker.tick(86_400_001);await worker.fetchUrl(url);assert.equal(worker.calls(),2);
});

test('visible upstream Age reduces remaining provider max-age freshness', async () => {
  const worker=setup({fetcher:async()=>new Response('DEM',{headers:{'content-type':'image/webp',
    'cache-control':'public, max-age=60','age':'59'}})});
  const url='https://tiles.mapterhorn.com/13/4359/2842.webp';
  await worker.fetchUrl(url);worker.tick(1001);await worker.fetchUrl(url);assert.equal(worker.calls(),2);
});


test('stats restores actual disk totals after the browser terminates/restarts an activated worker', async () => {
  const first=setup();await first.fetchUrl(photo);
  assert.equal(first.stats().entries,1);
  const restarted=setup({cacheStore:first.named}); // No activate event on ordinary restart.
  const report=restarted.send('stats');await report.done;
  assert.equal(report.reply.entries,1);assert.equal(report.reply.diskBytes,3);
  assert.equal(report.reply.hits,0); // Session counters are intentionally not historical analytics.
  await restarted.fetchUrl(photo);assert.equal(restarted.calls(),0);assert.equal(restarted.stats().hits,1);
});

test('mobile budget is durable and sticky per release, not reverted to desktop after restart', async () => {
  const first=setup();await first.send('configure',{mobile:true}).done;await first.fetchUrl(photo);
  const cache=first.named.get('batikan-earth-map-v1-release-test');
  assert.equal(cache.size,2); // One private policy record plus one visible asset.
  assert.equal(first.stats().entries,1);assert.equal(first.stats().diskBytes,3);
  const restarted=setup({cacheStore:first.named});
  const report=restarted.send('stats');await report.done;
  assert.equal(report.reply.limits.bytes,48_000_000);assert.equal(report.reply.limits.entries,512);
  assert.equal(report.reply.limits.concurrency,1);assert.equal(report.reply.limits.prefetchBytes,24_000_000);
  await restarted.send('configure',{mobile:false}).done;assert.equal(restarted.stats().limits.bytes,48_000_000);
  const secondRestart=setup({cacheStore:first.named});await secondRestart.fetchUrl(photo);
  assert.equal(secondRestart.calls(),0);assert.equal(secondRestart.stats().limits.bytes,48_000_000);
  assert.equal(secondRestart.stats().entries,1);
});

test('restart loads mobile policy before prefetch and enforces its lower transfer cap', async () => {
  const first=setup();await first.send('configure',{mobile:true}).done;
  let active=0,maxActive=0;
  const restarted=setup({cacheStore:first.named,fetcher:async()=>{
    active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
    return new Response(new Uint8Array(1_000_000),{headers:{'content-type':'application/octet-stream'}});
  }});
  await restarted.send('prefetch',{urls:Array.from({length:34},(_,i)=>asset(`restart-${i}`))}).done;
  assert.equal(maxActive,1);assert.equal(restarted.calls(),24);assert.equal(restarted.stats().prefetchBytes,24_000_000);
  assert.equal(restarted.stats().entries,24);
});

test('new release removes both old assets and sticky mobile policy', async () => {
  const first=setup();await first.send('configure',{mobile:true}).done;await first.fetchUrl(photo);
  const next=setup({cacheStore:first.named,release:'release-next'});await next.activate();
  assert.equal(next.named.has('batikan-earth-map-v1-release-test'),false);
  const report=next.send('stats');await report.done;
  assert.equal(report.reply.entries,0);assert.equal(report.reply.limits.bytes,96_000_000);
});


class ListenerSurface extends EventTarget {
  constructor(properties={}) {super();Object.assign(this,properties);this.listenerCount=0;}
  addEventListener(type,handler,options) {super.addEventListener(type,handler,options);this.listenerCount++;}
  removeEventListener(type,handler,options) {super.removeEventListener(type,handler,options);this.listenerCount--;}
}

function delayedClient() {
  const release=persistentCacheVersion('slow-first-visit');
  const received=[];
  const candidate=new ListenerSurface({scriptURL:`${origin}/earth-cache-sw.js?v=${release}`,state:'installing',
    postMessage:(data,ports)=>{received.push(data);ports[0].postMessage({available:true,release,entries:7});}});
  const registration=new ListenerSurface({active:null,installing:candidate,waiting:null});
  const container=new ListenerSurface({controller:null,getRegistration:async()=>undefined,register:async()=>registration});
  const client=createPersistentCache({version:'slow-first-visit',navigatorObject:{serviceWorker:container},
    locationObject:new URL(origin),registrationTimeoutMs:5,messageTimeoutMs:50});
  const activate=()=>{candidate.state='activated';registration.installing=null;registration.active=candidate;
    container.controller=candidate;candidate.dispatchEvent(new Event('statechange'));container.dispatchEvent(new Event('controllerchange'));};
  return {client,candidate,registration,container,received,activate,release};
}

test('slow first worker installation recovers after ready timeout and flushes exactly once', async () => {
  const task=delayedClient();await task.client.prefetch([photo]);
  const initial=await task.client.ready;assert.equal(initial.available,false);assert.equal(task.client.snapshot().queued,1);
  await new Promise(resolve=>setTimeout(resolve,10));task.activate();
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(task.client.snapshot().available,true);assert.equal(task.client.snapshot().failure,null);
  assert.equal(task.client.snapshot().queued,0);
  assert.equal(task.received.filter(message=>message.type==='configure').length,1);
  assert.equal(task.received.filter(message=>message.type==='prefetch').length,1);
  const recoveredStats=await task.client.stats();assert.equal(recoveredStats.entries,7);
  assert.equal(recoveredStats.available,true);assert.equal(recoveredStats.failure,null);task.client.dispose();
});

test('dispose removes late-activation listeners and never adopts or flushes afterward', async () => {
  const task=delayedClient();await task.client.prefetch([photo]);await task.client.ready;
  assert.ok(task.candidate.listenerCount>0);assert.ok(task.container.listenerCount>0);
  task.client.dispose();
  assert.equal(task.candidate.listenerCount,0);assert.equal(task.container.listenerCount,0);assert.equal(task.registration.listenerCount,0);
  task.activate();await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(task.client.snapshot().available,false);assert.equal(task.received.length,0);
});

test('controller change never adopts a different origin, worker path or release', async () => {
  const task=delayedClient();await task.client.ready;
  for (const scriptURL of [`https://evil.test/earth-cache-sw.js?v=${task.release}`,
    `${origin}/offline-app.js?v=${task.release}`,`${origin}/earth-cache-sw.js?v=release-other`]) {
    task.container.controller={scriptURL,state:'activated',postMessage:()=>{throw new Error('Unrelated worker must never be messaged');}};
    task.container.dispatchEvent(new Event('controllerchange'));assert.equal(task.client.snapshot().available,false);
  }
  task.client.dispose();
});


test('fingerprinted per-destination landing images share safe arrival caching policy', async () => {
  const worker=setup();
  const valid=`${origin}/assets/arrival/landing-14-8718-5686-deadbeef1234.webp`;
  assert.ok(worker.policy(valid));
  assert.equal(worker.policy(valid).ttl,7*86_400_000);
  for (const invalid of [valid+'?token=secret',valid+'#fragment',
    valid.replace('/assets/arrival/','/photos/'),valid.replace('landing-14','../landing-14'),
    valid.replace('deadbeef1234','not-a-hash'),valid.replace('.webp','.html'),
    valid.replace('https://staging.batikanor.com','https://evil.test')]) assert.equal(worker.policy(invalid),null,invalid);
  await worker.send('prefetch',{urls:[valid]}).done;await worker.fetchUrl(valid);
  assert.equal(worker.calls(),1);assert.equal(worker.stats().hits,1);
});

test('quality orthophotos require bounded dimensions, coordinates and fingerprints; credit logo is exact', async () => {
  const worker=setup({fetcher:async request=>new Response('source photography',
    {headers:{'content-type':request.url.endsWith('.jpg')?'image/jpeg':'image/webp','cache-control':'public, max-age=604800'}})});
  for (const url of [destinationPhoto,destinationMobilePhoto,landsDepartmentLogo,
    `${origin}/assets/isometric/tesla-gigafactory-ground-truedop20-v1.webp`,
    `${origin}/assets/isometric/tesla-gigafactory-roof-truedop20-v1-half.webp`]) {
    assert.ok(worker.policy(url),url);
    assert.equal(worker.policy(url).kind,'image');
    assert.equal(worker.policy(url).ttl,7*86_400_000);
  }
  for (const invalid of [destinationPhoto+'?token=secret',destinationPhoto+'#fragment',
    destinationPhoto.replace('/assets/destination-orthophotos/','/photos/'),
    destinationPhoto.replace('2048','4096'),destinationPhoto.replace('2048','20480'),
    destinationPhoto.replace('5e1e26255771','not-a-hash'),
    destinationPhoto.replace('5e1e26255771','5e1e2625577'),
    destinationPhoto.replace('5e1e26255771','5e1e262557711'),
    destinationPhoto.replace('11p535300','200p535300'),
    destinationPhoto.replace('48p178600','85p000000'),
    destinationPhoto.replace('11p535300','11p5353'),
    destinationPhoto.replace('.webp','.jpg'),destinationPhoto.replace('.webp','.json'),
    destinationPhoto.replace('https://staging.batikanor.com','https://evil.test'),
    destinationPhoto.replace('https://staging.batikanor.com','https://visitor:secret@staging.batikanor.com'),
    landsDepartmentLogo.replace('97fc83e2643b','97fc83e2643c'),
    landsDepartmentLogo.replace('lands-department-logo','personal-photo'),
    landsDepartmentLogo+'?download=true']) assert.equal(worker.policy(invalid),null,invalid);
  await worker.send('prefetch',{urls:[destinationPhoto,destinationMobilePhoto,landsDepartmentLogo]}).done;
  for (const url of [destinationPhoto,destinationMobilePhoto,landsDepartmentLogo]) await worker.fetchUrl(url);
  assert.equal(worker.calls(),3);assert.equal(worker.stats().entries,3);assert.equal(worker.stats().hits,3);
  worker.tick(7*86_400_000+1);await worker.fetchUrl(destinationPhoto);assert.equal(worker.calls(),4);
});

test('quality package fits encoded cache/preparation caps without increasing parallelism or per-asset limits', async () => {
  const manifest=JSON.parse(await readFile(new URL('../src/data/destinationOrthophotos.json',import.meta.url),'utf8'));
  const desktop=setup();
  const mobile=setup();await mobile.send('configure',{mobile:true}).done;
  const desktopLimits=desktop.stats().limits,mobileLimits=mobile.stats().limits;
  assert.equal(desktopLimits.bytes,96_000_000);assert.equal(mobileLimits.bytes,48_000_000);
  assert.equal(desktopLimits.prefetchBytes,64_000_000);assert.equal(mobileLimits.prefetchBytes,24_000_000);
  assert.equal(desktopLimits.concurrency,2);assert.equal(mobileLimits.concurrency,1);
  assert.equal(desktopLimits.entries,768);assert.equal(mobileLimits.entries,512);
  let desktopBytes=0,mobileBytes=0;
  for (const patch of Object.values(manifest.patches)) {
    assert.ok(desktop.policy(new URL(patch.url,origin+'/').href),patch.url);
    assert.ok(mobile.policy(new URL(patch.mobile.url,origin+'/').href),patch.mobile.url);
    assert.ok(patch.bytes<=10_000_000 && patch.mobile.bytes<=10_000_000);
    desktopBytes+=patch.bytes;mobileBytes+=patch.mobile.bytes;
  }
  assert.ok(desktopBytes<desktopLimits.prefetchBytes,'All full-quality destination photographs fit the desktop preparation tier');
  assert.ok(mobileBytes<mobileLimits.prefetchBytes,'All mobile destination photographs fit the mobile preparation tier');
  assert.ok(desktopBytes<desktopLimits.bytes && mobileBytes<mobileLimits.bytes);
});

test('fingerprinted quality photography reuses HTTP cache while versioned chapter misses reload', async () => {
  const seen=[];
  const worker=setup({fetcher:async request=>{seen.push({url:request.url,cache:request.cache});return new Response('source asset',
    {headers:{'content-type':request.url.endsWith('.jpg')?'image/jpeg':request.url.endsWith('.webp')?'image/webp':'application/octet-stream'}});}});
  await worker.fetchUrl(asset('fresh-chapter'));
  await worker.fetchUrl(destinationPhoto);
  await worker.fetchUrl(landsDepartmentLogo);
  assert.equal(seen[0].cache,'reload');assert.equal(seen[1].cache,'default');assert.equal(seen[2].cache,'default');
});

test('desktop LRU stays below the enlarged quality byte cap and still evicts oldest records', async () => {
  const worker=setup({fetcher:async()=>new Response(new Uint8Array(1_000_000),{headers:{'content-type':'application/octet-stream'}})});
  for (let i=0;i<99;i++) await worker.fetchUrl(asset(`desktop-${i}`));
  assert.equal(worker.stats().diskBytes,96_000_000);assert.equal(worker.stats().entries,96);
  assert.equal(worker.stats().evictions,3);
  const cache=worker.named.get('batikan-earth-map-v1-release-test');
  assert.equal(cache.has(asset('desktop-0')),false);assert.equal(cache.has(asset('desktop-98')),true);
});

test('desktop speculation stops at 64 MB with at most two transfers, not the full disk allowance', async () => {
  let active=0,maxActive=0;
  const worker=setup({fetcher:async()=>{
    active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,1));active--;
    return new Response(new Uint8Array(1_000_000),{headers:{'content-type':'application/octet-stream'}});
  }});
  await worker.send('prefetch',{urls:Array.from({length:72},(_,i)=>asset(`desktop-preload-${i}`))}).done;
  assert.equal(maxActive,2);assert.equal(worker.calls(),64);assert.equal(worker.stats().prefetchBytes,64_000_000);
  assert.equal(worker.stats().diskBytes,64_000_000);assert.equal(worker.stats().queued,8);
  await worker.fetchUrl(asset('desktop-preload-71'));assert.equal(worker.calls(),65);
  assert.equal(worker.stats().diskBytes,65_000_000);assert.equal(worker.stats().prefetchBytes,64_000_000);
});

test('quality photography does not weaken no-store/private policies or Save Data opt-out', async () => {
  for (const headers of [{'cache-control':'no-store'},{'cache-control':'private, max-age=60'},
    {'cache-control':'no-cache'},{vary:'Cookie'},{'content-type':'text/html'}]) {
    const worker=setup({fetcher:async()=>new Response('not publicly cacheable',
      {headers:{'content-type':'image/webp',...headers}})});
    await worker.fetchUrl(destinationPhoto);await worker.fetchUrl(destinationPhoto);
    assert.equal(worker.calls(),2);assert.equal(worker.stats().entries,0);
  }
  const worker=setup();
  await worker.send('prefetch',{urls:[destinationPhoto,destinationMobilePhoto,landsDepartmentLogo],saveData:true}).done;
  assert.equal(worker.calls(),0);
  assert.equal((await worker.fetchUrl(destinationPhoto)).response.status,200);
  assert.equal(worker.calls(),1);
  for (const options of [{headers:{range:'bytes=0-5'}},{cache:'no-store'},{headers:{authorization:'Bearer abc'}}]) {
    assert.equal((await worker.fetchUrl(destinationPhoto,options)).intercepted,false);
  }
});
