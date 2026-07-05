/**
 * LifeStoryScene — Nest & Fang results screen. Receives { player, outcome }
 * from WorldScene (`scene.start(SCENE.LifeStory, { player, outcome })` on
 * EV.runEnded). Shows a header, a combat stats grid, the final weapon
 * loadout, and Sunseeds earned, then returns to the Meadow.
 *
 * DECISIONS:
 * - Sunseeds conversion PORTED verbatim from the previous LifeStoryScene:
 *   `scoreFromStats(player)` -> `sunseedsFromScore(score)`, credited to
 *   SaveManager exactly once per scene instance (guarded by
 *   `sunseedsCreditedFor`). ADDED on top: `+1 sunseed per 2 banked food`
 *   (`Math.floor(player.stats.foodBanked / 2)`), shown as its own line and
 *   included in the total credited to SaveManager.
 * - `outcome` distinguishes header copy + particle drizzle (survived) vs a
 *   subtle rain-gray tint (died). Both are decorative only; scoring is
 *   unaffected by outcome per the ported formula (matches prior behavior).
 * - Bosses defeated shown as "x/4" (4 bosses per CONTRACTS.md pacing table);
 *   companions shown as the live count during the run
 *   (player.stats.companionsRecruited), since COMPANION_CAP applies to
 *   simultaneous slots, not lifetime recruits.
 * - Weapon loadout recap reads player.activeWeapons directly (already final
 *   at run-end) and looks up weapons.json for name/icon; passives are not
 *   included in the icon row per spec ("Weapon loadout recap").
 */
import Phaser from "phaser";
import {
  SCENE,
  REG,
  PlayerState,
  RunOutcome,
  WeaponData,
} from "../core/types";
import weaponsJson from "../data/weapons.json";
import { scoreFromStats, sunseedsFromScore } from "../core/RunStats";
import type { SaveManager } from "../core/SaveManager";
import { PALETTE, frameKey, iconKey } from "../gfx/spriteRegistry";

const WEAPONS = weaponsJson as unknown as WeaponData[];

export interface LifeStorySceneData {
  player: PlayerState;
  outcome: RunOutcome;
}

function hex(n: string): number {
  return parseInt(n.replace("#", ""), 16);
}

export class LifeStoryScene extends Phaser.Scene {
  private player!: PlayerState;
  private outcome: RunOutcome = "survived";

  private sunseedsCreditedFor: PlayerState | null = null;

  constructor() {
    super(SCENE.LifeStory);
  }

  init(data: LifeStorySceneData): void {
    this.player = data.player;
    this.outcome = data.outcome ?? "survived";
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    const bgColor = this.outcome === "died" ? hex(PALETTE.outline) : hex(PALETTE.darkBrown);
    this.add.rectangle(0, 0, width, height, bgColor, 1).setOrigin(0, 0);

    if (this.outcome === "died") {
      this.add.rectangle(0, 0, width, height, 0x888899, 0.12).setOrigin(0, 0);
    }

    // Sunseeds: ported scoring + new banked-food bonus, credited once.
    const score = scoreFromStats(this.player);
    const baseSunseeds = sunseedsFromScore(score);
    const foodBonus = Math.floor((this.player.stats.foodBanked ?? 0) / 2);
    const totalSunseeds = baseSunseeds + foodBonus;

    if (this.sunseedsCreditedFor !== this.player) {
      const sm = this.registry.get(REG.saveManager) as SaveManager | undefined;
      sm?.addSunseeds(totalSunseeds);
      this.sunseedsCreditedFor = this.player;
    }

    let y = 20;
    y = this.renderHeader(y, width);
    y = this.renderStatsGrid(y, width);
    y = this.renderWeaponRecap(y, width);
    y = this.renderSunseeds(y, width, baseSunseeds, foodBonus, totalSunseeds);

    this.buildReturnButton(width, height);

    if (this.outcome === "survived") {
      this.spawnConfetti(width, height);
    } else {
      this.spawnRain(width, height);
    }
  }

  // --------------------------------------------------------------------
  // Header
  // --------------------------------------------------------------------

  private renderHeader(startY: number, width: number): number {
    let y = startY;

    const headline =
      this.outcome === "survived" ? "A Life Well Lived" : "A Life Cut Short";
    const headlineColor = this.outcome === "survived" ? PALETTE.gold : PALETTE.danger;

    const title = this.add
      .text(width / 2, y, headline, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: headlineColor,
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    void title;
    y += 32;

    const animalName = this.player.animalId
      ? this.player.animalId.charAt(0).toUpperCase() + this.player.animalId.slice(1)
      : "Animal";

    const sub = this.add
      .text(width / 2, y, `${animalName} · Level ${this.player.level}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.cream,
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    void sub;
    y += 26;

    return y;
  }

  // --------------------------------------------------------------------
  // Stats grid
  // --------------------------------------------------------------------

  private renderStatsGrid(startY: number, width: number): number {
    let y = startY;
    const marginX = 20;
    const s = this.player.stats;

    const rows: [string, string | number][] = [
      ["Level", this.player.level],
      ["Kills", s.kills],
      ["Damage Dealt", Math.round(s.damageDealt)],
      ["Damage Taken", Math.round(s.damageTaken)],
      ["Food Eaten", s.foodEaten],
      ["Food Banked", s.foodBanked],
      ["Nest Raids Survived", s.nestRaidsSurvived],
      ["Bosses Defeated", `${s.bossesDefeated}/4`],
      ["Companions", s.companionsRecruited],
      ["Seasons Completed", s.seasonsCompleted],
    ];

    for (const [label, value] of rows) {
      const row = this.add.container(marginX, y);
      row.setDepth(2);

      const rowBg = this.add.rectangle(0, 0, width - marginX * 2, 20, hex(PALETTE.outline), 0.35);
      rowBg.setOrigin(0, 0);

      const labelText = this.add
        .text(6, 3, label, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: PALETTE.cream,
        })
        .setOrigin(0, 0);

      const valueText = this.add
        .text(width - marginX * 2 - 6, 3, String(value), {
          fontFamily: "monospace",
          fontSize: "11px",
          color: PALETTE.white,
        })
        .setOrigin(1, 0);

      row.add([rowBg, labelText, valueText]);
      y += 22;
    }

    return y + 10;
  }

  // --------------------------------------------------------------------
  // Weapon loadout recap
  // --------------------------------------------------------------------

  private renderWeaponRecap(startY: number, width: number): number {
    let y = startY;

    const heading = this.add
      .text(width / 2, y, "Final Loadout", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.leaf,
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    void heading;
    y += 20;

    const weapons = this.player.activeWeapons;
    if (weapons.length === 0) {
      const empty = this.add
        .text(width / 2, y, "No weapons carried", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: PALETTE.cream,
        })
        .setOrigin(0.5, 0)
        .setDepth(2);
      void empty;
      return y + 26;
    }

    const slotSize = 40;
    const gap = 8;
    const totalW = weapons.length * slotSize + (weapons.length - 1) * gap;
    const startX = width / 2 - totalW / 2;

    weapons.forEach((w, i) => {
      const x = startX + i * (slotSize + gap) + slotSize / 2;
      const data = WEAPONS.find((wd) => wd.id === w.weaponId);

      const container = this.add.container(x, y + slotSize / 2);
      container.setDepth(2);

      const bg = this.add.rectangle(0, 0, slotSize, slotSize, hex(PALETTE.outline), 0.8);
      bg.setStrokeStyle(2, w.evolved ? hex(PALETTE.gold) : hex(PALETTE.cream), 1);

      const fk = frameKey(iconKey(w.weaponId), 0);
      let icon: Phaser.GameObjects.GameObject;
      if (this.textures.exists(fk)) {
        const img = this.add.image(0, -4, fk);
        img.setDisplaySize(slotSize - 12, slotSize - 12);
        icon = img;
      } else {
        const label = this.add
          .text(0, -4, (data?.name ?? w.weaponId).slice(0, 2).toUpperCase(), {
            fontFamily: "monospace",
            fontSize: "10px",
            color: PALETTE.white,
          })
          .setOrigin(0.5);
        icon = label;
      }

      const lvText = this.add
        .text(0, slotSize / 2 - 8, w.evolved ? "EVO" : `Lv${w.level}`, {
          fontFamily: "monospace",
          fontSize: "8px",
          color: w.evolved ? PALETTE.gold : PALETTE.cream,
        })
        .setOrigin(0.5);

      container.add([bg, icon, lvText]);
    });

    return y + slotSize + 16;
  }

  // --------------------------------------------------------------------
  // Sunseeds
  // --------------------------------------------------------------------

  private renderSunseeds(
    startY: number,
    width: number,
    baseSunseeds: number,
    foodBonus: number,
    total: number
  ): number {
    let y = startY;

    const baseLine = this.add
      .text(width / 2, y, `Sunseeds earned: ${baseSunseeds}`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.cream,
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    void baseLine;
    y += 18;

    const bonusLine = this.add
      .text(width / 2, y, `Banked food bonus: +${foodBonus}`, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.grassLight,
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    void bonusLine;
    y += 20;

    const totalLine = this.add
      .text(width / 2, y, `Total: ${total} Sunseeds`, {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE.gold,
      })
      .setOrigin(0.5, 0)
      .setDepth(2);
    void totalLine;
    y += 28;

    return y;
  }

  // --------------------------------------------------------------------
  // Return button
  // --------------------------------------------------------------------

  private buildReturnButton(width: number, height: number): void {
    const btnWidth = Math.min(260, width * 0.75);
    const btnHeight = 48;
    const x = width / 2;
    const y = height - 34;

    const bg = this.add.rectangle(x, y, btnWidth, btnHeight, hex(PALETTE.grass), 1);
    bg.setStrokeStyle(3, hex(PALETTE.gold), 1);
    bg.setDepth(10);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x, y, "Return to Meadow", {
        fontFamily: "monospace",
        fontSize: "15px",
        color: PALETTE.white,
      })
      .setOrigin(0.5)
      .setDepth(10);

    bg.on("pointerover", () => bg.setFillStyle(hex(PALETTE.grassLight)));
    bg.on("pointerout", () => bg.setFillStyle(hex(PALETTE.grass)));
    bg.on("pointerdown", () => {
      this.scene.start(SCENE.Meta);
    });

    void label;
  }

  // --------------------------------------------------------------------
  // Decorative particles
  // --------------------------------------------------------------------

  private spawnConfetti(width: number, _height: number): void {
    const colors = [
      hex(PALETTE.gold),
      hex(PALETTE.grassLight),
      hex(PALETTE.leaf),
      hex(PALETTE.cream),
    ];
    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.Between(0, width);
      const startY = Phaser.Math.Between(-40, -4);
      const piece = this.add.rectangle(
        x,
        startY,
        3,
        6,
        colors[Phaser.Math.Between(0, colors.length - 1)],
        0.9
      );
      piece.setDepth(1);
      this.tweens.add({
        targets: piece,
        y: `+=${Phaser.Math.Between(300, 700)}`,
        x: `+=${Phaser.Math.Between(-30, 30)}`,
        angle: Phaser.Math.Between(90, 360),
        duration: Phaser.Math.Between(2200, 4200),
        delay: Phaser.Math.Between(0, 2000),
        repeat: -1,
        onRepeat: () => {
          piece.y = Phaser.Math.Between(-40, -4);
          piece.x = Phaser.Math.Between(0, width);
        },
      });
    }
  }

  private spawnRain(width: number, height: number): void {
    for (let i = 0; i < 18; i++) {
      const x = Phaser.Math.Between(0, width);
      const startY = Phaser.Math.Between(-height, 0);
      const drop = this.add.rectangle(x, startY, 1, 12, 0x9aa0a8, 0.4);
      drop.setDepth(1);
      this.tweens.add({
        targets: drop,
        y: `+=${height + 40}`,
        duration: Phaser.Math.Between(900, 1600),
        delay: Phaser.Math.Between(0, 1500),
        repeat: -1,
        onRepeat: () => {
          drop.y = Phaser.Math.Between(-40, -4);
          drop.x = Phaser.Math.Between(0, width);
        },
      });
    }
  }
}
