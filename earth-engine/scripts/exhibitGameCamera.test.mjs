import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exhibitGameCamera} from '../src/exhibitGameCamera.js';
import {exhibitInspectionCamera} from '../src/exhibitInspectionCamera.js';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {selectExhibitRoof} from '../src/achievementSceneLayer.js';

const context = JSON.parse(readFileSync(new URL('../public/data/achievement-context-v2.json', import.meta.url), 'utf8'));
const viewports = [[1512, 828], [390, 844], [844, 390]];

/** Independent FOV projection of the eight game corners after easeTo. */
function projectedGameBounds(camera, width, height, {baseM = 0, scale = 4, floorM = 7.28, hero = false,includeSigns=false} = {}) {
  if (hero) { baseM = 0; scale = 1; floorM = 0; }
  const distance = height / 2 / Math.tan(.6435011087932844 / 2);
  const pitch = camera.pitch * Math.PI / 180, bearing = camera.bearing * Math.PI / 180;
  const sin = Math.sin(pitch), cos = Math.cos(pitch), yawSin = Math.sin(bearing), yawCos = Math.cos(bearing);
  const mpp = 78271.51696 * Math.cos(camera.center[1] * Math.PI / 180) / 2 ** camera.zoom;
  const q = camera.offset[1], shift = -q * distance / (distance * cos + q * sin);
  const horizontal = camera.offset[0] * (distance + shift * sin) / distance;
  const bounds = {left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity};
  const halfWidth=includeSigns?10.45:6.8;
  for (const east of [-halfWidth * scale, halfWidth * scale]) for (const north of [-6.8 * scale, 6.8 * scale])
    for (const altitude of [baseM + floorM * scale, baseM + (floorM + 4.7) * scale]) {
      const n = shift + (east * yawSin + north * yawCos) / mpp;
      const x = horizontal + (east * yawCos - north * yawSin) / mpp, z = altitude / mpp;
      const depth = distance + n * sin - z * cos;
      assert.ok(depth > 0, 'every physical game corner remains in front of the camera');
      const pixelX = width / 2 + distance * x / depth;
      const pixelY = height / 2 - distance * (n * cos + z * sin) / depth;
      assert.ok(Number.isFinite(pixelX) && Number.isFinite(pixelY));
      bounds.left = Math.min(bounds.left, pixelX); bounds.right = Math.max(bounds.right, pixelX);
      bounds.top = Math.min(bounds.top, pixelY); bounds.bottom = Math.max(bounds.bottom, pixelY);
    }
  return bounds;
}

function assertFits(camera, width, height, options = {}, label = '') {
  const bounds = projectedGameBounds(camera, width, height, options);
  const inset = Math.min(24, width * .06), top = (options.headerBottom ?? 72) + 8;
  const bottom = (options.footerTop ?? height - 114) - 8, epsilon = 1e-6;
  assert.ok(bounds.left >= inset - epsilon && bounds.right <= width - inset + epsilon,
    `${label}: game exceeds screen width (${bounds.left}..${bounds.right})`);
  assert.ok(bounds.top >= top - epsilon && bounds.bottom <= bottom + epsilon,
    `${label}: game obscured by header/footer (${bounds.top}..${bounds.bottom})`);
  assert.ok(camera.zoom <= 21.35 && Number.isFinite(camera.zoom));
  assert.equal(camera.bearing, 0);
  assert.equal(camera.pitch, 54);
  assert.equal(camera.offset[0], 0);
  return bounds;
}

test('all 32 physical playgrounds fit their real roof elevation on desktop, portrait and landscape screens', () => {
  assert.equal(contestsAndActivities.length, 32);
  for (const project of contestsAndActivities) {
    const center = Object.freeze([project.mapData.coordinates.lng, project.mapData.coordinates.lat]);
    const chapter = context.chapters.find(chapter => chapter.slugs.includes(project.slug));
    const roof = selectExhibitRoof(chapter), baseM = roof ? roof.building.height + .15 : 0;
    for (const [width, height] of viewports) {
      const options = {height, baseM};
      const camera = exhibitGameCamera(center, width, options);
      assertFits(camera, width, height, options, `${project.slug} ${width}x${height} roof ${baseM}`);
      assert.equal(camera.center, center, 'camera preserves the geographic exhibit anchor');
      assert.deepEqual(center, [project.mapData.coordinates.lng, project.mapData.coordinates.lat]);
    }
  }
});

test('the playable volume and rim signs stay clear of expanded reading cards at real roof heights',()=>{
  const layouts=[
    [1280,633,{x:24,y:88,width:860,height:400}],
    [390,844,{left:24,top:88,right:366,bottom:480}],
    [844,390,{x:24,y:80,width:510,height:166}],
  ];
  for(const baseM of [0,13.15,90])for(const [width,height,gameRect]of layouts)for(const hero of [false,true]){
    const options={height,baseM,hero,gameRect,includeSigns:true};
    const camera=exhibitGameCamera([13.4,52.5],width,options);
    const bounds=projectedGameBounds(camera,width,height,options);
    const left=gameRect.left??gameRect.x,right=gameRect.right??gameRect.x+gameRect.width;
    const top=gameRect.top??gameRect.y,bottom=gameRect.bottom??gameRect.y+gameRect.height;
    assert.ok(bounds.left>=left-1e-6&&bounds.right<=right+1e-6,`${width}x${height}: reading card covers the game or rim signs`);
    assert.ok(bounds.top>=top-1e-6&&bounds.bottom<=bottom+1e-6,`${width}x${height}: notes tray covers the game`);
    assert.ok(Math.abs((bounds.left+bounds.right)/2-(left+right)/2)<1e-6);
    assert.ok(camera.offset.every(Number.isFinite));
  }
});

test('90m roofs and measured mobile/landscape chrome remain fully inside the safe game area', () => {
  for (const center of [[13.4, 52.5], [8.54, 47.38], [135.5, 34.7], [24.94, 60.17]])
    for (const [width, height, headerBottom, footerTop] of [[1512,828,74,708], [390,844,88,658], [844,390,77,236]]) {
      const options = {height, baseM: 90, headerBottom, footerTop};
      const camera = exhibitGameCamera(center, width, options);
      const bounds = assertFits(camera, width, height, options, `${width}x${height} high roof`);
      const availableWidth = width - 2 * Math.min(24, width * .06), availableHeight = footerTop - headerBottom - 16;
      assert.ok(Math.max((bounds.right - bounds.left) / availableWidth, (bounds.bottom - bounds.top) / availableHeight) > .99,
        'closest fitting game camera uses the available interior viewport');
    }
});

test('hero games use the same exact projection and recompute centring when the zoom ceiling is reached', () => {
  let capped = 0;
  for (const center of [[13.4,52.5], [135.5,34.7], [24.94,60.17]]) for (const [width, height] of viewports) {
    const options = {height, hero: true, baseM: 90, scale: 4, floorM: 7.28};
    const camera = exhibitGameCamera(center, width, options), bounds = assertFits(camera, width, height, options, 'hero');
    if (camera.zoom === 21.35) capped++;
    assert.ok(Math.abs((bounds.top + bounds.bottom) / 2 - (80 + height - 122) / 2) < 1e-6,
      'elevated/perspective offset centres the actual capped game bounds');
    assert.equal(camera.center, center);
  }
  assert.ok(capped > 0, 'test exercises the maximum zoom cap');
});

test('game framing makes the playable floor substantially larger than whole-capsule inspection', () => {
  for (const [width, height] of viewports) {
    const center = [13.79215,52.391331], options = {height, baseM: 20};
    const camera = exhibitGameCamera(center, width, options);
    const game = projectedGameBounds(camera, width, height, options);
    const inspection = exhibitInspectionCamera(center, width, {height, exhibitBaseM: 20, exhibitScale: 4,
      exhibitHeightM: 20 + 21.15 * 4});
    const previous = projectedGameBounds(inspection, width, height, options);
    assert.ok((game.right - game.left) > (previous.right - previous.left) * 1.2,
      `${width}x${height}: physical miniatures need a closer camera than the capsule/ladder`);
  }
});

test('bounded fitting stays finite with tiny or overlapping browser chrome', () => {
  for (const [width, height, headerBottom, footerTop] of [[160,120,110,20], [32,32,72,-82], [320,200,130,135]]) {
    const center = [13.4,52.5], options = {height, baseM: 90, headerBottom, footerTop};
    const camera = exhibitGameCamera(center, width, options);
    const bounds = projectedGameBounds(camera, width, height, options);
    assert.ok(Object.values(bounds).every(Number.isFinite));
    assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= height);
    assert.ok(camera.offset.every(Number.isFinite));
  }
});
