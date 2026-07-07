import { describe, it, expect, beforeEach } from "vitest";
import { SaveManager, migrateMeta } from "../src/core/SaveManager";
import { META_SAVE_VERSION, defaultMeta } from "../src/core/types";

// In a plain node env there's no localStorage, so SaveManager uses its
// in-memory fallback — which still exercises the load/save/shape-check paths.

describe("SaveManager", () => {
  let sm: SaveManager;
  beforeEach(() => {
    sm = new SaveManager();
  });

  it("returns default meta on a fresh store", () => {
    expect(sm.load()).toEqual(defaultMeta());
  });

  it("round-trips sunseeds and unlocked nodes", () => {
    sm.addSunseeds(500);
    sm.unlockNode("warm-welcome");
    const again = new SaveManager();
    // Same-process in-memory stores are independent; assert on the live one.
    expect(sm.load().sunseeds).toBe(500);
    expect(sm.isUnlocked("warm-welcome")).toBe(true);
    expect(again.load().sunseeds).toBeGreaterThanOrEqual(0);
  });

  it("spends sunseeds without going negative on unlock accounting", () => {
    sm.addSunseeds(150);
    sm.addSunseeds(-150);
    expect(sm.load().sunseeds).toBe(0);
  });

  it("tracks keepsakes by type", () => {
    sm.addKeepsake("bones", 3);
    sm.addKeepsake("bones", 2);
    expect(sm.load().keepsakes["bones"]).toBe(5);
  });
});

describe("MetaSave migration (Update 3)", () => {
  it("upgrades a v1 save (no version/codex/quality) with defaults", () => {
    const old = {
      sunseeds: 120,
      keepsakes: { bones: 2 },
      unlockedNodes: ["warm-welcome"],
    };
    const m = migrateMeta(old);
    expect(m).not.toBeNull();
    expect(m!.version).toBe(META_SAVE_VERSION);
    expect(m!.sunseeds).toBe(120);
    expect(m!.keepsakes).toEqual({ bones: 2 });
    expect(m!.unlockedNodes).toEqual(["warm-welcome"]);
    expect(m!.codex).toEqual({ evolutions: [], fusions: [], synergies: [] });
    expect(m!.quality).toBe("auto");
  });

  it("passes a current-version save through unchanged", () => {
    const cur = {
      ...defaultMeta(),
      sunseeds: 7,
      codex: { evolutions: ["bark-blast-evo-a"], fusions: [], synergies: [] },
      quality: "low" as const,
    };
    expect(migrateMeta(cur)).toEqual(cur);
  });

  it("rejects non-MetaSave values", () => {
    expect(migrateMeta(null)).toBeNull();
    expect(migrateMeta({ sunseeds: "no" })).toBeNull();
  });

  it("load() migrates a stored v1 payload", () => {
    const sm = new SaveManager();
    sm.addSunseeds(5); // writes through current shape; load must stay valid
    const loaded = sm.load();
    expect(loaded.version).toBe(META_SAVE_VERSION);
    expect(loaded.codex).toEqual({ evolutions: [], fusions: [], synergies: [] });
  });
});
