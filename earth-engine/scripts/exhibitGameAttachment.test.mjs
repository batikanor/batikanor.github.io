import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {pickProjectedObject} from '../src/exhibitGameAttachment.js';

test('physical picking inverts a perspective venue projection through reflected, elevated and scaled exhibit roots',()=>{
  const camera=new THREE.PerspectiveCamera(50,1000/700,.1,1000);
  camera.position.set(72,95,90);camera.lookAt(4,-24,3);camera.updateMatrixWorld(true);
  const projection=camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  const world=new THREE.Group();world.scale.y=-1;
  const venue=new THREE.Group();venue.position.set(4,16,3);venue.scale.setScalar(4);world.add(venue);
  const game=new THREE.Group();game.position.y=7.28;venue.add(game);
  const object=new THREE.Mesh(new THREE.BoxGeometry(1.5,1,1.5),new THREE.MeshBasicMaterial());
  object.position.set(-2,.6,1);object.userData.gameObjectId='forklift';game.add(object);world.updateMatrixWorld(true);
  const projected=object.getWorldPosition(new THREE.Vector3()).applyMatrix4(projection);
  const point={x:(projected.x+1)*500,y:(1-projected.y)*350};
  const hit=pickProjectedObject({point,canvas:{clientWidth:1000,clientHeight:700},projection,objects:[object],coordinateRoot:game});
  assert.equal(hit.id,'forklift');assert.ok(hit.point.every(Number.isFinite));
  assert.ok(Math.abs(hit.point[0]+2)<1&&Math.abs(hit.point[2]-1)<1,'hit coordinates belong to the canonical game, not terrain');
  object.visible=false;
  assert.equal(pickProjectedObject({point,canvas:{clientWidth:1000,clientHeight:700},projection,objects:[object],coordinateRoot:game}),null);
  object.geometry.dispose();object.material.dispose();
});

test('picking ignores off-canvas positions, singular projections, hidden parent groups and unrelated decoration',()=>{
  const parent=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
  mesh.userData.gameObjectId='coin';parent.add(mesh);parent.visible=false;
  const options={point:{x:50,y:50},canvas:{clientWidth:100,clientHeight:100},projection:new THREE.Matrix4(),objects:[mesh],coordinateRoot:parent};
  assert.equal(pickProjectedObject(options),null);
  parent.visible=true;assert.equal(pickProjectedObject({...options,point:{x:120,y:40}}),null);
  assert.equal(pickProjectedObject({...options,projection:new THREE.Matrix4().makeScale(0,0,0)}),null);
  delete mesh.userData.gameObjectId;assert.equal(pickProjectedObject(options),null);
  mesh.geometry.dispose();mesh.material.dispose();
});

test('untagged printed sign fronts and backs do not intercept physical objects or the floor behind them',()=>{
  const camera=new THREE.PerspectiveCamera(50,1,.1,100);camera.position.set(0,5,10);camera.lookAt(0,.6,0);camera.updateMatrixWorld(true);
  const projection=camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse);
  const game=new THREE.Group(),sign=new THREE.Group();game.add(sign);
  const board=new THREE.Mesh(new THREE.BoxGeometry(3,3,.1),new THREE.MeshBasicMaterial());
  board.position.set(0,1,3);sign.add(board);
  const actor=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.8),new THREE.MeshBasicMaterial());
  actor.position.y=.6;actor.userData.gameObjectId='actor';game.add(actor);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  floor.rotation.x=-Math.PI/2;floor.userData.gameObjectId='__floor';game.add(floor);game.updateMatrixWorld(true);
  const point={x:200,y:200},canvas={clientWidth:400,clientHeight:400};
  const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),camera);
  assert.equal(ray.intersectObjects([sign,actor,floor],true)[0].object,board,'the printed board really lies ahead of the actor');
  const options={point,canvas,projection,objects:[sign,actor,floor],coordinateRoot:game};
  assert.equal(pickProjectedObject(options).id,'actor');
  actor.visible=false;
  assert.equal(pickProjectedObject(options).id,'__floor','a printed sign has no inherited click action and cannot block floor navigation');
  assert.equal(pickProjectedObject({...options,objects:[sign]}),null);
  for(const object of [board,actor,floor]){object.geometry.dispose();object.material.dispose();}
});
