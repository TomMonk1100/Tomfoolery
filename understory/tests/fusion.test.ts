/**
 * Update 3 Phase 1c — fusion draft mechanics (D3/D4/D5) with the real JSON
 * catalogs. Phaser is mocked (node env; see tests/phasertest.test.ts).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({
  default: {
    Events: {
      EventEmitter: class {
        on(): void {}
        off(): void {}
        emit(): void {}
      },
    },
    Math: {
      Between: (a: number, _b: number): number => a,
      Clamp: (v: number, lo: number, hi: number): number =>
        v < lo ? lo : v > hi ? hi : v,
    },
  },
}));

import { DraftSystem } from "../src/systems/DraftSystem";
import type { GameContext } from "../src/core/context";
import weaponsJson from "../src/data/weapons.json";
import passivesJson from "../src/data/passives.json";
import fusionsJson from "../src/data/fusions.json";
import cardsJson from "../src/data/cards.json";
import {
  CardData,
  FusionData,
  PassiveData,
  PlayerState,
  WeaponData,
  makeRunStats,
} from "../src/core/types";

const weapons = weaponsJson as unknown as WeaponData[];
const passives = passivesJson as unknown as PassiveData[];
const fusions = fusionsJson as unknown as FusionData[];
const cards = cardsJson as unknown as CardData[];

function makeCtx(player: Partial<PlayerState>): GameContext {
  const emitted: { name: string; payload: unknown }[] = [];
  const p: Partial<PlayerState> = {
    animalId: "dog",
    activeWeapons: [],
    activePassives: [],
    activeCards: [],
    instinctMode: false,
    luck: 0,
    stats: makeRunStats(),
    ...player,
  };
  const ctx = {
    events: {
      on(): void {},
      off(): void {},
      emit(name: string, payload?: unknown): void {
        emitted.push({ name, payload });
      },
    },
    player: p,
    weapons,
    passives,
    cards,
    fusions,
    synergyDefs: [],
    audio: { blip(): void {} },
  } as unknown as GameContext;
  (ctx as unknown as { __emitted: typeof emitted }).__emitted = emitted;
  return ctx;
}

const emittedOf = (ctx: GameContext): { name: string; payload: unknown }[] =>
  (ctx as unknown as { __emitted: { name: string; payload: unknown }[] }).__emitted;

const maxed = (weaponId: string, evolved = false) => {
  const data = weapons.find((w) => w.id === weaponId)!;
  return { weaponId, level: data.levels.length, evolved };
};

describe("fusion offer injection (D3)", () => {
  it("both inputs at max level -> guaranteed fusion card PREPENDED, styled mythic", () => {
    const ctx = makeCtx({
      activeWeapons: [maxed("bark-blast"), maxed("fetch")],
    });
    const ds = new DraftSystem({} as never, ctx);
    const offer = ds.buildOffer(8);
    expect(offer[0].id).toBe("fuse::thunder-fetch");
    expect(offer[0].rarity).toBe("mythic");
    expect(offer.filter((c) => c.id.startsWith("fuse::"))).toHaveLength(1);
  });

  it("evolved inputs count as max level", () => {
    const ctx = makeCtx({
      activeWeapons: [maxed("bark-blast", true), maxed("fetch", true)],
    });
    const ds = new DraftSystem({} as never, ctx);
    expect(ds.buildOffer(8)[0].id).toBe("fuse::thunder-fetch");
  });

  it("no fusion card when an input is below max or result already owned", () => {
    const below = makeCtx({
      activeWeapons: [maxed("bark-blast"), { weaponId: "fetch", level: 3, evolved: false }],
    });
    expect(
      new DraftSystem({} as never, below)
        .buildOffer(8)
        .some((c) => c.id.startsWith("fuse::"))
    ).toBe(false);

    const ownedResult = makeCtx({
      activeWeapons: [
        maxed("bark-blast"),
        maxed("fetch"),
        { weaponId: "thunder-fetch", level: 1, evolved: false },
      ],
    });
    expect(
      new DraftSystem({} as never, ownedResult)
        .buildOffer(8)
        .some((c) => c.id.startsWith("fuse::"))
    ).toBe(false);
  });

  it("fusion-only weapons are never acquirable through the normal draft", () => {
    const ctx = makeCtx({ activeWeapons: [] });
    const ds = new DraftSystem({} as never, ctx);
    const card = cards.find((c) => c.id === "thunder-fetch")!;
    expect(
      (ds as unknown as { isDraftable(c: CardData): boolean }).isDraftable(card)
    ).toBe(false);
  });

  it("owned fused weapons level up through the normal draft path", () => {
    const ctx = makeCtx({
      activeWeapons: [{ weaponId: "thunder-fetch", level: 1, evolved: false }],
    });
    const ds = new DraftSystem({} as never, ctx);
    const card = cards.find((c) => c.id === "thunder-fetch")!;
    expect(
      (ds as unknown as { isDraftable(c: CardData): boolean }).isDraftable(card)
    ).toBe(true);
    // at max (3): empty evolutions must not crash and must not be draftable
    ctx.player.activeWeapons[0].level = 3;
    expect(
      (ds as unknown as { isDraftable(c: CardData): boolean }).isDraftable(card)
    ).toBe(false);
  });
});

describe("fusion apply (consume inputs, free a slot)", () => {
  it("removes both inputs in place, grants fused L1, emits weaponFused", () => {
    const ctx = makeCtx({
      activeWeapons: [maxed("bark-blast"), maxed("fetch"), maxed("dig")],
    });
    const arrRef = ctx.player.activeWeapons;
    const ds = new DraftSystem({} as never, ctx);
    (ds as unknown as { applyWeaponOrPassive(id: string): void }).applyWeaponOrPassive(
      "fuse::thunder-fetch"
    );
    expect(ctx.player.activeWeapons).toBe(arrRef); // in-place (systems hold refs)
    const ids = arrRef.map((w) => w.weaponId);
    expect(ids).toEqual(["dig", "thunder-fetch"]);
    expect(arrRef.find((w) => w.weaponId === "thunder-fetch")).toMatchObject({
      level: 1,
      evolved: false,
    });
    const fusedEv = emittedOf(ctx).find((e) => e.name === "weaponFused");
    expect(fusedEv?.payload).toMatchObject({
      fusionId: "thunder-fetch",
      resultWeaponId: "thunder-fetch",
      inputs: ["bark-blast", "fetch"],
    });
    // 3 slots -> 2 used: fusion freed one
    expect(arrRef).toHaveLength(2);
  });

  it("is idempotent-safe: unknown or unsatisfied fusion ids do nothing", () => {
    const ctx = makeCtx({ activeWeapons: [maxed("bark-blast")] });
    const ds = new DraftSystem({} as never, ctx);
    const apply = (id: string): void =>
      (ds as unknown as { applyWeaponOrPassive(id: string): void }).applyWeaponOrPassive(id);
    apply("fuse::not-real");
    apply("fuse::thunder-fetch"); // fetch not owned
    expect(ctx.player.activeWeapons.map((w) => w.weaponId)).toEqual(["bark-blast"]);
  });
});

describe("Gate 1 sanity — fusion reachable via scripted draft sequence", () => {
  it("a bot that force-picks toward thunder-fetch reaches it and the offer fuses", () => {
    const ctx = makeCtx({ activeWeapons: [] });
    const ds = new DraftSystem({} as never, ctx);
    const apply = (id: string): void =>
      (ds as unknown as { applyWeaponOrPassive(id: string): void }).applyWeaponOrPassive(id);
    // Acquire + max both inputs through the normal apply path.
    for (let i = 0; i < 5; i++) apply("bark-blast");
    for (let i = 0; i < 5; i++) apply("fetch");
    const offer = ds.buildOffer(10);
    expect(offer[0].id).toBe("fuse::thunder-fetch");
    apply(offer[0].id);
    expect(ctx.player.activeWeapons.map((w) => w.weaponId)).toEqual(["thunder-fetch"]);
  });
});
