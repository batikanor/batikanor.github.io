import * as THREE from 'three';

const PANEL_WIDTH_PX=1024;
const PANEL_HEIGHT_PX=640;
const PANEL_WIDTH_M=6.8;
const PANEL_HEIGHT_M=4;
const MAX_SUMMARY_CHARS=150;
const MAX_DETAIL_CHARS=190;
const GOLD='#e3c084';
const INK='#112227';
const PAPER='#f5f3eb';
const TITLE_FONT='Georgia, "Times New Roman", serif';
const BODY_FONT='Arial, Helvetica, sans-serif';
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

/** A source prefix at a sentence/word boundary; no generated continuation. */
function sourceExcerpt(text,maxChars) {
  if(text.length<=maxChars)return text;
  const prefix=text.slice(0,maxChars);
  const sentenceEnds=[...prefix.matchAll(/[.!?](?=\s|$)/g)].map(match=>match.index+1);
  const lastSentence=sentenceEnds.at(-1);
  if(lastSentence>=Math.min(65,maxChars*.4))return prefix.slice(0,lastSentence);
  const boundary=prefix.lastIndexOf(' ');
  return prefix.slice(0,boundary>0?boundary:maxChars).trimEnd();
}

/** Read only the existing portfolio strings. No inferred theme/title/claim. */
export function selectAchievementSignContent(project) {
  assert(project && typeof project.slug==='string' && typeof project.title==='string'
    && project.title.trim().length>0,'Achievement signs need an authored project title');
  const title=authoredSignProse(project.title).replace(/\n\n/g,' ');
  const paragraphs=authoredSignProse(project.longDescription??'').split('\n\n').filter(Boolean);
  const short=authoredSignProse(project.shortDescription??'').replace(/\n\n/g,' ');
  const summarySource=short?'shortDescription':paragraphs.length?'longDescription':'title';
  const summary=sourceExcerpt(short||paragraphs[0]||title,MAX_SUMMARY_CHARS);
  const candidates=paragraphs.filter(text=>text.length>=50 && text!==short && text!==title
    && !/^https?:\/\//.test(text));
  // Deterministic source order, not an AI rewrite. A second panel avoids
  // repeating the summary when an original explanatory paragraph is available.
  const preferred=project.slug==='salzburg-tourism-2024'
    ?candidates.find(text=>/^(?:1\)\s+)?You use a Muse 2 headband\b/.test(text)):null;
  const detailedSource=preferred??candidates.find(text=>!text.startsWith(summary))??candidates[0]??(short||title);
  // Long original titles need more lines on the same fixed physical panel.
  const detail=sourceExcerpt(detailedSource,title.length>65?160:MAX_DETAIL_CHARS);
  return Object.freeze({slug:project.slug,title,summary,detail,source:'portfolio-authored',summarySource,detailSource:candidates.length?'longDescription':short?'shortDescription':'title',
    summaryTruncated:summary.length<(short||paragraphs[0]||title).length,detailTruncated:detail.length<detailedSource.length});
}

function wrappedLines(context,text,width) {
  const lines=[];let line='';
  for(const word of text.split(/\s+/)) {
    const next=line?`${line} ${word}`:word;
    if(line && context.measureText(next).width>width){lines.push(line);line=word;}
    else line=next;
  }
  if(line)lines.push(line);
  return lines;
}

function textLayout(context,text,{family,size,minSize,width,maxHeight,lineFactor=1.17}) {
  let fontSize=size,lines,lineHeight;
  do {
    context.font=`${fontSize}px ${family}`;
    lines=wrappedLines(context,text,width);lineHeight=Math.ceil(fontSize*lineFactor);
    if(lines.length*lineHeight<=maxHeight || fontSize<=minSize)break;
    fontSize-=2;
  } while(true);
  return {font:`${fontSize}px ${family}`,fontSize,lines,lineHeight,height:lines.length*lineHeight};
}

function createPanelCanvas(content,text,{canvasFactory,document:doc,truncated=false,mirrorU=true}) {
  const canvas=canvasFactory?canvasFactory(PANEL_WIDTH_PX,PANEL_HEIGHT_PX):doc?.createElement('canvas');
  assert(canvas && typeof canvas.getContext==='function','Achievement signs require a native 2D canvas');
  let texture=null;
  try {
  canvas.width=PANEL_WIDTH_PX;canvas.height=PANEL_HEIGHT_PX;
  const context=canvas.getContext('2d');assert(context,'Achievement sign canvas 2D context unavailable');
  context.fillStyle=INK;context.fillRect(0,0,canvas.width,canvas.height);
  context.strokeStyle=GOLD;context.lineWidth=5;context.strokeRect(12,12,canvas.width-24,canvas.height-24);
  context.fillStyle=GOLD;context.fillRect(66,58,88,5);
  context.textBaseline='top';context.textAlign='left';
  const title=textLayout(context,content.title,{family:TITLE_FONT,size:54,minSize:42,width:892,maxHeight:232});
  context.font=title.font;context.fillStyle=PAPER;
  title.lines.forEach((line,i)=>context.fillText(line,66,90+i*title.lineHeight));
  const bodyY=90+title.height+24;
  const body=textLayout(context,`${text}${truncated?'…':''}`,{family:BODY_FONT,size:56,minSize:42,width:892,maxHeight:canvas.height-bodyY-56});
  context.font=body.font;context.fillStyle=PAPER;
  body.lines.forEach((line,i)=>context.fillText(line,66,bodyY+i*body.lineHeight));
  texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  // The mapped local basis is east/up/north (left-handed). A camera-facing
  // panel's local +X projects opposite MapLibre screen-right. Reverse U only;
  // retain CanvasTexture's normal Y flip so native text stays upright.
  if(mirrorU){texture.repeat.x=-1;texture.offset.x=1;}
  texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
  return {texture,layout:{titleFontSize:title.fontSize,bodyFontSize:body.fontSize,bodyLines:body.lines.length,
    overflow:bodyY+body.height>canvas.height-36}};
  } catch(error) {
    texture?.dispose();if(texture)texture.image=null;
    canvas.width=canvas.height=0;
    throw error;
  }
}

/**
 * Two bounded native-font museum panels surrounding the illustrative exhibit.
 * Heads face the public camera bearing; their poles never billboard or move.
 * The parent must collect this group's userData.textures/materials for disposal,
 * or traverse those arrays in disposeAchievementScene. No image/remote font/API.
 */
export function createAchievementSigns(project,{canvasFactory=null,document:doc=globalThis.document,bearing=42,pitch=54,mirrorU=true}={}) {
  const content=selectAchievementSignContent(project);
  assert(typeof mirrorU==='boolean','Achievement sign UV orientation must be explicit');
  const group=new THREE.Group();group.name=`Authored project signs · ${content.slug}`;
  const backs=new THREE.MeshBasicMaterial({color:0x182c30,toneMapped:false,transparent:true,opacity:0,depthWrite:false});
  const poles=new THREE.MeshStandardMaterial({color:0xbba16f,metalness:.35,roughness:.65,transparent:true,opacity:0,depthWrite:false});
  const poleGeometry=new THREE.CylinderGeometry(.075,.095,2.7,8);
  const poleMesh=new THREE.InstancedMesh(poleGeometry,poles,2);poleMesh.frustumCulled=false;
  const dummy=new THREE.Object3D();const panels=[],textures=[],materials=[backs,poles];
  const positions=[[-7,2.7,-8],[7,2.7,-8]];
  try {
  for(let i=0;i<2;i++) {
    const {texture,layout}=createPanelCanvas(content,i===0?content.summary:content.detail,{canvasFactory,document:doc,
      truncated:i===0?content.summaryTruncated:content.detailTruncated,mirrorU});
    textures.push(texture);
    const material=new THREE.MeshBasicMaterial({color:0xffffff,map:texture,side:THREE.FrontSide,
      toneMapped:false,transparent:true,opacity:0,depthWrite:false});materials.push(material);
    const head=new THREE.Group();head.position.set(...positions[i]);head.rotation.order='YXZ';
    const back=new THREE.Mesh(new THREE.BoxGeometry(PANEL_WIDTH_M+.12,PANEL_HEIGHT_M+.12,.13),backs);
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(PANEL_WIDTH_M,PANEL_HEIGHT_M),material);
    // Paint supports first, then the board and its face: no pole through prose.
    back.renderOrder=1;plane.renderOrder=2;
    plane.position.z=.071;plane.frustumCulled=back.frustumCulled=false;head.add(back,plane);group.add(head);
    dummy.position.set(positions[i][0],1.35,positions[i][2]);dummy.updateMatrix();poleMesh.setMatrixAt(i,dummy.matrix);
    panels.push({head,plane,material,layout,text:i===0?content.summary:content.detail});
  }
  poleMesh.instanceMatrix.needsUpdate=true;group.add(poleMesh);
  group.userData.content=content;group.userData.panels=panels;group.userData.textures=textures;
  group.userData.materials=materials;group.userData.authored=true;
  group.userData.texturePixels=2*PANEL_WIDTH_PX*PANEL_HEIGHT_PX;
  group.userData.textureBytes=group.userData.texturePixels*4;
  group.userData.triangles=92;group.userData.drawCalls=5;
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

/** Camera-event LOD only: no canvas redraw, new textures or animation loop. */
export function updateAchievementSigns(group,{zoom,distanceM,visible=true,bearing=42,pitch=54}={}) {
  assert(group?.userData?.panels && Number.isFinite(zoom) && (Number.isFinite(distanceM)||distanceM===Infinity),
    'Achievement sign LOD requires its group and public camera measurements');
  const on=!!visible && zoom>=17 && distanceM<=220;
  const opacity=on?clamp((zoom-17)/.85,0,1)*clamp((220-distanceM)/80,0,1):0;
  const rotation=(Number.isFinite(bearing)?bearing:42)+180;
  const tilt=clamp(90-(Number.isFinite(pitch)?pitch:54),0,35);
  for(const panel of group.userData.panels){
    panel.head.rotation.y=rotation*Math.PI/180;panel.head.rotation.x=-tilt*Math.PI/180;
    panel.material.opacity=opacity;panel.material.depthWrite=opacity>=.99;
  }
  group.userData.materials[0].opacity=group.userData.materials[1].opacity=opacity;
  group.visible=on && opacity>0;
  const state=group.userData.signState??{};
  state.visible=group.visible;state.readable=group.visible&&zoom>=19.5&&distanceM<=90;
  state.opacity=opacity;state.content=group.userData.content;
  group.userData.signState=state;
  return state;
}
