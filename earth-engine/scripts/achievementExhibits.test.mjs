import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {buildDetailedExhibit, EXHIBIT_MODELS} from '../src/achievementExhibits.js';
import {ACHIEVEMENT_SCENE_SUBJECTS} from '../src/achievementSceneData.js';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {CAPSULE_LAYOUT,CAPSULE_SIGN_POSITIONS} from '../src/achievementCapsule.js';
import {buildAchievementExhibit,disposeAchievementScene} from '../src/achievementSceneLayer.js';

const palette = new Set(['stone','edge','metal','dark','gold','glass','leaf','bark','paper','signal','blue','brick','red']);
const events = contestsAndActivities.filter(project=>ACHIEVEMENT_SCENE_SUBJECTS[project.slug]);

/** Same primitive geometries and transform order as the host; no WebGL needed. */
function record({cone=true}={}) {
  const commands=[],triangleVertices=[],bounds=new THREE.Box3(),materials=new Set();
  let triangles=0,positionNormalBytes=0,maxLiftedRadius=0;
  function submit(name,material,args,geometry,xyz,scale=[1,1,1],rotation) {
    assert.ok(palette.has(material),`Unknown host material ${material}`);
    assert.ok(xyz.every(Number.isFinite));assert.ok(scale.every(value=>Number.isFinite(value)&&value>0));
    if(rotation)assert.ok(rotation.every(Number.isFinite));
    commands.push({name,material,args:structuredClone(args)});materials.add(material);
    // Exactly the host's combined Object3D transform, including the lift in
    // the single Float32 write. Sequential local transforms/double-precision
    // post-lift subtly change tangent contacts in a horizontal panel sweep.
    const transform=new THREE.Object3D();transform.scale.set(...scale);transform.rotation.set(...(rotation??[0,0,0]));
    transform.position.set(xyz[0],xyz[1]+CAPSULE_LAYOUT.demonstrationLift,xyz[2]);transform.updateMatrix();
    const lifted=geometry.clone();lifted.applyMatrix4(transform.matrix);
    transform.position.set(...xyz);transform.updateMatrix();geometry.applyMatrix4(transform.matrix);
    geometry.computeBoundingBox();bounds.union(geometry.boundingBox);
    const positions=lifted.attributes.position;
    for(let i=0;i<positions.count;i++)maxLiftedRadius=Math.max(maxLiftedRadius,Math.hypot(
      positions.getX(i),positions.getY(i)-CAPSULE_LAYOUT.centerY,positions.getZ(i)));
    const count=geometry.index?.count??geometry.attributes.position.count;
    for(let i=0;i<count;i++){
      const vertex=geometry.index?geometry.index.getX(i):i;
      triangleVertices.push(positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex));
    }
    triangles+=count/3;positionNormalBytes+=count*3*2*4;
    for(const attribute of [geometry.attributes.position,geometry.attributes.normal])assert.ok([...attribute.array].every(Number.isFinite));
    lifted.dispose();geometry.dispose();
  }
  const p={
    box:(mat,xyz,scale,rot)=>submit('box',mat,[xyz,scale,rot],new THREE.BoxGeometry(1,1,1),xyz,scale,rot),
    sphere:(mat,xyz,scale)=>submit('sphere',mat,[xyz,scale],new THREE.IcosahedronGeometry(1,2),xyz,scale),
    cylinder:(mat,xyz,radius,height,rot)=>submit('cylinder',mat,[xyz,radius,height,rot],new THREE.CylinderGeometry(radius,radius,height,20),xyz,undefined,rot),
    ring:(mat,xyz,radius,tube,rot=[Math.PI/2,0,0])=>submit('ring',mat,[xyz,radius,tube,rot],new THREE.TorusGeometry(radius,tube,6,40),xyz,undefined,rot),
    rod:(mat,a,b,r=.06)=>{
      const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
      assert.ok(delta.length()>0,'Zero-length rod has no valid direction');
      const geometry=new THREE.CylinderGeometry(r,r,delta.length(),8);
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
      submit('rod',mat,[a,b,r],geometry,from.add(to).multiplyScalar(.5).toArray());
    },
  };
  if(cone)p.cone=(mat,xyz,radius,height,rot)=>submit('cone',mat,[xyz,radius,height,rot],new THREE.ConeGeometry(radius,height,20),xyz,undefined,rot);
  return {p,commands,triangleVertices,bounds,materials,get triangles(){return triangles;},get bytes(){return positionNormalBytes;},get maxLiftedRadius(){return maxLiftedRadius;}};
}
function model(project,options) {
  const result=record(options);let parts;
  const before=JSON.stringify(project);
  assert.equal(buildDetailedExhibit(ACHIEVEMENT_SCENE_SUBJECTS[project.slug].subject,result.p,{slug:project.slug,project,onParts:value=>parts=value}),true);
  assert.equal(JSON.stringify(project),before,'Rendering must not mutate original authored content');
  return {...result,parts,triangles:result.triangles,bytes:result.bytes};
}
function project(slug){return events.find(item=>item.slug===slug);}
function sourceText(slug){const item=project(slug);return `${item.title}\n${item.shortDescription}\n${item.longDescription}`;}

const models=new Map(events.map(item=>[item.slug,model(item)]));

test('all 32 authored achievements have complete detailed, meaningful exhibit metadata',()=>{
  assert.equal(events.length,32);
  assert.deepEqual(Object.keys(EXHIBIT_MODELS).sort(),events.map(item=>item.slug).sort());
  for(const item of events){
    const result=models.get(item.slug);
    assert.equal(result.parts,EXHIBIT_MODELS[item.slug]);assert.ok(result.parts.kind);
    assert.ok(result.parts.parts.length>=5,`${item.slug} needs integrated explanatory systems, not a stand-alone emblem`);
    assert.ok(result.commands.length>=20,`${item.slug} is not just a stand-alone token`);
    assert.ok(result.commands.filter(cmd=>cmd.name==='box').length>=10,`${item.slug} needs recognizable object surfaces`);
  }
});

test('demonstrations remain bounded without reducing the existing geometry quality budgets',()=>{
  for(const [slug,result] of models){
    // A local primitive ceiling protects temporary construction CPU. The real
    // complete globe/frame budgets are measured separately below, not guessed.
    assert.ok(result.triangles<9000,`${slug}: ${result.triangles} demonstration triangles`);
    assert.ok(result.bytes<500_000,`${slug}: ${result.bytes} flattened position/normal bytes`);
    const hostMaterials=new Set(['stone','edge','metal','dark',...result.materials]);
    assert.ok(hostMaterials.size+2<=10,`${slug} exceeds ten base-material/tree draw calls`);
    // Additional fitted controls/tread/retaining clips are cheap boxes, not
    // extra draws. Fair complete-host construction is independently timed;
    // the strict full 12k/900KB GPU ceilings below are unchanged.
    assert.ok(result.commands.length<=240,`${slug} has excessive temporary geometry`);
  }
});

test('actual complete material-batched globes still fit the original strict GPU budgets',()=>{
  for(const slug of models.keys()){
    const root=buildAchievementExhibit(slug);let triangles=0,bytes=0,draws=0;
    root.traverse(object=>{
      if(!object.isMesh)return;
      draws++;
      triangles+=(object.geometry.index?.count??object.geometry.attributes.position.count)/3*(object.isInstancedMesh?object.count:1);
      for(const attribute of Object.values(object.geometry.attributes))bytes+=attribute.array.byteLength;
      if(object.geometry.index)bytes+=object.geometry.index.array.byteLength;
      if(object.instanceMatrix)bytes+=object.instanceMatrix.array.byteLength;
    });
    assert.ok(triangles<12_000,`${slug}: complete ${triangles} triangles`);
    assert.ok(bytes<900_000,`${slug}: complete ${bytes} geometry bytes`);
    assert.ok(draws<=10,`${slug}: complete ${draws} material draw calls`);
    assert.equal(root.userData.triangles,triangles);
    disposeAchievementScene(root);assert.equal(root.children.length,0);
  }
});

test('real primitive geometry fits the central 12 × 8 m plinth, leaving authored signs clear',()=>{
  for(const [slug,{bounds}] of models){
    assert.ok(bounds.min.x>=-6.001&&bounds.max.x<=6.001,`${slug} crosses the side sign approach: ${bounds.min.x},${bounds.max.x}`);
    assert.ok(bounds.min.z>=-4.001&&bounds.max.z<=4.001,`${slug} crosses the front/back sign approach: ${bounds.min.z},${bounds.max.z}`);
    assert.ok(bounds.min.y>=.69&&bounds.max.y<6,`${slug} intersects terrain or obscures shelter`);
    assert.ok(models.get(slug).maxLiftedRadius<CAPSULE_LAYOUT.radius-.3,`${slug} crosses the actual orb after the demonstration lift`);
  }
});

test('all richer demonstration triangles leave both actual interior sign boards clear in the arrival view',()=>{
  // Independent exact triangle/box SAT test, not a bounding-circle guess.
  // Board orientation matches the actual camera-facing YXZ arrival rotation.
  const board=new THREE.Box3(new THREE.Vector3(-1.71,-.985,-.065),new THREE.Vector3(1.71,.985,.065));
  const triangle=new THREE.Triangle();
  const transforms=CAPSULE_SIGN_POSITIONS.map(position=>{
    const head=new THREE.Object3D();head.position.set(...position);head.rotation.order='YXZ';
    head.rotation.y=(42+180)*Math.PI/180;head.rotation.x=-35*Math.PI/180;head.updateMatrix();
    return head.matrix.clone().invert();
  });
  for(const [slug,{triangleVertices:vertices}] of models){
    for(const [index,inverse] of transforms.entries())for(let i=0;i<vertices.length;i+=9){
      triangle.a.fromArray(vertices,i).applyMatrix4(inverse);
      triangle.b.fromArray(vertices,i+3).applyMatrix4(inverse);
      triangle.c.fromArray(vertices,i+6).applyMatrix4(inverse);
      assert.ok(!board.intersectsTriangle(triangle),`${slug} intersects inside sign ${index+1} in the actual arrival view`);
    }
  }
});

test('craft introduces no newly affected camera poses versus the already-rich model baseline',()=>{
  // Immutable pre-craft-pass masks, independently measured with exact host
  // combined matrices on the already-rich demonstrations. Free-rotation sign
  // mount limitations are deliberately preserved, not claimed to be solved.
  // Bit = bearing index * 5 + pitch index for the two ordered arrays below.
  const allowed=Object.freeze({
    'tesla-gigathon-2026':1041219584,
    'hong-kong-talent-engage-eurotech-healthtech-2026':537903104,
    'pdm-kill-the-search-bar-2026':1041203200,
    'real-coin-map-2025':1041203200,
    'ethrome-2025':1040973824,
    'music-ai-osaka-2025':1040973824,
    'tech-berlin-ai-hackathon-2':1041203200,
    'masters-thesis':262144,
    'salzburg-tourism-2024':1041203200,
    'circular-bsh-2024':1041219584,
    'thuega-2024':1040711680,
    'ethmunich-2023':1041203200,
  });
  const bearings=[0,30,42,90,180,270],pitches=[0,30,54,65,90];
  const board=new THREE.Box3(new THREE.Vector3(-1.71,-.985,-.065),new THREE.Vector3(1.71,.985,.065));
  const triangle=new THREE.Triangle();
  const poses=bearings.flatMap((bearing,bearingIndex)=>pitches.map((pitch,pitchIndex)=>({
    bearing,pitch,bit:1<<(bearingIndex*5+pitchIndex),
    inverse:CAPSULE_SIGN_POSITIONS.map(position=>{
      const head=new THREE.Object3D();head.position.set(...position);head.rotation.order='YXZ';
      head.rotation.y=(bearing+180)*Math.PI/180;head.rotation.x=-Math.min(35,Math.max(0,90-pitch))*Math.PI/180;
      head.updateMatrix();return head.matrix.clone().invert();
    }),
  })));
  for(const [slug,{triangleVertices:vertices}] of models)for(const pose of poses){
    let touched=false;
    for(const inverse of pose.inverse){
      for(let i=0;i<vertices.length;i+=9){
        triangle.a.fromArray(vertices,i).applyMatrix4(inverse);
        triangle.b.fromArray(vertices,i+3).applyMatrix4(inverse);
        triangle.c.fromArray(vertices,i+6).applyMatrix4(inverse);
        if(board.intersectsTriangle(triangle)){touched=true;break;}
      }
      if(touched)break;
    }
    assert.ok(!touched||((allowed[slug]??0)&pose.bit),`${slug}: new sign contact at bearing ${pose.bearing}, pitch ${pose.pitch}`);
  }
});

test('Salzburg has a physical EEG headband, recommendation kiosk and tourism miniature',()=>{
  const slug='salzburg-tourism-2024',result=models.get(slug);
  assert.match(sourceText(slug),/Muse 2 headband/);assert.match(sourceText(slug),/recommended travel spot/);
  assert.equal(result.parts.kind,'eeg-tourism');
  assert.deepEqual(result.parts.parts,['EEG headband','recommendation kiosk','tourism route miniature','feature-extraction workbench','five personality feature channels','recommendation pipeline','headband electrode fittings','feature-channel selectors']);
  assert.ok(result.commands.some(cmd=>cmd.name==='ring'&&cmd.material==='metal'&&cmd.args[1]===.76),'Actual headband silhouette');
  assert.ok(result.commands.some(cmd=>cmd.name==='box'&&cmd.material==='signal'&&cmd.args[0][0]===-2.8),'Kiosk screen');
  assert.ok(result.commands.some(cmd=>cmd.name==='cone'&&cmd.material==='stone'),'Tourism mountain model');
  assert.ok(result.commands.some(cmd=>cmd.name==='box'&&cmd.material==='signal'&&cmd.args[1][0]===2.2),'Water/bridge tourism model');
  assert.ok(result.commands.filter(cmd=>cmd.name!=='rod'&&cmd.name!=='sphere').length>40,'Cannot regress to bead graph');
});

test('shared subjects remain visibly different according to the original project descriptions',()=>{
  const groups=[
    ['salzburg-tourism-2024','hackupc-2024','msg-karlsruhe-2023'],
    ['hong-kong-talent-engage-eurotech-healthtech-2026','draeger-2023'],
    ['music-ai-osaka-2025','huawei-agorize-2024'],
    ['sui-hackathon-poland-2025','solana-ideathon-2024','ethmunich-2023'],
    ['zurich-climathon-2024','six-swisshacks-2024','decarbon-days-climathon-2025'],
    ['pdm-kill-the-search-bar-2026','dsag-ideathon-2024'],
  ];
  for(const slugs of groups){
    assert.equal(new Set(slugs.map(slug=>models.get(slug).parts.kind)).size,slugs.length);
    assert.equal(new Set(slugs.map(slug=>JSON.stringify(models.get(slug).commands))).size,slugs.length);
  }
  assert.match(sourceText('sui-hackathon-poland-2025'),/word-joining dApp/);
  assert.ok(models.get('sui-hackathon-poland-2025').parts.parts.includes('word-composition tiles'));
  assert.match(sourceText('hong-kong-talent-engage-eurotech-healthtech-2026'),/conjunctiva images/);
  assert.match(sourceText('draeger-2023'),/sensor readings/);
  assert.match(sourceText('music-ai-osaka-2025'),/equalizer/);
  assert.match(sourceText('huawei-agorize-2024'),/pinna images/);
});

test('master thesis represents offline RL, trajectory encoding and environments, not stale HRTF tags',()=>{
  const result=models.get('masters-thesis');
  assert.match(sourceText('masters-thesis'),/Trajectory Encoding Augmentation/);
  assert.match(sourceText('masters-thesis'),/offline reinforcement learning/);
  assert.equal(result.parts.kind,'trajectory-policy-workbench');
  assert.deepEqual(result.parts.parts,['recorded trajectory display','latent encoder','shared policy','environment test boards','encoder-to-policy transfer bridge','varied-dynamics test mechanisms','mechanism pivot fittings','encoder ventilation fins']);
  assert.ok(!result.commands.some(cmd=>cmd.name==='sphere'||cmd.name==='ring'),'Not a pinna/headband replica');
});

test('all primitive instructions are deterministic, static and usable without optional cone',()=>{
  for(const item of events){
    assert.deepEqual(model(item).commands,models.get(item.slug).commands,`${item.slug} changes between visits`);
    const fallback=model(item,{cone:false});
    assert.ok(fallback.triangles+3000<12000);
    assert.ok(fallback.bounds.min.y>=.69&&fallback.bounds.max.y<6);
    assert.ok(fallback.bounds.min.x>=-6.001&&fallback.bounds.max.x<=6.001);
    assert.ok(fallback.bounds.min.z>=-4.001&&fallback.bounds.max.z<=4.001);
    assert.ok(fallback.maxLiftedRadius<CAPSULE_LAYOUT.radius-.3);
  }
  const source=readFileSync(new URL('../src/achievementExhibits.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|requestAnimationFrame|setInterval|fetch\(|\.load\(|new\s+Image|CanvasTexture|import\s/);
});

test('Tesla is a connected cargo handling system, not a generic car or proprietary factory reconstruction',()=>{
  const slug='tesla-gigathon-2026',result=models.get(slug),commands=result.commands;
  assert.match(sourceText(slug),/supply chain and logistics/);
  assert.match(sourceText(slug),/NDAs/);
  assert.ok(commands.some(cmd=>cmd.name==='box'&&cmd.material==='paper'&&cmd.args[0][1]===4.2&&cmd.args[1][2]===2.82),'Pallet scanning arch');
  assert.ok(commands.some(cmd=>cmd.name==='box'&&cmd.material==='dark'&&cmd.args[0][1]===3.35),'Forklift overhead protection');
  assert.equal(commands.filter(cmd=>cmd.name==='box'&&cmd.args[0][1]===1.82&&cmd.args[1][2]===1.04).length,2,'Two actual raised forks');
  assert.equal(commands.filter(cmd=>cmd.name==='cylinder'&&cmd.args[1]===.32&&cmd.args[2]===.19).length,4,'Four forklift wheels');
  assert.ok(commands.some(cmd=>cmd.name==='box'&&cmd.args[1][0]===2.45&&cmd.args[1][2]===2.25),'Buffer roller bed');
  assert.ok(commands.some(cmd=>cmd.name==='box'&&cmd.args[1][0]===4.8&&cmd.args[1][2]===2.2),'Readable low loading/routing bays');
  assert.ok(commands.filter(cmd=>cmd.name==='box').length>=140,'Integrated visible objects, not tiny bead decoration');
});

test('semiconductor and space demonstrations contain functional machinery and instrument silhouettes',()=>{
  const semiconductor=models.get('zero-one-hack-supercompute-industrial-2026');
  assert.match(sourceText('zero-one-hack-supercompute-industrial-2026'),/synthetic semiconductor fabrication process-sequence data/);
  assert.match(sourceText('zero-one-hack-supercompute-industrial-2026'),/Leonardo supercomputer/);
  assert.equal(semiconductor.commands.filter(cmd=>cmd.name==='cylinder'&&cmd.material==='signal'&&cmd.args[1]===.42).length,5,'Wafer cassette');
  assert.ok(semiconductor.commands.some(cmd=>cmd.name==='box'&&cmd.args[1][0]===2.4&&cmd.args[1][1]===3.35),'HPC rack silhouette');
  const space=models.get('nasa-space-apps-zurich-2025');
  assert.match(sourceText('nasa-space-apps-zurich-2025'),/satellite and geography-based APIs/);
  assert.ok(space.commands.some(cmd=>cmd.name==='cylinder'&&cmd.material==='signal'&&cmd.args[0][2]===-1.65),'Earth-observation optics');
  assert.ok(space.commands.some(cmd=>cmd.name==='box'&&cmd.args[1][0]===4.6&&cmd.args[1][2]===2.5),'Geography tile table');
  assert.ok(space.commands.filter(cmd=>cmd.name==='rod'&&cmd.args[2]===.025).length>=6,'Functional wing/feed trusses');
});

test('coin and gifting detail is richer while functional flat geometry replaces ornamental torus cost',()=>{
  const coin=models.get('real-coin-map-2025');
  assert.match(sourceText('real-coin-map-2025'),/numismatics and archeology/);
  assert.ok(coin.commands.some(cmd=>cmd.name==='box'&&cmd.args[1][0]===4.4&&cmd.args[1][1]===2.4),'Archival drawers');
  assert.equal(coin.commands.filter(cmd=>cmd.name==='box'&&cmd.material==='metal'&&cmd.args[1][0]===.05&&cmd.args[1][2]===.085).length,48,'Visible milled coin edges');
  assert.equal(coin.commands.filter(cmd=>cmd.name==='cylinder'&&cmd.args[1]===.48&&cmd.args[2]===.024).length,6,'Six layered coin rims');
  const gifts=models.get('ethrome-2025');
  assert.match(sourceText('ethrome-2025'),/hiding individual contributions/);
  assert.equal(gifts.commands.filter(cmd=>cmd.name==='box'&&cmd.material==='gold'&&cmd.args[1][1]===.055&&cmd.args[1][2]===.18).length,24,'Folded ribbon loops preserved on parcels');
  assert.equal(gifts.commands.filter(cmd=>cmd.name==='box'&&cmd.material==='dark'&&cmd.args[1][0]===.4&&cmd.args[1][2]===.05).length,4,'Anonymous contribution slots');
});

test('source-specific achievements receive their own meaningful objects rather than invented outcomes',()=>{
  assert.match(sourceText('decarbon-days-climathon-2026'),/ceremonial award cheque/);
  assert.ok(models.get('decarbon-days-climathon-2026').commands.some(cmd=>cmd.name==='box'&&cmd.material==='paper'&&cmd.args[1][0]===3.2&&cmd.args[1][1]===1.28));
  assert.match(sourceText('tgu-perfect-gpa'),/hourglass from the rector/);
  assert.equal(models.get('tgu-perfect-gpa').commands.filter(cmd=>cmd.name==='cone'&&cmd.material==='paper'&&cmd.args[1]===.44).length,2,'Source-backed gifted hourglass');
  assert.match(sourceText('circular-bsh-2024'),/automatically unloading the containers/);
  assert.ok(models.get('circular-bsh-2024').commands.some(cmd=>cmd.name==='box'&&cmd.args[0][1]===5.24),'Appliance unloading gantry');
  assert.match(sourceText('music-ai-osaka-2025'),/x, y, or z axes/);
  assert.ok(models.get('music-ai-osaka-2025').commands.filter(cmd=>cmd.name==='rod'&&cmd.args[2]===.024).length>=3,'Explicit pen tracking axes');
});


test('close-up logistics, wafer tooling and spacecraft craft are physical fitted assemblies',()=>{
  const logistics=models.get('tesla-gigathon-2026').commands;
  assert.equal(logistics.filter(cmd=>cmd.name==='box'&&cmd.material==='dark'&&cmd.args[1][0]===.21&&cmd.args[1][1]===.047&&cmd.args[1][2]===.19).length,24,'Actual tire tread blocks on four wheels');
  assert.equal(logistics.filter(cmd=>cmd.name==='cylinder'&&cmd.material==='metal'&&cmd.args[1]===.045&&cmd.args[2]===1.18).length,2,'Twin hydraulic mast pistons');
  assert.equal(logistics.filter(cmd=>cmd.name==='rod'&&cmd.args[2]===.025&&cmd.args[0][2]===3.91).length,2,'Warehouse rack cross-bracing');
  const wafer=models.get('zero-one-hack-supercompute-industrial-2026').commands;
  assert.equal(wafer.filter(cmd=>cmd.name==='box'&&cmd.material==='metal'&&cmd.args[1][0]===.16&&cmd.args[1][1]===.16&&cmd.args[1][2]===.075).length,4,'Load-lock flange clamps');
  const space=models.get('nasa-space-apps-zurich-2025').commands;
  assert.equal(space.filter(cmd=>cmd.name==='cylinder'&&cmd.material==='gold'&&cmd.args[1]===.1&&cmd.args[2]===.2).length,4,'Panel hinge collars');
  assert.ok(space.some(cmd=>cmd.name==='cylinder'&&cmd.material==='metal'&&cmd.args[1]===.285&&cmd.args[2]===.065),'Layered optical barrel');
  assert.ok(space.filter(cmd=>cmd.name==='box'&&cmd.material==='metal'&&cmd.args[1][0]===1.08*.86&&cmd.args[1][1]===.035).length>=4,'Radiator fin face');
});

test('VR pens have aligned recessed emitters and headsets have adjustable crown straps',()=>{
  for(const [slug,x,y,z,lean] of [['music-ai-osaka-2025',-2.9,3.25,-1.8,.7],['lauzhack-2024',-.9,2.37,-.55,.28]]){
    const commands=models.get(slug).commands;
    const emitters=commands.filter(cmd=>cmd.name==='box'&&cmd.material==='gold'&&cmd.args[1][0]===.047&&cmd.args[1][1]===.048);
    assert.equal(emitters.length,3,`${slug}: three actual infrared windows`);
    for(const [index,t] of [-.25,.05,.25].entries()){
      const [xyz,,rotation]=emitters[index].args;
      assert.deepEqual(xyz,[x-Math.sin(lean)*t,y+Math.cos(lean)*t,z-.082]);
      assert.deepEqual(rotation,[0,0,lean],'Emitter face follows the actual tilted pen axis');
    }
    assert.ok(!commands.some(cmd=>cmd.name==='sphere'&&cmd.material==='gold'&&cmd.args[1][0]===.035),'Floating high-subdivision emitter beads must not return');
    assert.equal(commands.filter(cmd=>cmd.name==='box'&&cmd.material==='metal'&&cmd.args[1][0]===.12&&cmd.args[1][2]===.045).length,10,`${slug}: fitted flat crown strap segments`);
    assert.ok(commands.some(cmd=>cmd.name==='cylinder'&&cmd.material==='metal'&&cmd.args[1]===.068&&cmd.args[2]===.085),'Machined pen collar');
  }
  const music=models.get('music-ai-osaka-2025').commands;
  assert.equal(music.filter(cmd=>cmd.name==='cylinder'&&cmd.material==='metal'&&cmd.args[1]===.115&&cmd.args[2]===.046).length,2,'Both loudspeakers retain actual layered circular diaphragm/dustcap geometry');
});

test('all 32 craft refinements preserve their existing subject/parts and add actual fitted objects',()=>{
  // Immutable already-rich baseline: primitive count, original part count,
  // SHA256 of {kind,parts}. Exact old noun lists remain intact as a prefix;
  // no unrelated project topic/object is silently replaced by this art pass.
  const baseline={
    'tesla-gigathon-2026':[179,8,'bc7eb7c616c61a588143de2e65bb2b2113698f94c5a2c2e915af72132c061caf'],
    'hong-kong-talent-engage-eurotech-healthtech-2026':[88,5,'5a1d514a485de5e82bd47f3654c4de5ddb3e6321a2c82166f71a9089dfe95a6e'],
    'decarbon-days-climathon-2026':[63,5,'9cf2c048573eb2ba16404c05ddd5c4e7c7a950a8929227ba26816ac6794c859d'],
    'pdm-kill-the-search-bar-2026':[138,5,'7c8fc3c7bcd6e783d5c593406329e9840586796b2d3bc6e557997199981c1ca5'],
    'zero-one-hack-supercompute-industrial-2026':[129,6,'634da2db539a0567b208da31c5f21e9c05a6244093fbe90ac2bf6af81c551418'],
    'huawei-tech-arena-finland-2025':[60,5,'69de7f30bb48f4b7e29ec0b82c306305ec50095d9543e917b9844ee10d958463'],
    'real-coin-map-2025':[164,6,'f584df3b41a38682ac8ab11ad7d58258ae6b5d1350cfd993e15941b3da40b7ad'],
    'ethrome-2025':[128,5,'abeadc14a34f4b3956c7ab4af4694801d1e9240055779d959ab03c57d67a2908'],
    'nasa-space-apps-zurich-2025':[113,7,'a530e4148f604c3204566606992e47f0ecb52c4d7c12d0e9c4567897de4cef2d'],
    'sui-hackathon-poland-2025':[104,5,'8583ee2172d7dc688f67ee78fddc75cd406d0d715970614a3aef1223e8fef6c9'],
    'decarbon-days-climathon-2025':[77,5,'79082ea7919ad2f91fd385ae182b07fd8646e96600bebc54577de8cf1970344e'],
    'music-ai-osaka-2025':[81,6,'c5c42fa78e9d910da14bc1dc4c528cde5915db1d67301612773ae1e91a40280d'],
    'european-defense-tech-2025-munich':[61,5,'47f4d4f914cceda1566a49b7e15ac67a4fe1e00e9ba8814eadc605bdd344baef'],
    'tech-berlin-ai-hackathon-2':[104,5,'f7ac8f990718968ae59c8c3ede976ff11ad3f3bbded97b4b2f5606b8d9d396cd'],
    'huawei-agorize-2024':[128,5,'01921fcaf154f8838e0725933f352bf83a5f715c116c50e2f1fd131d35be8def'],
    'masters-thesis':[89,6,'5d9854d30fb65f0047e9862167bfd8f1fc9b203fd7d37a6c7d7d28f124e0069d'],
    'lauzhack-2024':[84,7,'4f8e4a5d33dc41a583dc4711e99770dfe63a5068595a2bbf40d11d06f5ef64be'],
    'salzburg-tourism-2024':[115,6,'714e4df5f28bf9fa0e2711ccd41cf2b64afd569fbc7e38a958bba5654a9f241c'],
    'zurich-climathon-2024':[71,5,'f64070721245bf953db0e836166b47acc013096b17702e09b8e50408820fd246'],
    'bayer-ai-2024':[149,6,'2aacd449451bf5c2305e66ce6cf4e33bd49894d486420e1749e83060dda53c7a'],
    'dsag-ideathon-2024':[121,5,'e6884352cd8a2ae09df82f9abca708c9fd02f024e35c451b414d15bb09918f0b'],
    'circular-bsh-2024':[58,7,'84a30e6b2043b109698de877d3d6618854b8b9981210c7be5dda4e053ea3fe2a'],
    'thuega-2024':[115,7,'9994e43ac881321a913067f8976be2fedd39cc1195b6b49078c025c2e49330b6'],
    'solana-ideathon-2024':[73,5,'89d8c1e4df3d9f37f6a45d6f687aac5cd923fcd0be157b117875b164b162da82'],
    'six-swisshacks-2024':[112,5,'bf82c9adc5e50383f4c5c1bca60a014e5db8b5099888c5f6307a5392e69ea5f9'],
    'hackupc-2024':[103,6,'90e79ae98bab8ea90558f0db428d4ccfb6804d16c378adc9f4e82a0fdf900e97'],
    'mdsi-bundesliga-2024':[76,6,'c17bda9acc7373306bd3ae07fb568ae4897792a29991c55ceaf3860c4eb3c844'],
    'draeger-2023':[134,6,'81f0af1f8d31c3a86940539f1f9ee65d12b6cf9df716fc24c392024eec8633f5'],
    'ethmunich-2023':[64,5,'53cf8dc8f553291a2e24eb61d17e6aac424b37b2873ca5f92e1b097b357a958d'],
    'msg-karlsruhe-2023':[94,6,'0074c8c14e8b48c29170b2342806f65fbec229a3f26a7fcdc3035d90c0872e2a'],
    'bachelors-thesis':[71,6,'eb6240366c7e6e794eb89f2f2eb94084578ed3ae4592ebd0377f78c189523511'],
    'tgu-perfect-gpa':[52,5,'565e334369c02bbebc0912367ede591f25a7d7f78d9cf334ec14d817e514be9a'],
  };
  for(const [slug,result] of models){
    const [primitiveCount,partCount,hash]=baseline[slug];
    const preserved={kind:result.parts.kind,parts:result.parts.parts.slice(0,partCount)};
    assert.equal(createHash('sha256').update(JSON.stringify(preserved)).digest('hex'),hash,`${slug}: existing meaningful components must remain unchanged`);
    assert.ok(result.parts.parts.length>=partCount+2,`${slug}: craft metadata must describe implemented refinements`);
    assert.ok(result.commands.length>=primitiveCount+12,`${slug}: fitted craft must actually be drawn`);
  }
});

test('unknown future subjects preserve the host fallback without partially drawing',()=>{
  const result=record();assert.equal(buildDetailedExhibit('future-new-subject',result.p),false);
  assert.equal(result.commands.length,0);
  assert.throws(()=>buildDetailedExhibit('globe',{}),/needs primitive box/);
});
