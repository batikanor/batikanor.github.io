import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {createGalleryRoomScene,GALLERY_ROOM_LAYOUT} from '../src/galleryRoomScene.js';
import {galleryStationComponents} from '../src/galleryRoomLayout.js';
import {overviewCameraPlan,roomCameraFov} from '../src/galleryRoomCamera.js';

const sizes=[[1280,900],[1280,720],[1920,1080],[1024,768],[700,1080],[390,844],[320,568],[568,320]];
function arrival(station,width,height){
  const fov=roomCameraFov(width),plan=overviewCameraPlan(station,{width,height},fov);
  const camera=new THREE.PerspectiveCamera(fov,width/height,.08,170);
  camera.position.fromArray(plan.position);camera.lookAt(...plan.target);camera.updateMatrixWorld(true);
  assert.deepEqual(plan.viewOffset,{x:0,y:0});return camera;
}
function projected(box,camera){
  const bounds=new THREE.Box2();
  for(const x of[box.min.x,box.max.x])for(const y of[box.min.y,box.max.y])for(const z of[box.min.z,box.max.z]){
    const p=new THREE.Vector3(x,y,z).project(camera);bounds.expandByPoint(new THREE.Vector2(p.x,p.y));
  }
  return bounds;
}

test('all 32 stations expose one viewport-sized frontal wall and exact physical surface metadata',()=>{
  const scene=new THREE.Scene(),room=createGalleryRoomScene({scene,projects});
  assert.equal(room.stations.size,32);assert.equal(scene.children[0],room.root);
  let index=0,count=0;
  for(const project of projects){
    const station=room.stations.get(project.slug),expected=galleryStationComponents(project);
    assert.equal(station.spacing,station.wallLayout.worldWidth+GALLERY_ROOM_LAYOUT.stationGap);
    assert.deepEqual(station.anchor,[index++*station.spacing,0,0]);
    assert.equal(station.surfaces,station.contentSurfaces);assert.deepEqual(station.components,Object.values(station.surfaces));
    assert.deepEqual(station.components.map(pose=>pose.id),expected.map(pose=>pose.id));
    assert.deepEqual(station.frontObjects.map(object=>object.id),station.components.map(pose=>pose.id));
    assert.equal(station.frontBounds,station.wallBounds,'arrival bounds contain the wall rather than offscreen sculpture');
    for(const pose of station.components){
      assert.deepEqual(pose.rotation,[0,0,0]);assert.equal(pose.position[2],-2.72);
      assert.ok(pose.position[1]-pose.worldHeight/2-pose.framePadding>0);
      assert.ok(pose.position[1]+pose.worldHeight/2+pose.framePadding<GALLERY_ROOM_LAYOUT.ceiling);
      assert.ok(Math.abs(pose.worldHeight-pose.worldWidth*pose.height/pose.width)<1e-9);
      count++;
    }
  }
  assert.equal(count,156,'titles, stories, 66 originals and 26 References boards are present');room.dispose();
});

test('station, surface and mask identities survive responsive reflow without accumulating geometry',()=>{
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});
  const station=room.stations.values().next().value,surface=station.surfaces.story;
  const mask=room.raycastable.find(mesh=>mesh.userData.surface==='story'&&mesh.userData.part==='aperture');
  const baseline=room.getStats(),initial=surface.pixelRect;
  let retired=0;
  const bay=room.root.getObjectByName(`gallery-station-${station.slug}`),fittings=bay.getObjectByName('gallery-architecture');
  for(const mesh of fittings.children)mesh.geometry.addEventListener('dispose',()=>retired++);
  assert.equal(room.resize({width:390,height:844}),true);
  assert.equal(room.stations.get(station.slug),station);assert.equal(station.surfaces.story,surface);
  assert.equal(room.raycastable.find(mesh=>mesh.userData.surface==='story'&&mesh.userData.part==='aperture'),mask);
  assert.notDeepEqual(surface.pixelRect,initial);assert.equal(retired,6,'old physical fittings are disposed once');
  const unchanged=room.getStats();assert.equal(room.resize({width:390,height:844}),false);assert.deepEqual(room.getStats(),unchanged);
  for(let cycle=0;cycle<3;cycle++)for(const[width,height]of sizes){
    room.resize({width,height});const stats=room.getStats();
    assert.equal(stats.geometries,baseline.geometries);assert.equal(stats.materials,baseline.materials);assert.equal(stats.textures,baseline.textures);
    for(const pose of station.components){
      const aperture=room.raycastable.find(mesh=>mesh.userData.surface===pose.id&&mesh.userData.part==='aperture');
      assert.deepEqual(aperture.getWorldPosition(new THREE.Vector3()).toArray(),pose.position);
      assert.deepEqual(aperture.scale.toArray(),[pose.worldWidth,pose.worldHeight,1]);
    }
  }
  room.dispose();assert.equal(room.resize({width:1280,height:900}),false);
});

test('active and immediate neighboring walls expose aligned apertures and native pick faces across all switches',()=>{
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects,reducedMotion:true});
  for(const project of projects){
    room.setActive(project.slug);const station=room.stations.get(project.slug);
    const masks=room.raycastable.filter(mesh=>mesh.userData.part==='aperture');
    const visible=[...room.stations.values()].filter(candidate=>Math.abs(candidate.index-station.index)<=GALLERY_ROOM_LAYOUT.visibleRadius);
    assert.deepEqual(room.visibleSlugs,visible.map(candidate=>candidate.slug));
    assert.equal(masks.length,visible.reduce((sum,candidate)=>sum+candidate.components.length,0));
    assert.ok(room.raycastable.every(mesh=>room.visibleSlugs.includes(mesh.userData.gallerySlug)));
    for(const mask of masks){
      const pose=room.stations.get(mask.userData.gallerySlug).surfaces[mask.userData.surface];
      assert.equal(mask.material.opacity,0);assert.equal(mask.material.depthWrite,true);assert.equal(mask.material.blending,THREE.NoBlending);
      assert.deepEqual(mask.getWorldPosition(new THREE.Vector3()).toArray(),pose.position);
      const pick=room.raycastable.find(mesh=>mesh.userData.gallerySlug===mask.userData.gallerySlug&&mesh.userData.surface===pose.id&&mesh.userData.part==='frame');
      assert.deepEqual(pick.scale.toArray(),[pose.worldWidth+pose.framePadding*2,pose.worldHeight+pose.framePadding*2,1]);
    }
    let visibleMasks=0;room.root.traverseVisible(node=>{if(node.name==='active-content-apertures')visibleMasks++;});assert.equal(visibleMasks,visible.length);
    const story=station.surfaces.story,origin=new THREE.Vector3(...story.position).add(new THREE.Vector3(0,0,10));
    const ray=new THREE.Raycaster(origin,new THREE.Vector3(...story.position).sub(origin).normalize());
    assert.equal(ray.intersectObjects(room.raycastable,false)[0].object.userData.surface,'story');
    for(const neighbor of visible){
      const face=neighbor.surfaces.story,source=new THREE.Vector3(...face.position).add(new THREE.Vector3(0,0,10));
      const hit=new THREE.Raycaster(source,new THREE.Vector3(0,0,-1)).intersectObjects(room.raycastable,false)[0];
      assert.equal(hit.object.userData.gallerySlug,neighbor.slug,'neighbor boards can be picked before changing the active project');
    }
    assert.equal(room.update(1,1/60,project.slug),false);
  }
  room.dispose();
});

test('flush corridor tiles, gap sculptures and global walk bounds connect every adjacent project without barriers',()=>{
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});
  const bounds=room.walkBounds;let crossings=0;
  for(const [width,height]of sizes){
    room.resize({width,height});assert.equal(room.walkBounds,bounds,'controller retains the same global bounds object');
    const all=[...room.stations.values()];
    for(const [index,station]of all.entries()){
      assert.equal(room.stationAtPosition(station.anchor[0]),station);
      assert.ok(station.bounds.min[0]>=bounds.min[0]&&station.bounds.max[0]<=bounds.max[0]);
      const bay=room.root.getObjectByName(`gallery-station-${station.slug}`);
      const figure=bay.getObjectByName(`gallery-sculpture-${station.slug}`),sculptureBox=new THREE.Box3().setFromObject(figure);
      const nicheLeft=station.wallBounds.max[0],nicheRight=nicheLeft+GALLERY_ROOM_LAYOUT.stationGap;
      assert.ok(sculptureBox.min.x>nicheLeft&&sculptureBox.max.x<nicheRight,'complete sculpture stays in the gap between display walls');
      if(index===all.length-1)continue;
      const next=all[index+1],midpoint=(station.anchor[0]+next.anchor[0])/2;
      assert.ok(Math.abs(next.wallBounds.min[0]-station.wallBounds.max[0]-GALLERY_ROOM_LAYOUT.stationGap)<1e-9);
      assert.equal(room.stationAtPosition(midpoint-.001),station);assert.equal(room.stationAtPosition(midpoint),next);
      room.setActive(station.slug);
      for(const name of['gallery-floor','gallery-ceiling']){
        const tile=bay.getObjectByName('gallery-architecture').children.find(mesh=>mesh.material.name===name);
        const adjacent=room.root.getObjectByName(`gallery-station-${next.slug}`).getObjectByName('gallery-architecture').children.find(mesh=>mesh.material.name===name);
        const a=new THREE.Box3().setFromObject(tile),b=new THREE.Box3().setFromObject(adjacent);
        assert.ok(Math.abs(a.max.x-b.min.x)<1e-5,'floor and ceiling tiles meet without gaps or overlapping rooms');
      }
      const camera=arrival(station,width,height),target=arrival(next,width,height).position;
      const direction=target.clone().sub(camera.position),distance=direction.length(),meshes=[];
      room.root.traverseVisible(node=>{if(node.isMesh)meshes.push(node);});
      const hits=new THREE.Raycaster(camera.position,direction.normalize(),.01,distance-.01).intersectObjects(meshes,false);
      assert.equal(hits.length,0,'the complete strafe path to the next arrival has no side wall, plinth or sculpture barrier');crossings++;
    }
    assert.equal(room.stationAtPosition(-Infinity),all[0]);assert.equal(room.stationAtPosition(Infinity),all.at(-1));
  }
  assert.equal(crossings,(projects.length-1)*sizes.length);room.dispose();
  assert.equal(room.stationAtPosition(0),null);assert.deepEqual(room.visibleSlugs,[]);
});

test('all original apertures map to their intended screen rectangles after native station resize',()=>{
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});
  for(const[width,height]of sizes){
    room.resize({width,height});
    for(const project of projects){
      const station=room.stations.get(project.slug),camera=arrival(station,width,height);
      for(const pose of station.components){
        for(const x of[-1,1])for(const y of[-1,1]){
          const p=new THREE.Vector3(pose.position[0]+x*pose.worldWidth/2,pose.position[1]+y*pose.worldHeight/2,pose.position[2]).project(camera);
          assert.ok(Math.abs((p.x+1)*width/2-(pose.pixelRect.x+(x+1)*pose.pixelRect.width/2))<1e-6);
          assert.ok(Math.abs((1-p.y)*height/2-(pose.pixelRect.y+(1-y)*pose.pixelRect.height/2))<1e-6);
        }
      }
    }
  }
  room.dispose();
});

test('room structure never obstructs any interior display sightline and complete sculptures remain outside arrival',()=>{
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});let checked=0;
  for(const[width,height]of [[1280,900],[1024,768],[390,844],[568,320]]){
    room.resize({width,height});
    for(const project of projects){
      room.setActive(project.slug);const station=room.stations.get(project.slug),camera=arrival(station,width,height),walls=[];
      room.root.traverseVisible(node=>{if(node.isMesh&&(['gallery-plaster','gallery-ceiling','gallery-floor'].includes(node.material.name)||node.material.map))walls.push(node);});
      for(const pose of station.components)for(const x of[-.8,0,.8])for(const y of[-.8,0,.8]){
        const target=new THREE.Vector3(pose.position[0]+x*pose.worldWidth/2,pose.position[1]+y*pose.worldHeight/2,pose.position[2]+.002);
        const direction=target.clone().sub(camera.position),distance=direction.length();
        const hits=new THREE.Raycaster(camera.position,direction.normalize(),.01,distance-.01).intersectObjects(walls,false);
        assert.equal(hits.length,0,`${project.slug}/${pose.id} clears structural fittings at ${width}x${height}`);checked++;
      }
      for(const visibleSlug of room.visibleSlugs){
        const figure=room.root.getObjectByName(`gallery-sculpture-${visibleSlug}`),bounds=new THREE.Box3().setFromObject(figure);
        assert.ok(bounds.min.y>=.6,'original illustrative models retain their plinth');
        assert.equal(projected(bounds,camera).intersectsBox(new THREE.Box2(new THREE.Vector2(-1,-1),new THREE.Vector2(1,1))),false,
          `${visibleSlug} sculpture stays outside ${project.slug}'s full arrival wall`);
      }
    }
  }
  assert.equal(checked,156*9*4);room.dispose();
});

test('cohesive shared materials and bounded geometry remain stable while switching and resizing walls',()=>{
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});let maxDraws=0,maxTriangles=0;
  for(const[width,height]of sizes){
    room.resize({width,height});
    for(const project of projects){
      room.setActive(project.slug);const stats=room.getStats();maxDraws=Math.max(maxDraws,stats.drawCalls);maxTriangles=Math.max(maxTriangles,stats.triangles);
      assert.ok(stats.visibleStations<=3&&stats.drawCalls<=64&&stats.triangles<32_000&&stats.textures<=1,JSON.stringify(stats));
    }
  }
  room.root.traverse(node=>{
    if(!node.isMesh||!['gallery-plaster','gallery-floor','gallery-ceiling'].includes(node.material.name))return;
    assert.equal(node.material.vertexColors,true);assert.ok([...node.geometry.getAttribute('color').array].every(Number.isFinite));
    assert.equal(node.castShadow,false,'architecture retains soft sculpture-only contact shadows');
  });
  assert.ok(maxDraws>15&&maxTriangles>2000);room.dispose();
});

test('disposal remains idempotent after resized geometry and preserves host resources and original fog',()=>{
  const scene=new THREE.Scene(),fog=new THREE.Fog(0,10,20);scene.fog=fog;
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),host=new THREE.Mesh(geometry,material);scene.add(host);
  let hostDisposals=0;geometry.addEventListener('dispose',()=>hostDisposals++);material.addEventListener('dispose',()=>hostDisposals++);
  const room=createGalleryRoomScene({scene,projects});room.resize({width:390,height:844});
  const resources=new Set();room.root.traverse(node=>{if(node.isMesh){resources.add(node.geometry);resources.add(node.material);}});
  const counts=new Map();for(const resource of resources){counts.set(resource,0);resource.addEventListener('dispose',()=>counts.set(resource,counts.get(resource)+1));}
  room.dispose();room.dispose();assert.deepEqual(scene.children,[host]);assert.equal(scene.fog,fog);assert.equal(hostDisposals,0);
  assert.ok([...counts.values()].every(count=>count===1));assert.deepEqual(room.raycastable,[]);assert.equal(room.getStats().destroyed,true);
  geometry.dispose();material.dispose();
});

test('the removed corner engraving creates no atlas or mapped plaque on creation and reflow',t=>{
  const original=globalThis.document;
  globalThis.document={createElement(){throw new Error('The room must not allocate a station-number atlas');}};
  t.after(()=>{if(original===undefined)delete globalThis.document;else globalThis.document=original;});
  const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});
  for(const [width,height]of[[1280,900],[390,844]]){
    room.resize({width,height});assert.equal(room.getStats().textures,0);
    room.root.traverse(node=>{if(node.isMesh)assert.equal(node.material.map,null,'no engraved station/city texture remains');});
    for(const station of room.stations.values())assert.ok(station.surfaces.title,'the physical project-title board remains');
  }
  room.dispose();room.dispose();
});

test('invalid or duplicate station inputs are rejected before adding scene objects',()=>{
  const scene=new THREE.Scene();
  for(const value of[[],[{slug:'duplicate'},{slug:'duplicate'}],Array.from({length:33},(_,i)=>({slug:String(i)})),[{}]])
    assert.throws(()=>createGalleryRoomScene({scene,projects:value}),/unique project/);
  assert.equal(scene.children.length,0);
});
