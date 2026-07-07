/**
 * Rarity weight system — pure functions, no Phaser dependency, unit-tested.
 * Formulas per GDD §3. Level is clamped to [1, 30].
 */
import { Rarity, RARITY_ORDER } from "./types";

export function rawWeight(
  rarity: Rarity,
  level: number,
  instinctMode: boolean
): number {
  const L = Math.max(1, Math.min(30, level));
  switch (rarity) {
    case "common":
      return Math.max(45 - 1.5 * L, 10);
    case "uncommon":
      return 30;
    case "rare":
      return Math.min(15 + 0.8 * L, 30);
    case "epic":
      return Math.min(7 + 0.5 * L, 18);
    case "legendary":
      return Math.min(2.5 + 0.25 * L, 9);
    case "mythic": // "Unique" rarity tier in the GDD draw table
      if (L < 5 || instinctMode) return 0;
      return Math.min(0.5 + 0.15 * L, 5);
  }
}

/**
 * Full weight vector with Luck applied. Luck multiplies rare/epic/legendary/
 * mythic only, by (1 + luckPct/100). Returns a map rarity -> weight (unnormalized).
 */
export function weightVector(
  level: number,
  luckPct: number,
  instinctMode: boolean
): Record<Rarity, number> {
  const luckMult = 1 + luckPct / 100;
  const out = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) {
    let w = rawWeight(r, level, instinctMode);
    if (r === "rare" || r === "epic" || r === "legendary" || r === "mythic") {
      w *= luckMult;
    }
    out[r] = w;
  }
  return out;
}

/** Normalized percentage shares (0..1) for each rarity at a given state. */
export function normalizedShares(
  level: number,
  luckPct: number,
  instinctMode: boolean
): Record<Rarity, number> {
  const raw = weightVector(level, luckPct, instinctMode);
  const total = RARITY_ORDER.reduce((s, r) => s + raw[r], 0);
  const out = {} as Record<Rarity, number>;
  for (const r of RARITY_ORDER) out[r] = total > 0 ? raw[r] / total : 0;
  return out;
}

/** Pick a rarity given a random function (default Math.random). */
export function pickRarity(
  level: number,
  luckPct: number,
  instinctMode: boolean,
  rng: () => number = Math.random
): Rarity {
  const raw = weightVector(level, luckPct, instinctMode);
  const total = RARITY_ORDER.reduce((s, r) => s + raw[r], 0);
  let roll = rng() * total;
  for (const r of RARITY_ORDER) {
    roll -= raw[r];
    if (roll <= 0) return r;
  }
  return "common";
}

// ---------------------------------------------------------------------------
// Update 3 (D9) — combo-aware draft weighting. Cards that progress an owned
// weapon's evolution requirement or an owned synergy tag get 2x weight in
// DraftSystem.weightedPick. Pure + tested (antidote to draft-pool dilution,
// plan §8 R1). Phase 4's kill criterion may raise COMBO_WEIGHT_MULT.
// ---------------------------------------------------------------------------
import type {
  ActivePassive,
  ActiveWeapon,
  PassiveData,
  WeaponData,
} from "./types";

export const COMBO_WEIGHT_MULT = 2;

export function comboWeightMultiplier(
  cardId: string,
  activeWeapons: ActiveWeapon[],
  activePassives: ActivePassive[],
  weapons: WeaponData[],
  passives: PassiveData[]
): number {
  // Synthesized evolution-branch cards ARE combo progress by definition.
  if (cardId.includes("::")) return COMBO_WEIGHT_MULT;

  // A passive that gates an owned, un-evolved weapon's evolution branch.
  const passive = passives.find((p) => p.id === cardId);
  if (passive) {
    const gatesOwned = activeWeapons.some((aw) => {
      if (aw.evolved) return false;
      const data = weapons.find((w) => w.id === aw.weaponId);
      return !!data?.evolutions.some((e) => e.requiresPassiveId === cardId);
    });
    if (gatesOwned) return COMBO_WEIGHT_MULT;
  }

  // Any card whose tags overlap a tag the player already owns an item of.
  const ownedTags = new Set<string>();
  for (const aw of activeWeapons) {
    for (const t of weapons.find((w) => w.id === aw.weaponId)?.tags ?? []) {
      ownedTags.add(t);
    }
  }
  for (const ap of activePassives) {
    for (const t of passives.find((p) => p.id === ap.passiveId)?.tags ?? []) {
      ownedTags.add(t);
    }
  }
  const cardTags =
    weapons.find((w) => w.id === cardId)?.tags ??
    passives.find((p) => p.id === cardId)?.tags ??
    [];
  if (cardTags.some((t) => ownedTags.has(t))) return COMBO_WEIGHT_MULT;

  return 1;
}
