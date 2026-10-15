import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {shouldShowIntro} from '../src/introGate.js';

test('only the plain homepage waits for an explicit Enter', () => {
  for (const href of [
    'https://batikanor.com/',
    'https://batikanor.com/index.html',
    'https://staging.batikanor.com/?intro=1',
    'https://staging.batikanor.com/?intro=2',
    'https://batikanor.com/?utm_source=friend'
  ]) assert.equal(shouldShowIntro(href), true, href);

  for (const href of [
    'https://batikanor.com/?event=decarbon-days-climathon-2025',
    'https://batikanor.com/?event=unknown',
    'https://batikanor.com/?view=world',
    'https://batikanor.com/?view=list',
    'https://batikanor.com/?view=cv&download=cv',
    'https://batikanor.com/#tesla-gigathon-2026',
    'https://batikanor.com/cv/',
    'https://batikanor.com/projects/#some-project'
  ]) assert.equal(shouldShowIntro(href), false, href);
});

test('the introduction preserves the facts and offers achievements and live projects', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const intro = html.split('<section id="intro-screen"')[1].split('<div id="app">')[0];
  for (const removed of ['PREVIEW LAYOUT', 'Editorial', 'data-intro-variant',
    'intro-brand-dot', 'PORTFOLIO</span>', 'INTRODUCTION</span>', 'ABOUT MY WORK',
    'intro-fact-index', 'Explore the achievements on the map.']) {
    assert.ok(!intro.includes(removed), `${removed} should not appear in the introduction`);
  }
  for (const required of ['30+ competitions', 'juror and mentor', 'Software', 'Tooling',
    'Space tech', 'Biotech', 'Energy', 'Finance', 'AI', 'full-stack developer',
    'M&amp;A boutique based in Germany', 'entrepreneur', 'great ideas and great people']) {
    assert.ok(intro.includes(required), `${required} should appear in the introduction`);
  }
  assert.match(intro, /<ul class="intro-facts-list">/);
  assert.match(intro, /<ul class="intro-sector-list">/);
  assert.match(intro, /<span class="intro-enter-label">Explore achievements<\/span>/);
  assert.match(intro, /id="intro-achievements-map"[^>]*role="region"[^>]*aria-label="[^"]+"/);
  assert.ok(intro.indexOf('id="intro-achievements-map"')<intro.indexOf('id="intro-enter"'),
    'the achievement globe sits immediately above the exploration controls');
  assert.match(intro, /id="intro-live-projects"[^>]*href="\/\?view=live-projects"/);
  assert.ok(intro.includes('Explore live projects'));
  assert.match(intro, /id="intro-fallback-link"[^>]*href="\/projects\/"/);
  assert.ok(!intro.includes('view=list'), 'recovery uses the existing authored projects page');
});

test('cold entry cannot accept a click before its bootstrap handler is ready', async () => {
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/<button\b[^>]*id="intro-enter"[^>]*\bdisabled(?:\s|>)/);
  const listeners=new Map(),label={textContent:'Enter'};
  const enter={disabled:true,hidden:false,querySelector:()=>label,focus(){},
    addEventListener:(name,handler)=>listeners.set(name,handler)};
  const nodes={'intro-enter':enter,'intro-screen':{},app:{},'intro-fallback-link':{},
    'intro-load-status':{textContent:'',classList:{remove(){}}}};
  const history={state:null,replaceState(state){this.state=state;}};
  const context={document:{getElementById:id=>nodes[id],documentElement:{classList:{add(){}}}},
    history,location:{href:'https://staging.batikanor.com/'},requestAnimationFrame:callback=>callback()};
  const source=readFileSync(new URL('../src/intro.js',import.meta.url),'utf8')
    .replace(/^import '\.\/intro\.css';\s*/,'').replace(/^export /gm,'');
  runInNewContext(source,context);
  const entered=context.waitForIntroEntry();
  assert.equal(enter.disabled,false);
  assert.equal(typeof listeners.get('click'),'function');
  assert.equal(nodes.app.inert,true);
  assert.equal(history.state.earthIntroVisible,true);
  listeners.get('click')();
  assert.equal(JSON.stringify(await entered),'{}','ordinary entry makes no project selection');
  assert.equal(enter.disabled,true);
  assert.equal(label.textContent,'Opening…');
  assert.equal(history.state.earthIntroVisible,false);
  // Activation requests entry; only a useful map frame finishes the intro.
  assert.equal(nodes['intro-screen'].hidden,false);
});

test('a map selection shares the explicit entry gate and cannot replace an already chosen project',async()=>{
  const listeners=new Map(),label={textContent:'Explore achievements'};
  const enter={disabled:true,hidden:false,querySelector:()=>label,focus(){},
    addEventListener:(name,handler)=>listeners.set(name,handler)};
  const nodes={'intro-enter':enter,'intro-screen':{},app:{},'intro-fallback-link':{},
    'intro-load-status':{textContent:'',classList:{remove(){}}}};
  const history={state:{utm_source:'friend'},replaceState(state){this.state=state;}};
  const context={document:{getElementById:id=>nodes[id],documentElement:{classList:{add(){}}}},
    history,location:{href:'https://staging.batikanor.com/'},requestAnimationFrame:callback=>callback()};
  const source=readFileSync(new URL('../src/intro.js',import.meta.url),'utf8')
    .replace(/^import '\.\/intro\.css';\s*/,'').replace(/^export /gm,'');
  runInNewContext(source,context);
  assert.equal(context.requestIntroEntry({eventSlug:'tesla-gigathon-2026'}),false,
    'a marker cannot activate before the introduction gate exists');
  const entered=context.waitForIntroEntry({destination:'gallery'});
  assert.equal(context.requestIntroEntry({eventSlug:'tesla-gigathon-2026'}),true);
  assert.equal(JSON.stringify(await entered),'{"eventSlug":"tesla-gigathon-2026"}');
  assert.equal(context.requestIntroEntry({eventSlug:'decarbon-days-climathon-2026'}),false);
  listeners.get('click')();
  assert.equal(enter.disabled,true);assert.equal(label.textContent,'Opening…');
  assert.equal(nodes['intro-load-status'].textContent,'Opening the gallery…');
  assert.equal(history.state.earthIntroVisible,false);assert.equal(history.state.utm_source,'friend');
  assert.equal(nodes['intro-screen'].hidden,false,'the selected room still owns the readiness gate');
});
