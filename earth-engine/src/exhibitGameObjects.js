import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * The active exhibit's physical toys. One vertex-coloured mesh per miniature
 * keeps the silhouettes detailed without making every fitting a draw call.
 * This module owns its resources; it never reaches into the exhibit or DOM.
 */
export const EXHIBIT_GAME_OBJECT_KINDS = Object.freeze([
  'forklift','pallet','satellite','solarPanel','wafer','gripper','eeg','EEG','camera','cat','coin','football',
  'globe','mapTile','gift','book','pen','earModel','lens','mirror','battery','tree','turbine','appliance',
  'server','crystal','node','document','mask','cube','balancePan','pitchOrb','house','car','aircraft',
  'airplane','robot','player','dna','droplet','gear','motor','frame','signal','recordCube',
  'radarDish',
  'dock','ring','socket','receiver','landingPad','energyWell','trackGate',
]);

const TAU = Math.PI * 2;
const COLORS = {ink:'#263a44',metal:'#9daeb0',paper:'#e9e4d6',brass:'#d5ad66',cyan:'#72d7dc',
  leaf:'#75a88d',rose:'#df9684',blue:'#487bba',dark:'#172934',white:'#f5f1e7'};
const safeColor = (value,fallback) => /^#?[a-f\d]{6}$/i.test(value ?? '') || typeof value === 'number'
  ? new THREE.Color(typeof value==='string'&&!value.startsWith('#')?`#${value}`:value) : new THREE.Color(fallback);
const point = value => Array.isArray(value) && value.length===3 && value.every(Number.isFinite) ? value : [0,0,0];
const dimensions = value => (Array.isArray(value) ? value : [1,1,1]).map(n=>Number.isFinite(n)&&n>0?n:1);
const isTarget = item => item.role==='target' || ['dock','ring','socket','receiver','landingPad','energyWell','trackGate'].includes(item.kind);

function primitiveSet() {
  return {
    box:new THREE.BoxGeometry(1,1,1), sphere:new THREE.SphereGeometry(1,10,7),
    cylinder:new THREE.CylinderGeometry(1,1,1,12), cone:new THREE.ConeGeometry(1,1,10),
    torus:new THREE.TorusGeometry(1,.075,5,20), ico:new THREE.IcosahedronGeometry(1,0),
    thinTorus:new THREE.TorusGeometry(1,.008,4,64),
    guideTorus:new THREE.TorusGeometry(1,.018,4,24),
    crystal:new THREE.OctahedronGeometry(1,0), disc:new THREE.CylinderGeometry(1,1,.008,24),
  };
}

function createAssembler(primitives,owned) {
  const pieces=[],position=new THREE.Vector3(),scale=new THREE.Vector3(),rotation=new THREE.Euler();
  const quaternion=new THREE.Quaternion(),matrix=new THREE.Matrix4();
  const add=(shape,color,xyz,xyzScale=[1,1,1],angles=[0,0,0])=>{
    const source=primitives[shape];
    const geometry=source.index?source.toNonIndexed():source.clone();
    position.fromArray(xyz);scale.fromArray(xyzScale);rotation.set(...angles);
    quaternion.setFromEuler(rotation);matrix.compose(position,quaternion,scale);geometry.applyMatrix4(matrix);
    geometry.deleteAttribute('uv');
    const tint=safeColor(color,COLORS.paper),count=geometry.getAttribute('position').count;
    const colors=new Float32Array(count*3);
    for(let i=0;i<count;i++){colors[i*3]=tint.r;colors[i*3+1]=tint.g;colors[i*3+2]=tint.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(geometry);
  };
  const box=(color,xyz,size,angles)=>add('box',color,xyz,size,angles);
  const ball=(color,xyz,size)=>add('sphere',color,xyz,size);
  const cylinder=(color,xyz,radius,height,angles)=>add('cylinder',color,xyz,[radius,height,radius],angles);
  const ring=(color,xyz,radius,angles=[Math.PI/2,0,0])=>add('torus',color,xyz,[radius,radius,radius],angles);
  const rod=(color,from,to,radius=.03)=>{
    const a=new THREE.Vector3(...from),b=new THREE.Vector3(...to),delta=b.clone().sub(a);
    if(delta.lengthSq()<1e-9)return;
    const geometry=primitives.cylinder.toNonIndexed();geometry.deleteAttribute('uv');
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());
    geometry.applyMatrix4(new THREE.Matrix4().compose(a.add(b).multiplyScalar(.5),q,new THREE.Vector3(radius,delta.length(),radius)));
    const tint=safeColor(color,COLORS.brass),colors=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=tint.r;colors[i+1]=tint.g;colors[i+2]=tint.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));pieces.push(geometry);
  };
  const finish=()=>{
    if(!pieces.length)box(COLORS.paper,[0,.5,0],[.65,.75,.65]);
    const geometry=mergeGeometries(pieces,false);pieces.forEach(g=>g.dispose());
    geometry.computeBoundingBox();owned.add(geometry);return geometry;
  };
  return {add,box,ball,cylinder,ring,rod,finish};
}

function makeMiniature(item,p) {
  const c=item.color||COLORS.paper,a=item.accent||COLORS.brass,m=COLORS.metal,d=COLORS.dark,w=COLORS.white;
  const wheels=(z=.28)=>{for(const x of [-.4,.4])for(const dz of [-z,z])p.cylinder(d,[x,.17,dz],.15,.1,[0,0,Math.PI/2]);};
  const panel=(x,y,z,width=.8,depth=.5)=>{
    p.box(m,[x,y,z],[width,.045,depth]);
    for(let i=0;i<4;i++)p.box(COLORS.blue,[x+(i-1.5)*width/4,y+.027,z],[width/4-.02,.025,depth-.04]);
  };
  switch(item.kind){
    case 'forklift':
      p.box(c,[0,.35,.08],[.72,.35,.64]);p.box(d,[0,.62,.1],[.28,.28,.28]);
      p.box(a,[0,.85,.08],[.75,.065,.55]);
      for(const x of [-.31,.31])p.rod(m,[x,.48,.24],[x,.83,.24],.025);
      for(const x of [-.18,.18]){p.box(m,[x,.54,-.34],[.055,.97,.075]);p.box(a,[x,.14,-.55],[.07,.055,.43]);}
      p.box(d,[0,.56,-.35],[.41,.14,.12]);wheels();break;
    case 'pallet':
      for(const x of [-.35,0,.35])p.box(COLORS.brass,[x,.06,0],[.13,.12,.86]);
      for(let z=0;z<5;z++)p.box(COLORS.paper,[0,.15,(z-2)*.17],[.89,.075,.13]);
      p.box(c,[0,.52,0],[.76,.64,.72]);
      for(const x of [-.21,.21])p.box(a,[x,.53,-.367],[.04,.65,.018]);
      for(const x of [-.21,.21])p.box(a,[x,.85,0],[.04,.022,.73]);break;
    case 'satellite':
      p.box(c,[0,.46,0],[.36,.48,.4]);p.box(a,[0,.47,0],[.39,.07,.43]);
      panel(-.49,.48,0,.58,.58);panel(.49,.48,0,.58,.58);
      p.rod(m,[-.8,.44,0],[.8,.44,0],.025);p.cylinder(d,[0,.76,0],.16,.13);
      p.cylinder(a,[0,.86,0],.08,.08);p.rod(m,[.12,.7,.1],[.23,.99,.18],.018);break;
    case 'solarPanel':panel(0,.65,0,.95,.7);for(const x of [-.3,.3])p.rod(m,[x,.1,.25],[x,.63,-.18],.025);break;
    case 'wafer':
      p.cylinder(c,[0,.14,0],.48,.18);p.ring(a,[0,.24,0],.43);
      for(let x=-1;x<=1;x++)for(let z=-1;z<=1;z++)p.box((x+z)%2?a:d,[x*.21,.242,z*.21],[.15,.022,.15]);break;
    case 'gripper':
      p.cylinder(d,[0,.1,.2],.23,.2);p.cylinder(a,[0,.22,.2],.16,.08);
      p.rod(c,[0,.27,.2],[0,.68,.05],.09);p.ball(m,[0,.68,.05],[.13,.13,.13]);
      p.rod(c,[0,.68,.05],[0,.78,-.28],.075);p.box(d,[0,.72,-.3],[.28,.12,.18]);
      for(const x of [-.13,.13]){p.box(a,[x,.56,-.3],[.055,.29,.075]);p.box(a,[x*.6,.42,-.3],[.14,.05,.08]);}break;
    case 'eeg':case 'EEG':
      p.ball(c,[0,.48,0],[.34,.46,.31]);p.ring(d,[0,.7,0],.34);
      for(let i=0;i<6;i++){const angle=i*TAU/6;p.ball(a,[Math.cos(angle)*.32,.71,Math.sin(angle)*.3],[.055,.06,.055]);}
      p.ball(c,[0,.48,-.32],[.075,.09,.095]);p.rod(m,[.32,.7,0],[.45,.2,.22],.018);break;
    case 'camera':
      p.box(c,[0,.56,.08],[.74,.43,.36]);p.box(d,[0,.58,-.13],[.52,.29,.05]);
      p.cylinder(m,[0,.57,-.27],.17,.22,[Math.PI/2,0,0]);p.cylinder(d,[0,.57,-.4],.14,.065,[Math.PI/2,0,0]);
      p.cylinder(a,[0,.57,-.44],.1,.01,[Math.PI/2,0,0]);
      p.box(d,[.23,.78,.08],[.13,.08,.15]);p.rod(m,[0,.36,.08],[0,.17,.08],.035);
      for(let i=0;i<3;i++){const angle=i*TAU/3;p.rod(d,[0,.17,.08],[Math.cos(angle)*.3,.04,.08+Math.sin(angle)*.3],.025);}break;
    case 'radarDish':
      p.cylinder(d,[0,.055,0],.31,.09);p.rod(m,[0,.08,0],[0,.43,0],.055);
      p.cylinder(c,[0,.65,0],.42,.085,[Math.PI/3,0,0]);p.ring(a,[0,.66,-.04],.4,[Math.PI/3,0,0]);
      p.rod(m,[0,.65,-.05],[0,.75,-.37],.025);p.ball(a,[0,.75,-.37],[.055,.055,.055]);break;
    case 'cat':
      p.ball(c,[0,.36,.12],[.27,.3,.34]);p.ball(c,[0,.7,-.17],[.28,.25,.24]);
      for(const x of [-.18,.18]){p.add('cone',c,[x,.92,-.14],[.11,.23,.11],[0,0,x<0?.22:-.22]);p.ball(d,[x*.55,.74,-.39],[.042,.047,.025]);p.ball(c,[x,.11,-.1],[.095,.12,.14]);}
      p.ball(COLORS.rose,[0,.65,-.414],[.06,.038,.026]);
      p.rod(c,[.14,.25,.36],[.32,.51,.46],.07);p.ball(a,[0,.49,-.08],[.075,.035,.04]);break;
    case 'coin':
      p.cylinder(c,[0,.12,0],.47,.14);p.ring(a,[0,.2,0],.41);p.ring(a,[0,.205,0],.32);
      p.add('ico',a,[0,.225,0],[.19,.045,.19]);
      for(let i=0;i<12;i++){const angle=i*TAU/12;p.box(a,[Math.cos(angle)*.455,.125,Math.sin(angle)*.455],[.04,.1,.035],[0,-angle,0]);}break;
    case 'football':
      p.ball(w,[0,.5,0],[.45,.45,.45]);
      for(const v of [[0,.94,0],[0,.58,-.42],[.38,.64,.17],[-.38,.64,.17],[0,.24,.32]])p.add('ico',d,v,[.13,.12,.12]);break;
    case 'globe':
      p.cylinder(d,[0,.06,0],.28,.1);p.rod(m,[0,.1,0],[0,.34,0],.035);
      p.ball(COLORS.blue,[0,.65,0],[.35,.35,.35]);
      for(const xyz of [[-.16,.8,-.23],[.18,.71,-.26],[-.2,.53,.15],[.1,.43,-.12]])p.ball(COLORS.leaf,xyz,[.13,.11,.07]);
      p.ring(a,[0,.65,0],.39,[0,0,.2]);break;
    case 'mapTile':
      p.box(d,[0,.075,0],[.94,.15,.94]);p.box(c,[0,.16,0],[.88,.04,.88]);
      p.rod(COLORS.blue,[-.4,.19,-.3],[.1,.19,.1],.04);p.rod(COLORS.blue,[.1,.19,.1],[.4,.19,.2],.04);
      for(const [x,z] of [[-.25,.25],[.25,-.2],[.27,.32]])p.add('cone',a,[x,.29,z],[.09,.2,.09]);break;
    case 'gift':
      p.box(c,[0,.4,0],[.72,.66,.7]);p.box(w,[0,.77,0],[.78,.11,.77]);
      p.box(a,[0,.42,-.361],[.09,.72,.02]);p.box(a,[0,.83,0],[.09,.025,.76]);p.box(a,[0,.83,0],[.76,.025,.09]);
      p.ring(a,[-.13,.9,0],.13,[0,.3,.25]);p.ring(a,[.13,.9,0],.13,[0,-.3,-.25]);break;
    case 'book':
      for(const s of [-1,1]){p.box(c,[s*.23,.08,0],[.45,.1,.76],[0,0,s*.12]);p.box(w,[s*.22,.145,0],[.39,.07,.69],[0,0,s*.12]);}
      p.rod(a,[0,.15,-.4],[0,.15,.4],.035);for(const z of [-.2,0,.2])for(const s of [-1,1])p.box(m,[s*.22,.198,z],[.28,.007,.014],[0,0,s*.12]);break;
    case 'pen':
      p.cylinder(c,[0,.5,0],.075,.8,[0,0,-.25]);p.cylinder(d,[-.105,.9,0],.08,.13,[0,0,-.25]);
      p.add('cone',a,[.115,.055,0],[.065,.13,.065],[0,0,Math.PI-.25]);
      for(const y of [.35,.5,.65])p.box(a,[(.5-y)*.255,y,-.077],[.08,.045,.02],[0,0,-.25]);break;
    case 'earModel':
      p.ball(c,[0,.48,0],[.25,.47,.17]);p.ring(a,[0,.56,-.14],.22,[0,0,0]);
      p.ball(d,[.04,.48,-.175],[.07,.15,.025]);p.ball(c,[-.06,.13,-.03],[.11,.13,.14]);break;
    case 'lens':
      p.cylinder(d,[0,.49,0],.4,.12,[Math.PI/2,0,0]);p.ring(m,[0,.49,-.07],.39,[0,0,0]);
      p.cylinder(c,[0,.49,-.075],.32,.015,[Math.PI/2,0,0]);p.ring(a,[0,.49,-.085],.2,[0,0,0]);
      p.box(m,[0,.12,0],[.1,.24,.12]);p.box(d,[0,.03,0],[.54,.06,.3]);break;
    case 'mirror':
      p.box(a,[0,.53,0],[.7,.82,.12]);p.box(c,[0,.54,-.07],[.57,.67,.026]);
      p.box(w,[-.16,.68,-.085],[.018,.3,.01],[0,0,-.3]);p.box(d,[0,.07,.07],[.53,.09,.37]);break;
    case 'battery':
      p.box(c,[0,.44,0],[.55,.77,.43]);p.box(d,[0,.85,0],[.59,.07,.47]);
      for(const x of [-.17,.17])p.cylinder(a,[x,.93,0],.065,.12);
      for(const y of [.24,.44,.64])p.box(a,[0,y,-.225],[.3,.12,.025]);break;
    case 'tree':
      p.cylinder(COLORS.brass,[0,.3,0],.065,.6);
      p.add('ico',c,[0,.7,0],[.35,.33,.34]);p.add('ico',a,[-.16,.58,.13],[.2,.2,.19]);break;
    case 'turbine':
      p.cylinder(d,[0,.055,0],.22,.1);p.add('cone',c,[0,.49,0],[.065,.83,.065]);p.ball(a,[0,.86,-.04],[.085,.085,.085]);
      for(let i=0;i<3;i++){const angle=i*TAU/3;p.box(w,[Math.sin(angle)*.22,.86+Math.cos(angle)*.22,-.07],[.075,.46,.035],[0,0,-angle]);}break;
    case 'appliance':
      p.box(c,[0,.48,0],[.71,.89,.63]);p.box(d,[0,.77,-.325],[.63,.13,.035]);
      p.ring(m,[0,.43,-.33],.235,[0,0,0]);p.cylinder(d,[0,.43,-.33],.19,.04,[Math.PI/2,0,0]);p.cylinder(a,[.2,.79,-.352],.045,.025,[Math.PI/2,0,0]);break;
    case 'server':
      p.box(d,[0,.5,0],[.62,.95,.55]);
      for(let i=0;i<4;i++){p.box(c,[0,.2+i*.2,-.29],[.55,.14,.04]);p.box(a,[-.2,.2+i*.2,-.317],[.025,.045,.018]);p.box(m,[.09,.2+i*.2,-.317],[.2,.025,.018]);}break;
    case 'crystal':p.add('crystal',c,[0,.5,0],[.35,.47,.35]);p.cylinder(a,[0,.06,0],.29,.1);break;
    case 'node':
      p.ball(c,[0,.5,0],[.23,.23,.23]);for(let i=0;i<4;i++){const angle=i*TAU/4,xyz=[Math.cos(angle)*.41,.5+Math.sin(angle)*.3,Math.sin(angle)*.28];p.rod(m,[0,.5,0],xyz,.025);p.ball(a,xyz,[.09,.09,.09]);}break;
    case 'document':
      for(let i=0;i<3;i++)p.box(w,[0,.04+i*.025,0],[.64,.025,.87],[0,i*.055,0]);
      p.box(c,[0,.12,-.15],[.45,.03,.12]);for(const z of [.0,.1,.2])p.box(m,[-.05,.13,z],[.37,.01,.025]);p.cylinder(a,[.19,.14,.3],.09,.025);break;
    case 'mask':
      p.ball(c,[0,.53,0],[.32,.43,.13]);for(const x of [-.12,.12])p.ball(d,[x,.61,-.13],[.08,.045,.025]);
      p.ball(a,[0,.47,-.17],[.055,.085,.055]);p.rod(m,[-.28,.57,0],[.28,.57,0],.025);break;
    case 'balancePan':
      p.cylinder(d,[0,.05,0],.28,.08);p.rod(m,[0,.1,0],[0,.82,0],.035);p.rod(a,[-.4,.75,0],[.4,.75,0],.025);
      for(const x of [-.34,.34]){p.rod(m,[x,.75,0],[x,.3,0],.015);p.cylinder(c,[x,.3,0],.19,.045);p.ring(a,[x,.33,0],.19);}break;
    case 'pitchOrb':p.cylinder(d,[0,.07,0],.29,.1);p.rod(a,[0,.12,0],[0,.38,0],.05);p.add('ico',c,[0,.62,0],[.33,.33,.33]);p.ring(a,[0,.62,0],.4,[0,0,.25]);break;
    case 'house':
      p.box(c,[0,.39,0],[.65,.6,.64]);p.add('cone',a,[0,.84,0],[.49,.38,.49],[0,Math.PI/4,0]);
      p.box(d,[0,.28,-.326],[.15,.32,.018]);for(const x of [-.21,.21])p.box(COLORS.cyan,[x,.48,-.328],[.13,.14,.02]);break;
    case 'car':p.box(c,[0,.34,0],[.7,.28,.92]);p.box(d,[0,.58,.04],[.57,.26,.5]);wheels(.32);p.box(a,[0,.37,-.48],[.5,.055,.02]);break;
    case 'airplane':case 'aircraft':
      p.ball(c,[0,.5,0],[.11,.11,.47]);p.box(c,[0,.48,0],[.96,.055,.23],[0,0,.04]);
      p.box(a,[0,.53,.33],[.38,.04,.17]);p.box(a,[0,.65,.33],[.035,.3,.16]);break;
    case 'robot':
      p.box(c,[0,.53,0],[.35,.4,.28]);p.box(d,[0,.87,0],[.32,.25,.3]);
      for(const x of [-.1,.1]){p.ball(a,[x,.89,-.16],[.035,.035,.022]);p.box(m,[x,.2,0],[.1,.26,.1]);p.box(d,[x,.05,-.045],[.15,.1,.24]);p.rod(c,[x*2,.68,0],[x*3,.38,0],.055);}break;
    case 'player':
      p.ball(c,[0,.86,0],[.14,.14,.14]);p.box(c,[0,.57,0],[.3,.3,.17]);
      for(const s of [-1,1]){p.rod(d,[s*.09,.43,0],[s*.12,.15,-s*.04],.05);p.ball(a,[s*.12,.07,-s*.06],[.08,.06,.12]);p.rod(c,[s*.18,.68,0],[s*.26,.42,0],.04);}break;
    case 'dna':
      for(let i=0;i<8;i++){const angle=i*.75,y=.08+i*.11,x=Math.cos(angle)*.24,z=Math.sin(angle)*.24;
        p.ball(c,[x,y,z],[.055,.055,.055]);p.ball(a,[-x,y,-z],[.055,.055,.055]);p.rod(m,[x,y,z],[-x,y,-z],.018);
        if(i){const previous=(i-1)*.75;p.rod(c,[Math.cos(previous)*.24,y-.11,Math.sin(previous)*.24],[x,y,z],.025);p.rod(a,[-Math.cos(previous)*.24,y-.11,-Math.sin(previous)*.24],[-x,y,-z],.025);}}break;
    case 'droplet':p.ball(c,[0,.36,0],[.3,.32,.3]);p.add('cone',c,[0,.71,0],[.24,.53,.24]);p.ball(w,[-.1,.48,-.25],[.05,.09,.025]);break;
    case 'gear':
      p.cylinder(c,[0,.2,0],.35,.25);p.ring(a,[0,.335,0],.22);p.cylinder(d,[0,.338,0],.08,.035);
      for(let i=0;i<8;i++){const angle=i*TAU/8;p.box(c,[Math.cos(angle)*.37,.2,Math.sin(angle)*.37],[.18,.24,.13],[0,-angle,0]);}break;
    case 'motor':
      p.box(d,[0,.07,0],[.67,.13,.63]);p.cylinder(c,[0,.4,0],.26,.6,[Math.PI/2,0,0]);
      for(const z of [-.22,-.1,.02,.14])p.ring(m,[0,.4,z],.28,[0,0,0]);p.cylinder(a,[0,.4,-.38],.08,.17,[Math.PI/2,0,0]);p.box(d,[0,.71,.05],[.24,.13,.28]);break;
    case 'frame':
      for(const x of [-.36,.36])p.box(c,[x,.5,0],[.09,.94,.12]);for(const y of [.055,.945])p.box(c,[0,y,0],[.76,.09,.12]);
      p.box(a,[0,.95,0],[.31,.04,.13]);p.box(d,[0,.055,.04],[.83,.11,.4]);break;
    case 'signal':
      p.cylinder(d,[0,.045,0],.43,.08);
      for(let i=0;i<5;i++){const h=.25+(.5+.5*Math.sin(i*1.7))*.6;p.box(i===2?a:c,[(i-2)*.15,.08+h*.5,0],[.075,h,.11]);}break;
    case 'recordCube':
      p.box(c,[0,.4,0],[.65,.65,.65]);p.box(d,[0,.45,-.338],[.55,.41,.025]);
      for(let i=0;i<3;i++)p.box(a,[-.12+i*.12,.46,-.357],[.045,.22,.017]);p.box(a,[0,.075,0],[.72,.05,.72]);break;
    case 'trackGate':
      for(const x of [-.42,.42])p.box(c,[x,.45,0],[.11,.9,.18]);p.box(a,[0,.89,0],[.95,.08,.19]);
      for(const x of [-.42,.42])p.box(d,[x,.05,0],[.28,.1,.36]);break;
    case 'receiver':
      p.cylinder(d,[0,.055,0],.46,.09);p.ring(a,[0,.12,0],.41);
      for(let i=0;i<4;i++){const angle=i*TAU/4;p.box(c,[Math.cos(angle)*.4,.3,Math.sin(angle)*.4],[.13,.36,.13]);}break;
    case 'landingPad':case 'dock':
      p.cylinder(d,[0,.045,0],.47,.07);p.ring(c,[0,.088,0],.44);
      for(const x of [-.25,.25])p.box(a,[x,.09,0],[.055,.025,.47]);p.box(a,[0,.09,0],[.5,.025,.055]);break;
    case 'energyWell':
      p.cylinder(d,[0,.04,0],.44,.06);p.ring(a,[0,.09,0],.42);p.ring(c,[0,.115,0],.3);
      p.add('crystal',c,[0,.28,0],[.12,.19,.12]);break;
    case 'ring':case 'socket':
      if(item.kind==='ring'&&item.size?.[2]<.4&&item.size?.[1]>1){
        p.ring(c,[0,.5,0],.43,[0,0,0]);p.ring(a,[0,.5,0],.35,[0,0,0]);p.box(d,[0,.04,0],[.5,.06,.12]);
      }else{
        p.ring(c,[0,.07,0],.45);p.ring(a,[0,.045,0],.36);
        for(let i=0;i<3;i++){const angle=i*TAU/3;p.add('cone',a,[Math.cos(angle)*.46,.065,Math.sin(angle)*.46],[.06,.13,.06]);}
      }break;
    default:
      p.box(c,[0,.42,0],[.64,.68,.64]);p.box(a,[0,.78,0],[.7,.06,.7]);p.box(d,[0,.05,0],[.72,.07,.72]);
      p.add('ico',a,[0,.83,0],[.12,.1,.12]);
  }
}

// Shape stamps carry identity when two pieces share a silhouette or hue.
function addMotif(p,kind,color,center=[0,.95,0],radius=.2) {
  const [x,y,z]=center,at=(dx,dz)=>[x+dx*radius,y,z+dz*radius];
  if(!kind)return;
  switch(kind){
    case 'circle':p.ring(color,center,radius*.7);break;
    case 'crescent':p.ring(color,center,radius*.8);p.ball(COLORS.dark,at(.45,-.1),[radius*.7,.025,radius*.7]);break;
    case 'laurel':
      for(let i=0;i<7;i++){const a=Math.PI*.15+i*Math.PI*.7/6;for(const s of [-1,1])p.ball(color,at(s*Math.cos(a)*.7,Math.sin(a)*.8),[radius*.14,.03,radius*.25]);}break;
    case 'star':
      for(let i=0;i<5;i++){const a=i*TAU/5;p.rod(color,center,at(Math.sin(a),Math.cos(a)),radius*.15);}break;
    case 'diamond':case 'faceted':p.add('crystal',color,center,[radius*.8,.065,radius*.8]);break;
    case 'triangle':case 'gable':
      p.rod(color,at(-.8,.65),at(0,-.8),radius*.11);p.rod(color,at(0,-.8),at(.8,.65),radius*.11);p.rod(color,at(.8,.65),at(-.8,.65),radius*.11);break;
    case 'stepped':
      for(let i=0;i<3;i++)p.box(color,at((i-1)*.55,.5-i*.4),[radius*.45,.06,radius*.65]);break;
    case 'arch':p.ring(color,at(0,-.15),radius*.7);p.box(COLORS.dark,at(0,.6),[radius*1.8,.07,radius*.6]);break;
    case 'helix':
      for(let i=0;i<4;i++){const shift=Math.sin(i*1.5)*.5;p.rod(color,at(shift,(i-1.5)*.5),at(-shift,(i-1.5)*.5),radius*.08);p.ball(color,at(shift,(i-1.5)*.5),[radius*.13,.03,radius*.13]);}break;
    case 'bow':p.ring(color,at(-.4,0),radius*.38);p.ring(color,at(.4,0),radius*.38);break;
    case 'image':case 'open-frame':
      for(const s of [-1,1]){p.rod(color,at(-.8,s*.8),at(.8,s*.8),radius*.08);p.rod(color,at(s*.8,-.8),at(s*.8,.8),radius*.08);}break;
    case 'fold':p.rod(color,at(-.6,.65),at(0,-.7),radius*.1);p.rod(color,at(0,-.7),at(.6,.65),radius*.1);break;
  }
}

function fitGeometry(geometry,size) {
  const box=geometry.boundingBox,center=box.getCenter(new THREE.Vector3()),extent=box.getSize(new THREE.Vector3());
  geometry.translate(-center.x,-box.min.y,-center.z);
  geometry.scale(size[0]/Math.max(.001,extent.x),size[1]/Math.max(.001,extent.y),size[2]/Math.max(.001,extent.z));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
}

/** Only the active game allocates these assets. All coordinates are exhibit-local. */
export function createExhibitGameObjects(config) {
  const root=new THREE.Group();root.name=`physical-exhibit-game:${config.slug||'game'}`;
  root.userData.isExhibitGame=true;
  const ownedGeometries=new Set(),ownedMaterials=new Set(),primitives=primitiveSet();
  Object.values(primitives).forEach(g=>ownedGeometries.add(g));
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.52,metalness:.22});
  const guideMaterial=new THREE.MeshBasicMaterial({color:COLORS.cyan,transparent:true,opacity:.22,depthWrite:false});
  const shadowMaterial=new THREE.MeshBasicMaterial({color:COLORS.ink,transparent:true,opacity:.16,depthWrite:false});
  const signalMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.65,depthWrite:false});
  [material,guideMaterial,shadowMaterial,signalMaterial].forEach(m=>ownedMaterials.add(m));
  const selectedMaterial=new THREE.MeshBasicMaterial({color:COLORS.brass,transparent:true,opacity:.74,depthWrite:false});
  const completedMaterial=new THREE.MeshBasicMaterial({color:'#78ddb0',transparent:true,opacity:.7,depthWrite:false});
  const errorMaterial=new THREE.MeshBasicMaterial({color:COLORS.rose,transparent:true,opacity:.8,depthWrite:false});
  const ghostMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:.22,depthWrite:false});
  const chargeMaterial=new THREE.MeshStandardMaterial({color:COLORS.white,metalness:.15,roughness:.35});
  ownedMaterials.add(selectedMaterial);ownedMaterials.add(completedMaterial);ownedMaterials.add(errorMaterial);ownedMaterials.add(ghostMaterial);ownedMaterials.add(chargeMaterial);
  const items=new Map(),pickable=[];
  let destroyed=false,elapsedTime=0,completionAt=null,snapshotComplete=false,beamSignature='',trailSignature='';
  let beamsMesh=null,trailMesh=null;
  const arenaBuilder=createAssembler(primitives,ownedGeometries);
  arenaBuilder.add('thinTorus',config.floorColor||COLORS.metal,[0,.065,0],[6.78,6.78,6.78],[Math.PI/2,0,0]);
  for(let i=0;i<12;i++){
    const angle=i*TAU/12,x=Math.sin(angle)*6.55,z=Math.cos(angle)*6.55;
    arenaBuilder.box(i%3===0?COLORS.brass:COLORS.metal,[x,.035,z],[.16,.025,.42],[0,angle,0]);
  }
  const arena=new THREE.Mesh(arenaBuilder.finish(),material);arena.name='arena-perimeter';root.add(arena);
  const floorGeometry=new THREE.CircleGeometry(6.65,32);ownedGeometries.add(floorGeometry);
  const floorMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false,side:THREE.DoubleSide});ownedMaterials.add(floorMaterial);
  const floor=new THREE.Mesh(floorGeometry,floorMaterial);floor.rotation.x=-Math.PI/2;floor.position.y=.006;
  floor.name='game-floor-picking-surface';floor.userData.gameObjectId='__floor';root.add(floor);pickable.push(floor);
  const addItem=item=>{
    if(!item?.id||items.has(item.id))return;
    const node=new THREE.Group();node.name=`game-object:${item.id}`;node.userData.gameObjectId=item.id;
    const builder=createAssembler(primitives,ownedGeometries);makeMiniature(item,builder);
    addMotif(builder,item.groupKind,item.accent||COLORS.brass,[0,item.kind==='coin'?.26:1.035,0],.2);
    const geometry=builder.finish(),size=dimensions(item.size);fitGeometry(geometry,size);
    const body=new THREE.Mesh(geometry,material);body.userData.gameObjectId=item.id;
    // Miniature noses/forks are authored toward -z; movement yaw aims +z.
    // Rotate only the actor body so travel, steering and puzzle arrows agree.
    if(item.role==='actor')body.rotation.y=Math.PI;
    body.castShadow=false;body.receiveShadow=false;node.add(body);pickable.push(body);
    const radius=Math.max(size[0],size[2])*.6;
    const shadow=new THREE.Mesh(primitives.disc,shadowMaterial);shadow.scale.set(radius,.5,radius);
    shadow.position.y=.013;node.add(shadow);
    const halo=new THREE.Mesh(primitives.guideTorus,guideMaterial);halo.rotation.x=Math.PI/2;halo.position.y=.055;
    halo.scale.setScalar(radius*1.1);halo.visible=false;node.add(halo);
    node.position.fromArray(point(item.position));node.rotation.y=Number.isFinite(item.rotation)?item.rotation:0;
    let ghost=null,counter=null,counterGhost=null,arrow=null,goalArrow=null;
    if(item.ghostKind){
      const ghostBuilder=createAssembler(primitives,ownedGeometries);makeMiniature({...item,kind:item.ghostKind},ghostBuilder);
      const ghostGeometry=ghostBuilder.finish();fitGeometry(ghostGeometry,[size[0]*.52,Math.min(.55,size[0]*.4),size[2]*.52]);
      ghost=new THREE.Mesh(ghostGeometry,ghostMaterial);ghost.position.y=size[1]+.03;ghost.rotation.y=item.targetRotation||0;ghost.userData.gameObjectId=item.id;
      node.add(ghost);pickable.push(ghost);
    }
    if(Number.isFinite(item.capacity)||Number.isFinite(item.targetLevel)){
      const capacity=Math.max(1,Math.min(8,Math.round(item.capacity||item.targetLevel||1)));
      counter=new THREE.InstancedMesh(primitives.ico,chargeMaterial,capacity);counter.count=0;counter.name=`charge:${item.id}`;node.add(counter);
      const ghostBuilder=createAssembler(primitives,ownedGeometries),desired=Math.min(capacity,item.targetLevel||capacity);
      for(let i=0;i<desired;i++){const angle=-Math.PI*.72+i*Math.PI*1.44/Math.max(1,capacity-1);ghostBuilder.ring(item.color||COLORS.cyan,[Math.sin(angle)*size[0]*.5,size[1]+.08,Math.cos(angle)*size[2]*.5],.095);}
      counterGhost=new THREE.Mesh(ghostBuilder.finish(),ghostMaterial);node.add(counterGhost);
      counter.userData.capacity=capacity;
    }
    if(item.opticalNode||item.exits){
      const arrowBuilder=createAssembler(primitives,ownedGeometries);
      arrowBuilder.rod(item.accent||COLORS.brass,[0,0,0],[0,0,.5],.035);
      arrowBuilder.rod(item.accent||COLORS.brass,[0,0,.5],[-.1,0,.36],.035);arrowBuilder.rod(item.accent||COLORS.brass,[0,0,.5],[.1,0,.36],.035);
      arrow=new THREE.Mesh(arrowBuilder.finish(),selectedMaterial);arrow.position.y=size[1]+.13;node.add(arrow);
      if(item.opticalNode&&Number.isFinite(item.targetRotation)){
        goalArrow=new THREE.Mesh(arrow.geometry,guideMaterial);goalArrow.position.y=.05;goalArrow.scale.setScalar(1.1);node.add(goalArrow);
      }
    }
    const state={node,body,halo,shadow,ghost,counter,counterGhost,arrow,goalArrow,item,target:new THREE.Vector3(...point(item.position)),velocity:new THREE.Vector3(),rotation:node.rotation.y,
      glow:0,pulse:0,complete:Boolean(item.complete),size,lastLevel:Number(item.level)||0};
    items.set(item.id,state);root.add(node);
  };
  const allItems=snapshot=>[snapshot.actor,...(snapshot.objects||[]),...(snapshot.targets||[]),...(snapshot.obstacles||[]),
    ...(snapshot.decor??config.decor??[]).map(item=>({...item,role:'decor'}))].filter(Boolean);
  allItems(config).forEach(addItem);
  const railsBuilder=createAssembler(primitives,ownedGeometries);
  let railCount=0;
  for(const connection of (config.connections||[]).slice(0,24)){
    const from=items.get(connection.from),to=items.get(connection.to);
    if(from&&to){const a=from.node.position.toArray(),b=to.node.position.toArray();a[1]=b[1]=.035;
      railsBuilder.rod(COLORS.metal,a,b,.028);railCount++;}
  }
  if(railCount){const rails=new THREE.Mesh(railsBuilder.finish(),material);rails.name='connection-rails';root.add(rails);}

  const sparks=new THREE.InstancedMesh(primitives.ico,signalMaterial,18);sparks.name='finite-completion-sparks';sparks.visible=false;
  const sparkColor=new THREE.Color();for(let i=0;i<18;i++)sparks.setColorAt(i,sparkColor.set(i%2?COLORS.cyan:COLORS.brass));root.add(sparks);
  const matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),vector=new THREE.Vector3(),sizing=new THREE.Vector3();

  const replacePath=(current,segments,name)=>{
    if(current){root.remove(current);ownedGeometries.delete(current.geometry);current.geometry.dispose();}
    if(!segments.length)return null;
    const p=createAssembler(primitives,ownedGeometries);
    segments.slice(0,name==='physical-motion-trail'?180:24).forEach(({from,to,color})=>p.rod(color||COLORS.cyan,point(from),point(to),.022));
    const mesh=new THREE.Mesh(p.finish(),signalMaterial);mesh.name=name;root.add(mesh);return mesh;
  };
  const sync=(snapshot,deltaSeconds)=>{
    if(destroyed)return false;
    const initializing=!Number.isFinite(deltaSeconds)||(deltaSeconds===0&&elapsedTime===0);
    const dt=initializing?0:Math.min(.05,Math.max(0,deltaSeconds));elapsedTime+=dt;const now=elapsedTime;
    let needsMoreFrames=false;
    const supplied=new Set();
    for(const item of allItems(snapshot||config)){
      addItem(item);supplied.add(item.id);const state=items.get(item.id);if(!state)continue;
      state.item=item;state.target.fromArray(point(item.position));state.node.visible=item.visible!==false;
      state.rotation=Number.isFinite(item.rotation)?item.rotation:0;
      const selected=Boolean(item.selected)||snapshot?.selectedId===item.id;
      const hovered=Boolean(item.hovered)||snapshot?.hoveredId===item.id;
      const complete=Boolean(item.complete);
      if(complete&&!state.complete){state.pulse=1;needsMoreFrames=true;}
      if(Number.isFinite(item.level)&&item.level!==state.lastLevel){state.pulse=.65;state.lastLevel=item.level;needsMoreFrames=true;}
      state.complete=complete;state.halo.visible=selected||hovered||complete||isTarget(item)||Number(item.glow)>=.5||Number(item.glow)<0;
      state.halo.material=Number(item.glow)<0?errorMaterial:complete?completedMaterial:selected||hovered?selectedMaterial:guideMaterial;
      state.glow=selected?1:hovered?.7:complete?.7:Math.max(0,Math.min(1,Number(item.glow)||0));
      // A damped spring gives moved pieces weight, then settles exactly.
      if(initializing)state.node.position.copy(state.target);
      const offset=state.target.clone().sub(state.node.position);
      state.velocity.addScaledVector(offset,100*dt).multiplyScalar(Math.exp(-17*dt));
      state.node.position.addScaledVector(state.velocity,dt);
      if(offset.lengthSq()+state.velocity.lengthSq()>.000015){needsMoreFrames=true;}else{state.node.position.copy(state.target);state.velocity.set(0,0,0);}
      let angle=((state.rotation-state.node.rotation.y+Math.PI)%TAU+TAU)%TAU-Math.PI;
      if(Math.abs(angle)>.001){state.node.rotation.y+=angle*(1-Math.exp(-14*dt));needsMoreFrames=true;}else state.node.rotation.y=state.rotation;
      const scale=1+state.pulse*.055;state.body.scale.setScalar(scale);
      state.body.position.y=state.pulse*.12;
      state.body.rotation.z=Number(item.glow)<0?Math.sin(now*25)*.055:0;
      if(state.pulse>.001){state.pulse*=Math.exp(-9*dt);needsMoreFrames=true;}else{state.pulse=0;state.body.scale.setScalar(1);state.body.position.y=0;}
      state.halo.scale.setScalar(Math.max(state.size[0],state.size[2])*.66*(1+state.glow*.08+state.pulse*.22));
      // Stable selection markers do not keep the render loop alive.
      state.halo.rotation.z=complete?.18:0;
      state.shadow.visible=!isTarget(item)&&state.node.visible;
      state.shadow.position.y=.013-state.node.position.y;
      const projection=1+Math.max(0,state.node.position.y)*.09;
      state.shadow.scale.set(Math.max(state.size[0],state.size[2])*.6*projection,.5,Math.max(state.size[0],state.size[2])*.6*projection);
      if(state.ghost)state.ghost.visible=!complete;
      if(state.counter){
        const capacity=state.counter.userData.capacity,level=Math.max(0,Math.min(capacity,Math.round(Number(item.level)||0)));
        state.counter.count=level;
        for(let i=0;i<level;i++){
          const angle=-Math.PI*.72+i*Math.PI*1.44/Math.max(1,capacity-1);
          vector.set(Math.sin(angle)*state.size[0]*.5,state.size[1]+.08,Math.cos(angle)*state.size[2]*.5);
          q.identity();sizing.setScalar(.083);matrix.compose(vector,q,sizing);state.counter.setMatrixAt(i,matrix);
          state.counter.setColorAt(i,safeColor(complete?'#78ddb0':item.color,COLORS.cyan));
        }
        state.counter.instanceMatrix.needsUpdate=true;if(state.counter.instanceColor)state.counter.instanceColor.needsUpdate=true;
        state.counterGhost.visible=!complete;
      }
      if(item.kind==='tree'&&isTarget(item)){
        const growth=item.targetLevel?Math.max(.22,Math.min(1,(item.level||0)/item.targetLevel)):Number.isFinite(item.charge)?Math.max(.22,Math.min(1,item.charge)):1;
        state.body.scale.multiply(new THREE.Vector3(.65+.35*growth,growth,.65+.35*growth));
      }
      if(state.arrow){
        state.arrow.material=complete||item.glow>=.9?completedMaterial:selectedMaterial;
        const exit=item.exits?.[item.exitIndex??item.exit??0];
        if(exit&&items.has(exit)){
          const destination=items.get(exit).target;
          state.arrow.rotation.y=Math.atan2(destination.x-state.target.x,destination.z-state.target.z)-state.node.rotation.y;
        }
      }
      if(state.goalArrow){state.goalArrow.rotation.y=item.targetRotation-state.node.rotation.y;state.goalArrow.visible=!complete;}
    }
    for(const [id,state] of items)if(!supplied.has(id))state.node.visible=false;
    const beamSegments=(snapshot?.beams||[]).filter(b=>b.active!==false);
    const newBeamSignature=JSON.stringify(beamSegments);
    if(newBeamSignature!==beamSignature){beamsMesh=replacePath(beamsMesh,beamSegments,'physical-signal-beams');beamSignature=newBeamSignature;}
    const trails=snapshot?.trails||[],newTrailSignature=JSON.stringify(trails);
    if(newTrailSignature!==trailSignature){
      const segments=[];for(let i=1;i<trails.length;i++)segments.push({from:trails[i-1],to:trails[i],color:COLORS.brass});
      trailMesh=replacePath(trailMesh,segments,'physical-motion-trail');trailSignature=newTrailSignature;
    }
    const completed=Boolean(snapshot?.completed);
    if(completed&&!snapshotComplete)completionAt=now;
    if(!completed)completionAt=null;snapshotComplete=completed;
    if(completionAt!==null){
      const t=now-completionAt;sparks.visible=t>=0&&t<1.6;
      if(sparks.visible){
        for(let i=0;i<18;i++){
          const angle=i*TAU/18,radius=1.6+t*1.8;
          vector.set(Math.sin(angle)*radius,.5+Math.sin(Math.min(1,t/1.6)*Math.PI)*(1.1+i%3*.18),Math.cos(angle)*radius);
          q.setFromEuler(new THREE.Euler(t*3+i,t*2,angle));sizing.setScalar(.07*(1-t/1.6));matrix.compose(vector,q,sizing);sparks.setMatrixAt(i,matrix);
        }
        sparks.instanceMatrix.needsUpdate=true;needsMoreFrames=true;
      }
    }
    return needsMoreFrames;
  };
  const getStats=()=>{
    let triangles=0,drawCalls=0,visibleObjects=0;
    root.traverse(object=>{
      if(!object.isMesh||!object.visible)return;
      let parent=object.parent;while(parent&&parent!==root){if(!parent.visible)return;parent=parent.parent;}
      const count=object.geometry.index?.count??object.geometry.getAttribute('position')?.count??0;
      triangles+=count/3*(object.isInstancedMesh?object.count:1);drawCalls++;
    });
    items.forEach(({node})=>{if(node.visible)visibleObjects++;});
    return {triangles,drawCalls,objects:items.size,visibleObjects,geometries:ownedGeometries.size,materials:ownedMaterials.size,destroyed};
  };
  const destroy=()=>{
    if(destroyed)return;destroyed=true;
    root.traverse(object=>{if(object.isInstancedMesh)object.dispose();});
    root.removeFromParent();root.clear();pickable.length=0;items.clear();
    ownedGeometries.forEach(geometry=>geometry.dispose());ownedMaterials.forEach(mat=>mat.dispose());
    ownedGeometries.clear();ownedMaterials.clear();
  };
  sync(config);
  return {root,get pickable(){return pickable.filter(mesh=>{let parent=mesh;while(parent&&parent!==root){if(!parent.visible)return false;parent=parent.parent;}return true;});},sync,destroy,getStats};
}
