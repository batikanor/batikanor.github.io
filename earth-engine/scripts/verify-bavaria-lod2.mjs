import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const root = new URL('../public/data/', import.meta.url);
const meta = JSON.parse(readFileSync(new URL('garching-lod2-v1.json', root), 'utf8'));
const bin = readFileSync(new URL('garching-lod2-v1.bin', root));
const digest = createHash('sha256').update(bin).digest('hex');
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(digest === meta.binary_sha256, 'Generated LoD2 binary checksum mismatch');
assert(bin.toString('ascii', 0, 4) === 'BLD2', 'Unknown LoD2 binary signature');
assert(bin.readUInt32LE(4) === 1, 'Unknown LoD2 binary version');
const roof = bin.readUInt32LE(8), wall = bin.readUInt32LE(12);
const buildings = bin.readUInt32LE(16), surfaces = bin.readUInt32LE(20);
assert(roof % 3 === 0 && wall % 3 === 0, 'LoD2 mesh is not triangulated');
assert(bin.length === 40 + (roof + wall) * 3 * 4, 'LoD2 binary length mismatch');
assert(bin.length < 2_000_000, 'Garching detail mesh exceeds its local slice budget');
assert(buildings === meta.selected_buildings && surfaces === meta.triangulated_surfaces, 'LoD2 count metadata mismatch');
assert(new Set(meta.building_ids).size === buildings, 'Duplicate official LoD2 building IDs');
assert(Math.abs(bin.readDoubleLE(24) - 11.666954) < 1e-8, 'LoD2 longitude origin changed');
assert(Math.abs(bin.readDoubleLE(32) - 48.262269) < 1e-8, 'LoD2 latitude origin changed');
assert(meta.license.includes('CC BY 4.0') && meta.credit.includes('Bayerische Vermessungsverwaltung'), 'LoD2 attribution metadata missing');

const numbers = new Float32Array(bin.buffer, bin.byteOffset + 40, (roof + wall) * 3);
let minElevation = Infinity, maxElevation = -Infinity;
for (let i = 0; i < numbers.length; i += 3) {
  const x = numbers[i], h = numbers[i + 1], north = numbers[i + 2];
  assert(Number.isFinite(x) && Number.isFinite(h) && Number.isFinite(north), 'Non-finite LoD2 vertex');
  assert(Math.abs(x) < 1000 && Math.abs(north) < 1000, 'LoD2 vertex outside venue-local range');
  minElevation = Math.min(minElevation, h);
  maxElevation = Math.max(maxElevation, h);
}
assert(minElevation > 450 && maxElevation < 550, 'LoD2 height range implausible for Garching');
console.log(`Verified ${buildings} official LoD2 buildings, ${(roof + wall) / 3} triangles, ${bin.length.toLocaleString()} bytes; elevations ${minElevation.toFixed(1)}–${maxElevation.toFixed(1)} m.`);

const photoMeta = JSON.parse(readFileSync(new URL('garching-roof-orthophoto-v1.json', root), 'utf8'));
const photo = readFileSync(new URL(photoMeta.asset, root));
assert(createHash('sha256').update(photo).digest('hex') === photoMeta.sha256, 'DOP20 roof atlas checksum mismatch');
assert(photo.length === photoMeta.bytes && photo.length < 3_000_000, 'DOP20 roof atlas exceeds local slice budget');
assert(photo.toString('ascii', 0, 4) === 'RIFF' && photo.toString('ascii', 8, 16) === 'WEBPVP8 ', 'Unknown DOP20 WebP atlas format');
assert((photo.readUInt16LE(26) & 0x3fff) === photoMeta.width, 'DOP20 WebP width metadata mismatch');
assert((photo.readUInt16LE(28) & 0x3fff) === photoMeta.height, 'DOP20 WebP height metadata mismatch');
assert(photoMeta.source_tile_zoom === 18 && photoMeta.source_tile_count === 225, 'DOP20 source tile matrix changed');
assert(photoMeta.width === 3840 && photoMeta.height === 3840, 'DOP20 atlas exceeds conservative GPU dimension budget');
assert(photoMeta.license.includes('CC BY 4.0') && photoMeta.credit.includes('Bayerische Vermessungsverwaltung')
  && photoMeta.derived_changes.includes('Stitched'), 'DOP20 derivative attribution metadata missing');
const [minX, minY, maxX, maxY] = photoMeta.source_tile_bounds_xyxy;
const [originLon, originLat] = photoMeta.origin_lonlat;
assert(originLon === meta.origin[0] && originLat === meta.origin[1], 'DOP20 atlas/LoD2 origin mismatch');
const tiles = 2 ** photoMeta.source_tile_zoom;
const tileMetres = 40075016.68557849 * Math.cos(originLat * Math.PI / 180) / tiles;
const originX = (originLon + 180) / 360 * tiles;
const originY = (1 - Math.asinh(Math.tan(originLat * Math.PI / 180)) / Math.PI) / 2 * tiles;
for (let index = 0; index < roof; index++) {
  const east = numbers[index * 3];
  const north = numbers[index * 3 + 2];
  const u = ((originX - minX) + east / tileMetres) / (maxX - minX + 1);
  const v = 1 - ((originY - minY) - north / tileMetres) / (maxY - minY + 1);
  assert(u > 0 && u < 1 && v > 0 && v < 1, `DOP20 roof vertex ${index} falls outside atlas`);
}
console.log(`Verified official DOP20 roof atlas: ${photoMeta.width}×${photoMeta.height}, ${photo.length.toLocaleString()} bytes, ${roof.toLocaleString()} roof vertices covered.`);
