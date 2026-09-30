import imagery from './data/destinationOrthophotos.json' with {type:'json'};
import {arrivalPlanForEvent,landingPlanForEvent} from './arrivalImagery.js';

const EARTH = 40075016.68557849;
const asset = url => `/${url.replace(/^\//,'')}`;
const assert = (ok,message) => {if(!ok)throw new Error(message);};
export const destinationImagery = imagery;
export function destinationPatch(slug,{reduced=false}={}) {
  const patch=imagery.patches[imagery.events[slug]];
  if(!patch)return null;
  const selected=reduced ? {...patch,...patch.mobile} : patch;
  return {...selected,url:asset(selected.url)};
}

/** Real sampling, not a texture-size promise: reject malformed/upscaled assets. */
export function validateDestinationLandings(manifest) {
  assert(manifest?.schema===1&&manifest.events&&manifest.landings,'Invalid destination imagery manifest');
  for(const patch of Object.values(manifest.landings)) {
    assert(/^\/assets\/(?:destination-orthophotos\/ortho-[a-z0-9-]+-(?:2048|1024)-[a-f0-9]{12,64}|isometric\/tesla-gigafactory-ground-truedop20-v1(?:-half)?)\.webp$/.test(patch.url),'Destination imagery must be a pinned local asset');
    assert(Number.isInteger(patch.bytes)&&patch.bytes>0&&patch.bytes<=4_000_000
      &&[1024,2048].includes(patch.width)&&patch.height===patch.width,'Destination image exceeds transfer/decode budget');
    assert(Number.isFinite(patch.resolutionM)&&patch.resolutionM>0&&patch.resolutionM<=1.5
      &&typeof patch.source?.attribution==='string'&&patch.source.attribution.length>0
      &&/^https:\/\//.test(patch.source.url)&&typeof patch.source.license==='string'
      &&patch.source.license.length>0,'Destination image requires true resolution and provenance');
    const corners=patch.coordinates;
    assert(Array.isArray(corners)&&corners.length===4&&corners.every(pair=>Array.isArray(pair)
      &&pair.length===2&&pair.every(Number.isFinite)&&Math.abs(pair[0])<=180&&Math.abs(pair[1])<85),'Invalid destination image bounds');
    const [nw,ne,se,sw]=corners;
    assert(ne[0]>nw[0]&&nw[1]>sw[1]&&nw[0]===sw[0]&&ne[0]===se[0]
      &&nw[1]===ne[1]&&sw[1]===se[1],'Destination image must be an unwarped geographic rectangle');
    const latitude=(nw[1]+sw[1])/2;
    const sampling=(ne[0]-nw[0])/360*EARTH*Math.cos(latitude*Math.PI/180)/patch.width;
    assert(sampling<=patch.resolutionM*1.08&&sampling>=patch.resolutionM*.92,'Image sampling disagrees with its geographic extent');
  }
  for(const key of Object.values(manifest.events))assert(Object.hasOwn(manifest.landings,key),'Missing destination image');
  return manifest;
}
export function destinationLandingManifest(options={}) {
  return validateDestinationLandings({schema:1,events:imagery.events,
    landings:Object.fromEntries(Object.entries(imagery.patches).map(([key,patch])=>[
      key,destinationPatch(Object.keys(imagery.events).find(slug=>imagery.events[slug]===key),options)
    ]))});
}

/** A photo pixel occupies at most 1.5 CSS pixels on arrival, not a z17.8 blur. */
export function destinationCamera(event,{reduced=false}={}) {
  const patch=destinationPatch(event.slug,{reduced});
  if(!patch)return {zoom:13.8,pitch:43,bearing:42};
  const center=patch.camera?.center??[event.coordinates.lng,event.coordinates.lat];
  const nativeZoom=Math.log2(EARTH*Math.cos(center[1]*Math.PI/180)/(512*patch.resolutionM));
  return {...(patch.camera??{}),center,
    zoom:Math.min(patch.camera?.zoom??16.8,nativeZoom+Math.log2(1.5)),
    pitch:patch.camera?.pitch??49,bearing:patch.camera?.bearing??42};
}
export function qualityPlanForEvent(slug) {
  const patch=destinationPatch(slug);
  return patch?[{key:`orthophoto/${imagery.events[slug]}/full`,url:patch.url,bytes:patch.bytes}]
    :landingPlanForEvent(slug);
}
/** Inactive cities remain encoded. Phones prewarm small previews but selected
 * destinations ALWAYS use full native photos (except <=2 GB explicit tier). */
export function allQualityPreparationPlan(events,{mobile=false}={}) {
  const plan=[...events.slice(0,3).flatMap(event=>qualityPlanForEvent(event.slug)),
    ...events.flatMap(event=>{
      const patch=destinationPatch(event.slug,{reduced:mobile});
      return patch?[{key:`orthophoto/${imagery.events[event.slug]}/${mobile?'half':'full'}`,url:patch.url,bytes:patch.bytes}]:landingPlanForEvent(event.slug);
    }),...events.flatMap(event=>arrivalPlanForEvent(event.slug,{overviewOnly:true}))];
  const seen=new Set();
  return plan.filter(item=>{const key=item.url??`${item.z}/${item.x}/${item.y}`;
    if(seen.has(key))return false;seen.add(key);return true;});
}
export function destinationAssetBudget() {
  const patches=Object.values(imagery.patches);
  return {destinations:Object.keys(imagery.events).length,patches:patches.length,
    bytes:patches.reduce((total,patch)=>total+patch.bytes,0),
    previewBytes:patches.reduce((total,patch)=>total+patch.mobile.bytes,0),
    maxActiveDecodedRgbaBytes:2048*2048*4,unsupported:Object.keys(imagery.missing)};
}
