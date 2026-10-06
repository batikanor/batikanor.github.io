import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import vm from 'node:vm';
import {renderCvPage, writeCvPages} from '../scripts/cv-pages.mjs';
import {cvDestinationUrl, readPortfolioRoute} from '../earth-engine/src/portfolioRoute.js';

const pdfUrl = 'https://docs.google.com/document/d/1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w/export?format=pdf';
const previewUrl = 'https://docs.google.com/document/d/1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w/preview?rm=minimal';
const paths = ['/cv', '/cv/', '/cv/en', '/cv/en/'];
const shell = (staging = false) => {
  const origin = `https://${staging ? 'staging.' : ''}batikanor.com`;
  return `<!doctype html><html lang="en"><head>
<title>Batıkan — Hacker · Developer · Entrepreneur</title>
<meta name="description" content="Portfolio showcasing the projects and work of Batıkan." />
<meta name="robots" content="${staging ? 'noindex,nofollow' : 'index,follow'}" />
<link rel="canonical" href="${origin}/" />
<meta property="og:url" content="${origin}/" />
<meta property="og:title" content="Batıkan — Hacker · Developer · Entrepreneur" />
<meta property="og:description" content="Portfolio showcasing the projects and work of Batıkan." />
<meta property="og:image" content="${origin}/seo/batikan-social.png" />
<link rel="preconnect" href="https://gibs.earthdata.nasa.gov" crossorigin />
<link rel="dns-prefetch" href="//wmts.terrascope.be" />
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","url":"${origin}/"},{"@type":"ProfilePage","@id":"${origin}/#profile","url":"${origin}/","name":"Batıkan — Hacker · Developer · Entrepreneur","mainEntity":{"@type":"Person","name":"Batıkan Bora Ormancı"}}]}</script>
<script type="module">const response = await fetch('/assets/earth-current.json'); const {entry} = await response.json(); await import(entry);</script>
</head><body><section id="intro-screen"></section><div id="app"><div id="cv-view-root"></div></div>
<noscript><main id="seo-noscript">The map needs JavaScript. <a href="/cv/">CV</a></main></noscript>
</body></html>`;
};

test('both CV aliases retain the current viewer and canonicalize to the CV document', () => {
  for (const alias of [false, true]) {
    const html = renderCvPage(shell(), {alias});
    assert.match(html, /<title>[^<]*CV[^<]*<\/title>/);
    assert.ok(html.includes('rel="canonical" href="https://batikanor.com/cv/"'));
    assert.ok(html.includes('property="og:url" content="https://batikanor.com/cv/"'));
    assert.match(html, /name="robots" content="index,\s*follow/);
    assert.ok(html.includes('id="cv-view-root"'));
    assert.match(html, /<style id="cv-route-style">#intro-screen,#app>:not\(#cv-view-root\)\{display:none!important\}<\/style>/,
      'map-only controls are hidden before JavaScript, without hiding the CV root');
    assert.ok(html.includes('/assets/earth-current.json'));
    assert.ok(html.includes('await import(entry)'));
    assert.ok(!html.includes('self.__next_f'));
    assert.ok(!html.includes('/_next/'));
    assert.ok(!html.includes('http-equiv="refresh"'));
    assert.match(html, /<noscript>[\s\S]*href="\/"/);
    assert.ok(html.includes(previewUrl));
    assert.ok(html.includes(pdfUrl));
    assert.ok(!html.includes('The map needs JavaScript.'));
    assert.ok(!html.includes('href="https://batikanor.com/"'));
    assert.ok(!html.includes('rel="preconnect"'));
    assert.ok(!html.includes('rel="dns-prefetch"'));
    const schemas = Array.from(html.matchAll(/<script type="application\/ld\+json">([^<]+)<\/script>/g));
    assert.equal(schemas.length, 1, 'CV has one replacement schema, not duplicated homepage data');
    const profile = JSON.parse(schemas[0][1])['@graph'].find(item => item['@type'] === 'ProfilePage');
    assert.equal(profile.url, 'https://batikanor.com/cv/');
    assert.equal(profile['@id'], 'https://batikanor.com/cv/#profile');
    assert.equal(profile.name, 'CV | Batıkan Bora Ormancı');
    assert.equal(profile.mainEntity.name, 'Batıkan Bora Ormancı');
  }
});

test('staging CV pages keep staging-only metadata and block indexing', () => {
  for (const alias of [false, true]) {
    const html = renderCvPage(shell(true), {staging: true, alias});
    assert.ok(html.includes('rel="canonical" href="https://staging.batikanor.com/cv/"'));
    assert.ok(html.includes('property="og:url" content="https://staging.batikanor.com/cv/"'));
    assert.match(html, /name="robots" content="noindex,\s*nofollow/);
    assert.ok(!html.includes('https://batikanor.com/'));
    assert.ok(html.includes(previewUrl));
    assert.ok(html.includes(pdfUrl));
  }
});

test('static CV exports create both Pages-compatible directory routes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'batikan-cv-pages-'));
  try {
    await writeCvPages(directory, shell(), {});
    for (const route of ['cv', 'cv/en']) {
      const html = await readFile(join(directory, route, 'index.html'), 'utf8');
      assert.ok(html.includes('id="cv-view-root"'), route);
      assert.ok(html.includes('rel="canonical" href="https://batikanor.com/cv/"'), route);
      assert.ok(html.includes(pdfUrl), route);
    }
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});

test('CV aliases choose the viewer without changing the URL or implicitly downloading', () => {
  for (const path of paths) {
    const href = `https://batikanor.com${path}?utm_source=friend&event=tesla-gigathon-2026#original-anchor`;
    const route = readPortfolioRoute(href);
    assert.equal(route.view, 'cv', path);
    assert.equal(route.downloadCv, false, path);
    assert.equal(new URL(href).pathname, path, 'route parsing cannot silently replace an alias');
    assert.equal(readPortfolioRoute(`${href.replace('#original-anchor', '')}&download=cv`).downloadCv, true, path);
  }
});

async function runCvOnly(href) {
  const source = (await readFile(new URL('../earth-engine/src/cvOnly.js', import.meta.url), 'utf8'))
    .replace(/^import[^\n]+\n/gm, '')
    .replace('export function startCvOnly', 'function startCvOnly');
  const trace = {opened: 0, openCalls: 0, downloads: 0, assignments: [], replacements: []};
  const closeListeners = [];
  const windowListeners = new Map();
  const download = {href: '', click() { trace.downloads += 1; }};
  const elements = {
    'cv-view-root': {},
    'cv-download': download,
    'cv-view': {addEventListener(name, callback) { if (name === 'close') closeListeners.push(callback); }},
  };
  let options;
  let isOpen = false;
  vm.runInNewContext(`${source}\nstartCvOnly();`, {
    URL, cvDestinationUrl,
    portfolioLinks: {cvPdf: pdfUrl},
    bindCvDownload() {},
    createCvView(value) {
      options = value;
      return {
        open() {
          trace.openCalls += 1;
          if (isOpen) return;
          isOpen = true;
          trace.opened += 1;
        },
        isOpen() { return isOpen; },
      };
    },
    document: {getElementById(id) { assert.ok(elements[id], `unexpected DOM access: ${id}`); return elements[id]; }},
    window: {
      location: {href, assign(url) { trace.assignments.push(url); }, replace(url) { trace.replacements.push(url); }},
      addEventListener(name, callback) {
        const listeners = windowListeners.get(name) || [];
        listeners.push(callback);
        windowListeners.set(name, listeners);
      },
    },
  });
  return {
    trace,
    close() { isOpen = false; closeListeners.forEach(callback => callback()); },
    project(slug) { isOpen = false; options.onProjectLink(slug); },
    pageShow(persisted) { (windowListeners.get('pageshow') || []).forEach(callback => callback({persisted})); },
  };
}

test('closing alias CVs returns to the current root view, never back into a CV loop', async () => {
  for (const path of paths) {
    const cv = await runCvOnly(`https://batikanor.com${path}?utm_source=friend&view=cv&event=tesla-gigathon-2026#old-anchor`);
    assert.equal(cv.trace.opened, 1, path);
    assert.equal(cv.trace.downloads, 0, 'no automatic download from an English CV alias');
    cv.close();
    assert.equal(cv.trace.replacements.length, 1, path);
    const destination = new URL(cv.trace.replacements[0]);
    assert.equal(destination.pathname, '/', path);
    assert.equal(destination.hash, '');
    assert.equal(destination.searchParams.get('utm_source'), 'friend');
    assert.equal(destination.searchParams.get('event'), 'tesla-gigathon-2026');
    assert.equal(destination.searchParams.has('view'), false);
    assert.equal(destination.searchParams.has('download'), false);
  }
});

test('project links leave CV aliases for the map and do not race a close redirect', async () => {
  for (const path of paths) {
    const cv = await runCvOnly(`https://batikanor.com${path}?utm_source=friend&view=cv&download=cv#old-anchor`);
    assert.equal(cv.trace.downloads, 1, 'explicit PDF download remains available');
    cv.project('sui-hackathon-poland-2025');
    cv.close();
    assert.equal(cv.trace.assignments.length, 1, path);
    assert.equal(cv.trace.replacements.length, 0, 'project navigation must win over dialog close');
    const destination = new URL(cv.trace.assignments[0]);
    assert.equal(destination.pathname, '/', path);
    assert.equal(destination.hash, '');
    assert.equal(destination.searchParams.get('utm_source'), 'friend');
    assert.equal(destination.searchParams.get('event'), 'sui-hackathon-poland-2025');
    assert.equal(destination.searchParams.has('view'), false);
    assert.equal(destination.searchParams.has('download'), false);
  }
});

test('Back restores a closed CV viewer from BFCache without repeating its PDF download', async () => {
  for (const path of paths) {
    const cv = await runCvOnly(`https://batikanor.com${path}?utm_source=friend&view=cv&download=cv`);
    assert.equal(cv.trace.opened, 1);
    assert.equal(cv.trace.openCalls, 1);
    assert.equal(cv.trace.downloads, 1, 'the explicit initial PDF download still happens');
    cv.pageShow(false);
    assert.equal(cv.trace.openCalls, 1, 'ordinary initial pageshow must not open a second viewer');
    cv.project('tesla-gigathon-2026');
    cv.close();
    assert.equal(cv.trace.replacements.length, 0, 'project navigation wins over the queued close');
    cv.pageShow(true);
    assert.equal(cv.trace.opened, 2, `BFCache restore must reopen ${path}`);
    assert.equal(cv.trace.downloads, 1, 'Back must not trigger another automatic PDF download');
    cv.close();
    assert.equal(cv.trace.replacements.length, 1, 'restored CV must clear the old navigation guard');
    const destination = new URL(cv.trace.replacements[0]);
    assert.equal(destination.pathname, '/');
    assert.equal(destination.searchParams.get('utm_source'), 'friend');
    assert.equal(destination.searchParams.has('view'), false);
    assert.equal(destination.searchParams.has('download'), false);
  }
});

test('project navigation still works after a BFCache-restored CV viewer', async () => {
  for (const path of paths) {
    const cv = await runCvOnly(`https://batikanor.com${path}?utm_source=friend&view=cv`);
    cv.project('tesla-gigathon-2026');
    cv.close();
    cv.pageShow(true);
    cv.project('sui-hackathon-poland-2025');
    cv.close();
    assert.equal(cv.trace.opened, 2, path);
    assert.equal(cv.trace.assignments.length, 2, 'each project selection gets exactly one navigation');
    assert.equal(cv.trace.replacements.length, 0, 'restored project navigation cannot be overwritten by close');
    assert.equal(cv.trace.downloads, 0, 'a bare CV alias never downloads implicitly, even after Back');
    const destination = new URL(cv.trace.assignments[1]);
    assert.equal(destination.pathname, '/');
    assert.equal(destination.searchParams.get('event'), 'sui-hackathon-poland-2025');
    assert.equal(destination.searchParams.get('utm_source'), 'friend');
    assert.equal(destination.searchParams.has('view'), false);
  }
});

test('bootstrap dispatches all CV entries before WebGL detection or the map runtime', async () => {
  const original = await readFile(new URL('../earth-engine/src/bootstrap.js', import.meta.url), 'utf8');
  const end = original.indexOf('\nstart().catch(');
  assert.ok(end > 0, 'bootstrap error boundary must remain present');
  const source = original.slice(0, end).replace(/^import[^\n]+\n/gm, '').replace(/\bimport\(/g, 'importModule(');
  for (const href of [...paths.map(path => `https://batikanor.com${path}`), 'https://batikanor.com/?view=cv', 'https://batikanor.com/#cv']) {
    const calls = [];
    const destination = new URL(href);
    const result = await vm.runInNewContext(`${source}\nstartPortfolio();`, {
      URL, URLSearchParams, readPortfolioRoute,
      location: destination,
      document: {createElement() { assert.fail(`CV entry must not create a WebGL canvas: ${href}`); }},
      async importModule(path) {
        calls.push(path);
        assert.equal(path, './cvOnly.js', `unexpected map/fallback runtime on ${href}`);
        return {startCvOnly() { calls.push('startCvOnly'); }};
      },
      console: {error(...args) { assert.fail(`bootstrap error on ${href}: ${args.join(' ')}`); }},
    });
    assert.equal(result, 'cv', href);
    assert.deepEqual(calls, ['./cvOnly.js', 'startCvOnly']);
  }
});

test('release-manifest bootstrap does not speculatively preload the map on CV routes', async () => {
  const overlay = await readFile(new URL('../scripts/overlay-earth-homepage.mjs', import.meta.url), 'utf8');
  const replacement = overlay.match(/html\s*=\s*html\.replace\(entryTag,\s*(`\s*<script type="module">[\s\S]+?<\/script>`\s*)\);/);
  assert.ok(replacement, 'stable manifest bootstrap must remain extractable from the overlay');
  const markup = vm.runInNewContext(replacement[1]);
  const script = markup.match(/<script type="module">([\s\S]+)<\/script>/)[1].replace(/\bimport\(/g, 'importEntry(');
  for (const href of [...paths.map(path => `https://batikanor.com${path}?utm_source=friend`),
    'https://batikanor.com/?view=cv', 'https://batikanor.com/#cv', 'https://batikanor.com/?view=cv&download=cv']) {
    const preloads = [];
    const imports = [];
    await vm.runInNewContext(`(async () => {${script}})()`, {
      URL, URLSearchParams,
      location: new URL(href),
      document: {
        createElement(tag) { assert.equal(tag, 'link'); return {}; },
        head: {append(link) { preloads.push(link); }},
      },
      async fetch(url, options) {
        assert.ok(url.startsWith('/assets/earth-current.json'), 'only the tiny release manifest may be fetched');
        assert.equal(options.cache, 'no-store');
        return {ok: true, async json() { return {entry: '/assets/index-CvTest.js', mapEntry: '/assets/main-CvTest.js'}; }};
      },
      async importEntry(entry) { imports.push(entry); },
      console: {error(...args) { assert.fail(`manifest bootstrap error on ${href}: ${args.join(' ')}`); }},
    });
    assert.deepEqual(imports, ['/assets/index-CvTest.js'], 'small CV-capable bootstrap still starts');
    assert.equal(preloads.length, 0, `no heavyweight map module preload on ${href}`);
  }
});
