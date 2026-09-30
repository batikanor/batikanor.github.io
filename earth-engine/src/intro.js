import './intro.css';

const $ = id => document.getElementById(id);
let pendingEntry = null;
let resolveEntry = null;
let enterBound = false;

function setIntroHistoryState(visible) {
  const current = history.state;
  const state = current && typeof current === 'object' && !Array.isArray(current) ? {...current} : {};
  history.replaceState({...state, earthIntroVisible: visible}, '', location.href);
}

export function introHistoryVisible() {
  return history.state?.earthIntroVisible === true;
}

/** Resolve only after an explicit activation; never start the map on a timer. */
export function waitForIntroEntry() {
  const screen = $('intro-screen');
  const enter = $('intro-enter');
  const app = $('app');
  screen.hidden = false;
  document.documentElement.classList.add('intro-active');
  app.inert = true;
  screen.inert = false;
  enter.hidden = false;
  enter.disabled = false;
  enter.querySelector('.intro-enter-label').textContent = 'Enter';
  $('intro-fallback-link').hidden = true;
  $('intro-load-status').textContent = '';
  $('intro-load-status').classList.remove('is-error');
  setIntroHistoryState(true);
  if (!enterBound) {
    enterBound = true;
    enter.addEventListener('click', () => {
      if (!resolveEntry) return;
      enter.disabled = true;
      enter.querySelector('.intro-enter-label').textContent = 'Opening…';
      $('intro-load-status').textContent = 'Opening the map…';
      setIntroHistoryState(false);
      const resolve = resolveEntry;
      resolveEntry = null;
      pendingEntry = null;
      resolve();
    });
  }
  // Native focus makes the sole transition discoverable to keyboard users.
  requestAnimationFrame(() => enter.focus({preventScroll:true}));
  if (!pendingEntry) pendingEntry = new Promise(resolve => { resolveEntry = resolve; });
  return pendingEntry;
}

export function finishIntro() {
  const screen = $('intro-screen');
  const app = $('app');
  document.documentElement.classList.remove('intro-active');
  screen.inert = true;
  app.inert = false;
  screen.hidden = true;
  $('journey-current')?.focus({preventScroll:true});
}

export function hideIntroForDeepLink() {
  const screen = $('intro-screen');
  document.documentElement.classList.remove('intro-active');
  screen.hidden = true;
  screen.inert = true;
  $('app').inert = false;
}
