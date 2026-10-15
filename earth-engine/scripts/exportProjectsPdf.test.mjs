import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {achievementStarFills, driveThumbnailUrl, exportProjectsPdf, fitPdfImage, markdownLinks, mediaUrl, pdfAchievementDestination, plainProjectText, projectBlocks} from '../src/exportProjectsPdf.js';

const fontFiles = new Map(['Regular', 'Bold'].map(style => [
  `/fonts/BatiPortfolioSans-${style}.ttf`,
  readFileSync(new URL(`../public/fonts/BatiPortfolioSans-${style}.ttf`, import.meta.url))
]));

function fontResponse(url) {
  assert.ok(fontFiles.has(url), `unexpected request while exporting without images: ${url}`);
  return new Response(fontFiles.get(url));
}

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

test('on-demand PDF builds all 32 canonical projects with Unicode fonts and exact clickable destinations', async () => {
  const progress = [];
  const requests = [];
  const pdf = await exportProjectsPdf({
    includeImages: false,
    save: false,
    fetcher: async url => { requests.push(url); return fontResponse(url); },
    onProgress: state => progress.push(state)
  });
  const bytes = pdf.output();
  assert.match(bytes.slice(0, 8), /^%PDF-/);
  assert.ok(pdf.getNumberOfPages() > 20);
  assert.match(bytes, /\/Subtype \/Link/);
  assert.equal([...bytes.matchAll(/\/Dest/g)].length, 32, 'every TOC title must jump to an achievement');
  const destinations = [...bytes.matchAll(/\/Dest\s*\[\s*(\d+)\s+0\s+R\s+\/FitH\s+([-\d.]+)\s*\]/g)];
  assert.equal(destinations.length, 32, 'every TOC link must preserve its header position and horizontal fit');
  assert.ok(Number(destinations[0][2]) > 700, 'first header target must use PDF points, not millimetres');
  const pointHeight = pdf.internal.pageSize.getHeight() * pdf.internal.scaleFactor;
  for (const [, , top] of destinations) {
    assert.ok(Number(top) >= 0 && Number(top) <= pointHeight, `destination ${top} is outside the page`);
  }
  for (const project of contestsAndActivities) {
    assert.ok(bytes.includes(`https://batikanor.com/#${encodeURIComponent(project.slug)}`), `${project.slug}: canonical achievement link missing`);
  }
  assert.match(bytes, /https:\/\/batikanor\.com\/#tesla-gigathon-2026/);
  assert.doesNotMatch(bytes, /127\.0\.0\.1/, 'PDF links must remain shareable outside localhost');
  assert.match(bytes, /https:\/\/docs\.google\.com/);
  assert.equal(progress.at(-1).index, 32);
  assert.deepEqual(requests, [...fontFiles.keys()], 'text-only export must fetch only its two same-origin Unicode fonts');
});

test('importance stars preserve authored fractional values instead of rounding every remainder to a half star', () => {
  assert.deepEqual(achievementStarFills(8.5), [1, 1, 1, 1, 0.25]);
  assert.deepEqual(achievementStarFills(9), [1, 1, 1, 1, 0.5]);
  assert.deepEqual(achievementStarFills(4), [1, 1]);
  assert.deepEqual(achievementStarFills(0), []);
  assert.deepEqual(achievementStarFills(-1), []);
  assert.deepEqual(achievementStarFills(12), [1, 1, 1, 1, 1]);
  for (const project of contestsAndActivities) {
    const fills = achievementStarFills(project.importance);
    assert.ok(fills.every(fill => fill > 0 && fill <= 1), `${project.slug}: invalid partial star`);
    assert.equal(fills.reduce((sum, fill) => sum + fill, 0), project.importance / 2, `${project.slug}: rating changed`);
  }
});

test('PDF image fitting preserves tall prize photos and wide screenshots within both dimensions', () => {
  const portrait = fitPdfImage(0.5, 118, 90);
  assert.deepEqual(portrait, {width: 45, height: 90});
  const landscape = fitPdfImage(2, 118, 90);
  assert.deepEqual(landscape, {width: 118, height: 59});
  const square = fitPdfImage(1, 118, 90);
  assert.deepEqual(square, {width: 90, height: 90});
  for (const ratio of [0.15, 0.75, 1.5, 5]) {
    const {width, height} = fitPdfImage(ratio, 118, 90);
    assert.ok(width <= 118 && height <= 90);
    assert.ok(Math.abs(width / height - ratio) < 1e-10, `aspect ratio ${ratio} was distorted`);
  }
  assert.throws(() => fitPdfImage(0, 118, 90), RangeError);
});

test('achievement links use top-aligned PDF point coordinates including explicit document scales', () => {
  const destination = pdfAchievementDestination(4, 23, 297);
  assert.equal(destination.pageNumber, 4);
  assert.equal(destination.magFactor, 'FitH');
  assert.ok(Math.abs(destination.top - 776.6929133858268) < 1e-8);
  assert.deepEqual(pdfAchievementDestination(2, 50, 800, 1), {pageNumber: 2, magFactor: 'FitH', top: 750});
});

test('pre-aborted export stops before requesting a font or media', async () => {
  const controller = new AbortController();
  controller.abort();
  let requests = 0;
  await assert.rejects(() => exportProjectsPdf({
    signal: controller.signal,
    save: false,
    fetcher: async () => { requests += 1; throw new Error('aborted export must not fetch'); }
  }), {name: 'AbortError'});
  assert.equal(requests, 0);
});

test('cancellation during font loading stops before loading the next font or rendering projects', async () => {
  const controller = new AbortController();
  const requests = [];
  const progress = [];
  await assert.rejects(() => exportProjectsPdf({
    signal: controller.signal,
    save: false,
    onProgress: state => progress.push(state),
    fetcher: async (url, {signal}) => {
      requests.push(url);
      assert.equal(signal, controller.signal);
      return {
        ok: true,
        arrayBuffer: async () => {
          controller.abort();
          return fontFiles.get(url).buffer;
        }
      };
    }
  }), {name: 'AbortError'});
  assert.deepEqual(requests, ['/fonts/BatiPortfolioSans-Regular.ttf']);
  assert.deepEqual(progress, [], 'cancelled font load must never start project rendering');
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
