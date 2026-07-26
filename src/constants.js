// Arena dimensions (world units)
export const ARENA_HALF_SIZE = 20; // half-width/depth, for X/Z wraparound + wireframe
export const FLOOR_Y = 0;
export const CEILING_Y = 22;

// Lake (centered at origin on the floor)
export const LAKE_RADIUS = 6;
export const LAKE_DANGER_RADIUS = 5; // horizontal distance from lake center that's "too close"
export const LAKE_DANGER_HEIGHT = 4; // must also be below this height above the floor
export const LAKE_HOVER_TIME = 2; // seconds the player can linger in the danger zone before getting eaten

// Physics tuning
export const GRAVITY = -12;
export const MAX_FALL_SPEED = -12; // terminal velocity clamp, prevents runaway fall speed with no air damping
export const MAX_RISE_SPEED = 10; // caps how fast repeated flaps can launch the player upward
export const MAX_HORIZONTAL_SPEED = 12; // caps drift speed, since thrust has no drag to naturally limit it
export const FLAP_IMPULSE = 4; // deliberately small - takes several flaps to reverse a fall
export const MOVE_FORCE = 18;
export const ROTATION_SPEED = 3; // radians/sec while turning (A/D or Left/Right)
export const LINEAR_DAMPING = 0; // no air drag - velocity persists until flapped or landed
export const CEILING_RESTITUTION = 0.6; // bounciness off the ceiling
export const FLOOR_RESTITUTION = 0; // landing on the floor settles, it doesn't bounce
// Both surfaces use zero physics friction - continuous friction would fight active thrust while
// grounded. Landing instead zeroes residual drift once, in code (see Player#settleOnLanding).
export const FLOOR_FRICTION = 0;
export const CEILING_FRICTION = 0;
export const PLAYER_RADIUS = 0.7;

// Floating platforms - small, finite islands the player can fly above/below/around.
// topY is the height of the walkable top surface; halfWidth/halfDepth define the footprint.
export const PLATFORM_TOP_THICKNESS = 0.15; // thin "ground" slice on top, rest of the box is bouncy
export const PLATFORMS = [
  {
    x: 10, z: -8, topY: 7, halfWidth: 3, halfDepth: 3, thickness: 1.2,
  },
  {
    x: -10, z: 8, topY: 15, halfWidth: 3, halfDepth: 3, thickness: 1.2,
  },
];

// Respawn point, away from the lake
export const RESPAWN_POSITION = { x: 0, y: FLOOR_Y + 3, z: 14 };
export const PLAYER_BALLOON_COUNT = 2;
export const PLAYER_RESPAWN_DELAY = 1.5; // seconds grounded with no balloons before auto-respawn

// Enemy balloonists
export const ENEMY_RADIUS = 0.7;
// Each enemy starts grounded on its own platform, so spawn points are derived from PLATFORMS.
export const ENEMY_SPAWN_POINTS = PLATFORMS.map((platform) => ({
  x: platform.x, y: platform.topY + ENEMY_RADIUS, z: platform.z,
}));
export const ENEMY_THRUST = 10; // seek force toward the player - weaker than the player's own thrust
export const ENEMY_MAX_SPEED = 8; // slightly slower than the player's MAX_HORIZONTAL_SPEED, so they're outrunnable
// Climb/dive force applied on top of gravity-counteracting buoyancy (see Enemy#update) - without
// this, enemies just sink to the floor and walk instead of flying, since gravity always wins.
export const ENEMY_CLIMB_THRUST = 6;
export const ENEMY_MAX_VERTICAL_SPEED = 4; // caps bob/climb rate for a floaty balloon feel
// Enemies seek a spot above the player, not level with them, since height-based contact resolution
// means attacking from above is what actually pops the player's balloon.
export const ENEMY_ATTACK_HEIGHT_OFFSET = 1.5;
export const ENEMY_INITIAL_REST_TIME = 3; // grounded, balloon-less, non-tracking for this long right after spawning
export const ENEMY_REST_TIME = 4; // seconds resting on the ground (after being popped) before regrowing a balloon
export const ENEMY_POP_GRACE_TIME = 0.4; // brief window after a pop before "finish them off" contact can register
// 3D distance (not just physics-body contact) at which balloons are considered touching -
// bigger than the physics collision radii since the balloons sit above the bodies.
export const POP_CONTACT_DISTANCE = 2.2;
// Minimum height difference to count as a clean "from above"/"from below" hit; closer than this, contact is a no-op.
export const HEIGHT_WIN_MARGIN = 0.4;

// Camera
export const CAMERA_FOLLOW_DISTANCE = 9;
export const CAMERA_HEIGHT_OFFSET = 4;
export const CAMERA_LERP = 4; // higher = snappier follow

// Colors
export const COLORS = {
  sky: 0x0b1027,
  floor: 0x2b3a4a,
  ceiling: 0x1a2230,
  wireframe: 0x6ec1ff,
  lake: 0x1f6fb2,
  lakeSurface: 0x3fa9f5,
  balloonA: 0xe63946,
  balloonB: 0x2a9d8f,
  playerBody: 0xffcf6e,
  fish: 0xff7b54,
  platform: 0x8a6d3b,
  enemyBody: 0x8899a6,
  enemyBalloon: 0x9b59b6,
};
