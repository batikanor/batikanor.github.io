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
import {sortAchievementsByImportance} from '../src/achievementImportance.js';
import {readPortfolioRoute,portfolioUrl} from '../src/portfolioRoute.js';
import {bindAchievementSummaryDownload} from '../src/achievementSummaryDownload.js';

// Exercise the shipped pointer handlers and render loop with real camera,
// projection, physical frames and raycasting; only browser scheduling is fake.
const source=await readFile(new URL('../src/galleryRoom.js',import.meta.url),'utf8');
const brandLinksSource=await readFile(new URL('../src/brandLinks.js',import.meta.url),'utf8');
const dragSource=source.slice(source.indexOf('  let drag=null;'),source.indexOf('  reducedQuery.addEventListener'));
const renderSource=source.slice(source.indexOf('  function render(time)'),source.indexOf('  function dispose()'));
const sampleSource=source.slice(source.indexOf('  function sampleAnimation(time)'),source.indexOf('  function animatePose(plan)'));
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
    setProjection(offset){if(!offset.x&&!offset.y)camera.clearViewOffset();else camera.setViewOffset(width,height,offset.x,offset.y,width,height);},
    requestAnimationFrame:()=>1,dispatchEvent(){},Event
  });
  new vm.Script(dragSource+'\n'+sampleSource+'\n'+renderSource).runInContext(context);
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
function startupFixture({reducedMotion=true,coarse=false,loadSummaryExporter,loadGalleryMobile,createRendererError}={}){
  const pending=new Map(),timers=new Map(),events=[],pushed=[],replaced=[],resizes=[],globeSelections=[];
  let sequence=0,clock=0,picker;
  class Target{
    constructor(){this.listeners=new Map();}
    addEventListener(type,callback,options){
      if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback);
      if(options?.signal?.aborted){this.listeners.get(type).delete(callback);return;}
      options?.signal?.addEventListener('abort',()=>this.removeEventListener(type,callback),{once:true});
    }
    removeEventListener(type,callback){this.listeners.get(type)?.delete(callback);}
    dispatch(type,values={}){
      const event={target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.propagationStopped=true;},...values};
      for(const callback of this.listeners.get(type)??[])callback(event);return event;
    }
  }
  const document=new Target();
  class Element extends Target{
    constructor(tag){
      super();this.ownerDocument=document;this.tagName=tag.toUpperCase();this.children=[];this.className='';this.dataset={};this.attributes=new Map();this.captures=new Set();this.disabled=false;this.hidden=false;
      this.classList={contains:value=>this.className.split(' ').includes(value),
        add:(...values)=>{this.className=[...new Set([...this.className.split(' ').filter(Boolean),...values])].join(' ');},
        remove:(...values)=>{this.className=this.className.split(' ').filter(value=>!values.includes(value)).join(' ');}};
    }
    get textContent(){return this.children.length?this.children.map(child=>child.textContent).join(''):(this._textContent??'');}
    set textContent(value){for(const child of this.children)child.parent=null;this.children=[];this._textContent=String(value);}
    append(...children){for(const child of children){this.children.push(child);child.parent=this;}}
    replaceChildren(...children){for(const child of this.children)child.parent=null;this.children=[];this._textContent='';this.append(...children);}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
    removeAttribute(name){this.attributes.delete(name);}
    closest(){return ['BUTTON','A','INPUT','SELECT','TEXTAREA','IFRAME'].includes(this.tagName)?this:null;}
    get isConnected(){return this===document.body||!!this.parent?.isConnected;}
    focus(){if(this.inert)return;document.activeElement=this;this.focusCount=(this.focusCount??0)+1;}
    showModal(){this.open=true;this.modalOpenCount=(this.modalOpenCount??0)+1;}
    close(){this.open=false;this.dispatch('close');}
    setPointerCapture(id){this.captures.add(id);}
    hasPointerCapture(id){return this.captures.has(id);}
    releasePointerCapture(id){this.captures.delete(id);}
    getBoundingClientRect(){
      if(this.className==='gallery-room-header'){
        const phone=context.innerWidth<700,left=context.innerWidth<360?14:phone?19:context.innerWidth<=900?24:32;
        const top=phone?19:context.innerHeight<480?15:27,height=phone?28:32;
        return {left,right:context.innerWidth-left,top,bottom:top+height,width:context.innerWidth-left*2,height};
      }
      const phone=context.innerWidth<700,width=phone?220:336,height=phone?270:418,left=phone?16:28,bottom=context.innerHeight-(phone?18:27);
      return {left,right:left+width,top:bottom-height,bottom,width,height};
    }
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  }
  document.documentElement=new Element('html');document.documentElement.classList.add('intro-active','gallery-pending');
  document.body=new Element('body');document.hidden=false;document.createElement=tag=>new Element(tag);
  document.createElementNS=(_namespace,tag)=>new Element(tag);
  const original=new Element('div');original.id='app';original.inert=true;
  const enter=new Element('button');enter.id='intro-enter';document.body.append(original,enter);enter.focus();
  document.getElementById=id=>{
    const visit=element=>element.id===id?element:element.children.map(visit).find(Boolean);
    return visit(document.body)??null;
  };
  class Renderer{
    constructor(){const error=createRendererError?.();if(error)throw error;this.domElement=new Element('canvas');this.shadowMap={};this.info={render:{calls:0,triangles:0}};}
    setPixelRatio(){}setClearColor(){}setSize(){}dispose(){}forceContextLoss(){}
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);this.info.render.calls++;}
  }
  class CssRenderer{constructor(){this.domElement=new Element('div');}setSize(){}render(){}}
  const window=new Target(),reducedQuery=new Target();reducedQuery.matches=reducedMotion;document.defaultView=window;
  const context=vm.createContext({
    THREE:{...THREE,WebGLRenderer:Renderer},CSS3DRenderer:CssRenderer,achievements:projects,
    sortAchievementsNewestFirst,sortAchievementsByImportance,getChronologyState,readPortfolioRoute,portfolioUrl,createGalleryRoomScene,
    overviewCameraPlan,surfaceCameraPlan,roomCameraFov,roomWalkingVector,roomTransitionDuration,
    renderGalleryRoomDom,createRoomJumpState,stepRoomJump,document,window,Element,AbortController,Event,
    bindAchievementSummaryDownload:(button,options)=>bindAchievementSummaryDownload(button,{...options,...(loadSummaryExporter?{loadExporter:loadSummaryExporter}:{})}),
    location:{href:'https://staging.batikanor.com/'},innerWidth:1280,innerHeight:900,devicePixelRatio:1,
    matchMedia:query=>query==='(pointer: coarse)'?{matches:coarse}:reducedQuery,performance:{now:()=>clock},
    loadGalleryMobile:loadGalleryMobile??(()=>{throw new Error('A spatial fixture must explicitly bypass native mobile startup');}),
    createGalleryRoomPicker:({projects,onSortChange})=>(picker={element:new Element('div'),projects,
      setActive(slug){this.activeSlug=slug;},setProjects(projects){this.projects=projects;},
      setSortMode(mode){this.sortMode=mode;},changeSort(mode){onSortChange(mode);},close(){},dispose(){}}),
    createGalleryRoomContent:({stations,activeSlug,onFocusSurface,onReturnToRoom,readingContainer,onReadingChange})=>{
      const content={activeSlug,readingContainer,readingChanged:onReadingChange,stationSurfaces:new Map(),focusedSurface:null,
        setActiveSlug(slug){this.activeSlug=slug;},setFocusedSurface(kind){this.focusedSurface=kind;},setVisibleSlugs(slugs){this.visibleSlugs=slugs;},
        resize(viewport){resizes.push({...viewport});sync();},dispose(){},
        approach(kind){onFocusSurface(this.stationSurfaces.get(this.activeSlug)?.[kind]);},returnToRoom:onReturnToRoom};
      const sync=()=>{content.stationSurfaces=new Map([...stations].map(([slug,item])=>[slug,Object.fromEntries(
        Object.entries(item.surfaces).map(([kind,pose])=>[kind,{...pose,slug,kind}]))]));};
      sync();return content;
    },
    createGalleryRoomGlobe:()=>({setActive(slug){globeSelections.push(slug);},resize(){},dispose(){},
      getStats:()=>({activeSlug:globeSelections.at(-1)})}),
    requestAnimationFrame:callback=>{pending.set(++sequence,callback);return sequence;},cancelAnimationFrame:id=>pending.delete(id),
    setTimeout:callback=>{timers.set(++sequence,callback);return sequence;},clearTimeout:id=>timers.delete(id),
    addEventListener:(...args)=>window.addEventListener(...args),dispatchEvent:event=>{events.push(event.type);window.dispatch(event.type);}
  });
  context.history={pushState(_state,_title,url){context.location.href=url.href;pushed.push(url.searchParams.get('event'));},
    replaceState(_state,_title,url){context.location.href=url.href;replaced.push(url.searchParams.get('event'));}};
  new vm.Script(brandLinksSource.replace(/^import .*;\n/gm,'').replace(/^export /gm,'')).runInContext(context);
  new vm.Script(source.replace(/^import .*;\n/gm,'').replace(/^export /gm,'').replace("import('./galleryRoomMobile.js')",'loadGalleryMobile()')).runInContext(context);
  return {context,document,enter,original,pending,timers,events,pushed,replaced,resizes,globeSelections,get picker(){return picker;},
    tick(time){clock=time;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(callback=>callback(time));},
    advanceClock(time){clock=time;},
    key(key,details={}){
      let event={key,code:key===' '?'Space':'Key'+key.toUpperCase(),target:document.activeElement,...details};
      // Native keyboard events reach a modal's ancestor handler before window.
      for(let node=event.target;node;node=node.parent){
        if(!node.listeners?.has('keydown'))continue;
        event=node.dispatch('keydown',event);if(event.propagationStopped)return event;
      }
      return window.dispatch('keydown',event);
    },
    popstate(slug){context.location.href=portfolioUrl(context.location.href,{eventSlug:slug}).href;window.dispatch('popstate');}};
}

test('a deferred gallery prepares useful frames without consuming intro keys, pointers, history or focus',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true,spatial:true});
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
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true,spatial:true});
  try{
    f.tick(0);f.tick(16.7);f.context.innerWidth=390;f.context.innerHeight=844;
    f.original.inert=false; // finishIntro has released the old app before activation.
    api.activate();
    const stage=f.document.getElementById('gallery-room-stage'),active=api.getStats();
    assert.equal(active.active,true);assert.equal(api.root.inert,false);assert.equal(api.root.classList.contains('is-preparing'),false);
    assert.equal(f.original.inert,true);assert.equal(f.document.activeElement,stage);assert.equal(api.camera.aspect,390/844);
    assert.deepEqual(JSON.parse(JSON.stringify(f.resizes.at(-1))),{width:390,height:844,dockBounds:stage.getBoundingClientRect(),headerBounds:{left:19,right:371,top:19,bottom:47,controlsBottom:81}});
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

test('an entrance map choice exposes the chosen wall, content, globe and fitted camera before stage input',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true,spatial:true});
  try{
    f.tick(0);f.tick(16.7);
    const prepared=api.getStats(),chosen=projects.find(project=>project.slug!==prepared.activeSlug).slug;
    const stage=f.document.getElementById('gallery-room-stage');
    assert.equal(f.key('ArrowRight').prevented,undefined);
    f.context.innerWidth=390;f.context.innerHeight=844;
    let focusSnapshot;
    const focus=stage.focus.bind(stage);
    stage.focus=()=>{
      const active=api.getStats(),station=api.room.stations.get(chosen);
      const plan=overviewCameraPlan(station,active.viewport,roomCameraFov(390));
      assert.equal(active.activeSlug,chosen);assert.equal(api.content.activeSlug,chosen);
      assert.equal(active.globe.activeSlug,chosen);
      assert.equal(active.focusKind,null);assert.equal(active.pendingSlug,null);assert.equal(active.transitioning,false);
      assert.deepEqual(active.camera,plan.position,'the selected wall is fitted before the stage receives focus');
      assert.deepEqual(active.lookTarget,plan.target);
      assert.equal(api.camera.aspect,390/844);
      focusSnapshot=active;focus();
    };
    api.activate({eventSlug:chosen});
    assert.ok(focusSnapshot);assert.equal(f.document.activeElement,stage);
    assert.equal(api.root.inert,false);assert.equal(api.root.classList.contains('is-preparing'),false);
    assert.equal(f.globeSelections.at(-1),chosen);
    assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[],'entry selection does not invent navigation history');
    const selections=f.globeSelections.length,resizes=f.resizes.length,focuses=stage.focusCount;
    api.activate({eventSlug:prepared.activeSlug});
    assert.equal(api.getStats().activeSlug,chosen,'repeated activation cannot replace the selected achievement');
    assert.equal(f.globeSelections.length,selections);assert.equal(f.resizes.length,resizes);assert.equal(stage.focusCount,focuses);
    assert.equal(f.key(' ').prevented,true,'jump input becomes available after the selected wall is exposed');
  }finally{api.dispose();}
});

test('an unknown entrance choice preserves the prepared project and cannot alter an active or disposed room',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true,spatial:true});
  const prepared=api.getStats();
  try{
    api.activate({eventSlug:'not-a-known-achievement'});
    const active=api.getStats();
    assert.equal(active.active,true);assert.equal(active.activeSlug,prepared.activeSlug);
    assert.equal(api.content.activeSlug,prepared.activeSlug);assert.equal(active.globe.activeSlug,prepared.activeSlug);
    assert.deepEqual(active.camera,prepared.camera);assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[]);
    api.activate({eventSlug:projects.at(-1).slug});
    assert.equal(api.getStats().activeSlug,prepared.activeSlug);
  }finally{api.dispose();}
  api.activate({eventSlug:projects.at(-1).slug});
  assert.equal(api.getStats().active,false);assert.equal(api.getStats().activeSlug,prepared.activeSlug);
  assert.equal(f.pending.size,0);
});

test('default startup keeps deep links immediately active',async()=>{
  const f=startupFixture(),slug=projects[3].slug;f.context.location.href=portfolioUrl(f.context.location.href,{eventSlug:slug}).href;
  const api=await f.context.startGalleryRoom({spatial:true});
  try{
    assert.equal(api.getStats().active,true);assert.equal(api.getStats().activeSlug,slug);assert.equal(api.root.inert,false);
    assert.equal(api.root.classList.contains('is-preparing'),false);assert.equal(f.document.documentElement.classList.contains('intro-active'),false);
    f.document.getElementById('gallery-room-stage').focus();
    assert.equal(f.key('ArrowRight').prevented,true);assert.notEqual(api.getStats().activeSlug,slug);
  }finally{api.dispose();}
});

test('phones and coarse-pointer tablets delegate to a native gallery before creating a spatial renderer',async()=>{
  for(const [width,coarse,native]of[[320,false,true],[390,true,true],[699,false,true],[700,false,false],[700,true,true],[1000,true,true],[1001,true,false]]){
    let calls=0,received;
    const mobile={root:{},dispose(){}};
    const f=startupFixture({coarse,loadGalleryMobile:async()=>({startGalleryMobile:options=>{calls++;received=options;return mobile;}})});
    f.context.innerWidth=width;
    const api=await f.context.startGalleryRoom({deferActivation:true});
    try{
      assert.equal(calls,native?1:0,`${width}px, coarse=${coarse}`);
      if(native){
        assert.equal(api,mobile);assert.equal(received.deferActivation,true);assert.equal(typeof received.onExploreRoom,'function');
        assert.equal(f.document.getElementById('gallery-room-stage'),null,'the phone entry creates no CSS3D/WebGL room');
        assert.equal(f.pending.size,0,'the spatial render loop never starts');
      }else assert.ok(api.room,'desktop and fine-pointer tablet retain the spatial room');
    }finally{api.dispose();}
  }
});

test('native unlock hands the same selected achievement and importance order to one unlocked spatial room',async()=>{
  let received,disposed=false,disposals=0,f;
  const mobile={root:{},dispose(){if(disposed)return;disposed=true;disposals++;if(f.context.window.__galleryRoom===this)delete f.context.window.__galleryRoom;}};
  f=startupFixture({coarse:true,loadGalleryMobile:async()=>({startGalleryMobile:options=>{received=options;f.context.window.__galleryRoom=mobile;return mobile;}})});
  f.context.innerWidth=390;f.context.innerHeight=844;
  const native=await f.context.startGalleryRoom(),chosen=projects[3].slug;
  const first=received.onExploreRoom({eventSlug:chosen,sortMode:'importance'});
  const repeated=received.onExploreRoom({eventSlug:chosen,sortMode:'importance'});
  assert.equal(native,mobile);assert.equal(first,repeated,'repeated unlock taps share one handoff');
  const api=await first;
  try{
    assert.equal(disposals,1);assert.equal(api.getStats().activeSlug,chosen);assert.equal(api.getStats().sortMode,'importance');
    assert.equal(api.getStats().viewLocked,false);assert.equal(api.getStats().active,true);assert.equal(f.context.window.__galleryRoom,api);
    assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[],'changing presentation adds no history entries');
  }finally{api.dispose();}
});

test('a failed spatial unlock restores the readable native gallery and permits another attempt',async()=>{
  let f,attempts=0;const sessions=[],failure=new Error('WebGL unavailable');
  f=startupFixture({coarse:true,createRendererError:()=>++attempts===1?failure:null,loadGalleryMobile:async()=>({startGalleryMobile:options=>{
    const status={textContent:''};
    const api={root:{querySelector:()=>status},status,options,sortMode:'recent',disposed:false,
      setSortMode(mode){this.sortMode=mode;},dispose(){if(this.disposed)return;this.disposed=true;if(f.context.window.__galleryRoom===this)delete f.context.window.__galleryRoom;}};
    f.context.window.__galleryRoom=api;sessions.push(api);return api;
  }})});
  f.context.innerWidth=390;f.context.innerHeight=844;
  const chosen=projects[3].slug;f.context.location.href=portfolioUrl(f.context.location.href,{eventSlug:chosen}).href;
  const initial=await f.context.startGalleryRoom();
  await assert.rejects(initial.options.onExploreRoom({eventSlug:chosen,sortMode:'importance'}),error=>error===failure);
  const restored=sessions.at(-1);
  assert.equal(sessions.length,2);assert.equal(initial.disposed,true);assert.equal(restored.disposed,false);
  assert.equal(f.context.window.__galleryRoom,restored);assert.equal(restored.sortMode,'importance');
  assert.match(restored.status.textContent,/keep exploring here/);assert.equal(f.document.getElementById('gallery-room-stage'),null,'a failed room leaves no orphan surface');
  assert.equal(new URL(f.context.location.href).searchParams.get('event'),chosen);
  const retry=await restored.options.onExploreRoom({eventSlug:chosen,sortMode:'importance'});
  try{assert.equal(attempts,2);assert.equal(retry.getStats().activeSlug,chosen);assert.equal(retry.getStats().viewLocked,false);}
  finally{retry.dispose();}
});

test('the achievement header configures its PDF lazily without stage input and exposes accessible branded contact links',async()=>{
  let loads=0,exportOptions,finishRendering;
  const saved=[];
  const f=startupFixture({loadSummaryExporter:async()=>{
    loads++;
    return {exportProjectsPdf:options=>{exportOptions=options;return new Promise(resolve=>{finishRendering=resolve;});}};
  }});
  const api=await f.context.startGalleryRoom({spatial:true});
  const button=f.document.getElementById('gallery-summary-download'),status=f.document.getElementById('gallery-summary-status');
  const find=(element,predicate)=>predicate(element)?element:element.children.map(child=>find(child,predicate)).find(Boolean);
  let dialog;
  try{
    const header=api.root.children.find(child=>child.className==='gallery-room-header');
    const nav=header.children.find(child=>child.tagName==='NAV');
    const email=nav.children.find(child=>child.href==='mailto:batikanor@gmail.com');
    const linkedIn=nav.children.find(child=>child.href==='https://linkedin.com/in/batikanor');
    assert.equal(nav.children.indexOf(button),nav.children.findIndex(child=>child.textContent==='CV')+1,'the report is next to CV');
    assert.equal(button.getAttribute('aria-label'),'Download achievements summary (PDF)');
    for(const [link,brand,label]of[[email,'email','Email'],[linkedIn,'linkedin','LinkedIn']]){
      assert.equal(link.tagName,'A');assert.equal(link.getAttribute('aria-label'),label);
      assert.equal(link.classList.contains(`portfolio-brand-link-${brand}`),true);
      assert.equal(link.children[0].tagName,'SVG');assert.equal(link.children[0].getAttribute('aria-hidden'),'true');
      assert.equal(link.children[0].getAttribute('data-brand-icon'),brand);
      assert.equal(link.children[1].textContent.startsWith(label),true,'visible native link labels remain available');
    }
    assert.equal(email.children[0].children.length,5,'Gmail uses its complete multicolor mark');
    assert.equal(linkedIn.target,'_blank');assert.match(linkedIn.rel,/noopener/);
    assert.equal(loads,0,'preparing or viewing achievements never loads the PDF engine');
    assert.equal(button.getAttribute('aria-haspopup'),'dialog');
    assert.equal(button.getAttribute('aria-controls'),null,'options are not created during gallery startup');
    const initial=api.getStats(),stage=f.document.getElementById('gallery-room-stage');button.focus();
    for(const key of['w',' ','ArrowRight'])assert.equal(f.key(key).prevented,undefined,'native header controls never become movement keys');
    api.setViewLocked(false);stage.focus();f.key('w');
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:7,clientX:100,clientY:100});
    assert.equal(api.getStats().keys.length,1);assert.equal(stage.captures.has(7),true);
    button.focus();button.dispatch('click');
    assert.equal(loads,0,'opening options must not import or render a PDF');
    assert.equal(api.getStats().keys.length,0,'opening PDF options releases held movement');
    assert.equal(stage.captures.size,0,'opening PDF options releases the room drag');
    dialog=f.document.getElementById(button.getAttribute('aria-controls'));
    assert.equal(dialog.tagName,'DIALOG');assert.equal(dialog.open,true);
    assert.equal(button.getAttribute('aria-expanded'),'true');
    const images=find(dialog,child=>child.name==='include-images');
    const scale=find(dialog,child=>child.name==='image-size');
    const compress=find(dialog,child=>child.name==='compress-pdf');
    const strength=find(dialog,child=>child.name==='compression-strength');
    const form=find(dialog,child=>child.tagName==='FORM');
    const innerStatus=find(dialog,child=>child.className==='achievement-summary-status');
    assert.equal(images.checked,true,'the illustrated report is enabled by default');
    assert.equal(scale.value,'100');assert.equal(compress.checked,true);assert.equal(strength.value,'10');
    assert.equal(f.document.activeElement,images,'the modal focuses its native first option');
    for(const key of['w',' ','ArrowRight']){
      const event=f.key(key);assert.equal(event.propagationStopped,true);assert.equal(event.prevented,undefined);
    }
    const stageFocuses=stage.focusCount;
    const escape=f.key('Escape');assert.equal(escape.prevented,true);assert.equal(escape.propagationStopped,true);
    assert.equal(dialog.open,false);assert.equal(button.getAttribute('aria-expanded'),'false');
    assert.equal(f.document.activeElement,button);assert.equal(stage.focusCount,stageFocuses,'Escape closes only the options dialog');
    assert.equal(loads,0,'dismissing options never loads the PDF engine');
    button.dispatch('click');button.dispatch('click');
    assert.equal(dialog.open,true);assert.equal(dialog.modalOpenCount,2,'repeated clicks do not create or reopen a second modal');
    scale.value='60';scale.dispatch('input');strength.value='70';strength.dispatch('input');
    compress.checked=false;compress.dispatch('input');images.checked=false;images.dispatch('input');
    assert.equal(form.dispatch('submit').prevented,true);form.dispatch('submit');
    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(loads,1);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');
    assert.equal(exportOptions.includeImages,false);assert.equal(exportOptions.imageScale,.6);
    assert.equal(exportOptions.compressPdf,false);assert.equal(exportOptions.compressionStrength,.7);assert.equal(exportOptions.save,false);
    assert.equal(exportOptions.signal.aborted,false);
    exportOptions.onProgress({index:3,total:32});assert.equal(innerStatus.textContent,'Preparing achievement 4 of 32…');
    assert.equal(innerStatus.getAttribute('aria-live'),'polite');assert.equal(innerStatus.hidden,false);
    finishRendering({save:async name=>saved.push(name)});
    await new Promise(resolve=>setImmediate(resolve));
    assert.deepEqual(saved,['batikan-achievements-summary.pdf']);assert.equal(button.disabled,false);
    assert.equal(button.getAttribute('aria-busy'),null);assert.equal(status.textContent,'Achievements summary downloaded.');
    assert.equal(status.getAttribute('aria-live'),'polite');assert.equal(dialog.open,false);
    assert.equal(f.document.activeElement,button,'downloading restores its native trigger focus');
    assert.equal(api.getStats().activeSlug,initial.activeSlug);assert.deepEqual(api.getStats().camera,initial.camera);
    assert.equal(api.getStats().keys.length,0);assert.equal(api.getStats().jump.height,0);assert.deepEqual(f.pushed,[]);
  }finally{api.dispose();}
  assert.equal(dialog.isConnected,false,'disposing the room removes its modal');
  button.dispatch('click');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(loads,1,'disposing the room removes the real download listener');
});

test('the initial view lock blocks walking and looking, keeps Space jumping, and unlocks through its native button',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({spatial:true});
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
  const f=startupFixture(),api=await f.context.startGalleryRoom({spatial:true});
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
  const f=startupFixture(),api=await f.context.startGalleryRoom({spatial:true});
  try{
    const stage=f.document.getElementById('gallery-room-stage');stage.focus();f.tick(0);f.tick(16.7);
    const initial=api.getStats(),station=api.room.stations.get(initial.activeSlug);
    const [clientX,clientY]=screenPoint(api.camera,station.surfaces.story.position,1280,900);
    stage.dispatch('pointerdown',{button:0,isPrimary:true,pointerId:10,clientX,clientY});
    stage.dispatch('pointerup',{pointerId:10,clientX,clientY});
    assert.equal(api.getStats().viewLocked,true);assert.equal(api.getStats().focusKind,'story');assert.equal(api.content.focusedSurface,'story');
    assert.notDeepEqual(api.getStats().camera,initial.camera,'the programmatic reading approach remains available');
    assert.equal(api.content.readingContainer,api.root,'the story can use native screen pixels above the spatial scene');
    assert.equal(f.key('Escape').prevented,true);assert.equal(api.getStats().focusKind,null);assert.equal(api.getStats().viewLocked,true);
    assert.deepEqual(api.getStats().camera,initial.camera);
    f.key('ArrowRight');assert.notEqual(api.getStats().activeSlug,initial.activeSlug);assert.equal(api.getStats().viewLocked,true);
    assert.equal(api.getStats().focusKind,null);assert.equal(f.pushed.length,1,'project navigation stays available with the view locked');
  }finally{api.dispose();}
});

test('lock toggles preserve programmatic reading animations and pending project navigation',async()=>{
  const f=startupFixture({reducedMotion:false}),api=await f.context.startGalleryRoom({spatial:true});
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


test('native description focus blocks the blurred scene while map and header controls remain available',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({spatial:true});
  try{
    const stage=f.document.getElementById('gallery-room-stage');
    const close=f.document.createElement('button');api.root.append(close);
    api.content.approach('story');
    api.content.readingChanged(true,{closeDescription:close});
    assert.equal(stage.inert,true,'blurred scene descendants cannot receive pointer or keyboard interaction');
    assert.equal(f.document.activeElement,close,'the visible close action is immediately available to keyboard users');
    stage.focus();assert.equal(f.document.activeElement,close,'the inert scene cannot steal focus from the description');
    f.picker.element.focus();assert.equal(f.document.activeElement,f.picker.element,'map navigation stays usable');
    f.document.getElementById('gallery-view-lock').focus();
    assert.equal(f.document.activeElement,f.document.getElementById('gallery-view-lock'),'navbar controls stay usable');
    assert.notEqual(api.root.inert,true,'the whole interface remains available');
    api.content.readingChanged(false,{closeDescription:close});api.content.returnToRoom();
    assert.equal(stage.inert,false);assert.equal(f.document.activeElement,stage);
  }finally{api.dispose();}
});

test('repeated approach and return taps do not restart the current camera transition',async()=>{
  const f=startupFixture({reducedMotion:false}),api=await f.context.startGalleryRoom({spatial:true});
  try{
    f.tick(0);f.tick(16.7);
    const overview=api.getStats(),surface=api.content.stationSurfaces.get(overview.activeSlug).story;
    const destination=surfaceCameraPlan(surface,overview.viewport,api.camera.fov);
    const duration=roomTransitionDuration(new THREE.Vector3(...overview.camera).distanceTo(new THREE.Vector3(...destination.position)));
    api.content.approach('story');
    f.advanceClock(16.7+duration*.4);api.content.approach('story');
    f.advanceClock(16.7+duration*.8);api.content.approach('story');
    f.tick(16.7+duration+1);
    assert.equal(api.getStats().transitioning,false,'the first approach deadline is retained');
    assert.deepEqual(api.getStats().camera,destination.position,'the completed camera is the exact destination');
    assert.deepEqual(api.getStats().lookTarget,destination.target);
    const backStart=16.7+duration+1;
    const backDuration=roomTransitionDuration(new THREE.Vector3(...destination.position).distanceTo(new THREE.Vector3(...overview.camera)));
    api.content.returnToRoom();
    f.advanceClock(backStart+backDuration*.4);api.content.returnToRoom();
    f.advanceClock(backStart+backDuration*.8);api.content.returnToRoom();
    f.tick(backStart+backDuration+1);
    assert.equal(api.getStats().transitioning,false,'the first return deadline is retained');
    assert.equal(api.getStats().focusKind,null);assert.deepEqual(api.getStats().camera,overview.camera);assert.deepEqual(api.getStats().lookTarget,overview.lookTarget);
    assert.equal(api.camera.view?.enabled,false,'return settles the complete wall projection');
    api.content.returnToRoom();assert.equal(api.getStats().transitioning,false,'a settled Return does not start an idle tween');
  }finally{api.dispose();}
});

test('a new focus destination samples the in-flight camera between render frames',async()=>{
  const f=startupFixture({reducedMotion:false}),api=await f.context.startGalleryRoom({spatial:true});
  try{
    f.tick(0);f.tick(16.7);
    const origin=api.getStats(),story=api.content.stationSurfaces.get(origin.activeSlug).story;
    const destination=surfaceCameraPlan(story,origin.viewport,api.camera.fov);
    const duration=roomTransitionDuration(new THREE.Vector3(...origin.camera).distanceTo(new THREE.Vector3(...destination.position)));
    api.content.approach('story');f.tick(16.7+duration*.1);
    const oldRendered=api.getStats().camera;
    f.advanceClock(16.7+duration*.4);
    const t=.4,smooth=t*t*t*(t*(t*6-15)+10);
    const expected=new THREE.Vector3(...origin.camera).lerp(new THREE.Vector3(...destination.position),smooth);
    api.content.returnToRoom();
    assert.ok(api.camera.position.distanceTo(expected)<1e-10,'return starts at the current tween sample');
    assert.notDeepEqual(api.getStats().camera,oldRendered,'it does not restart from a stale rendered frame');
    f.tick(10000);assert.equal(api.getStats().transitioning,false);assert.deepEqual(api.getStats().camera,origin.camera);
  }finally{api.dispose();}
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

test('phone browser-height changes preserve the chosen reading board and refit every live pose',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({spatial:true});
  try{
    const chosen=api.getStats().activeSlug;
    for(const [width,height]of[[390,844],[390,664],[390,844],[412,915],[412,780],[844,390],[390,844]]){
      f.context.innerWidth=width;f.context.innerHeight=height;
      f.context.window.dispatch('resize');
      api.content.approach('story');
      const stats=api.getStats(),station=api.room.stations.get(chosen);
      assert.equal(stats.activeSlug,chosen);assert.equal(stats.focusKind,'story');
      assert.equal(station.wallLayout.width,width);assert.equal(station.wallLayout.height,height);
      assert.equal(stats.viewport.headerBounds.right,width-stats.viewport.headerBounds.left);
      const expected=surfaceCameraPlan(api.content.stationSurfaces.get(chosen).story,stats.viewport,api.camera.fov);
      assert.deepEqual(stats.camera,expected.position,'visible browser dimensions determine the complete approached frame');
      assert.equal(api.getStats().transitioning,false,'a resize cannot leave a stale in-progress button animation');
      assert.equal(api.camera.aspect,width/height);
    }
    assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[],'browser chrome changes do not change project history');
  }finally{api.dispose();}
});

test('native phone scroll regions have no ancestor blocking pan-y and fixed board chrome cannot focus-scroll sideways',async()=>{
  const [roomCss,contentCss,globeCss]=await Promise.all(['galleryRoom.css','galleryRoomContent.css','galleryRoomGlobe.css'].map(name=>readFile(new URL('../src/'+name,import.meta.url),'utf8')));
  const declarations=(css,selector)=>{
    const rule=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(match=>match[1].trim()===selector);
    assert.ok(rule,`${selector} has its own gesture boundary`);
    return Object.fromEntries([...rule[2].matchAll(/([\w-]+)\s*:\s*([^;]+);?/g)].map(match=>[match[1],match[2].trim()]));
  };
  const stage=declarations(roomCss,'.gallery-room-stage');
  const surface=declarations(contentCss,'.gallery-room-surface');
  const globe=declarations(globeCss,'.gallery-room-globe');
  const nativePanY=ancestors=>ancestors.every(style=>!style['touch-action']||['auto','pan-y','manipulation'].includes(style['touch-action']));
  for(const selector of['.gallery-room-story-scroll','.gallery-room-title-content','.gallery-room-references-list','.gallery-room-photo-caption']){
    const scroll=declarations(contentCss,selector);
    assert.ok(nativePanY([stage,surface,scroll]),`${selector}: a parent must not cancel its native vertical gesture`);
    assert.equal(scroll['touch-action'],'pan-y');
  }
  for(const selector of['.gallery-room-globe-credit','.gallery-room-globe-cluster-options']){
    assert.ok(nativePanY([globe,declarations(globeCss,selector)]),`${selector}: globe dragging must not disable native list scrolling`);
  }
  assert.ok(nativePanY([declarations(roomCss,'.gallery-room-picker-options')]));
  assert.equal(surface.overflow,'clip','outer frames cannot scroll hidden footer controls horizontally on native focus');
  const backdrop=declarations(roomCss,'.gallery-room-backdrop');
  assert.equal(backdrop['touch-action'],'none');assert.equal(backdrop['pointer-events'],'auto','the empty room keeps a separate custom drag target');
  assert.equal(declarations(globeCss,'.gallery-room-globe-canvas')['touch-action'],'none','the actual globe canvas keeps its custom drag gesture');
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

test('importance order preserves the current focused achievement and synchronizes selector, walls, counter order and arrows',async()=>{
  const recent=sortAchievementsNewestFirst(projects),important=sortAchievementsByImportance(recent),chosen=recent[4].slug;
  const f=startupFixture();f.context.location.href=portfolioUrl(f.context.location.href,{eventSlug:chosen}).href;
  const api=await f.context.startGalleryRoom({spatial:true});
  try{
    assert.equal(api.getStats().sortMode,'recent');
    assert.deepEqual([...api.getStats().projectOrder],recent.map(project=>project.slug));
    const station=api.room.stations.get(chosen),href=f.context.location.href,globeCount=f.globeSelections.length;
    api.content.approach('story');f.picker.element.focus();
    f.picker.changeSort('importance');
    const index=important.findIndex(project=>project.slug===chosen),neighbors=important.slice(Math.max(0,index-1),index+2).map(project=>project.slug);
    assert.equal(api.getStats().activeSlug,chosen);assert.equal(api.getStats().sortMode,'importance');
    assert.equal(api.getStats().focusKind,'story');assert.equal(api.getStats().viewLocked,true);
    assert.deepEqual([...api.getStats().projectOrder],important.map(project=>project.slug));
    assert.deepEqual([...f.picker.projects].map(project=>project.slug),important.map(project=>project.slug));
    assert.equal(f.picker.activeSlug,chosen);assert.equal(f.picker.sortMode,'importance');
    assert.equal(api.room.stations.get(chosen),station);assert.equal(station.index,index);
    assert.deepEqual([...api.room.stations.keys()],important.map(project=>project.slug));
    assert.deepEqual([...api.content.visibleSlugs],neighbors);assert.deepEqual(api.room.visibleSlugs,neighbors);
    assert.equal(api.content.stationSurfaces.get(chosen).story.position[0],station.surfaces.story.position[0]);
    assert.equal(f.context.location.href,href);assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[]);
    assert.equal(f.globeSelections.length,globeCount);assert.equal(f.document.activeElement,f.picker.element,'sorting does not steal native control focus');
    const expected=surfaceCameraPlan(api.content.stationSurfaces.get(chosen).story,api.getStats().viewport,api.camera.fov);
    for(let axis=0;axis<3;axis++)assert.ok(Math.abs(api.camera.position.toArray()[axis]-expected.position[axis])<1e-8);
    f.document.getElementById('gallery-next').dispatch('click');
    const adjacent=important[index+1].slug;assert.equal(api.getStats().activeSlug,adjacent);
    assert.deepEqual(f.pushed,[adjacent]);
    f.picker.changeSort('recent');
    assert.equal(api.getStats().activeSlug,adjacent);assert.equal(api.getStats().sortMode,'recent');
    assert.deepEqual([...api.room.stations.keys()],recent.map(project=>project.slug));
    assert.deepEqual([...api.getStats().projectOrder],recent.map(project=>project.slug));
    assert.deepEqual(f.pushed,[adjacent],'sort changes do not add project history entries');
  }finally{api.dispose();}
});

test('sorting during a pending project change commits that selected achievement once and retains order through browser history',async()=>{
  const recent=sortAchievementsNewestFirst(projects),important=sortAchievementsByImportance(recent);
  const f=startupFixture({reducedMotion:false}),api=await f.context.startGalleryRoom({spatial:true});
  try{
    f.document.getElementById('gallery-next').dispatch('click');
    const pending=api.getStats().pendingSlug;assert.equal(pending,recent[1].slug);assert.equal(f.timers.size,1);
    f.picker.changeSort('importance');
    assert.equal(api.getStats().activeSlug,pending);assert.equal(api.getStats().pendingSlug,null);assert.equal(f.timers.size,0);
    assert.equal(api.getStats().transitioning,false);assert.deepEqual(f.pushed,[pending]);assert.deepEqual(f.replaced,[]);
    assert.equal(new URL(f.context.location.href).searchParams.get('event'),pending);
    assert.equal(api.room.stations.get(pending).index,important.findIndex(project=>project.slug===pending));
    f.popstate(recent[0].slug);
    const callbacks=[...f.timers.values()];f.timers.clear();callbacks.forEach(callback=>callback());
    assert.equal(api.getStats().activeSlug,recent[0].slug);assert.equal(api.getStats().sortMode,'importance');
    assert.deepEqual([...api.getStats().projectOrder],important.map(project=>project.slug));
    assert.deepEqual(f.pushed,[pending],'Back does not introduce an extra entry');
  }finally{api.dispose();}
});

test('deferred and disposed galleries cannot be reordered by old controls or their public API',async()=>{
  const f=startupFixture(),api=await f.context.startGalleryRoom({deferActivation:true,spatial:true});
  const originalOrder=[...api.getStats().projectOrder];
  try{
    f.picker.changeSort('importance');assert.equal(api.getStats().sortMode,'recent');
    assert.deepEqual([...api.getStats().projectOrder],originalOrder);
    api.activate();api.setSortMode('importance');assert.equal(api.getStats().sortMode,'importance');
    const order=[...api.getStats().projectOrder];api.dispose();
    f.picker.changeSort('recent');api.setSortMode('recent');
    assert.equal(api.getStats().sortMode,'importance');assert.deepEqual([...api.getStats().projectOrder],order);
    assert.equal(f.pending.size,0);assert.equal(f.timers.size,0);
  }finally{api.dispose();}
});

test('Back to the original bare gallery URL restores its original achievement after importance sorting',async()=>{
  const recent=sortAchievementsNewestFirst(projects),important=sortAchievementsByImportance(recent);
  const f=startupFixture(),api=await f.context.startGalleryRoom({spatial:true});
  try{
    assert.notEqual(recent[0].slug,important[0].slug);
    f.picker.changeSort('importance');assert.equal(api.getStats().activeSlug,recent[0].slug);
    f.document.getElementById('gallery-next').dispatch('click');
    assert.notEqual(api.getStats().activeSlug,recent[0].slug);assert.equal(f.pushed.length,1);
    f.popstate(null);
    assert.equal(new URL(f.context.location.href).searchParams.get('event'),null);
    assert.equal(api.getStats().activeSlug,recent[0].slug);
    assert.equal(api.getStats().sortMode,'importance');assert.equal(f.pushed.length,1);
  }finally{api.dispose();}
});
