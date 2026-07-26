import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  RESPAWN_POSITION, COLORS,
  FLAP_IMPULSE, MOVE_FORCE, ROTATION_SPEED, LINEAR_DAMPING, PLAYER_RADIUS,
  MAX_FALL_SPEED, MAX_RISE_SPEED, MAX_HORIZONTAL_SPEED, PLAYER_BALLOON_COUNT,
} from './constants.js';
import { isGroundedAt, resolveWraparound } from './terrain.js';

function buildMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.playerBody, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 4, 8), bodyMat);
  body.position.y = 0;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), bodyMat);
  head.position.y = 0.65;
  group.add(head);

  const balloonGeom = new THREE.SphereGeometry(0.45, 16, 16);
  const balloonOffsets = [
    { x: -0.4, color: COLORS.balloonA },
    { x: 0.4, color: COLORS.balloonB },
  ];

  const stringMat = new THREE.LineBasicMaterial({ color: 0x333333 });

  const balloons = balloonOffsets.map(({ x, color }) => {
    const balloonGroup = new THREE.Group();

    const balloon = new THREE.Mesh(balloonGeom, new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));
    balloon.position.set(x, 1.7, 0);
    balloonGroup.add(balloon);

    const stringGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x * 0.5, 0.9, 0),
      new THREE.Vector3(x, 1.3, 0),
    ]);
    balloonGroup.add(new THREE.Line(stringGeom, stringMat));

    group.add(balloonGroup);
    return balloonGroup;
  });

  return { group, balloons };
}

export class Player {
  constructor(scene, world, playerMaterial) {
    const { group, balloons } = buildMesh();
    this.mesh = group;
    this.balloons = balloons;
    scene.add(this.mesh);

    // Shape-level material (not just the body-level one below) is required: cannon-es'
    // narrowphase looks up the contact material via shape.material first, falling back to
    // body.material only if both shapes lack one - and platform shapes always set theirs
    // (see physics.js) to get per-face floor/ceiling behavior. Without this, contacts against
    // a platform silently fall through to the 0.3-friction world default, which combined with
    // fixedRotation kills all horizontal movement (see cannon-es-friction-gotcha memory).
    const shape = new CANNON.Sphere(PLAYER_RADIUS);
    shape.material = playerMaterial;
    this.body = new CANNON.Body({
      mass: 1,
      shape,
      material: playerMaterial,
      linearDamping: LINEAR_DAMPING,
      fixedRotation: true,
      position: new CANNON.Vec3(RESPAWN_POSITION.x, RESPAWN_POSITION.y, RESPAWN_POSITION.z),
    });
    world.addBody(this.body);

    this.facing = 0;
    this.balloonCount = PLAYER_BALLOON_COUNT;
    this.incapacitated = false;
    this.groundedTime = 0;
  }

  /** Pops one balloon; once all are gone the player is incapacitated (falling, no control) until respawn. */
  popBalloon() {
    if (this.balloonCount <= 0) return;
    this.balloonCount -= 1;
    this.balloons[this.balloonCount].visible = false;
    if (this.balloonCount === 0) {
      this.incapacitated = true;
      this.groundedTime = 0;
    }
  }

  flap() {
    this.body.velocity.y += FLAP_IMPULSE;
  }

  /** direction: -1 turns left, +1 turns right. */
  turn(direction, dt) {
    if (direction === 0) return;
    this.facing -= direction * ROTATION_SPEED * dt;
  }

  /** direction: +1 thrusts forward (the way the player is facing), -1 thrusts backward. */
  thrust(direction) {
    if (direction === 0) return;
    const forward = new CANNON.Vec3(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.body.applyForce(forward.scale(direction * MOVE_FORCE));
  }

  /** Caps vertical and horizontal speed - with no air damping, nothing else bounds them. */
  enforceSpeedLimits() {
    const v = this.body.velocity;
    if (v.y < MAX_FALL_SPEED) v.y = MAX_FALL_SPEED;
    else if (v.y > MAX_RISE_SPEED) v.y = MAX_RISE_SPEED;

    const horizontalSpeed = Math.sqrt(v.x * v.x + v.z * v.z);
    if (horizontalSpeed > MAX_HORIZONTAL_SPEED) {
      const scale = MAX_HORIZONTAL_SPEED / horizontalSpeed;
      v.x *= scale;
      v.z *= scale;
    }
  }

  /** True while resting on the main floor or the top of any platform (not mid-flight). */
  isGrounded() {
    return isGroundedAt(this.body.position, this.body.velocity.y, PLAYER_RADIUS);
  }

  /** Landing arrests horizontal drift, but only while the player isn't actively thrusting. */
  settleOnLanding(thrustActive) {
    if (!thrustActive && this.isGrounded()) {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }
  }

  /** Wraps the body through the arena's side "portals". Returns true if a wrap occurred. */
  resolveWraparound() {
    return resolveWraparound(this.body.position);
  }

  respawn() {
    this.body.position.set(RESPAWN_POSITION.x, RESPAWN_POSITION.y, RESPAWN_POSITION.z);
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
    this.balloonCount = PLAYER_BALLOON_COUNT;
    this.incapacitated = false;
    this.groundedTime = 0;
    for (const balloon of this.balloons) balloon.visible = true;
  }

  syncMesh() {
    this.mesh.position.copy(this.body.position);
    this.mesh.rotation.y = this.facing;
  }
}
