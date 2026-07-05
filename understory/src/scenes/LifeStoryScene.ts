/**
 * LifeStoryScene — Life Story run-summary screen. Covers Screen 2 (Stats)
 * and Screen 3 (Card Value Breakdown) from GDD §5 in a single stacked,
 * scrollable layout (portrait, thumb-scrollable via drag), plus a Sunseeds
 * summary and a "Return to Meadow" button.
 */
import Phaser from "phaser";
import { SCENE, REG, PlayerState, CardData } from "../core/types";
import cardsJson from "../data/cards.json";
import {
  scoreFromStats,
  sunseedsFromScore,
  statCategories,
  cardBreakdown,
} from "../core/RunStats";
import type { SaveManager } from "../core/SaveManager";

export interface LifeStorySceneData {
  player: PlayerState;
}

const cardsData = cardsJson as CardData[];

export class LifeStoryScene extends Phaser.Scene {
  private player!: PlayerState;

  private contentContainer!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private maxScroll = 0;
  private dragStartY = 0;
  private scrollStartY = 0;
  private isDragging = false;

  private sunseedsCreditedFor: PlayerState | null = null;

  constructor() {
    super(SCENE.LifeStory);
  }

  init(data: LifeStorySceneData): void {
    this.player = data.player;
  }

  create(): void {
    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(0, 0, width, height, 0x142014, 1).setOrigin(0, 0);

    // Credit sunseeds to the meta save exactly once per LifeStoryScene
    // instance/player object (guards against double-credit on scene resize
    // or accidental re-create without re-init).
    const score = scoreFromStats(this.player);
    const sunseedsEarned = sunseedsFromScore(score);

    if (this.sunseedsCreditedFor !== this.player) {
      const sm = this.registry.get(REG.saveManager) as
        | SaveManager
        | undefined;
      sm?.addSunseeds(sunseedsEarned);
      this.sunseedsCreditedFor = this.player;
    }

    this.contentContainer = this.add.container(0, 0);

    let y = 24;
    y = this.renderHeader(y, width, score, sunseedsEarned);
    y = this.renderStatsSection(y, width);
    y = this.renderCardBreakdownSection(y, width);
    y += 100; // bottom padding so the return button clears the last row

    this.maxScroll = Math.max(0, y - height + 90);

    this.buildReturnButton(width, height);
    this.setupScrolling(width, height);
  }

  // --------------------------------------------------------------------
  // Sections
  // --------------------------------------------------------------------

  private renderHeader(
    startY: number,
    width: number,
    score: number,
    sunseeds: number
  ): number {
    let y = startY;

    const title = this.add.text(width / 2, y, "Life Story", {
      fontFamily: "sans-serif",
      fontSize: "26px",
      color: "#f2f6ee",
    });
    title.setOrigin(0.5, 0);
    this.contentContainer.add(title);
    y += 44;

    const scoreText = this.add.text(width / 2, y, `Run Score: ${score}`, {
      fontFamily: "sans-serif",
      fontSize: "16px",
      color: "#c8dcc0",
    });
    scoreText.setOrigin(0.5, 0);
    this.contentContainer.add(scoreText);
    y += 26;

    const sunseedsText = this.add.text(
      width / 2,
      y,
      `Sunseeds earned: ${sunseeds}`,
      {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#f2d675",
      }
    );
    sunseedsText.setOrigin(0.5, 0);
    this.contentContainer.add(sunseedsText);
    y += 36;

    return y;
  }

  private renderStatsSection(startY: number, width: number): number {
    let y = startY;
    const marginX = 20;

    y = this.sectionHeading("Stats", y, width);

    const categories = statCategories(this.player.stats);
    for (const cat of categories) {
      const catHeading = this.add.text(marginX, y, cat.category, {
        fontFamily: "sans-serif",
        fontSize: "15px",
        color: "#a8e0a0",
      });
      this.contentContainer.add(catHeading);
      y += 24;

      for (const [label, value] of cat.rows) {
        const row = this.add.text(marginX + 12, y, `${label}: ${value}`, {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#e6f0e0",
        });
        this.contentContainer.add(row);
        y += 20;
      }
      y += 8;
    }

    return y + 12;
  }

  private renderCardBreakdownSection(startY: number, width: number): number {
    let y = startY;
    const marginX = 20;

    y = this.sectionHeading("Card Value Breakdown", y, width);

    const rows = cardBreakdown(this.player, cardsData);

    if (rows.length === 0) {
      const empty = this.add.text(
        marginX,
        y,
        "No cards drafted this run",
        {
          fontFamily: "sans-serif",
          fontSize: "13px",
          color: "#8fae8f",
        }
      );
      this.contentContainer.add(empty);
      y += 26;
      return y;
    }

    // Column header
    const header = this.add.text(
      marginX,
      y,
      "Card              Stacks   Value   Cost   Net",
      {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#8fae8f",
      }
    );
    this.contentContainer.add(header);
    y += 20;

    for (const row of rows) {
      const netColor = row.net >= 0 ? "#a8e0a0" : "#e08a8a";
      const nameLine = this.add.text(marginX, y, row.name, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#f2f6ee",
      });
      this.contentContainer.add(nameLine);
      y += 18;

      const detailLine = this.add.text(
        marginX + 12,
        y,
        `x${row.stacks}  value +${row.value}  cost -${row.cost}  net ${
          row.net >= 0 ? "+" : ""
        }${row.net}`,
        {
          fontFamily: "monospace",
          fontSize: "12px",
          color: netColor,
        }
      );
      this.contentContainer.add(detailLine);
      y += 24;
    }

    return y + 12;
  }

  private sectionHeading(text: string, y: number, width: number): number {
    const heading = this.add.text(width / 2, y, text, {
      fontFamily: "sans-serif",
      fontSize: "18px",
      color: "#f2f6ee",
    });
    heading.setOrigin(0.5, 0);
    this.contentContainer.add(heading);
    return y + 30;
  }

  // --------------------------------------------------------------------
  // Scroll handling (drag-to-scroll, stacked & readable if scroll unused)
  // --------------------------------------------------------------------

  private setupScrolling(width: number, height: number): void {
    if (this.maxScroll <= 0) return;

    const dragZone = this.add.zone(0, 0, width, height).setOrigin(0, 0);
    dragZone.setInteractive();
    dragZone.setDepth(-1);

    dragZone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = p.y;
      this.scrollStartY = this.scrollY;
    });

    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const delta = p.y - this.dragStartY;
      this.scrollY = Phaser.Math.Clamp(
        this.scrollStartY + delta,
        -this.maxScroll,
        0
      );
      this.contentContainer.setY(this.scrollY);
    });

    this.input.on("pointerup", () => {
      this.isDragging = false;
    });
    this.input.on("pointerupoutside", () => {
      this.isDragging = false;
    });

    this.input.on(
      "wheel",
      (
        _pointer: Phaser.Input.Pointer,
        _objects: unknown,
        _dx: number,
        dy: number
      ) => {
        this.scrollY = Phaser.Math.Clamp(
          this.scrollY - dy,
          -this.maxScroll,
          0
        );
        this.contentContainer.setY(this.scrollY);
      }
    );
  }

  private buildReturnButton(width: number, height: number): void {
    const btnWidth = Math.min(240, width * 0.7);
    const btnHeight = 52;
    const x = width / 2;
    const y = height - 44;

    const bg = this.add.rectangle(x, y, btnWidth, btnHeight, 0x3a5a34, 1);
    bg.setStrokeStyle(2, 0x6b8f5a, 1);
    bg.setDepth(10);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x, y, "Return to Meadow", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#f2f6ee",
      })
      .setOrigin(0.5)
      .setDepth(10);

    bg.on("pointerover", () => bg.setFillStyle(0x4a6a44));
    bg.on("pointerout", () => bg.setFillStyle(0x3a5a34));
    bg.on("pointerdown", () => {
      this.scene.start(SCENE.Meta);
    });

    void label;
  }
}
