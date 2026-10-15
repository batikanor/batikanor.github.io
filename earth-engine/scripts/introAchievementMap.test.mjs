import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {sortAchievementsNewestFirst} from '../src/chronology.js';

const source = await readFile(new URL('../src/introAchievementMap.js', import.meta.url), 'utf8');
const achievements = JSON.parse(await readFile(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));

function fixture({inert = false} = {}) {
  const container = {inert}, selections = [], factories = [];
  let disposals = 0, resizes = 0;
  const context = vm.createContext({sortAchievementsNewestFirst,
    createGalleryRoomGlobe(options) {
      factories.push(options);
      return {dispose() {disposals++;}, resize() {resizes++;},
        getStats: () => ({projects: options.achievements.length, activeSlug: options.initialSlug, webgl: false})};
    }});
  new vm.Script(source.replace(/^import .*;\n/gm, '').replace(/^export /gm, '')).runInContext(context);
  const map = context.startIntroAchievementMap({container, achievements, onSelect: slug => selections.push(slug)});
  return {container, selections, factories, map, select: factories[0].onSelect,
    get disposals() {return disposals;}, get resizes() {return resizes;}};
}

test('entrance delegates all actual project locations to the shared gallery globe in chronology order', () => {
  assert.match(source, /import \{createGalleryRoomGlobe\} from '\.\/galleryRoomGlobe\.js'/);
  assert.match(source, /import \{sortAchievementsNewestFirst\} from '\.\/chronology\.js'/);
  const before = JSON.stringify(achievements), state = fixture(), [options] = state.factories;
  assert.equal(state.factories.length, 1);
  assert.equal(options.container, state.container);
  assert.equal(options.initialSlug, null, 'the entrance starts worldwide rather than focused on the first event');
  assert.equal(options.achievements.length, 32);
  assert.deepEqual(options.achievements, sortAchievementsNewestFirst(achievements));
  for (const achievement of achievements) {
    const location = options.achievements.find(item => item.slug === achievement.slug);
    assert.equal(location, achievement, 'shared coordinates and complete project information are preserved');
    assert.equal(location.coordinates, achievement.coordinates);
  }
  assert.equal(JSON.stringify(achievements), before, 'source editorial order remains untouched');
  assert.equal(state.map.getStats().projects, 32);
  assert.equal(state.map.getStats().activeSlug, null);
  assert.equal(state.map.getStats().webgl, false, 'shared native no-WebGL fallback remains usable');
  state.map.dispose();
});

test('a valid map or native location choice enters that achievement exactly once', () => {
  const state = fixture(), slug = achievements.at(-1).slug;
  state.select('not-a-project');state.select(undefined);state.select(null);
  assert.deepEqual(state.selections, []);
  assert.equal(state.container.inert, false);
  state.select(slug);
  assert.deepEqual(state.selections, [slug]);
  assert.equal(state.container.inert, true, 'map controls stop accepting further input while entry begins');
  assert.equal(state.map.getStats().selectedSlug, slug);
  state.select(slug);state.select(achievements[0].slug);
  assert.deepEqual(state.selections, [slug]);
  state.map.dispose();
});

test('disposal releases the shared globe once, restores interactivity, and rejects late choices', () => {
  const state = fixture();
  state.map.resize();assert.equal(state.resizes, 1);
  state.select(achievements[0].slug);state.map.dispose();state.map.dispose();
  assert.equal(state.disposals, 1);
  assert.equal(state.container.inert, false);
  assert.equal(state.map.getStats().disposed, true);
  state.map.resize();assert.equal(state.resizes, 1, 'a late resize cannot touch disposed graphics');
  state.select(achievements[1].slug);
  assert.deepEqual(state.selections, [achievements[0].slug]);
});

test('closing an unselected entrance preserves the original container state', () => {
  const state = fixture({inert: true});
  state.map.dispose();state.select(achievements[0].slug);
  assert.equal(state.container.inert, true);
  assert.equal(state.disposals, 1);
  assert.deepEqual(state.selections, []);
});
