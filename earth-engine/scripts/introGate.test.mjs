import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shouldShowIntro, shouldInitializeFallbackNeutral} from '../src/introGate.js';

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

test('the single dossier introduction has the requested facts and one Enter action', () => {
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
  assert.match(intro, /<span class="intro-enter-label">Enter<\/span>/);
});

test('prewarmed no-WebGL fallback stays neutral until Enter on the homepage', () => {
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/', true), true);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/?intro=2', true), true);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/', false), false);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/?view=list', true), false);
  assert.equal(shouldInitializeFallbackNeutral('https://batikanor.com/?event=real-coin-map-2025', true), false);
});
