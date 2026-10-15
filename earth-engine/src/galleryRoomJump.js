const GRAVITY = 14;
const IMPULSE = 5;
const MAX_HEIGHT = IMPULSE * IMPULSE / (2 * GRAVITY);
const MAX_STEP = .05;

/** Vertical displacement above the camera's current resting position, in metres. */
export function createRoomJumpState() {
  return {height: 0, velocity: 0, grounded: true};
}

/**
 * Return a new state without changing the input. requestJump is a one-frame
 * press request, so callers should ignore keyboard auto-repeat. ceilingHeight
 * is the available clearance above the resting position, not a world Y value.
 * Exact ballistic integration is independent of frame rate; elapsed time is
 * capped at 50 ms so resuming a paused tab never skips through the whole jump.
 * Invalid time does not advance physics; invalid state/clearance is bounded.
 */
export function stepRoomJump(state, deltaSeconds, {requestJump = false, ceilingHeight = Infinity} = {}) {
  const clearance = ceilingHeight === Infinity ? MAX_HEIGHT
    : Number.isFinite(ceilingHeight) ? Math.max(0, Math.min(MAX_HEIGHT, ceilingHeight)) : 0;
  let height = Number.isFinite(state?.height) ? Math.max(0, Math.min(clearance, state.height)) : 0;
  let velocity = Number.isFinite(state?.velocity) ? Math.max(-IMPULSE, Math.min(IMPULSE, state.velocity)) : 0;
  let grounded = state?.grounded === true || height === 0 && velocity <= 0 || clearance === 0;
  if (grounded) {height = 0;velocity = 0;}
  else if (height === clearance && velocity > 0) velocity = 0;
  if (requestJump && grounded && clearance > 0) {velocity = IMPULSE;grounded = false;}
  if (grounded) return createRoomJumpState();

  let elapsed = Number.isFinite(deltaSeconds) ? Math.max(0, Math.min(MAX_STEP, deltaSeconds)) : 0;
  // Resolve the exact ceiling contact, then fall for the rest of this frame.
  // This prevents frame-rate-dependent sticking against a low roof.
  if (velocity > 0) {
    const distance = clearance - height;
    const discriminant = velocity * velocity - 2 * GRAVITY * distance;
    if (discriminant >= -1e-12) {
      const contactTime = 2 * distance / (velocity + Math.sqrt(Math.max(0, discriminant)));
      if (contactTime <= elapsed + 1e-12) {
        height = clearance;velocity = 0;elapsed = Math.max(0, elapsed - contactTime);
      }
    }
  }
  height += velocity * elapsed - .5 * GRAVITY * elapsed * elapsed;
  velocity -= GRAVITY * elapsed;
  if (height < 0 || height <= 1e-12 && velocity <= 0) return createRoomJumpState();
  return {height: Math.min(clearance, height), velocity: Math.max(-IMPULSE, velocity), grounded: false};
}
