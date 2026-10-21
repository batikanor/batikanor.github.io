import './intro.css';

const $ = id => document.getElementById(id);
let pendingEntry = null;
let resolveEntry = null;
let enterBound = false;
let entryDestination = 'map';
function setIntroHistoryState(visible) {
  const current = history.state;
  const state = current && typeof current === 'object' && !Array.isArray(current) ? {...current} : {};
  history.replaceState({...state, earthIntroVisible: visible}, '', location.href);
}

export function introHistoryVisible() {
  return history.state?.earthIntroVisible === true;
}

/** A chosen globe marker and the entry button share the same explicit gate. */
export function requestIntroEntry({eventSlug=null}={}) {
  if (!resolveEntry) return false;
  const enter = $('intro-enter');
  enter.disabled = true;
  enter.querySelector('.intro-enter-label').textContent = 'Opening…';
  $('intro-load-status').textContent = entryDestination==='gallery'?'Opening the gallery…':'Opening the map…';
  setIntroHistoryState(false);
  const resolve = resolveEntry;
  resolveEntry = null;
  pendingEntry = null;
  resolve(eventSlug ? {eventSlug} : {});
  return true;
}

/** Resolve only after an explicit activation; never start the map on a timer. */
export function waitForIntroEntry({destination='map'}={}) {
  entryDestination = destination;
  const screen = $('intro-screen');
  const enter = $('intro-enter');
  const app = $('app');
  screen.hidden = false;
  document.documentElement.classList.add('intro-active');
  app.inert = true;
  screen.inert = false;
  enter.hidden = false;
  enter.disabled = false;
  enter.querySelector('.intro-enter-label').textContent = 'Explore achievements';
  $('intro-fallback-link').hidden = true;
  $('intro-load-status').textContent = '';
  $('intro-load-status').classList.remove('is-error');
  setIntroHistoryState(true);
  if (!enterBound) {
    enterBound = true;
    enter.addEventListener('click', () => requestIntroEntry());
  }
  // Native focus makes the sole transition discoverable to keyboard users.
  requestAnimationFrame(() => enter.focus({preventScroll:true}));
  if (!pendingEntry) pendingEntry = new Promise(resolve => { resolveEntry = resolve; });
  return pendingEntry;
}

export function finishIntro({keepAppInert=false,focusTarget=$('journey-current')}={}) {
  const screen = $('intro-screen');
  const app = $('app');
  document.documentElement.classList.remove('intro-active');
  screen.inert = true;
  app.inert = keepAppInert;
  screen.hidden = true;
  focusTarget?.focus({preventScroll:true});
}

export function hideIntroForDeepLink() {
  const screen = $('intro-screen');
  document.documentElement.classList.remove('intro-active');
  screen.hidden = true;
  screen.inert = true;
  $('app').inert = false;
}
