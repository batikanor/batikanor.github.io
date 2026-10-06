import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {authoredSignProse,selectAchievementSignContent,createAchievementSigns,updateAchievementSigns,ACHIEVEMENT_SIGN_FACE,ACHIEVEMENT_GAME_SIGN_POSITIONS} from '../src/achievementSigns.js';
import {getExhibitGameSignContent,EXHIBIT_GAME_AI_DISCLAIMER} from '../src/exhibitGameSignContent.js';
import {CAPSULE_LAYOUT,CAPSULE_SCALE,CAPSULE_SIGN_POSITIONS} from '../src/achievementCapsule.js';

function canvasFixture(glyphWidth=.52){
  const canvases=[];
  const canvasFactory=(width,height)=>{
    const calls=[];let font='10px Arial';
    const context={calls,get font(){return font;},set font(value){font=value;},
      fillRect(...args){calls.push({kind:'fillRect',args,fill:this.fillStyle});},
      strokeRect(...args){calls.push({kind:'strokeRect',args});},
      save(){calls.push({kind:'save'});},scale(...args){calls.push({kind:'scale',args});},restore(){calls.push({kind:'restore'});},
      measureText(text){const size=Number(font.match(/(\d+)px/)[1]);return {width:text.length*size*glyphWidth,
        actualBoundingBoxAscent:size*.72,actualBoundingBoxDescent:size*(/[pgqy]/.test(text)?.22:.02)};},
      fillText(text,x,y){calls.push({kind:'text',text,x,y,font,fill:this.fillStyle});}};
    const canvas={width,height,getContext:kind=>kind==='2d'?context:null,context};canvases.push(canvas);return canvas;
  };
  return {canvases,canvasFactory};
}
function release(group){
  const geometries=new Set(),materials=new Set(group.userData.materials),textures=new Set(group.userData.textures);
  group.traverse(object=>{if(object.geometry)geometries.add(object.geometry);if(object.material)materials.add(object.material);if(object.isInstancedMesh)object.dispose();});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.image=null;});group.clear();
}
const tesla=contestsAndActivities.find(project=>project.slug==='tesla-gigathon-2026');

test('all 32 monitors use explicit itemized source notes without repeated titles or prose blocks',()=>{
  assert.equal(contestsAndActivities.length,32);
  for(const project of contestsAndActivities){
    const content=selectAchievementSignContent(project);
    assert.equal(content.slug,project.slug);assert.equal(content.title,authoredSignProse(project.title));
    assert.equal(content.source,'portfolio-exhibit-notes');assert.equal(content.mode,'itemized');
    assert.equal(content.summarySource,'exhibitNotes.overview');assert.equal(content.detailSource,'exhibitNotes.details');
    assert.deepEqual(content.summaryItems,project.exhibitNotes.overview);
    assert.deepEqual(content.detailItems,project.exhibitNotes.details);
    assert.equal(content.summary,content.summaryItems.join('\n'));assert.equal(content.detail,content.detailItems.join('\n'));
    assert.equal(content.summaryTruncated,false);assert.equal(content.detailTruncated,false);
    assert.ok(Object.isFrozen(content)&&Object.isFrozen(content.summaryItems)&&Object.isFrozen(content.detailItems));
    for(const item of [...content.summaryItems,...content.detailItems]){
      assert.ok(item.length<=120&&item.length>0);assert.notEqual(item,content.title);
      assert.notEqual(item,project.shortDescription);assert.notEqual(item,project.longDescription);
      assert.doesNotMatch(item,/\{\{|gdrive_embed\[|<iframe|!\[|\]\(https?:/);
    }
  }
});

test('Tesla monitors use curated logistics facts rather than its prize title or team paragraph',()=>{
  const content=selectAchievementSignContent(tesla);
  assert.equal(content.title,'1st Place at Tesla Gigathon 2026');
  assert.deepEqual(content.summaryItems,tesla.exhibitNotes.overview);assert.deepEqual(content.detailItems,tesla.exhibitNotes.details);
  assert.notEqual(content.summary,tesla.shortDescription);
  assert.ok(!content.detail.startsWith('I teamed up with people'));
  assert.doesNotMatch(content.summary+'\n'+content.detail,/forklift|scanner|conveyor/i,'illustrative model parts are not claims about a confidential Tesla solution');
});

test('monitor notes are copied and frozen independently of title length or later data mutation',()=>{
  const overview=['Recorded trajectories','Shared policy across environments'],details=['Offline reinforcement learning','Latent trajectory encoding'];
  const project={slug:'notes-regression',title:'An original achievement title longer than the old sixty-five-character restriction',exhibitNotes:{overview,details}};
  const content=selectAchievementSignContent(project),short=selectAchievementSignContent({...project,title:'Short original title'});
  assert.deepEqual(content.summaryItems,short.summaryItems);assert.deepEqual(content.detailItems,short.detailItems);
  overview.push('Later source edit');details[0]='Changed later';
  assert.equal(content.summaryItems.length,2);assert.equal(content.detailItems[0],'Offline reinforcement learning');
  assert.throws(()=>content.summaryItems.push('mutation'),TypeError);
});

test('plain source extraction excludes embeds/media/code and retains real linked prose without its URL',()=>{
  const original='**Original title**\n\nI built [a real tool](https://example.org/tool_(v2)) using `Python`.\n\n{{gdrive_embed[0]}}\n\n![Photograph](https://example.org/photo.jpg)\n\n```js\nnot prose\n```\n\n<iframe src="https://example.org/">Embedded text</iframe>\n\nOriginal final sentence.';
  assert.equal(authoredSignProse(original),'Original title\n\nI built a real tool using Python.\n\nOriginal final sentence.');
  assert.throws(()=>selectAchievementSignContent({slug:'invented'}),/authored/);
});

test('two printed game signs retain the existing face, texture and geometry budgets',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  assert.equal(fixture.canvases.length,2);assert.equal(group.userData.textures.length,2);
  assert.equal(group.userData.texturePixels,1_310_720);assert.equal(group.userData.textureBytes,5_242_880);
  assert.equal(group.userData.content.title,tesla.title);assert.equal(group.userData.authored,true);
  assert.equal(group.userData.triangles,92);assert.equal(group.userData.drawCalls,5);
  assert.equal(group.userData.panels.length,2);assert.equal(group.visible,false);
  for(const [index,panel] of group.userData.panels.entries()){
    const canvas=fixture.canvases[index],printed=getExhibitGameSignContent(tesla.slug).panels[index];
    assert.equal(canvas.width,1024);assert.equal(canvas.height,640);
    assert.deepEqual(canvas.context.calls.filter(c=>c.kind==='text').map(c=>c.text),[...(printed.title?[printed.title]:[]),...printed.lines]);
    assert.ok(canvas.context.calls.filter(c=>c.kind==='text').every(c=>c.font.includes('Arial')));
    assert.equal(canvas.context.calls.find(c=>c.kind==='fillRect').fill,'#112227');
    assert.equal(panel.material.side,THREE.FrontSide);assert.equal(panel.material.toneMapped,false);
    assert.equal(panel.material.map.colorSpace,THREE.SRGBColorSpace);assert.equal(panel.material.map.generateMipmaps,false);
    assert.equal(panel.material.map.repeat.x,-1);assert.equal(panel.material.map.offset.x,1);assert.equal(panel.material.map.flipY,true);
    assert.deepEqual(panel.head.position.toArray(),ACHIEVEMENT_GAME_SIGN_POSITIONS[index]);
    assert.equal(panel.text,printed.text);assert.equal(panel.kind,printed.kind);
  }
  assert.deepEqual(group.userData.gameContent,getExhibitGameSignContent(tesla.slug));release(group);
});

test('all 32 games print their actual rules and the exact disclaimer without reading actions',()=>{
  for(const project of contestsAndActivities){
    const fixture=canvasFixture(),group=createAchievementSigns(project,{canvasFactory:fixture.canvasFactory});
    const content=getExhibitGameSignContent(project.slug);
    for(const [index,panel] of group.userData.panels.entries()){
      const printed=content.panels[index],textCalls=fixture.canvases[index].context.calls.filter(c=>c.kind==='text');
      assert.deepEqual(textCalls.map(c=>c.text),[...(printed.title?[printed.title]:[]),...printed.lines]);
      assert.equal(panel.layout.overflow,false);assert.ok(textCalls.every(c=>c.x===512));
      assert.doesNotMatch(textCalls.map(c=>c.text).join(' '),/Read excerpt|Read more/i);
      assert.ok(panel.layout.glyphBounds.every(g=>g.bottom-g.top===276/3),'visible type must be exactly one third the former lettering');
      assert.ok(panel.layout.glyphBounds.every(g=>g.top>=28&&g.bottom<=612&&g.width<=936),'complete words clear frame and fit face');
    }
    assert.equal(group.userData.panels[0].label,'Game rules');
    assert.equal(group.userData.panels[1].layout.lines.join(' '),EXHIBIT_GAME_AI_DISCLAIMER);
    release(group);
  }
});

test('rule heading and body share the requested ink height while heading retains clear emphasis',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  const rules=fixture.canvases[0].context.calls.filter(c=>c.kind==='text');
  assert.equal(rules[0].text,'Game rules');assert.ok(rules[0].font.startsWith('bold '));assert.equal(rules[0].fill,'#e3c084');
  assert.ok(rules.slice(1).every(c=>!c.font.startsWith('bold ')&&c.fill==='#f5f3eb'));
  assert.ok(group.userData.panels.every(p=>p.layout.fontSize>=72&&p.layout.fontSize<=85));
  assert.ok(group.userData.panels.flatMap(p=>p.layout.glyphBounds).every(g=>g.bottom-g.top===92));release(group);
});

test('printed signs are game-only and non-interactive beyond the playable floor',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  assert.equal(updateAchievementSigns(group,{zoom:20,distanceM:0}).visible,false,'idle never reveals signs implicitly');
  const point=new THREE.Vector3(),halfWidth=(ACHIEVEMENT_SIGN_FACE.widthM+.12)/2,halfHeight=(ACHIEVEMENT_SIGN_FACE.heightM+.12)/2;
  for(const [index,panel] of group.userData.panels.entries()){
    assert.deepEqual(panel.head.position.toArray(),ACHIEVEMENT_GAME_SIGN_POSITIONS[index]);
    panel.head.traverse(object=>{
      assert.equal(object.userData.gameObjectId,undefined);assert.equal(object.userData.signIndex,undefined);
      assert.equal(object.userData.actionLabel,undefined);
    });
  }
  for(let bearing=0;bearing<360;bearing+=15)for(const pitch of [0,30,54,65]){
    updateAchievementSigns(group,{visible:true,zoom:20,distanceM:0,bearing,pitch});group.updateMatrixWorld(true);
    for(const {head} of group.userData.panels)for(const x of [-halfWidth,halfWidth])for(const y of [-halfHeight,halfHeight])for(const z of [-.065,.071]){
      point.set(x,y,z).applyMatrix4(head.matrixWorld);
      assert.ok(Math.hypot(point.x,point.z)>6.65,'rotated physical faces must stay beyond the playable footprint');
    }
  }
  assert.equal(updateAchievementSigns(group,{visible:true,zoom:20,distanceM:0}).visible,true);
  assert.equal(updateAchievementSigns(group,{visible:false,zoom:20,distanceM:0}).visible,false);
  release(group);
});

test('proximity LOD changes only opacity/head orientation, never redraws textures or billboards the poles',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  const canvases=fixture.canvases.map(canvas=>canvas.context.calls.length),textures=[...group.userData.textures];
  const poles=group.children.find(child=>child.isInstancedMesh),poleMatrix=poles.instanceMatrix.array.slice();
  const positions=group.userData.panels.map(panel=>panel.head.position.toArray());
  assert.equal(updateAchievementSigns(group,{visible:true,zoom:16,distanceM:20}).visible,false);
  assert.equal(updateAchievementSigns(group,{visible:true,zoom:17.3,distanceM:180}).readable,false);
  const ready=updateAchievementSigns(group,{visible:true,zoom:20,distanceM:30,bearing:90,pitch:65});
  assert.equal(ready.visible,true);assert.equal(ready.readable,true);assert.equal(ready.opacity,1);
  group.userData.panels.forEach((panel,index)=>{
    assert.deepEqual(panel.head.position.toArray(),positions[index]);assert.equal(panel.head.rotation.y,Math.PI*1.5);
    assert.ok(Math.abs(panel.head.rotation.x+25*Math.PI/180)<1e-9);
  });
  assert.deepEqual([...poles.instanceMatrix.array],[...poleMatrix]);
  assert.deepEqual(group.userData.textures,textures);assert.deepEqual(fixture.canvases.map(canvas=>canvas.context.calls.length),canvases);
  assert.equal(updateAchievementSigns(group,{visible:true,zoom:20,distanceM:300}).visible,false);
  assert.equal(updateAchievementSigns(group,{zoom:20,distanceM:20,visible:false}).visible,false);
  release(group);
});

test('every viewport keeps the complete printed words without icon fallback or texture repaint',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  const textures=[...group.userData.textures],calls=fixture.canvases.map(c=>c.context.calls.length);
  const lines=group.userData.panels.map(p=>[...p.layout.lines]);
  for(const [viewportWidth,viewportHeight] of [[1280,900],[390,844],[568,320],[390,320]]){
    updateAchievementSigns(group,{visible:true,zoom:20,distanceM:0,viewportWidth,viewportHeight});
    assert.deepEqual(group.userData.panels.map(p=>p.layout.lines),lines);
    assert.ok(group.userData.panels.every(p=>!p.layout.compact&&p.layout.glyphBounds.length>0));
  }
  assert.deepEqual(fixture.canvases.map(c=>c.context.calls.length),calls);assert.deepEqual(group.userData.textures,textures);
  assert.equal(fixture.canvases.length,2);release(group);
});

test('large rim placards stand on the capsule floor and stay inside the camera allowance at fourfold scale',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory,
    positions:CAPSULE_SIGN_POSITIONS,baseY:CAPSULE_LAYOUT.floorY,panelWidthM:ACHIEVEMENT_SIGN_FACE.widthM,panelHeightM:ACHIEVEMENT_SIGN_FACE.heightM,exhibitScale:CAPSULE_SCALE});
  const calls=fixture.canvases.map(canvas=>canvas.context.calls.length);
  const pole=group.children.find(object=>object.isInstancedMesh),matrix=new THREE.Matrix4(),point=new THREE.Vector3();
  for(let i=0;i<2;i++) {
    pole.getMatrixAt(i,matrix);
    const bottom=new THREE.Vector3(0,-1.35,0).applyMatrix4(matrix);
    assert.ok(Math.abs(bottom.y-CAPSULE_LAYOUT.floorY)<1e-6,'pole must start at the internal floor, not ground level');
    assert.deepEqual(group.userData.panels[i].head.position.toArray(),CAPSULE_SIGN_POSITIONS[i]);
  }
  for(const bearing of [0,42,90,180,270])for(const pitch of [0,30,54,65]) {
    const state=updateAchievementSigns(group,{visible:true,zoom:18,distanceM:100,bearing,pitch});
    assert.equal(state.visible,true);assert.equal(state.readable,true);assert.equal(state.opacity,1);
    group.updateMatrixWorld(true);
    for(const {head} of group.userData.panels)for(const x of [-1.71,1.71])for(const y of [-.985,.985])for(const z of [-.065,.071]) {
      point.set(x,y,z).applyMatrix4(head.matrixWorld);
      assert.ok(point.y>=CAPSULE_LAYOUT.floorY,'panel must not pierce the floor');
      assert.ok(Math.abs(point.x)<10.45&&Math.abs(point.z)<10.45,
        `rim placard outside game camera at bearing${bearing}/pitch${pitch}`);
    }
  }
  assert.deepEqual(fixture.canvases.map(canvas=>canvas.context.calls.length),calls,'scale/orientation never redraws prose');
  assert.equal(group.userData.textureBytes,5_242_880);assert.equal(group.userData.triangles,92);
  release(group);
});

test('one active sign assembly releases all owned textures, materials, geometries and instance buffers exactly once',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  const geometrySet=new Set(),materialSet=new Set(group.userData.materials),textureSet=new Set(group.userData.textures);
  let geometries=0,materials=0,textures=0,instances=0;
  group.traverse(object=>{if(object.geometry)geometrySet.add(object.geometry);if(object.material)materialSet.add(object.material);
    if(object.isInstancedMesh)object.addEventListener('dispose',()=>instances++);});
  geometrySet.forEach(g=>g.addEventListener('dispose',()=>geometries++));materialSet.forEach(m=>m.addEventListener('dispose',()=>materials++));
  textureSet.forEach(t=>t.addEventListener('dispose',()=>textures++));release(group);
  assert.equal(geometries,geometrySet.size);assert.equal(materials,materialSet.size);assert.equal(textures,2);assert.equal(instances,1);
  textureSet.forEach(texture=>assert.equal(texture.image,null));
});


test('Salzburg notes describe the real EEG pipeline without hypothetical marketing preamble or duplicated paragraphs',()=>{
  const project=contestsAndActivities.find(project=>project.slug==='salzburg-tourism-2024');
  const content=selectAchievementSignContent(project);
  assert.match(content.summary+'\n'+content.detail,/Muse 2|EEG/);assert.match(content.summary+'\n'+content.detail,/personality|recommend/i);
  assert.doesNotMatch(content.summary+'\n'+content.detail,/Assume you are working|1\) You use/);
});

test('new projects without curated notes fall back only to existing tags, never a title or paragraph',()=>{
  const project={slug:'future-project',title:'Future project title',shortDescription:'A paragraph that must not be repeated.',
    longDescription:'Another paragraph that must not be repeated.',technologies:['Python','AI','Python','Robotics','Data','Energy']};
  const content=selectAchievementSignContent(project);
  assert.equal(content.source,'portfolio-technologies');assert.deepEqual(content.summaryItems,['Python','AI','Robotics']);
  assert.deepEqual(content.detailItems,['Data','Energy']);
  assert.deepEqual(selectAchievementSignContent({...project,technologies:[]}).summaryItems,[]);
  assert.deepEqual(selectAchievementSignContent({...project,technologies:[]}).detailItems,[]);
  assert.ok(!content.summary.includes(project.title)&&!content.detail.includes('paragraph'));
});

test('malformed or oversized curated lists fail before any canvas/GPU resources are allocated',()=>{
  for(const notes of [null,{overview:'not a list',details:[]},{overview:[''],details:[]},
    {overview:['x'.repeat(121)],details:[]},{overview:['<iframe>'],details:[]},
    {overview:['line\nline'],details:[]},{overview:Array(13).fill('Too many'),details:[]}]){
    if(notes===null)continue;
    const fixture=canvasFixture();
    assert.throws(()=>createAchievementSigns({...tesla,exhibitNotes:notes},{canvasFactory:fixture.canvasFactory}),/Monitor/);
    assert.equal(fixture.canvases.length,0);
  }
});

test('unknown game rules cannot allocate a misleading printed sign',()=>{
  const fixture=canvasFixture();
  assert.throws(()=>createAchievementSigns({...tesla,slug:'unknown-exhibit'},{canvasFactory:fixture.canvasFactory}),/known exhibit game/);
  assert.equal(fixture.canvases.length,0);
});

test('hero east/up/south basis can explicitly retain ordinary U orientation',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory,mirrorU:false});
  group.userData.textures.forEach(texture=>{assert.equal(texture.repeat.x,1);assert.equal(texture.offset.x,0);assert.equal(texture.flipY,true);});
  assert.equal(group.userData.content.title,tesla.title);release(group);
});

test('second-panel native canvas failure rolls back first pixels and every partially created resource',()=>{
  const fixture=canvasFixture();let created=0;
  const originalGeometry=THREE.BufferGeometry.prototype.dispose,originalMaterial=THREE.Material.prototype.dispose,
    originalTexture=THREE.Texture.prototype.dispose,originalInstance=THREE.InstancedMesh.prototype.dispose;
  const geometries=new Set(),materials=new Set(),textures=new Set();let instances=0;
  THREE.BufferGeometry.prototype.dispose=function(){geometries.add(this);return originalGeometry.call(this);};
  THREE.Material.prototype.dispose=function(){materials.add(this);return originalMaterial.call(this);};
  THREE.Texture.prototype.dispose=function(){textures.add(this);return originalTexture.call(this);};
  THREE.InstancedMesh.prototype.dispose=function(){instances++;return originalInstance.call(this);};
  try {
    assert.throws(()=>createAchievementSigns(tesla,{canvasFactory:(w,h)=>{
      const canvas=fixture.canvasFactory(w,h);created++;if(created===2)canvas.getContext=()=>null;return canvas;
    }}),/2D context unavailable/);
    assert.equal(created,2);assert.equal(geometries.size,3);assert.equal(materials.size,3);assert.equal(textures.size,1);assert.equal(instances,1);
    textures.forEach(texture=>assert.equal(texture.image,null));
    fixture.canvases.forEach(canvas=>{assert.equal(canvas.width,0);assert.equal(canvas.height,0);});
  } finally {
    THREE.BufferGeometry.prototype.dispose=originalGeometry;THREE.Material.prototype.dispose=originalMaterial;
    THREE.Texture.prototype.dispose=originalTexture;THREE.InstancedMesh.prototype.dispose=originalInstance;
  }
});


test('opaque close-range sign faces occlude their supports instead of drawing poles through authored text',()=>{
  const group=createAchievementSigns(tesla,{canvasFactory:canvasFixture().canvasFactory});
  updateAchievementSigns(group,{visible:true,zoom:20,distanceM:0});
  for(const panel of group.userData.panels){assert.equal(panel.material.depthWrite,true);assert.equal(panel.plane.renderOrder,2);assert.equal(panel.head.children[0].renderOrder,1);}
  updateAchievementSigns(group,{visible:true,zoom:17.2,distanceM:0});
  assert.ok(group.userData.panels.every(panel=>panel.material.depthWrite===false));release(group);
});


test('future technology tags are normalized, deduplicated and balanced without risking sign construction',()=>{
  const project={slug:'future-tags',title:'Future title',technologies:[' Python ','Python',null,42,' AI ','<script>','https://example.org','Future title','']};
  const content=selectAchievementSignContent(project);
  assert.deepEqual(content.summaryItems,['Python']);assert.deepEqual(content.detailItems,['AI']);
  assert.deepEqual(selectAchievementSignContent({...project,technologies:'not an array'}).summaryItems,[]);
  assert.equal(content.source,'portfolio-technologies');
});

test('source notes cannot replace printed game rules or AI disclaimer',()=>{
  const notes=Array.from({length:12},(_,i)=>`Source fact ${i+1}: `+'W'.repeat(96));
  const original=getExhibitGameSignContent(tesla.slug),fixture=canvasFixture();
  const group=createAchievementSigns({...tesla,exhibitNotes:{overview:notes,details:notes}},{canvasFactory:fixture.canvasFactory});
  assert.deepEqual(group.userData.content.summaryItems,notes);
  assert.deepEqual(group.userData.gameContent,original);
  assert.deepEqual(group.userData.panels.map(p=>p.layout.lines),original.panels.map(p=>[...(p.title?[p.title]:[]),...p.lines]));
  release(group);
});

test('all printed rules fit a conservative native sans-serif width estimate without hiding words',()=>{
  for(const project of contestsAndActivities){
    const fixture=canvasFixture(.6),group=createAchievementSigns(project,{canvasFactory:fixture.canvasFactory});
    for(const panel of group.userData.panels){
      assert.equal(panel.layout.overflow,false);assert.ok(panel.layout.fontSize>=72);
      assert.ok(panel.layout.glyphBounds.every(g=>g.width<=936&&g.top>=28&&g.bottom<=612));
      assert.equal(panel.layout.glyphBounds.length,panel.layout.lines.length);
    }
    release(group);
  }
});

test('unavailable native printed type rejects transactionally without retaining pixels',()=>{
  const fixture=canvasFixture(2);
  assert.throws(()=>createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory}),/Printed game sign text does not fit/);
  assert.equal(fixture.canvases.length,1);assert.equal(fixture.canvases[0].width,0);assert.equal(fixture.canvases[0].height,0);
});
