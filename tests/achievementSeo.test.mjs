import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  achievementPages, escapeHtml, renderAchievementPage, renderNoScriptIndex, renderSitemap, writeAchievementPages
} from '../scripts/achievement-seo.mjs';

test('every achievement has a distinct crawlable production page and sitemap URL', () => {
  const sitemap = renderSitemap();
  assert.equal(achievementPages.length, 32);
  assert.equal(new Set(achievementPages.map(item => item.slug)).size, achievementPages.length);
  assert.equal((sitemap.match(/<loc>/g) || []).length, achievementPages.length + 3);
  assert.match(sitemap, /<loc>https:\/\/batikanor\.com\/cv\/<\/loc>/);
  for (const [index, item] of achievementPages.entries()) {
    const url = `https://batikanor.com/achievements/${item.slug}/`;
    const html = renderAchievementPage(item, index);
    assert.ok(sitemap.includes(`<loc>${url}</loc>`), item.slug);
    assert.ok(html.includes(`<link rel="canonical" href="${url}" />`), item.slug);
    assert.ok(html.includes('name="robots" content="index,follow"'), item.slug);
    assert.ok(html.includes(`/?event=${item.slug}`), item.slug);
    assert.ok(html.includes('application/ld+json'), item.slug);
    assert.ok(html.includes('<h1>'), item.slug);
    assert.ok(html.includes(escapeHtml(item.shortDescription || item.title).slice(0, 35)), item.slug);
    assert.ok(!html.includes('{{gdrive_embed['), item.slug);
    for (const media of item.gdrive_embed ?? []) {
      assert.ok(html.includes(escapeHtml(media.url)), `${item.slug}: missing authored media URL ${media.url}`);
      if (media.abovePhotoCaption) assert.ok(html.includes(escapeHtml(media.abovePhotoCaption)), `${item.slug}: missing authored caption`);
    }
  }
});

test('staging pages stay noindex and never canonicalize to production', () => {
  for (const [index, item] of achievementPages.entries()) {
    const html = renderAchievementPage(item, index, {staging: true});
    assert.ok(html.includes('name="robots" content="noindex,nofollow"'), item.slug);
    assert.ok(html.includes(`href="https://staging.batikanor.com/achievements/${item.slug}/"`), item.slug);
    assert.ok(!html.includes('href="https://batikanor.com/achievements/'), item.slug);
  }
});

test('generated pages use existing media and safe escaped structured data', () => {
  const tesla = achievementPages.find(item => item.slug === 'tesla-gigathon-2026');
  const html = renderAchievementPage(tesla, 0);
  assert.match(html, /src="\/photos\/tesla-gigathon\/tesla-gigathon-2026-first-place-prize\.jpg"/);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([^<]+)<\/script>/)[1]);
  assert.equal(schema['@type'], 'WebPage');
  assert.equal(schema.name, tesla.title);
  assert.equal(schema.author.name, 'Batıkan Bora Ormancı');
  assert.match(html, /alt="My photo with the 1st place prize"/);
});

test('no-JavaScript map fallback links to every actual achievement without extra copy', () => {
  const fallback = renderNoScriptIndex();
  assert.match(fallback, /<noscript>/);
  assert.match(fallback, /\/cv\//);
  for (const item of achievementPages) {
    assert.ok(fallback.includes(`/achievements/${item.slug}/`), item.slug);
  }
});

test('writes all static pages without needing Next, map JS or external services', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'batikan-achievement-seo-'));
  try {
    await writeAchievementPages(directory, {staging: true});
    const sample = await readFile(join(directory, 'achievements', 'ethrome-2025', 'index.html'), 'utf8');
    const stylesheet = await readFile(join(directory, 'seo', 'achievement.css'), 'utf8');
    assert.match(sample, /noindex,nofollow/);
    assert.match(sample, /3rd Place \(Zama\)/);
    assert.match(stylesheet, /@media\(max-width:650px\)/);
  } finally {
    await rm(directory, {recursive: true, force: true});
  }
});
