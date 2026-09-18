import { create } from 'zustand';
import { ENEMY_TYPES, PICKUPS, PLAYER, WAVES, WEAPON, type EnemyTypeId } from './config';
import { runtime, resetRuntime } from './runtime';
import { audio } from './audio';
import { fx } from './Effects';
import * as THREE from 'three';

export type GameStatus = 'menu' | 'playing' | 'paused' | 'gameover';
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

let nextId = 1;
export const uid = () => nextId++;

interface GameState {
  status: GameStatus;
  health: number;
  ammo: number;
  reserve: number;
  reloading: boolean;
  score: number;
  kills: number;
  wave: number;
  waveState: WaveState;
  intermissionEndsAt: number;
  enemies: EnemyData[];
  pickups: PickupData[];
  messages: Message[];
  lastDamageAt: number;
  lastHitMarkerAt: number;
  lastKillMarkerAt: number;
  bestScore: number;
  bestWave: number;
  timeStarted: number;

  startGame: () => void;
  pause: () => void;
  resume: () => void;
  backToMenu: () => void;

  damagePlayer: (amount: number) => void;
  healPlayer: (amount: number) => void;

  consumeAmmo: () => boolean;
  startReload: () => void;
  finishReload: () => void;
  addReserve: (n: number) => void;

  spawnEnemy: (type: EnemyTypeId, spawn: [number, number, number]) => void;
  damageEnemy: (id: number, amount: number, headshot: boolean) => void;
  removeEnemy: (id: number) => void;

  addPickup: (kind: 'health' | 'ammo', position: [number, number, number]) => void;
  collectPickup: (id: number) => void;
  expirePickups: (now: number) => void;

  setWaveState: (s: WaveState, intermissionEndsAt?: number) => void;
  nextWave: () => void;
  pushMessage: (text: string, sub?: string, duration?: number) => void;
  pruneMessages: (now: number) => void;
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

const freshRun = () => ({
  health: PLAYER.maxHealth,
  ammo: WEAPON.magSize,
  reserve: WEAPON.startingReserve,
  reloading: false,
  score: 0,
  kills: 0,
  wave: 0,
  waveState: 'intermission' as WaveState,
  intermissionEndsAt: 0,
  enemies: [] as EnemyData[],
  pickups: [] as PickupData[],
  messages: [] as Message[],
  lastDamageAt: -10,
  lastHitMarkerAt: -10,
  lastKillMarkerAt: -10,
  timeStarted: 0,
});

export const useGame = create<GameState>((set, get) => ({
  status: 'menu',
  ...freshRun(),
  bestScore: loadBest('neon-siege-best-score'),
  bestWave: loadBest('neon-siege-best-wave'),

  startGame: () => {
    resetRuntime();
    audio.init();
    set({ ...freshRun(), status: 'playing', timeStarted: performance.now() / 1000 });
    get().pushMessage('NEON SIEGE', 'Survive the waves. Good luck.', 3.5);
  },
  pause: () => {
    if (get().status === 'playing') set({ status: 'paused' });
  },
  resume: () => {
    if (get().status === 'paused') set({ status: 'playing' });
  },
  backToMenu: () => set({ status: 'menu' }),

  damagePlayer: (amount) => {
    const s = get();
    if (s.status !== 'playing') return;
    const health = Math.max(0, s.health - amount);
    runtime.shake = Math.min(1, runtime.shake + 0.35);
    audio.hurt();
    if (health <= 0) {
      const bestScore = Math.max(s.bestScore, s.score);
      const bestWave = Math.max(s.bestWave, s.wave);
      saveBest('neon-siege-best-score', bestScore);
      saveBest('neon-siege-best-wave', bestWave);
      set({ health: 0, status: 'gameover', lastDamageAt: runtime.elapsed, bestScore, bestWave });
      audio.gameOver();
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      set({ health, lastDamageAt: runtime.elapsed });
    }
  },
  healPlayer: (amount) => set((s) => ({ health: Math.min(PLAYER.maxHealth, s.health + amount) })),

  consumeAmmo: () => {
    const s = get();
    if (s.reloading || s.ammo <= 0) return false;
    set({ ammo: s.ammo - 1 });
    return true;
  },
  startReload: () => {
    const s = get();
    if (s.reloading || s.ammo >= WEAPON.magSize || s.reserve <= 0) return;
    set({ reloading: true });
    audio.reload();
  },
  finishReload: () => {
    const s = get();
    const need = WEAPON.magSize - s.ammo;
    const take = Math.min(need, s.reserve);
    set({ ammo: s.ammo + take, reserve: s.reserve - take, reloading: false });
  },
  addReserve: (n) => set((s) => ({ reserve: Math.min(WEAPON.maxReserve, s.reserve + n) })),

  spawnEnemy: (type, spawn) => {
    const def = ENEMY_TYPES[type];
    const hp = Math.round(def.hp * WAVES.hpScale(Math.max(1, get().wave)));
    const e: EnemyData = { id: uid(), type, hp, maxHp: hp, spawn };
    set((s) => ({ enemies: [...s.enemies, e] }));
  },
  damageEnemy: (id, amount, headshot) => {
    const s = get();
    const e = s.enemies.find((x) => x.id === id);
    if (!e) return;
    const dmg = headshot ? amount * WEAPON.headshotMultiplier : amount;
    const hp = e.hp - dmg;
    const rt = runtime.enemies.get(id);
    if (rt) rt.hitFlash = 1;
    if (hp <= 0) {
      const def = ENEMY_TYPES[e.type];
      const bonus = headshot ? 1.5 : 1;
      const gained = Math.round(def.score * bonus * (1 + s.wave * 0.05));
      audio.enemyDeath(e.type);
      if (rt) {
        const center = new THREE.Vector3(rt.pos.x, rt.pos.y + rt.height * 0.5, rt.pos.z);
        fx.burst(center, def.color, e.type === 'brute' ? 60 : 28, e.type === 'brute' ? 9 : 6, 0.16, -10);
        fx.burst(center, '#ffffff', 8, 4, 0.08, -4);
        runtime.shake = Math.min(1, runtime.shake + (e.type === 'brute' ? 0.4 : 0.08));
      }
      // maybe drop a pickup
      const drop = Math.random() < PICKUPS.dropChance || (s.reserve < 30 && Math.random() < 0.6);
      if (drop && rt) {
        const kind: 'health' | 'ammo' =
          s.health < 50 ? (Math.random() < 0.65 ? 'health' : 'ammo') : Math.random() < 0.5 ? 'health' : 'ammo';
        get().addPickup(kind, [rt.pos.x, rt.pos.y, rt.pos.z]);
      }
      set({
        enemies: s.enemies.filter((x) => x.id !== id),
        score: s.score + gained,
        kills: s.kills + 1,
        lastHitMarkerAt: runtime.elapsed,
        lastKillMarkerAt: runtime.elapsed,
      });
      runtime.enemies.delete(id);
    } else {
      audio.hit();
      set({
        enemies: s.enemies.map((x) => (x.id === id ? { ...x, hp } : x)),
        lastHitMarkerAt: runtime.elapsed,
      });
    }
  },
  removeEnemy: (id) => {
    runtime.enemies.delete(id);
    set((s) => ({ enemies: s.enemies.filter((x) => x.id !== id) }));
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
    else get().addReserve(PICKUPS.ammoAmount);
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
    get().pushMessage(`WAVE ${wave}`, wave % 5 === 0 ? 'Heavy resistance incoming!' : undefined, 2.5);
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
  },
}));
