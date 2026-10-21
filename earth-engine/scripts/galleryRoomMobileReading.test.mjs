import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Scene} from 'three';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {galleryStationMedia, galleryStationLinks} from '../src/galleryRoomLayout.js';
import {projectHref} from '../src/projectContent.js';

// This fixture exercises the native flow's DOM identity, events and lifecycle;
// it deliberately makes no claim to provide browser layout or device rendering.
class TextNode {
  constructor(text) { this.textContent = String(text); this.parentElement = null; }
}
class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map();
    this.dataset = {}; this.listeners = new Map(); this.parentElement = null;
    this.ownerDocument = globalThis.document;
    this.style = {setProperty(key, value) { this[key] = String(value); },
      getPropertyValue(key) { return this[key] || ''; }, removeProperty(key) { delete this[key]; }};
    this.classList = {
      contains: name => (this.className || '').split(/\s+/).includes(name),
      add: (...names) => { this.className = [...new Set([...(this.className || '').split(/\s+/).filter(Boolean), ...names])].join(' '); },
      remove: (...names) => { this.className = (this.className || '').split(/\s+/).filter(name => !names.includes(name)).join(' '); },
      toggle: (name, force) => { const enabled = force ?? !this.classList.contains(name); this.classList[enabled ? 'add' : 'remove'](name); return enabled; },
    };
  }
  append(...items) {
    for (const item of items) {
      const child = typeof item === 'string' ? new TextNode(item) : item;
      child.remove?.(); this.children.push(child); child.parentElement = this;
    }
  }
  appendChild(item) { this.append(item); return item; }
  replaceChildren(...items) { for (const child of this.children) child.parentElement = null; this.children = []; this.append(...items); }
  get textContent() { return this.children.map(child => child.textContent).join(''); }
  set textContent(text) { this.replaceChildren(new TextNode(text)); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  hasAttribute(name) { return this.attributes.has(name); }
  set src(value) { this.srcWrites = (this.srcWrites || 0) + 1; this.setAttribute('src', value); }
  get src() { return this.getAttribute('src') || ''; }
  addEventListener(name, action) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(action); }
  dispatch(name, event = {}) {
    if (name === 'click' && this.disabled) return;
    for (const action of this.listeners.get(name) || []) action({target: this, ...event});
  }
  matches(selector) {
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector === '[data-gallery-surface]') return this.dataset.gallerySurface != null;
    return selector === this.tagName.toLowerCase();
  }
  querySelectorAll(selector) { return descendants(this).filter(child => selector.split(',').some(part => child.matches(part.trim()))); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  closest(selector) { for (let element = this; element; element = element.parentElement) if (selector.split(',').some(part => element.matches?.(part.trim()))) return element; return null; }
  contains(target) { for (let node = target; node; node = node.parentElement) if (node === this) return true; return false; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); this.parentElement = null; }
  pause() { this.paused = true; }
  load() { this.loaded = true; }
  focus() { document.activeElement = this; }
  getContext() { return null; }
}
function descendants(host) { return host.children.flatMap(child => child instanceof Element ? [child, ...descendants(child)] : []); }
globalThis.document = {createElement: tag => new Element(tag), createTextNode: text => new TextNode(text),
  createDocumentFragment: () => new Element('fragment'), defaultView: {Element}};
globalThis.window = {location: {href: 'https://staging.batikanor.com/?view=gallery'}, innerWidth: 390,
  innerHeight: 844, matchMedia: () => ({matches: false})};
let source = await readFile(new URL('../src/galleryRoomContent.js', import.meta.url), 'utf8');
source = source.replace(/^import ['"].*\.css['"];?\s*$/gm, '');
source = source.replace(/(['"])(\.\/[^'"]+\.js)\1/g, (_, quote, path) => JSON.stringify(new URL(`../src/${path.slice(2)}`, import.meta.url).href));
source = source.replace("'three/addons/renderers/CSS3DRenderer.js'", JSON.stringify(import.meta.resolve('three/addons/renderers/CSS3DRenderer.js')));
const {createGalleryRoomContent} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const stations = projects.map((project, index) => ({slug: project.slug, index, x: index * 18}));
const mountedBoards = host => descendants(host).filter(element => element.dataset.gallerySurface);
const nativePlayers = host => descendants(host).filter(element => ['IMG', 'IFRAME', 'VIDEO'].includes(element.tagName));
const ownElements = (descriptor, selector) => descriptor.element.querySelectorAll(selector)
  .filter(element => element.closest('[data-gallery-surface]') === descriptor.element);
const configuredMediaKeys = project => new Set([...project.longDescription.matchAll(/\{\{(image|embed|gdrive_embed)\[(\d+)\]\}\}/g)]
  .map(match => `${match[1] === 'image' ? 'image' : 'embed'}:${Number(match[2])}`));
function createFlow(options = {}) {
  const container = new Element('main'), scene = new Scene();
  const content = createGalleryRoomContent({scene, stations, presentation: 'flow', container, ...options});
  return {container, scene, content};
}

test('mobile reading honors all configured inline media and retains all 66 media and 107 references', () => {
  const {container, scene, content} = createFlow();
  assert.equal(scene.children.length, 0, 'native boards never enter the transformed CSS3D scene');
  let mediaCount = 0, referenceCount = 0, inlineCount = 0, trailingCount = 0;
  for (const project of projects) {
    content.setActiveSlug(project.slug);
    const descriptors = content.stationSurfaces.get(project.slug);
    const boards = mountedBoards(container), media = galleryStationMedia(project), links = galleryStationLinks(project);
    const configured = configuredMediaKeys(project), story = descriptors.story.element.querySelector('.gallery-room-story-scroll');
    assert.deepEqual(boards.map(board => board.dataset.gallerySurface),
      ['title', 'story', ...media.map((record, index) => index ? `media-${index + 1}` : 'media'), ...(links.length ? ['references'] : [])],
      `${project.slug}: media preserves authored order, followed by one complete reference list`);
    assert.ok(boards.every(board => board.dataset.gallerySlug === project.slug && !board.inert));
    assert.equal(descriptors.title.element.querySelector('h1').textContent, project.title);
    assert.ok(descriptors.story.element.textContent.includes(project.shortDescription));
    for (const [index, record] of media.entries()) {
      const descriptor = descriptors[index ? `media-${index + 1}` : 'media'];
      assert.equal(descriptor.media.key, record.key);
      const inline = configured.has(record.key);
      assert.equal(descriptor.element.parentElement, inline ? story : container,
        `${project.slug}/${record.key}: configured media belongs inside the story, other media follows it`);
      assert.equal(descriptor.element.classList.contains('gallery-room-inline-media'), inline);
      if (inline) inlineCount++; else trailingCount++;
      const originals = descendants(descriptor.element).filter(element => element.tagName === 'A');
      assert.ok(originals.some(link => link.href === projectHref(record.url, window.location.href)));
      if (record.abovePhotoCaption) assert.ok(descriptor.element.textContent.includes(record.abovePhotoCaption));
      if (record.credit) assert.ok(descriptor.element.textContent.includes(record.credit));
    }
    if (links.length) {
      const anchors = descriptors.references.element.querySelectorAll('a');
      assert.equal(anchors.length, links.length);
      assert.deepEqual(anchors.map(link => link.href), links.map(link => projectHref(link.url, window.location.href)));
    }
    mediaCount += media.length; referenceCount += links.length;
  }
  assert.equal(mediaCount, 66); assert.equal(referenceCount, 107);
  assert.equal(inlineCount, 31); assert.equal(trailingCount, 35);
  content.dispose(); assert.equal(mountedBoards(container).length, 0);
});

test('configured photos and demos appear beside the paragraphs that explain them, including reordered embed indices', () => {
  const {content} = createFlow();
  const examples = [
    ['sui-hackathon-poland-2025', 'embed:0', /^I took the "Kulturbahn"/, /^The hospitality continued/],
    ['sui-hackathon-poland-2025', 'embed:1', /^The hospitality continued/, /^The Sui team was fantastic/],
    ['sui-hackathon-poland-2025', 'embed:2', /^The Sui team was fantastic/, /^I hacked solo/],
    ['hong-kong-talent-engage-eurotech-healthtech-2026', 'embed:1', /^The pitch we delivered/, /^From the Munich hackathon to Hong Kong/],
    ['hong-kong-talent-engage-eurotech-healthtech-2026', 'embed:0', /^One personal highlight/, /^Research, company visits and technology demonstrations/],
    ['music-ai-osaka-2025', 'embed:5', /^We were given the incredible opportunity/, /^We designed the pen/],
    ['music-ai-osaka-2025', 'embed:2', /^On the left side of our interface/, /^In our demo video/],
  ];
  for (const [slug, key, before, after] of examples) {
    content.setActiveSlug(slug);
    const descriptors = content.stationSurfaces.get(slug), scroll = descriptors.story.element.querySelector('.gallery-room-story-scroll');
    const descriptor = Object.values(descriptors).find(item => item.media?.key === key), index = scroll.children.indexOf(descriptor.element);
    assert.ok(index > 0 && index < scroll.children.length - 1, `${slug}/${key}: media is interleaved with prose`);
    assert.match(scroll.children[index - 1].textContent, before, `${slug}/${key}: preceding context stays before the media`);
    assert.match(scroll.children[index + 1].textContent, after, `${slug}/${key}: following context stays after the media`);
  }
  content.dispose();
});

test('image and embed aliases support first configured placement without duplicating players, and preserve unplaced media', () => {
  const project = projects.find(item => item.slug === 'hong-kong-talent-engage-eurotech-healthtech-2026');
  const original = {longDescription: project.longDescription, images: project.images};
  let content;
  try {
    project.images = [
      {url: '/images/inline-fixture.jpg', abovePhotoCaption: 'Configured image'},
      {url: '/images/trailing-fixture.jpg', abovePhotoCaption: 'Unplaced image'},
    ];
    project.longDescription = 'Before the configured pitch.\n\n{{embed[1]}}\n\nBetween pitch and photo.\n\n{{image[0]}}\n\nAfter the configured photo.\n\n{{gdrive_embed[1]}}\n\nStill the same story.\n\n{{image[99]}}\n\nThe final paragraph.';
    const result = createFlow({activeSlug: project.slug});
    content = result.content;
    const {container} = result, descriptors = content.stationSurfaces.get(project.slug);
    const scroll = descriptors.story.element.querySelector('.gallery-room-story-scroll');
    const media = Object.values(descriptors).filter(item => item.type === 'media');
    assert.deepEqual(media.map(item => item.media.key), ['embed:1', 'image:0', 'image:1', 'embed:0']);
    assert.deepEqual(scroll.children.filter(item => item.dataset?.gallerySurface).map(item => media.find(descriptor => descriptor.element === item).media.key),
      ['embed:1', 'image:0'], 'embed aliases share one existing player at its first placement');
    assert.deepEqual(container.children.map(item => item.dataset.gallerySurface), ['title', 'story', 'media-3', 'media-4', 'references'],
      'unplaced image and embed remain available after the complete story');
    assert.deepEqual(scroll.children.filter(item => item.tagName === 'P').map(item => item.textContent),
      ['Before the configured pitch.', 'Between pitch and photo.', 'After the configured photo.', 'Still the same story.', 'The final paragraph.']);
    assert.doesNotMatch(scroll.textContent, /\{\{(?:image|embed|gdrive_embed)\[/, 'missing or repeated placement tokens never become visible text');
    assert.equal(mountedBoards(container).filter(item => item.dataset.galleryType === 'media').length, 4);
    assert.equal(new Set(nativePlayers(container)).size, 4, 'each authored source has exactly one native viewer');
  } finally {
    content?.dispose();project.longDescription = original.longDescription;
    if (original.images === undefined) delete project.images; else project.images = original.images;
  }
});

test('desktop keeps independent wall screens and contains no inline media in its story', () => {
  const scene = new Scene(), content = createGalleryRoomContent({scene, stations});
  let mediaCount = 0;
  for (const project of projects) {
    const descriptors = content.stationSurfaces.get(project.slug), scroll = descriptors.story.element.querySelector('.gallery-room-story-scroll');
    assert.equal(mountedBoards(scroll).length, 0, `${project.slug}: desktop prose remains on its own wall board`);
    for (const descriptor of Object.values(descriptors).filter(item => item.type === 'media')) {
      mediaCount++;
      assert.equal(descriptor.element.classList.contains('gallery-room-inline-media'), false);
      assert.ok(scene.children.includes(descriptor.object), 'the original spatial media screen remains in the room');
    }
  }
  assert.equal(mediaCount, 66);content.dispose();
});

test('phone resizes and approach/return keep the same native content without a fixed-height reference aperture', () => {
  const project = projects.find(project => project.slug === 'hong-kong-talent-engage-eurotech-healthtech-2026');
  const {container, content} = createFlow({activeSlug: project.slug});
  const originalBoards = mountedBoards(container), descriptors = content.stationSurfaces.get(project.slug);
  const references = descriptors.references.element;
  assert.equal(references.querySelectorAll('a').length, 19, 'the reported long references collection remains fully present');
  const players = nativePlayers(container), connected = new Map(players.map(player => [player, player.src]));
  for (const [width, height] of [[320, 568], [360, 640], [390, 844], [430, 932], [844, 390], [390, 650]]) {
    content.resize({width, height});
    for (const kind of ['story', 'references', null]) {
      content.setFocusedSurface(kind);
      assert.deepEqual(mountedBoards(container), originalBoards, 'focus does not rebuild or move unrelated reading boards');
      for (const board of originalBoards.filter(element => ['title', 'story', 'references'].includes(element.dataset.gallerySurface))) {
        assert.ok(!board.style.height || board.style.height === 'auto', `${width}×${height}: textual cards retain content height`);
      }
      assert.equal(references.querySelectorAll('a').length, 19);
      for (const player of players) assert.equal(player.src, connected.get(player), 'reading an adjacent section does not unload the media');
    }
  }
  content.dispose();
});

test('every reading panel keeps a clear bottom-row zoom pair and no next-object or central controls', () => {
  const {content} = createFlow();
  let panelCount = 0;
  for (const [slug, descriptors] of content.stationSurfaces) {
    content.setActiveSlug(slug);
    for (const descriptor of Object.values(descriptors).filter(item => item.type !== 'title')) {
      panelCount++;
      const buttons = ownElements(descriptor, 'button').filter(button => button.className?.split(' ').includes('gallery-room-zoom'));
      if (descriptor.closeDescription) assert.equal(descriptor.closeDescription.hidden, true, 'the desktop popup close action stays hidden in native flow');
      assert.deepEqual(buttons.map(button => button.getAttribute('aria-label')), ['Zoom in', 'Zoom out'],
        `${slug}/${descriptor.kind}: each panel offers the same two explicit magnifier actions`);
      assert.equal(descriptor.zoomIn, buttons[0]); assert.equal(descriptor.zoomOut, buttons[1]);
      assert.equal(buttons[0].parentElement, buttons[1].parentElement, 'both controls occupy the same bottom row');
      assert.ok(buttons[0].closest('footer'), 'the zoom pair is in the panel footer');
      for (const button of buttons) {
        assert.ok(!button.hidden);
        assert.match(button.innerHTML, /<svg[^>]+viewBox="0 0 24 24"/);
        assert.match(button.innerHTML, /<circle/);
        assert.equal(button.title, button.getAttribute('aria-label'));
      }
      assert.match(buttons[0].innerHTML, /M7 10\.5h7M10\.5 7v7/, 'zoom in contains the plus mark');
      assert.match(buttons[1].innerHTML, /M7 10\.5h7"/, 'zoom out contains the minus mark');
      assert.equal(descriptor.zoomIn.disabled, false); assert.equal(descriptor.zoomOut.disabled, true);
      content.setFocusedSurface(descriptor.kind);
      assert.equal(descriptor.zoomIn.disabled, true); assert.equal(descriptor.zoomOut.disabled, false);
      assert.ok(buttons.every(button => !button.hidden), 'focus retains both icons in place');
      content.setFocusedSurface(null);
      assert.equal(descriptor.zoomIn.disabled, false); assert.equal(descriptor.zoomOut.disabled, true);
      if (descriptor.approach) assert.equal(descriptor.approach.querySelectorAll('button').length, 0,
        'passive viewers have no additional center button');
    }
  }
  assert.equal(panelCount, 32 + 66 + [...content.stationSurfaces.values()].filter(items => items.references).length);
  content.dispose();
});

test('tapping a story, photo or references panel matches its explicit zoom-in action', () => {
  const focused = [], returned = [];
  const {container, content} = createFlow({activeSlug: projects[0].slug,
    onFocusSurface: descriptor => focused.push(descriptor), onReturnToRoom: () => returned.push(true)});
  const descriptors = content.stationSurfaces.get(projects[0].slug);
  const photo = Object.values(descriptors).find(descriptor => descriptor.type === 'media' && descriptor.element.querySelector('img'));
  assert.ok(photo, 'the fixture contains a directly tappable photo');
  for (const descriptor of [descriptors.story, photo, descriptors.references].filter(Boolean)) {
    const target = ownElements(descriptor, 'img,p')[0] || descriptor.element;
    descriptor.element.dispatch('click', {target, detail: 1});
    assert.equal(focused.at(-1), descriptor);
    descriptor.zoomIn.dispatch('click');
    assert.equal(focused.at(-1), descriptor, 'the footer and panel tap address the same content');
    let prevented = false;
    descriptor.element.dispatch('keydown', {key: 'Enter', preventDefault() { prevented = true; }});
    assert.ok(prevented); assert.equal(focused.at(-1), descriptor, 'keyboard activation reaches the same zoom-in action');
    content.setFocusedSurface(descriptor.kind);
    descriptor.zoomOut.dispatch('click');
    assert.equal(returned.length, [descriptors.story, photo, descriptors.references].filter(Boolean).indexOf(descriptor) + 1);
    content.setFocusedSurface(null);
  }
  assert.equal(mountedBoards(container).length, Object.keys(descriptors).length);
  assert.equal(photo.approach.hidden, true, 'photographs preserve native scrolling without an interception overlay');
  content.dispose();
});

test('inline media tap and keyboard activation focus the media once without focusing its containing story', () => {
  const focused = [], {content} = createFlow({activeSlug: projects[0].slug, onFocusSurface: descriptor => focused.push(descriptor)});
  const descriptors = content.stationSurfaces.get(projects[0].slug), story = descriptors.story.element;
  const photo = Object.values(descriptors).find(item => item.type === 'media' && item.element.querySelector('img'));
  assert.ok(story.contains(photo.element), 'the photograph is configured within this story');
  const image = photo.element.querySelector('img');
  photo.element.dispatch('click', {target: image, detail: 1});
  story.dispatch('click', {target: image, detail: 1});
  assert.equal(focused.length, 1, 'the bubbling tap belongs to its nearest media panel');
  assert.equal(focused[0], photo);
  focused.length = 0;
  let prevented = false;
  photo.element.dispatch('keydown', {key: 'Enter', target: photo.element, preventDefault() { prevented = true; }});
  story.dispatch('keydown', {key: 'Enter', target: photo.element, preventDefault() { prevented = true; }});
  assert.ok(prevented);assert.equal(focused.length, 1);assert.equal(focused[0], photo);
  content.setFocusedSurface(photo.kind);
  assert.equal(photo.zoomIn.disabled, true);assert.equal(photo.zoomOut.disabled, false);
  assert.equal(descriptors.story.zoomIn.disabled, false);assert.equal(descriptors.story.zoomOut.disabled, true,
    'the containing story keeps independent zoom state');
  content.setFocusedSurface('story');
  assert.equal(photo.zoomIn.disabled, false);assert.equal(photo.zoomOut.disabled, true);
  content.dispose();
});

test('scroll gestures, text selection, links, footer controls and native players do not trigger panel zoom', () => {
  const focused = [], {content} = createFlow({activeSlug: projects[0].slug, onFocusSurface: descriptor => focused.push(descriptor)});
  const descriptors = content.stationSurfaces.get(projects[0].slug), board = descriptors.story.element;
  board.dispatch('pointerdown', {pointerId: 1, clientX: 20, clientY: 40});
  board.dispatch('pointermove', {pointerId: 1, clientX: 21, clientY: 52});
  board.dispatch('click', {detail: 1});
  assert.equal(focused.length, 0, 'a swipe compatibility click cannot zoom the panel');
  board.dispatch('pointerdown', {pointerId: 2, clientX: 20, clientY: 40});
  board.dispatch('pointercancel', {pointerId: 2});
  board.dispatch('click', {detail: 1});
  assert.equal(focused.length, 0, 'native scrolling cancels panel activation');
  board.dispatch('click', {detail: 0});
  assert.equal(focused.at(-1), descriptors.story, 'keyboard-generated activation still works after a touch scroll');
  focused.length = 0;
  board.dispatch('pointerdown', {pointerId: 3, clientX: 20, clientY: 40});
  board.dispatch('pointermove', {pointerId: 3, clientX: 23, clientY: 42});
  board.dispatch('click', {detail: 1});
  assert.equal(focused.at(-1), descriptors.story, 'normal tap jitter stays tappable');
  focused.length = 0;
  const paragraph = board.querySelector('p'), selection = {isCollapsed: false,
    anchorNode: paragraph.children[0], toString: () => 'selected text'};
  window.getSelection = () => selection;
  try { board.dispatch('click', {target: paragraph, detail: 1}); }
  finally { delete window.getSelection; }
  assert.equal(focused.length, 0, 'selecting the authored prose remains native');
  for (const [slug, panels] of content.stationSurfaces) {
    content.setActiveSlug(slug);
    for (const descriptor of Object.values(panels)) {
      for (const target of descriptor.element.querySelectorAll('a,button,iframe,video')) {
        descriptor.element.dispatch('click', {target, detail: 1});
        assert.equal(focused.length, 0, `${slug}/${descriptor.kind}: native ${target.tagName} owns its interaction`);
      }
    }
  }
  content.dispose();
});

test('changing projects removes inactive boards and disconnects their native viewers, including during an approach', () => {
  const {container, content} = createFlow({activeSlug: projects[0].slug});
  const first = content.stationSurfaces.get(projects[0].slug), oldBoards = mountedBoards(container), oldPlayers = nativePlayers(container);
  const originalParents = new Map(oldBoards.map(board => [board, board.parentElement]));
  content.setFocusedSurface('media'); content.setActiveSlug(projects[1].slug);
  assert.ok(oldBoards.every(board => !container.contains(board) && board.inert));
  assert.ok(oldPlayers.every(player => !player.hasAttribute('src')));
  assert.ok(mountedBoards(container).every(board => board.dataset.gallerySlug === projects[1].slug));
  content.setActiveSlug(projects[0].slug);
  assert.equal(content.stationSurfaces.get(projects[0].slug).story.element, first.story.element, 'returning reuses the original authored story DOM');
  assert.deepEqual(mountedBoards(container), oldBoards, 'returning preserves every original board and authored order');
  for (const board of oldBoards) assert.equal(board.parentElement, originalParents.get(board), 'returning preserves inline versus trailing placement');
  assert.ok(oldPlayers.every(player => player.hasAttribute('src')));
  content.dispose(); assert.equal(nativePlayers(container).length, 0);
});

test('embedded providers activate explicitly without swallowing the page scroll or reloading their previews', () => {
  const {content} = createFlow();
  const entry = [...content.stationSurfaces].find(([, descriptors]) =>
    Object.values(descriptors).filter(descriptor => descriptor.type === 'media' && descriptor.element.querySelector('iframe')).length >= 2);
  assert.ok(entry, 'the fixture contains more than one interactive provider');
  const [slug, descriptors] = entry;
  content.setActiveSlug(slug);
  const providers = Object.values(descriptors).filter(descriptor => descriptor.type === 'media' && descriptor.element.querySelector('iframe'));
  const sources = new Map(providers.map(descriptor => {
    const iframe = descriptor.element.querySelector('iframe');
    assert.equal(iframe.inert, true, 'an unapproached provider must not capture keyboard focus');
    assert.equal(descriptor.approach.hidden, false, 'an unapproached provider has an explicit native activation affordance');
    return [iframe, {src: iframe.src, writes: iframe.srcWrites}];
  }));
  for (const descriptor of Object.values(descriptors).filter(descriptor => descriptor.approach && !descriptor.element.querySelector('iframe')))
    assert.equal(descriptor.approach.hidden, true, 'photographs and native videos never acquire an interception overlay');
  const chosen = providers[0];
  content.setFocusedSurface(chosen.kind);
  assert.equal(chosen.element.querySelector('iframe').inert, false, 'the approached provider becomes usable');
  assert.equal(chosen.approach.hidden, true);
  for (const other of providers.slice(1)) {
    assert.equal(other.element.querySelector('iframe').inert, true, 'the other embedded viewers remain gated');
    assert.equal(other.approach.hidden, false);
  }
  content.setFocusedSurface(null);
  for (const descriptor of providers) {
    const iframe = descriptor.element.querySelector('iframe');
    assert.equal(iframe.inert, true); assert.equal(descriptor.approach.hidden, false);
    assert.deepEqual({src: iframe.src, writes: iframe.srcWrites}, sources.get(iframe), 'activate/return keeps the same loaded provider URL');
  }
  content.dispose();
});
