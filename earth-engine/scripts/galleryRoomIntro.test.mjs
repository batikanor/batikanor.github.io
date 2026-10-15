import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {shouldShowIntro} from '../src/introGate.js';
import {readPortfolioRoute} from '../src/portfolioRoute.js';

const achievements=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url),'utf8'));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const classifier=/<script>\s*([\s\S]*?)<\/script>/.exec(html)?.[1];
assert.ok(classifier,'the entry classifier is the first inline head script');
const intro=readFileSync(new URL('../src/intro.js',import.meta.url),'utf8')
  .replace(/^import '\.\/intro\.css';\s*/,'').replace(/^export /gm,'');
// Execute the shipped start(), including its top-level failure handler. Only
// module loading is injected; the entry, preparation and readiness logic is real.
const bootstrap=readFileSync(new URL('../src/bootstrap.js',import.meta.url),'utf8')
  .replace(/^import[^\n]+\n/gm,'')
  .replace(/\bimport\((['"])([^'"]+)\1\)/g,(_match,_quote,path)=>`importModule(${JSON.stringify(path)})`)
  .replace(/\nstart\(\)\.catch\(/,'\nglobalThis.bootstrapDone=start().catch(');
assert.ok(bootstrap.includes('globalThis.bootstrapDone='),'capture the actual bootstrap completion promise');

function classes(){
  const values=new Set();
  return {add(...names){names.forEach(name=>values.add(name));},remove(...names){names.forEach(name=>values.delete(name));},
    contains:name=>values.has(name),values};
}
function classify(href,experience='gallery'){
  const classList=classes(),documentElement={dataset:{portfolioExperience:experience},classList};
  vm.runInNewContext(classifier,{URL,location:{href},document:{documentElement}});
  return classList;
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};}

function fixture({href='https://staging.batikanor.com/',experience='gallery',webgl=true,
  autoRuntime=true,readyOnImport=false,importError=null,mapImportError=null}={}){
  const calls={imports:[],start:[],activate:[],finish:[],wait:[],cv:0,errors:[],replaced:[],focus:[],disposed:0,gpuContexts:0};
  const listeners=new Map(),timers=new Map(),rafs=new Map();let clock=0,nextId=0,done=false;
  function target(id){
    const own=new Map();
    return {id,hidden:false,inert:false,disabled:false,textContent:'',dataset:{},style:{},classList:classes(),
      addEventListener(name,handler){if(!own.has(name))own.set(name,[]);own.get(name).push(handler);},
      dispatch(name){for(const handler of own.get(name)||[])handler({type:name,target:this});},
      focus(){calls.focus.push(id);},querySelector(){return label;}};
  }
  const label={textContent:'Enter'};
  const nodes=Object.fromEntries(['intro-screen','intro-enter','app','intro-fallback-link','intro-load-status','journey-current','status'].map(id=>[id,target(id)]));
  nodes['intro-enter'].disabled=/<button\b[^>]*id="intro-enter"[^>]*\bdisabled(?:\s|>)/.test(html);
  nodes['intro-fallback-link'].hidden=true;
  const classList=classes(),documentElement={dataset:{portfolioExperience:experience},classList};
  const location={href,replace(value){calls.replaced.push(String(value));this.href=String(value);}};
  Object.defineProperty(location,'search',{get(){return new URL(this.href).search;}});
  const history={state:null,replaceState(state,_title,url){this.state=state;if(url)location.href=String(url);}};
  const addEventListener=(name,handler,options={})=>{
    if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push({handler,once:!!options.once});
  };
  const removeEventListener=(name,handler)=>listeners.set(name,(listeners.get(name)||[]).filter(item=>item.handler!==handler));
  const emit=name=>{
    for(const item of [...listeners.get(name)||[]]){
      if(item.once)removeEventListener(name,item.handler);item.handler({type:name});
    }
  };
  const startup=deferred();
  const api={root:{inert:true},activate(){
    calls.activate.push({introHidden:nodes['intro-screen'].hidden,introActive:classList.contains('intro-active'),appInert:nodes.app.inert});
    this.root.inert=false;
  },dispose(){calls.disposed++;nodes.app.inert=false;}};
  const context=vm.createContext({URL,URLSearchParams,shouldShowIntro,readPortfolioRoute,achievements,location,history,
    console:{error(...items){calls.errors.push(items);}},
    document:{documentElement,getElementById:id=>nodes[id],createElement(tag){
      assert.equal(tag,'canvas');return{getContext(name){assert.equal(name,'webgl2');calls.gpuContexts++;
        return webgl?{getExtension:()=>({loseContext(){}})}:null;}};
    }},
    addEventListener,removeEventListener,
    requestAnimationFrame(callback){rafs.set(++nextId,callback);return nextId;},
    setTimeout(callback,delay){timers.set(++nextId,{callback,due:clock+delay});return nextId;},
    clearTimeout(id){timers.delete(id);},
    async importModule(path){
      calls.imports.push(path);
      if(path==='./galleryRoom.js'){
        calls.readinessSubscribedAtImport=(listeners.get('gallery-room-ready')||[]).length>0;
        if(readyOnImport)emit('gallery-room-ready');
        if(importError)throw importError;
        return {startGalleryRoom(options={}){
          calls.start.push({deferActivation:options.deferActivation??false});
          api.root.inert=!!options.deferActivation;context.__galleryRoom=api;
          if(!options.deferActivation)api.activate();
          return startup.promise;
        }};
      }
      if(path==='./cvOnly.js')return{startCvOnly(){calls.cv++;}};
      if(path==='./main.js'){if(mapImportError)throw mapImportError;return{};}
      throw new Error(`Unexpected runtime import: ${path}`);
    }
  });
  context.window=context;
  vm.runInContext(classifier,context,{filename:'index.html:inline-classifier'});
  vm.runInContext(intro,context,{filename:'intro.js'});
  const finish=context.finishIntro,wait=context.waitForIntroEntry;
  context.finishIntro=options=>{calls.finish.push(options?{keepAppInert:options.keepAppInert,focusTarget:options.focusTarget}:null);return finish(options);};
  context.waitForIntroEntry=options=>{calls.wait.push(options?.destination??'map');return wait(options);};
  if(autoRuntime)startup.resolve(api);
  vm.runInContext(bootstrap,context,{filename:'bootstrap.js'});
  context.bootstrapDone.then(()=>{done=true;});
  return{calls,nodes,label,classList,history,location,api,listeners,get done(){return done;},
    async frame(){clock+=16;const pending=[...rafs.values()];rafs.clear();pending.forEach(callback=>callback(clock));await settle();},
    async paint(){await this.frame();await this.frame();},
    async advance(ms){clock+=ms;let pending;do{pending=[...timers].filter(([,timer])=>timer.due<=clock);
      pending.forEach(([id,timer])=>{timers.delete(id);timer.callback();});await settle();}while(pending.length);},
    async enter(){const enter=nodes['intro-enter'];if(!enter.disabled&&!enter.hidden)enter.dispatch('click');await settle();},
    async ready(name='gallery-room-ready'){emit(name);await settle();},
    async resolveRuntime(){startup.resolve(api);await settle();},
    async rejectRuntime(error=new Error('renderer startup failed')){startup.reject(error);await settle();}
  };
}

test('the actual head classifier paints the gallery homepage intro before pending state and skips deep links',()=>{
  const rows=[
    ['/',true,false],['/index.html',true,false],['/?utm_source=friend',true,false],['/?prototype=room',true,false],
    ['/?event=tesla-gigathon-2026',false,true],['/?event=unknown',false,true],['/#tesla-gigathon-2026',false,true],
    ['/?view=world',false,true],['/projects/#solana-2024',false,true],
    ['/?view=cv',false,false],['/#cv',false,false],['/cv/',false,false],['/cv/en/',false,false],
    ['/?view=list',false,true],['/?view=cv&download=cv',false,false],['/?download=cv',false,false]
  ];
  for(const[path,introActive,pending]of rows){const c=classify(`https://batikanor.com${path}`);
    assert.equal(c.contains('gallery-experience'),true,path);assert.equal(c.contains('intro-active'),introActive,path);
    assert.equal(c.contains('gallery-pending'),pending,path);}
  for(const[experience,path,gallery,introActive]of[['earth','/',false,true],['earth','/?prototype=room',true,true],
    ['gallery','/?experience=earth',false,true],['earth','/?event=tesla-gigathon-2026',false,false]]){
    const c=classify(`https://batikanor.com${path}`,experience);
    assert.equal(c.contains('gallery-experience'),gallery);assert.equal(c.contains('intro-active'),introActive);
    assert.equal(c.contains('gallery-pending'),false);
  }
});

test('every standalone CV alias hides map controls before the runtime and skips gallery loading',()=>{
  for(const experience of ['gallery','earth'])for(const path of ['/cv','/cv/','/cv/index.html','/cv/en','/cv/en/',
    '/cv/en/index.html','/?view=cv','/#cv','/#%63v','/?download=cv']){
    const c=classify(`https://staging.batikanor.com${path}`,experience);
    assert.equal(c.contains('cv-page'),true,path);
    assert.equal(c.contains('intro-active'),false,path);
    assert.equal(c.contains('gallery-pending'),false,path);
  }
});

test('a room and useful frame prepared before Enter remain inert until explicit entry and then activate once',async()=>{
  const f=fixture({readyOnImport:true});
  assert.equal(f.calls.start.length,0);assert.equal(f.nodes.app.inert,true);assert.equal(f.nodes['intro-screen'].hidden,false);
  await f.frame();assert.equal(f.calls.start.length,0,'one paint is insufficient to start the room');
  await f.frame();assert.deepEqual(f.calls.start,[{deferActivation:true}]);
  assert.equal(f.calls.readinessSubscribedAtImport,true,'synchronous module readiness cannot be missed');
  assert.equal(f.api.root.inert,true);assert.equal(f.done,false);
  await f.advance(20000);assert.equal(f.calls.activate.length,0,'time never replaces explicit Enter');
  await f.enter();assert.equal(f.done,true);assert.equal(f.calls.activate.length,1);
  assert.deepEqual(f.calls.finish,[{keepAppInert:true,focusTarget:null}]);
  assert.deepEqual(f.calls.activate,[{introHidden:true,introActive:false,appInert:true}]);
  assert.equal(f.calls.focus.includes('journey-current'),false,'hidden classic chronology never takes gallery focus');
  await f.enter();await f.ready();assert.equal(f.calls.activate.length,1);
});

test('Enter before preparation still waits for both the runtime API and the first useful room frame',async()=>{
  const f=fixture({autoRuntime:false});
  await f.enter();assert.equal(f.history.state.earthIntroVisible,false);assert.equal(f.done,false);
  assert.equal(f.calls.imports.length,0);await f.paint();assert.deepEqual(f.calls.start,[{deferActivation:true}]);
  await f.ready();assert.equal(f.calls.activate.length,0,'a frame without a finished runtime API is insufficient');
  assert.equal(f.api.root.inert,true);assert.equal(f.nodes['intro-screen'].hidden,false);
  await f.advance(20000);assert.equal(f.calls.activate.length,0,'the safety timer cannot replace the unfinished runtime');
  await f.resolveRuntime();assert.equal(f.done,true);assert.equal(f.calls.activate.length,1);
});

test('a ready runtime cannot dismiss Enter while its first useful frame is missing',async()=>{
  const f=fixture();await f.paint();await f.enter();
  assert.equal(f.calls.activate.length,0);assert.equal(f.calls.finish.length,0);assert.equal(f.done,false);
  assert.equal(f.nodes['intro-screen'].hidden,false);assert.equal(f.api.root.inert,true);
  await f.ready();assert.equal(f.calls.activate.length,1);assert.equal(f.done,true);
  assert.equal((f.listeners.get('gallery-room-ready')||[]).length,0);
});

test('missing frame safety activates only after Enter and runtime completion, at the actual ten-second bound',async()=>{
  const f=fixture();await f.paint();await f.enter();await f.advance(9999);
  assert.equal(f.calls.activate.length,0);assert.equal(f.nodes['intro-screen'].hidden,false);
  await f.advance(1);assert.equal(f.calls.activate.length,1);assert.equal(f.done,true);
  assert.equal((f.listeners.get('gallery-room-ready')||[]).length,0);
});

test('a suspended animation clock can prepare after the paint timeout without auto-entering',async()=>{
  const f=fixture({readyOnImport:true});
  await f.advance(249);assert.equal(f.calls.start.length,0);
  await f.advance(1);assert.deepEqual(f.calls.start,[{deferActivation:true}]);
  assert.equal(f.calls.activate.length,0);assert.equal(f.nodes['intro-screen'].hidden,false);
  await f.enter();assert.equal(f.calls.activate.length,1);assert.equal(f.done,true);
});

test('gallery import and renderer failures retain the intro and expose the authored projects recovery link',async()=>{
  for(const failure of['import','runtime'])for(const enterFirst of[false,true]){
    const f=fixture({autoRuntime:failure!=='runtime',importError:failure==='import'?new Error('module unavailable'):null});
    if(enterFirst)await f.enter();await f.paint();if(failure==='runtime')await f.rejectRuntime();
    assert.equal(f.calls.activate.length,0);assert.equal(f.nodes['intro-screen'].hidden,false);
    assert.equal(f.classList.contains('intro-active'),true);assert.equal(f.nodes.app.inert,true);
    assert.equal(f.nodes['intro-enter'].hidden,true);assert.equal(f.nodes['intro-fallback-link'].hidden,false);
    assert.equal(f.nodes['intro-load-status'].classList.contains('is-error'),true);
    assert.ok(f.nodes['intro-load-status'].textContent.length>0);assert.deepEqual(f.calls.replaced,[]);
    assert.equal(f.calls.focus.at(-1),'intro-fallback-link','the visible escape link receives keyboard focus');
    assert.equal((f.listeners.get('gallery-room-ready')||[]).length,0,'a failed preparation releases its readiness listener');
    await f.advance(20000);await f.ready();assert.equal(f.calls.activate.length,0);assert.equal(f.calls.finish.length,0);
    if(failure==='runtime')assert.equal(f.calls.disposed,1,'a partially prepared room is disposed');
  }
});

test('gallery project query/hash deep links start directly without deferred input or an Enter gate',async()=>{
  for(const path of['/?event=tesla-gigathon-2026','/#tesla-gigathon-2026','/?view=world']){
    const f=fixture({href:`https://staging.batikanor.com${path}`});await settle();
    assert.deepEqual(f.calls.start,[{deferActivation:false}]);assert.equal(f.calls.wait.length,0);
    assert.equal(f.nodes['intro-screen'].hidden,true);assert.equal(f.calls.activate.length,1);assert.equal(f.done,true);
    assert.equal(f.calls.readinessSubscribedAtImport,false);assert.equal(f.calls.finish.length,0);
  }
});

test('CV aliases and downloads bypass the room, intro and GPU checks',async()=>{
  for(const experience of['gallery','earth'])for(const path of['/?view=cv','/cv/','/cv/en/',
    '/cv/index.html','/cv/en/index.html','/#cv','/#%63v','/?view=cv&download=cv','/?download=cv']){
    const f=fixture({experience,href:`https://staging.batikanor.com${path}`,webgl:false});await settle();
    assert.equal(f.calls.start.length,0);assert.equal(f.calls.wait.length,0);assert.equal(f.done,true);
    assert.equal(f.nodes['intro-screen'].hidden,true);assert.equal(f.calls.gpuContexts,0);
    assert.equal(f.calls.cv,1,path);assert.deepEqual(f.calls.imports,['./cvOnly.js']);
    assert.deepEqual(f.calls.replaced,[]);
  }
});

test('retired list-view URLs normalize without losing project, CV, hash or tracking information',async()=>{
  for(const experience of['gallery','earth'])for(const suffix of[
    '?view=list','?view=list&event=tesla-gigathon-2026&utm_source=old',
    '?utm_source=cv&view=list#tesla-gigathon-2026','?view=list#cv',
    '?view=list&download=cv&utm_source=cv'
  ]){
    const href=`https://staging.batikanor.com/${suffix}`;
    const f=fixture({experience,href,webgl:false});await settle();
    const expected=new URL(href);expected.searchParams.delete('view');
    assert.deepEqual(f.calls.replaced,[expected.href]);
    assert.deepEqual(f.calls.imports,[]);assert.equal(f.calls.gpuContexts,0);
    assert.equal(f.calls.wait.length,0);assert.equal(f.done,true);
  }
});

test('no-GPU homepages keep the introduction until Enter, then open existing projects',async()=>{
  for(const experience of['gallery','earth']){
    const f=fixture({experience,webgl:false,href:'https://staging.batikanor.com/?utm_source=friend'});await f.paint();
    assert.deepEqual(f.calls.wait,[experience==='gallery'?'gallery':'map']);assert.equal(f.calls.start.length,0);
    assert.deepEqual(f.calls.imports,[]);assert.equal(f.nodes['intro-screen'].hidden,false);
    assert.equal(f.done,false);assert.deepEqual(f.calls.replaced,[]);
    await f.advance(20000);assert.deepEqual(f.calls.replaced,[]);assert.equal(f.calls.finish.length,0);
    await f.enter();assert.equal(f.done,true);
    assert.deepEqual(f.calls.replaced,['https://staging.batikanor.com/projects/?utm_source=friend']);
    assert.equal(f.calls.activate.length,0);
  }
});

test('no-GPU deep links open their existing authored achievement page, or the projects index',async()=>{
  for(const experience of['gallery','earth'])for(const project of achievements)for(const selection of[
    `?event=${project.slug}&utm_source=old`, `?utm_source=old#${project.slug}`
  ]){
    const f=fixture({experience,href:`https://staging.batikanor.com/${selection}`,webgl:false});await settle();
    assert.equal(f.calls.wait.length,0);assert.deepEqual(f.calls.imports,[]);assert.equal(f.done,true);
    assert.deepEqual(f.calls.replaced,[`https://staging.batikanor.com/achievements/${project.slug}/?utm_source=old`]);
  }
  for(const selection of['?event=unknown','?view=world','#unknown']){
    const f=fixture({href:`https://staging.batikanor.com/${selection}`,webgl:false});await settle();
    assert.deepEqual(f.calls.replaced,['https://staging.batikanor.com/projects/']);
  }
});

test('failed gallery and classic map deep links recover to the selected authored project',async()=>{
  for(const experience of['gallery','earth'])for(const selection of[
    '?event=tesla-gigathon-2026&utm_source=old','#tesla-gigathon-2026','?event=unknown'
  ]){
    const f=fixture({experience,href:`https://staging.batikanor.com/${selection}`,
      importError:new Error('gallery unavailable'),mapImportError:new Error('map unavailable')});await settle();
    const path=selection.includes('tesla')?'/achievements/tesla-gigathon-2026/':'/projects/';
    const tracking=selection.includes('utm_source')?'?utm_source=old':'';
    assert.deepEqual(f.calls.replaced,[`https://staging.batikanor.com${path}${tracking}`]);
    assert.equal(f.calls.wait.length,0);assert.equal(f.calls.errors.length,1);
  }
});

test('failed classic map preparation preserves the intro and explicit projects recovery',async()=>{
  const f=fixture({experience:'earth',mapImportError:new Error('map unavailable')});await f.paint();
  assert.deepEqual(f.calls.replaced,[]);assert.equal(f.nodes['intro-screen'].hidden,false);
  assert.equal(f.nodes['intro-enter'].hidden,true);assert.equal(f.nodes['intro-fallback-link'].hidden,false);
  assert.equal(f.calls.focus.at(-1),'intro-fallback-link');
  await f.advance(20000);assert.deepEqual(f.calls.replaced,[]);assert.equal(f.calls.finish.length,0);
});

test('classic Earth entry keeps its original Enter/frame ordering and direct project behavior',async()=>{
  for(const readyFirst of[false,true]){
    const f=fixture({experience:'earth'});await f.paint();assert.deepEqual(f.calls.imports,['./main.js']);
    assert.deepEqual(f.calls.wait,['map']);assert.equal(f.calls.start.length,0);
    if(readyFirst)await f.ready('earth-ready');else await f.enter();
    assert.equal(f.calls.finish.length,0,'both explicit Enter and map readiness are required');
    if(readyFirst)await f.enter();else await f.ready('earth-ready');
    assert.equal(f.done,true);assert.deepEqual(f.calls.finish,[null]);assert.equal(f.nodes.app.inert,false);
    assert.equal(f.calls.focus.at(-1),'journey-current');
  }
  const deep=fixture({experience:'earth',href:'https://batikanor.com/?event=tesla-gigathon-2026'});await settle();
  assert.deepEqual(deep.calls.imports,['./main.js']);assert.equal(deep.calls.wait.length,0);assert.equal(deep.done,true);
});
