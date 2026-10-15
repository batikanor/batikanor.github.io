import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {galleryStationLinks} from '../src/galleryRoomLayout.js';
import {createGalleryRoomScene} from '../src/galleryRoomScene.js';
import {roomSafeArea,roomDockRectangle,roomCameraFov,surfaceCameraPlan,overviewCameraPlan,roomWalkingVector,roomTransitionDuration} from '../src/galleryRoomCamera.js';

const room=createGalleryRoomScene({scene:new THREE.Scene(),projects});
after(()=>room.dispose());
const viewports=[
  {width:1280,height:600},{width:1280,height:720},{width:1280,height:900},
  {width:1920,height:1080},{width:2148,height:1298},{width:2560,height:1440},
  {width:1000,height:1000},{width:1024,height:768},{width:901,height:650},
  {width:900,height:650},{width:800,height:500},{width:800,height:479},
  {width:700,height:1080},{width:768,height:1024},{width:700,height:479},
  {width:568,height:320},{width:390,height:844},{width:320,height:568},
  {width:390,height:480},{width:390,height:650,dockBounds:{top:366,left:16,right:236}}
];
function cameraFor(plan,{width,height}){
  const camera=new THREE.PerspectiveCamera(roomCameraFov(width),width/height,.08,170);
  camera.position.fromArray(plan.position);camera.lookAt(...plan.target);
  camera.setViewOffset(width,height,plan.viewOffset.x,plan.viewOffset.y,width,height);
  camera.updateMatrixWorld(true);return camera;
}
function projectFrame(surface,camera,{width,height},padding=2*(surface.framePadding??.08),depth=.1){
  const points=[];
  for(const x of[-1,1])for(const y of[-1,1])for(const z of[-depth,0]){
    const p=new THREE.Vector3(x*(surface.worldWidth+padding)/2,y*(surface.worldHeight+padding)/2,z)
      .applyEuler(new THREE.Euler(...surface.rotation)).add(new THREE.Vector3(...surface.position)).project(camera);
    points.push([(p.x+1)*width/2,(1-p.y)*height/2,p.z]);
  }
  return points;
}
function rectangle(points){return {left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0])),
  top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1]))};}
function overlaps(a,b){return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;}
function assertSafe(points,safe,{width,height},message){
  for(const [x,y,z]of points){
    assert.ok(x>=safe.left-.01&&x<=width-safe.right+.01,`${message}: horizontal ${x}`);
    assert.ok(y>=safe.top-.01&&y<=height-safe.bottom+.01,`${message}: vertical ${y}`);
    assert.ok(z>-1&&z<1,`${message}: depth ${z}`);
  }
}
function assertReaderInside(plan,station,message){
  for(let axis=0;axis<3;axis++)assert.ok(plan.position[axis]>=station.bounds.min[axis]&&plan.position[axis]<=station.bounds.max[axis],
    `${message}: reader axis${axis}=${plan.position[axis]} inside ${station.bounds.min[axis]}..${station.bounds.max[axis]}`);
}
function assertWall(station,viewport){
  const {width,height}=viewport,wall=station.wallLayout;
  assert.equal(wall.width,width);assert.equal(wall.height,height);
  const plan=overviewCameraPlan(station,viewport,roomCameraFov(width)),camera=cameraFor(plan,viewport);
  assert.deepEqual(plan.viewOffset,{x:0,y:0},'arrival sees the complete forward-facing wall');
  assert.equal(plan.position[0],plan.target[0]);assert.equal(plan.position[1],plan.target[1]);
  const header=wall.obstructions[0].height;
  for(const surface of station.components){
    assert.deepEqual(surface.rotation,[0,0,0],`${station.slug}/${surface.id} stays on the single front wall`);
    assert.equal(surface.position[2],wall.wallZ);
    const rect=wall.rects.find(rect=>rect.id===surface.id);
    assert.ok(rect,`${station.slug}/${surface.id} has a responsive pixel rectangle`);
    const aperture=rectangle(projectFrame(surface,camera,viewport,0,0));
    for(const [key,value]of Object.entries({left:rect.x,right:rect.x+rect.width,top:rect.y,bottom:rect.y+rect.height})){
      assert.ok(Math.abs(aperture[key]-value)<.01,`${station.slug}/${surface.id} maps exactly to ${key} at ${width}x${height}`);
    }
    const physical=projectFrame(surface,camera,viewport),box=rectangle(physical);
    assertSafe(physical,{left:0,right:0,top:header,bottom:0},viewport,`${station.slug}/${surface.id} arrival`);
    assert.ok(!overlaps(box,plan.dock),`${station.slug}/${surface.id} clears the complete left globe and navigation`);
    for(const obstruction of wall.obstructions??[]){
      const ui='left'in obstruction?obstruction:{left:obstruction.x,right:obstruction.x+obstruction.width,
        top:obstruction.y,bottom:obstruction.y+obstruction.height};
      assert.ok(!overlaps(box,ui),`${station.slug}/${surface.id} clears ${obstruction.id??'reserved UI'}`);
    }
  }
}

test('focused framing clears the larger left globe at portrait, tablet and short landscape breakpoints',()=>{
  for(const height of[480,568,620,621,740,741,844]){
    const globe=height<=620?144:height<=740?168:188,gap=height<=620?2:4,bottom=height<=620?10:height<=740?12:18;
    const safe=roomSafeArea(390,height,true);
    assert.ok(safe.bottom>=globe+58+gap+bottom);assert.ok(safe.top>=90);
    assert.deepEqual([safe.left,safe.right],[16,16]);
  }
  for(const [width,height,dockWidth,margin]of[[1280,900,336,28],[900,1000,280,20],[700,1080,280,20],[800,479,240,18],[568,320,188,16]]){
    const safe=roomSafeArea(width,height,true);assert.ok(safe.left>=dockWidth+margin+8);assert.ok(safe.right<=48);
  }
  assert.equal(roomSafeArea(479,479,true).bottom,214,'square phone matches CSS portrait orientation');
});

test('the compact phone chronology preserves the globe and full-location space at every responsive size',()=>{
  for(const [width,height,left,right,top,bottom]of[
    [1280,900,20,372,447,881],[900,1000,12,308,603,981],
    [800,600,12,308,263,581],[800,479,10,266,197,475],
    [568,320,8,212,130,318],[390,844,8,212,568,834],
    [390,650,8,212,400,646],[320,568,8,212,346,566]
  ]){
    assert.deepEqual(roomDockRectangle(width,height),{left,right,top,bottom},`${width}x${height}: the globe and complete chronology keep the responsive footprint`);
    const safe=roomSafeArea(width,height,true);
    if(width<700&&!(height<480&&width>height))assert.equal(height-safe.bottom,top+8,'a portrait approach ends above the complete visible dock');
    else assert.ok(safe.left>=right,'a wider approach stays beside the complete dock');
  }
});

test('actual inset dock bounds expand focused safe space and are shared with wall packing',()=>{
  assert.equal(roomSafeArea(390,650,true,{top:366,left:16,right:236}).bottom,284);
  assert.equal(roomSafeArea(1280,720,true,{right:390,top:275}).left,398);
  assert.deepEqual(roomDockRectangle(1280,900,{left:40,right:416,top:430,bottom:870}),{left:32,right:424,top:422,bottom:878});
});

test('wall camera maps the complete physical plane exactly without fitting an empty room',()=>{
  for(const viewport of viewports){
    const worldHeight=10.8,worldWidth=worldHeight*viewport.width/viewport.height;
    const station={anchor:[112,0,0],wallLayout:{worldHeight,worldWidth,wallZ:-2.72}};
    const plan=overviewCameraPlan(station,viewport,roomCameraFov(viewport.width)),camera=cameraFor(plan,viewport);
    const plane={worldWidth,worldHeight,position:[112,worldHeight/2,-2.72],rotation:[0,0,0]};
    const rect=rectangle(projectFrame(plane,camera,viewport,0,0));
    assert.ok(Math.abs(rect.left)<1e-8&&Math.abs(rect.top)<1e-8);
    assert.ok(Math.abs(rect.right-viewport.width)<1e-8&&Math.abs(rect.bottom-viewport.height)<1e-8);
    assert.deepEqual(plan.viewOffset,{x:0,y:0});
  }
});

test('all project boards are forward-visible, physically framed and UI-clear across twenty responsive wall layouts',()=>{
  const referenceProjects=projects.filter(project=>galleryStationLinks(project).length).length;
  for(const viewport of viewports){
    room.resize(viewport);
    let media=0,photos=0,references=0;
    for(const station of room.stations.values()){
      assertWall(station,viewport);
      assert.equal(station.components.filter(p=>p.kind==='story').length,1);
      assert.equal(station.components.filter(p=>p.kind==='link').length,0,'individual plaques have become one References panel');
      media+=station.components.filter(p=>p.kind==='media').length;
      photos+=station.components.filter(p=>p.photo).length;
      references+=station.components.filter(p=>p.kind==='references').length;
      assert.ok(station.components.filter(p=>p.kind==='references').length<=1);
    }
    assert.equal(media,66);assert.equal(photos,36);assert.equal(references,referenceProjects);
  }
});

test('every story, References panel, intrinsic photograph and playable screen keeps a clear native reading approach',()=>{
  for(const viewport of viewports){
    room.resize(viewport);
    for(const station of room.stations.values())for(const surface of station.components.filter(pose=>pose.kind!=='title')){
      const plan=surfaceCameraPlan(surface,viewport,roomCameraFov(viewport.width));
      assertSafe(projectFrame(surface,cameraFor(plan,viewport),viewport),plan.safe,viewport,
        `${station.slug}/${surface.id} focused at ${viewport.width}x${viewport.height}`);
      assertReaderInside(plan,station,`${station.slug}/${surface.id}`);
      assert.deepEqual(plan.target,surface.position);
      assert.equal(plan.position[0],surface.position[0]);assert.equal(plan.position[1],surface.position[1]);
      assert.ok(plan.position[2]>surface.position[2]);
    }
  }
});

test('wall layout and arrival camera account for a measured wider left dock and device bottom inset',()=>{
  const viewport={width:1280,height:900,dockBounds:{left:40,right:416,top:430,bottom:870}};
  room.resize(viewport);
  for(const station of room.stations.values())assertWall(station,viewport);
});

test('legacy station framing remains finite while walking direction and reduced motion stay correct',()=>{
  const plan=overviewCameraPlan({camera:[.75,4.3,12.3],lookAt:[0,4.2,-1.8]},{width:1280,height:900});
  assert.ok(plan.position.every(Number.isFinite));
  assert.deepEqual(roomWalkingVector(new Set(['w']),0),[0,0,-1]);
  assert.deepEqual(roomWalkingVector(new Set(['w','s']),0),[0,0,0]);
  assert.ok(Math.abs(Math.hypot(...roomWalkingVector(new Set(['w','d']),.7))-1)<1e-10);
  assert.equal(roomTransitionDuration(20,true),0);
  assert.ok(roomTransitionDuration(20)>roomTransitionDuration(1));
});
