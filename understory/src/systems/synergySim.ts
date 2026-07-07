/**
 * Update 3 — synergy tag math (pure, no Phaser; vitest-covered).
 *
 * Count = number of DISTINCT owned items (weapons + passives) carrying a tag;
 * stacks and weapon levels don't multiply the count. For each synergy def the
 * highest satisfied threshold wins (tiers are authored as totals, not deltas).
 *
 * Bonus fields map onto existing statBonus() stat types (plan D6/§4b — no new
 * stat plumbing): damage, cooldown (negative = faster), area, moveSpeed,
 * pickupRadius. See docs/update-3-deviations.md for the xpGain/knockback
 * mappings.
 */
import {
  ActivePassive,
  ActiveWeapon,
  PassiveData,
  StatBonus,
  SynergyData,
  WeaponData,
} from "../core/types";

export interface ActiveSynergy {
  synergyId: string;
  tag: string;
  /** 1-based tier index (1 = first threshold reached). */
  tier: number;
  /** Owned item count for the tag. */
  count: number;
  bonus: StatBonus;
}

/** Distinct-item tag counts across owned weapons + passives. */
export function countTags(
  activeWeapons: ActiveWeapon[],
  activePassives: ActivePassive[],
  weapons: WeaponData[],
  passives: PassiveData[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  const bump = (tags?: string[]): void => {
    for (const t of tags ?? []) counts[t] = (counts[t] ?? 0) + 1;
  };
  for (const aw of activeWeapons) {
    bump(weapons.find((w) => w.id === aw.weaponId)?.tags);
  }
  for (const ap of activePassives) {
    bump(passives.find((p) => p.id === ap.passiveId)?.tags);
  }
  return counts;
}

export function computeActiveSynergies(
  activeWeapons: ActiveWeapon[],
  activePassives: ActivePassive[],
  weapons: WeaponData[],
  passives: PassiveData[],
  synergyDefs: SynergyData[]
): ActiveSynergy[] {
  const counts = countTags(activeWeapons, activePassives, weapons, passives);
  const out: ActiveSynergy[] = [];
  for (const def of synergyDefs) {
    const count = counts[def.tag] ?? 0;
    let best: { tier: number; bonus: StatBonus } | null = null;
    def.thresholds.forEach((th, i) => {
      if (count >= th.count) best = { tier: i + 1, bonus: th.bonus };
    });
    if (best !== null) {
      const b = best as { tier: number; bonus: StatBonus };
      out.push({
        synergyId: def.id,
        tag: def.tag,
        tier: b.tier,
        count,
        bonus: b.bonus,
      });
    }
  }
  return out;
}

/** Sum a stat across active synergies (for the WorldScene statBonus seam). */
export function synergyStatBonus(
  active: ActiveSynergy[],
  statType: string
): number {
  let total = 0;
  for (const s of active) {
    const v = (s.bonus as Record<string, number | undefined>)[statType];
    if (typeof v === "number") total += v;
  }
  return total;
}
