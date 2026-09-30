/** Keep shared project, CV, list and world links immediately addressable. */
export function shouldShowIntro(href) {
  const url = new URL(href);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/index.html') return false;
  return !url.searchParams.has('event')
    && !url.searchParams.has('view')
    && !url.searchParams.has('download')
    && !url.hash;
}

/** The list fallback may prewarm, but must not open an event behind the intro. */
export function shouldInitializeFallbackNeutral(href, introActive) {
  return !!introActive && shouldShowIntro(href);
}
