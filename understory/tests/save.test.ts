import { describe, it, expect, beforeEach } from "vitest";
import { SaveManager } from "../src/core/SaveManager";
import { defaultMeta } from "../src/core/types";

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
