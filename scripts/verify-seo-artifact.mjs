import {readFile, readdir, stat} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {achievementPages} from './achievement-seo.mjs';

const target = process.argv[2];
if (!['production', 'staging'].includes(target)) {
  throw new Error('Usage: node scripts/verify-seo-artifact.mjs production|staging');
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, target === 'staging' ? 'staging-dist' : 'out');
const origin = target === 'staging' ? 'https://staging.batikanor.com' : 'https://batikanor.com';
const read = path => readFile(join(out, path), 'utf8');
const exists = async path => stat(join(out, path)).then(() => true, () => false);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function* htmlFiles(directory) {
  for (const item of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, item.name);
    if (item.isDirectory()) yield* htmlFiles(path);
    else if (item.isFile() && item.name.endsWith('.html')) yield path;
  }
}

const home = await read('index.html');
assert(home.includes(`rel="canonical" href="${origin}/"`), `Incorrect ${target} homepage canonical`);
assert(home.includes(`content="${origin}/seo/batikan-social.png"`), `Missing ${target} social image`);
assert(await exists('seo/batikan-social.png'), 'Social image not exported');
assert(home.includes('application/ld+json'), 'Homepage structured data missing');
for (const item of achievementPages) {
  const path = `achievements/${item.slug}/index.html`;
  const html = await read(path);
  assert(html.includes(`rel="canonical" href="${origin}/achievements/${item.slug}/"`), `Incorrect canonical: ${path}`);
  assert(html.includes(`/?event=${item.slug}`), `Map deep link missing: ${path}`);
  assert(html.includes('application/ld+json'), `Structured data missing: ${path}`);
  assert(html.includes('<h1>'), `Heading missing: ${path}`);
  assert(html.includes(`name="robots" content="${target === 'staging' ? 'noindex,nofollow' : 'index,follow'}"`), `Incorrect robots: ${path}`);
}
for (const route of ['cv', 'cv/en']) {
  const html = await read(`${route}/index.html`);
  // /cv/en is a language-compatible alias of the same live document. Both
  // routes must render the current, map-free Earth CV view, not the retained
  // Next portfolio layout or the former automatic PDF-download page.
  assert(html.includes(`rel="canonical" href="${origin}/cv/"`), `Incorrect canonical: /${route}/`);
  assert(html.includes('id="cv-view-root"'), `Modern CV viewer mount missing: /${route}/`);
  assert(html.includes('/assets/earth-current.json'), `Stable Earth release bootstrap missing: /${route}/`);
  assert(/await\s+import\(entry\)/.test(html), `Earth runtime import missing: /${route}/`);
  assert(!html.includes('self.__next_f') && !/<script[^>]+src=["'][^"']*\/_next\//i.test(html),
    `Legacy Next layout survived: /${route}/`);
  assert(html.includes('<noscript>'), `No-JavaScript CV fallback missing: /${route}/`);
  assert(html.includes('1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w/preview?rm=minimal'),
    `Live CV Drive fallback missing: /${route}/`);
  assert(html.includes('1WJrlmn0cTgHiylnJaGbDYt_AX4li0fC8VFtORVIkh8w/export?format=pdf'),
    `Live CV PDF fallback missing: /${route}/`);
  assert(html.includes('application/ld+json'), `CV structured data missing: /${route}/`);
  const robots = target === 'staging' ? /name="robots" content="noindex,\s*nofollow/ : /name="robots" content="index,\s*follow/;
  assert(robots.test(html), `Incorrect robots policy: /${route}/`);
}
const projects = await read('projects/index.html');
assert(projects.includes(`rel="canonical" href="${origin}/projects/"`), 'Incorrect canonical: /projects/');
if (target === 'staging') assert(/name="robots" content="noindex,\s*nofollow/.test(projects), 'Missing noindex: /projects/');
if (target === 'staging') {
  assert(home.includes('name="robots" content="noindex,nofollow"'), 'Staging homepage must be noindex');
  assert(!(await exists('sitemap.xml')), 'Staging sitemap must not exist');
  assert(!(await exists('CNAME')), 'Staging CNAME must not exist');
  assert((await read('robots.txt')).includes('Disallow: /'), 'Staging robots.txt must disallow crawling');
  for await (const file of htmlFiles(out)) {
    const html = await readFile(file, 'utf8');
    assert(/<meta[^>]*name="robots"[^>]*content="noindex(?:[, ]|\b)/i.test(html), `Staging page lacks noindex: ${file}`);
  }
} else {
  assert(home.includes('name="robots" content="index,follow"'), 'Production homepage should be indexable');
  const sitemap = await read('sitemap.xml');
  for (const item of achievementPages) {
    assert(sitemap.includes(`<loc>${origin}/achievements/${item.slug}/</loc>`), `Sitemap omits ${item.slug}`);
  }
  assert((await read('robots.txt')).includes(`Sitemap: ${origin}/sitemap.xml`), 'Production robots.txt omits sitemap');
}
console.log(`Verified ${target} SEO artifact: homepage, ${achievementPages.length} pages, modern /cv and /cv/en, projects, robots, canonical, social image and structured data.`);
