import { LIVE_PROJECTS, adjacentLiveProject, liveProjectIndex, liveProjectUrl } from './liveProjectsData.js';
import { decorateBrandLink } from './brandLinks.js';
import './liveProjects.css';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function projectBrand(item) {
  const brand = el('span', 'live-projects-tab-brand');
  brand.setAttribute('aria-hidden', 'true');
  if (item.id === 'gralobe') {
    brand.append(el('span', 'live-projects-tab-wordmark', 'gralobe'));
  } else if (item.id === 'cottbus') {
    const svg = (tag, attributes) => {
      const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
      return node;
    };
    const mark = svg('svg', { class: 'live-projects-tab-mark', 'aria-hidden': 'true', viewBox: '-2 -8 35 47', width: '56', height: '56', fill: 'none', stroke: '#eabb79', 'stroke-width': '1.7', focusable: 'false' });
    for (const [transform, fill] of [['translate(6 1)', '#dc915a'], ['translate(0 9)', '#efd7a6'], ['translate(12 11)', '#a6bfae']]) {
      const tile = svg('g', { transform });
      tile.append(svg('rect', { width: '19', height: '19', transform: 'matrix(.57735 1 -.43 .74478 8.1002 -7.0754)', fill }));
      mark.append(tile);
    }
    brand.append(mark);
  } else {
    const mark = el('img', 'live-projects-tab-mark');
    const nasa = item.id === 'space-cottbus';
    mark.src = nasa ? '/assets/intro-projects/space-cottbus.svg?v=63fc4767a4c0' : '/assets/intro-projects/maptheory.svg?v=618ba754db94';
    mark.alt = '';
    mark.width = nasa ? 150 : 46;
    mark.height = nasa ? 59 : 46;
    mark.draggable = false;
    mark.setAttribute('aria-hidden', 'true');
    brand.append(mark);
  }
  return brand;
}

// Keep the sites' own desktop entry screens intact as a scaled, click-to-open preview.
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 800;
// Original sites captured on 21 October 2026. Inactive cards stay passive;
// only the selected project downloads and runs a live site.
const PROJECT_PREVIEWS = {
  maptheory: '/assets/live-projects/maptheory-5f5f7a16743c.jpg',
  'space-cottbus': '/assets/live-projects/space-cottbus-5fa2c02d52f2.jpg',
  cottbus: '/assets/live-projects/cottbus-386d270cbefc.jpg',
  gralobe: '/assets/live-projects/gralobe-ac9b8b9c0a8b.jpg',
};

export function startLiveProjects({ project } = {}) {
  window.__liveProjects?.dispose?.();
  window.__galleryRoom?.dispose?.();
  const app = document.getElementById('app');
  if (!app) throw new Error('The live-projects room needs #app.');
  document.documentElement.classList.remove('intro-active', 'gallery-pending', 'gallery-experience');
  document.body.classList.add('live-projects-active');
  app.inert = false;
  const previousTitle = document.title;
  const root = el('main', 'live-projects');
  root.id = 'live-projects';
  root.setAttribute('aria-label', 'Live projects');
  const header = el('header', 'live-projects-header');
  const brand = el('a', 'live-projects-brand');
  brand.append(el('span', null, 'Batıkan'), el('span', 'portfolio-wordmark-accent', 'or'));
  brand.href = '/';
  brand.setAttribute('aria-label', 'Batıkanor — return to introduction');
  const links = el('nav', 'live-projects-links');
  links.setAttribute('aria-label', 'Portfolio and contact');
  for (const [text, href] of [['Achievements', '/?view=world'], ['CV', '/cv/'], ['Email', 'mailto:batikanor@gmail.com'], ['LinkedIn ↗', 'https://linkedin.com/in/batikanor']]) {
    const link = el('a', null, text);
    link.href = href;
    if (href === '/?view=world' || href === '/cv/') link.classList.add('live-projects-nav-action');
    if (href.startsWith('https:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    if (href.startsWith('mailto:')) decorateBrandLink(link, 'email');
    else if (href.includes('linkedin.com/')) decorateBrandLink(link, 'linkedin');
    links.append(link);
  }
  header.append(brand, links);

  const room = el('section', 'live-projects-room');
  const mosaic = el('div', 'live-projects-mosaic live-projects-desk');
  mosaic.setAttribute('role', 'tablist');
  mosaic.setAttribute('aria-label', 'Live projects');
  const preview = el('div', 'live-projects-preview');
  const poster = el('img', 'live-projects-preview-poster');
  poster.alt = '';
  poster.draggable = false;
  const fallback = el('div', 'live-projects-preview-fallback');
  fallback.setAttribute('aria-hidden', 'true');
  const fallbackName = el('span', 'live-projects-preview-name');
  const fallbackStatus = el('span', 'live-projects-preview-status');
  fallback.append(fallbackName, fallbackStatus);
  const siteFrame = el('div', 'live-projects-preview-frame');
  preview.setAttribute('aria-hidden', 'true');
  preview.append(poster, fallback, siteFrame);

  const story = el('article', 'live-projects-story');
  story.id = 'live-projects-panel';
  story.setAttribute('role', 'tabpanel');
  story.tabIndex = 0;
  const name = el('h1', 'live-projects-name');
  name.id = 'live-projects-name';
  const points = el('ul', 'live-projects-points');
  const open = el('a', 'live-projects-open');
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  const domain = el('span');
  const arrow = el('span', 'live-projects-open-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  open.append(domain, arrow);
  const identity = el('div', 'live-projects-identity');
  identity.append(name, open);
  story.append(identity, points);
  const cards = [];
  const windowBodies = [];
  const previewButtons = [];
  const windowOffsets = LIVE_PROJECTS.map(() => ({ x: 0, y: 0 }));
  let drag = null;
  const tabButtons = LIVE_PROJECTS.map((item, index) => {
    const card = el('figure', 'live-projects-visual live-projects-card');
    card.dataset.project = item.id;
    const chrome = el('figcaption', 'live-projects-browser-bar');
    const chromeDots = el('span', 'live-projects-browser-dots');
    chromeDots.setAttribute('aria-hidden', 'true');
    chromeDots.append(el('i'), el('i'), el('i'));
    const address = el('a', 'live-projects-browser-domain', item.domain);
    address.href = item.url;
    address.target = '_blank';
    address.rel = 'noopener noreferrer';
    address.setAttribute('aria-label', `Visit ${item.domain} — opens in a new tab`);
    chrome.append(chromeDots);
    const button = el('button', 'live-projects-tab');
    button.id = `live-project-${item.id}`;
    button.dataset.project = item.id;
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-label', item.name);
    button.setAttribute('aria-controls', story.id);
    const thumbnail = el('img', 'live-projects-thumbnail');
    thumbnail.src = PROJECT_PREVIEWS[item.id];
    thumbnail.alt = '';
    thumbnail.draggable = false;
    thumbnail.decoding = 'async';
    thumbnail.setAttribute('aria-hidden', 'true');
    const caption = el('span', 'live-projects-tab-caption');
    const text = el('span', 'live-projects-tab-text');
    text.append(el('span', 'live-projects-tab-name', item.name));
    const check = el('span', 'live-projects-tab-check', '✓');
    check.setAttribute('aria-hidden', 'true');
    caption.append(projectBrand(item), text, check);
    button.append(caption);
    const select = el('button', 'live-projects-preview-select');
    select.type = 'button';
    select.setAttribute('aria-label', `Select ${item.name}`);
    select.setAttribute('aria-controls', story.id);
    select.addEventListener('click', () => selectProject(index));
    previewButtons.push(select);
    const body = el('div', 'live-projects-window-body');
    body.append(thumbnail, select);
    windowBodies.push(body);
    const grip = el('button', 'live-projects-window-grip', '⠿');
    grip.type = 'button';
    grip.setAttribute('aria-label', `Move ${item.name} window`);
    grip.title = 'Drag to move · arrow keys to adjust';
    grip.addEventListener('pointerdown', event => {
      if (disposed || (event.button !== undefined && event.button !== 0) || event.isPrimary === false) return;
      event.preventDefault();
      selectProject(index);
      grip.focus({ preventScroll: true });
      drag = { index, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, ...windowOffsets[index] };
      card.classList.add('is-dragging');
      grip.setPointerCapture?.(event.pointerId);
    });
    grip.addEventListener('pointermove', event => {
      if (disposed || drag?.index !== index || drag.pointerId !== event.pointerId) return;
      moveWindow(index, drag.x + event.clientX - drag.startX, drag.y + event.clientY - drag.startY);
    });
    const endDrag = event => {
      if (drag?.index !== index || drag.pointerId !== event.pointerId) return;
      drag = null;
      card.classList.remove('is-dragging');
      if (grip.hasPointerCapture?.(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    };
    grip.addEventListener('pointerup', endDrag);
    grip.addEventListener('pointercancel', endDrag);
    grip.addEventListener('lostpointercapture', endDrag);
    grip.addEventListener('keydown', event => {
      if (disposed) return;
      const step = event.shiftKey ? 20 : 10;
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
      if (!delta && event.key !== 'Home') return;
      event.preventDefault();
      selectProject(index);
      moveWindow(index, delta ? windowOffsets[index].x + delta[0] : 0, delta ? windowOffsets[index].y + delta[1] : 0);
    });
    chrome.append(button, address, grip);
    button.addEventListener('click', () => selectProject(index));
    button.addEventListener('keydown', event => {
      if (disposed) return;
      let next;
      if (event.key === 'ArrowLeft') next = adjacentLiveProject(index, -1);
      else if (event.key === 'ArrowRight') next = adjacentLiveProject(index, 1);
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = LIVE_PROJECTS.length - 1;
      else return;
      event.preventDefault();
      selectProject(next);
      tabButtons[next].focus({ preventScroll: true });
    });
    card.append(chrome, body);
    mosaic.append(card);
    cards.push(card);
    return button;
  });
  const navigation = el('nav', 'live-projects-navigation');
  navigation.setAttribute('aria-label', 'Project navigation');
  const previous = el('button', 'live-projects-previous', '←');
  previous.type = 'button';
  previous.setAttribute('aria-label', 'Previous project');
  const count = el('span', 'live-projects-count');
  const next = el('button', 'live-projects-next', '→');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next project');
  previous.addEventListener('click', () => selectProject(adjacentLiveProject(selected, -1)));
  next.addEventListener('click', () => selectProject(adjacentLiveProject(selected, 1)));
  navigation.append(previous, count, next);
  room.append(mosaic, navigation, story);
  const announcement = el('p', 'live-projects-sr-only');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  root.append(header, room, announcement);
  app.replaceChildren(root);

  let selected = 0;
  let disposed = false;
  let activeFrame = null;
  let previewProjectId = null;
  let starRequest = null;
  const starCounts = new Map();
  let arranged = false;
  function moveWindow(index, x, y) {
    const offset = windowOffsets[index];
    offset.x = Math.max(-45, Math.min(45, x));
    offset.y = Math.max(-18, Math.min(18, y));
    cards[index].style.setProperty('--window-x', `${offset.x}px`);
    cards[index].style.setProperty('--window-y', `${offset.y}px`);
  }
  function arrangeCards() {
    for (const [index, card] of cards.entries()) card.classList.toggle('is-selected', index === selected);
    // Moving a connected iframe restarts it. Only transfer the empty container
    // after selectProject has unloaded the outgoing site.
    if (preview.parentElement !== windowBodies[selected]) windowBodies[selected].append(preview);
    scalePreview();
    arranged = true;
  }
  function clearStarRequest() {
    starRequest?.abort();
    starRequest = null;
  }
  function showPoints(item) {
    clearStarRequest();
    points.replaceChildren(...item.points.map(point => {
      if (typeof point === 'string') return el('li', null, point);
      const row = el('li');
      const link = el('a', 'live-projects-point-link', point.text);
      link.href = point.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      row.append(link);
      return row;
    }));
    if (!item.githubRepo) return;
    const stars = el('a', 'live-projects-github-stars');
    stars.href = `https://github.com/${item.githubRepo}`;
    stars.target = '_blank';
    stars.rel = 'noopener noreferrer';
    const showCount = count => { stars.textContent = `${count.toLocaleString('en-US')} GitHub ${count === 1 ? 'star' : 'stars'}`; };
    showCount(starCounts.get(item.githubRepo) ?? item.githubStars);
    stars.title = starCounts.has(item.githubRepo) ? 'Current star count on GitHub' : `GitHub star count checked ${item.githubStarsCheckedAt}`;
    const point = el('li');
    point.append(stars);
    points.append(point);
    if (starCounts.has(item.githubRepo)) return;
    const request = new AbortController();
    starRequest = request;
    fetch(`https://api.github.com/repos/${item.githubRepo}`, { signal: request.signal, credentials: 'omit' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (disposed || request.signal.aborted || starRequest !== request) return;
        const count = data?.stargazers_count;
        if (data?.full_name !== item.githubRepo || !Number.isSafeInteger(count) || count < 0) return;
        starCounts.set(item.githubRepo, count);
        showCount(count);
        stars.title = 'Current star count on GitHub';
      })
      .catch(() => { /* Keep the last verified count when GitHub is unavailable. */ });
  }
  function scalePreview() {
    if (disposed) return;
    const width = preview.clientWidth || preview.getBoundingClientRect?.().width;
    const height = preview.clientHeight || width * PREVIEW_HEIGHT / PREVIEW_WIDTH;
    if (width > 0 && height > 0) preview.style.setProperty('--preview-scale', String(Math.min(width / PREVIEW_WIDTH, height / PREVIEW_HEIGHT)));
  }
  function clearPreview() {
    if (activeFrame) {
      activeFrame.onload = null;
      activeFrame.onerror = null;
      activeFrame.src = 'about:blank';
      activeFrame.remove();
      activeFrame = null;
    }
    siteFrame.replaceChildren();
    previewProjectId = null;
  }
  function showPreview(item) {
    if (activeFrame && previewProjectId === item.id && preview.dataset.state !== 'unavailable') return;
    clearPreview();
    previewProjectId = item.id;
    preview.dataset.state = 'loading';
    poster.src = PROJECT_PREVIEWS[item.id];
    fallbackName.textContent = item.name;
    fallbackStatus.textContent = 'Loading site preview…';
    const frame = el('iframe', 'live-projects-site-frame');
    frame.width = String(PREVIEW_WIDTH);
    frame.height = String(PREVIEW_HEIGHT);
    frame.title = `${item.name} entry screen`;
    frame.tabIndex = -1;
    frame.inert = true;
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.setAttribute('allow', "autoplay 'none'; camera 'none'; microphone 'none'; geolocation 'none'; fullscreen 'none'");
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.loading = 'eager';
    // A load event does not establish that a cross-origin page rendered successfully.
    // The separate native address remains available after a frame-policy failure.
    frame.onload = () => {
      if (disposed || activeFrame !== frame) return;
      preview.dataset.state = 'response';
      fallbackStatus.textContent = 'Website preview';
    };
    frame.onerror = () => {
      if (disposed || activeFrame !== frame) return;
      preview.dataset.state = 'unavailable';
      fallbackStatus.textContent = 'Preview unavailable';
      frame.hidden = true;
    };
    activeFrame = frame;
    frame.src = item.previewUrl || item.url;
    siteFrame.append(frame);
    scalePreview();
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scalePreview) : null;
  if (resizeObserver) resizeObserver.observe(preview);
  else addEventListener('resize', scalePreview);
  function selectProject(value, { updateUrl = true } = {}) {
    if (disposed) return;
    const nextSelected = Number.isInteger(value) ? Math.max(0, Math.min(LIVE_PROJECTS.length - 1, value)) : liveProjectIndex(value);
    if (arranged && nextSelected === selected) {
      // Reattaching a connected iframe restarts its browser context, even when
      // the iframe Element and its src are unchanged. Leave the live document
      // and the running transition alone on a repeated selection or Back event.
      showPreview(LIVE_PROJECTS[selected]);
      if (updateUrl) {
        const url = liveProjectUrl(location.href, LIVE_PROJECTS[selected].id);
        if (url.href !== location.href) history.pushState(history.state, '', url);
      }
      return;
    }
    // Stop the outgoing site before moving the empty preview container. A DOM
    // move must never briefly restart the previous site in the next card.
    clearPreview();
    selected = nextSelected;
    const item = LIVE_PROJECTS[selected];
    root.dataset.project = item.id;
    root.style.setProperty('--live-accent', item.accent);
    root.style.setProperty('--live-accent-rgb', item.accentRgb);
    document.title = `${item.name} · Live projects · Batıkanor`;
    name.textContent = item.name;
    showPoints(item);
    domain.textContent = item.domain;
    open.href = item.url;
    open.setAttribute('aria-label', `Open ${item.domain} in a new tab`);
    story.setAttribute('aria-labelledby', tabButtons[selected].id);
    arrangeCards();
    showPreview(item);
    tabButtons.forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === selected));
      button.tabIndex = index === selected ? 0 : -1;
      previewButtons[index].setAttribute('aria-pressed', String(index === selected));
    });
    announcement.textContent = item.name;
    count.textContent = `${selected + 1} / ${LIVE_PROJECTS.length}`;
    count.setAttribute('aria-label', `Project ${selected + 1} of ${LIVE_PROJECTS.length}`);
    if (updateUrl) {
      const url = liveProjectUrl(location.href, item.id);
      if (url.href !== location.href) history.pushState(history.state, '', url);
    }
  }
  const onPopState = () => selectProject(new URL(location.href).searchParams.get('project'), { updateUrl: false });
  addEventListener('popstate', onPopState);
  selectProject(project || new URL(location.href).searchParams.get('project'), { updateUrl: false });
  const controller = {
    root,
    selectProject,
    dispose() {
      if (disposed) return;
      disposed = true;
      removeEventListener('popstate', onPopState);
      if (resizeObserver) resizeObserver.disconnect();
      else removeEventListener('resize', scalePreview);
      clearStarRequest();
      drag = null;
      clearPreview();
      document.body.classList.remove('live-projects-active');
      document.title = previousTitle;
      root.remove();
      if (window.__liveProjects === controller) delete window.__liveProjects;
    },
  };
  window.__liveProjects = controller;
  return controller;
}
