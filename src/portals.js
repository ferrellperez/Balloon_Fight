import * as THREE from 'three';
import { frameCorners } from 'three/examples/jsm/utils/CameraUtils.js';
import { ARENA_HALF_SIZE, FLOOR_Y, CEILING_Y } from './constants.js';

const SIZE = ARENA_HALF_SIZE * 2;
const HEIGHT = CEILING_Y - FLOOR_Y;
const MID_Y = (FLOOR_Y + CEILING_Y) / 2;
const ASPECT = SIZE / HEIGHT;
const RT_WIDTH = 1536;
const RT_HEIGHT = Math.round(RT_WIDTH / ASPECT);
// The portal camera sits roughly SIZE (an arena width) beyond the wall it's rendering, looking
// back across the whole arena - a straight, unobstructed line of sight that would otherwise reach
// all the way to the player's own position/model. No separate fog or far-plane clip is applied
// here: the scene's own fog (see arena.js) already fades out at the same fraction of the stage
// for every camera, so the portal naturally hides that self-view at the same draw distance the
// main view fades at - no jump in visible range when crossing through.

// One portal per wraparound wall. `offset` is the same x/z translation resolveWraparound()
// applies in terrain.js - since the wrap is a plain translation (not a mirror), the linked
// "destination" rectangle each portal camera frames is just this same wall's rectangle
// shifted by that offset, rather than a separate reflected portal plane like three.js's
// webgl_portal.html door example.
const CONFIGS = [
  { pos: [ARENA_HALF_SIZE, MID_Y, 0], rotY: -Math.PI / 2, offset: new THREE.Vector3(-SIZE, 0, 0) },
  { pos: [-ARENA_HALF_SIZE, MID_Y, 0], rotY: Math.PI / 2, offset: new THREE.Vector3(SIZE, 0, 0) },
  { pos: [0, MID_Y, ARENA_HALF_SIZE], rotY: Math.PI, offset: new THREE.Vector3(0, 0, -SIZE) },
  { pos: [0, MID_Y, -ARENA_HALF_SIZE], rotY: 0, offset: new THREE.Vector3(0, 0, SIZE) },
];

/** World-space corners of a wall's plane, before any offset is applied. */
function wallCorners(pos, rotY) {
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const rotate = (x, y) => new THREE.Vector3(pos[0] + x * cos, pos[1] + y, pos[2] - x * sin);

  return {
    bottomLeft: rotate(-SIZE / 2, -HEIGHT / 2),
    bottomRight: rotate(SIZE / 2, -HEIGHT / 2),
    topLeft: rotate(-SIZE / 2, HEIGHT / 2),
  };
}

/** Builds the four wraparound "portal" planes and their render targets/cameras. */
export function createPortals(scene) {
  return CONFIGS.map(({ pos, rotY, offset }) => {
    const renderTarget = new THREE.WebGLRenderTarget(RT_WIDTH, RT_HEIGHT, { samples: 4 });
    renderTarget.texture.colorSpace = THREE.SRGBColorSpace;
    const portalCamera = new THREE.PerspectiveCamera(60, ASPECT, 0.1, 200);

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE, HEIGHT),
      new THREE.MeshBasicMaterial({ map: renderTarget.texture }),
    );
    mesh.position.set(...pos);
    mesh.rotation.y = rotY;
    scene.add(mesh);

    // The linked destination rectangle: this same wall, translated by the wraparound offset.
    const corners = wallCorners(pos, rotY);
    const bottomLeftCorner = corners.bottomLeft.add(offset);
    const bottomRightCorner = corners.bottomRight.add(offset);
    const topLeftCorner = corners.topLeft.add(offset);

    return {
      mesh, renderTarget, portalCamera, offset, bottomLeftCorner, bottomRightCorner, topLeftCorner,
    };
  });
}

/**
 * Renders the scene from each portal's shifted viewpoint into its texture. The portal camera
 * sits at the main camera's position shifted by the wraparound offset, then has its rotation
 * and off-axis projection framed exactly onto the linked rectangle (via CameraUtils.frameCorners)
 * so the flat texture, mapped onto the wall plane, lines up as a real window rather than a
 * flat picture pasted on top of it. Must run before the main renderer.render() call each frame,
 * with the portal meshes hidden during their own pass so they don't block the view into (or
 * out of) the other portals.
 */
export function updatePortals(renderer, scene, camera, portals) {
  for (const p of portals) p.mesh.visible = false;

  for (const p of portals) {
    p.portalCamera.position.copy(camera.position).add(p.offset);
    frameCorners(p.portalCamera, p.bottomLeftCorner, p.bottomRightCorner, p.topLeftCorner, false);
    p.portalCamera.updateMatrixWorld(true);

    renderer.setRenderTarget(p.renderTarget);
    renderer.render(scene, p.portalCamera);
  }

  renderer.setRenderTarget(null);
  for (const p of portals) p.mesh.visible = true;
}
