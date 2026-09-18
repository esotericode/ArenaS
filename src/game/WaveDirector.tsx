import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { SPAWN_POINTS, WAVES, type EnemyTypeId } from './config';
import { runtime } from './runtime';
import { useGame } from './store';
import { audio } from './audio';

/**
 * Drives wave progression:
 *  intermission  -> (timer)     -> nextWave() -> spawning
 *  spawning      -> queue empty -> active
 *  active        -> all dead    -> augment pick -> intermission
 */
export function WaveDirector() {
  const queue = useRef<EnemyTypeId[]>([]);
  const nextSpawnAt = useRef(0);
  const lastRunId = useRef<number>(-1);
  const lastFarSpawn = useRef(0);
  /** set when a wave is cleared; the augment panel opens once it elapses */
  const offerAt = useRef<number | null>(null);

  useFrame(() => {
    const st = useGame.getState();

    // ─── music intensity follows the fight ──────────────────────────
    if (st.status === 'menu' || st.status === 'gameover') {
      audio.setIntensity(st.status === 'menu' ? 0.12 : 0);
    } else if (st.status === 'augment' || st.status === 'paused') {
      audio.setIntensity(0.25);
    } else if (st.waveState === 'intermission') {
      audio.setIntensity(0.25);
    } else {
      const boss = st.bossId !== null;
      audio.setIntensity(boss ? 1 : Math.min(0.92, 0.5 + st.wave * 0.04));
    }

    // detect fresh game start (timeStarted changes per run) – reset director
    if (st.status === 'playing' && st.timeStarted !== lastRunId.current) {
      lastRunId.current = st.timeStarted;
      queue.current = [];
      offerAt.current = null;
      st.setWaveState('intermission', runtime.elapsed + 3);
    }
    if (st.status !== 'playing') return;

    const now = runtime.elapsed;
    st.pruneMessages(now);
    st.expirePickups(now);

    // a cleared wave hands out an augment before the countdown resumes
    if (offerAt.current !== null && now >= offerAt.current) {
      offerAt.current = null;
      st.rollAugments();
      return;
    }

    switch (st.waveState) {
      case 'intermission': {
        if (now >= st.intermissionEndsAt) {
          st.nextWave();
          queue.current = WAVES.composition(useGame.getState().wave);
          nextSpawnAt.current = now + 0.4;
        }
        break;
      }
      case 'spawning': {
        if (queue.current.length === 0) {
          st.setWaveState('active');
          break;
        }
        if (now >= nextSpawnAt.current) {
          const type = queue.current.shift()!;
          // choose a spawn point far-ish from the player, rotating through options
          let best = SPAWN_POINTS[0];
          let bestScore = -Infinity;
          for (let i = 0; i < SPAWN_POINTS.length; i++) {
            const p = SPAWN_POINTS[(i + lastFarSpawn.current) % SPAWN_POINTS.length];
            const d = Math.hypot(p[0] - runtime.playerPos.x, p[1] - runtime.playerPos.z);
            const score = d + Math.random() * 12;
            if (score > bestScore && d > 10) {
              bestScore = score;
              best = p;
            }
          }
          lastFarSpawn.current = (lastFarSpawn.current + 3) % SPAWN_POINTS.length;
          const jitter = () => (Math.random() - 0.5) * 3;
          st.spawnEnemy(type, [best[0] + jitter(), 0, best[1] + jitter()]);
          const gap = type === 'warden' ? 2.4 : type === 'brute' ? 1.6 : 1;
          nextSpawnAt.current = now + WAVES.spawnInterval * gap;
        }
        break;
      }
      case 'active': {
        if (st.enemies.length === 0) {
          st.setWaveState('intermission', now + WAVES.intermissionSeconds);
          st.pushMessage('WAVE CLEARED', `Next wave in ${WAVES.intermissionSeconds}s`, 3);
          audio.waveClear();
          // Overdrive augment: a few seconds of slow motion as a victory lap
          if (runtime.mods.overdrive > 0) {
            runtime.slowMo = Math.max(runtime.slowMo, runtime.mods.overdrive);
          }
          offerAt.current = now + 1.1;
        }
        break;
      }
    }
  });

  return null;
}
