import * as CANNON from 'cannon-es';
import {
  GRAVITY, CEILING_Y, CEILING_RESTITUTION, FLOOR_RESTITUTION, FLOOR_FRICTION, CEILING_FRICTION,
  PLATFORMS, PLATFORM_TOP_THICKNESS,
} from './constants.js';

export function createPhysicsWorld() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, GRAVITY, 0) });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = false;

  const floorMaterial = new CANNON.Material('floor');
  const ceilingMaterial = new CANNON.Material('ceiling');
  const playerMaterial = new CANNON.Material('player');

  // Landing on the floor arrests horizontal drift (high friction, no bounce).
  world.addContactMaterial(new CANNON.ContactMaterial(floorMaterial, playerMaterial, {
    friction: FLOOR_FRICTION,
    restitution: FLOOR_RESTITUTION,
  }));

  // Bouncing off the ceiling preserves horizontal momentum (no friction, bouncy).
  world.addContactMaterial(new CANNON.ContactMaterial(ceilingMaterial, playerMaterial, {
    friction: CEILING_FRICTION,
    restitution: CEILING_RESTITUTION,
  }));

  // Bodies bump off each other (used now for the player, and later for enemy balloonists).
  world.addContactMaterial(new CANNON.ContactMaterial(playerMaterial, playerMaterial, {
    friction: 0.1,
    restitution: 0.6,
  }));

  const floorBody = new CANNON.Body({ mass: 0, material: floorMaterial });
  floorBody.addShape(new CANNON.Plane());
  floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(floorBody);

  const ceilingBody = new CANNON.Body({ mass: 0, material: ceilingMaterial, position: new CANNON.Vec3(0, CEILING_Y, 0) });
  ceilingBody.addShape(new CANNON.Plane());
  ceilingBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
  world.addBody(ceilingBody);

  // Each platform is one static body with two stacked box shapes so top vs. bottom/sides
  // can behave differently: a thin "floor" slice on top (land, no bounce) sits over a
  // "bouncy" core covering the underside and edges (bounce off, like the ceiling/walls).
  for (const platform of PLATFORMS) {
    const { x, z, topY, halfWidth, halfDepth, thickness } = platform;
    const platformBody = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(x, topY, z) });

    // Body origin sits at the platform's top surface (world y = topY).
    const topShape = new CANNON.Box(new CANNON.Vec3(halfWidth, PLATFORM_TOP_THICKNESS, halfDepth));
    topShape.material = floorMaterial;
    platformBody.addShape(topShape, new CANNON.Vec3(0, -PLATFORM_TOP_THICKNESS, 0));

    const coreHalfHeight = thickness / 2 - PLATFORM_TOP_THICKNESS;
    const coreShape = new CANNON.Box(new CANNON.Vec3(halfWidth, coreHalfHeight, halfDepth));
    coreShape.material = ceilingMaterial;
    platformBody.addShape(coreShape, new CANNON.Vec3(0, -(2 * PLATFORM_TOP_THICKNESS + coreHalfHeight), 0));

    world.addBody(platformBody);
  }

  return {
    world,
    materials: { floorMaterial, ceilingMaterial, playerMaterial },
    step(dt) {
      world.step(1 / 60, dt, 10);
    },
  };
}
