import * as THREE from 'three';
import { ARENA_HALF, JUMP_PADS, OBSTACLES } from './config';

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

/** True when the point sits inside any solid obstacle. */
export function pointInObstacle(x: number, y: number, z: number, pad = 0): boolean {
  for (const box of OBSTACLE_AABBS) {
    if (
      x >= box.min.x - pad &&
      x <= box.max.x + pad &&
      y >= box.min.y - pad &&
      y <= box.max.y + pad &&
      z >= box.min.z - pad &&
      z <= box.max.z + pad
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Slab-method ray/AABB sweep against the world.
 * Returns the distance to the nearest obstacle along `dir` (normalised),
 * or `Infinity` when the ray reaches `maxDist` unobstructed.
 */
export function rayObstacleDistance(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number,
): number {
  let nearest = Infinity;
  const invX = 1 / (dir.x || 1e-9);
  const invY = 1 / (dir.y || 1e-9);
  const invZ = 1 / (dir.z || 1e-9);
  for (const box of OBSTACLE_AABBS) {
    let t0 = (box.min.x - origin.x) * invX;
    let t1 = (box.max.x - origin.x) * invX;
    if (t0 > t1) [t0, t1] = [t1, t0];
    let tmin = t0;
    let tmax = t1;

    t0 = (box.min.y - origin.y) * invY;
    t1 = (box.max.y - origin.y) * invY;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax < tmin) continue;

    t0 = (box.min.z - origin.z) * invZ;
    t1 = (box.max.z - origin.z) * invZ;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
    if (tmax < tmin) continue;

    if (tmin >= 0 && tmin <= maxDist && tmin < nearest) nearest = tmin;
    // origin already inside the box
    else if (tmin < 0 && tmax >= 0) return 0;
  }
  return nearest;
}

const losDir = new THREE.Vector3();

/** True when nothing solid sits between `from` and `to`. */
export function hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
  losDir.subVectors(to, from);
  const dist = losDir.length();
  if (dist < 0.001) return true;
  losDir.multiplyScalar(1 / dist);
  // shave the ends so bodies touching a wall are not blocked by their own cover
  return rayObstacleDistance(from, losDir, dist - 0.15) === Infinity;
}

/** Returns the jump pad under an xz point, if the body is close to its surface. */
export function jumpPadAt(x: number, z: number, feetY: number) {
  for (const pad of JUMP_PADS) {
    const dx = x - pad.position[0];
    const dz = z - pad.position[1];
    if (dx * dx + dz * dz > pad.radius * pad.radius) continue;
    const padY = groundHeightAt(pad.position[0], pad.position[1], 3);
    if (Math.abs(feetY - padY) < 0.4) return pad;
  }
  return null;
}
