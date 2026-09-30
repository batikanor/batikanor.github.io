import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {chooseRoofAtlasVersion, parseBld2, roofUvForAtlas,
  validateGroundImageMetadata, validateReducedAtlas} from '../src/isometricRegionLayer.js';

const assets = new URL('../public/assets/isometric/', import.meta.url);
const read = name => readFileSync(new URL(name, assets));
const json = name => JSON.parse(read(name).toString('utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const stem = 'tesla-gigafactory';

test('Tesla surveyed clip includes complete factory halls, not tiny entrance extrusions', () => {
  const metadata = json(`${stem}-lod2-v1.json`);
  const bytes = read(metadata.asset);
  const mesh = parseBld2(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), metadata.origin);
  assert.equal(bytes.length, metadata.bytes);
  assert.equal(sha256(bytes), metadata.binary_sha256);
  assert.equal(mesh.roofCount / 3, metadata.roof_triangles);
  assert.equal(mesh.wallCount / 3, metadata.wall_triangles);
  assert.ok(metadata.selected_buildings >= 20);
  assert.ok(metadata.main_hall_ground_area_m2 > 140_000);
  for (const id of metadata.required_factory_hall_ids) assert.ok(metadata.building_ids.includes(id));
  assert.deepEqual(metadata.event_coordinates_lonlat, [13.79215, 52.391331]);
  assert.equal(metadata.source_update_date, '2026-01-06');
  assert.match(metadata.height_datum, /DHHN2016/);
  assert.ok(metadata.ground_height_range_m[0] > 30 && metadata.ground_height_range_m[1] < 50);
  assert.ok(mesh.positions.every(Number.isFinite));
});

test('Tesla photographic roof UVs register to source vertices at sub-metre resolution', () => {
  const meshMetadata = json(`${stem}-lod2-v1.json`);
  const bytes = read(meshMetadata.asset);
  const mesh = parseBld2(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), meshMetadata.origin);
  const full = json(`${stem}-roof-truedop20-v1.json`);
  const half = json(`${stem}-roof-truedop20-v1-half.json`);
  assert.equal(sha256(read(full.asset)), full.sha256);
  assert.equal(sha256(read(half.asset)), half.sha256);
  assert.equal(full.source_native_metres_per_pixel, 0.2);
  assert.ok(full.effective_metres_per_pixel < 0.4);
  assert.equal(validateReducedAtlas(full, half), half);
  assert.equal(chooseRoofAtlasVersion(full, half, {maxTextureSize:4096, lowMemory:false}), full);
  assert.equal(chooseRoofAtlasVersion(full, half, {maxTextureSize:4096, lowMemory:true}), half);
  assert.equal(roofUvForAtlas(mesh.positions.subarray(0, mesh.roofCount * 3), mesh.origin, full).length, mesh.roofCount * 2);
  assert.equal(full.source_flight_date, '2023-05-04');
  assert.match(full.credit, /GeoBasis-DE\/LGB/);
  assert.match(full.derived_changes, /not facade photography/);
});

test('Tesla ground is source-aligned bounded aerial photography, not the 10m ESA placeholder', () => {
  const mesh = json(`${stem}-lod2-v1.json`);
  const ground = json(`${stem}-ground-truedop20-v1.json`);
  const reduced = json(`${stem}-ground-truedop20-v1-half.json`);
  assert.equal(validateGroundImageMetadata(ground, {origin:mesh.origin}), ground);
  assert.equal(ground.width, 2048);
  assert.equal(ground.height, 2048);
  assert.ok(ground.effective_metres_per_pixel <= 0.65);
  assert.equal(sha256(read(ground.asset)), ground.sha256);
  assert.equal(sha256(read(reduced.asset)), reduced.sha256);
  assert.equal(reduced.source_asset_sha256, ground.sha256);
  assert.equal(reduced.width, 1024);
  assert.deepEqual(reduced.coordinates, ground.coordinates);
  assert.ok(ground.bytes <= 4_000_000 && reduced.bytes <= 4_000_000);
  assert.deepEqual(ground.camera.center, mesh.origin);
  assert.ok(ground.camera.zoom < 17.2, 'Entire factory must be framed instead of overzooming an entrance court');
  const [northwest, northeast, southeast, southwest] = ground.coordinates;
  const [lon,lat] = ground.event_coordinates_lonlat;
  assert.ok(lon > northwest[0] && lon < northeast[0] && lat < northwest[1] && lat > southwest[1]);
  assert.equal(southeast[0], northeast[0]);
  assert.equal(southeast[1], southwest[1]);
  for (const hash of Object.values(ground.source_zip_sha256)) assert.match(hash, /^[a-f0-9]{64}$/);
});
