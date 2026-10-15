import * as THREE from 'three';
import {CSS3DRenderer} from 'three/addons/renderers/CSS3DRenderer.js';
import achievements from './data/achievements.json';
import {sortAchievementsNewestFirst, getChronologyState} from './chronology.js';
import {readPortfolioRoute, portfolioUrl} from './portfolioRoute.js';
import {createGalleryRoomScene} from './galleryRoomScene.js';
import {createGalleryRoomContent} from './galleryRoomContent.js';
import {createGalleryRoomGlobe} from './galleryRoomGlobe.js';
import {createGalleryRoomPicker} from './galleryRoomPicker.js';
import {overviewCameraPlan,surfaceCameraPlan,roomCameraFov,roomWalkingVector,roomTransitionDuration} from './galleryRoomCamera.js';
import {renderGalleryRoomDom} from './galleryRoomDomView.js';
import {createRoomJumpState, stepRoomJump} from './galleryRoomJump.js';
import './galleryRoom.css';

const ordered = sortAchievementsNewestFirst(achievements);
const bySlug = new Map(ordered.map(project => [project.slug, project]));
const knownSlugs = new Set(bySlug.keys());
const el = (tag, className, text) => {
  const node=document.createElement(tag);
  if(className) node.className=className;
  if(text!=null) node.textContent=text;
  return node;
};
const svgArrow = direction => direction === 'previous' ? '←' : '→';

/** Prepare the spatial gallery; a deferred room keeps intro focus until activate(). */
export async function startGalleryRoom({deferActivation=false}={}) {
  window.__galleryRoom?.dispose?.();
  document.documentElement.classList.remove('gallery-pending');
  if(!deferActivation)document.documentElement.classList.remove('intro-active');
  document.body.classList.add('gallery-room-active');
  const original=document.getElementById('app');
  if(original) original.inert=true;
  const reducedQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion=reducedQuery.matches;
  const root=el('main','gallery-room'); root.id='gallery-room';
  root.inert=!!deferActivation;
  if(deferActivation)root.classList.add('is-preparing');
  const stage=el('section','gallery-room-stage'); stage.id='gallery-room-stage';
  stage.tabIndex=0;
  stage.setAttribute('aria-label','3D project gallery. Drag to look around, WASD to walk between neighboring projects, Space to jump, or use the globe and chronology.');
  const backdrop=el('div','gallery-room-backdrop');backdrop.setAttribute('aria-hidden','true');
  stage.append(backdrop);root.append(stage);

  const header=el('header','gallery-room-header');
  const brand=el('a','gallery-room-brand','Batıkan');brand.href='/';
  brand.setAttribute('aria-label','Batıkan — return to introduction');brand.title='Return to introduction';
  const identity=el('div','gallery-room-identity');
  identity.append(brand,el('span','gallery-room-tagline','Hacker · Developer · Entrepreneur'));
  const links=el('nav','gallery-room-links');links.setAttribute('aria-label','Gallery controls, contact and documents');
  const returnButton=el('button','gallery-room-return','↶');returnButton.type='button';returnButton.hidden=true;
  returnButton.setAttribute('aria-label','Return to room');returnButton.title='Return to room';
  const cv=el('a',null,'CV');cv.href='/cv/';
  const email=el('a',null,'Email');email.href='mailto:batikanor@gmail.com';
  const linkedIn=el('a',null,'LinkedIn ↗');linkedIn.href='https://linkedin.com/in/batikanor';linkedIn.target='_blank';linkedIn.rel='noopener noreferrer';
  const lockButton=el('button','gallery-room-view-lock');lockButton.id='gallery-view-lock';lockButton.type='button';
  links.append(returnButton,cv,email,linkedIn,lockButton);header.append(identity,links);root.append(header);

  const dock=el('aside','gallery-room-dock');dock.setAttribute('aria-label','Globe and project navigation');
  const globeMount=el('div','gallery-room-globe-mount');globeMount.id='gallery-room-globe';
  const chronology=el('nav','gallery-room-chronology');chronology.setAttribute('aria-label','Project chronology');
  const previous=el('button','gallery-room-arrow',svgArrow('previous'));previous.id='gallery-previous';previous.type='button';
  previous.setAttribute('aria-label','Previous, newer project');previous.title='Newer project · ←';
  const picker=createGalleryRoomPicker({projects:ordered,onSelect:selectProject});
  const next=el('button','gallery-room-arrow',svgArrow('next'));next.id='gallery-next';next.type='button';
  next.setAttribute('aria-label','Next, older project');next.title='Older project · →';
  chronology.append(previous,picker.element,next);dock.append(globeMount,chronology);root.append(dock);

  const hint=el('div','gallery-room-hint');
  const help=el('span','gallery-room-help');hint.append(help);
  root.append(hint);
  const motion=el('div','gallery-room-motion');motion.setAttribute('aria-hidden','true');root.append(motion);
  const announce=el('p','gallery-room-live');announce.id='gallery-room-status';announce.setAttribute('role','status');announce.setAttribute('aria-live','polite');root.append(announce);
  document.body.append(root);

  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setClearColor(0x444b4c,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.domElement.className='gallery-room-webgl';renderer.domElement.setAttribute('aria-hidden','true');
  const cssRenderer=new CSS3DRenderer();cssRenderer.domElement.className='gallery-room-css3d';
  stage.append(cssRenderer.domElement,renderer.domElement);
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x444b4c,38,115);
  const cssScene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(roomCameraFov(innerWidth),innerWidth/innerHeight,.08,170);
  const cssCamera=new THREE.PerspectiveCamera();
  cssCamera.position.z=1000;
  const viewport=()=>({width:innerWidth,height:innerHeight,dockBounds:dock.getBoundingClientRect()});
  const room=createGalleryRoomScene({scene,renderer,projects:ordered,reducedMotion,viewport:viewport()});
  let slug=readPortfolioRoute(location.href,knownSlugs).eventSlug??ordered[0].slug;
  let viewLocked=true;
  let active=!deferActivation,focusKind=null,animation=null,teleportTimer=null,pendingSlug=null,disposed=false,raf=0,lastTime=0,frameCount=0,needsRender=true;
  const keys=new Set(),tapKeys=new Set(),lookTarget=new THREE.Vector3(),pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();
  let jumpState=createRoomJumpState(),jumpQueued=false;
  const abort=new AbortController(),signal=abort.signal;
  const content=createGalleryRoomContent({scene:cssScene,stations:room.stations,activeSlug:slug,
    baseHref:location.href,onFocusSurface:focusSurface,onProjectLink:selectProject,onReturnToRoom:returnToRoom});
  const globe=createGalleryRoomGlobe({container:globeMount,achievements:ordered,onSelect:selectProject});
  globe.setActive(slug);

  function clearMovementKeys(){keys.clear();tapKeys.clear();jumpQueued=false;}
  function refreshViewLock(){
    root.dataset.viewLocked=String(viewLocked);
    lockButton.setAttribute('aria-pressed',String(viewLocked));
    const label=viewLocked?'Unlock viewing angle and walking':'Lock viewing angle and walking';
    lockButton.setAttribute('aria-label',label);lockButton.title=label;
    lockButton.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="'+(viewLocked?'M8 10V7a4 4 0 0 1 8 0v3':'M8 10V7a4 4 0 0 1 7.5-2')+'"/><path d="M12 14v3"/></svg>';
    help.textContent=viewLocked?'Space jump · unlock to walk and look':'WASD walk · Space jump · drag to look';
    stage.setAttribute('aria-label','3D project gallery. '+(viewLocked?'View locked. Unlock the top-bar padlock to look around and walk. ':'Drag to look around, WASD to walk between neighboring projects. ')+'Space to jump, or use the globe and chronology.');
  }
  function setViewLocked(locked){
    if(disposed)return;
    const nextLocked=!!locked;
    if(nextLocked===viewLocked)return;
    cancelDrag();keys.clear();tapKeys.clear();
    viewLocked=nextLocked;refreshViewLock();
  }
  function resetJump(){
    camera.position.y-=jumpState.height;lookTarget.y-=jumpState.height;
    jumpState=createRoomJumpState();jumpQueued=false;needsRender=true;
  }
  function updateVisibleProjects(){
    const index=ordered.findIndex(project=>project.slug===slug);
    content.setVisibleSlugs?.(ordered.slice(Math.max(0,index-1),index+2).map(project=>project.slug));
  }
  function adoptWalkStation(nextSlug){
    if(!bySlug.has(nextSlug)||nextSlug===slug)return;
    beginManualMovement();
    slug=nextSlug;pendingSlug=null;focusKind=null;
    content.setActiveSlug(slug);content.setFocusedSurface?.(null);updateVisibleProjects();
    globe.setActive(slug);room.update?.(performance.now()/1000,0,slug);
    history.replaceState({galleryRoom:true,eventSlug:slug},'',portfolioUrl(location.href,{eventSlug:slug}));
    refreshNavigation();needsRender=true;
  }
  function beginManualMovement(){
    const cancelledSelection=pendingSlug!==null,wasFocused=focusKind!==null;
    if(teleportTimer){clearTimeout(teleportTimer);teleportTimer=null;}
    pendingSlug=null;root.classList.remove('is-teleporting');
    animation=null;focusKind=null;
    if(wasFocused)content.setFocusedSurface?.(null);
    if(cancelledSelection)history.replaceState({galleryRoom:true,eventSlug:slug},'',portfolioUrl(location.href,{eventSlug:slug}));
    if(wasFocused||cancelledSelection)refreshNavigation();
  }
  function currentStation(){return room.stations.get(slug);}
  function currentSurface(kind){return content.stationSurfaces.get(slug)?.[kind];}
  function framePlan(kind=focusKind){
    const station=currentStation();
    if(kind){const descriptor=currentSurface(kind);if(descriptor){
      const pose=station.surfaces?.[kind]??station.contentSurfaces?.[kind]??descriptor;
      return surfaceCameraPlan({...pose,worldWidth:descriptor.worldWidth,worldHeight:descriptor.worldHeight},viewport(),camera.fov);
    }}
    return overviewCameraPlan(station,viewport(),camera.fov);
  }
  function setProjection(offset){
    if(!offset.x&&!offset.y)camera.clearViewOffset();
    else camera.setViewOffset(innerWidth,innerHeight,offset.x,offset.y,innerWidth,innerHeight);
  }
  function applyPose(plan){resetJump();camera.position.fromArray(plan.position);lookTarget.fromArray(plan.target);camera.lookAt(lookTarget);setProjection(plan.viewOffset);needsRender=true;}
  function animatePose(plan){
    resetJump();
    const distance=camera.position.distanceTo(new THREE.Vector3().fromArray(plan.position));
    const duration=roomTransitionDuration(distance,reducedMotion);
    if(!duration){applyPose(plan);animation=null;return;}
    animation={start:performance.now(),duration,from:camera.position.clone(),to:new THREE.Vector3().fromArray(plan.position),
      targetFrom:lookTarget.clone(),targetTo:new THREE.Vector3().fromArray(plan.target),
      offsetFrom:{x:camera.view?.offsetX??0,y:camera.view?.offsetY??0},offsetTo:plan.viewOffset};
  }
  function refreshNavigation(){
    const chronology=getChronologyState(ordered,pendingSlug??slug),project=chronology.current;
    previous.disabled=!chronology.previous;next.disabled=!chronology.next;
    picker.setActive(project.slug);
    cv.href='/cv/?event='+encodeURIComponent(slug);
    root.dataset.activeSlug=slug;root.dataset.focus=focusKind??'room';
    root.dataset.focusType=focusKind?(currentSurface(focusKind)?.type??focusKind):'room';
    returnButton.hidden=!focusKind;
    const focused=currentSurface(focusKind);
    announce.textContent=project.title+'. '+project.city+', '+project.country+'. '+(focusKind?'Viewing '+(focused?.element?.getAttribute('aria-label')??focusKind)+'.':'Project room.');
  }
  function setStation(nextSlug){
    cancelDrag();
    slug=nextSlug;pendingSlug=null;focusKind=null;
    clearMovementKeys();animation=null;
    content.setActiveSlug(slug);updateVisibleProjects();globe.setActive(slug);room.update?.(performance.now()/1000,0,slug);
    content.setFocusedSurface?.(focusKind);
    applyPose(framePlan());refreshNavigation();
  }
  function selectProject(nextSlug,options={}){
    if(!active||!bySlug.has(nextSlug)||disposed)return;
    picker.close();
    cancelDrag();clearMovementKeys();resetJump();
    const previousIntent=pendingSlug??slug;
    if(teleportTimer){clearTimeout(teleportTimer);teleportTimer=null;}
    pendingSlug=null;
    root.classList.remove('is-teleporting');
    if(options.history!==false&&nextSlug!==previousIntent)history.pushState({galleryRoom:true,eventSlug:nextSlug},'',portfolioUrl(location.href,{eventSlug:nextSlug}));
    if(nextSlug===slug){globe.setActive(nextSlug,{recenter:true});returnToRoom();return;}
    const update=()=>{setStation(nextSlug);root.classList.remove('is-teleporting');teleportTimer=null;};
    if(reducedMotion){update();return;}
    pendingSlug=nextSlug;refreshNavigation();
    root.classList.add('is-teleporting');
    teleportTimer=setTimeout(update,155);
  }
  function focusSurface(descriptor){
    if(!active||!descriptor||descriptor.kind==='title')return;
    if(pendingSlug!==null)beginManualMovement();
    if(descriptor.slug!==slug)adoptWalkStation(descriptor.slug);
    if(descriptor.slug!==slug)return;
    if(focusKind===descriptor.kind&&!animation){stage.focus({preventScroll:true});return;}
    clearMovementKeys();focusKind=descriptor.kind;animatePose(framePlan());refreshNavigation();
    content.setFocusedSurface?.(focusKind);
    stage.focus({preventScroll:true});
  }
  function returnToRoom(){if(!active)return;cancelDrag();clearMovementKeys();beginManualMovement();focusKind=null;content.setFocusedSurface?.(null);animatePose(framePlan(null));refreshNavigation();stage.focus({preventScroll:true});}
  function step(direction){const target=getChronologyState(ordered,pendingSlug??slug)[direction];if(target)selectProject(target.slug);}
  previous.addEventListener('click',()=>step('previous'),{signal});next.addEventListener('click',()=>step('next'),{signal});
  returnButton.addEventListener('click',returnToRoom,{signal});
  lockButton.addEventListener('click',()=>{if(active){setViewLocked(!viewLocked);stage.focus({preventScroll:true});}},{signal});
  addEventListener('popstate',()=>{if(!active)return;const route=readPortfolioRoute(location.href,knownSlugs);selectProject(route.eventSlug??ordered[0].slug,{history:false});},{signal});

  const controlTarget=target=>target instanceof Element&&!!target.closest('button,a,input,select,textarea,iframe,[contenteditable],[data-gallery-surface],.gallery-room-dock,.gallery-room-header');
  addEventListener('keydown',event=>{
    if(!active)return;
    if(event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==='Escape'){event.preventDefault();returnToRoom();return;}
    if(controlTarget(event.target))return;
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();step(event.key==='ArrowRight'?'next':'previous');return;}
    const key=event.key.toLowerCase();
    if('wasd'.includes(key)&&key.length===1){
      event.preventDefault();
      if(!viewLocked){keys.add(key);tapKeys.add(key);beginManualMovement();}
    }
    if(event.code==='Space'||event.key===' '){
      event.preventDefault();
      if(!event.repeat&&jumpState.grounded){
        if(viewLocked)animation=null;
        else beginManualMovement();
        jumpQueued=true;
      }
    }
    if(key==='r'){event.preventDefault();returnToRoom();}
  },{signal});
  addEventListener('keyup',event=>{if(active)keys.delete(event.key.toLowerCase());},{signal});
  addEventListener('blur',event=>{if(event.target===window){clearMovementKeys();resetJump();cancelDrag();}},{signal});
  document.addEventListener('visibilitychange',()=>{clearMovementKeys();resetJump();cancelDrag();lastTime=0;if(!document.hidden&&!raf&&!disposed){raf=requestAnimationFrame(render);}},{signal});

  let drag=null;
  function cancelDrag(){
    const id=drag?.id;drag=null;root.classList.remove('is-looking');
    if(id!=null&&stage.hasPointerCapture(id))stage.releasePointerCapture(id);
  }
  stage.addEventListener('pointerdown',event=>{
    if(!active||controlTarget(event.target)||event.button!==0||event.isPrimary===false||drag)return;
    stage.focus({preventScroll:true});if(!viewLocked)animation=null;
    const rotation=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:rotation.y,pitch:rotation.x,moved:false};
    stage.setPointerCapture(event.pointerId);
  },{signal});
  stage.addEventListener('pointermove',event=>{
    if(!active||!drag||drag.id!==event.pointerId)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    const firstMove=!drag.moved&&Math.hypot(dx,dy)>5;
    if(firstMove)drag.moved=true;
    if(!drag.moved||viewLocked)return;
    root.classList.add('is-looking');
    if(firstMove)beginManualMovement();
    const yaw=drag.yaw-dx*.0032,pitch=THREE.MathUtils.clamp(drag.pitch-dy*.0028,-.63,.7);
    // Keep the fitted projection while looking; clearing it jumps the room
    // toward the globe and misaligns the native reading space on first drag.
    camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));
    needsRender=true;
    lookTarget.copy(camera.position).add(new THREE.Vector3(0,0,-14).applyQuaternion(camera.quaternion));
  },{signal});
  stage.addEventListener('pointerup',event=>{
    if(!active||!drag||drag.id!==event.pointerId)return;
    const moved=drag.moved;drag=null;root.classList.remove('is-looking');
    if(stage.hasPointerCapture(event.pointerId))stage.releasePointerCapture(event.pointerId);
    if(moved)return;
    pointer.set(event.clientX/innerWidth*2-1,-event.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(room.raycastable??[],true)[0];
    if(hit){let object=hit.object,data=null;while(object&&!data){if(object.userData?.gallerySurface||object.userData?.gallerySlug)data=object.userData;object=object.parent;}
      const hitSlug=data?.gallerySlug??data?.slug;
      if(hitSlug&&hitSlug!==slug)adoptWalkStation(hitSlug);
      if(data?.gallerySurface==='sculpture')returnToRoom();
      else if(hitSlug===slug)focusSurface(currentSurface(data?.gallerySurface??'media'));
    }
  },{signal});
  stage.addEventListener('pointercancel',()=>{cancelDrag();clearMovementKeys();},{signal});
  stage.addEventListener('lostpointercapture',cancelDrag,{signal});
  reducedQuery.addEventListener('change',event=>{reducedMotion=event.matches;if(reducedMotion&&animation){applyPose(framePlan());animation=null;}},{signal});

  function resize(){
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.setSize(innerWidth,innerHeight);
    cssRenderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.fov=roomCameraFov(innerWidth);camera.updateProjectionMatrix();
    const nextViewport=viewport();
    room.resize?.(nextViewport);content.resize?.(nextViewport);globe.resize();animation=null;applyPose(framePlan());
  }
  addEventListener('resize',resize,{signal});
  focusKind=null;
  resize();content.setActiveSlug(slug);content.setFocusedSurface?.(focusKind);updateVisibleProjects();room.update?.(0,0,slug);refreshNavigation();refreshViewLock();

  function activate(){
    if(disposed||active)return;
    active=true;root.inert=false;root.classList.remove('is-preparing');
    if(original)original.inert=true;
    clearMovementKeys();lastTime=0;resize();needsRender=true;
    if(!raf&&!document.hidden)raf=requestAnimationFrame(render);
    stage.focus({preventScroll:true});
  }
  function render(time){
    raf=0;if(disposed||document.hidden)return;
    const delta=lastTime?Math.min((time-lastTime)/1000,.06):0;lastTime=time;
    if(active&&animation){
      needsRender=true;
      const t=Math.min(1,(time-animation.start)/animation.duration),smooth=t*t*t*(t*(t*6-15)+10);
      camera.position.lerpVectors(animation.from,animation.to,smooth);lookTarget.lerpVectors(animation.targetFrom,animation.targetTo,smooth);camera.lookAt(lookTarget);
      setProjection({x:THREE.MathUtils.lerp(animation.offsetFrom.x,animation.offsetTo.x,smooth),y:THREE.MathUtils.lerp(animation.offsetFrom.y,animation.offsetTo.y,smooth)});
      if(t===1)animation=null;
    }
    if(active&&!viewLocked&&(keys.size||tapKeys.size)){
      needsRender=true;
      const yaw=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ').y;
      const vector=new THREE.Vector3().fromArray(roomWalkingVector(keys.size?keys:tapKeys,yaw)).multiplyScalar((keys.size?delta:1/60)*5.2);
      tapKeys.clear();
      const before=camera.position.clone();camera.position.add(vector);
      const bounds=room.walkBounds??currentStation().bounds;
      camera.position.x=THREE.MathUtils.clamp(camera.position.x,bounds.min[0]+.4,bounds.max[0]-.4);
      const farView=Math.max(bounds.max[2],overviewCameraPlan(currentStation(),viewport(),camera.fov).position[2]+2);
      camera.position.z=THREE.MathUtils.clamp(camera.position.z,bounds.min[2]+.4,farView);
      lookTarget.add(camera.position.clone().sub(before));camera.lookAt(lookTarget);
      adoptWalkStation(room.stationAtPosition?.(camera.position.x)?.slug??slug);
    }
    if(active&&(jumpQueued||!jumpState.grounded)){
      const groundY=camera.position.y-jumpState.height;
      const bounds=room.walkBounds??currentStation().bounds;
      const next=stepRoomJump(jumpState,delta,{requestJump:jumpQueued,ceilingHeight:Math.max(0,bounds.max[1]-.2-groundY)});
      jumpQueued=false;
      const rise=next.height-jumpState.height;
      camera.position.y+=rise;lookTarget.y+=rise;jumpState=next;
      camera.lookAt(lookTarget);needsRender=true;
    }
    if(needsRender||frameCount<2){
      room.update?.(time/1000,delta,slug);renderGalleryRoomDom(cssRenderer,cssScene,camera,cssCamera);renderer.render(scene,camera);frameCount++;
      needsRender=false;
      root.dataset.camera=camera.position.toArray().map(value=>value.toFixed(3)).join(',');
      root.dataset.renderCalls=String(renderer.info.render.calls);
      root.dataset.triangles=String(renderer.info.render.triangles);
      root.dataset.frameCount=String(frameCount);
      if(frameCount===2){root.classList.add('is-ready');dispatchEvent(new Event('gallery-room-ready'));}
    }
    raf=requestAnimationFrame(render);
  }
  function dispose(){
    if(disposed)return;disposed=true;active=false;cancelDrag();abort.abort();clearMovementKeys();clearTimeout(teleportTimer);cancelAnimationFrame(raf);raf=0;
    picker.dispose();content.dispose();globe.dispose();room.dispose?.();renderer.dispose();renderer.forceContextLoss();root.remove();
    document.body.classList.remove('gallery-room-active');if(original)original.inert=false;
    if(window.__galleryRoom?.root===root)delete window.__galleryRoom;
  }
  const api={root,camera,scene,content,room,globe,activate,dispose,setViewLocked,getStats:()=>({active,viewLocked,activeSlug:slug,pendingSlug,focusKind,transitioning:!!animation||!!teleportTimer,
    camera:camera.position.toArray(),lookTarget:lookTarget.toArray(),viewport:viewport(),frameCount,keys:[...keys],jump:{...jumpState},
    room:room.getStats?.(),globe:globe.getStats?.(),render:{calls:renderer.info.render.calls,triangles:renderer.info.render.triangles},disposed})};
  window.__galleryRoom=api;
  addEventListener('pagehide',event=>{clearMovementKeys();resetJump();if(!event.persisted)dispose();},{signal});
  raf=requestAnimationFrame(render);
  return api;
}
