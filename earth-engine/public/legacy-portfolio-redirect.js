// Keep bookmarked production portfolio paths usable in the static replacement.
// Preserve the achievement slug from /projects/#slug instead of losing it in a
// generic SPA rewrite. The root app canonicalizes legacy #slug and #cv too.
(() => {
  const path = location.pathname.replace(/\/+$/, '');
  const destination = new URL('/', location.href);
  for (const [key, value] of new URLSearchParams(location.search)) destination.searchParams.set(key, value);
  let anchor = '';
  try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { /* Use the map default. */ }
  if (anchor && anchor !== 'cv') destination.searchParams.set('event', anchor);
  if (path === '/cv' || path === '/cv/en' || anchor === 'cv') destination.searchParams.set('view', 'cv');
  if (path === '/cv/en') destination.searchParams.set('download', 'cv');
  location.replace(destination.href);
})();
