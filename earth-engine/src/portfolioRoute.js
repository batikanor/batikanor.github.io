/** Browser-address compatibility for old portfolio links and new map history. */
export function readPortfolioRoute(href, knownSlugs = new Set()) {
  const url = new URL(href);
  const path = url.pathname.replace(/\/index\.html$/, '').replace(/\/+$/, '');
  const querySlug = url.searchParams.get('event');
  let hash = '';
  try { hash = decodeURIComponent(url.hash.slice(1)); } catch { /* Ignore malformed old anchors. */ }
  const eventSlug = knownSlugs.has(querySlug) ? querySlug : knownSlugs.has(hash) ? hash : null;
  const view = url.searchParams.get('view') === 'cv' || hash === 'cv' || path === '/cv' || path === '/cv/en' ? 'cv'
    : url.searchParams.get('view') === 'world' ? 'world' : null;
  return { eventSlug, view, downloadCv: url.searchParams.get('download') === 'cv' };
}

export function portfolioUrl(href, { eventSlug, view = null } = {}) {
  const url = new URL(href);
  url.pathname = '/';
  url.hash = '';
  if (eventSlug) url.searchParams.set('event', eventSlug);
  else url.searchParams.delete('event');
  if (view) url.searchParams.set('view', view);
  else url.searchParams.delete('view');
  url.searchParams.delete('download');
  return url;
}


/** Leave a standalone CV alias for the site, never reload the same CV path. */
export function cvDestinationUrl(href, eventSlug = null) {
  const url = new URL(href);
  url.pathname = '/';
  url.searchParams.delete('view');
  url.searchParams.delete('download');
  url.hash = '';
  if (eventSlug) url.searchParams.set('event', eventSlug);
  return url;
}
