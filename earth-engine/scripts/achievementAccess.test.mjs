import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import * as THREE from 'three';
import {CAPSULE_LAYOUT,CAPSULE_SCALE} from '../src/achievementCapsule.js';
import {CAPSULE_ACCESS_LIMITS,planCapsuleAccessFoot,resolveCapsuleAccess,createCapsuleAccess} from '../src/achievementAccess.js';
import {selectExhibitRoof,pointInFootprint,disposeAchievementScene} from '../src/achievementSceneLayer.js';

const context=JSON.parse(readFileSync(new URL('../public/data/achievement-context-v2.json',import.meta.url)));
const rectangle=(minX,minZ,maxX,maxZ)=>[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]];
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} does not match ${b}`);
const distanceToRing=(point,ring)=>{
  if(pointInFootprint(point,ring))return 0;
  return Math.min(...ring.map((a,i)=>{
    const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],l2=dx*dx+dz*dz;
    const t=l2===0?0:Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dz)/l2));
    return Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dz*t);
  }));
};
function transformedInstanceBounds(mesh,index) {
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);
  return mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
}
function release(mesh) {
  const group=new THREE.Group();group.add(mesh);disposeAchievementScene(group);return group;
}

test('the default access keeps a short approach when its complete landing is already outside the host',()=>{
  const site=[10,20],hostRing=rectangle(-10,-10,30,30),before=structuredClone({site,hostRing});
  const plan=planCapsuleAccessFoot({hostRing,site});
  assert.deepEqual(plan.footM,[10,20+CAPSULE_LAYOUT.ladderBottom[2]*CAPSULE_SCALE]);
  near(plan.bridgeLengthM,15.8);assert.deepEqual(plan.direction,[0,-1]);
  assert.deepEqual({site,hostRing},before);assert.equal(plan.illustrative,true);
  assert.ok(Object.isFrozen(plan)&&Object.isFrozen(plan.footM)&&plan.railFootM.every(Object.isFrozen));
  assert.ok(distanceToRing(plan.footM,hostRing)>plan.clearanceM);
});

test('large roofs move the entire exterior foot beyond the actual forward wall, not a roof-relative rung gap',()=>{
  const hostRing=rectangle(-100,-100,100,100),plan=planCapsuleAccessFoot({hostRing});
  assert.deepEqual(plan.footM,[0,-104.025]);assert.ok(plan.bridgeLengthM>60);
  assert.ok(distanceToRing(plan.footM,hostRing)>4);
  for(const foot of plan.railFootM)assert.ok(!pointInFootprint(foot,hostRing));
  const concave=[[-100,-120],[-5,-120],[-5,-50],[5,-50],[5,-120],[100,-120],[100,100],[-100,100]];
  const clearNotch=planCapsuleAccessFoot({hostRing:concave});
  near(clearNotch.bridgeLengthM,15.8);assert.deepEqual(clearNotch.footM,[0,-57.6]);
  assert.ok(distanceToRing(clearNotch.footM,concave)>4,'the real concave gap stays available instead of an expanded bounding box');
});

test('a nearby footprint chooses a shorter clear forward-side route deterministically',()=>{
  const hostRing=rectangle(-10,-10,10,10),obstacle={ring:rectangle(-4,-90,4,-50)};
  const plan=planCapsuleAccessFoot({hostRing,nearbyBuildings:[obstacle]});
  assert.ok(Math.abs(plan.footM[0])>4,'avoid the known building below the access');
  assert.ok(plan.footM[1]<-41.8);near(plan.bridgeLengthM,15.8);
  assert.ok(distanceToRing(plan.footM,obstacle.ring)>4);
  const others=[obstacle,{ring:rectangle(100,-90,110,-80)},{ring:rectangle(-110,-90,-100,-80)}];
  assert.deepEqual(planCapsuleAccessFoot({hostRing,nearbyBuildings:others}),
    planCapsuleAccessFoot({hostRing,nearbyBuildings:[...others].reverse()}));
});

test('all 30 actual longest-roof contexts provide a fully clear, finite and nearby exterior footprint',()=>{
  const before=JSON.stringify(context),rows=[];
  for(const chapter of context.chapters) {
    const host=selectExhibitRoof(chapter),plan=planCapsuleAccessFoot({hostRing:host.building.ring,site:host.site,nearbyBuildings:chapter.buildings});
    assert.deepEqual(plan,planCapsuleAccessFoot({hostRing:host.building.ring,site:host.site,nearbyBuildings:chapter.buildings}));
    assert.equal(plan.knownFootprints,chapter.buildings.length,'do not double-count the host supplied in the nearby list');
    assert.ok(plan.bridgeLengthM>=15.8-1e-6&&plan.bridgeLengthM<50,`${chapter.slugs[0]}: unnecessarily long approach`);
    for(const building of chapter.buildings) {
      assert.ok(distanceToRing(plan.footM,building.ring)>=plan.clearanceM-1e-6,`${chapter.slugs[0]}: access centre lacks full-footprint clearance from${building.id}`);
      for(const foot of plan.railFootM)assert.ok(!pointInFootprint(foot,building.ring));
    }
    const layout=resolveCapsuleAccess({roofBaseM:host.building.height+.15,groundFootDeltaM:0,footOffsetM:plan.footOffsetM});
    const access=createCapsuleAccess(layout);rows.push({roof:host.building.height,triangles:access.userData.access.triangles});release(access);
  }
  assert.equal(JSON.stringify(context),before,'never modify mapped footprints or the roof selection to fit access');
  assert.equal(Math.max(...rows.map(row=>row.roof)),90,'test the actual tallest selected roof, not the tallest unrelated tower');
  assert.equal(Math.max(...rows.map(row=>row.triangles)),1488,'complete actual access stays below its explicit1800triangle ceiling');
});

test('world-ground samples reach exact centre and individual shoe heights across roofs and terrain slopes',()=>{
  for(const roofBaseM of [0,9.15,13.15,90.15,400.15])for(const groundFootDeltaM of [-120,-2.8,0,6,32]) {
    const samples=[groundFootDeltaM-.42,groundFootDeltaM+.31];
    const layout=resolveCapsuleAccess({roofBaseM,groundFootDeltaM,groundRailDeltasM:samples,footOffsetM:[-20,-70]});
    assert.equal(layout.shoeGroundBasis,'individual-terrain-samples');
    assert.deepEqual(layout.entry,CAPSULE_LAYOUT.ladderTop,'join the actual original portal point');
    near(roofBaseM+layout.foot[1]*CAPSULE_SCALE,groundFootDeltaM);
    layout.railFeet.forEach((foot,i)=>near(roofBaseM+foot[1]*CAPSULE_SCALE,samples[i]));
    assert.ok(layout.bridgeStart[1]>=CAPSULE_LAYOUT.floorY,'the bridge cannot descend through the host roof');
    near(layout.bridgeStart[1],layout.landing[1]);
    assert.ok(layout.rungCount<=CAPSULE_ACCESS_LIMITS.maxRungs);
    const access=createCapsuleAccess(layout),shoes=access.userData.access.components.flatMap((role,index)=>role==='ground-shoe'?[index]:[]);
    assert.equal(shoes.length,2);
    shoes.forEach((index,i)=>near(roofBaseM+transformedInstanceBounds(access,index).min.y*CAPSULE_SCALE,samples[i],.0001));
    assert.ok(Object.isFrozen(layout)&&Object.isFrozen(layout.legs)&&layout.legs.every(Object.isFrozen));
    const bounds=access.boundingBox;
    for(const axis of ['x','y','z']) {
      const i=['x','y','z'].indexOf(axis);assert.ok(bounds.min[axis]>=layout.extents.min[i]-1e-5);assert.ok(bounds.max[axis]<=layout.extents.max[i]+1e-5);
    }
    release(access);
  }
});

test('a steep hillside raises the bridge and connects the original portal without changing the true ground sample',()=>{
  const layout=resolveCapsuleAccess({roofBaseM:13.15,groundFootDeltaM:80,groundRailDeltasM:[79,82],footOffsetM:[0,-70]});
  assert.equal(layout.terrainAbovePortal,true);assert.equal(layout.legs.length,2);
  assert.deepEqual(layout.legs[1].from,CAPSULE_LAYOUT.ladderTop);
  near(layout.roofBaseM+layout.landing[1]*layout.scale,82.6);
  near(layout.roofBaseM+layout.foot[1]*layout.scale,80);
  const mesh=createCapsuleAccess(layout);assert.ok(mesh.userData.access.components.includes('portal-rise-rung'));
  assert.ok(mesh.userData.access.components.includes('exterior-rung'));release(mesh);
});

test('extreme heights, slopes and long bridges keep exact endpoints and fixed bounded GPU resources',()=>{
  for(const options of [
    {roofBaseM:400,groundFootDeltaM:-500,footOffsetM:[-100,-1000]},
    {roofBaseM:20_000,groundFootDeltaM:-20_000,groundRailDeltasM:[-20_000,-19_998],footOffsetM:[50_000,-100_000]},
    {roofBaseM:-20_000,groundFootDeltaM:20_000,groundRailDeltasM:[19_997,20_000],footOffsetM:[-50_000,-100_000]},
  ]) {
    const layout=resolveCapsuleAccess(options),mesh=createCapsuleAccess(layout),stats=mesh.userData.access;
    assert.equal(layout.rungCount,96);assert.ok(layout.rungSpacingM>1);
    near(layout.roofBaseM+layout.foot[1]*layout.scale,options.groundFootDeltaM);
    assert.equal(stats.draws,1);assert.ok(stats.instances<=150);assert.ok(stats.triangles<=1800);assert.ok(stats.bytes<14_000);
    assert.equal(stats.triangles,mesh.count*12);assert.equal(mesh.material.map,null);
    assert.equal(mesh.material.transparent,false);assert.equal(mesh.children.length,0);
    assert.ok([...mesh.instanceMatrix.array,...mesh.instanceColor.array].every(Number.isFinite));
    assert.ok(mesh.boundingBox.min.toArray().every(Number.isFinite)&&mesh.boundingBox.max.toArray().every(Number.isFinite));
    release(mesh);
  }
});

test('repeated visits are deterministic and the existing scene disposer releases instance, geometry and material ownership once',()=>{
  const layout=resolveCapsuleAccess({roofBaseM:13.15,groundFootDeltaM:-.4,footOffsetM:[12,-65]});
  assert.equal(layout.shoeGroundBasis,'centre-terrain-plane');
  const first=createCapsuleAccess(layout),second=createCapsuleAccess(layout);
  assert.deepEqual([...first.instanceMatrix.array],[...second.instanceMatrix.array]);
  assert.deepEqual([...first.instanceColor.array],[...second.instanceColor.array]);assert.deepEqual(first.userData.access,second.userData.access);
  let geometryDisposals=0,materialDisposals=0,instanceDisposals=0;
  first.geometry.addEventListener('dispose',()=>geometryDisposals++);first.material.addEventListener('dispose',()=>materialDisposals++);
  first.addEventListener('dispose',()=>instanceDisposals++);
  const group=release(first);disposeAchievementScene(group);
  assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(instanceDisposals,1);assert.equal(group.children.length,0);release(second);
  const source=readFileSync(new URL('../src/achievementAccess.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/Math\.random|requestAnimationFrame|setInterval|fetch\(|\.load\(|new\s+Image|CanvasTexture|WebGLRenderTarget/);
});

test('malformed survey/terrain inputs are rejected instead of silently inventing a ground height or runaway geometry',()=>{
  for(const options of [{},{roofBaseM:13},{roofBaseM:13,groundFootDeltaM:Infinity},{roofBaseM:Infinity,groundFootDeltaM:0},
    {roofBaseM:13,groundFootDeltaM:0,groundRailDeltasM:[0,NaN]},{roofBaseM:13,groundFootDeltaM:0,footOffsetM:[0,0]},
    {roofBaseM:13,groundFootDeltaM:0,scale:0}])assert.throws(()=>resolveCapsuleAccess(options),TypeError);
  assert.throws(()=>planCapsuleAccessFoot({hostRing:[[0,0],[NaN,0],[1,1]]}),/footprint/);
  assert.throws(()=>planCapsuleAccessFoot({nearbyBuildings:Array(257).fill({ring:rectangle(0,0,1,1)})}),/building budget/);
  assert.throws(()=>planCapsuleAccessFoot({clearanceM:.1}),/clearance/);
  assert.throws(()=>createCapsuleAccess(null),/resolved/);
});
