import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sampleTerrainElevation} from '../src/geo.js';

test('cross-city stale DEM samples remain pending and recover as new terrain arrives',()=>{
  let available=false;
  const map={queryTerrainElevation(point){
    assert.deepEqual(point,[114.17,22.28]);
    if(!available)throw new RangeError('Out of range source coordinates for DEM data. x: -418, y: -223, dim: 512');
    return 37.5;
  }};
  assert.equal(sampleTerrainElevation(map,[114.17,22.28]),null);
  available=true;assert.equal(sampleTerrainElevation(map,[114.17,22.28]),37.5);
});

test('missing or nonfinite terrain stays pending while unrelated errors are still reported',()=>{
  for(const value of [null,undefined,NaN,Infinity])assert.equal(sampleTerrainElevation({queryTerrainElevation:()=>value},[0,0]),null);
  assert.equal(sampleTerrainElevation({},[0,0]),null);
  assert.equal(sampleTerrainElevation({queryTerrainElevation:()=>0},[0,0]),0);
  for(const error of [new Error('Terrain source unavailable'),new RangeError('Invalid latitude')]){
    assert.throws(()=>sampleTerrainElevation({queryTerrainElevation(){throw error;}},[0,0]),e=>e===error);
  }
});
