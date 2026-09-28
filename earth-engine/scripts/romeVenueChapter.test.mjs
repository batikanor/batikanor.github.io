import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {chooseRomeImage, createRomeVenueChapter, fetchRomeAsset} from '../src/romeVenueChapter.js';

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

test('Rome asset fetch retries transport failure, but not missing or oversized assets', async () => {
  const originalFetch = globalThis.fetch;
  const signal = new AbortController().signal;
  let attempts = 0;
  try {
    globalThis.fetch = async () => {
      attempts++;
      if (attempts === 1) throw new TypeError('connection dropped');
      return new Response(new Uint8Array([1, 2, 3]));
    };
    assert.deepEqual([...new Uint8Array(await (await fetchRomeAsset('/rome.webp', 10, signal)).arrayBuffer())],
      [1, 2, 3]);
    assert.equal(attempts, 2);

    attempts = 0;
    globalThis.fetch = async () => { attempts++; return new Response(null, {status: 404}); };
    await assert.rejects(fetchRomeAsset('/missing.webp', 10, signal), /HTTP 404/);
    assert.equal(attempts, 1);

    attempts = 0;
    globalThis.fetch = async () => { attempts++; return new Response(new Uint8Array(11)); };
    await assert.rejects(fetchRomeAsset('/oversized.webp', 10, signal), /budget/);
    assert.equal(attempts, 1);

    attempts = 0;
    globalThis.fetch = async () => { attempts++; return new Response(null, {status: 503}); };
    await assert.rejects(fetchRomeAsset('/unavailable.webp', 10, signal), /HTTP 503/);
    assert.equal(attempts, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Rome retry wait is aborted when the focused chapter is superseded', async () => {
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  let attempts = 0;
  try {
    globalThis.fetch = async () => { attempts++; throw new TypeError('offline'); };
    const pending = fetchRomeAsset('/rome.webp', 10, controller.signal);
    await new Promise(resolve => setImmediate(resolve));
    controller.abort();
    await assert.rejects(pending, /aborted/);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

function fakeMap() {
  const handlers = new Map();
  const layers = new Map();
  const sources = new Map();
  return {
    moving: false,
    zoom: 1.8,
    center: {lng: 12, lat: 27},
    layers,
    sources,
    on(name, handler) { handlers.set(name, handler); },
    off(name, handler) { if (handlers.get(name) === handler) handlers.delete(name); },
    emit(name) { handlers.get(name)?.(); },
    isMoving() { return this.moving; },
    getCenter() { return this.center; },
    getZoom() { return this.zoom; },
    getLayer(id) { return layers.get(id); },
    addLayer(layer) { layers.set(layer.id, layer); },
    removeLayer(id) { layers.delete(id); },
    getSource(id) { return sources.get(id); },
    addSource(id, source) { sources.set(id, source); },
    removeSource(id) { sources.delete(id); },
  };
}

async function flushMicrotasks() {
  await new Promise(resolve => setImmediate(resolve));
}

test('Rome focus prefetches during a flight and mounts after moveend, not on the homepage', async () => {
  const originalFetch = globalThis.fetch;
  const manifestBytes = await readFile(file('rome-ostiense-v1.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const imageBytes = await readFile(file(manifest.ground.products['1600'].asset));
  const geometryBytes = await readFile(file(manifest.buildings.asset));
  const assets = new Map([
    ['rome-ostiense-v1.json', manifestBytes],
    [manifest.ground.products['1600'].asset, imageBytes],
    [manifest.buildings.asset, geometryBytes],
  ]);
  const requests = [];
  const map = fakeMap();
  const chapter = createRomeVenueChapter({baseUrl:'/'});
  try {
    globalThis.fetch = async (url, {signal}) => {
      assert.equal(signal.aborted, false);
      requests.push(url);
      const bytes = assets.get(url.split('/').pop());
      return bytes ? new Response(bytes) : new Response(null, {status: 404});
    };
    chapter.onAdd(map);
    map.emit('moveend');
    assert.equal(requests.length, 0);

    map.moving = true;
    chapter.setFocus('ethrome-2025');
    await flushMicrotasks();
    await flushMicrotasks();
    assert.equal(requests.length, 3);
    assert.equal(chapter.isVisible(), false);
    assert.equal(map.layers.size, 0);

    map.center = {lng: 12.4791336, lat: 41.8678291};
    map.zoom = 17.45;
    map.moving = false;
    map.emit('moveend');
    await flushMicrotasks();
    assert.equal(chapter.isVisible(), true);
    assert.equal(map.layers.size, 3);
    assert.equal(map.sources.size, 2);
    assert.equal(requests.length, 3); // no second transfer after arrival

    chapter.setFocus('other');
    assert.equal(chapter.isVisible(), false);
    assert.equal(map.layers.size, 0);
    assert.equal(map.sources.size, 0);
  } finally {
    chapter.destroy();
    globalThis.fetch = originalFetch;
  }
});

test('leaving Rome aborts an in-flight predictive fetch before any layer is added', async () => {
  const originalFetch = globalThis.fetch;
  const map = fakeMap();
  const chapter = createRomeVenueChapter({baseUrl:'/'});
  let aborted = false;
  try {
    globalThis.fetch = (_url, {signal}) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => {
        aborted = true;
        reject(new Error('aborted'));
      }, {once: true});
    });
    chapter.onAdd(map);
    chapter.setFocus('ethrome-2025');
    chapter.setFocus('another-event');
    await flushMicrotasks();
    assert.equal(aborted, true);
    assert.equal(chapter.isVisible(), false);
    assert.equal(map.layers.size, 0);
  } finally {
    chapter.destroy();
    globalThis.fetch = originalFetch;
  }
});
