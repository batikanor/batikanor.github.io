import * as THREE from 'three';
import * as maplibregl from 'maplibre-gl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const TAU = Math.PI * 2;
function mesh(parent, geometry, material, xyz=[0,0,0], rotation=[0,0,0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...xyz); object.rotation.set(...rotation); parent.add(object);
  return object;
}
function rod(parent, a, b, radius, material) {
  const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b);
  const object=mesh(parent,new THREE.CylinderGeometry(radius,radius,start.distanceTo(end),7),material);
  object.position.copy(start).add(end).multiplyScalar(0.5);
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());
  return object;
}
function panel(parent, points, material) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flat(),3));
  geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
  return mesh(parent,geometry,material);
}
function at(z, stops) {
  if(z<=stops[0][0])return stops[0][1];
  for(let i=1;i<stops.length;i++)if(z<=stops[i][0]){
    const [z0,a]=stops[i-1], [z1,b]=stops[i];
    // Cubic Hermite interpolation keeps the bonnet, shoulder and haunches
    // continuous instead of exposing the straight facets of a blockout.
    const previous=stops[Math.max(i-2,0)],next=stops[Math.min(i+1,stops.length-1)];
    const m0=(b-previous[1])/(z1-previous[0]);
    const m1=(next[1]-a)/(next[0]-z0);
    const t=(z-z0)/(z1-z0),t2=t*t,t3=t2*t,h=z1-z0;
    return (2*t3-3*t2+1)*a+(t3-2*t2+t)*h*m0+(-2*t3+3*t2)*b+(t3-t2)*h*m1;
  }
  return stops.at(-1)[1];
}
function bodyShell() {
  // Original 4.34 m compact grand tourer, not a stretched game token. The
  // lower side rises around each real wheel so the silhouette has arch cuts.
  const tops=[[-2.17,.73],[-2.04,.81],[-1.80,.98],[-1.48,1.09],[-.7,1.12],[.7,1.115],[1.23,1.065],[1.78,.91],[2.08,.82],[2.17,.77]];
  const widths=[[-2.17,.69],[-2.04,.79],[-1.68,.915],[-.62,.945],[.65,.94],[1.52,.915],[2.05,.79],[2.17,.70]];
  const vertices=[],indices=[],rings=88,count=16;
  for(let j=0;j<=rings;j++){
    const z=-2.17+4.34*j/rings,w=at(z,widths),top=at(z,tops);
    const arch=Math.max(...[-1.36,1.35].map(c=>{
      const dz=Math.abs(z-c);
      return dz<.46?.365+Math.sqrt(Math.max(0,.46**2-dz**2)):.435;
    }));
    const shoulder=Math.max(arch+.065,top-.225);
    const cross=[
      [-.52,.445],[-w*.80,arch],[-w*.97,arch+.045],[-w,shoulder],
      [-w*.985,top-.095],[-w*.87,top-.027],[-w*.58,top+.026],[-w*.24,top+.047],
      [w*.24,top+.047],[w*.58,top+.026],[w*.87,top-.027],[w*.985,top-.095],
      [w,shoulder],[w*.97,arch+.045],[w*.80,arch],[.52,.445]
    ];
    for(const [x,y] of cross)vertices.push(x,y,z);
  }
  for(let j=0;j<rings;j++)for(let k=0;k<count;k++){
    const a=j*count+k,b=(j+1)*count+k,c=j*count+(k+1)%count,d=(j+1)*count+(k+1)%count;
    indices.push(a,b,c,c,b,d);
  }
  const rear=vertices.length/3;vertices.push(0,.65,-2.17);
  const front=vertices.length/3;vertices.push(0,.65,2.17);
  for(let k=0;k<count;k++){
    indices.push(rear,k,(k+1)%count);
    const a=rings*count+k,b=rings*count+(k+1)%count;
    indices.push(front,b,a);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function spokeGeometry() {
  const parts=[];
  for(let i=0;i<10;i++){
    const g=new THREE.BoxGeometry(.012,.173,.03);
    g.translate(0,.145,0);g.rotateZ(i*TAU/10);parts.push(g);
  }
  const merged=mergeGeometries(parts,false);
  for(const g of parts)g.dispose();
  return merged;
}
function roofSkin() {
  const vertices=[],indices=[],across=10,along=24;
  for(let j=0;j<=along;j++){
    const t=j/along,z=-.94+1.255*t;
    const halfWidth=.605-.026*Math.abs(t-.5)*2;
    for(let i=0;i<=across;i++){
      const u=i/across*2-1,x=u*halfWidth;
      const y=1.545+.065*(1-u*u)+.012*Math.sin(Math.PI*t);
      vertices.push(x,y,z);
    }
  }
  for(let j=0;j<along;j++)for(let i=0;i<across;i++){
    const a=j*(across+1)+i,b=a+across+1;
    indices.push(a,b,a+1,a+1,b,b+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}
function vehicleEnvironment() {
  // Tiny authored reflection probe: sky, warm horizon, dark ground and two
  // broad sky highlights. It adds surface definition without a downloaded HDRI.
  const width=128,height=64,bytes=new Uint8Array(width*height*4);
  const blend=(a,b,t)=>a+(b-a)*t;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const v=y/(height-1),u=x/(width-1),i=(y*width+x)*4;
    let rgb;
    if(v<.46){const t=v/.46;rgb=[blend(78,192,t),blend(119,202,t),blend(147,190,t)];}
    else if(v<.56){const t=(v-.46)/.10;rgb=[blend(192,142,t),blend(202,145,t),blend(190,138,t)];}
    else {const t=(v-.56)/.44;rgb=[blend(142,63,t),blend(145,69,t),blend(138,69,t)];}
    const band=Math.max(
      Math.exp(-(((u-.18)/.065)**2))*Math.exp(-(((v-.31)/.27)**2)),
      .7*Math.exp(-(((u-.75)/.09)**2))*Math.exp(-(((v-.38)/.26)**2))
    );
    for(let c=0;c<3;c++)bytes[i+c]=Math.min(255,Math.round(blend(rgb[c],245,band*.68)));
    bytes[i+3]=255;
  }
  const texture=new THREE.DataTexture(bytes,width,height,THREE.RGBAFormat);
  texture.mapping=THREE.EquirectangularReflectionMapping;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.needsUpdate=true;
  return texture;
}
function groundShadow() {
  return new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,
    vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 vUv; void main(){vec2 p=(vUv-0.5)*2.0;float a=.43*pow(max(1.0-length(p),0.0),2.2);gl_FragColor=vec4(.025,.035,.036,a);}'
  });
}
function mergeStaticMeshes(car) {
  // One vehicle remains cheap even as the touring details accumulate: collapse
  // all rigid pieces with the same material into a single draw call. The four
  // moving wheel groups and the translucent contact shadow stay separate.
  const groups=new Map();
  for(const object of car.children){
    if(!object.isMesh||object.material.isShaderMaterial)continue;
    const items=groups.get(object.material)??[];
    items.push(object);groups.set(object.material,items);
  }
  for(const [material,items] of groups){
    if(items.length<2)continue;
    const copies=items.map(object=>{
      object.updateMatrix();
      const copy=object.geometry.clone().applyMatrix4(object.matrix);
      // All car parts are untextured PBR; normalize attributes before merge.
      for(const name of Object.keys(copy.attributes))if(name!=='position'&&name!=='normal')copy.deleteAttribute(name);
      return copy;
    });
    const combined=mergeGeometries(copies,false);
    for(const copy of copies)copy.dispose();
    if(!combined)continue;
    for(const object of items){car.remove(object);object.geometry.dispose();}
    mesh(car,combined,material);
  }
}
function makeCar() {
  // Original local axes and heading semantics remain: x right, y up, z forward.
  const car=new THREE.Group();car.name='4.34 m touring vehicle';
  const paint=new THREE.MeshPhysicalMaterial({color:0xa4bbbc,metalness:.28,roughness:.28,clearcoat:.9,clearcoatRoughness:.18,envMapIntensity:.6});
  const trim=new THREE.MeshStandardMaterial({color:0x202c31,metalness:.14,roughness:.58});
  const dark=new THREE.MeshStandardMaterial({color:0x111b20,metalness:.12,roughness:.46});
  const satin=new THREE.MeshStandardMaterial({color:0xabbabc,metalness:.45,roughness:.35,envMapIntensity:.6});
  const chrome=new THREE.MeshStandardMaterial({color:0xe3e8e5,metalness:.72,roughness:.19,envMapIntensity:.85});
  const glass=new THREE.MeshPhysicalMaterial({color:0x1e3947,metalness:0,roughness:.13,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.1,side:THREE.DoubleSide});
  const rubber=new THREE.MeshStandardMaterial({color:0x0f1315,metalness:0,roughness:.94});
  const wall=new THREE.MeshStandardMaterial({color:0x252b2b,metalness:0,roughness:.82});
  const frontLamp=new THREE.MeshStandardMaterial({color:0xeef4ed,emissive:0xc3d9c8,emissiveIntensity:.44,metalness:.04,roughness:.26,side:THREE.DoubleSide});
  const rearLamp=new THREE.MeshStandardMaterial({color:0xc0201b,emissive:0x871515,emissiveIntensity:.72,metalness:0,roughness:.24,side:THREE.DoubleSide});
  mesh(car,new THREE.PlaneGeometry(5.05,2.35),groundShadow(),[0,.009,0],[-Math.PI/2,0,0]);
  mesh(car,bodyShell(),paint);
  mesh(car,new THREE.BoxGeometry(1.33,.10,3.34),trim,[0,.46,.02]);

  // Four distinct glass regions and slender pillars give the cabin a
  // recognizable windshield/door/quarter-light silhouette rather than a box.
  panel(car,[[-.75,1.12,.89],[.75,1.12,.89],[.596,1.546,.315],[-.596,1.546,.315]],trim);
  panel(car,[[-.718,1.142,.85],[.718,1.142,.85],[.574,1.545,.302],[-.574,1.545,.302]],glass);
  panel(car,[[.74,1.115,-1.43],[-.74,1.115,-1.43],[-.592,1.546,-.945],[.592,1.546,-.945]],trim);
  panel(car,[[.707,1.14,-1.386],[-.707,1.14,-1.386],[-.571,1.545,-.954],[.571,1.545,-.954]],glass);
  // A pair of low-profile wipers and a tinted upper sun strip separate the
  // windshield from the bonnet at a close hero camera.
  rod(car,[-.62,1.13,.862],[.16,1.15,.831],.012,dark);
  rod(car,[.61,1.13,.862],[-.18,1.15,.831],.012,dark);
  for(const side of [-1,1]){
    const bx=side*.767,tx=side*.606;
    panel(car,[[bx,1.12,.77],[bx,1.12,-.16],[tx,1.545,-.195],[tx,1.545,.295]],trim);
    panel(car,[[bx,1.12,-.18],[bx,1.12,-1.40],[tx,1.545,-.93],[tx,1.545,-.225]],trim);
    panel(car,[[side*.772,1.15,.716],[side*.772,1.15,-.139],[side*.609,1.54,-.207],[side*.609,1.54,.259]],glass);
    panel(car,[[side*.772,1.15,-.214],[side*.772,1.15,-1.318],[side*.609,1.54,-.935],[side*.609,1.54,-.248]],glass);
    rod(car,[side*.769,1.114,.83],[side*.608,1.551,.312],.029,paint);
    rod(car,[side*.77,1.112,-.17],[side*.607,1.551,-.22],.031,trim);
    rod(car,[side*.765,1.11,-1.42],[side*.607,1.551,-.94],.032,paint);
    rod(car,[side*.768,1.111,-1.43],[side*.768,1.111,.87],.016,chrome);
    rod(car,[side*.75,1.116,.76],[side*.986,1.107,.79],.018,trim);
    const mirror=mesh(car,new THREE.SphereGeometry(1,14,10),paint,[side*1.04,1.12,.79]);
    mirror.scale.set(.145,.075,.113);
    mesh(car,new THREE.BoxGeometry(.012,.055,.108),glass,[side*1.17,1.12,.79]);
  }
  mesh(car,roofSkin(),paint);
  rod(car,[-.53,1.595,-.61],[-.53,1.6,.14],.01,satin);
  rod(car,[.53,1.595,-.61],[.53,1.6,.14],.01,satin);
  mesh(car,new THREE.ConeGeometry(.018,.11,8),trim,[0,1.645,-.62]);

  const wheelGroups=[],frontWheelGroups=[];
  const spokes=spokeGeometry(),tire=new THREE.CylinderGeometry(.355,.355,.25,36);
  const sidewall=new THREE.CylinderGeometry(.303,.303,.254,36);
  const hub=new THREE.CylinderGeometry(.077,.077,.277,20);
  const rim=new THREE.TorusGeometry(.248,.022,8,36);
  for(const side of [-1,1])for(const z of [-1.36,1.35]){
    const steering=new THREE.Group();steering.position.set(side*.905,.37,z);car.add(steering);
    const spin=new THREE.Group();steering.add(spin);
    mesh(spin,tire,rubber,[0,0,0],[0,0,Math.PI/2]);
    mesh(spin,sidewall,wall,[side*.006,0,0],[0,0,Math.PI/2]);
    mesh(spin,rim,satin,[side*.139,0,0],[0,Math.PI/2,0]);
    mesh(spin,spokes,chrome,[side*.149,0,0],[0,Math.PI/2,0]);
    mesh(spin,hub,dark,[0,0,0],[0,0,Math.PI/2]);
    wheelGroups.push(spin);if(z>0)frontWheelGroups.push(steering);
    const points=[];
    for(let i=0;i<=18;i++){
      const t=i*Math.PI/18;
      points.push(new THREE.Vector3(side*.925,.375+.46*Math.sin(t),z+.46*Math.cos(t)));
    }
    mesh(car,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),28,.018,5,false),trim);
  }
  // Door cuts, handles and rocker trim.
  for(const side of [-1,1]){
    rod(car,[side*.914,.56,-.81],[side*.925,.56,.8],.016,trim);
    rod(car,[side*.938,.77,-.17],[side*.923,1.075,-.17],.011,trim);
    for(const z of [-.76,.36]){
      mesh(car,new THREE.BoxGeometry(.018,.028,.21),chrome,[side*.954,1.016,z]);
      mesh(car,new THREE.BoxGeometry(.024,.011,.145),trim,[side*.967,1.001,z]);
    }
  }
  // Tapered fascias: narrow lens wedges, air intake, plate and bumper lips.
  mesh(car,new THREE.BoxGeometry(1.19,.225,.025),dark,[0,.665,2.176]);
  for(const y of [.6,.66,.72])mesh(car,new THREE.BoxGeometry(1.10,.013,.033),satin,[0,y,2.197]);
  mesh(car,new THREE.BoxGeometry(1.47,.055,.08),trim,[0,.45,2.15]);
  mesh(car,new THREE.BoxGeometry(1.40,.052,.08),trim,[0,.45,-2.15]);
  mesh(car,new THREE.BoxGeometry(1.06,.08,.03),dark,[0,.69,-2.18]);
  for(const side of [-1,1]){
    const x=side*.64;
    panel(car,[[x-side*.23,.86,2.164],[x+side*.20,.85,2.164],[x+side*.15,.74,2.185],[x-side*.24,.76,2.185]],frontLamp);
    panel(car,[[x-side*.24,.84,-2.179],[x+side*.17,.84,-2.179],[x+side*.18,.64,-2.185],[x-side*.22,.64,-2.185]],rearLamp);
    mesh(car,new THREE.BoxGeometry(.14,.06,.025),frontLamp,[side*.71,.55,2.185]);
  }
  mesh(car,new THREE.BoxGeometry(.43,.10,.012),chrome,[0,.62,-2.195]);
  mesh(car,new THREE.BoxGeometry(.37,.09,.012),chrome,[0,.56,2.205]);
  mergeStaticMeshes(car);
  function dispose(){
    const geometries=new Set(),materials=new Set();
    car.traverse(item=>{
      if(item.geometry)geometries.add(item.geometry);
      if(item.material)for(const mat of Array.isArray(item.material)?item.material:[item.material])materials.add(mat);
    });
    for(const g of geometries)g.dispose();
    for(const m of materials)m.dispose();
  }
  return {root:car,wheelGroups,frontWheelGroups,dispose};
}

export function createCarLayer(getState) {
  return {
    id:'earth-engine-car',type:'custom',renderingMode:'3d',
    onAdd(map,gl){
      this.map=map;this.camera=new THREE.Camera();this.scene=new THREE.Scene();
      this.environment=vehicleEnvironment();this.scene.environment=this.environment;
      this.vehicle=makeCar();this.car=this.vehicle.root;this.scene.add(this.car);
      this.scene.add(new THREE.HemisphereLight(0xe7f0ef,0x67747a,2.0));
      const sun=new THREE.DirectionalLight(0xfff2d8,2.2);sun.position.set(28,65,24);this.scene.add(sun);
      const fill=new THREE.DirectionalLight(0x98bcc3,.75);fill.position.set(-18,24,-14);this.scene.add(fill);
      this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});
      this.renderer.autoClear=false;this.renderer.outputColorSpace=THREE.SRGBColorSpace;
      this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
      this.lastRender=performance.now();
    },
    render(gl,args){
      const state=getState();
      if(!state.active||this.map.getZoom()<15||args.defaultProjectionData.projectionTransition>0)return;
      const now=performance.now(),dt=Math.min((now-this.lastRender)/1000,.08);this.lastRender=now;
      const speed=Number.isFinite(state.speed)?state.speed:0;
      for(const wheel of this.vehicle.wheelGroups)wheel.rotation.x+=speed*dt/.355;
      const steer=(state.keys?.has('d')||state.keys?.has('arrowright')?1:0)-(state.keys?.has('a')||state.keys?.has('arrowleft')?1:0);
      for(const wheel of this.vehicle.frontWheelGroups)wheel.rotation.y=steer*.24;
      const location=state.position,elevation=this.map.queryTerrainElevation(location)??0;
      // Wheel bottoms are 15 mm above local zero. Keep only 25 mm terrain
      // clearance, with a soft contact shadow, rather than hovering at 200 mm.
      const merc=maplibregl.MercatorCoordinate.fromLngLat(location,elevation+.025);
      const scale=merc.meterInMercatorCoordinateUnits();
      const local=new THREE.Matrix4().makeTranslation(merc.x,merc.y,merc.z)
        .multiply(new THREE.Matrix4().makeRotationZ(Math.PI))
        .multiply(new THREE.Matrix4().makeRotationX(Math.PI/2))
        .multiply(new THREE.Matrix4().makeScale(-scale,scale,scale));
      this.car.rotation.y=THREE.MathUtils.degToRad(state.heading+90);
      this.camera.projectionMatrix=new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix).multiply(local);
      this.renderer.resetState();this.renderer.render(this.scene,this.camera);
    },
    onRemove(){this.vehicle?.dispose();this.environment?.dispose();this.renderer?.dispose();this.vehicle=null;this.environment=null;this.renderer=null;this.map=null;}
  };
}
