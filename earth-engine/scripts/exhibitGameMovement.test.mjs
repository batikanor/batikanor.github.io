import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {createAchievementSceneLayer} from '../src/achievementSceneLayer.js';
import {createHeroVenueLayer,HERO_VENUE_EVENT,HERO_VENUE_LOCATION} from '../src/heroVenueLayer.js';
import {exhibitGameCamera} from '../src/exhibitGameCamera.js';

const achievements=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url)));
const bearings=[0,42,90,180,-90];
const directions=[
  {name:'W / ArrowUp',input:{x:0,z:-1},axis:'y',sign:-1},
  {name:'D / ArrowRight',input:{x:1,z:0},axis:'x',sign:1},
  {name:'S / ArrowDown',input:{x:0,z:1},axis:'y',sign:1},
  {name:'A / ArrowLeft',input:{x:-1,z:0},axis:'x',sign:-1},
];

// Independent MapLibre Mercator clip projection: perspective, screen-Y flip,
// pitch, public bearing, geographic centre, then normalized Mercator scaling.
// Apply this to the actual custom layer's reflected/nonreflected scene matrix.
function mercatorProjection(center,bearing,{width=1512,height=828,hero=false}={}){
  const fitted=exhibitGameCamera(center,width,{height,hero}),{pitch,zoom}=fitted;
  const merc=maplibregl.MercatorCoordinate.fromLngLat(center,7),worldSize=512*2**zoom;
  const fov=.6435011087932844,distance=height/2/Math.tan(fov/2);
  const angle=pitch*Math.PI/180,yaw=bearing*Math.PI/180;
  const mpp=78271.51696*Math.cos(center[1]*Math.PI/180)/2**zoom;
  const offset=fitted.offset[1],shift=-offset*distance/(distance*Math.cos(angle)+offset*Math.sin(angle));
  const horizontal=fitted.offset[0]*(distance+shift*Math.sin(angle))/distance;
  const units=merc.meterInMercatorCoordinateUnits();
  // easeTo offsets the geographic ground target, including terrain elevation.
  const x=merc.x-(horizontal*Math.cos(yaw)+shift*Math.sin(yaw))*mpp*units;
  const y=merc.y+(-horizontal*Math.sin(yaw)+shift*Math.cos(yaw))*mpp*units;
  const camera=new THREE.PerspectiveCamera(fov*180/Math.PI,width/height,.1,1e7);
  return camera.projectionMatrix.clone()
    .multiply(new THREE.Matrix4().makeScale(1,-1,1))
    .multiply(new THREE.Matrix4().makeTranslation(0,0,-distance))
    .multiply(new THREE.Matrix4().makeRotationX(pitch*Math.PI/180))
    .multiply(new THREE.Matrix4().makeRotationZ(-bearing*Math.PI/180))
    .multiply(new THREE.Matrix4().makeTranslation(-x*worldSize,-y*worldSize,-merc.z*worldSize))
    .multiply(new THREE.Matrix4().makeScale(worldSize,worldSize,worldSize));
}

function fixture(center){
  const map={center:{lng:center[0],lat:center[1]},bearing:0,getZoom:()=>20,getPitch:()=>54,
    getCenter(){return this.center;},getBearing(){return this.bearing;},
    queryTerrainElevation:()=>7,triggerRepaint(){}};
  const renderer={resetState(){},render(scene){scene.updateMatrixWorld(true);},dispose(){}};
  return {map,renderer};
}

function assertScreenTravel(layer,map,slug,clock,{hero=false}={}){
  for(const bearing of bearings){
    map.bearing=bearing;
    const projection=mercatorProjection([map.center.lng,map.center.lat],bearing,{hero});
    const args={defaultProjectionData:{mainMatrix:projection.toArray(),projectionTransition:0}};
    for(const direction of directions){
      layer.resetGame();layer.gameInput({...direction.input,activate:false});
      layer.render({},args);
      const actor=layer.scene.getObjectByName('game-object:actor');
      assert.ok(actor,`${slug}: missing real rendered actor`);
      const before=actor.getWorldPosition(new THREE.Vector3());
      for(let frame=0;frame<18;frame++){clock.now+=1000/60;layer.render({},args);}
      const after=actor.getWorldPosition(new THREE.Vector3());
      const worldTravel=after.clone().sub(before).toArray();
      // Flight/trace gates adjust altitude independently of the movement key.
      // Compare ground-plane travel at equal height to isolate key direction.
      before.y=after.y;
      const from=before.applyMatrix4(layer.camera.projectionMatrix);
      const to=after.applyMatrix4(layer.camera.projectionMatrix);
      const delta={x:to.x-from.x,y:from.y-to.y}; // browser pixels grow down
      const primary=delta[direction.axis]*direction.sign,secondary=Math.abs(delta[direction.axis==='x'?'y':'x']);
      assert.ok(Number.isFinite(primary)&&primary>1e-6,
        `${slug} bearing ${bearing}: ${direction.name} moves opposite its screen direction (${JSON.stringify(delta)}); world travel=${worldTravel}`);
      assert.ok(primary>secondary,
        `${slug} bearing ${bearing}: ${direction.name} moves primarily across the wrong screen axis (${JSON.stringify(delta)})`);
    }
  }
}

test('all 32 achievement games map WASD/arrows to actual screen travel at default and rotated public camera bearings',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance'),clock={now:0};
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock.now}});
  let layer;
  try{
    const first=achievements[0].coordinates,{map,renderer}=fixture([first.lng,first.lat]);
    layer=createAchievementSceneLayer({achievements,rendererFactory:()=>renderer});
    layer.setFocus(achievements[0].slug);layer.onAdd(map,{});
    assert.equal(achievements.length,32);
    for(const event of achievements){
      layer.setFocus(event.slug);map.center=event.coordinates;
      assert.equal(await layer.startGame(event.slug),true);
      assertScreenTravel(layer,map,event.slug,clock);layer.stopGame();
    }
  }finally{layer?.onRemove();Object.defineProperty(globalThis,'performance',descriptor);}
});

test('Hero south-z games preserve the same visible WASD/arrows directions without using the reflected achievement basis',async()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'performance'),clock={now:0};
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>clock.now}});
  let layer;
  try{
    const {map,renderer}=fixture(HERO_VENUE_LOCATION);
    layer=createHeroVenueLayer({rendererFactory:()=>renderer});layer.onAdd(map,{});layer.setActive(true);
    assert.equal(await layer.startGame(HERO_VENUE_EVENT),true);
    assertScreenTravel(layer,map,HERO_VENUE_EVENT,clock,{hero:true});
  }finally{layer?.onRemove();Object.defineProperty(globalThis,'performance',descriptor);}
});
