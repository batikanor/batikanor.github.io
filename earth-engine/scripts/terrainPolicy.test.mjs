import test from 'node:test';
import assert from 'node:assert/strict';
import {
  terrainPolicy, terrainGapForEvent, hasTerrainGap,
  TERRAIN_CLOSEUP_MIN_ZOOM, HILLSHADE_MAX_ZOOM,
} from '../src/terrainPolicy.js';

test('World keeps relief and known gaps cannot affect unrelated destinations', () => {
  assert.deepEqual(terrainPolicy({zoom: 8}), {
    showTerrain: true, source: 'terrain', maxNativeZoom: 16,
    paused: false, reason: null, hillshadeVisible: true,
  });
  assert.equal(hasTerrainGap('tesla-gigathon-2026'), false);
  assert.equal(terrainGapForEvent(null), null);
  assert.equal(terrainGapForEvent('constructor'), null);
});

test('known regional gaps use existing coarse coverage rather than missing high-zoom tiles', () => {
  for (const eventSlug of ['hong-kong-talent-engage-eurotech-healthtech-2026',
    'ethrome-2025', 'huawei-tech-arena-finland-2025', 'bachelors-thesis', 'tgu-perfect-gpa']) {
    assert.equal(hasTerrainGap(eventSlug), true);
    const policy = terrainPolicy({eventSlug, zoom: 13.8});
    assert.equal(policy.showTerrain, true);
    assert.equal(policy.source, 'terrain-coarse');
    assert.equal(policy.maxNativeZoom, 12);
    assert.equal(policy.hillshadeVisible, false);
  }
});

test('local closeups pause relief whether or not optional scene data has arrived', () => {
  for (const eventSlug of ['tesla-gigathon-2026', 'ethrome-2025']) {
    const policy = terrainPolicy({eventSlug, localScene: true, zoom: 16.8});
    assert.equal(policy.showTerrain, false);
    assert.equal(policy.source, null);
    assert.equal(policy.maxNativeZoom, null);
    assert.equal(policy.paused, true);
    assert.equal(policy.reason, 'local-scene');
    assert.equal(policy.hillshadeVisible, false);
  }
  assert.equal(terrainPolicy({localScene: true, zoom: TERRAIN_CLOSEUP_MIN_ZOOM - .01}).paused, false);
  assert.equal(terrainPolicy({localScene: true, zoom: TERRAIN_CLOSEUP_MIN_ZOOM}).paused, true);
});

test('user OFF remains OFF, driving pause does not mutate caller settings', () => {
  const settings = {enabled: true, driving: true, zoom: 20};
  assert.equal(terrainPolicy(settings).reason, 'driving');
  assert.equal(settings.enabled, true);
  const off = terrainPolicy({enabled: false, driving: true, localScene: true, zoom: 20});
  assert.equal(off.showTerrain, false);
  assert.equal(off.paused, false);
  assert.equal(off.reason, null);
});

test('high-zoom hillshade is not paid for behind the high-resolution photo', () => {
  assert.equal(terrainPolicy({zoom: HILLSHADE_MAX_ZOOM - .01}).hillshadeVisible, true);
  assert.equal(terrainPolicy({zoom: HILLSHADE_MAX_ZOOM}).hillshadeVisible, false);
  assert.equal(terrainPolicy({zoom: 2}).hillshadeVisible, false);
  assert.equal(terrainPolicy({zoom: NaN}).hillshadeVisible, false);
});
