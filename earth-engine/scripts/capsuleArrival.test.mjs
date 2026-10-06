import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';
import * as cameraHelpers from '../src/exhibitInspectionCamera.js';
import {selectExhibitRoof} from '../src/achievementSceneLayer.js';
import {CAPSULE_SCALE,CAPSULE_LAYOUT} from '../src/achievementCapsule.js';
import {EARTH_RADIUS_METRES} from '../src/geo.js';
import {getProject} from '../src/projectContent.js';

const mainSource=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const events=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url),'utf8'));
const chapters=JSON.parse(readFileSync(new URL('../public/data/achievement-context-v2.json',import.meta.url),'utf8')).chapters;
const first=events.find(event=>event.slug==='tesla-gigathon-2026');
const second=events.find(event=>event.slug==='pdm-kill-the-search-bar-2026');
const hero=events.find(event=>event.slug==='european-defense-tech-2025-munich');
const heroLocation=[11.666695,48.262270];
const plain=value=>JSON.parse(JSON.stringify(value));
const exhibitInspectionCamera=cameraHelpers.exhibitInspectionCamera;

/** Independent exact tangencies under installed MapLibre's offset ground ray. */
function sphereProjection(camera,width,height,{base,scale=4}){
  const distance=height/2/Math.tan(.6435011087932844/2),pitch=camera.pitch*Math.PI/180;
  const sin=Math.sin(pitch),cos=Math.cos(pitch),mpp=78271.51696*Math.cos(camera.center[1]*Math.PI/180)/2**camera.zoom;
  const shiftedNorth=-camera.offset[1]*distance/(distance*cos+camera.offset[1]*sin);
  const anchorDepth=distance+shiftedNorth*sin,centreY=(base+11*scale)/mpp,radius=10.15*scale/mpp;
  const lateral=camera.offset[0]*anchorDepth/distance,vertical=-(shiftedNorth*cos+centreY*sin),depth=anchorDepth-centreY*cos;
  const denominator=depth*depth-radius*radius;
  assert.ok(depth>radius&&denominator>0,'whole globe must remain in front of the actual perspective camera');
  const horizontalRoot=Math.sqrt(lateral*lateral+denominator),verticalRoot=Math.sqrt(vertical*vertical+denominator);
  return {left:width/2+distance*(lateral*depth-radius*horizontalRoot)/denominator,
    right:width/2+distance*(lateral*depth+radius*horizontalRoot)/denominator,
    top:height/2+distance*(vertical*depth-radius*verticalRoot)/denominator,
    bottom:height/2+distance*(vertical*depth+radius*verticalRoot)/denominator,
    expectedRawX:desiredScreenShiftX=>desiredScreenShiftX*denominator/(anchorDepth*depth)};
}

/** Execute the real main functions, without importing the DOM/WebGL application. */
function actualFunction(name){
  const start=mainSource.indexOf(`function ${name}(`);
  const end=mainSource.indexOf('\n}\n',start);
  assert.ok(start>=0&&end>start,`Missing actual main function ${name}`);
  return mainSource.slice(start,end+2);
}
const functions=['capsuleArrivalCamera','selectEvent','showWholeEarth'].map(actualFunction).join('\n');

function realRoof(event){
  const roof=selectExhibitRoof(chapters.find(chapter=>chapter.slugs.includes(event.slug)));
  const {lng,lat}=event.coordinates;
  return {center:[lng+roof.site[0]/(EARTH_RADIUS_METRES*Math.cos(lat*Math.PI/180))*180/Math.PI,
    lat+roof.site[1]/EARTH_RADIUS_METRES*180/Math.PI],base:roof.building.height+.15};
}

function fixture({ready=false,width=1440,height=900,panelOffset=[-260,-210]}={}){
  const calls={flights:[],ease:[],inspection:[],horizontal:[],popup:[],warm:[],status:[],focus:[],history:[],stops:0,cancels:0,clears:0};
  const state={contextReady:ready,sceneFocus:null,prepareCalls:0,prepareRequests:0,pending:null,resolve:null,
    cvOpen:false,drive:{active:false},cameraOverride:null};
  const elements=new Map();
  const $=id=>{
    if(!elements.has(id))elements.set(id,{hidden:true,disabled:false,title:'',clientWidth:width,clientHeight:height,click(){}});
    return elements.get(id);
  };
  const handlers=new Map();
  const map={stop(){calls.stops++;},easeTo(camera){calls.ease.push(plain(camera));},
    on(name,fn){if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},
    off(name,fn){handlers.get(name)?.delete(fn);},
    emit(name,event){for(const fn of [...handlers.get(name)??[]])fn(event);},
    listenerCount(name){return handlers.get(name)?.size??0;}};
  const current=()=>events.find(event=>event.slug===state.sceneFocus);
  const roof=()=>current()&&realRoof(current());
  const achievementScenes={
    setFocus(slug){state.sceneFocus=slug;calls.focus.push(slug);},
    getStats(){return {ready:!!state.sceneFocus,contextReady:state.contextReady,exhibitHeightM:this.getExhibitHeight()};},
    getExhibitFocus(){const event=current();return event?(state.contextReady?roof().center:[event.coordinates.lng,event.coordinates.lat]):null;},
    getExhibitBaseHeight(){return state.contextReady&&current()?roof().base:0;},
    getExhibitScale(){return state.sceneFocus?CAPSULE_SCALE:0;},
    getExhibitHeight(){return state.sceneFocus?(CAPSULE_LAYOUT.centerY+CAPSULE_LAYOUT.radius+.15)*CAPSULE_SCALE+this.getExhibitBaseHeight():0;},
    prepareAll(){
      state.prepareCalls++;
      if(state.contextReady)return Promise.resolve(true);
      if(!state.pending){
        state.prepareRequests++;
        state.pending=new Promise(resolve=>{state.resolve=resolve;}).then(()=>{state.contextReady=true;return true;});
      }
      return state.pending;
    }
  };
  const qualityCameraOverrides=new Map(events.map(event=>[event.slug,
    {center:[event.coordinates.lng,event.coordinates.lat],zoom:20.2,pitch:54,bearing:42}]));
  qualityCameraOverrides.set(hero.slug,{center:heroLocation,zoom:20.23,pitch:68,bearing:285});
  const initialCamera={center:[8,32],zoom:1.6,pitch:0,bearing:0};
  const layers=()=>({setFocus(){},setEnabled(){},setActive(){}});
  const globals={$,achievementScenes,map,qualityCameraOverrides,initialCamera,getProject,
    HERO_VENUE_EVENT:hero.slug,HERO_VENUE_LOCATION:heroLocation,
    drive:state.drive,cvView:{isOpen:()=>state.cvOpen},
    byCity:new Map(events.map(event=>[`${event.city}|${event.country}`,{key:`${event.city}|${event.country}`}])) ,
    keyOf:event=>`${event.city}|${event.country}`,
    destinationPatch:()=>null,
    arrivalLanding:layers(),orthophoto:layers(),isometricRegions:layers(),romeVenue:layers(),heroVenue:layers(),
    ISOMETRIC_EVENT_REGIONS:new Map([[first.slug,'tesla-gigafactory']]),
    persistentCache:{prefetch:()=>Promise.resolve(true)},regionalPreparationUrls:()=>[],
    driveStarts:new Set([hero.slug]),prefersReducedMotion:false,
    finishDrive(){state.drive.active=false;},closePopovers(){},syncSceneContext(){},syncTerrain(){},resumeTerrainAfterFlight(){},renderJourney(){},
    closeProjectGame(){calls.clears++;},mapTransition:{cancel(){calls.cancels++;}},
    detailMapOffset:()=>panelOffset,
    exhibitInspectionCamera(center,availableWidth,options){
      calls.inspection.push({center:plain(center),width:availableWidth,options:plain(options)});
      return state.cameraOverride?{...state.cameraOverride,center}:exhibitInspectionCamera(center,availableWidth,options);
    },
    exhibitCameraHorizontalOffset(camera,options){
      calls.horizontal.push({camera:plain(camera),options:plain(options)});
      return cameraHelpers.exhibitCameraHorizontalOffset(camera,options);
    },
    showEventDetail(event){calls.popup.push(event.slug);},
    fly(camera,options){calls.flights.push({camera:plain(camera),options:options?plain(options):null});return Promise.resolve();},
    status(text){calls.status.push(text);},warmAdjacentDestinations(event){calls.warm.push(event.slug);},
    applyImagery(){},portfolioUrl(href,{eventSlug,view}){const url=new URL(href);if(eventSlug)url.searchParams.set('event',eventSlug);if(view)url.searchParams.set('view',view);return url;},
    window:{location:{href:'https://batikanor.com/'},history:{pushState(...args){calls.history.push(args);},replaceState(...args){calls.history.push(args);}}}
  };
  const runtime=runInNewContext(`
    let activeEvent=null,activeCity=null,achievementFlightGeneration=0,cityDetailOn=true,venueSceneSelected=false;
    let imagery='esa',terrainResumeToken=0,terrainPausedForRome=false;
    ${functions}
    ({capsuleArrivalCamera,selectEvent,showWholeEarth,
      activate(event){activeEvent=event;venueSceneSelected=true;achievementScenes.setFocus(event.slug);},
      setDetail(enabled){cityDetailOn=enabled;},setVenue(enabled){venueSceneSelected=enabled;},
      get generation(){return achievementFlightGeneration;},get activeEvent(){return activeEvent;}});
  `,globals);
  return {runtime,state,calls,map,$,qualityCameraOverrides,initialCamera,
    async resolveContext(){assert.ok(state.resolve,'expected a real pending context preparation');state.resolve();await state.pending;await Promise.resolve();}};
}

test('arrival frames the real longest rooftop and fourfold height, not the obsolete image centre',()=>{
  const f=fixture({ready:true});f.runtime.activate(first);
  const roof=realRoof(first),camera=f.runtime.capsuleArrivalCamera(false),record=f.calls.inspection[0];
  assert.deepEqual(plain(camera.center),roof.center);
  assert.notDeepEqual(plain(camera.center),f.qualityCameraOverrides.get(first.slug).center);
  assert.equal(record.options.exhibitBaseM,roof.base);assert.equal(record.options.exhibitScale,4);
  assert.equal(record.options.exhibitHeightM,roof.base+84.6);assert.equal(record.width,1440);
  assert.equal(record.options.height,900);assert.equal(camera.offset[0],0);
});

test('popup framing moves sideways only and preserves the fitted raised-crown offset and native quality ceiling',()=>{
  const f=fixture({ready:true,width:1440,panelOffset:[-260,-210]});f.runtime.activate(first);
  f.state.cameraOverride={zoom:19.9,pitch:47,bearing:42,offset:[0,134]};
  f.qualityCameraOverrides.set(first.slug,{zoom:17.65,center:[0,0]});
  const camera=f.runtime.capsuleArrivalCamera(true);
  assert.equal(camera.zoom,17.65,'a framing change must not request finer photo sampling than the native tier');
  assert.equal(camera.offset[1],134,'the old popup Y offset must not shift/crop an elevated crown');
  const bounds=sphereProjection(camera,1440,900,{base:realRoof(first).base});
  assert.ok(Math.abs(camera.offset[0]-bounds.expectedRawX(-260))<1e-8,'map-offset X must compensate the raised sphere, not apply a raw ground offset');
  assert.ok(Math.abs((bounds.left+bounds.right)/2-(1440/2-260))<1e-8,'actual silhouette must move by the requested visible-screen displacement');
  assert.notEqual(camera.offset[0],-260,'raw ground offsets magnify at high rooftops');
  assert.equal(f.calls.horizontal[0].camera.zoom,17.65,'compensation must be recomputed after the native quality zoom cap');
  assert.equal(f.calls.inspection[0].options.screenShiftX,-260);assert.equal(f.calls.inspection[0].width,920);assert.equal(camera.pitch,47);
  f.state.cameraOverride.zoom=16.8;assert.equal(f.runtime.capsuleArrivalCamera(true).zoom,16.8,'do not zoom back in when the whole orb needs a wider frame');
  f.qualityCameraOverrides.delete(first.slug);assert.equal(f.runtime.capsuleArrivalCamera(false).zoom,16.8);
});

test('hero and disabled 3D keep their original photo/radar fallback camera rather than generic globe framing',()=>{
  const f=fixture();f.runtime.selectEvent(hero,{showDetail:true,historyMode:'none'});
  assert.equal(f.state.prepareCalls,0);assert.equal(f.calls.inspection.length,0);
  assert.equal(f.state.sceneFocus,null);assert.equal(f.calls.flights.length,1);
  assert.deepEqual(f.calls.flights[0].camera,{...f.qualityCameraOverrides.get(hero.slug),offset:[-260,-210]});
  const g=fixture();g.runtime.setDetail(false);g.runtime.selectEvent(first,{historyMode:'none'});
  assert.equal(g.state.prepareCalls,0);assert.equal(g.calls.inspection.length,0);
  assert.deepEqual(g.calls.flights[0].camera,g.qualityCameraOverrides.get(first.slug));
});

test('cold direct selection opens the original popup immediately, waits once for the host and then flies straight to its roof',async()=>{
  const f=fixture();f.runtime.selectEvent(first,{showDetail:true,historyMode:'none',chronologyNavigation:true});
  assert.deepEqual(f.calls.popup,[first.slug]);assert.equal(f.$('detail').hidden,false);
  assert.equal(f.calls.flights.length,0);assert.equal(f.state.prepareRequests,1);
  assert.equal(f.map.listenerCount('movestart'),1);assert.equal(f.calls.cancels,1);assert.equal(f.calls.stops,1);
  await f.resolveContext();
  assert.equal(f.calls.flights.length,1);assert.deepEqual(f.calls.flights[0].camera.center,realRoof(first).center);
  assert.equal(f.calls.flights[0].options.chronologyNavigation,true);assert.equal(f.map.listenerCount('movestart'),0);
  assert.deepEqual(f.calls.popup,[first.slug],'arrival must not rerender or replace original project content');
});

test('quick cold navigation shares preparation and a late previous selection cannot steal the current destination',async()=>{
  const f=fixture();f.runtime.selectEvent(first,{showDetail:true,historyMode:'none'});
  f.runtime.selectEvent(second,{showDetail:true,historyMode:'none'});
  assert.equal(f.state.prepareRequests,1);assert.equal(f.state.prepareCalls,2);
  assert.deepEqual(f.calls.popup,[first.slug,second.slug]);assert.equal(f.calls.flights.length,0);
  await f.resolveContext();
  assert.equal(f.calls.flights.length,1);assert.deepEqual(f.calls.flights[0].camera.center,realRoof(second).center);
  assert.equal(f.runtime.activeEvent.slug,second.slug);assert.equal(f.map.listenerCount('movestart'),0);
});

test('reselecting the same pending achievement still invalidates its earlier flight generation',async()=>{
  const f=fixture();f.runtime.selectEvent(first,{showDetail:false,historyMode:'none'});
  f.runtime.selectEvent(first,{showDetail:true,historyMode:'none'});
  assert.equal(f.state.prepareRequests,1);await f.resolveContext();
  assert.equal(f.calls.flights.length,1,'same-slug selections require a generation guard, not only an active-event check');
  const bounds=sphereProjection(f.calls.flights[0].camera,1440,900,{base:realRoof(first).base});
  assert.ok(Math.abs((bounds.left+bounds.right)/2-(1440/2-260))<1e-8,'only the latest perspective-compensated popup framing should execute');
  assert.equal(f.map.listenerCount('movestart'),0);
});

test('every actual roof-zone arrival keeps its perspective globe inside the left popup map region, including high Real Coin roofs',()=>{
  let capsules=0,legacyHeroes=0;
  for(const chapter of chapters){
    const event=events.find(event=>chapter.slugs.includes(event.slug));
    assert.ok(event,'each pinned geographic pocket must still correspond to an actual achievement');
    const f=fixture({ready:true,width:1440,height:828,panelOffset:[-390,-210]});f.runtime.activate(event);
    if(event.slug===hero.slug){
      assert.equal(f.runtime.capsuleArrivalCamera(true),null);legacyHeroes++;continue;
    }
    const camera=f.runtime.capsuleArrivalCamera(true),base=realRoof(event).base;
    const bounds=sphereProjection(camera,1440,828,{base});
    assert.ok(Math.abs((bounds.left+bounds.right)/2-330)<1e-7,`${event.slug}: popup offset must refer to raised silhouette, not ground marker`);
    assert.ok(bounds.left>=32-1e-5&&bounds.right<=628+1e-5,`${event.slug}: orb crops or extends behind the right popup (${bounds.left},${bounds.right})`);
    assert.ok(bounds.top>=72&&bounds.bottom<=828-112,`${event.slug}: final capped camera crops the crown or lower globe`);
    assert.ok(camera.zoom<=f.qualityCameraOverrides.get(event.slug).zoom,'arrival must preserve its native photo-quality ceiling');
    capsules++;
  }
  assert.equal(capsules+legacyHeroes,30);assert.equal(legacyHeroes,1);assert.equal(capsules,29);
});

test('Home invalidates pending roof flights without losing the visible world camera',async()=>{
  const f=fixture();f.runtime.selectEvent(first,{showDetail:true,historyMode:'none'});
  const generation=f.runtime.generation;f.runtime.showWholeEarth({historyMode:'none'});
  assert.ok(f.runtime.generation>generation);assert.equal(f.$('detail').hidden,true);assert.equal(f.state.sceneFocus,null);
  assert.equal(f.calls.flights.length,1);assert.deepEqual(f.calls.flights[0].camera,f.initialCamera);
  await f.resolveContext();assert.equal(f.calls.flights.length,1,'late geography must not reopen/zoom an old achievement after Home');
  assert.equal(f.map.listenerCount('movestart'),0);
});

test('an actual user pan cancels the cold flight, but unrelated programmatic movestart does not',async()=>{
  for(const userMoved of [true,false]){
    const f=fixture();f.runtime.selectEvent(first,{historyMode:'none'});
    f.map.emit('movestart',userMoved?{originalEvent:{type:'pointermove'}}:{});
    await f.resolveContext();assert.equal(f.calls.flights.length,userMoved?0:1);
    assert.equal(f.map.listenerCount('movestart'),0,'cold-flight event handlers must always be removed');
  }
});

test('a drive, CV or unavailable venue started during preparation cannot be hijacked by arrival',async()=>{
  for(const mode of ['drive','cv','venue']){
    const f=fixture();f.runtime.selectEvent(first,{historyMode:'none'});
    if(mode==='drive')f.state.drive.active=true;
    if(mode==='cv')f.state.cvOpen=true;
    if(mode==='venue')f.runtime.setVenue(false);
    await f.resolveContext();assert.equal(f.calls.flights.length,0,mode);assert.equal(f.map.listenerCount('movestart'),0);
  }
});
