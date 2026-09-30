import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildDetailedExhibit, EXHIBIT_MODELS} from '../src/achievementExhibits.js';
import {ACHIEVEMENT_SCENE_SUBJECTS} from '../src/achievementSceneData.js';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';

const palette = new Set(['stone','edge','metal','dark','gold','glass','leaf','bark','paper','signal','blue','brick','red']);
const events = contestsAndActivities.filter(project=>ACHIEVEMENT_SCENE_SUBJECTS[project.slug]);

/** Same primitive geometries and transform order as the host; no WebGL needed. */
function record({cone=true}={}) {
  const commands=[],bounds=new THREE.Box3(),materials=new Set();
  let triangles=0,positionNormalBytes=0;
  function submit(name,material,args,geometry,xyz,scale=[1,1,1],rotation) {
    assert.ok(palette.has(material),`Unknown host material ${material}`);
    assert.ok(xyz.every(Number.isFinite));assert.ok(scale.every(value=>Number.isFinite(value)&&value>0));
    if(rotation)assert.ok(rotation.every(Number.isFinite));
    commands.push({name,material,args:structuredClone(args)});materials.add(material);
    geometry.scale(...scale);
    if(rotation)geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    geometry.translate(...xyz);geometry.computeBoundingBox();bounds.union(geometry.boundingBox);
    const count=geometry.index?.count??geometry.attributes.position.count;
    triangles+=count/3;positionNormalBytes+=count*3*2*4;
    for(const attribute of [geometry.attributes.position,geometry.attributes.normal])assert.ok([...attribute.array].every(Number.isFinite));
    geometry.dispose();
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
  return {p,commands,bounds,materials,get triangles(){return triangles;},get bytes(){return positionNormalBytes;}};
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
    assert.ok(result.parts.parts.length>=3);
    assert.ok(result.commands.length>=20,`${item.slug} is not just a stand-alone token`);
    assert.ok(result.commands.filter(cmd=>cmd.name==='box').length>=10,`${item.slug} needs recognizable object surfaces`);
  }
});

test('every complete court stays below its actual triangle, memory and material budgets',()=>{
  for(const [slug,result] of models){
    // Court/slats/planters + four instanced trees cost about 1,800 triangles;
    // reserve 3,000 for complete court and signs, not just the primary props.
    assert.ok(result.triangles+3000<12000,`${slug}: ${result.triangles} + court reserve`);
    assert.ok(result.bytes<500_000,`${slug}: ${result.bytes} flattened position/normal bytes`);
    const hostMaterials=new Set(['stone','edge','metal','dark',...result.materials]);
    assert.ok(hostMaterials.size+2<=10,`${slug} exceeds ten base-material/tree draw calls`);
    assert.ok(result.commands.length<=150,`${slug} has excessive temporary geometry`);
  }
});

test('real primitive geometry fits the central 12 × 8 m plinth, leaving authored signs clear',()=>{
  for(const [slug,{bounds}] of models){
    assert.ok(bounds.min.x>=-6.001&&bounds.max.x<=6.001,`${slug} crosses the side sign approach: ${bounds.min.x},${bounds.max.x}`);
    assert.ok(bounds.min.z>=-4.001&&bounds.max.z<=4.001,`${slug} crosses the front/back sign approach: ${bounds.min.z},${bounds.max.z}`);
    assert.ok(bounds.min.y>=.69&&bounds.max.y<6,`${slug} intersects terrain or obscures shelter`);
  }
});

test('Salzburg has a physical EEG headband, recommendation kiosk and tourism miniature',()=>{
  const slug='salzburg-tourism-2024',result=models.get(slug);
  assert.match(sourceText(slug),/Muse 2 headband/);assert.match(sourceText(slug),/recommended travel spot/);
  assert.equal(result.parts.kind,'eeg-tourism');
  assert.deepEqual(result.parts.parts,['EEG headband','recommendation kiosk','tourism route miniature']);
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
  assert.deepEqual(result.parts.parts,['recorded trajectory display','latent encoder','shared policy','environment test boards']);
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
  }
  const source=readFileSync(new URL('../src/achievementExhibits.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|requestAnimationFrame|setInterval|fetch\(|\.load\(|new\s+Image|CanvasTexture|import\s/);
});

test('unknown future subjects preserve the host fallback without partially drawing',()=>{
  const result=record();assert.equal(buildDetailedExhibit('future-new-subject',result.p),false);
  assert.equal(result.commands.length,0);
  assert.throws(()=>buildDetailedExhibit('globe',{}),/needs primitive box/);
});
