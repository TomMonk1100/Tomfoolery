import { describe, it, expect } from "vitest";
import {
  createPlayerState,
  applyCard,
  statBonus,
} from "../src/core/playerState";
import { CardData } from "../src/core/types";

const clover: CardData = {
  id: "clover-tuft",
  name: "Clover Tuft",
  rarity: "common",
  isUnique: false,
  weightsByLevel: { "1": 45 },
  effect: { type: "forageYield", magnitude: 10 },
  tradeoff: { type: "moveSpeed", magnitude: -3 },
  spriteSlot: "paws",
  stacking: true,
};
const foxfire: CardData = {
  id: "foxfire-luckwisp",
  name: "Foxfire Luckwisp",
  rarity: "rare",
  isUnique: false,
  weightsByLevel: { "1": 15 },
  effect: { type: "luck", magnitude: 26 },
  tradeoff: { type: "forageSpeed", magnitude: -6 },
  spriteSlot: "aura",
  stacking: true,
};

describe("playerState", () => {
  it("stacks stacking cards and counts drafts", () => {
    const p = createPlayerState("dog");
    applyCard(p, clover);
    applyCard(p, clover);
    expect(p.activeCards).toHaveLength(1);
    expect(p.activeCards[0].stacks).toBe(2);
    expect(p.stats.cardsDrafted).toBe(2);
  });

  it("computes net stat bonus scaled by stacks", () => {
    const p = createPlayerState("dog");
    applyCard(p, clover);
    applyCard(p, clover);
    expect(statBonus(p, [clover], "forageYield")).toBe(20);
    expect(statBonus(p, [clover], "moveSpeed")).toBe(-6);
  });

  it("accumulates luck from luck cards", () => {
    const p = createPlayerState("dog");
    applyCard(p, foxfire);
    expect(p.luck).toBe(26);
  });

  it("seeds a perCardStats entry on draft", () => {
    const p = createPlayerState("dog");
    applyCard(p, clover);
    expect(p.stats.perCardStats["clover-tuft"]).toEqual({
      valueDelivered: 0,
      costIncurred: 0,
    });
  });
});
