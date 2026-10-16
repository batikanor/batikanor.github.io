import test from 'node:test';
import assert from 'node:assert/strict';
import {contestsAndActivities as projects} from '../src/data/contestsAndActivities.js';
import {galleryStationMedia, galleryStationPlan} from '../src/galleryRoomLayout.js';
import {galleryPhotoSource} from '../src/galleryRoomMediaDimensions.js';
import {GALLERY_WALL_CURATION, galleryWallCuration} from '../src/galleryRoomCuration.js';

const families = new Set(['portrait-led', 'paired-photos', 'media-led', 'story-led', 'gallery-led', 'balanced']);
const right = rect => rect.x + rect.width;
const bottom = rect => rect.y + rect.height;
const overlaps = (a, b) => a.x < right(b) - 1e-7 && right(a) > b.x + 1e-7 &&
  a.y < bottom(b) - 1e-7 && bottom(a) > b.y + 1e-7;

test('every existing achievement has an explicit editorial composition using its real media keys', () => {
  assert.equal(projects.length, 32);
  assert.deepEqual(Object.keys(GALLERY_WALL_CURATION).sort(), projects.map(project => project.slug).sort(),
    'a new achievement needs an individual composition review, not a silent generic profile');
  for (const project of projects) {
    const profile = galleryWallCuration(project);
    const sources = new Map(galleryStationMedia(project).map(media => [media.key, media]));
    assert.equal(profile, galleryWallCuration(project.slug), 'object and slug access choose the same editorial profile');
    assert.ok(families.has(profile.family), `${project.slug}: supported composition family`);
    assert.ok(typeof profile.rationale === 'string' && profile.rationale.trim().length >= 30,
      `${project.slug}: preserve the reason for the individual design decision`);
    assert.equal(new Set(profile.leadMedia).size, profile.leadMedia.length, 'each lead source is named once');
    for (const key of profile.leadMedia) assert.ok(sources.has(key), `${project.slug}: ${key} names a real source`);
    if (sources.size) assert.ok(profile.leadMedia.length, `${project.slug}: identify the useful visual evidence`);
    else assert.equal(profile.leadMedia.length, 0, 'text-only projects do not invent media');
    for (const [key, aspect] of Object.entries(profile.preferredAspect || {})) {
      assert.ok(sources.has(key), `${project.slug}: preferred viewport belongs to a real source`);
      assert.ok(Number.isFinite(aspect) && aspect > 0, 'document and video viewport ratios are usable');
      assert.equal(galleryPhotoSource(sources.get(key)), null,
        `${project.slug}: a preferred document viewport must never replace a verified photo aspect`);
    }
  }
});

test('editorial preferences are immutable and unknown projects receive a safe balanced fallback', () => {
  assert.ok(Object.isFrozen(GALLERY_WALL_CURATION));
  for (const profile of Object.values(GALLERY_WALL_CURATION)) {
    assert.ok(Object.isFrozen(profile));
    assert.ok(Object.isFrozen(profile.leadMedia));
    if (profile.preferredAspect) assert.ok(Object.isFrozen(profile.preferredAspect));
  }
  for (const input of [undefined, null, {}, {slug: 'future-achievement'}, 'future-achievement', 'toString', '__proto__']) {
    const profile = galleryWallCuration(input);
    assert.equal(profile.family, 'balanced');
    assert.deepEqual(profile.leadMedia, []);
    assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.leadMedia));
  }
});

test('curating and laying out every project preserves original prose, media, captions, credits and source order', () => {
  const originalProjects = JSON.stringify(projects);
  for (const project of projects) {
    const originalMedia = JSON.stringify(galleryStationMedia(project));
    for (const [width, height] of [[1280, 900], [1920, 1080], [2992, 1574], [390, 844]]) {
      galleryWallCuration(project);
      const components = galleryStationPlan(project, {width, height}).components;
      assert.equal(JSON.stringify(components.filter(component => component.kind === 'media').map(component => component.media)),
        originalMedia, `${project.slug} at ${width}×${height}: visual prominence does not reorder or rewrite sources`);
    }
  }
  assert.equal(JSON.stringify(projects), originalProjects, 'editorial presentation must not mutate authored project content');
});

test('Tesla arrival gives the prize portrait full-height presence to the left of the description', () => {
  const project = projects.find(project => project.slug === 'tesla-gigathon-2026');
  for (const [width, height, minimumPhotoWidth] of [[1280, 900, 300], [1920, 1080, 420], [2992, 1574, 700]]) {
    const {components, wallLayout} = galleryStationPlan(project, {width, height});
    const story = components.find(component => component.kind === 'story');
    const portrait = components.find(component => component.media?.key === 'embed:0');
    const context = `${width}×${height}`;
    assert.ok(portrait?.photo && story, `${context}: actual verified portrait and story remain present`);
    assert.equal(wallLayout.curated, true, `${context}: an ordinary desktop uses the reviewed composition`);
    assert.ok(right(portrait.pixelRect) <= story.pixelRect.x - 10,
      `${context}: portrait sits beside and to the left of the description`);
    assert.ok(Math.abs(portrait.pixelRect.y - story.pixelRect.y) <= 1,
      `${context}: photo and description share their top edge`);
    assert.ok(Math.abs(portrait.height - story.height) <= 1,
      `${context}: portrait uses the whole description height instead of the short slot above the map`);
    assert.ok(portrait.width >= minimumPhotoWidth && portrait.height >= height * .55,
      `${context}: the prize is prominent on arrival rather than a small media thumbnail`);
    assert.ok(story.width >= 310, `${context}: larger photography still leaves a useful reading column`);
    assert.ok(Math.abs(portrait.photo.worldWidth / portrait.photo.worldHeight - 3 / 4) < 1e-10,
      `${context}: the complete photograph retains its exact 3:4 intrinsic aspect`);
    for (const obstruction of wallLayout.obstructions) assert.equal(overlaps(portrait.pixelRect, obstruction), false,
      `${context}: the full-height photograph stays clear of the map, navigation and shared header`);
  }
});

test('the Thüga slides and two videos have broad usable arrival screens instead of slender full-height columns', () => {
  const project = projects.find(project => project.slug === 'thuega-2024');
  for (const [width, height, minimumWidth] of [[1280, 900, 250], [1920, 1080, 420]]) {
    const {components, wallLayout} = galleryStationPlan(project, {width, height});
    const screens = components.filter(component => component.kind === 'media');
    assert.equal(screens.length, 3, 'slides and both original playable videos remain present');
    assert.equal(wallLayout.curated, true, 'the ordinary desktop does not fall back to the former narrow columns');
    for (const screen of screens) {
      assert.ok(screen.width >= minimumWidth, `${width}×${height}: ${screen.media.key} has a useful landscape width`);
      assert.ok(screen.width >= screen.height * 1.2,
        `${width}×${height}: ${screen.media.key} stays broad even including caption and zoom controls`);
    }
  }
});

test('dense galleries keep useful supporting previews and prominent award photographs', () => {
  const galleries = projects.filter(project => galleryWallCuration(project).family === 'gallery-led');
  for (const [width, height, minimumWidth] of [[1280, 900, 130], [1920, 1080, 150]]) {
    for (const project of galleries) {
      const {components} = galleryStationPlan(project, {width, height});
      for (const preview of components.filter(component => component.kind === 'media')) {
        assert.ok(preview.width >= minimumWidth && preview.height >= 120,
          `${project.slug} at ${width}×${height}: ${preview.media.key} remains a useful preview beside its lead source`);
      }
    }
  }
  for (const slug of ['music-ai-osaka-2025', 'decarbon-days-climathon-2025']) {
    const project = projects.find(project => project.slug === slug);
    const media = galleryStationPlan(project, {width: 1920, height: 1080}).components
      .filter(component => component.kind === 'media');
    const award = media.find(component => component.media.key === 'embed:0');
    const supporting = media.filter(component => component !== award);
    assert.ok(award.photo && award.width >= 450, `${slug}: the actual award photograph is visible at a meaningful scale`);
    assert.ok(supporting.every(component => award.width * award.height >= 2 * component.width * component.height),
      `${slug}: the award photograph leads the composition rather than sharing an equal thumbnail row`);
  }
});
