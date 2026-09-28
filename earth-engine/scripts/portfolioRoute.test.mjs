import test from 'node:test';
import assert from 'node:assert/strict';
import {readPortfolioRoute, portfolioUrl} from '../src/portfolioRoute.js';
import {initialMapCamera, ISOMETRIC_CAMERA, COTTBUS_HANGAR_CAMERA, preferLocalStart} from '../src/initialCamera.js';

const slugs = new Set(['tesla-gigathon-2026', 'sui-hackathon-poland-2025']);

test('old root and projects hashes still open the matching map story', () => {
  assert.deepEqual(readPortfolioRoute('https://batikanor.com/#tesla-gigathon-2026', slugs),
    {eventSlug:'tesla-gigathon-2026', view:null, downloadCv:false});
  assert.equal(readPortfolioRoute('https://batikanor.com/projects/#sui-hackathon-poland-2025', slugs).eventSlug,
    'sui-hackathon-poland-2025');
  assert.equal(readPortfolioRoute('https://batikanor.com/?event=not-real', slugs).eventSlug, null);
});

test('CV route and explicit map views survive canonicalization', () => {
  assert.equal(readPortfolioRoute('https://batikanor.com/#cv', slugs).view, 'cv');
  assert.equal(readPortfolioRoute('https://batikanor.com/cv/', slugs).view, 'cv');
  assert.equal(readPortfolioRoute('https://batikanor.com/cv/en/', slugs).downloadCv, true);
  assert.equal(readPortfolioRoute('https://batikanor.com/?view=cv&download=cv', slugs).downloadCv, true);
  const canonical = portfolioUrl('https://batikanor.com/projects/?view=cv#foo',
    {eventSlug:'tesla-gigathon-2026', view:'world'});
  assert.equal(canonical.pathname, '/');
  assert.equal(canonical.hash, '');
  assert.equal(canonical.searchParams.get('event'), 'tesla-gigathon-2026');
  assert.equal(canonical.searchParams.get('view'), 'world');
});

test('only explicit achievement deep links begin locally; World and CV still begin on the globe', () => {
  const world = {center:[12,27], zoom:1.85, pitch:0, bearing:0};
  const events = [{slug:'bayer-ai-2024', coordinates:{lng:11.5802,lat:48.1392}}];
  assert.deepEqual(initialMapCamera({eventSlug:'bayer-ai-2024',view:null},events,world),
    {center:[11.5802,48.1392],zoom:13.8,pitch:0,bearing:0});
  assert.deepEqual(initialMapCamera({eventSlug:'bayer-ai-2024',view:null},events,world,
    {isometricEventSlugs:new Set(['bayer-ai-2024'])}),
  {center:[11.5802,48.1392],...ISOMETRIC_CAMERA});
  const hangar = {slug:'decarbon-days-climathon-2025',coordinates:{lng:14.301040317339991,lat:51.775269384379186}};
  assert.deepEqual(initialMapCamera({eventSlug:hangar.slug,view:null},[hangar],world,
    {isometricEventSlugs:new Set([hangar.slug])}),
  {center:[hangar.coordinates.lng,hangar.coordinates.lat],...COTTBUS_HANGAR_CAMERA});
  for (const route of [
    {eventSlug:null,view:null},
    {eventSlug:'bayer-ai-2024',view:'world'},
    {eventSlug:'bayer-ai-2024',view:'cv'},
    {eventSlug:'unknown',view:null},
  ]) assert.equal(initialMapCamera(route,events,world),world);
  assert.deepEqual(initialMapCamera({eventSlug:null,view:null},events,world,{fastStart:true}),
    {center:[11.5802,48.1392],zoom:13.8,pitch:0,bearing:0});
  for (const view of ['world','cv']) {
    assert.equal(initialMapCamera({eventSlug:'bayer-ai-2024',view},events,world,{fastStart:true}),world);
  }
});

test('a constrained device skips the homepage globe flight, but an ordinary desktop keeps it', () => {
  assert.equal(preferLocalStart({deviceMemory:8}),false);
  assert.equal(preferLocalStart({deviceMemory:4}),true);
  assert.equal(preferLocalStart({coarsePointer:true}),true);
  assert.equal(preferLocalStart({saveData:true}),true);
  assert.equal(preferLocalStart({reducedMotion:true}),true);
});
