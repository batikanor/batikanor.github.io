/** Promote a frozen, reviewed staging export without rebuilding its application. */
import {createHash} from 'node:crypto';
import {cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import {dirname, isAbsolute, join, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const STAGING = 'https://staging.batikanor.com';
const PRODUCTION = 'https://batikanor.com';
const REQUIRED = ['index.html', 'cv/index.html', 'cv/en/index.html', 'projects/index.html',
  'projects/en/index.html', 'sui/index.html', 'solana/index.html', 'lab/index.html',
  'game/index.html', 'catalyst-run/index.html', 'explore-projects-world/index.html',
  'demo/1/index.html', 'demo/2/index.html', 'assets/earth-current.json', 'robots.txt'];
const fail = (condition, message) => { if (!condition) throw new Error(message); };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const inside = (parent, child) => child === parent || child.startsWith(parent + sep);
const errorPage = path => /^404(?:\/index)?\.(?:html|txt)$/.test(path);
const metadataFile = path => path.endsWith('.html') || /(?:^|\/)index\.txt$/.test(path);

function robots(value) {
  return value.split(',').map(part => part.trim()).filter(part => part && part.toLowerCase() !== 'noarchive')
    .map(part => ({noindex: 'index', nofollow: 'follow'}[part.toLowerCase()] || part)).join(',');
}

/** Next exports include metadata in HTML, escaped flight data, and index.txt. */
export function productionMetadata(text, {keepNoindex = false} = {}) {
  let result = text.replaceAll(STAGING, PRODUCTION);
  if (keepNoindex) return result;
  result = result.replace(/<meta\b[^>]*>/gi, tag => {
    if (!/\bname\s*=\s*(["'])(?:robots|googlebot)\1/i.test(tag)) return tag;
    return tag.replace(/(\bcontent\s*=\s*)(["'])(.*?)\2/i,
      (_match, prefix, quote, value) => `${prefix}${quote}${robots(value)}${quote}`);
  });
  // Both JSON in .txt and its escaped representation inside an HTML script.
  result = result.replace(/(\\?"name\\?"\s*:\s*\\?"(?:robots|googlebot)\\?"\s*,\s*\\?"content\\?"\s*:\s*\\?")([^"\\]*)(\\?")/g,
    (_match, prefix, value, quote) => prefix + robots(value) + quote);
  return result;
}

async function filesAt(directory, prefix = '') {
  const files = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = join(directory, entry.name);
    fail(!entry.isSymbolicLink(), `Frozen export contains a symlink: ${name}`);
    if (entry.isDirectory()) files.push(...await filesAt(path, name));
    else { fail(entry.isFile(), `Unsupported frozen export entry: ${name}`); files.push(name); }
  }
  return files.sort();
}

function safeRelative(path) {
  return typeof path === 'string' && path && !isAbsolute(path) && !path.includes('\\') &&
    path.split('/').every(part => part && part !== '.' && part !== '..');
}

function sitemap(slugs) {
  const paths = ['/', '/projects/', '/cv/', ...slugs.map(slug => `/achievements/${slug}/`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${PRODUCTION}${path}</loc></url>`).join('\n')}\n</urlset>\n`;
}

export async function prepareProduction({source, review, output, cname = 'www.batikanor.com'}) {
  fail(source && review && output, 'Explicit source, review and output paths are required');
  source = resolve(source); output = resolve(output);
  fail(!inside(source, output) && !inside(output, source), 'Source and output must be separate directories');
  fail(['www.batikanor.com', 'batikanor.com'].includes(cname), 'Unexpected production CNAME');
  fail(!(await lstat(output).catch(() => null)), 'Refusing to overwrite an existing production artifact');
  const sourceInfo = await lstat(source);
  fail(sourceInfo.isDirectory() && !sourceInfo.isSymbolicLink(), 'Frozen source must be a real directory');
  const prepared = JSON.parse(await readFile(resolve(review), 'utf8'));
  fail(prepared.artifacts && typeof prepared.artifacts === 'object' && !Array.isArray(prepared.artifacts), 'Review artifact hashes are missing');
  const paths = await filesAt(source), names = new Set(paths), hashes = {};
  for (const path of paths) hashes[path] = digest(await readFile(join(source, path)));
  for (const [path, expected] of Object.entries(prepared.artifacts)) {
    fail(safeRelative(path) && /^[0-9a-f]{64}$/.test(expected), `Invalid reviewed artifact: ${path}`);
    fail(hashes[path] === expected, `Reviewed artifact hash mismatch: ${path}`);
  }
  for (const path of REQUIRED) fail(names.has(path), `Missing frozen route: ${path}`);
  const manifest = JSON.parse(await readFile(join(source, 'assets/earth-current.json'), 'utf8'));
  fail(JSON.stringify(manifest) === JSON.stringify(prepared.manifest), 'Frozen gallery manifest differs from review');
  fail(manifest.experience === 'gallery-room-prototype', 'Reviewed release is not the gallery experience');
  for (const [key, pattern] of [['entry', /^\/assets\/index-[A-Za-z0-9_-]+\.js$/],
    ['mapEntry', /^\/assets\/main-[A-Za-z0-9_-]+\.js$/], ['roomEntry', /^\/assets\/galleryRoom-[A-Za-z0-9_-]+\.js$/]]) {
    fail(pattern.test(manifest[key] || ''), `Invalid gallery manifest ${key}`);
    const path = manifest[key].slice(1);
    fail(prepared.artifacts[path] && hashes[path] === prepared.artifacts[path], `Unreviewed runtime: ${path}`);
  }
  fail(prepared.artifacts['index.html'] && prepared.artifacts['assets/earth-current.json'], 'Homepage and gallery manifest must be reviewed');
  const articlePaths = Object.keys(prepared.artifacts).filter(path => /^achievements\/[a-z0-9]+(?:-[a-z0-9]+)*\/index\.html$/.test(path));
  fail(articlePaths.length === 32, `Expected 32 reviewed achievement pages; found ${articlePaths.length}`);
  const actualArticles = paths.filter(path => /^achievements\/[^/]+\/index\.html$/.test(path));
  fail(actualArticles.length === articlePaths.length && actualArticles.every(path => articlePaths.includes(path)), 'Frozen achievement routes differ from review');
  const slugs = articlePaths.map(path => path.split('/')[1]);
  const home = await readFile(join(source, 'index.html'), 'utf8');
  fail(home.includes('data-portfolio-experience="gallery"') && home.includes(`rel="canonical" href="${STAGING}/"`) &&
    /name="robots" content="noindex,\s*nofollow(?:,\s*noarchive)?"/.test(home), 'Source is not the reviewed staging gallery shell');
  fail((await readFile(join(source, 'robots.txt'), 'utf8')).includes('Disallow: /') &&
    !names.has('CNAME') && !names.has('sitemap.xml'), 'Source must be an isolated staging export');
  const temporary = `${output}.preparing-${process.pid}`;
  fail(!(await lstat(temporary).catch(() => null)), 'Temporary promotion directory already exists');
  await mkdir(dirname(output), {recursive: true});
  try {
    await cp(source, temporary, {recursive: true, force: false, errorOnExist: true, dereference: false});
    const changed = [];
    for (const path of paths) {
      const original = await readFile(join(temporary, path));
      fail(digest(original) === hashes[path], `Source changed during promotion: ${path}`);
      if (!metadataFile(path)) continue;
      const before = original.toString('utf8'), after = productionMetadata(before, {keepNoindex: errorPage(path)});
      if (after !== before) { await writeFile(join(temporary, path), after); changed.push(path); }
      fail(!after.includes(STAGING), `Staging metadata survived: ${path}`);
      if (!errorPage(path)) {
        fail(!/<meta\b[^>]*name=["'](?:robots|googlebot)["'][^>]*content=["'][^"']*noindex/i.test(after), `Production page remains noindex: ${path}`);
        fail(!/\\?"name\\?"\s*:\s*\\?"(?:robots|googlebot)\\?"\s*,\s*\\?"content\\?"\s*:\s*\\?"[^"\\]*noindex/.test(after), `Production RSC remains noindex: ${path}`);
      }
    }
    await writeFile(join(temporary, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${PRODUCTION}/sitemap.xml\n`);
    await writeFile(join(temporary, 'sitemap.xml'), sitemap(slugs));
    await writeFile(join(temporary, 'CNAME'), cname);
    changed.push('robots.txt', 'sitemap.xml', 'CNAME');
    const productionHashes = {}, immutable = [];
    for (const path of await filesAt(temporary)) {
      productionHashes[path] = digest(await readFile(join(temporary, path)));
      if (!changed.includes(path)) {
        fail(productionHashes[path] === hashes[path], `Non-metadata bytes changed: ${path}`);
        immutable.push(path);
      }
      if (/\.(?:js|css|woff2?|png|jpe?g|webp|avif|pdf|glb|bin)$/i.test(path))
        fail(productionHashes[path] === hashes[path], `Application or media bytes changed: ${path}`);
    }
    fail(productionHashes['assets/earth-current.json'] === hashes['assets/earth-current.json'], 'Gallery manifest changed');
    await rename(temporary, output);
    return {source, output, reviewedManifest: manifest, cname, achievementCount: slugs.length,
      reviewedArtifacts: Object.keys(prepared.artifacts).length, unchangedFiles: immutable.length,
      environmentChanges: changed.sort(), sourceHashes: hashes, productionHashes};
  } catch (error) {
    await rm(temporary, {recursive: true, force: true});
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i];
    fail(['--source', '--review', '--output', '--cname', '--report'].includes(key) && process.argv[i + 1],
      'Usage: node deploy/production/prepare.mjs --source FROZEN_EXPORT --review RELEASE_PREPARED_JSON --output NEW_DIRECTORY [--cname www.batikanor.com] [--report JSON_PATH]');
    fail(!(key.slice(2) in options), `Duplicate option: ${key}`);
    options[key.slice(2)] = process.argv[i + 1];
  }
  const result = await prepareProduction(options);
  if (options.report) await writeFile(resolve(options.report), JSON.stringify(result, null, 2) + '\n');
  const {sourceHashes, productionHashes, ...summary} = result;
  console.log(JSON.stringify(summary, null, 2));
}
