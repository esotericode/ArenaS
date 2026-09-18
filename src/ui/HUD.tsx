import { useEffect, useRef, useState } from 'react';
import { ARENA_HALF, PLAYER, WEAPON } from '../game/config';
import { runtime } from '../game/runtime';
import { useGame } from '../game/store';
import { cn } from '../utils/cn';

/** Re-render on every animation frame (HUD is lightweight). */
function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    let id = 0;
    const loop = () => {
      set((n) => (n + 1) % 1_000_000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);
}

function Radar() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let id = 0;
    const draw = () => {
      const c = ref.current;
      if (c) {
        const ctx = c.getContext('2d')!;
        const S = c.width;
        const R = S / 2;
        ctx.clearRect(0, 0, S, S);
        ctx.save();
        ctx.beginPath();
        ctx.arc(R, R, R - 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(34, 211, 238, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.clip();
        // rotate so that "up" is player facing direction
        ctx.translate(R, R);
        ctx.rotate(runtime.yaw + Math.PI);
        const scale = (R - 6) / (ARENA_HALF * 1.1);
        const px = runtime.playerPos.x;
        const pz = runtime.playerPos.z;
        // arena border
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect((-ARENA_HALF - px) * scale, (-ARENA_HALF - pz) * scale, ARENA_HALF * 2 * scale, ARENA_HALF * 2 * scale);
        // enemies
        for (const e of runtime.enemies.values()) {
          const x = (e.pos.x - px) * scale;
          const y = (e.pos.z - pz) * scale;
          ctx.beginPath();
          ctx.arc(x, y, e.radius > 0.8 ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = e.radius > 0.8 ? '#c084fc' : '#f87171';
          ctx.fill();
        }
        ctx.restore();
        // player marker
        ctx.save();
        ctx.translate(R, R);
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 5);
        ctx.lineTo(-4, 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      id = requestAnimationFrame(draw);
    };
    id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} width={140} height={140} className="h-[140px] w-[140px]" />;
}

export function HUD() {
  useTick();
  const s = useGame();
  const now = runtime.elapsed;
  const dmgAge = now - s.lastDamageAt;
  const dmgAlpha = Math.max(0, 1 - dmgAge / 0.6) * 0.7;
  const hitAge = now - s.lastHitMarkerAt;
  const killAge = now - s.lastKillMarkerAt;
  const showHit = hitAge < 0.12;
  const showKill = killAge < 0.35;
  const lowHealth = s.health <= 30;
  const healthPct = (s.health / PLAYER.maxHealth) * 100;
  const moving = Math.hypot(runtime.playerVel.x, runtime.playerVel.z) > 1;
  const firing = now - runtime.lastShotAt < 0.12;
  const spreadPx = 6 + (moving ? 6 : 0) + (firing ? 8 : 0) + (!runtime.playerGrounded ? 6 : 0);
  const intermissionLeft = s.waveState === 'intermission' ? Math.max(0, s.intermissionEndsAt - now) : 0;

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-mono text-cyan-100">
      {/* damage vignette */}
      <div
        className="absolute inset-0 transition-opacity"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,0,0,0) 45%, rgba(220,38,38,0.9) 100%)',
          opacity: dmgAlpha + (lowHealth ? 0.25 + Math.sin(now * 6) * 0.15 : 0),
        }}
      />
      {/* subtle vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }}
      />

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-0 w-0">
          {[0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              className={cn('absolute h-[2px] w-[9px] bg-cyan-300 shadow-[0_0_4px_#22d3ee]', showKill && 'bg-red-400')}
              style={{ transform: `rotate(${deg}deg) translateX(${spreadPx}px)`, transformOrigin: '0 50%', left: 0, top: -1 }}
            />
          ))}
          <div className="absolute -left-[1px] -top-[1px] h-[2px] w-[2px] bg-white" />
          {(showHit || showKill) && (
            <div className="absolute left-0 top-0">
              {[45, 135, 225, 315].map((deg) => (
                <div
                  key={deg}
                  className={cn('absolute h-[2px] w-[8px]', showKill ? 'bg-red-500' : 'bg-white')}
                  style={{ transform: `rotate(${deg}deg) translateX(${spreadPx + 4}px)`, transformOrigin: '0 50%', top: -1 }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* top-left: wave + score */}
      <div className="absolute left-6 top-6 space-y-1">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Wave</div>
        <div className="text-5xl font-black leading-none text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
          {s.wave.toString().padStart(2, '0')}
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.3em] text-cyan-400/80">
          {s.waveState === 'active' && <span>{s.enemies.length} hostile{s.enemies.length === 1 ? '' : 's'} remaining</span>}
          {s.waveState === 'spawning' && <span className="text-red-300">Incoming…</span>}
          {s.waveState === 'intermission' && <span className="text-emerald-300">Next wave in {intermissionLeft.toFixed(1)}s</span>}
        </div>
      </div>

      {/* top-right: score, kills, radar */}
      <div className="absolute right-6 top-6 flex flex-col items-end gap-3">
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Score</div>
          <div className="text-3xl font-bold text-white tabular-nums">{s.score.toLocaleString()}</div>
          <div className="text-xs text-cyan-200/70">{s.kills} kills</div>
        </div>
        <Radar />
      </div>

      {/* bottom-left: health */}
      <div className="absolute bottom-6 left-6 w-72">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Integrity</span>
          <span className={cn('text-2xl font-bold tabular-nums', lowHealth ? 'text-red-400' : 'text-white')}>{Math.ceil(s.health)}</span>
        </div>
        <div className="h-3 w-full skew-x-[-12deg] border border-cyan-400/40 bg-slate-900/70 p-[2px]">
          <div
            className={cn('h-full transition-[width] duration-150', lowHealth ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]')}
            style={{ width: `${healthPct}%` }}
          />
        </div>
      </div>

      {/* bottom-right: ammo */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">{WEAPON.name}</div>
        <div className="flex items-baseline justify-end gap-2">
          <span className={cn('text-5xl font-black tabular-nums', s.ammo === 0 ? 'text-red-400' : s.ammo <= 8 ? 'text-amber-300' : 'text-white')}>
            {s.ammo}
          </span>
          <span className="text-xl text-cyan-200/60 tabular-nums">/ {s.reserve}</span>
        </div>
        {s.reloading && (
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-amber-300 animate-pulse">Reloading</div>
        )}
        {!s.reloading && s.ammo === 0 && s.reserve === 0 && (
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-red-400 animate-pulse">No ammo – find a pickup</div>
        )}
        {!s.reloading && s.ammo <= 8 && s.reserve > 0 && (
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-amber-300/80">Press R to reload</div>
        )}
      </div>

      {/* center messages */}
      <div className="absolute left-1/2 top-[22%] flex -translate-x-1/2 flex-col items-center gap-2">
        {s.messages.map((m) => {
          const left = m.until - now;
          const alpha = Math.min(1, left / 0.5);
          return (
            <div key={m.id} className="text-center" style={{ opacity: alpha }}>
              <div className="text-4xl font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_0_16px_rgba(34,211,238,0.8)]">
                {m.text}
              </div>
              {m.sub && <div className="mt-1 text-sm uppercase tracking-[0.3em] text-cyan-300">{m.sub}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
