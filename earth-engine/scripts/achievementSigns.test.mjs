import assert from 'node:assert/strict';
import {test} from 'node:test';
import * as THREE from 'three';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {authoredSignProse,selectAchievementSignContent,createAchievementSigns,updateAchievementSigns} from '../src/achievementSigns.js';

function canvasFixture(){
  const canvases=[];
  const canvasFactory=(width,height)=>{
    const calls=[];let font='10px Arial';
    const context={calls,get font(){return font;},set font(value){font=value;},
      fillRect(...args){calls.push({kind:'fillRect',args,fill:this.fillStyle});},
      strokeRect(...args){calls.push({kind:'strokeRect',args});},
      measureText(text){return {width:text.length*parseInt(font,10)*.52};},
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

test('all 32 signs use authored portfolio titles and literal source excerpts, with no inferred exhibition names',()=>{
  assert.equal(contestsAndActivities.length,32);
  for(const project of contestsAndActivities){
    const content=selectAchievementSignContent(project);
    assert.equal(content.slug,project.slug);assert.equal(content.title,authoredSignProse(project.title));
    assert.equal(content.source,'portfolio-authored');
    assert.ok(authoredSignProse(project.shortDescription).includes(content.summary));
    assert.ok(authoredSignProse(project.longDescription).includes(content.detail),`${project.slug}: detail is not original prose`);
    assert.ok(content.summary.length<=150);assert.ok(content.detail.length<=190);
    assert.ok(content.detail.length>=30);assert.ok(Object.isFrozen(content));
    assert.ok(!/\{\{|gdrive_embed\[|<iframe|!\[|\]\(https?:/.test([content.summary,content.detail].join('\n')));
  }
});

test('Tesla text is exact existing title, description and first original explanatory sentence',()=>{
  const content=selectAchievementSignContent(tesla);
  assert.equal(content.title,'1st Place at Tesla Gigathon 2026');
  assert.equal(content.summary,tesla.shortDescription);
  assert.equal(content.detail,'I teamed up with people I met for the first time, as I have in many other competitions I won in the past, and we won 1st place at this supply chain and logistics-focused competition.');
});

test('plain source extraction excludes embeds/media/code and retains real linked prose without its URL',()=>{
  const original='**Original title**\n\nI built [a real tool](https://example.org/tool_(v2)) using `Python`.\n\n{{gdrive_embed[0]}}\n\n![Photograph](https://example.org/photo.jpg)\n\n```js\nnot prose\n```\n\n<iframe src="https://example.org/">Embedded text</iframe>\n\nOriginal final sentence.';
  assert.equal(authoredSignProse(original),'Original title\n\nI built a real tool using Python.\n\nOriginal final sentence.');
  assert.throws(()=>selectAchievementSignContent({slug:'invented'}),/authored/);
});

test('canvas native fonts and scene resources stay bounded to two active panels without network or extra title canvases',()=>{
  const fixture=canvasFixture();const group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  assert.equal(fixture.canvases.length,2);assert.equal(group.userData.textures.length,2);
  assert.equal(group.userData.texturePixels,1_310_720);assert.equal(group.userData.textureBytes,5_242_880);
  assert.equal(group.userData.content.title,tesla.title);assert.equal(group.userData.authored,true);
  assert.equal(group.userData.triangles,92);assert.equal(group.userData.drawCalls,5);
  assert.equal(group.userData.panels.length,2);assert.equal(group.visible,false);
  for(const canvas of fixture.canvases){
    assert.equal(canvas.width,1024);assert.equal(canvas.height,640);
    const textCalls=canvas.context.calls.filter(call=>call.kind==='text');
    assert.ok(textCalls.some(call=>call.font.includes('Georgia')));assert.ok(textCalls.some(call=>call.font.includes('Arial')));
    assert.ok(textCalls.every(call=>call.fill==='#f5f3eb'));
    assert.equal(canvas.context.calls.find(call=>call.kind==='fillRect').fill,'#112227');
  }
  for(const panel of group.userData.panels){
    assert.equal(panel.material.side,THREE.FrontSide,'no mirrored backside text');
    assert.equal(panel.material.toneMapped,false);assert.equal(panel.material.map.colorSpace,THREE.SRGBColorSpace);
    assert.equal(panel.material.map.generateMipmaps,false);
    assert.equal(panel.material.map.repeat.x,-1);assert.equal(panel.material.map.offset.x,1);
    assert.equal(panel.material.map.flipY,true,'Canvas Y orientation remains native/upright');
    assert.deepEqual(panel.head.position.toArray().filter((_,index)=>index!==0),[2.7,-8]);
  }
  assert.deepEqual(group.userData.panels.map(panel=>panel.head.position.x),[-7,7]);release(group);
});

test('all authored text fits the capped native canvases without silently dropping the selected source excerpt',()=>{
  for(const project of contestsAndActivities){
    const fixture=canvasFixture(),group=createAchievementSigns(project,{canvasFactory:fixture.canvasFactory});
    for(const [index,panel] of group.userData.panels.entries()){
      assert.equal(panel.layout.overflow,false,`${project.slug}: panel${index} overflow`);
      const text=fixture.canvases[index].context.calls.filter(call=>call.kind==='text').map(call=>call.text).join(' ');
      assert.ok(text.includes(group.userData.content.title),`${project.slug}: original title clipped`);
      assert.ok(text.includes(panel.text),`${project.slug}: original excerpt clipped`);
    }
    release(group);
  }
});

test('proximity LOD changes only opacity/head orientation, never redraws textures or billboards the poles',()=>{
  const fixture=canvasFixture(),group=createAchievementSigns(tesla,{canvasFactory:fixture.canvasFactory});
  const canvases=fixture.canvases.map(canvas=>canvas.context.calls.length),textures=[...group.userData.textures];
  const poles=group.children.find(child=>child.isInstancedMesh),poleMatrix=poles.instanceMatrix.array.slice();
  const positions=group.userData.panels.map(panel=>panel.head.position.toArray());
  assert.equal(updateAchievementSigns(group,{zoom:16,distanceM:20}).visible,false);
  assert.equal(updateAchievementSigns(group,{zoom:17.3,distanceM:180}).readable,false);
  const ready=updateAchievementSigns(group,{zoom:20,distanceM:30,bearing:90,pitch:65});
  assert.equal(ready.visible,true);assert.equal(ready.readable,true);assert.equal(ready.opacity,1);
  group.userData.panels.forEach((panel,index)=>{
    assert.deepEqual(panel.head.position.toArray(),positions[index]);assert.equal(panel.head.rotation.y,Math.PI*1.5);
    assert.ok(Math.abs(panel.head.rotation.x+25*Math.PI/180)<1e-9);
  });
  assert.deepEqual([...poles.instanceMatrix.array],[...poleMatrix]);
  assert.deepEqual(group.userData.textures,textures);assert.deepEqual(fixture.canvases.map(canvas=>canvas.context.calls.length),canvases);
  assert.equal(updateAchievementSigns(group,{zoom:20,distanceM:300}).visible,false);
  assert.equal(updateAchievementSigns(group,{zoom:20,distanceM:20,visible:false}).visible,false);
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


test('Salzburg sign quotes the actual EEG headband pipeline, not its hypothetical marketing preamble',()=>{
  const project=contestsAndActivities.find(project=>project.slug==='salzburg-tourism-2024');
  const content=selectAchievementSignContent(project);
  assert.match(content.detail,/^1\) You use a Muse 2 headband/);
  assert.ok(authoredSignProse(project.longDescription).includes(content.detail));
  assert.ok(!content.detail.includes('Assume you are working'));
});

test('a truncated excerpt receives a visual ellipsis without altering the authored content string',()=>{
  const project=contestsAndActivities.find(project=>project.slug==='tech-berlin-ai-hackathon-2');
  const fixture=canvasFixture(),group=createAchievementSigns(project,{canvasFactory:fixture.canvasFactory});
  const content=group.userData.content;assert.equal(content.detailTruncated,true);assert.ok(!content.detail.endsWith('…'));
  const drawn=fixture.canvases[1].context.calls.filter(call=>call.kind==='text').map(call=>call.text).join(' ');
  assert.ok(drawn.includes(`${content.detail}…`));
  assert.ok(authoredSignProse(project.longDescription).includes(content.detail));release(group);
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
  updateAchievementSigns(group,{zoom:20,distanceM:0});
  for(const panel of group.userData.panels){assert.equal(panel.material.depthWrite,true);assert.equal(panel.plane.renderOrder,2);assert.equal(panel.head.children[0].renderOrder,1);}
  updateAchievementSigns(group,{zoom:17.2,distanceM:0});
  assert.ok(group.userData.panels.every(panel=>panel.material.depthWrite===false));release(group);
});
