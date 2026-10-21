import {shouldShowIntro} from './introGate.js';
import {readPortfolioRoute, portfolioUrl} from './portfolioRoute.js';
import achievements from './data/achievements.json';
import {finishIntro, hideIntroForDeepLink, waitForIntroEntry, requestIntroEntry} from './intro.js';
import {mountIntroProjectFan} from './introProjectFan.js';

/**
 * Do not load the large map runtime on browsers that cannot create WebGL2.
 * The authored portfolio, CV and PDF export must remain usable without a GPU.
 * Devices without a GPU use the existing authored project pages.
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

const knownSlugs = new Set(achievements.map(project => project.slug));

/** Preserve authored project content without loading another portfolio UI. */
function staticDestination(href=location.href) {
  const url = new URL(href);
  const {eventSlug} = readPortfolioRoute(url.href,knownSlugs);
  url.pathname = eventSlug ? `/achievements/${eventSlug}/` : '/projects/';
  for (const key of ['event','view','download','prototype','experience']) url.searchParams.delete(key);
  url.hash = '';
  return url.href;
}

function openStaticPortfolio() {
  location.replace(staticDestination());
  return 'redirect';
}

async function startPortfolio({deferActivation=false}={}) {
  const route = readPortfolioRoute(location.href);
  // CV and download aliases remain independent of the map and GPU availability.
  if (route.view === 'cv' || route.downloadCv) {
    const {startCvOnly} = await import('./cvOnly.js');
    startCvOnly();
    return 'cv';
  }
  if (!supportsWebGl2()) return deferActivation ? 'static' : openStaticPortfolio();
  try {
    await import('./main.js');
    return 'map';
  } catch (error) {
    // The homepage retains its intro and an explicit recovery link. A deep
    // link opens the same project's authored page in a clean document.
    if (deferActivation) throw error;
    console.error('Interactive map could not start; opening the authored project page.', error);
    return openStaticPortfolio();
  }
}

function firstPaint() {
  return new Promise(resolve => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    requestAnimationFrame(() => requestAnimationFrame(done));
    // Background/energy-saving tabs may suspend animation frames.
    setTimeout(done, 250);
  });
}

async function prepareGallery(deferActivation=false) {
  if (!supportsWebGl2()) {
    document.documentElement.classList.remove('gallery-pending');
    return {kind:'static'};
  }
  const {startGalleryRoom} = await import('./galleryRoom.js');
  return {kind:'gallery', gallery:await startGalleryRoom({deferActivation})};
}

/** Load only for a visible gallery intro; navigation also cancels a late import. */
function prepareIntroAchievementMap() {
  const container=document.getElementById('intro-achievements-map');
  if (!container) return () => {};
  let disposed=false,map=null;
  const onPageHide=event=>{if(!event.persisted)dispose();};
  const dispose=()=>{
    if(disposed)return;
    disposed=true;
    removeEventListener('pagehide',onPageHide);
    map?.dispose();
    if(window.__introAchievementMap===map)delete window.__introAchievementMap;
  };
  // A browser-history snapshot resumes this same bootstrap and map on Back.
  addEventListener('pagehide',onPageHide);
  import('./introAchievementMap.js').then(({startIntroAchievementMap})=>{
    if(disposed || !document.documentElement.classList.contains('intro-active'))return;
    map=startIntroAchievementMap({container,achievements,
      onSelect:eventSlug=>requestIntroEntry({eventSlug})});
    window.__introAchievementMap=map;
  }).catch(error=>{
    if(disposed)return;
    console.error('The introduction globe could not load; Explore achievements is still available.',error);
    container.hidden=true;
    dispose();
  });
  return dispose;
}

async function enterGalleryFromIntro() {
  const entered = waitForIntroEntry({destination:'gallery'});
  let entryRequested=false;
  entered.then(()=>{entryRequested=true;});
  let ready;
  const firstGalleryFrame = new Promise(resolve => { ready=resolve; });
  addEventListener('gallery-room-ready',ready,{once:true});
  // Show the released introduction before preparing the inert room beneath it.
  await firstPaint();
  const disposeIntroMap=entryRequested ? () => {} : prepareIntroAchievementMap();
  const destinationPromise = prepareGallery(true).catch(error => {
    console.error('The gallery could not start; the projects page is still available.',error);
    removeEventListener('gallery-room-ready',ready);
    disposeIntroMap();
    const introMap=document.getElementById('intro-achievements-map');
    if(introMap)introMap.hidden=true;
    window.__galleryRoom?.dispose?.();
    document.getElementById('app').inert=true;
    const status=document.getElementById('intro-load-status');
    status.textContent='The gallery could not load. Open the projects page to continue.';
    status.classList.add('is-error');
    document.getElementById('intro-enter').hidden=true;
    const fallback=document.getElementById('intro-fallback-link');
    fallback.href=staticDestination();
    fallback.hidden=false;
    fallback.focus({preventScroll:true});
    return {kind:'error'};
  });
  const selection=await entered;
  const eventSlug=knownSlugs.has(selection?.eventSlug) ? selection.eventSlug : null;
  if(eventSlug)history.replaceState({...history.state,earthIntroVisible:false,eventSlug},'',portfolioUrl(location.href,{eventSlug}));
  disposeIntroMap();
  const destination = await destinationPromise;
  if (destination.kind==='gallery') {
    await Promise.race([firstGalleryFrame,new Promise(resolve=>setTimeout(resolve,10000))]);
    removeEventListener('gallery-room-ready',ready);
    finishIntro({keepAppInert:true,focusTarget:null});
    destination.gallery.activate(eventSlug ? {eventSlug} : undefined);
  } else {
    removeEventListener('gallery-room-ready',ready);
    if (destination.kind==='static') openStaticPortfolio();
    else if (destination.kind!=='error' && destination.kind!=='redirect') finishIntro();
  }
}

async function start() {
  mountIntroProjectFan(document.getElementById('intro-project-fan'));
  const url = new URL(location.href);
  // Old bookmarks no longer select the removed text-view interface.
  if (url.searchParams.get('view') === 'list') {
    url.searchParams.delete('view');
    location.replace(url.href);
    return;
  }
  const route = readPortfolioRoute(location.href);
  // Live projects are a separate, lightweight studio: no GPU or map runtime.
  // CV/download links still win over a stale view parameter.
  if (url.searchParams.get('view') === 'live-projects' && route.view !== 'cv' && !route.downloadCv) {
    hideIntroForDeepLink();
    document.documentElement.classList.remove('gallery-pending', 'gallery-experience');
    try {
      const {startLiveProjects} = await import('./liveProjects.js');
      window.__liveProjects = startLiveProjects();
    } catch (error) {
      console.error('The live-project studio could not start.', error);
      document.getElementById('app').innerHTML = `<main class="live-projects-recovery">
        <a href="/">← Batıkan<span class="portfolio-wordmark-accent">or</span></a><h1>Explore live projects</h1>
        <p>The studio could not load. You can still visit each project directly.</p>
        <a href="https://maptheory.org/">Maptheory ↗</a>
        <a href="https://spacecottbus.com/">NASA Space Apps Cottbus ↗</a>
        <a href="https://cottbus.maptheory.org/">Map of Cottbus ↗</a>
        <a href="https://gralobe.maptheory.org/">Gralobe ↗</a>
        <a href="/?view=world">Explore achievements →</a></main>`;
    } finally {
      document.documentElement.classList.remove('live-projects-pending');
    }
    return;
  }
  const roomRequested = (document.documentElement.dataset.portfolioExperience === 'gallery'
    || url.searchParams.get('prototype') === 'room') && url.searchParams.get('experience') !== 'earth';
  if(roomRequested)document.documentElement.classList.add('gallery-experience');
  if (roomRequested && route.view !== 'cv' && !route.downloadCv) {
    if(shouldShowIntro(location.href)) {
      await enterGalleryFromIntro();
      return;
    }
    hideIntroForDeepLink();
    try {
      const destination = await prepareGallery();
      if (destination.kind==='static') openStaticPortfolio();
    } catch (error) {
      console.error('The gallery could not start; opening the authored project page.', error);
      openStaticPortfolio();
    }
    return;
  }
  document.documentElement.classList.remove('gallery-pending');
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
  await firstPaint();
  const destinationPromise = startPortfolio({deferActivation:true}).catch(error => {
    console.error('Portfolio could not start.', error);
    const introStatus = document.getElementById('intro-load-status');
    introStatus.textContent = 'The map could not load. Open the projects page to continue.';
    introStatus.classList.add('is-error');
    document.getElementById('intro-enter').hidden = true;
    const recovery = document.getElementById('intro-fallback-link');
    recovery.hidden = false;
    recovery.focus({preventScroll:true});
    return 'error';
  });
  await entered;
  const destination = await destinationPromise;
  if (destination === 'redirect') return;
  if (destination === 'error') return;
  if (destination === 'static') { openStaticPortfolio(); return; }
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
