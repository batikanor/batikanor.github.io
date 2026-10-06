import * as THREE from 'three';
import {CAPSULE_LAYOUT,CAPSULE_SCALE} from './achievementCapsule.js';

/** Independent, finite access budget; not borrowed from the project exhibit. */
export const CAPSULE_ACCESS_LIMITS=Object.freeze({
  maxRungs:96,maxDeckSlats:24,maxBridgePosts:6,maxInstances:150,
  maxTriangles:1_800,maxBytes:14_000,draws:1,
  rungSpacingM:1,footClearanceM:4,railHalfWidth:.66,guardHeight:.92,
  maxBuildings:256,maxRingPoints:512,maxTotalPoints:32_768,
});
const EPS=1e-8,SKIN=.025;
const assert=(condition,message)=>{if(!condition)throw new TypeError(message);};
const finitePair=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isFinite);
const freezePair=value=>Object.freeze([...value]);
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

function inRing(point,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

// Ray intersections with the exact polygon plus its clearance-radius edge
// capsules. Expanded bounding boxes would unnecessarily send concave venues'
// access bridges across an entire neighbourhood.
function blockedIntervals(origin,direction,ring,radius) {
  const result=[],crossings=[];
  const interval=(offset,slope,low,high)=>{
    if(Math.abs(slope)<EPS)return offset>=low-EPS&&offset<=high+EPS?[-Infinity,Infinity]:null;
    const a=(low-offset)/slope,b=(high-offset)/slope;return [Math.min(a,b),Math.max(a,b)];
  };
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],edge=sub(b,a),length=Math.hypot(...edge),q=sub(origin,a);
    // End caps also protect a concave/convex polygon's individual corners.
    const projection=dot(q,direction),discriminant=projection*projection-dot(q,q)+radius*radius;
    if(discriminant>=-EPS) {const half=Math.sqrt(Math.max(0,discriminant));result.push([-projection-half,-projection+half]);}
    if(length<EPS)continue;
    const along=[edge[0]/length,edge[1]/length],normal=[-along[1],along[0]];
    const x=interval(dot(q,along),dot(direction,along),0,length),y=interval(dot(q,normal),dot(direction,normal),-radius,radius);
    if(x&&y) {const lo=Math.max(x[0],y[0]),hi=Math.min(x[1],y[1]);if(lo<=hi+EPS)result.push([lo,hi]);}
    const determinant=cross(direction,edge);
    if(Math.abs(determinant)>EPS) {
      const delta=sub(a,origin),t=cross(delta,edge)/determinant,u=cross(delta,direction)/determinant;
      if(u>=-EPS&&u<=1+EPS)crossings.push(t);
    }
  }
  const unique=[...new Set(crossings)].sort((a,b)=>a-b);
  for(let i=1;i<unique.length;i++) {
    const lo=unique[i-1],hi=unique[i],mid=(lo+hi)/2;
    if(hi-lo>EPS&&inRing([origin[0]+direction[0]*mid,origin[1]+direction[1]*mid],ring))result.push([lo,hi]);
  }
  return result;
}

/**
 * Plan in the chapter's metre XZ basis. Input/site and mapped footprints are
 * never moved. The complete exterior landing (not only its centre) is outside
 * the host and all supplied nearby footprints. Missing footprints are unknown,
 * not evidence that the real location is clear: this access remains illustrative.
 */
export function planCapsuleAccessFoot({hostRing=null,site=[0,0],nearbyBuildings=[],scale=CAPSULE_SCALE,
  clearanceM=CAPSULE_ACCESS_LIMITS.footClearanceM}={}) {
  assert(finitePair(site)&&site.every(value=>Math.abs(value)<=50_000),'Capsule access site must be finite bounded chapter metres');
  assert(Number.isFinite(scale)&&scale>=.5&&scale<=16,'Capsule access scale must be .5–16');
  assert(Number.isFinite(clearanceM)&&clearanceM>=.95*scale&&clearanceM<=100,'Capsule access needs full-landing clearance');
  assert(Array.isArray(nearbyBuildings)&&nearbyBuildings.length<=CAPSULE_ACCESS_LIMITS.maxBuildings,'Capsule access nearby building budget exceeded');
  const rings=[...new Set([...(hostRing?[hostRing]:[]),...nearbyBuildings.map(building=>building.ring??building)])];
  let points=0;
  for(const ring of rings) {
    assert(Array.isArray(ring)&&ring.length>=3&&ring.length<=CAPSULE_ACCESS_LIMITS.maxRingPoints
      &&ring.every(point=>finitePair(point)&&point.every(value=>Math.abs(value)<=50_000)),'Capsule access footprint must be finite and bounded');
    points+=ring.length;
  }
  assert(points<=CAPSULE_ACCESS_LIMITS.maxTotalPoints,'Capsule access footprint point budget exceeded');
  const portal=[site[0]+CAPSULE_LAYOUT.ladderTop[0]*scale,site[1]+CAPSULE_LAYOUT.ladderTop[2]*scale];
  const initialLength=(Math.abs(CAPSULE_LAYOUT.ladderBottom[2])-Math.abs(CAPSULE_LAYOUT.ladderTop[2]))*scale;
  // A small, deterministic forward fan permits a short clear side route instead
  // of marching straight south through consecutive neighbouring footprints.
  const angles=[0,-25,25,-50,50].map(degrees=>degrees*Math.PI/180);
  let best=null;
  for(const [order,angle] of angles.entries()) {
    const direction=[Math.sin(angle),-Math.cos(angle)];
    const blocked=rings.flatMap(ring=>blockedIntervals(portal,direction,ring,clearanceM)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    let distance=initialLength;
    for(const [lo,hi] of blocked) {
      if(hi<distance-EPS)continue;
      if(lo>distance+EPS)break;
      distance=Math.max(distance,hi+SKIN);
    }
    if(!best||distance<best.distance-EPS)best={distance,direction,order};
  }
  const foot=[portal[0]+best.direction[0]*best.distance,portal[1]+best.direction[1]*best.distance];
  const width=[-best.direction[1],best.direction[0]],half=CAPSULE_ACCESS_LIMITS.railHalfWidth*scale;
  const railFeet=[-1,1].map(side=>freezePair([foot[0]+width[0]*half*side,foot[1]+width[1]*half*side]));
  return Object.freeze({illustrative:true,basis:'mapped-footprint-clearance',knownFootprints:rings.length,
    hostMapped:hostRing!==null,clearanceM,scale,site:freezePair(site),portalM:freezePair(portal),footM:freezePair(foot),
    footOffsetM:freezePair([foot[0]-site[0],foot[1]-site[1]]),
    railFootM:Object.freeze(railFeet),direction:freezePair(best.direction),bridgeLengthM:best.distance});
}

/**
 * All heights are real world metres RELATIVE to the chapter's origin terrain.
 * roofBaseM is the host building height + existing roof offset; ground samples
 * are terrain-at-foot minus terrain-at-origin, never an absolute altitude.
 * Returned coordinates are canonical children of the roof-anchored 4× capsule.
 */
export function resolveCapsuleAccess({roofBaseM,groundFootDeltaM,groundRailDeltasM=null,
  footOffsetM=null,scale=CAPSULE_SCALE}={}) {
  assert(Number.isFinite(roofBaseM)&&Math.abs(roofBaseM)<=20_000,'Capsule access needs finite roofBaseM');
  assert(Number.isFinite(groundFootDeltaM)&&Math.abs(groundFootDeltaM)<=20_000,'Capsule access needs sampled groundFootDeltaM');
  assert(Number.isFinite(scale)&&scale>=.5&&scale<=16,'Capsule access scale must be .5–16');
  footOffsetM??=[0,CAPSULE_LAYOUT.ladderBottom[2]*scale];
  assert(finitePair(footOffsetM)&&footOffsetM.every(value=>Math.abs(value)<=100_000),'Capsule access needs finite relative foot XZ metres');
  assert(groundRailDeltasM===null||(finitePair(groundRailDeltasM)&&groundRailDeltasM.every(value=>Math.abs(value)<=20_000)),
    'Capsule access shoe terrain samples must be a finite pair');
  const entry=[...CAPSULE_LAYOUT.ladderTop],endXZ=footOffsetM.map(value=>value/scale);
  const dx=endXZ[0]-entry[0],dz=endXZ[1]-entry[2],length=Math.hypot(dx,dz);
  assert(length>=.25&&dz<-.1,'Capsule access foot must be outside and forward of the portal');
  const direction=[dx/length,dz/length],width=[-direction[1],direction[0]],ground=(groundFootDeltaM-roofBaseM)/scale;
  const grounds=(groundRailDeltasM??[groundFootDeltaM,groundFootDeltaM]).map(value=>(value-roofBaseM)/scale);
  // A steep hillside can be above the portal. Raise only the exterior bridge
  // and use a short portal-side rise, rather than burying the bridge or silently
  // clamping away the actual terrain elevation supplied by the map.
  const bridgeY=Math.max(entry[1],ground+.6/scale,...grounds.map(value=>value+.6/scale));
  const bridgeStart=[entry[0],bridgeY,entry[2]],landing=[endXZ[0],bridgeY,endXZ[1]],foot=[endXZ[0],ground,endXZ[1]];
  const railFeet=grounds.map((y,i)=>[endXZ[0]+width[0]*CAPSULE_ACCESS_LIMITS.railHalfWidth*(i?1:-1),
    y,endXZ[1]+width[1]*CAPSULE_ACCESS_LIMITS.railHalfWidth*(i?1:-1)]);
  const legs=[{name:'exterior',from:[endXZ[0],Math.max(...grounds),endXZ[1]],to:landing,railFeet}];
  if(bridgeY>entry[1]+EPS)legs.push({name:'portal-rise',from:entry,to:bridgeStart,
    railFeet:[-1,1].map(side=>[entry[0]+width[0]*CAPSULE_ACCESS_LIMITS.railHalfWidth*side,entry[1],entry[2]+width[1]*CAPSULE_ACCESS_LIMITS.railHalfWidth*side])});
  const requested=legs.map(leg=>Math.max(1,Math.ceil((leg.to[1]-leg.from[1])*scale/CAPSULE_ACCESS_LIMITS.rungSpacingM)-1));
  const total=requested.reduce((sum,count)=>sum+count,0),rungBudget=Math.min(total,CAPSULE_ACCESS_LIMITS.maxRungs);
  let allocated=0;
  legs.forEach((leg,i)=>{leg.rungs=i===legs.length-1?rungBudget-allocated:Math.max(1,Math.min(rungBudget-(legs.length-i-1),Math.round(requested[i]/total*rungBudget)));allocated+=leg.rungs;});
  const freeze3=value=>Object.freeze([...value]);
  const frozenLegs=legs.map(leg=>Object.freeze({...leg,from:freeze3(leg.from),to:freeze3(leg.to),railFeet:Object.freeze(leg.railFeet.map(freeze3))}));
  const points=[entry,bridgeStart,landing,foot,...railFeet];
  const margin=1.0,min=[0,1,2].map(axis=>Math.min(...points.map(point=>point[axis]))-(axis===1?.18:margin)),
    max=[0,1,2].map(axis=>Math.max(...points.map(point=>point[axis]))+(axis===1?CAPSULE_ACCESS_LIMITS.guardHeight+.08:margin));
  return Object.freeze({illustrative:true,basis:'sampled-terrain-relative-to-origin',roofBaseM,groundFootDeltaM,
    shoeGroundBasis:groundRailDeltasM?'individual-terrain-samples':'centre-terrain-plane',
    groundRailDeltasM:groundRailDeltasM&&freezePair(groundRailDeltasM),scale,entry:freeze3(entry),bridgeStart:freeze3(bridgeStart),
    landing:freeze3(landing),foot:freeze3(foot),railFeet:Object.freeze(railFeet.map(freeze3)),direction:freezePair(direction),width:freezePair(width),
    bridgeLengthM:length*scale,heightM:(bridgeY-Math.min(ground,...grounds))*scale,terrainAbovePortal:bridgeY>entry[1]+EPS,
    rungCount:rungBudget,rungSpacingM:Math.max(...legs.map(leg=>(leg.to[1]-leg.from[1])*scale/(leg.rungs+1))),
    legs:Object.freeze(frozenLegs),extents:Object.freeze({min:freeze3(min),max:freeze3(max)})});
}

/** One static instanced draw, fixed buffers, no texture/fetch/render-pass cost. */
export function createCapsuleAccess(layout) {
  assert(layout?.basis==='sampled-terrain-relative-to-origin'&&Object.isFrozen(layout)
    &&Array.isArray(layout.legs)&&layout.legs.length>=1&&layout.legs.length<=2
    &&Number.isInteger(layout.rungCount)&&layout.rungCount>=1&&layout.rungCount<=CAPSULE_ACCESS_LIMITS.maxRungs,
    'Capsule access needs a resolved terrain layout');
  const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshStandardMaterial({color:0xffffff,metalness:.3,roughness:.66});
  const mesh=new THREE.InstancedMesh(geometry,material,CAPSULE_ACCESS_LIMITS.maxInstances);
  mesh.name='terrain-grounded-capsule-access';mesh.castShadow=false;mesh.receiveShadow=false;
  const transform=new THREE.Object3D(),from=new THREE.Vector3(),to=new THREE.Vector3(),delta=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  const color=new THREE.Color(),components=[];
  let used=0;
  const box=(role,position,size,rotation=0,tint=0xa8b9af)=>{
    assert(used<CAPSULE_ACCESS_LIMITS.maxInstances,'Capsule access instance budget exceeded');
    transform.position.set(...position);transform.scale.set(...size);transform.quaternion.identity();transform.rotation.y=rotation;transform.updateMatrix();
    mesh.setMatrixAt(used,transform.matrix);mesh.setColorAt(used,color.setHex(tint));components.push(role);used++;
  };
  const beam=(role,a,b,thickness=.085,tint=0xa8b9af)=>{
    from.set(...a);to.set(...b);delta.subVectors(to,from);const length=delta.length();
    if(length<EPS)return;
    assert(used<CAPSULE_ACCESS_LIMITS.maxInstances,'Capsule access instance budget exceeded');
    transform.position.copy(from).add(to).multiplyScalar(.5);transform.scale.set(thickness,length,thickness);
    transform.quaternion.setFromUnitVectors(up,delta.normalize());transform.updateMatrix();
    mesh.setMatrixAt(used,transform.matrix);mesh.setColorAt(used,color.setHex(tint));components.push(role);used++;
  };
  const {entry,bridgeStart:start,landing:end,direction,width,scale}=layout,y=end[1],angle=Math.atan2(direction[0],direction[1]);
  const length=layout.bridgeLengthM/scale,mid=[(start[0]+end[0])/2,y-.04,(start[2]+end[2])/2];
  box('bridge-deck',mid,[1.32,.08,length+.02],angle,0x3c5048);
  box('exterior-landing',[end[0],y-.04,end[2]],[1.7,.08,.75],angle,0x65776d);
  const slats=Math.min(CAPSULE_ACCESS_LIMITS.maxDeckSlats,Math.max(2,Math.ceil(layout.bridgeLengthM/1.7)));
  for(let i=0;i<slats;i++) {
    const t=(i+.5)/slats;
    box('bridge-grating',[start[0]+direction[0]*length*t,y+.018,start[2]+direction[1]*length*t],[1.20,.018,.065],angle,0xbfc6ba);
  }
  const posts=Math.min(CAPSULE_ACCESS_LIMITS.maxBridgePosts,Math.max(2,Math.ceil(layout.bridgeLengthM/8)));
  for(const side of [-1,1]) {
    const a=[start[0]+width[0]*.66*side,y+.92,start[2]+width[1]*.66*side],b=[end[0]+width[0]*.66*side,y+.92,end[2]+width[1]*.66*side];
    beam('bridge-handrail',a,b,.065,0xc5b47f);
    beam('bridge-stringer',[a[0],y-.11,a[2]],[b[0],y-.11,b[2]],.12,0x667d70);
    for(let i=0;i<posts;i++) {
      const t=i/(posts-1),x=a[0]+(b[0]-a[0])*t,z=a[2]+(b[2]-a[2])*t;
      beam('bridge-guard-post',[x,y,z],[x,y+.92,z],.045);
    }
  }
  for(const leg of layout.legs) {
    leg.railFeet.forEach(foot=>{
      // The BOTTOM of each shoe is the supplied terrain sample, not its centre.
      box(leg.name==='exterior'?'ground-shoe':'portal-shoe',[foot[0],foot[1]+.04/scale,foot[2]],[.25,.08/scale,.35],angle,0x384d42);
      beam(`${leg.name}-upright`,[foot[0],foot[1]+.08/scale,foot[2]],[foot[0],leg.to[1]+.92,foot[2]],.095);
    });
    for(let i=1;i<=leg.rungs;i++) {
      const rungY=leg.from[1]+(leg.to[1]-leg.from[1])*i/(leg.rungs+1);
      box(`${leg.name}-rung`,[leg.from[0],rungY,leg.from[2]],[1.28,.055,.11],angle,0xd7d3ba);
    }
  }
  // The final ladder grips turn onto the landing; no disconnected ends above it.
  for(const side of [-1,1])beam('landing-grab',
    [end[0]+width[0]*.66*side,y+.92,end[2]+width[1]*.66*side],
    [end[0]+width[0]*.66*side-direction[0]*.70,y+.92,end[2]+width[1]*.66*side-direction[1]*.70],.065,0xc5b47f);
  mesh.count=used;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingBox();mesh.computeBoundingSphere();
  let bytes=mesh.instanceMatrix.array.byteLength+mesh.instanceColor.array.byteLength+(geometry.index?.array.byteLength??0);
  for(const attribute of Object.values(geometry.attributes))bytes+=attribute.array.byteLength;
  mesh.userData.access=Object.freeze({layout,illustrative:true,instances:used,triangles:used*12,bytes,draws:1,
    resourceBudget:CAPSULE_ACCESS_LIMITS,components:Object.freeze(components)});
  return mesh;
}
