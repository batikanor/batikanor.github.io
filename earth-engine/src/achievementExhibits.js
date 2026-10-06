/**
 * Static, explanatory portfolio miniatures. This module only submits geometry
 * to the host's material-keyed batch; no renderer, texture, animation or fetch.
 * Objects illustrate the author's actual descriptions, never surveyed venue
 * installations, proprietary prototypes, medical data or measured results.
 */

export const EXHIBIT_MODELS = Object.freeze({
  'tesla-gigathon-2026':{kind:'supply-chain-cell',parts:['roller conveyor','pallet racks','cargo pallets','logistics terminal','pallet scanning arch','routing buffer lane','forklift with raised forks','loading bay routing diagram','treaded forklift tires','hydraulic mast pistons','rack cross-bracing']},
  'hong-kong-talent-engage-eurotech-healthtech-2026':{kind:'conjunctiva-imaging',parts:['conjunctiva eye study','imaging camera','hemoglobin estimation screen','calibrated capture rig','image-to-estimate panels','adjustable imaging rail fittings','recessed imaging controls']},
  'decarbon-days-climathon-2026':{kind:'climate-jury-forum',parts:['jury desks','pitch display','factory energy demonstrator','jury microphone consoles','ceremonial award cheque','jury chair armrests','framed presentation and cheque displays']},
  'pdm-kill-the-search-bar-2026':{kind:'directory-discovery',parts:['discovery kiosk','directory cards','comparison display','public directory browsing shelves','data-quality comparison panels','directory frame rails','recessed directory controls']},
  'zero-one-hack-supercompute-industrial-2026':{kind:'semiconductor-cell',parts:['silicon wafer','process cell','sequence-monitoring terminal','wafer cassette','articulated transfer gripper','HPC sequence rack','load-lock clamps','robot joint fasteners']},
  'huawei-tech-arena-finland-2025':{kind:'globe-transition',parts:['desktop globe','flattened map display','map transition frames','unfolding projection strips','coordinate grid','globe trunnion bearings','coordinate table edging']},
  'real-coin-map-2025':{kind:'numismatic-study',parts:['coin specimen trays','optical inspection station','mint map display','coin reliefs and milled rims','archival specimen drawers','optical gantry','specimen tray fittings','adjustable optical focus control']},
  'ethrome-2025':{kind:'private-gifting',parts:['gift parcels','pooled contribution console','privacy lock','anonymous contribution slots','recipient choice cards','parcel lid seams','anonymous intake controls']},
  'nasa-space-apps-zurich-2025':{kind:'satellite-ground-station',parts:['satellite bus','solar panel wings','ground-station dish','geography terminal','earth-observation optics','dish feed truss','geography tile table','panel hinge collars','satellite radiator fins','layered sensor optics']},
  'sui-hackathon-poland-2025':{kind:'word-minting-workbench',parts:['word-composition tiles','minted object cards','Move contract terminal','word joining track','minted composition archive','minted-card retaining clips','composition input controls']},
  'decarbon-days-climathon-2025':{kind:'climate-jury-forum',parts:['jury desks','pitch display','factory energy demonstrator','jury microphone consoles','factory load-balancing channels','jury chair armrests','framed presentation display']},
  'music-ai-osaka-2025':{kind:'vr-pen-equalizer',parts:['VR headset','tracked pen','frequency-band console','loudspeakers','three-axis pen trajectory','frequency mapping selectors','arched adjustable headset strap','recessed infrared pen windows','loudspeaker diaphragms']},
  'european-defense-tech-2025-munich':{kind:'radar-instrument',parts:['radar antenna','instrument rack','detection console','antenna feed supports','signal-processing instrument modules','antenna pivot brackets','instrument ventilation panels']},
  'tech-berlin-ai-hackathon-2':{kind:'portfolio-scenario-desk',parts:['portfolio dashboard','causal news cards','scenario display','causal comparison connections','scenario selection workbench','framed scenario panels','scenario selector controls']},
  'huawei-agorize-2024':{kind:'hrtf-pinna-capture',parts:['pinna study','multi-view camera arc','head-related audio display','camera calibration rails','multi-view image contact sheets','multi-view lens fittings','calibration rail clamps']},
  'masters-thesis':{kind:'trajectory-policy-workbench',parts:['recorded trajectory display','latent encoder','shared policy','environment test boards','encoder-to-policy transfer bridge','varied-dynamics test mechanisms','mechanism pivot fittings','encoder ventilation fins']},
  'lauzhack-2024':{kind:'vr-classroom',parts:['classroom desk','VR headset','EEG headband','tracked pen','aligned writing paper','teacher question display','focus-dependent handwriting comparison','arched adjustable headset strap','recessed infrared pen windows','question-display controls']},
  'salzburg-tourism-2024':{kind:'eeg-tourism',parts:['EEG headband','recommendation kiosk','tourism route miniature','feature-extraction workbench','five personality feature channels','recommendation pipeline','headband electrode fittings','feature-channel selectors']},
  'zurich-climathon-2024':{kind:'employee-survey-station',parts:['anonymous survey kiosks','company sustainability display','feedback cards','private survey partitions','sustainability comparison archive','survey console fittings','comparison drawer handles']},
  'bayer-ai-2024':{kind:'bioinformatics-workbench',parts:['molecular study','image inspection table','computer-vision terminal','microscope capture rig','specimen slide rack','image-processing comparison panels','optical instrument vents','specimen slide clips']},
  'dsag-ideathon-2024':{kind:'transaction-fraud-workbench',parts:['transaction documents','time-series monitor','fraud inspection gate','multi-transaction processing track','time-series context archive','inspection-gate controls','transaction archive handles']},
  'circular-bsh-2024':{kind:'appliance-recovery-line',parts:['old appliances','X-ray inspection portal','sorting conveyor','recovery bins','appliance unloading gantry','sensor inspection heads','recovery sorting diverter','gantry gripper shoes','scanner retaining fittings']},
  'thuega-2024':{kind:'household-energy-grid',parts:['model households','PV panels','battery storage','grid controller','household smart meters','battery inverter modules','forecast distribution channels','battery bus terminals','inverter controls']},
  'solana-ideathon-2024':{kind:'microbetting-contract-table',parts:['agreement table','liquidity pool','oracle terminal','paired agreement lanes','oracle resolution bridge','agreement track rails','oracle resolution controls']},
  'six-swisshacks-2024':{kind:'sustainability-reporting-desk',parts:['report binder','KPI dashboard','framework document trays','framework assessment cabinet','peer benchmark cards','binder clips','framework archive handles']},
  'hackupc-2024':{kind:'flight-recommendation-table',parts:['city miniatures','flight routes','aircraft','interest-comparison kiosk','departure gate miniatures','interest-to-city embedding trays','aircraft nacelles','gate turnstile fittings']},
  'mdsi-bundesliga-2024':{kind:'football-analysis-table',parts:['football pitch','player positions','defensive lines','line-break monitor','line-break path overlay','configurable line-break timeline','goal side frames and net grids','line-break console controls']},
  'draeger-2023':{kind:'patient-sensor-monitor',parts:['patient-monitor console','ECG-style signal','sensor channels','prediction display','multichannel acquisition rack','three forecast-horizon modules','recessed acquisition controls','monitor foot fittings']},
  'ethmunich-2023':{kind:'nft-similarity-workbench',parts:['paired image cards','feature-embedding racks','similarity comparison display','image-and-description comparison channels','ranked similarity trays','image retaining frames','paired comparison controls']},
  'msg-karlsruhe-2023':{kind:'co2-route-planner',parts:['road-route miniature','vehicle','alternative route','efficiency kiosk','grade-separated route bridge','route impact comparison sliders','vehicle lights and sills','bridge lane markings']},
  'bachelors-thesis':{kind:'noseprint-identification',parts:['cat study','nose-image capture camera','paired siamese encoder racks','identity comparison','macro-imaging calibration rig','paired noseprint comparison cards','macro-imaging vents','encoder face fittings']},
  'tgu-perfect-gpa':{kind:'academic-study',parts:['open book','graduation cap','course-record display','graduation lectern','gifted hourglass','hourglass column collars','open-book binding']},
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
    // A flat crown strap is a wearable assembly, not a metal torus through the
    // face. Ten fitted segments preserve a smooth readable arch at this scale.
    let prior=[x,y,z-.76];
    for(let i=1;i<=10;i++){
      const a=-Math.PI/2+i*Math.PI/10,next=[x,y+Math.cos(a)*1.04,z+Math.sin(a)*.76];
      const dy=next[1]-prior[1],dz=next[2]-prior[2];
      p.box('metal',[x,(prior[1]+next[1])/2,(prior[2]+next[2])/2],[.12,Math.hypot(dy,dz)*1.035,.045],[Math.atan2(dz,dy),0,0]);
      prior=next;
    }
    for(const side of [-1,1])p.box('dark',[x+side*.75,y+.05,z-.1],[.1,.2,.32]);
  }
}
function sensorPen(p,x,y,z,{lean=.28}={}) {
  const point=t=>[x-Math.sin(lean)*t,y+Math.cos(lean)*t,z];
  p.cylinder('paper',[x,y,z],.065,1.15,[0,0,lean]);
  p.cylinder('dark',point(.49),.078,.18,[0,0,lean]);
  // Flush infrared windows sit on the pen axis instead of floating gold
  // beads. These precise recessed faces are cheaper and more recognizable.
  for(const t of [-.25,.05,.25]){
    const [px,py]=point(t);
    p.box('dark',[px,py,z-.067],[.075,.082,.022],[0,0,lean]);
    p.box('gold',[px,py,z-.082],[.047,.048,.014],[0,0,lean]);
  }
  p.cylinder('metal',point(-.43),.068,.085,[0,0,lean]);
  p.cylinder('dark',point(-.56),.037,.11,[0,0,lean]);
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

/** Flat ribbon geometry: visible folds, not expensive tubular jewellery. */
function ribbonLoop(p,x,y,z,side) {
  const points=[[x,y,z],[x+side*.36,y+.32,z],[x+side*.64,y+.18,z],[x+side*.42,y-.04,z],[x,y,z]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1];
    p.box('gold',[(a[0]+b[0])/2,(a[1]+b[1])/2,z],[Math.hypot(dx,dy),.055,.18],[0,0,Math.atan2(dy,dx)]);
  }
}
function cabinet(p,x,z,{w=1.5,h=2.4,d=1.0,rows=4}={}) {
  p.box('metal',[x,1.13+h/2,z],[w,h,d]);
  p.box('dark',[x,1.13+h/2,z-d/2-.026],[w-.14,h-.14,.05]);
  for(let i=0;i<rows;i++){
    const y=1.38+(h-.44)*(i+.5)/rows;
    p.box('paper',[x,y,z-d/2-.058],[w-.3,(h-.6)/rows-.08,.035]);
    p.box('gold',[x+w*.29,y,z-d/2-.086],[.12,.12,.026]);
    for(let j=0;j<3;j++)p.box('dark',[x-w*.3+j*w*.14,y,z-d/2-.08],[.09,.04,.025]);
  }
}
function opticalRig(p,x,z,{y=3.7,w=2.0}={}) {
  for(const side of [-1,1]){
    p.box('metal',[x+side*w/2,(1.95+y)/2,z],[.1,y-1.9,.1]);
    p.box('dark',[x+side*w/2,1.94,z],[.55,.08,.45]);
  }
  p.box('metal',[x,y,z],[w+.25,.12,.14]);
  p.box('dark',[x,y-.26,z],[.56,.4,.45]);
  p.cylinder('metal',[x,y-.56,z],.2,.22);
  p.cylinder('signal',[x,y-.69,z],.14,.04);
}
function cardRails(p,x,y,z,{w=2.1,count=4}={}) {
  p.box('metal',[x,y-.12,z],[w+.18,.12,.74]);
  for(let i=0;i<count;i++){
    const dx=x-w/2+(i+.5)*w/count;
    p.box('paper',[dx,y+.22,z],[w/count-.08,.58,.06]);
    p.box('gold',[dx,y+.31,z-.042],[w/count-.17,.065,.025]);
    p.box('dark',[dx,y+.14,z-.042],[w/count-.18,.04,.025]);
  }
}

/** Recessed controls and machined edges share the existing material batch. */
function instrumentFace(p,x,y,z,{w=1.2,h=.48,buttons=3}={}) {
  p.box('metal',[x,y,z],[w+.08,h+.08,.065]);
  p.box('dark',[x,y,z-.044],[w,h,.025]);
  for(let i=0;i<buttons;i++){
    const px=x-w*.34+i*w*.68/Math.max(1,buttons-1);
    p.box(i===buttons-1?'gold':'paper',[px,y,z-.073],[w*.13,h*.38,.034]);
    p.box('metal',[px,y-h*.28,z-.072],[w*.1,.018,.023]);
  }
}
function radiator(p,x,y,z,{w=1.0,h=.75,bars=5}={}) {
  p.box('dark',[x,y,z],[w,h,.045]);
  for(let i=0;i<bars;i++)p.box('metal',[x,y-h*.38+i*h*.76/Math.max(1,bars-1),z-.04],[w*.86,.035,.035]);
}
function drawerGrip(p,x,y,z,w=1.0) {
  p.box('dark',[x,y,z],[w,.13,.035]);
  p.box('metal',[x,y,z-.052],[w*.75,.035,.1]);
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
  // A public, generic supply-chain illustration, NOT Tesla's confidential
  // factory layout, data, machinery or the team's undisclosed prototype.
  // Scanning arch gives the moving-pallet lane a distinct engineered silhouette.
  for(const z of [-1.22,1.22]){
    p.box('paper',[-.65,2.8,z],[.38,2.75,.38]);
    p.box('dark',[-.65,1.39,z],[.74,.13,.72]);
    p.box('metal',[-.65,2.8,z-.21],[.14,2.35,.035]);
  }
  p.box('paper',[-.65,4.2,0],[.5,.3,2.82]);
  p.box('dark',[-.65,3.94,0],[.37,.16,.7]);
  p.box('signal',[-.65,3.84,0],[.26,.035,.44]);
  for(const z of [-.97,.97])p.box('gold',[-.65,3.52,z],[.14,.55,.06]);
  // Raised forks, overhead protection, mast rails and counterweight: a forklift
  // rather than an arbitrary car/token. It is parked beside the buffer lane.
  const fx=3.75,fz=2.55;
  p.box('gold',[fx,1.52,fz],[1.65,.64,1.95]);
  p.box('metal',[fx,1.12,fz],[1.75,.2,2.05]);
  p.box('gold',[fx,1.94,fz+.73],[1.7,.48,.5]);
  p.box('dark',[fx,2.07,fz+.1],[.65,.28,.6]);
  p.box('dark',[fx,2.39,fz+.33],[.68,.67,.12]);
  for(const side of [-1,1]){
    for(const dz of [-.63,.63]){
      p.cylinder('dark',[fx+side*.88,1.13,fz+dz],.32,.19,[0,0,Math.PI/2]);
      p.cylinder('metal',[fx+side*.985,1.13,fz+dz],.16,.03,[0,0,Math.PI/2]);
    }
    p.box('metal',[fx+side*.63,2.57,fz+.52],[.1,1.43,.1]);
    p.box('metal',[fx+side*.63,2.57,fz-.5],[.1,1.43,.1]);
    p.box('dark',[fx+side*.48,2.41,fz-1.04],[.14,2.4,.18]);
    p.box('metal',[fx+side*.48,2.41,fz-1.15],[.06,2.18,.055]);
    p.box('metal',[fx+side*.45,1.82,fz-1.51],[.12,.1,1.04]);
    p.box('metal',[fx+side*.45,2.02,fz-1.03],[.12,.48,.13]);
  }
  p.box('dark',[fx,3.35,fz],[1.55,.15,1.38]);
  for(const dx of [-.53,0,.53])p.box('metal',[fx+dx,3.45,fz],[.045,.04,1.23]);
  p.box('gold',[fx,2.04,fz-1.07],[1.18,.31,.2]);
  p.rod('dark',[fx,2.2,fz-.34],[fx,2.61,fz-.22],.05);
  p.cylinder('dark',[fx,2.66,fz-.22],.21,.04,[.4,0,0]);
  // A right-angle transfer/buffer makes origin → inspection → storage legible.
  p.box('metal',[.45,1.51,2.55],[2.45,.2,2.25]);
  for(let i=0;i<6;i++)p.cylinder('dark',[.45,1.66,1.55+i*.36],.075,2.24,[0,0,Math.PI/2]);
  for(const z of [1.46,3.66])p.box('metal',[.45,1.9,z],[2.45,.09,.08]);
  for(const x of [-.55,1.45])p.box('metal',[x,1.15,2.55],[.11,.65,2.0]);
  p.box('stone',[.4,1.84,2.55],[1.55,.16,1.35]);
  for(const x of [-.03,.83])p.box('paper',[x,2.28,2.55],[.75,.72,1.18]);
  for(const x of [-.03,.83])p.box('gold',[x,2.66,2.55],[.12,.04,1.2]);
  for(let i=0;i<5;i++)p.box('gold',[1.9+i*.18,1.045,1.9],[.08,.025,.35],[0,-.5,0]);
  // Low loading/routing diagram occupies the foreground without obstructing
  // the original-prose signs or pretending these are real production metrics.
  p.box('dark',[-.95,1.02,-2.4],[4.8,.12,2.2]);
  for(let bay=0;bay<3;bay++){
    const x=-2.5+bay*1.55;
    for(const z of [-3.35,-1.5])p.box('paper',[x,1.095,z],[1.18,.018,.04]);
    for(const dx of [-.6,.6])p.box('paper',[x+dx,1.095,-2.42],[.035,.018,1.85]);
    p.box(bay===1?'gold':'signal',[x,1.115,-2.95],[.5,.022,.12]);
    p.box('metal',[x,1.21,-2.4],[.83,.16,.85]);
    for(const dx of [-.21,.21])p.box('paper',[x+dx,1.43,-2.4],[.38,.28,.67]);
    p.box('gold',[x,1.59,-2.4],[.09,.035,.71]);
  }
  for(let i=0;i<4;i++)p.box('gold',[-.92,1.14,-1.32+i*.3],[.22,.04,.12]);
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
  p.cylinder('metal',[3.6,1.8,-.65],.16,1.7);p.cylinder('paper',[3.6,2.8,-.65],1.2,.12,[.8,0,0]);
  p.ring('metal',[3.6,2.89,-.65],1.23,.045,[.8,0,0]);p.rod('metal',[3.6,2.8,-.65],[3.6,3.7,-1.2],.04);
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
    // Raised solid rims retain the coin silhouette with fewer triangles than
    // six miniature tori; those savings fund actual optical/archive objects.
    p.cylinder('metal',[x,2.107,z],.53,.035);p.cylinder('gold',[x,2.13,z],.48,.024);
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
    ribbonLoop(p,x,1.45+h,z,-1);ribbonLoop(p,x,1.45+h,z,1);
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
    const z=-1.85+i*1.5;capsule(p,2.1,z,{height:1.55,w:1.1,d:1.0});
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
    // Flat complementary base-pair blocks make the molecular helix readable;
    // expensive high-subdivision beads are unnecessary for this scale model.
    p.box(i%2?'signal':'gold',[-3.2+x,y,z],[.25,.16,.29],[0,angle,0]);
    p.box(i%2?'gold':'signal',[-3.2-x,y,-z],[.25,.16,.29],[0,angle,0]);
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
 * Second level of each authored demonstration: integrated equipment and a
 * readable input → interpretation → outcome, not interchangeable ornaments.
 * These are deliberately static museum-style illustrations. No made-up UI
 * copy, measured signals, proprietary machinery or project outcomes appear.
 */
function addExhibitSystems(subject,p,slug) {
  switch(subject) {
    case 'supply-chain':break; // Complete handling workflow is built above.
    case 'health-imaging':
      if(slug==='draeger-2023') {
        cabinet(p,.25,2.65,{w:2.15,h:2.15,d:.75,rows:3});
        for(let channel=0;channel<3;channel++){
          const x=-.55+channel*.8;
          p.box('dark',[x,3.7,2.65],[.65,.28,.85]);
          p.box(channel===2?'gold':'signal',[x,3.87,2.65],[.48,.025,.66]);
          linePath(p,[[x,2.4,-.9],[x,1.22,.4],[x,1.22,2.15]],{material:'metal',radius:.025});
        }
        for(let i=0;i<3;i++){
          p.box('metal',[-4.8,2.4-i*.38,-.49],[.24,.2,.035]);
          p.box('gold',[-4.8,2.4-i*.38,-.516],[.1,.1,.02]);
          waveform(p,3.8,3.3-i*.39,1.962,2.2,.19,{material:i===2?'gold':'paper',ecg:i===0});
        }
      }else{
        opticalRig(p,-3.45,-.3,{y:4.85,w:2.95});
        p.box('paper',[-.85,2.5,-.96],[.55,.82,.025]);
        for(let i=0;i<4;i++)p.box(i%2?'red':'paper',[-.99+(i%2)*.27,2.69-Math.floor(i/2)*.35,-.99],[.19,.26,.024]);
        cabinet(p,.6,2.7,{w:1.4,h:1.7,d:.85,rows:3});
        linePath(p,[[-1.1,1.22,-.5],[.6,1.22,-.5],[.6,1.22,1.0],[2.0,1.22,1.0]],{material:'gold',radius:.045});
        for(let i=0;i<5;i++)p.box(i===4?'gold':'red',[2.57+i*.46,3.74,1.495],[.24,.24+i*.035,.026]);
      }
      break;
    case 'semiconductor':
      // Synthetic process-sequence work is illustrated by the cassette →
      // transfer cell → monitoring path and a compact HPC instrument rack.
      cabinet(p,-2.7,2.5,{w:2.4,h:3.35,d:1.0,rows:5});
      p.box('dark',[-.65,1.65,1.8],[1.35,1.1,1.3]);
      for(let i=0;i<5;i++){
        p.box('metal',[-.65,1.26+i*.19,1.8],[1.1,.035,1.2]);
        p.cylinder('signal',[-.65,1.31+i*.19,1.8],.42,.025);
      }
      for(const point of [[1.7,3.4,-.25],[2.45,3.2,-1.5],[1.1,2.45,-1.5]])p.cylinder('gold',point,.22,.21,[Math.PI/2,0,0]);
      p.box('metal',[1.08,2.35,-1.5],[.85,.12,.24]);
      for(const side of [-1,1])p.box('dark',[1.08+side*.32,2.19,-1.5],[.08,.32,.28]);
      for(let i=0;i<5;i++)p.box(i===3?'gold':'signal',[.05+i*.35,1.14,2.8],[.25,.04,.44]);
      linePath(p,[[-.65,1.14,1.0],[-.65,1.14,.7],[1.7,1.14,.7],[1.7,1.14,-.25]],{material:'metal',radius:.035});
      break;
    case 'energy-forum':
      if(slug==='six-swisshacks-2024') {
        cabinet(p,-3.4,2.45,{w:3.2,h:2.8,d:1.0,rows:4});
        cardRails(p,.6,1.55,-2.3,{w:3.4,count:4});
        for(let i=0;i<4;i++)p.box('gold',[.6,1.15,-1.6+i*.33],[.3,.04,.12]);
        for(let row=0;row<2;row++)for(let col=0;col<3;col++)p.box(row?'paper':'gold',[2.7+col*.88,2.28-row*.26,1.398],[.6,.13,.025]);
      }else if(slug==='zurich-climathon-2024') {
        for(const x of [-3.8,0,3.8])for(const side of [-1,1]){
          p.box('metal',[x+side*1.05,2.3,-.1],[.07,1.6,1.75]);
          p.box('paper',[x+side*1.04,2.3,-.32],[.055,1.4,1.2]);
        }
        cabinet(p,0,2.7,{w:3.9,h:2.6,d:1.0,rows:4});
        for(const x of [-3.8,3.8])linePath(p,[[x,1.12,1.25],[x,1.12,2.7],[1.95*Math.sign(x),1.12,2.7]],{material:'gold',radius:.04});
      }else{
        for(const x of [-3.65,0,3.65]){
          p.box('dark',[x+.75,1.98,-1.25],[.36,.14,.48]);
          p.rod('metal',[x+.75,2.04,-1.25],[x+.64,2.49,-.95],.025);
          p.box('dark',[x+.64,2.5,-.95],[.1,.12,.16]);
          p.box('gold',[x-.75,1.94,-1.9],[.35,.04,.55]);
        }
        if(slug==='decarbon-days-climathon-2026'){
          p.box('metal',[3.8,2.58,1.6],[.1,2.8,.15]);
          p.box('paper',[3.8,3.67,1.6],[3.2,1.28,.075]);
          for(let i=0;i<3;i++)p.box(i===2?'gold':'metal',[3.8,4.05-i*.35,1.55],[2.5-i*.45,.08,.025]);
        }else{
          for(let i=0;i<3;i++){
            const x=-5.35+i*.6;
            p.box('dark',[x,1.82,2.05],[.29,.44,.035]);
            linePath(p,[[x,1.15,1.6],[x,1.15,.35],[0,1.15,.35]],{material:i===1?'gold':'metal',radius:.026});
          }
          cardRails(p,3.85,1.5,2.2,{w:2.7,count:3});
        }
      }
      break;
    case 'discovery-graph':
      if(slug==='dsag-ideathon-2024') {
        cabinet(p,-3.3,2.65,{w:3.3,h:2.55,d:1.0,rows:5});
        for(let i=0;i<4;i++){
          const x=-4.7+i*.93;p.box('dark',[x,1.16,-2.5],[.72,.12,.95]);
          p.box(i===2?'gold':'paper',[x,1.25,-2.5],[.57,.06,.77]);
          for(let j=0;j<3;j++)p.box('metal',[x,1.29,-2.75+j*.18],[.36,.015,.035]);
        }
        linePath(p,[[-1.75,1.14,-2.5],[-.7,1.14,-2.5],[-.7,1.14,.1]],{material:'gold',radius:.04});
        for(let i=0;i<5;i++)p.box(i===2?'gold':'paper',[2.08+i*.6,2.27,1.35],[.42,.25,.025]);
      }else{
        cabinet(p,-3.6,2.4,{w:3.4,h:2.7,d:1.05,rows:3});
        for(let i=0;i<4;i++)cardRails(p,-3.6,1.24+i*.62,1.83,{w:2.8,count:4});
        p.box('dark',[.4,1.2,1.4],[1.6,.15,2.2]);
        for(let i=0;i<3;i++){
          p.box('paper',[.4,1.34,-.75+i*1.15],[1.1,.08,.8]);
          p.box('gold',[.4,1.39,-.75+i*1.15],[.7,.035,.12]);
        }
      }
      break;
    case 'globe':
      // Three curved-to-flat coordinate strips make the original Gralobe
      // transition visible as an actual surface, not disconnected poles.
      for(let strip=0;strip<3;strip++)for(let segment=0;segment<4;segment++){
        const x=-.75+segment*.55,y=2.62+strip*.36+Math.sin(segment*.48)*.32,z=-1.7+strip*.7;
        p.box(segment%2?'signal':'metal',[x,y,z],[.61,.045,.55],[0,0,.25-segment*.13]);
        p.box('paper',[x,y+.036,z],[.51,.017,.027],[0,0,.25-segment*.13]);
      }
      for(const dx of [-1.5,-.5,.5,1.5])for(const dz of [-1.25,0,1.25]){
        p.box((dx+dz)>0?'gold':'leaf',[2.7+dx,1.63,.1+dz],[.47,.08,.37]);
      }
      for(const x of [-4.75,-1.65])p.box('metal',[x,1.07,0],[.1,.13,3.0]);
      p.box('metal',[-3.2,1.07,-1.4],[3.3,.13,.1]);
      break;
    case 'coins':
      cabinet(p,-2.4,2.95,{w:4.4,h:2.4,d:.9,rows:3});
      opticalRig(p,-3.7,-.6,{y:4.3,w:1.9});
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=-4.5+col*1.9,z=-1.05+row*2.0;
        // Geometric relief studies, not invented historically identified coins.
        p.box('metal',[x,2.154,z],[.19,.035,.35],[0,(col+row)*.4,0]);
        p.box('metal',[x+.08,2.164,z-.18],[.13,.035,.15],[0,.3,0]);
        for(let i=0;i<8;i++){
          const a=i*Math.PI/4;
          p.box('metal',[x+Math.sin(a)*.46,2.16,z+Math.cos(a)*.46],[.05,.014,.085],[0,a,0]);
        }
      }
      p.box('dark',[3.6,1.13,-2.0],[3.5,.14,1.75]);
      for(let i=0;i<4;i++){
        const x=2.3+i*.85;p.box(i%2?'gold':'signal',[x,1.25,-2],[.54,.08,.65]);
        if(i)p.box('metal',[x-.42,1.24,-2.0],[.35,.035,.035]);
      }
      break;
    case 'gifting':
      cabinet(p,3.4,2.85,{w:3.1,h:2.05,d:.8,rows:3});
      for(let i=0;i<4;i++){
        const x=-1.8+i*.87;
        p.box('metal',[x,1.32,2.6],[.65,.28,.85]);
        p.box('dark',[x,1.48,2.6],[.4,.035,.05]);
        p.box('gold',[x,1.67,2.6],[.27,.28,.065]);
        linePath(p,[[x,1.14,2.12],[x,1.14,1.6],[.6,1.14,1.6],[.6,1.14,-1.45]],{material:'metal',radius:.026});
      }
      cardRails(p,-3.1,1.3,2.65,{w:3.25,count:3});
      for(let i=0;i<3;i++)p.box('gold',[2.15+i*1.05,2.26,1.435],[.24,.14,.028]);
      break;
    case 'satellite':
      // Earth-observation/communication instruments represent mentoring and
      // satellite API knowledge, not a spacecraft built by the author.
      p.cylinder('dark',[-1.8,3.9,-1.38],.32,.5,[Math.PI/2,0,0]);
      p.cylinder('signal',[-1.8,3.9,-1.65],.25,.045,[Math.PI/2,0,0]);
      for(const dx of [-.58,.58])for(const dz of [-.52,.52]){
        p.box('metal',[-1.8+dx,4.57,-.4+dz],[.1,.18,.1]);
        p.box('dark',[-1.8+dx,2.57,-.4+dz],[.22,.18,.22]);
      }
      p.box('paper',[-1.8,4.63,-.4],[1.31,.08,1.28]);
      for(const side of [-1,1]){
        p.rod('metal',[-1.8+side*.75,3.2,-.4],[-1.8+side*3.65,3.56,-1.25],.025);
        p.rod('metal',[-1.8+side*.75,3.2,-.4],[-1.8+side*3.65,3.56,.45],.025);
      }
      for(const dx of [-.7,.7])p.rod('metal',[3.6+dx,2.64,-.25],[3.6,3.7,-1.2],.025);
      p.box('gold',[3.6,3.71,-1.2],[.18,.16,.25]);
      p.box('dark',[-1.5,1.15,2.4],[4.6,.22,2.5]);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=-3+col*1.5,z=1.84+row*1.13;
        p.box((row+col)%2?'signal':'leaf',[x,1.3,z],[1.36,.06,1.0]);
        p.box('gold',[x+.22,1.345,z-.2],[.36,.018,.29]);
      }
      break;
    case 'spatial-audio':
      if(slug==='huawei-agorize-2024') {
        for(const z of [.9,2.05])p.box('metal',[-2.8,1.94,z],[4.65,.06,.07]);
        for(let i=0;i<3;i++){
          const x=-4.8+i*2,z=.9+Math.abs(i-1)*.6;
          for(const dz of [-.18,.18])p.box('gold',[x,2.02,z+dz],[.34,.08,.065]);
          p.box('metal',[x,3.49,z],[.32,.07,.36]);
          p.box('dark',[x+.26,3.15,z-.39],[.09,.24,.16]);
        }
        cardRails(p,-2.65,1.33,2.8,{w:4.1,count:5});
        for(let i=0;i<3;i++)waveform(p,3.6,2.94-i*.25,1.295,2.15,.15,{material:i===1?'gold':'paper'});
      }else{
        // A static spatial trajectory explains how pen x/y/z drives the EQ.
        const origin=[-3,2.45,-1.85];
        for(const end of [[-1.15,2.45,-1.85],[-3,4.45,-1.85],[-3,2.45,.1]])p.rod('metal',origin,end,.024);
        linePath(p,[[-3.8,2.62,-1.7],[-3.6,3.17,-1.32],[-3.05,3.55,-1.1],[-2.45,3.9,-.85],[-1.8,3.36,-.5]],{material:'gold',radius:.027});
        for(let i=0;i<9;i++)p.box(i%3===0?'gold':'paper',[-2.5+i*.46,1.97,-.3],[.14,.05,.18]);
        for(const x of [3.1,5.0])for(let i=0;i<3;i++)p.box('metal',[x,1.45+i*.16,-.455],[.85,.032,.025]);
        p.box('dark',[.2,1.14,2.5],[3.0,.17,1.3]);
        for(let i=0;i<3;i++)p.box(i===1?'gold':'signal',[-.7+i*.9,1.29,2.5],[.69,.08,.95]);
      }
      break;
    case 'finance-graph':
      for(let i=0;i<3;i++){
        const x=1.15+i*1.9;
        linePath(p,[[x,1.13,-1.3],[x,1.13,1.3],[-.15,1.13,1.3]],{material:i===1?'gold':'metal',radius:.035});
        p.box('metal',[x,1.06,-1.7],[1.9,.12,.82]);
      }
      p.box('dark',[-2.8,1.95,-.72],[2.8,.15,.4]);
      for(let i=0;i<5;i++)p.box(i===3?'gold':'paper',[-3.9+i*.55,2.04,-.72],[.34,.07,.23]);
      cardRails(p,3.6,1.94,2.35,{w:3.05,count:4});
      cabinet(p,-3.15,2.85,{w:3.4,h:1.95,d:.85,rows:3});
      break;
    case 'trajectory-policy':
      p.box('metal',[1,1.15,1.3],[1.6,.15,1.15]);
      p.box('dark',[1,2.2,1.3],[1.3,2.0,.8]);
      for(let i=0;i<4;i++)p.box(i===3?'gold':'signal',[1,1.65+i*.36,.88],[1.0,.15,.035]);
      linePath(p,[[1,2.9,-.82],[1,2.9,.88]],{material:'gold',radius:.055});
      linePath(p,[[-.4,1.12,.1],[-.4,1.12,1.3],[.32,1.12,1.3]],{material:'metal',radius:.04});
      for(let i=0;i<3;i++){
        const z=-2.6+i*2.6;
        for(const side of [-1,1])p.box('metal',[4+side*1.26,1.4,z],[.045,.45,1.65]);
        // Rear extension on the front test board keeps its mechanism clear
        // when the user rotates past the wide, camera-facing prose panels.
        const mechanismZ=i===0?z+1.5:z;
        if(i===0){
          p.box('metal',[4.82,1.22,z+.95],[.25,.08,1.25]);
          p.box('metal',[4.82,1.8,mechanismZ],[.07,1.12,.07]);
        }
        p.box('gold',[4.82,2.4,mechanismZ],[.45,.13,.48]);
        p.rod('metal',[4.82,2.4,mechanismZ],[4.45,3.5-i*.3,mechanismZ],.035);
        p.box('paper',[4.45,3.5-i*.3,mechanismZ],[.19,.35,.22],[0,0,.25+i*.22]);
        p.box('signal',[3.3,1.25,z],[.33,.04,.7]);
      }
      break;
    case 'focus':
      p.box('dark',[1.1,2.25,2.9],[2.8,1.85,.15]);
      p.box('paper',[1.1,2.25,2.81],[2.58,1.63,.025]);
      for(let i=0;i<4;i++)p.box(i===0?'gold':'metal',[1.1,2.83-i*.36,2.783],[2.0-i*.19,.065,.02]);
      p.box('metal',[1.1,1.15,2.9],[.14,.6,.15]);
      for(const z of [-.25,.4])linePath(p,[[-2.35,1.94,z],[-1.9,1.94,z+.1],[-1.55,1.94,z-.03]],{material:z>0?'gold':'metal',radius:z>0?.025:.014});
      for(const x of [-4.67,-3.53])p.box('gold',[x,3.07,-.97],[.12,.16,.08]);
      cabinet(p,-3.2,2.7,{w:2.3,h:1.55,d:.8,rows:3});
      break;
    case 'neural-route':
      if(slug==='salzburg-tourism-2024') {
        cabinet(p,-3.4,2.7,{w:2.6,h:2.6,d:.85,rows:3});
        p.box('dark',[-.15,1.3,2.75],[2.0,.25,1.35]);
        for(let feature=0;feature<5;feature++){
          p.box(feature%2?'gold':'signal',[-.9+feature*.38,1.55+feature*.055,2.75],[.25,.25+feature*.11,.85]);
        }
        linePath(p,[[-3.38,1.14,2.2],[-3.38,1.14,1.2],[-.15,1.14,1.2],[-.15,1.14,2.03],[1.4,1.14,2.03]],{material:'gold',radius:.045});
        for(const side of [-1,1])p.box('metal',[-4.2+side*.73,3.07,-1.6],[.08,.22,.22]);
        p.box('paper',[4.6,1.75,.3],[1.0,.16,1.5]);
        p.box('dark',[4.6,2.25,.95],[1.0,.85,.08]);
      }else if(slug==='hackupc-2024') {
        for(const x of [.3,3.9]){
          p.box('metal',[x,1.6,-.85],[1.05,.9,.56]);
          p.box('dark',[x,2.13,-.85],[.8,.1,.62]);
          p.box('gold',[x,2.23,-.85],[.33,.07,.55]);
        }
        p.box('dark',[-3.5,1.18,2.75],[3.6,.15,1.5]);
        for(let pair=0;pair<3;pair++)for(let side=0;side<2;side++){
          const x=-4.7+pair*1.2,z=2.38+side*.7;
          p.box(side?'gold':'signal',[x,1.33,z],[.83,.14,.45]);
          for(let bit=0;bit<3;bit++)p.box('paper',[x-.23+bit*.23,1.415,z],[.1,.035,.15]);
        }
      }else{
        p.box('stone',[2.1,1.75,1.3],[2.15,.14,.74]);
        for(const x of [1.2,3.0])p.box('metal',[x,1.45,1.3],[.14,.52,.52]);
        for(const z of [.96,1.65])p.box('metal',[2.1,1.95,z],[2.15,.06,.04]);
        p.box('paper',[2.1,1.86,1.3],[1.85,.035,.075]);
        cardRails(p,-3.6,1.3,2.6,{w:3.5,count:3});
        for(let i=0;i<4;i++)p.box(i>1?'gold':'signal',[-4.45+i*.5,2.06,-.74],[.24,.05,.18]);
      }
      break;
    case 'bioinformatics':
      opticalRig(p,-.5,-.55,{y:4.2,w:1.7});
      cabinet(p,-3.15,2.75,{w:3.5,h:2.05,d:.85,rows:3});
      for(let i=0;i<5;i++){
        const x=-4.4+i*.62;p.box('dark',[x,1.25,-2.6],[.46,.16,.82]);
        p.box('paper',[x,1.36,-2.6],[.36,.06,.7]);p.box('signal',[x,1.4,-2.6],[.23,.02,.36]);
      }
      p.box('metal',[3.45,1.14,-1.5],[3.4,.16,2.1]);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=2.4+col*1.06,z=-1.96+row*.96;
        p.box((row+col)%2?'signal':'gold',[x,1.27,z],[.88,.07,.77]);
        for(let i=0;i<3;i++)p.box('paper',[x+(i-1)*.19,1.315,z+(i%2)*.18],[.1,.025,.12]);
      }
      break;
    case 'circular-appliances':
      // Unloading gantry and actual recovery path expand the existing X-ray
      // line; every module follows the source description's circular process.
      for(const x of [-5.5,-1.9])p.box('metal',[x,3.2,.9],[.17,4.05,.17]);
      p.box('gold',[-3.7,5.24,.9],[3.94,.19,.28]);
      p.box('dark',[-3.5,5.04,.9],[.7,.27,.46]);
      p.rod('metal',[-3.5,4.93,.9],[-3.5,3.85,.9],.055);
      p.box('metal',[-3.5,3.8,.9],[1.1,.12,.24]);
      for(const side of [-1,1])p.box('dark',[-3.5+side*.47,3.59,.9],[.08,.45,.27]);
      for(const x of [-.75,1.1]){
        p.box('dark',[x,4.02,-.92],[.44,.26,.2]);
        p.box('gold',[x,3.86,-.93],[.25,.035,.14]);
      }
      p.box('metal',[2.85,1.54,.35],[1.7,.2,1.45]);
      p.box('gold',[2.85,1.68,.35],[1.45,.06,.15],[0,.55,0]);
      for(let i=0;i<3;i++){
        const z=-2.3+i*2.2;
        p.box('dark',[4.7,2.59,z],[1.5,.07,1.45]);
        for(let part=0;part<3;part++)p.box(i===1?'signal':'metal',[4.3+part*.4,2.76,z],[.28,.3,.72],[0,i*.2,0]);
      }
      break;
    case 'energy-grid':
      for(const [x,z] of [[-4.25,-1.3],[-1.6,1.4]]){
        p.box('metal',[x+.42,1.66,z-.69],[.26,.36,.07]);p.box('gold',[x+.42,1.66,z-.736],[.13,.14,.025]);
      }
      cabinet(p,2.1,.55,{w:1.1,h:2.45,d:.9,rows:3});
      for(const z of [-1.7,-.6,.5])linePath(p,[[1.03,1.15,z],[1.35,1.15,z],[1.35,1.15,.55]],{material:'gold',radius:.04});
      for(let i=0;i<4;i++)p.box(i===2?'gold':'signal',[3.25+i*.53,2.18,1.855],[.3,.3+i*.07,.025]);
      p.box('dark',[-2.3,1.15,-2.8],[1.7,.18,.86]);
      for(let i=0;i<3;i++)p.box('paper',[-2.8+i*.5,1.31,-2.8],[.32,.12,.55]);
      break;
    case 'linked-ledger':
      if(slug==='sui-hackathon-poland-2025') {
        p.box('dark',[-.25,1.18,2.8],[3.3,.16,1.35]);
        for(let i=0;i<3;i++){
          const x=-1.35+i*1.05;p.box('paper',[x,1.35,2.8],[.8,.16,.82]);
          p.box('gold',[x,1.46,2.8],[.4,.035,.18]);
          if(i)p.box('metal',[x-.54,1.36,2.8],[.2,.06,.16]);
        }
        cabinet(p,-3.05,2.9,{w:2.5,h:2.2,d:.6,rows:3});
        for(const x of [1.55,2.45])p.box('metal',[x,1.06,0],[.06,.13,5.25]);
      }else if(slug==='ethmunich-2023') {
        cardRails(p,-3,1.28,2.75,{w:4.3,count:5});
        for(const x of [-4.25,-1.75])linePath(p,[[x,1.16,-1.5],[x,1.16,-2.6],[2.5,1.16,-2.6]],{material:x< -3?'metal':'gold',radius:.03});
        for(let i=0;i<4;i++){
          p.box('metal',[2.5+i*.85,3.09,-1.4],[.65,.09,.85]);
          p.box('signal',[2.5+i*.85,3.16,-1.4],[.36,.04,.55]);
        }
      }else{
        for(const z of [-.85,.85]){
          p.box('dark',[-2.8,1.12,z],[4.65,.15,.63]);
          for(let i=0;i<4;i++)p.box(i%2?'gold':'paper',[-4.45+i*1.02,1.25,z],[.73,.08,.43]);
        }
        p.box('metal',[.45,2.15,.05],[.18,2.0,.18]);
        p.box('gold',[.45,3.23,.05],[1.1,.17,1.3]);
        linePath(p,[[-.5,1.14,2.8],[.45,1.14,2.8],[.45,1.14,.05],[1.5,1.14,.05]],{material:'gold',radius:.045});
        cardRails(p,-3.1,1.36,2.7,{w:3.4,count:3});
      }
      break;
    case 'football':
      // Keep spherical players, as the source explicitly describes them.
      linePath(p,[[-3.8,1.41,-1.8],[-2.35,1.41,-.9],[-1.1,1.41,.3],[.9,1.41,.1],[2.4,1.41,1.8]],{material:'gold',radius:.025});
      for(let i=0;i<4;i++)p.box('paper',[1.0+i*.25,1.38,.1],[.09,.025,.36],[0,-.45,0]);
      p.box('dark',[5.0,1.2,-1.65],[1.5,.18,2.1]);
      for(let i=0;i<5;i++)p.box(i===2?'gold':'signal',[5,1.35,-2.4+i*.38],[1.12,.09,.19]);
      for(const x of [-4.5,2.9])for(const z of [-3.25,3.25])p.box('metal',[x,1.31,z],[.17,.09,.2]);
      break;
    case 'noseprints':
      opticalRig(p,-.9,-1.1,{y:3.5,w:1.12});
      cardRails(p,-3.1,1.3,2.7,{w:4.0,count:4});
      for(const z of [-1.4,1.1]){
        p.box('metal',[2.0,3.14,z],[1.1,.12,1.88]);
        p.box('paper',[2.0,3.22,z],[.82,.035,1.58]);
        for(let i=0;i<3;i++)p.box(i===1?'gold':'signal',[2.0,3.265,z-.5+i*.48],[.5,.035,.18]);
      }
      linePath(p,[[-1.7,1.12,.0],[.85,1.12,.0],[.85,1.12,-1.4],[1.5,1.12,-1.4]],{material:'metal',radius:.035});
      break;
    case 'academia':
      p.box('metal',[1.9,2.05,-1.8],[.16,1.9,.16]);
      p.box('dark',[1.9,3.0,-1.8],[1.5,.12,1.1],[.2,0,0]);
      p.box('paper',[1.9,3.1,-1.8],[1.1,.045,.76],[.2,0,0]);
      for(const y of [1.35,3.25])p.box('metal',[-3.6,y,2.8],[1.2,.14,1.0]);
      for(const dx of [-.43,.43])p.box('gold',[-3.6+dx,2.3,2.8],[.06,1.82,.06]);
      // The rector's hourglass is explicitly mentioned in the source text.
      if(typeof p.cone==='function'){
        p.cone('paper',[-3.6,2.75,2.8],.44,.83,[Math.PI,0,0]);
        p.cone('paper',[-3.6,1.86,2.8],.44,.83);
      }else{
        for(const y of [1.87,2.76])p.box('paper',[-3.6,y,2.8],[.61,.59,.61],[0,0,Math.PI/4]);
      }
      p.cylinder('gold',[-3.6,2.28,2.8],.055,.16);
      break;
    case 'radar':
      for(const dx of [-1.1,1.1])p.rod('metal',[-2.6+dx,3.53,.35],[-2.6,4.6,-1.25],.033);
      for(let i=0;i<3;i++){
        p.box('paper',[.8,1.53+i*.73,-2.43],[1.1,.35,.025]);
        for(let j=0;j<3;j++)p.box('gold',[.48+j*.31,1.54+i*.73,-2.456],[.11,.08,.025]);
      }
      p.box('dark',[-2.6,1.14,2.3],[3.2,.2,1.4]);
      for(let i=0;i<3;i++)p.box('metal',[-3.55+i*.95,1.42,2.3],[.75,.32,1.0]);
      break;
  }
}

/**
 * Close-up craftsmanship, not a second renderer or invented project copy.
 * Machined collars, recessed interfaces, handles, trusses and fasteners make
 * the existing explanatory objects feel assembled and usable at the 4× scale.
 */
function addExhibitCraft(subject,p,slug) {
  switch(subject){
    case 'supply-chain':{
      const fx=3.75,fz=2.55;
      for(const side of [-1,1]){
        for(const dz of [-.63,.63])for(let block=0;block<6;block++){
          const a=block*Math.PI/3;
          p.box('dark',[fx+side*.88,1.13+Math.cos(a)*.322,fz+dz+Math.sin(a)*.322],[.21,.047,.19],[a,0,0]);
        }
        p.cylinder('metal',[fx+side*.29,2.16,fz-1.08],.045,1.18);
        p.box('gold',[fx+side*.29,1.58,fz-1.08],[.15,.13,.18]);
        p.box('metal',[fx+side*.91,1.67,fz+.02],[.22,.08,.63]);
        for(let i=0;i<3;i++)p.box('dark',[fx+side*.91,1.724,fz-.19+i*.19],[.16,.022,.055]);
      }
      p.box('metal',[fx+.31,2.13,fz-.16],[.08,.34,.08],[0,0,-.17]);
      p.box('dark',[fx+.28,2.32,fz-.16],[.14,.09,.14]);
      p.box('dark',[fx,1.93,fz-.48],[.44,.06,.18],[.28,0,0]);
      for(const y of [1.28,3.95])p.box('gold',[-3.25,y,3.86],[3.24,.045,.13]);
      p.rod('metal',[-4.71,1.35,3.91],[-1.78,3.86,3.91],.025);
      p.rod('metal',[-4.71,3.86,3.91],[-1.78,1.35,3.91],.025);
      for(const x of [-4.53,3.38])for(const z of [-1.05,1.05])p.box('gold',[x,1.64,z],[.13,.13,.075]);
      instrumentFace(p,-.66,3.3,1.0,{w:.27,h:.42,buttons:2});
      break;
    }
    case 'health-imaging':
      if(slug==='draeger-2023'){
        instrumentFace(p,-3.85,2.07,-.625,{w:1.65,h:.24,buttons:4});
        instrumentFace(p,.25,3.1,2.225,{w:1.7,h:.27,buttons:3});
        radiator(p,3.8,2.16,2.07,{w:1.85,h:.27,bars:3});
        for(let i=0;i<3;i++)p.box('paper',[-.8+i*.8,2.3,-.9],[.32,.06,.35]);
        for(const x of [-4.5,-3.2])p.box('metal',[x,1.0,.72],[.2,.06,.24]);
      }else{
        radiator(p,-3.45,4.58,-.54,{w:.39,h:.22,bars:3});
        instrumentFace(p,.6,2.82,2.214,{w:1.06,h:.28});
        for(const side of [-1,1]){
          p.box('metal',[-3.45+side*1.47,4.24,-.3],[.16,.34,.16]);
          p.box('gold',[-3.45+side*1.47,4.26,-.398],[.095,.2,.036]);
          p.box('dark',[-3.4+side*1.35,1.96,-.15],[.15,.09,1.7]);
        }
        p.box('metal',[-.9,3.8,-.975],[.28,.035,.035]);
        drawerGrip(p,3.5,1.7,.31,1.6);
      }
      break;
    case 'semiconductor':
      for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        const x=.15+Math.cos(a)*.77,y=2.3+Math.sin(a)*.77;
        p.box('metal',[x,y,-2.26],[.16,.16,.075],[0,0,a]);
        p.box('gold',[x,y,-2.311],[.085,.085,.035],[0,0,a]);
      }
      radiator(p,-2.7,4.12,1.94,{w:1.88,h:.25,bars:3});
      drawerGrip(p,-.65,1.64,1.123,.8);
      for(const point of [[1.7,3.4,-.25],[2.45,3.2,-1.5],[1.1,2.45,-1.5]]){
        p.box('dark',[point[0],point[1],point[2]-.12],[.15,.15,.04]);
        p.box('metal',[point[0],point[1],point[2]-.15],[.06,.06,.025]);
      }
      instrumentFace(p,3.9,2.05,1.03,{w:1.6,h:.24,buttons:4});
      break;
    case 'energy-forum':
      if(slug==='six-swisshacks-2024'){
        for(let row=0;row<4;row++)drawerGrip(p,-3.4,1.7+row*.53,1.905,1.55);
        for(const x of [-4.67,-3.35])p.box('metal',[x,2.66,.08],[.1,.035,1.45]);
        instrumentFace(p,3.6,2.08,.64,{w:2.35,h:.24,buttons:4});
      }else if(slug==='zurich-climathon-2024'){
        for(const x of [-3.8,0,3.8]){
          instrumentFace(p,x,2.12,-.653,{w:1.35,h:.2});
          p.box('metal',[x,1.32,-.15],[1.48,.08,.63]);
          p.box('dark',[x,1.23,-.15],[1.28,.07,.48]);
        }
        for(let row=0;row<3;row++)drawerGrip(p,0,1.75+row*.48,2.14,2.5);
      }else{
        for(const x of [-3.65,0,3.65])for(const side of [-1,1]){
          p.box('metal',[x+side*.6,1.54,-.8],[.075,.44,.08]);
          p.box('dark',[x+side*.6,1.78,-.8],[.14,.1,.72]);
        }
        for(const x of [-2.74,2.74])p.box('metal',[x,4.25,3.41],[.08,2.62,.07]);
        for(const y of [2.98,5.52])p.box('metal',[0,y,3.41],[5.55,.06,.07]);
        if(slug==='decarbon-days-climathon-2026'){
          for(const x of [2.24,5.36])p.box('gold',[x,3.67,1.551],[.035,1.16,.025]);
          for(const y of [3.08,4.26])p.box('gold',[3.8,y,1.551],[3.14,.035,.025]);
        }else instrumentFace(p,3.85,1.38,1.776,{w:1.9,h:.22,buttons:3});
      }
      break;
    case 'discovery-graph':
      if(slug==='dsag-ideathon-2024'){
        for(let row=0;row<4;row++)drawerGrip(p,-3.3,1.6+row*.46,2.096,1.95);
        instrumentFace(p,-3.2,3.34,-.22,{w:1.8,h:.24});
        for(const x of [-4.8,-1.6])p.box('gold',[x,2.2,-.2],[.1,.33,.035]);
      }else{
        for(const x of [-4.2,-1.5,1.2]){
          instrumentFace(p,x,1.36,-2.08,{w:1.7,h:.22});
          for(const side of [-1,1])p.box('metal',[x+side*.99,2.47,-1.746],[.035,2.44,.025]);
        }
        for(let row=0;row<3;row++)drawerGrip(p,-3.6,1.63+row*.7,1.828,1.75);
      }
      break;
    case 'globe':
      for(const side of [-1,1]){
        p.cylinder('metal',[-3.2+side*2.11,3.5,0],.11,.29,[0,0,Math.PI/2]);
        p.box('dark',[-3.2+side*2.11,3.1,0],[.12,.64,.4]);
        p.rod('metal',[-3.2+side*2.11,2.77,0],[-3.2+side*.61,1.24,0],.035);
      }
      for(const x of [.13,5.27])p.box('metal',[x,1.62,.1],[.045,.065,4.29]);
      for(const z of [-2.045,2.245])p.box('metal',[2.7,1.62,z],[5.18,.065,.045]);
      instrumentFace(p,2.7,1.22,-2.25,{w:2.25,h:.18,buttons:4});
      break;
    case 'coins':
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const x=-4.5+col*1.9,z=-1.05+row*2;
        for(const dx of [-.725,.725])p.box('metal',[x+dx,2.02,z],[.035,.085,1.48]);
        for(const dz of [-.72,.72])p.box('metal',[x,2.02,z+dz],[1.48,.085,.035]);
        p.box('metal',[x-.105,2.176,z+.06],[.11,.028,.2],[0,.3+col*.2,0]);
        p.box('metal',[x+.105,2.176,z+.06],[.11,.028,.2],[0,-.3-col*.2,0]);
      }
      instrumentFace(p,-3.7,3.92,-.845,{w:.37,h:.16,buttons:2});
      p.cylinder('metal',[-3.36,4.02,-.6],.075,.14,[0,0,Math.PI/2]);
      for(let row=0;row<3;row++)drawerGrip(p,-2.4,1.62+row*.65,2.433,2.4);
      break;
    case 'gifting':
      for(let i=0;i<3;i++){
        const x=-4.7+i*2.15,h=1.2+i*.28,z=-.7+(i%2)*1.2;
        for(const side of [-1,1])p.box('metal',[x+side*.76,1.31+h,z],[.035,.032,1.46]);
        p.box('gold',[x,1.27+h,z-.84],[.4,.16,.024]);
      }
      for(let row=0;row<3;row++)drawerGrip(p,3.4,1.63+row*.56,2.377,1.78);
      for(const x of [2.15,3.2,4.25])p.box('metal',[x,2.08,1.463],[.29,.06,.045]);
      instrumentFace(p,.6,1.21,-1.465,{w:.6,h:.19,buttons:2});
      break;
    case 'satellite':
      for(const side of [-1,1])for(const z of [-.94,.14]){
        p.box('paper',[-1.8+side*.7,3.6,z],[.065,1.82,.065]);
        p.cylinder('gold',[-1.8+side*.87,3.6,z],.1,.2,[0,0,Math.PI/2]);
        p.box('metal',[-1.8+side*.96,3.6,z],[.045,.3,.28]);
      }
      radiator(p,-1.8,2.99,-1.218,{w:1.08,h:.34,bars:4});
      p.cylinder('metal',[-1.8,3.9,-1.58],.285,.065,[Math.PI/2,0,0]);
      p.cylinder('dark',[-1.8,3.9,-1.688],.17,.027,[Math.PI/2,0,0]);
      p.box('dark',[3.6,2.23,-.65],[.63,.17,.48]);
      for(const dx of [-.27,.27])p.box('gold',[3.6+dx,2.32,-.65],[.08,.2,.27]);
      instrumentFace(p,3.5,2.0,1.445,{w:2.25,h:.21,buttons:4});
      break;
    case 'spatial-audio':
      if(slug==='huawei-agorize-2024'){
        for(let i=0;i<3;i++){
          const x=-4.8+i*2,z=.9+Math.abs(i-1)*.6;
          p.cylinder('dark',[x,3.15,z-.514],.135,.06,[Math.PI/2,0,0]);
          p.box('paper',[x-.22,3.15,z-.312],[.055,.39,.035]);
          p.box('paper',[x+.22,3.15,z-.312],[.055,.39,.035]);
          p.box('metal',[x,2.6,z],[.14,.15,.14]);
          p.box('gold',[x+.105,2.6,z],[.1,.065,.065]);
        }
        instrumentFace(p,3.6,2.16,.374,{w:2.0,h:.2,buttons:4});
        for(const side of [-1,1])p.box('metal',[-2.8+side*.98,1.95,0],[.055,.045,2.45]);
      }else{
        for(const x of [3.1,5.0]){
          p.cylinder('dark',[x,2.4,-.548],.31,.045,[Math.PI/2,0,0]);
          p.cylinder('metal',[x,2.4,-.593],.115,.046,[Math.PI/2,0,0]);
          for(const dx of [-.51,.51])for(const y of [1.93,2.86])p.box('paper',[x+dx,y,-.463],[.055,.055,.038]);
          for(let i=0;i<3;i++)p.box('metal',[x+.62,3.15+i*.17,.2],[.028,.035,.65]);
        }
        for(const x of [-2.77,1.57])p.box('metal',[x,2.0,-.26],[.045,.08,1.72]);
        for(const z of [-1.12,.6])p.box('metal',[-.6,2.0,z],[4.38,.08,.045]);
        instrumentFace(p,.2,1.46,1.821,{w:2.5,h:.23,buttons:5});
      }
      break;
    case 'finance-graph':
      instrumentFace(p,-2.8,2.08,-.815,{w:2.35,h:.21,buttons:4});
      for(const x of [1.15,3.05,4.95]){
        p.box('metal',[x-.68,2.65,-1.901],[.026,2.45,.027]);
        p.box('metal',[x+.68,2.65,-1.901],[.026,2.45,.027]);
        p.box('gold',[x,1.48,-1.901],[1.35,.027,.026]);
      }
      for(let row=0;row<3;row++)drawerGrip(p,-3.15,1.55+row*.53,2.358,1.95);
      break;
    case 'trajectory-policy':
      instrumentFace(p,1,2.76,.864,{w:.91,h:.21,buttons:3});
      radiator(p,1,4.13,-2.408,{w:1.04,h:.29,bars:3});
      for(let i=0;i<3;i++){
        const z=-2.6+i*2.6,mechanismZ=i===0?z+1.5:z;
        p.box('dark',[4.82,2.4,mechanismZ],[.18,.18,.51]);
        p.box('gold',[4.82,2.4,mechanismZ-.282],[.075,.075,.045]);
        p.box('metal',[3.3,1.33,z],[.33,.1,.74]);
        for(const dx of [-.085,.085])p.box('paper',[3.3+dx,1.4,z],[.045,.04,.46]);
      }
      instrumentFace(p,-3.1,2.08,-.855,{w:2.15,h:.21,buttons:4});
      break;
    case 'focus':
      for(const side of [-1,1]){
        p.box('metal',[-4.1+side*.53,2.9,-1.46],[.095,.11,.025]);
        p.box('gold',[-4.1+side*.53,2.9,-1.478],[.034,.038,.011]);
        p.box('dark',[-2.5+side*2.64,1.82,-.5],[.07,.12,2.52]);
      }
      instrumentFace(p,1.1,1.48,2.81,{w:1.85,h:.22});
      for(let i=0;i<3;i++)drawerGrip(p,-3.2,1.36+i*.36,2.234,1.4);
      p.box('metal',[-1.8,1.931,-1.32],[1.43,.02,.045]);
      p.box('metal',[-1.8,1.931,.22],[1.43,.02,.045]);
      break;
    case 'neural-route':
      if(slug==='salzburg-tourism-2024'){
        for(const dx of [-.51,-.17,.17,.51]){
          p.box('metal',[-4.2+dx,3.12,-.755],[.11,.16,.04]);
          p.box('gold',[-4.2+dx,3.12,-.784],[.04,.063,.023]);
        }
        instrumentFace(p,-.15,1.5,2.05,{w:1.66,h:.17,buttons:5});
        for(let row=0;row<3;row++)drawerGrip(p,-3.4,1.59+row*.68,2.211,1.5);
        for(const z of [-3.13,3.13])p.box('metal',[2.65,1.25,z],[5.6,.025,.035]);
      }else if(slug==='hackupc-2024'){
        // Visible aircraft controls: tailplanes, paired engine nacelles and
        // gate turnstiles. They illustrate routes, not a real airline fleet.
        for(const side of [-1,1]){
          p.cylinder('metal',[2.6+side*.61,3.85,.77],.13,.38,[Math.PI/2,0,0]);
          p.box('gold',[2.6+side*.61,3.85,.553],[.13,.13,.03]);
        }
        for(const x of [.3,3.9]){
          p.box('dark',[x,1.7,-1.154],[.41,.09,.037]);
          p.box('paper',[x,1.81,-1.154],[.06,.065,.045]);
        }
        instrumentFace(p,-3.5,1.18,1.938,{w:2.7,h:.14,buttons:4});
      }else{
        for(const side of [-1,1]){
          p.box('paper',[1.8+side*.24,1.58,-1.49],[.11,.11,.03]);
          p.box('gold',[1.8+side*.24,1.58,-.113],[.11,.07,.03]);
          p.box('metal',[1.8+side*.36,1.45,-.8],[.045,.1,.92]);
        }
        for(let i=0;i<5;i++)p.box('gold',[2.1,1.79,.98+i*.13],[.043,.025,.065]);
        instrumentFace(p,-4,2.06,-.811,{w:1.9,h:.22,buttons:4});
      }
      break;
    case 'bioinformatics':
      radiator(p,-.5,3.95,-.797,{w:.43,h:.22,bars:3});
      instrumentFace(p,3.45,1.21,-2.579,{w:2.0,h:.18,buttons:4});
      for(let i=0;i<5;i++){
        const x=-4.4+i*.62;
        p.box('metal',[x-.19,1.365,-2.6],[.025,.048,.68]);
        p.box('metal',[x+.19,1.365,-2.6],[.025,.048,.68]);
      }
      for(let row=0;row<3;row++)drawerGrip(p,-3.15,1.54+row*.57,2.266,1.95);
      break;
    case 'circular-appliances':
      for(const x of [-.93,1.33])for(const y of [2.17,3.58])p.box('gold',[x,y,-.944],[.13,.13,.045]);
      instrumentFace(p,.2,2.36,-.947,{w:1.48,h:.23,buttons:4});
      radiator(p,-3.5,5.04,.644,{w:.5,h:.17,bars:3});
      for(const side of [-1,1]){
        p.box('metal',[-3.5+side*.47,3.37,.9],[.16,.075,.35]);
        p.box('dark',[-3.5+side*.47,3.36,.66],[.11,.09,.1]);
      }
      p.box('metal',[2.85,1.64,-.35],[1.38,.11,.05]);
      p.box('metal',[2.85,1.64,1.05],[1.38,.11,.05]);
      break;
    case 'energy-grid':
      instrumentFace(p,2.1,2.86,.031,{w:.75,h:.25});
      for(const z of [-1.7,-.6,.5]){
        p.box('metal',[.7,2.49,z],[.64,.065,.58]);
        for(const side of [-1,1])p.box('gold',[.7+side*.2,2.545,z],[.075,.055,.12]);
      }
      for(const [x,z] of [[-4.25,-1.3],[-1.6,1.4]]){
        for(const dx of [-.67,.67])p.box('metal',[x+dx,2.67,z],[.027,.024,.8],[.18,0,0]);
        p.box('paper',[x,2.72,z+.42],[1.3,.025,.035],[.18,0,0]);
      }
      radiator(p,4.1,2.12,.814,{w:1.7,h:.2,bars:3});
      break;
    case 'linked-ledger':
      if(slug==='sui-hackathon-poland-2025'){
        for(const z of [-2.35,0,2.35])for(const dx of [-.55,.55])for(const y of [1.48,3.01]){
          p.box('metal',[2+dx,y,z-.162],[.12,.07,.029]);
        }
        for(let row=0;row<3;row++)drawerGrip(p,-3.05,1.65+row*.56,2.55,1.3);
        instrumentFace(p,-.25,1.19,2.068,{w:1.95,h:.17});
      }else if(slug==='ethmunich-2023'){
        for(const x of [-4.25,-1.75]){
          for(const dx of [-.83,.83])p.box('paper',[x+dx,2.45,-.542],[.035,1.38,.025]);
          p.box('metal',[x,1.8,-.542],[1.65,.035,.025]);
          instrumentFace(p,x,1.56,-.6,{w:1.3,h:.18,buttons:2});
        }
        instrumentFace(p,3.5,2.05,2.07,{w:2.2,h:.21,buttons:4});
      }else{
        for(const z of [-.85,.85]){
          p.box('metal',[-2.8,1.23,z-.3],[4.3,.025,.035]);
          p.box('metal',[-2.8,1.23,z+.3],[4.3,.025,.035]);
        }
        instrumentFace(p,.45,3.22,-.618,{w:.85,h:.11,buttons:2});
        instrumentFace(p,4.45,1.77,-.018,{w:1.47,h:.23});
      }
      break;
    case 'football':
      for(const x of [-5.2,3.8]){
        const back=x<0?x-.28:x+.28;
        for(const z of [-.85,.85]){
          p.box('metal',[(x+back)/2,1.35,z],[.28,.05,.035]);
          p.box('paper',[back,1.66,z],[.035,.65,.035]);
        }
        for(let row=0;row<3;row++)p.box('paper',[back,1.45+row*.18,0],[.022,.022,1.63]);
        for(let col=0;col<5;col++)p.box('paper',[back,1.65,-.72+col*.36],[.022,.52,.018]);
      }
      instrumentFace(p,5,1.34,-2.728,{w:1.05,h:.17,buttons:3});
      break;
    case 'noseprints':
      radiator(p,-.9,3.24,-1.347,{w:.4,h:.21,bars:3});
      instrumentFace(p,4.5,1.86,-.028,{w:1.35,h:.21,buttons:3});
      for(const z of [-1.4,1.1]){
        for(const dx of [-.41,.41])p.box('metal',[2+dx,2.03,z-.898],[.035,1.71,.032]);
        drawerGrip(p,2,1.3,z-.919,.58);
      }
      for(let i=0;i<4;i++)p.box('metal',[-4.6+i*.98,1.52,2.67],[.085,.48,.085]);
      break;
    case 'academia':
      for(const x of [-4.61,-2.99])p.box('gold',[x,2.155,0],[.05,.045,2.13]);
      p.box('metal',[-3.8,2.2,0],[.035,.075,2.09]);
      for(const side of [-1,1])p.box('metal',[-3.6+side*.43,1.48,2.8],[.15,.12,.16]);
      for(const side of [-1,1])p.box('metal',[-3.6+side*.43,3.12,2.8],[.15,.12,.16]);
      p.box('gold',[1.9,2.15,-1.894],[.5,.15,.035]);
      instrumentFace(p,4.1,1.9,.578,{w:1.9,h:.18,buttons:4});
      break;
    case 'radar':
      for(const dx of [-.45,.45]){
        p.box('metal',[-2.6+dx,2.53,-.35],[.13,.18,.45]);
        p.box('gold',[-2.6+dx,2.54,-.603],[.08,.08,.035]);
      }
      radiator(p,.8,3.54,-2.469,{w:1.01,h:.29,bars:3});
      instrumentFace(p,3.7,2.08,.968,{w:2.55,h:.21,buttons:4});
      for(let i=0;i<3;i++)drawerGrip(p,-3.55+i*.95,1.43,1.775,.5);
      break;
  }
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
  addExhibitSystems(subject,p,slug);
  addExhibitCraft(subject,p,slug);
  if(typeof context.onParts==='function')context.onParts(EXHIBIT_MODELS[slug]??null);
  return true;
}
