/**
 * HUD — always-on combat/survival readout for WorldScene.
 *
 * DECISIONS:
 * - Implements `System` so WorldScene(orchestrator) can `new HUD(scene, ctx)`
 *   and call `update(deltaMs)` uniformly; all per-frame polling (weapon
 *   slots, carried food, boss aggregate hp) happens inside update() rather
 *   than via extra event wiring, to keep this file self-contained.
 * - Run-progress bar accumulates elapsed *unpaused* ms locally (ctx exposes
 *   no clock), reset to 0 on construction; treated as "time since HUD/world
 *   was created" which for a single run == run elapsed time. Clamped to
 *   RUN_LENGTH_MS.
 * - Boss aggregate: `ctx.getEnemies()` polled each update(); the first time
 *   any isBoss entries are seen after EV.bossSpawned fires we capture sum of
 *   their hp as maxHp for the bar denominator (EnemyView has no explicit
 *   maxHp). If bosses re-spawn with a different total (e.g. multi-phase) we
 *   simply grow the captured max so the bar never shows >100%.
 * - Weapon/passive icons: fall back to first-2-letters text badge when
 *   `iconKey(id)` has no baked texture (pre-atlas or missing sprite), per
 *   CONTRACTS.md rule 6 (never crash on a missing texture).
 * - XP bar reads `ctx.player.xp` against `ctx.animal.xpToLevel`; beyond the
 *   authored table it extrapolates +90/level (mirrors WorldScene.thresholdFor)
 *   so the strip still makes sense post-authored-levels.
 */
import Phaser from "phaser";
import type { System, GameContext } from "../core/context";
import { EV, WELL_FED_THRESHOLD, RUN_LENGTH_MS, WEAPON_SLOTS, PASSIVE_SLOTS, SynergyData } from "../core/types";
import synergiesJson from "../data/synergies.json";

const SYNERGY_DEFS = synergiesJson as unknown as SynergyData[];

/** Update 3 (Phase 2.5): same 6 fixed tag colors as the draft card chips. */
const TAG_COLORS: Record<string, string> = {
  sonic: PALETTE.water,
  feral: PALETTE.danger,
  verdant: PALETTE.grassLight,
  swift: PALETTE.waterLight,
  lucky: PALETTE.gold,
  pack: PALETTE.purple,
};
import { PALETTE, iconKey, frameKey } from "../gfx/spriteRegistry";

const HUD_DEPTH = 4000;
const POLL_MS = 500;
const UI_PANEL = 0x18291d;
const UI_GOLD = 0xf0c95a;

function hex(n: string): number {
  return parseInt(n.replace("#", ""), 16);
}

export class HUD implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  // HP bar
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpLabel!: Phaser.GameObjects.Text;
  private hpBarW = 150;
  private hpBarH = 14;
  private lastHp = -1;

  // Hunger bar
  private hungerBarBg!: Phaser.GameObjects.Rectangle;
  private hungerBarFill!: Phaser.GameObjects.Rectangle;
  private hungerStar!: Phaser.GameObjects.Text;
  private hungerBarW = 150;
  private hungerBarH = 10;
  private hungerPulseTween?: Phaser.Tweens.Tween;

  // Season dial
  private seasonLabel!: Phaser.GameObjects.Text;
  private seasonBarBg!: Phaser.GameObjects.Rectangle;
  private seasonBarFill!: Phaser.GameObjects.Rectangle;
  private seasonBarW = 120;
  private elapsedMs = 0;

  // Top-right cluster
  private lvBadge!: Phaser.GameObjects.Text;
  private killLabel!: Phaser.GameObjects.Text;
  private carriedLabel!: Phaser.GameObjects.Text;
  private bankedLabel!: Phaser.GameObjects.Text;
  private helpText!: Phaser.GameObjects.Text;
  private helpBg!: Phaser.GameObjects.Rectangle;
  private killCount = 0;
  private bankedTotal = 0;

  // Weapon rack
  private weaponSlots: Phaser.GameObjects.Container[] = [];
  private passiveSlots: Phaser.GameObjects.Container[] = [];
  private pollAccum = 0;

  // Update 3 (Phase 2.5): synergy chips, bottom-right, max 3. Mirrors the
  // weapon rack's bottom-left footprint so nothing collides.
  private synergyChipsContainer!: Phaser.GameObjects.Container;

  // Boss bar
  private bossContainer!: Phaser.GameObjects.Container;
  private bossBarBg!: Phaser.GameObjects.Rectangle;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossNameText!: Phaser.GameObjects.Text;
  private bossMaxHp = 0;
  private bossVisible = false;

  // XP strip
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private xpBarW: number;

  private handlers: Array<{ ev: string; fn: (...args: unknown[]) => void }> = [];

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.xpBarW = scene.scale.width;

    this.buildXpStrip();
    this.buildHpBar();
    this.buildHungerBar();
    this.buildSeasonDial();
    this.buildTopRight();
    this.buildWeaponRack();
    this.buildBossBar();
    this.buildSynergyChips();
    this.buildHelpCue();

    this.bindEvents();
    this.refreshAll();
  }

  // ------------------------------------------------------------------
  // Construction
  // ------------------------------------------------------------------

  private buildXpStrip(): void {
    const bg = this.scene.add.rectangle(0, 0, this.xpBarW, 3, hex(PALETTE.outline), 1);
    bg.setOrigin(0, 0);
    bg.setScrollFactor(0);
    bg.setDepth(HUD_DEPTH);

    this.xpBarFill = this.scene.add.rectangle(0, 0, 0, 3, hex(PALETTE.gold), 1);
    this.xpBarFill.setOrigin(0, 0);
    this.xpBarFill.setScrollFactor(0);
    this.xpBarFill.setDepth(HUD_DEPTH + 1);
  }

  private buildHpBar(): void {
    const x = 10;
    const y = 10;

    this.hpBarBg = this.scene.add.rectangle(x, y, this.hpBarW, this.hpBarH, hex(PALETTE.outline), 0.85);
    this.hpBarBg.setOrigin(0, 0);
    this.hpBarBg.setStrokeStyle(1, hex(PALETTE.white), 1);
    this.hpBarBg.setScrollFactor(0);
    this.hpBarBg.setDepth(HUD_DEPTH);

    this.hpBarFill = this.scene.add.rectangle(
      x + 2,
      y + 2,
      this.hpBarW - 4,
      this.hpBarH - 4,
      hex(PALETTE.danger),
      1
    );
    this.hpBarFill.setOrigin(0, 0);
    this.hpBarFill.setScrollFactor(0);
    this.hpBarFill.setDepth(HUD_DEPTH + 1);

    this.hpLabel = this.scene.add.text(x + this.hpBarW + 6, y - 2, "HP", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: PALETTE.white,
    });
    this.hpLabel.setScrollFactor(0);
    this.hpLabel.setDepth(HUD_DEPTH + 1);
  }

  private buildHungerBar(): void {
    const x = 10;
    const y = 10 + this.hpBarH + 4;

    this.hungerBarBg = this.scene.add.rectangle(x, y, this.hungerBarW, this.hungerBarH, hex(PALETTE.outline), 0.85);
    this.hungerBarBg.setOrigin(0, 0);
    this.hungerBarBg.setStrokeStyle(1, hex(PALETTE.white), 1);
    this.hungerBarBg.setScrollFactor(0);
    this.hungerBarBg.setDepth(HUD_DEPTH);

    this.hungerBarFill = this.scene.add.rectangle(
      x + 2,
      y + 2,
      this.hungerBarW - 4,
      this.hungerBarH - 4,
      hex(PALETTE.gold),
      1
    );
    this.hungerBarFill.setOrigin(0, 0);
    this.hungerBarFill.setScrollFactor(0);
    this.hungerBarFill.setDepth(HUD_DEPTH + 1);

    this.hungerStar = this.scene.add.text(x + this.hungerBarW + 6, y - 3, "★", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: PALETTE.gold,
    });
    this.hungerStar.setScrollFactor(0);
    this.hungerStar.setDepth(HUD_DEPTH + 1);
    this.hungerStar.setVisible(false);
  }

  private buildSeasonDial(): void {
    const width = this.scene.scale.width;
    const y = 12;

    this.seasonLabel = this.scene.add
      .text(width / 2, y, "", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.white,
      })
      .setOrigin(0.5, 0);
    this.seasonLabel.setScrollFactor(0);
    this.seasonLabel.setDepth(HUD_DEPTH + 1);

    const barY = y + 16;
    this.seasonBarBg = this.scene.add.rectangle(
      width / 2 - this.seasonBarW / 2,
      barY,
      this.seasonBarW,
      4,
      hex(PALETTE.outline),
      0.85
    );
    this.seasonBarBg.setOrigin(0, 0);
    this.seasonBarBg.setScrollFactor(0);
    this.seasonBarBg.setDepth(HUD_DEPTH);

    this.seasonBarFill = this.scene.add.rectangle(
      width / 2 - this.seasonBarW / 2,
      barY,
      0,
      4,
      hex(PALETTE.leaf),
      1
    );
    this.seasonBarFill.setOrigin(0, 0);
    this.seasonBarFill.setScrollFactor(0);
    this.seasonBarFill.setDepth(HUD_DEPTH + 1);
  }

  private buildTopRight(): void {
    const width = this.scene.scale.width;
    const rightX = width - 10;
    let y = 10;

    this.lvBadge = this.scene.add.text(rightX, y, "Lv 1", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: PALETTE.gold,
    }).setOrigin(1, 0);
    this.lvBadge.setScrollFactor(0);
    this.lvBadge.setDepth(HUD_DEPTH + 1);
    y += 16;

    this.killLabel = this.scene.add.text(rightX, y, "Kills 0", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: PALETTE.white,
    }).setOrigin(1, 0);
    this.killLabel.setScrollFactor(0);
    this.killLabel.setDepth(HUD_DEPTH + 1);
    y += 14;

    this.carriedLabel = this.scene.add.text(rightX, y, "Food 0", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: PALETTE.cream,
    }).setOrigin(1, 0);
    this.carriedLabel.setScrollFactor(0);
    this.carriedLabel.setDepth(HUD_DEPTH + 1);
    y += 14;

    this.bankedLabel = this.scene.add.text(rightX, y, "Banked 0", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: PALETTE.grassLight,
    }).setOrigin(1, 0);
    this.bankedLabel.setScrollFactor(0);
    this.bankedLabel.setDepth(HUD_DEPTH + 1);
  }

  private buildWeaponRack(): void {
    const slotSize = 28;
    const gap = 4;
    const baseX = 10;
    const baseY = this.scene.scale.height - 10 - slotSize;

    // Passive row sits just above the weapon row, smaller icons.
    const passiveSize = 18;
    const passiveY = baseY - passiveSize - 6;

    for (let i = 0; i < WEAPON_SLOTS; i++) {
      const x = baseX + i * (slotSize + gap) + slotSize / 2;
      const y = baseY + slotSize / 2;
      this.weaponSlots.push(this.buildWeaponSlot(x, y, slotSize));
    }

    for (let i = 0; i < PASSIVE_SLOTS; i++) {
      const x = baseX + i * (passiveSize + gap) + passiveSize / 2;
      const y = passiveY + passiveSize / 2;
      this.passiveSlots.push(this.buildPassiveSlot(x, y, passiveSize));
    }
  }

  /** Bottom-right, stacked upward -- mirrors the bottom-left weapon rack's
   * footprint on the opposite corner, clear of the centered boss bar
   * (boss bar spans the middle third of the 480px-wide viewport). */
  private buildSynergyChips(): void {
    this.synergyChipsContainer = this.scene.add.container(0, 0);
    this.synergyChipsContainer.setScrollFactor(0);
    this.synergyChipsContainer.setDepth(HUD_DEPTH);
  }

  private refreshSynergyChips(active: { tag: string; tier: number; count: number }[]): void {
    this.synergyChipsContainer.removeAll(true);
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;
    const chipW = 84;
    const chipH = 16;
    const rightX = width - 10 - chipW / 2;
    let y = height - 10 - chipH / 2;

    for (const s of active.slice(0, 3)) {
      const def = SYNERGY_DEFS.find((d) => d.id === `syn-${s.tag}`);
      const thresholds = def?.thresholds ?? [];
      const need =
        thresholds[s.tier]?.count ?? thresholds[thresholds.length - 1]?.count ?? s.count;
      const color = TAG_COLORS[s.tag] ?? PALETTE.cream;
      const bg = this.scene.add.rectangle(rightX, y, chipW, chipH, hex(color), 0.35);
      bg.setStrokeStyle(1, hex(color), 1);
      const label = this.scene.add
        .text(rightX, y, `${s.tag} ${s.count}/${need}`, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: PALETTE.white,
        })
        .setOrigin(0.5);
      this.synergyChipsContainer.add([bg, label]);
      y -= chipH + 4;
    }
  }

  private buildWeaponSlot(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    c.setScrollFactor(0);
    c.setDepth(HUD_DEPTH);

    const bg = this.scene.add.rectangle(0, 0, size, size, hex(PALETTE.outline), 0.75);
    bg.setStrokeStyle(2, hex(PALETTE.cream), 0.9);

    const icon = this.scene.add.image(0, 0, "__DEFAULT");
    icon.setVisible(false);
    icon.setDisplaySize(size - 6, size - 6);

    const fallbackText = this.scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.white,
      })
      .setOrigin(0.5);

    const star = this.scene.add
      .text(size / 2 - 2, -size / 2 + 1, "★", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.gold,
      })
      .setOrigin(1, 0);
    star.setVisible(false);

    // 5 level pips along the bottom edge.
    const pips: Phaser.GameObjects.Arc[] = [];
    const pipCount = 5;
    const pipSpacing = size / (pipCount + 1);
    for (let i = 0; i < pipCount; i++) {
      const px = -size / 2 + pipSpacing * (i + 1);
      const pip = this.scene.add.circle(px, size / 2 + 4, 1.5, hex(PALETTE.outline), 1);
      pip.setStrokeStyle(1, hex(PALETTE.cream), 1);
      pips.push(pip);
    }

    c.add([bg, icon, fallbackText, star, ...pips]);
    c.setData("bg", bg);
    c.setData("icon", icon);
    c.setData("fallback", fallbackText);
    c.setData("star", star);
    c.setData("pips", pips);
    c.setVisible(false);
    return c;
  }

  private buildPassiveSlot(x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.scene.add.container(x, y);
    c.setScrollFactor(0);
    c.setDepth(HUD_DEPTH);

    const bg = this.scene.add.rectangle(0, 0, size, size, hex(PALETTE.outline), 0.6);
    bg.setStrokeStyle(1, hex(PALETTE.leaf), 0.9);

    const icon = this.scene.add.image(0, 0, "__DEFAULT");
    icon.setVisible(false);
    icon.setDisplaySize(size - 4, size - 4);

    const fallbackText = this.scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.white,
      })
      .setOrigin(0.5);

    const stackText = this.scene.add
      .text(size / 2 - 1, size / 2 - 1, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.gold,
      })
      .setOrigin(1, 1);

    c.add([bg, icon, fallbackText, stackText]);
    c.setData("bg", bg);
    c.setData("icon", icon);
    c.setData("fallback", fallbackText);
    c.setData("stackText", stackText);
    c.setVisible(false);
    return c;
  }

  private buildBossBar(): void {
    const width = this.scene.scale.width;
    const barW = 300;
    const barH = 12;
    const y = this.scene.scale.height - 10 - 28 - 18 - barH - 6;

    this.bossContainer = this.scene.add.container(width / 2, y);
    this.bossContainer.setScrollFactor(0);
    this.bossContainer.setDepth(HUD_DEPTH);
    this.bossContainer.setVisible(false);

    this.bossNameText = this.scene.add
      .text(0, -barH / 2 - 12, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.danger,
      })
      .setOrigin(0.5);

    this.bossBarBg = this.scene.add.rectangle(0, 0, barW, barH, hex(PALETTE.outline), 0.9);
    this.bossBarBg.setStrokeStyle(2, hex(PALETTE.white), 1);

    this.bossBarFill = this.scene.add.rectangle(
      -barW / 2 + 2,
      -barH / 2 + 2,
      barW - 4,
      barH - 4,
      hex(PALETTE.purple),
      1
    );
    this.bossBarFill.setOrigin(0, 0);

    this.bossContainer.add([this.bossNameText, this.bossBarBg, this.bossBarFill]);
  }

  private buildHelpCue(): void {
    const width = this.scene.scale.width;
    const y = this.scene.scale.height - 112;
    this.helpBg = this.scene.add.rectangle(width / 2, y, width - 48, 34, UI_PANEL, 0.86);
    this.helpBg.setStrokeStyle(1, UI_GOLD, 0.45);
    this.helpBg.setScrollFactor(0);
    this.helpBg.setDepth(HUD_DEPTH);

    this.helpText = this.scene.add
      .text(width / 2, y, "WASD / arrows or drag to move  ·  auto-attacks fire for you", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.cream,
      })
      .setOrigin(0.5);
    this.helpText.setScrollFactor(0);
    this.helpText.setDepth(HUD_DEPTH + 1);

    this.scene.tweens.add({
      targets: [this.helpBg, this.helpText],
      alpha: 0,
      delay: 7000,
      duration: 900,
      ease: "Sine.easeInOut",
    });
  }

  // ------------------------------------------------------------------
  // Events
  // ------------------------------------------------------------------

  private on(ev: string, fn: (...args: unknown[]) => void): void {
    this.ctx.events.on(ev, fn, this);
    this.handlers.push({ ev, fn });
  }

  private bindEvents(): void {
    this.on(EV.playerDamaged, () => this.flashHp());
    this.on(EV.hungerChanged, () => this.refreshHunger());
    this.on(EV.seasonChanged, () => this.refreshSeasonLabel());
    this.on(EV.enemyKilled, () => {
      this.killCount += 1;
      this.killLabel.setText(`Kills ${this.killCount}`);
    });
    this.on(EV.foodBanked, (...args: unknown[]) => {
      const payload = args[0] as { count?: number; total?: number } | undefined;
      this.bankedTotal = payload?.total ?? this.bankedTotal + (payload?.count ?? 0);
      this.bankedLabel.setText(`Banked ${this.bankedTotal}`);
    });
    this.on(EV.synergyChanged, (...args: unknown[]) => {
      const active = args[0] as { tag: string; tier: number; count: number }[];
      this.refreshSynergyChips(active ?? []);
    });
    this.on(EV.bossSpawned, (...args: unknown[]) => {
      const payload = args[0] as { enemyId?: string; name?: string } | undefined;
      this.bossVisible = true;
      this.bossMaxHp = 0; // recaptured on next update() poll
      this.bossNameText.setText(payload?.name ?? "Boss");
      this.bossContainer.setVisible(true);
    });
    this.on(EV.bossDefeated, () => {
      this.bossVisible = false;
      this.bossMaxHp = 0;
      this.bossContainer.setVisible(false);
    });
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    this.elapsedMs = Math.min(RUN_LENGTH_MS, this.elapsedMs + deltaMs);
    this.refreshSeasonProgress();
    this.refreshXp();
    this.refreshHp();

    this.pollAccum += deltaMs;
    if (this.pollAccum >= POLL_MS) {
      this.pollAccum = 0;
      this.refreshWeaponRack();
      this.refreshTopRightPolled();
    }

    this.refreshBoss();
  }

  private refreshAll(): void {
    this.refreshHp();
    this.refreshHunger();
    this.refreshSeasonLabel();
    this.refreshSeasonProgress();
    this.refreshXp();
    this.refreshWeaponRack();
    this.refreshTopRightPolled();
  }

  private refreshHp(): void {
    const p = this.ctx.player;
    if (p.hp === this.lastHp) return;
    this.lastHp = p.hp;
    const pct = p.maxHp > 0 ? Phaser.Math.Clamp(p.hp / p.maxHp, 0, 1) : 0;
    const targetW = (this.hpBarW - 4) * pct;
    this.scene.tweens.add({
      targets: this.hpBarFill,
      width: targetW,
      duration: 150,
      ease: "Sine.easeOut",
    });
  }

  private flashHp(): void {
    this.hpBarFill.setFillStyle(hex(PALETTE.white));
    this.scene.time.delayedCall(90, () => {
      this.hpBarFill.setFillStyle(hex(PALETTE.danger));
    });
  }

  private refreshHunger(): void {
    const hunger = this.ctx.getHunger();
    const pct = Phaser.Math.Clamp(hunger / 100, 0, 1);
    this.hungerBarFill.width = (this.hungerBarW - 4) * pct;

    const wellFed = this.ctx.isWellFed();
    this.hungerStar.setVisible(wellFed);
    if (wellFed && !this.hungerPulseTween) {
      this.hungerPulseTween = this.scene.tweens.add({
        targets: this.hungerBarFill,
        alpha: 0.55,
        duration: 550,
        yoyo: true,
        repeat: -1,
      });
    } else if (!wellFed && this.hungerPulseTween) {
      this.hungerPulseTween.stop();
      this.hungerPulseTween = undefined;
      this.hungerBarFill.setAlpha(1);
    }
  }

  private refreshSeasonLabel(): void {
    const season = this.ctx.season();
    const name = season.charAt(0).toUpperCase() + season.slice(1);
    this.seasonLabel.setText(name);
  }

  private refreshSeasonProgress(): void {
    if (!this.seasonLabel.text) this.refreshSeasonLabel();
    const pct = Phaser.Math.Clamp(this.elapsedMs / RUN_LENGTH_MS, 0, 1);
    this.seasonBarFill.width = this.seasonBarW * pct;
  }

  private refreshXp(): void {
    const p = this.ctx.player;
    const table = this.ctx.animal.xpToLevel;
    const currentThreshold =
      p.level - 1 < table.length
        ? p.level === 0
          ? 0
          : table[p.level - 2] ?? 0
        : table[table.length - 1] + (p.level - 1 - table.length) * 90;
    const nextThreshold =
      p.level < table.length
        ? table[p.level - 1]
        : table[table.length - 1] + (p.level - table.length) * 90;

    const span = Math.max(1, nextThreshold - currentThreshold);
    const into = Phaser.Math.Clamp(p.xp - currentThreshold, 0, span);
    const pct = Phaser.Math.Clamp(into / span, 0, 1);
    this.xpBarFill.width = this.xpBarW * pct;
  }

  private refreshTopRightPolled(): void {
    const p = this.ctx.player;
    this.lvBadge.setText(`Lv ${p.level}`);
    this.carriedLabel.setText(`Food ${p.carriedFood}`);
  }

  private refreshWeaponRack(): void {
    const p = this.ctx.player;

    for (let i = 0; i < this.weaponSlots.length; i++) {
      const slot = this.weaponSlots[i];
      const weapon = p.activeWeapons[i];
      if (!weapon) {
        slot.setVisible(false);
        continue;
      }
      slot.setVisible(true);
      this.applyIconOrFallback(slot, weapon.weaponId, iconKey(weapon.weaponId));

      const pips = slot.getData("pips") as Phaser.GameObjects.Arc[];
      const level = Phaser.Math.Clamp(weapon.level, 0, pips.length);
      pips.forEach((pip, idx) => {
        pip.setFillStyle(idx < level ? hex(PALETTE.gold) : hex(PALETTE.outline), 1);
      });

      const star = slot.getData("star") as Phaser.GameObjects.Text;
      star.setVisible(weapon.evolved);

      // Update 2 §5 verification: the rack previously only showed a star for
      // evolved weapons with no border change — added the gold border here
      // so evolved weapons are readable at a glance without the small star.
      const bg = slot.getData("bg") as Phaser.GameObjects.Rectangle;
      bg.setStrokeStyle(weapon.evolved ? 3 : 2, weapon.evolved ? hex(PALETTE.gold) : hex(PALETTE.cream), weapon.evolved ? 1 : 0.9);
    }

    for (let i = 0; i < this.passiveSlots.length; i++) {
      const slot = this.passiveSlots[i];
      const passive = p.activePassives[i];
      if (!passive) {
        slot.setVisible(false);
        continue;
      }
      slot.setVisible(true);
      this.applyIconOrFallback(slot, passive.passiveId, iconKey(passive.passiveId));
      const stackText = slot.getData("stackText") as Phaser.GameObjects.Text;
      stackText.setText(passive.stacks > 1 ? `${passive.stacks}` : "");
    }
  }

  private applyIconOrFallback(slot: Phaser.GameObjects.Container, id: string, key: string): void {
    const icon = slot.getData("icon") as Phaser.GameObjects.Image;
    const fallback = slot.getData("fallback") as Phaser.GameObjects.Text;
    const fk = frameKey(key, 0);
    if (this.scene.textures.exists(fk)) {
      icon.setTexture(fk);
      icon.setVisible(true);
      fallback.setVisible(false);
    } else {
      icon.setVisible(false);
      fallback.setText(id.slice(0, 2).toUpperCase());
      fallback.setVisible(true);
    }
  }

  private refreshBoss(): void {
    if (!this.bossVisible) {
      if (this.bossContainer.visible) this.bossContainer.setVisible(false);
      return;
    }
    const bosses = this.ctx.getEnemies().filter((e) => e.isBoss);
    if (bosses.length === 0) {
      // Boss defeated but bossDefeated event not yet observed (or multiple
      // bosses, one down) — keep bar if any remain, else hide gracefully.
      this.bossContainer.setVisible(false);
      return;
    }
    const totalHp = bosses.reduce((sum, b) => sum + Math.max(0, b.hp), 0);
    if (totalHp > this.bossMaxHp) this.bossMaxHp = totalHp;
    const pct = this.bossMaxHp > 0 ? Phaser.Math.Clamp(totalHp / this.bossMaxHp, 0, 1) : 0;
    this.bossBarFill.width = (300 - 4) * pct;
    this.bossContainer.setVisible(true);
  }

  destroy(): void {
    for (const { ev, fn } of this.handlers) this.ctx.events.off(ev, fn, this);
    this.hungerPulseTween?.stop();
  }
}
