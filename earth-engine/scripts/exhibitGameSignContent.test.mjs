import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {EXHIBIT_GAME_CATALOG} from '../src/exhibitGameCatalog.js';
import {EXHIBIT_GAME_SIGN_CONTENT,EXHIBIT_GAME_AI_DISCLAIMER,getExhibitGameSignContent} from '../src/exhibitGameSignContent.js';
import {createExhibitGameState as create,clickExhibitGame as click,stepExhibitGame as step,getExhibitGameSnapshot as snapshot} from '../src/exhibitGameSimulation.js';

const games=Object.values(EXHIBIT_GAME_CATALOG);
const printed=game=>getExhibitGameSignContent(game.slug).panels[0].lines.join(' ');
const angleDifference=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function until(game,state,predicate){
  for(let frame=0;frame<1800&&!predicate();frame++)step(game,state,{},1/60);
  assert.ok(predicate(),`${game.slug}: following the printed instruction must reach its physical objective`);
}

test('every existing project has two immutable passive game signs without modifying its catalog',()=>{
  const achievements=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url),'utf8'));
  assert.equal(achievements.length,32);
  assert.deepEqual(Object.keys(EXHIBIT_GAME_SIGN_CONTENT).sort(),achievements.map(a=>a.slug).sort());
  const original=JSON.stringify(EXHIBIT_GAME_CATALOG);
  for(const game of games){
    const content=getExhibitGameSignContent(game.slug);
    assert.equal(content.slug,game.slug);
    assert.equal(content.panels.length,2);
    assert.ok(Object.isFrozen(content)&&Object.isFrozen(content.panels));
    for(const panel of content.panels){
      assert.ok(Object.isFrozen(panel)&&Object.isFrozen(panel.lines));
      for(const field of ['id','action','href','onClick'])assert.equal(Object.hasOwn(panel,field),false);
      assert.throws(()=>panel.lines.push('changed'),TypeError);
    }
  }
  assert.equal(JSON.stringify(EXHIBIT_GAME_CATALOG),original);
  for(const slug of ['__proto__','constructor','toString','unknown',null,7])assert.equal(getExhibitGameSignContent(slug),null);
});

test('rules fit four short readable lines and every visible notice preserves the exact disclaimer',()=>{
  assert.equal(EXHIBIT_GAME_AI_DISCLAIMER,'This is just an AI-generated game. It does not represent anything Batıkan did at this event.');
  for(const content of Object.values(EXHIBIT_GAME_SIGN_CONTENT)){
    const [rules,notice]=content.panels;
    assert.equal(rules.title,'Game rules');assert.equal(rules.lines.length,4);
    assert.match(rules.lines[0],/^Click /);assert.equal(rules.lines[3],'WASD move, R reset');
    assert.equal(rules.text,rules.lines.join(' '));
    assert.equal(notice.title,'');assert.equal(notice.lines.length,6);
    assert.equal(notice.lines.join(' '),EXHIBIT_GAME_AI_DISCLAIMER);
    assert.equal(notice.text,EXHIBIT_GAME_AI_DISCLAIMER);
    for(const line of [...rules.lines,...notice.lines]){
      assert.ok(line.length>0&&line.length<=18,`${content.slug}: ${line}`);
      assert.equal(line,line.trim());assert.doesNotMatch(line,/[\r\n<>]|https?:\/\/|\{\{|\]\(/);
    }
    assert.doesNotMatch(rules.title+' '+rules.text+' '+notice.text,/Read excerpt|Read more|Open full project/);
  }
});

test('printed completion counts agree with the actual pieces, gates and relay route',()=>{
  const numbers={three:3,four:4,five:5,six:6,seven:7};let checked=0;
  for(const game of games){
    const claims=[...printed(game).matchAll(/\b(?:all|through)\s+(\d+|three|four|five|six|seven)\b/g)];
    for(const [,word] of claims){
      const count=numbers[word]??Number(word);
      const actual=game.mechanic==='routing'?game.route.length:['flight','trace','maze','morph'].includes(game.mechanic)?game.targets.length:game.objects.length;
      assert.equal(count,actual,`${game.slug}: printed objective count`);checked++;
    }
  }
  assert.ok(checked>=20,'counts cover the authored physical objectives rather than a vacuous check');
});

test('matching-mark and color-bay instructions correspond to visible identity and valid sockets',()=>{
  for(const game of games.filter(g=>['sort','delivery'].includes(g.mechanic))){
    const words=printed(game);
    assert.match(words,game.mechanic==='sort'?/mark/:/color bay/);
    for(const object of game.objects){
      const target=game.targets.find(t=>t.id===object.targetId);
      assert.ok(target);
      assert.equal(object.color,target.color);
      if(game.mechanic==='sort'){assert.ok(object.groupKind);assert.equal(object.groupKind,target.groupKind);}
      const state=create(game),wrong=game.targets.find(t=>t.id!==target.id);
      click(game,state,object.id);click(game,state,wrong.id);
      assert.equal(state.pendingTargetId,null,'a visually different socket must reject the piece');
      click(game,state,target.id);assert.equal(state.pendingTargetId,target.id);
    }
  }
});

test('glowing-slot and lit-gate instructions point to the next ordered objective',()=>{
  for(const game of games.filter(g=>['assembly','flight','trace','maze'].includes(g.mechanic))){
    assert.match(printed(game),game.mechanic==='assembly'?/glowing slot/:/lit (?:gates|rings)/);
    const state=create(game),first=game.targets[0];
    assert.equal(snapshot(game,state).targets.find(t=>t.id===first.id).glow,.55);
    if(game.mechanic==='assembly'){
      const last=game.objects.at(-1);click(game,state,last.id);click(game,state,last.targetId);
      assert.equal(state.pendingTargetId,null,'an out-of-order part cannot fill a later socket');
      const piece=game.objects.find(o=>o.id===game.order[0]);
      assert.equal(piece.targetId,first.id);click(game,state,piece.id);click(game,state,first.id);
    }else click(game,state,first.id);
    until(game,state,()=>state.stage===1);
    assert.equal(snapshot(game,state).targets.find(t=>t.id===game.targets[1].id).glow,.55);
    assert.equal(state.completed,false);
  }
});

test('turn and arrow-alignment instructions match physical rotations required for completion',()=>{
  for(const game of games.filter(g=>g.mechanic==='optics')){
    assert.match(printed(game),/Align both arrows.*Light the receiver/);
    const nodes=game.objects.filter(o=>o.opticalNode),state=create(game);
    if(printed(game).includes('each camera'))assert.ok(nodes.every(o=>o.kind==='camera'));
    assert.ok(game.targets.some(t=>t.id==='receiver'));
    for(const node of nodes){
      assert.ok(Number.isFinite(node.targetRotation)&&node.turnStep>0);
      for(let n=0;angleDifference(state.objects.find(o=>o.id===node.id).rotation,node.targetRotation)>.04&&n<8;n++)click(game,state,node.id);
    }
    assert.equal(state.completed,false,'aligned arrows still need their stable visible light flow');
    until(game,state,()=>state.completed);assert.equal(state.targets.find(t=>t.id==='receiver').complete,true);
  }
  const game=games.find(g=>g.mechanic==='morph'),state=create(game);
  assert.match(printed(game),/Click again: turn/);
  for(const tile of game.objects){
    click(game,state,tile.id);click(game,state,tile.targetId);
    assert.equal(state.pendingTargetId,null,'an unturned map tile cannot fit');
    click(game,state,tile.id);
    assert.ok(angleDifference(state.objects.find(o=>o.id===tile.id).rotation,tile.targetRotation)<.04);
    click(game,state,tile.targetId);assert.equal(state.pendingTargetId,tile.targetId);
  }
});

test('ring-count and charge-cycle instructions describe feasible displayed resource goals',()=>{
  const nouns={pitchOrb:'orb',droplet:'droplet',crystal:'crystal',book:'book'};
  for(const game of games.filter(g=>g.mechanic==='balance')){
    assert.match(printed(game),/Match ring counts/);
    assert.ok(game.objects.every(o=>o.resource&&printed(game).includes(nouns[o.kind])));
    assert.equal(game.objects.length,game.targets.reduce((n,t)=>n+t.targetLevel,0));
    for(const target of game.targets)assert.ok(Number.isInteger(target.targetLevel)&&target.targetLevel>0&&target.capacity>=target.targetLevel);
  }
  for(const game of games.filter(g=>g.mechanic==='energy')){
    assert.match(printed(game),/Cycle (?:its|their) charge.*Match load rings/);
    const state=create(game),source=game.objects[0];
    for(const expected of [1,2,3,0]){click(game,state,source.id);assert.equal(state.objects[0].level,expected);}
    let feasible=false;
    for(let a=0;a<=3;a++)for(let b=0;b<=3;b++)for(let c=0;c<=3;c++){
      const levels=[a,b,c];
      if(game.targets.every(t=>game.objects.reduce((n,o,i)=>n+levels[i]*(o.channels.find(ch=>ch.targetId===t.id)?.weight??0),0)===t.targetLevel))feasible=true;
    }
    assert.ok(feasible,`${game.slug}: every displayed ring-count goal must be reachable simultaneously`);
  }
});

test('rail-arrow instructions switch the actual relay branches and visit every node before winning',()=>{
  for(const game of games.filter(g=>g.mechanic==='routing')){
    assert.match(printed(game),/Click rail arrows.*Visit all 5 nodes/);
    const state=create(game);
    for(let i=0;i<game.route.length-1;i++){
      const node=state.objects.find(o=>o.id===game.route[i]);
      assert.ok(node.exits.includes(game.route[i+1]));
      if(node.exits.length>1){
        const before=node.exit;click(game,state,node.id);assert.notEqual(node.exit,before);
        while(node.exits[node.exit]!==game.route[i+1])click(game,state,node.id);
      }
    }
    until(game,state,()=>state.completed);
    assert.deepEqual(state.routeVisited,game.route);
  }
});
