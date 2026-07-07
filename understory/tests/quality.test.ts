import { describe, it, expect } from "vitest";
import {
  settingsForTier,
  resolveTier,
  ENABLE_POSTFX,
} from "../src/core/qualitySim";

describe("Quality tiers (Update 3, D10)", () => {
  it("high tier enables postFX (behind the kill-switch) and full particles", () => {
    const s = settingsForTier("high");
    expect(s.tier).toBe("high");
    expect(s.postFX).toBe(ENABLE_POSTFX);
    expect(s.particleScale).toBe(1);
  });

  it("low tier disables postFX and halves particle budgets", () => {
    const s = settingsForTier("low");
    expect(s.postFX).toBe(false);
    expect(s.particleScale).toBe(0.5);
  });

  it("explicit pref overrides the probe result", () => {
    expect(resolveTier("high", false)).toBe("high");
    expect(resolveTier("low", true)).toBe("low");
  });

  it("auto (or missing) pref follows the probe", () => {
    expect(resolveTier("auto", true)).toBe("high");
    expect(resolveTier("auto", false)).toBe("low");
    expect(resolveTier(undefined, true)).toBe("high");
    expect(resolveTier(undefined, false)).toBe("low");
  });
});
