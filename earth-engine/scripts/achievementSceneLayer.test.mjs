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
import {validateAchievementContext,pointInFootprint,footprintIntersectsExhibit,chooseExhibitSite,
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
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].buildings[0].height=Infinity),achievements),/height/);
  assert.throws(()=>validateAchievementContext(mutate(data=>data.chapters[0].source.sha256='unverified'),achievements),/provenance/);
});

test('illustrative exhibit siting respects mapped roofs when sufficient nearby open space exists',()=>{
  const square=[[-15,-15],[15,-15],[15,15],[-15,15]];
  assert.equal(pointInFootprint([0,0],square),true);assert.equal(pointInFootprint([30,0],square),false);
  const chapter={buildings:[{ring:square}]};const site=chooseExhibitSite(chapter);
  assert.ok(Math.hypot(...site)<=100);assert.ok(Math.hypot(...site)>0);
  for(const corner of [[-19,-15],[-19,15],[19,-15],[19,15],[0,0]])
    assert.ok(!pointInFootprint([site[0]+corner[0],site[1]+corner[1]],square));
  const empty=chooseExhibitSite({buildings:[]});
  assert.ok(empty[0]<0 && empty[1]<0,'court should face the southwest default camera');
  assert.ok(Math.abs(Math.hypot(...empty)-50)<1e-9);
  assert.equal(footprintIntersectsExhibit([0,0],[[-100,-1],[100,-1],[100,1],[-100,1]]),true,'narrow crossing building');
  assert.equal(footprintIntersectsExhibit([0,0],[[-1,-1],[1,-1],[1,1],[-1,1]]),true,'building wholly contained by court');
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
    const trees=scene.children.filter(object=>object.isInstancedMesh);
    assert.equal(trees.length,2);assert.equal(trees[0].count,4);assert.equal(trees[1].count,12);
    maxTriangles=Math.max(maxTriangles,stats.triangles);maxBytes=Math.max(maxBytes,stats.bytes);
    disposeAchievementScene(scene);assert.equal(scene.children.length,0);
  }
  for(const chapter of context.chapters){
    const scene=buildAchievementGeography(chapter),stats=geometryStats(scene);
    assert.ok(stats.draws<=4);assert.ok(scene.userData.triangles<26_000);
    assert.equal(scene.userData.triangles,stats.triangles);
    assert.ok(stats.bytes<1_000_000);disposeAchievementScene(scene);
  }
  assert.ok(maxTriangles>3000);assert.ok(maxBytes>100_000);
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


test('court preference faces the selected camera and never shifts the true achievement origin',async()=>{
  const facingNorth=chooseExhibitSite(null,{bearing:0});
  assert.ok(Math.abs(facingNorth[0])<1e-9);assert.equal(facingNorth[1],-50);
  const facingEast=chooseExhibitSite(null,{bearing:90});
  assert.equal(facingEast[0],-50);assert.ok(Math.abs(facingEast[1])<1e-9);
  assert.throws(()=>chooseExhibitSite(null,{targetDistanceM:150}),/preference/);
  const before=structuredClone(achievements[0].coordinates);
  const renderer=rendererFixture(),layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
  layer.setFocus(achievements[0].slug);layer.onAdd(mapFixture(),{});
  const focus=layer.getExhibitFocus();
  assert.ok(focus[0]<before.lng && focus[1]<before.lat,'focus is camera-facing southwest');
  assert.deepEqual(achievements[0].coordinates,before);
  layer.setFocus(null);assert.equal(layer.getExhibitFocus(),null);layer.onRemove();
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
    measureText(text){return {width:text.length*parseInt(font,10)*.52};},fillText(){}};
  return {width,height,getContext:()=>context};
}
test('all detailed exhibits and original explanation signs are complete and bounded together',()=>{
  for(const event of achievements){
    const root=buildAchievementExhibit(event.slug,{signOptions:{canvasFactory:signCanvasFactory}}),stats=geometryStats(root);
    assert.equal(root.userData.signs.userData.textures.length,2);
    assert.equal(root.userData.signContent.source,'portfolio-authored');
    assert.equal(root.userData.signContent.title,authoredSignProse(contestsAndActivities.find(project=>project.slug===event.slug).title));
    assert.ok(stats.triangles<12_000,`${event.slug}: complete triangle count`);
    assert.ok(stats.draws<=15,`${event.slug}: material batch count including signs`);
    assert.ok(stats.bytes<900_000,`${event.slug}: geometry budget`);
    assert.equal(root.userData.triangles,stats.triangles);
    const signs=root.userData.signs,textures=[...signs.userData.textures];let disposals=0;
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
    assert.equal(layer.getSignPositions().length,2);assert.equal(layer.getSignContent().slug,achievements[0].slug);
    layer.setFocus(achievements[1].slug);assert.equal(layer.getStats().activeSignTextures,2);
    assert.equal(layer.getSignContent().slug,achievements[1].slug);
    layer.setEnabled(false);assert.equal(layer.getStats().activeSignTextures,0);assert.deepEqual(layer.getSignPositions(),[]);
    layer.setEnabled(true);assert.equal(layer.getStats().activeSignTextures,2);
    layer.setFocus(null);assert.equal(layer.getStats().activeSignTextures,0);assert.equal(layer.getSignContent(),null);
    layer.onRemove();assert.equal(layer.getStats().activeScenes,0);
  }finally{globalThis.document=originalDocument;}
});
