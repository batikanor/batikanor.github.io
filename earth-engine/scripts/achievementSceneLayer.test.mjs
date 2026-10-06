import assert from 'node:assert/strict';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync, gzipSync} from 'node:zlib';
import {test} from 'node:test';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {ACHIEVEMENT_SCENE_SUBJECTS, ACHIEVEMENT_SCENE_CREDIT} from '../src/achievementSceneData.js';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {authoredSignProse} from '../src/achievementSigns.js';
import {CAPSULE_LAYOUT,CAPSULE_SCALE,CAPSULE_SIGN_POSITIONS} from '../src/achievementCapsule.js';
import {validateAchievementContext,pointInFootprint,footprintIntersectsExhibit,chooseExhibitSite,
  footprintPlanarDiameter,footprintInteriorAnchor,selectExhibitRoof,
  buildAchievementExhibit,buildAchievementGeography,disposeAchievementScene,
  validateAchievementRoofImagery,achievementRoofUv,
  createAchievementSceneLayer} from '../src/achievementSceneLayer.js';

const achievements=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url)));
const contextBytes=readFileSync(new URL('../public/data/achievement-context-v2.json',import.meta.url));
const context=JSON.parse(contextBytes);
const subjects=Object.keys(ACHIEVEMENT_SCENE_SUBJECTS);

function rendererFixture(){return {renders:0,disposals:0,resetState(){},render(){this.renders++;},dispose(){this.disposals++;}};}
function mapFixture(){return {repaints:0,zoom:17,center:achievements[0].coordinates,
  triggerRepaint(){this.repaints++;},getZoom(){return this.zoom;},
  getCenter(){return this.center;},queryTerrainElevation(){return 7;}};}
function roofImageryFixture(origin=achievements[0].coordinates) {
  const lnglat=Array.isArray(origin)?origin:[origin.lng,origin.lat];
  const anchor=maplibregl.MercatorCoordinate.fromLngLat(lnglat),scale=anchor.meterInMercatorCoordinateUnits();
  const coordinate=(east,north)=>{const p=new maplibregl.MercatorCoordinate(anchor.x+east*scale,anchor.y-north*scale).toLngLat();return [p.lng,p.lat];};
  return {image:{width:2048,height:2048,closes:0,close(){this.closes++;}},metadata:{width:2048,height:2048,resolutionM:.3,
    coordinates:[coordinate(-300,300),coordinate(300,300),coordinate(300,-300),coordinate(-300,-300)],
    source:{url:'https://example.gov/actual-orthophoto',license:'Open official aerial imagery',attribution:'Official aerial photograph · test fixture'}}};
}
function geometryStats(root){let triangles=0,bytes=0,draws=0;
  root.traverse(object=>{
    if(!object.isMesh)return;
    draws++;
    triangles+=(object.geometry.index?.count ?? object.geometry.getAttribute('position').count)/3*(object.isInstancedMesh?object.count:1);
    for(const attribute of Object.values(object.geometry.attributes))bytes+=attribute.array.byteLength;
    if(object.geometry.index)bytes+=object.geometry.index.array.byteLength;
    if(object.instanceMatrix)bytes+=object.instanceMatrix.array.byteLength;
  });return {triangles,bytes,draws};}

test('every actual achievement has an authored factual topic, without generated names',()=>{
  assert.equal(achievements.length,32);
  assert.deepEqual(subjects.toSorted(),achievements.map(event=>event.slug).toSorted());
  for(const descriptor of Object.values(ACHIEVEMENT_SCENE_SUBJECTS)){
    assert.equal(typeof descriptor.subject,'string');assert.equal(typeof descriptor.label,'string');
    assert.ok(!/breaker|dream|future|journey|quest|portal|odyssey/i.test(descriptor.label));
  }
  assert.match(ACHIEVEMENT_SCENE_CREDIT,/illustrative/);
  assert.match(ACHIEVEMENT_SCENE_CREDIT,/heights estimated/);
});

test('offline context covers all 32 points with actual OSM provenance in 30 coordinate pockets',()=>{
  assert.equal(validateAchievementContext(context,achievements),context);
  assert.equal(context.chapters.length,30);
  assert.equal(context.chapters.flatMap(chapter=>chapter.slugs).length,32);
  assert.ok(context.chapters.every(chapter=>chapter.buildings.length>0));
  assert.equal(context.chapters.reduce((sum,chapter)=>sum+chapter.buildings.length,0),1696);
  assert.equal(context.chapters.reduce((sum,chapter)=>sum+chapter.trees.length,0),1235);
  assert.ok(contextBytes.byteLength<600_000);
  assert.ok(gzipSync(contextBytes).byteLength<170_000);
});

test('all 30 data sources are pinned reproducible ODbL response snapshots',()=>{
  const sources=new URL('../design/sources/achievement-context/',import.meta.url);
  const pinnedNames=readdirSync(sources).filter(name=>name.endsWith('.osm.gz'));
  assert.equal(new Set(context.chapters.map(chapter=>chapter.source.snapshot)).size,30);
  for(const chapter of context.chapters){
    const raw=gunzipSync(readFileSync(new URL(chapter.source.snapshot,sources)));
    assert.ok(pinnedNames.includes(chapter.source.snapshot));
    assert.equal(createHash('sha256').update(raw).digest('hex'),chapter.source.sha256);
    assert.match(raw.toString(),/copyright="OpenStreetMap and contributors"/);
    const bounds=raw.toString().match(/<bounds\b([^>]+)>/)[1];
    const actual=['minlon','minlat','maxlon','maxlat'].map(key=>Number(bounds.match(new RegExp(`${key}="([^"]+)"`))[1]));
    actual.forEach((value,index)=>assert.ok(Math.abs(value-chapter.bbox[index])<1e-7,'Cached geography must match the requested venue bbox'));
    for(const building of chapter.buildings)assert.ok(raw.includes(Buffer.from(`<way id="${building.id}"`)));
  }
});

test('Hong Kong real venue context includes Revenue Tower rather than the obsolete hillside crop',()=>{
  const chapter=context.chapters.find(chapter=>chapter.slugs.includes('hong-kong-talent-engage-eurotech-healthtech-2026'));
  assert.deepEqual(chapter.origin,[114.1718383764,22.2796020939]);
  assert.equal(chapter.buildings.length,78);assert.equal(chapter.trees.length,13);
  const venue=chapter.buildings.find(building=>building.id===27087037);
  assert.ok(venue,'Actual named Revenue Tower footprint is included');
  assert.equal(venue.height,180);assert.equal(venue.basis,'osm-height');
  assert.equal(chapter.source.sha256,'a696616be9fded37c118065e104dafcf43caa5254d67ac89f3449b620f405a59');
});

test('v2 corrects only Hong Kong while the immutable v1 response remains compatible with previously cached JavaScript',()=>{
  const legacyBytes=readFileSync(new URL('../public/data/achievement-context-v1.json',import.meta.url));
  assert.equal(createHash('sha256').update(legacyBytes).digest('hex'),'0de40738708627c3aecda3da3c90b3bd2c79cd3c32c1dc9248f99a915fd4dbf4');
  const legacy=JSON.parse(legacyBytes),slug='hong-kong-talent-engage-eurotech-healthtech-2026';
  const oldAchievements=structuredClone(achievements);
  oldAchievements.find(event=>event.slug===slug).coordinates={lng:114.1698,lat:22.2745};
  assert.equal(validateAchievementContext(legacy,oldAchievements),legacy);
  legacy.chapters.forEach((chapter,index)=>{
    if(!chapter.slugs.includes(slug))assert.deepEqual(context.chapters[index],chapter,'Unrelated pinned geographic pockets are unchanged');
  });
});

test('context validator refuses incomplete coverage, fabricated origins, malformed rings and unproven heights',()=>{
  const mutate=fn=>{const data=structuredClone(context);fn(data);return data;};
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters.pop()),achievements),/cover/);
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].origin[0]+=.01),achievements),/actual event/);
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].buildings[0].ring[0][0]=261),achievements),/footprint/);
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].buildings[0].ring=[[0,0],[1,0],[2,0]]),achievements),/degenerate OSM footprint/);
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].buildings[0].height=Infinity),achievements),/height/);
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].source.sha256='unverified'),achievements),/provenance/);
});

test('longest-roof selection uses true planar span, preserves mapped data and anchors inside concave footprints',()=>{
  const square=[[-15,-15],[15,-15],[15,15],[-15,15]];
  assert.equal(pointInFootprint([0,0],square),true);assert.equal(pointInFootprint([30,0],square),false);
  const narrow=[[-25,-.5],[25,-.5],[25,.5],[-25,.5]];
  const chapter={buildings:[{id:2,height:200,ring:square},{id:8,height:4,ring:narrow},{id:3,height:7,ring:[...narrow].reverse()}]};
  const before=structuredClone(chapter),roof=selectExhibitRoof(chapter);
  assert.equal(roof.building.id,3,'the longest footprint wins regardless of taller/larger competitors; ties use stable OSM ids');
  assert.ok(Math.abs(roof.lengthM-Math.sqrt(2501))<1e-12);assert.ok(pointInFootprint(roof.site,roof.building.ring));
  assert.equal(selectExhibitRoof({buildings:[...chapter.buildings].reverse()}).building.id,3);
  assert.deepEqual(chooseExhibitSite(chapter),roof.site);assert.deepEqual(chapter,before);
  assert.equal(selectExhibitRoof(null),null);assert.equal(selectExhibitRoof({buildings:[]}),null);
  assert.deepEqual(chooseExhibitSite(null),[0,0],'missing data cannot fabricate a roof or camera-facing offset');
  const concave=[[-5,-5],[5,-5],[5,5],[2,5],[2,-2],[-2,-2],[-2,5],[-5,5]];
  assert.ok(!pointInFootprint([0,0],concave),'bounding-box centre is outside this real roof shape');
  assert.ok(pointInFootprint(footprintInteriorAnchor(concave),concave),'triangulated fallback must sit in the actual roof');
  assert.equal(footprintPlanarDiameter([[0,0],[0,0],[3,0],[1,0]]),3,'closed/collinear source vertices have an exact span');
  assert.equal(footprintIntersectsExhibit([0,0],[[-100,-1],[100,-1],[100,1],[-100,1]]),true,'narrow crossing building');
  assert.equal(footprintIntersectsExhibit([0,0],[[-1,-1],[1,-1],[1,1],[-1,1]]),true,'building wholly contained by court');
});

test('all pinned footprint diameters match independent exhaustive distances and each zone picks its longest real roof',()=>{
  for(const chapter of context.chapters){
    let maximum=0;
    for(const building of chapter.buildings){
      let squared=0;
      for(let i=0;i<building.ring.length;i++)for(let j=i+1;j<building.ring.length;j++){
        squared=Math.max(squared,(building.ring[i][0]-building.ring[j][0])**2+(building.ring[i][1]-building.ring[j][1])**2);
      }
      const expected=Math.sqrt(squared),actual=footprintPlanarDiameter(building.ring);
      assert.ok(Math.abs(actual-expected)<1e-8,`${building.id}: calipers must measure the real planar diameter`);
      maximum=Math.max(maximum,expected);
    }
    const roof=selectExhibitRoof(chapter);
    assert.ok(Math.abs(roof.lengthM-maximum)<1e-8);assert.ok(chapter.buildings.includes(roof.building));
    assert.ok(pointInFootprint(roof.site,roof.building.ring),'the selected anchor must be inside its actual roof footprint');
  }
});

test('all no-network exhibits and actual footprint pockets stay under bounded GPU/draw budgets',()=>{
  let maxTriangles=0,maxBytes=0;
  for(const slug of subjects){
    const scene=buildAchievementExhibit(slug);const stats=geometryStats(scene);
    assert.equal(scene.userData.illustrative,true);assert.equal(scene.userData.subject,ACHIEVEMENT_SCENE_SUBJECTS[slug].subject);
    assert.ok(stats.triangles<12_000,`${slug}: ${stats.triangles} triangles`);
    assert.ok(stats.bytes<900_000,`${slug}: ${stats.bytes} bytes`);
    assert.ok(stats.draws<=10);
    assert.equal(scene.userData.triangles,stats.triangles);
    assert.ok(scene.userData.capsule,`${slug}: missing elevated capsule architecture`);
    const glazing=scene.userData.glazing;
    assert.ok(glazing?.isMesh&&glazing.material.isShaderMaterial,`${slug}: missing actual transparent capsule glazing`);
    assert.equal(glazing.parent,scene);assert.equal(glazing.material.transparent,true);
    assert.equal(glazing.material.depthWrite,false);
    let authoredTrees=0;
    scene.traverse(object=>{if(object.isInstancedMesh&&object.userData.authored)authoredTrees++;});
    assert.equal(authoredTrees,0,'exhibits must not return to the same four decorative trees');
    assert.equal(scene.userData.treeTriangles??0,0);
    assert.deepEqual(scene.scale.toArray(),[4,4,4],'all authored architecture/props are fourfold; no geometry/network quality reduction');
    maxTriangles=Math.max(maxTriangles,stats.triangles);maxBytes=Math.max(maxBytes,stats.bytes);
    disposeAchievementScene(scene);assert.equal(scene.children.length,0);
  }
  for(const chapter of context.chapters){
    const scene=buildAchievementGeography(chapter),stats=geometryStats(scene);
    assert.deepEqual(scene.scale.toArray(),[1,1,1],'actual mapped OSM geography must never inherit exhibit scaling');
    assert.ok(stats.draws<=4);assert.ok(scene.userData.triangles<26_000);
    assert.equal(scene.userData.triangles,stats.triangles);
    const mappedTrees=scene.children.filter(object=>object.isInstancedMesh),treeCount=Math.min(chapter.trees.length,70);
    assert.equal(mappedTrees.length,treeCount?2:0,'real mapped trees must not disappear with the decorative tree removal');
    if(treeCount){assert.equal(mappedTrees[0].count,treeCount);assert.equal(mappedTrees[1].count,treeCount*3);}
    assert.ok(mappedTrees.every(object=>object.userData.authored===false));
    assert.ok(stats.bytes<1_000_000);disposeAchievementScene(scene);
  }
  assert.ok(maxTriangles>3000);assert.ok(maxBytes>100_000);
});

test('every project keeps its elevated capsule and demonstration in surveyed compact mode',()=>{
  for(const slug of subjects){
    const scene=buildAchievementExhibit(slug,{compact:true}),stats=geometryStats(scene);
    assert.equal(scene.userData.compact,true);assert.equal(scene.userData.illustrative,true);
    assert.equal(scene.userData.subject,ACHIEVEMENT_SCENE_SUBJECTS[slug].subject);
    assert.ok(scene.userData.capsule,`${slug}: surveyed context must not remove the capsule`);
    assert.ok(scene.userData.glazing?.isMesh,`${slug}: compact capsule is not glazed`);
    assert.equal(scene.userData.glazing.material.transparent,true);assert.equal(scene.userData.glazing.material.depthWrite,false);
    assert.ok(scene.userData.capsule.layout.floorY>=5);assert.ok(scene.userData.capsule.layout.demonstrationLift>0);
    assert.ok(stats.triangles<12_000,`${slug}: ${stats.triangles} compact triangles`);
    assert.ok(stats.bytes<900_000,`${slug}: ${stats.bytes} compact geometry bytes`);
    assert.ok(stats.draws<=10,`${slug}: ${stats.draws} compact material draws`);
    assert.equal(scene.userData.triangles,stats.triangles);
    const bounds=new THREE.Box3().setFromObject(scene);
    assert.ok([bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite));
    assert.ok(bounds.max.y>10,`${slug}: a ground plinth is not an elevated glass globe`);
    disposeAchievementScene(scene);assert.equal(scene.children.length,0);
  }
});

test('disposal releases geometry, every shared/unused material and instance buffers exactly once',()=>{
  const root=buildAchievementExhibit('bayer-ai-2024');const geometries=new Set(),materials=new Set(root.userData.materials);
  let geometryDisposals=0,materialDisposals=0,instanceDisposals=0,instances=0;
  root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    if(object.material)materials.add(object.material);
    if(object.isInstancedMesh){instances++;object.addEventListener('dispose',()=>instanceDisposals++);}
  });
  for(const geometry of geometries)geometry.addEventListener('dispose',()=>geometryDisposals++);
  for(const material of materials)material.addEventListener('dispose',()=>materialDisposals++);
  disposeAchievementScene(root);
  assert.equal(geometryDisposals,geometries.size);assert.equal(materialDisposals,materials.size);assert.equal(instanceDisposals,instances);
});

test('one active GPU scene only: rapid navigation, official context and city-detail opt-out',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(contextBytes);
  try{
    const renderer=rendererFixture(),map=mapFixture();
    const layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
    layer.setFocus(achievements[0].slug);assert.equal(layer.getStats().ready,false);
    layer.onAdd(map,{});assert.equal(layer.getStats().ready,true);
    await layer.prepareAll();assert.equal(layer.getStats().buildings,8);
    for(const event of achievements){layer.setFocus(event.slug);assert.equal(layer.getStats().activeScenes,1);}
    assert.equal(layer.getStats().eventSlug,'tgu-perfect-gpa');assert.equal(layer.getStats().buildings,24);
    layer.setOfficialContext(true);assert.equal(layer.getStats().buildings,0);assert.equal(layer.getStats().trees,0);
    assert.equal(layer.getStats().ready,true);assert.equal(layer.getStats().surveyedContext,true);
    layer.setEnabled(false);assert.equal(layer.getStats().activeScenes,0);assert.equal(layer.getActiveAttribution(),null);
    layer.setEnabled(true);assert.equal(layer.getStats().activeScenes,1);
    layer.setFocus(null);assert.equal(layer.getStats().activeScenes,0);
    assert.throws(()=>layer.setFocus('made-up-event'),/Unknown/);
    layer.onRemove();assert.equal(renderer.disposals,1);
  }finally{globalThis.fetch=originalFetch;}
});

test('capsule glazing releases exactly once through navigation, surveyed rebuild, opt-out, home and removal',()=>{
  const renderer=rendererFixture(),map=mapFixture();
  const layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
  layer.setFocus(achievements[0].slug);layer.onAdd(map,{});
  function observeGlazing(){
    const root=layer.scene.children.find(object=>object.isGroup);
    const structure=root.children.find(object=>object.userData.capsule);
    const glazing=structure?.userData.glazing;
    assert.ok(glazing?.isMesh,'the active scene must have its own capsule glazing');
    let geometries=0,materials=0;
    glazing.geometry.addEventListener('dispose',()=>geometries++);
    glazing.material.addEventListener('dispose',()=>materials++);
    return ()=>{assert.equal(geometries,1);assert.equal(materials,1);};
  }
  let released=observeGlazing();layer.setFocus(achievements[1].slug);released();
  released=observeGlazing();layer.setOfficialContext(true);released();
  assert.equal(layer.getStats().activeScenes,1);assert.equal(layer.getStats().surveyedContext,true);
  released=observeGlazing();layer.setEnabled(false);released();
  assert.equal(layer.getStats().activeScenes,0);layer.setEnabled(true);
  released=observeGlazing();layer.setFocus(null);released();
  assert.equal(layer.getStats().activeScenes,0);layer.setFocus(achievements[2].slug);
  released=observeGlazing();layer.onRemove();released();
  assert.equal(layer.getStats().activeScenes,0);assert.equal(renderer.disposals,1);
});

test('intro context preparation deduplicates and never uploads inactive scenes',async()=>{
  const originalFetch=globalThis.fetch;let requests=0;
  globalThis.fetch=async()=>{requests++;return new Response(contextBytes);};
  try{
    const layer=createAchievementSceneLayer({achievements});
    assert.deepEqual(await Promise.all([layer.prepareAll(),layer.prepareAll(),layer.prefetch()]),[true,true,true]);
    assert.equal(requests,1);assert.equal(layer.getStats().contextReady,true);assert.equal(layer.getStats().activeScenes,0);
    assert.equal(await layer.prepareAll(),true);assert.equal(requests,1);layer.onRemove();
  }finally{globalThis.fetch=originalFetch;}
});

test('missing or oversized geography never removes the immediate 3D exhibit',async()=>{
  const originalFetch=globalThis.fetch,originalWarn=console.warn;console.warn=()=>{};
  try{
    const renderer=rendererFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
    layer.setFocus(achievements[0].slug);layer.onAdd(mapFixture(),{});
    globalThis.fetch=async()=>new Response(null,{status:404});
    assert.equal(await layer.prepareAll(),false);assert.equal(layer.getStats().ready,true);
    globalThis.fetch=async()=>new Response('{}',{headers:{'Content-Length':'2000000'}});
    assert.equal(await layer.prepareAll(),false);assert.equal(layer.getStats().ready,true);layer.onRemove();
  }finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
});

test('render is on demand: no draws at world view, away from venue, during globe projection or after remove',()=>{
  const renderer=rendererFixture(),map=mapFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
  layer.setFocus(achievements[0].slug);layer.onAdd(map,{});
  const args={defaultProjectionData:{mainMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],projectionTransition:0}};
  layer.render({},args);assert.equal(renderer.renders,1);
  const repaints=map.repaints;layer.render({},args);assert.equal(map.repaints,repaints,'render must not schedule itself');
  map.zoom=12;layer.render({},args);assert.equal(renderer.renders,2);
  map.zoom=17;map.center={lng:0,lat:0};layer.render({},args);assert.equal(renderer.renders,2);
  map.center=achievements[0].coordinates;args.defaultProjectionData.projectionTransition=1;layer.render({},args);assert.equal(renderer.renders,2);
  layer.onRemove();args.defaultProjectionData.projectionTransition=0;layer.render({},args);assert.equal(renderer.renders,2);
});


test('MapLibre handedness keeps roof normals lit without moving source positions',()=>{
  const roofs=buildAchievementGeography(context.chapters[0],{roofImagery:roofImageryFixture(context.chapters[0].origin)});
  const normal=roofs.children.find(object=>object.name==='Source-aligned real aerial roof photographs').geometry.getAttribute('normal');
  for(let i=0;i<normal.count;i++)assert.equal(normal.getY(i),1,'source roof faces must point up');
  disposeAchievementScene(roofs);
  const renderer=rendererFixture(),map=mapFixture();
  const layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
  layer.setFocus(achievements[0].slug);layer.onAdd(map,{});
  const root=layer.scene.children.find(object=>object.isGroup);root.updateMatrixWorld(true);
  assert.equal(root.matrixWorld.determinant(),-1,'Three must see reflected world winding');
  const sky=layer.scene.children.find(object=>object.isHemisphereLight);
  const sun=layer.scene.children.find(object=>object.isDirectionalLight);
  assert.ok(sky.position.y<0 && sun.position.y<0,'lights must reflect with the world basis');
  const args={defaultProjectionData:{mainMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],projectionTransition:0}};
  layer.render({},args);
  const projected=new THREE.Vector4(1,2,3,1).applyMatrix4(root.matrixWorld).applyMatrix4(layer.camera.projectionMatrix);
  const origin=[achievements[0].coordinates.lng,achievements[0].coordinates.lat];
  const merc=maplibregl.MercatorCoordinate.fromLngLat(origin,7+.12),scale=merc.meterInMercatorCoordinateUnits();
  assert.ok(Math.abs(projected.x-(merc.x+scale))<1e-12);
  assert.ok(Math.abs(projected.y-(merc.y-3*scale))<1e-12);
  assert.ok(Math.abs(projected.z-(merc.z+2*scale))<1e-12,'inverse projection reflection must preserve altitude');
  layer.onRemove();
});


test('rooftop focus follows the longest mapped building without shifting the true achievement marker',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(contextBytes);
  try {
    const before=structuredClone(achievements[0].coordinates),chapter=context.chapters.find(chapter=>chapter.slugs.includes(achievements[0].slug));
    const renderer=rendererFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
    layer.setFocus(achievements[0].slug);layer.onAdd(mapFixture(),{});
    assert.deepEqual(layer.getExhibitFocus(),[before.lng,before.lat]);assert.equal(layer.getExhibitBaseHeight(),0,'no fabricated rooftop before pinned context');
    await layer.prepareAll();
    const focus=layer.getExhibitFocus(),roof=selectExhibitRoof(chapter),structure=layer.scene.children.find(object=>object.isGroup).children.find(object=>object.userData.capsule);
    assert.deepEqual(structure.position.toArray(),[roof.site[0],roof.building.height+.15,roof.site[1]]);
    assert.equal(layer.getStats().hostBuildingId,roof.building.id);assert.equal(layer.getExhibitScale(),CAPSULE_SCALE);
    assert.ok(focus.every(Number.isFinite));assert.notDeepEqual(focus,[before.lng,before.lat]);
    assert.deepEqual(achievements[0].coordinates,before);
    layer.setFocus(null);assert.equal(layer.getExhibitFocus(),null);assert.equal(layer.getExhibitHeight(),0);layer.onRemove();
  } finally {globalThis.fetch=originalFetch;}
});


test('master thesis exhibit follows authored TEA offlineRL description, not stale HRTF tags',()=>{
  const project=contestsAndActivities.find(project=>project.slug==='masters-thesis');
  const descriptor=ACHIEVEMENT_SCENE_SUBJECTS['masters-thesis'];
  assert.match(project.longDescription,/offline reinforcement learning/);
  assert.ok(project.longDescription.includes(descriptor.label));
  assert.equal(descriptor.subject,'trajectory-policy');
  assert.ok(!/HRTF|audio/i.test(descriptor.label));
  assert.equal(ACHIEVEMENT_SCENE_SUBJECTS['huawei-agorize-2024'].subject,'spatial-audio');
  const scene=buildAchievementExhibit('masters-thesis');
  assert.equal(scene.userData.subject,'trajectory-policy');
  assert.equal(scene.userData.label,descriptor.label);
  const stats=geometryStats(scene);
  assert.equal(stats.triangles,scene.userData.triangles);
  assert.ok(stats.triangles<12_000);assert.ok(stats.draws<=10);assert.ok(stats.bytes<900_000);
  disposeAchievementScene(scene);assert.equal(scene.children.length,0);
});


test('low-resolution preparation never covers photography with featureless opaque roofs',()=>{
  for(const chapter of context.chapters) {
    const scene=buildAchievementGeography(chapter);
    assert.equal(scene.userData.texturedBuildings,0);
    assert.equal(scene.userData.outlinedBuildings,chapter.buildings.length);
    assert.ok(!scene.children.some(object=>object.isMesh&&!object.isInstancedMesh),'untextured fallback must not hide the native aerial photograph');
    const outlines=scene.children.find(object=>object.isLineSegments);
    assert.ok(outlines);assert.equal(outlines.material.depthWrite,false);assert.ok(outlines.material.opacity<.3);
    disposeAchievementScene(scene);
  }
});

test('roof imagery requires genuine close-up sampling, georeference and source provenance',()=>{
  const fixture=roofImageryFixture();assert.equal(validateAchievementRoofImagery(fixture),fixture);
  const mutate=fn=>{const value=structuredClone(fixture.metadata);fn(value);return {image:fixture.image,metadata:value};};
  assert.throws(()=>validateAchievementRoofImagery(mutate(metadata=>metadata.resolutionM=10)),/too coarse/);
  assert.throws(()=>validateAchievementRoofImagery(mutate(metadata=>metadata.resolutionM=.02)),/sampling/);
  assert.throws(()=>validateAchievementRoofImagery(mutate(metadata=>metadata.source.url='invented')),/provenance/);
  assert.throws(()=>validateAchievementRoofImagery(mutate(metadata=>metadata.coordinates[1][1]+=.0001)),/rectangle/);
  assert.throws(()=>validateAchievementRoofImagery(mutate(metadata=>metadata.width=4097)),/budget/);
  assert.throws(()=>validateAchievementRoofImagery({image:{width:1024,height:1024},metadata:fixture.metadata}),/dimensions/);
});

test('real roof UVs follow the active atlas and never invert ImageBitmap imagery',()=>{
  const chapter=context.chapters[0],fixture=roofImageryFixture(chapter.origin);
  const uv=achievementRoofUv([-300,0,300,300,0,300,300,0,-300,-300,0,-300,0,0,0],chapter.origin,fixture.metadata);
  const expected=[0,0,1,0,1,1,0,1,.5,.5];
  uv.forEach((value,index)=>assert.ok(Math.abs(value-expected[index])<1e-6));
  const scene=buildAchievementGeography(chapter,{roofImagery:fixture,maxAnisotropy:32});
  assert.equal(scene.userData.texturedBuildings,chapter.buildings.length);
  assert.equal(scene.userData.outlinedBuildings,0);assert.equal(scene.userData.textures.length,1);
  const roof=scene.children.find(object=>object.name==='Source-aligned real aerial roof photographs');
  assert.equal(roof.material.map.image,fixture.image,'reuse borrowed active pixels, no second decode or canvas');
  assert.equal(roof.material.map.flipY,false);assert.equal(roof.material.map.anisotropy,8);
  assert.equal(roof.material.toneMapped,false);assert.equal(roof.material.color.getHex(),0xffffff);
  assert.equal(roof.geometry.getAttribute('uv').count,roof.geometry.getAttribute('position').count);
  assert.ok([...roof.geometry.getAttribute('uv').array].every(value=>value>=0&&value<=1));
  disposeAchievementScene(scene);assert.equal(fixture.image.closes,0,'decoded pixels remain owned by the active orthophoto layer');
});

test('partial orthophoto extent textures only covered roofs, preserving photos outside the patch',()=>{
  const chapter=structuredClone(context.chapters[0]),fixture=roofImageryFixture(chapter.origin);
  chapter.buildings=[{...chapter.buildings[0],ring:[[-10,-10],[10,-10],[10,10],[-10,10]]},
    {...chapter.buildings[0],id:100,ring:[[350,-10],[370,-10],[370,10],[350,10]]}];
  const scene=buildAchievementGeography(chapter,{roofImagery:fixture});
  assert.equal(scene.userData.texturedBuildings,1);assert.equal(scene.userData.outlinedBuildings,1);
  assert.equal(scene.userData.textures.length,1);assert.ok(scene.children.some(object=>object.isLineSegments));
  disposeAchievementScene(scene);
});

test('borrowed roof pixels get exactly one active GPU texture and synchronous release before owner close',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(contextBytes);
  try {
    const renderer=rendererFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
    const slug=achievements[0].slug,fixture=roofImageryFixture();
    layer.setFocus(slug);layer.onAdd(mapFixture(),{});await layer.prepareAll();
    assert.equal(layer.getStats().texturedContext,false);
    assert.equal(layer.setRoofImagery(slug,fixture),true);
    assert.equal(layer.getStats().texturedContext,true);assert.equal(layer.getStats().activeRoofTextures,1);
    assert.equal(layer.getStats().roofResolutionM,.3);assert.equal(layer.getStats().outlinedBuildings,0);
    assert.match(layer.getActiveAttribution(),/Official aerial photograph/);
    const texture=layer.scene.children.find(object=>object.isGroup).children.flatMap(object=>object.userData.textures??[])[0];
    let disposals=0;texture.addEventListener('dispose',()=>disposals++);
    assert.equal(layer.setRoofImagery(slug,fixture),true);assert.equal(disposals,0,'same source must not re-upload');
    assert.equal(layer.setRoofImagery(achievements[1].slug,roofImageryFixture(achievements[1].coordinates)),false,'late previous destination cannot create a hidden texture');
    layer.setRoofImagery(null,null);assert.equal(disposals,1);assert.equal(layer.getStats().activeRoofTextures,0);
    assert.equal(texture.image,null,'released GPU wrapper must not retain borrowed pixels');assert.equal(fixture.image.closes,0);
    layer.setRoofImagery(slug,fixture);layer.setOfficialContext(true);
    assert.equal(layer.getStats().activeRoofTextures,0);assert.equal(layer.getStats().buildings,0);
    layer.setOfficialContext(false);assert.equal(layer.getStats().activeRoofTextures,1);
    layer.setEnabled(false);assert.equal(layer.getStats().activeRoofTextures,0);
    layer.setEnabled(true);assert.equal(layer.getStats().activeRoofTextures,1);
    layer.setFocus(achievements[1].slug);assert.equal(layer.getStats().activeRoofTextures,0);
    layer.setFocus(null);assert.equal(layer.getStats().activeRoofTextures,0);assert.equal(layer.getStats().activeScenes,0);
    layer.onRemove();assert.equal(layer.setRoofImagery(slug,fixture),false);
    assert.equal(fixture.image.closes,0);
  } finally {globalThis.fetch=originalFetch;}
});

test('every zone keeps its fourfold capsule on only the longest actual roof regardless of imagery and resets inactive heights',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(contextBytes);
  const renderer=rendererFixture(),map=mapFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
  function structureAndLocalBounds(){
    const root=layer.scene.children.find(object=>object.isGroup),structure=root.children.find(object=>object.userData.capsule);
    assert.ok(structure,'active achievement must have its actual capsule geometry');
    layer.scene.updateMatrixWorld(true);
    // Undo only the renderer's handedness reflection, not the structure's roof
    // elevation: inspection framing consumes height in the local metre basis.
    const bounds=new THREE.Box3().setFromObject(structure).applyMatrix4(root.matrixWorld.clone().invert());
    return {structure,bounds};
  }
  function assertFramingHeight(supportY){
    const {structure,bounds}=structureAndLocalBounds();
    assert.ok(Math.abs(structure.position.y-supportY)<1e-8,'only the selected longest mapped roof supplies the physical exhibit lift');
    assert.ok(Math.abs(layer.getExhibitHeight()-((CAPSULE_LAYOUT.centerY+CAPSULE_LAYOUT.radius+.15)*CAPSULE_SCALE+supportY))<1e-8,
      'framing includes the fourfold globe plus its actual roof lift and crown-rib margin');
    // Cover the narrow exterior meridians too, not just the nominal glass.
    assert.ok(layer.getExhibitHeight()>=bounds.max.y&&layer.getExhibitHeight()-bounds.max.y<.15*CAPSULE_SCALE,
      'reported framing height must cover the actual elevated metal/glass crown');
    assert.equal(layer.getStats().exhibitHeightM,layer.getExhibitHeight());
    assert.equal(layer.getExhibitBaseHeight(),supportY);assert.equal(layer.getExhibitScale(),CAPSULE_SCALE);
    assert.equal(layer.getSignHeight(),supportY+CAPSULE_SIGN_POSITIONS[0][1]*CAPSULE_SCALE);
  }
  try {
    layer.setFocus(achievements[0].slug);layer.onAdd(map,{});
    assertFramingHeight(0);await layer.prepareAll();
    for(const {slug} of achievements){
      const event=achievements.find(event=>event.slug===slug),chapter=context.chapters.find(chapter=>chapter.slugs.includes(slug));
      assert.ok(event&&chapter,'regression must use a real portfolio event and pinned venue context');
      const roof=selectExhibitRoof(chapter),supportY=roof.building.height+.15;
      layer.setFocus(slug);
      assert.equal(layer.getStats().texturedBuildings,0);assert.ok(layer.getStats().outlinedBuildings>0);
      assert.equal(layer.getStats().hostBuildingId,roof.building.id);
      assertFramingHeight(supportY); // The authored mapped roof exists even before photography arrives.
      const fixture=roofImageryFixture(event.coordinates);
      assert.equal(layer.setRoofImagery(slug,fixture),true);
      assert.ok(layer.getStats().texturedBuildings>0);assert.equal(layer.getStats().activeRoofTextures,1);
      assertFramingHeight(supportY);
      layer.setRoofImagery(null,null);assert.equal(layer.getStats().activeRoofTextures,0);assertFramingHeight(supportY);
      layer.setRoofImagery(slug,fixture);assertFramingHeight(supportY);
      layer.setEnabled(false);assert.equal(layer.getExhibitHeight(),0);assert.equal(layer.getStats().exhibitHeightM,0);
      assert.equal(layer.getExhibitBaseHeight(),0);assert.equal(layer.getExhibitScale(),0);assert.equal(layer.getSignHeight(),0);
      layer.setEnabled(true);assertFramingHeight(supportY);
      layer.setFocus(null);assert.equal(layer.getExhibitHeight(),0);assert.equal(layer.getStats().exhibitHeightM,0);
      assert.equal(layer.getExhibitBaseHeight(),0);assert.equal(layer.getExhibitScale(),0);assert.equal(layer.getSignHeight(),0);
      layer.setFocus(slug);assertFramingHeight(supportY); // Home releases imagery, never the pinned actual roof.
      assert.equal(fixture.image.closes,0,'borrowed decoded imagery remains owned by its source layer');
    }
    layer.onRemove();assert.equal(layer.getExhibitHeight(),0);assert.equal(renderer.disposals,1);
  } finally {
    if(layer.scene)layer.onRemove();globalThis.fetch=originalFetch;
  }
});

test('roof selection is cached once per pinned zone across navigation and surveyed rebuilds',async()=>{
  const originalFetch=globalThis.fetch;globalThis.fetch=async()=>new Response(contextBytes);
  const layer=createAchievementSceneLayer({achievements,rendererFactory:()=>rendererFixture()});
  try {
    layer.setFocus(achievements[0].slug);layer.onAdd(mapFixture(),{});
    assert.equal(layer.getStats().roofSelectionBuilds,0);await layer.prepareAll();
    assert.equal(layer.getStats().roofSelectionBuilds,1,'preparation and buildFocused share one longest-roof calculation');
    const visited=new Set();
    for(let pass=0;pass<2;pass++)for(const event of achievements){
      visited.add(context.chapters.findIndex(chapter=>chapter.slugs.includes(event.slug)));
      layer.setFocus(event.slug);layer.setOfficialContext(true);layer.setOfficialContext(false);
      layer.setEnabled(false);layer.setEnabled(true);
      assert.equal(layer.getStats().roofSelectionBuilds,visited.size,'return visits and context toggles must reuse the pinned roof selection');
    }
    assert.equal(visited.size,30);layer.onRemove();assert.equal(layer.getStats().roofSelectionBuilds,0);
  } finally {if(layer.scene)layer.onRemove();globalThis.fetch=originalFetch;}
});

test('inside-globe reader pixels reuse the rendered projection and match actual elevated sign heads',async()=>{
  const originalFetch=globalThis.fetch,originalDocument=globalThis.document;
  globalThis.fetch=async()=>new Response(contextBytes);globalThis.document={createElement:()=>signCanvasFactory(1024,640)};
  const event=achievements.find(event=>event.slug==='pdm-kill-the-search-bar-2026'),map=mapFixture();
  map.center=event.coordinates;map.zoom=18;map.getCanvas=()=>({clientWidth:1280,clientHeight:720});
  const layer=createAchievementSceneLayer({achievements,rendererFactory:()=>rendererFixture()});
  const args={defaultProjectionData:{mainMatrix:new THREE.Matrix4().set(
    2,.1,.4,-.2, .2,1.8,.5,-.1, .1,.2,.8,0, 0,0,0,1).toArray(),projectionTransition:0}};
  try {
    assert.equal(layer.getSignScreenPositions(),null);layer.setFocus(event.slug);layer.onAdd(map,{});
    assert.equal(layer.getSignScreenPositions(),null,'initial identity camera is not a real MapLibre projection');
    await layer.prepareAll();assert.equal(layer.getSignScreenPositions(),null);
    layer.render({},args);assert.equal(layer.getSignScreenPositions(),null,'idle scene exposes no reader anchors');
    await layer.startGame(event.slug);layer.render({},args);layer.scene.updateMatrixWorld(true);
    const points=layer.getSignScreenPositions();assert.equal(points.length,2);
    const root=layer.scene.children.find(object=>object.isGroup),structure=root.children.find(object=>object.userData.capsule);
    const panels=structure.userData.signs.userData.panels,coordinates=layer.getSignPositions();
    assert.deepEqual(structure.scale.toArray(),[4,4,4]);assert.ok(structure.position.y>0);
    for(let i=0;i<panels.length;i++){
      const expected=new THREE.Vector4(0,0,0,1).applyMatrix4(panels[i].head.matrixWorld).applyMatrix4(layer.camera.projectionMatrix);
      assert.ok(expected.w>0);
      assert.ok(Math.abs(points[i].x-(expected.x/expected.w+1)*1280/2)<1e-8,'CSS X must match the true scaled/roof-supported head');
      assert.ok(Math.abs(points[i].y-(1-expected.y/expected.w)*720/2)<1e-8,'CSS Y must account for elevated head and reflected world basis');
      assert.ok(coordinates[i].every(Number.isFinite));
    }
    assert.equal(layer.getSignScreenPositions(),points);const first=points[0],second=points[1];
    layer.render({},args);assert.equal(layer.getSignScreenPositions(),points);
    assert.equal(points[0],first);assert.equal(points[1],second,'render-time projections must reuse both point objects');
    layer.camera.projectionMatrix.elements[15]=-1;assert.equal(layer.getSignScreenPositions(),null,'behind-camera points must not create stray reader buttons');
    layer.render({},args);assert.equal(layer.getSignScreenPositions(),points);
    map.zoom=12;layer.render({},args);assert.equal(layer.getSignScreenPositions(),null,'no projection for an inactive low-zoom scene');map.zoom=18;
    layer.setEnabled(false);assert.equal(layer.getSignScreenPositions(),null);layer.setEnabled(true);
    await layer.startGame(event.slug);
    assert.equal(layer.getSignScreenPositions(),null,'a rebuilt scene waits for its actual custom draw');
    layer.render({},args);assert.equal(layer.getSignScreenPositions(),points);
    layer.setFocus(null);assert.equal(layer.getSignScreenPositions(),null);layer.onRemove();assert.equal(layer.getSignScreenPositions(),null);
    assert.doesNotMatch(layer.getSignScreenPositions.toString(),/new\s+THREE\.|\.clone\(|getBoundingClientRect/,'render-time reader projection allocates no Three resources or DOM rectangle reads');
  } finally {if(layer.scene)layer.onRemove();globalThis.fetch=originalFetch;globalThis.document=originalDocument;}
});


test('all fully textured mapped pockets remain bounded, and only the active image is retained',()=>{
  let maximumBytes=0;
  for(const chapter of context.chapters) {
    const fixture=roofImageryFixture(chapter.origin),scene=buildAchievementGeography(chapter,{roofImagery:fixture});
    const stats=geometryStats(scene);maximumBytes=Math.max(maximumBytes,stats.bytes);
    assert.equal(scene.userData.texturedBuildings,chapter.buildings.length);
    assert.equal(scene.userData.outlinedBuildings,0);assert.equal(scene.userData.textures.length,1);
    assert.ok(stats.draws<=4);assert.ok(stats.triangles<26_000);
    assert.equal(scene.userData.triangles,stats.triangles);
    assert.ok(stats.bytes<1_400_000);disposeAchievementScene(scene);
    assert.equal(scene.userData.textures.length,0);assert.equal(fixture.image.closes,0);
  }
  assert.ok(maximumBytes>100_000);
});

function signCanvasFactory(width,height){
  let font='10px Arial';
  const context={get font(){return font;},set font(value){font=value;},fillRect(){},strokeRect(){},
    measureText(text){return {width:text.length*Number(font.match(/(\d+)px/)[1])*.52};},fillText(){}};
  return {width,height,getContext:()=>context};
}
test('all detailed exhibits and original explanation signs are complete and bounded together',()=>{
  for(const event of achievements){
    const root=buildAchievementExhibit(event.slug,{signOptions:{canvasFactory:signCanvasFactory}}),stats=geometryStats(root);
    assert.equal(root.userData.signs.userData.textures.length,2);
    assert.equal(root.userData.signContent.source,'portfolio-exhibit-notes');
    assert.equal(root.userData.signContent.title,authoredSignProse(contestsAndActivities.find(project=>project.slug===event.slug).title));
    assert.ok(stats.triangles<12_000,`${event.slug}: complete triangle count`);
    assert.ok(stats.draws<=15,`${event.slug}: material batch count including signs`);
    assert.ok(stats.bytes<900_000,`${event.slug}: geometry budget`);
    assert.equal(root.userData.triangles,stats.triangles);
    const signs=root.userData.signs,textures=[...signs.userData.textures];let disposals=0;
    for(const [index,panel] of signs.userData.panels.entries()){
      assert.ok(panel.plane.renderOrder>root.userData.glazing.renderOrder,'excerpts must render after glass instead of inheriting its tint');
      assert.deepEqual(panel.head.position.toArray(),CAPSULE_SIGN_POSITIONS[index],'physical explanations belong inside the globe');
      panel.plane.geometry.computeBoundingBox();
      assert.ok(panel.head.position.y+panel.plane.geometry.boundingBox.min.y>=CAPSULE_LAYOUT.floorY,'interior panel clears the exhibition floor');
    }
    textures.forEach(texture=>texture.addEventListener('dispose',()=>disposals++));
    disposeAchievementScene(root);assert.equal(disposals,2);assert.equal(root.children.length,0);
    assert.ok(textures.every(texture=>texture.image===null));assert.equal(root.userData.signs,null);
  }
});
test('physical signs release on focus changes, 3D off, home and removal without decoding inactive projects',async()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>signCanvasFactory(1024,640)};
  try{
    const renderer=rendererFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
    layer.setFocus(achievements[0].slug);layer.onAdd(mapFixture(),{});
    assert.equal(layer.getStats().activeSignTextures,2);assert.equal(layer.getStats().signTextureBytes,5_242_880);
    assert.deepEqual(layer.getSignPositions(),[],'idle project exposes no reading markers');assert.equal(layer.getSignContent().slug,achievements[0].slug);
    layer.setFocus(achievements[1].slug);assert.equal(layer.getStats().activeSignTextures,2);
    assert.equal(layer.getSignContent().slug,achievements[1].slug);
    layer.setEnabled(false);assert.equal(layer.getStats().activeSignTextures,0);assert.deepEqual(layer.getSignPositions(),[]);
    layer.setEnabled(true);assert.equal(layer.getStats().activeSignTextures,2);
    layer.setFocus(null);assert.equal(layer.getStats().activeSignTextures,0);assert.equal(layer.getSignContent(),null);
    layer.onRemove();assert.equal(layer.getStats().activeScenes,0);
  }finally{globalThis.document=originalDocument;}
});

test('physical achievement game shows source signs only during real game renders and releases each owned resource once',async()=>{
  const originalDocument=globalThis.document;
  globalThis.document={createElement:()=>signCanvasFactory(1024,640)};
  const renderer=rendererFixture(),map=mapFixture();map.zoom=20;
  const layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
  const args={defaultProjectionData:{mainMatrix:new THREE.Matrix4().toArray(),projectionTransition:0}};
  function watchResources(root){
    const resources=new Set();
    root.traverse(object=>{
      if(object.geometry)resources.add(object.geometry);
      if(object.isInstancedMesh)resources.add(object);
      for(const material of object.userData.materials??[])resources.add(material);
      for(const texture of object.userData.textures??[])resources.add(texture);
      for(const material of Array.isArray(object.material)?object.material:[object.material]){
        if(!material)continue;resources.add(material);
        if(material.map)resources.add(material.map);
      }
    });
    const counts=new Map([...resources].map(resource=>[resource,0]));
    for(const resource of resources)resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));
    return expected=>{assert.ok(counts.size>0);for(const [resource,count]of counts)assert.equal(count,expected,`${resource.type??resource.constructor.name} disposal count`);};
  }
  try{
    layer.setFocus(achievements[0].slug);layer.onAdd(map,{});layer.render({},args);
    let structure;layer.scene.traverse(object=>{if(object.userData.capsule)structure=object;});
    const signs=structure.userData.signs,content=layer.getSignContent(),textures=[...signs.userData.textures];
    const originalDemo=[...structure.userData.staticMeshes],originalResources=watchResources(structure);
    assert.equal(signs.visible,false,'idle exhibition has no source signs');
    assert.equal(await layer.startGame(achievements[0].slug),true);
    const gameRoot=structure.children.find(object=>object.userData.isExhibitGame),shell=structure.userData.gameShell;
    assert.ok(gameRoot&&shell);
    const gameResources=watchResources(gameRoot),shellResources=watchResources(shell);
    assert.ok(gameRoot.getObjectByName('finite-completion-sparks')?.isInstancedMesh,'test observes real game instance ownership');
    for(let frame=0;frame<3;frame++){
      layer.render({},args);
      assert.equal(signs.visible,true,`frame ${frame}: source signs belong only inside the active game`);
      assert.ok(originalDemo.every(mesh=>!mesh.visible),'original demonstration remains hidden during play');
      assert.equal(layer.getSignContent(),content,'game never rewrites the existing project/sign copy');
    }
    originalResources(0);gameResources(0);shellResources(0);
    layer.stopGame();layer.render({},args);
    assert.equal(structure.userData.signs,signs);
    assert.equal(signs.visible,false);
    assert.equal(layer.getSignContent(),content);
    assert.deepEqual(signs.userData.textures,textures);
    assert.ok(originalDemo.every(mesh=>mesh.visible));
    assert.equal(structure.userData.gameShell,null);
    assert.equal(gameRoot.parent,null);
    gameResources(1);shellResources(1);originalResources(0);
    layer.stopGame();gameResources(1);shellResources(1);
    layer.onRemove();layer.onRemove();
    originalResources(1);gameResources(1);shellResources(1);
    assert.ok(textures.every(texture=>texture.image===null));
    assert.equal(renderer.disposals,1);
  }finally{if(layer.scene)layer.onRemove();globalThis.document=originalDocument;}
});
