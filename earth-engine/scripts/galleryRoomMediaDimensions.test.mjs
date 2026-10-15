import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {galleryStationMedia} from '../src/galleryRoomLayout.js';
import {GALLERY_ROOM_MEDIA_DIMENSIONS, galleryPhotoSource} from '../src/galleryRoomMediaDimensions.js';

function dimensions(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) {
    return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
  }
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'local photo is a JPEG or PNG');
  const sof = new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  for (let offset = 2; offset < bytes.length;) {
    assert.equal(bytes[offset], 0xff);
    if (bytes[offset + 1] === 0xff) {offset++;continue;}
    if (sof.has(bytes[offset + 1])) return {width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5)};
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  throw new Error('JPEG has no dimensions');
}

test('all 36 measured gallery images refer to authored sources and retain finite original dimensions', () => {
  const authored = new Set(contestsAndActivities.flatMap(project => galleryStationMedia(project).map(media => media.url)));
  const entries = Object.entries(GALLERY_ROOM_MEDIA_DIMENSIONS);
  assert.equal(entries.length, 36);assert.equal(entries.filter(([url]) => url.startsWith('https://drive.google.com/')).length, 32);
  assert.ok(Object.isFrozen(GALLERY_ROOM_MEDIA_DIMENSIONS));
  for (const [url, photo] of entries) {
    assert.ok(authored.has(url), 'no fictional media source was added');
    assert.ok(Number.isInteger(photo.width) && photo.width > 0);
    assert.ok(Number.isInteger(photo.height) && photo.height > 0);
    assert.ok(Object.isFrozen(photo));assert.equal(galleryPhotoSource(url), photo);
    assert.equal(galleryPhotoSource({url}), photo);
    if (url.startsWith('/')) assert.equal(photo.src, url);
    else {
      const id = /\/file\/d\/([-\w]+)/.exec(url)[1];
      assert.equal(photo.src, `https://lh3.googleusercontent.com/d/${id}=s0`);
      assert.equal(new URL(photo.src).search, '', 'public sources contain no signed or authenticated query');
    }
  }
});

test('local image metadata matches the actual source files and the prize photo remains portrait', async () => {
  for (const [url, photo] of Object.entries(GALLERY_ROOM_MEDIA_DIMENSIONS).filter(([url]) => url.startsWith('/'))) {
    const bytes = await readFile(new URL(`../public${url}`, import.meta.url));
    assert.deepEqual(dimensions(bytes), {width: photo.width, height: photo.height});
  }
  const tesla = galleryPhotoSource('/photos/tesla-gigathon/tesla-gigathon-2026-first-place-prize.jpg');
  assert.equal(tesla.width, 1350);assert.equal(tesla.height, 1800);assert.equal(tesla.width / tesla.height, .75);
});

test('video, PDF and unsupported sources keep their native viewers instead of being guessed as photos', () => {
  for (const url of [
    'https://drive.google.com/file/d/1vW2hecPnWMbgtJvzqUqiBtLglIzygIHK/view?usp=sharing',
    'https://drive.google.com/file/d/1SaPVN7GKyx3lKH8SRSj20sS2I82LaCqL/view?usp=sharing',
    'https://docs.google.com/presentation/d/1D_xKlEpKfUM02-Cx2fBPCgS_OlWjhpGOIxt1g0R3PEU/embed',
    'https://example.com/unknown.jpg', 'constructor', null, undefined
  ]) assert.equal(galleryPhotoSource(url), null);
});

test('only oversized Drive photos use bounded display images while originals and animation stay intact', () => {
  let bounded = 0;
  for (const [url, photo] of Object.entries(GALLERY_ROOM_MEDIA_DIMENSIONS)) {
    const eligible = url.startsWith('https://drive.google.com/') && Math.max(photo.width, photo.height) > 2400;
    assert.equal(Boolean(photo.displaySrc), eligible);
    if (photo.displaySrc) {
      bounded++;
      assert.equal(photo.displaySrc, photo.src.replace(/=s0$/, '=s2400'));
      assert.ok(photo.src.endsWith('=s0'), 'the original full-size source is preserved');
      assert.ok(Math.max(photo.width, photo.height) > 2400, 'layout continues to use original dimensions');
    }
  }
  assert.equal(bounded, 7);
  const animated = galleryPhotoSource('https://drive.google.com/file/d/1Z7WmvqB6oa1zPSIBh_oCnWJgEkYNXj4r/view?usp=sharing');
  assert.equal(animated.displaySrc, undefined);assert.equal(animated.width, 640);assert.equal(animated.height, 480);
  assert.ok(animated.src.endsWith('=s0'));
});
