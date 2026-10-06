/**
 * Publish the Vite Earth homepage inside the existing Next.js Pages export.
 * Never replace the whole `out/` directory: /sui, project archives, games,
 * public certificates, and the custom-domain CNAME must keep working.
 */
import {createHash} from 'node:crypto';
import {readFile, readdir, mkdir, writeFile, copyFile, cp, rm, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderNoScriptIndex, renderSitemap, writeAchievementPages} from './achievement-seo.mjs';
import {writeCvPages} from './cv-pages.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The default remains the GitHub Pages release. Staging is a separate copy of
// the same Next export, so preparing a preview cannot overwrite the artifact
// used by the production workflow or its CNAME.
const target = process.env.EARTH_DEPLOY_TARGET || 'production';
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(target === 'production' || target === 'staging', `Unknown Earth deployment target: ${target}`);
const staging = target === 'staging';
const baseOut = join(root, 'out');
const out = staging ? join(root, 'staging-dist') : baseOut;
const earth = join(root, 'earth-engine', 'dist');
const preserved = [
  'CNAME', 'favicon.ico',
  'sui/index.html', 'solana/index.html', 'lab/index.html', 'game/index.html',
  'catalyst-run/index.html', 'explore-projects-world/index.html',
  'demo/1/index.html', 'demo/2/index.html', 'projects/index.html'
];

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}
async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}
async function mergeDirectory(source, destination) {
  await mkdir(destination, {recursive: true});
  for (const item of await readdir(source, {withFileTypes: true})) {
    const from = join(source, item.name);
    const to = join(destination, item.name);
    if (item.isDirectory()) {
      await mergeDirectory(from, to);
    } else if (item.isFile()) {
      // The same local photos/PDFs are present in both source sites. A
      // conflicting copy would silently replace an old public link; fail.
      if (await exists(to)) {
        assert(await sha256(from) === await sha256(to), `Earth asset conflicts with legacy asset: ${to}`);
      } else {
        await copyFile(from, to);
      }
    }
  }
}

if (staging) {
  assert(await exists(baseOut), 'Build the Next.js static export into out/ before preparing staging');
  await rm(out, {recursive: true, force: true});
  await cp(baseOut, out, {recursive: true});
}
for (const item of preserved) assert(await exists(join(out, item)), `Missing legacy output before overlay: ${item}`);
const checksums = new Map(await Promise.all(preserved.map(async item => [item, await sha256(join(out, item))])));
const assetFiles = await readdir(join(earth, 'assets'));
for (const file of assetFiles.filter(name => name.endsWith('.js'))) {
  const script = await readFile(join(earth, 'assets', file), 'utf8');
  assert(!script.includes('tiles.maps.eox.at') && !script.includes('s2cloudless-2024'),
    `Non-commercial EOX provider survived the public build in ${file}`);
}

let html = await readFile(join(earth, 'index.html'), 'utf8');
assert(html.includes('name="robots" content="noindex,nofollow"'), 'Earth preview indexing guard changed unexpectedly');
// GitHub Pages gives HTML a short but nonzero cache lifetime. If that HTML
// points straight to a fingerprinted Vite entry, a second deployment can
// remove the old entry before a returning visitor's HTML cache expires. Keep
// the HTML bootstrap stable and ask for a fresh, tiny manifest at each load.
const entryTag = /<script type="module" crossorigin src="(\/assets\/index-[A-Za-z0-9_-]+\.js)"><\/script>/;
const entryMatch = html.match(entryTag);
assert(entryMatch && await exists(join(earth, entryMatch[1].slice(1))),
  'Could not resolve the public Earth entry bundle');
const entryScript=await readFile(join(earth,entryMatch[1].slice(1)),'utf8');
const mapEntryMatch=entryScript.match(/\.\/(main-[A-Za-z0-9_-]+\.js)/);
assert(mapEntryMatch&&await exists(join(earth,'assets',mapEntryMatch[1])), 'Could not resolve current map runtime');
html = html.replace(entryTag, `<script type="module">
  try {
    const response = await fetch('/assets/earth-current.json?t=' + Date.now(), {cache: 'no-store'});
    if (!response.ok) throw new Error('Earth release manifest unavailable');
    const {entry, mapEntry} = await response.json();
    if (!/^\\/assets\\/index-[A-Za-z0-9_-]+\\.js$/.test(entry)) throw new Error('Invalid Earth release entry');
    // Start the large map download alongside the small bootstrap, not after
    // it. CV/list routes deliberately avoid this speculative runtime work.
    const path = location.pathname.replace(/\\/index\\.html$/, '').replace(/\\/+$/, '');
    let hash = '';
    try { hash = decodeURIComponent(location.hash.slice(1)); } catch { /* Ignore malformed old anchors. */ }
    const cvRoute = path === '/cv' || path === '/cv/en' || hash === 'cv';
    const view = cvRoute ? 'cv' : new URLSearchParams(location.search).get('view');
    if (view !== 'cv' && view !== 'list' && /^\\/assets\\/main-[A-Za-z0-9_-]+\\.js$/.test(mapEntry || '')) {
      const preload = document.createElement('link');
      preload.rel = 'modulepreload'; preload.href = mapEntry; preload.crossOrigin = 'anonymous';
      document.head.append(preload);
    }
    await import(entry);
  } catch (error) {
    console.error('Earth portfolio could not start.', error);
    const status = document.getElementById('status');
    if (status) status.textContent = 'Map could not start. Please reload the page.';
  }
</script>`);
if (!staging) html = html.replace('name="robots" content="noindex,nofollow"', 'name="robots" content="index,follow"');
const eoxButton = /<button data-imagery="eox"[^>]*>[^<]*(?:<small>[^<]*<\/small>)?<\/button>\s*/;
assert(eoxButton.test(html), 'Could not remove EOX switch from public homepage');
html = html.replace(eoxButton, '');
html = html.replace('data-imagery="esa" type="button" aria-pressed="false"',
  'data-imagery="esa" type="button" aria-pressed="true"');
const credit = /<span id="imagery-credit">[\s\S]*?<\/span>/;
assert(credit.test(html), 'Could not replace the initial EOX credit');
html = html.replace(credit,
  '<span id="imagery-credit"><a href="https://esa-worldcover.org/en/data-access">© ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/">NASA Blue Marble underlay</a></span>');
html = html.replace('</head>', `  <link rel="canonical" href="https://${staging ? 'staging.' : ''}batikanor.com/" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://${staging ? 'staging.' : ''}batikanor.com/" />
  <meta property="og:title" content="Batıkan — Hacker · Developer · Entrepreneur" />
  <meta property="og:description" content="Batıkan Bora Ormancı’s portfolio: competition wins, projects, software work and an interactive Earth map." />
  <meta property="og:image" content="https://${staging ? 'staging.' : ''}batikanor.com/seo/batikan-social.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Batıkan — Hacker · Developer · Entrepreneur" />
  <meta name="twitter:card" content="summary_large_image" />
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@graph': [{
      '@type': 'WebSite', '@id': `https://${staging ? 'staging.' : ''}batikanor.com/#website`,
      url: `https://${staging ? 'staging.' : ''}batikanor.com/`,
      name: 'Batıkan — Hacker · Developer · Entrepreneur'
    }, {
      '@type': 'ProfilePage', '@id': `https://${staging ? 'staging.' : ''}batikanor.com/#profile`,
      url: `https://${staging ? 'staging.' : ''}batikanor.com/`,
      name: 'Batıkan — Hacker · Developer · Entrepreneur',
      isPartOf: {'@id': `https://${staging ? 'staging.' : ''}batikanor.com/#website`},
      mainEntity: {
        '@type': 'Person', name: 'Batıkan Bora Ormancı',
        url: `https://${staging ? 'staging.' : ''}batikanor.com/`,
        sameAs: ['https://github.com/batikanor', 'https://linkedin.com/in/batikanor']
      }
    }]
  }).replace(/</g, '\\u003c')}</script>
</head>`);
html = html.replace('A geographically real Earth, streamed at the scale of an achievement journey.',
  'Batıkan Bora Ormancı’s portfolio: competition wins, projects, software work and an interactive Earth map.');
html = html.replace('</body>', `${renderNoScriptIndex()}\n</body>`);
assert(!html.includes('data-imagery="eox"'), 'Non-commercial EOX control survived the build');
assert(staging ? html.includes('name="robots" content="noindex,nofollow"') : !html.includes('noindex'),
  `Incorrect robots policy for ${target}`);

for (const directory of ['assets', 'data', 'fonts', 'photos', 'certificates', 'other']) {
  const from = join(earth, directory);
  if (await exists(from)) await mergeDirectory(from, join(out, directory));
}
// Root-scoped, Earth-only cache worker. Never intercepts shell/navigation HTML.
assert(await exists(join(earth,'earth-cache-sw.js')),'Earth cache worker missing from build');
await copyFile(join(earth,'earth-cache-sw.js'),join(out,'earth-cache-sw.js'));
await writeFile(join(out, 'assets', 'earth-current.json'),
  JSON.stringify({entry: entryMatch[1],mapEntry:`/assets/${mapEntryMatch[1]}`}) + '\n');
await writeFile(join(out, 'index.html'), html);
await writeAchievementPages(out, {staging});
await writeCvPages(out, html, {staging});
if (staging) {
  await writeFile(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  await rm(join(out, 'sitemap.xml'), {force: true});
} else {
  await writeFile(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://batikanor.com/sitemap.xml\n');
  await writeFile(join(out, 'sitemap.xml'), renderSitemap());
}
for (const [item, before] of checksums) {
  assert(await sha256(join(out, item)) === before, `Legacy output changed during overlay: ${item}`);
}
if (staging) await rm(join(out, 'CNAME'));
console.log(`Overlayed ${target} Earth homepage, both CV routes and ${assetFiles.length} built assets without changing ${preserved.length - (staging ? 1 : 0)} legacy routes/files.`);
