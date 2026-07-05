/**
 * DraftScene — presents a fan of 3 cards + Skip button when a level-up
 * draft fires. Purely presentational: this scene only ever calls
 * data.onPick(cardId | null). Pause/resume/stop of the underlying run is
 * the DraftSystem's responsibility, not this scene's.
 */
import Phaser from "phaser";
import { SCENE, CardData, Rarity } from "../core/types";

export interface DraftSceneData {
  cards: CardData[];
  onPick: (cardId: string | null) => void;
}

/** Border color per rarity — moss-green common up to firefly-shimmer mythic. */
const RARITY_COLOR: Record<Rarity, number> = {
  common: 0x6b8f5a,
  uncommon: 0x4f9d8f,
  rare: 0x4a7bc8,
  epic: 0x9b59d0,
  legendary: 0xe0a458,
  mythic: 0xf2d675,
};

const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythic: "Mythic",
};

function formatEffect(label: string, magnitude: number): string {
  const sign = magnitude >= 0 ? "+" : "";
  return `${sign}${magnitude}% ${label}`;
}

export class DraftScene extends Phaser.Scene {
  private cards: CardData[] = [];
  private onPick: (cardId: string | null) => void = () => {};

  private cardContainers: Phaser.GameObjects.Container[] = [];
  private overlay?: Phaser.GameObjects.Rectangle;
  private skipButton?: Phaser.GameObjects.Container;
  private resizeHandler?: () => void;

  constructor() {
    super(SCENE.Draft);
  }

  init(data: DraftSceneData): void {
    this.cards = data.cards;
    this.onPick = data.onPick;
  }

  create(): void {
    this.cardContainers = [];

    this.buildLayout();

    this.resizeHandler = () => this.buildLayout();
    this.scale.on("resize", this.resizeHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.resizeHandler) this.scale.off("resize", this.resizeHandler);
    });
  }

  private buildLayout(): void {
    // Clear any prior layout (handles resize re-entry cleanly).
    this.overlay?.destroy();
    this.skipButton?.destroy();
    for (const c of this.cardContainers) c.destroy();
    this.cardContainers = [];

    const width = this.scale.width;
    const height = this.scale.height;

    this.overlay = this.add.rectangle(0, 0, width, height, 0x0a140a, 0.55);
    this.overlay.setOrigin(0, 0);
    this.overlay.setDepth(0);

    const title = this.add
      .text(width / 2, height * 0.58, "Choose a Path", {
        fontFamily: "sans-serif",
        fontSize: "20px",
        color: "#f2f6ee",
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.time.delayedCall(0, () => title.setDepth(1));

    const cardWidth = Math.min(140, width * 0.28);
    const cardHeight = cardWidth * 1.35;
    const fanY = height * 0.66;
    const spread = Math.min(width * 0.3, cardWidth * 1.1);

    const count = this.cards.length;
    const startX = width / 2 - ((count - 1) * spread) / 2;

    this.cards.forEach((card, i) => {
      const x = startX + i * spread;
      // Slight arc: middle card sits a bit higher.
      const mid = (count - 1) / 2;
      const distFromMid = Math.abs(i - mid);
      const y = fanY + distFromMid * 18;
      const angle = (i - mid) * 6;

      const container = this.buildCard(
        card,
        x,
        y,
        cardWidth,
        cardHeight,
        angle
      );
      this.cardContainers.push(container);
    });

    this.skipButton = this.buildSkipButton(width / 2, height * 0.92);
  }

  private buildCard(
    card: CardData,
    x: number,
    y: number,
    w: number,
    h: number,
    angleDeg: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(2);
    container.setAngle(angleDeg);
    container.setSize(w, h);

    const borderColor = RARITY_COLOR[card.rarity];

    const bg = this.add.rectangle(0, 0, w, h, 0x1c2a1c, 0.95);
    bg.setStrokeStyle(card.rarity === "mythic" ? 4 : 3, borderColor, 1);

    const rarityLabel = this.add
      .text(0, -h / 2 + 14, RARITY_LABEL[card.rarity], {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color: "#" + borderColor.toString(16).padStart(6, "0"),
      })
      .setOrigin(0.5);

    const nameText = this.add
      .text(0, -h / 2 + 34, card.name, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#f2f6ee",
        align: "center",
        wordWrap: { width: w - 12 },
      })
      .setOrigin(0.5, 0);

    const effectText = this.add
      .text(0, -4, formatEffect(card.effect.type, card.effect.magnitude), {
        fontFamily: "sans-serif",
        fontSize: "12px",
        color: "#a8e0a0",
        align: "center",
        wordWrap: { width: w - 12 },
      })
      .setOrigin(0.5, 0);

    const tradeoffText = this.add
      .text(
        0,
        16,
        formatEffect(card.tradeoff.type, card.tradeoff.magnitude),
        {
          fontFamily: "sans-serif",
          fontSize: "11px",
          color: "#e08a8a",
          align: "center",
          wordWrap: { width: w - 12 },
        }
      )
      .setOrigin(0.5, 0);

    const slotText = this.add
      .text(0, h / 2 - 14, `slot: ${card.spriteSlot}`, {
        fontFamily: "sans-serif",
        fontSize: "10px",
        color: "#8fae8f",
      })
      .setOrigin(0.5);

    container.add([
      bg,
      rarityLabel,
      nameText,
      effectText,
      tradeoffText,
      slotText,
    ]);

    bg.setInteractive({ useHandCursor: true });
    bg.on("pointerover", () => container.setScale(1.05));
    bg.on("pointerout", () => container.setScale(1.0));
    bg.on("pointerdown", () => {
      this.onPick(card.id);
    });

    return container;
  }

  private buildSkipButton(
    x: number,
    y: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    container.setDepth(2);

    const w = 120;
    const h = 40;

    // Leaf-shaped button: an ellipse with a slight point, approximated via
    // graphics rather than a texture (programmer art only).
    const leaf = this.add.graphics();
    leaf.fillStyle(0x3a5a34, 0.95);
    leaf.lineStyle(2, 0x6b8f5a, 1);
    leaf.fillEllipse(0, 0, w, h);
    leaf.strokeEllipse(0, 0, w, h);

    const label = this.add
      .text(0, 0, "Skip", {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#f2f6ee",
      })
      .setOrigin(0.5);

    container.add([leaf, label]);

    const hitArea = new Phaser.Geom.Ellipse(0, 0, w / 2, h / 2);
    container.setInteractive(
      hitArea,
      Phaser.Geom.Ellipse.Contains
    );
    container.on("pointerover", () => container.setScale(1.05));
    container.on("pointerout", () => container.setScale(1.0));
    container.on("pointerdown", () => {
      this.onPick(null);
    });

    return container;
  }
}
