import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {projectHref,projectMedia} from '../src/projectContent.js';
import {galleryStationComponents,galleryStationPlan,galleryStationLinks,galleryStationMedia,galleryReferencesMetrics,GALLERY_REFERENCE_FONT_METRICS} from '../src/galleryRoomLayout.js';
import {GALLERY_ROOM_MEDIA_DIMENSIONS} from '../src/galleryRoomMediaDimensions.js';
import {surfaceCameraPlan,roomCameraFov} from '../src/galleryRoomCamera.js';

const sizes=[[1280,900],[1280,720],[1920,1080],[2148,1298],[2560,1440],[1440,900],[1024,768],
  [700,1080],[390,844],[320,568],[360,640],[568,320],[800,479],[1280,479],[800,600],[900,500]];
const right=r=>r.x+r.width,bottom=r=>r.y+r.height;
const overlaps=(a,b)=>a.x<right(b)-1e-7&&right(a)>b.x+1e-7&&a.y<bottom(b)-1e-7&&bottom(a)>b.y+1e-7;

test('every original media source and authored destination survives on one front wall',()=>{
  let mediaCount=0,linkCount=0,panels=0;
  for(const project of projects){
    const components=galleryStationComponents(project),media=galleryStationMedia(project),links=galleryStationLinks(project);
    assert.equal(new Set(components.map(pose=>pose.id)).size,components.length);
    assert.deepEqual(components.filter(pose=>pose.kind==='media').map(pose=>pose.media),media);
    const references=components.filter(pose=>pose.kind==='references');
    assert.equal(references.length,links.length?1:0);
    if(links.length){assert.equal(references[0].id,'references');assert.deepEqual(references[0].links,links);panels++;}
    assert.ok(!components.some(pose=>pose.kind==='link'||pose.id.startsWith('link-')),'individual resource plaques are consolidated');
    assert.deepEqual(links.slice(0,project.links?.length||0),project.links||[]);
    const original=projectMedia(project);
    assert.equal(media.length,original.images.length+original.embeds.length);
    for(const record of media){
      const source=(record.kind==='image'?original.images:original.embeds)[record.index];
      for(const [key,value]of Object.entries(typeof source==='string'?{url:source}:source))assert.deepEqual(record[key],value);
    }
    if(!media.length)assert.equal(components.some(pose=>pose.id==='media'),false);
    mediaCount+=media.length;linkCount+=links.length;
  }
  assert.equal(mediaCount,66);assert.equal(linkCount,107);assert.equal(panels,26);
});

test('all distinct inline Markdown destinations remain in References while authored prose stays intact',()=>{
  const normalize=url=>new URL(projectHref(url,'https://batikanor.com/'),'https://batikanor.com/').href;
  for(const project of projects){
    const description=project.longDescription,links=galleryStationLinks(project),destinations=links.map(link=>normalize(link.url));
    const explicitCount=(project.links?.length||0)+(project.githubRepo?2:0),additional=destinations.slice(explicitCount);
    assert.equal(new Set(additional).size,additional.length);
    assert.ok(additional.every(url=>!destinations.slice(0,explicitCount).includes(url)));
    for(const match of description.matchAll(/(?<!!)\[([^\]]+)\]\(([^)]+)\)/g))assert.ok(destinations.includes(normalize(match[2])));
    assert.equal(project.longDescription,description);
  }
});

test('resource extraction preserves original actions and deduplicates safe inline destinations',()=>{
  const project={githubRepo:'original/repo',links:[{label:'Original demo',url:'/sui'}],
    longDescription:'[Again](https://batikanor.com/sui) [**Contact**](mailto:hello@example.org) '+
      '[Repeated contact](mailto:hello@example.org) [Unsafe](javascript:alert) ![Image](/picture.jpg)'};
  assert.deepEqual(galleryStationLinks(project),[...project.links,{label:'Star on GitHub ↗',url:'https://github.com/original/repo'},
    {label:'Watch on GitHub ↗',url:'https://github.com/original/repo/watchers'},{label:'Contact',url:'mailto:hello@example.org'}]);
});

test('media order follows authored placeholders once and retains unreferenced originals',()=>{
  const project={longDescription:'{{gdrive_embed[1]}} {{image[0]}} {{gdrive_embed[1]}}',
    gdrive_embed:[{url:'https://example.org/first',credit:'Original credit'},'https://example.org/second'],
    images:[{url:'https://example.org/photo.jpg',abovePhotoCaption:'Original caption'}]};
  assert.deepEqual(galleryStationMedia(project).map(record=>record.key),['embed:1','image:0','embed:0']);
  assert.equal(galleryStationMedia(project)[2].credit,'Original credit');
  assert.equal(galleryStationMedia(project)[1].abovePhotoCaption,'Original caption');
});

test('References metrics stay tied to the exact body-font artifacts instead of silently reverting to Arial',async()=>{
  const theme=await readFile(new URL('../src/portfolioTheme.css',import.meta.url),'utf8');
  assert.ok(theme.includes(`--portfolio-font-body: '${GALLERY_REFERENCE_FONT_METRICS.family}'`),
    'a body-font family change requires regenerating the References metrics');
  assert.equal(GALLERY_REFERENCE_FONT_METRICS.weight,400);
  for(const[file,expected]of Object.entries(GALLERY_REFERENCE_FONT_METRICS.files)){
    const bytes=await readFile(new URL(`../public/fonts/${file}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,
      `${file} changed; regenerate the native-font metrics before publishing`);
  }
});

test('DM Sans References reflow grows formerly underestimated desktop cards without truncating a label',()=>{
  for(const[slug,width,height,minimum]of[['huawei-agorize-2024',1280,900,159],['ethrome-2025',1920,1080,189]]){
    const project=projects.find(project=>project.slug===slug),links=galleryStationLinks(project);
    const references=galleryStationPlan(project,{width,height}).components.find(pose=>pose.kind==='references');
    const metrics=galleryReferencesMetrics(links,references.width);
    assert.ok(metrics.requiredHeight>=minimum,'the wider authored glyphs contribute their extra wrapped line');
    assert.ok(references.height>=metrics.requiredHeight,
      `${slug}: the final reference line fits rather than scrolling under the footer`);
  }
});

test('References sizing follows native auto-fit thresholds, word wrapping and the atomic inline arrow',()=>{
  const links=Array.from({length:6},()=>({label:'Reference'}));
  assert.equal(galleryReferencesMetrics(links,397.99).columns,1,'two columns need 2×180 +16 gap +22 outer padding/border');
  assert.equal(galleryReferencesMetrics(links,398).columns,2);
  assert.equal(galleryReferencesMetrics(links,594).columns,3);
  assert.equal(galleryReferencesMetrics(links,790).columns,4,'the CSS grid has no artificial three-column maximum');
  assert.equal(galleryReferencesMetrics(links.slice(0,2),1200).columns,2,'unused auto-fit tracks collapse');
  const mono=(text,fontSize)=>[...text].length*fontSize/2;
  const wrapped=galleryReferencesMetrics([{label:'aaaa bbbb cccc'}],72,{measureText:mono});
  assert.deepEqual(wrapped.lineCounts,[3],'three words cannot pack into the two lines implied by total character width');
  const arrow=galleryReferencesMetrics([{label:'aaaaaa'}],70,{focused:true,measureText:mono});
  assert.deepEqual(arrow.lineCounts,[2],'an inline-block arrow plus .4em margin wraps after a full text line');
  assert.equal(arrow.requiredHeight,141,'two 21.6px lines +8 link padding +89.6 focused chrome');
  const unbroken=galleryReferencesMetrics([{label:'abcdefghijklmno'}],70,{focused:true,measureText:mono});
  assert.deepEqual(unbroken.lineCounts,[3],'overflow-wrap:anywhere still retains a complete long unbroken label');
  assert.ok(Math.abs(wrapped.chromeHeight-83.2)<1e-8);assert.ok(Math.abs(arrow.chromeHeight-89.6)<1e-8);
  for(const focused of[false,true]){
    const phone=galleryReferencesMetrics([{label:'Reference'}],360,{phone:true,focused});
    assert.equal(phone.chromeHeight,56,'compact phone header and controls preserve the actual body area');
    assert.equal(phone.fontSize,focused?9:8.5,'phone References use compact text in both reading states');
  }
  assert.equal(galleryReferencesMetrics(links,381.99,{phone:true}).columns,1);
  assert.equal(galleryReferencesMetrics(links,382,{phone:true}).columns,2,'compact padding and column gaps match the phone CSS grid');
});

test('the two Decarbon references fit completely at the reported desktop sizes without shrinking either photograph',()=>{
  const project=projects.find(project=>project.slug==='decarbon-days-climathon-2026'),links=galleryStationLinks(project);
  for(const[width,height,photoWidth,minimumPhotoHeight]of[[1794,886,497.76,411.84],[3588,1772,1216.317,890.878],
    [2048,1011,571.42,460.946],[1280,900,405.357,350.238]]){
    const {components}=galleryStationPlan(project,{width,height});
    const references=components.find(pose=>pose.kind==='references'),metrics=galleryReferencesMetrics(links,references.width);
    assert.ok(references.height>=metrics.requiredHeight,`${width}x${height}: the second reference's final line and footer fit`);
    assert.ok(references.height<=metrics.requiredHeight+1,'the card uses its content height rather than filling the empty region');
    assert.deepEqual(metrics.rowLines,width===2048?[3]:[1,2]);
    for(const photo of components.filter(pose=>pose.photo)){
      assert.ok(photo.width>=photoWidth-1e-6&&photo.height>=minimumPhotoHeight-1e-3,'Reference growth uses its available region, preserving the original photos');
    }
  }
});

test('the reported phone wall gives the description useful space and only enough height for its two References',()=>{
  const project=projects.find(project=>project.slug==='decarbon-days-climathon-2026');
  const links=galleryStationLinks(project);
  for(const[width,height]of[[360,640],[360,780],[390,740],[390,844],[400,864],[412,915],[500,1080]]){
    const plan=galleryStationPlan(project,{width,height});
    const story=plan.components.find(pose=>pose.kind==='story');
    const references=plan.components.find(pose=>pose.kind==='references');
    const metrics=galleryReferencesMetrics(links,references.width,{phone:true});
    assert.equal(plan.wallLayout.constrained,false);
    assert.ok(story.height>=200,`${width}x${height}: the story is a reading surface rather than the former two-line slot`);
    assert.ok(story.width>=180,`${width}x${height}: the body retains a useful reading column`);
    assert.ok(references.height>=metrics.requiredHeight,`${width}x${height}: both complete reference labels fit`);
    assert.ok(references.height<=metrics.requiredHeight+1,`${width}x${height}: References spend only their measured content height`);
    assert.ok(references.height<=125,`${width}x${height}: two links no longer take a tall part of the wall`);
    assert.equal(plan.components.filter(pose=>pose.photo).length,2,'both original photographs remain on the wall');
  }
});

test('all projects show several description lines on ordinary portrait phones, including dense media collections',()=>{
  const bodyLine=11.5*1.42,chrome=41,summaryHeadingAndSpacing=31;
  for(const[width,height]of[[320,568],[360,640],[390,650],[390,740],[390,844],[400,864],[412,915],[650,844],[699,900]]){
    for(const project of projects){
      const plan=galleryStationPlan(project,{width,height}),story=plan.components.find(pose=>pose.kind==='story');
      assert.equal(plan.wallLayout.constrained,false);
      assert.ok(story.height-chrome-summaryHeadingAndSpacing>=5*bodyLine,
        `${project.slug} at ${width}x${height}: at least five body lines fit after the Summary heading and board controls`);
      assert.ok(story.width>=150,`${project.slug} keeps a useful arrival reading width`);
      assert.deepEqual(plan.components.filter(pose=>pose.kind==='media').map(pose=>pose.media.key),
        galleryStationMedia(project).map(media=>media.key),'stronger reading priority retains every original media source');
    }
  }
});

test('all authored References collections reflow at their final card width while small desktop collections need no scroll',()=>{
  const viewports=[...sizes,[1794,886],[3588,1772],[2048,1011],[1440,900]];
  let smallCollections=0,longLabels=0;
  for(const[width,height]of viewports)for(const project of projects){
    const links=galleryStationLinks(project);if(!links.length)continue;
    const reference=galleryStationPlan(project,{width,height}).components.find(pose=>pose.kind==='references');
    const metrics=galleryReferencesMetrics(links,reference.width,{phone:width<700});
    assert.equal(metrics.lineCounts.length,links.length,'each original label contributes its complete wrapped line count');
    assert.ok(metrics.columns<=links.length&&metrics.requiredHeight>metrics.chromeHeight);
    if(links.some(link=>link.label.length>70)){longLabels++;assert.ok(metrics.lineCounts.some(count=>count>1),'long authored labels contribute additional height');}
    if(links.length<=2&&width>=1280&&height>=886){
      smallCollections++;assert.ok(reference.height>=metrics.requiredHeight,`${project.slug} avoids needless scrolling at ${width}x${height}`);
    }
  }
  assert.ok(smallCollections>=50);assert.ok(longLabels>=20);
});

test('every component fits the same front wall and clears header, globe and hints at all responsive sizes',()=>{
  for(const [width,height]of sizes)for(const project of projects){
    const {components,wallLayout}=galleryStationPlan(project,{width,height});
    assert.equal(wallLayout.constrained,false,'ordinary responsive viewports retain all reading and touch minimums');
    assert.equal(wallLayout.worldHeight,10.8);assert.ok(Math.abs(wallLayout.worldWidth-10.8*width/height)<1e-9);
    assert.equal(wallLayout.rects.length,components.length);
    const outer=[];
    for(const pose of components){
      const r=pose.pixelRect,padding=pose.framePadding*height/wallLayout.worldHeight;
      assert.deepEqual(pose.rotation,[0,0,0]);assert.equal(pose.position[2],-2.72);
      assert.ok([...pose.position,pose.width,pose.height,pose.worldWidth,pose.worldHeight].every(Number.isFinite));
      assert.ok(r.width>0&&r.height>0);
      const frame={x:r.x-padding,y:r.y-padding,width:r.width+padding*2,height:r.height+padding*2};
      assert.ok(frame.x>=0&&frame.y>=0&&right(frame)<=width&&bottom(frame)<=height,`${project.slug}/${pose.id} stays within ${width}x${height}`);
      for(const blocked of wallLayout.obstructions)assert.equal(overlaps(frame,blocked),false,
        `${project.slug}/${pose.id} clears interface at ${width}x${height}`);
      assert.ok(Math.abs((pose.position[0]/wallLayout.worldWidth+.5)*width-r.x-r.width/2)<1e-7);
      assert.ok(Math.abs((1-pose.position[1]/wallLayout.worldHeight)*height-r.y-r.height/2)<1e-7);
      assert.ok(Math.abs(pose.worldWidth/pose.worldHeight-r.width/r.height)<1e-8);
      outer.push({id:pose.id,rect:frame});
    }
    for(let i=0;i<outer.length;i++)for(let j=i+1;j<outer.length;j++)assert.equal(overlaps(outer[i].rect,outer[j].rect),false,
      `${project.slug}: ${outer[i].id} and ${outer[j].id} remain separate at ${width}x${height}`);
  }
});

test('all 36 photographs preserve native image apertures and separate captions/actions after every reflow',()=>{
  for(const [width,height]of sizes){
    let photos=0;
    for(const project of projects)for(const pose of galleryStationComponents(project,{width,height}).filter(pose=>pose.kind==='media')){
      const source=GALLERY_ROOM_MEDIA_DIMENSIONS[pose.media.url];
      if(!source){assert.equal(pose.photo,undefined);continue;}
      photos++;assert.equal(pose.photo.src,source.src);assert.equal(pose.photo.displaySrc,source.displaySrc);
      assert.equal(pose.photo.width,source.width);assert.equal(pose.photo.height,source.height);
      assert.ok(Math.abs(pose.photo.worldWidth/pose.photo.worldHeight-source.width/source.height)<1e-9,
        `${project.slug}/${pose.id} never crops or letterboxes its original image`);
      assert.equal(pose.worldWidth,pose.photo.worldWidth);
      assert.ok(pose.photo.captionWorldHeight>0&&pose.photo.controlsWorldHeight>0);
      assert.ok(Math.abs(pose.worldHeight-pose.photo.worldHeight-pose.photo.captionWorldHeight-pose.photo.controlsWorldHeight)<1e-9);
    }
    assert.equal(photos,36);
  }
});

test('single-photo walls retain a useful prize photograph and generous native-size reading window',()=>{
  const tesla=projects.find(project=>project.slug==='tesla-gigathon-2026');
  const {components}=galleryStationPlan(tesla,{width:1280,height:900});
  const story=components.find(pose=>pose.id==='story'),photo=components.find(pose=>pose.id==='media');
  assert.ok(story.pixelRect.width>=650&&story.pixelRect.height>=220,'the story uses a substantial native-pixel canvas');
  assert.ok(photo.pixelRect.width>=280&&photo.photo.worldHeight/10.8*900>=400,'the prize photograph stays large on arrival');
  const dense=galleryStationPlan(projects.find(project=>project.slug==='music-ai-osaka-2025'),{width:1280,height:900});
  assert.equal(dense.components.filter(pose=>pose.kind==='media').length,6);
  assert.ok(dense.components.filter(pose=>pose.kind==='media').every(pose=>pose.pixelRect.width>=150&&pose.pixelRect.height>=120),
    'the complete six-source collection remains individually visible and approachable');
});

test('title banners reserve a separate compact technology box and keep ordinary desktop title copy clear',()=>{
  for(const [width,height]of[[1024,768],[1280,720],[1280,900],[1920,1080]])for(const project of projects){
    const title=galleryStationComponents(project,{width,height}).find(pose=>pose.id==='title');
    assert.equal(title.titleLayout.technologiesStacked,false);
    assert.equal(title.titleLayout.technologyFont,13);
    assert.equal(title.titleLayout.counterWidth,undefined,'no space is reserved for the removed title counter');
    assert.ok(title.titleLayout.technologiesWidth>0&&title.titleLayout.technologiesWidth<=280);
    assert.ok(title.titleLayout.titleTextWidth>=width*.42,`${project.slug} has a useful separate title column`);
    assert.ok(title.height>=title.titleLayout.requiredHeight,`${project.slug} title and tags fit their desktop banner`);
  }
  for(const width of[320,390,600,650,699]){
    const title=galleryStationComponents(projects[0],{width,height:844}).find(pose=>pose.id==='title');
    assert.equal(title.titleLayout.technologiesStacked,true,'phone technology box wraps below the title');
    assert.equal(title.titleLayout.technologyFont,9,'the phone tag style extends through 699px');
    assert.equal(title.titleLayout.counterWidth,undefined);
  }
  for(const [width,height]of[[901,700],[1000,700],[1024,700],[1104,660],[1280,660]])for(const project of projects){
    const plan=galleryStationPlan(project,{width,height}),title=plan.components.find(pose=>pose.id==='title');
    assert.equal(plan.wallLayout.constrained,false,'ordinary narrow-desktop walls retain their readable composition');
    if(title.pixelRect.x<plan.wallLayout.dock.right)assert.ok(bottom(title.pixelRect)+3<=plan.wallLayout.dock.top,
      `${project.slug}: the complete title frame ends before the taller globe dock`);
  }
});

test('resize changes composition while retaining stable media ids and exactly one References object',()=>{
  for(const project of projects){
    const desktop=galleryStationComponents(project,{width:1280,height:900}),phone=galleryStationComponents(project,{width:390,height:844});
    assert.deepEqual(phone.map(pose=>pose.id),desktop.map(pose=>pose.id));
    assert.notDeepEqual(phone.find(pose=>pose.id==='story').pixelRect,desktop.find(pose=>pose.id==='story').pixelRect);
    assert.deepEqual(phone.filter(pose=>pose.kind==='media').map(pose=>pose.media.key),desktop.filter(pose=>pose.kind==='media').map(pose=>pose.media.key));
    assert.deepEqual(phone.find(pose=>pose.id==='references')?.links,desktop.find(pose=>pose.id==='references')?.links);
  }
});

test('every story and References panel retains a useful focused viewport while media remain tappable',()=>{
  const viewports=[...sizes,[900,600],[1280,568],[800,500],[1440,600]];
  for(const[width,height]of viewports)for(const project of projects){
    for(const pose of galleryStationComponents(project,{width,height})){
      if(pose.kind==='media'){
        assert.ok(pose.width>=24-1e-7&&pose.height>=40-1e-7,`${project.slug}/${pose.id} retains a visible native click target at ${width}x${height}`);
        continue;
      }
      if(!['story','references'].includes(pose.kind))continue;
      const fov=roomCameraFov(width),plan=surfaceCameraPlan(pose,{width,height},fov);
      const density=height/(2*Math.tan(fov*Math.PI/360)*plan.distance);
      const displayedWidth=pose.worldWidth*density,displayedHeight=pose.worldHeight*density;
      assert.ok(displayedWidth>=(pose.kind==='story'?140:100)-1e-7,`${project.slug}/${pose.id} avoids a narrow reading column`);
      const chrome=pose.kind==='story'?width<700?41:59:width<700?56:89.6;
      assert.ok(displayedHeight-chrome>=40-1e-7,`${project.slug}/${pose.id} leaves readable content after controls at ${width}x${height}`);
    }
  }
});

test('formerly clipped flat references and short stories have usable reading aspects without shrinking ordinary desktop stories',()=>{
  for(const[slug,width,height,id]of[['ethrome-2025',900,500,'references'],['mdsi-bundesliga-2024',568,320,'story']]){
    const pose=galleryStationComponents(projects.find(p=>p.slug===slug),{width,height}).find(p=>p.id===id);
    const fov=roomCameraFov(width),plan=surfaceCameraPlan(pose,{width,height},fov);
    const displayedHeight=pose.worldHeight*height/(2*Math.tan(fov*Math.PI/360)*plan.distance);
    assert.ok(displayedHeight>=(id==='story'?100:130));
  }
  const phone=galleryStationComponents(projects.find(p=>p.slug==='huawei-agorize-2024'),{width:360,height:640});
  assert.ok(phone.find(p=>p.id==='media-4').width>=24-1e-7,'the former 9px photograph is approachable');
  const desktop=galleryStationComponents(projects.find(p=>p.slug==='tesla-gigathon-2026'),{width:1280,height:900});
  assert.ok(desktop.find(p=>p.id==='story').width>=780,'ordinary desktop text keeps its generous width');
});

test('compact split layouts stay readable while impossible tiny windows preserve all sources without throwing',()=>{
  for(const[width,height]of[[320,480],[350,479],[480,320]])for(const project of projects){
    const plan=galleryStationPlan(project,{width,height});assert.equal(plan.wallLayout.constrained,false);
    for(const pose of plan.components.filter(pose=>pose.kind==='media'))assert.ok(pose.width>=24-1e-7&&pose.height>=40-1e-7);
    for(const pose of plan.components.filter(pose=>['story','references'].includes(pose.kind))){
      const fov=roomCameraFov(width),camera=surfaceCameraPlan(pose,{width,height},fov);
      const density=height/(2*Math.tan(fov*Math.PI/360)*camera.distance);
      assert.ok(pose.worldHeight*density>=100);
    }
  }
  for(const project of projects){
    const plan=galleryStationPlan(project,{width:320,height:320});assert.equal(plan.wallLayout.constrained,true);
    assert.deepEqual(plan.components.filter(pose=>pose.kind==='media').map(pose=>pose.media.key),galleryStationMedia(project).map(media=>media.key));
    assert.deepEqual(plan.components.find(pose=>pose.kind==='references')?.links,galleryStationLinks(project).length?galleryStationLinks(project):undefined);
    for(const pose of plan.components){
      assert.ok(pose.width>0&&pose.height>0&&[...pose.position,pose.worldWidth,pose.worldHeight].every(Number.isFinite));
      if(pose.photo)assert.ok(Math.abs(pose.photo.worldWidth/pose.photo.worldHeight-pose.photo.width/pose.photo.height)<1e-9);
    }
  }
});

test('practical interpolated window sizes never crash while ordinary compositions remain unconstrained',()=>{
  const widths=[320,350,360,390,480,568,600,640,699,700,768,800,900,901,1000,1024,1280,1440,1920];
  const heights=[320,360,400,479,480,500,568,600,620,640,650,700,720,768,844,900,1000,1080];
  for(const width of widths)for(const height of heights)for(const project of projects){
    const plan=galleryStationPlan(project,{width,height});
    assert.ok(plan.components.every(pose=>pose.width>0&&pose.height>0&&[...pose.position,pose.worldWidth,pose.worldHeight].every(Number.isFinite)));
    if(plan.wallLayout.constrained)assert.ok(width<=390&&height<=400,'only physically restricted tiny windows relax reading minimums');
  }
});
