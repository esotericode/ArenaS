import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { ARENA_HALF, AUGMENTS, COMBO, DASH, ENEMY_TYPES, WEAPONS, WEAPON_ORDER } from '../game/config';
import { runtime } from '../game/runtime';
import { comboMultiplier, useGame } from '../game/store';
import { magSizeFor } from '../game/weapons';
import { settings } from '../game/settings';
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

const RADAR_COLORS: Record<string, string> = {
  grunt: '#f87171',
  runner: '#fbbf24',
  brute: '#c084fc',
  spitter: '#34d399',
  warden: '#fb7185',
};

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
        ctx.strokeRect(
          (-ARENA_HALF - px) * scale,
          (-ARENA_HALF - pz) * scale,
          ARENA_HALF * 2 * scale,
          ARENA_HALF * 2 * scale,
        );
        // pickups
        for (const p of useGame.getState().pickups) {
          const x = (p.position[0] - px) * scale;
          const y = (p.position[2] - pz) * scale;
          ctx.fillStyle = p.kind === 'health' ? 'rgba(74,222,128,0.9)' : 'rgba(250,204,21,0.9)';
          ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
        }
        // enemies
        for (const e of runtime.enemies.values()) {
          const x = (e.pos.x - px) * scale;
          const y = (e.pos.z - pz) * scale;
          ctx.beginPath();
          ctx.arc(x, y, e.boss ? 6 : e.radius > 0.8 ? 4 : 2.5, 0, Math.PI * 2);
          ctx.fillStyle = RADAR_COLORS[e.type] ?? '#f87171';
          ctx.fill();
          if (e.boss) {
            ctx.strokeStyle = '#fecdd3';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
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

const proj = new THREE.Vector3();

/** Floating combat text, projected from world space onto the screen. */
function DamageNumbers() {
  const cam = runtime.camera;
  if (!cam || !settings.showDamageNumbers) return null;
  return (
    <div className="absolute inset-0 overflow-hidden">
      {runtime.damageNumbers.map((n) => {
        proj.copy(n.pos).project(cam);
        if (proj.z > 1) return null;
        const x = (proj.x * 0.5 + 0.5) * 100;
        const y = (-proj.y * 0.5 + 0.5) * 100;
        const t = n.life / 0.95;
        const size = n.crit ? 26 : n.headshot ? 20 : 15;
        return (
          <div
            key={n.id}
            className="absolute font-black tabular-nums"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              transform: `translate(-50%, -50%) scale(${1 + (1 - t) * 0.35})`,
              opacity: Math.max(0, 1 - t * t),
              fontSize: size,
              color: n.crit ? '#fbbf24' : n.headshot ? '#fef08a' : '#fca5a5',
              textShadow: '0 0 8px rgba(0,0,0,0.9), 0 2px 3px rgba(0,0,0,0.9)',
            }}
          >
            {n.crit && <span className="mr-0.5 text-[0.7em]">CRIT</span>}
            {Math.max(1, n.amount)}
          </div>
        );
      })}
    </div>
  );
}

/** Red wedges around the crosshair pointing at whatever just hit you. */
function DamageDirections() {
  if (runtime.damageDirs.length === 0) return null;
  return (
    <div className="absolute left-1/2 top-1/2 h-0 w-0">
      {runtime.damageDirs.map((d, i) => {
        const a = Math.max(0, 1 - d.life / 1.1);
        return (
          <div
            key={i}
            className="absolute"
            style={{
              transform: `rotate(${(d.angle * 180) / Math.PI}deg) translateY(-96px)`,
              transformOrigin: '0 0',
              opacity: a,
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                marginLeft: -18,
                borderLeft: '18px solid transparent',
                borderRight: '18px solid transparent',
                borderBottom: '22px solid rgba(248,113,113,0.85)',
                filter: 'drop-shadow(0 0 6px rgba(239,68,68,0.8))',
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

function WeaponSlots() {
  const s = useGame();
  return (
    <div className="mb-3 flex justify-end gap-2">
      {WEAPON_ORDER.map((w, i) => {
        const def = WEAPONS[w];
        const owned = s.unlocked.includes(w);
        const active = s.weapon === w;
        return (
          <div
            key={w}
            className={cn(
              'flex min-w-[76px] flex-col items-end border px-2 py-1 transition-all',
              active
                ? 'border-cyan-300 bg-cyan-400/15 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
                : owned
                  ? 'border-cyan-400/25 bg-slate-900/50'
                  : 'border-slate-700/40 bg-slate-950/40 opacity-40',
            )}
          >
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[10px] text-cyan-400/70">{i + 1}</span>
              <span
                className={cn('text-[10px] font-bold tracking-widest', active ? 'text-white' : 'text-cyan-200/70')}
                style={active ? { color: def.accent } : undefined}
              >
                {owned ? def.short : 'LOCKED'}
              </span>
            </div>
            <div className="text-[11px] tabular-nums text-cyan-200/60">
              {owned ? `${s.mags[w]} / ${s.reserves[w]}` : `WAVE ${def.unlockWave}`}
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const lowHealth = s.health <= s.maxHealth * 0.3;
  const healthPct = (s.health / s.maxHealth) * 100;
  const moving = Math.hypot(runtime.playerVel.x, runtime.playerVel.z) > 1;
  const firing = now - runtime.lastShotAt < 0.12;
  const def = WEAPONS[s.weapon];
  const mag = s.mags[s.weapon];
  const reserve = s.reserves[s.weapon];
  const magSize = magSizeFor(s.weapon);
  const baseSpread = def.spread * 260;
  const spreadPx =
    6 + baseSpread + (moving ? 6 : 0) + (firing ? 8 : 0) + (!runtime.playerGrounded ? 6 : 0);
  const intermissionLeft = s.waveState === 'intermission' ? Math.max(0, s.intermissionEndsAt - now) : 0;
  const comboActive = s.combo > 1 && now < s.comboEndsAt;
  const comboLeft = Math.max(0, s.comboEndsAt - now) / COMBO.window;
  const maxDash = Math.round(runtime.mods.dashCharges);
  const dashFrac =
    runtime.dashCharges >= maxDash
      ? 1
      : 1 - runtime.dashCooldown / (DASH.cooldown * runtime.mods.dashCooldownMul);
  const boss = s.bossId !== null ? runtime.enemies.get(s.bossId) : undefined;
  const bossDef = ENEMY_TYPES.warden;
  const ownedAugments = Object.entries(s.augments);

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-mono text-cyan-100">
      {/* damage vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,0,0,0) 45%, rgba(220,38,38,0.9) 100%)',
          opacity: dmgAlpha + (lowHealth ? 0.25 + Math.sin(now * 6) * 0.15 : 0),
        }}
      />
      {/* overdrive / slow-mo tint */}
      {runtime.slowMo > 0 && (
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(34,211,238,0) 35%, rgba(34,211,238,0.28) 100%)',
            opacity: Math.min(1, runtime.slowMo),
          }}
        />
      )}
      {/* subtle vignette */}
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)' }}
      />

      <DamageNumbers />

      {/* crosshair */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-0 w-0">
          {[0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              className={cn(
                'absolute h-[2px] bg-cyan-300 shadow-[0_0_4px_#22d3ee]',
                showKill && 'bg-red-400',
                s.weapon === 'rail' ? 'w-[14px]' : 'w-[9px]',
              )}
              style={{
                transform: `rotate(${deg}deg) translateX(${spreadPx}px)`,
                transformOrigin: '0 50%',
                left: 0,
                top: -1,
                backgroundColor: showKill ? undefined : def.accent,
              }}
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

      <DamageDirections />

      {/* top-left: wave + score */}
      <div className="absolute left-6 top-6 space-y-1">
        <div className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Wave</div>
        <div className="text-5xl font-black leading-none text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]">
          {s.wave.toString().padStart(2, '0')}
        </div>
        <div className="mt-2 text-xs uppercase tracking-[0.3em] text-cyan-400/80">
          {s.waveState === 'active' && (
            <span>
              {s.enemies.length} hostile{s.enemies.length === 1 ? '' : 's'} remaining
            </span>
          )}
          {s.waveState === 'spawning' && <span className="text-red-300">Incoming…</span>}
          {s.waveState === 'intermission' && (
            <span className="text-emerald-300">Next wave in {intermissionLeft.toFixed(1)}s</span>
          )}
        </div>
      </div>

      {/* top-center: boss health */}
      {boss && (
        <div className="absolute left-1/2 top-6 w-[min(70vw,560px)] -translate-x-1/2">
          <div className="mb-1 flex items-end justify-between">
            <span className="text-xs uppercase tracking-[0.4em] text-rose-300">{bossDef.name}</span>
            <span className="text-xs tabular-nums text-rose-200/70">{Math.ceil(boss.hpFrac * 100)}%</span>
          </div>
          <div className="h-3 w-full border border-rose-400/50 bg-slate-950/70 p-[2px]">
            <div
              className="h-full bg-gradient-to-r from-rose-600 to-rose-300 shadow-[0_0_14px_#f43f5e] transition-[width] duration-200"
              style={{ width: `${boss.hpFrac * 100}%` }}
            />
          </div>
          {boss.hpFrac < 0.35 && (
            <div className="mt-1 text-center text-[11px] uppercase tracking-[0.4em] text-rose-400">Enraged</div>
          )}
        </div>
      )}

      {/* top-right: score, combo, radar */}
      <div className="absolute right-6 top-6 flex flex-col items-end gap-3">
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Score</div>
          <div className="text-3xl font-bold tabular-nums text-white">{s.score.toLocaleString()}</div>
          <div className="text-xs text-cyan-200/70">{s.kills} kills</div>
        </div>
        {comboActive && (
          <div className="w-32 text-right">
            <div className="text-2xl font-black text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]">
              ×{comboMultiplier(s.combo).toFixed(2)}
            </div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-amber-200/70">{s.combo} streak</div>
            <div className="mt-1 h-[3px] w-full bg-slate-800">
              <div className="h-full bg-amber-400" style={{ width: `${comboLeft * 100}%` }} />
            </div>
          </div>
        )}
        <Radar />
        {/* kill feed */}
        <div className="flex w-56 flex-col items-end gap-1">
          {s.feed.map((f) => (
            <div
              key={f.id}
              className="border-r-2 bg-slate-950/60 px-2 py-1 text-right text-[11px] backdrop-blur-sm"
              style={{ borderColor: f.color, opacity: Math.min(1, (f.until - now) / 0.6) }}
            >
              <div className="font-bold" style={{ color: f.color }}>
                {f.text}
              </div>
              {f.detail && <div className="text-[10px] text-slate-400">{f.detail}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* bottom-left: health, dash, augments */}
      <div className="absolute bottom-6 left-6 w-72">
        {ownedAugments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1">
            {ownedAugments.map(([id, stacks]) => {
              const a = AUGMENTS.find((x) => x.id === id);
              if (!a) return null;
              return (
                <div
                  key={id}
                  title={`${a.name} — ${a.desc}`}
                  className="flex items-center gap-1 border border-cyan-400/30 bg-slate-900/60 px-1.5 py-0.5 text-[11px] text-cyan-200"
                >
                  <span>{a.icon}</span>
                  {stacks > 1 && <span className="text-[10px] text-cyan-400/80">×{stacks}</span>}
                </div>
              );
            })}
          </div>
        )}
        <div className="mb-1 flex items-end justify-between">
          <span className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">Integrity</span>
          <span className={cn('text-2xl font-bold tabular-nums', lowHealth ? 'text-red-400' : 'text-white')}>
            {Math.ceil(s.health)}
            <span className="ml-1 text-xs text-cyan-300/50">/ {s.maxHealth}</span>
          </span>
        </div>
        <div className="h-3 w-full skew-x-[-12deg] border border-cyan-400/40 bg-slate-900/70 p-[2px]">
          <div
            className={cn(
              'h-full transition-[width] duration-150',
              lowHealth ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]',
            )}
            style={{ width: `${healthPct}%` }}
          />
        </div>
        {/* dash charges */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.3em] text-cyan-400/60">Dash</span>
          <div className="flex gap-1">
            {Array.from({ length: maxDash }).map((_, i) => {
              const filled = i < runtime.dashCharges;
              const charging = i === runtime.dashCharges;
              return (
                <div key={i} className="h-[6px] w-8 skew-x-[-20deg] border border-cyan-400/40 bg-slate-900/70">
                  <div
                    className={cn('h-full', filled ? 'bg-cyan-300 shadow-[0_0_8px_#22d3ee]' : 'bg-cyan-600/60')}
                    style={{ width: filled ? '100%' : charging ? `${Math.max(0, dashFrac) * 100}%` : '0%' }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* bottom-right: weapons + ammo */}
      <div className="absolute bottom-6 right-6 text-right">
        <WeaponSlots />
        <div className="text-xs uppercase tracking-[0.3em]" style={{ color: def.accent }}>
          {def.name}
        </div>
        <div className="flex items-baseline justify-end gap-2">
          <span
            className={cn(
              'text-5xl font-black tabular-nums',
              mag === 0 ? 'text-red-400' : mag <= magSize * 0.3 ? 'text-amber-300' : 'text-white',
            )}
          >
            {mag}
          </span>
          <span className="text-xl tabular-nums text-cyan-200/60">/ {reserve}</span>
        </div>
        {s.reloading && <div className="mt-1 animate-pulse text-xs uppercase tracking-[0.3em] text-amber-300">Reloading</div>}
        {!s.reloading && mag === 0 && reserve === 0 && (
          <div className="mt-1 animate-pulse text-xs uppercase tracking-[0.3em] text-red-400">
            No ammo – switch or scavenge
          </div>
        )}
        {!s.reloading && mag <= magSize * 0.3 && reserve > 0 && (
          <div className="mt-1 text-xs uppercase tracking-[0.3em] text-amber-300/80">Press R to reload</div>
        )}
      </div>

      {/* center messages — only the two newest, so unlocks never wall off the view */}
      <div className="absolute left-1/2 top-[22%] flex w-[min(90vw,760px)] -translate-x-1/2 flex-col items-center gap-2">
        {s.messages.slice(-2).map((m, i, arr) => {
          const newest = i === arr.length - 1;
          const left = m.until - now;
          const alpha = Math.min(1, left / 0.5) * (newest ? 1 : 0.55);
          return (
            <div key={m.id} className="text-center" style={{ opacity: alpha }}>
              <div
                className={cn(
                  'font-black uppercase tracking-[0.25em] text-white drop-shadow-[0_0_16px_rgba(34,211,238,0.8)]',
                  newest ? 'text-4xl' : 'text-xl',
                )}
              >
                {m.text}
              </div>
              {m.sub && (
                <div className={cn('mt-1 uppercase tracking-[0.3em] text-cyan-300', newest ? 'text-sm' : 'text-[11px]')}>
                  {m.sub}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
