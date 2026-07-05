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
