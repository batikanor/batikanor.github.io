import {distanceMetres, EARTH_RADIUS_METRES, stepPosition} from './geo.js';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const STOP_EPSILON = 0.015;

/** Pure kinematic handling constants. Units are metres, seconds, radians. */
export const DRIVING_DEFAULTS = Object.freeze({
  maxStepSeconds: 0.05,       // avoid a giant jump after a suspended browser tab
  wheelbaseMetres: 2.65,
  forwardAcceleration: 4.2,
  reverseAcceleration: 2.5,
  serviceBrake: 7.8,
  coastDeceleration: 0.65,
  aerodynamicDrag: 0.012,   // additional m/s² per (m/s)²
  maxForwardSpeed: 15,       // 54 km/h; this is a local demo, not an autobahn
  maxReverseSpeed: 4,        // 14.4 km/h
  maxSteeringAngleDegrees: 33,
  maxLateralAcceleration: 3.5,
  steeringResponsePerSecond: 7,
  geofenceRadiusMetres: 250,
  geofenceBufferMetres: 4,
  geofenceBrake: 6.5
});

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const approachZero = (x, delta) => Math.sign(x) * Math.max(0, Math.abs(x) - delta);
const normalizeHeading = degrees => (degrees % 360 + 360) % 360;

/**
 * Buttons are intentionally independent. Opposed inputs cancel.
 * Input names match main.js's existing Set of keyboard/touch keys.
 */
export function drivingInputFromKeys(keys) {
  const forward = keys.has('w') || keys.has('arrowup');
  const reverse = keys.has('s') || keys.has('arrowdown');
  const right = keys.has('d') || keys.has('arrowright');
  const left = keys.has('a') || keys.has('arrowleft');
  return {throttle: Number(forward) - Number(reverse), steer: Number(right) - Number(left)};
}

/** A snapshot; `stepDriving` never mutates it or its coordinate arrays. */
export function createDrivingState({position, heading = 0, origin = position, speed = 0} = {}) {
  const validCoordinate = value => Array.isArray(value) && value.length === 2 &&
    value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) < 85;
  if (!validCoordinate(position)) {
    throw new TypeError('Driving state requires a finite [longitude, latitude] position.');
  }
  if (!validCoordinate(origin)) {
    throw new TypeError('Driving origin must be a finite [longitude, latitude] coordinate.');
  }
  if (!Number.isFinite(heading) || !Number.isFinite(speed)) {
    throw new TypeError('Heading and speed must be finite.');
  }
  return {
    position: position.slice(), origin: origin.slice(),
    heading: normalizeHeading(heading),
    speed: clamp(speed, -DRIVING_DEFAULTS.maxReverseSpeed, DRIVING_DEFAULTS.maxForwardSpeed),
    steeringAngleRadians: 0,
    geofenceLimited: false,
    geofenceHit: false,
    integratedSeconds: 0
  };
}

function isOutward(position, origin, heading, signedSpeed) {
  const latMid = (position[1] + origin[1]) * 0.5 * RAD;
  const east = (position[0] - origin[0]) * RAD * EARTH_RADIUS_METRES * Math.cos(latMid);
  const north = (position[1] - origin[1]) * RAD * EARTH_RADIUS_METRES;
  const radius = Math.hypot(east, north);
  if (radius < 0.01 || Math.abs(signedSpeed) < STOP_EPSILON) return false;
  const direction = (heading + (signedSpeed < 0 ? 180 : 0)) * RAD;
  return (east * Math.sin(direction) + north * Math.cos(direction)) / radius > 0.02;
}

/**
 * One deterministic bicycle-model step. `input` is {throttle, steer} in [-1,1].
 * Steering affects heading only while moving. There is no tyre/road/collision model.
 * Returns a new state; actual elapsed time is capped to `maxStepSeconds`.
 */
export function stepDriving(state, input = {}, elapsedSeconds, config = DRIVING_DEFAULTS) {
  const dt = Number.isFinite(elapsedSeconds) ? clamp(elapsedSeconds, 0, config.maxStepSeconds) : 0;
  if (dt === 0) return state;
  const throttle = clamp(Number.isFinite(input.throttle) ? input.throttle : 0, -1, 1);
  const steer = clamp(Number.isFinite(input.steer) ? input.steer : 0, -1, 1);
  const previousSpeed = state.speed;
  const resistance = config.coastDeceleration + config.aerodynamicDrag * previousSpeed * previousSpeed;
  let speed;

  if (throttle > 0) {
    speed = previousSpeed < -STOP_EPSILON
      ? Math.min(0, previousSpeed + (config.serviceBrake * throttle + resistance) * dt)
      : Math.min(config.maxForwardSpeed, Math.max(0, previousSpeed) + (config.forwardAcceleration * throttle - (previousSpeed > 0 ? resistance : 0)) * dt);
  } else if (throttle < 0) {
    speed = previousSpeed > STOP_EPSILON
      ? Math.max(0, previousSpeed - (config.serviceBrake * -throttle + resistance) * dt)
      : Math.max(-config.maxReverseSpeed, Math.min(0, previousSpeed) - (config.reverseAcceleration * -throttle - (previousSpeed < 0 ? resistance : 0)) * dt);
  } else {
    speed = approachZero(previousSpeed, resistance * dt);
  }
  if (Math.abs(speed) < STOP_EPSILON) speed = 0;

  // Mechanical steering lock is further reduced by a lateral-acceleration cap.
  // At speed, a full arrow-key input cannot demand an implausibly tight turn.
  const maxAngle = Math.min(config.maxSteeringAngleDegrees * RAD,
    Math.atan(config.maxLateralAcceleration * config.wheelbaseMetres / Math.max(speed * speed, 0.1)));
  const targetAngle = steer * maxAngle;
  const steeringAngleRadians = clamp(
    state.steeringAngleRadians + (targetAngle - state.steeringAngleRadians) * (1 - Math.exp(-config.steeringResponsePerSecond * dt)),
    -maxAngle, maxAngle);

  const origin = state.origin;
  const radius = distanceMetres(origin, state.position);
  let geofenceLimited = false;
  if (isOutward(state.position, origin, state.heading, speed)) {
    const room = Math.max(0, config.geofenceRadiusMetres - config.geofenceBufferMetres - radius);
    const allowedSpeed = Math.sqrt(2 * config.geofenceBrake * room);
    if (Math.abs(speed) > allowedSpeed) {
      speed = Math.sign(speed) * allowedSpeed;
      geofenceLimited = true;
    }
  }

  const travel = (previousSpeed + speed) * 0.5 * dt;
  const turnDegrees = travel / config.wheelbaseMetres * Math.tan(steeringAngleRadians) * DEG;
  const heading = normalizeHeading(state.heading + turnDegrees);
  let position = stepPosition(state.position, state.heading + turnDegrees * 0.5, travel);
  let geofenceHit = false;
  if (distanceMetres(origin, position) > config.geofenceRadiusMetres) {
    // Safety net for an unusual large inherited speed or nearly tangential move.
    // Do not let the visual car escape the authored local venue area.
    position = state.position.slice();
    speed = 0;
    geofenceLimited = true;
    geofenceHit = true;
  }

  return {
    position, origin, heading, speed, steeringAngleRadians,
    geofenceLimited, geofenceHit, integratedSeconds: dt
  };
}
