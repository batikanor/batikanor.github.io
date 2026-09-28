import test from 'node:test';
import assert from 'node:assert/strict';
import {MARKER_ZOOM, markerLevelForZoom, geographicCentroid, declutterMarkers} from '../src/markerPolicy.js';

test('city markers already replace country labels at the 100 km central-Europe scale',()=>{
  assert.equal(markerLevelForZoom(1.85),'region');
  assert.equal(markerLevelForZoom(MARKER_ZOOM.regionToCountry),'country');
  assert.equal(markerLevelForZoom(MARKER_ZOOM.countryToCity),'city');
  assert.equal(markerLevelForZoom(7),'city');
  assert.equal(markerLevelForZoom(MARKER_ZOOM.cityToAchievement),'achievement');
  assert.throws(()=>markerLevelForZoom(NaN),TypeError);
});

test('Hong Kong and Nara region marker is between the two cities, not on Hong Kong',()=>{
  const [lng,lat]=geographicCentroid([
    {lng:114.1698,lat:22.2745},
    {lng:135.6682,lat:34.6128}
  ]);
  assert.ok(lng>124&&lng<126,`longitude ${lng}`);
  assert.ok(lat>28&&lat<30,`latitude ${lat}`);
});

test('region midpoint is city-weighted by default and can explicitly be achievement-weighted',()=>{
  const points=[{lng:11.6,lat:48.2},{lng:13.4,lat:52.5}];
  const equal=geographicCentroid(points);
  const biased=geographicCentroid([{...points[0],weight:9},points[1]]);
  assert.ok(equal[0]>biased[0]);
  assert.ok(equal[1]>biased[1]);
});

test('spherical centroid handles the antimeridian and rejects undefined antipodal midpoint',()=>{
  const [lng,lat]=geographicCentroid([{lng:179,lat:0},{lng:-179,lat:0}]);
  assert.ok(Math.abs(lng)>179.9);
  assert.ok(Math.abs(lat)<1e-10);
  assert.throws(()=>geographicCentroid([{lng:0,lat:0},{lng:180,lat:0}]),RangeError);
  assert.throws(()=>geographicCentroid([]),TypeError);
});

test('screen-space declutter keeps important separated cities while suppressing collisions',()=>{
  const cities=[
    {id:'Munich',x:100,y:100,width:85,height:30,priority:9},
    {id:'Salzburg',x:143,y:108,width:90,height:30,priority:1},
    {id:'Berlin',x:450,y:100,width:75,height:30,priority:3},
    {id:'Zurich',x:210,y:190,width:70,height:30,priority:3}
  ];
  assert.deepEqual(declutterMarkers(cities).map(c=>c.id),['Munich','Berlin','Zurich']);
  assert.deepEqual(cities.map(c=>c.id),['Munich','Salzburg','Berlin','Zurich'],'input remains unchanged');
  const selected=declutterMarkers(cities.map(c=>c.id==='Salzburg'?{...c,priority:100}:c));
  assert.ok(selected.some(c=>c.id==='Salzburg'));
  assert.ok(!selected.some(c=>c.id==='Munich'));
});
