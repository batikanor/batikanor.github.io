import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {renderGalleryRoomDom} from '../src/galleryRoomDomView.js';

test('native DOM screens preserve the exact WebGL projection through side-wall turns and view offsets',()=>{
  for(const yaw of [0,Math.PI/2,-Math.PI/2,.7])for(const [width,height]of [[1280,720],[390,844]]){
    const camera=new THREE.PerspectiveCamera(50,width/height,.08,170);
    camera.position.set(201,4.8,17);camera.rotation.y=yaw;
    camera.setViewOffset(width,height,-121,-24,width,height);
    camera.updateMatrixWorld(true);
    const scene=new THREE.Scene(),board=new THREE.Object3D();
    board.position.set(207.7,4.8,17);board.rotation.y=-Math.PI/2;scene.add(board);
    const originalPosition=board.position.clone(),originalRotation=board.rotation.clone();
    const originalWorld=new THREE.Matrix4().compose(board.position,board.quaternion,board.scale);
    const viewCamera=new THREE.PerspectiveCamera();let called=false;
    viewCamera.position.z=1000;viewCamera.updateMatrixWorld(true);
    const expected=viewCamera.matrixWorld.clone().multiply(camera.matrixWorldInverse).multiply(originalWorld);
    renderGalleryRoomDom({render(s,c){called=true;s.updateMatrixWorld();c.updateMatrixWorld();}},scene,camera,viewCamera);
    assert.ok(called);
    board.matrixWorld.elements.forEach((value,i)=>assert.ok(Math.abs(value-expected.elements[i])<1e-10));
    assert.deepEqual(board.position.toArray(),originalPosition.toArray());
    assert.deepEqual(board.rotation.toArray(),originalRotation.toArray());
    assert.deepEqual(viewCamera.position.toArray(),[0,0,1000]);
    assert.deepEqual(viewCamera.projectionMatrix.elements,camera.projectionMatrix.elements);
    assert.deepEqual(viewCamera.view,camera.view);
    assert.notEqual(viewCamera.view,camera.view);
    const local=new THREE.Vector3(.4,.3,0);
    const glProjection=local.clone().applyMatrix4(originalWorld).project(camera);
    const domProjection=local.clone().applyMatrix4(board.matrixWorld).project(viewCamera);
    assert.ok(glProjection.distanceTo(domProjection)<1e-9);
  }
});
