import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';

const manifest=JSON.parse(readFileSync(new URL('../src/data/destinationOrthophotos.json',import.meta.url)));
const achievements=JSON.parse(readFileSync(new URL('../src/data/achievements.json',import.meta.url)));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const publicUrl=url=>new URL(`../public/${url}`,import.meta.url);

test('native aerial quality coverage is explicit: 30 events, not invented detail for the two remaining events',()=>{
  assert.equal(manifest.schema,1);
  assert.equal(Object.keys(manifest.events).length,30);
  assert.equal(Object.keys(manifest.patches).length,29);
  assert.deepEqual(Object.keys(manifest.missing).sort(),['bachelors-thesis','tgu-perfect-gpa']);
  for(const event of achievements){
    assert.ok(manifest.events[event.slug]||manifest.missing[event.slug],event.slug);
    if(manifest.events[event.slug])assert.ok(manifest.patches[manifest.events[event.slug]],event.slug);
  }
});

test('all owned aerial assets preserve audited image sizes and pixel hashes with one bounded decoded image',()=>{
  let fullBytes=0,mobileBytes=0;
  for(const patch of Object.values(manifest.patches)){
    assert.equal(patch.width,2048);
    assert.equal(patch.height,2048);
    assert.ok(patch.resolutionM>0.35&&patch.resolutionM<0.7,patch.id);
    assert.equal(patch.mobile.width,1024);
    assert.equal(patch.mobile.height,1024);
    assert.ok(Math.abs(patch.mobile.resolutionM/patch.resolutionM-2)<0.00001,patch.id);
    for(const asset of [patch,patch.mobile]){
      const bytes=readFileSync(publicUrl(asset.url));
      assert.equal(bytes.length,asset.bytes,asset.url);
      assert.equal(hash(bytes),asset.sha256,asset.url);
      assert.equal(asset.decodedRgbaBytes,asset.width*asset.height*4);
      assert.ok(asset.decodedRgbaBytes<=16_777_216);
      assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    }
    fullBytes+=patch.bytes;mobileBytes+=patch.mobile.bytes;
  }
  assert.equal(fullBytes,45_624_644);
  assert.equal(mobileBytes,14_804_348);
});

test('aerial rectangles contain the exact authored event points and both tiers describe the same source geometry',()=>{
  for(const [slug,key]of Object.entries(manifest.events)){
    const event=achievements.find(event=>event.slug===slug),patch=manifest.patches[key];
    const [w,s,e,n]=patch.bounds;
    assert.ok(event.coordinates.lng>=w&&event.coordinates.lng<=e,slug);
    assert.ok(event.coordinates.lat>=s&&event.coordinates.lat<=n,slug);
    assert.deepEqual(patch.coordinates,[[w,n],[e,n],[e,s],[w,s]]);
    assert.ok(e>w&&n>s);
    assert.ok((e-w)<0.025&&(n-s)<0.02,slug);
    assert.ok(patch.source.attribution&&patch.source.license&&patch.source.licenseUrl&&patch.source.url,slug);
  }
});

test('sources are real official WMS or native z18 imagery; no ESA satellite upscale is counted as aerial quality',()=>{
  for(const patch of Object.values(manifest.patches)){
    if(patch.provenance){
      assert.ok(patch.id.startsWith('tesla-'));
      assert.equal(hash(readFileSync(publicUrl(patch.provenance.metadataUrl))),patch.provenance.metadataSha256);
      continue;
    }
    assert.ok(patch.inputs.length===1||patch.inputs.length===64,patch.id);
    for(const input of patch.inputs){
      assert.ok(/^https:/.test(input.url));
      assert.equal(input.sha256.length,64);
      assert.ok(input.bytes>1000);
      assert.ok(!/terrascope|s2cloudless|arcgisonline|google|mapbox|bing\.com/.test(new URL(input.url).hostname));
      if('z'in input)assert.equal(input.z,18);
      else{
        const params=new URL(input.url).searchParams;
        assert.equal(params.get('request'),'GetMap');
        assert.equal(params.get('width'),'2048');
        assert.equal(params.get('height'),'2048');
      }
    }
  }
});

test('Hong Kong additional on-map logo requirement is retained rather than silently dropping source obligations',()=>{
  const patch=manifest.patches[manifest.events['hong-kong-talent-engage-eurotech-healthtech-2026']];
  assert.equal(patch.source.requiresLogo,true);
  assert.ok(patch.source.logoSourceUrl.startsWith('https://api.hkmapservice.gov.hk/'));
  const logo=publicUrl(patch.source.logoUrl);
  assert.ok(statSync(logo).size>1000);
  assert.equal(hash(readFileSync(logo)),'97fc83e2643b2e98dd40afae56a63ad2ad6cbc4aa6dd0152cd4ec44d5912ed59');
});

test('Hong Kong imagery is centred on the government-confirmed Revenue Tower rather than the previous forest estimate',()=>{
  const patch=manifest.patches[manifest.events['hong-kong-talent-engage-eurotech-healthtech-2026']];
  const proof=patch.locationProvenance;
  assert.equal(proof.contactUrl,'https://www.hkengage.gov.hk/en/contact-us');
  assert.equal(proof.sourceCrs,'EPSG:2326');
  assert.deepEqual(proof.sourcePoint,[835749,815637]);
  assert.deepEqual(proof.previousEstimatedCoordinates,[114.1698,22.2745]);
  assert.ok(Math.abs(proof.convertedWgs84Coordinates[0]-114.1718383764)<1e-9);
  assert.ok(Math.abs(proof.convertedWgs84Coordinates[1]-22.2796020939)<1e-9);
  assert.equal(proof.sourceResponseSha256,'846a5e1d76323ac396290de4be1ec9ffb7fb97bb5ed8b3a7953a1e3d99e6cd88');
  const [west,south,east,north]=patch.bounds;
  const [lon,lat]=proof.convertedWgs84Coordinates;
  assert.ok(lon>west+(east-west)*.35&&lon<west+(east-west)*.7);
  assert.ok(lat>south+(north-south)*.35&&lat<north-(north-south)*.35);
});
