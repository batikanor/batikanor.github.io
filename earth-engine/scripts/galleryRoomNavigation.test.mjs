import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {sortAchievementsNewestFirst, getChronologyState} from '../src/chronology.js';
import {portfolioUrl} from '../src/portfolioRoute.js';
import {createRoomJumpState} from '../src/galleryRoomJump.js';

// These are the actual integrated functions, extracted before DOM/Three startup.
// Only their external scene, clock, history and element dependencies are fakes.
const roomUrl = new URL('../src/galleryRoom.js', import.meta.url);
const source = await readFile(roomUrl, 'utf8');
const ordered = sortAchievementsNewestFirst(JSON.parse(await readFile(
  new URL('../src/data/achievements.json', import.meta.url), 'utf8')));
const names = ['clearMovementKeys', 'resetJump', 'updateVisibleProjects', 'adoptWalkStation', 'beginManualMovement',
  'currentSurface', 'refreshNavigation', 'setStation', 'selectProject', 'focusSurface', 'returnToRoom', 'step'];
const functions = names.map(name => {
  const start = source.indexOf(`  function ${name}(`);
  assert.ok(start >= 0, `${name} exists in current integration source`);
  const rest = source.slice(start);
  const next = rest.slice(1).search(/\n  (?:function |previous\.addEventListener)/);
  assert.ok(next >= 0, `${name} has an explicit extraction boundary`);
  return rest.slice(0, next + 1);
}).join('\n');

function fixture(index = 0) {
  const scheduled = new Map(), pushed = [], replaced = [], globeSelections = [], posePlans = [], classes = new Set();
  let sequence = 0;
  const context = vm.createContext({
    ordered, getChronologyState, portfolioUrl, createRoomJumpState,
    bySlug: new Map(ordered.map(project => [project.slug, project])),
    slug: ordered[index].slug, pendingSlug: null, focusKind: null,
    teleportTimer: null, active: true, viewLocked: true, disposed: false, reducedMotion: false,
    animation: null, keys: new Set(), tapKeys: new Set(), innerWidth: 1280,
    jumpState: createRoomJumpState(), jumpQueued: false, needsRender: false,
    camera: {position: {y: 5.4}}, lookTarget: {y: 5.4},
    previous: {}, next: {}, picker: {setActive(slug){this.activeSlug=slug;},close(){}}, cv: {}, returnButton: {}, announce: {},
    root: {dataset: {}, classList: {add: value => classes.add(value), remove: value => classes.delete(value)}},
    location: {href: `http://127.0.0.1:5175/?prototype=room&event=${ordered[index].slug}`},
    setTimeout: callback => {scheduled.set(++sequence, callback); return sequence;},
    clearTimeout: id => scheduled.delete(id),
    content: {activeSlug: ordered[index].slug,
      stationSurfaces: new Map(ordered.map(project=>[project.slug,{story:{slug:project.slug,kind:'story',type:'story',
        element:{getAttribute:()=>`${project.title} description`}}}])),
      setActiveSlug(value) {this.activeSlug=value;},
      setVisibleSlugs(values) {this.visibleSlugs=values;},
      setFocusedSurface(value) {this.focusedSurface=value;}},
    globe: {setActive(slug,options){globeSelections.push({slug,recenter:options?.recenter===true});}}, room: {update() {}},
    performance: {now: () => 100},
    framePlan: kind => ({slug:context.slug,kind:kind===undefined?context.focusKind:kind}),
    applyPose: plan => posePlans.push({plan,animated:false}),
    animatePose: plan => {posePlans.push({plan,animated:true});context.animation={plan};},
    stage: {focus() {this.focused=true;}}, cancelDrag() {}
  });
  context.history = {pushState(_state, _title, url) {
    context.location.href = url.href;
    pushed.push(url.searchParams.get('event'));
  }, replaceState(_state, _title, url) {
    context.location.href = url.href;
    replaced.push(url.searchParams.get('event'));
  }};
  new vm.Script(functions).runInContext(context);
  context.refreshNavigation();
  context.updateVisibleProjects();
  return {context, pushed, replaced, globeSelections, posePlans, scheduled, classes,
    commit() {const callbacks = [...scheduled.values()]; scheduled.clear(); callbacks.forEach(callback => callback());},
    route(slug) {context.location.href = portfolioUrl(context.location.href, {eventSlug: slug}).href;
      context.selectProject(slug, {history: false});}
  };
}

test('rapid chronology intent reaches all32 stations without duplicate history', () => {
  const f = fixture();
  for (let i = 1; i < ordered.length; i++) f.context.step('next');
  assert.equal(f.context.pendingSlug, ordered.at(-1).slug);
  assert.equal(f.context.picker.activeSlug, ordered.at(-1).slug);
  assert.equal(f.context.next.disabled, true);
  assert.equal(f.scheduled.size, 1);
  assert.deepEqual(f.pushed, ordered.slice(1).map(project => project.slug));
  assert.equal(f.globeSelections.length,0,'the globe waits for the committed room rather than visiting cancelled intermediate choices');
  f.commit();
  assert.equal(f.context.slug, ordered.at(-1).slug);
  assert.equal(f.context.pendingSlug, null);
  assert.equal(f.classes.has('is-teleporting'), false);
  assert.deepEqual(f.globeSelections,[{slug:ordered.at(-1).slug,recenter:false}]);
  assert.equal(f.context.content.activeSlug, ordered.at(-1).slug);
  assert.deepEqual(f.context.content.visibleSlugs, ordered.slice(-2).map(project=>project.slug));
});

test('rapid reverse chronology uses pending station and retains bounded endpoints', () => {
  const f = fixture(ordered.length - 1);
  for (let i = ordered.length - 2; i >= 0; i--) f.context.step('previous');
  assert.equal(f.context.pendingSlug, ordered[0].slug);
  assert.equal(f.context.previous.disabled, true);
  assert.equal(f.context.picker.activeSlug, ordered[0].slug);
  assert.equal(f.scheduled.size, 1);
  f.commit();
  assert.equal(f.context.slug, ordered[0].slug);
});

test('Next then Previous before commit cancels stale teleport and restores matching URL', () => {
  const f = fixture();
  f.context.step('next');
  assert.equal(f.context.previous.disabled, false);
  f.context.step('previous');
  assert.equal(f.scheduled.size, 0);
  assert.equal(f.context.pendingSlug, null);
  assert.equal(f.context.slug, ordered[0].slug);
  assert.equal(new URL(f.context.location.href).searchParams.get('event'), ordered[0].slug);
  assert.deepEqual(f.pushed, [ordered[1].slug, ordered[0].slug]);
  assert.deepEqual(f.globeSelections,[{slug:ordered[0].slug,recenter:true}],
    'cancelling a pending switch keeps the map centered on the restored project');
});

test('reselecting the current achievement recenters its globe without adding history or a room transition',()=>{
  const f=fixture(3);
  f.context.selectProject(ordered[3].slug);
  assert.deepEqual(f.globeSelections,[{slug:ordered[3].slug,recenter:true}]);
  assert.equal(f.scheduled.size,0);
  assert.equal(f.pushed.length,0);
  assert.equal(f.context.slug,ordered[3].slug);
});

test('Back and Forward during pending transitions never leave stale camera selection', () => {
  const f = fixture();
  f.context.step('next'); f.context.step('next');
  f.route(ordered[1].slug); f.commit();
  assert.equal(f.context.slug, ordered[1].slug);
  f.route(ordered[0].slug); f.route(ordered[2].slug); f.commit();
  assert.equal(f.context.slug, ordered[2].slug);
  assert.equal(new URL(f.context.location.href).searchParams.get('event'), ordered[2].slug);
  assert.equal(f.pushed.length, 2, 'history navigation creates no new entries');
});

test('reselecting a pending marker keeps one transition and one history entry', () => {
  const f = fixture();
  f.context.selectProject(ordered[1].slug);
  f.context.selectProject(ordered[1].slug);
  assert.equal(f.scheduled.size, 1);
  assert.deepEqual(f.pushed, [ordered[1].slug]);
  f.commit();
  assert.equal(f.context.slug, ordered[1].slug);
});

test('manual movement cancels a pending teleport and restores the current room URL without another history entry', () => {
  const index=3, f=fixture(index), current=ordered[index].slug, pending=ordered[index+1].slug;
  f.context.jumpState={height:.4,velocity:1,grounded:false};f.context.jumpQueued=true;
  f.context.camera.position.y+=.4;f.context.lookTarget.y+=.4;
  f.context.selectProject(pending);
  assert.deepEqual(f.context.jumpState,createRoomJumpState());assert.equal(f.context.jumpQueued,false);
  assert.equal(f.context.camera.position.y,5.4);assert.equal(f.context.lookTarget.y,5.4);
  assert.equal(f.context.pendingSlug,pending);assert.equal(f.scheduled.size,1);
  assert.equal(new URL(f.context.location.href).searchParams.get('event'),pending);
  f.context.animation={start:100};f.context.focusKind='story';
  f.context.content.setFocusedSurface('story');f.context.keys.add('w');f.context.tapKeys.add('w');
  f.context.beginManualMovement();
  assert.equal(f.scheduled.size,0);assert.equal(f.context.teleportTimer,null);
  assert.equal(f.context.pendingSlug,null);assert.equal(f.context.slug,current);
  assert.equal(f.context.animation,null);assert.equal(f.context.focusKind,null);
  assert.equal(f.context.content.focusedSurface,null);assert.equal(f.classes.has('is-teleporting'),false);
  assert.equal(f.context.keys.has('w'),true,'the key that cancels a teleport still starts walking');
  assert.equal(f.context.tapKeys.has('w'),true,'even a short tap remains available to the movement frame');
  assert.equal(new URL(f.context.location.href).searchParams.get('event'),current);
  assert.deepEqual(f.pushed,[pending]);assert.deepEqual(f.replaced,[current]);
  assert.equal(f.context.picker.activeSlug,current);assert.equal(f.context.root.dataset.activeSlug,current);
  assert.equal(f.context.content.activeSlug,current);assert.deepEqual(f.globeSelections,[]);
  f.commit();assert.equal(f.context.slug,current,'canceled timers cannot switch the room later');
  f.context.step('next');f.commit();
  assert.equal(f.context.slug,pending);assert.equal(f.context.content.activeSlug,pending);
  assert.deepEqual(f.context.content.visibleSlugs,ordered.slice(index,index+3).map(project=>project.slug));
});

test('manual movement without a pending selection leaves browser history intact', () => {
  const f=fixture(2), href=f.context.location.href;
  f.context.beginManualMovement();f.context.beginManualMovement();
  assert.equal(f.context.location.href,href);assert.deepEqual(f.pushed,[]);assert.deepEqual(f.replaced,[]);
  assert.equal(f.context.slug,ordered[2].slug);assert.equal(f.scheduled.size,0);
});

test('Next then Escape return-to-room cancels the delayed teleport and frames the current project', () => {
  const index=6, f=fixture(index), current=ordered[index].slug, pending=ordered[index+1].slug;
  f.context.step('next');assert.equal(f.context.pendingSlug,pending);assert.equal(f.scheduled.size,1);
  f.context.keys.add('w');f.context.tapKeys.add('w');f.context.jumpQueued=true;
  f.context.focusKind='story';f.context.content.setFocusedSurface('story');f.context.animation={start:100};
  f.context.returnToRoom();
  assert.equal(f.context.pendingSlug,null);assert.equal(f.context.teleportTimer,null);assert.equal(f.scheduled.size,0);
  assert.equal(f.context.slug,current);assert.equal(f.context.picker.activeSlug,current);
  assert.equal(f.context.focusKind,null);assert.equal(f.context.content.focusedSurface,null);
  assert.equal(f.context.returnButton.hidden,true);assert.equal(f.context.stage.focused,true);
  assert.equal(f.context.keys.size,0);assert.equal(f.context.tapKeys.size,0);assert.equal(f.context.jumpQueued,false);
  assert.equal(f.classes.has('is-teleporting'),false);
  assert.equal(new URL(f.context.location.href).searchParams.get('event'),current);
  assert.deepEqual(f.pushed,[pending]);assert.deepEqual(f.replaced,[current]);
  assert.deepEqual(f.posePlans,[{plan:{slug:current,kind:null},animated:true}]);
  f.commit();assert.equal(f.context.slug,current);assert.equal(f.context.content.activeSlug,current);
  assert.deepEqual(f.globeSelections,[],'canceling the transition never commits its pending map selection');
});

test('approaching the current project board cancels a pending Next even when that board was already focused', () => {
  for(const alreadyFocused of[false,true]){
    const index=8, f=fixture(index), current=ordered[index].slug, pending=ordered[index+1].slug;
    if(alreadyFocused){f.context.focusKind='story';f.context.content.setFocusedSurface('story');f.context.refreshNavigation();}
    f.context.step('next');assert.equal(f.context.pendingSlug,pending);assert.equal(f.scheduled.size,1);
    f.context.keys.add('d');f.context.tapKeys.add('d');
    f.context.focusSurface(f.context.currentSurface('story'));
    assert.equal(f.context.pendingSlug,null);assert.equal(f.context.teleportTimer,null);assert.equal(f.scheduled.size,0);
    assert.equal(f.context.slug,current);assert.equal(f.context.picker.activeSlug,current);
    assert.equal(f.context.focusKind,'story');assert.equal(f.context.content.focusedSurface,'story');
    assert.equal(f.context.returnButton.hidden,false);assert.equal(f.context.stage.focused,true);
    assert.equal(f.context.keys.size,0);assert.equal(f.context.tapKeys.size,0);
    assert.equal(f.classes.has('is-teleporting'),false);
    assert.equal(new URL(f.context.location.href).searchParams.get('event'),current);
    assert.deepEqual(f.pushed,[pending]);assert.deepEqual(f.replaced,[current]);
    assert.deepEqual(f.posePlans,[{plan:{slug:current,kind:'story'},animated:true}]);
    f.commit();assert.equal(f.context.slug,current);assert.equal(f.context.content.activeSlug,current);
    assert.deepEqual(f.globeSelections,[]);
  }
});
