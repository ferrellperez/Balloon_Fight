import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import {
  COLORS, ENEMY_RADIUS, ENEMY_THRUST, ENEMY_MAX_SPEED, ENEMY_ATTACK_HEIGHT_OFFSET,
  ENEMY_CLIMB_THRUST, ENEMY_MAX_VERTICAL_SPEED, ENEMY_INITIAL_REST_TIME, ENEMY_REST_TIME,
  ENEMY_POP_GRACE_TIME, LAKE_RADIUS, FLOOR_Y, GRAVITY,
} from './constants.js';
import { isGroundedAt, resolveWraparound } from './terrain.js';

function buildMesh() {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS.enemyBody, roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 4, 8), bodyMat);
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), bodyMat);
  head.position.y = 0.65;
  group.add(head);

  const balloonGroup = new THREE.Group();
  const balloon = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 16, 16),
    new THREE.MeshStandardMaterial({ color: COLORS.enemyBalloon, roughness: 0.3 }),
  );
  balloon.position.set(0, 1.7, 0);
  balloonGroup.add(balloon);

  const stringGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0.9, 0),
    new THREE.Vector3(0, 1.3, 0),
  ]);
  balloonGroup.add(new THREE.Line(stringGeom, new THREE.LineBasicMaterial({ color: 0x333333 })));
  group.add(balloonGroup);

  return { group, balloon: balloonGroup };
}

export class Enemy {
  constructor(scene, world, playerMaterial, spawnPoint) {
    const { group, balloon } = buildMesh();
    this.mesh = group;
    this.balloon = balloon;
    scene.add(this.mesh);

    this.scene = scene;
    this.world = world;
    this.spawnPoint = spawnPoint;
    // Shape-level material (not just the body-level one below) is required: cannon-es'
    // narrowphase looks up the contact material via shape.material first, falling back to
    // body.material only if both shapes lack one - and platform shapes always set theirs
    // (see physics.js) to get per-face floor/ceiling behavior. Without this, contacts against
    // a platform silently fall through to the 0.3-friction world default, which combined with
    // fixedRotation kills all horizontal movement (see cannon-es-friction-gotcha memory).
    const shape = new CANNON.Sphere(ENEMY_RADIUS);
    shape.material = playerMaterial;
    this.body = new CANNON.Body({
      mass: 1,
      shape,
      material: playerMaterial,
      linearDamping: 0,
      fixedRotation: true,
      position: new CANNON.Vec3(spawnPoint.x, spawnPoint.y, spawnPoint.z),
    });
    world.addBody(this.body);

    this.facing = 0;
    // Spawns grounded and balloon-less on its platform; regrows a balloon and starts
    // tracking the player after ENEMY_INITIAL_REST_TIME (see #update).
    this.state = 'resting'; // 'flying' | 'falling' | 'resting' | 'removed'
    this.stateTimer = 0;
    this.hasSpawnedBalloon = false;
    this.balloon.visible = false;
  }

  /** Balloon popped by the player - starts falling, out of control. */
  pop() {
    if (this.state !== 'flying') return;
    this.state = 'falling';
    this.stateTimer = 0;
    this.balloon.visible = false;
  }

  /** Defeated by player contact while falling/resting, or drowned in the lake. */
  remove() {
    this.state = 'removed';
    this.scene.remove(this.mesh);
    this.world.removeBody(this.body);
  }

  regrow() {
    this.state = 'flying';
    this.stateTimer = 0;
    this.hasSpawnedBalloon = true;
    this.balloon.visible = true;
  }

  /** Seeks the player while flying; otherwise just tracks state/timers (physics handles the fall). */
  update(dt, playerPosition) {
    if (this.state === 'flying') {
      const dx = playerPosition.x - this.body.position.x;
      // Aim above the player, not level with them - height-based contact resolution means
      // attacking from above is what actually pops the player's balloon.
      const dy = (playerPosition.y + ENEMY_ATTACK_HEIGHT_OFFSET) - this.body.position.y;
      const dz = playerPosition.z - this.body.position.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz) || 1;

      // Balloons hold them aloft - counteract gravity outright, then climb/dive on top of that
      // neutral buoyancy. Without the counter-term, gravity always wins and they sink to the floor.
      const buoyancy = -GRAVITY * this.body.mass;
      this.body.applyForce(new CANNON.Vec3(
        (dx / horizontalDist) * ENEMY_THRUST,
        buoyancy + (Math.abs(dy) > 0.3 ? Math.sign(dy) * ENEMY_CLIMB_THRUST : 0),
        (dz / horizontalDist) * ENEMY_THRUST,
      ));

      const v = this.body.velocity;
      const speed = Math.sqrt(v.x * v.x + v.z * v.z);
      if (speed > ENEMY_MAX_SPEED) {
        const scale = ENEMY_MAX_SPEED / speed;
        v.x *= scale;
        v.z *= scale;
      }
      if (v.y > ENEMY_MAX_VERTICAL_SPEED) v.y = ENEMY_MAX_VERTICAL_SPEED;
      else if (v.y < -ENEMY_MAX_VERTICAL_SPEED) v.y = -ENEMY_MAX_VERTICAL_SPEED;

      if (horizontalDist > 0.1) this.facing = Math.atan2(dx, dz);
      return;
    }

    this.stateTimer += dt;

    if (this.state === 'falling') {
      if (isGroundedAt(this.body.position, this.body.velocity.y, ENEMY_RADIUS)) {
        const horizontalDistFromLake = Math.sqrt(this.body.position.x ** 2 + this.body.position.z ** 2);
        if (this.body.position.y - ENEMY_RADIUS <= FLOOR_Y + 0.1 && horizontalDistFromLake < LAKE_RADIUS) {
          this.remove();
        } else {
          this.state = 'resting';
          this.stateTimer = 0;
          this.body.velocity.x = 0;
          this.body.velocity.z = 0;
        }
      }
      return;
    }

    const restTime = this.hasSpawnedBalloon ? ENEMY_REST_TIME : ENEMY_INITIAL_REST_TIME;
    if (this.state === 'resting' && this.stateTimer >= restTime) {
      this.regrow();
    }
  }

  /** True once past the pop grace period, so "finish them off" contact can register. */
  canBeFinishedOff() {
    return (this.state === 'falling' || this.state === 'resting') && this.stateTimer >= ENEMY_POP_GRACE_TIME;
  }

  resolveWraparound() {
    return resolveWraparound(this.body.position);
  }

  syncMesh() {
    this.mesh.position.copy(this.body.position);
    this.mesh.rotation.y = this.facing;
  }
}
