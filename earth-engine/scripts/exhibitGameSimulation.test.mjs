import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {EXHIBIT_GAME_CATALOG,getExhibitGame} from '../src/exhibitGameCatalog.js';
import {createExhibitGameState as create,stepExhibitGame as step,clickExhibitGame as click,getExhibitGameSnapshot as snapshot} from '../src/exhibitGameSimulation.js';
import {createExhibitGameRuntime} from '../src/exhibitGameRuntime.js';

const games=Object.values(EXHIBIT_GAME_CATALOG);
const difference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function until(config,state,predicate,limit=2400){
  for(let frame=0;frame<limit&&!predicate();frame++)step(config,state,{},1/60);
  assert.ok(predicate(),`${config.slug}: physical motion must reach the requested interaction; actor=${state.actor.position}, selected=${state.selectedId}, cargo=${state.cargoId}`);
}
function energyWitness(config){
  // Enumerate generator levels independently of the simulation's evaluator.
  for(let a=0;a<=3;a++)for(let b=0;b<=3;b++)for(let c=0;c<=3;c++){
    const levels=[a,b,c];
    if(config.targets.every(t=>config.objects.reduce((n,o,i)=>n+levels[i]*(o.channels.find(ch=>ch.targetId===t.id)?.weight??0),0)===t.targetLevel))return levels;
  }
  assert.fail(`${config.slug} has no feasible physical power distribution`);
}
function solve(config,state){
  if(['delivery','sort','assembly','morph'].includes(config.mechanic)){
    const ordered=config.mechanic==='assembly'?config.order.map(id=>config.objects.find(o=>o.id===id)):config.objects;
    for(const object of ordered){
      assert.ok(click(config,state,object.id));
      if(config.mechanic==='morph')for(let turns=0;difference(state.objects.find(o=>o.id===object.id).rotation,object.targetRotation)>.04&&turns<4;turns++)click(config,state,object.id);
      assert.ok(click(config,state,object.targetId));
      until(config,state,()=>state.objects.find(o=>o.id===object.id).complete);
    }
  }else if(config.mechanic==='balance'){
    let i=0;
    for(const target of config.targets)for(let n=0;n<target.targetLevel;n++){
      const object=config.objects[i++];click(config,state,object.id);click(config,state,target.id);
      until(config,state,()=>state.objects.find(o=>o.id===object.id).complete);
    }
  }else if(['flight','maze','trace'].includes(config.mechanic)){
    for(const target of config.targets){click(config,state,target.id);until(config,state,()=>state.targets.find(t=>t.id===target.id).complete);}
  }else if(config.mechanic==='optics'){
    for(const object of config.objects.filter(o=>o.opticalNode))for(let n=0;difference(state.objects.find(o=>o.id===object.id).rotation,object.targetRotation)>.04&&n<8;n++)click(config,state,object.id);
    until(config,state,()=>state.completed);
  }else if(config.mechanic==='energy'){
    const witness=energyWitness(config);
    config.objects.forEach((object,i)=>{for(let n=0;n<witness[i];n++)click(config,state,object.id);});
    until(config,state,()=>state.completed);
  }else if(config.mechanic==='routing'){
    for(let i=0;i<config.route.length-1;i++){
      const node=state.objects.find(o=>o.id===config.route[i]);
      for(let n=0;node.exits[node.exit]!==config.route[i+1]&&n<node.exits.length;n++)click(config,state,node.id);
    }
    until(config,state,()=>state.completed);
  }else assert.fail(`Missing actual player actions for ${config.mechanic}`);
  assert.equal(state.completed,true,config.slug);
  assert.equal(state.progress,1,config.slug);
}

test('all 32 existing project slugs have immutable physical scenes with 11 distinct mechanics',()=>{
  const achievements=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url),'utf8'));
  assert.deepEqual(games.map(g=>g.slug).sort(),achievements.map(a=>a.slug).sort());
  assert.equal(new Set(games.map(g=>g.theme)).size,32);
  assert.equal(new Set(games.map(g=>g.mechanic)).size,11);
  for(const game of games){
    assert.equal(getExhibitGame(game.slug),game);
    assert.ok(Object.isFrozen(game)&&Object.isFrozen(game.objects)&&Object.isFrozen(game.actor.position));
    const models=[game.actor,...game.objects,...game.targets,...game.obstacles,...(game.decor??[])];
    assert.equal(new Set(models.map(o=>o.id)).size,models.length,game.slug);
    for(const model of models){assert.ok(model.kind&&model.position.every(Number.isFinite));assert.ok(Math.hypot(model.position[0],model.position[2])<=game.radius+.01);assert.ok(model.position[1]>=0&&model.position[1]+model.size[1]<=5);}
    for(const field of ['instructions','goal','hint','controls','html','title'])assert.equal(Object.hasOwn(game,field),false);
  }
  for(const slug of ['__proto__','constructor','toString','missing',null,7])assert.equal(getExhibitGame(slug),null);
});

test('all 32 playgrounds finish using real clicks and simulated motion, preserving their configurations',()=>{
  for(const config of games){
    const original=JSON.stringify(config),state=create(config),other=create(config);
    assert.deepEqual(state,other);solve(config,state);
    assert.equal(JSON.stringify(config),original);
    assert.equal(other.completed,false);
    assert.ok(snapshot(config,state).actor.position.every(Number.isFinite));
    for(let frame=0;frame<100;frame++)step(config,state,{},1/60);
    assert.equal(step(config,state,{},1/60),false,`${config.slug} must sleep after completion particles settle`);
  }
});

test('project families use visibly different physical objects, arrangements and objective rules',()=>{
  const tesla=getExhibitGame('tesla-gigathon-2026'),music=getExhibitGame('music-ai-osaka-2025'),wafer=getExhibitGame('zero-one-hack-supercompute-industrial-2026'),coin=getExhibitGame('real-coin-map-2025'),cat=getExhibitGame('bachelors-thesis');
  assert.equal(tesla.actor.kind,'forklift');assert.ok(tesla.obstacles.length>=2);assert.ok(tesla.objects.every(o=>o.kind==='pallet'));
  assert.equal(music.actor.kind,'pen');assert.ok(new Set(music.targets.map(t=>t.position[1])).size>=4);
  assert.ok(wafer.objects.some(o=>o.kind==='wafer'));assert.equal(wafer.order.length,6);
  assert.ok(coin.objects.every(o=>o.kind==='coin'));assert.deepEqual(coin.targets.map(t=>t.groupKind),['laurel','star','crescent']);
  assert.ok(cat.objects.every(o=>o.kind==='cat'));assert.deepEqual(cat.targets.map(t=>t.groupKind),['triangle','diamond','circle']);
  assert.ok(getExhibitGame('huawei-tech-arena-finland-2025').objects.every(o=>o.kind==='mapTile'&&Number.isFinite(o.targetRotation)));
  assert.ok(getExhibitGame('masters-thesis').obstacles.every(o=>o.motionAxis));
});

test('wrong shapes and assembly stages cannot complete a socket',()=>{
  for(const slug of ['bachelors-thesis','zero-one-hack-supercompute-industrial-2026']){
    const config=getExhibitGame(slug),state=create(config),piece=config.objects.at(-1),wrong=config.targets.find(t=>t.id!==piece.targetId);
    click(config,state,piece.id);click(config,state,wrong.id);
    for(let frame=0;frame<300;frame++)step(config,state,{},1/60);
    assert.equal(state.objects.filter(o=>o.complete).length,0);assert.equal(state.completed,false);
    if(config.mechanic==='assembly'){click(config,state,piece.targetId);assert.equal(state.pendingTargetId,null);assert.equal(state.stage,0);}
  }
});

test('projection panels require a physical orientation match before placement',()=>{
  const config=getExhibitGame('huawei-tech-arena-finland-2025'),state=create(config),piece=config.objects[0];
  click(config,state,piece.id);click(config,state,piece.targetId);
  assert.equal(state.pendingTargetId,null);assert.ok(state.objects[0].error>0);
  for(let n=0;n<4&&difference(state.objects[0].rotation,piece.targetRotation)>.04;n++)click(config,state,piece.id);
  click(config,state,piece.targetId);until(config,state,()=>state.objects[0].complete);
  assert.equal(state.progress,1/6);
});

test('picking an assembly part out of sequence is recoverable by switching to another physical part',()=>{
  const config=getExhibitGame('zero-one-hack-supercompute-industrial-2026'),state=create(config),wrong=config.objects.at(-1);
  click(config,state,wrong.id);until(config,state,()=>state.cargoId===wrong.id);
  click(config,state,wrong.targetId);assert.equal(state.pendingTargetId,null);
  click(config,state,config.objects[0].id);
  assert.equal(state.selectedId,config.objects[0].id);assert.ok(state.objects.at(-1).returnPosition);
  solve(config,state);assert.equal(state.completed,true);
});

test('coupled power sources require simultaneous capacity matches and a stable visible flow',()=>{
  const config=getExhibitGame('thuega-2024'),state=create(config);
  for(const source of config.objects)click(config,state,source.id);
  assert.equal(state.completed,false);assert.equal(state.targets.every(t=>t.complete),false);
  assert.ok(snapshot(config,state).beams.every(b=>b.active));
  // Resetting produces the exact finite source state, then independent capacity enumeration solves it.
  const reset=create(config);solve(config,reset);assert.ok(reset.hold>=config.holdTime);
});

test('resource allocation can be retrieved and corrected before a balanced finish',()=>{
  const config=getExhibitGame('solana-ideathon-2024'),state=create(config),piece=config.objects[0],well=config.targets[0];
  click(config,state,piece.id);click(config,state,well.id);until(config,state,()=>state.objects[0].complete);
  assert.equal(state.targets[0].level,1);
  click(config,state,piece.id);assert.equal(state.targets[0].level,0);assert.equal(state.objects[0].complete,false);
  for(let frame=0;frame<30;frame++)step(config,state,{},1/60);
  assert.equal(state.targets[0].level,0,'retrieving a resource must not immediately drop it into the same nearby well');
  assert.equal(state.objects[0].complete,false);assert.equal(state.cargoId,piece.id);
  click(config,state,config.targets[1].id);until(config,state,()=>state.objects[0].complete);
  assert.equal(state.targets[1].level,1);assert.equal(state.completed,false);
  assert.ok(state.objects[0].position[1]>=config.targets[1].position[1]+config.targets[1].size[1],'resource geometry stays above its receiver so it remains pickable');
});

test('WASD motion respects solid obstacles, the capsule boundary and invalid delta/input values',()=>{
  const config=getExhibitGame('tesla-gigathon-2026'),state=create(config),obstacle=state.obstacles[0];
  state.actor.position=[obstacle.position[0],.04,obstacle.position[2]-obstacle.radius-state.actor.radius-.05];
  for(let frame=0;frame<60;frame++)step(config,state,{x:0,z:1},1/60);
  assert.ok(Math.hypot(state.actor.position[0]-obstacle.position[0],state.actor.position[2]-obstacle.position[2])>=obstacle.radius+state.actor.radius-.001);
  state.actor.position=[0,.04,0];
  for(let frame=0;frame<500;frame++)step(config,state,{x:1,z:1},1/60);
  assert.ok(Math.hypot(state.actor.position[0],state.actor.position[2])<=config.radius-state.actor.radius+.001);
  for(const delta of [NaN,Infinity,-1,0])assert.equal(step(config,state,{x:NaN,z:Infinity},delta),false);
  step(config,state,{x:NaN,z:Infinity},.016);assert.ok(state.actor.position.every(Number.isFinite));
  const prior=[...state.actor.position];step(config,state,{x:1,z:0},300);assert.ok(Math.hypot(state.actor.position[0]-prior[0],state.actor.position[2]-prior[2])<=state.actor.speed*.08+.001);
});

test('click routes travel around warehouse models rather than teleporting through them',()=>{
  const config=getExhibitGame('tesla-gigathon-2026'),state=create(config),object=config.objects[0];
  click(config,state,object.id);click(config,state,object.targetId);
  const before=[...state.actor.position];step(config,state,{},1/60);
  assert.ok(Math.hypot(state.actor.position[0]-before[0],state.actor.position[2]-before[2])<.08);
  until(config,state,()=>state.objects[0].complete);
  for(const obstacle of state.obstacles)assert.ok(Math.hypot(state.actor.position[0]-obstacle.position[0],state.actor.position[2]-obstacle.position[2])>=obstacle.radius+state.actor.radius-.001);
});

test('an incorrect graph branch visibly loops back and remains solvable',()=>{
  const config=getExhibitGame('salzburg-tourism-2024'),state=create(config);
  for(let frame=0;frame<650;frame++)step(config,state,{},1/60);
  assert.equal(state.completed,false);assert.ok(state.routeVisited.length<config.route.length);
  solve(config,state);assert.deepEqual(state.routeVisited,config.route);
});

test('WASD can steer a graph packet and keyboard activation turns a nearby physical switch',()=>{
  const config=getExhibitGame('tech-berlin-ai-hackathon-2'),state=create(config),before=[...state.actor.position];
  step(config,state,{x:1,z:0},.04);
  assert.ok(state.actor.position[0]>before[0]);assert.equal(state.actor.position[2],before[2]);
  const node=state.objects[1];
  // Approach the switch through actual continuous movement, before crossing its rail junction.
  for(let frame=0;Math.hypot(state.actor.position[0]-node.position[0],state.actor.position[2]-node.position[2])>1&&frame<150;frame++){
    const dx=node.position[0]-state.actor.position[0],dz=node.position[2]-state.actor.position[2],length=Math.hypot(dx,dz);
    step(config,state,{x:dx/length,z:dz/length},1/60);
  }
  assert.equal(node.exit,1);step(config,state,{activate:true},1/60);assert.equal(node.exit,0);
  solve(config,state);assert.equal(state.completed,true);
});

test('manual graph checkpoint arrival preserves exact WASD travel and heading, then automation resumes and completes',()=>{
  for(const config of games.filter(config=>config.mechanic==='routing'))for(const [x,z] of [[0,1],[1,0],[0,-1],[-1,0]]){
    const state=create(config),node=state.objects.find(object=>object.id===config.route[1]);
    for(const object of state.objects){
      const next=config.route[config.route.indexOf(object.id)+1];
      for(let turns=0;object.exits[object.exit]!==next&&turns<object.exits.length;turns++)click(config,state,object.id);
      assert.equal(object.exits[object.exit],next);
    }
    state.actor.position=[node.position[0]+.12,node.position[1]+.6,node.position[2]-.2];
    state.routeNextId=node.id;state.routeVisited=[config.route[0]];
    const before=[...state.actor.position],yaw=state.actor.rotation,dt=.04;
    step(config,state,{x,z},dt);
    const expected=[before[0]+x*state.actor.speed*dt,before[1],before[2]+z*state.actor.speed*dt];
    for(let axis=0;axis<3;axis++)assert.ok(Math.abs(state.actor.position[axis]-expected[axis])<1e-12,
      `${config.slug}: checkpoint snaps manual ${x},${z} travel off its intended position`);
    const desired=Math.atan2(x,z),expectedYaw=yaw+Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw))*dt*12;
    assert.ok(difference(state.actor.rotation,expectedYaw)<1e-12,'checkpoint must retain manually selected heading');
    assert.deepEqual(state.routeVisited,config.route.slice(0,2));
    assert.equal(state.routeNextId,config.route[2]);
    assert.equal(state.actor.moving,true);
    // Continuing the held direction remains manual, without revisiting the
    // checkpoint. Releasing the key resumes the correctly selected route.
    const continued=[...state.actor.position];step(config,state,{x,z},dt);
    assert.ok(Math.abs(state.actor.position[0]-continued[0]-x*state.actor.speed*dt)<1e-12);
    assert.ok(Math.abs(state.actor.position[2]-continued[2]-z*state.actor.speed*dt)<1e-12);
    assert.deepEqual(state.routeVisited,config.route.slice(0,2));
    until(config,state,()=>state.completed);
    assert.deepEqual(state.routeVisited,config.route);
    assert.equal(state.progress,1);
  }
});

test('idle scenes sleep, snapshots are detached, replay is clean, and activate acts once per press',()=>{
  const config=getExhibitGame('hong-kong-talent-engage-eurotech-healthtech-2026'),state=create(config),node=state.objects.find(o=>o.opticalNode);
  assert.equal(step(config,state,{},1/60),false);
  state.actor.position=[...node.position];const rotation=node.rotation;
  step(config,state,{activate:true},1/60);step(config,state,{activate:true},1/60);
  assert.equal(node.rotation,rotation+node.turnStep);
  step(config,state,{activate:false},1/60);step(config,state,{activate:true},1/60);
  assert.equal(node.rotation,rotation+node.turnStep*2);
  const view=snapshot(config,state);view.actor.position[0]=999;view.objects[0].position[0]=999;
  assert.notEqual(state.actor.position[0],999);assert.notEqual(state.objects[0].position[0],999);
  assert.equal(click(config,state,'missing'),false);assert.equal(click(config,state,null,[NaN,0,0]),false);
  assert.deepEqual(create(config),create(config));assert.equal(create(config).selectedId,null);
});

test('runtime repaints continue an aligned optics or energy hold after a zero-delta click frame',()=>{
  for(const slug of ['hong-kong-talent-engage-eurotech-healthtech-2026','thuega-2024']){
    const config=getExhibitGame(slug);let repaints=0;
    const runtime=createExhibitGameRuntime(slug,{onRepaint:()=>repaints++});
    try{
      runtime.render(0);
      if(config.mechanic==='optics')for(const object of config.objects.filter(o=>o.opticalNode)){
        for(let n=0;difference(runtime.getSnapshot().objects.find(o=>o.id===object.id).rotation,object.targetRotation)>.04&&n<8;n++)runtime.click(object.id);
      }
      else{const witness=energyWitness(config);config.objects.forEach((object,i)=>{for(let n=0;n<witness[i];n++)runtime.click(object.id);});}
      assert.equal(runtime.getStats().completed,false);
      assert.equal(runtime.render(0),true,'visible controls wake the next frame before a hold has elapsed');
      let now=0,frames=0;
      do{now+=1000/60;frames++;}while(runtime.render(now)&&frames<400);
      assert.ok(frames<400,'the complete flow and finite completion effects eventually sleep');
      assert.equal(runtime.getStats().completed,true);assert.ok(repaints>10);
      assert.equal(runtime.render(now+1000/60),false);
    }finally{runtime.destroy();}
  }
});

test('runtime keeps click movement alive without held keys and stops repainting after key release settles',()=>{
  const config=getExhibitGame('tesla-gigathon-2026'),runtime=createExhibitGameRuntime(config.slug);
  try{
    runtime.render(0);runtime.click(config.objects[0].id);runtime.click(config.objects[0].targetId);
    assert.equal(runtime.getSnapshot().actor.running,true);assert.equal(runtime.render(0),true);
    let now=0,frames=0;
    do{now+=1000/60;frames++;}while(runtime.render(now)&&frames<1600);
    assert.ok(frames<1600);assert.equal(runtime.getSnapshot().objects[0].complete,true);assert.equal(runtime.getSnapshot().actor.running,false);
    assert.equal(runtime.render(now+1000/60),false);
    runtime.input({x:-1,z:0,activate:false});now+=1000/60;assert.equal(runtime.render(now),true);
    runtime.input({x:0,z:0,activate:false});
    for(let frame=0;frame<200;frame++){now+=1000/60;runtime.render(now);}
    assert.equal(runtime.render(now+1000/60),false);
    runtime.reset();assert.equal(runtime.getSnapshot().objects[0].complete,false);assert.equal(runtime.getSnapshot().progress,0);
  }finally{runtime.destroy();}
});
