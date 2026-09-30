import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {getProject, projectCount, projectHref} from '../src/projectContent.js';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const vendoredSiteSource = new URL('../../src/data/contestsAndActivities.js', import.meta.url);
const workspaceSiteSource = new URL('../../../batikanor.github.io/src/data/contestsAndActivities.js', import.meta.url);
const source = existsSync(vendoredSiteSource) ? vendoredSiteSource : workspaceSiteSource;
const snapshot = new URL('../src/data/contestsAndActivities.js', import.meta.url);
const mapEvents = JSON.parse(readFileSync(new URL('../src/data/achievements.json', import.meta.url)));

test('the local portfolio snapshot still matches the existing-site source', () => {
  // A preview/deployment may contain only earth-engine; when both repos are in
  // the development workspace this detects stale copied author content.
  if (existsSync(source)) assert.equal(readFileSync(snapshot, 'utf8'), readFileSync(source, 'utf8'));
  assert.equal(projectCount, 32);
  assert.deepEqual(new Set(mapEvents.map(event => event.slug)), new Set(contestsAndActivities.map(project => project.slug)));
  for (const project of contestsAndActivities) {
    assert.equal(getProject(project.slug), project);
    const mapEvent = mapEvents.find(event => event.slug === project.slug);
    assert.equal(mapEvent?.title, project.title);
    assert.equal(mapEvent?.date, project.date);
    // The old content misspells Lausanne as "Laussane". Preserve the author's
    // story snapshot verbatim, but keep the correctly spelled map label.
    assert.equal(mapEvent?.city, project.mapData.city === 'Laussane' ? 'Lausanne' : project.mapData.city);
    assert.equal(mapEvent?.country, project.mapData.country);
    assert.equal(mapEvent?.venue, project.mapData.venue);
    if (project.slug === 'ethrome-2025') {
      // The author snapshot stays byte-for-byte intact. The old map-only pin
      // was ~470m north of Via Ostiense 92; audited venue sources are in
      // design/rome-venue-pilot.md, and only achievements.json is corrected.
      assert.deepEqual(mapEvent?.coordinates, {lat:41.8678291,lng:12.4791336});
      assert.deepEqual(project.mapData.coordinates, {lat:41.8719,lng:12.4802});
    } else if(project.slug==='hong-kong-talent-engage-eurotech-healthtech-2026') {
      // Map-only correction to named Revenue Tower: HK government location API
      // and HKTE contact page evidence are pinned in the photo manifest.
      assert.deepEqual(mapEvent.coordinates,{lat:22.2796020939,lng:114.1718383764});
      assert.deepEqual(project.mapData.coordinates,{lat:22.2745,lng:114.1698});
    } else assert.deepEqual(mapEvent?.coordinates, project.mapData.coordinates);
  }
});

test('every authored inline media reference resolves to a preserved media item', () => {
  for (const project of contestsAndActivities) {
    for (const [, kind, number] of project.longDescription.matchAll(/\{\{(image|embed|gdrive_embed)\[(\d+)\]\}\}/g)) {
      const media = kind === 'image' ? project.images : project.gdrive_embed;
      assert.ok(media?.[Number(number)], `${project.slug}: ${kind}[${number}] is missing`);
    }
    for (const media of [...(project.images ?? []), ...(project.gdrive_embed ?? [])]) {
      const url = typeof media === 'string' ? media : media.url;
      assert.match(url, /^(?:https?:\/\/|\/)/, `${project.slug}: unsupported media URL`);
      if (url.startsWith('/')) {
        assert.ok(existsSync(`${projectRoot}public${url}`), `${project.slug}: local media asset ${url} is missing`);
      }
    }
  }
});

test('old project cross-links target the same achievement in the map', () => {
  assert.equal(
    projectHref('/projects/#decarbon-days-climathon-2025', 'http://127.0.0.1:4177/'),
    'http://127.0.0.1:4177/?event=decarbon-days-climathon-2025'
  );
  assert.equal(projectHref('javascript:alert(1)'), null);
});

test('legacy PDF evidence linked from projects and the CV is retained at its domain path', () => {
  for (const path of [
    '/certificates/batikan/2023_msg_code_create_winner.pdf',
    '/certificates/batikan/e-signed_transcript.pdf',
    '/certificates/batikan/toefl2021.pdf',
    '/certificates/batikan/DSHZertifikat.pdf',
    '/other/bata-kozmetik/example-choco-mask.pdf'
  ]) assert.ok(existsSync(`${projectRoot}public${path}`), `${path} missing from replacement`);
});
