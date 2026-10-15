import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from 'three';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {createGalleryRoomScene} from '../src/galleryRoomScene.js';
import {overviewCameraPlan,surfaceCameraPlan,roomCameraFov,roomWalkingVector,roomTransitionDuration} from '../src/galleryRoomCamera.js';
import {renderGalleryRoomDom} from '../src/galleryRoomDomView.js';
import {createRoomJumpState,stepRoomJump} from '../src/galleryRoomJump.js';
import {sortAchievementsNewestFirst,getChronologyState} from '../src/chronology.js';
import {readPortfolioRoute,portfolioUrl} from '../src/portfolioRoute.js';

// Exercise the shipped pointer handlers and render loop with real camera,
// projection, physical frames and raycasting; only browser scheduling is fake.
const source=await readFile(new URL('../src/galleryRoom.js',import.meta.url),'utf8');
const dragSource=source.slice(source.indexOf('  let drag=null;'),source.indexOf('  reducedQuery.addEventListener'));
const renderSource=source.slice(source.indexOf('  function render(time)'),source.indexOf('  function dispose()'));
const movementSource=source.slice(source.indexOf('  function clearMovementKeys()'),source.indexOf('  function currentStation()'));
const keyboardSource=source.slice(source.indexOf('  const controlTarget='),source.indexOf('  let drag=null;'));
assert.ok(dragSource.includes("stage.addEventListener('pointermove'"));
assert.ok(renderSource.includes('function render(time)'));
const physicalRoom=createGalleryRoomScene({scene:new THREE.Scene(),projects});
after(()=>physicalRoom.dispose());
const station=[...physicalRoom.stations.values()].find(item=>item.surfaces['media-2']);
assert.ok(station,'fixture uses a real project with an additional screen');
const referenceKind=station.surfaces.references?'references':'link-1';

function fixture(width,height,kind=null,dockBounds=null){
  const viewport={width,height,dockBounds},fov=roomCameraFov(width);
  physicalRoom.resize?.(viewport);physicalRoom.setActive(station.slug);
  const plan=kind?surfaceCameraPlan(station.surfaces[kind],viewport,fov):overviewCameraPlan(station,viewport,fov);
  const camera=new THREE.PerspectiveCamera(fov,width/height,.08,170);
  camera.position.fromArray(plan.position);const lookTarget=new THREE.Vector3(...plan.target);camera.lookAt(lookTarget);
  camera.setViewOffset(width,height,plan.viewOffset.x,plan.viewOffset.y,width,height);camera.updateMatrixWorld(true);
  const handlers=new Map(),captures=new Set(),classes=new Set(),focuses=[];
  const keys=new Set(),tapKeys=new Set();
  const stage={focus(){},addEventListener(type,callback){handlers.set(type,callback);},
    setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)};
  const context=vm.createContext({
    THREE,camera,lookTarget,stage,keys,tapKeys,signal:undefined,animation:null,focusKind:kind,
    jumpState:createRoomJumpState(),jumpQueued:false,stepRoomJump,
    innerWidth:width,innerHeight:height,active:true,viewLocked:false,disposed:false,raf:0,lastTime:1000-1000/60,frameCount:2,needsRender:false,
    document:{hidden:false},root:{dataset:{},classList:{add:value=>classes.add(value),remove:value=>classes.delete(value)}},
    content:{setFocusedSurface(){}},refreshNavigation(){},controlTarget:()=>false,
    currentStation:()=>station,currentSurface:id=>station.surfaces[id],viewport:()=>viewport,slug:station.slug,
    roomWalkingVector,overviewCameraPlan,room:physicalRoom,
    pointer:new THREE.Vector2(),raycaster:new THREE.Raycaster(),focusSurface:descriptor=>focuses.push(descriptor?.id),
    selectProject(){},returnToRoom(){},clearMovementKeys(){keys.clear();tapKeys.clear();},
    adoptWalkStation(){},beginManualMovement(){context.animation=null;context.focusKind=null;},
    cssRenderer:{render(){}},cssScene:new THREE.Scene(),cssCamera:new THREE.PerspectiveCamera(),renderGalleryRoomDom,
    scene:{},renderer:{render(){},info:{render:{calls:1,triangles:1}}},
    requestAnimationFrame:()=>1,dispatchEvent(){},Event
  });
  new vm.Script(dragSource+'\n'+renderSource).runInContext(context);
  return {context,plan,focuses,keys,tapKeys,captures,
    dispatch(type,details={}){handlers.get(type)?.({button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100,...details});}};
}
function screenPoint(camera,position,width,height){
  camera.updateMatrixWorld(true);
  const projected=new THREE.Vector3(...position).project(camera);
  return [(projected.x+1)*width/2,(1-projected.y)*height/2];
}
function projection(camera){return {enabled:camera.view?.enabled,x:camera.view?.offsetX,y:camera.view?.offsetY};}

function integratedMovement(f){
  const context=f.context,events=new Map(),selected=[],replaced=[],visible=[],navigation=[];
  class Element {constructor(control=false){this.control=control;}closest(){return this.control;}}
  Object.assign(context,{
    ordered:projects,bySlug:new Map(projects.map(project=>[project.slug,project])),
    pendingSlug:null,teleportTimer:null,createRoomJumpState,
    location:{href:`https://staging.batikanor.com/?event=${context.slug}`},
    portfolioUrl:(href,{eventSlug})=>{const url=new URL(href);url.searchParams.set('event',eventSlug);return url;},
    history:{replaceState(_state,_title,url){context.location.href=url.href;replaced.push(url.searchParams.get('event'));}},
    content:{setActiveSlug:slug=>selected.push(slug),setFocusedSurface(){},setVisibleSlugs:slugs=>visible.push([...slugs])},
    globe:{setActive:slug=>selected.push(`map:${slug}`)},
    currentStation:()=>physicalRoom.stations.get(context.slug),
    currentSurface:kind=>physicalRoom.stations.get(context.slug).surfaces[kind],
    refreshNavigation:()=>navigation.push(context.slug),performance:{now:()=>1000},
    clearTimeout(){},Element,window:{},step(){},
    addEventListener:(type,callback)=>events.set(type,callback),
  });
  context.document.addEventListener=(type,callback)=>events.set(type,callback);
  new vm.Script(movementSource+'\n'+keyboardSource).runInContext(context);
  return {selected,replaced,visible,navigation,
    key(type,key,details={}){let prevented=false;events.get(type)?.({key,code:key===' '?'Space':'Key'+key.toUpperCase(),
      target:context.stage,preventDefault(){prevented=true;},...details});return prevented;},
    control:()=>new Element(true),
    blur(){events.get('blur')?.({target:context.window});}
  };
}

// Run the actual startup and public API with native scene/camera math. Only
// browser surfaces, scheduling and GPU rendering are replaced in this fixture.
function startupFixture({reducedMotion=true}={}){
  const pending=new Map(),timers=new Map(),events=[],pushed=[],replaced=[],resizes=[];
  let sequence=0,clock=0;
  class Target{
    constructor(){this.listeners=new Map();}
    addEventListener(type,callback,options){
      if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback);
      options?.signal?.cleanups.push(()=>this.listeners.get(type).delete(callback));
    }
    dispatch(type,values={}){
      const event={target:this,preventDefault(){this.prevented=true;},stopPropagation(){},...values};
      for(const callback of this.listeners.get(type)??[])callback(event);return event;
    }
  }
  const document=new Target();
  class Element extends Target{
    constructor(tag){
      super();this.tagName=tag.toUpperCase();this.children=[];this.className='';this.dataset={};this.attributes=new Map();this.captures=new Set();
      this.classList={contains:value=>this.className.split(' ').includes(value),
        add:(...values)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...values])].join(' ');},
        remove:(...values)=>{this.className=this.className.split(' ').filter(value=>!values.includes(value)).join(' ');}};
    }
    append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    closest(){return ['BUTTON','A','INPUT','SELECT','TEXTAREA','IFRAME'].includes(this.tagName)?this:null;}
    focus(){document.activeElement=this;this.focusCount=(this.focusCount??0)+1;}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
    getBoundingClientRect(){
      const phone=context.innerWidth<700,width=phone?220:336,height=phone?270:418,left=phone?16:28,bottom=context.innerHeight-(phone?18:27);
      return {left,right:left+width,top:bottom-height,bottom,width,height};
    }
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  }
  document.documentElement=new Element('html');document.documentElement.classList.add('intro-active','gallery-pending');
  document.body=new Element('body');document.hidden=false;document.createElement=tag=>new Element(tag);
  const original=new Element('div');original.id='app';original.inert=true;
  const enter=new Element('button');enter.id='intro-enter';document.body.append(original,enter);enter.focus();
  document.getElementById=id=>{
    const visit=element=>element.id===id?element:element.children.map(visit).find(Boolean);
    return visit(document.body)??null;
  };
  class Renderer{
    constructor(){this.domElement=new Element('canvas');this.shadowMap={};this.info={render:{calls:0,triangles:0}};}
    setPixelRatio(){}setClearColor(){}setSize(){}dispose(){}forceContextLoss(){}
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);this.info.render.calls++;}
  }
  class CssRenderer{constructor(){this.domElement=new Element('div');}setSize(){}render(){}}
  class Abort{constructor(){this.signal={cleanups:[]};}abort(){this.signal.cleanups.forEach(cleanup=>cleanup());}}
  const window=new Target(),reducedQuery=new Target();reducedQuery.matches=reducedMotion;
  const context=vm.createContext({
    THREE:{...THREE,WebGLRenderer:Renderer},CSS3DRenderer:CssRenderer,achievements:projects,
    sortAchievementsNewestFirst,getChronologyState,readPortfolioRoute,portfolioUrl,createGalleryRoomScene,
    overviewCameraPlan,surfaceCameraPlan,roomCameraFov,roomWalkingVector,roomTransitionDuration,
    renderGalleryRoomDom,createRoomJumpState,stepRoomJump,document,window,Element,AbortController:Abort,Event,
    location:{href:'https://staging.batikanor.com/'},innerWidth:1280,innerHeight:900,devicePixelRatio:1,
    matchMedia:()=>reducedQuery,performance:{now:()=>clock},
    createGalleryRoomPicker:()=>({element:new Element('div'),setActive(){},close(){},dispose(){}}),
    createGalleryRoomContent:({stations,activeSlug,onFocusSurface,onReturnToRoom})=>{
      const content={activeSlug,stationSurfaces:new Map(),focusedSurface:null,
        setActiveSlug(slug){this.activeSlug=slug;},setFocusedSurface(kind){this.focusedSurface=kind;},setVisibleSlugs(){},
        resize(viewport){resizes.push({...viewport});sync();},dispose(){},
        approach(kind){onFocusSurface(this.stationSurfaces.get(this.activeSlug)?.[kind]);},returnToRoom:onReturnToRoom};
      const sync=()=>{content.stationSurfaces=new Map([...stations].map(([slug,item])=>[slug,Object.fromEntries(
        Object.entries(item.surfaces).map(([kind,pose])=>[kind,{...pose,slug,kind}]))]));};
      sync();return content;
    },
    createGalleryRoomGlobe:()=>({setActive(){},resize(){},dispose(){}}),
    requestAnimationFrame:callback=>{pending.set(++sequence,callback);return sequence;},cancelAnimationFrame:id=>pending.delete(id),
    setTimeout:callback=>{timers.set(++sequence,callback);return sequence;},clearTimeout:id=>timers.delete(id),
    addEventListener:(...args)=>window.addEventListener(...args),dispatchEvent:event=>{events.push(event.type);window.dispatch(event.type);}
  });
  context.history={pushState(_state,_title,url){context.location.href=url.href;pushed.push(url.searchParams.get('event'));},
    replaceState(_state,_title,url){context.location.href=url.href;replaced.push(url.searchParams.get('event'));}};
  new vm.Script(source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).runInContext(context);
  return {context,document,enter,original,pending,timers,events,pushed,replaced,resizes,
    tick(time){clock=time;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(callback=>callback(time));},
    key(key,details={}){return window.dispatch('keydown',{key,code:key===' '?'Space':'Key'+key.toUpperCase(),target:document.activeElement,...details});},
    popstate(slug){context.location.href=portfolioUrl(context.location.href,{eventSlug:slug}).href;window.dispatch('popstate');}};
}

test('a deferred gallery prepares useful frames without consuming intro keys, pointers, history or focus',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true});
  try{
    const initial=api.getStats(),stage=f.document.getElementById('gallery-room-stage');
    assert.equal(initial.active,false);assert.equal(initial.viewLocked,true);assert.equal(api.root.inert,true);assert.equal(api.root.classList.contains('is-preparing'),true);
    f.document.getElementById('gallery-view-lock').dispatch('click');
    assert.equal(api.getStats().viewLocked,true,'the prepared lock control cannot activate behind the intro');
    assert.equal(f.document.documentElement.classList.contains('intro-active'),true);
    assert.equal(f.document.activeElement,f.enter);assert.equal(f.original.inert,true);
    for(const key of['w','a','s','d',' ','ArrowLeft','ArrowRight','Escape','r']){
      assert.equal(f.key(key).prevented,undefined,`${key} remains available to the introduction`);
      assert.equal(f.key(key,{target:f.document.body}).prevented,undefined,`${key} is ignored even outside a native intro control`);
    }
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:1,clientX:100,clientY:100});
    stage.dispatch('pointermove',{pointerId:1,clientX:140,clientY:120});stage.dispatch('pointerup',{pointerId:1,clientX:140,clientY:120});
    f.popstate(projects.at(-1).slug);f.tick(0);f.tick(16.7);f.tick(33.4);
    const prepared=api.getStats();
    assert.equal(prepared.active,false);assert.equal(prepared.frameCount,2);assert.deepEqual(f.events,['gallery-room-ready']);
    assert.equal(f.key('ArrowRight').prevented,undefined,'readiness alone never enables navigation');
    assert.equal(prepared.activeSlug,initial.activeSlug);assert.equal(prepared.pendingSlug,null);assert.equal(prepared.focusKind,null);
    assert.deepEqual(prepared.camera,initial.camera);assert.deepEqual(prepared.lookTarget,initial.lookTarget);
    assert.equal(prepared.keys.length,0);assert.equal(prepared.jump.grounded,true);assert.equal(f.timers.size,0);
    assert.equal(stage.captures.size,0);assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[]);
    assert.equal(f.document.activeElement,f.enter,'readiness never dismisses or steals focus from the intro');
    const brand=api.root.children.find(child=>child.className==='gallery-room-header').children[0].children[0];
    assert.equal(brand.tagName,'A');assert.equal(brand.href,'/');assert.equal(brand.title,'Return to introduction');
    assert.equal(brand.dispatch('click').prevented,undefined,'Home uses native navigation to the introduction');
  }finally{api.dispose();}
  assert.equal(f.pending.size,0);
});

test('explicit activation refits the prepared gallery, focuses its stage and enables input only once',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true});
  try{
    f.tick(0);f.tick(16.7);f.context.innerWidth=390;f.context.innerHeight=844;
    f.original.inert=false; // finishIntro has released the old app before activation.
    api.activate();
    const stage=f.document.getElementById('gallery-room-stage'),active=api.getStats();
    assert.equal(active.active,true);assert.equal(api.root.inert,false);assert.equal(api.root.classList.contains('is-preparing'),false);
    assert.equal(f.original.inert,true);assert.equal(f.document.activeElement,stage);assert.equal(api.camera.aspect,390/844);
    assert.deepEqual(f.resizes.at(-1),{width:390,height:844,dockBounds:stage.getBoundingClientRect()});
    const selected=api.room.stations.get(active.activeSlug),plan=overviewCameraPlan(selected,active.viewport,roomCameraFov(390));
    assert.deepEqual(active.camera,plan.position,'the first exposed frame uses the latest viewport');
    const resizeCount=f.resizes.length,focusCount=stage.focusCount;api.activate();
    assert.equal(f.resizes.length,resizeCount);assert.equal(stage.focusCount,focusCount,'repeated activation does not steal focus again');
    assert.equal(api.getStats().viewLocked,true);api.setViewLocked(false);
    assert.equal(f.key('w').prevented,true);assert.equal(api.getStats().keys[0],'w');
    f.tick(1000);f.tick(1016.7);assert.ok(api.camera.position.z<active.camera[2],'walking works after entry');
    f.context.window.dispatch('keyup',{key:'w'});
    assert.equal(f.key('ArrowRight').prevented,true);assert.notEqual(api.getStats().activeSlug,active.activeSlug);
    assert.equal(f.pushed.length,1);
    f.popstate(active.activeSlug);assert.equal(api.getStats().activeSlug,active.activeSlug,'history navigation works after activation');
    assert.equal(f.pushed.length,1,'restoring history creates no additional entries');
  }finally{api.dispose();}
  api.activate();assert.equal(api.getStats().active,false,'a disposed room cannot reactivate');
  assert.equal(f.pending.size,0);
});

test('default startup keeps deep links immediately active',async()=>{
  const f=startupFixture(),slug=projects[3].slug;f.context.location.href=portfolioUrl(f.context.location.href,{eventSlug:slug}).href;
  const api=await f.context.startGalleryRoom();
  try{
    assert.equal(api.getStats().active,true);assert.equal(api.getStats().activeSlug,slug);assert.equal(api.root.inert,false);
    assert.equal(api.root.classList.contains('is-preparing'),false);assert.equal(f.document.documentElement.classList.contains('intro-active'),false);
    f.document.getElementById('gallery-room-stage').focus();
    assert.equal(f.key('ArrowRight').prevented,true);assert.notEqual(api.getStats().activeSlug,slug);
  }finally{api.dispose();}
});

test('the initial view lock blocks walking and looking, keeps Space jumping, and unlocks through its native button',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom();
  try{
    const stage=f.document.getElementById('gallery-room-stage'),button=f.document.getElementById('gallery-view-lock');
    stage.focus();f.tick(0);f.tick(16.7);
    const initial=api.getStats(),rotation=api.camera.quaternion.clone();
    assert.equal(initial.viewLocked,true);assert.equal(api.root.dataset.viewLocked,'true');
    assert.equal(button.getAttribute('aria-pressed'),'true');assert.equal(button.getAttribute('aria-label'),'Unlock viewing angle and walking');
    assert.equal(button.title,button.getAttribute('aria-label'));assert.match(button.innerHTML,/<svg\b/);
    for(const key of['w','a','s','d'])assert.equal(f.key(key).prevented,true);
    f.tick(33.4);assert.equal(api.getStats().keys.length,0);assert.deepEqual(api.getStats().camera,initial.camera);
    const station=api.room.stations.get(initial.activeSlug),[clientX,clientY]=screenPoint(api.camera,station.surfaces.story.position,1280,900);
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:4,clientX,clientY});
    stage.dispatch('pointermove',{pointerId:4,clientX:clientX+40,clientY:clientY+20});
    stage.dispatch('pointerup',{pointerId:4,clientX,clientY});
    assert.deepEqual(api.getStats().camera,initial.camera);assert.ok(api.camera.quaternion.angleTo(rotation)<1e-10);
    assert.equal(api.getStats().focusKind,null,'a blocked drag that returns to its origin cannot become a board click');
    assert.equal(stage.captures.size,0);
    assert.equal(f.key(' ').prevented,true);let maximum=0;
    for(let frame=0;frame<60;frame++){
      f.tick(50.1+frame*1000/60);maximum=Math.max(maximum,api.getStats().jump.height);
      assert.equal(api.camera.position.x,initial.camera[0]);assert.equal(api.camera.position.z,initial.camera[2]);
    }
    assert.ok(maximum>.88&&maximum<.90);assert.equal(api.getStats().jump.grounded,true);
    assert.ok(api.camera.position.distanceTo(new THREE.Vector3(...initial.camera))<1e-10,'landing preserves the locked eye position');
    button.focus();button.dispatch('click');
    assert.equal(api.getStats().viewLocked,false);assert.equal(api.root.dataset.viewLocked,'false');
    assert.equal(f.document.activeElement,stage,'unlocking immediately returns keyboard controls to the stage');
    assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.getAttribute('aria-label'),'Lock viewing angle and walking');
    assert.equal(button.title,button.getAttribute('aria-label'));
    const before=api.camera.position.clone();f.key('w');f.tick(1050.1);f.context.window.dispatch('keyup',{key:'w'});
    assert.ok(api.camera.position.z<before.z,'unlock restores walking');
    const beforeLook=api.camera.quaternion.clone();
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:5,clientX:100,clientY:100});
    stage.dispatch('pointermove',{pointerId:5,clientX:120,clientY:110});stage.dispatch('pointerup',{pointerId:5,clientX:120,clientY:110});
    assert.ok(api.camera.quaternion.angleTo(beforeLook)>.01,'unlock restores manual looking');
    button.focus();button.dispatch('click');assert.equal(api.getStats().viewLocked,true);assert.equal(f.document.activeElement,stage);
    assert.equal(f.key(' ').prevented,true);f.tick(1066.8);
    assert.ok(api.getStats().jump.height>0,'relocking through the button leaves Space immediately usable');
  }finally{api.dispose();}
});

test('relocking freezes the chosen view, releases held movement and drag, and preserves queued and airborne jumps',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom();
  try{
    const stage=f.document.getElementById('gallery-room-stage');stage.focus();api.setViewLocked(false);f.tick(0);f.tick(16.7);
    f.key('w');f.tick(33.4);f.key('d');
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:8,clientX:100,clientY:100});
    stage.dispatch('pointermove',{pointerId:8,clientX:130,clientY:115});assert.equal(stage.captures.size,1);
    f.key(' ');const before=api.getStats(),rotation=api.camera.quaternion.clone();
    const button=f.document.getElementById('gallery-view-lock');button.focus();api.setViewLocked(true);
    assert.equal(f.document.activeElement,button,'the programmatic lock API preserves focus');
    assert.equal(api.getStats().viewLocked,true);assert.equal(api.getStats().keys.length,0);assert.equal(stage.captures.size,0);
    assert.deepEqual(api.getStats().camera,before.camera);assert.deepEqual(api.getStats().lookTarget,before.lookTarget);
    assert.ok(api.camera.quaternion.angleTo(rotation)<1e-10,'the selected angle does not snap when relocked');
    f.tick(50.1);assert.ok(api.getStats().jump.height>0,'the queued jump survives relocking');
    const airborne=api.getStats();api.setViewLocked(false);api.setViewLocked(true);
    assert.deepEqual(api.getStats().jump,airborne.jump);assert.deepEqual(api.getStats().camera,airborne.camera);
    api.setViewLocked(false);f.tick(66.8);
    assert.equal(api.camera.position.x,before.camera[0]);assert.equal(api.camera.position.z,before.camera[2]);
    assert.ok(api.getStats().jump.height>airborne.jump.height,'an airborne jump continues through toggles');
    stage.dispatch('pointermove',{pointerId:8,clientX:180,clientY:150});stage.dispatch('pointerup',{pointerId:8,clientX:180,clientY:150});
    assert.ok(api.camera.quaternion.angleTo(rotation)<1e-10,'released drag input cannot resume after unlocking');
    assert.equal(api.getStats().keys.length,0,'neither held keys nor a queued tap restart walking after unlock');
  }finally{api.dispose();}
});

test('locked stage clicks still approach boards and Escape returns to the complete current wall',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom();
  try{
    const stage=f.document.getElementById('gallery-room-stage');stage.focus();f.tick(0);f.tick(16.7);
    const initial=api.getStats(),station=api.room.stations.get(initial.activeSlug);
    const [clientX,clientY]=screenPoint(api.camera,station.surfaces.story.position,1280,900);
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:10,clientX,clientY});
    stage.dispatch('pointerup',{pointerId:10,clientX,clientY});
    assert.equal(api.getStats().viewLocked,true);assert.equal(api.getStats().focusKind,'story');assert.equal(api.content.focusedSurface,'story');
    assert.notDeepEqual(api.getStats().camera,initial.camera,'the programmatic reading approach remains available');
    assert.equal(f.key('Escape').prevented,true);assert.equal(api.getStats().focusKind,null);assert.equal(api.getStats().viewLocked,true);
    assert.deepEqual(api.getStats().camera,initial.camera);
    f.key('ArrowRight');assert.notEqual(api.getStats().activeSlug,initial.activeSlug);assert.equal(api.getStats().viewLocked,true);
    assert.equal(api.getStats().focusKind,null);assert.equal(f.pushed.length,1,'project navigation stays available with the view locked');
  }finally{api.dispose();}
});

test('lock toggles preserve programmatic reading animations and pending project navigation',async()=>{
  const f=startupFixture({reducedMotion:false}),api=await f.context.startGalleryRoom();
  const lockButton=f.document.getElementById('gallery-view-lock');
  try{
    const stage=f.document.getElementById('gallery-room-stage');stage.focus();f.tick(0);f.tick(16.7);
    api.content.approach('story');assert.equal(api.getStats().transitioning,true);
    const before=api.getStats();api.setViewLocked(false);api.setViewLocked(true);
    assert.equal(api.getStats().transitioning,true);assert.deepEqual(api.getStats().camera,before.camera);
    f.tick(10000);assert.equal(api.getStats().transitioning,false);assert.equal(api.getStats().focusKind,'story');
    const approached=api.getStats().camera;f.key('ArrowRight');const pending=api.getStats().pendingSlug;
    assert.ok(pending);assert.equal(f.timers.size,1);api.setViewLocked(false);api.setViewLocked(true);
    assert.equal(api.getStats().pendingSlug,pending);assert.equal(f.timers.size,1);
    assert.deepEqual(api.getStats().camera,approached,'locking never replaces the current transition pose');
    const callbacks=[...f.timers.values()];f.timers.clear();callbacks.forEach(callback=>callback());
    assert.equal(api.getStats().activeSlug,pending);assert.equal(api.getStats().pendingSlug,null);assert.equal(api.getStats().viewLocked,true);
    api.content.approach('story');api.content.returnToRoom();f.tick(20000);
    assert.equal(api.getStats().focusKind,null);assert.equal(api.getStats().transitioning,false);assert.equal(api.getStats().viewLocked,true);
  }finally{api.dispose();}
  const button=f.document.getElementById('gallery-view-lock');assert.equal(button,null,'disposal removes the lock along with its gallery');
  lockButton.dispatch('click');api.setViewLocked(false);
  assert.equal(api.getStats().viewLocked,true,'neither old controls nor the API can change a disposed room');
  assert.equal(f.key('w',{target:f.document.body}).prevented,undefined,'disposal releases global keyboard handling');
  assert.equal(f.pending.size,0);
});

const viewports=[[1280,900],[1280,720],[700,1080],[568,320],[390,844]];
test('first manual look preserves fitted XY framing without a projection jump from room or reading views',()=>{
  for(const [width,height]of viewports)for(const kind of[null,'story','media-2']){
    const f=fixture(width,height,kind),camera=f.context.camera;
    const beforeProjection=projection(camera),beforePosition=camera.position.clone();
    const point=kind?station.surfaces[kind].position:station.surfaces.story.position;
    const before=screenPoint(camera,point,width,height);
    f.dispatch('pointerdown');f.dispatch('pointermove',{clientX:106});
    const after=screenPoint(camera,point,width,height);
    assert.deepEqual(projection(camera),beforeProjection,`${width}x${height}/${kind??'room'} keeps both fitted axes`);
    assert.deepEqual(camera.position.toArray(),beforePosition.toArray(),'looking does not translate the reader');
    const focal=height/(2*Math.tan(roomCameraFov(width)*Math.PI/360));
    assert.ok(Math.hypot(after[0]-before[0],after[1]-before[1])<focal*.0192*1.6+2,
      `${width}x${height}/${kind??'room'} moves only by the small requested look angle`);
    assert.equal(f.context.focusKind,null);
    f.dispatch('pointerup',{clientX:106});
    assert.equal(f.captures.size,0);
    assert.deepEqual(f.focuses,[],'a drag never becomes an accidental board click');
  }
});

test('WASD retains framing and sight direction while W from an approached plaque moves forward without snapping back',()=>{
  for(const [width,height]of viewports)for(const kind of[null,'story',referenceKind]){
    const f=fixture(width,height,kind),camera=f.context.camera;
    const beforeProjection=projection(camera),before=camera.position.clone();
    const direction=f.context.lookTarget.clone().sub(before).normalize();
    f.keys.add('w');f.context.render(1000);
    const delta=camera.position.clone().sub(before);
    assert.ok(delta.z<0&&delta.length()>.08&&delta.length()<.09,
      `${width}x${height}/${kind??'room'} moves toward the front by exactly one walking frame`);
    assert.deepEqual(projection(camera),beforeProjection,'walking retains both projection offsets');
    assert.ok(f.context.lookTarget.clone().sub(camera.position).normalize().distanceTo(direction)<1e-10,
      'walking keeps the view aligned with the camera');
  }
});

test('walking stops before the physical front frames and releases quick tap movement after one frame',()=>{
  const f=fixture(1280,900,referenceKind),camera=f.context.camera;
  const clearance=station.bounds.min[2]+.4;
  const shift=clearance+.01-camera.position.z;
  camera.position.z+=shift;f.context.lookTarget.z+=shift;
  f.tapKeys.add('w');f.context.render(1000);
  assert.equal(camera.position.z,clearance,'the architectural front bound prevents walking into the display wall');
  assert.ok(clearance>station.surfaces.story.position[2]+.2,'reader remains in front of the tangible frames');
  assert.equal(f.tapKeys.size,0);
  const stopped=camera.position.clone();f.context.render(1016.7);
  assert.deepEqual(camera.position.toArray(),stopped.toArray(),'released movement does not drift');
});

test('native frame picking stays aligned with the rendered room after manual look retains its asymmetric projection',()=>{
  const width=1280,height=900,f=fixture(width,height);
  f.dispatch('pointerdown');f.dispatch('pointermove',{clientX:106});f.dispatch('pointerup',{clientX:106});
  const [clientX,clientY]=screenPoint(f.context.camera,station.surfaces.story.position,width,height);
  f.dispatch('pointerdown',{clientX,clientY});f.dispatch('pointerup',{clientX,clientY});
  assert.deepEqual(f.focuses,['story'],'the actual screen ray hits the original story frame');
});

test('measured left dock framing stays on the right through manual look and walking',()=>{
  const width=1280,height=900;
  const f=fixture(width,height,'story',{left:40,right:416,top:430,bottom:870});
  const before=projection(f.context.camera);
  assert.equal(f.plan.safe.left,424,'actual dock width and inset determine the reserved left edge');
  const center=screenPoint(f.context.camera,station.surfaces.story.position,width,height);
  assert.ok(center[0]>width/2,'the reading area remains to the right of the globe');
  assert.ok(before.x<0,'the camera carries the mirrored horizontal projection');
  f.dispatch('pointerdown');f.dispatch('pointermove',{clientX:106});f.dispatch('pointerup',{clientX:106});
  f.keys.add('w');f.context.render(1000);
  assert.deepEqual(projection(f.context.camera),before,'drag and walking preserve both measured framing offsets');
});

test('choosing a project on a phone opens the complete wall rather than an automatic story approach',()=>{
  const body=source.slice(source.indexOf('  function setStation('),source.indexOf('  function selectProject('));
  const focusCalls=[];
  const context=vm.createContext({
    slug:'old',pendingSlug:'new',focusKind:'story',innerWidth:390,animation:{},active:true,viewLocked:false,
    cancelDrag(){},clearMovementKeys(){},updateVisibleProjects(){},performance:{now:()=>100},
    content:{setActiveSlug(){},setFocusedSurface:kind=>focusCalls.push(kind)},
    globe:{setActive(){}},room:{update(){}},
    framePlan:()=>({}),applyPose(){},refreshNavigation(){}
  });
  new vm.Script(body).runInContext(context);
  context.setStation(station.slug);
  assert.equal(context.focusKind,null);
  assert.deepEqual(focusCalls,[null]);
});

test('resize updates physical wall layout before live content and applies the new exact wall camera',()=>{
  const resizeSource=source.slice(source.indexOf('  function resize()'),source.indexOf("  addEventListener('resize',resize"));
  const nextViewport={width:390,height:844,dockBounds:{left:16,right:236,top:556,bottom:826}};
  const f=fixture(1280,900),order=[];
  const context=vm.createContext({
    camera:f.context.camera,innerWidth:nextViewport.width,innerHeight:nextViewport.height,devicePixelRatio:1,
    roomCameraFov,animation:{},viewport:()=>nextViewport,
    renderer:{setPixelRatio(){},setSize(){}},cssRenderer:{setSize(){}},
    room:{resize(viewport){order.push('layout');physicalRoom.resize(viewport);}},
    content:{resize(viewport){
      order.push('content');assert.equal(station.wallLayout.width,viewport.width);
      assert.equal(station.wallLayout.height,viewport.height);
    }},globe:{resize(){order.push('globe');}},
    framePlan:()=>overviewCameraPlan(station,nextViewport,roomCameraFov(nextViewport.width)),
    applyPose(plan){
      order.push('camera');f.context.camera.position.fromArray(plan.position);
      f.context.camera.lookAt(...plan.target);f.context.camera.clearViewOffset();
    }
  });
  new vm.Script(resizeSource).runInContext(context);context.resize();
  assert.deepEqual(order,['layout','content','globe','camera']);
  assert.equal(context.animation,null);
  assert.equal(context.camera.aspect,390/844);
  const expected=overviewCameraPlan(station,nextViewport,roomCameraFov(nextViewport.width));
  assert.deepEqual(context.camera.position.toArray(),expected.position);
});

test('holding D walks continuously to the real neighboring wall and synchronizes project, map, URL and visible content',()=>{
  for(const [width,height]of viewports){
    const f=fixture(width,height),m=integratedMovement(f),camera=f.context.camera;
    const neighbor=[...physicalRoom.stations.values()][station.index+1];
    assert.ok(neighbor);
    const sight=f.context.lookTarget.clone().sub(camera.position),beforeProjection=projection(camera);
    m.key('keydown','d');
    const frames=Math.ceil(station.spacing/5.2*60)+2;
    for(let index=0;index<frames;index++){
      const previous=camera.position.clone();f.context.render(1000+index*1000/60);
      assert.ok(camera.position.distanceTo(previous)<.087,'crossing a station never teleports or accelerates the camera');
      assert.ok(f.context.lookTarget.clone().sub(camera.position).distanceTo(sight)<1e-9,'crossing preserves sight direction');
    }
    m.key('keyup','d');
    assert.equal(f.context.slug,neighbor.slug);
    assert.ok(camera.position.x>station.bounds.max[0],'walking passes through the former per-project clamp');
    assert.deepEqual(m.selected,[neighbor.slug,`map:${neighbor.slug}`]);
    assert.deepEqual(m.replaced,[neighbor.slug],'walking updates the current history entry once');
    assert.equal(new URL(f.context.location.href).searchParams.get('event'),neighbor.slug);
    assert.deepEqual(m.visible.at(-1),physicalRoom.visibleSlugs,'native content and aperture masks show the same neighboring walls');
    assert.deepEqual(projection(camera),beforeProjection);
    assert.equal(f.context.pendingSlug,null);
    assert.equal(f.context.animation,null);
  }
});

test('Space jumps while walking, ignores auto-repeat and native controls, then lands at the same eye height and sight direction',()=>{
  const f=fixture(1280,900),m=integratedMovement(f),camera=f.context.camera;
  const restingY=camera.position.y,sight=f.context.lookTarget.clone().sub(camera.position);
  assert.equal(m.key('keydown',' ',{target:m.control()}),false,'native buttons and embeds retain Space');
  assert.equal(f.context.jumpQueued,false);
  assert.equal(m.key('keydown',' ',{repeat:true}),true);
  assert.equal(f.context.jumpQueued,false,'holding Space cannot repeatedly launch');
  m.key('keydown','w');m.key('keydown',' ');
  let apex=0;
  for(let index=0;index<70;index++){
    f.context.render(1000+index*1000/60);
    apex=Math.max(apex,camera.position.y-restingY);
    m.key('keydown',' ',{repeat:true});
    assert.ok(f.context.lookTarget.clone().sub(camera.position).distanceTo(sight)<1e-9);
  }
  m.key('keyup','w');m.key('keyup',' ');
  assert.ok(apex>.88&&apex<.90,'the jump is clearly visible');
  assert.ok(Math.abs(camera.position.y-restingY)<1e-10,'landing does not drift vertically');
  assert.equal(f.context.jumpState.grounded,true);
  assert.equal(f.context.jumpQueued,false,'auto-repeat never queues a second jump on landing');
  assert.ok(camera.position.z<f.plan.position[2]-4,'forward movement continues during the jump');
  m.key('keydown',' ');f.context.render(2200);assert.ok(f.context.jumpState.height>0,'a fresh press after landing can jump again');
  m.blur();assert.equal(f.keys.size,0);assert.equal(f.context.jumpState.grounded,true);
  assert.ok(Math.abs(camera.position.y-restingY)<1e-10,'leaving the window restores resting height');
});

test('jumping across a station boundary preserves airborne height and the global corridor endpoints stop walking',()=>{
  const f=fixture(1280,900),m=integratedMovement(f),camera=f.context.camera;
  const next=[...physicalRoom.stations.values()][station.index+1];
  const shift=(station.anchor[0]+next.anchor[0])/2-.04-camera.position.x;
  camera.position.x+=shift;f.context.lookTarget.x+=shift;
  m.key('keydown','d');m.key('keydown',' ');f.context.render(1000);
  assert.equal(f.context.slug,next.slug);assert.ok(f.context.jumpState.height>0);
  m.key('keyup','d');
  const beforeHeight=f.context.jumpState.height;f.context.render(1016.6666667);
  assert.ok(f.context.jumpState.height>beforeHeight,'crossing does not reset the jump');
  f.context.resetJump();
  for(const [key,edge]of[['a',physicalRoom.walkBounds.min[0]+.4],['d',physicalRoom.walkBounds.max[0]-.4]]){
    const shift=edge-camera.position.x;camera.position.x+=shift;f.context.lookTarget.x+=shift;
    m.key('keydown',key);f.context.render(1033.3333334);m.key('keyup',key);
    assert.equal(camera.position.x,edge,'the endpoint is bounded by the complete corridor');
  }
});
