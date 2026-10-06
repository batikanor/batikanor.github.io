import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {EXHIBIT_GAME_CATALOG} from '../src/exhibitGameCatalog.js';
import {createExhibitGameObjects,EXHIBIT_GAME_OBJECT_KINDS} from '../src/exhibitGameObjects.js';
import {createExhibitGameState,getExhibitGameSnapshot,stepExhibitGame} from '../src/exhibitGameSimulation.js';

const game=slug=>EXHIBIT_GAME_CATALOG[slug];
const node=(view,id)=>view.root.getObjectByName(`game-object:${id}`);
function settle(view,snapshot,frames=240){let active=false;for(let i=0;i<frames;i++)active=view.sync(snapshot,1/60);return active;}

test('every actor miniature faces its actual travel while control models and floor feedback keep their own basis',()=>{
  for(const config of Object.values(EXHIBIT_GAME_CATALOG))for(const [x,z] of [[0,1],[1,0],[0,-1],[-1,0]]){
    const state=createExhibitGameState(config),view=createExhibitGameObjects(config);
    state.actor.position=[0,state.actor.position[1],0];state.obstacles=[];state.routeNextId=null;
    const before=[...state.actor.position];
    for(let frame=0;frame<24;frame++)stepExhibitGame(config,state,{x,z},1/60);
    settle(view,getExhibitGameSnapshot(config,state));view.root.updateMatrixWorld(true);
    const actor=node(view,'actor'),body=actor.children[0];
    const travel=new THREE.Vector3(state.actor.position[0]-before[0],0,state.actor.position[2]-before[2]).normalize();
    const nose=new THREE.Vector3(0,0,-1).transformDirection(body.matrixWorld);
    assert.ok(nose.dot(travel)>.999,`${config.slug}: authored nose points opposite ${x},${z} travel`);
    assert.equal(body.rotation.y,Math.PI);
    for(const object of [...config.objects,...config.targets])assert.equal(node(view,object.id).children[0].rotation.y,0,
      `${config.slug}: actor correction must not rotate puzzle models or their control arrows`);
    const halo=actor.children.find(child=>child.geometry?.type==='TorusGeometry');
    assert.equal(halo.rotation.y,0,'floor halo does not inherit miniature correction');
    const shadow=actor.children.find(child=>child.geometry?.type==='CylinderGeometry');
    assert.equal(shadow.rotation.y,0,'floor shadow does not inherit miniature correction');
    view.destroy();
  }
});

test('all 32 authored playgrounds have physical kinds, readable pickups and bounded active assets',()=>{
  assert.equal(Object.keys(EXHIBIT_GAME_CATALOG).length,32);
  for(const config of Object.values(EXHIBIT_GAME_CATALOG)){
    const state=createExhibitGameState(config),snapshot=getExhibitGameSnapshot(config,state),view=createExhibitGameObjects(config);
    view.sync(snapshot,0);view.root.updateMatrixWorld(true);
    const entries=[config.actor,...config.objects,...config.targets,...config.obstacles,...(config.decor||[])];
    assert.equal(view.getStats().objects,entries.length,config.slug);
    for(const item of entries){
      assert.ok(EXHIBIT_GAME_OBJECT_KINDS.includes(item.kind),`${config.slug}: ${item.kind}`);
      assert.ok(node(view,item.id),`${config.slug}: missing ${item.id}`);
      assert.ok(view.pickable.some(mesh=>mesh.userData.gameObjectId===item.id),`${config.slug}: ${item.id} is unreachable`);
    }
    for(const object of view.root.children){
      if(!object.visible)continue;
      const bounds=new THREE.Box3().setFromObject(object);
      assert.ok(bounds.min.y>=-.08,`${config.slug}: floor penetration ${object.name}`);
      assert.ok(bounds.max.y<5,`${config.slug}: excessive height ${object.name}`);
      for(const x of [bounds.min.x,bounds.max.x])for(const z of [bounds.min.z,bounds.max.z]){
        // A circumference's rectangular bounds include empty corners.
        if(object.name==='arena-perimeter'||object.name==='game-floor-picking-surface')continue;
        assert.ok(Math.hypot(x,z)<8,`${config.slug}: outside capsule ${object.name}`);
      }
    }
    const stats=view.getStats();assert.ok(stats.triangles<=18_000,`${config.slug}: ${stats.triangles} triangles`);
    assert.ok(stats.drawCalls<=50,`${config.slug}: ${stats.drawCalls} draws`);
    state.completed=true;
    for(const item of [...state.objects,...state.targets]){item.complete=true;if(item.targetLevel)item.level=item.targetLevel;else if(item.capacity)item.level=item.capacity;}
    view.sync(getExhibitGameSnapshot(config,state),1/60);
    const finished=view.getStats();assert.ok(finished.triangles<=18_000,`${config.slug}: ${finished.triangles} completed triangles`);
    assert.ok(finished.drawCalls<=50,`${config.slug}: ${finished.drawCalls} completed draws`);view.destroy();
  }
});

test('spring motion settles, finite victory finishes and identical completed snapshots remain idle',()=>{
  const config=game('tesla-gigathon-2026'),state=createExhibitGameState(config),view=createExhibitGameObjects(config);
  let snapshot=getExhibitGameSnapshot(config,state);assert.equal(view.sync(snapshot,0),false);
  state.actor.position=[2,.04,3];snapshot=getExhibitGameSnapshot(config,state);
  assert.equal(view.sync(snapshot,1/60),true);
  assert.ok(node(view,'actor').position.x>0&&node(view,'actor').position.x<2);
  assert.equal(settle(view,snapshot),false);assert.deepEqual(node(view,'actor').position.toArray(),state.actor.position);
  state.completed=true;state.objects[0].complete=true;snapshot=getExhibitGameSnapshot(config,state);
  assert.equal(view.sync(snapshot,1/60),true);assert.equal(view.root.getObjectByName('finite-completion-sparks').visible,true);
  assert.equal(settle(view,snapshot),false);assert.equal(view.root.getObjectByName('finite-completion-sparks').visible,false);
  assert.equal(view.sync(snapshot,1/60),false);view.destroy();assert.equal(view.sync(snapshot,1/60),false);
});

test('solid-obstacle collision is reflected by the same rendered vehicle and its floor shadow',()=>{
  const config=game('tesla-gigathon-2026'),state=createExhibitGameState(config),view=createExhibitGameObjects(config);
  const rack=state.obstacles[0];state.actor.position=[rack.position[0],.04,rack.position[2]+2];
  view.sync(getExhibitGameSnapshot(config,state),0);
  for(let i=0;i<160;i++){
    stepExhibitGame(config,state,{x:0,z:-1},1/60);view.sync(getExhibitGameSnapshot(config,state),1/60);
    assert.ok(Math.hypot(state.actor.position[0]-rack.position[0],state.actor.position[2]-rack.position[2])>=rack.radius+state.actor.radius-1e-6);
  }
  const snapshot=getExhibitGameSnapshot(config,state);assert.equal(settle(view,snapshot),false);
  assert.deepEqual(node(view,'actor').position.toArray(),state.actor.position);
  const shadow=node(view,'actor').children.find(child=>child.geometry.type==='CylinderGeometry');
  assert.ok(Math.abs(shadow.position.y+node(view,'actor').position.y-.013)<1e-6);view.destroy();
});

test('charge marbles, goal rings and growing trees show actual puzzle state without text',()=>{
  const config=game('decarbon-days-climathon-2026'),state=createExhibitGameState(config),view=createExhibitGameObjects(config);
  let snapshot=getExhibitGameSnapshot(config,state);view.sync(snapshot,0);
  const tree=node(view,'well-0'),body=tree.children[0],counter=tree.getObjectByName('charge:well-0');
  const young=body.scale.y;assert.equal(counter.count,0);
  state.targets[0].level=1;state.targets[0].charge=.3;snapshot=getExhibitGameSnapshot(config,state);settle(view,snapshot);
  assert.equal(counter.count,1);assert.ok(body.scale.y>young);
  state.targets[0].level=state.targets[0].targetLevel;state.targets[0].complete=true;snapshot=getExhibitGameSnapshot(config,state);settle(view,snapshot);
  assert.equal(counter.count,state.targets[0].targetLevel);assert.equal(body.scale.y,1);
  const energy=game('thuega-2024'),energyState=createExhibitGameState(energy),energyView=createExhibitGameObjects(energy);
  energyState.objects[1].level=2;energyView.sync(getExhibitGameSnapshot(energy,energyState),0);
  assert.equal(node(energyView,'generator-1').getObjectByName('charge:generator-1').count,2);
  view.destroy();energyView.destroy();
});

test('floor, multipart miniatures and ghost sockets return IDs; hidden pieces are not pickable',()=>{
  const config=game('zero-one-hack-supercompute-industrial-2026'),state=createExhibitGameState(config),view=createExhibitGameObjects(config);
  view.sync(getExhibitGameSnapshot(config,state),0);view.root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(5,5,0),new THREE.Vector3(0,-1,0));
  assert.equal(ray.intersectObjects(view.pickable,false)[0].object.userData.gameObjectId,'__floor');
  const ghost=view.pickable.find(mesh=>mesh.userData.gameObjectId==='slot-0'&&mesh.material.transparent);
  assert.ok(ghost);state.objects[0].visible=false;view.sync(getExhibitGameSnapshot(config,state),0);
  assert.equal(view.pickable.some(mesh=>mesh.userData.gameObjectId==='part-0'),false);view.destroy();assert.deepEqual(view.pickable,[]);
});

test('spatial pen traces stay above the floor and inside the active scene triangle budget',()=>{
  const config=game('music-ai-osaka-2025'),state=createExhibitGameState(config),view=createExhibitGameObjects(config);
  state.trails=Array.from({length:180},(_,i)=>[Math.sin(i*.06)*3,1+Math.sin(i*.03)*.4,Math.cos(i*.06)*3]);
  view.sync(getExhibitGameSnapshot(config,state),0);
  const trail=view.root.getObjectByName('physical-motion-trail');assert.ok(trail);
  trail.geometry.computeBoundingBox();assert.ok(trail.geometry.boundingBox.min.y>.5);
  assert.ok(view.getStats().triangles<=18_000);assert.ok(view.getStats().drawCalls<=50);view.destroy();
});

test('replaced signal geometry and every owned resource are disposed exactly once',()=>{
  const geometries=new Map(),materials=new Map(),originalGeometryDispose=THREE.BufferGeometry.prototype.dispose,originalMaterialDispose=THREE.Material.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose=function(){geometries.set(this,(geometries.get(this)||0)+1);return originalGeometryDispose.call(this);};
  THREE.Material.prototype.dispose=function(){materials.set(this,(materials.get(this)||0)+1);return originalMaterialDispose.call(this);};
  try{
    const config=game('huawei-agorize-2024'),state=createExhibitGameState(config),view=createExhibitGameObjects(config);
    view.sync(getExhibitGameSnapshot(config,state),0);state.objects[1].rotation+=Math.PI/4;view.sync(getExhibitGameSnapshot(config,state),1/60);
    const visibleGeometries=new Set(),visibleMaterials=new Set();view.root.traverse(mesh=>{if(mesh.geometry)visibleGeometries.add(mesh.geometry);if(mesh.material)visibleMaterials.add(mesh.material);});
    view.destroy();view.destroy();
    for(const resource of visibleGeometries)assert.equal(geometries.get(resource),1);
    for(const resource of visibleMaterials)assert.equal(materials.get(resource),1);
    for(const count of geometries.values())assert.equal(count,1);
    for(const count of materials.values())assert.equal(count,1);
    assert.deepEqual(view.getStats(),{triangles:0,drawCalls:0,objects:0,visibleObjects:0,geometries:0,materials:0,destroyed:true});
  }finally{THREE.BufferGeometry.prototype.dispose=originalGeometryDispose;THREE.Material.prototype.dispose=originalMaterialDispose;}
});
