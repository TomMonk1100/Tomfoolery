/**
 * Update 3 — Quality tier pure logic (D10), Phaser-free so it's testable
 * under vitest's node environment (see tests/phasertest.test.ts note).
 * The Phaser-dependent boot probe lives in Quality.ts.
 */
import { QualityPref } from "./types";

export interface QualitySettings {
  tier: "high" | "low";
  /** Whether bloom/vignette postFX may be added (Phase 3). */
  postFX: boolean;
  /** Multiplier applied to particle budgets. */
  particleScale: 1 | 0.5;
}

/** Phase 3 kill-switch: flip to false to ship without postFX entirely. */
export const ENABLE_POSTFX = true;

export const PROBE_DURATION_MS = 3000;
export const PROBE_FPS_THRESHOLD = 45;

/** Pure: settings implied by a tier. */
export function settingsForTier(tier: "high" | "low"): QualitySettings {
  return {
    tier,
    postFX: tier === "high" && ENABLE_POSTFX,
    particleScale: tier === "high" ? 1 : 0.5,
  };
}

/** Pure: resolve the effective tier from a preference + probe outcome. */
export function resolveTier(
  pref: QualityPref | undefined,
  probedHigh: boolean
): "high" | "low" {
  if (pref === "high") return "high";
  if (pref === "low") return "low";
  return probedHigh ? "high" : "low";
}
