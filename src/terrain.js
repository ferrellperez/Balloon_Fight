import { ARENA_HALF_SIZE, FLOOR_Y, PLATFORMS } from './constants.js';

/** True while a sphere of the given radius is resting on the main floor or a platform top. */
export function isGroundedAt(position, verticalVelocity, radius) {
  if (verticalVelocity > 0.2) return false;

  const footY = position.y - radius;
  if (footY <= FLOOR_Y + 0.05) return true;

  return PLATFORMS.some((platform) => (
    Math.abs(position.x - platform.x) <= platform.halfWidth + radius * 0.5
    && Math.abs(position.z - platform.z) <= platform.halfDepth + radius * 0.5
    && Math.abs(footY - platform.topY) <= 0.25
  ));
}

/** Wraps a position through the arena's side "portals". Returns true if a wrap occurred. */
export function resolveWraparound(position) {
  let wrapped = false;
  if (position.x > ARENA_HALF_SIZE) { position.x = -ARENA_HALF_SIZE; wrapped = true; }
  else if (position.x < -ARENA_HALF_SIZE) { position.x = ARENA_HALF_SIZE; wrapped = true; }
  if (position.z > ARENA_HALF_SIZE) { position.z = -ARENA_HALF_SIZE; wrapped = true; }
  else if (position.z < -ARENA_HALF_SIZE) { position.z = ARENA_HALF_SIZE; wrapped = true; }
  return wrapped;
}
