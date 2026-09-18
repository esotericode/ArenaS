import * as THREE from 'three';
import { PLAYER } from './config';

/**
 * Mutable per-frame state that lives OUTSIDE React.
 * Systems read/write here every frame without triggering re-renders.
 */
export interface EnemyRuntime {
  id: number;
  pos: THREE.Vector3;
  radius: number;
  height: number;
  hitFlash: number;
}

export const runtime = {
  canvas: null as HTMLCanvasElement | null,
  playerPos: new THREE.Vector3(0, PLAYER.eyeHeight, 12),
  playerVel: new THREE.Vector3(),
  playerGrounded: false,
  yaw: 0, // yaw 0 faces -Z (toward arena center from the spawn at +Z)
  pitch: 0,
  keys: new Set<string>(),
  mouseDown: false,
  enemies: new Map<number, EnemyRuntime>(),
  /** Group that contains all enemy meshes (for raycasting). */
  enemyGroup: null as THREE.Group | null,
  /** camera shake magnitude, decays over time */
  shake: 0,
  /** recoil kick applied to pitch, decays */
  recoil: 0,
  /** time since last shot (for view model animation) */
  lastShotAt: -10,
  elapsed: 0,
};

export function resetRuntime() {
  runtime.playerPos.set(0, PLAYER.eyeHeight, 12);
  runtime.playerVel.set(0, 0, 0);
  runtime.playerGrounded = false;
  runtime.yaw = 0;
  runtime.pitch = 0;
  runtime.keys.clear();
  runtime.mouseDown = false;
  runtime.enemies.clear();
  runtime.shake = 0;
  runtime.recoil = 0;
  runtime.lastShotAt = -10;
  runtime.elapsed = 0;
}
