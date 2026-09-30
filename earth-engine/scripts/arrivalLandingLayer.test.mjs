import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createArrivalLandingLayer,validateArrivalLandings,decodeArrivalImage} from '../src/arrivalLandingLayer.js';
import actualManifest from '../src/data/arrivalLandings.json' with {type:'json'};

const slugs = Object.keys(actualManifest.events);
const first = slugs[0];
const second = slugs.find(slug => actualManifest.events[slug] !== actualManifest.events[first]);
const turn = () => new Promise(resolve => setTimeout(resolve,0));
async function until(predicate) {
  for (let attempt=0;attempt<100;attempt++) {if (predicate()) return;await turn();}
  assert.fail('Controlled arrival image did not reach expected state');
}
function setup(t,{fetcher,imageDecoder,automaticSourceCompletion=false,landingOptions={}}={}) {
  const manifest = structuredClone(actualManifest);
  for (const item of Object.values(manifest.landings)) item.bytes=4;
  const map = new EventEmitter(),sources=new Map(),layers=new Map();
  const calls=[],created=[],revoked=[],changes=[],operations=[];
  let zoom=17.05,repaints=0,visibility='visible';
  let bounds={west:-180,east:180,south:-85,north:85};
  layers.set('bavaria-imagery',{id:'bavaria-imagery'});
  map.getSource=id=>sources.get(id);
  map.getLayer=id=>layers.get(id);
  map.getZoom=()=>zoom;
  map.getLayoutProperty=()=>visibility;
  map.getBounds=()=>({getWest:()=>bounds.west,getEast:()=>bounds.east,
    getSouth:()=>bounds.south,getNorth:()=>bounds.north});
  map.isSourceLoaded=id=>sources.get(id)?.loaded===true;
  map.triggerRepaint=()=>{repaints++;};
  const makeSource=(id,spec)=>({...spec,loaded:true,updateImage({image}) {
    this.pixels=image;this.loaded=automaticSourceCompletion;
    map.emit('sourcedata',{dataType:'source',sourceDataType:'content',sourceId:id});
    map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:id});
  }});
  map.addSource=(id,spec)=>{
    sources.set(id,makeSource(id,spec));operations.push(['addSource',id]);
    // Actual empty ImageSource.onAdd completes synchronously with no pixels.
    map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:id});
  };
  map.addLayer=(spec,before)=>{layers.set(spec.id,spec);operations.push(['addLayer',spec.id,before]);};
  map.removeLayer=id=>{layers.delete(id);operations.push(['removeLayer',id]);};
  map.removeSource=id=>{assert.ok(![...layers.values()].some(item=>item.source===id));
    sources.delete(id);operations.push(['removeSource',id]);};
  const response=()=>new Response('RIFF',{headers:{'content-type':'image/webp'}});
  const layer=createArrivalLandingLayer({manifest,baseUrl:'/preview/',
    fetcher:(url,options)=>{calls.push({url,options});return fetcher?fetcher(url,options,response):response();},
    imageDecoder:imageDecoder??(async blob=>{
      const id=`image:arrival-${created.length+1}`,image={id,width:768,height:768};
      created.push({id,image,blob});return {image,dispose:()=>revoked.push(id)};
    }),onChange:stats=>changes.push(stats),...landingOptions});
  layer.addTo(map);
  t.after(()=>layer.onRemove());
  const complete=(id=layer.getStats().sourceId)=>{
    if(sources.has(id))sources.get(id).loaded=true;
    map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:id});
  };
  return {layer,map,calls,sources,layers,created,revoked,changes,operations,complete,response,makeSource,
    paint:()=>map.emit('render',{type:'render'}),repaints:()=>repaints,
    camera(nextZoom,nextBounds=bounds){zoom=nextZoom;bounds=nextBounds;},
    visibility(value){visibility=value;}};
}

test('all real mosaics use bounded native pixels and exact source-grid coordinates',()=>{
  assert.equal(validateArrivalLandings(actualManifest),actualManifest);
  assert.equal(Object.keys(actualManifest.events).length,32);
  assert.equal(Object.keys(actualManifest.landings).length,27);
  for(const mutation of [
    item=>{item.coordinates.reverse();}, item=>{item.coordinates[0][0]+=.01;},
    item=>{item.width=1024;}, item=>{item.bytes=1_200_001;},
    item=>{item.url='/unknown.webp';}
  ]) {
    const damaged=structuredClone(actualManifest);mutation(damaged.landings[damaged.events[first]]);
    assert.throws(()=>validateArrivalLandings(damaged));
  }
  assert.throws(()=>validateArrivalLandings({...actualManifest,events:{missing:'14/0/0'}}));
});

test('only owned completion plus target paint is ready, below official imagery',async t=>{
  const state=setup(t);state.layer.setFocus(first);
  await until(()=>state.layer.getStats().activeSources===1);
  const id=state.layer.getStats().sourceId;
  assert.equal(state.calls[0].options.cache,'force-cache');
  assert.equal(state.calls[0].options.priority,'high');
  assert.ok(state.calls[0].url.startsWith('/preview/assets/arrival/landing-'));
  assert.equal(state.layer.isReadyFor(first),false);
  state.paint();assert.equal(state.layer.isReadyFor(first),false);
  state.complete(id);assert.equal(state.layer.isReadyFor(first),false);
  const before=state.repaints();state.paint();
  assert.equal(state.layer.isReadyFor(first),true);
  assert.equal(state.layer.isReadyFor(second),false);
  assert.equal(state.layer.getStats().estimatedDecodedRgbaBytes,768*768*4);
  assert.equal(state.repaints(),before+1); // Exactly one readiness follow-up paint.
  state.paint();assert.equal(state.repaints(),before+1);
  assert.equal(state.map.listenerCount('render'),0);
  const installed=[...state.layers.values()].find(item=>item.source===id);
  assert.equal(installed.minzoom,12);assert.equal(installed.paint['raster-fade-duration'],0);
  assert.equal(installed.paint['raster-brightness-max'],1);
  assert.equal(state.operations.find(item=>item[0]==='addLayer')[2],'bavaria-imagery');
});

test('world/hidden/different city is not ready, but offset viewport overlap is allowed',async t=>{
  const state=setup(t);state.camera(2);state.layer.setFocus(first);
  await until(()=>state.layer.getStats().activeSources===1);state.complete();state.paint();
  assert.equal(state.layer.isReadyFor(first),false);
  state.camera(13.8,{west:-.1,east:.1,south:-.1,north:.1});state.paint();
  assert.equal(state.layer.isReadyFor(first),false);
  const [tl,,br]=actualManifest.landings[actualManifest.events[first]].coordinates;
  // A camera centre outside the patch would still be legal: only viewport
  // overlap is relevant to a side-panel-offset achievement view.
  state.camera(13.8,{west:br[0]-.001,east:br[0]+.1,south:br[1],north:tl[1]});
  state.paint();assert.equal(state.layer.isReadyFor(first),true);
  state.visibility('none');assert.equal(state.layer.isReadyFor(first),false);
  state.visibility('visible');state.camera(2);assert.equal(state.layer.isReadyFor(first),false);
});

test('rapid navigation aborts old transfers and ignored aborts cannot create stale sources',async t=>{
  const finishes=[];
  const state=setup(t,{fetcher:()=>new Promise(resolve=>finishes.push(resolve))});
  state.layer.setFocus(first);state.layer.setFocus(second);
  assert.equal(state.calls.length,2);assert.equal(state.calls[0].options.signal.aborted,true);
  finishes[0](state.response());await turn();
  assert.equal(state.created.length,0);assert.equal(state.sources.size,0);
  finishes[1](state.response());await until(()=>state.sources.size===1);
  state.complete();state.paint();
  assert.equal(state.layer.isReadyFor(second),true);
  assert.equal(state.layer.isReadyFor(first),false);
  assert.equal(state.created.length,1);
});

test('revisit uses a new current source, and old completion cannot certify it',async t=>{
  const state=setup(t);state.layer.setFocus(first);
  await until(()=>state.sources.size===1);state.complete();state.paint();
  const oldId=state.layer.getStats().sourceId;
  state.layer.setFocus(second);
  assert.equal(state.sources.size,0);assert.deepEqual(state.revoked,['image:arrival-1']);
  await until(()=>state.sources.size===1);
  state.complete(oldId);state.paint();
  assert.equal(state.layer.isReadyFor(second),false);
  state.complete();state.paint();assert.equal(state.layer.isReadyFor(second),true);
  state.layer.setFocus(first);await until(()=>state.sources.size===1);
  assert.notEqual(state.layer.getStats().sourceId,oldId);
  state.paint();assert.equal(state.layer.isReadyFor(first),false);
  state.complete();state.paint();assert.equal(state.layer.isReadyFor(first),true);
  assert.equal(state.sources.size,1);assert.equal(state.created.length,3);
  state.layer.setFocus(null);
  assert.equal(state.sources.size,0);assert.equal(state.revoked.length,3);
  assert.equal(state.layer.getStats().estimatedDecodedRgbaBytes,0);
});

function sharedLandingSlugs() {
  const entries=Object.entries(actualManifest.events);
  const [slug,key]=entries.find(([slug,key])=>entries.some(([other,value])=>other!==slug&&value===key));
  return [slug,entries.find(([other,value])=>other!==slug&&value===key)[0]];
}

test('exact shared manifest key reuses one decoded image while readiness follows the new slug',async t=>{
  const [a,b]=sharedLandingSlugs();const state=setup(t);
  state.layer.setFocus(a);await until(()=>state.sources.size===1);state.complete();state.paint();
  const id=state.layer.getStats().sourceId;
  state.layer.setFocus(b);
  assert.equal(state.layer.isReadyFor(a),false);assert.equal(state.layer.isReadyFor(b),true);
  assert.equal(state.layer.getStats().sourceId,id);assert.equal(state.calls.length,1);
  assert.equal(state.sources.size,1);assert.equal(state.created.length,1);assert.equal(state.revoked.length,0);
});

test('exact shared key reuses pending fetch without admitting the old achievement as ready',async t=>{
  let finish;const [a,b]=sharedLandingSlugs();
  const state=setup(t,{fetcher:()=>new Promise(resolve=>{finish=resolve;})});
  state.layer.setFocus(a);state.layer.setFocus(b);
  assert.equal(state.calls.length,1);assert.equal(state.calls[0].options.signal.aborted,false);
  finish(state.response());await until(()=>state.sources.size===1);
  state.complete();state.paint();
  assert.equal(state.layer.isReadyFor(a),false);assert.equal(state.layer.isReadyFor(b),true);
  assert.equal(state.sources.size,1);assert.equal(state.created.length,1);
});

test('disable/world/remove release source and owned pixels and leave no observers or speculation',async t=>{
  const state=setup(t);state.layer.setFocus(first);await until(()=>state.sources.size===1);
  state.complete();state.layer.setEnabled(false);
  assert.equal(state.map.listenerCount('render'),0);assert.equal(state.sources.size,0);
  assert.equal(state.revoked.length,1);assert.equal(state.layer.isReadyFor(first),false);
  state.layer.setFocus(second);assert.equal(state.calls.length,1);
  state.layer.setEnabled(true);await until(()=>state.sources.size===1);
  state.complete();state.paint();assert.equal(state.layer.isReadyFor(second),true);
  state.layer.onRemove();
  assert.equal(state.sources.size,0);assert.equal(state.revoked.length,2);
  assert.equal(state.map.listenerCount('render'),0);
  assert.equal(state.map.listenerCount('sourcedata'),0);assert.equal(state.map.listenerCount('error'),0);
  assert.equal(state.map.listenerCount('style.load'),0);
});

test('HTTP, MIME and oversized bodies fail safely; same selection can retry',async t=>{
  let attempt=0;
  const state=setup(t,{fetcher:()=>{
    attempt++;
    if(attempt===1)return new Response('fail',{status:503});
    if(attempt===2)return new Response('RIFF',{headers:{'content-type':'text/html'}});
    if(attempt===3)return new Response('RIFFX',{headers:{'content-type':'image/webp'}});
    return new Response('RIFF',{headers:{'content-type':'image/webp'}});
  }});
  for(let index=1;index<=3;index++) {
    state.layer.setFocus(first);await until(()=>state.layer.getStats().failures===index);
    assert.equal(state.sources.size,0);assert.equal(state.created.length,0);
  }
  state.layer.setFocus(first);await until(()=>state.sources.size===1);
  state.complete();state.paint();assert.equal(state.layer.isReadyFor(first),true);
});

test('current image decode error removes only the owned source without a false ready result',async t=>{
  const state=setup(t);state.layer.setFocus(first);await until(()=>state.sources.size===1);
  const sourceId=state.layer.getStats().sourceId;
  state.map.emit('error',{sourceId:'other-provider'});assert.equal(state.sources.size,1);
  state.map.emit('error',{sourceId});
  state.complete(sourceId);state.paint();
  assert.equal(state.sources.size,0);assert.equal(state.revoked.length,1);
  assert.equal(state.layer.isReadyFor(first),false);assert.equal(state.layer.getStats().failures,1);
});

test('queue-free pixels use URL-less public updateImage and synchronous real completion safely',async t=>{
  const state=setup(t,{automaticSourceCompletion:true});state.layer.setFocus(first);
  await until(()=>state.sources.size===1);
  const source=state.sources.get(state.layer.getStats().sourceId);
  assert.equal(source.type,'image');assert.equal(source.url,undefined);
  assert.equal(source.pixels,state.created[0].image);
  assert.equal(state.layer.isReadyFor(first),false); // No post-load paint yet.
  state.paint();assert.equal(state.layer.isReadyFor(first),true);
  assert.equal(state.layer.getStats().decodes,1);assert.equal(state.layer.getStats().ownedDecodedImages,1);
  state.layer.setFocus(null);assert.equal(state.layer.getStats().closedImages,1);
});

test('uncancelable native decodes are serialized, obsolete queued work skips and late images close',async t=>{
  const finishes=[],closed=[];let inFlight=0,maxInFlight=0;
  const state=setup(t,{imageDecoder:()=>{
    const id=finishes.length;inFlight++;maxInFlight=Math.max(maxInFlight,inFlight);
    return new Promise(resolve=>finishes.push(()=>{inFlight--;resolve({image:{width:768,height:768},dispose:()=>closed.push(id)});}));
  }});
  state.layer.setFocus(first);await until(()=>finishes.length===1);
  state.layer.setFocus(second);await until(()=>state.calls.length===2);await turn();
  state.layer.setFocus(first);await until(()=>state.calls.length===3);await turn();
  assert.equal(finishes.length,1);assert.equal(state.layer.getStats().decoding,1);
  finishes[0]();await until(()=>finishes.length===2);
  assert.deepEqual(closed,[0]);assert.equal(state.sources.size,0);assert.equal(maxInFlight,1);
  finishes[1]();await until(()=>state.sources.size===1);state.complete();state.paint();
  assert.equal(state.layer.isReadyFor(first),true);assert.equal(state.layer.getStats().decodes,2);
  state.layer.setFocus(null);assert.deepEqual(closed,[0,1]);
});

test('wrong decoded dimensions close the bitmap and never install a source',async t=>{
  let closes=0;
  const state=setup(t,{imageDecoder:async()=>({image:{width:1024,height:768},dispose:()=>closes++})});
  state.layer.setFocus(first);await until(()=>state.layer.getStats().failures===1);
  assert.equal(closes,1);assert.equal(state.sources.size,0);assert.equal(state.layer.getStats().ownedDecodedImages,0);
});

test('context/style restoration reinjects retained pixels into the new public source without refetch',async t=>{
  const state=setup(t,{automaticSourceCompletion:true});state.layer.setFocus(first);
  await until(()=>state.sources.size===1);state.paint();
  const id=state.layer.getStats().sourceId,previous=state.sources.get(id);
  state.sources.set(id,state.makeSource(id,{type:'image',coordinates:previous.coordinates}));
  assert.equal(state.layer.isReadyFor(first),false);
  state.map.emit('style.load');assert.equal(state.layer.isReadyFor(first),false);
  state.paint();assert.equal(state.layer.isReadyFor(first),true);
  assert.equal(state.sources.get(id).pixels,state.created[0].image);
  assert.equal(state.calls.length,1);assert.equal(state.revoked.length,0);
  state.layer.onRemove();assert.equal(state.revoked.length,1);
});

test('native bitmap decoder retains pixels until teardown; legacy element fallback keeps and revokes its own URL',async()=>{
  let closed=0;
  const bitmap={width:768,height:768,close:()=>closed++};
  const native=await decodeArrivalImage(new Blob(['RIFF']),{bitmapFactory:async()=>bitmap});
  assert.equal(native.image,bitmap);assert.equal(closed,0);native.dispose();assert.equal(closed,1);
  const revoked=[];let src='',decodes=0;
  const element={naturalWidth:768,naturalHeight:768,decode:async()=>{decodes++;},
    set src(value){src=value;if(value)queueMicrotask(()=>element.onload?.());},get src(){return src;}};
  const fallback=await decodeArrivalImage(new Blob(['RIFF']),{bitmapFactory:null,imageFactory:()=>element,
    urlFactory:{createObjectURL:()=> 'blob:owned',revokeObjectURL:url=>revoked.push(url)}});
  assert.equal(element.src,'blob:owned');assert.equal(decodes,1);assert.deepEqual(revoked,[]);
  assert.equal(element.onload,null);fallback.dispose();
  assert.equal(element.src,'');assert.deepEqual(revoked,['blob:owned']);
});


test('borrowed roof wrapper is installed after raster and released before owned bitmap closes',async t=>{
  const lifecycle=[];
  const state=setup(t,{landingOptions:{
    onImageReady:({slug,image,metadata})=>{
      assert.equal(slug,first);assert.equal(image.width,768);assert.equal(metadata.width,768);
      assert.equal(state.layer.getStats().activeSources,1);
      assert.ok([...state.layers.values()].some(item=>item.source===state.layer.getStats().sourceId));
      lifecycle.push('borrow');
    },
    onBeforeImageRelease:({image})=>{
      assert.equal(state.sources.size,0);assert.equal(state.revoked.length,0);
      assert.equal(image.id,state.created[0].id);lifecycle.push('release-wrapper');
    }
  }});
  state.layer.setFocus(first);await until(()=>lifecycle.length===1);
  state.layer.setFocus(null);assert.deepEqual(lifecycle,['borrow','release-wrapper']);
  assert.equal(state.revoked.length,1);assert.equal(state.layer.getStats().ownedDecodedImages,0);
});

test('custom native-photo validator and decoded2048 pixels remain explicitly bounded',async t=>{
  const manifest=structuredClone(actualManifest);
  for(const patch of Object.values(manifest.landings)){patch.width=2048;patch.height=2048;patch.bytes=4;}
  let validated=0,closed=0,borrowed=0;
  const state=setup(t,{imageDecoder:async()=>({image:{width:2048,height:2048},dispose:()=>{closed++;}}),
    landingOptions:{manifest,manifestValidator:m=>{assert.equal(m,manifest);validated++;},
      maxImageBytes:4_000_000,minZoom:13,onImageReady:()=>{borrowed++;}}});
  assert.equal(validated,1);state.layer.setFocus(first);await until(()=>borrowed===1);
  state.complete();state.paint();assert.equal(state.layer.isReadyFor(first),true);
  assert.equal(state.layer.getStats().estimatedDecodedRgbaBytes,16_777_216);
  state.layer.setFocus(null);assert.equal(closed,1);
  assert.throws(()=>createArrivalLandingLayer({manifest,manifestValidator:()=>{},maxImageBytes:10_000_001}));
});
