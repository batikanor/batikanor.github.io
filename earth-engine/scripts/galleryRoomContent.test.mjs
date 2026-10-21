import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene, PerspectiveCamera, Vector3} from 'three';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {renderProjectContent, projectHref} from '../src/projectContent.js';
import {galleryStationComponents} from '../src/galleryRoomLayout.js';
import {roomCameraFov, roomSafeArea, surfaceCameraPlan, overviewCameraPlan} from '../src/galleryRoomCamera.js';
import {createGalleryRoomScene} from '../src/galleryRoomScene.js';

class TextNode {
  constructor(text) { this.textContent = text; this.parentElement = null; }
}
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
    this.dataset = {}; this.style = {setProperty(key, value) { this[key] = String(value); }, getPropertyValue(key) { return this[key] || ''; }, removeProperty(key) { const value = this[key] || ''; delete this[key]; return value; }}; this.listeners = new Map(); this.parentElement = null;
    this.ownerDocument = globalThis.document;
    this.classList = {
      add: (...names) => { this.className = [...new Set([...(this.className || '').split(' ').filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = (this.className || '').split(' ').filter(name => !names.includes(name)).join(' '); },
      toggle: (name, force) => {
        const on = force ?? !(this.className || '').split(' ').includes(name);
        this.classList[on ? 'add' : 'remove'](name); return on;
      }
    };
  }
  append(...items) { for (const item of items) { const child = typeof item === 'string' ? new TextNode(item) : item; child.remove?.(); if (child.parentElement) child.parentElement.children = child.parentElement.children.filter(item => item !== child); this.children.push(child); child.parentElement = this; } }
  replaceChildren(...items) { this.children.forEach(item => { item.parentElement = null; }); this.children = []; this.append(...items); }
  get textContent() { return this.children.map(child => child.textContent).join(''); }
  set textContent(text) { this.replaceChildren(new TextNode(String(text))); }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  hasAttribute(key) { return this.attributes.has(key); }
  set src(value) { this.srcWrites=(this.srcWrites||0)+1;this.setAttribute('src', value); }
  get src() { return this.getAttribute('src') || ''; }
  addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
  dispatch(name, event = {}) { for (const fn of this.listeners.get(name) || []) fn({target: this, ...event}); }
  matches(selector) {
    if (selector.startsWith('.')) return (this.className || '').split(' ').includes(selector.slice(1));
    if (selector === 'iframe[data-deferred-src]') return this.tagName === 'IFRAME' && !!this.dataset.deferredSrc;
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) { return descendants(this).filter(child => child.matches?.(selector)); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let element = this; element; element = element.parentElement) if (selector.split(',').some(part => element.matches?.(part))) return element; return null; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  pause() { this.paused = true; this.pauseCalls = (this.pauseCalls || 0) + 1; }
  load() { this.loaded = true; this.loadCalls = (this.loadCalls || 0) + 1; }
  getContext() { return null; }
}
function descendants(host) { return host.children.flatMap(child => child instanceof Element ? [child, ...descendants(child)] : []); }
const observers = [];
globalThis.document = {createElement: tag => new Element(tag), createTextNode: text => new TextNode(text), createDocumentFragment: () => new Element('fragment'), defaultView: {Element}};
globalThis.window = {location: {href: 'https://staging.batikanor.com/?view=gallery'}, innerWidth: 1440, matchMedia: () => ({matches: false})};
globalThis.fetch = async () => ({ok: false});
globalThis.IntersectionObserver = class {
  constructor(fn, options) { this.fn = fn; this.options = options; this.items = new Set(); observers.push(this); }
  observe(item) { this.items.add(item); }
  unobserve(item) { this.items.delete(item); }
  disconnect() { this.items.clear(); this.disconnected = true; }
  reveal() { this.fn([...this.items].map(target => ({target, isIntersecting: true}))); }
};
// Node tests import the same implementation with its CSS side effect removed.
const file = new URL('../src/galleryRoomContent.js', import.meta.url);
let source = await readFile(file, 'utf8');
source = source.replace("import './galleryRoomContent.css';", '');
source = source.replaceAll("'./projectContent.js'", JSON.stringify(new URL('../src/projectContent.js', import.meta.url).href));
source = source.replace("'three/addons/renderers/CSS3DRenderer.js'", JSON.stringify(import.meta.resolve('three/addons/renderers/CSS3DRenderer.js')));
source = source.replaceAll("'./galleryRoomLayout.js'", JSON.stringify(new URL('../src/galleryRoomLayout.js', import.meta.url).href));
source = source.replaceAll("'./galleryRoomCamera.js'", JSON.stringify(new URL('../src/galleryRoomCamera.js', import.meta.url).href));
const {createGalleryRoomContent, galleryMediaPreview, galleryStationMedia, galleryStationLinks, galleryStoryCanvasWidth} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const stations = contestsAndActivities.map((project, index) => ({slug: project.slug, index, x: index * 18}));
const authoredBlocks = host => descendants(host).filter(element => /(?:project-copy-(?:paragraph|heading|bullet)|gallery-room-story-(?:paragraph|heading|bullet))/.test(element.className || '')).map(element => element.textContent);

test('all 32 stories and 66 media sources preserve authored content while 107 resources share 26 References panels', () => {
  const sourceDescriptions = new Map(contestsAndActivities.map(project => [project.slug, project.longDescription]));
  const obsoletePlacement = {
    'huawei-agorize-2024': ['In case you are interested in our method, feel free to check out the slides attached below.', ''],
    'sui-hackathon-poland-2025': [' Here I am with it.', ''],
    'hackupc-2024': ['the video I embedded below', 'the video'],
    'circular-bsh-2024': [' See the slide deck for more details.', ''],
  };
  const gallery = createGalleryRoomContent({scene: new Scene(), stations, activeSlug: null});
  assert.equal(gallery.stationSurfaces.size, 32);
  let componentCount = 0, referenceCount = 0, resourceCount = 0, mediaCount = 0;
  for (const project of contestsAndActivities) {
    const original = new Element('div');
    renderProjectContent(original, project.slug, {baseHref: window.location.href});
    const descriptors = Object.values(gallery.stationSurfaces.get(project.slug));
    componentCount += descriptors.length;
    const board = gallery.stationSurfaces.get(project.slug).story.element;
    const placement = obsoletePlacement[project.slug];
    const expectedBlocks = authoredBlocks(original).map(block => placement ? block.replace(...placement) : block).filter(block => block.trim());
    assert.deepEqual(authoredBlocks(board), expectedBlocks, `${project.slug}: only the four retired placement cues may change`);
    assert.equal(project.longDescription, sourceDescriptions.get(project.slug), 'the original source and legacy copy stay intact');
    if (placement) assert.equal(board.textContent.includes(placement[0]), false);
    assert.equal(descendants(board).some(element => element.textContent === 'The full story'), false, `${project.slug}: no redundant story heading`);
    assert.ok(board.textContent.includes(project.shortDescription), `${project.slug} summary`);
    assert.equal(board.querySelector('.gallery-room-technologies'), null, 'technology tags no longer occupy the story footer');
    assert.equal(board.querySelector('.gallery-room-story-resources'), null, 'the redundant References shortcut is removed');
    assert.equal(board.querySelector('.gallery-room-story-media'), null, 'no media placement or empty figure remains in the story');
    assert.equal(descendants(board).some(element => element.tagName === 'BUTTON' && element.textContent.startsWith('View ')), false,
      `${project.slug} has no generated inline media prompt`);
    const title = gallery.stationSurfaces.get(project.slug).title.element;
    assert.equal(title.querySelector('h1').textContent, project.title);
    assert.equal(title.querySelector('.gallery-room-title-number'), null, 'the title contains no progress counter');
    assert.equal(title.querySelector('.gallery-room-title-meta'), null, 'date and location are outside the title');
    assert.deepEqual(title.querySelector('.gallery-room-technologies')?.children.map(tag => tag.textContent) ?? [], project.technologies || [],
      `${project.slug} retains every original technology beside its title`);
    assert.equal(descendants(board).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName)).length, 0, `${project.slug}: no duplicate story players`);
    const mediaSurfaces = descriptors.filter(item => item.type === 'media');
    const referenceSurfaces = descriptors.filter(item => item.type === 'references');
    assert.equal(descriptors.some(item => item.type === 'link'), false, 'individual resource plaques are removed');
    const allMedia = galleryStationMedia(project);
    const links = galleryStationLinks(project);
    assert.equal(mediaSurfaces.length, allMedia.length, project.slug);
    assert.equal(referenceSurfaces.length, links.length ? 1 : 0, project.slug);
    mediaCount += mediaSurfaces.length;referenceCount += referenceSurfaces.length;resourceCount += links.length;
    const referencePanel = referenceSurfaces[0];
    const resourceAnchors = referencePanel ? descendants(referencePanel.element).filter(element => element.tagName === 'A') : [];
    assert.equal(resourceAnchors.length, links.length, project.slug);
    if (referencePanel) {
      assert.equal(referencePanel.element.querySelector('h2').textContent, 'References');
      assert.equal(referencePanel.element.querySelector('.gallery-room-references-count').textContent, String(links.length));
    }
    assert.equal(new Set(descriptors.map(item => item.kind)).size, descriptors.length);
    for (const media of allMedia) {
      const surface = mediaSurfaces.find(item => item.media.key === media.key);
      assert.equal(surface.element.querySelector('.gallery-room-screen-label'), null, `${project.slug}/${media.key}: no generic numbered screen label`);
      const urls = descendants(surface.element).filter(element => element.tagName === 'A').map(element => element.href);
      assert.ok(urls.includes(projectHref(media.url, window.location.href)), `${project.slug} original media ${media.key}`);
      if (media.abovePhotoCaption) assert.ok(surface.element.textContent.includes(media.abovePhotoCaption));
      if (media.credit) assert.ok(surface.element.textContent.includes(media.credit));
      assert.equal(descendants(surface.element).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName)).length, surface.photo ? 1 : galleryMediaPreview(media.url)?.kind === 'link' ? 0 : 1);
    }
    for (const [index, link] of links.entries()) {
      const anchor = resourceAnchors[index];
      assert.ok(anchor.textContent.includes(link.label), `${project.slug} ${link.label}`);
      assert.equal(anchor.href, projectHref(link.url, window.location.href));
      assert.equal(anchor.title, anchor.href, 'the complete destination remains available on hover');
      assert.ok(anchor.getAttribute('aria-label').includes(link.label));
      assert.equal(anchor.querySelector('.gallery-room-reference-arrow').getAttribute('aria-hidden'), 'true');
      assert.ok(anchor.className.includes('gallery-room-reference-link'));
      assert.equal(anchor.querySelector('button'), null, 'references remain direct native links');
    }
    const originalInlineLinks = descendants(original).filter(element => element.tagName === 'A').map(element => element.href);
    const currentLinks = descriptors.flatMap(item => descendants(item.element)).filter(element => element.tagName === 'A').map(element => element.href);
    for (const href of originalInlineLinks) assert.ok(currentLinks.includes(href), `${project.slug} preserved link ${href}`);
  }
  assert.equal(gallery.surfaces.length, componentCount);
  assert.equal(componentCount, 156);assert.equal(mediaCount, 66);
  assert.equal(referenceCount, 26);assert.equal(resourceCount, 107);
  gallery.dispose();
});

test('the selected wall connects every preview, approaches keep its static photos and chosen player, and inactive projects stop', () => {
  const scene = new Scene();
  const gallery = createGalleryRoomContent({scene, stations});
  const first = gallery.stationSurfaces.get(stations[0].slug);
  const connected = () => gallery.surfaces.flatMap(object => descendants(object.element)).filter(element => element.hasAttribute?.('src'));
  const viewers = descriptors => descriptors.flatMap(surface => descendants(surface.element)).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName));
  assert.deepEqual(connected(), viewers(Object.values(first)));
  const mixed = [...gallery.stationSurfaces].find(([,surfaces]) => {
    const players = viewers(Object.values(surfaces));
    return players.some(player => player.tagName === 'IMG') && players.filter(player => player.tagName === 'IFRAME').length >= 2;
  });
  assert.ok(mixed, 'fixture includes static photographs and multiple interactive viewers');
  const [slug, surfaces] = mixed;
  gallery.setActiveSlug(slug);
  const players = viewers(Object.values(surfaces));
  assert.equal(first.story.object.visible, false);assert.equal(first.story.element.inert, true);
  assert.deepEqual(connected(), players, 'all selected-wall native previews are initially connected');
  const chosen = Object.values(surfaces).find(surface => surface.element.querySelector('iframe'));
  const chosenPlayer = chosen.element.querySelector('iframe');
  const images = players.filter(player => player.tagName === 'IMG');
  gallery.setFocusedSurface(chosen.kind);
  assert.deepEqual(new Set(connected()), new Set([...images, chosenPlayer]), 'an approach retains every static photo and its chosen native player');
  assert.equal(chosen.approach.hidden, true);
  for (const player of players.filter(player => player.tagName === 'IFRAME' && player !== chosenPlayer)) assert.equal(player.hasAttribute('src'), false);
  gallery.setFocusedSurface('story');
  assert.deepEqual(new Set(connected()), new Set(images), 'reading the story stops other interactive players');
  gallery.setFocusedSurface(null);
  assert.deepEqual(connected(), players, 'returning to the wall restores its previews');
  assert.equal(chosen.approach.hidden, false);
  gallery.dispose();
  assert.equal(scene.children.length, 0);assert.equal(connected().length, 0);
  gallery.setFocusedSurface('media');assert.equal(connected().length, 0);
});

test('three adjacent walls retain readable content and photographs while crossing projects transfers only interactive playback', () => {
  const projects = contestsAndActivities.slice(10, 14), viewport = {width: 1280, height: 900};
  const room = createGalleryRoomScene({scene: new Scene(), projects, viewport});
  const scene = new Scene(), focused = [], gallery = createGalleryRoomContent({scene, stations: room.stations,
    activeSlug: projects[1].slug, onFocusSurface: descriptor => focused.push(descriptor)});
  gallery.resize(viewport);
  const panels = slug => Object.values(gallery.stationSurfaces.get(slug));
  const players = slug => panels(slug).flatMap(panel => descendants(panel.element)).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName));
  const connected = () => gallery.surfaces.flatMap(object => descendants(object.element)).filter(element => element.hasAttribute?.('src'));
  const host = new Element('div');
  const attachVisible = () => { for (const object of gallery.surfaces) if (object.visible && !object.element.parentElement) host.append(object.element); };
  const input = new Set(projects.slice(0, 3).map(project => project.slug));
  gallery.setVisibleSlugs(input); input.clear(); attachVisible();
  assert.deepEqual(gallery.visibleSlugs, new Set(projects.slice(0, 3).map(project => project.slug)), 'the copied explicit neighbor window survives caller mutation');
  for (const project of projects.slice(0, 3)) for (const panel of panels(project.slug)) {
    assert.equal(panel.object.visible, true); assert.equal(panel.element.inert, false);
    assert.equal(panel.element.hasAttribute('aria-hidden'), false); assert.equal(panel.element.parentElement, host);
    if (panel.type === 'story') assert.ok(panel.element.textContent.includes(project.shortDescription));
  }
  const staticPhotos = projects.slice(0, 3).flatMap(project => players(project.slug)).filter(player => player.tagName === 'IMG');
  const activePlayers = players(projects[1].slug);
  assert.deepEqual(new Set(connected()), new Set([...staticPhotos, ...activePlayers]), 'only the active project contributes interactive native viewers');
  const sourceState = new Map(staticPhotos.map(player => [player, {src: player.src, writes: player.srcWrites}]));
  gallery.setVisibleSlugs([...projects.slice(0, 3).map(project => project.slug), projects[0].slug, 'unknown-project']);
  for (const player of staticPhotos) assert.deepEqual({src: player.src, writes: player.srcWrites}, sourceState.get(player), 'unchanged neighbors never reload photographs');

  const neighborStory = gallery.stationSurfaces.get(projects[0].slug).story;
  neighborStory.element.dispatch('click');
  assert.equal(focused.at(-1), neighborStory, 'visible neighbor board clicks retain their own project descriptor');
  const neighborPhoto = panels(projects[0].slug).find(panel => panel.photo);
  neighborPhoto.zoomIn.dispatch('click');
  assert.equal(focused.at(-1), neighborPhoto, 'the native approach control reaches the controller for a neighboring project');

  const old = gallery.stationSurfaces.get(projects[1].slug), chosen = Object.values(old).find(panel => panel.element.querySelector('iframe'));
  gallery.setFocusedSurface(chosen.kind);
  assert.equal(chosen.approach.hidden, true);
  gallery.setActiveSlug(projects[2].slug);
  assert.deepEqual(gallery.visibleSlugs, new Set(projects.slice(0, 3).map(project => project.slug)), 'walking across a boundary preserves the explicit visibility window');
  for (const panel of Object.values(old)) {
    assert.equal(panel.element.className.split(' ').includes('is-focused'), false);
    assert.equal(panel.width, room.stations.get(projects[1].slug).surfaces[panel.kind].width, 'previously approached content returns to arrival density');
    if (panel.approach) assert.equal(panel.approach.hidden, false);
  }
  assert.ok(players(projects[1].slug).filter(player => player.tagName !== 'IMG').every(player => !player.hasAttribute('src')), 'former active players stop even while their wall stays visible');
  assert.deepEqual(new Set(connected()), new Set([...staticPhotos, ...players(projects[2].slug)]));
  for (const player of staticPhotos) assert.deepEqual({src: player.src, writes: player.srcWrites}, sourceState.get(player), 'crossing a project boundary retains static source identity');

  gallery.setVisibleSlugs(projects.slice(1).map(project => project.slug)); attachVisible();
  for (const panel of panels(projects[0].slug)) {
    assert.equal(panel.object.visible, false); assert.equal(panel.element.inert, true);
    assert.equal(panel.element.getAttribute('aria-hidden'), 'true'); assert.equal(panel.element.parentElement, null, 'outgoing CSS3D panels detach from the rendered DOM');
  }
  assert.ok(players(projects[0].slug).every(player => !player.hasAttribute('src')));
  assert.ok(players(projects[3].slug).filter(player => player.tagName === 'IMG').every(player => player.hasAttribute('src')));
  assert.ok(players(projects[3].slug).filter(player => player.tagName !== 'IMG').every(player => !player.hasAttribute('src')));
  gallery.setVisibleSlugs([]);
  assert.deepEqual(gallery.visibleSlugs, new Set([projects[2].slug]), 'the active wall remains visible when the explicit neighbor list is empty');
  gallery.setVisibleSlugs(projects.map(project => project.slug)); attachVisible();
  gallery.setVisibleSlugs(null);
  assert.deepEqual(gallery.visibleSlugs, new Set([projects[2].slug]), 'null restores the legacy single-wall mode');
  gallery.setVisibleSlugs(projects.slice(1).map(project => project.slug)); attachVisible();
  gallery.dispose(); gallery.dispose();
  assert.equal(scene.children.length, 0); assert.equal(host.children.length, 0); assert.equal(connected().length, 0);
  assert.equal(gallery.stationSurfaces.size, 0); assert.deepEqual(gallery.visibleSlugs, new Set());
  gallery.setVisibleSlugs(projects.map(project => project.slug)); gallery.setActiveSlug(projects[0].slug); gallery.setFocusedSurface('media');
  assert.equal(scene.children.length, 0); assert.equal(connected().length, 0);
  room.dispose();
});

test('native videos on visible neighboring walls unload once and reconnect only when their project becomes active', () => {
  const selected = contestsAndActivities.slice(10, 13);
  const stations = selected.map((project, index) => ({slug: project.slug, x: index * 18,
    components: galleryStationComponents(project).map(pose => pose.kind === 'media' && !pose.photo
      ? {...pose, media: {...pose.media, url: `https://example.com/project-${index}.mp4`}} : pose)}));
  const gallery = createGalleryRoomContent({scene: new Scene(), stations, activeSlug: selected[1].slug});
  const video = slug => Object.values(gallery.stationSurfaces.get(slug)).find(panel => panel.element.querySelector('video')).element.querySelector('video');
  const [left, center, right] = selected.map(project => video(project.slug));
  gallery.setVisibleSlugs(selected.map(project => project.slug));
  assert.equal(center.hasAttribute('src'), true); assert.equal(left.hasAttribute('src'), false); assert.equal(right.hasAttribute('src'), false);
  gallery.setActiveSlug(selected[2].slug);
  assert.equal(center.hasAttribute('src'), false); assert.equal(center.pauseCalls, 1); assert.equal(center.loadCalls, 1);
  assert.equal(right.hasAttribute('src'), true);
  const writes = right.srcWrites;
  gallery.setVisibleSlugs(selected.map(project => project.slug)); gallery.setVisibleSlugs([selected[2].slug]);
  assert.equal(center.pauseCalls, 1); assert.equal(center.loadCalls, 1, 'unchanged disconnected neighbors are not repeatedly unloaded');
  assert.equal(right.srcWrites, writes, 'visibility reconciliation does not reload the active native video');
  gallery.setVisibleSlugs(selected.map(project => project.slug)); gallery.setActiveSlug(selected[1].slug);
  assert.equal(center.hasAttribute('src'), true); assert.equal(right.hasAttribute('src'), false);
  assert.equal(right.pauseCalls, 1); assert.equal(right.loadCalls, 1); assert.equal(center.srcWrites, 2);
  gallery.dispose();
  assert.equal(center.pauseCalls, 2); assert.equal(center.loadCalls, 2);
  assert.equal(left.pauseCalls, undefined, 'a never-active neighboring video never loads or needs unloading');
});

test('continuous scene and native content share the same bounded neighbor window across every project and responsive reflow', () => {
  const room = createGalleryRoomScene({scene: new Scene(), projects: contestsAndActivities, viewport: {width: 1280, height: 900}});
  const gallery = createGalleryRoomContent({scene: new Scene(), stations: room.stations});
  const allPanels = [...gallery.stationSurfaces.values()].flatMap(surfaces => Object.values(surfaces));
  const allPlayers = allPanels.flatMap(panel => descendants(panel.element)).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName));
  for (const viewport of [{width: 1280, height: 900}, {width: 390, height: 844}]) {
    const before = new Map(allPlayers.filter(player => player.hasAttribute('src')).map(player => [player, {src: player.src, writes: player.srcWrites}]));
    room.resize(viewport); gallery.resize(viewport);
    for (const [player, expected] of before) assert.deepEqual({src: player.src, writes: player.srcWrites}, expected, 'responsive corridor reflow retains every connected native source');
    for (const [index, project] of contestsAndActivities.entries()) {
      room.setActive(project.slug); gallery.setActiveSlug(project.slug); gallery.setVisibleSlugs(room.visibleSlugs);
      const expected = new Set(contestsAndActivities.slice(Math.max(0, index - 1), index + 2).map(item => item.slug));
      assert.deepEqual(gallery.visibleSlugs, expected); assert.deepEqual(new Set(room.visibleSlugs), expected);
      assert.equal(room.getStats().visibleStations, expected.size); assert.ok(expected.size <= 3);
      for (const panel of allPanels) {
        const visible = expected.has(panel.slug);
        assert.equal(panel.object.visible, visible, `${project.slug}: the physical and HTML neighbor windows match`);
        assert.equal(panel.element.inert, !visible);
        assert.equal(panel.element.getAttribute('aria-hidden'), visible ? null : 'true');
        for (const player of descendants(panel.element).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName))) {
          assert.equal(player.hasAttribute('src'), visible && (player.tagName === 'IMG' || panel.slug === project.slug),
            `${project.slug}/${panel.slug}: neighboring photos load while only the active project owns native playback`);
        }
      }
    }
  }
  gallery.dispose(); room.dispose();
  assert.ok(allPlayers.every(player => !player.hasAttribute('src')));
});

test('wider reading canvases preserve authored copy, live surfaces and exact physical bounds at every density', () => {
  const multiSource = contestsAndActivities.find(project => galleryStationMedia(project).length >= 4 && galleryStationLinks(project).length);
  const station = stations.find(item => item.slug === multiSource.slug);
  const gallery = createGalleryRoomContent({scene: new Scene(), stations: new Map([[station.slug, station]])});
  const descriptors = Object.values(gallery.stationSurfaces.get(station.slug));
  const story = descriptors.find(item => item.type === 'story');
  assert.equal(story.width, 960);
  const copy = authoredBlocks(story.element);
  const links = descendants(story.element).filter(element => element.tagName === 'A').map(element => element.href);
  const objects = [...gallery.surfaces];
  const original = descriptors.map(surface => [surface.worldWidth, surface.worldHeight, [...surface.position], [...surface.rotation]]);
  gallery.resize({width: 390});
  assert.equal(descriptors.find(item => item.type === 'story').width, 360);
  for (const surface of descriptors.filter(item => item.type === 'media')) assert.equal(surface.width, surface.photo ? surface.worldWidth * 80 : 400);
  assert.equal(descriptors.find(item => item.type === 'references').width, 360);
  descriptors.forEach((surface, index) => {
    assert.deepEqual([surface.worldWidth, surface.worldHeight, surface.position, surface.rotation], original[index]);
    assert.ok(Math.abs(surface.object.scale.x * surface.width - surface.worldWidth) < 1e-10);
    assert.ok(Math.abs(surface.object.scale.y * surface.height - surface.worldHeight) < 1e-10);
    assert.equal(surface.element.style.width, `${surface.width}px`);
    assert.equal(surface.element.dataset.gallerySurface, surface.kind);
  });
  gallery.resize({width: 800});
  assert.equal(story.width, 680);
  assert.deepEqual(authoredBlocks(story.element), copy);
  assert.deepEqual(descendants(story.element).filter(element => element.tagName === 'A').map(element => element.href), links);
  gallery.resize({width: 1280, height: 720});
  assert.equal(story.width, galleryStoryCanvasWidth(story, {width: 1280, height: 720}), 'a short desktop reflows at the projected reading width');
  assert.deepEqual(authoredBlocks(story.element), copy);
  gallery.resize({width: 1440});
  assert.equal(story.width, 960);
  assert.deepEqual(authoredBlocks(story.element), copy);
  assert.deepEqual(descendants(story.element).filter(element => element.tagName === 'A').map(element => element.href), links);
  assert.ok(gallery.surfaces.every((object, index) => object === objects[index]), 'resize retains native content objects');
  descriptors.forEach((surface, index) => assert.deepEqual([surface.worldWidth, surface.worldHeight, surface.position, surface.rotation], original[index]));
  gallery.dispose();
});

test('approached stories preserve overview type size at the real projected desktop and tablet width', async () => {
  const css = (await readFile(new URL('../src/galleryRoomContent.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const selector of ['.gallery-room-story', '.gallery-room-story.is-tablet',
    '.gallery-room-story.is-wall-panel', '.gallery-room-story.is-reading-story']) {
    const rule = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .find(match => match[1].trim() === selector)?.[2];
    assert.equal(Number.parseFloat(/--room-copy:\s*([\d.]+)px/.exec(rule)?.[1]), 16,
      `${selector}: shipped story styles retain the 16px overview text used by projection metrics`);
  }
  const surface = galleryStationComponents(contestsAndActivities[0]).find(pose => pose.kind === 'story');
  for (const viewport of [
    {width: 1280, height: 720}, {width: 1280, height: 900}, {width: 1440, height: 900},
    {width: 1024, height: 768}, {width: 700, height: 1080}, {width: 800, height: 600},
    {width: 900, height: 500}, {width: 1024, height: 768, dockBounds: {right: 430}},
    {width: 390, height: 844}, {width: 390, height: 480}, {width: 568, height: 320},
    {width: 360, height: 780}, {width: 412, height: 915}, {width: 500, height: 1080},
    {width: 650, height: 844}, {width: 699, height: 900},
    {width: 1920, height: 1080}, {width: 2148, height: 1298}, {width: 2560, height: 1440}
  ]) {
    const plan = surfaceCameraPlan(surface, viewport, roomCameraFov(viewport.width));
    const camera = new PerspectiveCamera(roomCameraFov(viewport.width), viewport.width / viewport.height, .08, 170);
    camera.position.fromArray(plan.position);
    camera.lookAt(...plan.target);
    camera.setViewOffset(viewport.width, viewport.height, plan.viewOffset.x, plan.viewOffset.y, viewport.width, viewport.height);
    camera.updateMatrixWorld(true);
    const left = new Vector3(surface.position[0] - surface.worldWidth / 2, surface.position[1], surface.position[2]).project(camera);
    const right = new Vector3(surface.position[0] + surface.worldWidth / 2, surface.position[1], surface.position[2]).project(camera);
    const displayedWidth = (right.x - left.x) * viewport.width / 2;
    const canvasWidth = galleryStoryCanvasWidth(surface, viewport);
    const bodySize = viewport.width < 700 ? 11.5 : 16;
    const minimum = viewport.width < 700 ? 11 : 15.8;
    const displayedBodySize = bodySize * displayedWidth / canvasWidth;
    assert.ok(displayedBodySize >= minimum - 1e-9,
      `${viewport.width}×${viewport.height}: actual approached text stays at least ${minimum}px`);
    if (viewport.width >= 700) {
      assert.equal(canvasWidth, Math.ceil(displayedWidth), 'the fallback canvas uses the projected width instead of enlarging its contents');
      assert.ok(displayedBodySize <= 16 + 1e-9,
        `${viewport.width}×${viewport.height}: approach never inflates the 16px overview text`);
    }
    if (viewport.width < 700) assert.ok(displayedBodySize <= 11.5 + 1e-9,
      `${viewport.width}×${viewport.height}: mobile reading keeps a restrained type scale`);
    if (viewport.width < 700) assert.ok(canvasWidth <= 680);
  }
  assert.ok(galleryStoryCanvasWidth(surface, {width: 1280, height: 900}) > 600, 'a normal desktop shows more authored text than the former 600px canvas');
  assert.ok(galleryStoryCanvasWidth(surface, {width: 700, height: 1080}) < 500, 'a narrow tablet cannot shrink an oversized text canvas');
  assert.ok(galleryStoryCanvasWidth(surface, {width: 390, height: 844}) <= 360, 'height-known phones adapt density to keep approached writing readable');
  assert.equal(galleryStoryCanvasWidth(surface, {width: 390}), 360, 'height-missing phones keep the established density fallback');
  assert.equal(galleryStoryCanvasWidth(surface, 1280), 960, 'numeric resize preserves the established fallback');
  assert.equal(galleryStoryCanvasWidth(surface, {width: 800}), 680, 'missing-height resize preserves the established fallback');
});

test('Hong Kong description uses a taller native reading surface without replacing its authored nodes', () => {
  const slug = 'hong-kong-talent-engage-eurotech-healthtech-2026';
  const cssScene = new Scene(), readingContainer = new Element('div'), wallContainer = new Element('div');
  const room = createGalleryRoomScene({scene: new Scene(), projects: contestsAndActivities});
  const gallery = createGalleryRoomContent({scene: cssScene, stations: room.stations, activeSlug: slug, readingContainer});
  const story = gallery.stationSurfaces.get(slug).story;
  const element = story.element, object = story.object;
  const scroll = element.querySelector('.gallery-room-story-scroll');
  const authoredNodes = [...scroll.children], copy = authoredBlocks(element);
  const links = descendants(element).filter(child => child.tagName === 'A');
  const destinations = links.map(link => link.href);
  try {
    for (const [width, height] of [[1280, 900], [1440, 900], [1920, 1080]]) {
      gallery.setFocusedSurface(null);
      const viewport = {width, height};room.resize(viewport);gallery.resize(viewport);
      const arrival = {width: story.width, height: story.height};
      // The renderer's transform is removed while reading and restored before
      // CSS3D takes ownership again; the native scroll node stays unchanged.
      wallContainer.append(element);element.style.transform = 'matrix3d(wall)';
      scroll.scrollTop = 81;
      gallery.setFocusedSurface('story');
      const safe = roomSafeArea(width, height, true);
      const expected = {left: safe.left + 8, top: safe.top + 8,
        width: width - safe.left - safe.right - 16, height: height - safe.top - safe.bottom - 16};
      assert.deepEqual(story.readingRect, expected, `${width}×${height}: use the available reading height`);
      assert.equal(element.parentElement, readingContainer);
      assert.equal(readingContainer.children.filter(child => child === element).length, 1);
      assert.equal(wallContainer.children.includes(element), false);
      assert.equal(object.parent, null, 'CSS3D cannot apply a second camera transform to native reading text');
      assert.equal(element.style.transform, 'none');
      assert.equal(element.style.position, 'absolute');
      assert.equal(element.style.zIndex, '10');
      assert.equal(element.style.width, `${expected.width}px`);
      assert.equal(element.style.height, `${expected.height}px`);
      assert.ok(element.className.split(' ').includes('is-reading-story'));
      assert.ok(expected.height > arrival.height, `${width}×${height}: focus increases description height`);
      assert.ok(expected.height - 60 > 600, 'the description has room for many native-size lines, beyond fixed controls');
      assert.equal(element.querySelector('.gallery-room-story-scroll'), scroll);
      assert.deepEqual(scroll.children, authoredNodes);
      assert.deepEqual(authoredBlocks(element), copy);
      assert.deepEqual(descendants(element).filter(child => child.tagName === 'A'), links);
      assert.deepEqual(links.map(link => link.href), destinations);
      assert.equal(scroll.scrollTop, 81);
      assert.equal(gallery.stationSurfaces.get(slug).story, story);
      assert.equal(story.object, object);
      gallery.setFocusedSurface(null);
      assert.equal(story.readingRect, undefined);
      assert.equal(object.parent, cssScene);
      assert.equal(readingContainer.children.includes(element), false);
      assert.equal(element.className.split(' ').includes('is-reading-story'), false);
      assert.equal(element.style.transform, 'matrix3d(wall)');
      assert.equal(element.style.width, `${arrival.width}px`);
      assert.equal(element.style.height, `${arrival.height}px`);
      assert.equal(scroll.scrollTop, 81, 'return preserves the same scroll state');
    }
  } finally {gallery.dispose();room.dispose();}
});

test('native description ownership survives focus changes, project changes, responsive reflow and disposal', () => {
  const slug = 'hong-kong-talent-engage-eurotech-healthtech-2026';
  const scene = new Scene(), readingContainer = new Element('div');
  const viewport = {width: 1440, height: 900};
  const room = createGalleryRoomScene({scene: new Scene(), projects: contestsAndActivities, viewport});
  const gallery = createGalleryRoomContent({scene, stations: room.stations, activeSlug: slug, readingContainer});
  const descriptors = gallery.stationSurfaces.get(slug), story = descriptors.story;
  const scroll = story.element.querySelector('.gallery-room-story-scroll');
  const copy = authoredBlocks(story.element), storyChildren = [...story.element.children];
  const players = Object.values(descriptors).flatMap(panel => descendants(panel.element))
    .filter(child => ['IMG', 'IFRAME', 'VIDEO'].includes(child.tagName));
  try {
    gallery.resize(viewport);scroll.scrollTop = 137;
    for (const destination of ['references', 'media', null]) {
      gallery.setFocusedSurface('story');
      assert.equal(story.element.parentElement, readingContainer);
      assert.equal(story.object.parent, null);
      gallery.setFocusedSurface(destination);
      assert.equal(story.readingRect, undefined);
      assert.equal(story.object.parent, scene);
      assert.equal(readingContainer.children.includes(story.element), false);
      assert.equal(scroll.scrollTop, 137);
    }
    gallery.setFocusedSurface('story');
    const originalRect = {...story.readingRect};
    const resized = {width: 1024, height: 768, dockBounds: {left: 28, right: 400, top: 300, bottom: 740},
      headerBounds: {left: 32, right: 992, top: 27, bottom: 68, controlsBottom: 72}};
    room.resize(resized);gallery.resize(resized);
    assert.equal(story.element.parentElement, readingContainer);
    assert.notDeepEqual(story.readingRect, originalRect);
    const safe = roomSafeArea(resized.width, resized.height, true, resized.dockBounds, resized.headerBounds);
    assert.equal(story.readingRect.left, safe.left + 8);
    assert.equal(story.readingRect.top, safe.top + 8);
    assert.ok(story.readingRect.left + story.readingRect.width <= resized.width - safe.right);
    assert.ok(story.readingRect.top + story.readingRect.height <= resized.height - safe.bottom);
    assert.equal(scroll.scrollTop, 137);
    // Sorting moves the existing station and then reflows the content. It must
    // not put the reading article back under the transformed scene.
    room.setOrder([...contestsAndActivities].reverse());gallery.resize(resized);
    assert.equal(story.element.parentElement, readingContainer);
    assert.equal(story.object.parent, null);
    assert.deepEqual(story.element.children, storyChildren);
    assert.deepEqual(authoredBlocks(story.element), copy);
    assert.deepEqual(Object.values(descriptors).flatMap(panel => descendants(panel.element))
      .filter(child => ['IMG', 'IFRAME', 'VIDEO'].includes(child.tagName)), players);
    assert.equal(scroll.scrollTop, 137);
    const nextSlug = contestsAndActivities.find(project => project.slug !== slug).slug;
    gallery.setActiveSlug(nextSlug);
    assert.equal(story.readingRect, undefined);
    assert.equal(story.object.parent, scene);
    assert.equal(readingContainer.children.includes(story.element), false);
    gallery.setActiveSlug(slug);gallery.setFocusedSurface('story');
    assert.equal(story.element.parentElement, readingContainer);
    assert.equal(story.element.querySelector('.gallery-room-story-scroll'), scroll);
    assert.equal(scroll.scrollTop, 137);
    gallery.resize({width: 650, height: 844});
    assert.equal(story.readingRect, undefined, 'small spatial windows retain their established compact approach');
    assert.equal(story.object.parent, scene);
    gallery.resize(viewport);
    assert.equal(story.element.parentElement, readingContainer, 'returning to a desktop window restores native reading');
    gallery.dispose();
    assert.equal(readingContainer.children.length, 0);
    assert.equal(story.object.parent, null);
  } finally {gallery.dispose();room.dispose();}
});

test('native phone flow never moves a focused description into the spatial reading host', () => {
  const slug = 'hong-kong-talent-engage-eurotech-healthtech-2026';
  const container = new Element('div'), readingContainer = new Element('div');
  const gallery = createGalleryRoomContent({scene: new Scene(), stations, activeSlug: slug,
    presentation: 'flow', container, readingContainer});
  const story = gallery.stationSurfaces.get(slug).story;
  const scroll = story.element.querySelector('.gallery-room-story-scroll');scroll.scrollTop = 93;
  try {
    gallery.resize({width: 800, height: 1000});gallery.setFocusedSurface('story');
    assert.equal(story.element.parentElement, container);
    assert.equal(story.readingRect, undefined);
    assert.equal(readingContainer.children.length, 0);
    assert.equal(story.element.style.position, 'relative');
    assert.equal(story.element.style.width, '');
    assert.equal(story.element.style.height, '');
    assert.equal(story.element.querySelector('.gallery-room-story-scroll'), scroll);
    assert.equal(scroll.scrollTop, 93);
    assert.equal(story.closeDescription.hidden, true, 'native mobile reading does not expose the spatial close action');
    gallery.setFocusedSurface(null);
    assert.equal(story.element.parentElement, container);
    assert.equal(story.closeDescription.hidden, true);
  } finally {gallery.dispose();}
});

test('Close description is native, stable and acts only while its own desktop reading surface is open', () => {
  const slug = 'hong-kong-talent-engage-eurotech-healthtech-2026';
  const readingContainer = new Element('div');
  const viewport = {width: 1440, height: 900};
  const room = createGalleryRoomScene({scene: new Scene(), projects: contestsAndActivities, viewport});
  let returned = 0;const readingChanges = [];
  const gallery = createGalleryRoomContent({scene: new Scene(), stations: room.stations,
    activeSlug: slug, readingContainer, onReadingChange(reading, descriptor) {readingChanges.push([reading, descriptor]);},
    onReturnToRoom() {returned++;gallery.setFocusedSurface(null);}});
  const story = gallery.stationSurfaces.get(slug).story;
  const close = story.closeDescription, scroll = story.element.querySelector('.gallery-room-story-scroll');
  const authored = authoredBlocks(story.element), nativeChildren = [...story.element.children];
  const assertHidden = message => {
    assert.equal(close.hidden, true, message);
    const previous = returned;close.dispatch('click');
    assert.equal(returned, previous, `${message}: a stale close action does not request navigation`);
  };
  try {
    gallery.resize(viewport);
    assert.equal(close.tagName, 'BUTTON');
    assert.equal(close.type, 'button');
    assert.equal(close.getAttribute('aria-label'), 'Close description');
    assert.equal(story.element.querySelector('.gallery-room-story-close'), close);
    assert.equal(story.element.children.indexOf(close) < story.element.children.indexOf(scroll), true,
      'the close action is outside the authored scroll area');
    assertHidden('overview keeps the close action hidden');
    scroll.scrollTop = 112;gallery.setFocusedSurface('story');
    assert.equal(readingChanges.length, 1);assert.deepEqual(readingChanges[0], [true, story]);
    gallery.resize(viewport);assert.equal(readingChanges.length, 1, 'reflow does not steal focus again');
    assert.equal(close.hidden, false);
    assert.equal(close.parentElement, story.element);
    close.dispatch('click');
    assert.equal(returned, 1, 'the close button invokes the same return callback as Zoom out');
    assert.deepEqual(readingChanges.at(-1), [false, story], 'close re-enables the scene with the same descriptor');
    assert.equal(story.readingRect, undefined);
    assert.equal(readingContainer.children.includes(story.element), false);
    assert.equal(story.element.querySelector('.gallery-room-story-scroll'), scroll);
    assert.equal(scroll.scrollTop, 112);
    assertHidden('return hides the close action');
    for (const destination of ['references', 'media']) {
      gallery.setFocusedSurface('story');assert.equal(close.hidden, false);
      gallery.setFocusedSurface(destination);assertHidden(`switching to ${destination} hides the close action`);
    }
    gallery.setFocusedSurface('story');gallery.resize({width: 650, height: 844});
    assertHidden('compact spatial reading hides the desktop close action');
    gallery.resize(viewport);assert.equal(close.hidden, false);
    assert.equal(story.closeDescription, close);
    assert.deepEqual(story.element.children, nativeChildren);
    assert.deepEqual(authoredBlocks(story.element), authored);
    const nextSlug = contestsAndActivities.find(project => project.slug !== slug).slug;
    gallery.setActiveSlug(nextSlug);assertHidden('changing the project hides the previous close action');
    gallery.setActiveSlug(slug);gallery.setFocusedSurface('story');assert.equal(close.hidden, false);
    assert.equal(story.element.querySelector('.gallery-room-story-close'), close, 'reopening reuses the native close button');
    assert.equal(descendants(story.element).filter(element => element.className?.split(' ').includes('gallery-room-story-close')).length, 1);
    gallery.dispose();assertHidden('disposal hides and deactivates the retained close action');
  } finally {gallery.dispose();room.dispose();}
});

test('portrait and landscape photographs reserve an exact intrinsic aperture with captions and controls below', () => {
  const project = contestsAndActivities.find(project => project.slug === 'tesla-gigathon-2026');
  for (const photo of [
    {width: 1350, height: 1800, worldWidth: 3.3, worldHeight: 4.4, src: '/photos/verified-portrait.jpg', captionWorldHeight: .6, controlsWorldHeight: .5},
    {width: 2400, height: 1600, worldWidth: 5.7, worldHeight: 3.8, src: '/photos/verified-landscape.jpg', captionWorldHeight: .6, controlsWorldHeight: .5}
  ]) {
    const components = galleryStationComponents(project).map(pose => pose.id !== 'media' ? pose : {
      ...pose, photo, worldWidth: photo.worldWidth,
      worldHeight: photo.worldHeight + photo.captionWorldHeight + photo.controlsWorldHeight,
      width: photo.worldWidth * 100,
      height: (photo.worldHeight + photo.captionWorldHeight + photo.controlsWorldHeight) * 100
    });
    const gallery = createGalleryRoomContent({scene: new Scene(), stations: [{slug: project.slug, components}]});
    const surface = gallery.stationSurfaces.get(project.slug).media;
    const [aperture, caption, controls] = surface.element.children;
    assert.ok(surface.element.className.includes('gallery-room-photo-board'));
    assert.equal(aperture.className, 'gallery-room-media-viewport');
    assert.equal(caption.className, 'gallery-room-photo-caption');
    assert.equal(controls.className, 'gallery-room-screen-controls');
    assert.equal(descendants(surface.element).some(element => element.className?.includes('gallery-room-screen-label')), false, 'a photograph has no monitor Screen label');
    assert.ok(caption.textContent.includes(surface.media.abovePhotoCaption));
    const image = aperture.querySelector('img');
    assert.equal(image.src, photo.src, 'only the verified image preview is loaded');
    assert.equal(image.width, photo.width);
    assert.equal(image.height, photo.height);
    assert.equal(aperture.querySelector('iframe'), null);
    assert.ok(descendants(controls).some(element => element.tagName === 'A' && element.href === projectHref(surface.media.url, window.location.href)), 'source remains the original authored URL');
    for (const [width, density] of [[1440, 100], [800, 92], [390, 80]]) {
      gallery.resize({width});
      const imageHeight = Number.parseFloat(surface.element.style.getPropertyValue('--photo-height'));
      const captionHeight = Number.parseFloat(surface.element.style.getPropertyValue('--photo-caption-height'));
      const controlsHeight = Number.parseFloat(surface.element.style.getPropertyValue('--photo-controls-height'));
      assert.ok(Math.abs(surface.width / imageHeight - photo.width / photo.height) < 1e-12, 'image aperture has no residual space to crop, stretch or letterbox');
      assert.ok(Math.abs(surface.height - imageHeight - captionHeight - controlsHeight) < 1e-10, 'caption and controls occupy space outside the exact image aperture');
      assert.equal(surface.width, photo.worldWidth * density);
      assert.equal(surface.element.style.getPropertyValue('--photo-ui-scale'), String(density / 100));
      assert.ok(Math.abs(surface.object.scale.x * imageHeight - photo.worldHeight) < 1e-10);
    }
    gallery.dispose();
    assert.equal(image.hasAttribute('src'), false);
  }
});

test('all verified photo sources, including extensionless Google images, activate as one native image with the original source retained', () => {
  const gallery = createGalleryRoomContent({scene: new Scene(), stations});
  const connected = () => gallery.surfaces.flatMap(object => descendants(object.element)).filter(element => element.hasAttribute?.('src'));
  let count = 0, extensionless = 0, bounded = 0;
  for (const project of contestsAndActivities) {
    gallery.setActiveSlug(project.slug);
    const surfaces = Object.values(gallery.stationSurfaces.get(project.slug));
    for (const surface of surfaces.filter(item => item.photo)) {
      gallery.setFocusedSurface(surface.kind);
      const image = surface.element.querySelector('img');
      assert.ok(image, `${project.slug}/${surface.kind}: verified photograph renders as an image`);
      assert.equal(image.src, surface.photo.displaySrc ?? surface.photo.src);
      assert.equal(surface.element.querySelector('iframe'), null);
      const staticPhotos = surfaces.filter(item => item.photo).map(item => item.element.querySelector('img'));
      assert.deepEqual(new Set(connected()), new Set(staticPhotos), `${project.slug}/${surface.kind}: every static wall photo remains connected without interactive preload`);
      assert.ok(connected().includes(image));
      if (surface.media.abovePhotoCaption) assert.ok(surface.element.querySelector('.gallery-room-photo-caption').textContent.includes(surface.media.abovePhotoCaption));
      if (surface.media.credit) assert.ok(surface.element.querySelector('.gallery-room-photo-caption').textContent.includes(surface.media.credit));
      const originals = descendants(surface.element).filter(element => element.tagName === 'A');
      assert.equal(originals.length, 1);
      assert.equal(originals[0].href, projectHref(surface.media.url, window.location.href));
      gallery.resize({width: 390});
      const apertureHeight = Number.parseFloat(surface.element.style.getPropertyValue('--photo-height'));
      assert.ok(Math.abs(surface.width / apertureHeight - surface.photo.width / surface.photo.height) < 1e-12);
      if (surface.photo.src.includes('googleusercontent.com')) extensionless++;
      if (surface.photo.displaySrc) bounded++;
      count++;
    }
  }
  assert.equal(count, 36, 'all current authored photographs have verified dimensions');
  assert.ok(extensionless > 0, 'extensionless Google image sources are covered');
  assert.equal(bounded, 7, 'oversized originals use bounded presentation copies');
  gallery.dispose();
  assert.equal(connected().length, 0);
});

test('a failed bounded photo retries its original once, reports a second failure and retries the preferred source after reconnecting', () => {
  const gallery = createGalleryRoomContent({scene: new Scene(), stations});
  const candidates = [...gallery.stationSurfaces.values()].flatMap(surfaces => Object.values(surfaces));
  const surface = candidates.find(surface => surface.photo?.displaySrc);
  assert.ok(surface, 'fixture includes a bounded photo copy');
  gallery.setActiveSlug(surface.slug);
  gallery.setFocusedSurface(surface.kind);
  const image = surface.element.querySelector('img');
  const status = surface.element.querySelector('.gallery-room-media-status');
  assert.equal(image.src, surface.photo.displaySrc);
  image.dispatch('error');
  assert.equal(image.src, surface.photo.src, 'first error loads the original image');
  assert.equal(status.textContent, 'Loading original photo…');
  image.dispatch('error');
  assert.equal(image.src, surface.photo.src, 'a second error never starts a retry loop');
  assert.equal(status.textContent, 'This image could not be loaded. Open the original below.');
  const source = descendants(surface.element).find(element => element.tagName === 'A');
  assert.equal(source.href, projectHref(surface.media.url, window.location.href));

  const other = candidates.find(candidate => candidate.type === 'media' && candidate.slug !== surface.slug);
  gallery.setActiveSlug(other.slug);
  assert.equal(image.hasAttribute('src'), false);
  assert.equal(status.textContent, '');
  image.dispatch('error');
  assert.equal(image.hasAttribute('src'), false, 'errors from a disconnected image cannot reload it');
  gallery.setActiveSlug(surface.slug);
  gallery.setFocusedSurface(surface.kind);
  assert.equal(image.src, surface.photo.displaySrc, 'reconnection starts with the bounded source again');
  image.dispatch('error');
  assert.equal(image.src, surface.photo.src, 'reconnection restores one original-source fallback');
  image.dispatch('load');
  assert.equal(status.textContent, '');
  gallery.dispose();
});

test('each panel has two footer magnifiers that zoom the same panel in and out', () => {
  const focused = [];let returned = 0;
  const project = contestsAndActivities.find(project => galleryStationMedia(project).length >= 4 && galleryStationLinks(project).length);
  const station = stations.find(item => item.slug === project.slug);
  const gallery = createGalleryRoomContent({scene: new Scene(), stations: [station], onFocusSurface: surface => focused.push(surface), onReturnToRoom: () => returned++});
  for (const descriptor of Object.values(gallery.stationSurfaces.get(station.slug)).filter(item => item.type !== 'title')) {
    gallery.setFocusedSurface(null);
    const buttons = descendants(descriptor.element).filter(element => element.tagName === 'BUTTON' && element.className?.split(' ').includes('gallery-room-zoom'));
    assert.deepEqual(buttons.map(button => button.getAttribute('aria-label')), ['Zoom in', 'Zoom out']);
    assert.equal(buttons[0].parentElement, buttons[1].parentElement);
    for (const button of buttons) assert.match(button.innerHTML, /<svg[^>]+viewBox="0 0 24 24"/);
    assert.equal(buttons[0].disabled, false);assert.equal(buttons[1].disabled, true);
    buttons[1].dispatch('click');assert.equal(returned, focused.length);
    buttons[0].dispatch('click');assert.equal(focused.at(-1), descriptor);
    gallery.setFocusedSurface(descriptor.kind);
    assert.equal(buttons[0].disabled, true);assert.equal(buttons[1].disabled, false);
    const count = focused.length;buttons[0].dispatch('click');assert.equal(focused.length, count);
    buttons[1].dispatch('click');assert.equal(returned, focused.length);
  }
  gallery.dispose();
});

test('titles retain only their authored heading and technologies on desktop, phones and focused views', () => {
  const subset = [stations[15], stations[2], stations[29]];
  const gallery = createGalleryRoomContent({scene:new Scene(), stations:subset});
  for(const width of[1280,800,390]){
    gallery.resize({width,height:844});
    for(const station of subset){
      gallery.setActiveSlug(station.slug);gallery.setFocusedSurface('story');
      const title=gallery.stationSurfaces.get(station.slug).title.element;
      const project=contestsAndActivities.find(item=>item.slug===station.slug);
      assert.equal(title.querySelector('h1').textContent, project.title);
      assert.equal(title.querySelector('.gallery-room-title-number'), null);
      assert.equal(title.querySelector('.gallery-room-title-meta'), null);
      assert.deepEqual(title.querySelector('.gallery-room-technologies').children.map(tag=>tag.textContent),project.technologies);
      assert.equal(title.style['--title-counter-width'], undefined);
    }
  }
  gallery.dispose();
});

test('photo and monitor previews have no centered icon and tapping the surface zooms in', async () => {
  const focused = [];
  const gallery = createGalleryRoomContent({scene: new Scene(), stations, onFocusSurface: surface => focused.push(surface)});
  let photos = 0, monitors = 0;
  for (const descriptors of gallery.stationSurfaces.values()) for (const descriptor of Object.values(descriptors)) {
    if (descriptor.type !== 'media') continue;
    if (descriptor.photo) photos++;else monitors++;
    assert.equal(descriptor.approach.querySelector('button'), null);
    assert.equal(descriptor.approach.getAttribute('aria-hidden'), 'true');
    descriptor.element.dispatch('click', {target: descriptor.approach});
    assert.equal(focused.at(-1), descriptor);
  }
  assert.equal(photos, 36);assert.equal(monitors, 30);
  const css = await readFile(new URL('../src/galleryRoomContent.css', import.meta.url), 'utf8');
  assert.match(/\.gallery-room-screen-approach\s*\{([^}]+)\}/.exec(css)?.[1], /background:\s*transparent\s*;/);
  gallery.dispose();
});

test('projects without media zoom their story and references independently', () => {
  const focused = [];
  const project = contestsAndActivities.find(project => !galleryStationMedia(project).length && galleryStationLinks(project).length);
  const gallery = createGalleryRoomContent({scene: new Scene(), stations: stations.filter(item => item.slug === project.slug), onFocusSurface: surface => focused.push(surface)});
  const descriptors = gallery.stationSurfaces.get(project.slug);
  assert.equal(descriptors.media, undefined);
  for (const descriptor of [descriptors.story, descriptors.references]) {
    descriptor.zoomIn.dispatch('click');assert.equal(focused.at(-1), descriptor);
    assert.equal(descendants(descriptor.element).some(element => element.getAttribute?.('aria-label') === 'Next object'), false);
  }
  gallery.dispose();
});

test('compact screens retain both accessible magnifiers and original-source links', () => {
  const station = stations.find(item => galleryStationMedia(contestsAndActivities.find(project => project.slug === item.slug)).length && galleryStationLinks(contestsAndActivities.find(project => project.slug === item.slug)).length);
  const gallery = createGalleryRoomContent({scene: new Scene(), stations: [station]});
  gallery.resize({width: 390});
  for (const surface of Object.values(gallery.stationSurfaces.get(station.slug)).filter(item => item.type !== 'title')) {
    assert.equal(surface.zoomIn.getAttribute('aria-label'), 'Zoom in');assert.equal(surface.zoomOut.getAttribute('aria-label'), 'Zoom out');
    assert.notEqual(surface.zoomIn.hidden, true);assert.notEqual(surface.zoomOut.hidden, true);
    if (surface.type === 'media') assert.ok(descendants(surface.element).some(element => element.tagName === 'A' && element.textContent === 'Open original ↗' && element.href === projectHref(surface.media.url, window.location.href)));
  }
  gallery.dispose();
});

test('all References links preserve external security and native internal project navigation including modifier clicks', () => {
  const selected = [];
  const gallery = createGalleryRoomContent({scene: new Scene(), stations, onProjectLink: slug => selected.push(slug)});
  let externalCount = 0;
  let internalCount = 0;
  for (const surfaces of gallery.stationSurfaces.values()) for (const surface of Object.values(surfaces).filter(item => item.type === 'references')) for (const anchor of descendants(surface.element).filter(element => element.tagName === 'A')) {
    const destination = new URL(anchor.href, window.location.href);
    const slug = destination.origin === new URL(window.location.href).origin ? destination.searchParams.get('event') : null;
    if (slug && contestsAndActivities.some(project => project.slug === slug)) {
      let prevented = false;
      anchor.dispatch('click', {button: 0, preventDefault: () => { prevented = true; }});
      assert.equal(prevented, true);
      assert.equal(selected.at(-1), slug);
      prevented = false;
      anchor.dispatch('click', {button: 0, ctrlKey: true, preventDefault: () => { prevented = true; }});
      assert.equal(prevented, false, 'modifier click retains browser behavior');
      internalCount++;
    } else {
      assert.equal(anchor.target, '_blank');
      assert.equal(anchor.rel, 'noopener noreferrer');
      externalCount++;
    }
  }
  assert.ok(internalCount > 0, 'fixture covers legacy/internal achievement links');
  assert.ok(externalCount > 0, 'fixture covers external resources');
  gallery.dispose();
});

test('native viewer URLs preserve provider identity and unsafe or unsupported sources cannot fake playback', () => {
  assert.deepEqual(galleryMediaPreview('https://drive.google.com/file/d/real_id/view'), {kind: 'iframe', url: 'https://drive.google.com/file/d/real_id/preview', provider: 'Google Drive'});
  assert.equal(galleryMediaPreview('https://docs.google.com/presentation/d/slides-id/edit').url, 'https://docs.google.com/presentation/d/slides-id/embed?start=false&loop=false&delayms=3000');
  assert.equal(galleryMediaPreview('/photos/tesla-gigathon/tesla-gigathon-2026-first-place-prize.jpg').kind, 'image');
  assert.equal(galleryMediaPreview('https://example.com/not-a-player').kind, 'link');
  assert.equal(galleryMediaPreview('javascript:alert(1)'), null);
});

test('real wall reflow preserves native players and source navigation while CSS3D boards stay aligned with packed camera pixels', () => {
  const initial={width:1280,height:900};
  const room=createGalleryRoomScene({scene:new Scene(),projects:contestsAndActivities,viewport:initial});
  const cssScene=new Scene();
  const gallery=createGalleryRoomContent({scene:cssScene,stations:room.stations});
  const [slug,surfaces]=[...gallery.stationSurfaces].find(([,panels])=>{
    const media=Object.values(panels).filter(panel=>panel.type==='media');
    return media.some(panel=>panel.element.querySelector('img'))&&media.filter(panel=>panel.element.querySelector('iframe')).length>=2;
  });
  room.setActive(slug);gallery.setActiveSlug(slug);gallery.resize(initial);
  const station=room.stations.get(slug),descriptors=Object.values(surfaces);
  const identity=new Map(descriptors.map(panel=>[panel.kind,{object:panel.object,element:panel.element}]));
  const players=descriptors.flatMap(panel=>descendants(panel.element)).filter(element=>['IMG','IFRAME','VIDEO'].includes(element.tagName));
  const sourceState=new Map(players.map(player=>[player,{src:player.src,writes:player.srcWrites}]));
  const authored=authoredBlocks(surfaces.story.element);
  const references=descendants(surfaces.references.element).filter(element=>element.className?.includes('gallery-room-reference-link'));
  const referenceDestinations=references.map(link=>link.href);
  for(const [width,height]of[[1280,900],[2148,1298],[390,844],[568,320],[320,568],[1280,720],[700,1080],[800,479]]){
    const viewport={width,height};room.resize(viewport);gallery.resize(viewport);
    assert.equal(room.stations.get(slug),station,'the selected physical station retains its identity');
    assert.equal(Object.values(gallery.stationSurfaces.get(slug)).filter(panel=>panel.type==='references').length,1);
    const plan=overviewCameraPlan(station,viewport,roomCameraFov(width));
    const camera=new PerspectiveCamera(roomCameraFov(width),width/height,.08,170);
    camera.position.fromArray(plan.position);camera.lookAt(...plan.target);camera.updateMatrixWorld(true);cssScene.updateMatrixWorld(true);
    for(const descriptor of descriptors){
      const original=identity.get(descriptor.kind),pose=station.surfaces[descriptor.kind];
      assert.equal(descriptor.object,original.object);assert.equal(descriptor.element,original.element);
      assert.deepEqual(descriptor.position,pose.position);assert.deepEqual(descriptor.object.position.toArray(),pose.position);
      assert.equal(descriptor.width,pose.width,'wall canvases use the actual arrival pixel width');
      assert.equal(descriptor.worldWidth,pose.worldWidth);assert.equal(descriptor.worldHeight,pose.worldHeight);
      const corners=[];
      for(const x of[-1,1])for(const y of[-1,1]){
        const point=new Vector3(x*descriptor.width/2,y*descriptor.height/2,0).applyMatrix4(descriptor.object.matrixWorld).project(camera);
        corners.push([(point.x+1)*width/2,(1-point.y)*height/2]);
      }
      const rect=pose.pixelRect;
      assert.ok(Math.abs(Math.min(...corners.map(point=>point[0]))-rect.x)<.01);
      assert.ok(Math.abs(Math.max(...corners.map(point=>point[0]))-(rect.x+rect.width))<.01);
      assert.ok(Math.abs(Math.min(...corners.map(point=>point[1]))-rect.y)<.01);
      assert.ok(Math.abs(Math.max(...corners.map(point=>point[1]))-(rect.y+rect.height))<.01);
    }
    for(const player of players){
      const before=sourceState.get(player);
      assert.equal(player.src,before.src,'resizing does not navigate a loaded native player');
      assert.equal(player.srcWrites,before.writes,'the same src is never reassigned during reflow');
    }
    assert.deepEqual(authoredBlocks(surfaces.story.element),authored);
    assert.deepEqual(descendants(surfaces.references.element).filter(element=>element.className?.includes('gallery-room-reference-link')),references);
    assert.deepEqual(references.map(link=>link.href),referenceDestinations);
  }
  gallery.setFocusedSurface('story');
  assert.equal(surfaces.story.width,galleryStoryCanvasWidth(surfaces.story,{width:800,height:479}));
  gallery.setFocusedSurface('references');
  assert.equal(surfaces.references.element,identity.get('references').element);
  assert.deepEqual(references.map(link=>link.href),referenceDestinations);
  gallery.setFocusedSurface(null);
  assert.equal(surfaces.story.width,station.surfaces.story.width);
  gallery.dispose();room.dispose();
  assert.ok(players.every(player=>!player.hasAttribute('src')));
});

test('tiny phone media previews retain their player while the focused screen restores room for all native actions', () => {
  const room=createGalleryRoomScene({scene:new Scene(),projects:contestsAndActivities});
  const gallery=createGalleryRoomContent({scene:new Scene(),stations:room.stations});
  let tinyPreviews=0,focusedScreens=0;
  try{
    for(const [width,height]of[[320,568],[375,667],[390,664],[390,844],[430,814],[360,640],[412,780],[412,915],[844,390]]){
      const viewport={width,height};room.resize(viewport);gallery.resize(viewport);
      for(const station of room.stations.values()){
        gallery.setActiveSlug(station.slug);
        const media=Object.values(gallery.stationSurfaces.get(station.slug)).filter(surface=>surface.type==='media'&&!surface.photo);
        for(const surface of media){
          gallery.setFocusedSurface(null);
          const small=surface.width<100;
          assert.equal(surface.element.className.split(' ').includes('is-tiny'),small);
          if(small)tinyPreviews++;
          const player=surface.element.querySelector('iframe')??surface.element.querySelector('video');
          const approach=surface.element.querySelector('.gallery-room-screen-approach');
          gallery.setFocusedSurface(surface.kind);focusedScreens++;
          assert.ok(surface.width>=100,`${station.slug}/${surface.kind} at ${width}x${height}: focused actions have a complete native row`);
          assert.equal(surface.element.className.split(' ').includes('is-tiny'),false);
          assert.equal(surface.element.querySelector('iframe')??surface.element.querySelector('video'),player,'approach reuses the native player');
          assert.equal(surface.element.querySelector('.gallery-room-screen-approach'),approach);
          assert.equal(approach.hidden,true,'the center approach relinquishes pointer access to the focused player');
        }
      }
    }
    assert.ok(tinyPreviews>0,'the regression covers actually narrow original preview screens');
    assert.equal(focusedScreens,30*9,'every nonphoto screen is approached at every selected phone/browser size');
  }finally{gallery.dispose();room.dispose();}
});

test('every focused story and References panel has useful reading space and native-size text across all responsive walls', () => {
  const viewports=[
    {width:1280,height:600},{width:1280,height:720},{width:1280,height:900},
    {width:1920,height:1080},{width:2148,height:1298},{width:2560,height:1440},
    {width:1000,height:1000},{width:1024,height:768},{width:901,height:650},
    {width:900,height:650},{width:800,height:500},{width:800,height:479},
    {width:700,height:1080},{width:768,height:1024},{width:700,height:479},
    {width:568,height:320},{width:390,height:844},{width:320,height:568},
    {width:390,height:480},{width:390,height:650,dockBounds:{left:16,right:236,top:366,bottom:640}},
    {width:601,height:844},{width:650,height:844},{width:699,height:900},
    {width:360,height:780},{width:412,height:915},{width:500,height:1080}
  ];
  const room=createGalleryRoomScene({scene:new Scene(),projects:contestsAndActivities,viewport:viewports[0]});
  const gallery=createGalleryRoomContent({scene:new Scene(),stations:room.stations});
  const failures=[],metrics=[];
  function measure(station,kind,viewport){
    gallery.setActiveSlug(station.slug);gallery.setFocusedSurface(kind);
    const descriptor=gallery.stationSurfaces.get(station.slug)[kind],pose=station.surfaces[kind];
    const fov=roomCameraFov(viewport.width);
    // The controller uses physical poses, including adaptive frame padding.
    const plan=surfaceCameraPlan({...pose,worldWidth:descriptor.worldWidth,worldHeight:descriptor.worldHeight},viewport,fov);
    const camera=new PerspectiveCamera(fov,viewport.width/viewport.height,.08,170);
    camera.position.fromArray(plan.position);camera.lookAt(...plan.target);
    camera.setViewOffset(viewport.width,viewport.height,plan.viewOffset.x,plan.viewOffset.y,viewport.width,viewport.height);
    camera.updateMatrixWorld(true);
    const left=new Vector3(descriptor.position[0]-descriptor.worldWidth/2,descriptor.position[1],descriptor.position[2]).project(camera);
    const right=new Vector3(descriptor.position[0]+descriptor.worldWidth/2,descriptor.position[1],descriptor.position[2]).project(camera);
    const displayWidth=(right.x-left.x)*viewport.width/2,scale=displayWidth/descriptor.width;
    const phone=viewport.width<700;
    // Phone copy uses a compact reading scale; desktop/tablet chrome and
    // physical reading space retain their established minimums.
    const chrome=kind==='story'?(phone?27+12:37+20)+2:(phone?19+27+8:36.6+37+14)+2;
    const usefulHeight=(descriptor.height-chrome)*scale;
    const cssBody=kind==='references'?(phone?9:16):phone?11.5:16;
    const actualFont=cssBody*scale,minimumFont=kind==='references'?(phone?9:16):phone?11:15.8;
    const metric={slug:station.slug,kind,viewport:[viewport.width,viewport.height],
      arrival:[pose.width,pose.height],focused:[displayWidth,descriptor.height*scale],usefulHeight,actualFont};
    metrics.push(metric);
    if(usefulHeight<40-1e-7)failures.push({...metric,reason:'less than 40px of useful text viewport'});
    if(actualFont<minimumFont-1e-7)failures.push({...metric,reason:`focused font below ${minimumFont}px`});
    if(!phone&&kind==='story'&&actualFont>16+1e-7)failures.push({...metric,reason:'focused story text exceeds its 16px overview size'});
    if(phone&&actualFont>(kind==='references'?9:11.5)+1e-7)failures.push({...metric,reason:'focused phone text exceeds its intended compact size'});
    return metric;
  }
  for(const viewport of viewports){
    room.resize(viewport);gallery.resize(viewport);
    for(const station of room.stations.values()){
      measure(station,'story',viewport);
      if(station.surfaces.references)measure(station,'references',viewport);
    }
  }
  assert.equal(metrics.filter(metric=>metric.kind==='story').length,32*viewports.length);
  assert.equal(metrics.filter(metric=>metric.kind==='references').length,26*viewports.length);
  const narrow={width:900,height:500};room.resize(narrow);gallery.resize(narrow);
  const ethrome=measure(room.stations.get('ethrome-2025'),'references',narrow);
  assert.ok(ethrome.focused[1]>=129.6,'former 560×42 ETHRome References panel reserves fixed chrome and 40px for links');
  const mdsi=metrics.find(metric=>metric.slug==='mdsi-bundesliga-2024'&&metric.kind==='story'&&metric.viewport[0]===568&&metric.viewport[1]===320);
  assert.ok(mdsi.usefulHeight>=40,'former 302×36 MDSI story has a useful scroll viewport after approaching');
  assert.deepEqual(failures.slice(0,12),[],`${failures.length} focused text metrics failed`);
  gallery.dispose();room.dispose();
});
