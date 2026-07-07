/**
 * Update 3 Phase 2b — CodexSystem discovery writes. Phaser mocked (node env;
 * see tests/phasertest.test.ts note).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("phaser", () => ({ default: {} }));

import { CodexSystem } from "../src/systems/CodexSystem";
import type { GameContext } from "../src/core/context";
import { EV, PlayerState, makeRunStats } from "../src/core/types";

// Minimal in-memory SaveManager double — CodexSystem only calls
// recordCodexDiscovery, so a fake is more direct than importing the real
// (localStorage-backed) SaveManager here.
function makeFakeSaveManager() {
  const calls: [string, string][] = [];
  return {
    recordCodexDiscovery: (kind: string, id: string) => {
      calls.push([kind, id]);
    },
    calls,
  };
}

/** Minimal on/off/emit emitter matching Phaser.Events.EventEmitter's surface
 * (the only part CodexSystem touches): on(ev, fn, ctx), off(ev, fn, ctx),
 * emit(ev, payload). */
class FakeEmitter {
  private handlers = new Map<string, { fn: (...a: unknown[]) => void; ctx: unknown }[]>();
  on(ev: string, fn: (...a: unknown[]) => void, ctx?: unknown): void {
    if (!this.handlers.has(ev)) this.handlers.set(ev, []);
    this.handlers.get(ev)!.push({ fn, ctx });
  }
  off(ev: string, fn: (...a: unknown[]) => void, ctx?: unknown): void {
    const list = this.handlers.get(ev);
    if (!list) return;
    this.handlers.set(
      ev,
      list.filter((h) => !(h.fn === fn && h.ctx === ctx))
    );
  }
  emit(ev: string, payload?: unknown): void {
    for (const h of this.handlers.get(ev) ?? []) h.fn.call(h.ctx, payload);
  }
}

function makeCtx(player: Partial<PlayerState>) {
  const ctx = {
    events: new FakeEmitter(),
    player: {
      activeWeapons: [],
      activePassives: [],
      stats: makeRunStats(),
      ...player,
    },
  } as unknown as GameContext;
  return ctx;
}

describe("CodexSystem discovery writes", () => {
  it("records evolutionId on weaponUpgraded when evolved, reading it off the owned weapon", () => {
    const ctx = makeCtx({
      activeWeapons: [{ weaponId: "bark-blast", level: 5, evolved: true, evolutionId: "bark-blast-evo-a" }],
    });
    const sm = makeFakeSaveManager();
    new CodexSystem({} as never, ctx, sm as never);
    ctx.events.emit(EV.weaponUpgraded, { weaponId: "bark-blast", level: 5, evolved: true });
    expect(sm.calls).toEqual([["evolutions", "bark-blast-evo-a"]]);
  });

  it("ignores weaponUpgraded when not evolved (plain level-up)", () => {
    const ctx = makeCtx({
      activeWeapons: [{ weaponId: "bark-blast", level: 3, evolved: false }],
    });
    const sm = makeFakeSaveManager();
    new CodexSystem({} as never, ctx, sm as never);
    ctx.events.emit(EV.weaponUpgraded, { weaponId: "bark-blast", level: 3, evolved: false });
    expect(sm.calls).toEqual([]);
  });

  it("records fusionId on weaponFused", () => {
    const ctx = makeCtx({});
    const sm = makeFakeSaveManager();
    new CodexSystem({} as never, ctx, sm as never);
    ctx.events.emit(EV.weaponFused, {
      fusionId: "thunder-fetch",
      resultWeaponId: "thunder-fetch",
      inputs: ["bark-blast", "fetch"],
    });
    expect(sm.calls).toEqual([["fusions", "thunder-fetch"]]);
  });

  it("records every active synergyId on synergyChanged", () => {
    const ctx = makeCtx({});
    const sm = makeFakeSaveManager();
    new CodexSystem({} as never, ctx, sm as never);
    ctx.events.emit(EV.synergyChanged, [
      { synergyId: "syn-sonic", tag: "sonic", tier: 1, count: 2, bonus: {} },
      { synergyId: "syn-feral", tag: "feral", tier: 2, count: 3, bonus: {} },
    ]);
    expect(sm.calls).toEqual([
      ["synergies", "syn-sonic"],
      ["synergies", "syn-feral"],
    ]);
  });

  it("destroy() detaches listeners", () => {
    const ctx = makeCtx({});
    const sm = makeFakeSaveManager();
    const cs = new CodexSystem({} as never, ctx, sm as never);
    cs.destroy();
    ctx.events.emit(EV.weaponFused, { fusionId: "glowhive" });
    expect(sm.calls).toEqual([]);
  });
});
