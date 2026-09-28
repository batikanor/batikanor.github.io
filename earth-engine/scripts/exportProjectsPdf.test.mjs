import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {driveThumbnailUrl, exportProjectsPdf, markdownLinks, mediaUrl, plainProjectText, projectBlocks} from '../src/exportProjectsPdf.js';

test('PDF content preserves all original narrative text and all 66 media positions', () => {
  assert.equal(contestsAndActivities.length, 32);
  let mediaCount = 0;
  for (const project of contestsAndActivities) {
    const blocks = projectBlocks(project);
    const actualText = blocks.filter(block => block.type === 'paragraph').map(block => block.text).join(' ').replace(/\s+/g, ' ').trim();
    const expectedText = plainProjectText(project.longDescription.replace(/\{\{(?:image|embed|gdrive_embed)\[\d+\]\}\}/g, ' ')).replace(/\s+/g, ' ').trim();
    assert.equal(actualText, expectedText, `${project.slug}: description was shortened`);
    const media = blocks.filter(block => block.type === 'media');
    assert.equal(media.length, (project.images?.length ?? 0) + (project.gdrive_embed?.length ?? 0), `${project.slug}: missing media`);
    for (const item of media) assert.ok(mediaUrl(item.item), `${project.slug}: empty media URL`);
    mediaCount += media.length;
    for (const link of markdownLinks(project.longDescription)) assert.match(link.url, /^https?:\/\//);
  }
  assert.equal(mediaCount, 66);
});

test('on-demand PDF builds all 32 canonical projects with Unicode font and clickable references', async () => {
  const font = readFileSync(new URL('../public/fonts/BatiPortfolioSans-Regular.ttf', import.meta.url));
  const progress = [];
  const pdf = await exportProjectsPdf({
    includeImages: false,
    save: false,
    fetcher: async () => new Response(font),
    onProgress: state => progress.push(state)
  });
  const bytes = pdf.output();
  assert.match(bytes.slice(0, 8), /^%PDF-/);
  assert.ok(pdf.getNumberOfPages() > 20);
  assert.match(bytes, /\/Subtype \/Link/);
  assert.equal([...bytes.matchAll(/\/Dest/g)].length, 32, 'every TOC title must jump to an achievement');
  assert.match(bytes, /https:\/\/batikanor\.com\/#tesla-gigathon-2026/);
  assert.doesNotMatch(bytes, /127\.0\.0\.1/, 'PDF links must remain shareable outside localhost');
  assert.match(bytes, /https:\/\/docs\.google\.com/);
  assert.equal(progress.at(-1).index, 32);
});

test('configurable PDF export resolves public Drive previews without a broken CORS redirect', () => {
  assert.equal(
    driveThumbnailUrl('https://drive.google.com/file/d/abc_123/view?usp=sharing'),
    'https://lh3.googleusercontent.com/d/abc_123=w1200'
  );
  assert.equal(driveThumbnailUrl('https://docs.google.com/presentation/d/example/embed'), null);
  assert.equal(driveThumbnailUrl('/photos/tesla.jpg'), null);
});

test('PDF image size and compression controls reject values outside the production control range', async () => {
  await assert.rejects(() => exportProjectsPdf({imageScale: 0.1, save: false}), RangeError);
  await assert.rejects(() => exportProjectsPdf({compressionStrength: 1, save: false}), RangeError);
});
