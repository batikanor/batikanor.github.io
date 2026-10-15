import test from 'node:test';
import assert from 'node:assert/strict';
import {createRoomJumpState, stepRoomJump} from '../src/galleryRoomJump.js';

const near = (actual, expected, tolerance = 1e-10) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${actual} differs from ${expected}`);
function advance(state, seconds, fps, options = {}) {
  let remaining = seconds;
  while (remaining > 1e-12) {
    const elapsed = Math.min(1 / fps, remaining);
    state = stepRoomJump(state, elapsed, options);remaining -= elapsed;
  }
  return state;
}
const startJump = () => stepRoomJump(createRoomJumpState(), 0, {requestJump: true});

test('a grounded press produces a ballistic 0.89 metre jump and lands exactly at rest', () => {
  const initial = Object.freeze(createRoomJumpState());
  assert.deepEqual(initial, {height: 0, velocity: 0, grounded: true});
  const launched = stepRoomJump(initial, 0, {requestJump: true});
  assert.deepEqual(launched, {height: 0, velocity: 5, grounded: false});
  assert.notEqual(launched, initial);assert.deepEqual(initial, createRoomJumpState());
  const apex = advance(launched, 5 / 14, 60);
  near(apex.height, 25 / 28);near(apex.velocity, 0);assert.equal(apex.grounded, false);
  const descending = advance(apex, .3, 60);
  assert.ok(descending.height > 0 && descending.velocity < 0);
  assert.deepEqual(advance(launched, 10 / 14, 144), createRoomJumpState(), 'the exact flight duration reaches the floor');
  const landed = advance(descending, .1, 60);
  assert.deepEqual(landed, createRoomJumpState());
  assert.deepEqual(advance(landed, 10, 60), landed);
});

test('30, 60 and 144 fps follow the same rise, apex, descent and landing', () => {
  for (const seconds of [.1, 5 / 14, .4, .7, .72, 1]) {
    const states = [30, 60, 144].map(fps => advance(startJump(), seconds, fps));
    for (const state of states.slice(1)) {
      near(state.height, states[0].height);near(state.velocity, states[0].velocity);
      assert.equal(state.grounded, states[0].grounded);
    }
    if (seconds >= 10 / 14) assert.deepEqual(states[0], createRoomJumpState());
    else {
      near(states[0].height, 5 * seconds - 7 * seconds * seconds);
      near(states[0].velocity, 5 - 14 * seconds);
    }
  }
});

test('repeated midair requests cannot add velocity, and another press works after landing', () => {
  const ascending = advance(startJump(), .2, 60);
  const repeated = advance(ascending, .45, 144, {requestJump: true});
  const uninterrupted = advance(ascending, .45, 144);
  assert.deepEqual(repeated, uninterrupted);assert.equal(repeated.grounded, false);
  const landed = advance(repeated, .1, 60);
  assert.deepEqual(landed, createRoomJumpState());
  const second = stepRoomJump(landed, 1 / 60, {requestJump: true});
  assert.ok(second.height > 0 && second.velocity > 0);assert.equal(second.grounded, false);
});

test('a low ceiling stops the rise at contact and allows a frame-rate-independent fall', () => {
  const ceilingHeight = .2;
  const contactTime = (5 - Math.sqrt(25 - 28 * ceilingHeight)) / 14;
  const contact = advance(startJump(), contactTime, 144, {ceilingHeight});
  near(contact.height, ceilingHeight);near(contact.velocity, 0);
  for (const fps of [30, 60, 144]) {
    let state = startJump(), maximum = 0;
    for (let frame = 0; frame < fps; frame++) {
      state = stepRoomJump(state, 1 / fps, {ceilingHeight});maximum = Math.max(maximum, state.height);
      assert.ok(state.height <= ceilingHeight && state.height >= 0);
    }
    assert.ok(maximum > .18);assert.deepEqual(state, createRoomJumpState());
    const falling = advance(startJump(), .1, fps, {ceilingHeight});
    const fallTime = .1 - contactTime;
    near(falling.height, ceilingHeight - 7 * fallTime * fallTime);near(falling.velocity, -14 * fallTime);
  }
  assert.deepEqual(stepRoomJump(createRoomJumpState(), .02, {requestJump: true, ceilingHeight: 0}), createRoomJumpState());
  const loweredRoof = stepRoomJump(advance(startJump(), .2, 60), .01, {ceilingHeight: .1});
  assert.ok(loweredRoof.height < .1 && loweredRoof.velocity < 0, 'a changed clearance never leaves the camera beyond the roof');
});

test('pause and resume preserve a jump and cap a delayed frame instead of teleporting to landing', () => {
  const airborne = Object.freeze(advance(startJump(), .2, 60));
  for (const elapsed of [0, -1, NaN, Infinity, -Infinity]) {
    assert.deepEqual(stepRoomJump(airborne, elapsed), airborne);
  }
  const resumed = stepRoomJump(airborne, 300);
  assert.deepEqual(resumed, stepRoomJump(airborne, .05));
  assert.ok(resumed.height > airborne.height);assert.equal(resumed.grounded, false);
  assert.deepEqual(advance(resumed, 1, 60), createRoomJumpState());
  assert.deepEqual(airborne, advance(startJump(), .2, 60), 'stepping never mutates a held state');
});

test('invalid or extreme inputs return finite bounded state without crossing floor or ceiling', () => {
  for (const state of [undefined, {}, {height: Infinity, velocity: NaN},
    {height: -100, velocity: -100}, {height: 1e300, velocity: 1e300, grounded: false},
    {height: .8, velocity: -1e300, grounded: false}]) {
    for (const ceilingHeight of [Infinity, .1, 0, -1, NaN, -Infinity]) {
      const next = stepRoomJump(state, 1e300, {ceilingHeight});
      assert.ok(Number.isFinite(next.height) && next.height >= 0 && next.height <= 25 / 28);
      assert.ok(Number.isFinite(next.velocity) && Math.abs(next.velocity) <= 5);
      assert.equal(typeof next.grounded, 'boolean');
      if (Number.isFinite(ceilingHeight)) assert.ok(next.height <= Math.max(0, ceilingHeight));
    }
  }
});
