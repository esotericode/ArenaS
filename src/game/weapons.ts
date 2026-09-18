import { WEAPONS, type WeaponId } from './config';
import { runtime } from './runtime';

/** Weapon stats after augment modifiers are applied. */
export const magSizeFor = (w: WeaponId) =>
  Math.max(1, Math.round(WEAPONS[w].magSize * runtime.mods.magMul));

export const fireIntervalFor = (w: WeaponId) =>
  WEAPONS[w].fireInterval / runtime.mods.fireRateMul;

export const reloadTimeFor = (w: WeaponId) => WEAPONS[w].reloadTime * runtime.mods.reloadMul;

export const damageFor = (w: WeaponId) => WEAPONS[w].damage * runtime.mods.damageMul;

export const headshotMulFor = (w: WeaponId) =>
  WEAPONS[w].headshotMultiplier + runtime.mods.headshotAdd;

/** Linear damage falloff past `falloffStart`, clamped at `falloffMin`. */
export function falloffAt(w: WeaponId, distance: number) {
  const def = WEAPONS[w];
  if (distance <= def.falloffStart) return 1;
  const t = Math.min(1, (distance - def.falloffStart) / Math.max(0.001, def.range - def.falloffStart));
  return 1 + (def.falloffMin - 1) * t;
}
