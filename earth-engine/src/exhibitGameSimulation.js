/** Deterministic, renderer-independent capsule gameplay. No DOM or services. */
const TAU=Math.PI*2;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=(n,fallback=0)=>Number.isFinite(n)?n:fallback;
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const transportMechanics=new Set(['delivery','sort','assembly','balance','morph']);
const traversalMechanics=new Set(['flight','trace','maze']);
const mechanics=new Set([...transportMechanics,...traversalMechanics,'optics','energy','routing']);
const copyItem=o=>({...o,position:[...o.position],basePosition:[...o.position],size:[...(o.size??[1,1,1])],rotation:o.rotation??0,level:o.initialLevel??0,charge:0,complete:false,selected:false,glow:0,visible:true,error:0});
const byId=(state,id)=>state.objects.find(o=>o.id===id)??state.targets.find(o=>o.id===id);
const definition=(config,id)=>config.objects.find(o=>o.id===id)??config.targets.find(o=>o.id===id);

export function createExhibitGameState(config){
  if(!config||!mechanics.has(config.mechanic)||!Array.isArray(config.objects)||!Array.isArray(config.targets))throw new TypeError('Unknown physical exhibit game.');
  const state={slug:config.slug,mechanic:config.mechanic,actor:copyItem(config.actor),objects:config.objects.map(copyItem),targets:config.targets.map(copyItem),obstacles:(config.obstacles??[]).map(copyItem),decor:(config.decor??[]).map(copyItem),selectedId:null,cargoId:null,pendingTargetId:null,stage:0,completed:false,progress:0,time:0,pulse:0,hold:0,dwell:0,trails:[],navPath:[],activateWasDown:false,blockedTime:0,routeVisited:[],routeNextId:null};
  state.actor.moving=false;
  if(config.mechanic==='routing'){
    for(const node of state.objects){node.exit=node.initialExit??0;setRouteAngle(config,state,node);}
    const source=byId(state,config.route[0]);state.actor.position=[source.position[0],source.position[1]+.6,source.position[2]];
    state.routeVisited=[source.id];state.routeNextId=source.exits[0];
  }
  updateProgress(config,state,0);
  return state;
}

function boundedPoint(config,point){
  const p=Array.isArray(point)?point:point&&typeof point==='object'?[point.x,point.y,point.z]:null;
  if(!p||p.length<3||!p.every(Number.isFinite))return null;
  const radius=config.radius-.45,length=Math.hypot(p[0],p[2]),scale=length>radius?radius/length:1;
  return [p[0]*scale,clamp(p[1],.04,3.8),p[2]*scale];
}
function segmentClear(a,b,obstacles,radius){
  const dx=b[0]-a[0],dz=b[2]-a[2],length2=dx*dx+dz*dz;
  return obstacles.every(o=>{
    const t=length2?clamp(((o.position[0]-a[0])*dx+(o.position[2]-a[2])*dz)/length2,0,1):0;
    const x=a[0]+t*dx,z=a[2]+t*dz;
    return Math.hypot(x-o.position[0],z-o.position[2])>=(o.radius??.6)+radius+.025;
  });
}
/** A tiny visibility graph keeps click movement physical around solid models. */
function planPath(config,state,goal){
  const start=state.actor.position,r=state.actor.radius??.32,obstacles=state.obstacles;
  if(segmentClear(start,goal,obstacles,r))return [[...goal]];
  const points=[[...start],[...goal]];
  for(const obstacle of obstacles){
    const radius=(obstacle.radius??.6)+r+.25;
    for(let i=0;i<12;i++){
      const a=i*TAU/12,p=[obstacle.position[0]+Math.cos(a)*radius,goal[1],obstacle.position[2]+Math.sin(a)*radius];
      if(Math.hypot(p[0],p[2])<config.radius-r&&segmentClear(p,p,obstacles,r))points.push(p);
    }
  }
  const costs=points.map(()=>Infinity),previous=points.map(()=>-1),visited=new Set();costs[0]=0;
  for(let count=0;count<points.length;count++){
    let current=-1;
    for(let i=0;i<points.length;i++)if(!visited.has(i)&&(current<0||costs[i]<costs[current]))current=i;
    if(current<0||!Number.isFinite(costs[current]))break;
    if(current===1)break;
    visited.add(current);
    for(let i=0;i<points.length;i++)if(!visited.has(i)&&segmentClear(points[current],points[i],obstacles,r)){
      const candidate=costs[current]+distance(points[current],points[i]);
      if(candidate<costs[i]){costs[i]=candidate;previous[i]=current;}
    }
  }
  if(previous[1]<0)return [];
  const path=[];for(let node=1;node!==0;node=previous[node])path.unshift(points[node]);return path;
}
function navigate(config,state,point){
  const goal=boundedPoint(config,point);if(!goal)return false;
  if(transportMechanics.has(config.mechanic)||config.mechanic==='optics'||config.mechanic==='energy')goal[1]=.04;
  state.navPath=planPath(config,state,goal);state.actor.destination=goal;state.blockedTime=0;
  return true;
}
function setRouteAngle(config,state,node){
  const next=byId(state,node.exits?.[node.exit]);
  if(next)node.rotation=Math.atan2(next.position[0]-node.position[0],next.position[2]-node.position[2]);
}
function validPlacement(config,state,object,target){
  if(!target||target.deadEnd)return false;
  if(config.mechanic==='balance')return target.level<target.capacity;
  if(object.targetId!==target.id)return false;
  if(config.mechanic==='assembly'&&config.order[state.stage]!==object.id)return false;
  if(config.mechanic==='morph'&&Math.abs(angleDifference(object.rotation,object.targetRotation))>.04)return false;
  return true;
}
function selectPiece(config,state,object){
  if(object.complete&&config.mechanic!=='balance')return false;
  if(state.cargoId&&state.cargoId!==object.id){
    const previous=byId(state,state.cargoId);previous.returnPosition=[...previous.basePosition];previous.moving=true;
  }
  if(config.mechanic==='balance'&&object.placedAt){
    const well=byId(state,object.placedAt);object.pickupFromTarget=well.id;well.level--;object.placedAt=null;object.complete=false;
  }
  object.returnPosition=null;state.selectedId=object.id;state.pendingTargetId=null;
  if(state.cargoId!==object.id){state.cargoId=null;navigate(config,state,object.position);}
  return true;
}

/** id is a picked physical model; an omitted id plus point is a floor click. */
export function clickExhibitGame(config,state,id,point){
  if(state.slug!==config.slug||state.completed)return false;
  const object=state.objects.find(o=>o.id===id),target=state.targets.find(o=>o.id===id);
  if(config.mechanic==='routing'){
    if(object?.exits?.length>1){object.exit=(object.exit+1)%object.exits.length;state.selectedId=id;setRouteAngle(config,state,object);return true;}
    return false;
  }
  if(config.mechanic==='optics'&&object?.opticalNode){
    object.rotation+=object.turnStep??Math.PI/4;state.selectedId=id;state.hold=0;updateProgress(config,state,0);return true;
  }
  if(config.mechanic==='energy'&&object?.role==='control'){
    object.level=(object.level+1)%(object.capacity+1);state.selectedId=id;state.hold=0;updateProgress(config,state,0);return true;
  }
  if(transportMechanics.has(config.mechanic)){
    if(object){
      if(config.mechanic==='morph'&&state.selectedId===object.id){object.rotation+=object.turnStep;object.error=0;return true;}
      return selectPiece(config,state,object);
    }
    if(target){
      const selected=state.objects.find(o=>o.id===state.selectedId);
      if(!selected)return navigate(config,state,target.position);
      if(!validPlacement(config,state,selected,target)){selected.error=.65;state.pulse=.4;return true;}
      state.pendingTargetId=target.id;
      if(state.cargoId)navigate(config,state,target.position);
      return true;
    }
  }
  if(traversalMechanics.has(config.mechanic)&&target){
    const goal=[...target.position];if(target.kind==='ring')goal[1]+=Math.max(0,(target.size[1]-state.actor.size[1])*.5);
    return navigate(config,state,goal);
  }
  if(point){state.pendingTargetId=null;return navigate(config,state,point);}
  return false;
}

function nearestAction(config,state){
  const near=[...state.objects,...state.targets].filter(o=>o.visible!==false&&distance(state.actor.position,o.position)<1.35).sort((a,b)=>distance(state.actor.position,a.position)-distance(state.actor.position,b.position));
  if(state.cargoId){const target=near.find(o=>o.role==='target');if(target)return clickExhibitGame(config,state,target.id);}
  const object=near.find(o=>o.role!=='target'&&o.role!=='source'&&(!o.complete||o.role==='control'||config.mechanic==='balance'));
  return object?clickExhibitGame(config,state,object.id):false;
}
function moveActor(config,state,input,dt){
  const actor=state.actor,x=clamp(finite(input.x),-1,1),z=clamp(finite(input.z),-1,1),magnitude=Math.hypot(x,z),manual=magnitude>.02;
  let dx=0,dz=0,targetY=actor.position[1];
  if(manual){state.navPath=[];actor.destination=null;dx=x/Math.max(1,magnitude)*actor.speed*dt;dz=z/Math.max(1,magnitude)*actor.speed*dt;
    if(traversalMechanics.has(config.mechanic)){const target=state.targets[state.stage];targetY=target?target.position[1]+(target.kind==='ring'?Math.max(0,(target.size[1]-actor.size[1])*.5):0):actor.position[1];}
  }else if(state.navPath.length){
    const goal=state.navPath[0],d=distance(actor.position,goal),travel=actor.speed*dt;
    if(d<=travel){dx=goal[0]-actor.position[0];dz=goal[2]-actor.position[2];state.navPath.shift();}
    else{dx=(goal[0]-actor.position[0])/d*travel;dz=(goal[2]-actor.position[2])/d*travel;}
    targetY=goal[1];
  }else if(traversalMechanics.has(config.mechanic)){const target=state.targets[state.stage];targetY=target?target.position[1]+(target.kind==='ring'?Math.max(0,(target.size[1]-actor.size[1])*.5):0):actor.position[1];}
  const previous=[...actor.position];
  if(dx||dz){
    let next=[actor.position[0]+dx,actor.position[1],actor.position[2]+dz];
    const radius=config.radius-(actor.radius??.32),length=Math.hypot(next[0],next[2]);
    if(length>radius){next[0]*=radius/length;next[2]*=radius/length;}
    const blocked=p=>state.obstacles.some(o=>distance(p,o.position)<(o.radius??.6)+(actor.radius??.32));
    if(blocked(next)){
      const slideX=[next[0],next[1],actor.position[2]],slideZ=[actor.position[0],next[1],next[2]];
      if(!blocked(slideX))next=slideX;else if(!blocked(slideZ))next=slideZ;else next=[...actor.position];
      state.pulse=Math.max(state.pulse,.12);state.blockedTime+=dt;
      if(state.blockedTime>.2&&actor.destination){state.navPath=planPath(config,state,actor.destination);state.blockedTime=0;}
    }else state.blockedTime=0;
    actor.position=next;
    const desired=Math.atan2(dx,dz);actor.rotation+=angleDifference(desired,actor.rotation)*Math.min(1,dt*12);
  }
  actor.position[1]+=(targetY-actor.position[1])*Math.min(1,dt*6);
  actor.moving=distance(previous,actor.position)>.00001||Math.abs(previous[1]-actor.position[1])>.00001;
  if(!state.navPath.length)actor.destination=null;
  return actor.moving;
}
function transport(config,state,dt){
  let changed=false;
  let object=state.objects.find(o=>o.id===state.selectedId);
  if(config.mechanic==='delivery'&&!object&&!state.cargoId){
    const pickup=state.objects.find(o=>!o.complete&&distance(state.actor.position,o.position)<.72);
    if(pickup){state.selectedId=pickup.id;object=pickup;changed=true;}
  }
  if(object&&!state.cargoId&&distance(state.actor.position,object.position)<.8){
    state.cargoId=object.id;changed=true;
    if(state.pendingTargetId)navigate(config,state,byId(state,state.pendingTargetId).position);
  }
  object=state.objects.find(o=>o.id===state.cargoId);
  if(object){
    if(object.pickupFromTarget&&distance(state.actor.position,byId(state,object.pickupFromTarget).position)>1.1)object.pickupFromTarget=null;
    const carried=[state.actor.position[0],state.actor.position[1]+.75,state.actor.position[2]];
    for(let i=0;i<3;i++){const before=object.position[i];object.position[i]+=(carried[i]-object.position[i])*Math.min(1,dt*13);if(Math.abs(object.position[i]-before)>.00001)changed=true;}
    object.rotation=config.mechanic==='morph'?object.rotation:state.actor.rotation;
    const candidate=state.pendingTargetId?byId(state,state.pendingTargetId):state.targets.find(t=>t.id!==object.pickupFromTarget&&distance(state.actor.position,t.position)<.65&&validPlacement(config,state,object,t));
    if(candidate&&distance(state.actor.position,candidate.position)<.55&&validPlacement(config,state,object,candidate)){
      const placedCount=state.objects.filter(o=>o.complete&&o.placedAt===candidate.id).length;
      object.position=[...candidate.position];
      if(config.mechanic==='sort'&&state.objects.filter(o=>o.targetId===candidate.id).length>1)object.position[0]+=(placedCount-.5)*.64;
      if(config.mechanic==='balance')object.position[1]+=candidate.size[1]+.12+placedCount*.28;
      object.rotation=object.targetRotation??candidate.rotation??0;object.complete=true;object.placedAt=candidate.id;object.pickupFromTarget=null;
      if(config.mechanic==='balance')candidate.level++;
      if(config.mechanic==='assembly')state.stage++;
      state.selectedId=null;state.cargoId=null;state.pendingTargetId=null;state.navPath=[];state.actor.destination=null;state.pulse=.55;changed=true;
    }
  }
  return changed;
}
function traverse(config,state,dt){
  const target=state.targets[state.stage];if(!target)return false;
  const near=distance(state.actor.position,target.position)<.58&&Math.abs(state.actor.position[1]-target.position[1])<.6;
  state.dwell=near?state.dwell+dt:0;
  if(config.mechanic==='trace'&&state.actor.moving){
    const p=[...state.actor.position];p[1]+=.12;
    if(!state.trails.length||distance(state.trails.at(-1),p)>.16||Math.abs(state.trails.at(-1)[1]-p[1])>.15){state.trails.push(p);if(state.trails.length>180)state.trails.shift();}
  }
  if(state.dwell>=(config.dwellTime??.1)){
    target.complete=true;target.charge=1;state.stage++;state.dwell=0;state.pulse=.5;return true;
  }
  return near;
}
function routePacket(config,state,dt,manual=false){
  const target=byId(state,state.routeNextId);if(!target)return false;
  const actor=state.actor,goal=[target.position[0],target.position[1]+.6,target.position[2]],d=distance(actor.position,goal),travel=actor.speed*dt;
  if(!manual)actor.rotation=Math.atan2(goal[0]-actor.position[0],goal[2]-actor.position[2]);actor.moving=true;
  if(d>(manual ? .55 : travel)){
    if(!manual){actor.position[0]+=(goal[0]-actor.position[0])/d*travel;actor.position[2]+=(goal[2]-actor.position[2])/d*travel;actor.position[1]+=(goal[1]-actor.position[1])*Math.min(1,dt*8);}
    return true;
  }
  // A nearby checkpoint may advance the graph while a key is held, but must
  // not pull the manually steered packet backward or sideways onto its node.
  if(!manual)actor.position=goal;
  if(target.id===config.route.at(-1)){
    if(state.routeVisited.length===config.route.length-1&&config.route.slice(0,-1).every((id,i)=>state.routeVisited[i]===id)){state.routeVisited.push(target.id);target.complete=true;target.charge=1;state.completed=true;state.progress=1;state.pulse=1;actor.moving=false;state.routeNextId=null;return true;}
    state.routeNextId=config.route[0];state.pulse=.5;
  }else if(target.deadEnd){state.routeNextId=config.route[0];state.pulse=.35;state.routeVisited=[];}
  else{
    if(target.id===config.route[0])state.routeVisited=[target.id];else state.routeVisited.push(target.id);
    state.routeNextId=target.exits[target.exit??0];
  }
  return true;
}
function updateProgress(config,state,dt){
  const previous=state.progress,wasCompleted=state.completed;
  if(transportMechanics.has(config.mechanic)){
    if(config.mechanic==='balance'){
      for(const t of state.targets){t.complete=t.level===t.targetLevel;t.charge=clamp(t.level/t.capacity,0,1);}
      state.progress=state.targets.reduce((n,t)=>n+Math.min(t.level,t.targetLevel),0)/state.targets.reduce((n,t)=>n+t.targetLevel,0);
      state.completed=state.targets.every(t=>t.complete);
    }else{state.progress=state.objects.filter(o=>o.complete).length/state.objects.length;state.completed=state.progress===1;
      for(const t of state.targets){t.complete=state.objects.filter(o=>o.targetId===t.id).every(o=>o.complete);t.charge=t.complete?1:0;}}
  }else if(traversalMechanics.has(config.mechanic)){state.progress=state.stage/state.targets.length;state.completed=state.stage===state.targets.length;}
  else if(config.mechanic==='optics'){
    const nodes=state.objects.filter(o=>o.opticalNode);
    for(const node of nodes)node.complete=Math.abs(angleDifference(node.rotation,node.targetRotation))<.04;
    const count=nodes.filter(o=>o.complete).length,aligned=count===nodes.length;
    state.hold=aligned?state.hold+dt:0;state.targets[0].charge=aligned?clamp(state.hold/config.holdTime,0,1):0;
    state.progress=count/nodes.length*.9+state.targets[0].charge*.1;state.completed=state.hold>=config.holdTime;state.targets[0].complete=state.completed;
  }else if(config.mechanic==='energy'){
    for(const target of state.targets){target.level=state.objects.reduce((n,o)=>n+o.level*(o.channels?.find(c=>c.targetId===target.id)?.weight??0),0);target.charge=clamp(target.level/target.capacity,0,1);target.complete=target.level===target.targetLevel;}
    for(const object of state.objects)object.charge=object.level/object.capacity;
    const aligned=state.targets.every(t=>t.complete);state.hold=aligned?state.hold+dt:0;
    state.progress=state.targets.filter(t=>t.complete).length/state.targets.length*.9+(aligned?clamp(state.hold/config.holdTime,0,1)*.1:0);state.completed=state.hold>=config.holdTime;
  }else if(config.mechanic==='routing')state.progress=state.completed?1:Math.max(0,state.routeVisited.length-1)/(config.route.length-1);
  if(state.completed&&!wasCompleted)state.pulse=1;
  return previous!==state.progress||wasCompleted!==state.completed||(state.hold>0&&!state.completed);
}

/** Mutates only state; returns whether a visible update needs another frame. */
export function stepExhibitGame(config,state,input={},delta=0){
  if(state.slug!==config.slug)return false;
  const dt=clamp(finite(delta),0,.08);if(!dt)return false;
  if(!input||typeof input!=='object')input={};
  state.time+=dt;let changed=false;
  if(state.pulse>0){state.pulse=Math.max(0,state.pulse-dt*1.8);changed=true;}
  for(const object of state.objects)if(object.error>0){object.error=Math.max(0,object.error-dt);changed=true;}
  for(const object of state.objects)if(object.returnPosition){
    let remaining=0;
    for(let i=0;i<3;i++){const delta=object.returnPosition[i]-object.position[i];object.position[i]+=delta*Math.min(1,dt*7);remaining+=Math.abs(delta);}
    if(remaining<.004){object.position=[...object.returnPosition];object.returnPosition=null;object.moving=false;}
    changed=true;
  }
  if(state.completed){state.actor.moving=false;return changed;}
  for(const obstacle of state.obstacles)if(obstacle.motionAxis){const axis=obstacle.motionAxis==='x'?0:2;obstacle.position[axis]=obstacle.basePosition[axis]+Math.sin(state.time*obstacle.motionSpeed)*obstacle.motionAmplitude;changed=true;}
  const activated=Boolean(input.activate);if(activated&&!state.activateWasDown)changed=nearestAction(config,state)||changed;state.activateWasDown=activated;
  if(config.mechanic==='routing'){
    const manual=Math.hypot(finite(input.x),finite(input.z))>.02;
    if(manual)changed=moveActor(config,state,input,dt)||changed;
    changed=routePacket(config,state,dt,manual)||changed;
  }
  else{
    changed=moveActor(config,state,input,dt)||changed;
    if(transportMechanics.has(config.mechanic))changed=transport(config,state,dt)||changed;
    if(traversalMechanics.has(config.mechanic))changed=traverse(config,state,dt)||changed;
  }
  changed=updateProgress(config,state,dt)||changed;
  return changed;
}

function publicItem(state,item){
  const next=state.targets[state.stage],selected=item.id===state.selectedId;
  return {...item,position:[...item.position],basePosition:[...item.basePosition],size:[...item.size],selected,glow:item.error>0?-1:item.complete?1:selected ? .85 : item.role==='target'&&next?.id===item.id ? .55 : .16};
}
export function getExhibitGameSnapshot(config,state){
  const position=o=>[o.position[0],o.position[1]+Math.max(.3,(o.size?.[1]??1)*.55),o.position[2]];
  const beams=[];
  if(config.mechanic==='optics'){
    let active=true;
    for(let i=0;i<config.opticalPath.length-1;i++){
      const from=byId(state,config.opticalPath[i]),to=byId(state,config.opticalPath[i+1]);
      if(from.opticalNode&&!from.complete){const p=position(from);beams.push({from:p,to:[p[0]+Math.sin(from.rotation)*2,p[1],p[2]+Math.cos(from.rotation)*2],color:from.color,active});active=false;}
      beams.push({from:position(from),to:position(to),color:from.color,active});
    }
  }else if(config.mechanic==='energy'){
    for(const edge of config.connections){const from=byId(state,edge.from),to=byId(state,edge.to);beams.push({from:position(from),to:position(to),color:edge.color,active:from.level>0,power:from.charge});}
  }else if(config.mechanic==='routing'){
    for(const edge of config.connections){const from=byId(state,edge.from),to=byId(state,edge.to);beams.push({from:position(from),to:position(to),color:edge.color,active:from.exits[from.exit]===edge.to});}
  }
  if(state.cargoId){const object=byId(state,state.cargoId);beams.push({from:position(state.actor),to:position(object),color:object.color,active:true});}
  return {slug:state.slug,mechanic:state.mechanic,actor:{...publicItem(state,state.actor),running:state.actor.moving||state.navPath.length>0||Boolean(state.routeNextId),destination:state.actor.destination?[...state.actor.destination]:null},objects:state.objects.map(o=>publicItem(state,o)),targets:state.targets.map(o=>publicItem(state,o)),obstacles:state.obstacles.map(o=>publicItem(state,o)),decor:state.decor.map(o=>publicItem(state,o)),selectedId:state.selectedId,cargoId:state.cargoId,completed:state.completed,progress:state.progress,stage:state.stage,time:state.time,pulse:state.pulse,beams,trails:state.trails.map(p=>[...p])};
}
