import * as THREE from 'three';
import { ARENA_HALF, OBSTACLES } from './config';

export interface AABB {
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export const OBSTACLE_AABBS: AABB[] = OBSTACLES.map((o) => ({
  min: new THREE.Vector3(
    o.position[0] - o.size[0] / 2,
    o.position[1] - o.size[1] / 2,
    o.position[2] - o.size[2] / 2,
  ),
  max: new THREE.Vector3(
    o.position[0] + o.size[0] / 2,
    o.position[1] + o.size[1] / 2,
    o.position[2] + o.size[2] / 2,
  ),
}));

export interface BodyState {
  /** position of the feet (bottom of the capsule) */
  feet: THREE.Vector3;
  vel: THREE.Vector3;
  radius: number;
  height: number;
  grounded: boolean;
}

/**
 * Resolve a vertical-cylinder body against all obstacle AABBs and the arena
 * bounds. Mutates body.feet / body.vel / body.grounded.
 * If `allowClimb` is true, the body may land on top of boxes.
 */
export function resolveBody(body: BodyState, allowClimb = true) {
  const { feet, vel, radius, height } = body;
  body.grounded = false;

  // ground plane
  if (feet.y <= 0) {
    feet.y = 0;
    if (vel.y < 0) vel.y = 0;
    body.grounded = true;
  }

  // arena bounds
  const lim = ARENA_HALF - radius - 0.05;
  if (feet.x > lim) feet.x = lim;
  if (feet.x < -lim) feet.x = -lim;
  if (feet.z > lim) feet.z = lim;
  if (feet.z < -lim) feet.z = -lim;

  for (const box of OBSTACLE_AABBS) {
    const headY = feet.y + height;
    // broad-phase
    if (
      feet.x <= box.min.x - radius ||
      feet.x >= box.max.x + radius ||
      feet.z <= box.min.z - radius ||
      feet.z >= box.max.z + radius ||
      feet.y >= box.max.y ||
      headY <= box.min.y
    ) {
      continue;
    }

    const penXMin = feet.x - (box.min.x - radius);
    const penXMax = box.max.x + radius - feet.x;
    const penZMin = feet.z - (box.min.z - radius);
    const penZMax = box.max.z + radius - feet.z;
    const penTop = box.max.y - feet.y;
    const penBottom = headY - box.min.y;

    let minPen = Math.min(penXMin, penXMax, penZMin, penZMax);
    let axis: 'x-' | 'x+' | 'z-' | 'z+' | 'top' | 'bottom' =
      minPen === penXMin ? 'x-' : minPen === penXMax ? 'x+' : minPen === penZMin ? 'z-' : 'z+';

    if (allowClimb) {
      // Prefer landing on top when close to it & moving down (step-up tolerance)
      if (penTop < minPen || (penTop < 0.65 && vel.y <= 0.01)) {
        minPen = penTop;
        axis = 'top';
      }
      if (penBottom < minPen) {
        minPen = penBottom;
        axis = 'bottom';
      }
    }

    switch (axis) {
      case 'x-':
        feet.x = box.min.x - radius;
        if (vel.x > 0) vel.x = 0;
        break;
      case 'x+':
        feet.x = box.max.x + radius;
        if (vel.x < 0) vel.x = 0;
        break;
      case 'z-':
        feet.z = box.min.z - radius;
        if (vel.z > 0) vel.z = 0;
        break;
      case 'z+':
        feet.z = box.max.z + radius;
        if (vel.z < 0) vel.z = 0;
        break;
      case 'top':
        feet.y = box.max.y;
        if (vel.y < 0) vel.y = 0;
        body.grounded = true;
        break;
      case 'bottom':
        feet.y = box.min.y - height;
        if (vel.y > 0) vel.y = 0;
        break;
    }
  }
}

/** Returns the height of the highest surface directly under an xz point (for enemy grounding). */
export function groundHeightAt(x: number, z: number, maxY: number): number {
  let h = 0;
  for (const box of OBSTACLE_AABBS) {
    if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z) {
      if (box.max.y <= maxY + 0.01 && box.max.y > h) h = box.max.y;
    }
  }
  return h;
}
