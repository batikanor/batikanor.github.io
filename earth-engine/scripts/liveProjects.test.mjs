import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { LIVE_PROJECTS, liveProjectIndex, adjacentLiveProject, liveProjectUrl } from '../src/liveProjectsData.js';

test('live project destinations include Gralobe’s canonical public demo', () => {
  assert.deepEqual(LIVE_PROJECTS.map(project => project.url), [
    'https://maptheory.org/', 'https://spacecottbus.com/', 'https://cottbus.maptheory.org/', 'https://gralobe.maptheory.org/',
  ]);
  assert.equal(new Set(LIVE_PROJECTS.map(project => project.id)).size, 4);
  for (const project of LIVE_PROJECTS) {
    assert.equal(new URL(project.url).hostname, project.domain);
    assert.equal(new URL(project.previewUrl || project.url).hostname, project.domain);
    assert.ok(Object.isFrozen(project));
  }
  assert.equal(LIVE_PROJECTS[1].previewUrl, 'https://spacecottbus.com/?portfolio-preview=1');
  assert.equal(LIVE_PROJECTS[3].id, 'gralobe');
  assert.equal(LIVE_PROJECTS[3].githubRepo, 'batikanor/gralobe');
  assert.equal(LIVE_PROJECTS[3].githubStars, 92);
  assert.equal(LIVE_PROJECTS[3].githubStarsCheckedAt, '2026-10-15');
});

test('unknown bookmarks recover to Maptheory and project arrows wrap in both directions', () => {
  assert.equal(liveProjectIndex('missing-project'), 0);
  assert.equal(liveProjectIndex('cottbus'), 2);
  assert.equal(liveProjectIndex('gralobe'), 3);
  assert.equal(adjacentLiveProject(0, -1), 3);
  assert.equal(adjacentLiveProject(3, 1), 0);
  assert.equal(adjacentLiveProject(2, 1), 3);
  assert.equal(adjacentLiveProject(1, -1), 0);
});

test('project navigation has a stable map-free URL without stale achievement or CV state', () => {
  const url = liveProjectUrl('https://staging.batikanor.com/cv/?event=old&view=cv&download=pdf#old', 'space-cottbus');
  assert.equal(url.href, 'https://staging.batikanor.com/?view=live-projects&project=space-cottbus');
  assert.equal(liveProjectUrl(url.href, 'unknown').searchParams.get('project'), 'maptheory');
  const tracked = liveProjectUrl('https://staging.batikanor.com/?utm_source=cv&event=old&prototype=room&experience=earth&download=pdf#old', 'cottbus');
  assert.equal(tracked.searchParams.get('utm_source'), 'cv');
  for (const key of ['event', 'prototype', 'experience', 'download']) assert.equal(tracked.searchParams.has(key), false);
});

const runtime = (await readFile(new URL('../src/liveProjects.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');
const brandRuntime = (await readFile(new URL('../src/brandLinks.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace(/^export /gm, '');

function fixture(project = null, { hasResizeObserver = true } = {}) {
  const listeners = new Map(), pushes = [], createdFrames = [], observers = [], requests = [];
  const document = { title: 'Portfolio', activeElement: null };
  class Element {
    constructor(tag, namespace = null) {
      assert.notEqual(tag, 'canvas', 'the parent page must not load a separate GPU or map canvas');
      if (tag === 'svg') assert.equal(namespace, 'http://www.w3.org/2000/svg', 'brand marks use a real SVG namespace');
      this.namespaceURI = namespace;
      this.tagName = tag.toUpperCase(); this.children = []; this.className = ''; this.attributes = new Map(); this.listeners = new Map(); this.dataset = {}; this.clientWidth = 640;
      this.style = { setProperty: (name, value) => { this.style[name] = value; } };
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
        toggle: (name, active) => { if (active) this.classList.add(name); else this.classList.remove(name); },
      };
      if (tag === 'iframe') createdFrames.push(this);
    }
    append(...children) { for (const child of children) { this.children.push(child); child.parent = this; } }
    replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.text = ''; this.append(...children); }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = String(value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    addEventListener(type, callback) { this.listeners.set(type, callback); }
    dispatch(type, props = {}) { const event = { preventDefault() { this.prevented = true; }, ...props }; this.listeners.get(type)?.(event); return event; }
    focus() { document.activeElement = this; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  }
  document.createElement = tag => new Element(tag);
  document.createElementNS = (namespace, tag) => {
    assert.equal(namespace, 'http://www.w3.org/2000/svg');
    return new Element(tag, namespace);
  };
  document.documentElement = new Element('html'); document.documentElement.classList.add('intro-active', 'gallery-pending', 'gallery-experience');
  document.body = new Element('body');
  const app = new Element('div'); app.id = 'app'; app.inert = true; document.body.append(app);
  document.getElementById = id => {
    const visit = node => node.id === id ? node : node.children.map(visit).find(Boolean);
    return visit(document.body);
  };
  const context = vm.createContext({
    LIVE_PROJECTS, adjacentLiveProject, liveProjectIndex, liveProjectUrl, document, URL, AbortController,
    fetch: (url, options = {}) => new Promise((resolve, reject) => {
      // Resolve explicitly, even after abort, to exercise responses already in flight.
      requests.push({ url, options, resolve, reject });
    }),
    window: {}, location: { href: `https://staging.batikanor.com/?view=live-projects${project ? `&project=${project}` : ''}` },
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => { if (listeners.get(type) === callback) listeners.delete(type); },
  });
  if (hasResizeObserver) context.ResizeObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(target) { this.target = target; this.callback(); }
    disconnect() { this.disconnected = true; }
  };
  context.history = { state: null, pushState(_state, _title, url) { context.location.href = url.href; pushes.push(url.href); } };
  new vm.Script(brandRuntime).runInContext(context);
  new vm.Script(runtime).runInContext(context);
  const controller = context.startLiveProjects();
  const walk = node => [node, ...node.children.flatMap(walk)];
  const all = className => walk(controller.root).filter(node => node.className.split(' ').includes(className));
  const respond = (index, body, { ok = true, status = 200 } = {}) => requests[index].resolve({ ok, status, json: async () => body });
  return { context, document, app, controller, pushes, listeners, observers, createdFrames, requests, respond, all, one: className => all(className)[0], nodes: () => walk(controller.root) };
}

const settleRequests = () => new Promise(resolve => setImmediate(resolve));

test('a bookmarked project loads only its real entry screen with a full native outbound link', () => {
  const f = fixture('cottbus');
  const frame = f.one('live-projects-site-frame'), overlay = f.one('live-projects-preview-link');
  assert.equal(f.app.inert, false);
  assert.equal(f.controller.root.dataset.project, 'cottbus');
  assert.equal(f.one('live-projects-name').textContent, 'Map of Cottbus');
  assert.equal(f.createdFrames.length, 1, 'unselected sites must not download or run');
  assert.equal(frame.src, 'https://cottbus.maptheory.org/');
  assert.equal(frame.width, '1280');
  assert.equal(frame.height, '800');
  assert.equal(frame.inert, true);
  assert.equal(frame.tabIndex, -1);
  assert.equal(frame.getAttribute('aria-hidden'), 'true');
  assert.equal(frame.getAttribute('sandbox'), 'allow-scripts allow-same-origin');
  assert.ok(frame.getAttribute('allow').includes("autoplay 'none'"));
  assert.equal(overlay.tagName, 'A');
  assert.equal(overlay.href, 'https://cottbus.maptheory.org/');
  assert.equal(overlay.target, '_blank');
  assert.equal(overlay.rel, 'noopener noreferrer');
  assert.match(overlay.getAttribute('aria-label'), /cottbus\.maptheory\.org/);
  assert.equal(overlay.listeners.has('click'), false, 'native links preserve keyboard activation and open-in-tab');
  assert.equal(overlay.parent, f.one('live-projects-preview'));
  assert.equal(frame.parent, f.one('live-projects-preview-frame'));
  assert.equal(f.one('live-projects-open').href, overlay.href);
  assert.ok(f.one('live-projects-links').children.some(link => link.href === '/?view=world'));
  assert.equal(f.one('live-projects-story').getAttribute('aria-labelledby'), 'live-project-cottbus');
  assert.equal(f.document.documentElement.classList.contains('intro-active'), false);
  assert.equal(f.pushes.length, 0, 'opening a shared URL adds no history entry');
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  assert.equal(descendants(f.one('live-projects-visual')).some(node => node.tagName === 'SVG'), false,
    'site previews remain actual website frames rather than generated illustrations');
  f.controller.dispose();
});

test('branded contact links retain native destinations and accessible text beside the actual site preview', () => {
  const f = fixture();
  for (const [brand, href, text] of [
    ['email', 'mailto:batikanor@gmail.com', 'Email'],
    ['linkedin', 'https://linkedin.com/in/batikanor', 'LinkedIn ↗'],
  ]) {
    const link = f.one(`portfolio-brand-link-${brand}`);
    assert.equal(link.tagName, 'A');
    assert.equal(link.href, href);
    assert.equal(link.textContent, text, 'the hidden icon adds no duplicate accessible name');
    assert.equal(link.listeners.has('click'), false, 'contact links retain native activation');
    const icon = link.children.find(node => node.tagName === 'SVG');
    assert.equal(icon.namespaceURI, 'http://www.w3.org/2000/svg');
    assert.equal(icon.getAttribute('aria-hidden'), 'true');
    assert.equal(icon.getAttribute('focusable'), 'false');
    f.context.decorateBrandLink(link, brand);
    assert.equal(link.children.filter(node => node.tagName === 'SVG').length, 1, 'redecoration cannot duplicate the icon');
    assert.equal(link.textContent, text);
  }
  assert.equal(f.nodes().filter(node => node.tagName === 'SVG').length, 2, 'SVG marks are limited to the two contact links');
  assert.equal(f.createdFrames.length, 1);
  assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[0].url);
  f.controller.dispose();
});

test('native tabs, keyboard selection and browser history keep the single preview and link in sync', () => {
  const f = fixture(), tabs = f.all('live-projects-tab');
  for (let i = 0; i < LIVE_PROJECTS.length; i++) {
    const item = LIVE_PROJECTS[i], oldFrame = f.one('live-projects-site-frame');
    tabs[i].dispatch('click');
    assert.equal(f.controller.root.dataset.project, item.id);
    assert.equal(f.all('live-projects-site-frame').length, 1);
    assert.equal(f.one('live-projects-site-frame').src, item.previewUrl || item.url);
    assert.equal(f.one('live-projects-preview-link').href, item.url);
    assert.equal(f.one('live-projects-open').href, item.url);
    const points = f.one('live-projects-points');
    assert.equal(points.tagName, 'UL');
    assert.deepEqual(points.children.map(node => node.tagName), [...item.points, ...(item.githubRepo ? ['stars'] : [])].map(() => 'LI'));
    assert.deepEqual(points.children.slice(0, item.points.length).map(node => node.textContent), item.points.map(point => typeof point === 'string' ? point : point.text), 'project switching replaces every authored marketing point');
    item.points.forEach((point, pointIndex) => {
      if (typeof point === 'string') return;
      const link = points.children[pointIndex].children[0];
      assert.equal(link.tagName, 'A');
      assert.equal(link.href, point.url);
      assert.equal(link.target, '_blank');
      assert.equal(link.rel, 'noopener noreferrer');
      assert.equal(link.listeners.has('click'), false, 'marketing links preserve native activation');
    });
    assert.equal(tabs[i].getAttribute('aria-selected'), 'true');
    assert.deepEqual(tabs.map(tab => tab.tabIndex), tabs.map((_, index) => index === i ? 0 : -1));
    if (oldFrame !== f.one('live-projects-site-frame')) {
      assert.equal(oldFrame.src, 'about:blank', 'the old site must stop running when another is selected');
      assert.equal(oldFrame.parent, null);
    }
  }
  assert.equal(tabs[3].dispatch('keydown', { key: 'ArrowRight' }).prevented, true);
  assert.equal(f.controller.root.dataset.project, 'maptheory');
  assert.equal(f.document.activeElement, tabs[0]);
  tabs[0].dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(f.controller.root.dataset.project, 'gralobe');
  tabs[2].dispatch('keydown', { key: 'Home' });
  assert.equal(f.controller.root.dataset.project, 'maptheory');
  tabs[0].dispatch('keydown', { key: 'End' });
  assert.equal(f.controller.root.dataset.project, 'gralobe');
  assert.equal(f.document.activeElement, tabs[3]);
  const before = f.pushes.length;
  f.context.location.href = 'https://staging.batikanor.com/?view=live-projects&project=space-cottbus';
  f.listeners.get('popstate')();
  assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[1].previewUrl);
  assert.equal(f.one('live-projects-preview-link').href, LIVE_PROJECTS[1].url);
  assert.equal(f.pushes.length, before, 'Back restores content without pushing another URL');
  const count = f.createdFrames.length;
  tabs[1].dispatch('click');
  assert.equal(f.createdFrames.length, count, 'reselecting a project does not restart its site');
  f.controller.dispose();
});

function assertDatedStarsFallback(f) {
  const stars = f.one('live-projects-github-stars');
  assert.ok(stars, 'Gralobe retains its GitHub stars link when a fresh count is unavailable');
  assert.match(stars.textContent, /92 GitHub stars/);
  assert.match([stars.textContent, stars.title, stars.getAttribute('aria-label')].filter(Boolean).join(' '), /2026-10-15/,
    'a fallback count is identified by the date on which it was checked');
  return stars;
}

test('Gralobe loads its actual demo and requests GitHub stars only when selected, then caches a valid fresh count', async () => {
  const f = fixture();
  assert.equal(f.requests.length, 0, 'opening another project must not fetch Gralobe metadata');
  f.controller.selectProject('gralobe');
  assert.equal(f.controller.root.dataset.project, 'gralobe');
  assert.equal(f.one('live-projects-name').textContent, 'Gralobe');
  assert.equal(f.one('live-projects-site-frame').src, 'https://gralobe.maptheory.org/');
  assert.equal(f.one('live-projects-preview-link').href, 'https://gralobe.maptheory.org/');
  assert.equal(f.one('live-projects-open').href, 'https://gralobe.maptheory.org/');
  const stars = assertDatedStarsFallback(f);
  assert.equal(stars.tagName, 'A');
  assert.equal(stars.href, 'https://github.com/batikanor/gralobe');
  assert.equal(stars.target, '_blank');
  assert.equal(stars.rel, 'noopener noreferrer');
  assert.equal(stars.listeners.has('click'), false, 'the stars bullet remains a native keyboard-accessible link');
  assert.equal(stars.parent.tagName, 'LI');
  assert.equal(stars.parent.parent, f.one('live-projects-points'));
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, 'https://api.github.com/repos/batikanor/gralobe');
  assert.ok(f.requests[0].options.signal instanceof AbortSignal);
  assert.equal(f.requests[0].options.signal.aborted, false);
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 103 });
  await settleRequests();
  assert.match(f.one('live-projects-github-stars').textContent, /103 GitHub stars/);
  f.controller.selectProject('maptheory');
  assert.equal(f.one('live-projects-github-stars'), undefined, 'the stars bullet belongs only to Gralobe');
  f.controller.selectProject('gralobe');
  assert.match(f.one('live-projects-github-stars').textContent, /103 GitHub stars/);
  assert.equal(f.requests.length, 1, 'a successful count is cached for this controller');
  f.controller.dispose();
});

test('switching projects aborts a pending stars request and ignores late results from the previous selection', async () => {
  const f = fixture('gralobe');
  const staleStars = assertDatedStarsFallback(f);
  f.controller.selectProject('space-cottbus');
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.one('live-projects-github-stars'), undefined);
  f.controller.selectProject('gralobe');
  const currentStars = assertDatedStarsFallback(f);
  assert.notEqual(currentStars, staleStars);
  assert.equal(f.requests.length, 2, 'returning after cancellation starts a fresh request');
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 700 });
  await settleRequests();
  assert.equal(f.one('live-projects-github-stars'), currentStars);
  assertDatedStarsFallback(f);
  assert.match(staleStars.textContent, /92 GitHub stars/, 'a stale response cannot update detached content');
  f.respond(1, { full_name: 'batikanor/gralobe', stargazers_count: 104 });
  await settleRequests();
  assert.match(currentStars.textContent, /104 GitHub stars/);
  f.controller.dispose();
});

test('disposing the controller aborts pending GitHub metadata and prevents detached updates', async () => {
  const f = fixture('gralobe');
  const stars = assertDatedStarsFallback(f);
  f.controller.dispose();
  assert.equal(f.requests[0].options.signal.aborted, true);
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 500 });
  await settleRequests();
  assert.match(stars.textContent, /92 GitHub stars/);
  assert.equal(f.app.children.length, 0);
  f.controller.selectProject('gralobe');
  assert.equal(f.requests.length, 1, 'detached controls cannot start another request');
});

test('failed GitHub requests preserve the dated count and the native repository link', async t => {
  for (const [name, fail] of [
    ['network error', f => f.requests[0].reject(new Error('Network unavailable'))],
    ['rate limit', f => f.respond(0, { message: 'Rate limit exceeded' }, { ok: false, status: 429 })],
    ['invalid JSON', f => f.requests[0].resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON'); } })],
  ]) {
    await t.test(name, async () => {
      const f = fixture('gralobe');
      fail(f);
      await settleRequests();
      assert.equal(assertDatedStarsFallback(f).href, 'https://github.com/batikanor/gralobe');
      f.controller.selectProject('cottbus');
      assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[2].url, 'metadata failure does not break project navigation');
      f.controller.dispose();
    });
  }
});

test('GitHub counts require the expected repository and a safe nonnegative integer', async t => {
  for (const [name, body] of [
    ['missing payload', null],
    ['different repository', { full_name: 'someone-else/gralobe', stargazers_count: 103 }],
    ['missing repository', { stargazers_count: 103 }],
    ['missing count', { full_name: 'batikanor/gralobe' }],
    ['text count', { full_name: 'batikanor/gralobe', stargazers_count: '103' }],
    ['negative count', { full_name: 'batikanor/gralobe', stargazers_count: -1 }],
    ['fractional count', { full_name: 'batikanor/gralobe', stargazers_count: 103.5 }],
    ['unsafe count', { full_name: 'batikanor/gralobe', stargazers_count: Number.MAX_SAFE_INTEGER + 1 }],
  ]) {
    await t.test(name, async () => {
      const f = fixture('gralobe');
      f.respond(0, body);
      await settleRequests();
      assertDatedStarsFallback(f);
      f.controller.dispose();
    });
  }
  await t.test('zero is a valid fresh count', async () => {
    const f = fixture('gralobe');
    f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 0 });
    await settleRequests();
    assert.match(f.one('live-projects-github-stars').textContent, /0 GitHub stars/);
    f.controller.dispose();
  });
});

test('loading and failed previews retain native navigation and stale frame events cannot affect a new project', () => {
  const f = fixture();
  const preview = f.one('live-projects-preview'), oldFrame = f.one('live-projects-site-frame');
  assert.equal(preview.dataset.state, 'loading');
  assert.match(f.one('live-projects-preview-status').textContent, /Loading/);
  assert.equal(f.one('live-projects-preview-link').href, LIVE_PROJECTS[0].url);
  oldFrame.onload();
  assert.equal(preview.dataset.state, 'response', 'load means a response, not proven cross-origin rendering');
  assert.equal(f.one('live-projects-open').href, LIVE_PROJECTS[0].url);
  const staleError = oldFrame.onerror;
  f.controller.selectProject('space-cottbus');
  staleError();
  assert.equal(preview.dataset.state, 'loading');
  const frame = f.one('live-projects-site-frame');
  frame.onerror();
  assert.equal(preview.dataset.state, 'unavailable');
  assert.equal(frame.hidden, true);
  assert.match(f.one('live-projects-preview-status').textContent, /Preview unavailable/);
  assert.equal(f.one('live-projects-preview-link').href, LIVE_PROJECTS[1].url);
  assert.equal(f.one('live-projects-open').href, LIVE_PROJECTS[1].url);
  f.controller.selectProject('space-cottbus');
  assert.notEqual(f.one('live-projects-site-frame'), frame, 'reselecting an unavailable preview retries the site');
  assert.equal(preview.dataset.state, 'loading');
  assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[1].previewUrl);
  f.controller.dispose();
});

test('preview resizing preserves the site entry screen without reloading it', () => {
  const f = fixture(), preview = f.one('live-projects-preview'), observer = f.observers[0];
  assert.equal(preview.style['--preview-scale'], '0.5');
  preview.clientWidth = 320;
  observer.callback();
  assert.equal(preview.style['--preview-scale'], '0.25');
  assert.equal(f.createdFrames.length, 1);
  f.controller.dispose();
  assert.equal(observer.disconnected, true);
});

test('disposing the real controller removes listeners, unloads third-party content and disables detached controls', () => {
  const f = fixture(null, { hasResizeObserver: false });
  const tabs = f.all('live-projects-tab'), frame = f.one('live-projects-site-frame');
  const root = f.controller.root;
  assert.equal(f.listeners.has('resize'), true);
  f.one('live-projects-preview').clientWidth = 384;
  f.listeners.get('resize')();
  assert.equal(f.one('live-projects-preview').style['--preview-scale'], '0.3');
  f.controller.dispose(); f.controller.dispose();
  tabs[2].dispatch('click');
  tabs[0].dispatch('keydown', { key: 'End' });
  f.controller.selectProject('cottbus');
  assert.equal(f.pushes.length, 0);
  assert.equal(root.dataset.project, 'maptheory');
  assert.equal(frame.src, 'about:blank');
  assert.equal(frame.onload, null);
  assert.equal(frame.onerror, null);
  assert.equal(f.app.children.length, 0);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.context.window.__liveProjects, undefined);
  assert.equal(f.document.title, 'Portfolio');
});
