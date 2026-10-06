import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {exhibitInspectionCamera,exhibitCameraHorizontalOffset} from '../src/exhibitInspectionCamera.js';
import {buildAchievementExhibit,disposeAchievementScene,selectExhibitRoof} from '../src/achievementSceneLayer.js';
import {planCapsuleAccessFoot,resolveCapsuleAccess} from '../src/achievementAccess.js';

/** Independent point projection matching installed Mercator/easeTo, not the fitter's tangent solution. */
function perspectiveFixture(camera,width,height){
  const fov=.6435011087932844,distance=height/2/Math.tan(fov/2),pitch=camera.pitch*Math.PI/180,bearing=camera.bearing*Math.PI/180;
  const sin=Math.sin(pitch),cos=Math.cos(pitch),yawSin=Math.sin(bearing),yawCos=Math.cos(bearing);
  const mpp=78271.51696*Math.cos(camera.center[1]*Math.PI/180)/2**camera.zoom,q=camera.offset[1];
  const shift=-q*distance/(distance*cos+q*sin);
  const horizontalShift=camera.offset[0]*(distance+shift*sin)/distance;
  return {mpp,groundShiftM:Math.hypot(shift,horizontalShift)*mpp,
    project(east,north,altitude){
      const n=shift+(east*yawSin+north*yawCos)/mpp,x=horizontalShift+(east*yawCos-north*yawSin)/mpp,z=altitude/mpp;
      const w=distance+n*sin-z*cos;
      return {x:width/2+distance*x/w,y:height/2-distance*(n*cos+z*sin)/w,w};
    }};
}
function sampledCapsuleBounds(camera,width,height,{scale=1,base=0}={}){
  const fixture=perspectiveFixture(camera,width,height),bounds={top:Infinity,bottom:-Infinity,left:Infinity,right:-Infinity};
  function include(east,north,y){const p=fixture.project(east,north,y);assert.ok(p.w>0,'every fitted capsule point must be in front of the camera');
    bounds.top=Math.min(bounds.top,p.y);bounds.bottom=Math.max(bounds.bottom,p.y);bounds.left=Math.min(bounds.left,p.x);bounds.right=Math.max(bounds.right,p.x);}
  // Sample the actual upper/lower silhouette plane independently of analytic
  // sphere tangencies, plus horizontal samples and projecting entrance/supports.
  const yaw=camera.bearing*Math.PI/180,pitch=camera.pitch*Math.PI/180,r=10.15*scale,c=base+11*scale;
  for(let i=0;i<1440;i++){
    const angle=i*Math.PI*2/1440,n=r*Math.cos(angle),y=c+r*Math.sin(angle);
    include(n*Math.sin(yaw),n*Math.cos(yaw),y);
    // Horizontal silhouette circle lies in the camera X/depth plane. The
    // off-axis globe is wider than a centred orthographic diameter estimate.
    const x=r*Math.cos(angle),depth=r*Math.sin(angle),along=depth*Math.sin(pitch);
    include(x*Math.cos(yaw)+along*Math.sin(yaw),-x*Math.sin(yaw)+along*Math.cos(yaw),c-depth*Math.cos(pitch));
  }
  for(let latitude=0;latitude<=20;latitude++)for(let azimuth=0;azimuth<40;azimuth++){
    const phi=latitude*Math.PI/20,theta=azimuth*Math.PI*2/40;
    include(r*Math.sin(phi)*Math.cos(theta),r*Math.sin(phi)*Math.sin(theta),c+r*Math.cos(phi));
  }
  function box(xs,ys,ns){for(const x of xs)for(const y of ys)for(const north of ns)include(x*scale,north*scale,base+y*scale);}
  box([-.75,.75],[.3,8.2],[-14.6,-9.2]);box([-1.7,1],[7.1,11.6],[-13.1,-10]);box([-4.4,4.4],[0,7],[-4.4,4.4]);
  return {...bounds,...fixture};
}
function assertPerspectiveFits(camera,width,height,options,label){
  const bounds=sampledCapsuleBounds(camera,width,height,options),usable=Math.max(220,Math.min((options.framingWidth??width)-64,780));
  const midpoint=width/2+(options.screenShiftX??0),inset=midpoint-usable/2;
  assert.ok(bounds.top>=72,`${label}: perspective crown behind header (${bounds.top})`);
  assert.ok(bounds.bottom<=height-112,`${label}: perspective ladder behind chronology (${bounds.bottom})`);
  assert.ok(bounds.left>=inset&&bounds.right<=midpoint+usable/2,`${label}: perspective globe/door outside safe width (${bounds.left}..${bounds.right})`);
  return bounds;
}




test('all 32 authored exhibits fit the available mobile and desktop viewport without changing their geographic centre',()=>{
  for(const project of contestsAndActivities){
    const centre=[project.mapData.coordinates.lng,project.mapData.coordinates.lat],original=[...centre];
    for(const width of [320,390,600,1024,1440]){
      const camera=exhibitInspectionCamera(centre,width),usable=Math.max(220,Math.min(width-64,780));
      assert.deepEqual(camera.center,original);assert.deepEqual(centre,original);
      assert.ok(Number.isFinite(camera.zoom));assert.ok(camera.zoom>=18.4);assert.ok(camera.zoom<=20.8);
      assert.equal(camera.pitch,54);assert.equal(camera.bearing,42);assert.deepEqual(camera.offset,[0,-32]);
      const metresPerPixel=156543.03392*Math.cos(centre[1]*Math.PI/180)/2**camera.zoom;
      assert.ok(55/metresPerPixel<=usable+1e-6,`${project.slug}: court crop at width${width}`);
    }
  }
});

test('raised capsule inspection fits actual perspective crowns and ladders on portrait and landscape viewports',()=>{
  for(const project of contestsAndActivities)for(const [width,height] of [[320,844],[390,844],[844,390],[1440,828]]){
    const center=[project.mapData.coordinates.lng,project.mapData.coordinates.lat];
    const camera=exhibitInspectionCamera(center,width,{height,exhibitHeightM:22});
    assertPerspectiveFits(camera,width,height,{},`${project.slug} ${width}x${height}`);
    assert.deepEqual(camera.center,center);assert.ok(Number.isFinite(camera.zoom));
  }
});

test('roof-supported crowns use real perspective fitting on short landscape screens',()=>{
  for(const [slug,base] of [['pdm-kill-the-search-bar-2026',15.15],['nasa-space-apps-zurich-2025',26.55],['draeger-2023',12.15]]){
    const project=contestsAndActivities.find(project=>project.slug===slug),center=[project.mapData.coordinates.lng,project.mapData.coordinates.lat];
    for(const [width,height] of [[320,568],[390,844],[844,390],[1440,828]]){
      const exhibitHeightM=base+21.15,camera=exhibitInspectionCamera(center,width,{height,exhibitHeightM,exhibitBaseM:base});
      const bounds=assertPerspectiveFits(camera,width,height,{base},`${slug} ${width}x${height}`);assert.deepEqual(camera.center,center);
    }
  }
});

test('four-times capsules fit actual perspective at every rooftop height without changing the legacy hero camera',()=>{
  for(const project of contestsAndActivities){
    const center=[project.mapData.coordinates.lng,project.mapData.coordinates.lat],scale=4;
    for(const base of [0,15.15,26.55,90.15,180,400])for(const [width,height] of [[320,568],[390,844],[844,390],[1024,500],[1440,828]]){
      const exhibitHeightM=base+84.6,camera=exhibitInspectionCamera(center,width,{height,exhibitHeightM,exhibitScale:scale,exhibitBaseM:base});
      const bounds=assertPerspectiveFits(camera,width,height,{scale,base},`${project.slug} ${width}x${height} roof${base}`);
      assert.deepEqual(camera.center,center);assert.ok(Number.isFinite(camera.zoom));assert.ok(Math.abs(camera.offset[1])<=height*.75);
    }
    const legacy=exhibitInspectionCamera(center,390),hero=exhibitInspectionCamera(center,390,{height:390,exhibitHeightM:0,exhibitScale:4,exhibitBaseM:400});
    assert.deepEqual(hero,legacy,'special radar framing must remain exactly unchanged');
  }
  const transformSource=readFileSync(new URL('../node_modules/maplibre-gl/src/geo/transform_helper.ts',import.meta.url),'utf8');
  const defaultFov=Number(transformSource.match(/this\._fovInRadians\s*=\s*([\d.]+)/)[1]);
  assert.equal(defaultFov,.6435011087932844,'revisit the fit if the installed MapLibre default projection changes');
});

test('real Tesla, Zero One and Real Coin geometry remains visible under the fitted perspective camera',()=>{
  for(const [slug,base] of [['tesla-gigathon-2026',13.15],['zero-one-hack-supercompute-industrial-2026',30.15],['real-coin-map-2025',90.15]]){
    const project=contestsAndActivities.find(project=>project.slug===slug),center=[project.mapData.coordinates.lng,project.mapData.coordinates.lat];
    const model=buildAchievementExhibit(slug);model.position.y=base;model.updateMatrixWorld(true);
    for(const [width,height] of [[320,568],[390,844],[844,390],[1440,828]])for(const screenShiftX of width>800?[0,-Math.min(390,width*.31),Math.min(390,width*.31)]:[0]){
      const framingWidth=Math.max(320,width-2*Math.abs(screenShiftX));
      const camera=exhibitInspectionCamera(center,framingWidth,{height,exhibitHeightM:base+84.6,exhibitScale:4,exhibitBaseM:base,screenShiftX});
      assertPerspectiveFits(camera,width,height,{scale:4,base,framingWidth,screenShiftX},`${slug} shifted${screenShiftX}`);
      const fixture=perspectiveFixture(camera,width,height);let tested=0;
      model.traverse(object=>{if(!object.isMesh)return;const positions=object.geometry.getAttribute('position'),m=object.matrixWorld.elements;
        for(let i=0;i<positions.count;i++){
          const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
          const p=fixture.project(m[0]*x+m[4]*y+m[8]*z+m[12],m[2]*x+m[6]*y+m[10]*z+m[14],m[1]*x+m[5]*y+m[9]*z+m[13]);
          assert.ok(p.w>0&&p.y>=72&&p.y<=height-112&&p.x>=16&&p.x<=width-16,`${slug}: actual model vertex cropped in ${width}x${height} shift${screenShiftX}`);tested++;
        }
      });assert.ok(tested>10_000);
    }
    disposeAchievementScene(model);
  }
});

test('popup-side rooftop framing solves the raised silhouette shift instead of applying a magnified ground offset',()=>{
  const center=[13.5,52.4],scale=4;
  for(const base of [0,30.15,90.15,180,400])for(const [width,height] of [[320,568],[390,844],[844,390],[1440,828]]){
    const shifts=width>800?[0,-Math.min(390,width*.31),Math.min(390,width*.31)]:[0];
    for(const screenShiftX of shifts){
      const framingWidth=Math.max(320,width-2*Math.abs(screenShiftX)),options={height,exhibitHeightM:base+84.6,exhibitScale:scale,exhibitBaseM:base,screenShiftX};
      const camera=exhibitInspectionCamera(center,framingWidth,options);
      const bounds=assertPerspectiveFits(camera,width,height,{scale,base,framingWidth,screenShiftX},`roof${base} ${width}x${height} shift${screenShiftX}`);
      assert.ok(bounds.left>=16&&bounds.right<=width-16,'the visible pane must remain on the actual canvas');
      if(screenShiftX)assert.ok(Math.abs(camera.offset[0])<Math.abs(screenShiftX),'the raised silhouette needs a smaller ground offset, not the old raw popup shift');
    }
  }
});

test('horizontal offset is recalculated at the final native-quality zoom rather than retaining the fit-camera magnification',()=>{
  const center=[13.5,52.4],width=1440,height=828,scale=4,screenShiftX=-390;
  for(const base of [13.15,30.15,90.15,180,400]){
    const options={height,exhibitHeightM:base+84.6,exhibitScale:scale,exhibitBaseM:base,screenShiftX};
    const fitted=exhibitInspectionCamera(center,width-2*Math.abs(screenShiftX),options);
    for(const zoomDrop of [0,.5,1,2]){
      const camera={...fitted,zoom:fitted.zoom-zoomDrop,offset:[0,fitted.offset[1]]};
      camera.offset[0]=exhibitCameraHorizontalOffset(camera,options);
      const project=perspectiveFixture(camera,width,height).project,yaw=camera.bearing*Math.PI/180,pitch=camera.pitch*Math.PI/180;
      let left=Infinity,right=-Infinity;
      for(let i=0;i<1440;i++){
        const angle=i*Math.PI*2/1440,x=40.6*Math.cos(angle),depth=40.6*Math.sin(angle),n=depth*Math.sin(pitch);
        const point=project(x*Math.cos(yaw)+n*Math.sin(yaw),-x*Math.sin(yaw)+n*Math.cos(yaw),base+44-depth*Math.cos(pitch));
        left=Math.min(left,point.x);right=Math.max(right,point.x);
      }
      assert.ok(Math.abs((left+right)/2-(width/2+screenShiftX))<.001,'final perspective silhouette must remain centred in the visible pane after a native zoom cap');
      if(zoomDrop)assert.ok(Math.abs(camera.offset[0]-fitted.offset[0])>1,'native zoom changes must recompute the raw ground offset');
    }
  }
});

test('adaptive exterior bridge and full ground-reaching ladder fit inspection on every existing roof, including portrait and short landscape',()=>{
  const data=JSON.parse(readFileSync(new URL('../public/data/achievement-context-v2.json',import.meta.url)));
  for(const chapter of data.chapters){
    const host=selectExhibitRoof(chapter),plan=planCapsuleAccessFoot({hostRing:host.building.ring,site:host.site,nearbyBuildings:chapter.buildings});
    const base=host.building.height+.15,layout=resolveCapsuleAccess({roofBaseM:base,groundFootDeltaM:-.12,groundRailDeltasM:[-.12,-.12],footOffsetM:plan.footOffsetM});
    for(const [width,height]of [[1512,828],[390,844],[844,390]]){
      const options={scale:4,base},camera=exhibitInspectionCamera(chapter.origin,width,{height,exhibitScale:4,exhibitBaseM:base,exhibitHeightM:base+84.6,exhibitAccessBounds:layout.extents});
      const bounds=assertPerspectiveFits(camera,width,height,options,`${chapter.slugs[0]} ${width}×${height}`),fixture=perspectiveFixture(camera,width,height);
      for(const x of [layout.extents.min[0],layout.extents.max[0]])for(const y of [layout.extents.min[1],layout.extents.max[1]])for(const z of [layout.extents.min[2],layout.extents.max[2]]){
        const point=fixture.project(x*4,z*4,base+y*4);assert.ok(point.w>0);assert.ok(point.y>=72&&point.y<=height-112,'ground access must clear header and chronology');assert.ok(point.x>=16&&point.x<=width-16,'outside landing must fit available width');
      }
      assert.ok(Number.isFinite(bounds.groundShiftM));
    }
  }
});
