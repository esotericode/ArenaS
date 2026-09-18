/**
 * User settings, persisted to localStorage. Read directly (not via React) by
 * the per-frame systems; the UI mutates them through `updateSettings`.
 */
export interface Settings {
  sensitivity: number;
  fov: number;
  volume: number;
  invertY: boolean;
  showDamageNumbers: boolean;
  screenShake: number;
}

const KEY = 'neon-siege-settings';

export const DEFAULT_SETTINGS: Settings = {
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
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export const settings: Settings = load();

/** Listeners fire after any change so React panels and the camera can react. */
const listeners = new Set<() => void>();

export function onSettingsChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function updateSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* ignore quota / private mode */
  }
  listeners.forEach((fn) => fn());
}

export function resetSettings() {
  updateSettings({ ...DEFAULT_SETTINGS });
}
