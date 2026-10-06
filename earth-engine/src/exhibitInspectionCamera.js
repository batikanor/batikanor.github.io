function groundOffsetForSilhouette(screenShiftX,distance,shift,depth,radius,sin) {
  return screenShiftX*(depth*depth-radius*radius)/((distance+shift*sin)*depth);
}

/** Convert a raised globe's desired screen shift to MapLibre's ground offset. */
export function exhibitCameraHorizontalOffset(camera,{height=800,exhibitScale=1,exhibitBaseM=0,screenShiftX=0}={}) {
  const radians=camera.pitch*Math.PI/180,sin=Math.sin(radians),cos=Math.cos(radians),distance=1.5*height;
  const mpp=78271.51696*Math.cos(camera.center[1]*Math.PI/180)/2**camera.zoom;
  const scale=Math.max(1,exhibitScale),base=Math.max(0,exhibitBaseM),q=camera.offset?.[1]??0;
  const shift=-q*distance/(distance*cos+q*sin),radius=10.15*scale/mpp;
  const depth=distance+shift*sin-(base+11*scale)/mpp*cos;
  return groundOffsetForSilhouette(screenShiftX,distance,shift,depth,radius,sin);
}

/** Framing of the exhibit, not a claim of finer ground-image sampling. */
export function exhibitInspectionCamera(center,width,{height=800,exhibitHeightM=0,exhibitScale=1,exhibitBaseM=0,screenShiftX=0,exhibitAccessBounds=null}={}) {
  const usableWidth=Math.max(220,Math.min(width-64,780));
  const pitch=54,bearing=42,radians=pitch*Math.PI/180;
  const worldMpp=exhibitHeightM>0?78271.51696:156543.03392;
  if(exhibitHeightM<=0)return {center,zoom:Math.min(20.8,Math.log2(worldMpp*Math.cos(center[1]*Math.PI/180)*usableWidth/55)),
    pitch,bearing,offset:[0,-32]};
  const scale=Math.max(1,exhibitScale),base=Math.max(0,exhibitBaseM);
  const sin=Math.sin(radians),cos=Math.cos(radians),yaw=bearing*Math.PI/180;
  // Installed MapLibre's vertical FOV is 2*atan(1/3), hence D=1.5*height.
  // easeTo's offset relocates the ground target; it is not a post-projection
  // translation. Solve that perspective camera and offset together, once on
  // inspection, instead of using an orthographic margin that crops tall roofs.
  const distance=1.5*height,radius=10.15*scale,globeY=base+11*scale;
  const points=[];
  function corners(xs,ys,ns){for(const x of xs)for(const y of ys)for(const north of ns)points.push([
    x*Math.sin(yaw)+north*Math.cos(yaw),x*Math.cos(yaw)-north*Math.sin(yaw),base+y]);}
  // The globe bounds every inside demonstration/sign and the crown cradle.
  // Add the projecting door, full ladder and lower supporting shoes/mast.
  corners([-.75*scale,.75*scale],[.3*scale,8.2*scale],[-14.6*scale,-9.2*scale]);
  corners([-1.7*scale,1*scale],[7.1*scale,11.6*scale],[-13.1*scale,-10*scale]);
  corners([-4.4*scale,4.4*scale],[0,7*scale],[-4.4*scale,4.4*scale]);
  if(exhibitAccessBounds?.min?.length===3&&exhibitAccessBounds?.max?.length===3
    &&[...exhibitAccessBounds.min,...exhibitAccessBounds.max].every(Number.isFinite)){
    const {min,max}=exhibitAccessBounds;
    corners([min[0]*scale,max[0]*scale],[min[1]*scale,max[1]*scale],[min[2]*scale,max[2]*scale]);
  }
  function projectedBounds(mpp,offset) {
    const shift=-offset*distance/(distance*cos+offset*sin),r=radius/mpp,c=globeY/mpp;
    const vertical=-(shift*cos+c*sin),depth=distance+shift*sin-c*cos;
    if(depth<=r)return null;
    const denominator=depth*depth-r*r,root=Math.sqrt(vertical*vertical+denominator);
    // The ground offset is magnified at roof height. Solve the projected
    // silhouette's centre, including its wider off-axis perspective ellipse.
    const offsetX=groundOffsetForSilhouette(screenShiftX,distance,shift,depth,r,sin);
    const horizontal=offsetX*(distance+shift*sin)/distance;
    const horizontalRoot=Math.sqrt(horizontal*horizontal+denominator);
    const bounds={top:height/2+distance*(vertical*depth-r*root)/denominator,
      bottom:height/2+distance*(vertical*depth+r*root)/denominator,
      left:width/2+distance*(horizontal*depth-r*horizontalRoot)/denominator,
      right:width/2+distance*(horizontal*depth+r*horizontalRoot)/denominator};
    for(const [north,x,y] of points){
      const n=shift+north/mpp,z=y/mpp,w=distance+n*sin-z*cos;
      if(w<=0)return null;
      const screenX=width/2+distance*(horizontal+x/mpp)/w,screenY=height/2-distance*(n*cos+z*sin)/w;
      bounds.top=Math.min(bounds.top,screenY);bounds.bottom=Math.max(bounds.bottom,screenY);
      bounds.left=Math.min(bounds.left,screenX);bounds.right=Math.max(bounds.right,screenX);
    }
    return bounds;
  }
  const safeTop=74,safeBottom=height-114,safeMiddle=(safeTop+safeBottom)/2;
  function fitAt(mpp) {
    // Keep every tested point in front of the perspective camera throughout
    // the offset search. The bounded offset also avoids unbounded map pans.
    let forward=(globeY*cos+radius)/mpp;
    for(const [north,,y] of points)forward=Math.max(forward,(y*cos-north*sin)/mpp);
    let low=-height*.25,high=Math.min(height*.75,(distance*distance*cos/(forward+1)-distance*cos)/sin);
    if(high<low)return null;
    for(let i=0;i<24;i++){
      const middle=(low+high)/2,bounds=projectedBounds(mpp,middle);
      if(!bounds)return null;
      if((bounds.top+bounds.bottom)/2<safeMiddle)low=middle;else high=middle;
    }
    const offset=(low+high)/2,bounds=projectedBounds(mpp,offset),inset=(width-usableWidth)/2;
    return {mpp,offset,fits:!!bounds&&bounds.top>=safeTop&&bounds.bottom<=safeBottom
      &&bounds.left-screenShiftX>=inset&&bounds.right-screenShiftX<=width-inset};
  }
  // Keeping the camera above the complete installation makes the offset
  // solution monotonic; then refine the closest fitting zoom with bounded work.
  let low=Math.max(38*scale/usableWidth,Math.max(exhibitHeightM,globeY+radius)/(distance*cos)*1.05),high=low;
  let fitted=fitAt(high);
  for(let i=0;i<32&&(!fitted||!fitted.fits);i++){high*=1.25;fitted=fitAt(high);}
  for(let i=0;i<20;i++){
    const middle=(low+high)/2,result=fitAt(middle);
    if(result?.fits){high=middle;fitted=result;}else low=middle;
  }
  const camera={center,zoom:Math.min(20.8,Math.log2(worldMpp*Math.cos(center[1]*Math.PI/180)/high)),
    pitch,bearing,offset:[0,fitted?.offset??0]};
  camera.offset[0]=exhibitCameraHorizontalOffset(camera,{height,exhibitScale:scale,exhibitBaseM:base,screenShiftX});
  return camera;
}
