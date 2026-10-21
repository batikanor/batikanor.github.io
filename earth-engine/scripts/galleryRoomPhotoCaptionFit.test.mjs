import test from 'node:test';
import assert from 'node:assert/strict';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {fitGalleryPhotoCaptions, galleryStationMedia, galleryStationPlan} from '../src/galleryRoomLayout.js';
import {GALLERY_ROOM_MEDIA_DIMENSIONS} from '../src/galleryRoomMediaDimensions.js';
import {galleryPhotoCaptionMetrics} from '../src/galleryRoomPhotoCaption.js';

const right = rect => rect.x + rect.width, bottom = rect => rect.y + rect.height;
const overlaps = (a, b) => a.x < right(b) - 1e-7 && right(a) > b.x + 1e-7 &&
  a.y < bottom(b) - 1e-7 && bottom(a) > b.y + 1e-7;
const close = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7,
  `${label}: expected ${expected}, got ${actual}`);
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
const imagePixels = entry => entry.rect.height - entry.photo.captionPixels - entry.photo.controlsPixels;

function syntheticPhoto({id = 'media', x = 20, caption = 'A deliberately detailed original photo caption describing the people, event and setting, with enough authored context to require several wrapped lines.', credit = 'Photo: Original photographer, event organisers and university partners'} = {}) {
  return {id, kind: 'media', media: {key: `image:${id}`, index: 0, url: `/original-${id}.jpg`,
    abovePhotoCaption: caption, credit},
  photo: {src: `/original-${id}.jpg`, width: 1500, height: 1000, captionPixels: 48, controlsPixels: 32},
  rect: {x, y: 50, width: 180, height: 200}};
}

test('Decarbon 2025 group and question captions fit completely without moving or resizing either original photo', () => {
  const project = projects.find(project => project.slug === 'decarbon-days-climathon-2025');
  // Frozen reviewed apertures: only their caption area may grow downwards.
  const fixtures = [
    {width: 1280, height: 900, y: 543.338, photoWidth: 162.8, imageHeight: 108.53333333333333,
      xs: {'embed:1': 386, 'embed:2': 739.6}},
    {width: 1920, height: 1080, y: 654.938, photoWidth: 222.81, imageHeight: 148.54,
      xs: {'embed:1': 962.76, 'embed:2': 1199.57}},
    {width: 2992, height: 1574, y: 179.1, photoWidth: 809.175, imageHeight: 539.45,
      xs: {'embed:1': 475.4125, 'embed:2': 2151.4125}},
  ];
  const originalMedia = galleryStationMedia(project);
  for (const fixture of fixtures) {
    const {components, wallLayout} = galleryStationPlan(project, fixture);
    assert.deepEqual(components.filter(component => component.kind === 'media').map(component => component.media), originalMedia,
      'authored media, captions, credits and source order stay intact');
    for (const [key, x] of Object.entries(fixture.xs)) {
      const pose = components.find(component => component.media?.key === key);
      const label = `${fixture.width}×${fixture.height}/${key}`;
      assert.ok(pose?.photo, `${label}: retain the verified original photograph`);
      const source = GALLERY_ROOM_MEDIA_DIMENSIONS[pose.media.url];
      assert.equal(pose.photo.src, source.src, `${label}: original full-size source`);
      assert.equal(pose.photo.displaySrc, source.displaySrc);
      assert.equal(pose.photo.width, source.width);
      assert.equal(pose.photo.height, source.height);
      close(pose.pixelRect.x, x, `${label}: original left edge`);
      close(pose.pixelRect.y, fixture.y, `${label}: original top edge`);
      close(pose.pixelRect.width, fixture.photoWidth, `${label}: original width`);
      const pixelsPerWorld = wallLayout.height / wallLayout.worldHeight;
      close(pose.photo.worldHeight * pixelsPerWorld, fixture.imageHeight, `${label}: original image height`);
      close(pose.photo.controlsWorldHeight * pixelsPerWorld, 32, `${label}: original controls height`);
      close(pose.photo.captionUiScale, .8, `${label}: original overview font scale`);
      const metrics = galleryPhotoCaptionMetrics(pose.media, pose.width, {uiScale: pose.photo.captionUiScale, phone: false});
      assert.ok(pose.photo.captionPixels + .01 >= metrics.requiredHeight, `${label}: complete caption and photographer credit fit`);
      assert.equal(pose.photo.captionComplete, true, `${label}: no caption scrolling is needed`);
      close(pose.photo.captionRequiredPixels, metrics.requiredHeight, `${label}: complete authored caption measured`);
      assert.ok(pose.photo.captionPixels >= 48, `${label}: caption space never shrinks`);
      close(pose.height, fixture.imageHeight + pose.photo.captionPixels + 32, `${label}: growth belongs only to the caption`);
    }
  }
});

test('caption fitting spends only required free space while preserving image, controls and authored records', () => {
  const inputs = freeze([syntheticPhoto(), syntheticPhoto({id: 'second', x: 250, caption: 'Portrait', credit: ''})]);
  const snapshot = structuredClone(inputs);
  const result = fitGalleryPhotoCaptions(inputs, {floor: 1000});
  assert.deepEqual(inputs, snapshot, 'frozen source entries are not mutated');
  assert.deepEqual(result.map(entry => entry.id), inputs.map(entry => entry.id));
  for (let i = 0; i < inputs.length; i++) {
    const original = inputs[i], fitted = result[i];
    const metrics = galleryPhotoCaptionMetrics(original.media, original.rect.width, {uiScale: .8, phone: false});
    const expectedCaption = Math.max(original.photo.captionPixels, metrics.requiredHeight);
    assert.deepEqual(fitted.media, original.media, 'caption prose, credit and source remain authored');
    assert.deepEqual([fitted.rect.x, fitted.rect.y, fitted.rect.width], [original.rect.x, original.rect.y, original.rect.width]);
    close(imagePixels(fitted), imagePixels(original), 'the proportional photo aperture stays unchanged');
    assert.equal(fitted.photo.controlsPixels, original.photo.controlsPixels);
    assert.equal(fitted.photo.src, original.photo.src);
    assert.equal(fitted.photo.width, original.photo.width);
    assert.equal(fitted.photo.height, original.photo.height);
    close(fitted.photo.captionPixels, expectedCaption, 'the caption uses its full text height without filling the column');
    close(fitted.rect.height - original.rect.height, expectedCaption - original.photo.captionPixels, 'only caption growth changes total height');
    assert.equal(fitted.photo.captionComplete, true);
    assert.equal(fitted.photo.captionUiScale, .8, 'extra caption space cannot enlarge the existing UI');
  }
  assert.ok(result[0].photo.captionPixels > inputs[0].photo.captionPixels, 'the long caption exercises real growth');
  assert.equal(result[1].rect.height, inputs[1].rect.height, 'a complete short caption receives no unnecessary growth');
});

test('nearest component, obstruction and floor cap growth without shrinking photographs or hiding overflow', () => {
  const photo = syntheticPhoto();
  const below = {id: 'references', kind: 'references', rect: {x: 20, y: 290, width: 180, height: 60}};
  const beside = {id: 'story', kind: 'story', rect: {x: 230, y: 255, width: 180, height: 200}};
  const cases = [
    {name: 'nearest overlapping component', entries: [photo, below, beside], options: {floor: 800}, expectedCaption: 74},
    {name: 'nearer interface obstruction', entries: [photo, below, beside],
      options: {floor: 800, obstructions: [{x: 40, y: 270, width: 120, height: 40}]}, expectedCaption: 54},
    {name: 'viewport floor', entries: [photo, beside], options: {floor: 260}, expectedCaption: 58},
    {name: 'no remaining space', entries: [photo, beside], options: {floor: 250}, expectedCaption: 48},
  ];
  for (const fixture of cases) {
    const inputs = freeze(structuredClone(fixture.entries)), snapshot = structuredClone(inputs);
    const result = fitGalleryPhotoCaptions(inputs, fixture.options), fitted = result[0];
    assert.deepEqual(inputs, snapshot, `${fixture.name}: source geometry remains immutable`);
    assert.equal(fitted.photo.captionPixels, fixture.expectedCaption, fixture.name);
    assert.equal(fitted.photo.captionComplete, false, `${fixture.name}: preserve honest overflow when full prose cannot fit`);
    assert.ok(fitted.photo.captionRequiredPixels > fitted.photo.captionPixels);
    close(imagePixels(fitted), imagePixels(photo), `${fixture.name}: original image height`);
    assert.equal(fitted.photo.controlsPixels, photo.photo.controlsPixels);
    assert.deepEqual([fitted.rect.x, fitted.rect.y, fitted.rect.width], [photo.rect.x, photo.rect.y, photo.rect.width]);
    assert.deepEqual(fitted.media, photo.media);
    assert.deepEqual(result.slice(1), inputs.slice(1), `${fixture.name}: existing neighboring components remain unchanged`);
    for (const block of [...result.slice(1).map(entry => entry.rect), ...(fixture.options.obstructions || [])]) {
      assert.equal(overlaps(fitted.rect, block), false, `${fixture.name}: expanded caption stays clear of the next component`);
    }
    assert.ok(bottom(fitted.rect) <= fixture.options.floor, `${fixture.name}: remain inside the wall`);
  }
});

test('all 32 walls preserve source order and native photo apertures without frame collisions after caption growth', () => {
  const viewports = [[320, 568], [390, 844], [568, 320], [700, 1080], [800, 600],
    [1024, 768], [1280, 900], [1440, 900], [1920, 1080], [2992, 1574]];
  for (const [width, height] of viewports) {
    let photos = 0;
    for (const project of projects) {
      const {components, wallLayout} = galleryStationPlan(project, {width, height});
      const label = `${project.slug} at ${width}×${height}`;
      assert.deepEqual(components.filter(component => component.kind === 'media').map(component => component.media), galleryStationMedia(project),
        `${label}: source order and complete authored records`);
      const framed = components.map(pose => {
        const frame = pose.framePadding * wallLayout.height / wallLayout.worldHeight;
        return {id: pose.id, rect: {x: pose.pixelRect.x - frame, y: pose.pixelRect.y - frame,
          width: pose.pixelRect.width + 2 * frame, height: pose.pixelRect.height + 2 * frame}};
      });
      for (const {id, rect} of framed) {
        assert.ok(rect.x >= 0 && rect.y >= 0 && right(rect) <= width + 1e-7 && bottom(rect) <= height + 1e-7,
          `${label}/${id}: frame stays on screen`);
        for (const block of wallLayout.obstructions) assert.equal(overlaps(rect, block), false,
          `${label}/${id}: frame remains clear of navigation and header`);
      }
      for (let i = 0; i < framed.length; i++) for (let j = i + 1; j < framed.length; j++) {
        assert.equal(overlaps(framed[i].rect, framed[j].rect), false,
          `${label}: ${framed[i].id} and ${framed[j].id} retain separate frames`);
      }
      for (const pose of components.filter(pose => pose.photo)) {
        photos++;
        const source = GALLERY_ROOM_MEDIA_DIMENSIONS[pose.media.url];
        assert.equal(pose.photo.src, source.src, `${label}/${pose.id}: original source`);
        assert.equal(pose.photo.width, source.width);
        assert.equal(pose.photo.height, source.height);
        close(pose.photo.worldWidth / pose.photo.worldHeight, source.width / source.height,
          `${label}/${pose.id}: native image proportions`);
        close(pose.worldHeight, pose.photo.worldHeight + pose.photo.captionWorldHeight + pose.photo.controlsWorldHeight,
          `${label}/${pose.id}: image, caption and controls retain separate apertures`);
        assert.ok(Number.isFinite(pose.photo.captionRequiredPixels));
        assert.ok(pose.photo.captionUiScale > 0 && pose.photo.captionUiScale <= .8);
        assert.equal(pose.photo.captionComplete, pose.photo.captionPixels + .01 >= pose.photo.captionRequiredPixels);
      }
    }
    assert.equal(photos, 36, `${width}×${height}: all original photographs retained`);
  }
});
