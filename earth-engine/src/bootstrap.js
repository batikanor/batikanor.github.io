import {shouldShowIntro} from './introGate.js';
import {readPortfolioRoute} from './portfolioRoute.js';
import {finishIntro, hideIntroForDeepLink, waitForIntroEntry} from './intro.js';

/**
 * Do not load the large map runtime on browsers that cannot create WebGL2.
 * The authored portfolio, CV and PDF export must remain usable without a GPU.
 * `?view=list` is also a stable way to exercise the accessible fallback.
 */
function supportsWebGl2() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

async function startPortfolio() {
  const view = readPortfolioRoute(location.href).view === 'cv' ? 'cv' : new URLSearchParams(location.search).get('view');
  // The live CV is a document, not a map scene. Do not start MapLibre/Three or
  // thousands of tile requests behind PDF.js; slow devices otherwise hit the
  // preview timeout before the first page can render.
  if (view === 'cv') {
    const {startCvOnly} = await import('./cvOnly.js');
    startCvOnly();
    return 'cv';
  }
  const forceList = view === 'list';
  if (forceList || !supportsWebGl2()) {
    const {startFallback} = await import('./fallback.js');
    startFallback();
    return 'fallback';
  }
  try {
    await import('./main.js');
    return 'map';
  } catch (error) {
    console.error('Interactive map could not start; switching to the portfolio list.', error);
    // A partially evaluated map module may have bound handlers. Reloading a
    // clean document avoids duplicate controls and leaves the source URL intact.
    const url = new URL(location.href);
    url.searchParams.set('view', 'list');
    location.replace(url.href);
    return 'redirect';
  }
}

async function start() {
  if (!shouldShowIntro(location.href)) {
    hideIntroForDeepLink();
    await startPortfolio();
    return;
  }

  // Paint the introduction first, then prepare the map beneath its
  // opaque surface. It never dismisses itself: Enter is the only transition.
  const entered = waitForIntroEntry();
  const firstMapFrame = new Promise(resolve => {
    addEventListener('earth-ready', resolve, {once:true});
  });
  await new Promise(resolve => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(done));
    // Background/energy-saving tabs may suspend animation frames.
    setTimeout(done, 250);
  });
  const destinationPromise = startPortfolio().catch(error => {
    console.error('Portfolio could not start.', error);
    const introStatus = document.getElementById('intro-load-status');
    introStatus.textContent = 'The map could not load. The achievement list is still available.';
    introStatus.classList.add('is-error');
    document.getElementById('intro-enter').hidden = true;
    document.getElementById('intro-fallback-link').hidden = false;
    return 'error';
  });
  await entered;
  const destination = await destinationPromise;
  if (destination === 'redirect') return;
  if (destination === 'error') return;
  if (destination === 'map') {
    await Promise.race([
      firstMapFrame,
      // A missing optional tile must not trap the visitor on the introduction.
      new Promise(resolve => setTimeout(resolve, 10000))
    ]);
  }
  finishIntro();
}

start().catch(error => {
  console.error('Portfolio could not start.', error);
  const status = document.getElementById('status');
  if (status) {
    status.className = 'bootstrap-error';
    status.textContent = 'The portfolio could not load. Please refresh or try another browser.';
  }
});
