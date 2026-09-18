// ─────────────────────────────────────────────────────────────
// Central tuning knobs for NEON SIEGE.
// Future agents: tweak values here before touching systems.
// ─────────────────────────────────────────────────────────────

export const ARENA_HALF = 30; // arena spans -30..30 on X and Z
export const WALL_HEIGHT = 6;

export const PLAYER = {
  eyeHeight: 1.7,
  radius: 0.45,
  walkSpeed: 6.5,
  sprintSpeed: 10,
  jumpVelocity: 10,
  gravity: -24,
  maxHealth: 100,
  acceleration: 60,
  airControl: 0.35,
  friction: 12,
};

export const WEAPON = {
  name: 'Pulse Rifle',
  damage: 14,
  headshotMultiplier: 2,
  fireInterval: 0.11, // seconds between shots (auto)
  magSize: 30,
  startingReserve: 120,
  maxReserve: 300,
  reloadTime: 1.5,
  range: 120,
  spread: 0.012, // radians of random spread
  recoil: 0.018,
};

export type EnemyTypeId = 'grunt' | 'runner' | 'brute';

export interface EnemyType {
  id: EnemyTypeId;
  hp: number;
  speed: number;
  radius: number;
  height: number;
  color: string;
  emissive: string;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  score: number;
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyType> = {
  grunt: {
    id: 'grunt',
    hp: 40,
    speed: 4.2,
    radius: 0.5,
    height: 1.8,
    color: '#ff4d6d',
    emissive: '#ff1744',
    damage: 10,
    attackRange: 1.6,
    attackCooldown: 1.0,
    score: 100,
  },
  runner: {
    id: 'runner',
    hp: 24,
    speed: 7.5,
    radius: 0.38,
    height: 1.3,
    color: '#ffd166',
    emissive: '#ffb300',
    damage: 6,
    attackRange: 1.3,
    attackCooldown: 0.6,
    score: 150,
  },
  brute: {
    id: 'brute',
    hp: 160,
    speed: 2.4,
    radius: 0.95,
    height: 2.8,
    color: '#a855f7',
    emissive: '#7c3aed',
    damage: 25,
    attackRange: 2.3,
    attackCooldown: 1.6,
    score: 350,
  },
};

export const WAVES = {
  intermissionSeconds: 5,
  spawnInterval: 0.55, // seconds between individual spawns within a wave
  /** Returns the enemy composition for a given wave number (1-indexed). */
  composition(wave: number): EnemyTypeId[] {
    const list: EnemyTypeId[] = [];
    const grunts = 3 + Math.floor(wave * 1.5);
    const runners = wave >= 2 ? Math.floor(wave * 0.9) : 0;
    const brutes = wave >= 3 ? Math.floor((wave - 1) / 2) : 0;
    for (let i = 0; i < grunts; i++) list.push('grunt');
    for (let i = 0; i < runners; i++) list.push('runner');
    for (let i = 0; i < brutes; i++) list.push('brute');
    // shuffle so spawn order is mixed
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  },
  /** HP multiplier scaling with wave. */
  hpScale(wave: number) {
    return 1 + (wave - 1) * 0.12;
  },
};

export const PICKUPS = {
  dropChance: 0.28,
  healthAmount: 30,
  ammoAmount: 45,
  collectRadius: 1.4,
  lifetime: 25,
};

export interface Obstacle {
  position: [number, number, number]; // center
  size: [number, number, number];
  color?: string;
}

// Arena layout: crates, pillars, and platforms. y is the center height.
export const OBSTACLES: Obstacle[] = [
  // central platform
  { position: [0, 0.6, 0], size: [8, 1.2, 8], color: '#1f2937' },
  { position: [0, 1.6, 0], size: [4, 0.8, 4], color: '#111827' },
  // corner crate clusters
  { position: [14, 1, 14], size: [2, 2, 2] },
  { position: [16, 1, 12], size: [2, 2, 2] },
  { position: [14, 3, 14], size: [2, 2, 2] },
  { position: [-14, 1, 14], size: [2, 2, 2] },
  { position: [-16, 1, 16], size: [2, 2, 2] },
  { position: [14, 1, -14], size: [2, 2, 2] },
  { position: [12, 1, -16], size: [2, 2, 2] },
  { position: [-14, 1, -14], size: [2, 2, 2] },
  { position: [-14, 3, -14], size: [2, 2, 2] },
  { position: [-16, 1, -12], size: [2, 2, 2] },
  // pillars
  { position: [8, 2.5, -8], size: [1.4, 5, 1.4], color: '#0f172a' },
  { position: [-8, 2.5, 8], size: [1.4, 5, 1.4], color: '#0f172a' },
  { position: [8, 2.5, 8], size: [1.4, 5, 1.4], color: '#0f172a' },
  { position: [-8, 2.5, -8], size: [1.4, 5, 1.4], color: '#0f172a' },
  // long walls / cover
  { position: [0, 0.9, 18], size: [10, 1.8, 1], color: '#1e293b' },
  { position: [0, 0.9, -18], size: [10, 1.8, 1], color: '#1e293b' },
  { position: [18, 0.9, 0], size: [1, 1.8, 10], color: '#1e293b' },
  { position: [-18, 0.9, 0], size: [1, 1.8, 10], color: '#1e293b' },
  // stepping stones to platform
  { position: [6, 0.3, 0], size: [2, 0.6, 2], color: '#1f2937' },
  { position: [-6, 0.3, 0], size: [2, 0.6, 2], color: '#1f2937' },
  { position: [0, 0.3, 6], size: [2, 0.6, 2], color: '#1f2937' },
  { position: [0, 0.3, -6], size: [2, 0.6, 2], color: '#1f2937' },
  // ramps approximated as stair blocks near north side
  { position: [22, 0.4, 22], size: [3, 0.8, 3] },
  { position: [22, 1.2, 25], size: [3, 2.4, 3] },
  { position: [-22, 0.4, -22], size: [3, 0.8, 3] },
  { position: [-22, 1.2, -25], size: [3, 2.4, 3] },
];

/** Enemy spawn points around the arena perimeter. */
export const SPAWN_POINTS: [number, number][] = [
  [26, 26],
  [-26, 26],
  [26, -26],
  [-26, -26],
  [0, 27],
  [0, -27],
  [27, 0],
  [-27, 0],
];
