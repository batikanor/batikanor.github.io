import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {
  chooseRoofAtlasVersion,
  parseBld2,
  roofUvForAtlas,
  validateGroundImageMetadata,
  validateReducedAtlas,
} from '../src/isometricRegionLayer.js';

const assets = new URL('../public/assets/isometric/', import.meta.url);
const read = name => readFileSync(new URL(name, assets));
const json = name => JSON.parse(read(name).toString('utf8'));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

for (const year of ['2025', '2026']) {
  test(`real official Cottbus ${year} assets fit the shared 3D/ground pipeline`, () => {
    const stem = `cottbus-climathon-${year}`;
    const meshMeta = json(`${stem}-lod2-v1.json`);
    const meshBytes = read(`${stem}-lod2-v1.bin`);
    assert.equal(meshBytes.length, meshMeta.bytes);
    assert.equal(digest(meshBytes), meshMeta.binary_sha256);
    const mesh = parseBld2(meshBytes.buffer.slice(meshBytes.byteOffset,
      meshBytes.byteOffset + meshBytes.byteLength), meshMeta.origin);
    assert.equal((mesh.roofCount + mesh.wallCount) / 3,
      meshMeta.roof_triangles + meshMeta.wall_triangles);
    assert.ok(meshMeta.selected_buildings > 0);

    const full = json(`${stem}-roof-truedop20-v1.json`);
    const reduced = json(`${stem}-roof-truedop20-v1-half.json`);
    assert.equal(digest(read(full.asset)), full.sha256);
    assert.equal(digest(read(reduced.asset)), reduced.sha256);
    assert.equal(validateReducedAtlas(full, reduced), reduced);
    assert.equal(chooseRoofAtlasVersion(full, reduced,
      {maxTextureSize: 4096, lowMemory: false}), full);
    assert.equal(chooseRoofAtlasVersion(full, reduced,
      {maxTextureSize: 4096, lowMemory: true}), reduced);
    const uv = roofUvForAtlas(mesh.positions.subarray(0, mesh.roofCount * 3),
      meshMeta.origin, full);
    assert.equal(uv.length, mesh.roofCount * 2);

    const ground = json(`${stem}-ground-truedop20-v1.json`);
    assert.equal(digest(read(ground.asset)), ground.sha256);
    assert.equal(validateGroundImageMetadata(ground, {origin: meshMeta.origin}), ground);
    assert.match(ground.credit, /GeoBasis-DE\/LGB/);
    assert.match(meshMeta.credit, /GeoBasis-DE\/LGB/);
  });
}
