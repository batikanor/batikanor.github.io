import './style.css';
import './projectContent.css';
import './fallback.css';
import achievements from './data/achievements.json';
import {sortAchievementsNewestFirst, getChronologyState, stepChronology} from './chronology.js';
import {getProject, renderProjectContent} from './projectContent.js';
import {readPortfolioRoute, portfolioUrl} from './portfolioRoute.js';
import {createCvView} from './cvView.js';
import {bindCvDownload} from './cvDownload.js';
import {installExportControls} from './exportControls.js';
import {createDetailPanel} from './detailPanel.js';

const $ = id => document.getElementById(id);
const ordered = sortAchievementsNewestFirst(achievements);
const bySlug = new Map(ordered.map(event => [event.slug, event]));
const knownSlugs = new Set(bySlug.keys());
const forcedList = new URLSearchParams(location.search).get('view') === 'list';

/** A complete, chronological portfolio when the 3D map cannot initialize. */
export function startFallback() {
  document.body.classList.add('fallback-mode');
  const detailPanel = createDetailPanel($('detail'));
  $('settings-toggle').hidden = true;
  $('settings-panel').hidden = true;
  $('sources').hidden = true;
  $('app').style.setProperty('--credits-height', '0px');
  $('world-button').title = 'Show all achievements';
  $('world-button').setAttribute('aria-label', 'Show all achievements');
  $('map').setAttribute('aria-label', 'Chronological achievement list');

  const status = message => { $('status').textContent = message; };
  const cvView = createCvView({root: $('cv-view-root'), onProjectLink: slug => select(bySlug.get(slug))});
  bindCvDownload($('cv-download'));
  installExportControls({announce: status});

  const shell = document.createElement('div');
  shell.className = 'fallback-content';
  const heading = document.createElement('header');
  heading.className = 'fallback-heading';
  const label = document.createElement('p');
  label.className = 'fallback-eyebrow';
  label.textContent = 'PORTFOLIO / LIST VIEW';
  const title = document.createElement('h1');
  title.textContent = 'Achievements';
  const explanation = document.createElement('p');
  explanation.textContent = 'The interactive map is unavailable in this browser. All achievements, original stories, media and downloads remain accessible.';
  heading.append(label, title, explanation);
  const list = document.createElement('ol');
  list.className = 'fallback-achievements';
  list.setAttribute('aria-label', 'Achievements, newest first');
  const rows = new Map();
  ordered.forEach((event, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fallback-achievement';
    button.setAttribute('aria-label', `Open achievement ${index + 1} of ${ordered.length}: ${getProject(event.slug)?.title ?? event.title}`);
    const number = document.createElement('span');
    number.className = 'fallback-number';
    number.textContent = String(index + 1).padStart(2, '0');
    const content = document.createElement('span');
    content.className = 'fallback-row-content';
    const rowTitle = document.createElement('strong');
    rowTitle.textContent = getProject(event.slug)?.title ?? event.title;
    const place = document.createElement('small');
    place.textContent = `${event.date} · ${event.city}, ${event.country}`;
    content.append(rowTitle, place);
    const arrow = document.createElement('span');
    arrow.className = 'fallback-open';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    button.append(number, content, arrow);
    button.addEventListener('click', () => select(event));
    item.append(button);
    list.append(item);
    rows.set(event.slug, button);
  });
  shell.append(heading, list);
  $('map').replaceChildren(shell);

  let active = null;
  function closePopovers() {
    $('portfolio-panel').hidden = true;
    $('portfolio-toggle').setAttribute('aria-expanded', 'false');
  }
  function renderJourney() {
    const state = getChronologyState(ordered, active?.slug);
    const event = state.current ?? ordered[0];
    if (!event) return;
    const ordinal = state.index < 0 ? 1 : state.index + 1;
    const eventTitle = getProject(event.slug)?.title ?? event.title;
    $('journey-meta').textContent = `${String(ordinal).padStart(2, '0')} / ${ordered.length} · ${event.date} · ${event.city}`;
    $('journey-title').textContent = eventTitle;
    $('journey-current').title = `${eventTitle} — open details`;
    $('journey-previous').disabled = !state.previous;
    $('journey-next').disabled = !state.next;
    for (const [slug, button] of rows) {
      if (slug === event.slug) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }
  function showDetail(event) {
    const root = $('detail');
    const scroll = detailPanel.render();
    const content = document.createElement('div');
    content.className = 'project-content-host';
    scroll.append(content);
    renderProjectContent(content, event.slug, {onProjectLink: slug => select(bySlug.get(slug))});
    scroll.scrollTop = 0;
    root.hidden = false;
  }
  function select(event, {historyMode = 'push', showDetail: openDetail = true, view = null} = {}) {
    if (!event) return;
    active = event;
    if (historyMode !== 'none') {
      const url = portfolioUrl(location.href, {eventSlug: event.slug, view: view ?? (forcedList ? 'list' : null)});
      history[historyMode === 'replace' ? 'replaceState' : 'pushState'](null, '', url);
    }
    closePopovers();
    renderJourney();
    if (openDetail) showDetail(event);
    else $('detail').hidden = true;
    status(`${getProject(event.slug)?.title ?? event.title}. Map unavailable; ${openDetail ? 'project details open' : 'chronology available'}.`);
  }

  $('journey-previous').addEventListener('click', () => select(stepChronology(ordered, active?.slug, 'previous')));
  $('journey-next').addEventListener('click', () => select(stepChronology(ordered, active?.slug, 'next')));
  $('journey-current').addEventListener('click', () => select(active ?? ordered[0]));
  $('world-button').addEventListener('click', () => {
    $('detail').hidden = true;
    $('map').scrollTo({top: 0, behavior: 'smooth'});
    closePopovers();
    status('Showing all achievements in chronological order.');
  });
  $('portfolio-toggle').addEventListener('click', () => {
    const opening = $('portfolio-panel').hidden;
    $('portfolio-panel').hidden = !opening;
    $('portfolio-toggle').setAttribute('aria-expanded', String(opening));
  });
  $('cv-link').addEventListener('click', () => {
    closePopovers();
    history.pushState(null, '', portfolioUrl(location.href, {eventSlug: active?.slug, view: 'cv'}));
    cvView.open();
  });
  $('cv-view').addEventListener('close', () => {
    if (new URLSearchParams(location.search).get('view') !== 'cv') return;
    history.replaceState(null, '', portfolioUrl(location.href, {eventSlug: active?.slug, view: forcedList ? 'list' : null}));
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.top-popover,.topbar-actions')) closePopovers();
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closePopovers(); $('detail').hidden = true; }
  });
  const restoreRoute = () => {
    const route = readPortfolioRoute(location.href, knownSlugs);
    const event = bySlug.get(route.eventSlug) ?? ordered[0];
    select(event, {historyMode: 'none', showDetail: route.view !== 'cv' && route.view !== 'world'});
    if (route.view === 'cv' && !cvView.isOpen()) cvView.open();
    else if (route.view !== 'cv' && cvView.isOpen()) cvView.close();
    if (route.view === 'world') $('map').scrollTo({top: 0, behavior: 'smooth'});
  };
  window.addEventListener('popstate', restoreRoute);
  window.addEventListener('hashchange', restoreRoute);

  const initialRoute = readPortfolioRoute(location.href, knownSlugs);
  select(bySlug.get(initialRoute.eventSlug) ?? ordered[0], {
    historyMode: 'replace', showDetail: initialRoute.view !== 'cv', view: initialRoute.view
  });
  if (initialRoute.view === 'cv') {
    cvView.open();
    if (initialRoute.downloadCv) $('cv-download').click();
  }
  window.__earthFallback = {ordered, select};
}
