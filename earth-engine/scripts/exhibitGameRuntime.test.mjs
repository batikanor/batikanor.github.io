import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getExhibitGame} from '../src/exhibitGameCatalog.js';
import {createExhibitGameRuntime} from '../src/exhibitGameRuntime.js';
import {createExhibitGameAttachment} from '../src/exhibitGameAttachment.js';
import * as THREE from 'three';

test('a physical click starts movement on the first frame, completes deliveries and lets the shared renderer sleep',()=>{
  const runtime=createExhibitGameRuntime('tesla-gigathon-2026');
  const config=getExhibitGame('tesla-gigathon-2026');let clock=0;
  try {
    assert.equal(runtime.render(clock),false);
    for(const cargo of config.objects){
      runtime.click(cargo.id);runtime.click(cargo.targetId);
      assert.equal(runtime.render(clock),true,'zero delta must still schedule pending click movement');
      for(let frame=0;frame<2400&&!runtime.getSnapshot().objects.find(object=>object.id===cargo.id).complete;frame++)runtime.render(clock+=1000/60);
      assert.equal(runtime.getSnapshot().objects.find(object=>object.id===cargo.id).complete,true);
    }
    assert.equal(runtime.getStats().completed,true);assert.equal(runtime.getStats().progress,1);
    for(let frame=0;frame<400;frame++)runtime.render(clock+=1000/60);
    assert.equal(runtime.render(clock+=1000/60),false,'movement and celebration must both end');
  }finally{runtime.destroy();runtime.destroy();}
  assert.equal(runtime.getStats().destroyed,true);assert.equal(runtime.root.children.length,0);
});

test('the final optical alignment continues its physical hold without a pressed key or an external animation loop',()=>{
  const slug='hong-kong-talent-engage-eurotech-healthtech-2026',config=getExhibitGame(slug),runtime=createExhibitGameRuntime(slug);
  let clock=0;
  try{
    runtime.render(clock);
    for(const node of config.objects.filter(object=>object.opticalNode)){
      for(let turns=0;turns<8&&!runtime.getSnapshot().objects.find(object=>object.id===node.id).complete;turns++)runtime.click(node.id);
    }
    let requested=true;
    for(let frame=0;frame<600&&requested;frame++)requested=runtime.render(clock+=1000/60);
    assert.equal(runtime.getStats().completed,true);assert.equal(requested,false);
  }finally{runtime.destroy();}
});

test('pending scene loads cannot revive a stopped game, and a rebuilt host receives the same visit state without double disposal',async()=>{
  let slug='tesla-gigathon-2026',host=new THREE.Group(),toggles=[];
  const attachment=createExhibitGameAttachment({getSlug:()=>slug,getHost:()=>host,getDemo:()=>[],
    getCanvas:()=>({clientWidth:1000,clientHeight:700}),getProjection:()=>new THREE.Matrix4(),canRender:()=>true,
    onActiveChange:(active,owner)=>toggles.push({active,owner}),floor:[0,7.28,0]});
  const cancelled=attachment.start(slug);attachment.stop();assert.equal(await cancelled,false);
  assert.equal(attachment.getStats().active,false);assert.equal(host.children.length,0);
  await attachment.start(slug);const original=host.children[0];assert.equal(original.position.y,7.28);
  attachment.click('cargo-0');assert.equal(attachment.getStats().active,true);
  attachment.detach();assert.equal(host.children.length,0);host=new THREE.Group();attachment.render(0);
  assert.equal(host.children[0],original,'a context rebuild reattaches the existing state and resource owner');
  assert.equal(attachment.getStats().active,true);attachment.destroy();assert.equal(host.children.length,0);
  attachment.revive();assert.equal(await attachment.start(slug),true);attachment.destroy();
  assert.equal(toggles.filter(toggle=>toggle.active).length,3);
});
