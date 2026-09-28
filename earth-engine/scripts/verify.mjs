import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stepPosition,distanceMetres} from '../src/geo.js';
const a=JSON.parse(fs.readFileSync(new URL('../src/data/achievements.json',import.meta.url),'utf8'));
assert.equal(a.length,32);
assert.equal(new Set(a.map(x=>x.slug)).size,32);
for(const x of a){assert.ok(x.title && x.city && x.venue && Number.isFinite(x.coordinates.lat) && Number.isFinite(x.coordinates.lng)); assert.ok(x.coordinates.lat>=-90&&x.coordinates.lat<=90&&x.coordinates.lng>=-180&&x.coordinates.lng<=180)}
const origin=[11.5761,48.1372];
for(const heading of [0,90,180,270])assert.ok(Math.abs(distanceMetres(origin,stepPosition(origin,heading,1000))-1000)<1);
console.log('Verified 32 unique event records and WGS84 coordinates.');
