import test from 'node:test';
import assert from 'node:assert/strict';
import {readPortfolioRoute, portfolioUrl, cvDestinationUrl, portfolioProjectSlug} from '../src/portfolioRoute.js';
import {initialMapCamera, ISOMETRIC_CAMERA, COTTBUS_HANGAR_CAMERA, preferLocalStart} from '../src/initialCamera.js';

const slugs = new Set(['tesla-gigathon-2026', 'sui-hackathon-poland-2025']);

test('PDF project links recognize current and legacy destinations and stay on the viewer origin', () => {
  for (const host of ['batikanor.com', 'www.batikanor.com', 'staging.batikanor.com']) {
    for (const destination of [
      '/?event=tesla-gigathon-2026', '/#tesla-gigathon-2026',
      '/projects#tesla-gigathon-2026', '/projects/#tesla-gigathon-2026',
      '/index.html?event=tesla-gigathon-2026', '/projects/index.html#tesla-gigathon-2026',
    ]) {
      const slug = portfolioProjectSlug('https://' + host + destination, slugs);
      assert.equal(slug, 'tesla-gigathon-2026');
      const local = cvDestinationUrl('https://staging.batikanor.com/cv/en/?view=cv', slug);
      assert.equal(local.href, 'https://staging.batikanor.com/?event=tesla-gigathon-2026');
    }
  }
  assert.equal(portfolioProjectSlug('http://batikanor.com/?event=unknown#sui-hackathon-poland-2025', slugs), 'sui-hackathon-poland-2025');
  assert.equal(portfolioProjectSlug('https://batikanor.com/#tesla%2Dgigathon%2D2026', slugs), 'tesla-gigathon-2026');
});

test('PDF link recognition leaves external, malformed and unknown destinations unchanged', () => {
  for (const href of [
    'https://example.com/?event=tesla-gigathon-2026',
    'https://batikanor.com.example.com/#tesla-gigathon-2026',
    'https://batikanor.com@other.example/#tesla-gigathon-2026',
    'https://user@batikanor.com/#tesla-gigathon-2026',
    'https://batikanor.com/certificates/file.pdf#tesla-gigathon-2026',
    'https://batikanor.com/?event=unknown', 'https://batikanor.com/#cv',
    'https://batikanor.com/#%ZZ', 'javascript:alert(1)', '/#tesla-gigathon-2026',
  ]) assert.equal(portfolioProjectSlug(href, slugs), null, href);
});

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
  assert.equal(readPortfolioRoute('https://batikanor.com/cv/en/', slugs).downloadCv, false);
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


test('all CV aliases open the map-free viewer without automatic downloads',()=>{
  for (const path of ['/cv','/cv/','/cv/en','/cv/en/','/cv/index.html','/cv/en/index.html']) {
    const route=readPortfolioRoute('https://batikanor.com'+path);
    assert.equal(route.view,'cv',path);assert.equal(route.downloadCv,false,path);
    assert.equal(readPortfolioRoute('https://batikanor.com'+path+'?download=cv').downloadCv,true);
  }
});

test('standalone CV exits and project links return to the site root without alias loops',()=>{
  for (const path of ['/cv/','/cv/en/','/']) {
    const href='https://staging.batikanor.com'+path+'?view=cv&download=cv&utm_source=cv#section';
    const home=cvDestinationUrl(href),project=cvDestinationUrl(href,'tesla-gigathon-2026');
    assert.equal(home.pathname,'/');assert.equal(home.origin,'https://staging.batikanor.com');
    assert.equal(home.searchParams.get('utm_source'),'cv');assert.equal(home.hash,'');
    assert.equal(home.searchParams.has('view'),false);assert.equal(home.searchParams.has('download'),false);
    assert.equal(project.pathname,'/');assert.equal(project.searchParams.get('event'),'tesla-gigathon-2026');
    assert.equal(readPortfolioRoute(home.href).view,null);
  }
  assert.equal(cvDestinationUrl('https://batikanor.com/cv/?event=tesla-gigathon-2026').searchParams.get('event'),'tesla-gigathon-2026');
});
