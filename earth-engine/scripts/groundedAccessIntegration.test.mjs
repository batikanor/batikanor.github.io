import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createAchievementSceneLayer,selectExhibitRoof,disposeAchievementScene,buildAchievementExhibit} from '../src/achievementSceneLayer.js';
import {CAPSULE_SCALE} from '../src/achievementCapsule.js';
import {ACHIEVEMENT_GAME_STATION} from '../src/achievementGameStation.js';
import {planCapsuleAccessFoot,resolveCapsuleAccess,createCapsuleAccess} from '../src/achievementAccess.js';
const events=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url)));
const context=JSON.parse(readFileSync(new URL('../public/data/achievement-context-v2.json',import.meta.url)));
function fixture(){const listeners=new Map(),map={zoom:20,center:events[0].coordinates,repaints:0,
  getZoom(){return this.zoom;},getCenter(){return this.center;},triggerRepaint(){this.repaints++;},getBearing:()=>42,getPitch:()=>54,
  getCanvas:()=>({clientWidth:1200,clientHeight:800}),queryTerrainElevation:()=>10,
  on(name,fn){listeners.set(name,fn);},off(name,fn){if(listeners.get(name)===fn)listeners.delete(name);}};
  const renderer={renders:0,render(){this.renders++;},resetState(){},dispose(){}};
  const layer=createAchievementSceneLayer({achievements:events,rendererFactory:()=>renderer});
  layer.onAdd(map,{});return {layer,map,listeners,renderer};}
async function prepare(layer){const fetch=globalThis.fetch;globalThis.fetch=async()=>({ok:true,headers:new Map(),arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify(context)).buffer});try{assert.equal(await layer.prepareAll(),true);}finally{globalThis.fetch=fetch;}}
const accessOf=layer=>layer.scene.children[0].children.find(group=>group.userData.gameStation)?.children.find(mesh=>mesh.name==='terrain-grounded-capsule-access');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} must meet ${b}`);
test('all 32 active contexts join the existing door to terrain; actual mapped points and longest roof stay unchanged',async()=>{
  const {layer,map}=fixture();await prepare(layer);
  for(const event of events){map.center=event.coordinates;layer.setFocus(event.slug);const chapter=context.chapters.find(c=>c.slugs.includes(event.slug)),host=selectExhibitRoof(chapter);
    const stats=layer.getStats(),access=accessOf(layer),layout=access.userData.access.layout;
    assert.equal(stats.hostBuildingId,host.building.id);assert.equal(stats.access.groundSamples.complete,true);
    assert.equal(stats.gameStation,true);assert.equal(stats.activeScenes,1);assert.equal(stats.access.draws,1);
    assert.ok(stats.access.triangles<=1800&&stats.access.bytes<14000);
    near(10+.12+stats.exhibitBaseHeightM+layout.foot[1]*CAPSULE_SCALE,10);
    layout.railFeet.forEach(foot=>near(10+.12+stats.exhibitBaseHeightM+foot[1]*CAPSULE_SCALE,10));
    assert.equal(access.material.map,null);assert.equal(layer.scene.children[0].children.filter(g=>g.userData.gameStation).length,1);
  }layer.onRemove();
});
test('terrain settlement resamples centre and both ladder shoes; identical height values never churn GPU ownership',async()=>{
  const {layer,map,listeners}=fixture();await prepare(layer);layer.setFocus(events[0].slug);
  const original=accessOf(layer);let disposed=0;original.addEventListener('dispose',()=>disposed++);
  assert.equal(layer.refreshAccessGround(),false);assert.equal(accessOf(layer),original);
  const origin=[events[0].coordinates.lng,events[0].coordinates.lat];map.queryTerrainElevation=coordinate=>Math.abs(coordinate[0]-origin[0])<1e-10&&Math.abs(coordinate[1]-origin[1])<1e-10?100:112+(coordinate[0]-origin[0])*1000;
  listeners.get('sourcedata')({sourceId:'esa-imagery'});await Promise.resolve();assert.equal(disposed,0);
  listeners.get('sourcedata')({sourceId:'terrain'});listeners.get('sourcedata')({sourceId:'terrain'});await Promise.resolve();assert.equal(disposed,1);
  const access=accessOf(layer),stats=layer.getStats(),layout=access.userData.access.layout;
  near(100+.12+stats.exhibitBaseHeightM+layout.foot[1]*4,stats.access.groundSamples.foot);
  layout.railFeet.forEach((foot,i)=>near(100+.12+stats.exhibitBaseHeightM+foot[1]*4,stats.access.groundSamples.rails[i]));
  assert.equal(layer.refreshAccessGround(),false);assert.equal(accessOf(layer),access);
  layer.onRemove();assert.equal(listeners.size,0);
});
test('missing foot/shoe DEM samples use explicit centre fallback, recover when known, and never rebuild after navigation/removal',async()=>{
  const {layer,map,listeners}=fixture();await prepare(layer);layer.setFocus(events[0].slug);
  const origin=[events[0].coordinates.lng,events[0].coordinates.lat];map.queryTerrainElevation=coordinate=>Math.abs(coordinate[0]-origin[0])<1e-10&&Math.abs(coordinate[1]-origin[1])<1e-10?80:null;
  layer.refreshAccessGround();let stats=layer.getStats();assert.equal(stats.access.groundSamples.complete,false);near(stats.access.worldGroundFootM,0);
  map.queryTerrainElevation=()=>null;listeners.get('terrain')({});await Promise.resolve();stats=layer.getStats();assert.equal(stats.access.groundSamples.complete,false);near(stats.access.worldGroundFootM,0);
  const late=listeners.get('sourcedata');late({sourceId:'terrain'});layer.setFocus(null);await Promise.resolve();assert.equal(layer.getStats().access,null);
  layer.setFocus(events[1].slug);late({sourceId:'terrain'});layer.onRemove();await Promise.resolve();assert.equal(layer.getStats().activeScenes,0);
});
test('inside-globe game console has a finite actual projection and adds only 72 batched triangles without a texture',()=>{
  const root=buildAchievementExhibit(events[0].slug);assert.equal(root.userData.gameStation.triangles,72);assert.deepEqual(root.userData.gameStation.position,ACHIEVEMENT_GAME_STATION);disposeAchievementScene(root);
  const {layer,map}=fixture();layer.setFocus(events[0].slug);assert.equal(layer.getGameScreenPosition(),null);
  layer.render({}, {defaultProjectionData:{mainMatrix:new THREE.Matrix4().identity().toArray(),projectionTransition:0}});
  const point=layer.getGameScreenPosition();assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.equal(layer.getGameScreenPosition(),point,'no new projection point allocations');
  map.zoom=2;layer.render({}, {defaultProjectionData:{mainMatrix:new THREE.Matrix4().identity().toArray(),projectionTransition:0}});assert.equal(layer.getGameScreenPosition(),null);layer.onRemove();
});

test('the complete live globe, game console, signs and grounded access retain explicit combined GPU bounds',()=>{
  const signCanvasFactory=(width,height)=>{let font='10px Arial';const ctx={get font(){return font;},set font(value){font=value;},fillRect(){},strokeRect(){},measureText:text=>({width:text.length*Number(font.match(/(\d+)px/)[1])*.52}),fillText(){}};return {width,height,getContext:()=>ctx};};
  let maxTriangles=0,maxBytes=0,maxDraws=0,maxRungs=0,largest='';
  for(const event of events){const chapter=context.chapters.find(c=>c.slugs.includes(event.slug)),host=selectExhibitRoof(chapter),plan=planCapsuleAccessFoot({hostRing:host.building.ring,site:host.site,nearbyBuildings:chapter.buildings});
    const layout=resolveCapsuleAccess({roofBaseM:host.building.height+.15,groundFootDeltaM:-.12,groundRailDeltasM:[-.12,-.12],footOffsetM:plan.footOffsetM});
    const globe=buildAchievementExhibit(event.slug,{includeLadder:false,signOptions:{canvasFactory:signCanvasFactory}}),access=createCapsuleAccess(layout);globe.add(access);
    let triangles=0,bytes=0,draws=0;globe.traverse(object=>{if(!object.isMesh)return;draws++;triangles+=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3*(object.isInstancedMesh?object.count:1);
      for(const attribute of Object.values(object.geometry.attributes))bytes+=attribute.array.byteLength;bytes+=object.geometry.index?.array.byteLength??0;bytes+=object.instanceMatrix?.array.byteLength??0;bytes+=object.instanceColor?.array.byteLength??0;});
    if(triangles>maxTriangles){maxTriangles=triangles;largest=event.slug;}maxBytes=Math.max(maxBytes,bytes);maxDraws=Math.max(maxDraws,draws);maxRungs=Math.max(maxRungs,layout.rungCount);
    assert.ok(triangles<13_500,`${event.slug}: complete actual live geometry`);assert.ok(bytes<900_000,`${event.slug}: full geometry including fixed access buffers`);assert.ok(draws<=16,`${event.slug}: active material draw bound`);
    assert.equal(globe.userData.signs.userData.textureBytes,5_242_880);assert.equal(globe.userData.signs.userData.textures.length,2);disposeAchievementScene(globe);
  }
  console.log('Grounded complete exhibit budget:',JSON.stringify({maxTriangles,maxBytes,maxDraws,maxRungs,largest}));
});
