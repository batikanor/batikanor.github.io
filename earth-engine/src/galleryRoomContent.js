import {CSS3DObject} from 'three/addons/renderers/CSS3DRenderer.js';
import {getProject, projectHref} from './projectContent.js';
import {galleryStationComponents, galleryStationMedia, galleryStationLinks} from './galleryRoomLayout.js';
import {roomCameraFov, surfaceCameraPlan} from './galleryRoomCamera.js';
import './galleryRoomContent.css';

export {galleryStationMedia, galleryStationLinks} from './galleryRoomLayout.js';

const placeholder = /\{\{(image|embed|gdrive_embed)\[(\d+)\]\}\}/g;
const imageExtension = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i;
const videoExtension = /\.(?:mp4|webm|ogv|ogg|mov)(?:[?#].*)?$/i;
// These four obsolete placement cues belong only to the old inline-media
// presentation. Keep the source records and every other authored word intact.
const storyPlacementCopy = new Map([
  ['huawei-agorize-2024', ['In case you are interested in our method, feel free to check out the slides attached below.', '']],
  ['sui-hackathon-poland-2025', [' Here I am with it.', '']],
  ['hackupc-2024', ['the video I embedded below', 'the video']],
  ['circular-bsh-2024', [' See the slide deck for more details.', '']],
]);

/** Keep approached reading text legible when the viewport limits board size. */
export function galleryStoryCanvasWidth(surface, viewport = {}) {
  const width = typeof viewport === 'number' ? viewport : viewport.width;
  const compact = width <= 600;
  const tablet = width <= 900;
  const preferred = compact ? 360 : tablet ? 680 : 960;
  const height = typeof viewport === 'number' ? null : viewport.height;
  if (![width, height, surface?.worldWidth, surface?.worldHeight].every(value => Number.isFinite(value) && value > 0)) return preferred;
  const fov = roomCameraFov(width);
  const plan = surfaceCameraPlan({...surface, position: surface.position ?? [0, 0, 0]}, viewport, fov);
  const displayedWidth = surface.worldWidth * height / (2 * Math.tan(fov * Math.PI / 360) * plan.distance);
  const phone = width < 700;
  const bodySize = phone ? 11.5 : tablet ? 18 : 19, minimumDisplayedSize = phone ? 11 : tablet ? 16 : 17;
  // Larger windows reveal more writing without inflating approached text.
  const capacity = phone ? Math.max(preferred, Math.ceil(displayedWidth))
    : tablet ? preferred : Math.max(preferred, Math.ceil(displayedWidth * bodySize / 22));
  return Math.max(1, Math.min(capacity, Math.floor(displayedWidth * bodySize / minimumDisplayedSize)));
}

function node(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text != null) result.textContent = text;
  return result;
}

/** Only real viewers are embedded. An unsupported source retains its original link. */
export function galleryMediaPreview(rawUrl, baseHref = 'https://batikanor.com/') {
  let url;
  try { url = new URL(rawUrl, baseHref); } catch { return null; }
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (imageExtension.test(url.href)) return {kind: 'image', url: rawUrl};
  if (videoExtension.test(url.href)) return {kind: 'video', url: rawUrl};
  const drive = /^\/file\/d\/([-\w]+)/.exec(url.pathname);
  if (url.hostname === 'drive.google.com' && drive) {
    return {kind: 'iframe', url: `https://drive.google.com/file/d/${drive[1]}/preview`, provider: 'Google Drive'};
  }
  const slides = /^\/presentation\/d\/([-\w]+)/.exec(url.pathname);
  if (url.hostname === 'docs.google.com' && slides) {
    return {kind: 'iframe', url: `https://docs.google.com/presentation/d/${slides[1]}/embed?start=false&loop=false&delayms=3000`, provider: 'Google Slides'};
  }
  const doc = /^\/document\/d\/([-\w]+)/.exec(url.pathname);
  if (url.hostname === 'docs.google.com' && doc) {
    return {kind: 'iframe', url: `https://docs.google.com/document/d/${doc[1]}/preview`, provider: 'Google Docs'};
  }
  const youtube = ['www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'youtube-nocookie.com'].includes(url.hostname);
  const videoId = youtube ? /^\/embed\/([-\w]+)/.exec(url.pathname)?.[1] || url.searchParams.get('v') : url.hostname === 'youtu.be' ? url.pathname.slice(1) : null;
  if (videoId && /^[-\w]+$/.test(videoId)) return {kind: 'iframe', url: `https://www.youtube-nocookie.com/embed/${videoId}`, provider: 'YouTube'};
  if (url.hostname === 'player.vimeo.com' && /^\/video\/\d+/.test(url.pathname)) return {kind: 'iframe', url: url.href, provider: 'Vimeo'};
  if (/\.pdf(?:[?#].*)?$/i.test(url.href)) return {kind: 'iframe', url: rawUrl, provider: 'PDF'};
  return {kind: 'link', url: rawUrl};
}

function appendLink(parent, label, rawHref, options) {
  const href = projectHref(rawHref, options.baseHref);
  if (!href) { parent.append(document.createTextNode(label)); return; }
  const link = node('a', 'gallery-room-link', label);
  link.href = href;
  const destination = new URL(href, options.baseHref);
  const internalSlug = destination.origin === new URL(options.baseHref).origin ? destination.searchParams.get('event') : null;
  if (internalSlug && getProject(internalSlug) && options.onProjectLink) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      event.preventDefault();
      options.onProjectLink(internalSlug);
    });
  } else {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  parent.append(link);
  return link;
}

// This is the original story renderer's safe Markdown subset, with media lifecycle
// owned by each station rather than the map panel's singleton observer.
function inline(parent, text, options) {
  const tokens = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let previous = 0;
  for (const match of text.matchAll(tokens)) {
    if (match.index > previous) parent.append(document.createTextNode(text.slice(previous, match.index)));
    if (match[1] != null || match[2] != null) {
      const child = node(match[1] != null ? 'strong' : 'em');
      inline(child, match[1] ?? match[2], options);
      parent.append(child);
    } else appendLink(parent, match[3], match[4], options);
    previous = match.index + match[0].length;
  }
  if (previous < text.length) parent.append(document.createTextNode(text.slice(previous)));
}

function textBlocks(parent, text, options) {
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    const heading = /^\*\*(.+)\*\*$/.exec(line.trim());
    const bullet = /^-\s+(.+)$/.exec(line.trim());
    const block = node(heading ? 'h3' : 'p', heading ? 'gallery-room-story-heading' : bullet ? 'gallery-room-story-bullet' : 'gallery-room-story-paragraph');
    inline(block, heading ? heading[1] : line, options);
    parent.append(block);
  }
}

function control(label, action, className = '') {
  const button = node('button', `gallery-room-control ${className}`.trim(), label);
  button.type = 'button';
  button.addEventListener('click', action);
  return button;
}

function symbolControl(symbol, label, action, className = '') {
  const button = control(symbol, action, `gallery-room-symbol ${className}`.trim());
  button.setAttribute('aria-label', label);
  button.title = label;
  return button;
}

function sourceLink(parent, media, options) {
  return appendLink(parent, 'Open original ↗', media.url, options);
}

function makePreview(media, project, options, photo = null) {
  let spec = null;
  if (photo) {
    // Verified image metadata can point at extensionless Google photo sources.
    // The metadata owns the media type; URL protocols still pass validation.
    const safeSource = raw => {
      try { return ['http:', 'https:'].includes(new URL(raw, options.baseHref).protocol) ? raw : null; }
      catch { return null; }
    };
    const original = safeSource(photo.src);
    const preferred = safeSource(photo.displaySrc ?? photo.src) ?? original;
    if (preferred) spec = {kind: 'image', url: preferred, fallbackUrl: original !== preferred ? original : null};
  } else spec = galleryMediaPreview(media.url, options.baseHref);
  const stage = node('div', 'gallery-room-media-viewport');
  const status = node('p', 'gallery-room-media-status');
  status.setAttribute('role', 'status');
  const title = media.abovePhotoCaption || `${project.title} — media ${media.index + 1}`;
  let preview = null;
  let connected = false;
  let imageFallbackAttempted = false;
  let timeout = null;
  if (spec?.kind === 'image') {
    preview = node('img', 'gallery-room-photo');
    preview.alt = title;
    preview.decoding = 'async';
    if (photo) { preview.width = photo.width; preview.height = photo.height; }
    preview.addEventListener('load', () => { if (connected) status.textContent = ''; });
    preview.addEventListener('error', () => {
      if (!connected) return;
      if (spec.fallbackUrl && !imageFallbackAttempted) {
        imageFallbackAttempted = true;
        status.textContent = 'Loading original photo…';
        preview.src = spec.fallbackUrl;
        return;
      }
      status.textContent = 'This image could not be loaded. Open the original below.';
    });
  } else if (spec?.kind === 'video') {
    preview = node('video', 'gallery-room-native-video');
    preview.controls = true;
    preview.playsInline = true;
    preview.preload = 'metadata';
    preview.setAttribute('aria-label', title);
    preview.addEventListener('loadedmetadata', () => { if (connected) status.textContent = ''; });
    preview.addEventListener('error', () => { if (connected) status.textContent = 'The browser could not play this source. Open the original below.'; });
  } else if (spec?.kind === 'iframe') {
    preview = node('iframe', 'gallery-room-native-frame');
    preview.title = title;
    preview.allow = 'accelerometer; encrypted-media; gyroscope; picture-in-picture; clipboard-write';
    preview.referrerPolicy = 'strict-origin-when-cross-origin';
    // Viewer controls remain on this physical screen. No modal/fullscreen surface.
    preview.addEventListener('load', () => {
      if (!connected) return;
      clearTimeout(timeout);
      // A load event confirms navigation, not successful cross-origin playback.
      // Keep the source link available without placing provider copy over controls.
      status.textContent = '';
    });
    preview.addEventListener('error', () => {
      if (connected) status.textContent = `${spec.provider} could not be loaded. Open the original below.`;
    });
  }
  if (preview) stage.append(preview);
  else {
    stage.classList.add('gallery-room-link-only');
    stage.append(node('p', null, 'This source is available at its original location.'));
    sourceLink(stage, media, options);
  }
  return {
    stage, status, preview, isStatic: spec?.kind === 'image',
    connect() {
      if (connected || !preview) return;
      connected = true;
      imageFallbackAttempted = false;
      status.textContent = spec.kind === 'iframe' ? `Opening ${spec.provider} preview…` : spec.kind === 'image' ? 'Loading original photo…' : 'Loading original video…';
      preview.src = spec.url;
      if (spec.kind === 'iframe') timeout = setTimeout(() => {
        if (connected) status.textContent = 'The provider may be slow or may block embedding. Open the original below.';
      }, 12000);
    },
    disconnect() {
      if (!connected) return;
      connected = false;
      imageFallbackAttempted = false;
      clearTimeout(timeout);
      if (!preview) return;
      if (spec.kind === 'video') preview.pause();
      // Navigating a cross-origin frame to blank stops its native player too.
      if (spec.kind === 'iframe' && preview.hasAttribute('src')) preview.src = 'about:blank';
      preview.removeAttribute('src');
      if (spec.kind === 'video') preview.load();
      status.textContent = '';
    }
  };
}

function nextObject(station, descriptor, options) {
  const objects = Object.values(station.descriptors).filter(item => ['story', 'media', 'references'].includes(item.type));
  const index = objects.indexOf(descriptor);
  const next = objects[(index + 1) % objects.length];
  if (next && next !== descriptor) options.onFocusSurface?.(next);
}

function boardControls(station, descriptor, options) {
  const footer = node('footer', 'gallery-room-board-controls');
  if (Object.values(station.descriptors).filter(item => item.type !== 'title').length > 1) {
    footer.append(symbolControl('→', 'Next object', () => nextObject(station, descriptor, options)));
  }
  footer.append(symbolControl('↶', 'Return to room', () => options.onReturnToRoom?.()));
  return footer;
}

function storyContents(host, project, station, options) {
  const placementCopy = storyPlacementCopy.get(project.slug);
  const description = placementCopy ? (project.longDescription || '').replace(...placementCopy) : project.longDescription || '';
  const scroll = node('div', 'gallery-room-story-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('aria-label', `Full story: ${project.title}`);
  scroll.append(node('h2', 'gallery-room-story-title', project.title));
  if (project.shortDescription) {
    const summary = node('section', 'gallery-room-summary');
    summary.append(node('h3', null, 'Summary'), node('p', null, project.shortDescription));
    scroll.append(summary);
  }
  // Media already occupies its original wall screen. Skip only its placement
  // token, retaining the surrounding authored blocks and genuine inline links.
  let previous = 0;
  for (const match of description.matchAll(placeholder)) {
    textBlocks(scroll, description.slice(previous, match.index), options);
    previous = match.index + match[0].length;
  }
  textBlocks(scroll, description.slice(previous), options);
  host.append(scroll, boardControls(station, station.descriptors.story, options));
}

function monitorContents(host, project, station, descriptor, options) {
  const media = descriptor.media;
  const mediaIndex = station.media.findIndex(item => item.key === media.key);
  const header = node('header', 'gallery-room-screen-header');
  const caption = node('h2', 'gallery-room-screen-caption', media.abovePhotoCaption || `${project.title} — original media ${mediaIndex + 1}`);
  caption.tabIndex = 0;
  header.append(caption);
  const viewport = node('div', 'gallery-room-screen-content');
  const preview = makePreview(media, project, options);
  const approach = node('div', 'gallery-room-screen-approach');
  approach.append(symbolControl('⤢', 'Approach screen', () => options.onFocusSurface?.(descriptor)));
  preview.stage.append(approach);
  descriptor.approach = approach;
  viewport.append(preview.stage, preview.status);
  station.previews.set(descriptor.kind, preview);
  const controls = node('footer', 'gallery-room-screen-controls');
  const actions = node('div', 'gallery-room-screen-actions');
  actions.append(symbolControl('→', 'Next object', () => nextObject(station, descriptor, options)), symbolControl('↶', 'Return to room', () => options.onReturnToRoom?.(), 'gallery-room-screen-return'));
  sourceLink(actions, media, options);
  controls.append(actions);
  if (media.credit) {
    const credit = node('p', 'gallery-room-credit', media.credit);
    credit.tabIndex = 0;
    controls.append(credit);
  }
  host.append(header, viewport, controls);
}

function photoContents(host, project, station, descriptor, options) {
  const {media, photo} = descriptor;
  host.classList.add('gallery-room-photo-board');
  host.dataset.photoWidth = photo.width;
  host.dataset.photoHeight = photo.height;
  const preview = makePreview(media, project, options, photo);
  const approach = node('div', 'gallery-room-screen-approach');
  approach.append(symbolControl('⤢', 'Approach screen', () => options.onFocusSurface?.(descriptor)));
  preview.stage.append(preview.status, approach);
  descriptor.approach = approach;
  station.previews.set(descriptor.kind, preview);

  const caption = node('header', 'gallery-room-photo-caption');
  caption.tabIndex = 0;
  caption.setAttribute('aria-label', 'Photo caption and credit');
  caption.append(node('h2', 'gallery-room-photo-caption-title', media.abovePhotoCaption || `${project.title} — photo ${media.index + 1}`));
  if (media.credit) caption.append(node('p', 'gallery-room-photo-credit', media.credit));
  const controls = node('footer', 'gallery-room-screen-controls');
  const actions = node('div', 'gallery-room-screen-actions');
  actions.append(symbolControl('→', 'Next object', () => nextObject(station, descriptor, options)), symbolControl('↶', 'Return to room', () => options.onReturnToRoom?.(), 'gallery-room-screen-return'));
  sourceLink(actions, media, options);
  controls.append(actions);
  host.append(preview.stage, caption, controls);
}

function referencesContents(host, station, descriptor, options) {
  const header = node('header', 'gallery-room-references-header');
  header.append(node('h2', null, 'References'), node('span', 'gallery-room-references-count', String(station.links.length)));
  const list = node('ul', 'gallery-room-references-list');
  list.tabIndex = 0;
  list.setAttribute('aria-label', 'Project references');
  for (const resource of station.links) {
    const item = node('li');
    const link = appendLink(item, resource.label, resource.url, options);
    if (link) {
      link.classList.add('gallery-room-reference-link');
      link.title = link.href;
      const destination = new URL(link.href, options.baseHref);
      const source = destination.hostname.replace(/^www\./, '') || destination.protocol.replace(':', '');
      link.setAttribute('aria-label', `${resource.label} (${source})`);
      const arrow = node('span', 'gallery-room-reference-arrow', '↗');
      arrow.setAttribute('aria-hidden', 'true');
      link.append(arrow);
    }
    list.append(item);
  }
  host.append(header, list, boardControls(station, descriptor, options));
}

function stationComponents(station, project) {
  if (station.components?.length) return station.components;
  const components = galleryStationComponents(project);
  const x = Number(station.x ?? station.anchor?.[0] ?? station.position?.[0] ?? 0);
  return components.map(component => {
    const provided = (station.surfaces || station.contentSurfaces)?.[component.id];
    return provided ? {...component, ...provided} : {...component, position: [component.position[0] + x, ...component.position.slice(1)]};
  });
}

/** One physical board per story, media source or resource; native viewers stay on their own screens. */
export function createGalleryRoomContent({scene, stations = [], activeSlug, baseHref, onFocusSurface, onProjectLink, onReturnToRoom} = {}) {
  if (!scene?.add) throw new TypeError('A CSS3D scene is required');
  const stationList = stations instanceof Map ? [...stations.values()] : [...stations];
  const options = {baseHref: baseHref ?? window.location.href, onFocusSurface, onProjectLink, onReturnToRoom};
  const surfaces = [];
  const stationSurfaces = new Map();
  const states = new Map();
  let disposed = false;
  let currentSlug = null;
  let explicitVisibleSlugs = null;
  let lastViewport = {};
  for (const station of stationList) {
    const project = getProject(station.slug);
    if (!project) continue;
    const state = {station, project, media: galleryStationMedia(project), links: galleryStationLinks(project), active: false, visible: false, focused: null, descriptors: {}, previews: new Map()};
    states.set(project.slug, state);
    for (const pose of stationComponents(station, project)) {
      const kind = pose.id;
      const type = pose.kind;
      const element = node(type === 'title' ? 'header' : 'article', `gallery-room-surface gallery-room-${type === 'link' ? 'resource' : type}`);
      element.dataset.gallerySurface = kind;
      element.dataset.galleryType = type;
      element.dataset.gallerySlug = project.slug;
      element.setAttribute('aria-label', `${project.title} — ${type === 'media' ? `${pose.media?.abovePhotoCaption || kind} media screen` : type === 'story' ? 'full story board' : type === 'references' ? 'references' : 'title board'}`);
      element.tabIndex = 0;
      const object = new CSS3DObject(element);
      object.name = `gallery-${project.slug}-${kind}`;
      object.position.fromArray(pose.position);
      object.rotation.set(...(pose.rotation || [0, 0, 0]));
      object.visible = false;
      const descriptor = {slug: project.slug, kind, type, media: pose.media, photo: pose.photo, links: pose.links, pixelRect: pose.pixelRect, framePadding: pose.framePadding, object, element, position: [...pose.position], rotation: [...(pose.rotation || [0, 0, 0])], width: pose.width, height: pose.height, originalWidth: pose.width, originalHeight: pose.height, worldWidth: pose.worldWidth, worldHeight: pose.worldHeight ?? pose.worldWidth * pose.height / pose.width};
      object.userData.gallerySlug = project.slug;
      object.userData.gallerySurface = kind;
      object.userData.surface = descriptor;
      state.descriptors[kind] = descriptor;
      surfaces.push(object);
      scene.add(object);
      element.addEventListener('click', event => {
        if (event.target.closest('a,button,iframe,video,input,select,textarea')) return;
        onFocusSurface?.(descriptor);
      });
      element.addEventListener('keydown', event => {
        if (event.target !== element || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault();
        onFocusSurface?.(descriptor);
      });
      if (type === 'title') {
        if (project.title.length > 90) element.classList.add('has-long-title');
        const titleContent = node('div', 'gallery-room-title-content');
        titleContent.tabIndex = 0;
        const text = node('div', 'gallery-room-title-copy');
        text.append(node('h1', null, project.title));
        titleContent.append(text);
        if (project.technologies?.length) {
          const list = node('ul', 'gallery-room-technologies');
          list.setAttribute('aria-label', 'Technologies and topics');
          for (const technology of project.technologies) list.append(node('li', null, technology));
          titleContent.append(list);
        }
        element.append(titleContent);
      }
    }
    storyContents(state.descriptors.story.element, project, state, options);
    for (const descriptor of Object.values(state.descriptors)) {
      if (descriptor.type === 'media') (descriptor.photo ? photoContents : monitorContents)(descriptor.element, project, state, descriptor, options);
      if (descriptor.type === 'references') referencesContents(descriptor.element, state, descriptor, options);
    }
    stationSurfaces.set(project.slug, state.descriptors);
  }
  function connectFocusedPreview(state) {
    for (const [id, preview] of state.previews) {
      state.descriptors[id].approach.hidden = state.active && id === state.focused;
      // Adjacent walls retain their photographs and readable boards. Native
      // players belong only to the active wall and its current reading approach.
      if (state.visible && (preview.isStatic || state.active && (!state.focused || id === state.focused))) preview.connect();
      else preview.disconnect();
    }
  }
  function clearFocus(state) {
    const focused = state.focused != null;
    state.focused = null;
    for (const descriptor of Object.values(state.descriptors)) descriptor.element.classList.remove('is-focused');
    return focused;
  }
  function stop(state) {
    state.active = false;
    state.visible = false;
    clearFocus(state);
    for (const preview of state.previews.values()) preview.disconnect();
    for (const descriptor of Object.values(state.descriptors)) {
      descriptor.object.visible = false;
      descriptor.element.inert = true;
      descriptor.element.setAttribute('aria-hidden', 'true');
      descriptor.element.remove();
    }
  }
  function start(state) {
    state.visible = true;
    for (const descriptor of Object.values(state.descriptors)) {
      descriptor.object.visible = true;
      descriptor.element.inert = false;
      descriptor.element.removeAttribute('aria-hidden');
    }
    connectFocusedPreview(state);
  }
  function refreshVisibility() {
    for (const [slug, state] of states) {
      state.active = slug === currentSlug;
      if (state.active || explicitVisibleSlugs?.has(slug)) start(state);
      else stop(state);
    }
  }
  /** Keep an explicit neighbor window across active-project changes; null restores one wall. */
  function setVisibleSlugs(slugs) {
    if (disposed) return;
    explicitVisibleSlugs = slugs == null ? null
      : new Set((typeof slugs === 'string' ? [slugs] : [...slugs]).filter(slug => states.has(slug)));
    refreshVisibility();
  }
  function setActiveSlug(slug) {
    if (disposed || slug === currentSlug) return;
    let resized = false;
    for (const state of states.values()) resized = clearFocus(state) || resized;
    currentSlug = states.has(slug) ? slug : null;
    refreshVisibility();
    if (resized) resize(lastViewport);
  }
  function setFocusedSurface(id) {
    const state = states.get(currentSlug);
    if (disposed || !state) return;
    state.focused = state.descriptors[id] ? id : null;
    for (const descriptor of Object.values(state.descriptors)) descriptor.element.classList.toggle('is-focused', descriptor.kind === state.focused);
    connectFocusedPreview(state);
    resize(lastViewport);
  }
  function resize(viewport = {}) {
    lastViewport = viewport;
    const viewportWidth = typeof viewport === 'number' ? viewport : viewport.width ?? window.innerWidth;
    const compact = viewportWidth <= 600;
    const tablet = viewportWidth <= 900;
    const widths = compact ? {title: 900, media: 400, references: 360} : tablet ? {title: 1120, media: 560, references: 520} : {title: 1280, media: 640, references: 640};
    const readingViewport = typeof viewport === 'number' ? viewport : {...viewport, width: viewportWidth};
    for (const state of states.values()) {
      const poses = new Map(stationComponents(state.station, state.project).map(pose => [pose.id, pose]));
      for (const descriptor of Object.values(state.descriptors)) {
        const pose = poses.get(descriptor.kind);
        if (pose) {
          Object.assign(descriptor, {photo: pose.photo, titleLayout: pose.titleLayout, pixelRect: pose.pixelRect, framePadding: pose.framePadding, originalWidth: pose.width,
            originalHeight: pose.height, worldWidth: pose.worldWidth,
            worldHeight: pose.worldHeight ?? pose.worldWidth * pose.height / pose.width,
            position: [...pose.position], rotation: [...pose.rotation]});
          descriptor.object.position.fromArray(descriptor.position);
          descriptor.object.rotation.set(...descriptor.rotation);
        }
        const wall = !!state.station.wallLayout;
        const focused = descriptor.kind === state.focused;
        const photoDensity = compact ? 80 : tablet ? 92 : 100;
        descriptor.width = wall && !focused ? descriptor.originalWidth
          : descriptor.photo && !wall ? descriptor.worldWidth * photoDensity
          : descriptor.type === 'story' ? galleryStoryCanvasWidth(descriptor, readingViewport)
          : widths[descriptor.type] ?? descriptor.originalWidth;
        if (wall && focused && descriptor.type !== 'story' && descriptor.type !== 'title' && Number.isFinite(readingViewport.height)) {
          const fov = roomCameraFov(viewportWidth), plan = surfaceCameraPlan(descriptor, readingViewport, fov);
          descriptor.width = descriptor.worldWidth * readingViewport.height /
            (2 * Math.tan(fov * Math.PI / 360) * plan.distance);
        }
        descriptor.height = descriptor.width * descriptor.worldHeight / descriptor.worldWidth;
        if (descriptor.photo) {
          const density = descriptor.width / descriptor.worldWidth;
          descriptor.element.style.setProperty('--photo-height', `${descriptor.photo.worldHeight * density}px`);
          descriptor.element.style.setProperty('--photo-caption-height', `${descriptor.photo.captionWorldHeight * density}px`);
          descriptor.element.style.setProperty('--photo-controls-height', `${descriptor.photo.controlsWorldHeight * density}px`);
          const chromeScale = Math.min(focused ? 1 : .8,
            descriptor.photo.controlsWorldHeight * density / 40,
            descriptor.photo.captionWorldHeight * density / (descriptor.media.credit ? 55 : 36));
          descriptor.element.style.setProperty('--photo-ui-scale', String(wall ? chromeScale : photoDensity / 100));
        }
        descriptor.element.style.width = `${descriptor.width}px`;
        descriptor.element.style.height = `${descriptor.height}px`;
        descriptor.element.classList.toggle('is-compact', compact);
        descriptor.element.classList.toggle('is-tablet', !compact && tablet);
        descriptor.element.classList.toggle('is-wall-panel', wall);
        descriptor.element.classList.toggle('is-narrow', descriptor.width < 260);
        if (descriptor.type === 'title') {
          descriptor.element.classList.toggle('has-stacked-technologies', wall ? descriptor.titleLayout?.technologiesStacked : viewportWidth < 700);
          descriptor.element.style.setProperty('--title-technologies-width', `${wall ? descriptor.titleLayout?.technologiesWidth ?? 280 : Math.min(280, descriptor.width * .28)}px`);
        }
        descriptor.object.scale.setScalar(descriptor.worldWidth / descriptor.width);
      }
    }
  }
  for (const state of states.values()) stop(state);
  resize();
  setActiveSlug(activeSlug ?? stationList[0]?.slug);
  return {
    surfaces, stationSurfaces, setActiveSlug, setActive: setActiveSlug, setVisibleSlugs, setFocusedSurface, resize,
    get activeSlug() { return currentSlug; },
    get visibleSlugs() { return new Set([...states].filter(([, state]) => state.visible).map(([slug]) => slug)); },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const state of states.values()) stop(state);
      for (const object of surfaces) scene.remove(object);
      states.clear();
      stationSurfaces.clear();
    }
  };
}
