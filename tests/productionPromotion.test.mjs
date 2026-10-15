import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, mkdir, readFile, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareProduction, productionMetadata} from '../deploy/production/prepare.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const origin = 'https://staging.batikanor.com';
const manifest = {entry: '/assets/index-reviewed.js', mapEntry: '/assets/main-reviewed.js',
  roomEntry: '/assets/galleryRoom-reviewed.js', experience: 'gallery-room-prototype'};
const meta = `<meta name="robots" content="noindex, nofollow, noarchive"><meta content='noindex, nofollow' name='googlebot'>`;
const rsc = `{"name":"robots","content":"noindex, nofollow"},{"name":"googlebot","content":"noindex, nofollow, noarchive"}`;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'batikan-production-'));
  const source = join(root, 'frozen'), output = join(root, 'production'), review = join(root, 'review.json');
  const files = {'index.html': `<html data-portfolio-experience="gallery"><head>${meta}<link rel="canonical" href="${origin}/"></head><body><script>${JSON.stringify(rsc)}</script></body></html>`,
    'assets/earth-current.json': JSON.stringify(manifest) + '\n', 'robots.txt': 'User-agent: *\nDisallow: /\n',
    'assets/index-reviewed.js': `const allowed=['batikanor.com','staging.batikanor.com'];`,
    'assets/main-reviewed.js': `const fallback='noindex';`, 'assets/galleryRoom-reviewed.js': 'export const room=true;',
    'assets/room.css': '.room{font-size:13px}', 'photos/prize.png': Buffer.from([0, 255, 4, 8]),
    'fonts/OFL.txt': 'Copyright test font\n', '404.html': meta,
    'index.txt': `${rsc},"${origin}/"`};
  for (const route of ['cv', 'cv/en', 'projects', 'projects/en', 'sui', 'solana', 'lab', 'game', 'catalyst-run', 'explore-projects-world', 'demo/1', 'demo/2']) {
    files[`${route}/index.html`] = `<html><head>${meta}</head><body>Original ${route} prose; noindex is a word.</body></html>`;
    files[`${route}/index.txt`] = `${rsc},"${origin}/${route}/"`;
  }
  for (let i = 1; i <= 32; i++) files[`achievements/project-${i}/index.html`] = `<html><head>${meta}</head><body>Authored achievement ${i}</body></html>`;
  const artifacts = {};
  for (const [path, bytes] of Object.entries(files)) {
    await mkdir(join(source, path, '..'), {recursive: true});
    await writeFile(join(source, path), bytes);
    artifacts[path] = hash(bytes);
  }
  const prepared = {manifest, artifacts};
  await writeFile(review, JSON.stringify(prepared));
  return {root, source, output, review, prepared, files,
    async updateReview() { await writeFile(review, JSON.stringify(prepared)); }};
}

test('production metadata updates HTML and both RSC representations, preserving prose and error-page indexing', () => {
  const input = `${meta}<script>${JSON.stringify(rsc)}</script>${rsc}<p>noindex, nofollow and noarchive are prose.</p><link href="${origin}/cv/">`;
  const result = productionMetadata(input);
  assert.match(result, /content="index,follow"/);
  assert.match(result, /content='index,follow'/);
  assert.ok(result.includes('"content":"index,follow"'));
  assert.ok(result.includes('\\"content\\":\\"index,follow\\"'));
  assert.ok(result.includes('<p>noindex, nofollow and noarchive are prose.</p>'));
  assert.ok(result.includes('https://batikanor.com/cv/'));
  assert.equal(productionMetadata(input, {keepNoindex: true}), input.replaceAll(origin, 'https://batikanor.com'));
});

test('frozen promotion keeps every application/media byte, all legacy routes, and gallery manifest while replacing environment metadata', async () => {
  const f = await fixture();
  try {
    const result = await prepareProduction(f);
    assert.equal(result.achievementCount, 32);
    assert.equal(result.cname, 'www.batikanor.com');
    assert.deepEqual(result.reviewedManifest, manifest);
    for (const [path, original] of Object.entries(f.files)) {
      assert.equal(hash(await readFile(join(f.source, path))), hash(original), `staging untouched: ${path}`);
      const published = await readFile(join(f.output, path));
      if (/\.(?:js|css|png)$/.test(path) || ['assets/earth-current.json', 'fonts/OFL.txt'].includes(path))
        assert.equal(hash(published), hash(original), `immutable bytes: ${path}`);
      if (path.endsWith('.html') || path.endsWith('index.txt')) {
        assert.ok(!published.includes(origin), path);
        if (path !== '404.html') assert.ok(published.includes('index,follow'), path);
      }
    }
    assert.ok((await readFile(join(f.output, '404.html'), 'utf8')).includes('noindex'));
    assert.equal(await readFile(join(f.output, 'CNAME'), 'utf8'), 'www.batikanor.com');
    assert.equal(await readFile(join(f.output, 'robots.txt'), 'utf8'), 'User-agent: *\nAllow: /\nSitemap: https://batikanor.com/sitemap.xml\n');
    const sitemap = await readFile(join(f.output, 'sitemap.xml'), 'utf8');
    assert.equal((sitemap.match(/<loc>/g) || []).length, 35);
    assert.ok(sitemap.includes('https://batikanor.com/achievements/project-32/'));
    assert.ok((await readFile(join(f.output, 'index.html'), 'utf8')).includes('data-portfolio-experience="gallery"'));
    assert.ok((await readFile(join(f.output, 'projects/index.html'), 'utf8')).includes('Original projects prose; noindex is a word.'));
    await assert.rejects(prepareProduction(f), /overwrite/);
  } finally { await rm(f.root, {recursive: true, force: true}); }
});

test('promotion rejects changed reviewed bytes, malformed paths, a missing reviewed runtime or non-gallery manifest', async () => {
  for (const mode of ['changed', 'path', 'runtime', 'experience', 'article-count', 'route']) {
    const f = await fixture();
    try {
      if (mode === 'changed') await writeFile(join(f.source, 'assets/galleryRoom-reviewed.js'), 'unreviewed change');
      if (mode === 'path') f.prepared.artifacts['../escape.js'] = '0'.repeat(64);
      if (mode === 'runtime') delete f.prepared.artifacts['assets/galleryRoom-reviewed.js'];
      if (mode === 'experience') {
        f.prepared.manifest = {...manifest, experience: 'earth'};
        const bytes = JSON.stringify(f.prepared.manifest) + '\n';
        await writeFile(join(f.source, 'assets/earth-current.json'), bytes);
        f.prepared.artifacts['assets/earth-current.json'] = hash(bytes);
      }
      if (mode === 'article-count') delete f.prepared.artifacts['achievements/project-32/index.html'];
      if (mode === 'route') { await rm(join(f.source, 'cv/en/index.html')); delete f.prepared.artifacts['cv/en/index.html']; }
      await f.updateReview();
      await assert.rejects(prepareProduction(f), /hash mismatch|Invalid reviewed|Unreviewed runtime|not the gallery|Expected 32|Missing frozen route/, mode);
    } finally { await rm(f.root, {recursive: true, force: true}); }
  }
});

test('promotion refuses source/output overlap, unsafe CNAME and symlink input', async () => {
  const f = await fixture();
  try {
    await assert.rejects(prepareProduction({...f, output: join(f.source, 'production')}), /separate/);
    await assert.rejects(prepareProduction({...f, cname: 'other.example'}), /CNAME/);
    await symlink(join(f.source, 'index.html'), join(f.source, 'outside-link'));
    await assert.rejects(prepareProduction(f), /symlink/);
  } finally { await rm(f.root, {recursive: true, force: true}); }
});
