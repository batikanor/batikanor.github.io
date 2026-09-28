import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {chooseRomeImage, createRomeVenueChapter} from '../src/romeVenueChapter.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const file = name => resolve(root, 'public', 'data', name);

test('Rome tier budgets and frozen source outputs agree', async () => {
  const manifest = JSON.parse(await readFile(file('rome-ostiense-v1.json'), 'utf8'));
  assert.equal(manifest.id, 'rome-ostiense-v1');
  assert.equal(manifest.ground.license, 'CC BY 4.0');
  assert.equal(manifest.buildings.license, 'ODbL 1.0');
  for (const mobile of [true, false]) {
    const product = chooseRomeImage(manifest, {mobile});
    const bytes = await readFile(file(product.asset));
    assert.equal(bytes.length, product.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), product.sha256);
    assert.ok(product.bytes < (mobile ? 250_000 : 850_000));
  }
  const buildings = await readFile(file(manifest.buildings.asset));
  assert.equal(buildings.length, manifest.buildings.bytes);
  assert.equal(createHash('sha256').update(buildings).digest('hex'), manifest.buildings.sha256);
  const data = JSON.parse(buildings.toString('utf8'));
  assert.equal(data.features.length, manifest.buildings.features);
  const venue = data.features.find(feature => feature.properties.venue);
  assert.equal(venue.properties.osm_id, '390787504');
  assert.match(venue.properties.height_basis, /illustrative/);
  assert.equal(venue.properties.height_m, 12);
  assert.ok(data.features.some(feature => feature.properties.height_m === 0));
});

test('corrupt or over-budget Rome images are rejected', () => {
  assert.throws(() => chooseRomeImage({ground:{products:{'800':{
    asset:'rome-ostiense-agea2020-800-v1.webp', bytes:300_000, decoded_rgba_bytes:2_560_000,
  }}}}, {mobile:true}), /budget/);
});

test('Rome map pin is corrected without changing the author content snapshot', async () => {
  const achievements = JSON.parse(await readFile(resolve(root, 'src/data/achievements.json'), 'utf8'));
  const event = achievements.find(e => e.slug === 'ethrome-2025');
  assert.deepEqual(event.coordinates, {lat:41.8678291,lng:12.4791336});
  const source = await readFile(resolve(root, 'src/data/contestsAndActivities.js'), 'utf8');
  assert.match(source, /slug: "ethrome-2025",[\s\S]*?coordinates: \{ lat: 41\.8719, lng: 12\.4802 \}/);
});

test('Rome layer begins inert and never loads at the globe', () => {
  const chapter = createRomeVenueChapter({baseUrl:'/'});
  assert.equal(chapter.isVisible(), false);
  chapter.setFocus('ethrome-2025'); // no map attached yet
  assert.equal(chapter.isVisible(), false);
  chapter.setFocus('other');
  chapter.destroy();
});
