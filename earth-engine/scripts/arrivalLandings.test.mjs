import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import achievements from '../src/data/achievements.json' with {type:'json'};
import original from '../src/data/arrivalTiles.json' with {type:'json'};
import manifest from '../src/data/arrivalLandings.json' with {type:'json'};

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const lon = (x,z) => x / 2**z * 360 - 180;
const lat = (y,z) => Math.atan(Math.sinh(Math.PI*(1-2*y/2**z)))*180/Math.PI;
const sourceCache = '/tmp/batikan-esa-arrival-source-v1';

function webpSize(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'RIFF');
  assert.equal(bytes.toString('ascii',8,12),'WEBP');
  assert.equal(bytes.toString('ascii',12,16),'VP8 ');
  assert.deepEqual([...bytes.subarray(23,26)],[0x9d,0x01,0x2a]);
  return {width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
}

test('all32 event landings dedupe real source tile centers, preserving original manifest',async()=>{
  assert.equal(manifest.schema,1);
  assert.deepEqual(Object.keys(manifest.events).toSorted(),achievements.map(event=>event.slug).toSorted());
  assert.equal(Object.keys(manifest.landings).length,27);
  assert.equal(new Set(Object.values(manifest.events)).size,27);
  for(const event of achievements){
    const key=manifest.events[event.slug];
    assert.equal(key,original.events[event.slug].detail[0]);
    assert.ok(manifest.landings[key]);
  }
  const bytes=await readFile(new URL('../src/data/arrivalTiles.json',import.meta.url));
  assert.equal(sha(bytes),manifest.sourceManifestSha256);
});

test('same-source ESA licence, source hashes and native-pixel derivation remain explicit',()=>{
  for(const field of ['source','sourceUrl','license','attribution'])assert.equal(manifest[field],original[field]);
  assert.equal(manifest.license,'CC-BY-4.0');
  assert.match(manifest.derivation,/original 256px PNG/);
  assert.match(manifest.derivation,/native 768x768/);
  assert.match(manifest.derivation,/No resampling or upscaling/);
  for(const [key,landing] of Object.entries(manifest.landings)){
    const [z,x,y]=key.split('/').map(Number);assert.equal(z,14);
    const keys=[];
    for(let tileY=y-1;tileY<=y+1;tileY++)for(let tileX=x-1;tileX<=x+1;tileX++)keys.push(`${z}/${tileX}/${tileY}`);
    assert.deepEqual(landing.sourceKeys,keys,'tile paste order must be north-to-south row-major');
    assert.equal(landing.sourceKeys.length,9);assert.equal(landing.width,3*256);assert.equal(landing.height,3*256);
    assert.equal(landing.sourceBytes,keys.reduce((sum,id)=>sum+original.tiles[id].sourceBytes,0));
    for(const id of keys)assert.equal(landing.sourceSha256[id],original.tiles[id].sourceSha256);
    assert.match(landing.stitchedRgbSha256,/^[a-f0-9]{64}$/);
  }
});

test('corners are exactWebMercator native3x3 edges in NW NE SE SW order',()=>{
  for(const [key,landing] of Object.entries(manifest.landings)){
    const [z,x,y]=key.split('/').map(Number);
    const expected=[[lon(x-1,z),lat(y-1,z)],[lon(x+2,z),lat(y-1,z)],
      [lon(x+2,z),lat(y+2,z)],[lon(x-1,z),lat(y+2,z)]];
    for(let i=0;i<4;i++)for(let axis=0;axis<2;axis++)assert.ok(Math.abs(landing.coordinates[i][axis]-expected[i][axis])<1e-12);
    const [nw,ne,se,sw]=landing.coordinates;
    assert.ok(nw[0]<ne[0]&&nw[1]>sw[1]);
    assert.equal(nw[0],sw[0]);assert.equal(ne[0],se[0]);assert.equal(nw[1],ne[1]);assert.equal(sw[1],se[1]);
    for(const event of achievements.filter(event=>manifest.events[event.slug]===key)){
      assert.ok(event.coordinates.lng>nw[0]&&event.coordinates.lng<ne[0]);
      assert.ok(event.coordinates.lat>sw[1]&&event.coordinates.lat<nw[1]);
    }
  }
});

test('all encoded WebP content and filenames are fingerprinted and768x768 without upscaling',async()=>{
  let total=0;
  for(const [key,landing] of Object.entries(manifest.landings)){
    const bytes=await readFile(new URL(`../public${landing.url}`,import.meta.url));
    assert.equal(bytes.length,landing.bytes);assert.equal(sha(bytes),landing.sha256);
    assert.equal(landing.url,`/assets/arrival/landing-${key.replaceAll('/','-')}-${landing.sha256.slice(0,12)}.webp`);
    assert.deepEqual(webpSize(bytes),{width:768,height:768});
    assert.ok(bytes.length<=300_000);total+=bytes.length;
  }
  assert.equal(total,5_061_162);assert.ok(total<5_500_000);
  const overviewBytes=Object.entries(original.tiles).filter(([key])=>key.startsWith('11/')).reduce((sum,[,tile])=>sum+tile.bytes,0);
  assert.ok(total+overviewBytes<12_000_000,'all32 mobile landings+overview fit bounded warm budget');
});

test('local pinned originalPNG cache independently verifies every used source bytehash',async t=>{
  if(!existsSync(sourceCache)){t.skip('Offline authoring PNG cache is unavailable; release assets remain content-hash verified');return;}
  const keys=[...new Set(Object.values(manifest.landings).flatMap(landing=>landing.sourceKeys))];
  for(const key of keys){
    const bytes=await readFile(`${sourceCache}/${key.replaceAll('/','-')}.png`);
    assert.equal(sha(bytes),original.tiles[key].sourceSha256);
    assert.equal(bytes.length,original.tiles[key].sourceBytes);
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    assert.equal(bytes.readUInt32BE(16),256);assert.equal(bytes.readUInt32BE(20),256);
  }
});
