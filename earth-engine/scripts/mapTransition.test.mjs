import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {createMapTransition} from '../src/mapTransition.js';

const expectedOverview = {z:11, x:1105, y:678};
const expectedDetail = {z:14, x:8843, y:5429};
const mainSource=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
function actualQualityFallback(globals){
  const start=mainSource.indexOf('onQualityTimeout:()=>{');
  const end=mainSource.indexOf('\n  },\n  arrivalTiles:',start);
  assert.ok(start>=0&&end>start,'the actual main arrival quality callback must exist');
  const body=mainSource.slice(start+'onQualityTimeout:()=>{'.length,end);
  return runInNewContext(`(()=>{${body}\n})`,globals);
}
function setupTransition(t, {automaticFrames = true, arrivalReady = () => false, qualityRequired=()=>false,
  qualityTimeoutMs=8000,onQualityTimeout=null} = {}) {
  const previousDocument = globalThis.document;
  t.mock.timers.enable({apis:['setTimeout']});
  const makeElement = () => {
    const classes = new Set();
    return {hidden:false,textContent:'',src:'',
      classList:{add:value=>classes.add(value),remove:value=>classes.delete(value),contains:value=>classes.has(value)},
      append(...children){this.children=children;},removeAttribute(name){delete this[name];},setAttribute(){}};
  };
  globalThis.document = {createElement:makeElement};
  const map = new EventEmitter();
  const cameraCalls = [];
  let appliedOffset = [0,0];
  let captures = 0;
  map.getCanvas = () => ({toDataURL:() => {captures++; return `data:image/jpeg;base64,${'a'.repeat(6000)}`;}});
  map.triggerRepaint = () => {if (automaticFrames) queueMicrotask(() => map.emit('render'));};
  map.jumpTo = options => {
    cameraCalls.push({method:'jumpTo',options});appliedOffset=[0,0];
    if (automaticFrames) queueMicrotask(() => map.emit('render'));
  };
  map.easeTo = options => {cameraCalls.push({method:'easeTo',options});appliedOffset=options.offset;};
  map.isSourceLoaded = () => false; // The horizon is still downloading.
  const container = {append(veil,cue){this.veil=veil;this.cue=cue;}};
  const transition = createMapTransition(map,{container,arrivalTiles:() => [expectedOverview,expectedDetail],arrivalReady,qualityRequired,qualityTimeoutMs,onQualityTimeout});
  t.after(() => {transition.cancel();globalThis.document=previousDocument;});
  const tileComplete = (sourceId, tile, properties = {}) => {
    // Real MapLibre tile completion shape: sourceDataType is not 'content'.
    map.emit('sourcedata',{type:'sourcedata',dataType:'source',sourceId,
      coord:{canonical:tile},tile:{state:'loaded'},...properties});
  };
  return {map,container,transition,tileComplete,captures:() => captures,cameraCalls,
    projectDestination:({width,height})=>({x:width/2+appliedOffset[0],y:height/2+appliedOffset[1]})};
}

test('real overview tile completion releases after paint without waiting for the horizon', async t => {
  const {map,container,transition,tileComplete} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  assert.equal(container.veil.hidden,false);
  tileComplete('esa-overview',expectedOverview);
  assert.equal(container.veil.classList.contains('is-releasing'),false); // Not painted yet.
  map.emit('render');
  assert.equal(container.veil.classList.contains('is-releasing'),true);
  assert.equal(container.cue.textContent,'Refining map detail near Cottbus');
  t.mock.timers.tick(250);
  assert.equal(container.veil.hidden,true);
  tileComplete('esa',expectedDetail);
  map.emit('render');
  assert.equal(container.cue.hidden,true);
  assert.equal(map.listenerCount('render'),0);
  assert.equal(map.listenerCount('sourcedata'),0);
  t.mock.timers.tick(6500);
  assert.equal(container.cue.hidden,true); // Old approach/refinement timers cannot revive it.
});

test('sharp centre completion can release directly and removes every observer', async t => {
  const {map,container,transition,tileComplete} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  tileComplete('esa',expectedDetail);
  map.emit('render');
  assert.equal(container.cue.hidden,true);
  assert.equal(map.listenerCount('render'),0);
  assert.equal(map.listenerCount('sourcedata'),0);
  t.mock.timers.tick(7000);
  assert.equal(container.veil.hidden,true);
  assert.equal(container.cue.hidden,true);
});

test('bursts of centre completions coalesce into one paint callback', async t => {
  const {map,container,transition,tileComplete} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  tileComplete('esa-overview',expectedOverview);
  tileComplete('esa-overview',expectedOverview);
  tileComplete('esa',expectedDetail);
  assert.equal(map.listenerCount('render'),2); // Progress + one actual paint waiter.
  map.emit('render');
  assert.equal(container.cue.hidden,true);
  assert.equal(map.listenerCount('render'),0);
  assert.equal(map.listenerCount('sourcedata'),0);
});

test('bounded fallback releases unavailable imagery and eventually removes observers', async t => {
  const {map,container,transition} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  t.mock.timers.tick(2799);
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  t.mock.timers.tick(1);
  assert.equal(container.veil.classList.contains('is-releasing'),true);
  assert.equal(container.cue.textContent,'Refining map detail near Cottbus');
  t.mock.timers.tick(250);
  assert.equal(container.veil.hidden,true);
  t.mock.timers.tick(6000);
  assert.equal(container.cue.hidden,true);
  assert.equal(map.listenerCount('render'),0);
  assert.equal(map.listenerCount('sourcedata'),0);
  t.mock.timers.tick(8000);map.emit('render');
  assert.equal(container.cue.hidden,true);
});

test('a previously loaded tile is not assumed to survive decoded-cache eviction', async t => {
  const {map,container,transition,tileComplete} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  tileComplete('esa',expectedDetail);map.emit('render');
  t.mock.timers.tick(250);
  // Revisit with no new completion. Historical keys/frames alone cannot prove
  // raster residency: MapLibre may have recycled the earlier GPU texture.
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  map.emit('render');map.emit('render');
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  assert.equal(container.veil.hidden,false);
  assert.equal(container.cue.textContent,'Approaching Cottbus');
});

test('owned current landing releases and hides cues after paint while every horizon source is pending',async t=>{
  let ready=false;
  const {map,container,transition}=setupTransition(t,{arrivalReady:()=>ready});
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  ready=true;
  map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:'owned-image'});
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  map.emit('render');
  assert.equal(container.veil.classList.contains('is-releasing'),true);
  assert.equal(container.cue.hidden,true);
  assert.equal(map.listenerCount('render'),0);assert.equal(map.listenerCount('sourcedata'),0);
  t.mock.timers.tick(8000);
  assert.equal(container.veil.hidden,true);assert.equal(container.cue.hidden,true);
});

test('even a prepared owned landing cannot release before the post-jump target render',async t=>{
  const {map,container,transition}=setupTransition(t,{automaticFrames:false,arrivalReady:()=>true});
  const pending=transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  map.emit('render');await pending; // Only the old map capture has painted.
  map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:'owned-image'});
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  map.emit('render');
  assert.equal(container.veil.classList.contains('is-releasing'),true);
  assert.equal(container.cue.hidden,true);
});

test('mobile handoff applies bottom-sheet offset locally with no animation before its first arrival paint',async t=>{
  const state=setupTransition(t,{automaticFrames:false,arrivalReady:()=>true});
  const target={center:[13.41,52.52],zoom:17.05,pitch:54,bearing:42,offset:[0,-243]};
  const pending=state.transition.jump(target,'Berlin');
  state.map.emit('render');await pending; // Capture only; target frame has not rendered.
  assert.deepEqual(state.cameraCalls.map(item=>item.method),['jumpTo','easeTo']);
  const local=state.cameraCalls[1].options;
  assert.deepEqual(local.center,target.center);assert.deepEqual(local.offset,target.offset);
  assert.equal(local.duration,0);assert.equal(local.animate,false);
  assert.deepEqual(state.projectDestination({width:427,height:844}),{x:213.5,y:179});
  assert.equal(state.container.veil.classList.contains('is-releasing'),false);
  state.map.emit('render'); // Both camera changes are reflected in this one frame.
  assert.equal(state.container.veil.classList.contains('is-releasing'),true);
  assert.equal(state.container.cue.hidden,true);
  assert.equal(state.map.listenerCount('render'),0);
});

test('desktop handoff preserves a horizontal panel offset through the supported immediate API',async t=>{
  const state=setupTransition(t,{arrivalReady:()=>true});
  await state.transition.jump({center:[114.17,22.27],zoom:17.05,pitch:54,offset:[-390,0]},'Hong Kong');
  assert.deepEqual(state.cameraCalls.map(item=>item.method),['jumpTo','easeTo']);
  assert.equal(state.cameraCalls[1].options.duration,0);assert.equal(state.cameraCalls[1].options.animate,false);
  assert.deepEqual(state.projectDestination({width:1440,height:900}),{x:330,y:450});
  assert.equal(state.container.cue.hidden,true);
});

test('zero or invalid offsets do not create a second camera change, while PointLike offsets work',async t=>{
  const state=setupTransition(t);
  for(const offset of [undefined,[0,0],[0,NaN],[Infinity,0],[4],[4,0,2]]) {
    state.cameraCalls.length=0;
    await state.transition.jump({center:[14.326,51.767],zoom:17.05,offset},'Cottbus');
    assert.deepEqual(state.cameraCalls.map(item=>item.method),['jumpTo']);
  }
  state.cameraCalls.length=0;
  await state.transition.jump({center:[14.326,51.767],zoom:17.05,offset:{x:175,y:0}},'Cottbus');
  assert.deepEqual(state.cameraCalls[1].options.offset,[175,0]);
});

test('synchronous camera cancellation cannot apply a stale offset or install a stale first-paint waiter',async t=>{
  const state=setupTransition(t,{automaticFrames:false,arrivalReady:()=>true});
  state.map.jumpTo=options=>{state.cameraCalls.push({method:'jumpTo',options});state.transition.cancel();};
  const pending=state.transition.jump({center:[14.326,51.767],zoom:17.05,offset:[0,-243]},'Cottbus');
  state.map.emit('render');await pending;
  assert.deepEqual(state.cameraCalls.map(item=>item.method),['jumpTo']);
  assert.equal(state.map.listenerCount('render'),0);assert.equal(state.map.listenerCount('sourcedata'),0);
  state.map.emit('render');t.mock.timers.tick(8000);
  assert.equal(state.container.veil.hidden,true);assert.equal(state.container.cue.hidden,true);
});

test('unrelated or unfinished tiles cannot release a different achievement arrival', async t => {
  const {map,container,transition,tileComplete} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  tileComplete('esa',{...expectedDetail,x:expectedDetail.x+1});
  tileComplete('other-imagery',expectedDetail);
  tileComplete('esa',expectedDetail,{tile:{state:'loading'}});
  map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:'esa'});
  map.emit('render');
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  assert.equal(container.veil.hidden,false);
  transition.cancel();
  assert.equal(map.listenerCount('render'),0);
  assert.equal(map.listenerCount('sourcedata'),0);
});

test('cancel removes queued centre render callbacks and no stale chip touches the next arrival', async t => {
  const {map,container,transition,tileComplete} = setupTransition(t);
  await transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  tileComplete('esa-overview',expectedOverview); // Next render callback is queued.
  transition.cancel();
  assert.equal(map.listenerCount('render'),0);
  assert.equal(map.listenerCount('sourcedata'),0);
  t.mock.timers.tick(8000);
  map.emit('render');
  assert.equal(container.cue.hidden,true);
  await transition.jump({center:[114.17,22.27],zoom:17.05},'Hong Kong');
  t.mock.timers.tick(450);
  assert.equal(container.cue.textContent,'Approaching Hong Kong');
  assert.equal(container.cue.hidden,false);
});

test('capture cancellation and timeout leave no deferred framebuffer readback', async t => {
  const {map,transition,captures} = setupTransition(t,{automaticFrames:false});
  const cancelled = transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  assert.equal(map.listenerCount('render'),1);
  transition.cancel();
  await cancelled;
  assert.equal(map.listenerCount('render'),0);
  map.emit('render');
  assert.equal(captures(),0);
  const timed = transition.jump({center:[14.326,51.767],zoom:17.05},'Cottbus');
  t.mock.timers.tick(150); await timed;
  // Only the actual arrival's observer/first-paint callbacks remain; capture
  // itself cannot read back a much later, unrelated canvas frame.
  transition.cancel();
  assert.equal(map.listenerCount('render'),0);
  map.emit('render');
  assert.equal(captures(),0);
});

test('an already-warm arrival does not revive a stale approaching cue', async () => {
  const previousDocument = globalThis.document;
  const makeElement = () => {
    const classes = new Set();
    return {
      hidden:false, textContent:'', src:'',
      classList:{add:value=>classes.add(value), remove:value=>classes.delete(value)},
      append(...children){ this.children = children; },
      removeAttribute(name){ delete this[name]; },
      setAttribute(){},
    };
  };
  globalThis.document = {createElement:makeElement};
  try {
    const map = new EventEmitter();
    map.getCanvas = () => ({toDataURL:() => `data:image/jpeg;base64,${'a'.repeat(6000)}`});
    map.triggerRepaint = () => setTimeout(() => map.emit('render'), 0);
    map.jumpTo = () => setTimeout(() => map.emit('render'), 0);
    map.isSourceLoaded = () => true;
    const container = {append(veil, cue){ this.veil = veil; this.cue = cue; }};
    const transition = createMapTransition(map, {container});
    await transition.jump({center:[11.66,48.26],zoom:13.8}, 'Munich');
    await new Promise(resolve => setTimeout(resolve, 520));
    assert.equal(container.veil.hidden, true);
    assert.equal(container.cue.hidden, true);
    transition.cancel();
  } finally {
    globalThis.document = previousDocument;
  }
});


test('HQ arrivals ignore overview, ESA centre and global loaded flags until native photo and textured chapter are ready',async t=>{
  let photoReady=false,chapterReady=false;
  const {map,container,transition,tileComplete}=setupTransition(t,{qualityRequired:()=>true,
    arrivalReady:()=>photoReady&&chapterReady});
  await transition.jump({center:[13.795,52.399],zoom:17.05},'Tesla');
  map.isSourceLoaded=()=>true;
  tileComplete('esa-overview',expectedOverview);tileComplete('esa',expectedDetail);map.emit('render');
  t.mock.timers.tick(2800);map.emit('render');
  assert.equal(container.veil.classList.contains('is-releasing'),false);assert.equal(container.veil.hidden,false);
  assert.equal(container.cue.textContent,'Refining map detail near Tesla');
  photoReady=true;map.emit('render');assert.equal(container.veil.classList.contains('is-releasing'),false);
  chapterReady=true;map.emit('sourcedata',{dataType:'source',sourceDataType:'content',sourceId:'actual-photo'});
  assert.equal(container.veil.classList.contains('is-releasing'),false,'source update alone is not target paint');
  map.emit('render');assert.equal(container.veil.classList.contains('is-releasing'),true);
  assert.equal(container.cue.hidden,true);assert.equal(map.listenerCount('render'),0);assert.equal(map.listenerCount('sourcedata'),0);
  t.mock.timers.tick(8000);assert.equal(container.veil.hidden,true);assert.equal(container.cue.hidden,true);
});

test('prepared HQ imagery still requires the post-jump camera paint',async t=>{
  const {map,container,transition}=setupTransition(t,{automaticFrames:false,qualityRequired:()=>true,arrivalReady:()=>true});
  const pending=transition.jump({center:[13.795,52.399],zoom:17.05},'Tesla');
  map.emit('render');await pending;
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  map.emit('sourcedata',{dataType:'source',sourceDataType:'metadata',sourceId:'actual-photo'});
  assert.equal(container.veil.classList.contains('is-releasing'),false);
  map.emit('render');assert.equal(container.veil.classList.contains('is-releasing'),true);
  assert.equal(container.cue.hidden,true);
});

test('HQ timeout calls honest camera fallback exactly once and releases only its subsequent paint',async t=>{
  const callbacks=[];
  const state=setupTransition(t,{automaticFrames:false,qualityRequired:()=>true,
    onQualityTimeout:({target,label})=>{callbacks.push({target,label});state.map.jumpTo({...target,zoom:14});}});
  const target={center:[13.795,52.399],zoom:17.05};
  const pending=state.transition.jump(target,'Tesla');state.map.emit('render');await pending;state.map.emit('render');
  state.map.isSourceLoaded=()=>true;
  t.mock.timers.tick(7999);assert.equal(callbacks.length,0);assert.equal(state.container.veil.classList.contains('is-releasing'),false);
  t.mock.timers.tick(1);assert.equal(callbacks.length,1);assert.equal(callbacks[0].target,target);assert.equal(callbacks[0].label,'Tesla');
  assert.equal(state.cameraCalls.at(-1).options.zoom,14);
  assert.equal(state.container.veil.classList.contains('is-releasing'),false,'fallback camera must first paint');
  state.map.emit('render');assert.equal(state.container.veil.classList.contains('is-releasing'),true);
  assert.equal(state.container.cue.textContent,'Refining map detail near Tesla');assert.equal(state.container.cue.hidden,false,'global loaded is not sharp-photo completion');
  t.mock.timers.tick(250);assert.equal(state.container.veil.hidden,true);
  t.mock.timers.tick(10000);assert.equal(callbacks.length,1);assert.equal(state.container.cue.hidden,true);
  assert.equal(state.map.listenerCount('render'),0);assert.equal(state.map.listenerCount('sourcedata'),0);
});

test('actual Hero arrival timeout retains the native clickable radar camera and open notes while imagery is pending',async t=>{
  const detail={hidden:false};
  const globals={activeEvent:{slug:'european-defense-tech-2025-munich'},
    HERO_VENUE_EVENT:'european-defense-tech-2025-munich',venueSceneSelected:true,cityDetailOn:true,
    $:id=>{assert.equal(id,'detail');return detail;},
    activeGameScene:()=>({gameIsActive:()=>false}),framePhysicalGame(){assert.fail('an idle arrival must not start or frame a game');},
    destinationQualityReady:()=>false};
  const state=setupTransition(t,{automaticFrames:false,qualityRequired:()=>true,
    onQualityTimeout:()=>actualQualityFallback({...globals,map:state.map})()});
  state.map.getZoom=()=>state.cameraCalls.at(-1).options.zoom;
  const target={center:[11.666695,48.262270],zoom:20.23,pitch:68,bearing:285,offset:[-390,0]};
  const pending=state.transition.jump(target,'Munich');state.map.emit('render');await pending;state.map.emit('render');
  assert.equal(state.cameraCalls.length,2,'the original arrival applies its supported popup offset');
  t.mock.timers.tick(8000);
  assert.equal(state.cameraCalls.length,2,'slow imagery must not zoom the radar below the native picking threshold');
  assert.equal(state.map.getZoom(),20.23);
  assert.deepEqual(state.projectDestination({width:1440,height:900}),{x:330,y:450});
  assert.equal(detail.hidden,false,'the notes remain open until the user clicks the exhibit');
  state.map.emit('render');t.mock.timers.tick(250);
  assert.equal(state.container.veil.hidden,true,'the retained exhibit becomes usable after the bounded quality wait');
  t.mock.timers.tick(6000);
  assert.equal(state.container.cue.hidden,true);assert.equal(state.map.listenerCount('render'),0);
});

test('actual quality callback preserves active game framing and the existing wide fallback outside close Hero notes',()=>{
  const detail={hidden:false},calls=[];
  const globals={activeEvent:{slug:'european-defense-tech-2025-munich'},
    HERO_VENUE_EVENT:'european-defense-tech-2025-munich',venueSceneSelected:true,cityDetailOn:true,
    $:()=>detail,activeGameScene:()=>({gameIsActive:()=>false}),
    framePhysicalGame:()=>calls.push('game'),destinationQualityReady:()=>false,
    map:{getZoom:()=>20.23,easeTo:options=>calls.push(options)}};
  for(const override of [{activeEvent:{slug:'tesla-gigathon-2026'}},{venueSceneSelected:false},
    {cityDetailOn:false},{map:{...globals.map,getZoom:()=>16.9}}]){
    calls.length=0;actualQualityFallback({...globals,...override})();
    assert.deepEqual(calls.map(call=>({...call})),[{zoom:13.8,pitch:43,duration:0,animate:false}]);
  }
  detail.hidden=true;calls.length=0;actualQualityFallback(globals)();
  assert.equal(calls[0].zoom,13.8);
  calls.length=0;actualQualityFallback({...globals,activeGameScene:()=>({gameIsActive:()=>true})})();
  assert.deepEqual(calls,['game'],'a playing exhibit still uses the dedicated game camera');
  calls.length=0;actualQualityFallback({...globals,destinationQualityReady:()=>true})();
  assert.deepEqual(calls,[],'ready native imagery needs no fallback');
});

test('HQ quality fallback is bounded even when a background tab produces no paint',async t=>{
  let callbacks=0;
  const {map,container,transition}=setupTransition(t,{automaticFrames:false,qualityRequired:()=>true,
    qualityTimeoutMs:1000,onQualityTimeout:()=>{callbacks++;}});
  const pending=transition.jump({center:[13.795,52.399],zoom:17.05},'Tesla');map.emit('render');await pending;
  t.mock.timers.tick(1000);assert.equal(callbacks,1);assert.equal(container.veil.classList.contains('is-releasing'),false);
  t.mock.timers.tick(150);assert.equal(container.veil.classList.contains('is-releasing'),true);
  t.mock.timers.tick(250);assert.equal(container.veil.hidden,true);
  t.mock.timers.tick(6000);assert.equal(map.listenerCount('render'),0);assert.equal(map.listenerCount('sourcedata'),0);
});

test('cancelled HQ timeout and stale photo completion cannot affect the next ordinary arrival',async t=>{
  let requiresQuality=true,ready=false,calls=0;
  const state=setupTransition(t,{qualityRequired:()=>requiresQuality,arrivalReady:()=>ready,onQualityTimeout:()=>{calls++;}});
  await state.transition.jump({center:[13.795,52.399],zoom:17.05},'Tesla');
  t.mock.timers.tick(4000);state.transition.cancel();requiresQuality=false;
  await state.transition.jump({center:[114.17,22.27],zoom:14},'Hong Kong');
  t.mock.timers.tick(2800);assert.equal(state.container.veil.classList.contains('is-releasing'),true);
  ready=true;state.map.emit('render');t.mock.timers.tick(8000);
  assert.equal(calls,0);assert.equal(state.container.cue.hidden,true);
  assert.equal(state.map.listenerCount('render'),0);assert.equal(state.map.listenerCount('sourcedata'),0);
});

test('a synchronous cancel inside quality fallback cannot install stale paint or grace callbacks',async t=>{
  let calls=0;
  const state=setupTransition(t,{qualityRequired:()=>true,onQualityTimeout:()=>{calls++;state.transition.cancel();}});
  await state.transition.jump({center:[13.795,52.399],zoom:17.05},'Tesla');
  t.mock.timers.tick(8000);assert.equal(calls,1);assert.equal(state.container.veil.hidden,true);
  assert.equal(state.map.listenerCount('render'),0);assert.equal(state.map.listenerCount('sourcedata'),0);
  state.map.emit('render');t.mock.timers.tick(10000);assert.equal(calls,1);assert.equal(state.container.cue.hidden,true);
});

test('a failing quality policy conservatively retains the gate rather than declaring coarse tiles complete',async t=>{
  const state=setupTransition(t,{qualityRequired:()=>{throw new Error('unavailable policy');}});
  await state.transition.jump({center:[13.795,52.399],zoom:17.05},'Tesla');state.map.isSourceLoaded=()=>true;
  state.map.emit('render');t.mock.timers.tick(2800);
  assert.equal(state.container.veil.classList.contains('is-releasing'),false);
  assert.equal(state.container.cue.textContent,'Refining map detail near Tesla');state.transition.cancel();
});
