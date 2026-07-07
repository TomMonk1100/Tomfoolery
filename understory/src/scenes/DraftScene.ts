/**
 * DraftScene — presents 3 large vertical rarity-cards + a Skip button when a
 * level-up draft fires. Purely presentational: this scene only ever calls
 * data.onPick(cardId | null). Pause/resume/stop of the underlying run is the
 * DraftSystem's responsibility, not this scene's.
 *
 * DECISIONS:
 * - DraftSystem (read-only, owned by Worker B/orchestrator) launches this
 *   scene with exactly `{ cards, onPick }` today. To show ownership-aware
 *   copy ("NEW!" / "Lv N->N+1" / "EVOLVE -> X") we need to know the player's
 *   activeWeapons/activePassives, which this scene is not given. Per the
 *   assignment: accept an OPTIONAL `player` field on the init data and code
 *   defensively — if absent, omit ownership info and just show the card's
 *   base description. ORCHESTRATOR TODO: update DraftSystem's
 *   `this.scene.scene.launch(SCENE.Draft, { cards, onPick })` call to
 *   `{ cards, onPick, player: this.ctx.player }` to light up the richer copy.
 * - weapons.json/passives.json are imported directly (read-only lookup) to
 *   resolve card.id -> WeaponData/PassiveData for display; DraftScene does
 *   not mutate them and never receives ctx.
 * - Icon rendering: draws frameKey(iconKey(card.id)) at 4x if the texture
 *   exists; else a colored emblem circle with the card's initials, per the
 *   "never crash on missing texture" standing order.
 */
import Phaser from "phaser";
import { SCENE, CardData, FusionData, Rarity, PlayerState, PassiveData, resolveEvolution } from "../core/types";
import { normalizeWeapons } from "../core/weaponCatalog";
import { PALETTE, iconKey, frameKey } from "../gfx/spriteRegistry";
import weaponsJson from "../data/weapons.json";
import fusionsJson from "../data/fusions.json";
import passivesJson from "../data/passives.json";

const WEAPONS = normalizeWeapons(weaponsJson);
const PASSIVES = passivesJson as unknown as PassiveData[];
const FUSIONS = fusionsJson as unknown as FusionData[];

export interface DraftSceneData {
  cards: CardData[];
  onPick: (cardId: string | null) => void;
  /** Optional — orchestrator may pass ctx.player for ownership-aware copy. */
  player?: PlayerState;
}

function hex(n: string): number {
  return parseInt(n.replace("#", ""), 16);
}

/** Border color per rarity. */
const RARITY_COLOR: Record<Rarity, string> = {
  common: PALETTE.cream,
  uncommon: PALETTE.grassLight,
  rare: PALETTE.water,
  epic: PALETTE.purple,
  legendary: PALETTE.gold,
  mythic: PALETTE.danger,
};

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

const PULSE_RARITIES: Rarity[] = ["epic", "legendary", "mythic"];

export class DraftScene extends Phaser.Scene {
  private cards: CardData[] = [];
  private onPick: (cardId: string | null) => void = () => {};
  private player?: PlayerState;

  private cardContainers: Phaser.GameObjects.Container[] = [];
  private overlay?: Phaser.GameObjects.Rectangle;
  private skipButton?: Phaser.GameObjects.Container;
  private title?: Phaser.GameObjects.Text;
  private resolved = false;

  constructor() {
    super(SCENE.Draft);
  }

  init(data: DraftSceneData): void {
    this.cards = data.cards;
    this.onPick = data.onPick;
    this.player = data.player;
    this.resolved = false;
  }

  create(): void {
    this.cardContainers = [];
    this.buildLayout();
  }

  private buildLayout(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.overlay = this.add.rectangle(0, 0, width, height, hex(PALETTE.outline), 0.72);
    this.overlay.setOrigin(0, 0);
    this.overlay.setDepth(0);

    this.title = this.add
      .text(width / 2, 48, "Choose a Path", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.white,
      })
      .setOrigin(0.5)
      .setDepth(1);

    // Update 3: a guaranteed fusion card can make this a 4-card offer —
    // shrink card width so 4 fit the 480px viewport (4x108 + 3x8 = 456).
    const cardW = this.cards.length >= 4 ? 108 : 130;
    const cardH = 290;
    const gap = 8;
    const totalW = this.cards.length * cardW + (this.cards.length - 1) * gap;
    const startX = width / 2 - totalW / 2 + cardW / 2;
    const y = height / 2 - 10;

    this.cards.forEach((card, i) => {
      const x = startX + i * (cardW + gap);
      const container = this.buildCard(card, x, y, cardW, cardH);
      // Entrance: start below/offscreen + transparent, slide up staggered.
      container.setAlpha(0);
      const finalY = y;
      container.y = finalY + 60;
      this.tweens.add({
        targets: container,
        y: finalY,
        alpha: 1,
        duration: 320,
        delay: i * 80,
        ease: "Back.easeOut",
        easeParams: [2.2],
      });
      this.cardContainers.push(container);
    });

    this.skipButton = this.buildSkipButton(width / 2, height - 40);
  }

  private buildCard(
    card: CardData,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(2);
    container.setSize(w, h);

    const borderColorStr = RARITY_COLOR[card.rarity];
    const borderColor = hex(borderColorStr);

    const bg = this.add.rectangle(0, 0, w, h, hex(PALETTE.outline), 0.95);
    bg.setStrokeStyle(3, borderColor, 1);

    if (PULSE_RARITIES.includes(card.rarity)) {
      this.tweens.add({
        targets: bg,
        alpha: 0.75,
        duration: 650,
        yoyo: true,
        repeat: -1,
        delay: Phaser.Math.Between(0, 200),
      });
    }

    const rarityLabel = this.add
      .text(0, -h / 2 + 10, RARITY_LABEL[card.rarity], {
        fontFamily: "monospace",
        fontSize: "10px",
        color: borderColorStr,
      })
      .setOrigin(0.5, 0);

    const iconArea = this.buildIcon(card, 0, -h / 2 + 56, 48);

    const nameText = this.add
      .text(0, -h / 2 + 92, card.name, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.white,
        align: "center",
        wordWrap: { width: w - 12 },
      })
      .setOrigin(0.5, 0);

    const { statusLine, bodyLines } = this.describeCard(card);

    const statusText = this.add
      .text(0, -h / 2 + 128, statusLine, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.gold,
        align: "center",
        wordWrap: { width: w - 12 },
      })
      .setOrigin(0.5, 0);

    const bodyText = this.add
      .text(0, -h / 2 + 150, bodyLines, {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.cream,
        align: "center",
        wordWrap: { width: w - 16 },
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);

    container.add([bg, rarityLabel, iconArea, nameText, statusText, bodyText]);

    // Update 2 §5: neutral (animal:"any") weapons/passives get a small
    // paw-print corner badge so they read as "usable by everyone" at a
    // glance, without needing to read the body text.
    if (this.isNeutralCard(card)) {
      container.add(this.buildNeutralBadge(w / 2 - 18, -h / 2 + 16));
    }

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => container.setScale(1.04));
    bg.on("pointerout", () => container.setScale(1.0));
    bg.on("pointerdown", () => this.pick(card.id, container));

    return container;
  }

  /** Update 3: synthesized ids ("<weaponId>::<evolutionId>") resolve weapon
   * lookups via the part before "::". */
  private baseCardId(card: CardData): string {
    return card.id.includes("::") ? card.id.split("::")[0] : card.id;
  }

  private isNeutralCard(card: CardData): boolean {
    const weapon = WEAPONS.find((w) => w.id === this.baseCardId(card));
    if (weapon) return weapon.animal === "any";
    const passive = PASSIVES.find((p) => p.id === card.id);
    return passive?.animal === "any";
  }

  /** Small paw-print-style badge ("ALL") for neutral cards — a filled paw
   * pad + toes made of circles, cheaper and more legible at 16px than a
   * hand-authored pixel sprite would be at this size. */
  private buildNeutralBadge(x: number, y: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    const bg = this.add.circle(0, 0, 11, hex(PALETTE.outline), 0.9);
    bg.setStrokeStyle(1.5, hex(PALETTE.gold), 1);
    const pad = this.add.ellipse(0, 2, 10, 7, hex(PALETTE.gold));
    const toe1 = this.add.circle(-5, -4, 2.4, hex(PALETTE.gold));
    const toe2 = this.add.circle(-1.5, -6, 2.4, hex(PALETTE.gold));
    const toe3 = this.add.circle(2, -6, 2.4, hex(PALETTE.gold));
    const toe4 = this.add.circle(5.5, -4, 2.4, hex(PALETTE.gold));
    c.add([bg, pad, toe1, toe2, toe3, toe4]);
    return c;
  }

  private buildIcon(card: CardData, x: number, y: number, size: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    // Update 3: fusion cards render BOTH input icons side by side.
    if (card.id.startsWith("fuse::")) {
      const fusion = FUSIONS.find((f) => f.id === card.id.slice("fuse::".length));
      if (fusion) {
        const half = size * 0.72;
        fusion.inputs.forEach((inputId, i) => {
          const k = frameKey(iconKey(inputId), 0);
          if (this.textures.exists(k)) {
            const img = this.add.image(i === 0 ? -size / 3 : size / 3, 0, k);
            img.setDisplaySize(half, half);
            c.add(img);
          }
        });
        const plus = this.add
          .text(0, 0, "+", {
            fontFamily: "monospace",
            fontSize: "14px",
            color: PALETTE.gold,
          })
          .setOrigin(0.5);
        c.add(plus);
        return c;
      }
    }
    const key = frameKey(iconKey(this.baseCardId(card)), 0);
    if (this.textures.exists(key)) {
      const img = this.add.image(0, 0, key);
      img.setDisplaySize(size, size);
      c.add(img);
    } else {
      const circle = this.add.circle(0, 0, size / 2, hex(RARITY_COLOR[card.rarity]), 0.3);
      circle.setStrokeStyle(2, hex(RARITY_COLOR[card.rarity]), 1);
      const initials = card.name
        .split(/[\s-]+/)
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      const label = this.add
        .text(0, 0, initials, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: PALETTE.white,
        })
        .setOrigin(0.5);
      c.add([circle, label]);
    }
    return c;
  }

  /** Look up the weapon/passive record for a card and build display copy. */
  private describeCard(card: CardData): { statusLine: string; bodyLines: string } {
    // Update 3: guaranteed fusion card — "⚡ FUSE" + recipe flavor.
    if (card.id.startsWith("fuse::")) {
      const fusion = FUSIONS.find((f) => f.id === card.id.slice("fuse::".length));
      if (fusion) {
        return {
          statusLine: "⚡ FUSE",
          bodyLines: truncateTwoLines(fusion.description),
        };
      }
    }
    // Update 3: synthesized evolution-branch card — title stays the weapon
    // name, status line names the branch (plan: "EVOLVE -> Guard Bark").
    if (card.id.includes("::")) {
      const [weaponId, evolutionId] = card.id.split("::");
      const w = WEAPONS.find((x) => x.id === weaponId);
      const branch = w?.evolutions.find((e) => e.id === evolutionId);
      if (w && branch) {
        return {
          statusLine: `EVOLVE -> ${branch.name}`,
          bodyLines: truncateTwoLines(branch.description),
        };
      }
    }
    const weapon = WEAPONS.find((w) => w.id === card.id);
    if (weapon) {
      const owned = this.player?.activeWeapons.find((w) => w.weaponId === weapon.id);
      // Update 3: branch-aware evolution copy — the first passive-satisfied
      // branch drives the "EVOLVE ->" offer; the taken branch once evolved.
      const satisfiedBranch = weapon.evolutions.find((evo) =>
        this.player?.activePassives.some((p) => p.passiveId === evo.requiresPassiveId)
      );
      let statusLine: string;
      if (!owned) {
        statusLine = "NEW!";
      } else if (owned.level >= weapon.levels.length) {
        const canEvolve = !owned.evolved && !!satisfiedBranch;
        statusLine = canEvolve
          ? `EVOLVE -> ${satisfiedBranch!.name}`
          : `Max Lv ${owned.level}`;
      } else {
        statusLine = `Lv ${owned.level} -> ${owned.level + 1}`;
      }
      const evoCopy = owned?.evolved
        ? resolveEvolution(weapon, owned)
        : satisfiedBranch ?? weapon.evolutions[0];
      const desc =
        owned && owned.level >= weapon.levels.length && evoCopy
          ? evoCopy.description
          : weapon.description;
      return { statusLine, bodyLines: truncateTwoLines(desc) };
    }

    const passive = PASSIVES.find((p) => p.id === card.id);
    if (passive) {
      const owned = this.player?.activePassives.find((p) => p.passiveId === passive.id);
      const stacks = owned?.stacks ?? 0;
      const statusLine = `Stack ${Math.min(stacks + 1, passive.maxStacks)}/${passive.maxStacks}`;
      return { statusLine, bodyLines: truncateTwoLines(passive.description) };
    }

    // Legacy stat card fallback.
    const sign = card.effect.magnitude >= 0 ? "+" : "";
    return {
      statusLine: `${sign}${card.effect.magnitude}% ${card.effect.type}`,
      bodyLines: truncateTwoLines(
        `${card.tradeoff.magnitude >= 0 ? "+" : ""}${card.tradeoff.magnitude}% ${card.tradeoff.type}`
      ),
    };
  }

  private pick(cardId: string, container: Phaser.GameObjects.Container): void {
    if (this.resolved) return;
    this.resolved = true;

    const flash = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0xffffff, 0);
    flash.setOrigin(0, 0);
    flash.setDepth(50);
    this.tweens.add({
      targets: flash,
      alpha: { from: 0.85, to: 0 },
      duration: 140,
      onComplete: () => flash.destroy(),
    });

    this.tweens.add({
      targets: container,
      scale: 1.12,
      duration: 90,
      yoyo: true,
      onComplete: () => this.onPick(cardId),
    });
  }

  private buildSkipButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(2);

    const w = 140;
    const h = 36;

    const bg = this.add.rectangle(0, 0, w, h, hex(PALETTE.outline), 0.9);
    bg.setStrokeStyle(2, hex(PALETTE.cream), 1);

    const label = this.add
      .text(0, 0, "Skip (+5 XP)", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.white,
      })
      .setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerover", () => container.setScale(1.05));
    container.on("pointerout", () => container.setScale(1.0));
    container.on("pointerdown", () => {
      if (this.resolved) return;
      this.resolved = true;
      this.onPick(null);
    });

    return container;
  }
}

/** Clamp a description to ~2 short lines by trimming at a sane length. */
function truncateTwoLines(text: string): string {
  const maxLen = 80;
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1).trimEnd() + "…";
}
