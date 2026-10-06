/**
 * Small, authored physical playgrounds for the existing exhibition capsules.
 * All coordinates are local metres; y is the base of a model, not its centre.
 * These are visual interpretations of public project themes, with no source
 * project prose, clinical inputs, confidential recipes or live services.
 */
const C={mint:'#67e8ca',blue:'#62a9ff',gold:'#ffd477',rose:'#ff8ca8',violet:'#b99aff',white:'#edf5ff',green:'#8fe1a4',orange:'#ffac68'};
const palette=[C.mint,C.blue,C.gold,C.rose,C.violet,C.green];
const item=(id,kind,position,color=C.mint,extra={})=>({id,kind,position,rotation:0,size:[.8,.8,.8],color,accent:C.white,role:'piece',...extra});
const target=(id,kind,position,color,extra={})=>item(id,kind,position,color,{role:'target',size:[1.2,.18,1.2],...extra});
const actor=(kind='robot',color=C.white,extra={})=>item('actor',kind,[0,.04,5.2],color,{role:'actor',size:[.7,.8,.9],speed:3.4,radius:.32,...extra});
const base=(slug,mechanic,theme,extra={})=>({slug,mechanic,theme,actor:actor(),objects:[],targets:[],obstacles:[],connections:[],floorColor:'#193341',radius:6.65,...extra});
const obstacle=(id,position,size=[1,1,1],kind='server')=>item(id,kind,position,'#466273',{role:'obstacle',size,radius:Math.max(size[0],size[2])*.5+.12});
const sources=[[-4.1,.05,-2.8],[-4.5,.05,.1],[-3.5,.05,3.2],[4,.05,-2.5],[4.4,.05,.2],[3.5,.05,3.2]];
const sockets=[[-2.5,.05,-2.5],[0,.05,-3.1],[2.5,.05,-2.5],[-2.5,.05,.7],[0,.05,1.8],[2.5,.05,.7]];

function cargoGame(slug,theme,{vehicle='forklift',cargo='pallet',colors=[C.mint,C.gold,C.blue],docks,barriers=[]}={}){
  const objects=colors.map((color,i)=>item(`cargo-${i}`,cargo,[-4.1,.04,-3.3+i*2.8],color,{targetId:`dock-${i}`,size:[.9,.7,.9]}));
  const targets=colors.map((color,i)=>target(`dock-${i}`,'dock',docks?.[i]??[4.1,.04,-3.3+i*2.8],color,{accepts:[`cargo-${i}`],size:[1.5,.14,1.5]}));
  return base(slug,'delivery',theme,{actor:actor(vehicle,colors[0],{size:vehicle==='forklift'?[.85,.9,1.35]:[.9,.65,1.4]}),objects,targets,obstacles:barriers});
}
function sortGame(slug,theme,kinds,receivers,{colors=palette,positions=sources,groupKinds=null,extra={}}={}){
  const targets=receivers.map((kind,i)=>target(`socket-${i}`,kind,sockets[i],colors[i],{size:[1.35,.16,1.35],groupKind:groupKinds?.[i]}));
  const objects=kinds.map((kind,i)=>{const group=i%receivers.length;return item(`piece-${i}`,kind,positions[i],colors[group],{targetId:targets[group].id,groupKind:groupKinds?.[group],size:kind==='coin'?[.72,.18,.72]:[.72,.75,.72],variant:group});});
  return base(slug,'sort',theme,{actor:actor('gripper',C.white,{size:[.65,.95,.65]}),objects,targets,...extra});
}
function assemblyGame(slug,theme,kinds,{positions=sources,slotPositions=sockets,colors=palette,centre=null}={}){
  const motifs=['triangle','diamond','circle','star','fold','arch'];
  const objects=kinds.map((kind,i)=>item(`part-${i}`,kind,positions[i],colors[i%colors.length],{targetId:`slot-${i}`,sequence:i,groupKind:motifs[i],size:[.7,.75,.7]}));
  const targets=kinds.map((kind,i)=>target(`slot-${i}`,'socket',slotPositions[i],colors[i%colors.length],{accepts:[`part-${i}`],sequence:i,ghostKind:kind,groupKind:motifs[i],size:[1.15,.15,1.15]}));
  return base(slug,'assembly',theme,{actor:actor('gripper'),objects,targets,order:objects.map(o=>o.id),decor:centre?[centre]:[]});
}
function opticsGame(slug,theme,kinds,{sourceKind='camera',receiverKind='receiver',color=C.blue,points=[[-2.6,.1,-2.2],[0,.1,.2],[2.6,.1,-2.2]],decor=[]}={}){
  const source=item('source',sourceKind,[-4.9,.1,-2.2],color,{role:'source',size:[.85,1.05,.85]});
  const receiver=target('receiver',receiverKind,[4.9,.05,-2.2],color,{size:[1.3,1.15,1.3]});
  const objects=[source,...points.map((position,i)=>{
    const next=points[i+1]??receiver.position,angle=Math.atan2(next[0]-position[0],next[2]-position[2]);
    return item(`optic-${i}`,kinds[i%kinds.length],position,palette[i],{role:'control',opticalNode:true,targetRotation:angle,rotation:angle-Math.PI/4*(i+1),turnStep:Math.PI/4,size:[1,1.05,1]});
  })];
  return base(slug,'optics',theme,{objects,targets:[receiver],opticalPath:['source',...points.map((_,i)=>`optic-${i}`),'receiver'],decor,holdTime:.7});
}
function balanceGame(slug,theme,kind,levels,{targetKinds=null,colors=palette,decor=[]}={}){
  const targetPositions=[[-3.5,.04,-1.4],[0,.04,-3.2],[3.5,.04,-1.4],[0,.04,2]];
  const targets=levels.map((level,i)=>target(`well-${i}`,targetKinds?.[i]??'energyWell',targetPositions[i],colors[i],{targetLevel:level,capacity:Math.max(...levels)+1,size:[1.5,.8,1.5]}));
  const count=levels.reduce((n,v)=>n+v,0);
  const objects=Array.from({length:count},(_,i)=>{const angle=Math.PI*.15+(i/(count-1||1))*Math.PI*.7;return item(`unit-${i}`,kind,[Math.cos(angle)*4.7,.05,Math.sin(angle)*4.7],C.gold,{size:[.45,.5,.45],resource:true});});
  return base(slug,'balance',theme,{actor:actor('gripper'),objects,targets,decor});
}
function energyGame(slug,theme,kinds,{solution=[1,2,1],decor=[]}={}){
  const channels=[['load-0','load-2'],['load-0','load-1'],['load-1','load-2']];
  const objects=kinds.map((kind,i)=>item(`generator-${i}`,kind,[[-3.5,.04,2.2],[0,.04,3.9],[3.5,.04,2.2]][i],palette[i],{role:'control',capacity:3,initialLevel:0,channels:channels[i].map(targetId=>({targetId,weight:1})),size:[1.2,1.2,1.2]}));
  const levels=[solution[0]+solution[1],solution[1]+solution[2],solution[0]+solution[2]];
  const targets=levels.map((n,i)=>target(`load-${i}`,'energyWell',[[-3.5,.04,-2.4],[0,.04,-3.9],[3.5,.04,-2.4]][i],palette[i],{targetLevel:n,capacity:6,size:[1.4,.85,1.4]}));
  return base(slug,'energy',theme,{objects,targets,connections:objects.flatMap(o=>o.channels.map(c=>({from:o.id,to:c.targetId,color:o.color}))),decor,holdTime:.8});
}
function traversalGame(slug,mechanic,theme,kind,points,{gate='ring',obstacles=[],colors=palette,decor=[]}={}){
  return base(slug,mechanic,theme,{actor:actor(kind,colors[0],{position:[0,points[0][1],5.2],size:kind==='airplane'?[1.2,.5,1]:kind==='pen'?[.26,1.3,.26]:[.6,.6,.7],speed:mechanic==='trace'?3.1:3.8}),targets:points.map((position,i)=>target(`gate-${i}`,gate,position,colors[i%colors.length],{sequence:i,size:gate==='trackGate'?[1.65,.12,1.25]:[1.45,1.45,.2]})),obstacles,decor,dwellTime:mechanic==='trace'?.16:.08});
}
function routeGame(slug,theme,kinds,{color=C.mint}={}){
  const positions=[[-4.6,.05,2.5],[-2.3,.05,-.7],[0,.05,1.6],[2.3,.05,-.7],[4.6,.05,2.5]];
  const route=positions.map((_,i)=>`node-${i}`);
  const objects=positions.slice(0,-1).map((position,i)=>item(route[i],kinds[i%kinds.length],position,palette[i],{role:i===0?'source':'control',size:[.95,1,.95],exits:i===0?[route[1]]:[route[i+1],`dead-${i}`],initialExit:i===0?0:1}));
  const targets=[target(route.at(-1),'receiver',positions.at(-1),color,{size:[1.3,1.1,1.3]}),...positions.slice(1,-1).map((p,i)=>target(`dead-${i+1}`,'node',[p[0],.04,-3.75],C.rose,{size:[.7,.4,.7],deadEnd:true}))];
  const connections=objects.flatMap(o=>o.exits.map(to=>({from:o.id,to,color:o.color})));
  return base(slug,'routing',theme,{actor:actor('signal',color,{position:[...positions[0]],size:[.32,.32,.32],speed:2.8}),objects,targets,connections,route});
}

const entries=[
  cargoGame('tesla-gigathon-2026','scan-and-dispatch',{barriers:[obstacle('rack-a',[-.8,.02,-2.1],[1.25,1.25,1.3]),obstacle('rack-b',[.8,.02,1.4],[1.25,1.25,1.3])] }),
  opticsGame('hong-kong-talent-engage-eurotech-healthtech-2026','capture-reference-light',['lens','lens','mirror'],{sourceKind:'camera',receiverKind:'receiver',decor:[item('capture-reference','recordCube',[0,.02,-4.4],C.rose,{size:[1.4,.15,1.2]})]}),
  balanceGame('decarbon-days-climathon-2026','grow-the-pitch-garden','pitchOrb',[2,1,2,1],{targetKinds:['tree','tree','tree','tree']}),
  sortGame('pdm-kill-the-search-bar-2026','directory-silhouette-reconciliation',['recordCube','recordCube','recordCube','recordCube','recordCube','recordCube'],['dock','dock','dock'],{groupKinds:['arch','stepped','gable'],extra:{decor:[item('directory','server',[0,.02,-.4],C.gold,{size:[.75,1.3,.75]})]}}),
  assemblyGame('zero-one-hack-supercompute-industrial-2026','synthetic-wafer-process',['wafer','lens','gear','gripper','wafer','recordCube'],{slotPositions:[[-2.6,.05,-2.4],[0,.05,-2.4],[2.6,.05,-2.4],[2.6,.05,.4],[0,.05,.4],[-2.6,.05,.4]],centre:item('process','server',[0,.02,2.4],C.blue,{size:[1.2,1.3,.9]})}),
  (()=>{
    const cfg=base('huawei-tech-arena-finland-2025','morph','globe-unfolding',{actor:actor('gripper'),decor:[item('globe-core','globe',[0,.04,0],C.blue,{size:[2.4,2.4,2.4]})]});
    cfg.objects=Array.from({length:6},(_,i)=>{const a=i*Math.PI/3;return item(`tile-${i}`,'mapTile',[Math.cos(a)*2.05,.2+(i%3)*.55,Math.sin(a)*2.05],palette[i],{targetId:`map-${i}`,targetRotation:i%2?Math.PI/2:0,rotation:(i%2?Math.PI/2:0)-Math.PI/2,size:[.85,.2,.75],turnStep:Math.PI/2,variant:i});});
    cfg.targets=cfg.objects.map((o,i)=>target(o.targetId,'socket',[[-3.9,.04,-2.4],[0,.04,-4.2],[3.9,.04,-2.4],[-3.9,.04,1.8],[0,.04,4.2],[3.9,.04,1.8]][i],o.color,{accepts:[o.id],targetRotation:o.targetRotation,ghostKind:'mapTile',variant:i}));return cfg;
  })(),
  sortGame('real-coin-map-2025','mint-imprint-cabinet',Array(6).fill('coin'),['socket','socket','socket'],{groupKinds:['laurel','star','crescent']}),
  assemblyGame('ethrome-2025','pooled-gift-sculpture',['gift','gift','gift'],{slotPositions:[[-1.5,.05,-.4],[0,.05,-.4],[1.5,.05,-.4]],centre:item('recipient','gift',[0,.04,-3.2],C.rose,{size:[1.7,1.3,1.3]})}),
  routeGame('nasa-space-apps-zurich-2025','mentoring-earth-data-relay',['globe','satellite','book','pitchOrb']),
  assemblyGame('sui-hackathon-poland-2025','join-the-complementary-blocks',Array(6).fill('recordCube'),{slotPositions:[[-2.2,.05,-1.6],[-1.3,.05,-1.6],[1.3,.05,-1.6],[2.2,.05,-1.6],[-.45,.05,1.3],[.45,.05,1.3]],colors:[C.blue,C.blue,C.gold,C.gold,C.mint,C.mint]}),
  energyGame('decarbon-days-climathon-2025','factory-load-orchestra',['battery','turbine','gear'],{solution:[2,1,2],decor:[item('factory','server',[0,.04,0],C.blue,{size:[1.2,1.2,.9]})]}),
  traversalGame('music-ai-osaka-2025','trace','frequency-ribbon-pen','pen',[[-4,.25,1.1],[-2.6,1.1,-1.2],[0,2.6,-2.7],[2.5,1.3,-1.2],[4,.35,1.2],[0,.6,3.2]],{decor:[item('bands','crystal',[0,.02,0],C.violet,{size:[.7,1.8,.7]})]}),
  opticsGame('european-defense-tech-2025-munich','exhibition-display-alignment',['mirror','lens','mirror'],{sourceKind:'radarDish',receiverKind:'receiver',color:C.mint}),
  routeGame('tech-berlin-ai-hackathon-2','context-to-explanation-graph',['document','node','server','crystal'],{color:C.gold}),
  opticsGame('huawei-agorize-2024','multi-view-ear-capture',['camera','camera','camera'],{sourceKind:'earModel',color:C.violet,decor:[item('ear-study','earModel',[0,.04,-4.4],C.rose,{size:[.8,1.2,.5]})]}),
  traversalGame('masters-thesis','maze','one-policy-changing-corridors','robot',[[-4,.04,-2.7],[-1.5,.04,2.5],[1.5,.04,-2.5],[4,.04,2.7]],{gate:'trackGate',obstacles:[{...obstacle('moving-bound-a',[-1.8,.03,-.6],[1,.65,1]),motionAxis:'x',motionAmplitude:.55,motionSpeed:.7},{...obstacle('moving-bound-b',[1.8,.03,.6],[1,.65,1]),motionAxis:'z',motionAmplitude:.6,motionSpeed:.9}]}),
  traversalGame('lauzhack-2024','trace','classroom-handwriting-in-space','pen',[[-4,.25,2],[-3,.35,-1.4],[-1.6,.3,1.1],[0,.35,-1.8],[1.5,.25,1.1],[3,.35,-1.4],[4,.25,2]],{gate:'ring',decor:[item('classroom-page','document',[0,.02,0],C.white,{size:[4,.08,3]})]}),
  routeGame('salzburg-tourism-2024','signal-to-scenery-relay',['EEG','crystal','server','mapTile'],{color:C.violet}),
  balanceGame('zurich-climathon-2024','anonymous-survey-grove','droplet',[2,2,2],{targetKinds:['tree','tree','tree'],decor:[item('privacy-canopy','mask',[0,.02,.6],C.mint,{size:[1.1,1,.7]})]}),
  sortGame('bayer-ai-2024','quality-assurance-laboratory',['recordCube','dna','document','recordCube','dna','document'],['socket','socket','socket'],{groupKinds:['image','helix','fold'],extra:{decor:[item('lab','lens',[0,.02,.2],C.white,{size:[.8,1.2,.8]})]}}),
  routeGame('dsag-ideathon-2024','chronological-context-circuit',['document','gear','server','book'],{color:C.blue}),
  assemblyGame('circular-bsh-2024','recover-and-rebuild-appliance',['frame','motor','gear','battery','gear','frame'],{positions:[[-.6,.05,-.9],[0,.12,-.9],[.6,.1,-.9],[-.6,.08,.1],[0,.16,.1],[.6,.08,.1]],slotPositions:sources,centre:item('appliance-shell','appliance',[0,.02,-3.5],C.white,{size:[1.5,1.6,1.2]})}),
  energyGame('thuega-2024','solar-storage-dispatch',['solarPanel','battery','turbine'],{solution:[1,2,1]}),
  balanceGame('solana-ideathon-2024','peer-pool-equilibrium','crystal',[3,3],{targetKinds:['balancePan','balancePan'],decor:[item('pool','energyWell',[0,.03,1.3],C.mint,{size:[1.6,.7,1.6]})]}),
  assemblyGame('six-swisshacks-2024','reporting-machine',['document','frame','lens','gear','crystal','book'],{centre:item('report','document',[0,.02,-.5],C.white,{size:[1,.9,.15]})}),
  traversalGame('hackupc-2024','flight','interest-city-flight-path','airplane',[[-4,1.6,1.5],[-2.7,2.3,-1.5],[0,2.7,-3],[2.7,2.2,-1.5],[4,1.6,1.5],[0,1.6,3.2]],{decor:[item('route-globe','globe',[0,.03,0],C.blue,{size:[1.8,1.8,1.8]})]}),
  traversalGame('mdsi-bundesliga-2024','flight','thread-the-tactical-lines','football',[[-3.8,.04,2.8],[-2.3,.04,.6],[0,.04,-1.4],[2.3,.04,.6],[3.8,.04,-2.8]],{gate:'trackGate',obstacles:[obstacle('defender-a',[-1.4,.03,-.4],[.65,1.1,.65],'player'),obstacle('defender-b',[1.4,.03,-.4],[.65,1.1,.65],'player')],colors:[C.white,C.mint,C.gold,C.blue,C.white]}),
  traversalGame('draeger-2023','flight','abstract-signal-horizon-rings','signal',[[-3.5,.6,1.5],[0,1.4,-2.8],[3.5,2.2,1.5]],{decor:[item('signal-source','EEG',[0,.02,.4],C.mint,{size:[1.2,.75,.75]})]}),
  sortGame('ethmunich-2023','gallery-shape-neighbours',['crystal','gift','frame','crystal','gift','frame'],['socket','socket','socket'],{groupKinds:['faceted','bow','open-frame']}),
  cargoGame('msg-karlsruhe-2023','green-road-passenger-relay',{vehicle:'car',cargo:'tree',colors:[C.green,C.blue,C.gold],barriers:[obstacle('road-island-a',[-.5,.02,-2],[1.4,.35,1.4],'tree'),obstacle('road-island-b',[.5,.02,1.6],[1.4,.35,1.4],'tree')]}),
  sortGame('bachelors-thesis','noseprint-cat-reunion',Array(6).fill('cat'),['socket','socket','socket'],{groupKinds:['triangle','diamond','circle'],extra:{decor:[item('noseprint-view','lens',[0,.02,.1],C.rose,{size:[.9,1.2,.9]})]}}),
  balanceGame('tgu-perfect-gpa','build-the-study-staircase','book',[3,2,3],{targetKinds:['dock','dock','dock'],decor:[item('graduation','crystal',[0,.03,.4],C.gold,{size:[.9,1.5,.9]})]}),
];

function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}
export const EXHIBIT_GAME_CATALOG=deepFreeze(Object.fromEntries(entries.map(game=>[game.slug,game])));
export function getExhibitGame(slug){return typeof slug==='string'&&Object.hasOwn(EXHIBIT_GAME_CATALOG,slug)?EXHIBIT_GAME_CATALOG[slug]:null;}
