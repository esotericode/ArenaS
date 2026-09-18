import { create } from 'zustand';
import {
  AUGMENTS,
  BASE_MODS,
  COMBO,
  ENEMY_TYPES,
  PICKUPS,
  PLAYER,
  RARITY_WEIGHT,
  WAVES,
  WEAPONS,
  WEAPON_ORDER,
  type AugmentDef,
  type EnemyTypeId,
  type Mods,
  type WeaponId,
} from './config';
import { runtime, resetRuntime } from './runtime';
import { audio } from './audio';
import { fx } from './Effects';
import { projectiles } from './Projectiles';
import { magSizeFor } from './weapons';
import * as THREE from 'three';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover' | 'augment';
export type WaveState = 'spawning' | 'active' | 'intermission';

export interface EnemyData {
  id: number;
  type: EnemyTypeId;
  hp: number;
  maxHp: number;
  spawn: [number, number, number];
}

export interface PickupData {
  id: number;
  kind: 'health' | 'ammo';
  position: [number, number, number];
  createdAt: number;
}

export interface Message {
  id: number;
  text: string;
  sub?: string;
  until: number;
}

export interface FeedEntry {
  id: number;
  text: string;
  detail?: string;
  color: string;
  until: number;
}

let nextId = 1;
export const uid = () => nextId++;

type AmmoMap = Record<WeaponId, number>;

interface GameState {
  status: GameStatus;
  health: number;
  maxHealth: number;
  score: number;
  kills: number;
  wave: number;
  waveState: WaveState;
  intermissionEndsAt: number;
  enemies: EnemyData[];
  pickups: PickupData[];
  messages: Message[];
  feed: FeedEntry[];
  lastDamageAt: number;
  lastHitMarkerAt: number;
  lastKillMarkerAt: number;
  bestScore: number;
  bestWave: number;
  timeStarted: number;

  // weapons
  weapon: WeaponId;
  lastWeapon: WeaponId;
  unlocked: WeaponId[];
  mags: AmmoMap;
  reserves: AmmoMap;
  reloading: boolean;

  // progression
  augments: Record<string, number>;
  offers: string[];
  augmentPicks: number;

  // combo
  combo: number;
  comboEndsAt: number;

  // boss
  bossId: number | null;

  startGame: () => void;
  pause: () => void;
  resume: () => void;
  backToMenu: () => void;

  damagePlayer: (amount: number) => void;
  damagePlayerFrom: (amount: number, source: THREE.Vector3) => void;
  healPlayer: (amount: number) => void;

  consumeAmmo: () => boolean;
  startReload: () => void;
  finishReload: () => void;
  addAmmo: () => void;
  selectWeapon: (w: WeaponId) => void;
  cycleWeapon: (dir: number) => void;
  swapWeapon: () => void;
  unlockWeapon: (w: WeaponId) => void;

  spawnEnemy: (type: EnemyTypeId, spawn: [number, number, number]) => void;
  damageEnemy: (
    id: number,
    amount: number,
    opts?: { headshot?: boolean; crit?: boolean; chain?: number; silent?: boolean },
  ) => void;
  removeEnemy: (id: number) => void;

  addPickup: (kind: 'health' | 'ammo', position: [number, number, number]) => void;
  collectPickup: (id: number) => void;
  expirePickups: (now: number) => void;

  setWaveState: (s: WaveState, intermissionEndsAt?: number) => void;
  nextWave: () => void;
  pushMessage: (text: string, sub?: string, duration?: number) => void;
  pruneMessages: (now: number) => void;
  pushFeed: (text: string, color: string, detail?: string) => void;

  rollAugments: () => void;
  chooseAugment: (id: string) => void;
  skipAugment: () => void;
  recomputeMods: () => void;
  tickCombo: (now: number) => void;
}

const loadBest = (key: string) => {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
};
const saveBest = (key: string, v: number) => {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
};

const emptyAmmo = (): AmmoMap => ({ rifle: 0, scatter: 0, rail: 0 });

const freshRun = () => {
  const mags = emptyAmmo();
  const reserves = emptyAmmo();
  mags.rifle = WEAPONS.rifle.magSize;
  reserves.rifle = WEAPONS.rifle.startingReserve;
  return {
    health: PLAYER.maxHealth,
    maxHealth: PLAYER.maxHealth,
    score: 0,
    kills: 0,
    wave: 0,
    waveState: 'intermission' as WaveState,
    intermissionEndsAt: 0,
    enemies: [] as EnemyData[],
    pickups: [] as PickupData[],
    messages: [] as Message[],
    feed: [] as FeedEntry[],
    lastDamageAt: -10,
    lastHitMarkerAt: -10,
    lastKillMarkerAt: -10,
    timeStarted: 0,
    weapon: 'rifle' as WeaponId,
    lastWeapon: 'rifle' as WeaponId,
    unlocked: ['rifle'] as WeaponId[],
    mags,
    reserves,
    reloading: false,
    augments: {} as Record<string, number>,
    offers: [] as string[],
    augmentPicks: 0,
    combo: 0,
    comboEndsAt: 0,
    bossId: null as number | null,
  };
};

const augmentById = (id: string) => AUGMENTS.find((a) => a.id === id);

export const comboMultiplier = (combo: number) =>
  Math.min(COMBO.maxMultiplier, 1 + Math.max(0, combo - 1) * COMBO.step);

export const useGame = create<GameState>((set, get) => ({
  status: 'menu',
  ...freshRun(),
  bestScore: loadBest('neon-siege-best-score'),
  bestWave: loadBest('neon-siege-best-wave'),

  startGame: () => {
    resetRuntime();
    projectiles.clear();
    fx.clear();
    audio.init();
    set({ ...freshRun(), status: 'playing', timeStarted: performance.now() / 1000 });
    get().recomputeMods();
    get().pushMessage('NEON SIEGE', 'Survive the waves. Good luck.', 3.5);
  },
  pause: () => {
    if (get().status === 'playing') set({ status: 'paused' });
  },
  resume: () => {
    if (get().status === 'paused') set({ status: 'playing' });
  },
  backToMenu: () => {
    projectiles.clear();
    fx.clear();
    set({ status: 'menu' });
  },

  damagePlayer: (amount) => {
    const s = get();
    if (s.status !== 'playing') return;
    if (runtime.invuln > 0) return;
    const mitigated = amount * (1 - runtime.mods.armor);
    const health = Math.max(0, s.health - mitigated);
    runtime.shake = Math.min(1, runtime.shake + 0.35);
    audio.hurt();
    if (health <= 0) {
      const bestScore = Math.max(s.bestScore, s.score);
      const bestWave = Math.max(s.bestWave, s.wave);
      saveBest('neon-siege-best-score', bestScore);
      saveBest('neon-siege-best-wave', bestWave);
      runtime.timeScale = 1;
      runtime.slowMo = 0;
      set({ health: 0, status: 'gameover', lastDamageAt: runtime.elapsed, bestScore, bestWave });
      audio.gameOver();
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      set({ health, lastDamageAt: runtime.elapsed });
    }
  },
  damagePlayerFrom: (amount, source) => {
    if (runtime.invuln > 0 || get().status !== 'playing') return;
    // angle of the hit relative to where the player is facing (0 = dead ahead)
    const dx = source.x - runtime.playerPos.x;
    const dz = source.z - runtime.playerPos.z;
    const world = Math.atan2(dx, -dz);
    let rel = world - runtime.yaw;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    runtime.damageDirs.push({ angle: rel, life: 0 });
    if (runtime.damageDirs.length > 8) runtime.damageDirs.shift();
    get().damagePlayer(amount);
  },
  healPlayer: (amount) =>
    set((s) => ({ health: Math.min(s.maxHealth, s.health + amount) })),

  consumeAmmo: () => {
    const s = get();
    if (s.reloading) return false;
    if (s.mags[s.weapon] <= 0) return false;
    // Scavenger: some shots are free
    if (runtime.mods.ammoEfficiency > 0 && Math.random() < runtime.mods.ammoEfficiency) return true;
    set({ mags: { ...s.mags, [s.weapon]: s.mags[s.weapon] - 1 } });
    return true;
  },
  startReload: () => {
    const s = get();
    const w = s.weapon;
    if (s.reloading || s.mags[w] >= magSizeFor(w) || s.reserves[w] <= 0) return;
    set({ reloading: true });
    audio.reload();
  },
  finishReload: () => {
    const s = get();
    const w = s.weapon;
    const need = magSizeFor(w) - s.mags[w];
    const take = Math.min(need, s.reserves[w]);
    set({
      mags: { ...s.mags, [w]: s.mags[w] + take },
      reserves: { ...s.reserves, [w]: s.reserves[w] - take },
      reloading: false,
    });
  },
  addAmmo: () => {
    const s = get();
    const reserves = { ...s.reserves };
    for (const w of s.unlocked) {
      const def = WEAPONS[w];
      // the equipped gun gets a full pack, the rest get a top-up
      const amount = w === s.weapon ? def.pickupAmount : Math.ceil(def.pickupAmount * 0.4);
      reserves[w] = Math.min(def.maxReserve, reserves[w] + amount);
    }
    set({ reserves });
  },
  selectWeapon: (w) => {
    const s = get();
    if (s.weapon === w || !s.unlocked.includes(w)) return;
    set({ weapon: w, lastWeapon: s.weapon, reloading: false });
    runtime.currentWeapon = w;
    runtime.weaponSwapT = 1;
    audio.weaponSwap();
  },
  cycleWeapon: (dir) => {
    const s = get();
    const avail = WEAPON_ORDER.filter((w) => s.unlocked.includes(w));
    if (avail.length < 2) return;
    const i = avail.indexOf(s.weapon);
    const next = avail[(i + dir + avail.length * 2) % avail.length];
    get().selectWeapon(next);
  },
  swapWeapon: () => {
    const s = get();
    if (s.unlocked.includes(s.lastWeapon)) get().selectWeapon(s.lastWeapon);
    else get().cycleWeapon(1);
  },
  unlockWeapon: (w) => {
    const s = get();
    if (s.unlocked.includes(w)) return;
    const def = WEAPONS[w];
    set({
      unlocked: [...s.unlocked, w],
      mags: { ...s.mags, [w]: magSizeFor(w) },
      reserves: { ...s.reserves, [w]: def.startingReserve },
    });
    get().pushMessage(`${def.name.toUpperCase()} ONLINE`, def.tagline, 3);
    get().pushFeed(`Acquired ${def.name}`, def.accent, `Slot ${WEAPON_ORDER.indexOf(w) + 1}`);
    audio.unlock();
  },

  spawnEnemy: (type, spawn) => {
    const def = ENEMY_TYPES[type];
    const wave = Math.max(1, get().wave);
    const scale = def.boss ? WAVES.bossHpScale(wave) : WAVES.hpScale(wave);
    const hp = Math.round(def.hp * scale);
    const e: EnemyData = { id: uid(), type, hp, maxHp: hp, spawn };
    set((s) => ({ enemies: [...s.enemies, e], bossId: def.boss ? e.id : s.bossId }));
    if (def.boss) {
      get().pushMessage('WARDEN INBOUND', 'Something enormous just breached the gate.', 3.5);
      audio.bossSpawn();
    }
  },
  damageEnemy: (id, amount, opts = {}) => {
    const s = get();
    if (s.status !== 'playing') return;
    const e = s.enemies.find((x) => x.id === id);
    if (!e) return;
    const def = ENEMY_TYPES[e.type];
    const { headshot = false, crit = false, chain = 0, silent = false } = opts;
    const dmg = amount;
    const hp = e.hp - dmg;
    const rt = runtime.enemies.get(id);
    if (rt) {
      rt.hitFlash = 1;
      rt.hpFrac = Math.max(0, hp / e.maxHp);
      if (runtime.mods.lifesteal > 0) {
        get().healPlayer(Math.min(dmg, e.hp) * runtime.mods.lifesteal);
      }
      runtime.damageNumbers.push({
        id: uid(),
        pos: new THREE.Vector3(
          rt.pos.x + (Math.random() - 0.5) * 0.4,
          rt.pos.y + rt.height * (0.6 + Math.random() * 0.3),
          rt.pos.z + (Math.random() - 0.5) * 0.4,
        ),
        amount: Math.round(dmg),
        crit,
        headshot,
        life: 0,
      });
      if (runtime.damageNumbers.length > 40) runtime.damageNumbers.shift();
    }

    if (hp <= 0) {
      const now = runtime.elapsed;
      const comboActive = now < s.comboEndsAt;
      const combo = (comboActive ? s.combo : 0) + 1;
      const mult = comboMultiplier(combo);
      const bonus = headshot ? 1.5 : 1;
      const gained = Math.round(
        def.score * bonus * (1 + s.wave * 0.05) * mult * runtime.mods.scoreMul,
      );
      audio.enemyDeath(e.type);
      if (rt) {
        const center = new THREE.Vector3(rt.pos.x, rt.pos.y + rt.height * 0.5, rt.pos.z);
        const heavy = def.boss || e.type === 'brute';
        fx.burst(center, def.color, def.boss ? 140 : heavy ? 60 : 28, heavy ? 9 : 6, 0.16, -10);
        fx.burst(center, '#ffffff', def.boss ? 40 : 8, 5, 0.09, -4);
        runtime.shake = Math.min(1, runtime.shake + (def.boss ? 1 : heavy ? 0.4 : 0.08));
        if (heavy || headshot) runtime.hitStop = Math.max(runtime.hitStop, def.boss ? 0.32 : 0.055);

        // Detonation Core
        if (runtime.mods.explosiveRadius > 0 && chain === 0) {
          const r = runtime.mods.explosiveRadius;
          fx.burst(center, '#fb923c', 34, 11, 0.2, -6);
          fx.ring(center, '#fdba74', r);
          audio.explode();
          for (const other of runtime.enemies.values()) {
            if (other.id === id) continue;
            const d = Math.hypot(other.pos.x - center.x, other.pos.z - center.z);
            if (d <= r) {
              const falloff = 1 - (d / r) * 0.5;
              get().damageEnemy(other.id, runtime.mods.explosiveDamage * falloff, { chain: 1 });
            }
          }
        }
      }
      // maybe drop a pickup
      const reserveNow = get().reserves[s.weapon];
      const drop = Math.random() < PICKUPS.dropChance || (reserveNow < 30 && Math.random() < 0.6);
      if (drop && rt) {
        const kind: 'health' | 'ammo' =
          get().health < s.maxHealth * 0.5
            ? Math.random() < 0.65
              ? 'health'
              : 'ammo'
            : Math.random() < 0.5
              ? 'health'
              : 'ammo';
        get().addPickup(kind, [rt.pos.x, rt.pos.y, rt.pos.z]);
      }
      const after = get();
      set({
        enemies: after.enemies.filter((x) => x.id !== id),
        score: after.score + gained,
        kills: after.kills + 1,
        lastHitMarkerAt: now,
        lastKillMarkerAt: now,
        combo,
        comboEndsAt: now + COMBO.window,
        bossId: after.bossId === id ? null : after.bossId,
      });
      runtime.enemies.delete(id);
      if (def.boss) {
        get().pushMessage('WARDEN DOWN', `+${gained.toLocaleString()} points`, 3);
        get().pushFeed('WARDEN destroyed', '#fbbf24', `+${gained.toLocaleString()}`);
      } else if (combo > 1 && combo % 5 === 0) {
        get().pushFeed(`${combo} kill streak`, '#fbbf24', `×${mult.toFixed(2)} score`);
        audio.combo(combo);
      }
    } else {
      if (!silent) audio.hit();
      set({
        enemies: s.enemies.map((x) => (x.id === id ? { ...x, hp } : x)),
        lastHitMarkerAt: runtime.elapsed,
      });
    }
  },
  removeEnemy: (id) => {
    runtime.enemies.delete(id);
    set((s) => ({
      enemies: s.enemies.filter((x) => x.id !== id),
      bossId: s.bossId === id ? null : s.bossId,
    }));
  },

  addPickup: (kind, position) =>
    set((s) => ({
      pickups: [...s.pickups, { id: uid(), kind, position, createdAt: runtime.elapsed }],
    })),
  collectPickup: (id) => {
    const s = get();
    const p = s.pickups.find((x) => x.id === id);
    if (!p) return;
    if (p.kind === 'health') get().healPlayer(PICKUPS.healthAmount);
    else get().addAmmo();
    audio.pickup();
    set({ pickups: s.pickups.filter((x) => x.id !== id) });
  },
  expirePickups: (now) => {
    const s = get();
    if (s.pickups.some((p) => now - p.createdAt > PICKUPS.lifetime)) {
      set({ pickups: s.pickups.filter((p) => now - p.createdAt <= PICKUPS.lifetime) });
    }
  },

  setWaveState: (waveState, intermissionEndsAt) =>
    set((s) => ({ waveState, intermissionEndsAt: intermissionEndsAt ?? s.intermissionEndsAt })),
  nextWave: () => {
    const wave = get().wave + 1;
    set({ wave, waveState: 'spawning' });
    audio.waveStart();
    const boss = wave % WAVES.bossEvery === 0;
    get().pushMessage(`WAVE ${wave}`, boss ? 'Heavy resistance incoming!' : undefined, 2.5);
    // weapons come online as the siege escalates
    for (const w of WEAPON_ORDER) {
      if (WEAPONS[w].unlockWave > 0 && wave >= WEAPONS[w].unlockWave) get().unlockWeapon(w);
    }
  },
  pushMessage: (text, sub, duration = 2.5) =>
    set((s) => ({
      messages: [...s.messages, { id: uid(), text, sub, until: runtime.elapsed + duration }],
    })),
  pruneMessages: (now) => {
    const s = get();
    if (s.messages.some((m) => m.until < now)) {
      set({ messages: s.messages.filter((m) => m.until >= now) });
    }
    if (s.feed.some((f) => f.until < now)) {
      set({ feed: get().feed.filter((f) => f.until >= now) });
    }
  },
  pushFeed: (text, color, detail) =>
    set((s) => ({
      feed: [...s.feed.slice(-5), { id: uid(), text, detail, color, until: runtime.elapsed + 4 }],
    })),

  rollAugments: () => {
    const s = get();
    const pool = AUGMENTS.filter((a) => (s.augments[a.id] ?? 0) < a.maxStacks);
    const picks: string[] = [];
    const weights = pool.map((a) => RARITY_WEIGHT[a.rarity]);
    const taken = new Set<number>();
    for (let n = 0; n < 3 && taken.size < pool.length; n++) {
      let total = 0;
      for (let i = 0; i < pool.length; i++) if (!taken.has(i)) total += weights[i];
      let roll = Math.random() * total;
      for (let i = 0; i < pool.length; i++) {
        if (taken.has(i)) continue;
        roll -= weights[i];
        if (roll <= 0) {
          taken.add(i);
          picks.push(pool[i].id);
          break;
        }
      }
    }
    set({ offers: picks, status: picks.length ? 'augment' : s.status });
    if (picks.length) {
      audio.augmentOffer();
      if (document.pointerLockElement) document.exitPointerLock();
    }
  },
  chooseAugment: (id) => {
    const s = get();
    const def = augmentById(id);
    if (!def) return;
    const augments = { ...s.augments, [id]: (s.augments[id] ?? 0) + 1 };
    set({ augments, offers: [], status: 'playing', augmentPicks: s.augmentPicks + 1 });
    get().recomputeMods();
    get().pushFeed(`${def.icon} ${def.name}`, '#67e8f9', def.desc);
    audio.augmentPick();
  },
  skipAugment: () => set({ offers: [], status: 'playing' }),
  recomputeMods: () => {
    const s = get();
    const mods: Mods = { ...BASE_MODS };
    for (const [id, stacks] of Object.entries(s.augments)) {
      const def: AugmentDef | undefined = augmentById(id);
      if (!def) continue;
      for (let i = 0; i < stacks; i++) def.apply(mods);
    }
    runtime.mods = mods;
    const maxHealth = PLAYER.maxHealth + mods.maxHealthAdd;
    const gained = Math.max(0, maxHealth - s.maxHealth);
    set({ maxHealth, health: Math.min(maxHealth, s.health + gained) });
    // augments are picked between waves — hand back a full set of dashes
    runtime.dashCharges = Math.round(mods.dashCharges);
  },
  tickCombo: (now) => {
    const s = get();
    if (s.combo > 0 && now >= s.comboEndsAt) set({ combo: 0 });
  },
}));
