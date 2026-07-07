/**
 * Update 3 Phase 3.3 — SeasonAmbience: a fullscreen multiply-blend tint
 * (crossfaded 2s on season change) plus a small drifting ambient-particle
 * population, both driven off `ctx.season()`. Self-contained (new file,
 * screen-space/scrollFactor(0)) so it doesn't touch the existing pooled
 * Particles/EnemySystem code — see docs/update-3-deviations.md for why
 * ambience was kept separate from the combat particle pool.
 *
 * Budget: `12 * Quality.current.particleScale` ambient particles on screen
 * at once (plan §6.3), fully pooled (respawned in place, never
 * created/destroyed after boot).
 *
 * Only summer's fireflies glow (alpha-pulse); the other three seasons drift
 * at a constant alpha, per plan §6.3(b).
 */
import Phaser from "phaser";
import { GameContext, System } from "../core/context";
import { EV, Season } from "../core/types";
import { Quality } from "../core/Quality";

export const SEASON_TINT: Record<Season, number> = {
  spring: 0xf2fff2,
  summer: 0xfff8e8,
  autumn: 0xffe8d0,
  winter: 0xe8f0ff,
};
export const TINT_ALPHA = 0.12;
const TINT_FADE_MS = 2000;

export interface SeasonLook {
  color: number;
  /** Per-second drift velocity in screen px. */
  vx: [number, number]; // range
  vy: [number, number];
  size: [number, number];
  glow: boolean;
}

/** Only summer glows (fireflies) -- plan §6.3(b). */
export const SEASON_LOOK: Record<Season, SeasonLook> = {
  spring: { color: 0xffd0e0, vx: [-6, 10], vy: [8, 20], size: [3, 5], glow: false },
  summer: { color: 0xe8b23d, vx: [-8, 8], vy: [-4, 4], size: [2, 3], glow: true },
  autumn: { color: 0xd98a3f, vx: [-14, -4], vy: [14, 28], size: [3, 5], glow: false },
  winter: { color: 0xf4f0e8, vx: [-4, 4], vy: [18, 34], size: [2, 3], glow: false },
};

interface AmbientParticle {
  img: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  glowTween?: Phaser.Tweens.Tween;
}

export class SeasonAmbience implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private tintCurrent: Phaser.GameObjects.Rectangle;
  private tintIncoming: Phaser.GameObjects.Rectangle;
  private lastSeason: Season;

  private particles: AmbientParticle[] = [];
  private targetCount = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.lastSeason = ctx.season();

    const w = scene.scale.width;
    const h = scene.scale.height;
    // Both rects keep a fixed fillAlpha of TINT_ALPHA forever; crossfades
    // tween each GameObject's own `.alpha` (0..1) instead, so effective
    // opacity is always `alpha * TINT_ALPHA` -- avoids ever animating
    // fillColor/fillAlpha mid-tween.
    this.tintCurrent = scene.add.rectangle(0, 0, w, h, SEASON_TINT[this.lastSeason], TINT_ALPHA);
    this.tintCurrent.setOrigin(0, 0).setScrollFactor(0).setDepth(1500);
    this.tintCurrent.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tintCurrent.setAlpha(1);
    this.tintIncoming = scene.add.rectangle(0, 0, w, h, SEASON_TINT[this.lastSeason], TINT_ALPHA);
    this.tintIncoming.setOrigin(0, 0).setScrollFactor(0).setDepth(1501);
    this.tintIncoming.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.tintIncoming.setAlpha(0);

    this.ctx.events.on(EV.seasonChanged, this.onSeasonChanged, this);

    this.rebuildParticlePool();
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    const dtSec = deltaMs / 1000;

    // Quality can be toggled mid-run (MetaHub setting only takes effect next
    // boot in practice, but stay defensive and resize the live pool if it
    // ever changes).
    const wanted = Math.round(12 * Quality.current.particleScale);
    if (wanted !== this.targetCount) this.rebuildParticlePool();

    for (const p of this.particles) {
      p.img.x += p.vx * dtSec;
      p.img.y += p.vy * dtSec;
      if (p.img.x < -10 || p.img.x > w + 10 || p.img.y < -10 || p.img.y > h + 10) {
        this.respawnParticle(p, w, h, true);
      }
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.seasonChanged, this.onSeasonChanged, this);
    this.tintCurrent.destroy();
    this.tintIncoming.destroy();
    for (const p of this.particles) {
      p.glowTween?.stop();
      p.img.destroy();
    }
    this.particles = [];
  }

  // ------------------------------------------------------------------

  private onSeasonChanged(season: Season): void {
    this.lastSeason = season;
    // Crossfade: incoming rect is pre-set to the new color (fillAlpha fixed
    // at TINT_ALPHA), starts at object-alpha 0, tweens to 1 over 2s while
    // current fades from 1 to 0 -- net effective tint lerps smoothly.
    this.tintIncoming.setFillStyle(SEASON_TINT[season], TINT_ALPHA);
    this.tintIncoming.setAlpha(0);
    this.scene.tweens.add({
      targets: this.tintIncoming,
      alpha: 1,
      duration: TINT_FADE_MS,
    });
    this.scene.tweens.add({
      targets: this.tintCurrent,
      alpha: 0,
      duration: TINT_FADE_MS,
      onComplete: () => {
        // Settle: current adopts the new color at full tint alpha, incoming
        // resets transparent, ready for the next season boundary.
        this.tintCurrent.setFillStyle(SEASON_TINT[season], TINT_ALPHA);
        this.tintCurrent.setAlpha(1);
        this.tintIncoming.setAlpha(0);
      },
    });
  }

  private rebuildParticlePool(): void {
    for (const p of this.particles) {
      p.glowTween?.stop();
      p.img.destroy();
    }
    this.particles = [];
    this.targetCount = Math.round(12 * Quality.current.particleScale);
    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    for (let i = 0; i < this.targetCount; i++) {
      const look = SEASON_LOOK[this.ctx.season()];
      const rect = this.scene.add.rectangle(
        Phaser.Math.Between(0, w),
        Phaser.Math.Between(0, h),
        Phaser.Math.FloatBetween(look.size[0], look.size[1]),
        Phaser.Math.FloatBetween(look.size[0], look.size[1]),
        look.color,
        0.7
      );
      rect.setScrollFactor(0).setDepth(1490);
      const p: AmbientParticle = {
        img: rect,
        vx: Phaser.Math.FloatBetween(look.vx[0], look.vx[1]),
        vy: Phaser.Math.FloatBetween(look.vy[0], look.vy[1]),
      };
      if (look.glow) {
        p.glowTween = this.scene.tweens.add({
          targets: rect,
          alpha: 0.25,
          duration: Phaser.Math.Between(600, 1100),
          yoyo: true,
          repeat: -1,
        });
      }
      this.particles.push(p);
    }
  }

  private respawnParticle(p: AmbientParticle, w: number, h: number, wrapping: boolean): void {
    const look = SEASON_LOOK[this.ctx.season()];
    p.img.setFillStyle(look.color, 0.7);
    p.vx = Phaser.Math.FloatBetween(look.vx[0], look.vx[1]);
    p.vy = Phaser.Math.FloatBetween(look.vy[0], look.vy[1]);
    const size = Phaser.Math.FloatBetween(look.size[0], look.size[1]);
    p.img.setDisplaySize(size, size);
    // Re-enter from whichever edge matches the new drift direction; falls
    // back to top since most seasons drift downward.
    if (wrapping) {
      p.img.x = Phaser.Math.Between(0, w);
      p.img.y = p.vy >= 0 ? -8 : h + 8;
    }
  }
}
