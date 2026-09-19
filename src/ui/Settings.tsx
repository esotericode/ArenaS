import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, resetSettings, settings, updateSettings } from '../game/settings';
import { audio } from '../game/audio';
import { cmPer360 } from '../game/config';
import { isRawInput, onLockPending } from '../game/pointerLock';

function Slider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
  hint?: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.3em] text-cyan-400/80">{label}</span>
        <span className="text-sm tabular-nums text-white">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="pointer-events-auto h-1 w-full cursor-pointer appearance-none rounded bg-slate-700 accent-cyan-400"
      />
      {hint && <div className="mt-1 text-[10px] leading-relaxed text-slate-400">{hint}</div>}
    </label>
  );
}

/** Says plainly whether aim is a true 1:1 match or the OS is still in the way. */
function RawInputNotice() {
  const [, force] = useState(0);
  useEffect(() => onLockPending(() => force((n) => n + 1)), []);
  const raw = isRawInput();
  if (raw === null) {
    return (
      <div className="border border-slate-600/40 bg-slate-900/40 px-3 py-2 text-[10px] leading-relaxed text-slate-400">
        Raw mouse input is confirmed the first time you deploy.
      </div>
    );
  }
  if (raw) {
    return (
      <div className="border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-[10px] leading-relaxed text-emerald-300">
        Raw mouse input active — no OS acceleration, 1:1 with CS2 at the same DPI.
      </div>
    );
  }
  return (
    <div className="border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-[10px] leading-relaxed text-amber-300">
      This browser will not give raw mouse input, so your OS pointer acceleration and
      display scaling still apply and aim cannot match CS2 exactly. Chrome or Edge on
      Windows or macOS gives a true 1:1 match.
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="pointer-events-auto flex w-full items-center justify-between border border-cyan-400/25 bg-slate-900/50 px-3 py-2 text-xs uppercase tracking-[0.25em] text-cyan-100 transition-colors hover:border-cyan-300/60"
    >
      <span>{label}</span>
      <span className={value ? 'text-cyan-300' : 'text-slate-500'}>{value ? 'On' : 'Off'}</span>
    </button>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [, force] = useState(0);
  const set = (patch: Partial<typeof settings>) => {
    updateSettings(patch);
    if (patch.volume !== undefined) audio.applyVolume();
    force((n) => n + 1);
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.6em] text-cyan-400/80">Configuration</div>
        <h2 className="mt-1 text-3xl font-black uppercase text-white">Settings</h2>
      </div>

      <Slider
        label="Sensitivity"
        value={settings.sensitivity}
        min={0.1}
        max={6}
        step={0.01}
        format={(v) => v.toFixed(2)}
        onChange={(v) => set({ sensitivity: v })}
        hint={
          <>
            Same scale as CS2 — {settings.sensitivity.toFixed(2)} here turns exactly like{' '}
            {settings.sensitivity.toFixed(2)} there at the same DPI.
            <br />
            <span className="tabular-nums">
              {cmPer360(settings.sensitivity, 400).toFixed(1)} /{' '}
              {cmPer360(settings.sensitivity, 800).toFixed(1)} /{' '}
              {cmPer360(settings.sensitivity, 1600).toFixed(1)} cm per 360° at 400 / 800 / 1600 DPI
            </span>
          </>
        }
      />
      <RawInputNotice />
      <Slider
        label="Field of view"
        value={settings.fov}
        min={60}
        max={115}
        step={1}
        format={(v) => `${v}°`}
        onChange={(v) => set({ fov: v })}
      />
      <Slider
        label="Volume"
        value={settings.volume}
        min={0}
        max={1}
        step={0.02}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => set({ volume: v })}
      />
      <Slider
        label="Screen shake"
        value={settings.screenShake}
        min={0}
        max={1.5}
        step={0.05}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(v) => set({ screenShake: v })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Toggle label="Invert Y" value={settings.invertY} onChange={(v) => set({ invertY: v })} />
        <Toggle
          label="Damage numbers"
          value={settings.showDamageNumbers}
          onChange={(v) => set({ showDamageNumbers: v })}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={() => {
            resetSettings();
            audio.applyVolume();
            force((n) => n + 1);
          }}
          className="pointer-events-auto flex-1 border border-slate-600/50 px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-200"
        >
          Defaults ({DEFAULT_SETTINGS.fov}°)
        </button>
        <button
          onClick={onClose}
          className="pointer-events-auto flex-1 border border-cyan-300 bg-cyan-400 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-slate-950 transition-colors hover:bg-cyan-300"
        >
          Back
        </button>
      </div>
    </div>
  );
}
