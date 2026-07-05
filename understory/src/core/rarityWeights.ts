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
