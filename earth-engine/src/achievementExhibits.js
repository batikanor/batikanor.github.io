/**
 * Static, explanatory portfolio miniatures. This module only submits geometry
 * to the host's material-keyed batch; no renderer, texture, animation or fetch.
 * Objects illustrate the author's actual descriptions, never surveyed venue
 * installations, proprietary prototypes, medical data or measured results.
 */

export const EXHIBIT_MODELS = Object.freeze({
  'tesla-gigathon-2026':{kind:'supply-chain-cell',parts:['roller conveyor','pallet racks','cargo pallets','logistics terminal']},
  'hong-kong-talent-engage-eurotech-healthtech-2026':{kind:'conjunctiva-imaging',parts:['conjunctiva eye study','imaging camera','hemoglobin estimation screen']},
  'decarbon-days-climathon-2026':{kind:'climate-jury-forum',parts:['jury desks','pitch display','factory energy demonstrator']},
  'pdm-kill-the-search-bar-2026':{kind:'directory-discovery',parts:['discovery kiosk','directory cards','comparison display']},
  'zero-one-hack-supercompute-industrial-2026':{kind:'semiconductor-cell',parts:['silicon wafer','process cell','sequence-monitoring terminal']},
  'huawei-tech-arena-finland-2025':{kind:'globe-transition',parts:['desktop globe','flattened map display','map transition frames']},
  'real-coin-map-2025':{kind:'numismatic-study',parts:['coin specimen trays','optical inspection station','mint map display']},
  'ethrome-2025':{kind:'private-gifting',parts:['gift parcels','pooled contribution console','privacy lock']},
  'nasa-space-apps-zurich-2025':{kind:'satellite-ground-station',parts:['satellite bus','solar panel wings','ground-station dish','geography terminal']},
  'sui-hackathon-poland-2025':{kind:'word-minting-workbench',parts:['word-composition tiles','minted object cards','Move contract terminal']},
  'decarbon-days-climathon-2025':{kind:'climate-jury-forum',parts:['jury desks','pitch display','factory energy demonstrator']},
  'music-ai-osaka-2025':{kind:'vr-pen-equalizer',parts:['VR headset','tracked pen','frequency-band console','loudspeakers']},
  'european-defense-tech-2025-munich':{kind:'radar-instrument',parts:['radar antenna','instrument rack','detection console']},
  'tech-berlin-ai-hackathon-2':{kind:'portfolio-scenario-desk',parts:['portfolio dashboard','causal news cards','scenario display']},
  'huawei-agorize-2024':{kind:'hrtf-pinna-capture',parts:['pinna study','multi-view camera arc','head-related audio display']},
  'masters-thesis':{kind:'trajectory-policy-workbench',parts:['recorded trajectory display','latent encoder','shared policy','environment test boards']},
  'lauzhack-2024':{kind:'vr-classroom',parts:['classroom desk','VR headset','EEG headband','tracked pen','aligned writing paper']},
  'salzburg-tourism-2024':{kind:'eeg-tourism',parts:['EEG headband','recommendation kiosk','tourism route miniature']},
  'zurich-climathon-2024':{kind:'employee-survey-station',parts:['anonymous survey kiosks','company sustainability display','feedback cards']},
  'bayer-ai-2024':{kind:'bioinformatics-workbench',parts:['molecular study','image inspection table','computer-vision terminal']},
  'dsag-ideathon-2024':{kind:'transaction-fraud-workbench',parts:['transaction documents','time-series monitor','fraud inspection gate']},
  'circular-bsh-2024':{kind:'appliance-recovery-line',parts:['old appliances','X-ray inspection portal','sorting conveyor','recovery bins']},
  'thuega-2024':{kind:'household-energy-grid',parts:['model households','PV panels','battery storage','grid controller']},
  'solana-ideathon-2024':{kind:'microbetting-contract-table',parts:['agreement table','liquidity pool','oracle terminal']},
  'six-swisshacks-2024':{kind:'sustainability-reporting-desk',parts:['report binder','KPI dashboard','framework document trays']},
  'hackupc-2024':{kind:'flight-recommendation-table',parts:['city miniatures','flight routes','aircraft','interest-comparison kiosk']},
  'mdsi-bundesliga-2024':{kind:'football-analysis-table',parts:['football pitch','player positions','defensive lines','line-break monitor']},
  'draeger-2023':{kind:'patient-sensor-monitor',parts:['patient-monitor console','ECG-style signal','sensor channels','prediction display']},
  'ethmunich-2023':{kind:'nft-similarity-workbench',parts:['paired image cards','feature-embedding racks','similarity comparison display']},
  'msg-karlsruhe-2023':{kind:'co2-route-planner',parts:['road-route miniature','vehicle','alternative route','efficiency kiosk']},
  'bachelors-thesis':{kind:'noseprint-identification',parts:['cat study','nose-image capture camera','paired siamese encoder racks','identity comparison']},
  'tgu-perfect-gpa':{kind:'academic-study',parts:['open book','graduation cap','course-record display']},
});

const SUBJECTS = new Set(['supply-chain','health-imaging','energy-forum','discovery-graph','semiconductor','globe','coins','gifting',
  'satellite','linked-ledger','spatial-audio','radar','finance-graph','trajectory-policy','focus','neural-route','bioinformatics',
  'circular-appliances','energy-grid','football','noseprints','academia']);

function desk(p,x,z,w=3.4,d=2,h=1.75) {
  p.box('stone',[x,h,z],[w,.18,d]);
  for(const side of [-1,1])p.box('metal',[x+side*(w/2-.2),(.88+h)/2,z],[.16,h-.88,d-.2]);
}
function screen(p,x,y,z,w=2.4,h=1.55,{frame='dark',face='signal',stand=true}={}) {
  p.box(frame,[x,y,z],[w,h,.2]);p.box(face,[x,y,z-.115],[w-.18,h-.18,.035]);
  if(stand){p.box('metal',[x,y-h/2-.35,z+.1],[.18,.7,.22]);p.box('dark',[x,y-h/2-.72,z],[w*.62,.09,.6]);}
}
function waveform(p,x,y,z,w=1.8,h=.6,{material='paper',ecg=false}={}) {
  // Explanatory trace only: not actual EEG, ECG or patient measurements.
  const values=ecg?[0,.05,0,-.12,.78,-.42,.12,0,.13,.28,.16,0]
    :[0,.24,-.18,.08,.42,-.3,.12,.22,-.1,.31,-.23,0];
  values.forEach((value,i)=>{if(i)p.rod(material,[x-w/2+(i-1)*w/(values.length-1),y+values[i-1]*h,z],
    [x-w/2+i*w/(values.length-1),y+value*h,z],.018);});
}
function keyboard(p,x,z,w=1.8) {
  p.box('dark',[x,1.95,z],[w,.08,.6]);
  for(let row=0;row<3;row++)for(let col=0;col<7;col++)p.box('paper',[x+(col-3)*w/8,2.005,z+(row-1)*.15],[w/10,.025,.1]);
}
function chair(p,x,z) {
  p.box('dark',[x,1.35,z],[1.15,.12,1]);p.box('stone',[x,2.0,z+.44],[1.15,1.25,.14]);
  for(const side of [-1,1])p.box('metal',[x+side*.42,1.06,z],[.08,.54,.8]);
}
function headStudy(p,x,z,{headband=false,headset=false,y=2.9}={}) {
  p.cylinder('metal',[x,1.4,z],.32,1.0);
  p.sphere('paper',[x,y,z],[.76,.98,.68]);p.sphere('paper',[x,y-.08,z-.68],[.14,.2,.16]);
  p.sphere('paper',[x-.74,y-.05,z],[.12,.25,.16]);p.sphere('paper',[x+.74,y-.05,z],[.12,.25,.16]);
  if(headband){
    p.ring('metal',[x,y+.22,z],.76,.055);
    for(const dx of [-.53,-.18,.18,.53])p.box('gold',[x+dx,y+.22,z-.57],[.12,.16,.1]);
    p.rod('dark',[x+.72,y+.17,z],[x+1.0,1.2,z+.3],.035);
  }
  if(headset){
    p.box('dark',[x,y,z-.68],[1.55,.7,.55]);p.box('signal',[x,y,z-.98],[1.28,.48,.08]);
    p.ring('metal',[x,y,z],.84,.06,[0,0,Math.PI/2]);
  }
}
function sensorPen(p,x,y,z,{lean=.28}={}) {
  p.cylinder('paper',[x,y,z],.065,1.15,[0,0,lean]);
  p.cylinder('dark',[x-.16,y+.49,z],.078,.18,[0,0,lean]);
  for(const dy of [-.25,.05,.25])p.sphere('gold',[x+dy*.28,y+dy,z-.065],[.035,.035,.035]);
}
function smallTree(p,x,z,h=1.5) {
  p.cylinder('metal',[x,1.13+h*.18,z],.035,h*.4);
  p.sphere('leaf',[x,1.15+h*.6,z],[h*.32,h*.48,h*.3]);
}
function house(p,x,z,{height=1.3,w=1.4,solar=false}={}) {
  p.box('stone',[x,1.12+height/2,z],[w,height,1.3]);
  p.box('dark',[x,1.12+height+.055,z],[w+.15,.1,1.45]);
  for(const dx of [-.35,.35])p.box('signal',[x+dx,1.3+height*.48,z-.66],[.28,.38,.025]);
  p.box('dark',[x,1.35,z-.675],[.28,.5,.025]);
  if(solar){p.box('metal',[x,1.3+height,z],[w,.08,1],[.18,0,0]);for(let i=0;i<3;i++)p.box('signal',[x+(i-1)*.32,1.37+height,z],[.29,.025,.8],[.18,0,0]);}
}
function routeBoard(p,{x=2.5,z=0,w=5.3,d=6.4,tourism=false}={}) {
  p.box('dark',[x,1.04,z],[w,.16,d]);p.box('leaf',[x,1.14,z],[w-.2,.08,d-.2]);
  const points=[[x-1.65,1.26,z-2.05],[x+.65,1.26,z-1.2],[x-1.0,1.26,z+.45],[x+1.45,1.26,z+2.0]];
  points.forEach((point,i)=>{
    p.cylinder('gold',point,.14,.06);
    if(i)p.rod('gold',points[i-1],point,.06);
  });
  if(tourism){
    // Generic tourism scale models, not invented named Salzburg landmarks.
    if(typeof p.cone==='function'){
      p.cone('stone',[x+1.65,2.0,z-2.05],.85,1.75);
      p.cone('paper',[x+1.65,2.66,z-2.05],.29,.53);
    }else{
      p.sphere('stone',[x+1.65,1.95,z-2.05],[.74,.9,.67]);
      p.sphere('paper',[x+1.65,2.75,z-2.05],[.3,.2,.3]);
    }
    house(p,x-1.5,z+.5,{height:1.4,w:1.05});
    p.box('stone',[x-.1,1.4,z-1.4],[.9,.55,1.0]);p.cylinder('stone',[x-.1,2.08,z-1.4],.22,.85);
    p.box('signal',[x-.2,1.18,z+2.1],[2.2,.04,1.1]);
    p.box('stone',[x-.2,1.35,z+2.1],[2.5,.11,.42]);
    for(const dx of [-.85,.85])p.box('metal',[x-.2+dx,1.22,z+2.1],[.08,.22,.4]);
    for(const xy of [[x+1.7,z+.3],[x-1.9,z+2.2],[x+.5,z+1.05]])smallTree(p,...xy,1.2);
  }else for(const xy of [[x-1.8,z-1.9],[x+.8,z-.9],[x-1.1,z+.8],[x+1.4,z+2.3]])house(p,...xy,{height:1.0,w:.95});
  return points;
}
function plane(p,x,y,z,heading=0) {
  p.sphere('paper',[x,y,z],[.23,.18,1.1]);
  p.box('paper',[x,y,z],[2.0,.07,.45],[0,heading,.06]);
  p.box('metal',[x,y+.13,z+.75],[.8,.055,.28],[0,heading,0]);p.box('gold',[x,y+.4,z+.75],[.04,.55,.32]);
}
function miniatureCar(p,x,y,z) {
  p.box('paper',[x,y,z],[.75,.38,1.35]);p.box('dark',[x,y+.3,z-.02],[.65,.28,.7]);
  for(const side of [-1,1])for(const dz of [-.43,.43])p.cylinder('dark',[x+side*.4,y-.13,z+dz],.18,.1,[0,0,Math.PI/2]);
}
function panel(p,x,z,w=2.1,d=1.5) {
  p.box('metal',[x,1.6,z],[w,.12,d],[.25,0,0]);
  for(let row=0;row<2;row++)for(let col=0;col<4;col++)p.box('signal',[x+(col-1.5)*w/4,1.68-row*.16,z+(row-.5)*d/2],
    [w/4-.045,.018,d/2-.045],[.25,0,0]);
  for(const side of [-1,1])p.box('metal',[x+side*w*.32,1.15,z],[.08,.9,.7]);
}
function paperStack(p,x,y,z,{w=1.25,d=1.4,count=4}={}) {
  for(let i=0;i<count;i++)p.box('paper',[x,y+i*.09,z],[w,.055,d],[0,i%2*.04,0]);
  p.box('gold',[x,y+count*.09,z-d*.28],[w*.7,.018,.08]);
}
function chart(p,x,y,z,w=1.8,h=.9) {
  for(let i=0;i<5;i++)p.box(i===4?'gold':'paper',[x-w/2+(i+.5)*w/5,y-h/2+(i+1)*h/10,z],
    [w/6,(i+1)*h/5,.018]);
}
function capsule(p,x,z,{color='paper',height=2.8,w=1.25,d=1.25}={}) {
  p.box(color,[x,1.12+height/2,z],[w,height,d]);p.box('dark',[x,1.12+height+.06,z],[w+.05,.12,d+.05]);
}
function linePath(p,points,{material='gold',radius=.07}={}) {
  points.forEach((point,i)=>{if(i)p.rod(material,points[i-1],point,radius);});
}
function pinna(p,x,y,z) {
  // A physical ear-form study: helix, antihelix and concha, not a sphere graph.
  p.sphere('paper',[x,y,z],[.95,1.45,.36]);
  p.ring('gold',[x,y+.1,z-.32],.67,.08,[0,0,0]);
  p.ring('metal',[x+.12,y+.17,z-.42],.38,.055,[0,0,0]);
  p.sphere('dark',[x+.14,y-.1,z-.45],[.22,.35,.05]);p.sphere('paper',[x-.1,y-.9,z-.15],[.36,.45,.25]);
}
function transactionDocs(p,x,z,{fraud=false}={}) {
  desk(p,x,z,4.5,2.5);
  for(let i=0;i<3;i++){
    paperStack(p,x-1.55+i*1.55,1.9,z,{count:3,w:1.0,d:1.3});
    p.box(i===2&&fraud?'gold':'signal',[x-1.55+i*1.55,2.23,z-.42],[.7,.025,.09]);
  }
}
function lock(p,x,y,z) {
  p.box('gold',[x,y,z],[1.3,1.0,.55]);p.ring('metal',[x,y+.65,z],.48,.09,[0,0,0]);
  p.cylinder('dark',[x,y,z-.3],.09,.06,[Math.PI/2,0,0]);
}

function eegTourism(p) {
  headStudy(p,-4.2,-1.4,{headband:true});
  desk(p,-2.8,1.6,3.1,1.7);screen(p,-2.8,3.1,1.75,2.7,2.1);keyboard(p,-2.8,1.0);
  waveform(p,-2.8,3.55,1.61,2.2,.7);
  for(let i=0;i<3;i++)p.box(['gold','leaf','paper'][i],[-3.58+i*.78,2.64,1.61],[.55,.55,.035]);
  p.rod('dark',[-3.2,1.2,-1.1],[-2.8,1.8,1.5],.035);
  routeBoard(p,{x:2.65,z:0,tourism:true,w:5.9});
  p.rod('gold',[-1.45,2.4,1.3],[-.55,2.4,1.3],.09);
}
function travel(p,slug) {
  desk(p,-4.0,0,3.0,2.0);screen(p,-4,3.1,.55,2.55,2.15);keyboard(p,-4,-.4);
  for(let i=0;i<3;i++){p.box('paper',[-4.72+i*.7,3.32,.42],[.48,.52,.035]);p.box('gold',[-4.72+i*.7,2.58,.42],[.48,.12,.035]);}
  const points=routeBoard(p,{x:2.1,z:0,w:6.3});
  if(slug==='hackupc-2024'){
    plane(p,2.6,4.0,.8);
    linePath(p,[[.55,1.55,-2.05],[1.2,3.3,-1.5],[2.6,4,.8],[3.55,1.6,2.0]],{material:'gold',radius:.045});
  }else{
    miniatureCar(p,1.8,1.55,-.8);
    linePath(p,[[.45,1.25,-2.05],[3.7,1.25,-2.2],[3.7,1.25,1.9]],{material:'signal',radius:.045});
    p.sphere('leaf',[-3.2,4.05,.46],[.3,.14,.2]);
  }
  p.rod('metal',[-2.35,2.2,0],[-1.3,2.2,0],.075);
}
function semiconductor(p) {
  p.cylinder('metal',[-3.8,1.42,-.6],1.65,.15);
  p.cylinder('dark',[-3.8,3.0,-.6],2.15,.13,[Math.PI/2,0,0]);
  p.cylinder('signal',[-3.8,3.0,-.68],2.07,.04,[Math.PI/2,0,0]);
  for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++)if(row*row+col*col<7)
    p.box('gold',[-3.8+col*.7,3+row*.7,-.73],[.57,.57,.02]);
  p.box('metal',[-3.8,1.8,-.4],[2.1,.35,1.15]);
  // Small process cell and robot actuator. No reconstruction of Infineon fab.
  p.box('paper',[.25,2.2,-.9],[3.0,2.2,2.5]);p.box('dark',[.25,2.1,-2.2],[2.7,1.65,.06]);
  p.cylinder('metal',[.15,2.3,-2.25],.66,.08,[Math.PI/2,0,0]);
  p.cylinder('gold',[.15,2.3,-2.32],.55,.05,[Math.PI/2,0,0]);
  p.rod('metal',[1.7,1.25,-.25],[1.7,3.4,-.25],.16);p.rod('metal',[1.7,3.4,-.25],[2.45,3.2,-1.5],.15);
  p.rod('dark',[2.45,3.2,-1.5],[1.1,2.45,-1.5],.11);
  desk(p,3.9,1.9,3.0,1.65);screen(p,3.9,3.05,2.15,2.65,1.75);
  for(let i=0;i<5;i++)p.box(i===3?'gold':'paper',[3.03+i*.43,2.88,2.03],[.24,.23+i*.11,.025]);
  waveform(p,3.9,3.48,2.03,2.05,.3);keyboard(p,3.9,1.4);
}
function logistics(p) {
  p.box('metal',[-.55,1.5,0],[8.5,.22,2.1]);
  for(let i=0;i<14;i++)p.cylinder('dark',[-4.55+i*.62,1.66,0],.095,2.05,[Math.PI/2,0,0]);
  for(let i=0;i<3;i++){
    const x=-3.5+i*2.35;p.box('stone',[x,1.84,0],[1.4,.17,1.25]);
    for(let row=0;row<2;row++)for(let col=0;col<2;col++)p.box('gold',[x+(col-.5)*.6,2.13+row*.54,0],[.53,.49,1.0]);
    p.box('paper',[x,2.32,-.52],[.16,.8,.025]);
  }
  for(const x of [-4.55,3.4])for(const z of [-.7,.7])p.box('metal',[x,1.15,z],[.12,.7,.12]);
  // Warehouse storage shelves make supply-chain meaning visible at map scale.
  for(const x of [-4.8,-1.7])for(const z of [2.6,3.9])p.box('metal',[x,2.65,z],[.11,3.3,.11]);
  for(const y of [1.25,2.6,4.0])p.box('metal',[-3.25,y,3.2],[3.3,.1,1.45]);
  for(const y of [1.65,3.05])for(const x of [-4.1,-2.45])p.box('paper',[x,y,3.25],[1.35,.65,1.1]);
  desk(p,4.3,-2.25,2.8,1.7);screen(p,4.3,3.0,-1.95,2.3,1.6);chart(p,4.3,3.0,-2.08,1.8,.95);
  p.box('gold',[4.3,3.8,-1.95],[2.0,.09,.1]);keyboard(p,4.3,-2.8);
}
function conjunctiva(p) {
  desk(p,-2.9,-.5,5.6,2.75);
  p.sphere('paper',[-3.4,3.4,-.3],[1.25,.72,.65]);
  p.sphere('signal',[-3.4,3.4,-.9],[.48,.48,.05]);p.sphere('dark',[-3.4,3.4,-.97],[.2,.2,.04]);
  p.sphere('red',[-3.4,2.96,-.72],[1.02,.17,.27]);
  p.box('dark',[-.9,3.0,-.8],[.95,1.8,.24]);p.box('paper',[-.9,3,-.95],[.79,1.57,.03]);
  p.sphere('dark',[-.9,3.58,-1.0],[.08,.08,.03]);p.rod('metal',[-.9,2.1,-.75],[-.9,1.9,.25],.055);
  p.rod('metal',[-.9,1.9,.25],[-2.8,1.9,.25],.055);
  desk(p,3.5,1.4,3.1,2.1);screen(p,3.5,3.18,1.65,2.75,2.3);
  p.box('paper',[3.5,3.47,1.52],[2.2,.1,.02]);
  for(let i=0;i<4;i++)p.box(i>2?'gold':'red',[2.66+i*.54,2.93,1.51],[.38,.56,.02]);
  keyboard(p,3.5,.8);
  for(let i=0;i<3;i++)p.cylinder('red',[2.9+i*.7,2.3,-2.05],.34,.17,[.18,0,.15]);
  p.box('stone',[3.6,1.92,-2.05],[2.85,.18,1.3]);
}
function patientMonitor(p) {
  capsule(p,-3.85,.1,{height:2.7,w:2.0,d:1.1});
  screen(p,-3.85,3.2,-.52,2.3,2.0,{stand:false});waveform(p,-3.85,3.6,-.65,1.85,.7,{ecg:true});
  for(let i=0;i<3;i++)p.box(i===2?'gold':'paper',[-4.55+i*.7,2.65,-.65],[.42,.34,.035]);
  for(const x of [-4.5,-3.2])for(const z of [-.4,.6])p.sphere('dark',[x,1.03,z],[.13,.13,.13]);
  desk(p,.1,-.9,3.8,2.4);p.box('paper',[.1,2.06,-.9],[2.6,.22,1.2]);
  for(let i=0;i<3;i++){
    p.cylinder('metal',[-.8+i*.8,2.29,-.9],.12,.18);
    p.rod('dark',[-.8+i*.8,2.3,-.9],[-2.8,1.8,.25+i*.2],.024);
  }
  desk(p,3.8,1.9,3.2,1.6);screen(p,3.8,3.1,2.1,2.75,1.9);chart(p,3.8,3.1,1.97,2.2,.9);keyboard(p,3.8,1.45);
}
function energyGrid(p) {
  p.box('dark',[-2.9,1.04,0],[5.7,.14,6.5]);
  house(p,-4.25,-1.3,{solar:true});house(p,-1.6,1.4,{solar:true});
  panel(p,-4.4,2.1,1.7,1.0);
  for(let i=0;i<3;i++){capsule(p,.7,-1.7+i*1.1,{height:1.3,w:.6,d:.65});p.box('gold',[.7,1.75,-2.04+i*1.1],[.35,.35,.025]);}
  p.rod('gold',[-1.65,1.16,1.4],[.7,1.16,.5],.05);
  p.rod('metal',[-4.25,1.16,-1.3],[.7,1.16,-1.7],.05);
  p.box('metal',[1.9,2.65,-2.0],[.12,3.2,.12]);
  for(const y of [3.4,3.8])p.box('metal',[1.9,y,-2.0],[1.4,.08,.08]);
  for(const x of [1.45,2.35])p.rod('dark',[x,3.8,-2.0],[x,3.8,3],.025);
  desk(p,4.1,1.7,3.0,1.6);screen(p,4.1,3.0,2.0,2.6,1.8);chart(p,4.1,3.0,1.87,2,.95);keyboard(p,4.1,1.1);
}
function forum(p,slug) {
  if(slug==='six-swisshacks-2024'){
    desk(p,-2.8,.2,5.4,3);paperStack(p,-4,1.96,-.1,{w:1.9,d:2.0,count:7});
    p.box('dark',[-4,2.25,1.0],[1.92,.6,.12]);
    for(let i=0;i<3;i++)paperStack(p,-2.3+i*.55,1.96,.2,{w:.46,d:1.8,count:4+i});
    desk(p,3.6,1.2,3.3,1.8);screen(p,3.6,3.2,1.55,2.85,2.25);chart(p,3.6,3.4,1.41,2.3,.8);
    for(let i=0;i<3;i++)p.box('paper',[2.83+i*.77,2.65,1.41],[.55,.36,.025]);keyboard(p,3.6,.6);
    return;
  }
  if(slug==='zurich-climathon-2024'){
    for(const x of [-3.8,0,3.8]){
      capsule(p,x,.5,{height:1.7,w:1.9,d:1.6});screen(p,x,3.3,.65,2.35,2.2,{stand:false});
      for(let i=0;i<4;i++)p.box(i===3?'gold':'paper',[x,3.95-i*.42,.52],[1.9,.19,.025]);
      p.box('dark',[x,2.1,-.2],[1.85,.08,.85]);
    }
    p.box('stone',[0,1.17,-2.5],[8,.4,1.25]);
    for(let i=0;i<5;i++)p.box('paper',[-3+i*1.5,1.42,-2.5],[1.1,.08,.8]);return;
  }
  for(const x of [-3.65,0,3.65]){desk(p,x,-1.9,2.8,1.7);chair(p,x,-.8);paperStack(p,x,1.9,-1.95,{w:1.15,d:.8,count:2});}
  screen(p,0,4.25,3.55,6.5,3.0,{stand:false});
  for(let i=0;i<3;i++){p.box('paper',[-2.1+i*2.1,3.65,3.39],[1.4,.55,.025]);p.box('gold',[-2.1+i*2.1,4.55,3.39],[1.4,.8,.025]);}
  p.box('metal',[0,2.4,3.55],[.28,3.0,.3]);
  p.box('dark',[-4.75,1.37,2.55],[2.4,.2,1.6]);
  for(let i=0;i<3;i++){p.box('stone',[-5.35+i*.6,1.8,2.55],[.46,.65,.95]);p.box('signal',[-5.35+i*.6,2.2,2.55],[.36,.08,.78]);}
}
function appliance(p,x,z,{fridge=false}={}) {
  const h=fridge?3.2:2.5;capsule(p,x,z,{height:h,w:1.6,d:1.65});
  if(fridge){
    p.box('metal',[x+.5,2.3,z-.85],[.06,.85,.1]);p.box('dark',[x,3.4,z-.845],[1.45,.035,.025]);
  }else{
    p.cylinder('dark',[x,2.3,z-.88],.59,.08,[Math.PI/2,0,0]);p.ring('metal',[x,2.3,z-.94],.63,.065,[0,0,0]);
    for(let i=0;i<3;i++)p.cylinder('dark',[x-.5+i*.48,3.25,z-.86],.08,.06,[Math.PI/2,0,0]);
  }
}
function applianceRecovery(p) {
  appliance(p,-4.7,-.4);appliance(p,-2.7,-.4,{fridge:true});
  p.box('metal',[.2,1.46,.25],[4.0,.18,2.1]);
  for(let i=0;i<8;i++)p.cylinder('dark',[-1.35+i*.44,1.6,.25],.08,2,[Math.PI/2,0,0]);
  for(const x of [-1.1,1.5])p.box('paper',[x,2.75,.25],[.5,2.7,2.3]);p.box('paper',[.2,4.1,.25],[3.1,.4,2.3]);
  p.box('signal',[.2,3.3,-.93],[1.45,1.35,.04]);
  p.rod('metal',[2.3,1.15,.4],[2.3,3.2,.4],.12);p.rod('metal',[2.3,3.2,.4],[3.15,2.8,-.2],.12);
  for(let i=0;i<3;i++){
    p.box('stone',[4.7,1.75,-2.3+i*2.2],[1.7,1.5,1.65]);p.box(i%2?'signal':'gold',[4.7,2.56,-2.3+i*2.2],[1.75,.08,1.7]);
  }
}
function vrClassroom(p) {
  desk(p,-2.5,-.5,5.5,2.8);chair(p,-2.5,1.0);headStudy(p,-4.1,-.45,{headband:true,headset:true});
  p.box('paper',[-1.8,1.88,-.55],[1.6,.06,1.6]);
  linePath(p,[[-2.25,1.94,-.9],[-1.8,1.94,-.7],[-1.95,1.94,-.3],[-1.45,1.94,-.05]],{material:'dark',radius:.014});
  sensorPen(p,-.9,2.37,-.55);
  screen(p,3.6,3.4,.35,3.8,3.05);waveform(p,3.6,3.8,.22,3.05,.8);chart(p,3.6,2.83,.22,3.05,.5);
  p.box('stone',[3.6,1.3,.4],[4.5,.6,2.0]);
  for(let i=0;i<3;i++)p.box('paper',[2.25+i*1.35,1.65,.4],[1.05,.08,1.45]);
}
function musicEq(p) {
  headStudy(p,-4.3,-1.0,{headset:true});sensorPen(p,-2.9,3.25,-1.8,{lean:.7});
  desk(p,-.6,.3,4.6,2.4);
  for(let i=0;i<9;i++){
    const x=-2.5+i*.46,h=.5+Math.sin(i*.67)**2*2.25;
    p.box(i%3?'signal':'gold',[x,2+h/2,.35],[.27,h,.36]);
    p.box('dark',[x,1.96,-.65],[.17,.06,.55]);p.cylinder('paper',[x,2.08,-.57],.055,.12);
  }
  for(const x of [3.1,5.0]){
    capsule(p,x,.2,{height:3.4,w:1.3,d:1.25});
    p.cylinder('dark',[x,2.4,-.47],.48,.1,[Math.PI/2,0,0]);p.ring('metal',[x,2.4,-.55],.51,.055,[0,0,0]);
    p.cylinder('dark',[x,3.5,-.47],.23,.1,[Math.PI/2,0,0]);
  }
  p.rod('gold',[-2.75,2.8,-1.8],[-2.75,2.8,1.4],.03);p.rod('gold',[-2.75,2.8,1.4],[.0,2.8,1.4],.03);
}
function hrtfStudy(p) {
  desk(p,-2.8,0,5.3,3.5);pinna(p,-2.8,3.5,-.5);
  for(let i=0;i<3;i++){
    const x=-4.8+i*2.0,z=.9+Math.abs(i-1)*.6;
    p.box('dark',[x,3.15,z],[.7,.55,.6]);p.cylinder('metal',[x,3.15,z-.38],.19,.21,[Math.PI/2,0,0]);
    p.rod('metal',[x,1.9,z],[x,2.9,z],.055);p.box('metal',[x,1.9,z],[.7,.08,.7]);
  }
  desk(p,3.6,1.0,3.5,2.1);screen(p,3.6,3.2,1.45,3.0,2.3);waveform(p,3.6,3.55,1.31,2.3,.6);chart(p,3.6,2.7,1.31,2.3,.6);keyboard(p,3.6,.4);
}
function satellite(p) {
  p.box('metal',[-1.8,3.6,-.4],[1.5,1.9,1.45]);p.box('gold',[-1.8,3.6,-1.15],[1.25,1.65,.08]);
  for(const side of [-1,1]){
    const x=-1.8+side*2.7;p.rod('metal',[-1.8+side*.75,3.6,-.4],[x,3.6,-.4],.055);
    p.box('dark',[x,3.6,-.4],[3.0,.11,2.2]);
    for(let row=0;row<3;row++)for(let col=0;col<5;col++)p.box('signal',[x+(col-2)*.55,3.68,-.4+(row-1)*.63],[.48,.02,.57]);
  }
  p.cylinder('metal',[-1.8,1.9,-.4],.14,1.9);p.ring('gold',[-1.8,3.6,-.4],1.7,.03,[0,.4,.35]);
  // Ground station is a model of communication/geography APIs, not a launch.
  p.cylinder('metal',[3.6,1.8,-2.05],.16,1.7);p.cylinder('paper',[3.6,2.8,-2.05],1.2,.12,[.8,0,0]);
  p.ring('metal',[3.6,2.89,-2.05],1.23,.045,[.8,0,0]);p.rod('metal',[3.6,2.8,-2.05],[3.6,3.7,-2.6],.04);
  desk(p,3.5,2.1,3.5,1.65);screen(p,3.5,3.0,2.3,2.8,1.75);waveform(p,3.5,3.2,2.17,2.1,.4);keyboard(p,3.5,1.65);
}
function globeTransition(p) {
  p.sphere('signal',[-3.2,3.5,0],[2.0,2.0,2.0]);
  for(let i=0;i<3;i++)p.ring('gold',[-3.2,3.5,0],2.06,.025,[0,i*Math.PI/3,0]);
  for(const offset of [-1.0,0,1.0])p.ring('metal',[-3.2,3.5+offset,0],Math.sqrt(4.24-offset*offset),.02);
  p.cylinder('metal',[-3.2,1.2,0],.5,.65);
  p.box('dark',[2.7,1.4,.1],[5.4,.2,4.6]);p.box('signal',[2.7,1.55,.1],[5.15,.06,4.35]);
  for(let i=0;i<4;i++)p.box('paper',[.7+i*1.25,1.595,.1],[.025,.012,4.25]);
  for(let i=0;i<3;i++)p.box('paper',[2.7,1.595,-1.35+i*1.45],[5.05,.012,.025]);
  for(let i=0;i<3;i++)p.box('metal',[.2+i*.55,2.55+i*.28,-2.6],[.14,2.3+i*.56,.14]);
  p.rod('gold',[-.9,2.25,0],[.5,2.25,0],.08);
}
function coins(p) {
  desk(p,-2.6,.0,6.1,4.3);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++){
    const x=-4.5+col*1.9,z=-1.05+row*2.0;
    p.box('dark',[x,1.93,z],[1.5,.15,1.55]);p.cylinder('gold',[x,2.06,z],.54,.06);
    p.ring('metal',[x,2.105,z],.44,.023);
    p.box('paper',[x,2.03,z+.63],[.87,.025,.17]);
  }
  p.cylinder('metal',[-5.3,3.3,-1.7],.065,2.8);p.rod('metal',[-5.3,4.0,-1.7],[-3.7,4.0,-.6],.055);
  p.ring('metal',[-3.7,4.0,-.6],.42,.035);p.cylinder('paper',[-3.7,4.13,-.6],.23,.18);
  desk(p,3.6,1.0,3.4,2.0);screen(p,3.6,3.2,1.45,3.0,2.3);keyboard(p,3.6,.4);
  for(let i=0;i<4;i++)p.cylinder('gold',[2.65+(i%2)*1.9,3.65-Math.floor(i/2)*.9,1.31],.12,.04,[Math.PI/2,0,0]);
  p.rod('paper',[2.65,3.65,1.29],[4.55,2.75,1.29],.02);
}
function gifting(p) {
  for(let i=0;i<3;i++){
    const x=-4.7+i*2.15,h=1.2+i*.28,z=-.7+(i%2)*1.2;
    p.box(i%2?'signal':'paper',[x,1.2+h/2,z],[1.7,h,1.7]);p.box('gold',[x,1.2+h/2,z],[.13,h+.02,1.73]);
    p.box('gold',[x,1.24+h,z],[1.73,.08,.13]);
    p.ring('gold',[x-.24,1.45+h,z],.23,.035,[0,.4,Math.PI/2]);p.ring('gold',[x+.24,1.45+h,z],.23,.035,[0,-.4,Math.PI/2]);
  }
  desk(p,3.2,1.1,4.1,2.4);screen(p,3.2,3.3,1.6,3.55,2.6);keyboard(p,3.2,.4);
  for(let i=0;i<3;i++)p.cylinder('gold',[2.15+i*1.05,2.74,1.46],.23,.04,[Math.PI/2,0,0]);
  lock(p,3.2,3.63,1.32);p.cylinder('metal',[.6,1.25,-2.3],.85,.14);
  for(let i=0;i<5;i++)p.cylinder('gold',[.6,1.4+i*.08,-2.3],.53,.07);
}
function fraud(p) {
  transactionDocs(p,-3.2,.1,{fraud:true});
  p.box('metal',[-3.2,2.8,-.1],[.2,1.7,.2]);p.box('metal',[-3.2,3.55,-.1],[4.0,.15,.15]);
  for(const x of [-4.8,-1.6])p.box('metal',[x,2.8,-.1],[.15,1.55,.15]);
  desk(p,3.3,1.1,4.2,2.0);screen(p,3.3,3.3,1.5,3.65,2.6);waveform(p,3.3,3.65,1.36,2.8,.5);
  for(let i=0;i<4;i++)p.box(i===2?'gold':'paper',[2.13+i*.78,2.77,1.36],[.5,.44,.035]);keyboard(p,3.3,.4);
  p.rod('gold',[-.75,2.35,.1],[1.0,2.35,.1],.1);
}
function discovery(p) {
  for(let i=0;i<3;i++){
    const x=-4.2+i*2.7;p.box('stone',[x,2.45,-1.5],[2.2,2.7,.45]);p.box('signal',[x,2.45,-1.75],[1.85,2.35,.025]);
    for(let row=0;row<3;row++){p.box('paper',[x,3.12-row*.63,-1.79],[1.55,.24,.02]);p.box('gold',[x-.62,3.12-row*.63,-1.805],[.14,.16,.025]);}
    p.box('metal',[x,1.3,-1.5],[2.4,.25,1.1]);
  }
  desk(p,3.7,2.0,3.25,1.55);screen(p,3.7,3.1,2.2,2.8,1.85);chart(p,3.7,3.1,2.07,2.1,.95);keyboard(p,3.7,1.4);
  p.rod('gold',[-3.95,1.2,.15],[2.2,1.2,.15],.065);
}
function finance(p) {
  desk(p,-2.8,0,5.5,3.0);screen(p,-2.8,3.4,.65,4.8,2.6);chart(p,-2.8,3.45,.51,3.9,1.3);keyboard(p,-2.8,-.4);
  for(let i=0;i<3;i++){
    const x=1.15+i*1.9;p.box('stone',[x,2.65,-1.7],[1.6,2.8,.26]);p.box('signal',[x,2.65,-1.85],[1.37,2.55,.025]);
    for(let row=0;row<3;row++)p.box('paper',[x,3.27-row*.57,-1.89],[1.04,.11,.02]);
    p.box('gold',[x,2.0,-1.89],[1.0,.35,.02]);
  }
  linePath(p,[[1.15,1.2,-1.7],[1.15,1.2,.9],[5.0,1.2,.9]],{material:'gold'});
  paperStack(p,3.6,1.36,2.45,{w:3.2,d:1.7,count:4});
}
function ledger(p,slug) {
  if(slug==='sui-hackathon-poland-2025'){
    // Existing dApp joins words and mints the composition; these are neutral
    // word tiles and object cards, not a fabricated blockchain transaction UI.
    desk(p,-3.0,.35,5.2,3.5);
    for(let row=0;row<3;row++)for(let col=0;col<3;col++){
      const x=-4.65+col*1.6,z=-.85+row*1.12;
      p.box('dark',[x,1.94,z],[1.3,.15,.83]);
      p.box('paper',[x,2.035,z],[1.08,.035,.59]);
      for(let token=0;token<3;token++)p.box('gold',[x+(token-1)*.25,2.06,z],[.17,.025,.22]);
    }
    p.rod('gold',[-.3,2.15,.35],[.8,2.15,.35],.08);
    for(let row=0;row<3;row++){
      const z=-2.35+row*2.35;
      p.box('stone',[2.0,2.25,z],[1.55,2.1,.2]);
      p.box('signal',[2.0,2.25,z-.12],[1.3,1.85,.025]);
      for(let token=0;token<3;token++)p.box('paper',[1.55+token*.45,2.95,z-.15],[.32,.18,.025]);
      p.box('gold',[2.0,1.55,z-.15],[.75,.18,.025]);
    }
    screen(p,4.45,3.15,.35,2.25,2.1);chart(p,4.45,3.2,.22,1.7,1.0);
    return;
  }
  if(slug==='ethmunich-2023'){
    desk(p,-3.0,0,5.2,3.0);
    for(const x of [-4.25,-1.75]){
      p.box('dark',[x,2.45,-.4],[2.0,1.7,.18]);p.box('signal',[x,2.45,-.51],[1.77,1.48,.025]);
      for(let i=0;i<4;i++)p.box(i%2?'gold':'paper',[x-.54+(i%2)*1.08,2.82-Math.floor(i/2)*.7,-.55],[.72,.43,.025]);
    }
    for(let i=0;i<4;i++){capsule(p,2.5+i*.85,-1.4,{height:1.8,w:.58,d:.8});p.box('gold',[2.5+i*.85,2.1,-1.82],[.29,.45,.025]);}
    screen(p,3.5,3.4,2.2,3.35,2.05);chart(p,3.5,3.4,2.07,2.6,1.0);return;
  }
  transactionDocs(p,-3.0,.35);
  for(let i=0;i<4;i++){
    const z=-2.4+i*1.65;capsule(p,2.1,z,{height:1.55,w:1.1,d:1.0});
    p.box('signal',[2.1,2.15,z-.52],[.7,.76,.025]);
    if(i)p.rod('gold',[2.1,1.23,z-1.1],[2.1,1.23,z-.55],.1);
  }
  screen(p,4.45,3.15,.35,2.25,2.1);chart(p,4.45,3.2,.22,1.7,1.0);
  if(slug==='solana-ideathon-2024'){
    p.cylinder('metal',[-3.0,2.25,-1.85],.78,.2);
    for(let i=0;i<5;i++)p.cylinder('gold',[-3.0,2.4+i*.08,-1.85],.52,.07);
  }else p.box('gold',[-.05,2.2,.35],[.2,1.2,1.7]);
}
function trajectoryPolicy(p) {
  desk(p,-3.1,0,5.4,3.0);
  screen(p,-3.1,3.3,.6,4.8,2.4);
  for(let path=0;path<2;path++)linePath(p,[[-5.1,3.7-path*.8,.46],[-4.35,3.3-path*.45,.46],[-3.65,3.85-path*.9,.46],[-2.6,3.45-path*.7,.46],[-1.2,3.5-path*.65,.46]],{material:path?'gold':'paper',radius:.035});
  keyboard(p,-3.1,-.5);
  capsule(p,1.0,-1.6,{height:3.3,w:1.5,d:1.5});
  for(let i=0;i<5;i++)p.box(i%2?'gold':'signal',[1.0,1.5+i*.56,-2.37],[1.18,.26,.035]);
  p.rod('metal',[-.6,2.2,-.25],[.2,2.2,-1.5],.09);
  for(let i=0;i<3;i++){
    const z=-2.6+i*2.6;p.box('dark',[4.0,1.14,z],[2.65,.15,1.9]);
    for(let j=0;j<3;j++)p.box('stone',[3.25+j*.65,1.42+j*.16,z],[.38,.45+j*.32,.62]);
    p.rod('gold',[1.75,2.7,-1.6],[4,2.05,z],.065);
  }
}
function bioinformatics(p) {
  desk(p,-3.2,0,5.1,3.5);
  for(let i=0;i<9;i++){
    const angle=i*.73,y=2.05+i*.33,x=Math.cos(angle)*.72,z=Math.sin(angle)*.72;
    p.sphere(i%2?'signal':'gold',[-3.2+x,y,z],[.16,.16,.16]);p.sphere(i%2?'gold':'signal',[-3.2-x,y,-z],[.16,.16,.16]);
    p.rod('metal',[-3.2+x,y,z],[-3.2-x,y,-z],.035);
    if(i){const a=(i-1)*.73;p.rod('metal',[-3.2+Math.cos(a)*.72,y-.33,Math.sin(a)*.72],[-3.2+x,y,z],.035);p.rod('metal',[-3.2-Math.cos(a)*.72,y-.33,-Math.sin(a)*.72],[-3.2-x,y,-z],.035);}
  }
  p.box('dark',[-.8,2.1,-.5],[1.0,.28,1.2]);p.cylinder('paper',[-.8,2.45,-.5],.2,.48);p.rod('metal',[-.8,2.6,-.5],[-1.15,3.2,-.1],.08);
  desk(p,3.6,1.1,3.4,2.0);screen(p,3.6,3.25,1.6,3.0,2.5);keyboard(p,3.6,.45);
  for(let row=0;row<2;row++)for(let col=0;col<3;col++)p.box((row+col)%2?'gold':'paper',[2.65+col*.95,3.77-row*.87,1.46],[.6,.56,.025]);
}
function football(p) {
  p.box('dark',[-.7,1.1,0],[9.4,.2,6.5]);p.box('signal',[-.7,1.25,0],[9.15,.05,6.25]);
  for(const x of [-5.15,3.75])p.box('paper',[x,1.29,0],[.035,.018,6.15]);
  for(const z of [-3.05,3.05])p.box('paper',[-.7,1.29,z],[8.95,.018,.035]);
  p.box('paper',[-.7,1.3,0],[.035,.018,6.15]);p.ring('paper',[-.7,1.3,0],.8,.018);
  for(const x of [-5.2,3.8]){
    p.rod('paper',[x,1.31,-.85],[x,2.0,-.85],.035);p.rod('paper',[x,1.31,.85],[x,2,.85],.035);p.rod('paper',[x,2,-.85],[x,2,.85],.035);
    for(let i=0;i<4;i++)p.rod('metal',[x,1.32,-.75+i*.5],[x-.25,1.95,-.75+i*.5],.012);
  }
  for(let team=0;team<2;team++)for(let i=0;i<7;i++){
    const x=-4.4+team*4.3+(i%3)*1.05,z=-2.35+Math.floor(i/3)*2.1;
    p.sphere(team?'gold':'paper',[x,1.55,z],[.15,.15,.15]);
  }
  for(const x of [-2.6,1.05])p.rod('gold',[x,1.34,-2.85],[x,1.34,2.85],.022);
  screen(p,5.0,3.5,1.35,1.7,2.2);waveform(p,5.0,3.85,1.22,1.3,.55);chart(p,5.0,3.0,1.22,1.3,.4);
}
function noseprints(p) {
  desk(p,-3.2,0,5.2,3.5);
  p.sphere('paper',[-3.2,3.4,-.2],[1.03,.83,.63]);
  // Pointed ear silhouettes use thin rotated diamonds if no cone is supplied.
  if(typeof p.cone==='function')for(const dx of [-.74,.74])p.cone('paper',[-3.2+dx,4.2,-.15],.4,1.15,[0,0,dx>0?-.12:.12]);
  else for(const dx of [-.74,.74])p.box('paper',[-3.2+dx,4.16,-.15],[.43,.9,.17],[0,0,dx>0?-.18:.18]);
  for(const dx of [-.45,.45])p.sphere('signal',[-3.2+dx,3.48,-.81],[.12,.17,.035]);
  p.box('gold',[-3.2,3.11,-.87],[.17,.17,.05],[0,0,Math.PI/4]);
  for(const side of [-1,1])for(let i=0;i<3;i++)p.rod('metal',[-3.2+side*.25,3.0,-.85],[-3.2+side*1.08,3.0+(i-1)*.18,-.8],.015);
  p.box('dark',[-.92,2.4,-1.2],[.6,.55,.55]);p.cylinder('metal',[-1.25,2.4,-1.2],.18,.23,[0,0,Math.PI/2]);
  p.rod('metal',[-.92,1.9,-1.2],[-.92,2.17,-1.2],.05);
  for(const z of [-1.4,1.1]){
    capsule(p,2.0,z,{height:1.9,w:.9,d:1.7});
    for(let i=0;i<3;i++)p.box('gold',[2.0,1.53+i*.5,z-.88],[.6,.16,.03]);
  }
  screen(p,4.5,3.2,.25,2.0,2.2);chart(p,4.5,3.2,.12,1.55,1.0);
}
function academia(p) {
  desk(p,-2.2,0,6.3,3.3);
  p.box('dark',[-3.8,2.05,.0],[2.4,.13,2.3]);
  for(let page=0;page<4;page++){
    p.box('paper',[-4.36,2.18+page*.035,0],[1.15,.03,2.1],[0,0,-.14]);
    p.box('paper',[-3.22,2.18+page*.035,0],[1.15,.03,2.1],[0,0,.14]);
  }
  for(let i=0;i<5;i++){p.box('metal',[-4.3,2.36,-.72+i*.35],[.72,.009,.018]);p.box('metal',[-3.3,2.36,-.72+i*.35],[.72,.009,.018]);}
  p.cylinder('dark',[-.1,2.4,.1],.65,.45);p.box('dark',[-.1,2.72,.1],[2.1,.1,2.1],[0,.2,0]);
  p.rod('gold',[.65,2.78,-.55],[1.05,2.25,-.6],.025);p.cylinder('gold',[1.05,2.14,-.6],.06,.3);
  screen(p,4.1,3.2,.8,2.9,2.5);
  for(let row=0;row<4;row++)for(let col=0;col<3;col++)p.box(col===2?'gold':'paper',[3.1+col*1.0,4.0-row*.5,.66],[.58,.19,.025]);
}
function radar(p) {
  p.cylinder('metal',[-2.6,2.15,-.35],.2,2.2);p.cylinder('stone',[-2.6,1.12,-.35],1.05,.2);
  p.cylinder('paper',[-2.6,3.55,-.35],2.0,.16,[.75,0,0]);p.ring('metal',[-2.6,3.65,-.35],2.04,.05,[.75,0,0]);
  p.rod('metal',[-2.6,3.65,-.35],[-2.6,4.6,-1.25],.045);
  capsule(p,.8,-1.7,{height:3,w:1.4,d:1.4});
  for(let i=0;i<4;i++)p.box('signal',[.8,1.6+i*.6,-2.42],[1.05,.18,.035]);
  desk(p,3.7,1.5,3.7,1.8);screen(p,3.7,3.15,1.95,3.2,2.25);
  p.ring('paper',[3.7,3.15,1.81],.65,.015,[0,0,0]);p.ring('paper',[3.7,3.15,1.81],.32,.015,[0,0,0]);
  p.rod('gold',[3.7,3.15,1.79],[4.23,3.67,1.79],.027);keyboard(p,3.7,.85);
}

/**
 * p = {box,sphere,cylinder,ring,rod,cone?}, already material-keyed/batched.
 * context = {slug,project}; the project is never changed or used as new copy.
 * Returns true when handled, false for unknown future subjects (host fallback).
 * `onParts` is optional metadata-only instrumentation, not a UI text renderer.
 */
export function buildDetailedExhibit(subject,p,context={}) {
  if(!SUBJECTS.has(subject))return false;
  for(const name of ['box','sphere','cylinder','ring','rod'])if(typeof p?.[name]!=='function')throw new Error(`Detailed exhibit needs primitive ${name}`);
  const slug=context.slug??'';
  switch(subject){
    case 'supply-chain':logistics(p);break;
    case 'health-imaging':slug==='draeger-2023'?patientMonitor(p):conjunctiva(p);break;
    case 'energy-forum':forum(p,slug);break;
    case 'discovery-graph':slug==='dsag-ideathon-2024'?fraud(p):discovery(p);break;
    case 'semiconductor':semiconductor(p);break;
    case 'globe':globeTransition(p);break;
    case 'coins':coins(p);break;
    case 'gifting':gifting(p);break;
    case 'satellite':satellite(p);break;
    case 'linked-ledger':ledger(p,slug);break;
    case 'spatial-audio':slug==='huawei-agorize-2024'?hrtfStudy(p):musicEq(p);break;
    case 'radar':radar(p);break;
    case 'finance-graph':finance(p);break;
    case 'trajectory-policy':trajectoryPolicy(p);break;
    case 'focus':vrClassroom(p);break;
    case 'neural-route':slug==='salzburg-tourism-2024'?eegTourism(p):travel(p,slug);break;
    case 'bioinformatics':bioinformatics(p);break;
    case 'circular-appliances':applianceRecovery(p);break;
    case 'energy-grid':energyGrid(p);break;
    case 'football':football(p);break;
    case 'noseprints':noseprints(p);break;
    case 'academia':academia(p);break;
  }
  if(typeof context.onParts==='function')context.onParts(EXHIBIT_MODELS[slug]??null);
  return true;
}
