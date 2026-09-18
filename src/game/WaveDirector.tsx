import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { SPAWN_POINTS, WAVES, type EnemyTypeId } from './config';
import { runtime } from './runtime';
import { useGame } from './store';

/**
 * Drives wave progression:
 *  intermission  -> (timer)   -> nextWave() -> spawning
 *  spawning      -> queue empty -> active
 *  active        -> all enemies dead -> intermission
 */
export function WaveDirector() {
  const queue = useRef<EnemyTypeId[]>([]);
  const nextSpawnAt = useRef(0);
  const lastRunId = useRef<number>(-1);
  const lastFarSpawn = useRef(0);

  useFrame(() => {
    const st = useGame.getState();

    // detect fresh game start (timeStarted changes per run) – reset director
    if (st.status === 'playing' && st.timeStarted !== lastRunId.current) {
      lastRunId.current = st.timeStarted;
      queue.current = [];
      st.setWaveState('intermission', runtime.elapsed + 3);
    }
    if (st.status !== 'playing') return;

    const now = runtime.elapsed;
    st.pruneMessages(now);
    st.expirePickups(now);

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
          nextSpawnAt.current = now + WAVES.spawnInterval * (type === 'brute' ? 1.6 : 1);
        }
        break;
      }
      case 'active': {
        if (st.enemies.length === 0) {
          st.setWaveState('intermission', now + WAVES.intermissionSeconds);
          st.pushMessage('WAVE CLEARED', `Next wave in ${WAVES.intermissionSeconds}s`, 3);
        }
        break;
      }
    }
  });

  return null;
}
