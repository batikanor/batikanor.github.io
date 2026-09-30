import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {distanceMetres, EARTH_RADIUS_METRES} from './geo.js';
import {ACHIEVEMENT_SCENE_SUBJECTS, ACHIEVEMENT_SCENE_CREDIT} from './achievementSceneData.js';
import {buildDetailedExhibit} from './achievementExhibits.js';
import {createAchievementSigns, updateAchievementSigns, selectAchievementSignContent} from './achievementSigns.js';
import {getProject} from './projectContent.js';

const MAX_CONTEXT_BYTES = 1_200_000;
const MAX_BUILDINGS = 100;
const MAX_TREES = 70;
const MAX_CONTEXT_TRIANGLES = 22_000;
const MAX_EXHIBIT_TRIANGLES = 16_000;
const MIN_ZOOM = 15;
const MAX_RADIUS_M = 950;
const MAX_ROOF_RESOLUTION_M = 1;
const MAX_ROOF_DIMENSION = 4096;
const TAU = Math.PI * 2;
const PALETTE = Object.freeze({stone:0xc2c1b5,edge:0x384647,metal:0x7b8e91,dark:0x1a2c31,
  gold:0xc0a16e,glass:0x6f9c9f,leaf:0x56745a,bark:0x756454,paper:0xe3e4da,signal:0x84bfc1,
  blue:0x517780,brick:0x8d8474,red:0xb36b62});

const assert = (condition, message) => {if (!condition) throw new Error(message);};
const validOrigin = origin => Array.isArray(origin) && origin.length === 2
  && origin.every(Number.isFinite) && Math.abs(origin[0]) <= 180 && Math.abs(origin[1]) < 85;
const finitePair = xy => Array.isArray(xy) && xy.length === 2 && xy.every(Number.isFinite);
const hash = value => [...value].reduce((seed,char) => Math.imul(seed ^ char.charCodeAt(0),16777619) >>> 0,2166136261);

/** Reject malformed/off-budget geography before constructing any GPU object. */
export function validateAchievementContext(data, achievements) {
  assert(data?.version === 1 && data.license === 'ODbL 1.0'
    && data.attribution === '© OpenStreetMap contributors', 'Invalid achievement context provenance');
  assert(Array.isArray(data.chapters) && data.chapters.length <= 32, 'Invalid achievement context chapter count');
  const known = new Map(achievements.map(event=>[event.slug,[event.coordinates.lng,event.coordinates.lat]]));
  const seen = new Set();
  for (const chapter of data.chapters) {
    assert(validOrigin(chapter.origin) && chapter.radiusM === 260, 'Invalid achievement context origin/extent');
    assert(Array.isArray(chapter.slugs) && chapter.slugs.length > 0, 'Achievement context lacks event slugs');
    for (const slug of chapter.slugs) {
      assert(known.has(slug) && !seen.has(slug), 'Unknown or duplicate achievement context slug');
      assert(distanceMetres(known.get(slug),chapter.origin) < .1, 'Achievement context is not at the actual event point');
      seen.add(slug);
    }
    assert(/^https:\/\/api\.openstreetmap\.org\/api\/0\.6\/map\?bbox=/.test(chapter.source?.url ?? '')
      && /^[0-9a-f]{64}$/.test(chapter.source?.sha256 ?? ''), 'Achievement context lacks pinned source provenance');
    assert(Array.isArray(chapter.buildings) && chapter.buildings.length <= MAX_BUILDINGS
      && Array.isArray(chapter.trees) && chapter.trees.length <= MAX_TREES, 'Achievement context exceeds instance budget');
    for (const building of chapter.buildings) {
      assert(Number.isInteger(building.id) && building.id > 0 && Number.isFinite(building.height)
        && building.height >= .5 && building.height <= 400 && Number.isFinite(building.base)
        && building.base >= 0 && building.base < building.height
        && ['osm-height','osm-levels-3m-estimate','illustrative-height'].includes(building.basis),
      'Invalid OSM building height/provenance');
      assert(Array.isArray(building.ring) && building.ring.length >= 3 && building.ring.length <= 512
        && building.ring.every(point=>finitePair(point) && point.every(value=>Math.abs(value)<=260.01)),
      'Invalid bounded OSM footprint');
    }
    for (const tree of chapter.trees) assert(Number.isInteger(tree.id) && finitePair(tree.xy)
      && tree.xy.every(value=>Math.abs(value)<=260.01) && Number.isFinite(tree.height)
      && tree.height >= 1 && tree.height <= 40
      && ['osm-height','illustrative-height'].includes(tree.basis), 'Invalid OSM tree/provenance');
  }
  assert(seen.size === known.size, 'Achievement context does not cover every event');
  return data;
}

export function pointInFootprint([x,y], ring) {
  let inside = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const [xi,yi]=ring[i], [xj,yj]=ring[j];
    if (((yi>y)!==(yj>y)) && x < (xj-xi)*(y-yi)/(yj-yi)+xi) inside=!inside;
  }
  return inside;
}

function segmentsIntersect(a,b,c,d) {
  const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  const on=(p,q,r)=>Math.abs(cross(p,q,r))<1e-6 && r[0]>=Math.min(p[0],q[0])-1e-6
    && r[0]<=Math.max(p[0],q[0])+1e-6 && r[1]>=Math.min(p[1],q[1])-1e-6 && r[1]<=Math.max(p[1],q[1])+1e-6;
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  return abC*abD<0&&cdA*cdB<0 || on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
}

export function footprintIntersectsExhibit(site,ring) {
  const [x,y]=site;
  const court=[[x-19,y-15],[x+19,y-15],[x+19,y+15],[x-19,y+15]];
  if(court.some(point=>pointInFootprint(point,ring)))return true;
  if(ring.some(([a,b])=>a>=x-19&&a<=x+19&&b>=y-15&&b<=y+15))return true;
  return ring.some((a,i)=>court.some((c,j)=>segmentsIntersect(a,ring[(i+1)%ring.length],c,court[(j+1)%court.length])));
}

/** Place an explicitly illustrative court off mapped roofs where possible. */
export function chooseExhibitSite(chapter, {bearing=42,targetDistanceM=50} = {}) {
  assert(Number.isFinite(bearing) && Number.isFinite(targetDistanceM)
    && targetDistanceM>=20 && targetDistanceM<=100,'Invalid exhibit camera preference');
  // A north-facing map camera sits south of its target. Rotate that camera-
  // facing side with the selected bearing. Keep the *event* at its true point;
  // only a clearly illustrative museum court uses this local metre offset.
  const radians=bearing*Math.PI/180;
  const preferred=[-Math.sin(radians)*targetDistanceM,-Math.cos(radians)*targetDistanceM];
  if (!chapter?.buildings?.length) return preferred;
  const candidates = [preferred];
  for (let radius=0;radius<=100;radius+=20) for (let i=0;i<(radius?16:1);i++) {
    const angle = -Math.PI/2-radians + i*TAU/16;
    candidates.push([Math.cos(angle)*radius,Math.sin(angle)*radius]);
  }
  const score=([x,z])=>(x-preferred[0])**2+(z-preferred[1])**2;
  candidates.sort((a,b)=>score(a)-score(b));
  return candidates.find(xy=>!chapter.buildings.some(building=>footprintIntersectsExhibit(xy,building.ring))) ?? [0,0];
}

function materials() {
  return Object.fromEntries(Object.entries(PALETTE).map(([name,color])=>[name,
    new THREE.MeshStandardMaterial({color,metalness:['metal','gold','dark'].includes(name)?.45:.06,
      roughness:['metal','gold'].includes(name)?.42:.84, flatShading:false})]));
}

function triangleCount(geometry) {return (geometry.index?.count ?? geometry.getAttribute('position').count)/3;}

/** A material-keyed geometry batch: every static subject takes few draw calls. */
function batchBuilder() {
  const groups = new Map();
  let count = 0;
  const transform = new THREE.Object3D();
  return {
    add(key,geometry,xyz=[0,0,0],scale=[1,1,1],rotation=[0,0,0]) {
      transform.position.set(...xyz);transform.scale.set(...scale);transform.rotation.set(...rotation);transform.updateMatrix();
      geometry.applyMatrix4(transform.matrix);
      // Normalize shared attributes so primitive types can be merged safely.
      geometry.deleteAttribute('uv');
      const flat=geometry.index ? geometry.toNonIndexed() : geometry;
      if(flat!==geometry)geometry.dispose();
      const triangles=triangleCount(flat);
      if(count+triangles>MAX_EXHIBIT_TRIANGLES){flat.dispose();throw new Error('Achievement exhibit exceeds the complete-model triangle budget');}
      count+=triangles;
      if(!groups.has(key))groups.set(key,[]);
      groups.get(key).push(flat);
    },
    finish() {
      const root=new THREE.Group();const mats=materials();
      for (const [key,geometries] of groups) {
        const combined=mergeGeometries(geometries,false);
        geometries.forEach(geometry=>geometry.dispose());
        if(!combined)continue;
        const mesh=new THREE.Mesh(combined,mats[key]);mesh.frustumCulled=false;root.add(mesh);
      }
      // Unused palette entries must also be disposed (same rule as used ones).
      root.userData.materials=Object.values(mats);root.userData.triangles=count;
      return root;
    }
  };
}

function primitives(batch) {
  const box=(mat,xyz,scale,rotation)=>batch.add(mat,new THREE.BoxGeometry(1,1,1),xyz,scale,rotation);
  const sphere=(mat,xyz,scale)=>batch.add(mat,new THREE.IcosahedronGeometry(1,2),xyz,scale);
  const cylinder=(mat,xyz,radius,height,rotation)=>batch.add(mat,new THREE.CylinderGeometry(radius,radius,height,20),xyz,[1,1,1],rotation);
  const ring=(mat,xyz,radius,tube,rotation=[Math.PI/2,0,0])=>batch.add(mat,new THREE.TorusGeometry(radius,tube,6,40),xyz,[1,1,1],rotation);
  const rod=(mat,a,b,r=.06)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
    const geometry=new THREE.CylinderGeometry(r,r,delta.length(),8);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    batch.add(mat,geometry,from.add(to).multiplyScalar(.5).toArray());
  };
  const cone=(mat,xyz,radius,height,rotation)=>batch.add(mat,new THREE.ConeGeometry(radius,height,20),xyz,[1,1,1],rotation);
  return {box,sphere,cylinder,ring,rod,cone};
}

function addTrees(root, records, {authored = false} = {}) {
  if(!records.length)return;
  const trunkGeometry=new THREE.CylinderGeometry(1,1.2,1,8);
  const leafGeometry=new THREE.IcosahedronGeometry(1,1);
  const trunkMaterial=new THREE.MeshStandardMaterial({color:PALETTE.bark,roughness:.98});
  const leafMaterial=new THREE.MeshStandardMaterial({color:PALETTE.leaf,roughness:.94});
  const trunks=new THREE.InstancedMesh(trunkGeometry,trunkMaterial,records.length);
  const crowns=new THREE.InstancedMesh(leafGeometry,leafMaterial,records.length*3);
  trunks.frustumCulled=crowns.frustumCulled=false;
  const dummy=new THREE.Object3D();const color=new THREE.Color();
  records.forEach((tree,i)=>{
    const [x,z]=tree.xy,h=tree.height,seed=hash(String(tree.id)),y=tree.base ?? 0;
    const radius=Math.min(2.8,h*.28);
    dummy.position.set(x,y+h*.25,z);dummy.scale.set(h*.018,h*.5,h*.018);dummy.rotation.set(0,0,0);dummy.updateMatrix();
    trunks.setMatrixAt(i,dummy.matrix);
    for(let branch=0;branch<3;branch++){
      const angle=(seed%360)*Math.PI/180+branch*TAU/3;
      dummy.position.set(x+Math.cos(angle)*radius*.32,y+h*(.64+branch*.065),z+Math.sin(angle)*radius*.3);
      dummy.rotation.set(0,angle,.1);dummy.scale.set(radius*(tree.evergreen?.72:1),h*(tree.evergreen?.37:.25),radius*.8);dummy.updateMatrix();
      crowns.setMatrixAt(i*3+branch,dummy.matrix);
      color.setHex(PALETTE.leaf).multiplyScalar(.85+(seed%19)/70+branch*.035);crowns.setColorAt(i*3+branch,color);
    }
  });
  trunks.instanceMatrix.needsUpdate=crowns.instanceMatrix.needsUpdate=true;
  crowns.instanceColor.needsUpdate=true;
  trunks.userData.authored=crowns.userData.authored=authored;
  root.add(trunks,crowns);
  root.userData.treeTriangles=triangleCount(trunkGeometry)*records.length+triangleCount(leafGeometry)*records.length*3;
  root.userData.triangles=(root.userData.triangles??0)+root.userData.treeTriangles;
}

function addSubject(batch, subject, slug) {
  const p=primitives(batch);
  // An illustrative exhibit, never a supposed survey of the real venue.
  p.box('dark',[0,.5,0],[13,.45,10]);p.box('stone',[0,.75,0],[12.7,.07,9.7]);
  assert(buildDetailedExhibit(subject,p,{slug,project:getProject(slug)}),`Missing detailed exhibit: ${slug}`);
}

/** Static material-batched models and native-font signs; no network or decoder. */
export function buildAchievementExhibit(slug, {compact=false, site=[0,0],signOptions={}} = {}) {
  const descriptor=ACHIEVEMENT_SCENE_SUBJECTS[slug];
  assert(descriptor,`Missing authored achievement subject: ${slug}`);
  const batch=batchBuilder();const {box,cylinder,rod}=primitives(batch);
  if(!compact){
    box('edge',[0,.07,0],[36,.14,27]);box('stone',[0,.18,0],[35.5,.1,26.5]);
    // Architectural exhibit shelter, emphatically not a venue reconstruction.
    for(const x of [-13,13])for(const z of [-8,8])cylinder('metal',[x,3.5,z],.15,6.7);
    for(const x of [-13,13])rod('metal',[x,6.85,-8],[x,6.85,8],.14);
    for(const z of [-8,8])rod('metal',[-13,6.85,z],[13,6.85,z],.14);
    // Thin roof slats leave the subject visible from the isometric view.
    for(let i=0;i<7;i++)box('metal',[-11.7+i*3.9,6.95,5.6],[.08,.08,5]);
    for(const x of [-15,15])for(const z of [-10.6,10.6])box('edge',[x,.65,z],[2.4,1,2.4]);
    for(const z of [-11.8,11.8])box('dark',[0,.51,z],[9,.3,1]);
  }
  addSubject(batch,descriptor.subject,slug);
  const root=batch.finish();root.name=`Achievement exhibit · ${descriptor.label}`;
  root.position.set(site[0],0,site[1]);
  if(!compact)addTrees(root,[[-15,-10.6],[15,-10.6],[-15,10.6],[15,10.6]].map((xy,i)=>({xy,id:i,height:6.3,base:.6})),{authored:true});
  root.userData.subject=descriptor.subject;root.userData.label=descriptor.label;
  root.userData.illustrative=true;root.userData.compact=compact;
  root.userData.signContent=selectAchievementSignContent(getProject(slug));
  if(signOptions.canvasFactory || globalThis.document?.createElement) {
    try {
      const signs=createAchievementSigns(getProject(slug),signOptions);root.add(signs);root.userData.signs=signs;
      // Two panel backs/planes and two instanced poles. Count real geometry too.
      signs.traverse(object=>{if(object.isMesh)root.userData.triangles+=triangleCount(object.geometry)*(object.isInstancedMesh?object.count:1);});
    }catch(error){console.warn('Physical project signs unavailable; the model and accessible original-text reader remain available.',error);}
  }
  return root;
}

function appendTriangle(array,a,b,c) {array.push(...a,...b,...c);}

/** Only real, geographically aligned ≤1 m aerial imagery can make opaque roofs. */
export function validateAchievementRoofImagery(descriptor) {
  const metadata=descriptor?.metadata,image=descriptor?.image;
  assert(image && metadata,'Roof imagery requires borrowed decoded pixels and metadata');
  assert(Number.isInteger(metadata.width) && Number.isInteger(metadata.height)
    && metadata.width>0 && metadata.height>0
    && metadata.width<=MAX_ROOF_DIMENSION && metadata.height<=MAX_ROOF_DIMENSION,
  'Roof orthophoto exceeds one active texture budget');
  assert((image.naturalWidth??image.width)===metadata.width
    && (image.naturalHeight??image.height)===metadata.height,
  'Roof orthophoto decoded dimensions differ from source metadata');
  assert(Number.isFinite(metadata.resolutionM) && metadata.resolutionM>0
    && metadata.resolutionM<=MAX_ROOF_RESOLUTION_M,
  'Roof imagery is too coarse for opaque building detail');
  assert(typeof metadata.source?.attribution==='string' && metadata.source.attribution.length>0
    && /^https:\/\//.test(metadata.source?.url??'')
    && typeof metadata.source?.license==='string' && metadata.source.license.length>0,
  'Roof orthophoto lacks actual source provenance');
  const c=metadata.coordinates;
  assert(Array.isArray(c) && c.length===4 && c.every(validOrigin),'Invalid roof orthophoto coordinates');
  const [nw,ne,se,sw]=c;
  assert(ne[0]>nw[0] && nw[1]>sw[1] && Math.abs(nw[1]-ne[1])<1e-8
    && Math.abs(sw[1]-se[1])<1e-8 && Math.abs(nw[0]-sw[0])<1e-8
    && Math.abs(ne[0]-se[0])<1e-8,
  'Roof orthophoto must use a clockwise, unwarped geographic rectangle');
  const centreLat=(nw[1]+sw[1])/2;
  const actualResolution=Math.max(distanceMetres([nw[0],centreLat],[ne[0],centreLat])/metadata.width,
    distanceMetres(nw,sw)/metadata.height);
  assert(actualResolution<=MAX_ROOF_RESOLUTION_M*1.05
    && actualResolution<=metadata.resolutionM*1.08,
  'Roof orthophoto geographic sampling disagrees with its claimed resolution');
  return descriptor;
}

/** UVs follow the exact MapLibre metre transform, not a stretched local photo. */
export function achievementRoofUv(positions, origin, metadata) {
  assert(validOrigin(origin) && positions.length%3===0,'Roof UVs require local XYZ positions and origin');
  const [nw,,se]=metadata.coordinates;
  const topLeft=maplibregl.MercatorCoordinate.fromLngLat(nw);
  const bottomRight=maplibregl.MercatorCoordinate.fromLngLat(se);
  const anchor=maplibregl.MercatorCoordinate.fromLngLat(origin);
  const scale=anchor.meterInMercatorCoordinateUnits();
  const width=bottomRight.x-topLeft.x,height=bottomRight.y-topLeft.y;
  assert(width>0 && height>0,'Roof atlas must have positive Mercator extent');
  const uv=new Float32Array(positions.length/3*2);
  for(let i=0;i<positions.length/3;i++) {
    const u=(anchor.x+positions[i*3]*scale-topLeft.x)/width;
    // flipY=false for both HTMLImageElement and ImageBitmap. This top-down v
    // convention avoids ImageBitmap's ignored WebGL UNPACK_FLIP_Y setting.
    const v=(anchor.y-positions[i*3+2]*scale-topLeft.y)/height;
    assert(Number.isFinite(u) && Number.isFinite(v),'Non-finite georeferenced roof UV');
    uv[i*2]=u;uv[i*2+1]=v;
  }
  return uv;
}

/**
 * Keep source photography visible while genuine local detail is pending.
 * Large featureless gray roofs are NOT a performance fallback: untextured
 * footprints are unobtrusive ground outlines. Real trees and the authored
 * exhibit still provide 3D at every event. With a source-aligned orthophoto,
 * only fully covered footprints receive roofs and neutral unphotographed walls.
 * The caller retains image ownership; this scene owns at most one GPU texture.
 */
export function buildAchievementGeography(chapter, {maxTrees=MAX_TREES,roofImagery=null,maxAnisotropy=1} = {}) {
  assert(Number.isInteger(maxTrees) && maxTrees>=0 && maxTrees<=MAX_TREES,'Invalid mapped tree instance budget');
  if(roofImagery)validateAchievementRoofImagery(roofImagery);
  const root=new THREE.Group();root.name='OSM mapped context · heights may be estimated';
  const walls=[],roofs=[],outlines=[];
  let used=0,texturedBuildings=0,outlinedBuildings=0;const texturedBuildingIds=[];
  for(const building of chapter.buildings){
    const ring=building.ring.map(point=>new THREE.Vector2(...point));
    const probe=roofImagery?achievementRoofUv(ring.flatMap(point=>[point.x,0,point.y]),chapter.origin,roofImagery.metadata):null;
    const fullyCovered=probe&&probe.every(value=>value>=0&&value<=1);
    if(!fullyCovered){
      outlinedBuildings++;
      for(let i=0;i<ring.length;i++) {
        const a=ring[i],b=ring[(i+1)%ring.length],y=building.base+.2;
        outlines.push(a.x,y,a.y,b.x,y,b.y);
      }
      continue;
    }
    const triangles=THREE.ShapeUtils.triangulateShape(ring,[]);
    if(used+triangles.length+ring.length*2>MAX_CONTEXT_TRIANGLES)break;
    used+=triangles.length+ring.length*2;texturedBuildings++;texturedBuildingIds.push(building.id);
    for(const [a,b,c] of triangles){
      // north is local +z; wind roof triangles upward in the x/y/z basis.
      appendTriangle(roofs,[ring[c].x,building.height,ring[c].y],[ring[b].x,building.height,ring[b].y],[ring[a].x,building.height,ring[a].y]);
    }
    for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length];
      appendTriangle(walls,[a.x,building.base,a.y],[a.x,building.height,a.y],[b.x,building.height,b.y]);
      appendTriangle(walls,[a.x,building.base,a.y],[b.x,building.height,b.y],[b.x,building.base,b.y]);
    }
  }
  if(walls.length) {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(walls,3));geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:0xb0b4ac,roughness:.96,metalness:0,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name='Mapped walls · no surveyed facade photograph';root.add(mesh);
  }
  if(roofs.length) {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(roofs,3));geometry.computeVertexNormals();
    geometry.setAttribute('uv',new THREE.BufferAttribute(achievementRoofUv(roofs,chapter.origin,roofImagery.metadata),2));
    const texture=new THREE.Texture(roofImagery.image);texture.colorSpace=THREE.SRGBColorSpace;
    texture.flipY=false;texture.anisotropy=Math.max(1,Math.min(8,maxAnisotropy));texture.needsUpdate=true;
    const material=new THREE.MeshBasicMaterial({color:0xffffff,map:texture,side:THREE.DoubleSide,toneMapped:false});
    const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name='Source-aligned real aerial roof photographs';root.add(mesh);
    root.userData.textures=[texture];root.userData.roofResolutionM=roofImagery.metadata.resolutionM;
    root.userData.roofCredit=roofImagery.metadata.source.attribution;
  }
  if(outlines.length) {
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(outlines,3));
    const material=new THREE.LineBasicMaterial({color:0xd4ddd7,transparent:true,opacity:.24,depthWrite:false});
    const outline=new THREE.LineSegments(geometry,material);outline.frustumCulled=false;
    outline.name='Mapped footprint outlines · photography preserved';root.add(outline);
  }
  root.userData.triangles=used;
  root.userData.texturedBuildings=texturedBuildings;root.userData.outlinedBuildings=outlinedBuildings;
  root.userData.texturedBuildingIds=texturedBuildingIds;
  const trees=chapter.trees.slice(0,maxTrees);
  addTrees(root,trees);
  root.userData.buildings=chapter.buildings.length;root.userData.trees=trees.length;
  return root;
}

export function disposeAchievementScene(root) {
  if(!root)return;
  const geometries=new Set(),mats=new Set(root.userData.materials ?? []),textures=new Set(root.userData.textures??[]);
  root.traverse(object=>{
    if(object.geometry)geometries.add(object.geometry);
    for(const texture of object.userData.textures??[])textures.add(texture);
    for(const material of object.userData.materials??[])mats.add(material);
    object.userData.textures=[];
    if(object.material)for(const mat of Array.isArray(object.material)?object.material:[object.material])mats.add(mat);
    // Instance buffers are not released by geometry.dispose alone.
    if(object.isInstancedMesh)object.dispose();
  });
  geometries.forEach(geometry=>geometry.dispose());mats.forEach(mat=>mat.dispose());
  // Borrowed pixels belong to the orthophoto layer; never call image.close here.
  textures.forEach(texture=>{texture.dispose();texture.image=null;});root.userData.textures=[];root.userData.signs=null;root.clear();
}

function localCoordinate(origin,[east,north]) {
  const lat=origin[1]+north/EARTH_RADIUS_METRES*180/Math.PI;
  const lng=origin[0]+east/(EARTH_RADIUS_METRES*Math.cos(origin[1]*Math.PI/180))*180/Math.PI;
  return [lng,lat];
}

/**
 * One active local scene, independent of remote vector tiles or 3D services.
 * Host API:
 *   map.addLayer(createAchievementSceneLayer({achievements}));
 *   layer.prepareAll();                 // compressed context during intro
 *   layer.setFocus(event.slug);         // immediately constructs one exhibit
 *   layer.setOfficialContext(true);     // hide OSM and shrink the exhibit
 *   layer.setEnabled(cityDetailOn);     // same preference as surveyed chapters
 * Keep the actual map event marker at its authored WGS84 coordinate. The court
 * is an illustrative installation near that marker, not a geographic claim.
 */
export function createAchievementSceneLayer({achievements, baseUrl=import.meta.env?.BASE_URL ?? '/',
  contextUrl=null, onChange=null, rendererFactory=null, lowMemory=null}={}) {
  assert(Array.isArray(achievements) && achievements.length>0 && achievements.length<=32,
    'Achievement scene needs the actual portfolio events');
  const memory=typeof navigator==='undefined'?null:navigator.deviceMemory;
  const coarse=typeof matchMedia==='function'&&matchMedia('(pointer: coarse)').matches;
  const mobileBudget=lowMemory??(Number.isFinite(memory)?memory<=4:coarse);
  const events=new Map(achievements.map(event=>[event.slug,event]));
  assert(events.size===achievements.length && [...events.keys()].every(slug=>ACHIEVEMENT_SCENE_SUBJECTS[slug]),
    'Every achievement needs an authored scene subject');
  let focus=null,enabled=true,officialContext=false,context=null,pending=null,abort=null,destroyed=false;
  let structure=null,geography=null,root=null,site=[0,0],contextBytes=0,anchor=null,roofImagery=null;
  const modelMatrix=new THREE.Matrix4(),scaleMatrix=new THREE.Matrix4(),axisMatrix=new THREE.Matrix4().makeRotationX(Math.PI/2);
  const getChapter=()=>context?.chapters.find(chapter=>chapter.slugs.includes(focus)) ?? null;
  const notify=layer=>{if(typeof onChange==='function')onChange(layer.getStats());};
  const release=()=>{
    if(structure){root?.remove(structure);disposeAchievementScene(structure);structure=null;}
    if(geography){root?.remove(geography);disposeAchievementScene(geography);geography=null;}
  };
  const layer={
    id:'earth-engine-achievement-scenes',type:'custom',renderingMode:'3d',
    setFocus(slug=null){
      assert(slug==null || events.has(slug),`Unknown achievement scene: ${slug}`);
      if(focus===slug)return;
      focus=slug;officialContext=false;release();roofImagery=null;
      if(focus){
        const event=events.get(focus),origin=[event.coordinates.lng,event.coordinates.lat];
        const merc=maplibregl.MercatorCoordinate.fromLngLat(origin,0);
        anchor={origin,x:merc.x,y:merc.y,scale:merc.meterInMercatorCoordinateUnits()};
      }else anchor=null;
      site=focus?chooseExhibitSite(getChapter()):[0,0];
      if(!destroyed && enabled && root && focus)this.buildFocused();
      this.map?.triggerRepaint();notify(this);
    },
    /** Borrow active decoded orthophoto only; clear before its owner closes pixels. */
    setRoofImagery(slug,descriptor=null){
      assert(slug==null || events.has(slug),`Unknown roof imagery scene: ${slug}`);
      assert(!descriptor||slug!=null,'Borrowed roof imagery requires the active achievement slug');
      if(destroyed)return false;
      if(slug!=null && slug!==focus)return false;
      if(descriptor)validateAchievementRoofImagery(descriptor);
      if((roofImagery?.image??null)===(descriptor?.image??null)
        && (roofImagery?.metadata??null)===(descriptor?.metadata??null))return true;
      roofImagery=descriptor;
      if(geography){root?.remove(geography);disposeAchievementScene(geography);geography=null;}
      if(root&&focus&&enabled&&!officialContext){this.buildGeography();this.updateExhibitHeight();}
      this.map?.triggerRepaint();notify(this);return true;
    },
    setOfficialContext(available){
      const next=!!available;if(officialContext===next)return;officialContext=next;
      if(focus && root && enabled){release();this.buildFocused();}
      this.map?.triggerRepaint();notify(this);
    },
    setEnabled(next){
      enabled=!!next;
      if(!enabled)release();else if(root && focus && !structure)this.buildFocused();
      this.map?.triggerRepaint();notify(this);
    },
    getEnabled(){return enabled;},
    getActiveAttribution(){return enabled&&focus?[ACHIEVEMENT_SCENE_CREDIT,geography?.userData.roofCredit].filter(Boolean).join(' · '):null;},
    getExhibitFocus(){return focus?localCoordinate([events.get(focus).coordinates.lng,events.get(focus).coordinates.lat],site):null;},
    getSignContent(){return structure?.userData.signContent??null;},
    getSignPositions(){return focus&&structure?[-7,7].map(east=>localCoordinate(anchor.origin,[site[0]+east,site[1]-8])):[];},
    getStats(){return {eventSlug:focus,enabled,ready:!!structure,contextReady:!!context,
      activeSignTextures:structure?.userData.signs?.userData.textures?.length??0,
      signTextureBytes:structure?.userData.signs?.userData.textureBytes??0,
      surveyedContext:officialContext,buildings:geography?.userData.buildings??0,trees:geography?.userData.trees??0,
      illustrative:!!structure,subject:focus?ACHIEVEMENT_SCENE_SUBJECTS[focus].subject:null,
      activeScenes:structure?1:0,triangles:(structure?.userData.triangles??0)+(geography?.userData.triangles??0),
      contextBytes,texturedContext:!!geography?.userData.texturedBuildings,
      texturedBuildings:geography?.userData.texturedBuildings??0,outlinedBuildings:geography?.userData.outlinedBuildings??0,
      activeRoofTextures:geography?.userData.textures?.length??0,roofResolutionM:geography?.userData.roofResolutionM??null};},
    /** Shared ≤1.2 MB database only; no GPU for inactive events, safe on phones. */
    async prepareAll(){
      if(destroyed)return false;if(context)return true;if(pending)return pending;
      abort=new AbortController();
      pending=(async()=>{
        try{
          const response=await fetch(contextUrl ?? `${baseUrl}data/achievement-context-v2.json`,{signal:abort.signal,cache:'force-cache'});
          assert(response.ok,`Achievement context HTTP ${response.status}`);
          const advertised=Number(response.headers.get('content-length'));
          assert(!Number.isFinite(advertised)||advertised<=MAX_CONTEXT_BYTES,'Achievement context exceeds transfer budget');
          const bytes=await response.arrayBuffer();assert(bytes.byteLength<=MAX_CONTEXT_BYTES,'Achievement context exceeds transfer budget');
          const data=validateAchievementContext(JSON.parse(new TextDecoder().decode(bytes)),achievements);
          if(destroyed)return false;context=data;contextBytes=bytes.byteLength;
          if(focus)site=chooseExhibitSite(getChapter());
          if(root&&focus&&enabled){release();this.buildFocused();this.map?.triggerRepaint();}
          notify(this);return true;
        }catch(error){
          if(!destroyed && !abort.signal.aborted)console.warn('Offline geographic context unavailable; authored 3D exhibits remain visible.',error);
          return false;
        }finally{pending=null;}
      })();return pending;
    },
    prefetch(){return this.prepareAll();},
    buildFocused(){
      if(!root||!focus||!enabled||destroyed)return;
      const chapter=getChapter();site=chooseExhibitSite(chapter);
      structure=buildAchievementExhibit(focus,{compact:officialContext,site});
      root.add(structure);
      this.buildGeography();this.updateExhibitHeight();
    },
    updateExhibitHeight(){
      if(!structure)return;
      const visibleIds=new Set(geography?.userData.texturedBuildingIds??[]);
      // A dense pocket can have no empty exhibit site. Raise a rooftop exhibit
      // only when its supporting roof is actually visible, not when the native
      // aerial photograph is being preserved by ground-outline fallback.
      const supportingHeights=getChapter()?.buildings.filter(building=>(officialContext||visibleIds.has(building.id))
        && footprintIntersectsExhibit(site,building.ring)).map(building=>building.height)??[];
      structure.position.y=supportingHeights.length?Math.max(...supportingHeights)+.15:0;
    },
    buildGeography(){
      const chapter=getChapter();
      if(!root||!chapter||!focus||!enabled||officialContext||destroyed)return;
      geography=buildAchievementGeography(chapter,{maxTrees:mobileBudget?35:MAX_TREES,roofImagery,
        maxAnisotropy:this.renderer?.capabilities?.getMaxAnisotropy?.()??1});root.add(geography);
    },
    onAdd(map,gl){
      destroyed=false;this.map=map;this.camera=new THREE.Camera();this.scene=new THREE.Scene();
      root=new THREE.Group();
      // MapLibre's projection has reversed screen winding relative to a
      // normal Three camera. Reflect the *world* basis (which Three sees),
      // then undo it in the projection transform. Positions stay exactly
      // georeferenced, but Three correctly flips its front-face state and
      // computes outward illumination instead of black inverted roofs.
      root.scale.y=-1;this.scene.add(root);
      const sky=new THREE.HemisphereLight(0xe5eee8,0x505d57,1.9);
      sky.position.set(0,-1,0);this.scene.add(sky);
      const sun=new THREE.DirectionalLight(0xffeed6,2.1);sun.position.set(-80,-140,-50);this.scene.add(sun);
      this.renderer=rendererFactory?rendererFactory(map,gl):new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});
      this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
      if(enabled&&focus)this.buildFocused();
      // Fetch is deliberately host-triggered during the introduction, not by
      // render. render never allocates models or starts network work.
      notify(this);
    },
    render(gl,args){
      if(!enabled||!structure||!focus||!this.map||!args.defaultProjectionData?.mainMatrix
        ||args.defaultProjectionData.projectionTransition>0||this.map.getZoom()<MIN_ZOOM)return;
      const {origin,x,y,scale}=anchor,centre=this.map.getCenter();
      if(distanceMetres([centre.lng,centre.lat],origin)>MAX_RADIUS_M)return;
      const signs=structure.userData.signs;
      if(signs)updateAchievementSigns(signs,{zoom:this.map.getZoom(),distanceM:distanceMetres([centre.lng,centre.lat],this.getExhibitFocus()),
        bearing:this.map.getBearing?.()??42,pitch:this.map.getPitch?.()??54});
      // Re-evaluate centre altitude as DEM tiles settle. The court and trees
      // remain grounded without a perpetual repaint or animation timeline.
      const elevation=this.map.queryTerrainElevation?.(origin)??0;
      modelMatrix.makeTranslation(x,y,(elevation+.12)*scale)
        .multiply(axisMatrix).multiply(scaleMatrix.makeScale(scale,-scale,scale));
      this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(modelMatrix);
      this.renderer.resetState();this.renderer.render(this.scene,this.camera);
    },
    onRemove(){
      destroyed=true;abort?.abort();release();roofImagery=null;root=null;this.renderer?.dispose();this.renderer=null;
      this.scene=null;this.camera=null;this.map=null;notify(this);
    }
  };
  return layer;
}
