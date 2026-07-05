/**
 * ScreenFX — camera shakes, screen-space overlays (vignette, banners,
 * flashes) and world-space rings/glows tied to combat/survival events.
 * Subscribes ONLY to ctx.events; reads positions via ctx.getPlayerPos() /
 * ctx.getNest().
 *
 * DECISIONS:
 * - "expanding gold ring at player" for levelUp is drawn in world space
 *   (spec explicitly allows this) as a Graphics ring that scales+fades.
 * - Well-Fed persistent outline circle spec appears twice (ScreenFX section
 *   and Juice.ts section). Implemented once here, in ScreenFX, since it's a
 *   pure "screen/world overlay" concern that matches this file's job;
 *   Juice.ts's own section is treated as duplicate spec text describing the
 *   same feature, not a second implementation, to avoid double-drawing.
 * - Nest-raid directional arrow: simple triangle Graphics rotated to face
 *   ctx.getNest() from screen center, clamped to a radius near the screen
 *   edge (world bounds aren't needed since it's a fixed HUD-radius arrow).
 * - Banner "slide in/hold/slide out" implemented with tweens on a container;
 *   kept simple (single Back/Cubic ease) rather than building a generic
 *   sequencer, since only 4 banner types exist and none share timing.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV, Season } from "../core/types";

const SCREEN_W = 480;
const SCREEN_H = 854;

export class ScreenFX implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  // Red vignette (4 edge rects, screen-space).
  private vignetteRects: Phaser.GameObjects.Rectangle[] = [];
  private vignetteTween: Phaser.Tweens.Tween | null = null;

  // Full-screen white flash (levelUp).
  private whiteFlash: Phaser.GameObjects.Rectangle;
  private whiteFlashTween: Phaser.Tweens.Tween | null = null;

  // World-space expanding ring (levelUp).
  private ringGfx: Phaser.GameObjects.Graphics | null = null;
  private ringTween: Phaser.Tweens.Tween | null = null;

  // Well-Fed persistent outline.
  private wellFedGfx: Phaser.GameObjects.Graphics | null = null;
  private wellFedActive = false;
  private wellFedPulseTweens: Phaser.Tweens.Tween[] = [];

  // Nest raid banner + arrow.
  private raidBannerContainer: Phaser.GameObjects.Container | null = null;
  private raidArrowGfx: Phaser.GameObjects.Graphics | null = null;
  private raidActive = false;
  private raidBannerTimer: Phaser.Time.TimerEvent | null = null;

  // Boss spawn/defeat banner.
  private bossBannerContainer: Phaser.GameObjects.Container | null = null;
  private bossBannerBar: Phaser.GameObjects.Rectangle | null = null;

  // Season change banner.
  private seasonBannerText: Phaser.GameObjects.Text | null = null;
  private seasonBannerTween: Phaser.Tweens.Tween | null = null;

  private readonly seasonColors: Record<Season, string> = {
    spring: "#a8d878",
    summer: "#e8b23d",
    autumn: "#d9a441",
    winter: "#dfefff",
  };

  private onScreenShake = (payload: { intensity: number; durationMs: number }): void => {
    try {
      const intensity = Phaser.Math.Clamp(payload.intensity, 0, 1);
      this.scene.cameras.main.shake(payload.durationMs, 0.004 * intensity);
    } catch (err) {
      console.warn("[ScreenFX] screenShake handler failed", err);
    }
  };

  private onPlayerDamaged = (): void => {
    try {
      this.scene.cameras.main.shake(120, 0.004 * 0.5);
      this.flashVignette();
    } catch (err) {
      console.warn("[ScreenFX] playerDamaged handler failed", err);
    }
  };

  private onBossSpawned = (payload: { enemyId: string; name: string }): void => {
    try {
      this.scene.cameras.main.shake(400, 0.004 * 0.8);
      this.showBossBanner(payload.name ?? "???", false);
    } catch (err) {
      console.warn("[ScreenFX] bossSpawned handler failed", err);
    }
  };

  private onBossDefeated = (payload: { enemyId: string; name: string }): void => {
    try {
      this.scene.cameras.main.shake(500, 0.004 * 1.0);
      this.showBossBanner("VICTORY", true);
    } catch (err) {
      console.warn("[ScreenFX] bossDefeated handler failed", err);
    }
  };

  private onLevelUp = (): void => {
    try {
      this.flashWhite();
      this.spawnLevelRing();
    } catch (err) {
      console.warn("[ScreenFX] levelUp handler failed", err);
    }
  };

  private onWellFedChanged = (wellFed: boolean): void => {
    try {
      if (wellFed) this.startWellFedGlow();
      else this.stopWellFedGlow();
    } catch (err) {
      console.warn("[ScreenFX] wellFedChanged handler failed", err);
    }
  };

  private onNestRaidStarted = (): void => {
    try {
      this.startRaidBanner();
    } catch (err) {
      console.warn("[ScreenFX] nestRaidStarted handler failed", err);
    }
  };

  private onNestRaidEnded = (): void => {
    try {
      this.endRaidBanner();
    } catch (err) {
      console.warn("[ScreenFX] nestRaidEnded handler failed", err);
    }
  };

  private onSeasonChanged = (season: Season): void => {
    try {
      this.showSeasonBanner(season);
    } catch (err) {
      console.warn("[ScreenFX] seasonChanged handler failed", err);
    }
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    // Red vignette: 4 edge rects, screen-space, alpha 0 until triggered.
    const edge = 48;
    const rectDefs: [number, number, number, number][] = [
      [0, 0, SCREEN_W, edge], // top
      [0, SCREEN_H - edge, SCREEN_W, edge], // bottom
      [0, 0, edge, SCREEN_H], // left
      [SCREEN_W - edge, 0, edge, SCREEN_H], // right
    ];
    for (const [x, y, w, h] of rectDefs) {
      const r = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0xd94f4f, 0.35);
      r.setScrollFactor(0);
      r.setDepth(5000);
      r.setAlpha(0);
      this.vignetteRects.push(r);
    }

    this.whiteFlash = scene.add.rectangle(
      SCREEN_W / 2,
      SCREEN_H / 2,
      SCREEN_W,
      SCREEN_H,
      0xffffff,
      0.25
    );
    this.whiteFlash.setScrollFactor(0);
    this.whiteFlash.setDepth(5010);
    this.whiteFlash.setAlpha(0);

    ctx.events.on(EV.screenShake, this.onScreenShake);
    ctx.events.on(EV.playerDamaged, this.onPlayerDamaged);
    ctx.events.on(EV.bossSpawned, this.onBossSpawned);
    ctx.events.on(EV.bossDefeated, this.onBossDefeated);
    ctx.events.on(EV.levelUp, this.onLevelUp);
    ctx.events.on(EV.wellFedChanged, this.onWellFedChanged);
    ctx.events.on(EV.nestRaidStarted, this.onNestRaidStarted);
    ctx.events.on(EV.nestRaidEnded, this.onNestRaidEnded);
    ctx.events.on(EV.seasonChanged, this.onSeasonChanged);
  }

  update(_deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    if (this.wellFedActive && this.wellFedGfx) {
      const pos = this.ctx.getPlayerPos();
      this.wellFedGfx.setPosition(pos.x, pos.y);
    }

    if (this.raidActive && this.raidArrowGfx) {
      this.updateRaidArrow();
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.screenShake, this.onScreenShake);
    this.ctx.events.off(EV.playerDamaged, this.onPlayerDamaged);
    this.ctx.events.off(EV.bossSpawned, this.onBossSpawned);
    this.ctx.events.off(EV.bossDefeated, this.onBossDefeated);
    this.ctx.events.off(EV.levelUp, this.onLevelUp);
    this.ctx.events.off(EV.wellFedChanged, this.onWellFedChanged);
    this.ctx.events.off(EV.nestRaidStarted, this.onNestRaidStarted);
    this.ctx.events.off(EV.nestRaidEnded, this.onNestRaidEnded);
    this.ctx.events.off(EV.seasonChanged, this.onSeasonChanged);

    for (const r of this.vignetteRects) r.destroy();
    this.vignetteRects = [];
    this.vignetteTween?.remove();
    this.whiteFlash.destroy();
    this.whiteFlashTween?.remove();
    this.ringGfx?.destroy();
    this.ringTween?.remove();
    this.wellFedGfx?.destroy();
    for (const t of this.wellFedPulseTweens) t.remove();
    this.raidBannerContainer?.destroy();
    this.raidArrowGfx?.destroy();
    this.raidBannerTimer?.remove();
    this.bossBannerContainer?.destroy();
    this.seasonBannerText?.destroy();
    this.seasonBannerTween?.remove();
  }

  // ---- Red vignette flash ----
  private flashVignette(): void {
    this.vignetteTween?.remove();
    for (const r of this.vignetteRects) r.setAlpha(0.35);
    this.vignetteTween = this.scene.tweens.add({
      targets: this.vignetteRects,
      alpha: 0,
      duration: 250,
      ease: "Linear",
    });
  }

  // ---- Level-up white flash ----
  private flashWhite(): void {
    this.whiteFlashTween?.remove();
    this.whiteFlash.setAlpha(0.25);
    this.whiteFlashTween = this.scene.tweens.add({
      targets: this.whiteFlash,
      alpha: 0,
      duration: 180,
      ease: "Linear",
    });
  }

  // ---- Level-up expanding gold ring (world space) ----
  private spawnLevelRing(): void {
    this.ringGfx?.destroy();
    this.ringTween?.remove();

    const pos = this.ctx.getPlayerPos();
    const gfx = this.scene.add.graphics();
    gfx.setDepth(1600);
    gfx.setPosition(pos.x, pos.y);
    gfx.lineStyle(3, 0xe8b23d, 1);
    gfx.strokeCircle(0, 0, 10);
    this.ringGfx = gfx;

    const state = { radius: 10, alpha: 1 };
    this.ringTween = this.scene.tweens.add({
      targets: state,
      radius: 60,
      alpha: 0,
      duration: 450,
      ease: "Cubic.Out",
      onUpdate: () => {
        gfx.clear();
        gfx.lineStyle(3, 0xe8b23d, state.alpha);
        gfx.strokeCircle(0, 0, state.radius);
      },
      onComplete: () => {
        gfx.destroy();
        if (this.ringGfx === gfx) this.ringGfx = null;
      },
    });
  }

  // ---- Well-Fed persistent glow ----
  private startWellFedGlow(): void {
    if (this.wellFedActive) return;
    this.wellFedActive = true;
    const pos = this.ctx.getPlayerPos();
    const gfx = this.scene.add.graphics();
    gfx.setDepth(999);
    gfx.setPosition(pos.x, pos.y);
    gfx.lineStyle(2, 0xe8b23d, 0.5);
    gfx.strokeCircle(0, 0, 26);
    this.wellFedGfx = gfx;

    // Two soft pulses on activation (spec: "brief golden glow pulse... 2 pulses").
    for (const t of this.wellFedPulseTweens) t.remove();
    this.wellFedPulseTweens = [];
    const state = { scale: 1 };
    const pulse = this.scene.tweens.add({
      targets: state,
      scale: 1.25,
      duration: 260,
      yoyo: true,
      repeat: 1,
      ease: "Sine.InOut",
      onUpdate: () => {
        if (this.wellFedGfx) this.wellFedGfx.setScale(state.scale);
      },
    });
    this.wellFedPulseTweens.push(pulse);
  }

  private stopWellFedGlow(): void {
    this.wellFedActive = false;
    for (const t of this.wellFedPulseTweens) t.remove();
    this.wellFedPulseTweens = [];
    this.wellFedGfx?.destroy();
    this.wellFedGfx = null;
  }

  // ---- Nest raid banner + directional arrow ----
  private startRaidBanner(): void {
    this.endRaidBanner();
    this.raidActive = true;

    const text = this.scene.add
      .text(SCREEN_W / 2, 40, "⚠ NEST RAID", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "22px",
        fontStyle: "bold",
        color: "#d94f4f",
      })
      .setOrigin(0.5, 0.5);
    const container = this.scene.add.container(0, 0, [text]);
    container.setScrollFactor(0);
    container.setDepth(5000);
    this.raidBannerContainer = container;

    this.scene.tweens.add({
      targets: text,
      alpha: { from: 1, to: 0.3 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    const arrow = this.scene.add.graphics();
    arrow.setScrollFactor(0);
    arrow.setDepth(5000);
    this.raidArrowGfx = arrow;

    this.raidBannerTimer?.remove();
    this.raidBannerTimer = this.scene.time.delayedCall(3000, () => {
      this.raidBannerContainer?.destroy();
      this.raidBannerContainer = null;
    });
  }

  private updateRaidArrow(): void {
    if (!this.raidArrowGfx) return;
    const nest = this.ctx.getNest();
    if (!nest) return;
    const playerPos = this.ctx.getPlayerPos();
    const dx = nest.x - playerPos.x;
    const dy = nest.y - playerPos.y;
    const angle = Math.atan2(dy, dx);

    const cx = SCREEN_W / 2;
    const cy = SCREEN_H / 2;
    const radius = Math.min(SCREEN_W, SCREEN_H) / 2 - 24;
    const ax = cx + Math.cos(angle) * radius;
    const ay = cy + Math.sin(angle) * radius;

    this.raidArrowGfx.clear();
    this.raidArrowGfx.fillStyle(0xd94f4f, 0.9);
    this.raidArrowGfx.save();
    this.raidArrowGfx.translateCanvas(ax, ay);
    this.raidArrowGfx.rotateCanvas(angle);
    this.raidArrowGfx.fillTriangle(10, 0, -8, -7, -8, 7);
    this.raidArrowGfx.restore();
  }

  private endRaidBanner(): void {
    this.raidActive = false;
    this.raidBannerTimer?.remove();
    this.raidBannerTimer = null;
    this.raidBannerContainer?.destroy();
    this.raidBannerContainer = null;
    this.raidArrowGfx?.destroy();
    this.raidArrowGfx = null;
  }

  // ---- Boss spawn/defeat banner ----
  private showBossBanner(label: string, isVictory: boolean): void {
    this.bossBannerContainer?.destroy();

    const barY = SCREEN_H * 0.28;
    const bar = this.scene.add.rectangle(SCREEN_W / 2, barY, SCREEN_W, 70, 0x000000, 0.75);
    const text = this.scene.add
      .text(SCREEN_W / 2, barY, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: isVictory ? "26px" : "24px",
        fontStyle: "bold",
        color: isVictory ? "#e8b23d" : "#f4f0e8",
      })
      .setOrigin(0.5, 0.5);

    const container = this.scene.add.container(0, -100, [bar, text]);
    container.setScrollFactor(0);
    container.setDepth(5020);
    this.bossBannerContainer = container;
    this.bossBannerBar = bar;

    const holdMs = isVictory ? 1200 : 1800;
    this.scene.tweens.add({
      targets: container,
      y: 0,
      duration: 260,
      ease: "Back.Out",
      onComplete: () => {
        this.scene.time.delayedCall(holdMs, () => {
          if (this.bossBannerContainer !== container) return;
          this.scene.tweens.add({
            targets: container,
            y: -100,
            duration: 260,
            ease: "Back.In",
            onComplete: () => {
              container.destroy();
              if (this.bossBannerContainer === container) this.bossBannerContainer = null;
              if (this.bossBannerBar === bar) this.bossBannerBar = null;
            },
          });
        });
      },
    });
  }

  // ---- Season change banner ----
  private showSeasonBanner(season: Season): void {
    this.seasonBannerText?.destroy();
    this.seasonBannerTween?.remove();

    const label = season.charAt(0).toUpperCase() + season.slice(1) + "...";
    const text = this.scene.add
      .text(SCREEN_W / 2, SCREEN_H * 0.4, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "28px",
        fontStyle: "bold",
        color: this.seasonColors[season] ?? "#f4f0e8",
      })
      .setOrigin(0.5, 0.5);
    text.setScrollFactor(0);
    text.setDepth(5000);
    text.setAlpha(0);
    this.seasonBannerText = text;

    this.seasonBannerTween = this.scene.tweens.add({
      targets: text,
      alpha: { from: 0, to: 1 },
      duration: 500,
      yoyo: true,
      hold: 500,
      onComplete: () => {
        text.destroy();
        if (this.seasonBannerText === text) this.seasonBannerText = null;
      },
    });
  }
}
