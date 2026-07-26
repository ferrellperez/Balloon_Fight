import './style.css';
import * as THREE from 'three';
import { createArena } from './arena.js';
import { createPortals, updatePortals } from './portals.js';
import { createPhysicsWorld } from './physics.js';
import { Player } from './player.js';
import { Fish } from './fish.js';
import { Enemy } from './enemy.js';
import { Input } from './input.js';
import {
  CAMERA_FOLLOW_DISTANCE, CAMERA_HEIGHT_OFFSET, CAMERA_LERP,
  ENEMY_SPAWN_POINTS, POP_CONTACT_DISTANCE, HEIGHT_WIN_MARGIN, PLAYER_RESPAWN_DELAY,
} from './constants.js';

const app = document.querySelector('#app');
const messageEl = document.querySelector('#message');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 10, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
app.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

createArena(scene);
const portals = createPortals(scene);

const physics = createPhysicsWorld();
const player = new Player(scene, physics.world, physics.materials.playerMaterial);
const fish = new Fish(scene);
let enemies = ENEMY_SPAWN_POINTS.map(
  (spawnPoint) => new Enemy(scene, physics.world, physics.materials.playerMaterial, spawnPoint),
);
const input = new Input();

let messageTimeout = null;
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.style.opacity = '1';
  clearTimeout(messageTimeout);
  messageTimeout = setTimeout(() => { messageEl.style.opacity = '0'; }, 1800);
}

let cameraSnapped = false;

function updateCamera(dt) {
  const forward = new THREE.Vector3(Math.sin(player.facing), 0, Math.cos(player.facing));
  const target = new THREE.Vector3(
    player.mesh.position.x - forward.x * CAMERA_FOLLOW_DISTANCE,
    player.mesh.position.y + CAMERA_HEIGHT_OFFSET,
    player.mesh.position.z - forward.z * CAMERA_FOLLOW_DISTANCE,
  );

  if (!cameraSnapped) {
    camera.position.copy(target);
    cameraSnapped = true;
  } else {
    camera.position.lerp(target, Math.min(1, dt * CAMERA_LERP));
  }

  camera.lookAt(player.mesh.position.x, player.mesh.position.y + 0.8, player.mesh.position.z);
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  let turnDir = 0;
  let thrustDir = 0;
  if (!player.incapacitated) {
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) turnDir -= 1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) turnDir += 1;
    if (input.isDown('KeyW') || input.isDown('ArrowUp')) thrustDir += 1;
    if (input.isDown('KeyS') || input.isDown('ArrowDown')) thrustDir -= 1;

    player.turn(turnDir, dt);
    player.thrust(thrustDir);
    if (input.wasJustPressed('Space')) player.flap();
  }

  for (const enemy of enemies) enemy.update(dt, player.body.position);

  physics.step(dt);
  player.enforceSpeedLimits();
  player.settleOnLanding(thrustDir !== 0);
  const wrapped = player.resolveWraparound();
  if (wrapped) cameraSnapped = false;
  player.syncMesh();

  for (const enemy of enemies) {
    if (enemy.state === 'removed') continue;
    enemy.resolveWraparound();
    enemy.syncMesh();
  }
  enemies = enemies.filter((enemy) => enemy.state !== 'removed');

  // Balloon-popping contact between the player and each enemy.
  for (const enemy of enemies) {
    const dx = player.body.position.x - enemy.body.position.x;
    const dy = player.body.position.y - enemy.body.position.y;
    const dz = player.body.position.z - enemy.body.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist >= POP_CONTACT_DISTANCE) continue;

    if (enemy.state === 'flying' && !player.incapacitated) {
      // Height-based resolution: contact from above wins, from below loses. Too close
      // in height to call cleanly is just a bump - no balloon changes hands.
      if (dy > HEIGHT_WIN_MARGIN) {
        enemy.pop();
        showMessage('Popped an enemy balloon!');
      } else if (dy < -HEIGHT_WIN_MARGIN) {
        player.popBalloon();
        showMessage(player.incapacitated ? 'Your balloons popped!' : 'Your balloon popped!');
      }
    } else if (enemy.canBeFinishedOff()) {
      enemy.remove();
    }
  }
  enemies = enemies.filter((enemy) => enemy.state !== 'removed');

  if (player.incapacitated) {
    if (player.isGrounded()) {
      player.groundedTime += dt;
      if (player.groundedTime >= PLAYER_RESPAWN_DELAY) {
        player.respawn();
        cameraSnapped = false;
      }
    }
  }

  const eaten = fish.update(dt, player.body.position);
  if (eaten) {
    player.respawn();
    cameraSnapped = false;
    showMessage('Gulp! The fish got you...');
  }

  updateCamera(dt);

  updatePortals(renderer, scene, camera, portals);
  renderer.render(scene, camera);
  input.endFrame();
}

animate();

if (import.meta.env.DEV) {
  window.__game = {
    player, fish, physics, scene, camera, portals, renderer, THREE, getEnemies: () => enemies,
  };
}
