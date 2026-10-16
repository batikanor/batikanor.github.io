import achievements from './data/achievements.json';
import {sortAchievementsNewestFirst, getChronologyState} from './chronology.js';
import {sortAchievementsByImportance} from './achievementImportance.js';
import {readPortfolioRoute, portfolioUrl} from './portfolioRoute.js';
import {createGalleryRoomContent} from './galleryRoomContent.js';
import {createGalleryRoomGlobe} from './galleryRoomGlobe.js';
import {createGalleryRoomPicker} from './galleryRoomPicker.js';
import {decorateBrandLink} from './brandLinks.js';
import {bindAchievementSummaryDownload} from './achievementSummaryDownload.js';
import './galleryRoomMobile.css';

const defaultOrder = sortAchievementsNewestFirst(achievements);
const bySlug = new Map(defaultOrder.map(project => [project.slug, project]));
const knownSlugs = new Set(bySlug.keys());
const node = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  return element;
};

/** The same project wall, arranged as one native reading scroll on a phone. */
export async function startGalleryMobile({deferActivation = false, onExploreRoom} = {}) {
  window.__galleryRoom?.dispose?.();
  let ordered = defaultOrder, sortMode = 'recent';
  let slug = readPortfolioRoute(location.href, knownSlugs).eventSlug ?? defaultOrder[0].slug;
  let active = !deferActivation, disposed = false, focusKind = null, focusOrigin = null;
  let readyFrame = 0, keyboardFrame = 0, frameCount = 0, globe = null, globeObserver = null, exploring = false;
  const projectScrolls = new Map();
  const abort = new AbortController(), signal = abort.signal;
  const reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedQuery.matches;
  const original = document.getElementById('app');
  document.documentElement.classList.remove('gallery-pending');
  if (active) document.documentElement.classList.remove('intro-active');
  document.body.classList.add('gallery-room-active');
  if (original) original.inert = true;

  const root = node('main', 'gallery-room gallery-room-mobile');root.id = 'gallery-room';
  root.inert = !active;root.dataset.presentation = 'flow';root.dataset.viewLocked = 'true';
  if (!active) root.classList.add('is-preparing');
  const flow = node('section', 'gallery-room-mobile-flow');flow.id = 'gallery-room-stage';flow.tabIndex = -1;
  flow.setAttribute('aria-label', 'Achievement gallery. Scroll to read the story, media and references.');
  const flowHost = node('div', 'gallery-room-mobile-content');flow.append(flowHost);

  const header = node('header', 'gallery-room-header');
  const brand = node('a', 'gallery-room-brand');brand.href = '/';
  brand.append(node('span', null, 'Batıkan'), node('span', 'portfolio-wordmark-accent', 'or'));
  brand.setAttribute('aria-label', 'Batıkanor — return to introduction');brand.title = 'Return to introduction';
  const identity = node('div', 'gallery-room-identity');
  identity.append(brand, node('span', 'gallery-room-tagline', 'Hacker · Developer · Entrepreneur'));
  const links = node('nav', 'gallery-room-links');links.setAttribute('aria-label', 'Gallery controls, contact and documents');
  const returnButton = node('button', 'gallery-room-return', '↶');returnButton.type = 'button';returnButton.hidden = true;
  returnButton.setAttribute('aria-label', 'Return to project overview');returnButton.title = 'Return to project overview';
  const cv = node('a', null, 'CV');cv.href = '/cv/';
  const summaryDownload = node('button', 'gallery-room-summary-download');summaryDownload.id = 'gallery-summary-download';summaryDownload.type = 'button';
  summaryDownload.setAttribute('aria-label', 'Download achievements summary (PDF)');summaryDownload.title = 'Download achievements summary (PDF)';
  const summaryIcon = node('span', 'gallery-room-download-icon', '↓');summaryIcon.setAttribute('aria-hidden', 'true');
  summaryDownload.append(summaryIcon, node('span', 'gallery-room-summary-label', 'Achievements'), node('span', 'gallery-room-summary-mobile-label', 'Summary'));
  const summaryStatus = node('p', 'gallery-room-export-status');summaryStatus.id = 'gallery-summary-status';summaryStatus.hidden = true;
  const email = node('a', null, 'Email');email.href = 'mailto:batikanor@gmail.com';email.setAttribute('aria-label', 'Email');decorateBrandLink(email, 'email');
  const linkedIn = node('a', null, 'LinkedIn');linkedIn.href = 'https://linkedin.com/in/batikanor';linkedIn.target = '_blank';linkedIn.rel = 'noopener noreferrer';
  linkedIn.setAttribute('aria-label', 'LinkedIn');decorateBrandLink(linkedIn, 'linkedin');
  const lockButton = node('button', 'gallery-room-view-lock');lockButton.id = 'gallery-view-lock';lockButton.type = 'button';
  lockButton.setAttribute('aria-pressed', 'true');lockButton.setAttribute('aria-label', 'Unlock to explore the 3D room');lockButton.title = 'Unlock to explore the 3D room';
  lockButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/></svg>';
  links.append(returnButton, cv, summaryDownload, email, linkedIn, lockButton);header.append(identity, links, summaryStatus);

  const dock = node('aside', 'gallery-room-dock gallery-room-mobile-map');dock.setAttribute('aria-label', 'Achievement location map');
  const globeMount = node('div', 'gallery-room-globe-mount');globeMount.id = 'gallery-room-globe';dock.append(globeMount);
  const chronology = node('nav', 'gallery-room-chronology gallery-room-mobile-chronology');
  chronology.setAttribute('aria-label', 'Achievements, more recent first');
  const previous = node('button', 'gallery-room-arrow', '←');previous.id = 'gallery-previous';previous.type = 'button';
  const picker = createGalleryRoomPicker({projects: ordered, onSelect: selectProject, onSortChange: setSortMode, document});
  const pickerPanel = picker.element.querySelector('.gallery-room-picker');
  const pickerSearch = picker.element.querySelector('.gallery-room-picker-search');
  const next = node('button', 'gallery-room-arrow', '→');next.id = 'gallery-next';next.type = 'button';
  chronology.append(previous, picker.element, next);
  const announce = node('p', 'gallery-room-live');announce.id = 'gallery-room-status';announce.setAttribute('role', 'status');announce.setAttribute('aria-live', 'polite');
  root.append(header, flow, chronology, announce);document.body.append(root);

  bindAchievementSummaryDownload(summaryDownload, {status: summaryStatus, signal});
  const content = createGalleryRoomContent({scene: {add() {}, remove() {}},
    stations: ordered.map((project, index) => ({slug: project.slug, index, x: 0})),
    activeSlug: slug, presentation: 'flow', container: flowHost, baseHref: location.href,
    onFocusSurface: focusSurface, onProjectLink: selectProject, onReturnToRoom: returnToRoom});
  // Keep the same live map immediately after each project's title.
  // Content replacement removes only its own boards, preserving the globe.
  placeMap();

  function currentSurface(kind = focusKind) { return content.stationSurfaces.get(slug)?.[kind]; }
  function placeMap() { currentSurface('title')?.element.after(dock); }
  function refreshVisualViewport() {
    if (disposed) return;
    const viewport = window.visualViewport;
    const scale = Number(viewport?.scale ?? 1);
    const unzoomed = Math.abs(scale - 1) < .02;
    const height = unzoomed ? Number(viewport?.height) || innerHeight : innerHeight;
    const searching = active && unzoomed && document.activeElement === pickerSearch && !pickerPanel.hidden;
    const keyboard = searching ? Math.max(0, innerHeight - height - (Number(viewport?.offsetTop) || 0)) : 0;
    root.style.setProperty('--gallery-mobile-visual-height', `${height}px`);
    root.style.setProperty('--gallery-mobile-keyboard', `${keyboard}px`);
  }
  // Safari keeps the layout viewport behind its keyboard. Only the open,
  // focused chooser follows that reduced visible height; page pinch zoom and
  // ordinary project reading retain their native position.
  const pickerObserver = typeof MutationObserver === 'function' ? new MutationObserver(refreshVisualViewport) : null;
  pickerObserver?.observe(pickerPanel, {attributes: true, attributeFilter: ['hidden']});
  document.addEventListener('focusin', refreshVisualViewport, {signal});
  document.addEventListener('focusout', () => {
    root.style.setProperty('--gallery-mobile-keyboard', '0px');
    cancelAnimationFrame(keyboardFrame);
    keyboardFrame = requestAnimationFrame(() => {keyboardFrame = 0;refreshVisualViewport();});
  }, {signal});
  function refreshNavigation() {
    const state = getChronologyState(ordered, slug), project = state.current;
    previous.disabled = !state.previous;next.disabled = !state.next;picker.setActive(slug);
    const before = sortMode === 'recent' ? 'newer' : 'more important', after = sortMode === 'recent' ? 'older' : 'less important';
    previous.setAttribute('aria-label', `Previous, ${before} achievement`);previous.title = `Previous, ${before} achievement · ←`;
    next.setAttribute('aria-label', `Next, ${after} achievement`);next.title = `Next, ${after} achievement · →`;
    chronology.setAttribute('aria-label', sortMode === 'recent' ? 'Achievements, more recent first' : 'Achievements, more important first');
    cv.href = '/cv/?event=' + encodeURIComponent(slug);
    root.dataset.activeSlug = slug;root.dataset.sort = sortMode;root.dataset.focus = focusKind ?? 'room';
    root.dataset.focusType = currentSurface()?.type ?? 'room';
    root.classList.toggle('has-focused-surface', !!focusKind);returnButton.hidden = !focusKind;
    announce.textContent = project.title + '. ' + [project.venue, project.city, project.country].filter(Boolean).join(', ') + '.';
  }
  function setScroll(top, {smooth = false} = {}) {
    const target = Math.max(0, Number(top) || 0);
    // An instant scroll also cancels a native smooth focus flight, so pressing
    // Return while it is moving cannot leave the reader between two cards.
    if (flow.scrollTo) {
      try {flow.scrollTo({top: target, behavior: smooth && !reducedMotion ? 'smooth' : 'instant'});}
      catch {flow.scrollTop = target;}
    } else flow.scrollTop = target;
  }
  function rememberScroll() {
    projectScrolls.set(slug, flow.scrollTop);
    history.replaceState({...history.state, galleryRoom: true, eventSlug: slug, galleryScrollTop: flow.scrollTop,
      galleryFocus: focusKind, galleryFocusOrigin: focusOrigin}, '', location.href);
  }
  function restoreFocus(options) {
    focusKind = options.history === false && options.focusKind !== 'title' && currentSurface(options.focusKind) ? options.focusKind : null;
    focusOrigin = focusKind ? Math.max(0, Number(options.focusOrigin) || 0) : null;
    content.setFocusedSurface?.(focusKind);
  }
  function focusSurface(descriptor) {
    if (!active || disposed || !descriptor || descriptor.slug !== slug || descriptor.type === 'title' || descriptor.kind === 'title') return;
    if (focusKind === descriptor.kind) return;
    if (focusOrigin === null) focusOrigin = flow.scrollTop;
    focusKind = descriptor.kind;content.setFocusedSurface?.(focusKind);refreshNavigation();
    const bounds = descriptor.element.getBoundingClientRect(), parentBounds = flow.getBoundingClientRect();
    const headerBounds = header.getBoundingClientRect();
    const safeTop = Math.max(headerBounds.bottom, headerBounds.top + 62) + 12;
    setScroll(flow.scrollTop + bounds.top - Math.max(parentBounds.top, safeTop), {smooth: true});
  }
  function returnToRoom() {
    if (!active || disposed || focusKind === null) return;
    const origin = focusOrigin ?? flow.scrollTop;
    focusKind = null;focusOrigin = null;content.setFocusedSurface?.(null);refreshNavigation();setScroll(origin);
  }
  function selectProject(nextSlug, options = {}) {
    if (!active || disposed || !bySlug.has(nextSlug)) return;
    picker.close();refreshVisualViewport();
    if (nextSlug === slug) {
      globe?.setActive(slug, {recenter: true});
      if (options.history === false) {
        restoreFocus(options);refreshNavigation();
        setScroll(options.scrollTop ?? projectScrolls.get(slug) ?? 0);
      }
      return;
    }
    if (options.history !== false) rememberScroll();else projectScrolls.set(slug, flow.scrollTop);
    slug = nextSlug;focusKind = null;focusOrigin = null;
    content.setActiveSlug(slug);restoreFocus(options);placeMap();
    globe?.setActive(slug);refreshNavigation();
    const top = options.history === false ? options.scrollTop ?? projectScrolls.get(slug) ?? 0 : 0;
    if (options.history !== false) history.pushState({galleryRoom: true, eventSlug: slug, galleryScrollTop: top}, '', portfolioUrl(location.href, {eventSlug: slug}));
    setScroll(top);
  }
  function setSortMode(mode) {
    if (!active || disposed || !['recent', 'importance'].includes(mode) || mode === sortMode) return;
    ordered = mode === 'importance' ? sortAchievementsByImportance(defaultOrder) : defaultOrder;sortMode = mode;
    picker.setProjects(ordered);picker.setSortMode(mode);refreshNavigation();
  }
  function ensureGlobe() {
    if (!active || disposed || globe) return;
    globeObserver?.disconnect();globeObserver = null;
    globe = createGalleryRoomGlobe({container: globeMount, achievements: ordered, onSelect: selectProject, initialSlug: slug});
  }
  function prepareGlobe() {
    if (!active || disposed || globe || globeObserver) return;
    if (typeof IntersectionObserver === 'function') {
      globeObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) ensureGlobe();
      }, {root: flow, rootMargin: '160px 0px'});
      globeObserver.observe(globeMount);
    } else ensureGlobe();
  }
  async function setViewLocked(locked) {
    if (!active || disposed || locked || exploring || !onExploreRoom) return;
    exploring = true;lockButton.disabled = true;root.classList.add('is-opening-room');
    try { await onExploreRoom({eventSlug: slug, sortMode}); }
    catch (error) {
      if (!disposed) announce.textContent = 'The 3D room could not open. You can continue reading this project.';
      console.error('The optional 3D room could not open.', error);
    } finally {
      if (!disposed) {exploring = false;lockButton.disabled = false;root.classList.remove('is-opening-room');}
    }
  }
  function step(direction) { const project = getChronologyState(ordered, slug)[direction];if (project) selectProject(project.slug); }
  previous.addEventListener('click', () => step('previous'), {signal});next.addEventListener('click', () => step('next'), {signal});
  returnButton.addEventListener('click', returnToRoom, {signal});lockButton.addEventListener('click', () => setViewLocked(false), {signal});
  addEventListener('popstate', event => {
    if (!active || disposed) return;
    const nextSlug = readPortfolioRoute(location.href, knownSlugs).eventSlug ?? defaultOrder[0].slug;
    selectProject(nextSlug, {history: false, scrollTop: event.state?.galleryScrollTop ?? projectScrolls.get(nextSlug) ?? 0,
      focusKind: event.state?.galleryFocus, focusOrigin: event.state?.galleryFocusOrigin});
  }, {signal});
  addEventListener('keydown', event => {
    if (!active || disposed || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' && focusKind) {event.preventDefault();returnToRoom();return;}
    if (event.target instanceof Element && event.target.closest('button,a,input,select,textarea,iframe,video,[contenteditable]')) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {event.preventDefault();step(event.key === 'ArrowLeft' ? 'previous' : 'next');}
  }, {signal});
  reducedQuery.addEventListener('change', event => {reducedMotion = event.matches;}, {signal});
  addEventListener('resize', () => {refreshVisualViewport();if (active) globe?.resize();}, {signal});
  // Browser chrome and orientation changes preserve the reader's current
  // scroll position. No camera fit or focus animation is restarted on resize.
  window.visualViewport?.addEventListener('resize', () => {refreshVisualViewport();if (active) globe?.resize();}, {signal});
  window.visualViewport?.addEventListener('scroll', refreshVisualViewport, {signal});

  function activate({eventSlug} = {}) {
    if (disposed || active) return;
    if (bySlug.has(eventSlug)) {slug = eventSlug;content.setActiveSlug(slug);placeMap();}
    active = true;root.inert = false;root.classList.remove('is-preparing');
    document.documentElement.classList.remove('intro-active');if (original) original.inert = true;
    refreshNavigation();prepareGlobe();setScroll(0);flow.focus({preventScroll: true});refreshVisualViewport();
  }
  function ready() {
    readyFrame = 0;if (disposed) return;
    frameCount++;root.dataset.frameCount = String(frameCount);
    if (frameCount < 2) readyFrame = requestAnimationFrame(ready);
    else {root.classList.add('is-ready');dispatchEvent(new Event('gallery-room-ready'));}
  }
  function dispose() {
    if (disposed) return;
    disposed = true;active = false;abort.abort();cancelAnimationFrame(readyFrame);cancelAnimationFrame(keyboardFrame);
    globeObserver?.disconnect();globeObserver = null;pickerObserver?.disconnect();picker.dispose();content.dispose();globe?.dispose();
    root.style.removeProperty('--gallery-mobile-keyboard');root.style.removeProperty('--gallery-mobile-visual-height');root.remove();
    document.body.classList.remove('gallery-room-active');if (original) original.inert = false;
    if (window.__galleryRoom?.root === root) delete window.__galleryRoom;
  }
  const api = {root, flow, content, get globe() { return globe; }, activate, dispose, selectProject, setSortMode, setViewLocked, focusSurface, returnToRoom,
    getStats: () => ({presentation: 'flow', active, viewLocked: true, sortMode, projectOrder: ordered.map(project => project.slug),
      activeSlug: slug, pendingSlug: null, focusKind, focusOrigin, scrollTop: flow.scrollTop, transitioning: exploring, frameCount,
      viewport: {width: innerWidth, height: innerHeight}, globe: globe?.getStats?.() ?? null, render: {calls: 0, triangles: 0}, disposed})};
  window.__galleryRoom = api;
  addEventListener('pagehide', event => {if (active && !disposed && event.persisted) rememberScroll();else if (!event.persisted) dispose();}, {signal});
  refreshNavigation();prepareGlobe();refreshVisualViewport();readyFrame = requestAnimationFrame(ready);
  if (active) flow.focus({preventScroll: true});
  return api;
}
