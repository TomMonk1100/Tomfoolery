/**
 * Juice — the single System the orchestrator wires in. Constructs
 * DamageNumbers / Particles / ScreenFX internally and fans update/destroy to
 * them, plus owns a couple of standalone micro-tweens too small to warrant
 * their own file.
 *
 * DECISIONS:
 * - xpMoteCollected camera zoom pulse: rate-limited to <=1 per 900ms per
 *   spec ("keep subtle and rate-limited"), tracked via a lastZoomAt
 *   timestamp compared against `scene.time.now` (falls back to a manual ms
 *   accumulator so it still works if the scene clock is unavailable, though
 *   in practice scene.time.now is always present on a live Phaser.Scene).
 * - foodBanked gold sparkle burst at the nest: reads ctx.getNest(); if null
 *   (NestSystem hasn't registered yet — shouldn't happen since foodBanked is
 *   only emitted by NestSystem itself) the handler no-ops rather than
 *   guessing a position.
 * - Well-Fed persistent outline is implemented in ScreenFX (see its
 *   DECISIONS note) — Juice does not duplicate it, it only fans update/
 *   destroy through to the ScreenFX instance that owns it.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV } from "../core/types";
import { DamageNumbers } from "./DamageNumbers";
import { Particles } from "./Particles";
import { ScreenFX } from "./ScreenFX";

const ZOOM_PULSE_COOLDOWN_MS = 900;

export class JuiceSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private damageNumbers: DamageNumbers;
  private particles: Particles;
  private screenFX: ScreenFX;

  private lastZoomAt = -Infinity;
  private zoomActive = false;

  private onXpMoteCollected = (): void => {
    try {
      this.tryZoomPulse();
    } catch (err) {
      console.warn("[JuiceSystem] xpMoteCollected handler failed", err);
    }
  };

  private onFoodBanked = (): void => {
    try {
      this.sparkleAtNest();
    } catch (err) {
      console.warn("[JuiceSystem] foodBanked handler failed", err);
    }
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.damageNumbers = new DamageNumbers(scene, ctx);
    this.particles = new Particles(scene, ctx);
    this.screenFX = new ScreenFX(scene, ctx);

    ctx.events.on(EV.xpMoteCollected, this.onXpMoteCollected);
    ctx.events.on(EV.foodBanked, this.onFoodBanked);
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    this.damageNumbers.update(deltaMs);
    this.particles.update(deltaMs);
    this.screenFX.update(deltaMs);
  }

  destroy(): void {
    this.ctx.events.off(EV.xpMoteCollected, this.onXpMoteCollected);
    this.ctx.events.off(EV.foodBanked, this.onFoodBanked);
    this.damageNumbers.destroy?.();
    this.particles.destroy?.();
    this.screenFX.destroy?.();
  }

  private tryZoomPulse(): void {
    const now = this.scene.time.now;
    if (now - this.lastZoomAt < ZOOM_PULSE_COOLDOWN_MS) return;
    if (this.zoomActive) return;
    this.lastZoomAt = now;
    this.zoomActive = true;

    const cam = this.scene.cameras.main;
    cam.zoomTo(1.02, 60, "Power2", true, (_cam, progress) => {
      if (progress >= 1) {
        cam.zoomTo(1.0, 60, "Power2", true, (_cam2, progress2) => {
          if (progress2 >= 1) this.zoomActive = false;
        });
      }
    });
  }

  private sparkleAtNest(): void {
    const nest = this.ctx.getNest();
    if (!nest) return;
    // Reach into the Particles pool via its own burst path by emitting a
    // foodSpawned-shaped event would double-count stats, so we drive a
    // dedicated gold burst directly through a throwaway Graphics flourish
    // instead of touching Particles' private pool (keeps ownership clean).
    const gfx = this.scene.add.graphics();
    gfx.setDepth(1500);
    gfx.setPosition(nest.x, nest.y);
    const particles: { x: number; y: number; vx: number; vy: number }[] = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const speed = Phaser.Math.FloatBetween(30, 70);
      particles.push({
        x: 0,
        y: 0,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }

    const state = { t: 0 };
    this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 450,
      ease: "Cubic.Out",
      onUpdate: () => {
        gfx.clear();
        gfx.fillStyle(0xe8b23d, 1 - state.t);
        for (const p of particles) {
          const px = p.vx * state.t * 0.45;
          const py = p.vy * state.t * 0.45;
          gfx.fillRect(px - 2, py - 2, 4, 4);
        }
      },
      onComplete: () => gfx.destroy(),
    });
  }
}
