import { describe, it, expect } from "vitest";
import {
  normalizedShares,
  rawWeight,
  pickRarity,
} from "../src/core/rarityWeights";

describe("rarity weights", () => {
  it("matches the GDD draw table at L=1 (no luck)", () => {
    const s = normalizedShares(1, 0, false);
    expect(s.common * 100).toBeCloseTo(43.7, 0);
    expect(s.uncommon * 100).toBeCloseTo(30.1, 0);
    expect(s.rare * 100).toBeCloseTo(15.9, 0);
    expect(s.epic * 100).toBeCloseTo(7.5, 0);
    expect(s.legendary * 100).toBeCloseTo(2.8, 0);
    expect(s.mythic).toBe(0); // Unique gated below L=5
  });

  it("matches the GDD draw table at L=15 (no luck)", () => {
    const s = normalizedShares(15, 0, false);
    expect(s.common * 100).toBeCloseTo(21.8, 0);
    expect(s.rare * 100).toBeCloseTo(26.2, 0);
    expect(s.mythic * 100).toBeCloseTo(2.7, 0);
  });

  it("zeroes mythic (Unique) in Instinct Mode", () => {
    expect(rawWeight("mythic", 20, true)).toBe(0);
    const s = normalizedShares(20, 0, true);
    expect(s.mythic).toBe(0);
  });

  it("luck widens the good-stuff tail without touching common raw weight", () => {
    const noLuck = normalizedShares(15, 0, false);
    const luck = normalizedShares(15, 20, false);
    // rare share grows, common share shrinks (denominator grew)
    expect(luck.rare).toBeGreaterThan(noLuck.rare);
    expect(luck.common).toBeLessThan(noLuck.common);
  });

  it("pickRarity is deterministic given a fixed rng", () => {
    const r = pickRarity(1, 0, false, () => 0.0001);
    expect(r).toBe("common");
  });

  it("common never drops below floor of 10 raw", () => {
    expect(rawWeight("common", 30, false)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Update 3 (D9) — combo-aware weighting
// ---------------------------------------------------------------------------
import weaponsJsonD9 from "../src/data/weapons.json";
import passivesJsonD9 from "../src/data/passives.json";
import { comboWeightMultiplier, COMBO_WEIGHT_MULT } from "../src/core/rarityWeights";
import type { PassiveData as PD9, WeaponData as WD9 } from "../src/core/types";

const W9 = weaponsJsonD9 as unknown as WD9[];
const P9 = passivesJsonD9 as unknown as PD9[];

describe("comboWeightMultiplier (D9)", () => {
  const aw = (weaponId: string, level = 1, evolved = false) => ({ weaponId, level, evolved });
  const ap = (passiveId: string) => ({ passiveId, stacks: 1 });

  it("2x for a passive that gates an owned un-evolved weapon's branch", () => {
    // bark-blast branch A requires loyal-heart.
    expect(comboWeightMultiplier("loyal-heart", [aw("bark-blast")], [], W9, P9)).toBe(
      COMBO_WEIGHT_MULT
    );
    // Already evolved: no longer progress.
    // (loyal-heart is tagged pack; bark-blast is sonic — no tag overlap.)
    expect(
      comboWeightMultiplier("loyal-heart", [aw("bark-blast", 5, true)], [], W9, P9)
    ).toBe(1);
  });

  it("2x for a card sharing an owned synergy tag", () => {
    // echo-screech is sonic; bark-blast (owned) is sonic.
    expect(comboWeightMultiplier("echo-screech", [aw("bark-blast")], [], W9, P9)).toBe(
      COMBO_WEIGHT_MULT
    );
  });

  it("1x for unrelated cards; 2x for synthesized branch cards", () => {
    // yarn-whip is swift; owned bark-blast is sonic, no gate relation.
    expect(comboWeightMultiplier("yarn-whip", [aw("bark-blast")], [], W9, P9)).toBe(1);
    expect(
      comboWeightMultiplier("bark-blast::bark-blast-evo-a", [aw("bark-blast", 5)], [], W9, P9)
    ).toBe(COMBO_WEIGHT_MULT);
  });

  it("nothing owned: everything stays 1x", () => {
    expect(comboWeightMultiplier("bark-blast", [], [], W9, P9)).toBe(1);
    expect(comboWeightMultiplier("loyal-heart", [], [], W9, P9)).toBe(1);
  });
});
