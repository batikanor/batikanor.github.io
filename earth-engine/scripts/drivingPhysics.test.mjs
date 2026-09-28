import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {createDrivingState, drivingInputFromKeys, stepDriving, DRIVING_DEFAULTS} from '../src/drivingPhysics.js';
import {distanceMetres} from '../src/geo.js';

const SPAWN = [11.666954, 48.262269];
const tick = (state, input, frames = 1, config = DRIVING_DEFAULTS) => {
  for (let i = 0; i < frames; i++) state = stepDriving(state, input, 1 / 60, config);
  return state;
};

test('keyboard and touch key pairs convert to bounded, cancelling inputs', () => {
  assert.deepEqual(drivingInputFromKeys(new Set(['w', 'arrowright'])), {throttle: 1, steer: 1});
  assert.deepEqual(drivingInputFromKeys(new Set(['arrowup', 's', 'a', 'd'])), {throttle: 0, steer: 0});
  assert.deepEqual(drivingInputFromKeys(new Set()), {throttle: 0, steer: 0});
});

test('state creation protects coordinates and normalizes heading', () => {
  const input = SPAWN.slice();
  const state = createDrivingState({position: input, heading: -135});
  input[0] = 0;
  assert.deepEqual(state.position, SPAWN);
  assert.deepEqual(state.origin, SPAWN);
  assert.equal(state.heading, 225);
  assert.throws(() => createDrivingState({position: [NaN, 10]}), TypeError);
  assert.throws(() => createDrivingState({position: [200, 10]}), TypeError);
  assert.equal(createDrivingState({position: SPAWN, speed: 100}).speed, DRIVING_DEFAULTS.maxForwardSpeed);
});

test('stationary steering turns wheels but never rotates or translates the car', () => {
  const initial = createDrivingState({position: SPAWN, heading: 225});
  const final = tick(initial, {steer: 1}, 180);
  assert.equal(final.speed, 0);
  assert.equal(final.heading, 225);
  assert.deepEqual(final.position, SPAWN);
  assert.ok(final.steeringAngleRadians > 0);
  assert.deepEqual(initial.position, SPAWN, 'input state was not mutated');
});

test('forward acceleration is responsive but capped; neutral coasts to a stop', () => {
  const openGround = {...DRIVING_DEFAULTS, geofenceRadiusMetres: 1_000_000};
  let state = createDrivingState({position: SPAWN, heading: 0});
  state = tick(state, {throttle: 1}, 60, openGround);
  assert.ok(state.speed > 3 && state.speed < 5, `one-second speed ${state.speed}`);
  state = tick(state, {throttle: 1}, 1200, openGround);
  assert.ok(state.speed <= DRIVING_DEFAULTS.maxForwardSpeed);
  const peak = state.speed;
  state = tick(state, {}, 900, openGround);
  assert.ok(state.speed < peak);
  assert.equal(state.speed, 0);
});

test('opposite throttle brakes before reverse and reverse remains capped', () => {
  let state = createDrivingState({position: SPAWN, heading: 0});
  state = tick(state, {throttle: 1}, 120);
  const before = state.speed;
  state = tick(state, {throttle: -1}, 1);
  assert.ok(state.speed >= 0 && state.speed < before, 'first reverse command brakes');
  state = tick(state, {throttle: -1}, 240);
  assert.ok(state.speed < 0);
  assert.ok(state.speed >= -DRIVING_DEFAULTS.maxReverseSpeed);
});

test('bicycle turn follows travel direction, and reverse turns the opposite way', () => {
  let forward = createDrivingState({position: SPAWN, heading: 0});
  forward = tick(forward, {throttle: 1, steer: 1}, 120);
  assert.ok(forward.heading > 0 && forward.heading < 180);
  assert.ok(distanceMetres(SPAWN, forward.position) > 3);

  let reverse = createDrivingState({position: SPAWN, heading: 0});
  reverse = tick(reverse, {throttle: -1, steer: 1}, 120);
  assert.ok(reverse.heading > 180, `reverse heading ${reverse.heading}`);
});

test('steering lock decreases strongly at higher speed', () => {
  const slow = stepDriving(createDrivingState({position: SPAWN, speed: 1}), {steer: 1}, 0.05);
  const fast = stepDriving(createDrivingState({position: SPAWN, speed: 14}), {steer: 1}, 0.05);
  assert.ok(slow.steeringAngleRadians > fast.steeringAngleRadians * 5);
});

test('an enormous elapsed time is clamped rather than teleporting', () => {
  const state = createDrivingState({position: SPAWN});
  const stepped = stepDriving(state, {throttle: 1}, 60);
  assert.equal(stepped.integratedSeconds, DRIVING_DEFAULTS.maxStepSeconds);
  assert.ok(distanceMetres(SPAWN, stepped.position) < 0.1);
  assert.equal(stepDriving(state, {throttle: 1}, -1), state);
});

test('WGS84 motion retains real metre scale over short local travel', () => {
  const state = createDrivingState({position: SPAWN, speed: 10, heading: 90});
  const stepped = stepDriving(state, {throttle: 1}, 0.05);
  const expected = (10 + stepped.speed) * 0.5 * 0.05;
  assert.ok(Math.abs(distanceMetres(SPAWN, stepped.position) - expected) < 0.001);
});

test('soft geofence slows and safely contains repeated outward driving', () => {
  let state = createDrivingState({position: SPAWN, heading: 0});
  let limited = false;
  for (let i = 0; i < 4800; i++) {
    state = stepDriving(state, {throttle: 1}, 1 / 60);
    limited ||= state.geofenceLimited;
    assert.ok(distanceMetres(SPAWN, state.position) <= DRIVING_DEFAULTS.geofenceRadiusMetres + 0.001);
  }
  assert.ok(limited);
  assert.ok(state.speed < 0.05);
  const atEdge = distanceMetres(SPAWN, state.position);
  assert.ok(atEdge > 240);
  state = tick(state, {throttle: -1}, 180);
  assert.ok(distanceMetres(SPAWN, state.position) < atEdge - 1, 'reversing can retreat from the boundary');
});

test('identical input traces produce byte-for-byte identical final states', () => {
  const simulate = () => {
    let state = createDrivingState({position: SPAWN, heading: 225});
    for (let i = 0; i < 3000; i++) {
      const input = {throttle: i < 800 ? 1 : i < 1300 ? 0 : -1, steer: i % 180 < 90 ? 0.5 : -0.5};
      state = stepDriving(state, input, 1 / 60);
    }
    return state;
  };
  assert.deepEqual(simulate(), simulate());
});

test('100,000 deterministic physics steps complete within a generous browser-budget sanity threshold', () => {
  let state = createDrivingState({position: SPAWN, heading: 225});
  const start = performance.now();
  for (let i = 0; i < 100_000; i++) {
    const input = {throttle: i % 800 < 400 ? 1 : -1, steer: i % 1000 < 500 ? 0.2 : -0.2};
    state = stepDriving(state, input, 1 / 60);
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 5000, `physics benchmark took ${elapsed.toFixed(1)} ms`);
  assert.ok(Number.isFinite(state.position[0]));
  console.log(`Driving physics: 100,000 steps in ${elapsed.toFixed(1)} ms (${Math.round(100_000 / (elapsed / 1000)).toLocaleString()} steps/s)`);
});
