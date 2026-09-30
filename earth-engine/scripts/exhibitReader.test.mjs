import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {contestsAndActivities} from '../src/data/contestsAndActivities.js';
import {createExhibitReader,exhibitInspectionCamera} from '../src/exhibitReader.js';
import {selectAchievementSignContent} from '../src/achievementSigns.js';

const source=name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
const readerSource=source('exhibitReader.js'),sceneSource=source('achievementSceneLayer.js'),mainSource=source('main.js'),css=source('style.css');

test('all 32 authored exhibits fit the available mobile and desktop viewport without changing their geographic centre',()=>{
  for(const project of contestsAndActivities){
    const centre=[project.mapData.coordinates.lng,project.mapData.coordinates.lat],original=[...centre];
    for(const width of [320,390,600,1024,1440]){
      const camera=exhibitInspectionCamera(centre,width),usable=Math.max(220,Math.min(width-64,780));
      assert.deepEqual(camera.center,original);assert.deepEqual(centre,original);
      assert.ok(Number.isFinite(camera.zoom));assert.ok(camera.zoom>=18.4);assert.ok(camera.zoom<=20.8);
      assert.equal(camera.pitch,54);assert.equal(camera.bearing,42);assert.deepEqual(camera.offset,[0,-32]);
      const metresPerPixel=156543.03392*Math.cos(centre[1]*Math.PI/180)/2**camera.zoom;
      assert.ok(55/metresPerPixel<=usable+1e-6,`${project.slug}: court crop at width${width}`);
    }
  }
});

test('mobile compact 44px targets have room between the two projected source sign positions at inspection zoom',()=>{
  for(const width of [320,390,430]){
    const camera=exhibitInspectionCamera([13.79215,52.391331],width);
    const mpp=156543.03392*Math.cos(camera.center[1]*Math.PI/180)/2**camera.zoom;
    const spacing=14*Math.cos(camera.bearing*Math.PI/180)/mpp;
    assert.ok(spacing>44,`width${width}: compact targets overlap`);
  }
  assert.match(css,/reader-label-wide\s*\{\s*display:\s*none/);
  assert.match(css,/reader-label-compact\s*\{\s*display:\s*inline/);
  assert.match(css,/\.exhibit-sign-reader\s*\{[^}]*min-width:\s*44px;[^}]*width:\s*44px/);
});

test('entry, original popup, drive and distant states need no marker or popup allocation',()=>{
  const project=contestsAndActivities[0],content=selectAchievementSignContent(project);
  let zoom=20,centre=project.mapData.coordinates,allowed=false;
  const focus=[centre.lng,centre.lat];
  const scene={getExhibitFocus:()=>focus,getSignContent:()=>content,
    getSignPositions:()=>[[centre.lng-.00005,centre.lat],[centre.lng+.00005,centre.lat]]};
  const reader=createExhibitReader({map:{getCenter:()=>centre,getZoom:()=>zoom},getScene:()=>scene,
    getEvent:()=>project,canRead:()=>allowed,onOpenProject:()=>{throw new Error('no project interaction expected');}});
  // No document/native DOM is installed in this pure test. Any accidental
  // marker/popup allocation in these ineligible states would throw.
  for(let i=0;i<100;i++)reader.sync();
  allowed=true;zoom=17;reader.sync();zoom=20;centre={lng:0,lat:0};reader.sync();reader.clear();
});

test('reader source escapes authored copy with textContent, preserves original source flags and guards stale interactions',()=>{
  assert.match(readerSource,/title\.textContent=content\.title/);
  assert.match(readerSource,/excerpt\.textContent=.*content\.summary:content\.detail/);
  assert.match(readerSource,/content\.summaryTruncated:content\.detailTruncated/);
  assert.ok(!readerSource.includes('.innerHTML'));
  assert.match(readerSource,/if\(!canRead\(\)\|\|getEvent\(\)\?\.slug!==content\.slug\)return/);
  assert.match(readerSource,/getEvent\(\)\?\.slug!==content\.slug\|\|!canRead\(\)/);
  assert.match(readerSource,/onOpenProject\(content\.slug\)/);
});

test('source wiring retains one pair of accessible markers, clears ownership and positions them below physical sign copy',()=>{
  assert.match(readerSource,/markers=positions\.map/);assert.match(readerSource,/positions\.length!==2/);
  assert.match(readerSource,/if\(key===nextKey\)return/);
  assert.match(readerSource,/markers\.forEach\(marker=>marker\.remove\(\)\);markers=\[\]/);
  assert.match(readerSource,/popup\?\.remove\(\);popup=null;key=null/);
  assert.match(readerSource,/button\.setAttribute\('aria-label'/);
  assert.match(readerSource,/anchor:'top',offset:\[0,10\]/);
  assert.match(readerSource,/focusAfterOpen:true/);
  assert.match(css,/\.exhibit-sign-reader\s*\{[^}]*min-height:\s*44px/);
  assert.match(css,/\.exhibit-excerpt-popup\s*\{[^}]*max-width:\s*calc\(100vw - 40px\)/);
});

test('main integrates inspection safely with native imagery, cleared project popup and every focused scene including the hero',()=>{
  const inspection=mainSource.slice(mainSource.indexOf('function inspectExhibit()'),mainSource.indexOf("$('inspect-exhibit').addEventListener"));
  assert.match(inspection,/\$\('detail'\)\.hidden=true/);
  assert.match(inspection,/if\(imagery!=='esa'\)applyImagery\('esa'\)/);
  assert.match(inspection,/mapTransition\.cancel\(\);map\.stop\(\)/);
  assert.match(inspection,/exhibitInspectionCamera\(focus,\$\('map'\)\.clientWidth\)/);
  assert.match(mainSource,/getScene:\(\)=>activeEvent\?\.slug===HERO_VENUE_EVENT\?heroVenue:achievementScenes/);
  assert.match(mainSource,/canRead:\(\)=>[^\n]*!drive\.active[^\n]*\$\('detail'\)\.hidden[^\n]*!cvView\.isOpen\(\)/);
  for(const name of ['function selectEvent','function showWholeEarth']){
    const section=mainSource.slice(mainSource.indexOf(name),mainSource.indexOf(name)+500);
    assert.match(section,/exhibitReader\.clear\(\)/);
  }
});

test('scene lifetime integrates authored signs once and traverses all nested GPU resources on disposal',()=>{
  assert.match(sceneSource,/root\.userData\.signContent=selectAchievementSignContent\(getProject\(slug\)\)/);
  assert.match(sceneSource,/createAchievementSigns\(getProject\(slug\),signOptions\)/);
  assert.match(sceneSource,/for\(const texture of object\.userData\.textures\?\?\[\]\)textures\.add\(texture\)/);
  assert.match(sceneSource,/texture\.dispose\(\);texture\.image=null/);
  assert.match(sceneSource,/getSignContent\(\)/);assert.match(sceneSource,/getSignPositions\(\)/);
});
