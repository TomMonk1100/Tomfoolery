/**
 * Gate 0 (Update 3) — DraftSystem evolution eligibility against the new
 * `evolutions[]` array schema. Written before Phase 1's branching/fusion
 * changes land (R7: the eligibility matrix test precedes fusions).
 */
import { describe, it, expect, vi } from "vitest";

// Phaser needs DOM globals unavailable in vitest's node env (see
// tests/phasertest.test.ts) — mock the small surface DraftSystem touches.
vi.mock("phaser", () => ({
  default: {
    Events: {
      EventEmitter: class {
        on(): void {}
        off(): void {}
        emit(): void {}
      },
    },
  },
}));

import { DraftSystem } from "../src/systems/DraftSystem";
import type { GameContext } from "../src/core/context";
import {
  CardData,
  WeaponData,
  WeaponEvolution,
  PlayerState,
  makeRunStats,
} from "../src/core/types";

const LEVELS = Array.from({ length: 5 }, (_, i) => ({
  damage: 10 + i * 5,
  cooldownMs: 1000,
  area: 60,
}));

function evo(id: string, requiresPassiveId: string): WeaponEvolution {
  return {
    id,
    name: id,
    requiresPassiveId,
    stats: { damage: 100, cooldownMs: 800, area: 90 },
    description: "",
  };
}

function weapon(id: string, evolutions: WeaponEvolution[]): WeaponData {
  return {
    id,
    name: id,
    animal: "dog",
    archetype: "aoe-pulse",
    isStarting: false,
    rarity: "common",
    levels: LEVELS,
    evolutions,
    description: "",
    icon: `icon_${id.replace(/-/g, "_")}`,
  } as WeaponData;
}

function card(id: string): CardData {
  return { id } as CardData;
}

function makeCtx(weapons: WeaponData[], player: Partial<PlayerState>): GameContext {
  const p: Partial<PlayerState> = {
    animalId: "dog",
    activeWeapons: [],
    activePassives: [],
    activeCards: [],
    instinctMode: false,
    stats: makeRunStats(),
    ...player,
  };
  return {
    events: { on(): void {}, off(): void {}, emit(): void {} },
    player: p,
    weapons,
    passives: [],
    cards: [],
    fusions: [],
    synergyDefs: [],
  } as unknown as GameContext;
}

function isDraftable(ctx: GameContext, c: CardData): boolean {
  const ds = new DraftSystem({} as never, ctx);
  // Private method; Gate 0 tests the eligibility seam directly.
  return (ds as unknown as { isDraftable(c: CardData): boolean }).isDraftable(c);
}

describe("DraftSystem evolution eligibility (evolutions[] schema)", () => {
  const singlePath = weapon("bark-blast", [evo("bark-blast-evo-a", "loyal-heart")]);
  const dualPath = weapon("zoomies", [
    evo("zoomies-evo-a", "spring-legs"),
    evo("zoomies-evo-b", "thick-fur"),
  ]);
  const maxed = (weaponId: string, evolved = false) => ({
    weaponId,
    level: 5,
    evolved,
  });

  it("0 branches satisfied: max-level weapon is not draftable", () => {
    const ctx = makeCtx([singlePath], { activeWeapons: [maxed("bark-blast")] });
    expect(isDraftable(ctx, card("bark-blast"))).toBe(false);
  });

  it("1 branch satisfied: single-path evolution still triggers", () => {
    const ctx = makeCtx([singlePath], {
      activeWeapons: [maxed("bark-blast")],
      activePassives: [{ passiveId: "loyal-heart", stacks: 1 }],
    });
    expect(isDraftable(ctx, card("bark-blast"))).toBe(true);
  });

  it("second branch satisfied: any-branch match makes it draftable", () => {
    const ctx = makeCtx([dualPath], {
      activeWeapons: [maxed("zoomies")],
      activePassives: [{ passiveId: "thick-fur", stacks: 1 }],
    });
    expect(isDraftable(ctx, card("zoomies"))).toBe(true);
  });

  it("both branches satisfied: draftable", () => {
    const ctx = makeCtx([dualPath], {
      activeWeapons: [maxed("zoomies")],
      activePassives: [
        { passiveId: "spring-legs", stacks: 1 },
        { passiveId: "thick-fur", stacks: 1 },
      ],
    });
    expect(isDraftable(ctx, card("zoomies"))).toBe(true);
  });

  it("already evolved: never draftable again", () => {
    const ctx = makeCtx([singlePath], {
      activeWeapons: [maxed("bark-blast", true)],
      activePassives: [{ passiveId: "loyal-heart", stacks: 1 }],
    });
    expect(isDraftable(ctx, card("bark-blast"))).toBe(false);
  });

  it("empty evolutions[] (fusion-only shape) does not crash and is not draftable at max", () => {
    const fused = weapon("thunder-fetch", []);
    fused.fusionOnly = true;
    const ctx = makeCtx([fused], { activeWeapons: [maxed("thunder-fetch")] });
    expect(isDraftable(ctx, card("thunder-fetch"))).toBe(false);
  });

  it("below max level: still draftable as a normal upgrade", () => {
    const ctx = makeCtx([singlePath], {
      activeWeapons: [{ weaponId: "bark-blast", level: 3, evolved: false }],
    });
    expect(isDraftable(ctx, card("bark-blast"))).toBe(true);
  });
});
