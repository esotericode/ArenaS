import * as THREE from 'three';
import { BASE_MODS, PLAYER, type Mods, type WeaponId } from './config';

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
  type: string;
  boss: boolean;
  /** 0..1 — used by the radar and the boss health bar */
  hpFrac: number;
}

export interface DamageNumber {
  id: number;
  pos: THREE.Vector3;
  amount: number;
  crit: boolean;
  headshot: boolean;
  life: number;
}

export const runtime = {
  canvas: null as HTMLCanvasElement | null,
  camera: null as THREE.Camera | null,
  playerPos: new THREE.Vector3(0, PLAYER.eyeHeight, 12),
  playerVel: new THREE.Vector3(),
  playerGrounded: false,
  yaw: 0, // yaw 0 faces -Z (toward arena center from the spawn at +Z)
  pitch: 0,
  keys: new Set<string>(),
  mouseDown: false,
  /** set on the frame a click begins — semi-auto weapons consume it */
  mouseClicked: false,
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
  /** global time multiplier — drives hit-stop and Overdrive slow-mo */
  timeScale: 1,
  /** remaining seconds of freeze-frame on a big kill */
  hitStop: 0,
  /** remaining seconds of slow motion */
  slowMo: 0,
  /** dash state */
  dashCharges: 1,
  dashCooldown: 0,
  dashTime: 0,
  dashDir: new THREE.Vector3(),
  invuln: 0,
  /** derived augment modifiers — rebuilt by the store whenever augments change */
  mods: { ...BASE_MODS } as Mods,
  /** weapon the viewmodel is currently showing (drives swap animation) */
  weaponSwapT: 0,
  currentWeapon: 'rifle' as WeaponId,
  /** world-space directions of recent hits, for the damage indicator */
  damageDirs: [] as { id: number; angle: number; life: number }[],
  /** floating combat text */
  damageNumbers: [] as DamageNumber[],
};

export function resetRuntime() {
  runtime.playerPos.set(0, PLAYER.eyeHeight, 12);
  runtime.playerVel.set(0, 0, 0);
  runtime.playerGrounded = false;
  runtime.yaw = 0;
  runtime.pitch = 0;
  runtime.keys.clear();
  runtime.mouseDown = false;
  runtime.mouseClicked = false;
  runtime.enemies.clear();
  runtime.shake = 0;
  runtime.recoil = 0;
  runtime.lastShotAt = -10;
  runtime.elapsed = 0;
  runtime.timeScale = 1;
  runtime.hitStop = 0;
  runtime.slowMo = 0;
  runtime.dashCharges = BASE_MODS.dashCharges;
  runtime.dashCooldown = 0;
  runtime.dashTime = 0;
  runtime.invuln = 0;
  runtime.mods = { ...BASE_MODS };
  runtime.weaponSwapT = 0;
  runtime.currentWeapon = 'rifle';
  runtime.damageDirs.length = 0;
  runtime.damageNumbers.length = 0;
}
