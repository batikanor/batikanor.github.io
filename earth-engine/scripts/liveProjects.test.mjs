import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { LIVE_PROJECTS, liveProjectIndex, adjacentLiveProject, liveProjectUrl } from '../src/liveProjectsData.js';
import { mountNpmDownloads } from '../src/npmDownloads.js';
import { mountGithubStars } from '../src/githubStars.js';
import { GITHUB_STARS_URL } from '../src/githubStarsData.js';
const seed = {full_name: 'batikanor/gralobe', stargazers_count: 120, verified_at: '2026-10-26T00:00:00Z'};

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
  assert.equal(LIVE_PROJECTS[0].dailyUniqueVisitors, 100);
  assert.equal(LIVE_PROJECTS.slice(1).some(project => project.dailyUniqueVisitors), false);
  assert.equal(LIVE_PROJECTS[3].id, 'gralobe');
  assert.equal(LIVE_PROJECTS[3].githubRepo, 'batikanor/gralobe');
  assert.equal(LIVE_PROJECTS[3].githubStars, undefined, 'stars have no fixed numeric fallback');
  assert.equal(LIVE_PROJECTS[3].githubStarsCheckedAt, undefined);
  assert.equal(LIVE_PROJECTS[3].npmPackage, 'gralobe');
  assert.equal(LIVE_PROJECTS[3].npmPublishedOn, '2025-11-29');
  assert.equal(LIVE_PROJECTS[3].points.some(point => /weekly users/.test(point)), false);
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
  const listeners = new Map(), pushes = [], createdFrames = [], observers = [], requests = [], npmRequests = [];
  const document = { title: 'Portfolio', activeElement: null };
  class Element {
    constructor(tag, namespace = null) {
      assert.notEqual(tag, 'canvas', 'the parent page must not load a separate GPU or map canvas');
      if (tag === 'svg') assert.equal(namespace, 'http://www.w3.org/2000/svg', 'brand marks use a real SVG namespace');
      this.namespaceURI = namespace;
      this.tagName = tag.toUpperCase(); this.children = []; this.className = ''; this.attributes = new Map(); this.listeners = new Map(); this.dataset = {}; this.clientWidth = 640; this.clientHeight = 400;
      this.style = { setProperty: (name, value) => { this.style[name] = value; } };
      this.classList = {
        contains: name => this.className.split(' ').includes(name),
        add: (...names) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...names])].join(' '); },
        remove: (...names) => { this.className = this.className.split(' ').filter(name => !names.includes(name)).join(' '); },
        toggle: (name, active) => { if (active) this.classList.add(name); else this.classList.remove(name); },
      };
      if (tag === 'iframe') createdFrames.push(this);
    }
    get parentElement() { return this.parent || null; }
    append(...children) {
      for (const child of children) {
        const descendants = node => [node, ...node.children.flatMap(descendants)];
        if (child.parent) for (const frame of descendants(child).filter(node => node.tagName === 'IFRAME')) frame.contextRestarts = (frame.contextRestarts || 0) + 1;
        child.remove(); this.children.push(child); child.parent = this;
      }
    }
    replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.text = ''; this.append(...children); }
    set textContent(value) { this.text = value; this.children = []; }
    get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
    setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'class') this.className = String(value); }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    querySelector(selector) {
      const matches = node => selector.startsWith('.') ? node.classList.contains(selector.slice(1)) : node.getAttribute(selector.slice(1, -1)) !== null;
      const find = node => node.children.find(matches) || node.children.map(find).find(Boolean);
      return find(this) || null;
    }
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
  const fetcher = (url, options = {}) => new Promise((resolve, reject) => {
    const pending = url.startsWith('https://api.npmjs.org/') ? npmRequests : requests;
    pending.push({ url, options, resolve, reject });
  });
  const context = vm.createContext({
    LIVE_PROJECTS, adjacentLiveProject, liveProjectIndex, liveProjectUrl, document, URL, AbortController,
    fetch: fetcher,
    mountNpmDownloads: node => mountNpmDownloads(node, { fetch: fetcher }),
    mountGithubStars: node => mountGithubStars(node, { fetch: fetcher, document, window: null, snapshot: seed }),
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
  const respond = (index, body, { ok = true, status = 200 } = {}) => requests[index].resolve({ ok, status, json: async () => body && ({ verified_at: new Date().toISOString(), ...body }) });
  const respondNpm = (index, body, { ok = true } = {}) => npmRequests[index].resolve({ ok, json: async () => body });
  return { context, document, app, controller, pushes, listeners, observers, createdFrames, requests, npmRequests, respond, respondNpm, all, one: className => all(className)[0], nodes: () => walk(controller.root) };
}

const settleRequests = () => new Promise(resolve => setImmediate(resolve));

test('a bookmarked project fronts its own window and loads only its passive real entry screen', () => {
  const f = fixture('cottbus');
  const frame = f.one('live-projects-site-frame'), address = f.all('live-projects-browser-domain')[2];
  const cards = f.all('live-projects-card'), preview = f.one('live-projects-preview');
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
  assert.equal(address.tagName, 'A');
  assert.equal(address.href, 'https://cottbus.maptheory.org/');
  assert.equal(address.target, '_blank');
  assert.equal(address.rel, 'noopener noreferrer');
  assert.match(address.getAttribute('aria-label'), /cottbus\.maptheory\.org/);
  assert.equal(address.listeners.has('click'), false, 'native links preserve keyboard activation and open-in-tab');
  assert.equal(address.parent.parent, cards[2]);
  assert.equal(preview.parent, f.all('live-projects-window-body')[2], 'the body contains the passive preview beneath its selection overlay');
  assert.equal(frame.parent, f.one('live-projects-preview-frame'));
  assert.equal(f.one('live-projects-open').href, address.href);
  assert.ok(f.one('live-projects-links').children.some(link => link.href === '/?view=world'));
  assert.equal(f.one('live-projects-story').getAttribute('role'), 'tabpanel');
  assert.equal(f.one('live-projects-story').getAttribute('aria-labelledby'), 'live-project-cottbus');
  assert.equal(f.one('live-projects-name').id, 'live-projects-name');
  assert.equal(f.document.documentElement.classList.contains('intro-active'), false);
  assert.equal(f.pushes.length, 0, 'opening a shared URL adds no history entry');
  assert.equal(cards.length, LIVE_PROJECTS.length);
  assert.ok(cards.every(card => card.tagName === 'FIGURE'));
  assert.equal(f.one('live-projects-mosaic').getAttribute('role'), 'tablist');
  assert.equal(f.one('live-projects-shelf'), undefined, 'the window headers choose a project');
  assert.equal(f.one('live-projects-tabs'), undefined, 'there is no duplicate selector row');
  assert.equal(f.all('live-projects-preview-select').length, LIVE_PROJECTS.length, 'every preview provides a separate native selection control');
  assert.equal(f.one('live-projects-preview-action'), undefined);
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
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  assert.equal(descendants(f.one('live-projects-links')).filter(node => node.tagName === 'SVG').length, 2, 'each contact keeps exactly one original brand mark');
  assert.equal(f.createdFrames.length, 1);
  assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[0].url);
  f.controller.dispose();
});

test('window header brands preserve original artwork without adding nested interactive controls or duplicate accessible names', () => {
  const f = fixture(), tabs = f.all('live-projects-tab');
  const captions = f.all('live-projects-tab-caption');
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  assert.equal(f.all('live-projects-tab-check').length, 0, 'selection uses the existing border without an additional tick');
  for (const [index, tab] of tabs.entries()) {
    const item = LIVE_PROJECTS[index];
    const brand = captions[index].children[0];
    assert.equal(tab.dataset.project, item.id);
    assert.equal(tab.getAttribute('aria-label'), item.name);
    assert.equal(brand.className, 'live-projects-tab-brand');
    assert.equal(brand.getAttribute('aria-hidden'), 'true', 'artwork is decorative beside the full native project name');
    assert.equal(captions[index].children[1].children[0].textContent, item.name);
    assert.equal(captions[index].children.length, 2, 'headers contain only the project brand and name');
    assert.equal(descendants(tab).filter(node => node.tagName === 'BUTTON').length, 1);
    assert.equal(descendants(tab).some(node => node.tagName === 'A'), false, 'selection cards remain native tabs, with outbound links outside their controls');
    const previewButton = f.all('live-projects-preview-select')[index];
    const body = f.all('live-projects-window-body')[index];
    assert.equal(descendants(tab).some(node => node.classList.contains('live-projects-thumbnail')), false, 'the header and preview provide separate selection targets');
    assert.equal(previewButton.parent, body, 'the native selection overlay covers the same body as its capture');
    const thumbnail = descendants(body).find(node => node.classList.contains('live-projects-thumbnail'));
    assert.equal(thumbnail.parent, body, 'the decorative capture is a sibling of the native overlay');
    assert.equal(thumbnail.tagName, 'IMG', 'every window uses a capture of its actual website');
    assert.match(thumbnail.src, /^\/assets\//, 'preview captures ship locally with the release');
    assert.equal(thumbnail.alt, '', 'the preview button’s explicit label names its decorative capture');
    assert.equal(thumbnail.draggable, false);
  }
  for (const [index, src, width, height] of [
    [0, '/assets/intro-projects/maptheory.svg?v=618ba754db94', 46, 46],
    [1, '/assets/intro-projects/space-cottbus.svg?v=63fc4767a4c0', 150, 59],
  ]) {
    const image = captions[index].children[0].children[0];
    assert.equal(image.tagName, 'IMG');
    assert.equal(image.src, src);
    assert.equal(image.width, width);
    assert.equal(image.height, height);
    assert.equal(image.alt, '');
    assert.equal(image.getAttribute('aria-hidden'), 'true');
    assert.equal(image.draggable, false);
  }
  const cottbus = captions[2].children[0].children[0];
  assert.equal(cottbus.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(cottbus.getAttribute('viewBox'), '-2 -8 35 47', 'the original tile mark retains its complete bounds');
  assert.equal(cottbus.getAttribute('focusable'), 'false');
  assert.deepEqual(cottbus.children.map(node => node.getAttribute('transform')), ['translate(6 1)', 'translate(0 9)', 'translate(12 11)']);
  assert.deepEqual(cottbus.children.map(node => node.children[0].getAttribute('fill')), ['#dc915a', '#efd7a6', '#a6bfae']);
  assert.ok(cottbus.children.every(node => node.children[0].getAttribute('transform') === 'matrix(.57735 1 -.43 .74478 8.1002 -7.0754)'));
  assert.equal(captions[3].children[0].children[0].textContent, 'gralobe');
  assert.equal(captions[3].children[0].children[0].className, 'live-projects-tab-wordmark');
  const brandNodes = captions.map(caption => caption.children[0]);
  f.controller.selectProject('gralobe');
  assert.deepEqual(captions.map(caption => caption.children[0]), brandNodes, 'selection preserves original logo nodes');
  f.controller.dispose();
});

test('every desk window retains its independent canonical address and stable native selection nodes', () => {
  const f = fixture('space-cottbus');
  const cards = f.all('live-projects-card'), addresses = f.all('live-projects-browser-domain');
  const tabs = f.all('live-projects-tab'), thumbnails = f.all('live-projects-thumbnail');
  const previewButtons = f.all('live-projects-preview-select'), bodies = f.all('live-projects-window-body'), grips = f.all('live-projects-window-grip');
  const preview = f.one('live-projects-preview');
  addresses.forEach((address, index) => {
    const item = LIVE_PROJECTS[index];
    assert.equal(address.tagName, 'A');
    assert.equal(address.href, item.url, 'public URLs never inherit iframe-only preview parameters');
    assert.equal(address.textContent, item.domain);
    assert.equal(address.target, '_blank');
    assert.equal(address.rel, 'noopener noreferrer');
    assert.equal(address.getAttribute('aria-label'), `Visit ${item.domain} — opens in a new tab`);
    assert.equal(address.listeners.has('click'), false);
    assert.equal(address.parent.parent, cards[index]);
    assert.notEqual(address.parent, tabs[index], 'website links are siblings of card selection controls');
  });
  for (const item of LIVE_PROJECTS) {
    f.controller.selectProject(item.id);
    assert.deepEqual(f.all('live-projects-card'), cards);
    assert.deepEqual(f.all('live-projects-browser-domain'), addresses);
    assert.deepEqual(f.all('live-projects-tab'), tabs);
    assert.deepEqual(f.all('live-projects-thumbnail'), thumbnails);
    assert.deepEqual(f.all('live-projects-preview-select'), previewButtons);
    assert.deepEqual(f.all('live-projects-window-body'), bodies);
    assert.deepEqual(f.all('live-projects-window-grip'), grips);
    assert.equal(f.one('live-projects-preview'), preview, 'selection moves the actual preview rather than cloning it');
    assert.equal(preview.parent, bodies[liveProjectIndex(item.id)]);
    assert.equal(f.one('live-projects-site-frame').src, item.previewUrl || item.url);
    assert.equal(f.all('live-projects-site-frame').length, 1, 'only the selected website can execute');
  }
  const historyCount = f.pushes.length;
  f.context.location.href = 'https://staging.batikanor.com/?view=live-projects&project=space-cottbus';
  f.listeners.get('popstate')();
  assert.equal(preview.parent, bodies[1]);
  assert.deepEqual(f.all('live-projects-browser-domain'), addresses);
  assert.equal(f.pushes.length, historyCount, 'Back restores the address without an extra navigation');
  f.controller.dispose();
});

test('clicking any passive app preview selects and fronts its project while only native URL links visit sites', () => {
  const f = fixture('maptheory');
  const cards = f.all('live-projects-card'), buttons = f.all('live-projects-preview-select');
  const tabs = f.all('live-projects-tab'), grips = f.all('live-projects-window-grip');
  const addresses = f.all('live-projects-browser-domain'), bodies = f.all('live-projects-window-body');
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  assert.equal(buttons.length, LIVE_PROJECTS.length);
  assert.equal(grips.length, LIVE_PROJECTS.length);
  assert.equal(f.one('live-projects-preview-link'), undefined, 'app previews no longer navigate away');
  for (const [index, button] of buttons.entries()) {
    const item = LIVE_PROJECTS[index], tab = tabs[index], grip = grips[index];
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.type, 'button');
    assert.equal(button.href, undefined, 'preview activation has no website destination');
    assert.equal(button.target, undefined);
    assert.equal(button.getAttribute('aria-label'), `Select ${item.name}`);
    assert.equal(button.getAttribute('aria-controls'), 'live-projects-panel');
    assert.equal(button.parent, bodies[index]);
    assert.equal(bodies[index].parent, cards[index]);
    assert.equal(descendants(button).some(node => ['BUTTON', 'A', 'IFRAME'].includes(node.tagName) && node !== button), false, 'native selection overlays contain no nested controls or browsing contexts');
    assert.equal(tab.tagName, 'BUTTON');
    assert.equal(tab.getAttribute('role'), 'tab');
    assert.equal(grip.tagName, 'BUTTON');
    assert.match(grip.getAttribute('aria-label'), /move/i);
    assert.equal(descendants(tab).includes(grip), false, 'moving and selecting are separate controls');
    button.dispatch('click');
    assert.equal(f.controller.root.dataset.project, item.id);
    assert.equal(cards[index].classList.contains('is-selected'), true, 'preview selection fronts and highlights the matching window');
    assert.deepEqual(buttons.map(node => node.getAttribute('aria-pressed')), buttons.map((_, current) => String(current === index)));
    assert.equal(tab.getAttribute('aria-selected'), 'true', 'preview and header selection stay synchronized');
    assert.equal(f.one('live-projects-name').textContent, item.name);
    assert.equal(f.one('live-projects-preview').parent, bodies[index]);
    assert.equal(f.one('live-projects-site-frame').src, item.previewUrl || item.url);
    assert.equal(new URL(f.context.location.href).searchParams.get('project'), item.id);
    const frame = f.one('live-projects-site-frame'), frameCount = f.createdFrames.length, historyCount = f.pushes.length;
    const points = f.one('live-projects-points').children;
    button.dispatch('click');
    assert.equal(f.one('live-projects-site-frame'), frame, 'clicking the selected preview cannot reload its website');
    assert.equal(frame.contextRestarts || 0, 0);
    assert.equal(f.createdFrames.length, frameCount);
    assert.equal(f.one('live-projects-points').children, points);
    assert.equal(f.pushes.length, historyCount, 'repeated preview selection adds no history entry');
    assert.equal(addresses[index].tagName, 'A');
    assert.equal(addresses[index].href, item.url, 'only the separate blue URL retains the canonical website destination');
    assert.equal(addresses[index].target, '_blank');
    assert.equal(addresses[index].rel, 'noopener noreferrer');
    assert.equal(addresses[index].listeners.has('click'), false, 'website links retain native activation and modifiers');
    assert.equal(frame.inert, true);
    assert.equal(frame.tabIndex, -1);
    assert.equal(frame.getAttribute('aria-hidden'), 'true');
  }
  assert.equal(f.pushes.length, LIVE_PROJECTS.length - 1, 'changing preview selections records portfolio history');
  assert.equal(f.all('live-projects-site-frame').length, 1, 'only the selected passive app can execute');
  f.controller.dispose();
});

test('moving a selected desk window preserves its passive preview and content without opening a website', () => {
  const f = fixture('maptheory'), grip = f.all('live-projects-window-grip')[0];
  const card = f.all('live-projects-card')[0], frame = f.one('live-projects-site-frame');
  const points = f.one('live-projects-points').children;
  assert.equal(grip.dispatch('pointerdown', { pointerId: 7, button: 0, isPrimary: true, clientX: 100, clientY: 100 }).prevented, true);
  assert.equal(f.document.activeElement, grip, 'the move control retains keyboard focus');
  grip.dispatch('pointermove', { pointerId: 7, clientX: 125, clientY: 110 });
  const movedX = card.style['--window-x'];
  assert.notEqual(movedX, undefined, 'dragging updates the window position');
  grip.dispatch('pointerup', { pointerId: 7 });
  grip.dispatch('pointermove', { pointerId: 7, clientX: 200, clientY: 200 });
  assert.equal(card.style['--window-x'], movedX, 'releasing the grip ends the move');
  assert.equal(grip.dispatch('keydown', { key: 'ArrowLeft' }).prevented, true);
  assert.notEqual(card.style['--window-x'], movedX, 'keyboard arrows can adjust the selected window');
  assert.equal(f.one('live-projects-site-frame'), frame);
  assert.equal(frame.contextRestarts || 0, 0, 'moving a window must not detach its embedded browser');
  assert.equal(f.one('live-projects-points').children, points);
  assert.equal(f.createdFrames.length, 1);
  assert.equal(f.pushes.length, 0, 'moving the selected window does not change portfolio history');
  const finalX = card.style['--window-x'];
  f.controller.dispose();
  grip.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(card.style['--window-x'], finalX, 'detached move controls cannot change state');
});

test('native tabs, keyboard selection and browser history keep the single preview and link in sync', () => {
  const f = fixture(), tabs = f.all('live-projects-tab');
  for (let i = 0; i < LIVE_PROJECTS.length; i++) {
    const item = LIVE_PROJECTS[i], oldFrame = f.one('live-projects-site-frame');
    tabs[i].dispatch('click');
    assert.equal(f.controller.root.dataset.project, item.id);
    assert.equal(f.all('live-projects-site-frame').length, 1);
    assert.equal(f.one('live-projects-site-frame').src, item.previewUrl || item.url);
    assert.equal(f.all('live-projects-browser-domain')[i].href, item.url);
    assert.equal(f.one('live-projects-open').href, item.url);
    const points = f.one('live-projects-points');
    assert.equal(points.tagName, 'UL');
    assert.deepEqual(points.children.map(node => node.tagName), item.points.map(() => 'LI'));
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
  assert.equal(f.all('live-projects-browser-domain')[1].href, LIVE_PROJECTS[1].url);
  assert.equal(f.pushes.length, before, 'Back restores content without pushing another URL');
  const count = f.createdFrames.length;
  tabs[1].dispatch('click');
  assert.equal(f.createdFrames.length, count, 'reselecting a project does not restart its site');
  f.controller.dispose();
});

test('previous and next controls wrap the selected window without recreating its native controls', () => {
  const f = fixture(), cards = f.all('live-projects-card'), tabs = f.all('live-projects-tab');
  const previous = f.one('live-projects-previous'), next = f.one('live-projects-next');
  assert.equal(previous.tagName, 'BUTTON');
  assert.equal(next.tagName, 'BUTTON');
  assert.match(previous.getAttribute('aria-label'), /previous/i);
  assert.match(next.getAttribute('aria-label'), /next/i);
  assert.match(f.one('live-projects-count').textContent, /1\s*\/\s*4/);
  previous.dispatch('click');
  assert.equal(f.controller.root.dataset.project, 'gralobe');
  assert.equal(f.one('live-projects-preview').parent, f.all('live-projects-window-body')[3]);
  assert.match(f.one('live-projects-count').textContent, /4\s*\/\s*4/);
  next.dispatch('click');
  assert.equal(f.controller.root.dataset.project, 'maptheory');
  assert.equal(f.one('live-projects-preview').parent, f.all('live-projects-window-body')[0]);
  assert.match(f.one('live-projects-count').textContent, /1\s*\/\s*4/);
  assert.deepEqual(f.all('live-projects-tab'), tabs);
  assert.equal(f.all('live-projects-site-frame').length, 1);
  f.controller.dispose();
});

function assertVerifiedStars(f) {
  const stars = f.one('live-projects-github-stars');
  assert.ok(stars, 'Gralobe retains its verified number and native GitHub link while refreshing');
  assert.equal(stars.querySelector('.stat-pennant-number').textContent, String(seed.stargazers_count));
  assert.match(stars.getAttribute('aria-label'), /120 GitHub stars/);
  assert.doesNotMatch(`${stars.title} ${stars.getAttribute('aria-label')}`, /unavailable|retry|refresh|verified/i);
  assert.equal(stars.hidden, false);
  assert.equal(stars.dataset.githubRepo, 'batikanor/gralobe');
  return stars;
}

test('Maptheory keeps its owner-supplied visitor pennant plain and visible regardless of selection', () => {
  const f = fixture('maptheory');
  const visitors = f.one('live-projects-daily-visitors');
  const maptheory = f.all('live-projects-card')[0];
  assert.equal(visitors.tagName, 'SPAN');
  assert.ok(visitors.classList.contains('stat-pennant--visitors'));
  assert.equal(visitors.getAttribute('aria-label'), null, 'the visible caption supplies the accessible text');
  assert.equal(visitors.querySelector('.stat-pennant-number').textContent, '~100');
  const caption = visitors.querySelector('.stat-pennant-caption');
  assert.equal(caption.textContent.trim(), 'daily unique visitors');
  const unique = caption.querySelector('.stat-pennant-unique');
  assert.equal(unique.textContent, 'unique ');
  assert.equal(unique.getAttribute('aria-hidden'), null);
  assert.equal(caption.children[1].textContent, 'visitors');
  assert.equal(visitors.parent.parent.parent, maptheory);
  assert.ok(visitors.parent.parent.classList.contains('has-project-stats'));
  assert.ok(visitors.parent.parent.classList.contains('has-visitor-stats'));
  for (const attribute of ['href', 'role', 'tabindex', 'title']) assert.equal(visitors.getAttribute(attribute), null);
  assert.equal(visitors.href, undefined);
  assert.equal(visitors.tabIndex, undefined);
  assert.equal(visitors.listeners.size, 0);
  assert.equal(visitors.title, undefined);
  assert.equal(maptheory.classList.contains('is-selected'), true);
  assert.equal(f.requests.length, 1, 'only the separately evidenced GitHub count is fetched');
  assert.equal(f.npmRequests.length, 1, 'only the separately evidenced npm count is fetched');
  f.controller.selectProject('gralobe');
  assert.equal(maptheory.classList.contains('is-selected'), false);
  assert.equal(f.one('live-projects-daily-visitors'), visitors, 'unselected Maptheory retains the same visible statistic');
  assert.equal(visitors.querySelector('.stat-pennant-unique'), unique, 'selection preserves the same daily unique visitors caption');
  assert.equal(caption.textContent.trim(), 'daily unique visitors');
  assert.equal(visitors.hidden, undefined);
  assert.equal(visitors.getAttribute('hidden'), null);
  assert.equal(visitors.getAttribute('aria-hidden'), null);
  assert.equal(f.all('live-projects-daily-visitors').length, 1);
  assert.equal(f.controller.root.textContent.includes('unique users'), false);
  assert.equal(f.controller.root.textContent.includes('weekly users'), false);
  f.controller.selectProject('maptheory');
  assert.equal(f.one('live-projects-daily-visitors'), visitors);
  assert.equal(visitors.querySelector('.stat-pennant-unique'), unique);
  assert.equal(f.all('live-projects-browser-domain')[0].href, 'https://maptheory.org/');
  f.controller.dispose();
});

test('Gralobe keeps one native stars link in its window regardless of selection and caches fresh metadata', async () => {
  const f = fixture();
  const stars = assertVerifiedStars(f);
  assert.equal(f.requests.length, 1, 'the visible Gralobe counter refreshes even while another project is selected');
  assert.ok(stars.parent.classList.contains('live-projects-window-stats'));
  assert.equal(stars.parent.parent.parent, f.all('live-projects-card')[3]);
  assert.equal(f.all('live-projects-card')[3].classList.contains('is-selected'), false);
  f.controller.selectProject('gralobe');
  assert.equal(f.controller.root.dataset.project, 'gralobe');
  assert.equal(f.one('live-projects-name').textContent, 'Gralobe');
  assert.equal(f.one('live-projects-site-frame').src, 'https://gralobe.maptheory.org/');
  assert.equal(f.all('live-projects-browser-domain')[3].href, 'https://gralobe.maptheory.org/');
  assert.equal(f.one('live-projects-open').href, 'https://gralobe.maptheory.org/');
  assert.equal(stars.tagName, 'A');
  assert.equal(stars.href, 'https://github.com/batikanor/gralobe');
  assert.equal(stars.target, '_blank');
  assert.equal(stars.rel, 'noopener noreferrer');
  assert.equal(stars.listeners.has('click'), false, 'stars retain native keyboard activation and open-in-tab');
  assert.ok(stars.classList.contains('stat-pennant--github'));
  const brand = stars.querySelector('.stat-pennant-brand');
  assert.equal(brand.getAttribute('aria-hidden'), 'true');
  assert.equal(stars.querySelector('.stat-pennant-label').textContent, 'stars');
  assert.ok(stars.parent.classList.contains('stat-pennants'));
  assert.ok(stars.parent.parent.classList.contains('has-project-stats'));
  assert.equal(f.all('live-projects-github-stars').length, 1, 'selected details do not duplicate the persistent counter');
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].url, GITHUB_STARS_URL);
  assert.ok(f.requests[0].options.signal instanceof AbortSignal);
  assert.equal(f.requests[0].options.signal.aborted, false);
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 103 });
  await settleRequests();
  assert.equal(stars.querySelector('.stat-pennant-number').textContent, '103');
  assert.equal(stars.querySelector('.stat-pennant-brand'), brand, 'fetching a count preserves the original branded pennant');
  assert.match(stars.getAttribute('aria-label'), /103 GitHub stars/);
  f.controller.selectProject('maptheory');
  assert.equal(f.one('live-projects-github-stars'), stars, 'the Gralobe counter remains available while another project is selected');
  f.controller.selectProject('gralobe');
  assert.equal(stars.querySelector('.stat-pennant-number').textContent, '103');
  assert.equal(f.requests.length, 1, 'a successful count is cached for this controller');
  f.controller.dispose();
});

test('selection keeps visible metadata requests running without recreating the native counter nodes', async () => {
  const f = fixture('gralobe');
  const stars = assertVerifiedStars(f);
  const downloads = f.one('live-projects-npm-downloads');
  f.controller.selectProject('space-cottbus');
  assert.equal(f.requests[0].options.signal.aborted, false);
  assert.equal(f.npmRequests[0].options.signal.aborted, false);
  assert.equal(f.one('live-projects-github-stars'), stars);
  f.controller.selectProject('gralobe');
  assert.equal(f.one('live-projects-github-stars'), stars);
  assert.equal(f.one('live-projects-npm-downloads'), downloads);
  assert.equal(f.requests.length, 1, 'selection does not duplicate requests for the persistent counter');
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 104 });
  await settleRequests();
  assert.equal(stars.querySelector('.stat-pennant-number').textContent, '104');
  f.controller.dispose();
});

test('the persistent npm link fetches its actual latest available total since publication', async () => {
  const f = fixture('maptheory');
  const downloads = f.one('live-projects-npm-downloads');
  assert.equal(downloads.tagName, 'A');
  assert.equal(downloads.href, 'https://www.npmjs.com/package/gralobe');
  assert.equal(downloads.target, '_blank');
  assert.equal(downloads.rel, 'noopener noreferrer');
  assert.equal(downloads.listeners.has('click'), false);
  assert.ok(downloads.parent.classList.contains('live-projects-window-stats'));
  assert.equal(downloads.dataset.npmPackage, 'gralobe');
  assert.equal(downloads.dataset.npmPublishedOn, '2025-11-29');
  assert.ok(downloads.classList.contains('stat-pennant--npm'));
  const brand = downloads.querySelector('.stat-pennant-brand');
  const count = downloads.querySelector('[data-npm-count]');
  assert.equal(brand.getAttribute('aria-hidden'), 'true');
  assert.equal(downloads.querySelector('.stat-pennant-label').textContent, 'downloads');
  assert.equal(count.textContent, '…');
  assert.match(downloads.getAttribute('aria-label'), /npm downloads/);
  assert.equal(f.npmRequests.length, 1);
  assert.equal(f.npmRequests[0].url, 'https://api.npmjs.org/downloads/point/last-day/gralobe');
  f.respondNpm(0, { package: 'gralobe', start: '2026-10-22', end: '2026-10-22', downloads: 57 });
  await settleRequests();
  assert.equal(f.npmRequests[1].url, 'https://api.npmjs.org/downloads/point/2025-11-29:2026-10-22/gralobe');
  f.controller.selectProject('cottbus');
  f.respondNpm(1, { package: 'gralobe', start: '2025-11-29', end: '2026-10-22', downloads: 9876 });
  await settleRequests();
  assert.equal(count.textContent, '9,876');
  assert.match(downloads.getAttribute('aria-label'), /9,876 npm downloads/);
  assert.equal(downloads.querySelector('.stat-pennant-brand'), brand, 'fetched downloads preserve the original npm wordmark');
  assert.match(downloads.title, /2025-11-29–2026-10-22/);
  assert.equal(f.one('live-projects-npm-downloads'), downloads);
  f.controller.selectProject('gralobe');
  assert.equal(f.npmRequests.length, 2, 'project selection keeps the fetched total and node');
  assert.equal(f.all('live-projects-npm-downloads').length, 1);
  assert.equal(f.one('live-projects-points').textContent.includes('npm downloads'), false);
  f.controller.dispose();
});

test('npm metadata failure keeps the native package link without presenting a fixed total', async () => {
  const f = fixture();
  f.npmRequests[0].reject(new Error('npm unavailable'));
  await settleRequests();
  const downloads = f.one('live-projects-npm-downloads');
  assert.equal(downloads.querySelector('[data-npm-count]').textContent, '—');
  assert.match(downloads.getAttribute('aria-label'), /npm downloads unavailable/);
  assert.equal(downloads.href, 'https://www.npmjs.com/package/gralobe');
  f.controller.selectProject('gralobe');
  assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[3].url);
  assert.equal(f.one('live-projects-npm-downloads'), downloads);
  f.controller.dispose();
});

test('BFCache suspends both counters and refetches current data without restarting the preview', async () => {
  const f = fixture('cottbus');
  const stars = assertVerifiedStars(f), downloads = f.one('live-projects-npm-downloads');
  const frame = f.one('live-projects-site-frame');
  const pageShow = f.listeners.get('pageshow');
  f.listeners.get('pagehide')();
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.npmRequests[0].options.signal.aborted, true);
  pageShow({ persisted: true });
  assert.equal(f.requests.length, 2);
  assert.equal(f.npmRequests.length, 2);
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 700 });
  f.respondNpm(0, { package: 'gralobe', start: '2026-10-18', end: '2026-10-18', downloads: 1 });
  await settleRequests();
  assertVerifiedStars(f);
  assert.equal(f.npmRequests.length, 2, 'a cancelled npm response cannot start a range request');
  f.respond(1, { full_name: 'batikanor/gralobe', stargazers_count: 121 });
  f.respondNpm(1, { package: 'gralobe', start: '2026-10-22', end: '2026-10-22', downloads: 57 });
  await settleRequests();
  f.respondNpm(2, { package: 'gralobe', start: '2025-11-29', end: '2026-10-22', downloads: 9880 });
  await settleRequests();
  assert.equal(stars.querySelector('.stat-pennant-number').textContent, '121');
  assert.match(stars.getAttribute('aria-label'), /121 GitHub stars/);
  assert.equal(downloads.querySelector('[data-npm-count]').textContent, '9,880');
  assert.equal(f.one('live-projects-site-frame'), frame);
  assert.equal(frame.contextRestarts || 0, 0);
  pageShow({ persisted: false });
  assert.equal(f.requests.length, 2, 'ordinary pageshow does not duplicate the initial requests');
  f.controller.dispose();
  pageShow({ persisted: true });
  assert.equal(f.requests.length, 2, 'disposed BFCache callbacks cannot recreate metadata requests');
  assert.equal(f.listeners.size, 0);
});

test('disposing the controller aborts pending GitHub metadata and prevents detached updates', async () => {
  const f = fixture('gralobe');
  const stars = assertVerifiedStars(f);
  f.controller.dispose();
  assert.equal(f.requests[0].options.signal.aborted, true);
  assert.equal(f.npmRequests[0].options.signal.aborted, true);
  f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 500 });
  await settleRequests();
  assert.equal(stars.querySelector('.stat-pennant-number').textContent, String(seed.stargazers_count));
  assert.equal(f.app.children.length, 0);
  f.controller.selectProject('gralobe');
  assert.equal(f.requests.length, 1, 'detached controls cannot start another request');
});

test('failed feed requests silently retain the verified count and native repository link', async t => {
  for (const [name, fail] of [
    ['network error', f => f.requests[0].reject(new Error('Network unavailable'))],
    ['rate limit', f => f.respond(0, { message: 'Rate limit exceeded' }, { ok: false, status: 429 })],
    ['invalid JSON', f => f.requests[0].resolve({ ok: true, status: 200, json: async () => { throw new SyntaxError('Invalid JSON'); } })],
  ]) {
    await t.test(name, async () => {
      const f = fixture('gralobe');
      fail(f);
      await settleRequests();
      assert.equal(assertVerifiedStars(f).href, 'https://github.com/batikanor/gralobe');
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
      assertVerifiedStars(f);
      f.controller.dispose();
    });
  }
  await t.test('zero is a valid fresh count', async () => {
    const f = fixture('gralobe');
    f.respond(0, { full_name: 'batikanor/gralobe', stargazers_count: 0 });
    await settleRequests();
    const stars = f.one('live-projects-github-stars');
    assert.equal(stars.querySelector('.stat-pennant-number').textContent, '0');
    assert.match(stars.getAttribute('aria-label'), /0 GitHub stars/);
    f.controller.dispose();
  });
});

test('loading and failed previews retain native navigation and stale frame events cannot affect a new project', () => {
  const f = fixture();
  const preview = f.one('live-projects-preview'), oldFrame = f.one('live-projects-site-frame');
  assert.equal(preview.dataset.state, 'loading');
  assert.match(f.one('live-projects-preview-status').textContent, /Loading/);
  assert.equal(f.all('live-projects-browser-domain')[0].href, LIVE_PROJECTS[0].url);
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
  assert.equal(f.all('live-projects-browser-domain')[1].href, LIVE_PROJECTS[1].url);
  assert.equal(f.one('live-projects-open').href, LIVE_PROJECTS[1].url);
  f.controller.selectProject('space-cottbus');
  assert.notEqual(f.one('live-projects-site-frame'), frame, 'reselecting an unavailable preview retries the site');
  assert.equal(preview.dataset.state, 'loading');
  assert.equal(f.one('live-projects-site-frame').src, LIVE_PROJECTS[1].previewUrl);
  f.controller.dispose();
});

test('preview resizing contains the actual site in both dimensions without reloading it', () => {
  const f = fixture(), preview = f.one('live-projects-preview'), observer = f.observers[0];
  assert.equal(preview.style['--preview-scale'], '0.5');
  preview.clientWidth = 320;
  observer.callback();
  assert.equal(preview.style['--preview-scale'], '0.25');
  preview.clientWidth = 800;
  preview.clientHeight = 200;
  observer.callback();
  assert.equal(preview.style['--preview-scale'], '0.25', 'a short card contains the original site instead of clipping its height');
  preview.clientWidth = 640;
  preview.clientHeight = 0;
  observer.callback();
  assert.equal(preview.style['--preview-scale'], '0.5', 'an unmeasurable initial height can use the native preview ratio');
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
  f.all('live-projects-preview-select')[2].dispatch('click');
  tabs[0].dispatch('keydown', { key: 'End' });
  f.one('live-projects-next').dispatch('click');
  f.one('live-projects-previous').dispatch('click');
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

test('reselecting the current card, Home and duplicate Back events never detach its live browser context', () => {
  const f = fixture();
  const frame = f.one('live-projects-site-frame');
  const preview = f.one('live-projects-preview');
  const points = f.one('live-projects-points').children;
  frame.onload();
  for (let i = 0; i < 8; i++) {
    f.all('live-projects-tab')[0].dispatch('click');
    f.all('live-projects-preview-select')[0].dispatch('click');
    f.all('live-projects-tab')[0].dispatch('keydown', { key: 'Home' });
    f.listeners.get('popstate')();
    f.observers[0].callback();
  }
  assert.equal(frame.contextRestarts || 0, 0, 'a connected iframe subtree must never be re-appended on repeated selection');
  assert.equal(f.one('live-projects-site-frame'), frame);
  assert.equal(f.one('live-projects-preview'), preview);
  assert.equal(f.one('live-projects-points').children, points, 'idle/repeated selection must not rebuild the text');
  assert.equal(f.createdFrames.length, 1);
  assert.equal(preview.dataset.state, 'response');
  f.controller.dispose();
});

test('changing cards unloads the old website before relocating the preview container', () => {
  const f = fixture();
  for (const project of ['space-cottbus', 'cottbus', 'gralobe', 'maptheory']) {
    const oldFrame = f.one('live-projects-site-frame');
    f.controller.selectProject(project);
    assert.equal(oldFrame.contextRestarts || 0, 0, 'moving the old iframe would trigger an unwanted reload before unload');
    assert.equal(oldFrame.src, 'about:blank');
    assert.equal(oldFrame.parent, null);
    assert.equal(f.all('live-projects-site-frame').length, 1);
    assert.equal(f.one('live-projects-preview').parent, f.all('live-projects-window-body')[liveProjectIndex(project)]);
  }
  f.controller.dispose();
});
