import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldShowIntro, shouldInitializeFallbackNeutral, readIntroVariant, introVariantUrl} from '../src/introGate.js';

test('only the plain homepage waits for an explicit Enter', () => {
  for (const href of [
    'https://batikanor.com/',
    'https://batikanor.com/index.html',
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

test('the two preview variants are shareable without altering another query', () => {
  const first = 'https://staging.batikanor.com/?utm_source=friend';
  assert.equal(readIntroVariant(first), 'editorial');
  const second = introVariantUrl(first, 'dossier');
  assert.equal(second.searchParams.get('utm_source'), 'friend');
  assert.equal(second.searchParams.get('intro'), '2');
  assert.equal(readIntroVariant(second.href), 'dossier');
  assert.equal(introVariantUrl(second.href, 'editorial').searchParams.get('intro'), '1');
});

test('prewarmed no-WebGL fallback stays neutral until Enter on the homepage', () => {
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/', true), true);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/?intro=2', true), true);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/', false), false);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/?view=list', true), false);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/?event=real-coin-map-2025', true), false);
});
