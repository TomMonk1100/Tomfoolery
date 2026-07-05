/**
 * AudioManager — raw Web Audio synthesis, no external assets. Implements
 * AudioLike (core/context.ts) so WorldScene/systems can call
 * ctx.audio.blip(...) etc. without knowing the underlying implementation.
 *
 * Designed to never throw: any AudioContext failure (unsupported browser,
 * autoplay policy, suspended context that can't resume, etc.) degrades to
 * silent no-ops rather than breaking gameplay.
 */
import { AudioLike } from "../core/context";
import { Season } from "../core/types";

import type { SfxKind } from "../core/context";

type BlipKind = "forage" | "befriend" | "nest" | "evade" | "levelup";

function isLegacyBlip(kind: SfxKind): kind is BlipKind {
  return (
    kind === "forage" ||
    kind === "befriend" ||
    kind === "nest" ||
    kind === "evade" ||
    kind === "levelup"
  );
}

const BLIP_FREQ: Record<BlipKind, number> = {
  forage: 660,
  befriend: 784,
  nest: 392,
  evade: 220,
  levelup: 988,
};

/** Base ambient filter cutoff (Hz) before per-season nudges. */
const AMBIENT_BASE_CUTOFF = 500;

/** Per-season cutoff/detune nudges applied on top of the ambient base. */
const SEASON_MOOD: Record<Season, { cutoffHz: number; detuneCents: number }> = {
  spring: { cutoffHz: 650, detuneCents: 4 },
  summer: { cutoffHz: 750, detuneCents: 6 },
  autumn: { cutoffHz: 450, detuneCents: -4 },
  winter: { cutoffHz: 300, detuneCents: -10 },
};

export class AudioManager implements AudioLike {
  private ctx: AudioContext | null = null;
  private ctxCreationFailed = false;

  // Ambient bed nodes (created lazily by startAmbient()).
  private ambientOscA: OscillatorNode | null = null;
  private ambientOscB: OscillatorNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private ambientStarted = false;

  private currentSeason: Season = "spring";

  /** Lazily create (or return existing) AudioContext; null if unavailable. */
  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (this.ctxCreationFailed) return null;

    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) {
        this.ctxCreationFailed = true;
        return null;
      }
      this.ctx = new Ctor();
      return this.ctx;
    } catch {
      this.ctxCreationFailed = true;
      return null;
    }
  }

  /** Resume a suspended context; call this on the first user gesture. */
  resume(): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => {
          /* ignore — nothing we can do if resume is rejected */
        });
      }
    } catch {
      // no-op: never let audio unlock crash the caller
    }
  }

  /**
   * Short synthesized envelope blip, pitched per kind.
   * Combat SfxKinds are stubbed to the nearest legacy sound until Worker G's
   * pass; unknown kinds no-op (AudioLike contract: never throw).
   */
  blip(sfx: SfxKind): void {
    const kind: BlipKind = isLegacyBlip(sfx)
      ? sfx
      : sfx === "bossDown" || sfx === "evolve"
        ? "levelup"
        : sfx === "eat" || sfx === "xpPickup"
          ? "forage"
          : sfx === "playerHurt" || sfx === "raidWarning"
            ? "evade"
            : "nest";
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = kind === "evade" ? "sawtooth" : "sine";
      osc.frequency.setValueAtTime(BLIP_FREQ[kind], now);
      if (kind === "levelup") {
        // Small upward pitch sweep to sell the "level up" feeling.
        osc.frequency.exponentialRampToValueAtTime(
          BLIP_FREQ[kind] * 1.5,
          now + 0.18
        );
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      // degrade silently
    }
  }

  /** Two detuned sines through a slow-LFO'd lowpass filter, low gain. */
  startAmbient(): void {
    if (this.ambientStarted) return;

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const gain = ctx.createGain();
      gain.gain.value = 0.05;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = AMBIENT_BASE_CUTOFF;
      filter.Q.value = 0.7;

      const oscA = ctx.createOscillator();
      oscA.type = "sine";
      oscA.frequency.value = 110;

      const oscB = ctx.createOscillator();
      oscB.type = "sine";
      oscB.frequency.value = 110;
      oscB.detune.value = 6;

      // Slow LFO modulating filter cutoff for a gentle "breathing" texture.
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      oscA.start();
      oscB.start();
      lfo.start();

      this.ambientOscA = oscA;
      this.ambientOscB = oscB;
      this.ambientFilter = filter;
      this.ambientGain = gain;
      this.lfo = lfo;
      this.lfoGain = lfoGain;
      this.ambientStarted = true;

      // Apply mood for whatever season is already current.
      this.setSeasonMood(this.currentSeason);
    } catch {
      // degrade silently — ambient bed simply never starts
    }
  }

  /** Nudge filter cutoff / oscillator detune per season. */
  setSeasonMood(season: Season): void {
    this.currentSeason = season;
    if (!this.ambientStarted) return;

    try {
      const ctx = this.ctx;
      if (!ctx || !this.ambientFilter || !this.ambientOscB) return;

      const mood = SEASON_MOOD[season];
      const now = ctx.currentTime;

      this.ambientFilter.frequency.cancelScheduledValues(now);
      this.ambientFilter.frequency.setTargetAtTime(mood.cutoffHz, now, 1.5);

      this.ambientOscB.detune.cancelScheduledValues(now);
      this.ambientOscB.detune.setTargetAtTime(mood.detuneCents, now, 1.5);
    } catch {
      // degrade silently
    }
  }
}
