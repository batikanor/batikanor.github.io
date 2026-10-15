/** Keep shared project, CV and world links immediately addressable. */
export function shouldShowIntro(href) {
  const url = new URL(href);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path !== '/' && path !== '/index.html') return false;
  return !url.searchParams.has('event')
    && !url.searchParams.has('view')
    && !url.searchParams.has('download')
    && !url.hash;
}
