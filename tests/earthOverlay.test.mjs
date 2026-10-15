import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the exact configuration and shell/manifest snippets used by the
// overlay without modifying the retained export or rebuilding reviewed assets.
const source = await readFile(new URL('../scripts/overlay-earth-homepage.mjs', import.meta.url), 'utf8');
const optionsSource = source.match(/function earthDeploymentOptions\(env\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(optionsSource, 'overlay configuration must stay testable');
function options(env) {
  const context = {env};
  vm.runInNewContext(`${optionsSource}; result=earthDeploymentOptions(env);`, context);
  return JSON.parse(JSON.stringify(context.result));
}

test('production gallery is explicit while classic defaults and staging preview compatibility remain intact', () => {
  assert.deepEqual(options({}), {target: 'production', staging: false, gallery: false});
  assert.deepEqual(options({EARTH_PORTFOLIO_EXPERIENCE: 'gallery'}), {target: 'production', staging: false, gallery: true});
  assert.deepEqual(options({EARTH_DEPLOY_TARGET: 'staging', EARTH_ROOM_PROTOTYPE: 'true'}),
    {target: 'staging', staging: true, gallery: true});
  assert.deepEqual(options({EARTH_DEPLOY_TARGET: 'staging', EARTH_PORTFOLIO_EXPERIENCE: 'gallery'}),
    {target: 'staging', staging: true, gallery: true});
  assert.deepEqual(options({EARTH_PORTFOLIO_EXPERIENCE: 'gallery', EARTH_ROOM_PROTOTYPE: 'true'}),
    {target: 'production', staging: false, gallery: true});
  assert.deepEqual(options({EARTH_PORTFOLIO_EXPERIENCE: 'earth'}), {target: 'production', staging: false, gallery: false});
});

test('accidental preview promotion, invalid targets and conflicting experience settings are rejected', () => {
  assert.throws(() => options({EARTH_ROOM_PROTOTYPE: 'true'}), /Production gallery requires/);
  assert.throws(() => options({EARTH_DEPLOY_TARGET: 'preview'}), /Unknown Earth deployment target/);
  assert.throws(() => options({EARTH_PORTFOLIO_EXPERIENCE: 'anything'}), /Unknown portfolio experience/);
  assert.throws(() => options({EARTH_DEPLOY_TARGET: 'staging', EARTH_ROOM_PROTOTYPE: 'true', EARTH_PORTFOLIO_EXPERIENCE: 'earth'}), /Conflicting/);
});

test('explicit production gallery retains the reviewed shell marker and exact runtime manifest shape', async () => {
  const marker = source.match(/if\(gallery\) \{[\s\S]*?\n\}/)?.[0];
  const manifest = source.match(/await writeFile\(join\(out, 'assets', 'earth-current\.json'\),\s*([\s\S]*?)\);/)?.[1];
  assert.ok(marker); assert.ok(manifest);
  const reviewed = {
    entry: '/assets/index-B79AJgE7.js', mapEntry: '/assets/main-D-u8gmQH.js',
    roomEntry: '/assets/galleryRoom-CSX3nCcI.js', experience: 'gallery-room-prototype',
  };
  for (const env of [{EARTH_PORTFOLIO_EXPERIENCE: 'gallery'}, {EARTH_DEPLOY_TARGET: 'staging', EARTH_ROOM_PROTOTYPE: 'true'}]) {
    const context = {gallery: options(env).gallery, html: '<html lang="en"><head></head><body></body></html>',
      roomEntryMatch: [null, 'galleryRoom-CSX3nCcI.js'], mapEntryMatch: [null, 'main-D-u8gmQH.js'],
      entryMatch: [null, '/assets/index-B79AJgE7.js'], earth: '/reviewed', join: (...parts) => parts.join('/'),
      exists: async path => { assert.equal(path, '/reviewed/assets/galleryRoom-CSX3nCcI.js'); return true; },
      assert: (condition, message) => assert.ok(condition, message)};
    await vm.runInNewContext(`(async()=>{${marker}; result=${manifest}; shell=html;})()`, context);
    assert.ok(context.shell.includes('data-portfolio-experience="gallery"'));
    assert.deepEqual(JSON.parse(context.result), reviewed);
  }
});

test('an explicitly selected gallery cannot silently publish a build without its room runtime', async () => {
  const marker = source.match(/if\(gallery\) \{[\s\S]*?\n\}/)?.[0];
  const context = {gallery: true, roomEntryMatch: null,
    assert: (condition, message) => { if (!condition) throw new Error(message); }};
  await assert.rejects(vm.runInNewContext(`(async()=>{${marker}})()`, context), /Could not resolve gallery-room prototype runtime/);
});
