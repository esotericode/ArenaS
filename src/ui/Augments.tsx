import { useEffect } from 'react';
import { AUGMENTS, RARITY_COLOR, type AugmentDef } from '../game/config';
import { useGame } from '../game/store';
import { lockPointer } from '../game/pointerLock';
import { cn } from '../utils/cn';

function Card({ def, stacks, index, onPick }: { def: AugmentDef; stacks: number; index: number; onPick: () => void }) {
  const color = RARITY_COLOR[def.rarity];
  return (
    <button
      onClick={onPick}
      className={cn(
        'group pointer-events-auto relative flex w-full flex-col items-center gap-3 border bg-slate-950/80 p-5 text-center transition-all',
        'hover:-translate-y-1 hover:bg-slate-900/90',
      )}
      style={{ borderColor: `${color}66`, boxShadow: `0 0 24px ${color}22` }}
    >
      <span
        className="absolute left-2 top-2 text-[10px] font-bold text-slate-500 transition-colors group-hover:text-slate-300"
      >
        {index + 1}
      </span>
      <span
        className="absolute right-2 top-2 text-[9px] uppercase tracking-[0.25em]"
        style={{ color }}
      >
        {def.rarity}
      </span>
      <span
        className="mt-3 flex h-14 w-14 items-center justify-center rounded-full border text-2xl transition-transform group-hover:scale-110"
        style={{ borderColor: `${color}88`, color, boxShadow: `0 0 20px ${color}33`, background: `${color}14` }}
      >
        {def.icon}
      </span>
      <span className="text-base font-black uppercase tracking-[0.15em] text-white">{def.name}</span>
      <span className="text-xs leading-relaxed text-slate-300">{def.desc}</span>
      {stacks > 0 && (
        <span className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
          owned ×{stacks} / {def.maxStacks}
        </span>
      )}
    </button>
  );
}

export function AugmentPicker() {
  const offers = useGame((s) => s.offers);
  const augments = useGame((s) => s.augments);
  const wave = useGame((s) => s.wave);
  const chooseAugment = useGame((s) => s.chooseAugment);
  const skipAugment = useGame((s) => s.skipAugment);

  const defs = offers
    .map((id) => AUGMENTS.find((a) => a.id === id))
    .filter((a): a is AugmentDef => !!a);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0 && defs[i]) {
        e.preventDefault();
        chooseAugment(defs[i].id);
        lockPointer();
      }
      if (e.code === 'Escape') {
        skipAugment();
        lockPointer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [defs, chooseAugment, skipAugment]);

  if (defs.length === 0) return null;

  return (
    <div className="pointer-events-auto w-[min(94vw,880px)]">
      <div className="mb-6 text-center">
        <div className="text-xs uppercase tracking-[0.6em] text-cyan-400/80">Wave {wave} cleared</div>
        <h2 className="mt-1 bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-4xl font-black uppercase tracking-tight text-transparent">
          Install Augment
        </h2>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] text-slate-400">
          Press 1–3 or click · Esc to skip
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {defs.map((def, i) => (
          <Card
            key={def.id}
            def={def}
            index={i}
            stacks={augments[def.id] ?? 0}
            onPick={() => {
              chooseAugment(def.id);
              lockPointer();
            }}
          />
        ))}
      </div>
      <div className="mt-6 flex justify-center">
        <button
          onClick={() => {
            skipAugment();
            lockPointer();
          }}
          className="pointer-events-auto border border-slate-600/50 px-6 py-2 text-xs uppercase tracking-[0.3em] text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-200"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
