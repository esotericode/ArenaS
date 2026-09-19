import { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { audio } from '../game/audio';
import { lockPointer, onLockPending } from '../game/pointerLock';
import { AUGMENTS, RARITY_COLOR, WEAPONS, WEAPON_ORDER } from '../game/config';
import { AugmentPicker } from './Augments';
import { SettingsPanel } from './Settings';
import { cn } from '../utils/cn';

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
      <div className="flex items-center gap-2">
        <Key>W</Key>
        <Key>A</Key>
        <Key>S</Key>
        <Key>D</Key>
        <span>Move</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>Mouse</Key>
        <span>Look / Aim</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>Space</Key>
        <span>Jump</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>LMB</Key>
        <span>Fire</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>Shift</Key>
        <span>Sprint</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>RMB</Key>
        <Key>Ctrl</Key>
        <span>Dash</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>1</Key>
        <Key>2</Key>
        <Key>3</Key>
        <span>Weapons</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>Q</Key>
        <Key>Wheel</Key>
        <span>Quick swap</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>R</Key>
        <span>Reload</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>Esc</Key>
        <span>Pause</span>
      </div>
      <div className="flex items-center gap-2">
        <Key>M</Key>
        <span>Mute</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-500">Green pads launch you high</span>
      </div>
    </div>
  );
}

function Button({
  children,
  onClick,
  primary,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
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

function Panel({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={cn(
        'relative border border-cyan-400/30 bg-slate-950/85 p-8 shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur-md',
        wide ? 'w-[min(94vw,720px)]' : 'w-[min(92vw,560px)]',
      )}
    >
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

function AugmentSummary({ augments }: { augments: Record<string, number> }) {
  const owned = Object.entries(augments);
  if (owned.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="mb-2 text-center text-[10px] uppercase tracking-[0.4em] text-cyan-400/70">Augments installed</div>
      <div className="flex flex-wrap justify-center gap-2">
        {owned.map(([id, stacks]) => {
          const a = AUGMENTS.find((x) => x.id === id);
          if (!a) return null;
          const color = RARITY_COLOR[a.rarity];
          return (
            <div
              key={id}
              className="flex items-center gap-1.5 border bg-slate-900/60 px-2 py-1 text-[11px]"
              style={{ borderColor: `${color}55`, color }}
              title={a.desc}
            >
              <span>{a.icon}</span>
              <span className="text-slate-200">{a.name}</span>
              {stacks > 1 && <span className="opacity-70">×{stacks}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Menus() {
  const status = useGame((s) => s.status);
  const { score, kills, wave, bestScore, bestWave, augments, startGame, backToMenu } = useGame();
  const [muted, setMuted] = useState(audio.muted);
  const [showSettings, setShowSettings] = useState(false);
  const [lockPending, setLockPending] = useState(false);

  useEffect(() => onLockPending(setLockPending), []);
  // the M key can mute from anywhere, so follow the engine rather than guessing
  useEffect(() => audio.onMuteChange(() => setMuted(audio.muted)), []);
  useEffect(() => {
    if (status === 'menu') setShowSettings(false);
  }, [status]);

  if (status === 'playing') return null;

  const start = () => {
    startGame();
    lockPointer();
  };

  return (
    <div
      className={cn(
        'absolute inset-0 flex items-center justify-center font-mono',
        status === 'augment' ? 'bg-slate-950/75 backdrop-blur-sm' : 'bg-slate-950/60',
      )}
    >
      {status === 'augment' && <AugmentPicker />}

      {status === 'menu' && (
        <Panel>
          {showSettings ? (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          ) : (
            <>
              <Title />
              <p className="mb-5 text-center text-sm leading-relaxed text-slate-300">
                Hostile constructs are breaching the arena in escalating waves. Hold the line, keep moving,
                dash through the crossfire, and install an augment after every wave. A Warden arrives every
                fifth wave.
              </p>
              <div className="mb-5 flex justify-center gap-2 text-[10px] uppercase tracking-[0.2em]">
                {WEAPON_ORDER.map((w) => (
                  <span
                    key={w}
                    className="border px-2 py-1"
                    style={{ borderColor: `${WEAPONS[w].accent}55`, color: WEAPONS[w].accent }}
                  >
                    {WEAPONS[w].short}
                  </span>
                ))}
              </div>
              <div className="mb-6 flex justify-center">
                <Controls />
              </div>
              {(bestScore > 0 || bestWave > 0) && (
                <div className="mb-6 flex justify-center gap-8 text-center text-xs uppercase tracking-[0.3em] text-cyan-300/80">
                  <div>
                    Best score
                    <div className="text-xl font-bold text-white">{bestScore.toLocaleString()}</div>
                  </div>
                  <div>
                    Best wave
                    <div className="text-xl font-bold text-white">{bestWave}</div>
                  </div>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <Button primary onClick={start}>
                  Deploy
                </Button>
                <div className="flex gap-3">
                  <Button onClick={() => setShowSettings(true)}>Settings</Button>
                  <Button
                    onClick={() => {
                      audio.init();
                      audio.setMuted(!audio.muted);
                    }}
                  >
                    Sound: {muted ? 'Off' : 'On'}
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-center text-[11px] text-slate-500">
                Click Deploy to lock the mouse pointer. Best played in Chrome / Edge / Firefox on desktop.
              </p>
            </>
          )}
        </Panel>
      )}

      {status === 'paused' && (
        <Panel>
          {showSettings ? (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          ) : (
            <>
              <div className="mb-6 text-center">
                <div className="text-xs uppercase tracking-[0.6em] text-cyan-400/80">Neon Siege</div>
                <h2 className="mt-1 text-4xl font-black uppercase text-white">Paused</h2>
              </div>
              <div className="mb-6 grid grid-cols-3 gap-4 text-center text-xs uppercase tracking-[0.3em] text-cyan-300/80">
                <div>
                  Wave
                  <div className="text-2xl font-bold text-white">{wave}</div>
                </div>
                <div>
                  Score
                  <div className="text-2xl font-bold text-white">{score.toLocaleString()}</div>
                </div>
                <div>
                  Kills
                  <div className="text-2xl font-bold text-white">{kills}</div>
                </div>
              </div>
              <AugmentSummary augments={augments} />
              <div className="mb-6 flex justify-center">
                <Controls />
              </div>
              <div className="flex flex-col gap-3">
                <Button primary onClick={lockPointer}>
                  {lockPending ? 'Re-acquiring pointer…' : 'Resume'}
                </Button>
                <div className="flex gap-3">
                  <Button onClick={() => setShowSettings(true)}>Settings</Button>
                  <Button onClick={backToMenu}>Abandon run</Button>
                </div>
              </div>
              {lockPending && (
                <p className="mt-3 text-center text-[11px] text-slate-500">
                  The browser blocks pointer lock for a moment after Escape — retrying automatically.
                </p>
              )}
            </>
          )}
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
              Wave reached
              <div className="text-3xl font-bold text-white">{wave}</div>
            </div>
            <div>
              Score
              <div className="text-3xl font-bold text-white">{score.toLocaleString()}</div>
            </div>
            <div>
              Kills
              <div className="text-3xl font-bold text-white">{kills}</div>
            </div>
          </div>
          <AugmentSummary augments={augments} />
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
