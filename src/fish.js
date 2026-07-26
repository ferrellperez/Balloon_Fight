import * as THREE from 'three';
import {
  LAKE_RADIUS, LAKE_DANGER_RADIUS, LAKE_DANGER_HEIGHT, LAKE_HOVER_TIME, FLOOR_Y, COLORS,
} from './constants.js';

const PATROL_RADIUS = LAKE_RADIUS * 0.55;
const PATROL_SPEED = 1.1; // radians/sec
const EAT_COOLDOWN = 2; // seconds of invulnerability after an eat, so respawn doesn't instantly re-trigger

function buildMesh() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: COLORS.fish, roughness: 0.4 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 10), mat);
  body.scale.set(1, 0.8, 1.8);
  group.add(body);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.8, 8), mat);
  tail.rotation.x = Math.PI / 2;
  tail.position.z = -1.1;
  group.add(tail);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
  const eyeGeom = new THREE.SphereGeometry(0.08, 8, 8);
  const eyeL = new THREE.Mesh(eyeGeom, eyeMat);
  eyeL.position.set(0.35, 0.15, 0.9);
  group.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = -0.35;
  group.add(eyeR);

  return group;
}

export class Fish {
  constructor(scene) {
    this.mesh = buildMesh();
    scene.add(this.mesh);

    this.angle = 0;
    this.cooldown = 0;
    this.lungeTime = 0;
    this.hoverTime = 0;
  }

  /** Returns true once the player has lingered in the danger zone too long (respects a cooldown after eating). */
  update(dt, playerPosition) {
    this.angle += PATROL_SPEED * dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.lungeTime = Math.max(0, this.lungeTime - dt);

    const bob = Math.sin(this.angle * 2) * 0.15;
    this.mesh.position.set(
      Math.cos(this.angle) * PATROL_RADIUS,
      FLOOR_Y + 0.3 + bob,
      Math.sin(this.angle) * PATROL_RADIUS,
    );
    // Facing the direction of travel: position is (cos(angle), sin(angle))*R, so velocity
    // (tangent) direction is (-sin(angle), cos(angle)) - matching forward = (sin(theta), cos(theta)) at theta=-angle.
    this.mesh.rotation.y = -this.angle;

    const lungeScale = 1 + (this.lungeTime > 0 ? Math.sin((EAT_COOLDOWN - this.lungeTime) * 10) * 0.3 : 0);
    this.mesh.scale.setScalar(Math.max(0.7, lungeScale));

    if (this.cooldown > 0) return false;

    const dx = playerPosition.x - this.mesh.position.x;
    const dz = playerPosition.z - this.mesh.position.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);
    const heightAboveFloor = playerPosition.y - FLOOR_Y;
    const inDanger = horizontalDist < LAKE_DANGER_RADIUS && heightAboveFloor < LAKE_DANGER_HEIGHT;

    if (!inDanger) {
      this.hoverTime = 0;
      return false;
    }

    this.hoverTime += dt;
    if (this.hoverTime >= LAKE_HOVER_TIME) {
      this.hoverTime = 0;
      this.cooldown = EAT_COOLDOWN;
      this.lungeTime = EAT_COOLDOWN;
      return true;
    }

    return false;
  }
}
