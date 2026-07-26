import * as THREE from 'three';
import {
  ARENA_HALF_SIZE, FLOOR_Y, CEILING_Y, LAKE_RADIUS, COLORS, PLATFORMS,
} from './constants.js';

export function createArena(scene) {
  const size = ARENA_HALF_SIZE * 2;

  scene.background = new THREE.Color(COLORS.sky);
  // Fog fades in over the stage's last 20% of depth (fully fogged by one full stage-length away).
  // Portals reuse this same fog unchanged, so the visible range through a portal matches the
  // visible range in the room you're standing in - no jump in perceived draw distance when
  // crossing a wraparound wall.
  scene.fog = new THREE.Fog(COLORS.sky, size * 0.8, size);

  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.1);
  sun.position.set(ARENA_HALF_SIZE * 0.4, CEILING_Y * 1.3, ARENA_HALF_SIZE * 0.3);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x9fd7ff, 0x1a2230, 0.4));

  // Floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({ color: COLORS.floor, roughness: 0.9 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  scene.add(floor);

  const floorGrid = new THREE.GridHelper(size, 20, COLORS.wireframe, COLORS.wireframe);
  floorGrid.position.y = FLOOR_Y + 0.01;
  floorGrid.material.transparent = true;
  floorGrid.material.opacity = 0.15;
  scene.add(floorGrid);

  // Ceiling - faint, so the bounce surface is visible but doesn't block the view
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshStandardMaterial({
      color: COLORS.ceiling, roughness: 1, transparent: true, opacity: 0.35, side: THREE.DoubleSide,
    }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEILING_Y;
  scene.add(ceiling);

  // Cube boundary wireframe (visual only - the side walls are portals, not solid)
  const boxGeom = new THREE.BoxGeometry(size, CEILING_Y - FLOOR_Y, size);
  const edges = new THREE.EdgesGeometry(boxGeom);
  const wireframe = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: COLORS.wireframe, transparent: true, opacity: 0.5 }),
  );
  wireframe.position.y = (FLOOR_Y + CEILING_Y) / 2;
  scene.add(wireframe);

  // Lake
  const lake = new THREE.Mesh(
    new THREE.CylinderGeometry(LAKE_RADIUS, LAKE_RADIUS, 0.5, 40),
    new THREE.MeshStandardMaterial({
      color: COLORS.lake, transparent: true, opacity: 0.85, roughness: 0.2, metalness: 0.1,
    }),
  );
  lake.position.set(0, FLOOR_Y + 0.05, 0);
  scene.add(lake);

  const lakeSurface = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE_RADIUS, 40),
    new THREE.MeshStandardMaterial({
      color: COLORS.lakeSurface, transparent: true, opacity: 0.5, roughness: 0.1,
    }),
  );
  lakeSurface.rotation.x = -Math.PI / 2;
  lakeSurface.position.set(0, FLOOR_Y + 0.31, 0);
  scene.add(lakeSurface);

  // Floating platforms
  const platformMat = new THREE.MeshStandardMaterial({ color: COLORS.platform, roughness: 0.8 });
  for (const p of PLATFORMS) {
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(p.halfWidth * 2, p.thickness, p.halfDepth * 2),
      platformMat,
    );
    platform.position.set(p.x, p.topY - p.thickness / 2, p.z);
    scene.add(platform);
  }

  return { lake, lakeSurface };
}
