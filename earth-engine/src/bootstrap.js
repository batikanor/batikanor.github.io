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

async function start() {
  const forceList = new URLSearchParams(location.search).get('view') === 'list';
  if (forceList || !supportsWebGl2()) {
    const {startFallback} = await import('./fallback.js');
    startFallback();
    return;
  }
  try {
    await import('./main.js');
  } catch (error) {
    console.error('Interactive map could not start; switching to the portfolio list.', error);
    // A partially evaluated map module may have bound handlers. Reloading a
    // clean document avoids duplicate controls and leaves the source URL intact.
    const url = new URL(location.href);
    url.searchParams.set('view', 'list');
    location.replace(url.href);
  }
}

start().catch(error => {
  console.error('Portfolio could not start.', error);
  const status = document.getElementById('status');
  if (status) {
    status.className = 'bootstrap-error';
    status.textContent = 'The portfolio could not load. Please refresh or try another browser.';
  }
});
