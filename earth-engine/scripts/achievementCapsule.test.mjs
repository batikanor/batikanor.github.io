import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as THREE from 'three';
import {ACHIEVEMENT_SCENE_SUBJECTS} from '../src/achievementSceneData.js';
import {buildDetailedExhibit} from '../src/achievementExhibits.js';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {CAPSULE_LAYOUT,CAPSULE_SCALE,CAPSULE_SIGN_POSITIONS,buildCapsuleFrame,createCapsuleGlazing,updateCapsuleGlazing} from '../src/achievementCapsule.js';

const subjects=[...new Set(Object.values(ACHIEVEMENT_SCENE_SUBJECTS).map(item=>item.subject))];
const palette=new Set(['stone','edge','metal','dark','gold','glass','leaf','bark','paper','signal','blue','brick','red']);

/** Real host primitives, measured before batching, without a canvas/WebGL. */
function record({lift=0}={}) {
  const commands=[],bounds=new THREE.Box3(),materials=new Set();
  let triangles=0,bytes=0;
  function add(name,mat,args,geometry,xyz,scale=[1,1,1],rotation=[0,0,0]) {
    assert.ok(palette.has(mat),`Unknown host material ${mat}`);
    assert.ok(xyz.every(Number.isFinite));assert.ok(scale.every(value=>Number.isFinite(value)&&value>0));
    assert.ok(rotation.every(Number.isFinite));
    commands.push({name,material:mat,args:structuredClone(args)});materials.add(mat);
    const transform=new THREE.Object3D();transform.position.set(xyz[0],xyz[1]+lift,xyz[2]);
    transform.scale.set(...scale);transform.rotation.set(...rotation);transform.updateMatrix();geometry.applyMatrix4(transform.matrix);
    geometry.computeBoundingBox();bounds.union(geometry.boundingBox);
    const count=geometry.index?.count??geometry.attributes.position.count;
    triangles+=count/3;bytes+=count*3*2*4;
    assert.ok([...geometry.attributes.position.array,...geometry.attributes.normal.array].every(Number.isFinite));
    geometry.dispose();
  }
  const p={
    box:(mat,xyz,scale,rot)=>add('box',mat,[xyz,scale,rot],new THREE.BoxGeometry(1,1,1),xyz,scale,rot),
    sphere:(mat,xyz,scale)=>add('sphere',mat,[xyz,scale],new THREE.IcosahedronGeometry(1,2),xyz,scale),
    cylinder:(mat,xyz,radius,height,rot)=>add('cylinder',mat,[xyz,radius,height,rot],new THREE.CylinderGeometry(radius,radius,height,20),xyz,undefined,rot),
    ring:(mat,xyz,radius,tube,rot=[Math.PI/2,0,0])=>add('ring',mat,[xyz,radius,tube,rot],new THREE.TorusGeometry(radius,tube,6,40),xyz,undefined,rot),
    rod:(mat,a,b,r=.06)=>{
      const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
      assert.ok(delta.length()>0,'Zero-length rung/strut');
      const geometry=new THREE.CylinderGeometry(r,r,delta.length(),8);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      add('rod',mat,[a,b,r],geometry,from.add(to).multiplyScalar(.5).toArray());
    },
    cone:(mat,xyz,radius,height,rot)=>add('cone',mat,[xyz,radius,height,rot],new THREE.ConeGeometry(radius,height,20),xyz,undefined,rot),
  };
  return {p,commands,bounds,materials,get triangles(){return triangles;},get bytes(){return bytes;}};
}
function frame(subject,compact=false){const result=record();const metadata=buildCapsuleFrame(result.p,{subject,compact});return {...result,metadata,triangles:result.triangles,bytes:result.bytes};}
function release(mesh){mesh.geometry.dispose();mesh.material.dispose();}

// Focused geometry/ownership assertions are intentionally separate from the
// complete host-scene budgets, which also count the unchanged demonstrations.
test('capsule layout elevates the original work rather than repeating a ground court',()=>{
  assert.ok(Object.isFrozen(CAPSULE_LAYOUT));
  for(const key of ['floorY','demonstrationLift','centerY','radius'])assert.ok(Number.isFinite(CAPSULE_LAYOUT[key]),key);
  assert.ok(CAPSULE_LAYOUT.floorY>=5);assert.ok(CAPSULE_LAYOUT.radius>=7);
  assert.equal(CAPSULE_LAYOUT.demonstrationLift,CAPSULE_LAYOUT.floorY-.8);
  assert.ok(CAPSULE_LAYOUT.centerY+CAPSULE_LAYOUT.radius>15);
  assert.equal(CAPSULE_SCALE,4);assert.equal(CAPSULE_LAYOUT.radius*2*CAPSULE_SCALE,80);
  assert.ok(Object.isFrozen(CAPSULE_SIGN_POSITIONS)&&CAPSULE_SIGN_POSITIONS.every(Object.isFrozen));
  for(const [x,y,z] of CAPSULE_SIGN_POSITIONS) {
    assert.ok(y>CAPSULE_LAYOUT.floorY);
    assert.ok(Math.hypot(x,y-CAPSULE_LAYOUT.centerY,z)<CAPSULE_LAYOUT.radius);
  }
});

test('all project-topic frames are finite, deterministic and fit existing venue siting',()=>{
  for(const subject of subjects)for(const compact of [false,true]){
    const model=frame(subject,compact),again=frame(subject,compact);
    assert.deepEqual(model.commands,again.commands,`${subject}: geometry changes on repeated visits`);
    assert.deepEqual(model.metadata,again.metadata,`${subject}: metadata changes on repeated visits`);
    assert.equal(typeof model.metadata.style,'string');assert.ok(model.metadata.style.length>0);
    assert.equal(model.metadata.compact,compact);assert.equal(model.metadata.decorativeTrees,0);
    const {ladder,entrance}=model.metadata;
    assert.ok(Number.isInteger(ladder.rungs)&&ladder.rungs>=8,`${subject}: the elevated entry needs a real rung ladder`);
    assert.ok(ladder.handrails>=2,`${subject}: ladder needs two visible handrails`);
    assert.ok(ladder.to[1]>ladder.from[1]+5);assert.equal(ladder.to[1],CAPSULE_LAYOUT.floorY);
    assert.equal(entrance.width,CAPSULE_LAYOUT.doorwayWidth);assert.equal(entrance.floorY,CAPSULE_LAYOUT.floorY);
    assert.ok(entrance.topY>entrance.floorY+2);assert.ok(entrance.doorOpenDegrees>30);
    assert.ok(model.commands.length>=15,`${subject}: frame lacks a recognisable entrance/support structure`);
    assert.ok(model.triangles>200);assert.ok(model.triangles<6_800,`${subject}: frame consumes demonstration budget`);
    assert.ok(model.bytes<490_000,`${subject}: excessive flattened frame buffers`);
    assert.ok(model.bounds.min.x>=-19&&model.bounds.max.x<=19,`${subject}: east/west siting margin`);
    assert.ok(model.bounds.min.z>=-15&&model.bounds.max.z<=15,`${subject}: north/south siting margin`);
    assert.ok(model.bounds.min.y>=-.1&&model.bounds.max.y>15,`${subject}: elevated globe silhouette`);
    assert.ok(!model.commands.some(command=>command.name==='box'&&command.args[0][1]<1&&command.args[1][0]>=30&&command.args[1][2]>=20),
      'the old opaque 36 x 27 m ground platform must not survive');
  }
});

test('terrain access can replace only the floating legacy ladder without altering the globe, portal or guards',()=>{
  for(const subject of subjects)for(const compact of [false,true]) {
    const old=record(),newFrame=record();
    const legacy=buildCapsuleFrame(old.p,{subject,compact});
    const adapted=buildCapsuleFrame(newFrame.p,{subject,compact,includeLadder:false});
    assert.deepEqual(adapted.entrance,legacy.entrance);assert.equal(adapted.style,legacy.style);assert.equal(adapted.ribs,legacy.ribs);
    assert.equal(adapted.ladder.enabled,false);assert.equal(adapted.ladder.rungs,0);assert.equal(adapted.ladder.handrails,0);
    assert.deepEqual(adapted.ladder.to,CAPSULE_LAYOUT.ladderTop);
    const removed=old.commands.filter(command=>!newFrame.commands.some(candidate=>JSON.stringify(candidate)===JSON.stringify(command)));
    assert.equal(removed.length,26,'only22oldrungs+2rails+2grabs are replaced by grounded access');
    assert.ok(removed.every(command=>command.name==='rod'),'no floor, portal, door, support, collar or globe changes');
    assert.equal(old.triangles-newFrame.triangles,26*32,'reclaim only the legacy ladder GPU cost');
    assert.ok(newFrame.commands.some(command=>command.name==='box'&&command.args[0][2]===CAPSULE_LAYOUT.doorwayZ),'the existing entry landing remains');
    assert.equal(newFrame.commands.filter(command=>command.name==='rod'&&command.args[0][1]===CAPSULE_LAYOUT.floorY
      &&Math.abs(command.args[0][0])===1.2).length,2,'the two existing door landing guards remain');
  }
  assert.throws(()=>buildCapsuleFrame(record().p,{subject:subjects[0],includeLadder:'false'}),/explicit/);
});

test('project demonstrations retain every existing prop and fit inside the elevated globe',()=>{
  for(const project of contestsAndActivities){
    const subject=ACHIEVEMENT_SCENE_SUBJECTS[project.slug].subject;
    const props=record({lift:CAPSULE_LAYOUT.demonstrationLift});
    assert.equal(buildDetailedExhibit(subject,props.p,{slug:project.slug,project}),true);
    assert.ok(props.commands.length>=20,`${project.slug}: demonstration simplified`);
    assert.ok(props.bounds.min.y>=CAPSULE_LAYOUT.floorY-.12,`${project.slug}: props fall through the capsule floor`);
    const {min,max}=props.bounds;
    for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z]){
      assert.ok(Math.hypot(x,y-CAPSULE_LAYOUT.centerY,z)<=CAPSULE_LAYOUT.radius+.08,
        `${project.slug}: original demonstration extends outside the glass globe`);
    }
  }
});

test('glazing is a single bounded transparent mesh without offscreen transmission, textures or image downloads',()=>{
  for(const subject of subjects)for(const compact of [false,true]){
    const mesh=createCapsuleGlazing({subject,compact});
    assert.ok(mesh.isMesh);assert.equal(mesh.children.length,0);assert.ok(mesh.material.isShaderMaterial);
    assert.equal(mesh.material.transparent,true);assert.equal(mesh.material.depthWrite,false);assert.equal(mesh.material.side,THREE.FrontSide);
    assert.ok(mesh.material.uniforms.uViewDirection?.value?.isVector3);
    assert.equal(typeof mesh.userData.style,'string');
    assert.equal(mesh.userData.aperture.width,CAPSULE_LAYOUT.doorwayWidth);
    assert.equal(mesh.userData.aperture.bottomY,CAPSULE_LAYOUT.floorY);assert.equal(mesh.userData.aperture.cut,true);
    assert.ok(mesh.userData.aperture.topY>mesh.userData.aperture.springY);
    assert.equal(mesh.userData.door.openDegrees,CAPSULE_LAYOUT.doorOpenDegrees);
    assert.ok(mesh.userData.door.openDegrees>=30);assert.ok(mesh.userData.door.hinge.every(Number.isFinite));
    assert.equal(mesh.material.map,undefined);assert.equal(mesh.material.transmission,undefined);
    for(const uniform of Object.values(mesh.material.uniforms))assert.ok(!uniform.value?.isTexture);
    const positions=mesh.geometry.getAttribute('position');assert.ok(positions.count>100);
    assert.ok([...positions.array].every(Number.isFinite));
    const count=mesh.geometry.index?.count??positions.count;assert.ok(count/3<3_000);assert.equal(mesh.userData.triangles,count/3);
    let bytes=mesh.geometry.index?.array.byteLength??0;
    for(const attribute of Object.values(mesh.geometry.attributes))bytes+=attribute.array.byteLength;
    assert.ok(bytes<180_000,`${subject}: glazing buffer budget`);
    const bounds=new THREE.Box3().setFromObject(mesh);
    assert.ok(bounds.min.x>=-19&&bounds.max.x<=19);assert.ok(bounds.min.z>=-15&&bounds.max.z<=15);
    assert.ok(bounds.max.y>15);release(mesh);
  }
});

test('the actual front glazing has an empty arch aperture and a separately swung outward-facing door',()=>{
  const mesh=createCapsuleGlazing({subject:'supply-chain'}),positions=mesh.geometry.getAttribute('position'),normals=mesh.geometry.getAttribute('normal');
  const {radius,centerY,floorY,doorwaySpringY:spring,doorwayTopY:top,doorwayWidth}=CAPSULE_LAYOUT;
  const swing=CAPSULE_LAYOUT.doorOpenDegrees*Math.PI/180,doorNormal=new THREE.Vector3(-Math.sin(swing),0,-Math.cos(swing));
  const hinge=new THREE.Vector3(...mesh.userData.door.hinge);
  let openBandFaces=0,doorFaces=0,facesBelow=0,facesAbove=0;
  for(let i=0;i<positions.count;i+=3){
    const vertices=[0,1,2].map(offset=>new THREE.Vector3().fromBufferAttribute(positions,i+offset));
    const ab=vertices[1].clone().sub(vertices[0]),ac=vertices[2].clone().sub(vertices[0]);
    const cross=ab.cross(ac),normal=new THREE.Vector3().fromBufferAttribute(normals,i);
    assert.ok(cross.length()>1e-8,'degenerate glass face');assert.ok(cross.dot(normal)>0,'front-only glazing must have outward face winding');
    const spherical=vertices.every(v=>Math.abs(Math.hypot(v.x,v.y-centerY,v.z)-radius)<.001);
    if(!spherical){
      doorFaces++;assert.ok(normal.distanceTo(doorNormal)<1e-6,'door face normal must follow its actual open angle');
      for(const vertex of vertices)assert.ok(Math.abs(vertex.clone().sub(hinge).dot(doorNormal))<1e-5,'the door geometry must lie in the swung plane, not across the entry');
      continue;
    }
    const centroid=vertices.reduce((sum,v)=>sum.addScaledVector(v,1/3),new THREE.Vector3());
    if(centroid.z>=-7)continue;
    if(Math.abs(centroid.x)<1&&centroid.y<floorY-.1)facesBelow++;
    if(Math.abs(centroid.x)<1&&centroid.y>top+.1)facesAbove++;
    if(centroid.y<=floorY+.1||centroid.y>=top-.1)continue;
    openBandFaces++;
    const half=doorwayWidth/2,halfOpening=centroid.y>spring?Math.sqrt(half*half-(centroid.y-spring)**2):half;
    assert.ok(Math.abs(centroid.x)>=halfOpening-.05,'the arch must be a real opening, not a door painted over unbroken glass');
  }
  assert.ok(openBandFaces>50);assert.ok(doorFaces>=10,'a visible open arched glass leaf must remain');
  assert.ok(facesBelow>0&&facesAbove>0,'trim only the entrance; preserve the surrounding globe');release(mesh);
});

test('topic families change the physical suspension and collar rather than only inventing a label',()=>{
  const models=subjects.map(subject=>frame(subject));
  assert.ok(new Set(models.map(model=>model.metadata.style)).size>=4);
  assert.ok(new Set(models.map(model=>JSON.stringify(model.commands))).size>=4);
});

test('camera-facing glass updates existing uniform vectors only, without geometry rebuilds or perpetual work',()=>{
  const mesh=createCapsuleGlazing({subject:subjects[0]});
  const geometry=mesh.geometry,material=mesh.material,uniform=material.uniforms.uViewDirection.value;
  const vertices=geometry.getAttribute('position').array.slice();
  let geometries=0,materials=0;
  geometry.addEventListener('dispose',()=>geometries++);material.addEventListener('dispose',()=>materials++);
  for(const [bearing,pitch] of [[0,0],[42,54],[90,65],[-170,85],[360,30]]){
    updateCapsuleGlazing(mesh,{bearing,pitch});
    assert.equal(mesh.geometry,geometry);assert.equal(mesh.material,material);assert.equal(material.uniforms.uViewDirection.value,uniform);
    assert.ok(uniform.toArray().every(Number.isFinite));assert.ok(Math.abs(uniform.length()-1)<1e-6);
  }
  assert.deepEqual([...geometry.getAttribute('position').array],[...vertices]);assert.equal(geometries,0);assert.equal(materials,0);
  release(mesh);assert.equal(geometries,1);assert.equal(materials,1);
  assert.doesNotMatch(updateCapsuleGlazing.toString(),/new\s+THREE\.|\.clone\(/,'camera events must not allocate Three resources');
  const source=readFileSync(new URL('../src/achievementCapsule.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|requestAnimationFrame|setInterval|fetch\(|\.load\(|new\s+Image|CanvasTexture|WebGLRenderTarget|MeshPhysicalMaterial/);
});
