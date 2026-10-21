import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {galleryPhotoCaptionMetrics, GALLERY_PHOTO_CAPTION_FONT_METRICS} from '../src/galleryRoomPhotoCaption.js';

test('photo-caption measurements stay tied to the shipped DM Sans font files and actual text weights', async () => {
  const theme = await readFile(new URL('../src/portfolioTheme.css', import.meta.url), 'utf8');
  assert.ok(theme.includes(`--portfolio-font-body: '${GALLERY_PHOTO_CAPTION_FONT_METRICS.family}'`),
    'changing the body font requires regenerating the caption advances');
  assert.equal(GALLERY_PHOTO_CAPTION_FONT_METRICS.unitsPerEm, 1000);
  assert.equal(GALLERY_PHOTO_CAPTION_FONT_METRICS.titleWeight, 500);
  assert.equal(GALLERY_PHOTO_CAPTION_FONT_METRICS.creditWeight, 400);
  for (const [file, expected] of Object.entries(GALLERY_PHOTO_CAPTION_FONT_METRICS.files)) {
    const bytes = await readFile(new URL(`../public/fonts/${file}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected,
      `${file} changed; regenerate the exact 400/500 caption metrics`);
  }
});

test('the reported Decarbon photographs budget the complete original caption and credit at their real widths', () => {
  const project = projects.find(project => project.slug === 'decarbon-days-climathon-2025');
  const group = project.gdrive_embed[1], question = project.gdrive_embed[2];
  const before = JSON.stringify([group, question]);
  const groupNarrow = galleryPhotoCaptionMetrics(group, 222.81);
  const questionNarrow = galleryPhotoCaptionMetrics(question, 222.81);
  assert.deepEqual([groupNarrow.titleLines, groupNarrow.creditLines, groupNarrow.requiredHeight], [3, 2, 88],
    'the former fixed 48px aperture cannot contain the group subtitle and two-line credit');
  assert.deepEqual([questionNarrow.titleLines, questionNarrow.creditLines, questionNarrow.requiredHeight], [2, 2, 72]);
  const broad = galleryPhotoCaptionMetrics(group, 809.175);
  assert.deepEqual([broad.titleLines, broad.creditLines, broad.requiredHeight], [1, 1, 43],
    'a broad photograph needs only its actual text height');
  assert.equal(JSON.stringify([group, question]), before, 'measurement never changes authored media metadata');
});

test('caption wrapping uses the heavier title advances and the original regular-weight credit advances', () => {
  // Six 500-weight a glyphs are 3342 font units; at this width the 400-weight
  // total of 3264 would incorrectly fit. The .03em safety reserve is included.
  assert.equal(galleryPhotoCaptionMetrics({abovePhotoCaption: 'aaaaaa'}, 72, {uiScale: 1}).titleLines, 2);
  assert.equal(galleryPhotoCaptionMetrics({credit: 'aaaaaa'}, 61.9, {uiScale: 1}).creditLines, 1,
    'the same glyphs in the smaller regular credit retain their real, narrower advances');
});

test('word boundaries and long source labels wrap without losing characters', () => {
  const words = galleryPhotoCaptionMetrics({abovePhotoCaption: 'aaaa bbbb cccc'}, 70, {uiScale: 1});
  const unbroken = galleryPhotoCaptionMetrics({abovePhotoCaption: 'abcdefghijklmno'}, 70, {uiScale: 1});
  assert.equal(words.titleLines, 3, 'three complete words cannot be packed using only their total width');
  assert.equal(unbroken.titleLines, 3, 'overflow-wrap:anywhere preserves a long unbroken label on three lines');
  assert.equal(galleryPhotoCaptionMetrics({abovePhotoCaption: '  aaaa\t bbbb\ncccc  '}, 70, {uiScale: 1}).titleLines,
    words.titleLines, 'normal source whitespace collapses in the same way as native text');
  assert.ok(galleryPhotoCaptionMetrics({abovePhotoCaption: 'abcdefghijklmno'.repeat(10)}, 70, {uiScale: 1}).titleLines >
    unbroken.titleLines, 'extra source text contributes height instead of being truncated');
});

test('Unicode captions retain measured Latin glyphs, combining accents and safe fallback widths', () => {
  const latin = galleryPhotoCaptionMetrics({abovePhotoCaption: 'äéüğış — · ×'}, 70, {uiScale: 1});
  assert.equal(latin.titleLines, 2, 'the original accented letters and punctuation use their real advances');
  const precomposed = galleryPhotoCaptionMetrics({abovePhotoCaption: 'é'.repeat(20)}, 70, {uiScale: 1});
  const combining = galleryPhotoCaptionMetrics({abovePhotoCaption: 'e\u0301'.repeat(20)}, 70, {uiScale: 1});
  assert.equal(combining.titleLines, precomposed.titleLines, 'combining marks add no invented extra character width');
  assert.equal(galleryPhotoCaptionMetrics({abovePhotoCaption: '東京'}, 60, {uiScale: 1}).titleLines, 2,
    'unmeasured fallback glyphs receive a conservative width rather than disappearing');
});

test('padding, credit margin and compact typography all contribute to the allocated row', () => {
  const media = {abovePhotoCaption: 'Photo', credit: 'Photographer'};
  const desktop = galleryPhotoCaptionMetrics(media, 1000, {uiScale: 1});
  assert.deepEqual([desktop.titleFontSize, desktop.creditFontSize, desktop.paddingX, desktop.paddingY, desktop.creditMargin],
    [16, 13, 9, 6, 3]);
  assert.equal(desktop.requiredHeight, 53,
    'one 20.8px title line, one 15.6px credit line, 3px margin and 12px padding fit with the rounding reserve');
  const phone = galleryPhotoCaptionMetrics(media, 1000, {uiScale: 1, phone: true});
  assert.deepEqual([phone.titleFontSize, phone.creditFontSize, phone.titleLineHeight, phone.creditLineHeight],
    [12, 11, 15.600000000000001, 13.2]);
  assert.equal(phone.requiredHeight, 45);
  const smaller = galleryPhotoCaptionMetrics(media, 1000, {uiScale: .5});
  assert.deepEqual([smaller.titleFontSize, smaller.creditFontSize, smaller.paddingX, smaller.paddingY, smaller.creditMargin],
    [8, 6.5, 4.5, 3, 1.5]);
  assert.equal(smaller.requiredHeight, 27);
});

test('empty text reserves only padding while credit-only captions still include their native top margin', () => {
  const empty = galleryPhotoCaptionMetrics({}, 200);
  assert.equal(empty.titleLines, 0);
  assert.equal(empty.creditLines, 0);
  assert.equal(empty.creditMargin, 0);
  assert.equal(empty.contentHeight, 0);
  assert.equal(empty.requiredHeight, 11);
  const credit = galleryPhotoCaptionMetrics({credit: 'Original photographer'}, 500);
  assert.equal(credit.titleLines, 0);
  assert.equal(credit.creditLines, 1);
  assert.equal(credit.requiredHeight, 26);
  const title = galleryPhotoCaptionMetrics({abovePhotoCaption: 'Original photo'}, 500);
  assert.equal(title.creditMargin, 0);
  assert.equal(title.requiredHeight, 28);
});

test('narrow or temporarily unavailable widths remain finite and recover to smaller rows at useful widths', () => {
  const media = {abovePhotoCaption: 'Photo subtitle', credit: 'Original credit'};
  for (const width of [0, -1, NaN, Infinity]) {
    const metrics = galleryPhotoCaptionMetrics(media, width, {uiScale: NaN});
    assert.equal(metrics.uiScale, .8);
    assert.ok(Number.isFinite(metrics.requiredHeight) && metrics.requiredHeight > 0);
  }
  const widths = [60, 100, 160, 300, 1000];
  const heights = widths.map(width => galleryPhotoCaptionMetrics(media, width).requiredHeight);
  for (let index = 1; index < heights.length; index++) assert.ok(heights[index] <= heights[index - 1]);
  assert.ok(heights[0] > heights.at(-1), 'temporary narrow composition can recover without retaining a tall empty caption');
});
