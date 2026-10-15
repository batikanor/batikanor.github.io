import { LIVE_PROJECTS, adjacentLiveProject, liveProjectIndex, liveProjectUrl } from './liveProjectsData.js';
import { decorateBrandLink } from './brandLinks.js';
import './liveProjects.css';

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

// Keep the sites' own desktop entry screens intact as a scaled, click-to-open preview.
const PREVIEW_WIDTH = 1280;
const PREVIEW_HEIGHT = 800;

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
  const visual = el('figure', 'live-projects-visual');
  const chrome = el('figcaption', 'live-projects-browser-bar');
  const chromeDots = el('span', 'live-projects-browser-dots');
  chromeDots.setAttribute('aria-hidden', 'true');
  chromeDots.append(el('i'), el('i'), el('i'));
  const previewDomain = el('span', 'live-projects-browser-domain');
  chrome.append(chromeDots, previewDomain);
  const preview = el('div', 'live-projects-preview');
  const fallback = el('div', 'live-projects-preview-fallback');
  fallback.setAttribute('aria-hidden', 'true');
  const fallbackName = el('span', 'live-projects-preview-name');
  const fallbackStatus = el('span', 'live-projects-preview-status');
  fallback.append(fallbackName, fallbackStatus);
  const siteFrame = el('div', 'live-projects-preview-frame');
  const previewLink = el('a', 'live-projects-preview-link');
  previewLink.target = '_blank';
  previewLink.rel = 'noopener noreferrer';
  const previewAction = el('span', 'live-projects-preview-action', 'Open site ↗');
  previewAction.setAttribute('aria-hidden', 'true');
  previewLink.append(previewAction);
  preview.append(fallback, siteFrame, previewLink);
  visual.append(chrome, preview);

  const story = el('article', 'live-projects-story');
  story.id = 'live-projects-panel';
  story.setAttribute('role', 'tabpanel');
  story.tabIndex = 0;
  const name = el('h1', 'live-projects-name');
  const points = el('ul', 'live-projects-points');
  const open = el('a', 'live-projects-open');
  open.target = '_blank';
  open.rel = 'noopener noreferrer';
  const domain = el('span');
  const arrow = el('span', 'live-projects-open-arrow', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  open.append(domain, arrow);
  story.append(name, points, open);
  room.append(visual, story);

  const shelf = el('nav', 'live-projects-shelf');
  shelf.setAttribute('aria-label', 'Choose a live project');
  const tabs = el('div', 'live-projects-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Live projects');
  tabs.style.setProperty('--live-project-count', String(LIVE_PROJECTS.length));
  const tabButtons = LIVE_PROJECTS.map((item, index) => {
    const button = el('button', 'live-projects-tab');
    button.id = `live-project-${item.id}`;
    button.type = 'button';
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', story.id);
    const text = el('span', 'live-projects-tab-text');
    text.append(el('span', 'live-projects-tab-name', item.name), el('span', 'live-projects-tab-domain', item.domain));
    const direction = el('span', 'live-projects-tab-arrow', '↗');
    direction.setAttribute('aria-hidden', 'true');
    button.append(text, direction);
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
    tabs.append(button);
    return button;
  });
  shelf.append(tabs);
  const announcement = el('p', 'live-projects-sr-only');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  root.append(header, room, shelf, announcement);
  app.replaceChildren(root);

  let selected = 0;
  let disposed = false;
  let activeFrame = null;
  let previewProjectId = null;
  let starRequest = null;
  const starCounts = new Map();
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
    if (width > 0) preview.style.setProperty('--preview-scale', String(width / PREVIEW_WIDTH));
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
    previewDomain.textContent = item.domain;
    fallbackName.textContent = item.name;
    fallbackStatus.textContent = 'Loading site preview…';
    previewLink.href = item.url;
    previewLink.setAttribute('aria-label', `Visit ${item.domain} — opens in a new tab`);
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
    // The native link remains available in every state, including a frame-policy failure.
    frame.onload = () => {
      if (disposed || activeFrame !== frame) return;
      preview.dataset.state = 'response';
      fallbackStatus.textContent = 'Open the site ↗';
    };
    frame.onerror = () => {
      if (disposed || activeFrame !== frame) return;
      preview.dataset.state = 'unavailable';
      fallbackStatus.textContent = 'Preview unavailable · Open the site ↗';
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
    selected = Number.isInteger(value) ? Math.max(0, Math.min(LIVE_PROJECTS.length - 1, value)) : liveProjectIndex(value);
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
    showPreview(item);
    tabButtons.forEach((button, index) => {
      button.setAttribute('aria-selected', String(index === selected));
      button.tabIndex = index === selected ? 0 : -1;
    });
    announcement.textContent = item.name;
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
