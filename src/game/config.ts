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
  /** grace period after walking off a ledge during which you can still jump */
  coyoteTime: 0.12,
  /** a jump pressed this long before landing still fires on touchdown */
  jumpBuffer: 0.15,
};

// ─── Aim ──────────────────────────────────────────────────────
/**
 * Source-engine yaw constant: degrees of turn per mouse count at sensitivity 1.
 * CS2 and CS:GO both use 0.022, so `settings.sensitivity` here is a 1:1 match
 * for the same number in CS2 — same DPI gives the same eDPI and the same cm/360.
 *
 * This only holds while the browser hands us raw mouse counts. Chromium grants
 * those through pointer lock's `unadjustedMovement` and reports `movementX` in
 * physical pixels, unscaled by display scaling or page zoom. Firefox and Safari
 * apply OS pointer acceleration and scale by devicePixelRatio, so they cannot be
 * matched exactly — `isRawInput()` in pointerLock.ts reports which you have.
 */
export const M_YAW = 0.022;

/** Radians of turn per mouse count at sensitivity 1. */
export const RADIANS_PER_COUNT = (M_YAW * Math.PI) / 180;

/** Centimetres of mouse travel for one full 360° turn. */
export const cmPer360 = (sensitivity: number, dpi: number) =>
  (360 * 2.54) / (dpi * sensitivity * M_YAW);

/** Enemies stop casting shadows past this distance — shadow maps dominate the frame. */
export const ENEMY_SHADOW_DISTANCE = 22;

export const DASH = {
  speed: 22,
  duration: 0.16,
  cooldown: 1.6,
  /** base charges; augments add more */
  charges: 1,
  /** upward nudge so a dash can carry you onto a crate */
  lift: 2.4,
  /** damage immunity while dashing */
  iframes: 0.2,
};

// ─── Weapons ──────────────────────────────────────────────────
export type WeaponId = 'rifle' | 'scatter' | 'rail';

export interface WeaponDef {
  id: WeaponId;
  name: string;
  /** short HUD label */
  short: string;
  damage: number;
  /** hitscan rays per trigger pull */
  pellets: number;
  headshotMultiplier: number;
  fireInterval: number;
  /** true = hold to keep firing, false = one shot per click */
  auto: boolean;
  magSize: number;
  startingReserve: number;
  maxReserve: number;
  /** reserve restored by one ammo pickup */
  pickupAmount: number;
  reloadTime: number;
  range: number;
  /** radians of random cone spread */
  spread: number;
  /** extra spread while airborne or sprinting */
  moveSpread: number;
  recoil: number;
  shake: number;
  /** how many bodies a single ray passes through (1 = stops at first) */
  pierce: number;
  /** damage multiplier at maximum range (linear falloff from falloffStart) */
  falloffStart: number;
  falloffMin: number;
  tracerColor: string;
  accent: string;
  /** wave number after which the weapon becomes available (0 = from the start) */
  unlockWave: number;
  tagline: string;
  /** view-model placement relative to the camera (x right, y down, z forward) */
  viewOffset: [number, number, number];
  viewScale: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  rifle: {
    id: 'rifle',
    name: 'Pulse Rifle',
    short: 'PULSE',
    damage: 14,
    pellets: 1,
    headshotMultiplier: 2,
    fireInterval: 0.11,
    auto: true,
    magSize: 30,
    startingReserve: 120,
    maxReserve: 300,
    pickupAmount: 45,
    reloadTime: 1.5,
    range: 120,
    spread: 0.012,
    moveSpread: 0.018,
    recoil: 0.018,
    shake: 0.05,
    pierce: 1,
    falloffStart: 120,
    falloffMin: 1,
    tracerColor: '#67e8f9',
    accent: '#22d3ee',
    unlockWave: 0,
    tagline: 'Reliable full-auto workhorse.',
    viewOffset: [0.32, -0.28, -0.55],
    viewScale: 1,
  },
  scatter: {
    id: 'scatter',
    name: 'Scatter Cannon',
    short: 'SCATTER',
    damage: 11,
    pellets: 9,
    headshotMultiplier: 1.5,
    fireInterval: 0.62,
    auto: false,
    magSize: 6,
    startingReserve: 36,
    maxReserve: 90,
    pickupAmount: 14,
    reloadTime: 2.1,
    range: 40,
    spread: 0.085,
    moveSpread: 0.02,
    recoil: 0.07,
    shake: 0.22,
    pierce: 1,
    falloffStart: 9,
    falloffMin: 0.35,
    tracerColor: '#fdba74',
    accent: '#fb923c',
    unlockWave: 2,
    tagline: 'Devastating up close. Useless at range.',
    viewOffset: [0.34, -0.3, -0.66],
    viewScale: 0.88,
  },
  rail: {
    id: 'rail',
    name: 'Rail Driver',
    short: 'RAIL',
    damage: 95,
    pellets: 1,
    headshotMultiplier: 2.5,
    fireInterval: 1.05,
    auto: false,
    magSize: 4,
    startingReserve: 20,
    maxReserve: 48,
    pickupAmount: 8,
    reloadTime: 2.4,
    range: 200,
    spread: 0,
    moveSpread: 0.006,
    recoil: 0.11,
    shake: 0.34,
    pierce: 5,
    falloffStart: 200,
    falloffMin: 1,
    tracerColor: '#e9d5ff',
    accent: '#c084fc',
    unlockWave: 4,
    tagline: 'Punches a hole through the whole crowd.',
    viewOffset: [0.33, -0.29, -0.78],
    viewScale: 0.82,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['rifle', 'scatter', 'rail'];

// ─── Enemies ──────────────────────────────────────────────────
export type EnemyTypeId = 'grunt' | 'runner' | 'brute' | 'spitter' | 'warden';

export interface RangedAttack {
  damage: number;
  projectileSpeed: number;
  cooldown: number;
  range: number;
  /** shots per volley */
  burst: number;
  burstDelay: number;
  spread: number;
  color: string;
  radius: number;
}

export interface EnemyType {
  id: EnemyTypeId;
  name: string;
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
  /** distance the enemy tries to hold from the player (0 = charge in) */
  preferredRange: number;
  ranged?: RangedAttack;
  boss?: boolean;
}

export const ENEMY_TYPES: Record<EnemyTypeId, EnemyType> = {
  grunt: {
    id: 'grunt',
    name: 'Grunt',
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
    preferredRange: 0,
  },
  runner: {
    id: 'runner',
    name: 'Runner',
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
    preferredRange: 0,
  },
  brute: {
    id: 'brute',
    name: 'Brute',
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
    preferredRange: 0,
  },
  spitter: {
    id: 'spitter',
    name: 'Spitter',
    hp: 55,
    speed: 3.4,
    radius: 0.46,
    height: 1.7,
    color: '#34d399',
    emissive: '#10b981',
    damage: 8,
    attackRange: 1.5,
    attackCooldown: 1.2,
    score: 220,
    preferredRange: 13,
    ranged: {
      damage: 9,
      projectileSpeed: 26,
      cooldown: 2.1,
      range: 30,
      burst: 3,
      burstDelay: 0.16,
      spread: 0.035,
      color: '#34d399',
      radius: 0.16,
    },
  },
  warden: {
    id: 'warden',
    name: 'Warden',
    hp: 1500,
    speed: 3.0,
    radius: 1.7,
    height: 4.4,
    color: '#f43f5e',
    emissive: '#fb7185',
    damage: 34,
    attackRange: 3.4,
    attackCooldown: 1.5,
    score: 3000,
    preferredRange: 0,
    boss: true,
    ranged: {
      damage: 14,
      projectileSpeed: 22,
      cooldown: 3.4,
      range: 45,
      burst: 7,
      burstDelay: 0.09,
      spread: 0.14,
      color: '#fb7185',
      radius: 0.3,
    },
  },
};

// ─── Waves ────────────────────────────────────────────────────
export const WAVES = {
  intermissionSeconds: 6,
  spawnInterval: 0.55, // seconds between individual spawns within a wave
  /** a boss joins the fight every N waves */
  bossEvery: 5,
  /** Returns the enemy composition for a given wave number (1-indexed). */
  composition(wave: number): EnemyTypeId[] {
    const list: EnemyTypeId[] = [];
    const boss = wave % WAVES.bossEvery === 0;
    // boss waves trim the chaff so the fight stays readable
    const trim = boss ? 0.45 : 1;
    const grunts = Math.round((3 + wave * 1.5) * trim);
    const runners = wave >= 2 ? Math.round(wave * 0.9 * trim) : 0;
    const brutes = wave >= 3 ? Math.round(((wave - 1) / 2) * trim) : 0;
    const spitters = wave >= 3 ? Math.round((1 + (wave - 3) * 0.6) * trim) : 0;
    for (let i = 0; i < grunts; i++) list.push('grunt');
    for (let i = 0; i < runners; i++) list.push('runner');
    for (let i = 0; i < brutes; i++) list.push('brute');
    for (let i = 0; i < spitters; i++) list.push('spitter');
    // shuffle so spawn order is mixed
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // the boss always arrives first so the player sees it coming
    if (boss) list.unshift('warden');
    return list;
  },
  /** HP multiplier scaling with wave. */
  hpScale(wave: number) {
    return 1 + (wave - 1) * 0.12;
  },
  /** Boss HP is scaled more gently — it is already a wall. */
  bossHpScale(wave: number) {
    return 1 + Math.floor((wave - 1) / WAVES.bossEvery) * 0.55;
  },
};

export const PICKUPS = {
  dropChance: 0.28,
  healthAmount: 30,
  collectRadius: 1.4,
  lifetime: 25,
};

export const COMBO = {
  /** kill streak decays if you go this long without a kill */
  window: 4,
  /** score multiplier per streak tier */
  step: 0.25,
  maxMultiplier: 4,
};

// ─── Augments (roguelite between-wave upgrades) ───────────────
export interface Mods {
  damageMul: number;
  fireRateMul: number;
  reloadMul: number;
  magMul: number;
  moveSpeedMul: number;
  jumpMul: number;
  maxHealthAdd: number;
  dashCharges: number;
  dashCooldownMul: number;
  doubleJump: boolean;
  lifesteal: number;
  headshotAdd: number;
  pickupRadiusAdd: number;
  /** blast radius on kill; 0 = no explosions */
  explosiveRadius: number;
  explosiveDamage: number;
  critChance: number;
  critMul: number;
  scoreMul: number;
  regenPerSec: number;
  /** chance a shot does not consume ammo */
  ammoEfficiency: number;
  /** flat damage reduction fraction */
  armor: number;
  /** seconds of slow-motion granted on a wave clear */
  overdrive: number;
}

export const BASE_MODS: Mods = {
  damageMul: 1,
  fireRateMul: 1,
  reloadMul: 1,
  magMul: 1,
  moveSpeedMul: 1,
  jumpMul: 1,
  maxHealthAdd: 0,
  dashCharges: DASH.charges,
  dashCooldownMul: 1,
  doubleJump: false,
  lifesteal: 0,
  headshotAdd: 0,
  pickupRadiusAdd: 0,
  explosiveRadius: 0,
  explosiveDamage: 0,
  critChance: 0,
  critMul: 2.5,
  scoreMul: 1,
  regenPerSec: 0,
  ammoEfficiency: 0,
  armor: 0,
  overdrive: 0,
};

export type Rarity = 'common' | 'rare' | 'epic';

export interface AugmentDef {
  id: string;
  name: string;
  desc: string;
  rarity: Rarity;
  maxStacks: number;
  icon: string;
  apply: (m: Mods) => void;
}

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 1, rare: 0.45, epic: 0.16 };
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#67e8f9',
  rare: '#c084fc',
  epic: '#fbbf24',
};

export const AUGMENTS: AugmentDef[] = [
  {
    id: 'overclock',
    name: 'Overclock',
    desc: '+18% fire rate',
    rarity: 'common',
    maxStacks: 4,
    icon: '⚡',
    apply: (m) => (m.fireRateMul *= 1.18),
  },
  {
    id: 'hollow-point',
    name: 'Hollow Point',
    desc: '+20% weapon damage',
    rarity: 'common',
    maxStacks: 5,
    icon: '◈',
    apply: (m) => (m.damageMul *= 1.2),
  },
  {
    id: 'extended-mag',
    name: 'Extended Mag',
    desc: '+40% magazine size',
    rarity: 'common',
    maxStacks: 3,
    icon: '▤',
    apply: (m) => (m.magMul *= 1.4),
  },
  {
    id: 'quick-hands',
    name: 'Quick Hands',
    desc: '−25% reload time',
    rarity: 'common',
    maxStacks: 3,
    icon: '↺',
    apply: (m) => (m.reloadMul *= 0.75),
  },
  {
    id: 'plating',
    name: 'Reactive Plating',
    desc: '+30 max integrity, healed on pickup',
    rarity: 'common',
    maxStacks: 4,
    icon: '⬢',
    apply: (m) => (m.maxHealthAdd += 30),
  },
  {
    id: 'servo-legs',
    name: 'Servo Legs',
    desc: '+12% move speed, +8% jump',
    rarity: 'common',
    maxStacks: 3,
    icon: '⇈',
    apply: (m) => {
      m.moveSpeedMul *= 1.12;
      m.jumpMul *= 1.08;
    },
  },
  {
    id: 'marksman',
    name: 'Marksman Optics',
    desc: '+0.6× headshot damage',
    rarity: 'rare',
    maxStacks: 3,
    icon: '⊕',
    apply: (m) => (m.headshotAdd += 0.6),
  },
  {
    id: 'kinetic-cells',
    name: 'Kinetic Cells',
    desc: '+1 dash charge, −20% dash cooldown',
    rarity: 'rare',
    maxStacks: 2,
    icon: '»',
    apply: (m) => {
      m.dashCharges += 1;
      m.dashCooldownMul *= 0.8;
    },
  },
  {
    id: 'grav-boots',
    name: 'Grav Boots',
    desc: 'Double jump',
    rarity: 'rare',
    maxStacks: 1,
    icon: '⇡',
    apply: (m) => (m.doubleJump = true),
  },
  {
    id: 'siphon',
    name: 'Siphon Rounds',
    desc: 'Heal 6% of damage dealt',
    rarity: 'rare',
    maxStacks: 3,
    icon: '✚',
    apply: (m) => (m.lifesteal += 0.06),
  },
  {
    id: 'crit-matrix',
    name: 'Crit Matrix',
    desc: '+12% chance for 2.5× damage',
    rarity: 'rare',
    maxStacks: 4,
    icon: '✶',
    apply: (m) => (m.critChance += 0.12),
  },
  {
    id: 'scavenger',
    name: 'Scavenger',
    desc: '+2.5m pickup radius, 15% ammo-free shots',
    rarity: 'rare',
    maxStacks: 2,
    icon: '⊚',
    apply: (m) => {
      m.pickupRadiusAdd += 2.5;
      m.ammoEfficiency += 0.15;
    },
  },
  {
    id: 'nanoweave',
    name: 'Nanoweave',
    desc: 'Regenerate 2 integrity / second',
    rarity: 'rare',
    maxStacks: 3,
    icon: '❋',
    apply: (m) => (m.regenPerSec += 2),
  },
  {
    id: 'ablative',
    name: 'Ablative Shell',
    desc: '−15% damage taken',
    rarity: 'rare',
    maxStacks: 3,
    icon: '◘',
    apply: (m) => (m.armor = 1 - (1 - m.armor) * 0.85),
  },
  {
    id: 'detonator',
    name: 'Detonation Core',
    desc: 'Kills explode for 45 damage',
    rarity: 'epic',
    maxStacks: 3,
    icon: '✺',
    apply: (m) => {
      m.explosiveRadius = Math.max(m.explosiveRadius, 4.2) + 0.8;
      m.explosiveDamage += 45;
    },
  },
  {
    id: 'bounty',
    name: 'Bounty Protocol',
    desc: '+35% score from every kill',
    rarity: 'epic',
    maxStacks: 3,
    icon: '★',
    apply: (m) => (m.scoreMul *= 1.35),
  },
  {
    id: 'overdrive',
    name: 'Overdrive',
    desc: 'Clearing a wave slows time for 4s',
    rarity: 'epic',
    maxStacks: 2,
    icon: '◉',
    apply: (m) => (m.overdrive += 4),
  },
];

// ─── Arena layout ─────────────────────────────────────────────
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
  // elevated sniper decks reachable by jump pad
  { position: [24, 3.4, -6], size: [6, 0.6, 8], color: '#1f2937' },
  { position: [-24, 3.4, 6], size: [6, 0.6, 8], color: '#1f2937' },
];

export interface JumpPad {
  position: [number, number]; // x, z
  /** vertical launch velocity */
  power: number;
  radius: number;
}

export const JUMP_PADS: JumpPad[] = [
  { position: [20, -6], power: 15.5, radius: 1.5 },
  { position: [-20, 6], power: 15.5, radius: 1.5 },
  { position: [0, 12], power: 13, radius: 1.5 },
  { position: [0, -12], power: 13, radius: 1.5 },
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
