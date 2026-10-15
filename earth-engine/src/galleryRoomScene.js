import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {ACHIEVEMENT_SCENE_SUBJECTS} from './achievementSceneData.js';
import {galleryStationPlan, galleryStationDepth} from './galleryRoomLayout.js';

export const GALLERY_ROOM_LAYOUT = Object.freeze({stationGap:3.6, ceiling:10.8,
  frontWall:-3.2, floorBack:75, visibleRadius:1});

const PALETTE = Object.freeze({plaster:0x5b605f, ceiling:0x5c6261, floor:0x4c5251, oak:0x665e53,
  charcoal:0x252b2d, brass:0x837969, paper:0xdad7cf, sky:0xb5c0c2});
const ACCENTS = [0x829aa4,0xa19584,0x939e97,0x92949f,0xa49b89,0x8e9fa5];
const ROOM_SURFACES = new Set(['plaster','ceiling','floor']);
const SCULPTURE_POSITION = [1.3,.65,.7];
const SCULPTURE_SCALE = .9;
const TAU = Math.PI * 2;
const triangleCount = geometry => (geometry.index?.count ?? geometry.getAttribute('position').count) / 3;

/** Own every geometry/material once, including primitives shared by all bays. */
function resources() {
  const geometries = new Set(), materials = new Set();
  return {geometries,materials,
    geometry(value) {geometries.add(value);return value;},
    material(value) {materials.add(value);return value;},
    dispose() {for(const set of [geometries,materials])for(const value of set)value.dispose();},
  };
}

function primitives(owned) {
  return {box:owned.geometry(new THREE.BoxGeometry(1,1,1)),
    cylinder:owned.geometry(new THREE.CylinderGeometry(1,1,1,16)),
    cone:owned.geometry(new THREE.ConeGeometry(1,1,16)),
    sphere:owned.geometry(new THREE.SphereGeometry(1,16,10)),
    torus:owned.geometry(new THREE.TorusGeometry(1,.075,6,32)),
    arc:owned.geometry(new THREE.TorusGeometry(1,.055,6,32,Math.PI)),
    octa:owned.geometry(new THREE.OctahedronGeometry(1)),
    dish:owned.geometry(new THREE.LatheGeometry(Array.from({length:10},(_,i)=>
      new THREE.Vector2(i*.083,i*i*.0033)),32)),
    plane:owned.geometry(new THREE.PlaneGeometry(1,1))};
}

/** Static fittings are merged by material, rather than hundreds of tiny draws. */
function assembler(shapes, owned) {
  const batches=new Map();let parent=new THREE.Matrix4();
  const add=(shape,material,position,size=[1,1,1],rotation=[0,0,0],color)=>{
    const source=shapes[shape],geometry=source.index?source.toNonIndexed():source.clone();
    geometry.deleteAttribute('uv');
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...size));
    geometry.applyMatrix4(parent.clone().multiply(transform));
    if(color!==undefined) {
      const tint=new THREE.Color(color),colors=new Float32Array(geometry.getAttribute('position').count*3);
      for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    }
    if(!batches.has(material))batches.set(material,[]);batches.get(material).push(geometry);
  };
  return {add,box:(m,p,s,r,c)=>add('box',m,p,s,r,c),
    ball:(m,p,s,c)=>add('sphere',m,p,s,[0,0,0],c),
    cylinder:(m,p,r,h,angles=[0,0,0],c)=>add('cylinder',m,p,[r,h,r],angles,c),
    ring:(m,p,r,angles=[0,0,0],c)=>add('torus',m,p,[r,r,r],angles,c),
    rod(m,from,to,radius=.025,color) {
      const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
      if(delta.lengthSq()<1e-9)return;
      const rotation=new THREE.Euler().setFromQuaternion(new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0,1,0),delta.clone().normalize()));
      add('cylinder',m,a.add(b).multiplyScalar(.5).toArray(),[radius,delta.length(),radius],rotation.toArray().slice(0,3),color);
    },
    at(position,rotation,scale,fn) {
      const previous=parent;parent=parent.clone().multiply(new THREE.Matrix4().compose(
        new THREE.Vector3(...position),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...scale)));
      try{fn();}finally{parent=previous;}
    },
    finish(group,{castShadow=true,receiveShadow=true}={}) {
      const meshes=[];
      for(const [material,parts]of batches) {
        const geometry=owned.geometry(mergeGeometries(parts,false));parts.forEach(part=>part.dispose());
        geometry.computeBoundingSphere();
        const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=castShadow;mesh.receiveShadow=receiveShadow;
        group.add(mesh);meshes.push(mesh);
      }
      return meshes;
    }};
}

function frame(builder, material, pose, {freestanding=false}={}) {
  const padding=pose.framePadding??.08;
  if(pose.kind==='references') {
    // References share one quiet matte board.
    builder.at(pose.position,pose.rotation,[1,1,1],()=>{
      builder.box(material.charcoal,[0,0,-.08],[pose.worldWidth+padding*2,pose.worldHeight+padding*2,.12]);
    });
    return;
  }
  if (pose.photo) {
    const {photo, ...picture} = pose;
    const chromeHeight = photo.captionWorldHeight + photo.controlsWorldHeight;
    const offset = new THREE.Vector3(0, chromeHeight / 2, 0).applyEuler(new THREE.Euler(...pose.rotation)).toArray();
    picture.position = pose.position.map((value, index) => value + offset[index]);
    picture.worldHeight = photo.worldHeight;
    frame(builder, material, picture);
    builder.at(pose.position, pose.rotation, [1,1,1], () => {
      builder.box(material.charcoal, [0, -photo.worldHeight / 2, -.11], [pose.worldWidth, chromeHeight, .17]);
    });
    return;
  }
  const width=pose.worldWidth,height=pose.worldHeight,trim=Math.min(.075,padding*.9);
  builder.at(pose.position,pose.rotation,[1,1,1],()=>{
    builder.box(material.charcoal,[0,0,-.08],[width+padding*2,height+padding*2,.12]);
    for(const x of [-1,1])builder.box(freestanding?material.oak:material.brass,[x*(width/2+padding/2),0,-.015],[trim,height+padding*2,.03]);
    for(const y of [-1,1])builder.box(freestanding?material.oak:material.brass,[0,y*(height/2+padding/2),-.015],[width+padding*2,trim,.03]);
    if(freestanding)for(const x of [-width*.36,width*.36]) {
      const footY=-pose.position[1]+.09;
      builder.box(material.charcoal,[x,footY+.22,-.1],[.085,.44,.085]);
      builder.box(material.charcoal,[x,footY,0],[.38,.12,1.18]);
      builder.rod(material.charcoal,[x,footY+.05,.5],[x,-height/2-.04,-.1],.025);
    }
  });
}

function architecture(group, shapes, material, owned, components, depth, sculpturePosition, wallWidth, lastStation) {
  const b=assembler(shapes,owned);
  const physicalDepth=Math.max(depth,GALLERY_ROOM_LAYOUT.floorBack);
  const floorLength=physicalDepth+3.6,floorCenter=(physicalDepth-3.6)/2;
  const ceiling=GALLERY_ROOM_LAYOUT.ceiling;
  // Each bay owns one flush tile of a continuous corridor, including half of
  // either inter-project gap. The final tile finishes the last sculpture niche.
  const endExtension=lastStation?GALLERY_ROOM_LAYOUT.stationGap/2:0;
  const roomWidth=wallWidth+GALLERY_ROOM_LAYOUT.stationGap+endExtension;
  const tileCenter=endExtension/2;
  b.box(material.floor,[tileCenter,-.14,floorCenter],[roomWidth,.28,floorLength]);
  b.box(material.plaster,[tileCenter,ceiling/2,-3.45],[roomWidth,ceiling,.42]);
  // Unbroken planes and two recessed light slots keep attention on the work.
  // They extend with the collection without adding a repeating ceiling grid.
  b.box(material.ceiling,[tileCenter,ceiling+.11,floorCenter],[roomWidth,.22,floorLength]);
  for(const x of [-1,1])b.box(material.sky,[x*wallWidth*.38,ceiling-.0125,floorCenter],[.14,.025,floorLength-.4]);
  for(const component of components)frame(b,material,component);
  // Sculptures sit on a tactile monolithic plinth, outside the reading boards.
  b.box(material.plaster,[sculpturePosition[0],.3,sculpturePosition[2]],[1.72,.6,1.72]);
  b.box(material.brass,[sculpturePosition[0],.615,sculpturePosition[2]],[1.74,.028,1.74]);
  // A shared stone gradient joins the floor, wall bases and upper wall/ceiling.
  // Both wings use the same world-height tones, so corners stay in one family.
  // Vertex colours add no textures, fittings or render passes.
  const meshes=b.finish(group,{castShadow:false,receiveShadow:true});
  const low=new THREE.Color(0x4c5251),high=new THREE.Color(0x606665);
  const floorFar=new THREE.Color(0x464c4b),ceilingFar=new THREE.Color(0x565d5d);
  for(const mesh of meshes){
    const name=mesh.material.name.replace('gallery-','');
    if(!ROOM_SURFACES.has(name))continue;
    const positions=mesh.geometry.getAttribute('position'),colors=new Float32Array(positions.count*3);
    const tint=new THREE.Color();
    for(let index=0;index<positions.count;index++){
      const depth=THREE.MathUtils.clamp((positions.getZ(index)+3.6)/physicalDepth,0,1);
      if(name==='plaster')tint.copy(low).lerp(high,THREE.MathUtils.clamp(positions.getY(index)/ceiling,0,1));
      else if(name==='floor')tint.copy(low).lerp(floorFar,depth);
      else tint.copy(high).lerp(ceilingFar,depth);
      tint.toArray(colors,index*3);
    }
    mesh.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  }
  // Only sculptures cast shadows; architecture receives their soft contact.
  return meshes;
}

function sculpture(subject, slug, index, shapes, material, owned, position) {
  const group=new THREE.Group();group.name=`gallery-sculpture-${slug}`;
  const b=assembler(shapes,owned),m=material.sculpture;
  const ink=PALETTE.charcoal,paper=PALETTE.paper,brass=PALETTE.brass,metal=0x9fa8a5,accent=ACCENTS[index%ACCENTS.length];
  const box=(p,s,c=accent,r)=>b.box(m,p,s,r,c),ball=(p,s,c=accent)=>b.ball(m,p,s,c);
  const cylinder=(p,r,h,c=accent,angles)=>b.cylinder(m,p,r,h,angles,c);
  const ring=(p,r,c=brass,angles)=>b.ring(m,p,r,angles,c);
  const rod=(a,z,r=.03,c=brass)=>b.rod(m,a,z,r,c);
  const panel=(x,y,z,w=1,h=.65)=>{
    box([x,y,z],[w,.035,h],metal);
    for(let i=0;i<5;i++)box([x+(i-2)*w/5,y+.025,z],[w/5-.02,.025,h-.025],0x385768);
  };
  const network=(count=7)=>{
    const points=Array.from({length:count},(_,i)=>[Math.cos(i*TAU/count)*.72,.65+(i%3)*.37,Math.sin(i*TAU/count)*.45]);
    points.forEach((p,i)=>{ball(p,[.105,.105,.105],i%2?brass:accent);rod(p,points[(i+1)%count],.025,metal);if(i%2===0)rod(p,[0,1.3,0],.022,metal);});
    ball([0,1.3,0],[.19,.19,.19],ink);
  };
  const turbine=(x=0)=>{
    cylinder([x,.1,0],.27,.12,ink);rod([x,.15,0],[x,1.55,0],.065,metal);
    ball([x,1.6,.03],[.11,.11,.1],brass);
    for(let i=0;i<3;i++){const angle=i*TAU/3;box([x+Math.sin(angle)*.36,1.6+Math.cos(angle)*.36,.08],[.075,.76,.05],paper,[0,0,-angle]);}
  };
  switch(subject) {
    case 'supply-chain':
      box([-.32,.3,0],[.78,.38,.82]);box([-.32,.76,.03],[.79,.065,.7],brass);
      box([-.32,.57,-.05],[.28,.31,.25],ink);
      for(const x of [-.69,.05])for(const z of [-.29,.29])cylinder([x,.18,z],.17,.13,ink,[0,0,Math.PI/2]);
      for(const x of [-.62,-.02])rod([x,.39,-.3],[x,.75,-.3],.025,metal);
      for(const x of [-.48,-.16]){box([x,.63,.4],[.055,1.15,.08],metal);box([x,.15,.65],[.07,.065,.65],brass);}
      for(const z of [-.29,0,.29])box([.72,.13,z],[.55,.075,.1],brass);
      box([.72,.42,0],[.48,.5,.58],paper);box([.72,.42,.3],[.035,.5,.012],accent);break;
    case 'semiconductor':
      cylinder([-.18,.78,.02],.76,.05,ink,[Math.PI/2,0,0]);ring([-.18,.78,.06],.72,brass);
      for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)if(x*x+y*y<7)box([x*.22-.18,.78+y*.22,.06],[.16,.16,.027],(x+y)%2?metal:brass);
      cylinder([.75,.13,0],.24,.18,ink);rod([.75,.24,0],[.75,.82,.06],.065,metal);
      rod([.75,.82,.06],[.35,1.16,.22],.06,accent);ball([.75,.82,.06],[.12,.12,.12],brass);
      for(const x of [.29,.42])box([x,1.04,.22],[.035,.26,.075],ink);break;
    case 'satellite':
      box([0,.97,0],[.43,.57,.44],brass);box([0,1.02,0],[.46,.06,.46],paper);
      panel(-.78,1,0,1.03,.78);panel(.78,1,0,1.03,.78);rod([-1.3,.96,0],[1.3,.96,0],.023,metal);
      cylinder([0,1.34,0],.14,.12,ink);rod([.16,1.2,.16],[.28,1.62,.29],.016,brass);
      rod([0,.15,0],[0,.69,0],.035,metal);ring([0,.11,0],.56,metal,[Math.PI/2,0,0]);break;
    case 'radar':
      cylinder([0,.08,0],.52,.14,ink);rod([0,.12,0],[0,1.1,0],.085,metal);
      b.add('dish',m,[0,1.3,0],[1,1,1],[Math.PI/2-.15,0,0],metal);
      ring([0,1.42,.24],.75,brass,[-.15,0,0]);
      rod([0,1.28,0],[0,1.48,1],.035,ink);ball([0,1.48,1],[.085,.085,.09],brass);
      for(const x of [-.4,.4])rod([x,1.05,.21],[0,1.48,1],.017,metal);break;
    case 'globe':
      cylinder([0,.08,0],.45,.14,ink);rod([0,.12,0],[0,.5,0],.045,metal);
      ball([0,1.12,0],[.6,.6,.6],accent);
      for(const y of [-.36,0,.36])ring([0,1.12+y,0],Math.sqrt(.61**2-y**2),brass,[Math.PI/2,0,0]);
      for(const angle of [0,Math.PI/2])ring([0,1.12,0],.615,metal,[0,angle,0]);
      ring([0,1.12,0],.7,brass,[0,0,.28]);break;
    case 'coins':
      for(let i=0;i<3;i++){
        const x=(i-1)*.52,y=.55+i*.18;
        cylinder([x,y,0],.34,.09,i%2?metal:brass,[Math.PI/2,0,0]);ring([x,y,.057],.3,paper);
        b.add('octa',m,[x,y,.064],[.13,.13,.035],[0,0,.2+i*.2],accent);
        rod([x,.08,0],[x,y-.3,0],.035,ink);
      }box([0,.06,0],[1.75,.12,.65],ink);break;
    case 'gifting':
      box([0,.5,0],[1,.94,1],accent);box([0,.99,0],[1.06,.13,1.06],paper);
      box([0,.52,.513],[.13,1,.02],brass);box([0,1.07,0],[.13,.025,1.02],brass);box([0,1.07,0],[1.02,.025,.13],brass);
      ring([-.18,1.21,0],.21,brass,[0,.2,.3]);ring([.18,1.21,0],.21,brass,[0,-.2,-.3]);
      cylinder([.64,.43,.35],.13,.05,brass,[Math.PI/2,0,0]);ring([.64,.58,.35],.09,ink);break;
    case 'linked-ledger':
      for(let i=0;i<3;i++){
        const x=(i-1)*.62,y=.63+(i%2)*.38;
        ring([x,y,0],.32,i===1?brass:metal);
        b.add('octa',m,[x,y,0],[.18,.27,.16],[0,i*.3,0],accent);
        if(i)rod([x-.3,y,0],[x-.62+.3,.63+((i-1)%2)*.38,0],.035,brass);
        rod([x,.1,0],[x,y-.29,0],.028,ink);
      }
      if(slug.startsWith('solana'))ball([0,.2,.48],[.17,.17,.17],paper);
      if(slug.startsWith('ethmunich'))ring([0,1.5,0],.19,brass);break;
    case 'spatial-audio':
      b.add('arc',m,[0,.85,0],[.62,.62,.62],[0,0,0],metal);
      for(const x of [-.62,.62]){box([x,.78,0],[.19,.53,.36],ink);cylinder([x,.79,.02],.2,.13,accent,[0,0,Math.PI/2]);}
      if(slug.startsWith('music'))for(let i=0;i<8;i++)box([(i-3.5)*.13,.13,.25],[.115,.12,.48],i%3?paper:ink);
      else{ball([0,.62,0],[.28,.42,.25],paper);for(let i=0;i<4;i++)ring([0,.64,.27+i*.16],.15+i*.04,brass);}
      break;
    case 'health-imaging':
      if(slug.startsWith('draeger')) {
        ball([-.19,.94,0],[.35,.35,.2],accent);ball([.19,.94,0],[.35,.35,.2],accent);
        b.add('cone',m,[0,.65,0],[.45,.7,.22],[0,0,Math.PI],accent);
        const line=[[-.8,.48,.35],[-.45,.48,.35],[-.27,.63,.35],[-.14,.21,.35],[.06,.88,.35],[.2,.48,.35],[.8,.48,.35]];
        line.slice(1).forEach((p,i)=>rod(line[i],p,.023,brass));
      } else {
        box([0,.91,0],[1,.57,.45],accent);cylinder([0,.91,.37],.27,.33,metal,[Math.PI/2,0,0]);
        cylinder([0,.91,.55],.22,.035,ink,[Math.PI/2,0,0]);ring([0,.91,.58],.16,brass);
        rod([0,.62,0],[0,.25,0],.04,metal);
        for(let i=0;i<3;i++){const a=i*TAU/3;rod([0,.26,0],[Math.cos(a)*.48,.04,Math.sin(a)*.48],.028,ink);}
      }break;
    case 'focus':
      box([0,.75,0],[1.13,.48,.48],ink);box([0,.74,.25],[1.04,.32,.035],metal);
      for(const x of [-.3,.3])ring([x,.74,.275],.15,brass);
      b.add('arc',m,[0,.81,-.22],[.59,.45,.6],[Math.PI/2,0,0],accent);
      for(let i=0;i<3;i++)box([-.44+i*.42,.09,.12],[.35,.12,.7],i%2?paper:accent);break;
    case 'noseprints':
      ball([0,.62,0],[.4,.45,.3],accent);ball([0,1.14,.06],[.43,.38,.31],accent);
      for(const x of [-.29,.29]){b.add('cone',m,[x,1.51,.02],[.17,.35,.14],[0,0,x<0?.15:-.15],accent);ball([x*.61,1.22,.36],[.052,.065,.03],ink);}
      b.add('octa',m,[0,1.09,.41],[.085,.05,.035],[0,0,0],brass);
      for(const s of [-1,1])for(const y of [1.02,1.12])rod([s*.13,y,.37],[s*.55,y+.04,.36],.009,metal);
      ring([.68,.43,.12],.25,brass);for(let i=0;i<5;i++)ball([.68+Math.cos(i*TAU/5)*.12,.43+Math.sin(i*TAU/5)*.12,.13],[.035,.027,.014],ink);break;
    case 'football':
      ball([0,.86,0],[.56,.56,.56],paper);
      for(const [x,y,z]of [[0,1.39,.04],[.48,.95,.24],[-.48,.95,.24],[0,.56,.45],[.08,.96,-.55]])b.add('octa',m,[x,y,z],[.17,.15,.14],[0,0,.2],ink);
      box([0,.09,0],[1.75,.16,1.32],accent);ring([0,.185,0],.38,paper,[Math.PI/2,0,0]);break;
    case 'bioinformatics':
      for(let i=0;i<11;i++){
        const a=i*.6,y=.2+i*.13,one=[Math.cos(a)*.34,y,Math.sin(a)*.34],two=[-one[0],y,-one[2]];
        ball(one,[.07,.07,.07],accent);ball(two,[.07,.07,.07],brass);rod(one,two,.025,metal);
        if(i){const p=a-.6;rod([Math.cos(p)*.34,y-.13,Math.sin(p)*.34],one,.028,accent);rod([-Math.cos(p)*.34,y-.13,-Math.sin(p)*.34],two,.028,brass);}
      }ring([0,.12,0],.62,ink,[Math.PI/2,0,0]);break;
    case 'circular-appliances':
      box([0,.7,0],[.91,1.32,.72],paper);box([0,1.21,.38],[.82,.16,.025],ink);
      cylinder([0,.64,.4],.32,.06,ink,[Math.PI/2,0,0]);ring([0,.64,.44],.34,metal);
      ring([0,.65,.48],.22,accent);cylinder([.29,1.21,.41],.056,.03,brass,[Math.PI/2,0,0]);
      ring([0,.15,0],.75,brass,[Math.PI/2,0,0]);break;
    case 'trajectory-policy':
      cylinder([-.3,.15,0],.32,.23,ink);rod([-.3,.26,0],[-.3,1.06,0],.1,metal);
      ball([-.3,1.06,0],[.15,.15,.15],brass);rod([-.3,1.06,0],[.4,1.38,.1],.075,accent);
      ball([.4,1.38,.1],[.11,.11,.11],metal);box([.48,1.26,.1],[.17,.3,.15],ink);
      for(let j=0;j<3;j++)for(let i=1;i<15;i++){
        const p=k=>[(k/14)*1.7-.8,.32+Math.sin(k/14*Math.PI)*(.37+j*.14),.45+j*.12];rod(p(i-1),p(i),.014,j===1?brass:accent);
      }break;
    case 'neural-route': {
      box([0,.1,0],[1.9,.18,1.4],paper);
      const route=[[-.75,.23,-.4],[-.3,.3,.25],[.2,.23,-.25],[.74,.33,.3]];
      route.forEach((p,i)=>{ball(p,[.065,.065,.065],brass);if(i)rod(route[i-1],p,.03,accent);});
      for(const x of [-.52,.55])box([x,.27,-.42],[.3,.22,.26],metal);
      if(slug.startsWith('salzburg')) {ball([0,.83,0],[.29,.39,.24],paper);ring([0,1.04,0],.32,ink,[Math.PI/2,0,0]);for(let i=0;i<6;i++){const a=i*TAU/6;ball([Math.cos(a)*.29,1.05,Math.sin(a)*.29],[.04,.04,.04],brass);}}
      else if(slug.startsWith('hackupc')) {box([0,.85,0],[.14,.15,.75],metal);box([0,.85,.05],[1.12,.04,.2],accent);box([0,.97,-.3],[.05,.25,.16],brass);}
      else {box([0,.46,0],[.79,.3,.44],accent);box([0,.7,-.05],[.43,.23,.41],ink);for(const x of [-.32,.32])for(const z of [-.18,.18])cylinder([x,.34,z],.12,.09,ink,[Math.PI/2,0,0]);}break;
    }
    case 'energy-grid':
      box([0,.43,0],[.9,.71,.78],paper);box([0,.83,0],[1.04,.06,.93],metal,[0,0,.2]);panel(0,.9,0,.91,.82);
      turbine(-.75);for(const x of [.62,.87])rod([x,.12,.39],[x,.77,.39],.025,brass);break;
    case 'energy-forum':
      if(slug.startsWith('zurich')) {rod([0,.1,0],[0,.91,0],.05,brass);for(const [x,y,z]of [[0,1.13,0],[-.25,.94,.07],[.25,.91,-.05]])ball([x,y,z],[.29,.27,.21],accent);for(let i=0;i<5;i++){const a=i*TAU/5;ball([Math.cos(a)*.67,.66,Math.sin(a)*.67],[.085,.085,.085],metal);rod([Math.cos(a)*.67,.13,Math.sin(a)*.67],[Math.cos(a)*.67,.58,Math.sin(a)*.67],.048,ink);}}
      else if(slug.startsWith('six')) {for(let i=0;i<4;i++)box([-.52+i*.34,.28+i*.15,0],[.25,.3+i*.3,.48],i%2?accent:paper);rod([-.65,1.35,0],[.7,1.35,0],.025,brass);ball([0,1.48,0],[.14,.21,.09],accent);}
      else {turbine(-.43);panel(.5,.62,.06,.8,.68);for(const x of [.28,.73])rod([x,.05,.38],[x,.6,-.2],.026,metal);}
      break;
    case 'finance-graph':
      network(5);for(let i=0;i<4;i++)box([-.62+i*.4,.13+i*.07,.46],[.2,.22+i*.14,.2],i%2?brass:paper);break;
    case 'discovery-graph':
      network(slug.startsWith('pdm')?8:6);
      if(slug.startsWith('pdm'))for(let i=0;i<3;i++)box([-.48+i*.48,.33+i*.12,.48],[.3,.48,.035],paper,[0,0,(i-1)*.09]);
      else {ring([.59,1.35,.34],.22,brass);rod([.72,1.19,.34],[.91,.92,.34],.04,ink);}break;
    case 'academia':
    default:
      for(const s of [-1,1]){box([s*.36,.38,0],[.69,.1,1.05],accent,[0,0,s*.13]);box([s*.35,.45,0],[.62,.07,.96],paper,[0,0,s*.13]);}
      for(let i=0;i<3;i++)box([0,.07+i*.09,-.04],[1.2,.08,.87],i%2?paper:metal);
      box([0,.9,0],[.95,.05,.75],ink,[0,.35,0]);cylinder([0,.77,0],.29,.22,ink);rod([.44,.91,.04],[.54,.55,.08],.015,brass);break;
  }
  b.finish(group);
  const localHeight=new THREE.Box3().setFromObject(group).max.y;
  const scale=Math.min(SCULPTURE_SCALE,(2.3-position[1])/localHeight);
  group.position.fromArray(position);group.scale.setScalar(scale);
  group.userData={gallerySurface:'sculpture',surface:'sculpture',subject,slug,gallerySlug:slug,illustrative:true};
  group.traverse(node=>{if(node.isMesh)Object.assign(node.userData,group.userData);});
  return group;
}

/** A reusable architectural gallery; content and input stay in separate layers. */
export function createGalleryRoomScene({scene, projects, reducedMotion=false, viewport={width:1280,height:900}}={}) {
  if(!scene?.isScene)throw new TypeError('Gallery room requires a Three.js scene');
  if(!Array.isArray(projects)||!projects.length||projects.length>32||projects.some(p=>!p?.slug)
    ||new Set(projects.map(p=>p.slug)).size!==projects.length)throw new TypeError('Gallery needs 1–32 unique project slugs');
  const owned=resources(),shapes=primitives(owned),root=new THREE.Group();root.name='project-gallery-room';scene.add(root);
  const material=Object.fromEntries(Object.entries(PALETTE).map(([name,color])=>[name,owned.material(new THREE.MeshStandardMaterial({
    color:ROOM_SURFACES.has(name)?0xffffff:color,vertexColors:ROOM_SURFACES.has(name),
    roughness:name==='brass'?.72:name==='oak'?.82:.91,metalness:name==='brass'?.25:name==='charcoal'?.12:0,
    ...(name==='sky'?{emissive:color,emissiveIntensity:.32}:{}),
    ...(name==='ceiling'?{emissive:color,emissiveIntensity:.025}:{}),}))]));
  for(const [name,value]of Object.entries(material))value.name=`gallery-${name}`;
  material.sculpture=owned.material(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.52,metalness:.23,side:THREE.DoubleSide}));
  const maskMaterial=owned.material(new THREE.MeshBasicMaterial({color:0x000000,opacity:0,transparent:false,
    blending:THREE.NoBlending,depthWrite:true,fog:false,toneMapped:false}));
  const stations=new Map(),bays=[],walkBounds={min:[0,.08,-2.639],max:[0,GALLERY_ROOM_LAYOUT.ceiling-.08,25.2]};
  projects.forEach((project,index)=>{
    const bay=new THREE.Group();bay.name=`gallery-station-${project.slug}`;root.add(bay);
    const fittings=new THREE.Group();fittings.name='gallery-architecture';bay.add(fittings);
    const subject=ACHIEVEMENT_SCENE_SUBJECTS[project.slug]?.subject??'academia';
    const figure=sculpture(subject,project.slug,index,shapes,material,owned,SCULPTURE_POSITION);bay.add(figure);
    const masks=new THREE.Group();masks.name='active-content-apertures';bay.add(masks);
    const surfaces={};
    const station={slug:project.slug,index,anchor:[0,0,0],
      surfaces,contentSurfaces:surfaces,components:[],subject};
    stations.set(project.slug,station);bays.push({group:bay,fittings,figure,masks,station,project});
  });
  let layoutKey=null,layoutViewport=viewport;
  const resize=nextViewport=>{
    const selected=nextViewport??layoutViewport;
    const key=JSON.stringify([selected.width,selected.height,...['left','top','right','bottom'].map(name=>selected.dockBounds?.[name])]);
    if(key===layoutKey)return false;
    const plans=bays.map(bay=>galleryStationPlan(bay.project,selected));
    const spacing=plans[0].wallLayout.worldWidth+GALLERY_ROOM_LAYOUT.stationGap;
    for(const [index,bay]of bays.entries()) {
      const {station,masks,fittings,figure}=bay,{components,wallLayout}=plans[index];
      const x=index*spacing;
      station.index=index;station.anchor[0]=x;station.spacing=spacing;bay.group.position.x=x;
      for(const pose of components){
        const worldPose={...pose,position:[pose.position[0]+x,...pose.position.slice(1)]};
        if(station.surfaces[pose.id])Object.assign(station.surfaces[pose.id],worldPose);
        else station.surfaces[pose.id]=worldPose;
        let mask=masks.children.find(mesh=>mesh.userData.surface===pose.id&&mesh.userData.part==='aperture');
        if(!mask){
          mask=new THREE.Mesh(shapes.plane,maskMaterial);mask.renderOrder=10;
          mask.userData={gallerySlug:station.slug,slug:station.slug,gallerySurface:pose.id,surface:pose.id,
            galleryComponent:pose.id,kind:pose.kind,part:'aperture'};masks.add(mask);
          const pick=mask.clone();pick.visible=false;pick.name=`${pose.id}-frame-pick`;
          pick.userData={...mask.userData,part:'frame'};masks.add(pick);
        }
        mask.position.fromArray(pose.position);mask.rotation.set(...pose.rotation);
        mask.scale.set(pose.worldWidth,pose.worldHeight,1);
        const pick=masks.children.find(mesh=>mesh.userData.surface===pose.id&&mesh.userData.part==='frame');
        pick.position.copy(mask.position);pick.rotation.copy(mask.rotation);
        pick.scale.set(pose.worldWidth+pose.framePadding*2,pose.worldHeight+pose.framePadding*2,1);
      }
      station.components=Object.values(station.surfaces);
      station.wallLayout=wallLayout;
      station.wallBounds={min:[x-wallLayout.worldWidth/2,0,wallLayout.wallZ],
        max:[x+wallLayout.worldWidth/2,wallLayout.worldHeight,wallLayout.wallZ]};
      station.frontBounds=station.wallBounds;
      station.frontObjects=station.components.map(pose=>({id:pose.id,
        min:[pose.position[0]-pose.worldWidth/2-pose.framePadding,pose.position[1]-pose.worldHeight/2-pose.framePadding,pose.position[2]-.2],
        max:[pose.position[0]+pose.worldWidth/2+pose.framePadding,pose.position[1]+pose.worldHeight/2+pose.framePadding,pose.position[2]]}));
      station.camera=[x,wallLayout.worldHeight/2,12];station.lookAt=[x,wallLayout.worldHeight/2,wallLayout.wallZ];
      station.bounds={min:[x-spacing/2+.2,.08,wallLayout.wallZ+.081],max:[x+spacing/2-.2,GALLERY_ROOM_LAYOUT.ceiling-.08,25.2]};
      // Keep the illustrative sculpture in the room but outside the exact
      // arrival wall. It cannot hide a photo or the consolidated references.
      const sculpturePosition=[wallLayout.worldWidth/2+GALLERY_ROOM_LAYOUT.stationGap/2,.65,.7];
      figure.position.fromArray(sculpturePosition);
      for(const mesh of [...fittings.children]){
        fittings.remove(mesh);owned.geometries.delete(mesh.geometry);mesh.geometry.dispose();
      }
      architecture(fittings,shapes,material,owned,components,galleryStationDepth(components),sculpturePosition,wallLayout.worldWidth,index===bays.length-1);
    }
    walkBounds.min[0]=-spacing/2+.2;
    walkBounds.min[2]=plans[0].wallLayout.wallZ+.081;
    walkBounds.max[0]=(bays.length-1)*spacing+spacing/2+GALLERY_ROOM_LAYOUT.stationGap/2-.2;
    root.updateMatrixWorld(true);layoutKey=key;
    layoutViewport={...selected,...(selected.dockBounds?{dockBounds:{...selected.dockBounds}}:{})};
    return true;
  };
  resize(viewport);
  // Broad neutral daylight keeps the stone planes related across corners;
  // the warmer, softer key leaves gentle contact beneath each sculpture.
  const ambient=new THREE.HemisphereLight(0xd7dfe0,0x90918a,1.85);ambient.name='gallery-skylight-fill';root.add(ambient);
  const key=new THREE.DirectionalLight(0xeee6da,1.35);key.name='gallery-daylight';key.castShadow=true;
  key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-16,right:16,top:16,bottom:-16,near:1,far:40});
  key.shadow.bias=-.00018;key.shadow.normalBias=.025;root.add(key,key.target);
  const originalFog=scene.fog,fog=new THREE.Fog(0x444b4c,75,170);scene.fog=fog;
  let activeSlug=null,destroyed=false;
  const setActive=(slug,force=false)=>{
    if(destroyed)return;
    const station=stations.get(slug)??stations.values().next().value;
    if(station.slug===activeSlug&&!force)return;
    activeSlug=station.slug;
    for(const bay of bays) {
      const distance=Math.abs(bay.station.index-station.index);
      bay.group.visible=distance<=GALLERY_ROOM_LAYOUT.visibleRadius;
      bay.figure.visible=bay.group.visible;bay.masks.visible=bay.group.visible;
    }
    key.position.set(station.anchor[0]+5,13,10);key.target.position.set(station.anchor[0],2,-1.8);
    root.updateMatrixWorld(true);
  };
  setActive(projects[0].slug);
  const setOrder=orderedProjects=>{
    if(destroyed)return false;
    if(!Array.isArray(orderedProjects)||orderedProjects.length!==bays.length
      ||[...orderedProjects].some(project=>!stations.has(project?.slug))
      ||new Set(orderedProjects.map(project=>project.slug)).size!==stations.size)
      throw new TypeError('Gallery order must contain the same unique project slugs');
    if(orderedProjects.every((project,index)=>project.slug===bays[index].station.slug))return false;
    const bySlug=new Map(bays.map(bay=>[bay.station.slug,bay]));
    const previousLast=bays.at(-1),orderedBays=orderedProjects.map(project=>bySlug.get(project.slug));
    const nextLast=orderedBays.at(-1);
    if(previousLast!==nextLast)for(const name of ROOM_SURFACES){
      // The last corridor tile includes the final sculpture niche. Move its
      // existing geometry with that role rather than rebuilding GPU assets.
      const before=previousLast.fittings.children.find(mesh=>mesh.material.name===`gallery-${name}`);
      const after=nextLast.fittings.children.find(mesh=>mesh.material.name===`gallery-${name}`);
      [before.geometry,after.geometry]=[after.geometry,before.geometry];
    }
    bays.splice(0,bays.length,...orderedBays);stations.clear();
    for(const [index,bay]of bays.entries()){
      const {station}=bay,x=index*station.spacing;
      station.index=index;station.anchor[0]=x;bay.group.position.x=x;
      for(const pose of station.components){
        const mask=bay.masks.children.find(mesh=>mesh.userData.surface===pose.id&&mesh.userData.part==='aperture');
        pose.position[0]=mask.position.x+x;
      }
      station.wallBounds.min[0]=x-station.wallLayout.worldWidth/2;
      station.wallBounds.max[0]=x+station.wallLayout.worldWidth/2;
      station.bounds.min[0]=x-station.spacing/2+.2;station.bounds.max[0]=x+station.spacing/2-.2;
      for(const bounds of station.frontObjects){
        const pose=station.surfaces[bounds.id];
        bounds.min[0]=pose.position[0]-pose.worldWidth/2-pose.framePadding;
        bounds.max[0]=pose.position[0]+pose.worldWidth/2+pose.framePadding;
      }
      station.camera[0]=station.lookAt[0]=x;
      stations.set(station.slug,station);
    }
    setActive(activeSlug,true);return true;
  };
  return {root,stations,setActive,setOrder,walkBounds,
    stationAtPosition(x) {
      if(destroyed)return null;
      const value=Number(x);
      if(Number.isNaN(value))return stations.get(activeSlug)??bays[0].station;
      for(let index=0;index<bays.length-1;index++)if(value<(bays[index].station.anchor[0]+bays[index+1].station.anchor[0])/2)return bays[index].station;
      return bays.at(-1).station;
    },
    get visibleSlugs() {return destroyed?[]:bays.filter(bay=>bay.group.visible).map(bay=>bay.station.slug);},
    resize(nextViewport) {if(destroyed)return false;const changed=resize(nextViewport);if(changed)setActive(activeSlug,true);return changed;},
    get raycastable() {
      if(destroyed)return[];
      const list=[];
      for(const bay of bays)if(bay.group.visible){
        list.push(...bay.masks.children);
        if(bay.figure.visible)bay.figure.traverse(node=>{if(node.isMesh)list.push(node);});
      }
      return list;
    },
    update(_time,_delta,slug=activeSlug) {setActive(slug);return false;},
    getStats() {
      let draws=0,triangles=0;
      root.traverseVisible(node=>{if(node.isMesh){draws++;triangles+=triangleCount(node.geometry);}});
      return {stations:stations.size,visibleStations:bays.filter(b=>b.group.visible).length,
        activeSlug,drawCalls:draws,triangles,geometries:owned.geometries.size,materials:owned.materials.size,
        textures:0,reducedMotion:Boolean(reducedMotion),destroyed};
    },
    dispose() {
      if(destroyed)return;destroyed=true;scene.remove(root);
      if(scene.fog===fog)scene.fog=originalFog;key.shadow.dispose();owned.dispose();root.clear();
    }};
}
