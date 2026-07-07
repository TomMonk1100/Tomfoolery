/**
 * Update 3 — Quality tiers (D10). Detected once per boot: WebGL renderer AND
 * a 3-second fps probe averaging >= 45 fps => "high", else "low". An explicit
 * MetaSave.quality of "high"/"low" overrides the probe; "auto" uses it.
 *
 * Low tier: postFX disabled, particle budgets halved. Consumers read
 * Quality.current at effect-spawn time (never cache at construction) so a
 * mid-session toggle takes effect immediately.
 *
 * Pure logic lives in qualitySim.ts (Phaser-free, vitest-covered).
 */
import Phaser from "phaser";
import { QualityPref } from "./types";
import {
  QualitySettings,
  PROBE_DURATION_MS,
  PROBE_FPS_THRESHOLD,
  resolveTier,
  settingsForTier,
} from "./qualitySim";

export { ENABLE_POSTFX } from "./qualitySim";
export type { QualitySettings } from "./qualitySim";

// Module-level singleton state. Conservative ("low") until the probe lands.
let probedHigh = false;
let currentPref: QualityPref = "auto";
let current: QualitySettings = settingsForTier("low");

export const Quality = {
  get current(): QualitySettings {
    return current;
  },
  /** Apply a (possibly new) preference against the last probe result. */
  setPref(pref: QualityPref): void {
    currentPref = pref;
    current = settingsForTier(resolveTier(pref, probedHigh));
  },
};

/**
 * Run the one-per-boot detection. Always applies `pref` immediately; if the
 * renderer is WebGL it additionally probes fps for 3s and re-resolves (which
 * only changes anything when the pref is "auto").
 */
export function startQualityProbe(
  game: Phaser.Game,
  pref: QualityPref | undefined
): void {
  Quality.setPref(pref ?? "auto");
  if (game.renderer.type !== Phaser.WEBGL) {
    probedHigh = false;
    Quality.setPref(currentPref);
    return;
  }
  let frames = 0;
  const start = performance.now();
  const onStep = (): void => {
    frames += 1;
    const elapsed = performance.now() - start;
    if (elapsed >= PROBE_DURATION_MS) {
      game.events.off(Phaser.Core.Events.STEP, onStep);
      probedHigh = (frames * 1000) / elapsed >= PROBE_FPS_THRESHOLD;
      Quality.setPref(currentPref);
    }
  };
  game.events.on(Phaser.Core.Events.STEP, onStep);
}
