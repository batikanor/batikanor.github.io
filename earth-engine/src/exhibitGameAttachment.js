import * as THREE from 'three';

let runtimeModule=null;
export function warmExhibitGames(){
  if(!runtimeModule)runtimeModule=import('./exhibitGameRuntime.js').catch(error=>{runtimeModule=null;throw error;});
  return runtimeModule;
}

/** Invert the actual custom-layer projection; no separate camera or canvas. */
export function pickProjectedObject({point,canvas,projection,objects,coordinateRoot}) {
  const width=canvas?.clientWidth,height=canvas?.clientHeight;
  if(!projection||!objects?.length||!(width>0&&height>0)||!Number.isFinite(point?.x)||!Number.isFinite(point?.y)
    ||point.x<0||point.x>width||point.y<0||point.y>height)return null;
  const inverse=projection.clone();
  if(Math.abs(inverse.determinant())<1e-30)return null;
  inverse.invert();
  const x=point.x/width*2-1,y=1-point.y/height*2;
  const near=new THREE.Vector3(x,y,-1).applyMatrix4(inverse),far=new THREE.Vector3(x,y,1).applyMatrix4(inverse);
  const direction=far.clone().sub(near).normalize();
  if(![...near.toArray(),...direction.toArray()].every(Number.isFinite))return null;
  const ray=new THREE.Raycaster(near,direction);
  coordinateRoot?.updateWorldMatrix(true,true);
  const visible=object=>{for(let node=object;node;node=node.parent)if(!node.visible)return false;return true;};
  for(const hit of ray.intersectObjects(objects.filter(visible),true)) {
    if(!visible(hit.object))continue;
    let node=hit.object,id=null;
    while(node&&!id){id=node.userData.gameObjectId;node=node.parent;}
    if(!id)continue;
    const local=coordinateRoot?coordinateRoot.worldToLocal(hit.point.clone()):hit.point;
    return {id,point:local.toArray()};
  }
  return null;
}

/** Holds a lazy game through scene rebuilds and cancels every obsolete load. */
export function createExhibitGameAttachment({getSlug,getHost,getDemo,getSigns=()=>[],getProjection,getCanvas,canRender,
  onRepaint=()=>{},onActiveChange=()=>{},floor=[0,0,0],transformInput=input=>input}={}) {
  let active=false,generation=0,runtime=null,host=null,destroyed=false,input={x:0,z:0,activate:false};
  function attach(){
    const next=getHost();if(!active||!runtime||!next)return;
    if(host!==next){host=next;onActiveChange(true,host);runtime.root.position.set(...floor);host.add(runtime.root);}
  }
  function stop(){
    generation++;active=false;input={x:0,z:0,activate:false};runtime?.destroy();runtime=null;
    if(host)onActiveChange(false,host);host=null;onRepaint();
  }
  return {
    async start(slug){
      if(destroyed||slug!==getSlug()||!getHost())return false;
      stop();active=true;const token=++generation;
      try {
        const module=await warmExhibitGames();
        if(destroyed||!active||token!==generation||slug!==getSlug())return false;
        runtime=module.createExhibitGameRuntime(slug,{onRepaint});runtime.input(transformInput(input));attach();onRepaint();return true;
      }catch(error){if(token===generation)stop();throw error;}
    },
    stop,
    isActive:()=>active,
    input(next){input=next;runtime?.input(transformInput(next));},
    click(id,point){return runtime?.click(id,point)??false;},
    hover(id){runtime?.hover(id);},
    reset(){runtime?.reset();},
    detach(){runtime?.root.removeFromParent();if(host)onActiveChange(false,host);host=null;},
    render(now){attach();runtime?.input(transformInput(input));return runtime?.render(now)??false;},
    pick(point){
      if(destroyed||!canRender())return null;
      attach();const owner=getHost();if(!owner)return null;
      if(active&&!runtime)return null;
      const demo=getDemo();
      if(!active)for(const object of demo)object.userData.gameObjectId='__start';
      return pickProjectedObject({point,canvas:getCanvas(),projection:getProjection(),
        objects:active?[...runtime.pickable,...getSigns()]:demo,coordinateRoot:active?runtime.root:owner});
    },
    getStats(){return {active,ready:!!runtime,slug:active?getSlug():null,panels:0,...(runtime?.getStats()??{})};},
    revive(){destroyed=false;},
    destroy(){stop();destroyed=true;}
  };
}
