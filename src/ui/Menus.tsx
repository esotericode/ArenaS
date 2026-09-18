import { useGame } from '../game/store';
import { runtime } from '../game/runtime';
import { audio } from '../game/audio';
import { useState } from 'react';
import { cn } from '../utils/cn';

function lockPointer() {
  const c = runtime.canvas;
  if (!c) return;
  try {
    const p = c.requestPointerLock({ unadjustedMovement: true } as unknown as undefined) as unknown as Promise<void> | undefined;
    if (p && typeof p.catch === 'function') p.catch(() => c.requestPointerLock());
  } catch {
    c.requestPointerLock();
  }
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-block min-w-[1.6rem] rounded border border-cyan-400/40 bg-slate-900/80 px-1.5 py-0.5 text-center text-[11px] font-bold text-cyan-200">
      {children}
    </kbd>
  );
}

function Controls() {
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-300">
      <div className="flex items-center gap-2"><Key>W</Key><Key>A</Key><Key>S</Key><Key>D</Key><span>Move</span></div>
      <div className="flex items-center gap-2"><Key>Mouse</Key><span>Look / Aim</span></div>
      <div className="flex items-center gap-2"><Key>Space</Key><span>Jump</span></div>
      <div className="flex items-center gap-2"><Key>LMB</Key><span>Fire (hold)</span></div>
      <div className="flex items-center gap-2"><Key>Shift</Key><span>Sprint</span></div>
      <div className="flex items-center gap-2"><Key>R</Key><span>Reload</span></div>
      <div className="flex items-center gap-2"><Key>Esc</Key><span>Pause</span></div>
      <div className="flex items-center gap-2"><Key>M</Key><span>Mute</span></div>
    </div>
  );
}

function Button({ children, onClick, primary }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'pointer-events-auto w-full skew-x-[-8deg] border px-8 py-3 text-sm font-bold uppercase tracking-[0.3em] transition-all',
        primary
          ? 'border-cyan-300 bg-cyan-400 text-slate-950 shadow-[0_0_24px_rgba(34,211,238,0.6)] hover:bg-cyan-300 hover:shadow-[0_0_36px_rgba(34,211,238,0.9)]'
          : 'border-cyan-400/40 bg-slate-900/70 text-cyan-100 hover:border-cyan-300 hover:bg-slate-800/80',
      )}
    >
      <span className="inline-block skew-x-[8deg]">{children}</span>
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[min(92vw,560px)] border border-cyan-400/30 bg-slate-950/80 p-8 shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-md">
      <div className="absolute -left-px -top-px h-6 w-6 border-l-2 border-t-2 border-cyan-300" />
      <div className="absolute -right-px -top-px h-6 w-6 border-r-2 border-t-2 border-cyan-300" />
      <div className="absolute -bottom-px -left-px h-6 w-6 border-b-2 border-l-2 border-cyan-300" />
      <div className="absolute -bottom-px -right-px h-6 w-6 border-b-2 border-r-2 border-cyan-300" />
      {children}
    </div>
  );
}

function Title() {
  return (
    <div className="mb-6 text-center">
      <div className="text-xs uppercase tracking-[0.6em] text-cyan-400/80">First-person arena defense</div>
      <h1 className="mt-1 bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-6xl font-black uppercase tracking-tight text-transparent drop-shadow-[0_0_20px_rgba(34,211,238,0.5)]">
        Neon Siege
      </h1>
    </div>
  );
}

export function Menus() {
  const status = useGame((s) => s.status);
  const { score, kills, wave, bestScore, bestWave, startGame, backToMenu } = useGame();
  const [muted, setMuted] = useState(false);

  if (status === 'playing') return null;

  const start = () => {
    startGame();
    lockPointer();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 font-mono">
      {status === 'menu' && (
        <Panel>
          <Title />
          <p className="mb-6 text-center text-sm leading-relaxed text-slate-300">
            Hostile constructs are breaching the arena in escalating waves. Hold the line, keep moving,
            and use the terrain — you can climb the crates and the central platform.
          </p>
          <div className="mb-6 flex justify-center">
            <Controls />
          </div>
          {(bestScore > 0 || bestWave > 0) && (
            <div className="mb-6 flex justify-center gap-8 text-center text-xs uppercase tracking-[0.3em] text-cyan-300/80">
              <div>
                Best score<div className="text-xl font-bold text-white">{bestScore.toLocaleString()}</div>
              </div>
              <div>
                Best wave<div className="text-xl font-bold text-white">{bestWave}</div>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Button primary onClick={start}>
              Deploy
            </Button>
            <Button
              onClick={() => {
                audio.init();
                audio.setMuted(!muted);
                setMuted(!muted);
              }}
            >
              Sound: {muted ? 'Off' : 'On'}
            </Button>
          </div>
          <p className="mt-4 text-center text-[11px] text-slate-500">Click Deploy to lock the mouse pointer. Best played in Chrome / Edge / Firefox on desktop.</p>
        </Panel>
      )}

      {status === 'paused' && (
        <Panel>
          <div className="mb-6 text-center">
            <div className="text-xs uppercase tracking-[0.6em] text-cyan-400/80">Neon Siege</div>
            <h2 className="mt-1 text-4xl font-black uppercase text-white">Paused</h2>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-4 text-center text-xs uppercase tracking-[0.3em] text-cyan-300/80">
            <div>
              Wave<div className="text-2xl font-bold text-white">{wave}</div>
            </div>
            <div>
              Score<div className="text-2xl font-bold text-white">{score.toLocaleString()}</div>
            </div>
            <div>
              Kills<div className="text-2xl font-bold text-white">{kills}</div>
            </div>
          </div>
          <div className="mb-6 flex justify-center">
            <Controls />
          </div>
          <div className="flex flex-col gap-3">
            <Button primary onClick={lockPointer}>
              Resume
            </Button>
            <Button onClick={backToMenu}>Abandon run</Button>
          </div>
        </Panel>
      )}

      {status === 'gameover' && (
        <Panel>
          <div className="mb-6 text-center">
            <div className="text-xs uppercase tracking-[0.6em] text-red-400/80">Signal lost</div>
            <h2 className="mt-1 text-5xl font-black uppercase text-white drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]">
              You fell
            </h2>
          </div>
          <div className="mb-6 grid grid-cols-3 gap-4 text-center text-xs uppercase tracking-[0.3em] text-cyan-300/80">
            <div>
              Wave reached<div className="text-3xl font-bold text-white">{wave}</div>
            </div>
            <div>
              Score<div className="text-3xl font-bold text-white">{score.toLocaleString()}</div>
            </div>
            <div>
              Kills<div className="text-3xl font-bold text-white">{kills}</div>
            </div>
          </div>
          <div className="mb-6 text-center text-xs uppercase tracking-[0.3em] text-slate-400">
            Best: {bestScore.toLocaleString()} pts · wave {bestWave}
            {score >= bestScore && score > 0 && <span className="ml-2 text-amber-300">New record!</span>}
          </div>
          <div className="flex flex-col gap-3">
            <Button primary onClick={start}>
              Redeploy
            </Button>
            <Button onClick={backToMenu}>Main menu</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
