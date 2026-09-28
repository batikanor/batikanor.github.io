# Driving physics integration note

`src/drivingPhysics.js` is a pure, deterministic **kinematic** handling module. It does not modify MapLibre, Three.js, DOM, or the app's existing `drive` object. It uses `geo.js` for metre-based WGS84 movement.

## Behaviour

- Signed velocity in m/s: W/↑ accelerates forward; S/↓ brakes, then engages capped reverse. Releasing both coasts with rolling and quadratic drag.
- Bicycle-model heading from wheelbase and steered front-wheel angle. A/D or ←/→ turn the wheel; the body cannot spin when stationary. Steering smoothly recentres and is limited by both mechanical lock and a practical lateral-acceleration ceiling at speed.
- A browser stall cannot produce a kilometre jump: one step accepts at most 50 ms of elapsed time. State transitions never mutate the input snapshot.
- A 250 m venue geofence starts slowing outward travel before the edge and has a hard containment guard. Reverse/inward travel remains possible. This is **not** a road, pavement, curb, roof, or collision model.

## Minimal main.js integration

Do not import this alongside the old ad-hoc speed/yaw updates. Replace that block after selecting a curated, physically suitable road start:

```js
import {
  createDrivingState,
  drivingInputFromKeys,
  stepDriving
} from './drivingPhysics.js';

let physicsState = null;

// In startDrive(), after assigning curated drive.position and drive.heading:
physicsState = createDrivingState({
  position: drive.position,
  heading: drive.heading,
  origin: drive.position
});
drive.speed = 0;
drive.last = performance.now();

// In tickDrive(now), replace the old integration block:
const before = physicsState;
physicsState = stepDriving(
  physicsState,
  drivingInputFromKeys(drive.keys),
  (now - drive.last) / 1000
);
drive.last = now;
drive.position = physicsState.position;
drive.heading = physicsState.heading;
drive.speed = physicsState.speed;
document.getElementById('speed').textContent =
  String(Math.round(Math.abs(drive.speed) * 3.6));
if (before.position[0] !== physicsState.position[0] ||
    before.position[1] !== physicsState.position[1] ||
    before.heading !== physicsState.heading) {
  map.jumpTo({center: drive.position, zoom: 20.15, pitch: 68, bearing: drive.heading});
  map.triggerRepaint();
}
// Optional: announce physicsState.geofenceLimited once, not on every frame.
requestAnimationFrame(tickDrive);
```

The prototype's Three car reads the existing mutable `drive` object, so mirroring the returned state fields is intentional. Call `createDrivingState` on **every** new drive to reset the origin and steering angle. Do not continue integrating after `finishDrive()`.

## Verification

```sh
cd /Users/batikanor2/Documents/development/personal-git/batikanor.github.io-workspace/experiments/earth-engine
npm run test:drive
npm run benchmark:drive
```

The unit suite checks throttle/brake/reverse, no stationary spin, speed-limited turns, 50 ms stall clamp, true short-range WGS84 metre scale, determinism, and geofence containment. The benchmark performs 100,000 steps and reports throughput. It is a local computational sanity check, **not** a browser frame-time or GPU benchmark; rendering, tile fetches, and DOM work still dominate production profiling.
