/**
 * Update 3 — weapon catalog normalizer (defense-in-depth, see R2 in the plan).
 * weapons.json now uses `evolutions: WeaponEvolution[]`. If a legacy entry (or
 * a stale JSON fixture) still carries a single `evolution` object, convert it
 * here so every consumer can rely on the array schema unconditionally.
 * Apply wherever weapons.json is imported.
 */
import { WeaponData, WeaponEvolution } from "./types";

type LegacyWeapon = WeaponData & { evolution?: WeaponEvolution };

export function normalizeWeapons(raw: unknown): WeaponData[] {
  const list = raw as LegacyWeapon[];
  for (const w of list) {
    if (!Array.isArray(w.evolutions)) w.evolutions = [];
    if (w.evolution) {
      const legacy = w.evolution;
      if (!legacy.id) legacy.id = `${w.id}-evo-a`;
      if (!w.evolutions.some((e) => e.id === legacy.id)) {
        w.evolutions.push(legacy);
      }
      delete w.evolution;
    }
  }
  return list;
}
