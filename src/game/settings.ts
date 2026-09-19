/**
 * User settings, persisted to localStorage. Read directly (not via React) by
 * the per-frame systems, which pick changes up on their next frame; the UI
 * mutates them through `updateSettings` and re-renders itself.
 */
export interface Settings {
  /** bumped when a stored field changes meaning; see `load` */
  version: number;
  /** CS2-equivalent: 1 here turns exactly as 1 does in CS2 at the same DPI */
  sensitivity: number;
  fov: number;
  volume: number;
  invertY: boolean;
  showDamageNumbers: boolean;
  screenShake: number;
}

const KEY = 'neon-siege-settings';
const SETTINGS_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  version: SETTINGS_VERSION,
  sensitivity: 1,
  fov: 80,
  volume: 0.5,
  invertY: false,
  showDamageNumbers: true,
  screenShake: 1,
};

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    const merged = { ...DEFAULT_SETTINGS, ...parsed };
    if ((parsed.version ?? 1) < 2) {
      // v1 stored an opaque multiplier that ran ~5.7x faster than CS2 at the
      // same number. The scale is CS2-equivalent now, so an old value would be
      // meaningless rather than merely different — start from the new default.
      merged.sensitivity = DEFAULT_SETTINGS.sensitivity;
      merged.version = SETTINGS_VERSION;
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings: Settings = load();

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
}

export function resetSettings() {
  updateSettings({ ...DEFAULT_SETTINGS });
}
