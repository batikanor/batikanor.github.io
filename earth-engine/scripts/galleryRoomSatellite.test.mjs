import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GALLERY_SATELLITE_DATA, gallerySatellitePatch, gallerySatelliteProjectLevels} from '../src/galleryRoomSatellite.js';

const projects = JSON.parse(await readFile(new URL('../src/data/achievements.json', import.meta.url), 'utf8'));
const source = (await readFile(new URL('../src/galleryRoomGlobe.js', import.meta.url), 'utf8'))
  .replace("import './galleryRoomGlobe.css';", '')
  .replace("'./galleryRoomSatellite.js'", JSON.stringify(new URL('../src/galleryRoomSatellite.js', import.meta.url).href))
  .replace("from 'three';", `from '${import.meta.resolve('three')}';`);
const {galleryGlobeSatelliteGeometry, galleryGlobeRotation, GALLERY_GLOBE_PROJECT_ZOOM,
  GALLERY_GLOBE_MAX_ZOOM} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('all32 authored locations have same-origin historical satellite detail at the selected city zoom', () => {
  assert.ok(GALLERY_GLOBE_PROJECT_ZOOM >= 200 && GALLERY_GLOBE_MAX_ZOOM >= 512);
  assert.equal(GALLERY_SATELLITE_DATA.regions.length, 18);
  assert.equal(new Set(GALLERY_SATELLITE_DATA.regions.flatMap(r => r.slugs)).size, projects.length);
  for (const project of projects) {
    const levels = gallerySatelliteProjectLevels(project.slug);
    assert.equal(levels.length, 2);
    const {lat, lng} = project.coordinates;
    const patch = gallerySatellitePatch(lat, lng, GALLERY_GLOBE_PROJECT_ZOOM);
    assert.equal(patch?.level, 'city', `${project.slug} has real city imagery`);
    assert.ok(levels.includes(patch), `${project.slug} uses its own measured geographic city bounds`);
    assert.ok(levels.every(level => level.url.startsWith('/assets/gallery/satellite/')));
  }
  assert.equal(gallerySatellitePatch(0, 0, 1024), null, 'unexported geography falls back to the global satellite image');
  assert.equal(gallerySatellitePatch(48, 11, 6.5), null, 'world flights never stretch a detail patch across the globe');
});

test('real satellite patch rays cover the entire selected viewport with north-up, fixed geographic UVs', () => {
  for (const project of projects) for (const zoom of [GALLERY_GLOBE_PROJECT_ZOOM, GALLERY_GLOBE_MAX_ZOOM]) {
    const {lat, lng} = project.coordinates, patch = gallerySatellitePatch(lat, lng, zoom);
    const geometry = galleryGlobeSatelliteGeometry(patch.bounds), material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material), rotation = galleryGlobeRotation(lat, lng);
    mesh.quaternion.setFromEuler(new THREE.Euler(rotation.pitch, rotation.yaw, 0, 'XYZ'));
    const camera = new THREE.OrthographicCamera(-1.23, 1.23, 1.23, -1.23, .1, 10);
    camera.position.z = 4;camera.zoom = zoom;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);mesh.updateMatrixWorld(true);
    const inverse = mesh.quaternion.clone().invert();
    for (const x of [-.98, 0, .98]) for (const y of [-.98, 0, .98]) {
      const ray = new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(x, y), camera);
      const [hit] = ray.intersectObject(mesh);
      assert.ok(hit, `${project.slug}/${zoom} real patch covers viewport point ${x},${y}`);
      const ground = hit.point.clone().applyQuaternion(inverse).normalize();
      const latitude = Math.asin(ground.y) * 180 / Math.PI, longitude = Math.atan2(-ground.z, ground.x) * 180 / Math.PI;
      const [west, south, east, north] = patch.bounds;
      assert.ok(Math.abs(hit.uv.x - (longitude-west)/(east-west)) < .00005, 'longitude UV does not swim');
      assert.ok(Math.abs(hit.uv.y - (latitude-south)/(north-south)) < .00005, 'north-up latitude UV does not swim');
      assert.ok(ground.z > -1, 'finite curved ground');
    }
    assert.equal(geometry.index.count / 3, 2048, 'fine regional curvature has a bounded triangle cost');
    geometry.dispose();material.dispose();
  }
});

test('the finite self-hosted image inventory verifies its licensed2016 source, dimensions and unchanged JPEG hashes', async () => {
  const inventory = JSON.parse(await readFile(new URL('../public/assets/gallery/satellite/attribution.json', import.meta.url), 'utf8'));
  assert.equal(inventory.sourceLayer, 's2cloudless');
  assert.equal(inventory.license, 'https://creativecommons.org/licenses/by/4.0/');
  assert.deepEqual(inventory.acquisitionYears, [2016, 2017]);
  assert.equal(inventory.files.length, 38);assert.ok(inventory.totalBytes < 25_000_000);
  assert.ok(inventory.attribution.includes('Copernicus Sentinel data 2016 & 2017'));
  for (const record of inventory.files) {
    const source = new URL(record.sourceUrl);
    assert.equal(source.hostname, 'tiles.maps.eox.at');assert.equal(source.searchParams.get('layers'), 's2cloudless');
    assert.equal(source.searchParams.get('version'), '1.1.1');assert.equal(source.searchParams.get('srs'), 'EPSG:4326');
    assert.equal(source.searchParams.get('width'), String(record.width));assert.equal(source.searchParams.get('height'), String(record.height));
    const bytes = await readFile(new URL('../public' + record.url, import.meta.url));
    assert.equal(bytes.length, record.bytes);assert.equal(bytes.readUInt16BE(0), 0xffd8);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256);
  }
});
