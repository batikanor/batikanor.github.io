import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
maplibregl.setWorkerUrl(workerUrl);
import './style.css';
import achievements from './data/achievements.json';
import {earthStyle, BAVARIA_TRIAL_BOUNDS, BERLIN_TRUEDOP_BOUNDS, PUBLIC_RELEASE} from './sources.js';
import {createCarLayer} from './carLayer.js';
import {createBavariaBuildingLayer} from './buildingLayer.js';
import {createIsometricRegionLayer} from './isometricRegionLayer.js';
import {createRomeVenueChapter} from './romeVenueChapter.js';
import {createHeroVenueLayer, HERO_VENUE_EVENT, HERO_VENUE_LOCATION} from './heroVenueLayer.js';
import {createDrivingState, drivingInputFromKeys, stepDriving} from './drivingPhysics.js';
import {stepPosition, distanceMetres} from './geo.js';
import {sortAchievementsNewestFirst, getChronologyState, stepChronology} from './chronology.js';
import {markerLevelForZoom, MARKER_ZOOM, geographicCentroid, declutterMarkers} from './markerPolicy.js';
import {portfolioLinks} from './portfolioData.js';
import {getProject, renderProjectContent} from './projectContent.js';
import {readPortfolioRoute, portfolioUrl} from './portfolioRoute.js';
import {shouldShowIntro} from './introGate.js';
import {initialMapCamera, ISOMETRIC_CAMERA, COTTBUS_HANGAR_CAMERA, preferLocalStart} from './initialCamera.js';
import './projectContent.css';
import {createCvView} from './cvView.js';
import {bindCvDownload} from './cvDownload.js';
import {installExportControls} from './exportControls.js';
import {createDetailPanel} from './detailPanel.js';

const $ = (id) => document.getElementById(id);
const detailPanel = createDetailPanel($('detail'), {onGeometrySettled: keepCurrentEventVisible});
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const status = (message) => { $('status').textContent = message; };
const cvView=createCvView({root:$('cv-view-root'),onProjectLink:slug=>{
  const projectEvent=orderedAchievements.find(event=>event.slug===slug);
  if(projectEvent){refocusAfterCv=false;selectEvent(projectEvent,{showDetail:true});}
}});
const orderedAchievements=sortAchievementsNewestFirst(achievements);
const knownSlugs=new Set(orderedAchievements.map(event=>event.slug));
const initialRoute=readPortfolioRoute(window.location.href,knownSlugs);
const cities = Object.values(achievements.reduce((all, event) => {
  const key = `${event.city}|${event.country}`;
  const city = all[key] ??= {key, city:event.city, country:event.country, events:[], lng:0, lat:0};
  city.events.push(event);
  city.lng += event.coordinates.lng;
  city.lat += event.coordinates.lat;
  return all;
}, {})).map(city => ({...city,lng:city.lng/city.events.length,lat:city.lat/city.events.length})).sort((a,b)=>b.events.length-a.events.length || a.city.localeCompare(b.city));
const countries=Object.values(cities.reduce((all,city)=>{
  const group=all[city.country]??={name:city.country,cities:[],lng:0,lat:0,count:0};
  group.cities.push(city);group.lng+=city.lng;group.lat+=city.lat;group.count+=city.events.length;return all;
},{})).map(c=>({...c,lng:c.lng/c.cities.length,lat:c.lat/c.cities.length}));
const byCity = new Map(cities.map(x=>[x.key,x]));
const initialCamera = {center:[12,27],zoom:1.85,pitch:0,bearing:0};
const DETAIL_MAX_ZOOM=21.35;
const hasBavariaDetail = ([lng,lat]) => lng>=BAVARIA_TRIAL_BOUNDS[0] && lng<=BAVARIA_TRIAL_BOUNDS[2]
  && lat>=BAVARIA_TRIAL_BOUNDS[1] && lat<=BAVARIA_TRIAL_BOUNDS[3];
// Small real-data pockets rather than a fabricated miniature world. Every
// chapter has official LoD2 roofs/walls and a source-aligned 20 cm photo
// atlas. Other achievements keep the existing satellite/terrain journey.
const chapterUrl = name => `${import.meta.env.BASE_URL}data/${name}`;
const cottbusUrl = name => `${import.meta.env.BASE_URL}assets/isometric/${name}`;
const ISOMETRIC_CHAPTERS = [
  {
    id:'munich-siemens',origin:[11.5758,48.1453],radiusM:250,
    meshUrl:chapterUrl('munich-siemens-lod2-v1.bin'),
    roofAtlas:{imageUrl:chapterUrl('munich-siemens-roof-dop20-v1.webp'),metadataUrl:chapterUrl('munich-siemens-roof-dop20-v1.json')},
    credit:'Bayerische Vermessungsverwaltung · LoD2 buildings and DOP20 imagery (modified), CC BY 4.0'
  },
  {
    id:'munich-google',origin:[11.5802,48.1392],radiusM:250,
    meshUrl:chapterUrl('munich-google-lod2-v1.bin'),
    roofAtlas:{imageUrl:chapterUrl('munich-google-roof-dop20-v1.webp'),metadataUrl:chapterUrl('munich-google-roof-dop20-v1.json')},
    credit:'Bayerische Vermessungsverwaltung · LoD2 buildings and DOP20 imagery (modified), CC BY 4.0'
  },
  {
    id:'berlin-library',origin:[13.3708,52.5074],radiusM:250,
    meshUrl:chapterUrl('berlin-library-lod2-v1.bin'),
    roofAtlas:{imageUrl:chapterUrl('berlin-library-roof-truedop20-v1.webp'),metadataUrl:chapterUrl('berlin-library-roof-truedop20-v1.json')},
    credit:'Geoportal Berlin · LoD2 buildings and TrueDOP 2026 imagery (modified), dl-de-zero-2.0'
  },
  ...[
    {year:'2025',origin:[14.301040317339991,51.775269384379186]},
    {year:'2026',origin:[14.326165,51.767384]}
  ].map(({year,origin})=>{
    const stem=`cottbus-climathon-${year}`;
    return {
      id:stem,origin,radiusM:250,
      meshUrl:cottbusUrl(`${stem}-lod2-v1.bin`),
      roofAtlas:{
        imageUrl:cottbusUrl(`${stem}-roof-truedop20-v1.webp`),
        metadataUrl:cottbusUrl(`${stem}-roof-truedop20-v1.json`)
      },
      groundImage:{
        imageUrl:cottbusUrl(`${stem}-ground-truedop20-v1.webp`),
        metadataUrl:cottbusUrl(`${stem}-ground-truedop20-v1.json`)
      },
      credit:'© GeoBasis-DE/LGB · Brandenburg LoD2 buildings and TrueDOP20 imagery (data modified), dl-de/by-2-0'
    };
  })
];
const ISOMETRIC_EVENT_REGIONS = new Map([
  ['masters-thesis','munich-siemens'],
  ['bayer-ai-2024','munich-google'],
  ['real-coin-map-2025','berlin-library'],
  ['decarbon-days-climathon-2025','cottbus-climathon-2025'],
  ['decarbon-days-climathon-2026','cottbus-climathon-2026']
]);
const constrainedNavigation=preferLocalStart({deviceMemory:navigator.deviceMemory,
  saveData:navigator.connection?.saveData,
  coarsePointer:window.matchMedia('(pointer: coarse)').matches,
  reducedMotion:prefersReducedMotion});
const bootstrapCamera = initialMapCamera(initialRoute, orderedAchievements, initialCamera, {
  // The entered homepage starts on the world, not on the newest competition.
  // Explicit achievement deep links still get their direct local camera.
  fastStart:false,
  isometricEventSlugs:ISOMETRIC_EVENT_REGIONS
});

const map = new maplibregl.Map({
  container:'map',
  style:earthStyle(),
  center:bootstrapCamera.center,
  zoom:bootstrapCamera.zoom,
  pitch:bootstrapCamera.pitch,
  bearing:bootstrapCamera.bearing,
  minZoom:1.3,
  maxZoom:DETAIL_MAX_ZOOM,
  maxPitch:82,
  renderWorldCopies:false,
  canvasContextAttributes:{antialias:true},
  attributionControl:false
});
map.addControl(new maplibregl.ScaleControl({unit:'metric',maxWidth:120}),'bottom-left');
const scaleElement=document.querySelector('.maplibregl-ctrl-scale');
if(scaleElement)$('settings-scale').append(scaleElement);

let activeCity = null;
let activeEvent = null;
let imagery = PUBLIC_RELEASE ? 'esa' : 'eox';
if(PUBLIC_RELEASE){
  document.querySelector('[data-imagery="eox"]')?.remove();
  document.querySelector('[data-imagery="esa"]').setAttribute('aria-pressed','true');
  $('imagery-credit').innerHTML='<a href="https://esa-worldcover.org/en/data-access">© ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/">NASA Blue Marble underlay</a>';
}
let terrainOn = true;
// Mapterhorn has z13 coverage around the Rome venue but returns 404 for the
// z14–16 tiles requested by our global DEM source there. The city-scale Rome
// orthophoto/massing is effectively flat; do not make dozens of doomed DEM
// requests while approaching it. Restore relief on the next destination.
let terrainPausedForRome = false;
let terrainResumeToken = 0;
let cityDetailOn = true;
let creditedImagery = null;
function syncTerrain(){
  // At street-level drive zoom, MapLibre's terrain projection can show a black
  // ground plane on short mobile canvases. The local campus is essentially
  // flat, so pause the DEM while driving and honour the user's preference again
  // on exit. Both the car and radar then query the same flat map surface.
  const show=terrainOn&&!drive.active&&!terrainPausedForRome;
  map.setTerrain(show?{source:'terrain',exaggeration:1}:null);
  map.setLayoutProperty('terrain-hillshade','visibility',show?'visible':'none');
  $('terrain-toggle').setAttribute('aria-pressed',String(terrainOn));
  $('terrain-state').textContent=terrainOn?(drive.active||terrainPausedForRome?'PAUSED':'ON'):'OFF';
}
function resumeTerrainAfterFlight(){
  const token=++terrainResumeToken;
  const resume=()=>{
    if(token!==terrainResumeToken)return; // A newer destination won the race.
    terrainPausedForRome=false;
    syncTerrain();
  };
  // Register after fly(), not before: map.stop() and its high-zoom safety
  // jump can themselves emit moveend at the *old* Rome location.
  if(map.isMoving())map.once('moveend',resume);
  else resume();
}
// Two honest camera framings of the same 4.34 m car. No model-scale change.
// The close chase helps the vehicle read; the overview keeps the installation
// and its real spatial relationship visible.
const DRIVE_CAMERAS=Object.freeze({
  chase:Object.freeze({zoom:21.05,pitch:60,lookahead:3.8}),
  overview:Object.freeze({zoom:20.15,pitch:68,lookahead:8})
});
// A phone turned sideways has too little vertical canvas for the desktop
// chase: the physically scaled car falls below the map and attribution. Keep
// the same car and heading, but pull back and shorten the look-ahead. A centre
// behind the car would put MapLibre's terrain camera below the DEM here.
const SHORT_LANDSCAPE_DRIVE_CAMERAS=Object.freeze({
  chase:Object.freeze({zoom:20.45,pitch:60,lookahead:.5}),
  overview:Object.freeze({zoom:19.95,pitch:62,lookahead:4})
});
function driveCamera(){
  const shortLandscape=window.innerHeight<=500&&window.innerWidth>window.innerHeight*1.3;
  return (shortLandscape?SHORT_LANDSCAPE_DRIVE_CAMERAS:DRIVE_CAMERAS)[drive.cameraMode];
}
const drive = {active:false,position:[11.5761,48.1372],heading:0,speed:0,keys:new Set(),last:0,cameraMode:'chase'};
let physicsState = null;
// Approximate, manually inspected ground-level start for the Garching demo.
// This is *not* a road graph or an assertion that every venue coordinate is drivable.
const driveStarts = new Map([
  ['european-defense-tech-2025-munich',{position:[11.666954,48.262269],heading:225}]
]);
const carLayer = createCarLayer(()=>drive);
const bavariaBuildings = createBavariaBuildingLayer();
const isometricRegions = createIsometricRegionLayer({regions:ISOMETRIC_CHAPTERS,onChange:()=>updateCredits()});
const romeVenue = createRomeVenueChapter({onChange:()=>updateCredits()});
const heroVenue = createHeroVenueLayer({onScan:({phase})=>{
  const button=$('scan-button');
  button.classList.toggle('active',phase==='scanning'||phase==='contact');
  button.querySelector('span').textContent=phase==='scanning'?'SCANNING':phase==='contact'?'CONTACT':'SCAN RADAR';
  if(phase==='scanning')status('Protective Radar · the dish sweeps the surrounding airspace.');
  else if(phase==='contact')status('Protective Radar · one contact detected; the quiet warning shield rises.');
  else if(phase==='complete')status('Protective Radar · scan complete. Activate it again to replay.');
}});
const markers = [];

function safeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function keyOf(e){return `${e.city}|${e.country}`;}

function renderJourney(){
  const state=getChronologyState(orderedAchievements,activeEvent?.slug??null);
  const event=state.current??orderedAchievements[0];
  if(!event)return;
  const ordinal=state.index<0?1:state.index+1;
  $('journey-meta').textContent=`${String(ordinal).padStart(2,'0')} / ${orderedAchievements.length} · ${event.date} · ${event.city}`;
  const title=getProject(event.slug)?.title??event.title;
  $('journey-title').textContent=title;
  $('journey-current').title=`${title} — open details`;
  $('journey-previous').disabled=!state.previous;
  $('journey-next').disabled=state.index<0?false:!state.next;
}
renderJourney();
$('journey-previous').addEventListener('click',()=>{
  const event=stepChronology(orderedAchievements,activeEvent?.slug??null,'previous');
  if(event)selectEvent(event,{showDetail:true,chronologyNavigation:true});
});
$('journey-next').addEventListener('click',()=>{
  const event=stepChronology(orderedAchievements,activeEvent?.slug??null,'next');
  if(event)selectEvent(event,{showDetail:true,chronologyNavigation:true});
});
$('journey-current').addEventListener('click',()=>{
  const event=activeEvent??orderedAchievements[0];
  // The centre card doubles as an explicit refocus, even after free panning.
  selectEvent(event,{showDetail:true});
});

$('cv-download').href=portfolioLinks.cvPdf;
bindCvDownload($('cv-download'));
// PDF.js and a cross-continent map flight should not compete for the main
// thread when the CV opens. In particular, a direct ?view=cv entry starts at
// the globe and has no reason to render the selected venue behind a modal.
let refocusAfterCv=false;
function openCvView({mapFocusSkipped=false}={}){
  refocusAfterCv=mapFocusSkipped||map.isMoving();
  if(map.isMoving())map.stop();
  cvView.open();
}
$('cv-link').addEventListener('click',()=>{
  closePopovers();
  const url=portfolioUrl(window.location.href,{eventSlug:activeEvent?.slug,view:'cv'});
  // A full navigation selects the map-free bootstrap path for the PDF viewer.
  // Keeping the map running behind a modal can starve PDF.js on slow devices.
  window.location.assign(url.href);
});
$('cv-view').addEventListener('close',()=>{
  if(readPortfolioRoute(window.location.href,knownSlugs).view==='cv'){
    const url=portfolioUrl(window.location.href,{eventSlug:activeEvent?.slug});
    window.history.replaceState(null,'',url);
  }
  if(refocusAfterCv&&activeEvent){
    refocusAfterCv=false;
    selectEvent(activeEvent,{showDetail:!$('detail').hidden,historyMode:'none'});
  }
});
installExportControls({announce: status});
function closePopovers(){
  for(const [panelId,toggleId] of [['portfolio-panel','portfolio-toggle'],['settings-panel','settings-toggle']]){
    $(panelId).hidden=true;$(toggleId).setAttribute('aria-expanded','false');
  }
}
function togglePopover(panelId,toggleId){
  const wasOpen=!$(panelId).hidden;
  closePopovers();
  $(panelId).hidden=wasOpen;
  $(toggleId).setAttribute('aria-expanded',String(!wasOpen));
}
$('portfolio-toggle').addEventListener('click',()=>togglePopover('portfolio-panel','portfolio-toggle'));
$('settings-toggle').addEventListener('click',()=>togglePopover('settings-panel','settings-toggle'));
document.addEventListener('pointerdown',event=>{
  if(!event.target.closest('.top-popover,.topbar-actions'))closePopovers();
});
const creditsObserver=new ResizeObserver(()=>{
  const height=$('sources').getBoundingClientRect().height;
  if(height)$('app').style.setProperty('--credits-height',`${Math.ceil(height)}px`);
});
creditsObserver.observe($('sources'));

function updateCredits(){
  const bounds=map.getBounds();
  // Show the attribution conservatively whenever a Bavaria tile could intersect
  // the viewport; the camera center may be outside while an edge tile is shown.
  const bavaria=imagery!=='nasa'&&map.getZoom()>=12
    &&bounds.getEast()>=BAVARIA_TRIAL_BOUNDS[0]&&bounds.getWest()<=BAVARIA_TRIAL_BOUNDS[2]
    &&bounds.getNorth()>=BAVARIA_TRIAL_BOUNDS[1]&&bounds.getSouth()<=BAVARIA_TRIAL_BOUNDS[3];
  $('bavaria-credit').hidden=!bavaria;
  const berlin=imagery!=='nasa'&&map.getZoom()>=16
    &&bounds.getEast()>=BERLIN_TRUEDOP_BOUNDS[0]&&bounds.getWest()<=BERLIN_TRUEDOP_BOUNDS[2]
    &&bounds.getNorth()>=BERLIN_TRUEDOP_BOUNDS[1]&&bounds.getSouth()<=BERLIN_TRUEDOP_BOUNDS[3];
  $('berlin-credit').hidden=!berlin;
  $('cottbus-credit').hidden=!isometricRegions.getActiveRegionId()?.startsWith('cottbus-');
  $('rome-credit').hidden=!romeVenue.isVisible();
  if(creditedImagery!==imagery){
    $('imagery-credit').innerHTML=imagery==='eox'
      ? '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2024) · <a href="https://cloudless.eox.at/license-non-commercial">CC BY-NC-SA 4.0</a>'
      : imagery==='esa'
        ? '<a href="https://esa-worldcover.org/en/data-access">© ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/">NASA Blue Marble underlay</a>'
        : '<a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/">NASA Earth Observatory · Blue Marble Next Generation</a>';
    creditedImagery=imagery;
  }
}

function fly(target,{chronologyNavigation=false}={}) {
  map.stop();
  const current=map.getCenter();
  const nextCenter=Array.isArray(target.center)
    ? target.center : [target.center?.lng,target.center?.lat];
  const crossCity=chronologyNavigation&&nextCenter.every(Number.isFinite)
    &&distanceMetres([current.lng,current.lat],nextCenter)>35_000;
  // The chronology is a navigation control, not a forced 2.4 s tour through
  // every intervening raster/DEM zoom level. On constrained devices, a direct
  // cross-city jump avoids downloading tiles that will immediately be discarded.
  if(crossCity&&constrainedNavigation){map.jumpTo(target);return;}
  // MapLibre's globe+terrain DEM sampler cannot always project a distant
  // destination from a street-level camera. The resulting Infinity tile
  // coordinate aborts flyTo (notably Garching → WORLD). Back out locally
  // before the geographic flight instead of asking one flight to span z20→z2.
  const nextLng=nextCenter[0];
  if(map.getZoom()>17 && (target.zoom<15 || Math.abs(map.getCenter().lng-nextLng)>5)){
    map.jumpTo({center:map.getCenter(),zoom:13.8,pitch:0,bearing:map.getBearing()});
  }
  if (prefersReducedMotion) {map.jumpTo(target);return;}
  const duration=chronologyNavigation?(crossCity?1400:900):2400;
  try {map.flyTo({...target,essential:true,duration,curve:1.25});}
  catch(error){
    // A failed animation must not strand the visitor on an unresponsive map.
    console.warn('Map flight fell back to a direct camera change:',error);
    map.jumpTo(target);
  }
}
function finishDrive() {
  if (!drive.active) return;
  drive.active=false; drive.keys.clear(); drive.speed=0; physicsState=null;
  syncTerrain();
  map.setLayoutProperty('achievement-halo','visibility','visible');
  map.setLayoutProperty('achievement-points','visibility','visible');
  $('drive-hud').hidden=true;
  $('app').classList.remove('drive-active');
  $('drive-button').classList.remove('active');
  $('drive-button').querySelector('span').textContent='DRIVE';
  map.dragPan.enable();map.scrollZoom.enable();map.dragRotate.enable();map.touchZoomRotate.enable();
  status('Drive paused. Drag, zoom or choose another destination.');
  updateScanAvailability();
  map.triggerRepaint();
}
function updateDriveCameraButton(){
  const close=drive.cameraMode==='chase';
  const button=$('drive-camera-toggle');
  button.querySelector('span').textContent=close?'CLOSE CHASE':'SITE OVERVIEW';
  button.setAttribute('aria-pressed',String(close));
  button.setAttribute('aria-label',close
    ?'Close chase camera active. Switch to site overview. Shortcut C.'
    :'Site overview camera active. Switch to close chase. Shortcut C.');
}
function toggleDriveCamera(){
  if(!drive.active)return;
  drive.cameraMode=drive.cameraMode==='chase'?'overview':'chase';
  updateDriveCameraButton();
  status(drive.cameraMode==='chase'
    ?'Close chase camera · the car remains 4.34 metres long; press C for the site overview.'
    :'Site overview camera · the installation and drive area in context; press C for close chase.');
}
function selectCity(city) {
  if(!city)return;
  const newest=orderedAchievements.find(event=>keyOf(event)===city.key);
  if(newest)selectEvent(newest,{showDetail:true});
}
function detailMapOffset(){
  const panel=detailPanel.getRect();
  if(!panel){
    if(window.innerWidth<=760){
      if(window.innerHeight<=560&&window.innerWidth>window.innerHeight*1.3)return [175,0];
      return [0,-Math.min(window.innerHeight*.29,290)];
    }
    return [-Math.min(390,window.innerWidth*.31),0];
  }
  const appRect=$('app').getBoundingClientRect();
  const width=appRect.width, height=appRect.height;
  const safeTop=$('app').querySelector('.topbar').getBoundingClientRect().bottom-appRect.top+8;
  const safeBottom=$('journey').getBoundingClientRect().top-appRect.top-8;
  const safeHeight=Math.max(0,safeBottom-safeTop);
  const leftRoom=Math.max(0,panel.x);
  const rightRoom=Math.max(0,width-panel.x-panel.width);
  const topRoom=Math.max(0,panel.y-safeTop);
  const bottomRoom=Math.max(0,safeBottom-panel.y-panel.height);
  // Choose the largest unobstructed piece of the map. This also handles a
  // bottom-sheet dragged upward or a landscape/mobile sheet moved sideways.
  const choices=[
    {area:leftRoom*safeHeight,x:leftRoom/2,y:safeTop+safeHeight/2},
    {area:rightRoom*safeHeight,x:panel.x+panel.width+rightRoom/2,y:safeTop+safeHeight/2},
    {area:topRoom*width,x:width/2,y:safeTop+topRoom/2},
    {area:bottomRoom*width,x:width/2,y:panel.y+panel.height+bottomRoom/2}
  ];
  const target=choices.reduce((best,choice)=>choice.area>best.area?choice:best);
  const x=Math.max(-Math.min(420,width*.45),Math.min(Math.min(420,width*.45),target.x-width/2));
  const y=Math.max(-Math.min(320,height*.45),Math.min(Math.min(320,height*.45),target.y-height/2));
  return [x,y];
}
function keepCurrentEventVisible(){
  if($('detail').hidden||!activeEvent||drive.active)return;
  const focus=activeEvent.slug===HERO_VENUE_EVENT
    ? document.querySelector('[data-venue-view="campus"][aria-pressed="true"]')
      ? [11.666954,48.262269] : HERO_VENUE_LOCATION
    : [activeEvent.coordinates.lng,activeEvent.coordinates.lat];
  const point=map.project(focus);
  const mapRect=$('map').getBoundingClientRect();
  const panelRect=$('detail').getBoundingClientRect();
  const screenX=point.x+mapRect.left, screenY=point.y+mapRect.top;
  if(screenX<panelRect.left-12||screenX>panelRect.right+12
    ||screenY<panelRect.top-12||screenY>panelRect.bottom+12)return;
  map.easeTo({center:focus,offset:detailMapOffset(),duration:prefersReducedMotion?0:400});
}
function selectEvent(event,{showDetail=false,historyMode='push',view=null,skipFly=false,chronologyNavigation=false}={}) {
  if(!event)return;
  finishDrive();activeEvent=event;activeCity=byCity.get(keyOf(event));
  const pauseRome=event.slug==='ethrome-2025';
  terrainResumeToken++;
  const restoreReliefAfterArrival=!pauseRome&&terrainPausedForRome;
  if(pauseRome&&!terrainPausedForRome){terrainPausedForRome=true;syncTerrain();}
  if(historyMode!=='none'){
    const projectUrl=portfolioUrl(window.location.href,{eventSlug:event.slug,view});
    window.history[historyMode==='replace'?'replaceState':'pushState'](null,'',projectUrl);
  }
  if(imagery==='nasa')applyImagery('esa');
  closePopovers();
  const isHero=event.slug===HERO_VENUE_EVENT;
  const chapterId=ISOMETRIC_EVENT_REGIONS.get(event.slug)??null;
  const chapterCamera=event.slug==='decarbon-days-climathon-2025'
    ? COTTBUS_HANGAR_CAMERA : ISOMETRIC_CAMERA;
  isometricRegions.setFocus(chapterId);
  romeVenue.setFocus(event.slug);
  const isometricView=cityDetailOn&&!!chapterId;
  const romeView=cityDetailOn&&event.slug==='ethrome-2025';
  const localImage=hasBavariaDetail([event.coordinates.lng,event.coordinates.lat]);
  heroVenue.setActive(isHero);$('scan-button').hidden=!isHero;
  const drivable=driveStarts.has(event.slug);
  $('drive-button').hidden=!drivable;$('drive-button').disabled=!drivable;
  $('drive-button').title=drivable?'Start the curated Garching driving demo':'Driving prototype currently available at Garching only';
  renderJourney();
  // Never enlarge the global Sentinel mosaic several zoom levels beyond its
  // native z14 ceiling. Other cities need their own orthophoto chapter first.
  if(!skipFly){
  fly({center:isHero?HERO_VENUE_LOCATION:[event.coordinates.lng,event.coordinates.lat],
    zoom:isHero?20.23:isometricView?chapterCamera.zoom:romeView?17.45:localImage?16.4:13.8,
    pitch:isHero?68:isometricView?chapterCamera.pitch:romeView?55:localImage?67:55,
    bearing:isHero?285:isometricView?chapterCamera.bearing:romeView?38:-18,
      ...(showDetail?{offset:detailMapOffset()}:{})},{chronologyNavigation});
    if(restoreReliefAfterArrival)resumeTerrainAfterFlight();
    showEventDetail(event);
  }else if(restoreReliefAfterArrival)resumeTerrainAfterFlight();
  $('detail').hidden=!showDetail;
  status(`${getProject(event.slug)?.title??event.title} · ${event.venue} · ${event.coordinates.lat.toFixed(5)}°, ${event.coordinates.lng.toFixed(5)}°`);
}
function showEventDetail(event) {
  const root=$('detail');
  const isHero=event.slug===HERO_VENUE_EVENT;
  const scroll=detailPanel.render();
  const content=document.createElement('div');
  content.className='project-content-host';
  scroll.append(content);
  const project=renderProjectContent(content,event.slug,{onProjectLink:slug=>{
    const linked=orderedAchievements.find(candidate=>candidate.slug===slug);
    if(linked)selectEvent(linked,{showDetail:true});
  }});
  if(!project){
    const fallback=document.createElement('p');
    fallback.textContent='Project content is unavailable.';
    content.append(fallback);
  }
  if(isHero){
    const controls=document.createElement('div');
    controls.className='venue-views';controls.setAttribute('aria-label','Map views');
    controls.innerHTML='<button data-venue-view="campus" aria-pressed="false">3D CAMPUS</button><button data-venue-view="radar" aria-pressed="true">INSTALLATION</button>';
    scroll.insertBefore(controls,content);
  }
  scroll.scrollTop=0;
  bindDetail(root);
}
function bindDetail(root){
  root.querySelectorAll('[data-venue-view]').forEach(el=>el.addEventListener('click',()=>goHeroView(el.dataset.venueView)));
}

function goHeroView(view){
  if(activeEvent?.slug!==HERO_VENUE_EVENT)return;
  finishDrive();
  const isCampus=view==='campus';
  const offset=$('detail').hidden?{}:{offset:detailMapOffset()};
  fly(isCampus
    ?{center:[11.666954,48.262269],zoom:16.25,pitch:62,bearing:285,...offset}
    :{center:HERO_VENUE_LOCATION,zoom:20.23,pitch:68,bearing:285,...offset});
  document.querySelectorAll('[data-venue-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.venueView===view)));
  status(isCampus
    ?'Garching campus · real Bavarian LoD2 volumes with official aerial-photo roof textures. Select Installation to approach.'
    :'Protective Radar · a metre-scale field object on official orthophoto.');
}

function activateScan(){
  if(!canScan()){
    status(map.getZoom()<19.5
      ? 'Choose the Installation view and approach the radar before scanning.'
      :drive.active
        ? 'Return within 35 m of the Garching installation before scanning.'
        : 'Center the camera near the Garching installation before scanning.');
    return;
  }
  if(!heroVenue.triggerScan())status('The installation is not ready to scan yet.');
}

function canScan(){
  if(activeEvent?.slug!==HERO_VENUE_EVENT||map.getZoom()<19.5)return false;
  const location=drive.active?drive.position:[map.getCenter().lng,map.getCenter().lat];
  return distanceMetres(location,HERO_VENUE_LOCATION)<=(drive.active?35:75);
}
function updateScanAvailability(){
  const available=canScan();
  const button=$('scan-button');
  if(button.disabled===available)button.disabled=!available;
  const hint=available
    ?'Activate the Protective Radar installation'
    :map.getZoom()<19.5?'Approach the installation to scan'
      :drive.active?'Drive back within 35 m of the installation to scan':'Move the camera near the installation to scan';
  if(button.title!==hint)button.title=hint;
}

function makeMarker({location,label,count,type,cityKey,onClick}) {
  const el=document.createElement('button');el.type='button';el.className=`map-marker ${type}`;
  el.innerHTML=`<span class="marker-core"></span><span class="marker-label">${safeHtml(label)}</span>${count>1?`<span class="marker-count">${count}</span>`:''}`;
  el.title=label;
  el.addEventListener('click',onClick);
  const marker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat(location);
  markers.push({marker,el,type,location,label,count,cityKey,attached:false});
}
function initializeMarkers(){
  const eastAsia=cities.filter(c=>c.city==='Hong Kong'||c.city==='Nara');
  const europe=cities.filter(c=>!eastAsia.includes(c));
  for(const [group,label,zoom] of [[europe,'EUROPE',4.55],[eastAsia,'EAST ASIA',4.15]]){
    const center=geographicCentroid(group);
    makeMarker({location:center,label,count:group.reduce((n,c)=>n+c.events.length,0),type:'region',
      onClick:()=>fly({center,zoom,pitch:25,bearing:0})});
  }
  for(const country of countries){
    const center=geographicCentroid(country.cities);
    const lngs=country.cities.map(city=>city.lng);
    const lats=country.cities.map(city=>city.lat);
    const bounds=[[Math.min(...lngs),Math.min(...lats)],[Math.max(...lngs),Math.max(...lats)]];
    makeMarker({location:center,label:country.name.toUpperCase(),count:country.count,type:'country',
      onClick:()=>{
        const fitted=map.cameraForBounds(bounds,{padding:{top:100,bottom:185,left:95,right:95},maxZoom:7});
        fly({center:fitted?.center??center,zoom:Math.max(MARKER_ZOOM.countryToCity,fitted?.zoom??MARKER_ZOOM.countryToCity),pitch:0,bearing:0});
      }});
  }
  for(const city of cities)makeMarker({location:[city.lng,city.lat],label:city.city.toUpperCase(),count:city.events.length,type:'city',cityKey:city.key,onClick:()=>selectCity(city)});
  updateMarkerVisibility();
}
function updateMarkerVisibility(){
  const level=markerLevelForZoom(map.getZoom());
  const bounds=map.getBounds();
  let acceptedCityIds=null;
  if(level==='city'){
    const candidates=markers.filter(item=>item.type==='city'&&bounds.contains(item.location)).map(item=>{
      const point=map.project(item.location);
      return {id:item.cityKey,x:point.x,y:point.y,
        width:Math.max(94,item.label.length*8+45),height:34,
        priority:activeCity?.key===item.cityKey?1000:item.count};
    }).filter(candidate=>Number.isFinite(candidate.x)&&Number.isFinite(candidate.y));
    acceptedCityIds=new Set(declutterMarkers(candidates,{padding:8}).map(candidate=>candidate.id));
  }
  for(const item of markers){
    const shouldAttach=item.type===level&&bounds.contains(item.location)
      &&(level!=='city'||acceptedCityIds.has(item.cityKey));
    // Do not leave hidden far-away DOM markers attached: MapLibre can sample DEM
    // outside its valid tile while projecting them during a high-zoom drive.
    if(shouldAttach&&!item.attached){item.marker.addTo(map);item.attached=true;}
    else if(!shouldAttach&&item.attached){item.marker.remove();item.attached=false;}
    item.el.classList.toggle('selected',item.cityKey===activeCity?.key);
  }
}

function initializeEventLayers(){
  const geo={type:'FeatureCollection',features:achievements.map(e=>({type:'Feature',geometry:{type:'Point',coordinates:[e.coordinates.lng,e.coordinates.lat]},properties:{slug:e.slug,title:e.title}}))};
  map.addSource('achievements',{type:'geojson',data:geo});
  map.addLayer({id:'achievement-halo',type:'circle',source:'achievements',minzoom:MARKER_ZOOM.cityToAchievement,paint:{'circle-radius':['interpolate',['linear'],['zoom'],10,7,16,15],'circle-color':'#f4d298','circle-opacity':0.17,'circle-blur':0.25}},'earth-engine-car');
  map.addLayer({id:'achievement-points',type:'circle',source:'achievements',minzoom:MARKER_ZOOM.cityToAchievement,paint:{'circle-radius':['interpolate',['linear'],['zoom'],10,3,16,6],'circle-color':'#ead6af','circle-stroke-color':'#222d31','circle-stroke-width':2,'circle-opacity':0.98}},'earth-engine-car');
  map.on('mouseenter','achievement-points',()=>{map.getCanvas().style.cursor='pointer'});
  map.on('mouseleave','achievement-points',()=>{map.getCanvas().style.cursor=''});
  map.on('click','achievement-points',(e)=>{
    const hits=[...new Set(map.queryRenderedFeatures(e.point,{layers:['achievement-points']}).map(f=>f.properties?.slug).filter(Boolean))];
    if(hits.length){
      const event=orderedAchievements.find(candidate=>hits.includes(candidate.slug));
      if(event)selectEvent(event,{showDetail:true});
    }
  });
}

function showWholeEarth({historyMode='push'}={}){
  finishDrive();activeCity=null;$('detail').hidden=true;
  terrainResumeToken++;
  const restoreReliefAfterArrival=terrainPausedForRome;
  isometricRegions.setFocus(null);
  romeVenue.setFocus(null);
  $('drive-button').hidden=true;$('drive-button').disabled=true;
  heroVenue.setActive(false);$('scan-button').hidden=true;
  closePopovers();fly(initialCamera);
  if(restoreReliefAfterArrival)resumeTerrainAfterFlight();
  status('Whole Earth. The chronology remains on the selected achievement.');
  if(historyMode!=='none'){
    const url=portfolioUrl(window.location.href,{eventSlug:activeEvent?.slug,view:'world'});
    window.history[historyMode==='replace'?'replaceState':'pushState'](null,'',url);
  }
}
$('world-button').addEventListener('click',()=>showWholeEarth());
function applyImagery(next){
  if(PUBLIC_RELEASE&&next==='eox')return;
  if(next==='nasa')finishDrive();
  imagery=next;
  map.setMaxZoom(imagery==='nasa'?8:DETAIL_MAX_ZOOM);
  if(!PUBLIC_RELEASE)map.setLayoutProperty('sentinel-imagery','visibility',imagery==='eox'?'visible':'none');
  map.setLayoutProperty('esa-imagery','visibility',imagery==='esa'?'visible':'none');
  map.setLayoutProperty('nasa-imagery','visibility',imagery==='nasa'||imagery==='esa'?'visible':'none');
  map.setLayoutProperty('bavaria-imagery','visibility',imagery!=='nasa'?'visible':'none');
  map.setLayoutProperty('berlin-imagery','visibility',imagery!=='nasa'?'visible':'none');
  document.querySelectorAll('[data-imagery]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.imagery===imagery)));
  updateCredits();
  if(imagery==='nasa'&&map.getZoom()>8)fly({center:map.getCenter(),zoom:8,pitch:50,bearing:map.getBearing()});
  status(imagery==='eox'
    ?'EOX Sentinel‑2 2024 · 10 m source, local research only under non-commercial license.'
    :imagery==='esa'
      ?'ESA WorldCover 2021 · open 10 m Sentinel composite over land, NASA underlay.'
      :'NASA Blue Marble 2004 · global overview only, detail capped at about 500 m/pixel.');
}
document.querySelectorAll('[data-imagery]').forEach(button=>button.addEventListener('click',()=>applyImagery(button.dataset.imagery)));
$('terrain-toggle').addEventListener('click',()=>{
  terrainOn=!terrainOn;syncTerrain();
});
$('city-detail-toggle').addEventListener('click',()=>{
  cityDetailOn=!cityDetailOn;
  isometricRegions.setEnabled(cityDetailOn);
  romeVenue.setEnabled(cityDetailOn);
  $('city-detail-toggle').setAttribute('aria-pressed',String(cityDetailOn));
  $('city-detail-state').textContent=cityDetailOn?'ON':'OFF';
  updateCredits();
  status(cityDetailOn
    ?'City detail enabled: official LoD2 in Munich, Berlin and Cottbus; source-audited illustrative venue massing in Rome.'
    :'3D city detail hidden; the real aerial imagery remains.');
});
$('zoom-in').addEventListener('click',()=>map.zoomIn());
$('zoom-out').addEventListener('click',()=>map.zoomOut());
$('drive-button').addEventListener('click',()=>drive.active?finishDrive():startDrive());
$('drive-camera-toggle').addEventListener('click',toggleDriveCamera);
$('scan-button').addEventListener('click',activateScan);

function startDrive(){
  const e=activeEvent;
  if(!e||!driveStarts.has(e.slug))return;
  if(imagery==='nasa')applyImagery('esa');
  const start=driveStarts.get(e.slug);
  drive.position=start?.position.slice()??[e.coordinates.lng,e.coordinates.lat];
  drive.heading=start?.heading??0;drive.speed=0;drive.active=true;drive.last=performance.now();drive.geofenceWarned=false;
  syncTerrain();
  drive.cameraMode='chase';updateDriveCameraButton();
  physicsState=createDrivingState({position:drive.position,heading:drive.heading,origin:drive.position});
  drive.cameraHeading=drive.heading;
  const camera=driveCamera();
  drive.cameraCenter=stepPosition(drive.position,drive.heading,camera.lookahead);
  drive.cameraZoom=camera.zoom;drive.cameraPitch=camera.pitch;
  map.setLayoutProperty('achievement-halo','visibility','none');
  map.setLayoutProperty('achievement-points','visibility','none');
  $('app').classList.add('drive-active');
  $('drive-hud').hidden=false;$('drive-button').classList.add('active');$('drive-button').querySelector('span').textContent='EXIT DRIVE';
  map.dragPan.disable();map.scrollZoom.disable();map.dragRotate.disable();map.touchZoomRotate.disable();
  fly({center:drive.cameraCenter,zoom:camera.zoom,pitch:camera.pitch,bearing:drive.cameraHeading});
  status('Local drive: real metre-scale vehicle. Close-range imagery and road assets remain a production art/data task.');
  updateScanAvailability();
  requestAnimationFrame(tickDrive);
}
function tickDrive(now){
  if(!drive.active)return;
  const before=physicsState;
  physicsState=stepDriving(physicsState,drivingInputFromKeys(drive.keys),(now-drive.last)/1000);
  drive.last=now;
  drive.position=physicsState.position;drive.heading=physicsState.heading;drive.speed=physicsState.speed;
  updateScanAvailability();
  const camera=driveCamera();
  const cameraTarget=stepPosition(drive.position,drive.heading,camera.lookahead);
  const cameraAlpha=1-Math.exp(-physicsState.integratedSeconds*5);
  drive.cameraCenter=[
    drive.cameraCenter[0]+(cameraTarget[0]-drive.cameraCenter[0])*cameraAlpha,
    drive.cameraCenter[1]+(cameraTarget[1]-drive.cameraCenter[1])*cameraAlpha
  ];
  const angleDelta=((drive.heading-drive.cameraHeading+540)%360)-180;
  drive.cameraHeading=(drive.cameraHeading+angleDelta*cameraAlpha+360)%360;
  drive.cameraZoom+=(camera.zoom-drive.cameraZoom)*cameraAlpha;
  drive.cameraPitch+=(camera.pitch-drive.cameraPitch)*cameraAlpha;
  $('speed').textContent=String(Math.round(Math.abs(drive.speed)*3.6));
  if(physicsState.geofenceLimited&&!drive.geofenceWarned){
    drive.geofenceWarned=true;
    status('Local drive boundary ahead. Steer inward or reverse to stay inside the curated chapter.');
  }
  const cameraSettling=Math.abs(cameraTarget[0]-drive.cameraCenter[0])>1e-9
    ||Math.abs(cameraTarget[1]-drive.cameraCenter[1])>1e-9||Math.abs(angleDelta)>0.005
    ||Math.abs(camera.zoom-drive.cameraZoom)>0.001||Math.abs(camera.pitch-drive.cameraPitch)>0.01;
  if(before.position[0]!==drive.position[0]||before.position[1]!==drive.position[1]||before.heading!==drive.heading||cameraSettling){
    map.jumpTo({center:drive.cameraCenter,zoom:drive.cameraZoom,pitch:drive.cameraPitch,bearing:drive.cameraHeading});
    map.triggerRepaint();
  }
  requestAnimationFrame(tickDrive);
}
window.addEventListener('keydown',e=>{
  const key=e.key.toLowerCase();
  if(e.key==='Escape'){
    finishDrive();closePopovers();$('detail').hidden=true;
  }
  if(drive.active&&key==='c'&&!e.repeat&&!e.metaKey&&!e.ctrlKey&&!e.altKey
    &&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement)){
    toggleDriveCamera();e.preventDefault();return;
  }
  if(drive.active&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){
    drive.keys.add(key);e.preventDefault();
  }
});
window.addEventListener('keyup',e=>drive.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>drive.keys.clear());
for(const button of document.querySelectorAll('[data-drive-key]')){
  const key=button.dataset.driveKey;
  button.addEventListener('pointerdown',e=>{drive.keys.add(key);button.setPointerCapture(e.pointerId);e.preventDefault();});
  const release=()=>drive.keys.delete(key);
  button.addEventListener('pointerup',release);
  button.addEventListener('pointercancel',release);
  button.addEventListener('lostpointercapture',release);
}

let mapReady=false;
map.on('style.load',()=>{
  map.setProjection({type:'globe'});
  map.addLayer(bavariaBuildings);
  map.addLayer(isometricRegions);
  map.addLayer(carLayer);
  map.addLayer(heroVenue);
  romeVenue.onAdd(map);
  initializeEventLayers();
  initializeMarkers();
  mapReady=true;
  const event=orderedAchievements.find(candidate=>candidate.slug===initialRoute.eventSlug)
    ??(initialRoute.view?orderedAchievements[0]:null);
  const cvRoute=initialRoute.view==='cv';
  if(event)selectEvent(event,{showDetail:!initialRoute.view,historyMode:'replace',view:initialRoute.view,skipFly:cvRoute});
  else status('Whole Earth. Choose an achievement to begin.');
  if(initialRoute.view==='world')showWholeEarth({historyMode:'none'});
  if(initialRoute.view==='cv'){
    openCvView({mapFocusSkipped:true});
    if(initialRoute.downloadCv)$('cv-download').click();
  }
  const signalReady=()=>window.dispatchEvent(new Event('earth-ready'));
  if(map.loaded())signalReady();
  else map.once('load',signalReady);
});
function restorePortfolioRoute(){
  if(!mapReady)return;
  const route=readPortfolioRoute(window.location.href,knownSlugs);
  if(shouldShowIntro(window.location.href)){
    refocusAfterCv=false;
    if(cvView.isOpen())cvView.close();
    activeEvent=null;activeCity=null;renderJourney();
    showWholeEarth({historyMode:'none'});
    status('Whole Earth. Choose an achievement to begin.');
    return;
  }
  const event=orderedAchievements.find(candidate=>candidate.slug===route.eventSlug)??orderedAchievements[0];
  if(route.view==='cv'){
    selectEvent(event,{showDetail:false,historyMode:'none',skipFly:true});
    if(!cvView.isOpen())openCvView({mapFocusSkipped:true});
  }else{
    refocusAfterCv=false;
    if(cvView.isOpen())cvView.close();
    selectEvent(event,{showDetail:route.view!=='world',historyMode:'none'});
    if(route.view==='world')showWholeEarth({historyMode:'none'});
  }
}
window.addEventListener('popstate',restorePortfolioRoute);
window.addEventListener('hashchange',restorePortfolioRoute);
map.on('zoom',()=>{
  updateMarkerVisibility();
  updateCredits();
  updateScanAvailability();
});
map.on('move',()=>{updateScanAvailability();updateMarkerVisibility();});
map.on('moveend',updateCredits);
let lastError=0;
map.on('error',e=>{
  const now=Date.now();if(now-lastError<2000)return;lastError=now;
  console.warn('Earth tile/render issue:',e.error||e);
  status('A terrain or imagery tile did not load. Check the network; other tiles continue to render.');
});
window.__earthEngine={map,cities,achievements,selectCity,selectEvent,drive,heroVenue,isometricRegions,romeVenue};
