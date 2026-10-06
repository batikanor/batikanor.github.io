import * as THREE from 'three';
import {getExhibitGameSignContent} from './exhibitGameSignContent.js';

const PANEL_WIDTH_PX=1024;
const PANEL_HEIGHT_PX=640;
export const ACHIEVEMENT_SIGN_FACE=Object.freeze({widthM:3.3,heightM:1.85});
export const ACHIEVEMENT_GAME_SIGN_POSITIONS=Object.freeze([
  Object.freeze([-8.55,3.4,.6]),Object.freeze([8.55,3.4,.6]),
]);
const PANEL_WIDTH_M=ACHIEVEMENT_SIGN_FACE.widthM;
const PANEL_HEIGHT_M=ACHIEVEMENT_SIGN_FACE.heightM;
const MAX_ITEMS=12;
const MAX_ITEM_CHARS=120;
const GOLD='#e3c084';
const INK='#112227';
const PAPER='#f5f3eb';
const PRINT_FONT='Arial, Helvetica, sans-serif';
const PRINT_FONT_SIZE=85;
const PRINT_FONT_MIN_SIZE=72;
export const ACHIEVEMENT_SIGN_GLYPH_HEIGHT_PX=92;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const assert=(condition,message)=>{if(!condition)throw new TypeError(message);};

/** Plain authored prose only: no embed markers, media, URL destinations or code. */
export function authoredSignProse(markdown) {
  assert(typeof markdown==='string','Achievement sign prose must come from the authored project');
  return markdown
    .replace(/```[\s\S]*?```/g,'')
    .replace(/<(iframe|video|audio|script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'')
    .replace(/<(img|source)\b[^>]*>/gi,'')
    .replace(/\{\{[\s\S]*?\}\}/g,'')
    .replace(/!\[[^\]]*\]\([^\n]*?\)(?:\{[^}]*\})?/g,'')
    .replace(/\[([^\]]+)\]\((?:[^()\n]|\([^()\n]*\))*\)/g,'$1')
    .replace(/^\s*https?:\/\/\S+\s*$/gm,'')
    .replace(/<br\s*\/?\s*>/gi,'\n')
    .replace(/<[^>]+>/g,'')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/gm,'')
    .replace(/\*\*([^*]+)\*\*/g,'$1')
    .replace(/__([^_]+)__/g,'$1')
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g,'$1')
    .replace(/`([^`]+)`/g,'$1')
    .replace(/&(?:amp|lt|gt|quot|apos|#39);/g,entity=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&#39;':"'"}[entity]))
    .split(/\n\s*\n/)
    .map(paragraph=>paragraph.replace(/\s+/g,' ').trim())
    .filter(Boolean)
    .join('\n\n');
}

function noteItems(items) {
  assert(Array.isArray(items)&&items.length<=MAX_ITEMS,'Monitor notes require at most twelve items per panel');
  return Object.freeze(items.map(item=>{
    assert(typeof item==='string'&&item.trim().length>0&&item===item.trim()
      &&item.length<=MAX_ITEM_CHARS&&!/[\r\n<>]|https?:\/\/|\{\{/.test(item),
    'Monitor items must be short, plain text from the project source data');
    return item;
  }));
}

/** Explicit source-data notes; never truncate/repeat a project paragraph/title. */
export function selectAchievementSignContent(project) {
  assert(project && typeof project.slug==='string' && typeof project.title==='string'
    && project.title.trim().length>0,'Achievement signs need an authored project title');
  const title=authoredSignProse(project.title).replace(/\n\n/g,' ');
  // New projects without curated notes get only existing technology tags.
  // No on-device summarizer, invented claim, title or paragraph fallback.
  const curated=project.exhibitNotes!=null;
  const technologies=curated?[]:[...new Set((Array.isArray(project.technologies)?project.technologies:[])
    .filter(item=>typeof item==='string').map(item=>item.trim())
    .filter(item=>item.length>0&&item.length<=MAX_ITEM_CHARS&&item!==title
      &&!/[\r\n<>]|https?:\/\/|\{\{/.test(item)))].slice(0,MAX_ITEMS*2);
  const split=Math.ceil(technologies.length/2);
  const summaryItems=noteItems(curated?project.exhibitNotes.overview:technologies.slice(0,split));
  const detailItems=noteItems(curated?project.exhibitNotes.details:technologies.slice(split));
  return Object.freeze({slug:project.slug,title,summaryItems,detailItems,
    summary:summaryItems.join('\n'),detail:detailItems.join('\n'),mode:'itemized',
    source:curated?'portfolio-exhibit-notes':'portfolio-technologies',
    summarySource:curated?'exhibitNotes.overview':'technologies',detailSource:curated?'exhibitNotes.details':'technologies',
    summaryTruncated:false,detailTruncated:false});
}

function createPanelCanvas(content,{canvasFactory,document:doc,mirrorU=true}) {
  const canvas=canvasFactory?canvasFactory(PANEL_WIDTH_PX,PANEL_HEIGHT_PX):doc?.createElement('canvas');
  assert(canvas && typeof canvas.getContext==='function','Achievement signs require a native 2D canvas');
  let texture=null;
  try {
  canvas.width=PANEL_WIDTH_PX;canvas.height=PANEL_HEIGHT_PX;
  const context=canvas.getContext('2d');assert(context,'Achievement sign canvas 2D context unavailable');
  const lines=[...(content.title?[content.title]:[]),...content.lines];
  assert(lines.length>0&&lines.length<=6,'Printed game signs require at most six complete lines');
  const layout={label:content.title,canvasWidth:canvas.width,canvasHeight:canvas.height,overflow:false,compact:false};
  context.fillStyle=INK;context.fillRect(0,0,canvas.width,canvas.height);
  context.strokeStyle=GOLD;context.lineWidth=12;context.strokeRect(18,18,canvas.width-36,canvas.height-36);
  context.textBaseline='alphabetic';context.textAlign='center';
  // All words are printed on the physical face. Preserve the requested
  // one-third ink height rather than omitting rules on small viewports.
  const width=canvas.width-88;
  let fontSize=PRINT_FONT_SIZE;
  while(true){
    if(lines.every((line,index)=>{
      context.font=`${content.title&&index===0?'bold ':''}${fontSize}px ${PRINT_FONT}`;
      return context.measureText(line).width<=width;
    }))break;
    assert(fontSize>PRINT_FONT_MIN_SIZE,'Printed game sign text does not fit its physical face');
    fontSize=Math.max(PRINT_FONT_MIN_SIZE,fontSize-1);
  }
  const height=ACHIEVEMENT_SIGN_GLYPH_HEIGHT_PX,gap=lines.length===6?6:16;
  const top=(canvas.height-(lines.length*height+(lines.length-1)*gap))/2;
  layout.fontSize=fontSize;layout.lines=lines;
  layout.fontWidthRatio=fontSize/canvas.width;
  layout.glyphBounds=lines.map((line,index)=>{
    const font=`${content.title&&index===0?'bold ':''}${fontSize}px ${PRINT_FONT}`;
    context.font=font;
    const metrics=context.measureText(line);
    const ascent=metrics.actualBoundingBoxAscent??fontSize*.72,descent=metrics.actualBoundingBoxDescent??fontSize*.18;
    const scaleY=height/Math.max(1,ascent+descent),rowTop=top+index*(height+gap);
    return {text:line,font,width:metrics.width,top:rowTop,bottom:rowTop+height,
      scaleY,baseline:rowTop+ascent*scaleY};
  });
  for(const [index,glyph] of layout.glyphBounds.entries()){
    context.font=glyph.font;context.fillStyle=content.title&&index===0?GOLD:PAPER;
    context.save?.();context.scale?.(1,glyph.scaleY);
    context.fillText(glyph.text,canvas.width/2,glyph.baseline/glyph.scaleY);
    context.restore?.();
  }
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  // The mapped local basis is east/up/north (left-handed). A camera-facing
  // panel's local +X projects opposite MapLibre screen-right. Reverse U only;
  // retain CanvasTexture's normal Y flip so native text stays upright.
  if(mirrorU){texture.repeat.x=-1;texture.offset.x=1;}
  texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  return {texture,layout};
  } catch(error) {
    texture?.dispose();if(texture)texture.image=null;
    canvas.width=canvas.height=0;
    throw error;
  }
}

/**
 * Two printed, non-interactive game signs surrounding the exhibit.
 * Heads face the public camera bearing; their poles never billboard or move.
 * The parent must collect this group's userData.textures/materials for disposal,
 * or traverse those arrays in disposeAchievementScene. No image/remote font/API.
 */
export function createAchievementSigns(project,{canvasFactory=null,document:doc=globalThis.document,bearing=42,pitch=54,mirrorU=true,
  positions=ACHIEVEMENT_GAME_SIGN_POSITIONS,baseY=0,panelWidthM=PANEL_WIDTH_M,panelHeightM=PANEL_HEIGHT_M,exhibitScale=1}={}) {
  const content=selectAchievementSignContent(project);
  const gameContent=getExhibitGameSignContent(project.slug);
  assert(gameContent?.panels?.length===2,'Printed game signs require a known exhibit game');
  assert(typeof mirrorU==='boolean','Achievement sign UV orientation must be explicit');
  assert(positions.length===2&&positions.every(position=>Array.isArray(position)&&position.length===3
    &&position.every(Number.isFinite)&&position[1]>baseY),'Achievement signs require two supported panel positions');
  assert(Number.isFinite(baseY)&&Number.isFinite(panelWidthM)&&panelWidthM>0&&Number.isFinite(panelHeightM)&&panelHeightM>0
    &&Number.isFinite(exhibitScale)&&exhibitScale>0,'Achievement sign dimensions must be finite and positive');
  const group=new THREE.Group();group.name=`Printed game signs · ${content.slug}`;
  const backs=new THREE.MeshBasicMaterial({color:0x182c30,toneMapped:false,transparent:true,opacity:0,depthWrite:false});
  const poles=new THREE.MeshStandardMaterial({color:0xbba16f,metalness:.35,roughness:.65,transparent:true,opacity:0,depthWrite:false});
  const poleGeometry=new THREE.CylinderGeometry(.075,.095,2.7,8);
  const poleMesh=new THREE.InstancedMesh(poleGeometry,poles,2);poleMesh.frustumCulled=false;
  const dummy=new THREE.Object3D();const panels=[],textures=[],materials=[backs,poles];
  try {
  for(let i=0;i<2;i++) {
    const printed=gameContent.panels[i],items=printed.lines,label=printed.title;
    const {texture,layout}=createPanelCanvas(printed,{canvasFactory,document:doc,mirrorU});
    textures.push(texture);
    const material=new THREE.MeshBasicMaterial({color:0xffffff,map:texture,side:THREE.FrontSide,
      toneMapped:false,transparent:true,opacity:0,depthWrite:false});materials.push(material);
    const head=new THREE.Group();head.position.set(...positions[i]);head.rotation.order='YXZ';
    const back=new THREE.Mesh(new THREE.BoxGeometry(panelWidthM+.12,panelHeightM+.12,.13),backs);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(panelWidthM,panelHeightM),material);
    // Paint supports first, then the board and its face: no pole through prose.
    back.renderOrder=1;plane.renderOrder=2;
    plane.position.z=.071;plane.frustumCulled=back.frustumCulled=false;head.add(back,plane);group.add(head);
    const poleHeight=positions[i][1]-baseY;
    dummy.position.set(positions[i][0],baseY+poleHeight/2,positions[i][2]);dummy.scale.set(1,poleHeight/2.7,1);
    dummy.updateMatrix();poleMesh.setMatrixAt(i,dummy.matrix);
    panels.push({head,plane,material,layout,label,items,text:printed.text,kind:printed.kind});
  }
  poleMesh.instanceMatrix.needsUpdate=true;group.add(poleMesh);
  group.userData.content=content;group.userData.panels=panels;group.userData.textures=textures;
  group.userData.gameContent=gameContent;
  group.userData.materials=materials;group.userData.authored=true;
  group.userData.texturePixels=2*PANEL_WIDTH_PX*PANEL_HEIGHT_PX;
  group.userData.textureBytes=group.userData.texturePixels*4;
  group.userData.triangles=92;group.userData.drawCalls=5;
  group.userData.exhibitScale=exhibitScale;
  updateAchievementSigns(group,{zoom:0,distanceM:Infinity,bearing,pitch});
  return group;
  } catch(error) {
    // A native canvas can be unavailable under browser GPU/memory pressure.
    // Construction is transactional: a failure on panel two must not retain
    // panel one's decoded pixels, materials, geometries or instance buffers.
    const geometries=new Set([poleGeometry]);
    group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);});
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(material=>material.dispose());poleMesh.dispose();
    textures.forEach(texture=>{
      texture.dispose();
      if(texture.image)texture.image.width=texture.image.height=0;
      texture.image=null;
    });
    group.clear();throw error;
  }
}

/** Camera-event LOD changes opacity and orientation without repainting words. */
export function updateAchievementSigns(group,{zoom,distanceM,visible=false,bearing=42,pitch=54}={}) {
  assert(group?.userData?.panels && Number.isFinite(zoom) && (Number.isFinite(distanceM)||distanceM===Infinity),
    'Achievement sign LOD requires its group and public camera measurements');
  // A four-times-larger installation is legible two zoom steps farther out.
  // Use the same two textures; scaling never redraws or upsizes their canvases.
  const scale=group.userData.exhibitScale??1,effectiveZoom=zoom+Math.log2(scale),effectiveDistance=distanceM/scale;
  const on=!!visible && effectiveZoom>=17 && effectiveDistance<=220;
  const opacity=on?clamp((effectiveZoom-17)/.85,0,1)*clamp((220-effectiveDistance)/80,0,1):0;
  const rotation=(Number.isFinite(bearing)?bearing:42)+180;
  const tilt=clamp(90-(Number.isFinite(pitch)?pitch:54),0,35);
  for(const panel of group.userData.panels){
    panel.head.rotation.y=rotation*Math.PI/180;panel.head.rotation.x=-tilt*Math.PI/180;
    panel.material.opacity=opacity;panel.material.depthWrite=opacity>=.99;
  }
  group.userData.materials[0].opacity=group.userData.materials[1].opacity=opacity;
  group.visible=on && opacity>0;
  const state=group.userData.signState??{};
  state.visible=group.visible;state.readable=group.visible&&effectiveZoom>=19.5&&effectiveDistance<=90;
  state.opacity=opacity;state.content=group.userData.content;
  group.userData.signState=state;
  return state;
}
