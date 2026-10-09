import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {clampPanelRect, expandedPanelRect, largePanelRect, reserveJourneySpace, reserveReadingTopbar, resizePanelRect, withCompactPanelMinimum} from '../src/detailPanel.js';

// Exercise the production viewer's event handlers without loading its CSS,
// PDF worker or network. The pending PDF request is aborted by the real close
// handler; window sizing must neither recreate pages nor initiate another PDF.
const source = (await readFile(new URL('../src/cvView.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('export function createCvView', 'function createCvView');

function fixture(width = 1280, height = 900, {journeyTop = height - 112, journeyVisible = true} = {}) {
  const frames = new Map(), observers = []; let frameId = 0;
  const flushFrames = () => { const pending=[...frames.values()];frames.clear();for(const fn of pending)fn(); };
  const window = {innerWidth:width,innerHeight:height,listeners:new Map(),
    addEventListener(type, fn) { const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list); },
    emit(type) { for (const fn of this.listeners.get(type)||[]) fn(); flushFrames(); },
    getComputedStyle() { return {getPropertyValue: () => '0px'}; },
  };
  let document, requests = 0;
  const signals = [], timers = new Set();
  class Element {
    constructor(tag = 'div') { this.tagName=tag;this.attributes={};this.children=[];this.style={};this.dataset={};this.listeners=new Map();this.classes=new Set();this.hidden=false;this.open=false;this.disabled=false;this.textContent=''; }
    set className(value) { this.classes=new Set(value.split(/\s+/)); }
    get className() { return [...this.classes].join(' '); }
    get classList() { return {contains: name=>this.classes.has(name),add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)}; }
    setAttribute(name,value) { this.attributes[name]=String(value);if(name==='id')this.id=value; }
    getAttribute(name) { return this.attributes[name]??null; }
    append(...nodes) { for(const node of nodes){node.parentElement=this;this.children.push(node);} }
    replaceChildren(...nodes) { this.children=[];this.append(...nodes); }
    set innerHTML(html) {
      this.markup=html;this.children=[];
      for (const match of html.matchAll(/<([a-z]+)\b([^>]*)>/g)) {
        const node=new Element(match[1]),attrs=match[2];
        for(const attr of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) {
          node.setAttribute(attr[1],attr[2]);
          if(attr[1]==='class')node.className=attr[2];
          if(attr[1]==='data-cv-zoom')node.dataset.cvZoom=attr[2];
        }
        node.disabled=/\bdisabled\b/.test(attrs);this.append(node);
      }
    }
    matches(selector) { if(selector[0]==='.')return this.classes.has(selector.slice(1));if(selector[0]==='#')return this.id===selector.slice(1);if(selector==='[data-cv-zoom]')return !!this.dataset.cvZoom;const match=selector.match(/^\[data-cv-zoom="(.*)"\]$/);return !!match&&this.dataset.cvZoom===match[1]; }
    querySelectorAll(selector) { return this.children.flatMap(node=>[...(node.matches(selector)?[node]:[]),...node.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0]??null; }
    addEventListener(type,fn) { const list=this.listeners.get(type)||[];list.push(fn);this.listeners.set(type,list); }
    removeEventListener(type,fn) { this.listeners.set(type,(this.listeners.get(type)||[]).filter(item=>item!==fn)); }
    emit(type,values={}) {
      const event={button:0,pointerId:1,prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};
      for (const fn of [...(this.listeners.get(type)||[])])fn(event);
      return event;
    }
    getBoundingClientRect() {
      const dialog=this.tagName==='dialog'?this:this.closestDialog();
      const x=parseFloat(dialog?.style.left)||0,y=parseFloat(dialog?.style.top)||0;
      const w=parseFloat(dialog?.style.width)||window.innerWidth;
      let h=parseFloat(dialog?.style.height)||window.innerHeight;
      if(this.classes.has('cv-view-header')) h=dialog?.classes.has('is-compact')?40:w<=360?136:w<=760?140:80;
      if(this.classes.has('cv-view-help')) h=dialog?.classes.has('is-compact')||(parseFloat(dialog?.style.height)||window.innerHeight)<=540?0:32;
      return {left:x,top:y,width:w,height:h,right:x+w,bottom:y+h};
    }
    closestDialog(){for(let node=this;node;node=node.parentElement)if(node.tagName==='dialog')return node;return null;}
    get clientWidth(){return this.getBoundingClientRect().width-(this.classes.has('cv-view-document')?2:0);}
    setPointerCapture(id){this.captured=id;}
    hasPointerCapture(id){return this.captured===id;}
    releasePointerCapture(){this.captured=null;}
    showModal(){throw new Error('Modal CV would block chronology');}
    show(){this.open=true;this.modeless=true;}
    close(){this.open=false;this.emit('close');}
    focus(){document.activeElement=this;}
    get isConnected(){return this===document.body||!!this.parentElement?.isConnected;}
    closest(selector){return selector==='[hidden]'&&this.hidden?this:this.parentElement?.closest(selector)??null;}
  }
  document={body:new Element('body'),createElement:tag=>new Element(tag),getElementById:id=>document.body.querySelector('#'+id),querySelector:selector=>document.body.querySelector(selector),activeElement:null};
  const trigger=new Element('button');trigger.id='portfolio-toggle';document.body.append(trigger);trigger.focus();
  const journey=new Element('nav');journey.id='journey';journey.hidden=!journeyVisible;journey.getBoundingClientRect=()=>journey.hidden?{width:0,height:0,top:0}:{width:window.innerWidth-24,height:60,top:journeyTop};document.body.append(journey);
  const sources=new Element('div');sources.id='sources';document.body.append(sources);
  const topbar=new Element('header');topbar.className='topbar';topbar.hidden=!journeyVisible;topbar.getBoundingClientRect=()=>topbar.hidden?{width:0,height:0,bottom:0}:{width:window.innerWidth-24,height:44,bottom:window.innerWidth<=760?56:66};document.body.append(topbar);
  const create=new Function('document','window','HTMLElement','portfolioLinks','bindCvDownload','fetchCvPdfBlob','getProject','cvDestinationUrl','pdfWorkerUrl','clampPanelRect','expandedPanelRect','largePanelRect','reserveJourneySpace','reserveReadingTopbar','resizePanelRect','withCompactPanelMinimum','setTimeout','clearTimeout','requestAnimationFrame','cancelAnimationFrame','ResizeObserver',source+'\nreturn createCvView;')(
    document,window,Element,{cvPdf:'https://docs.google.com/export?format=pdf'},()=>{},({signal})=>{requests++;signals.push(signal);return new Promise(()=>{});},()=>null,()=>null,'worker.mjs',clampPanelRect,expandedPanelRect,largePanelRect,reserveJourneySpace,reserveReadingTopbar,resizePanelRect,withCompactPanelMinimum,
    fn=>{timers.add(fn);return fn;},fn=>timers.delete(fn),
    fn=>{frames.set(++frameId,fn);return frameId;},id=>frames.delete(id),class {constructor(fn){this.callback=fn;this.nodes=[];observers.push(this);}observe(node){this.nodes.push(node);}},
  );
  const viewer=create(),dialog=document.body.querySelector('#cv-view');
  const node=selector=>dialog.querySelector(selector);
  return {viewer,dialog,window,document,node,trigger,signals,timers,Element,journey,sources,observers,
    setJourneyTop(value){journeyTop=value;observers[0].callback();flushFrames();},
    resize(width,height){const bottomInset=window.innerHeight-journeyTop;window.innerWidth=width;window.innerHeight=height;journeyTop=height-bottomInset;window.emit('resize');},
    get requests(){return requests;}};
}

function assertReachable(f) {
  const rect=f.dialog.getBoundingClientRect();
  assert.ok(rect.left>=0&&rect.top>=0,'top-left stays visible');
  assert.ok(rect.right<=f.window.innerWidth&&rect.bottom<=f.window.innerHeight,'bottom-right stays visible');
  if(!f.journey.hidden) assert.ok(rect.bottom<=f.journey.getBoundingClientRect().top-12,'chronology retains its clear gap');
  assert.ok(rect.width>0&&rect.height>0);
}

test('CV opens modeless in a shorter reading view, Expand and Restore preserve pages and zoom',()=>{
  const f=fixture();f.viewer.open();
  assert.equal(f.dialog.modeless,true);
  assert.equal(f.dialog.getAttribute('aria-modal'),'false');
  assert.equal(f.dialog.classList.contains('is-reading'),true);
  assert.equal(f.dialog.classList.contains('is-expanded'),false);
  assert.equal(f.node('.cv-view-size').getAttribute('aria-label'),'Expand CV window');
  assert.equal(f.node('.cv-view-size').getAttribute('aria-pressed'),'false');
  const initial=f.dialog.getBoundingClientRect();
  assert.deepEqual(initial,{left:376,top:112,width:896,height:630,right:1272,bottom:742});
  const page=new f.Element();page.className='cv-view-page';f.node('.cv-view-pages').append(page);
  f.node('[data-cv-zoom="in"]').emit('click');
  const corner=f.node('.cv-view-resize-right');corner.emit('keydown',{key:'ArrowLeft'});
  const custom=f.dialog.getBoundingClientRect();
  f.node('.cv-view-size').emit('click');
  assert.equal(f.dialog.classList.contains('is-expanded'),true);
  const expanded=f.dialog.getBoundingClientRect();
  assert.deepEqual(expanded,{left:8,top:8,width:1264,height:768,right:1272,bottom:776});
  assert.ok(expanded.width>custom.width&&expanded.height>custom.height);
  assert.equal(f.node('.cv-view-size').getAttribute('aria-label'),'Restore CV window');
  f.node('.cv-view-size').emit('click');assert.deepEqual(f.dialog.getBoundingClientRect(),custom);
  assert.equal(f.node('.cv-view-pages').children[0],page);
  assert.equal(f.requests,1);assert.equal(f.node('[data-cv-zoom="out"]').disabled,false);
  corner.emit('keydown',{key:'Home'});assert.deepEqual(f.dialog.getBoundingClientRect(),initial);
  f.node('.cv-view-size').emit('click');f.node('.cv-view-size').emit('click');assert.deepEqual(f.dialog.getBoundingClientRect(),initial);
  f.viewer.close();f.viewer.open();assert.equal(f.dialog.classList.contains('is-reading'),true);f.viewer.close();
});

test('CV moves immediately, corners resize above the rail and Home resets reading geometry',()=>{
  const f=fixture();f.viewer.open();
  const handle=f.node('.cv-view-drag'),before=f.dialog.getBoundingClientRect();
  assert.equal(handle.disabled,false);
  handle.emit('pointerdown',{clientX:before.left+40,clientY:before.top+20});
  handle.emit('pointermove',{clientX:before.left-40,clientY:before.top+70});handle.emit('pointerup');
  assert.equal(parseFloat(f.dialog.style.left),before.left-80);
  assert.equal(parseFloat(f.dialog.style.top),Math.min(before.top+50,776-before.height),
    'downward movement clamps above the chronology');
  assert.equal(handle.hasPointerCapture(1),false);
  handle.emit('keydown',{key:'ArrowLeft',shiftKey:true});
  assert.equal(parseFloat(f.dialog.style.left),before.left-128);
  const corner=f.node('.cv-view-resize-right');
  corner.emit('pointerdown',{clientX:100,clientY:100});corner.emit('pointermove',{clientX:4000,clientY:4000});corner.emit('pointerup');
  assertReachable(f);assert.equal(f.dialog.getBoundingClientRect().bottom,776);
  corner.emit('keydown',{key:'Home'});assert.deepEqual(f.dialog.getBoundingClientRect(),before);
  corner.emit('pointerdown',{clientX:100,clientY:100});corner.emit('pointermove',{clientX:-2000,clientY:-2000});corner.emit('pointercancel');
  assertReachable(f);assert.equal(parseFloat(f.dialog.style.width),280);
  assert.ok(f.dialog.classList.contains('is-compact'));
  assert.equal(corner.hasPointerCapture(1),false);
  handle.emit('dblclick');assert.deepEqual(f.dialog.getBoundingClientRect(),before);
  f.viewer.close();
});

test('initial CV left corner grows into the map while right corner stays within its margin',()=>{
  const f=fixture();f.viewer.open();
  const right=f.node('.cv-view-resize-right'),left=f.node('.cv-view-resize-left'),initial=f.dialog.getBoundingClientRect();
  right.emit('keydown',{key:'ArrowRight'});assert.deepEqual(f.dialog.getBoundingClientRect(),initial);
  left.emit('keydown',{key:'ArrowLeft'});
  assert.equal(f.dialog.getBoundingClientRect().width,initial.width+16);
  assert.equal(f.dialog.getBoundingClientRect().right,initial.right);
  right.emit('keydown',{key:'Home'});right.emit('keydown',{key:'ArrowUp'});
  assert.equal(f.dialog.getBoundingClientRect().height,initial.height-16);
  f.viewer.close();
});

test('short on-map CV corners shrink from the default without minimum-height growth or jumping',()=>{
  const f=fixture(568,320,{journeyTop:215});f.viewer.open();
  const initial=f.dialog.getBoundingClientRect();
  assert.equal(initial.top,68);assert.equal(initial.height,135);
  for(const [selector,dx] of [['.cv-view-resize-right',-24],['.cv-view-resize-left',24]]){
    const handle=f.node(selector);handle.emit('keydown',{key:'Home'});
    handle.emit('pointerdown',{clientX:400,clientY:200});
    handle.emit('pointermove',{clientX:400+dx,clientY:188});handle.emit('pointerup');
    const resized=f.dialog.getBoundingClientRect();
    assert.equal(resized.top,initial.top);
    assert.equal(resized.height,initial.height-12);
    assert.equal(resized.width,initial.width-24);
    assert.equal(resized.left,initial.left+(dx>0?dx:0));
    assert.equal(handle.hasPointerCapture(1),false);
    f.setJourneyTop(215);assert.deepEqual(f.dialog.getBoundingClientRect(),resized);
    f.node('.cv-view-size').emit('click');f.node('.cv-view-size').emit('click');
    assert.deepEqual(f.dialog.getBoundingClientRect(),resized,'Restore retains short custom geometry after toolbar measurement');
    assertReachable(f);
  }
  const drag=f.node('.cv-view-drag');drag.emit('keydown',{key:'Home'});
  drag.emit('pointerdown',{clientX:400,clientY:80});
  drag.emit('pointermove',{clientX:390,clientY:75});drag.emit('pointerup');
  const moved=f.dialog.getBoundingClientRect();
  assert.equal(moved.top,initial.top-5);assert.equal(moved.left,initial.left-10);
  assert.equal(moved.width,initial.width);assert.equal(moved.height,initial.height);
  f.node('.cv-view-resize-right').emit('keydown',{key:'Home'});
  f.node('.cv-view-resize-right').emit('keydown',{key:'ArrowUp'});
  assert.equal(f.dialog.getBoundingClientRect().top,initial.top);
  assert.equal(f.dialog.getBoundingClientRect().height,initial.height-16);
  f.viewer.close();
});

test('CV rail observers recompute reading, custom and expanded bounds when credits wrap',()=>{
  const f=fixture();f.viewer.open();
  f.setJourneyTop(700);assertReachable(f);
  f.node('.cv-view-size').emit('click');assert.equal(f.dialog.getBoundingClientRect().bottom,688);
  f.setJourneyTop(630);assert.equal(f.dialog.getBoundingClientRect().bottom,618);
  f.node('.cv-view-size').emit('click');assertReachable(f);
  f.node('.cv-view-drag').emit('keydown',{key:'ArrowDown',shiftKey:true});
  f.setJourneyTop(500);assertReachable(f);
  assert.ok(f.observers[0].nodes.includes(f.journey));assert.ok(f.observers[0].nodes.includes(f.sources));
  f.viewer.close();
});

test('phone and short CV windows fit above actual chronology; hidden standalone rail reserves nothing',()=>{
  const f=fixture(390,844);f.viewer.open();
  assert.equal(f.dialog.getBoundingClientRect().width,280);assert.equal(f.dialog.getBoundingClientRect().left,102);
  for(const [width,height] of [[390,320],[568,320],[320,568]]){
    f.resize(width,height);assertReachable(f);
    f.node('.cv-view-size').emit('click');assertReachable(f);
    f.node('.cv-view-size').emit('click');assertReachable(f);
  }
  f.resize(390,320);assert.equal(f.dialog.classList.contains('is-compact'),true);
  f.viewer.close();
  const standalone=fixture(390,844,{journeyVisible:false});standalone.viewer.open();
  const initial=standalone.dialog.getBoundingClientRect();
  assert.equal(initial.width,280);assert.ok(Math.abs(initial.height-590.8)<1e-9);
  standalone.node('.cv-view-size').emit('click');assert.equal(standalone.dialog.getBoundingClientRect().bottom,836);
  standalone.viewer.close();
});

test('Escape explicitly closes modeless CV, aborts PDF work and restores focus',()=>{
  const f=fixture();f.viewer.open();
  const event=f.dialog.emit('keydown',{key:'Escape'});
  assert.equal(event.prevented,true);assert.equal(event.stopped,true);
  assert.equal(f.viewer.isOpen(),false);assert.equal(f.signals[0].aborted,true);
  assert.equal(f.timers.size,0);assert.equal(f.document.activeElement,f.trigger);
  assert.equal(f.node('.cv-view-pages').children.length,0);
});

test('short standalone Restore measures the destination toolbar and returns reading or custom geometry exactly',()=>{
  const f=fixture(390,340,{journeyVisible:false});f.viewer.open();
  const reading=f.dialog.getBoundingClientRect();
  assert.equal(reading.height,240);assert.equal(f.dialog.classList.contains('is-compact'),true);
  f.node('.cv-view-size').emit('click');
  assert.equal(f.dialog.getBoundingClientRect().height,324);
  assert.equal(f.dialog.classList.contains('is-compact'),false);
  f.node('.cv-view-size').emit('click');
  assert.deepEqual(f.dialog.getBoundingClientRect(),reading);
  f.node('.cv-view-drag').emit('keydown',{key:'ArrowLeft'});
  const custom=f.dialog.getBoundingClientRect();
  f.node('.cv-view-size').emit('click');f.node('.cv-view-size').emit('click');
  assert.deepEqual(f.dialog.getBoundingClientRect(),custom);
  f.viewer.close();
});

test('default CV at1280×633 keeps the visible topbar reachable while Expand uses the full work area',()=>{
  const f=fixture(1280,633);f.viewer.open();
  const reading=f.dialog.getBoundingClientRect();
  assert.deepEqual(reading,{left:376,top:78,width:896,height:431,right:1272,bottom:509});
  f.node('.cv-view-size').emit('click');
  assert.deepEqual(f.dialog.getBoundingClientRect(),{left:8,top:8,width:1264,height:501,right:1272,bottom:509});
  f.node('.cv-view-size').emit('click');assert.deepEqual(f.dialog.getBoundingClientRect(),reading);
  f.viewer.close();
});
