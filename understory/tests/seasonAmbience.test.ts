/**
 * Update 3 Phase 3.3 — SeasonAmbience content checks. The system itself is
 * Phaser-heavy (tweens/GameObjects) with no pure-logic seam worth extracting
 * for this cosmetic feature, so this covers the data tables that drive it
 * (all four seasons present, glow only on summer, sane color/velocity
 * ranges) without instantiating Phaser.
 */
import { describe, it, expect, vi } from "vitest";

// SeasonAmbience.ts imports Phaser (for its class body) and Quality.ts
// (which also imports Phaser) at module scope; neither is instantiated by
// this content-only test, but the import still runs Phaser's real entry
// file under node, which throws (see tests/phasertest.test.ts). Mock both.
vi.mock("phaser", () => ({ default: {} }));
vi.mock("../src/core/Quality", () => ({ Quality: { current: { particleScale: 1 } } }));

import { SEASON_TINT, SEASON_LOOK, TINT_ALPHA } from "../src/systems/SeasonAmbience";
import { SEASON_ORDER } from "../src/core/types";

describe("SeasonAmbience data tables", () => {
  it("defines a tint and a look for all four seasons", () => {
    for (const season of SEASON_ORDER) {
      expect(SEASON_TINT[season], season).toBeTypeOf("number");
      expect(SEASON_LOOK[season], season).toBeDefined();
    }
  });

  it("only summer glows (plan §6.3(b): 'only these glow')", () => {
    expect(SEASON_LOOK.summer.glow).toBe(true);
    expect(SEASON_LOOK.spring.glow).toBe(false);
    expect(SEASON_LOOK.autumn.glow).toBe(false);
    expect(SEASON_LOOK.winter.glow).toBe(false);
  });

  it("velocity/size ranges are well-formed (min <= max, positive size)", () => {
    for (const season of SEASON_ORDER) {
      const look = SEASON_LOOK[season];
      expect(look.vx[0], season).toBeLessThanOrEqual(look.vx[1]);
      expect(look.vy[0], season).toBeLessThanOrEqual(look.vy[1]);
      expect(look.size[0], season).toBeGreaterThan(0);
      expect(look.size[0], season).toBeLessThanOrEqual(look.size[1]);
    }
  });

  it("tint alpha stays subtle (plan §6.3(a): alpha 0.12)", () => {
    expect(TINT_ALPHA).toBe(0.12);
  });
});
