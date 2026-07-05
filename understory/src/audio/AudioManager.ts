/**
 * AudioManager — raw Web Audio synthesis, no external assets. Implements
 * AudioLike (core/context.ts) so WorldScene/systems can call
 * ctx.audio.blip(...) etc. without knowing the underlying implementation.
 *
 * Designed to never throw: any AudioContext failure (unsupported browser,
 * autoplay policy, suspended context that can't resume, etc.) degrades to
 * silent no-ops rather than breaking gameplay.
 *
 * DECISIONS:
 * - Replaced the temporary SfxKind->BlipKind mapping shim with real
 *   per-kind synthesis (one private `play*` method per SfxKind). Every
 *   voice is built from oscillators/noise + a short gain envelope, all
 *   wrapped in the same top-level try/catch pattern as the original blip().
 * - Kept every voice SHORT (<=150ms, most well under) and mix-safe: peak
 *   gain per voice tops out ~0.16-0.22 (roughly -12dB-ish alongside the
 *   0.18 peak the original blip() used), so multiple overlapping hits
 *   don't clip.
 * - xpPickup fires constantly (every mote), so it is both the quietest
 *   voice (peak 0.06) and internally rate-limited to max 1 real playback
 *   per 60ms — extra calls within the window are silently dropped (still
 *   never throws, just a cheap no-op) so a mote-collection burst can't
 *   turn into a wall of clicks.
 * - `duck(ms)`: new public method per spec, halves ambient gain for `ms`
 *   then restores it. No call sites wired yet (optional/future — e.g.
 *   bossIntro/raidWarning could duck the ambient bed); implemented so
 *   callers can adopt it later without touching this file again. Uses
 *   setTargetAtTime for click-free ramps and is itself guarded so a
 *   missing ambient graph (never started) is just a no-op.
 * - Noise bursts are synthesized via a short-lived AudioBufferSourceNode
 *   fed random samples (no external assets allowed) through a highpass
 *   filter to keep them "burst"-flavored rather than full white-noise hiss.
 */
import { AudioLike } from "../core/context";
import { Season } from "../core/types";

import type { SfxKind } from "../core/context";

/** Base ambient filter cutoff (Hz) before per-season nudges. */
const AMBIENT_BASE_CUTOFF = 500;
const AMBIENT_BASE_GAIN = 0.05;

/** Per-season cutoff/detune nudges applied on top of the ambient base. */
const SEASON_MOOD: Record<Season, { cutoffHz: number; detuneCents: number }> = {
  spring: { cutoffHz: 650, detuneCents: 4 },
  summer: { cutoffHz: 750, detuneCents: 6 },
  autumn: { cutoffHz: 450, detuneCents: -4 },
  winter: { cutoffHz: 300, detuneCents: -10 },
};

/** Minimum gap (ms) between real xpPickup playbacks; extras are dropped. */
const XP_PICKUP_MIN_GAP_MS = 60;

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
  private ambientBaseGainValue = AMBIENT_BASE_GAIN;

  private currentSeason: Season = "spring";

  private lastXpPickupAt = -Infinity;

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

  // --------------------------------------------------------------------
  // Low-level synthesis helpers (shared by every voice below).
  // --------------------------------------------------------------------

  /** A single oscillator with an exponential attack/decay gain envelope. */
  private playTone(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      type: OscillatorType;
      freq: number;
      endFreq?: number;
      rampMs?: number;
      startAt?: number;
      durationMs: number;
      peakGain: number;
      attackMs?: number;
      detune?: number;
    }
  ): void {
    const now = ctx.currentTime + (opts.startAt ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(1, opts.freq), now);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, now);
    if (opts.endFreq !== undefined) {
      const rampEnd = now + (opts.rampMs ?? opts.durationMs) / 1000;
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, opts.endFreq),
        rampEnd
      );
    }

    const attack = Math.max(0.001, (opts.attackMs ?? 8) / 1000);
    const dur = opts.durationMs / 1000;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, opts.peakGain),
      now + attack
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(now);
    osc.stop(now + dur + 0.02);
  }

  /** Short filtered noise burst (buffer of random samples), for "tick"/thock texture. */
  private playNoiseBurst(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      durationMs: number;
      peakGain: number;
      filterType?: BiquadFilterType;
      filterFreq?: number;
      startAt?: number;
    }
  ): void {
    const now = ctx.currentTime + (opts.startAt ?? 0);
    const dur = opts.durationMs / 1000;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType ?? "highpass";
    filter.frequency.value = opts.filterFreq ?? 1500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.max(0.0002, opts.peakGain), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.start(now);
    src.stop(now + dur + 0.01);
  }

  /**
   * Short synthesized envelope blip, per-kind voice. Unknown kinds no-op
   * (AudioLike contract: never throw).
   */
  blip(sfx: SfxKind): void {
    try {
      const ctx = this.getContext();
      if (!ctx) return;
      const dest = ctx.destination;

      switch (sfx) {
        case "forage":
          this.playTone(ctx, dest, {
            type: "sine",
            freq: 660,
            durationMs: 220,
            peakGain: 0.18,
          });
          return;
        case "befriend":
          this.playTone(ctx, dest, {
            type: "sine",
            freq: 784,
            durationMs: 220,
            peakGain: 0.18,
          });
          return;
        case "nest":
          this.playTone(ctx, dest, {
            type: "sine",
            freq: 392,
            durationMs: 220,
            peakGain: 0.18,
          });
          return;
        case "evade":
          this.playTone(ctx, dest, {
            type: "sawtooth",
            freq: 220,
            durationMs: 220,
            peakGain: 0.18,
          });
          return;
        case "levelup":
          this.playLevelUp(ctx, dest);
          return;

        case "hit":
          this.playHit(ctx, dest);
          return;
        case "crit":
          this.playCrit(ctx, dest);
          return;
        case "enemyDeath":
          this.playEnemyDeath(ctx, dest);
          return;
        case "playerHurt":
          this.playPlayerHurt(ctx, dest);
          return;
        case "eat":
          this.playEat(ctx, dest);
          return;
        case "bark":
          this.playBark(ctx, dest);
          return;
        case "pounce":
          this.playPounce(ctx, dest);
          return;
        case "thump":
          this.playThump(ctx, dest);
          return;
        case "xpPickup":
          this.playXpPickup(ctx, dest);
          return;
        case "bossIntro":
          this.playBossIntro(ctx, dest);
          return;
        case "bossDown":
          this.playBossDown(ctx, dest);
          return;
        case "raidWarning":
          this.playRaidWarning(ctx, dest);
          return;
        case "evolve":
          this.playEvolve(ctx, dest);
          return;
        default:
          // Unknown SfxKind: no-op per AudioLike contract.
          return;
      }
    } catch {
      // degrade silently
    }
  }

  // --------------------------------------------------------------------
  // Per-kind voices.
  // --------------------------------------------------------------------

  /** Short square 220Hz thock, 40ms. */
  private playHit(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "square",
      freq: 220,
      durationMs: 40,
      attackMs: 3,
      peakGain: 0.16,
    });
  }

  /** Dual-osc 440+660 ping, 80ms. */
  private playCrit(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "triangle",
      freq: 440,
      durationMs: 80,
      attackMs: 3,
      peakGain: 0.16,
    });
    this.playTone(ctx, dest, {
      type: "triangle",
      freq: 660,
      durationMs: 80,
      attackMs: 3,
      peakGain: 0.13,
    });
  }

  /** Down-sweep sine 300->80Hz + tiny noise burst, 120ms. */
  private playEnemyDeath(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "sine",
      freq: 300,
      endFreq: 80,
      durationMs: 120,
      attackMs: 4,
      peakGain: 0.18,
    });
    this.playNoiseBurst(ctx, dest, {
      durationMs: 30,
      peakGain: 0.08,
      filterType: "highpass",
      filterFreq: 2000,
    });
  }

  /** Sawtooth 160Hz + pitch drop, 100ms. */
  private playPlayerHurt(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "sawtooth",
      freq: 160,
      endFreq: 100,
      durationMs: 100,
      attackMs: 2,
      peakGain: 0.19,
    });
  }

  /** Soft double pop 500/700Hz, 90ms total. */
  private playEat(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "sine",
      freq: 500,
      durationMs: 45,
      attackMs: 3,
      peakGain: 0.15,
    });
    this.playTone(ctx, dest, {
      type: "sine",
      freq: 700,
      durationMs: 45,
      attackMs: 3,
      peakGain: 0.15,
      startAt: 0.045,
    });
  }

  /** Two rapid square bursts 180Hz w/ noise, "ruff", 130ms. */
  private playBark(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "square",
      freq: 180,
      endFreq: 140,
      durationMs: 55,
      attackMs: 2,
      peakGain: 0.17,
    });
    this.playNoiseBurst(ctx, dest, {
      durationMs: 40,
      peakGain: 0.06,
      filterType: "bandpass",
      filterFreq: 1200,
    });
    this.playTone(ctx, dest, {
      type: "square",
      freq: 180,
      endFreq: 130,
      durationMs: 55,
      attackMs: 2,
      peakGain: 0.15,
      startAt: 0.06,
    });
    this.playNoiseBurst(ctx, dest, {
      durationMs: 35,
      peakGain: 0.05,
      filterType: "bandpass",
      filterFreq: 1200,
      startAt: 0.06,
    });
  }

  /** Fast up-sweep 200->600 sine, 70ms. */
  private playPounce(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "sine",
      freq: 200,
      endFreq: 600,
      durationMs: 70,
      attackMs: 3,
      peakGain: 0.17,
    });
  }

  /** Low sine 70Hz boom w/ fast decay + noise tick, 110ms. */
  private playThump(ctx: AudioContext, dest: AudioNode): void {
    this.playTone(ctx, dest, {
      type: "sine",
      freq: 70,
      durationMs: 110,
      attackMs: 2,
      peakGain: 0.2,
    });
    this.playNoiseBurst(ctx, dest, {
      durationMs: 15,
      peakGain: 0.07,
      filterType: "highpass",
      filterFreq: 2500,
    });
  }

  /**
   * Tiny sine ping 900Hz +/-80Hz random, 35ms, QUIET. Rate-limited to a
   * max of 1 real playback per XP_PICKUP_MIN_GAP_MS internally — this
   * fires constantly (once per XP mote) so bursts must not stack into a
   * wall of clicks. Extra calls inside the window are silent no-ops.
   */
  private playXpPickup(ctx: AudioContext, dest: AudioNode): void {
    const now = ctx.currentTime * 1000;
    if (now - this.lastXpPickupAt < XP_PICKUP_MIN_GAP_MS) return;
    this.lastXpPickupAt = now;

    const jitter = (Math.random() * 2 - 1) * 80;
    this.playTone(ctx, dest, {
      type: "sine",
      freq: 900 + jitter,
      durationMs: 35,
      attackMs: 2,
      peakGain: 0.06,
    });
  }

  /** Ominous minor triad swell 110/131/165Hz, 600ms. */
  private playBossIntro(ctx: AudioContext, dest: AudioNode): void {
    const freqs = [110, 131, 165];
    for (const f of freqs) {
      this.playTone(ctx, dest, {
        type: "sawtooth",
        freq: f,
        durationMs: 600,
        attackMs: 180,
        peakGain: 0.12,
      });
    }
  }

  /** Triumphant up-arpeggio 262/330/392/523, 450ms total. */
  private playBossDown(ctx: AudioContext, dest: AudioNode): void {
    const freqs = [262, 330, 392, 523];
    const step = 450 / freqs.length / 1000;
    freqs.forEach((f, i) => {
      this.playTone(ctx, dest, {
        type: "triangle",
        freq: f,
        durationMs: 160,
        attackMs: 4,
        peakGain: 0.17,
        startAt: i * step,
      });
    });
  }

  /** Alternating 440/554 alarm x3, 500ms total. */
  private playRaidWarning(ctx: AudioContext, dest: AudioNode): void {
    const pairFreqs = [440, 554];
    const beatMs = 500 / 6; // 3 repeats x 2 tones
    for (let i = 0; i < 6; i++) {
      this.playTone(ctx, dest, {
        type: "square",
        freq: pairFreqs[i % 2],
        durationMs: beatMs * 0.8,
        attackMs: 3,
        peakGain: 0.15,
        startAt: (i * beatMs) / 1000,
      });
    }
  }

  /** Rising shimmer: 3 sines 523/659/784 staggered, 400ms. */
  private playEvolve(ctx: AudioContext, dest: AudioNode): void {
    const freqs = [523, 659, 784];
    const stagger = 90;
    freqs.forEach((f, i) => {
      this.playTone(ctx, dest, {
        type: "sine",
        freq: f,
        endFreq: f * 1.25,
        durationMs: 400 - i * stagger,
        rampMs: 400 - i * stagger,
        attackMs: 20,
        peakGain: 0.13,
        startAt: (i * stagger) / 1000,
      });
    });
  }

  /** Legacy levelup, sweetened with a third sine above the original sweep. */
  private playLevelUp(ctx: AudioContext, dest: AudioNode): void {
    const base = 988;
    this.playTone(ctx, dest, {
      type: "sine",
      freq: base,
      endFreq: base * 1.5,
      durationMs: 220,
      rampMs: 180,
      attackMs: 15,
      peakGain: 0.18,
    });
    // Added third above (major third ~1.26x) for a sweeter chord.
    this.playTone(ctx, dest, {
      type: "sine",
      freq: base * 1.26,
      endFreq: base * 1.26 * 1.5,
      durationMs: 220,
      rampMs: 180,
      attackMs: 15,
      peakGain: 0.12,
    });
  }

  // --------------------------------------------------------------------
  // Ambient bed (unchanged from the pre-existing implementation).
  // --------------------------------------------------------------------

  /** Two detuned sines through a slow-LFO'd lowpass filter, low gain. */
  startAmbient(): void {
    if (this.ambientStarted) return;

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const gain = ctx.createGain();
      gain.gain.value = AMBIENT_BASE_GAIN;

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
      this.ambientBaseGainValue = AMBIENT_BASE_GAIN;

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

  /**
   * Drop ambient bed gain by 50% for `ms`, then restore it. New optional
   * hook (no call sites wired yet) so callers can duck the ambient bed
   * under big moments (boss intro, raid warning) later without touching
   * this file again. No-ops safely if ambient was never started.
   */
  duck(ms: number): void {
    try {
      const ctx = this.ctx;
      if (!ctx || !this.ambientGain || !this.ambientStarted) return;

      const now = ctx.currentTime;
      const duckedGain = this.ambientBaseGainValue * 0.5;
      this.ambientGain.gain.cancelScheduledValues(now);
      this.ambientGain.gain.setTargetAtTime(duckedGain, now, 0.05);
      this.ambientGain.gain.setTargetAtTime(
        this.ambientBaseGainValue,
        now + Math.max(0, ms) / 1000,
        0.2
      );
    } catch {
      // degrade silently
    }
  }
}
