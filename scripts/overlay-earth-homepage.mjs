/**
 * Publish the Vite Earth homepage inside the existing Next.js Pages export.
 * Never replace the whole `out/` directory: /sui, CV, project archives, games,
 * public certificates, and the custom-domain CNAME must keep working.
 */
import {createHash} from 'node:crypto';
import {readFile, readdir, mkdir, writeFile, copyFile, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'out');
const earth = join(root, 'earth-engine', 'dist');
const preserved = [
  'CNAME', 'favicon.ico',
  'sui/index.html', 'solana/index.html', 'lab/index.html', 'game/index.html',
  'catalyst-run/index.html', 'explore-projects-world/index.html',
  'demo/1/index.html', 'demo/2/index.html', 'cv/index.html', 'projects/index.html'
];

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}
async function exists(file) {
  try { await stat(file); return true; } catch { return false; }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
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
html = html.replace('name="robots" content="noindex,nofollow"', 'name="robots" content="index,follow"');
const eoxButton = /<button data-imagery="eox"[^>]*>[^<]*(?:<small>[^<]*<\/small>)?<\/button>\s*/;
assert(eoxButton.test(html), 'Could not remove EOX switch from public homepage');
html = html.replace(eoxButton, '');
html = html.replace('data-imagery="esa" type="button" aria-pressed="false"',
  'data-imagery="esa" type="button" aria-pressed="true"');
const credit = /<span id="imagery-credit">[\s\S]*?<\/span>/;
assert(credit.test(html), 'Could not replace the initial EOX credit');
html = html.replace(credit,
  '<span id="imagery-credit"><a href="https://esa-worldcover.org/en/data-access">© ESA WorldCover project 2021</a> / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · <a href="https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/">NASA Blue Marble underlay</a></span>');
html = html.replace('</head>', `  <link rel="canonical" href="https://batikanor.com/" />
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://batikanor.com/" />
  <meta property="og:title" content="Batıkan — Hacker · Developer · Entrepreneur" />
  <meta property="og:description" content="Portfolio showcasing the projects and work of Batıkan Bora Ormancı." />
</head>`);
html = html.replace('A geographically real Earth, streamed at the scale of an achievement journey.',
  'Portfolio showcasing the projects and work of Batıkan Bora Ormancı.');
assert(!html.includes('noindex') && !html.includes('data-imagery="eox"'), 'Public homepage is still preview-only');

for (const directory of ['assets', 'data', 'fonts', 'photos', 'certificates', 'other']) {
  const from = join(earth, directory);
  if (await exists(from)) await mergeDirectory(from, join(out, directory));
}
await writeFile(join(out, 'index.html'), html);
await writeFile(join(out, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://batikanor.com/sitemap.xml\n');
await writeFile(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://batikanor.com/</loc></url>
  <url><loc>https://batikanor.com/projects/</loc></url>
  <url><loc>https://batikanor.com/cv/</loc></url>
</urlset>\n`);
for (const [item, before] of checksums) {
  assert(await sha256(join(out, item)) === before, `Legacy output changed during overlay: ${item}`);
}
console.log(`Overlayed public Earth homepage and ${assetFiles.length} built assets without changing ${preserved.length} legacy routes/files.`);
