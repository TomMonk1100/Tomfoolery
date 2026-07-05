/**
 * MetaHubScene — the home screen ("Meadow"). Shows Sunseeds, the Dog
 * meta-tree nodes (locked/unlockable/unlocked), an Instinct Mode toggle,
 * and the "Begin a Life" entry point into WorldScene.
 */
import Phaser from "phaser";
import { SCENE, REG, MetaNode, MetaSave } from "../core/types";
import metaTreesJson from "../data/metaTrees.json";
import { SaveManager } from "../core/SaveManager";

type MetaTrees = Record<string, MetaNode[]>;
const metaTreesData = metaTreesJson as MetaTrees;

const DOG_ANIMAL_ID = "dog";

export class MetaHubScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private meta!: MetaSave;

  private sunseedsText?: Phaser.GameObjects.Text;
  private nodeButtons: Phaser.GameObjects.Container[] = [];
  private instinctChoice = false;
  private instinctToggle?: Phaser.GameObjects.Container;

  constructor() {
    super(SCENE.Meta);
  }

  create(): void {
    const sm = this.registry.get(REG.saveManager) as SaveManager | undefined;
    if (!sm) {
      // Contract mismatch guard: SaveManager should always be registered
      // before MetaHubScene starts. Fail soft with a fresh in-scene
      // instance rather than crashing the hub.
      // eslint-disable-next-line no-console
      console.warn(
        "[MetaHubScene] REG.saveManager missing from registry; " +
          "meta progression will not persist this session."
      );
    }
    this.saveManager = sm ?? this.createFallbackSaveManager();
    this.meta = this.saveManager.load();

    this.instinctChoice = Boolean(this.registry.get("instinctChoice"));

    const width = this.scale.width;
    const height = this.scale.height;

    this.add.rectangle(0, 0, width, height, 0x0f1a0f, 1).setOrigin(0, 0);

    this.buildTitle(width);
    this.buildSunseedsDisplay(width);
    this.buildMetaTree(width, height);
    this.buildInstinctToggle(width, height);
    this.buildBeginButton(width, height);
  }

  private createFallbackSaveManager(): SaveManager {
    // Construct one locally so the hub still renders even if the wiring
    // scene forgot to register REG.saveManager. Not persisted to the
    // registry — this is a last-resort fallback, not a replacement for
    // proper wiring.
    return new SaveManager();
  }

  private buildTitle(width: number): void {
    this.add
      .text(width / 2, 40, "Understory", {
        fontFamily: "sans-serif",
        fontSize: "30px",
        color: "#f2f6ee",
      })
      .setOrigin(0.5, 0);
  }

  private buildSunseedsDisplay(width: number): void {
    this.sunseedsText = this.add
      .text(width / 2, 82, `Sunseeds: ${this.meta.sunseeds}`, {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#f2d675",
      })
      .setOrigin(0.5, 0);
  }

  private refreshSunseedsDisplay(): void {
    this.sunseedsText?.setText(`Sunseeds: ${this.meta.sunseeds}`);
  }

  // --------------------------------------------------------------------
  // Meta tree
  // --------------------------------------------------------------------

  private buildMetaTree(width: number, height: number): void {
    const nodes = metaTreesData[DOG_ANIMAL_ID] ?? [];

    const heading = this.add
      .text(width / 2, 118, "Dog — Meta Tree", {
        fontFamily: "sans-serif",
        fontSize: "16px",
        color: "#a8e0a0",
      })
      .setOrigin(0.5, 0);
    void heading;

    const topY = 150;
    const rowHeight = 56;
    const marginX = 20;
    const btnWidth = width - marginX * 2;

    nodes.forEach((node, i) => {
      const y = topY + i * rowHeight;
      const btn = this.buildNodeButton(node, marginX, y, btnWidth, rowHeight - 8);
      this.nodeButtons.push(btn);
    });
  }

  private nodeState(node: MetaNode): "locked" | "unlockable" | "unlocked" {
    if (this.meta.unlockedNodes.includes(node.id)) return "unlocked";
    const prereqsMet = node.prerequisiteIds.every((id) =>
      this.meta.unlockedNodes.includes(id)
    );
    if (prereqsMet && this.meta.sunseeds >= node.costSunseeds) {
      return "unlockable";
    }
    return "locked";
  }

  private buildNodeButton(
    node: MetaNode,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x + w / 2, y + h / 2);

    const state = this.nodeState(node);
    const colors: Record<string, number> = {
      locked: 0x2a2a2a,
      unlockable: 0x3a5a34,
      unlocked: 0x4f7d3a,
    };
    const strokeColors: Record<string, number> = {
      locked: 0x4a4a4a,
      unlockable: 0x6b8f5a,
      unlocked: 0xf2d675,
    };

    const bg = this.add.rectangle(0, 0, w, h, colors[state], 1);
    bg.setStrokeStyle(2, strokeColors[state], 1);

    const nameText = this.add
      .text(-w / 2 + 12, -h / 2 + 6, node.name, {
        fontFamily: "sans-serif",
        fontSize: "13px",
        color: "#f2f6ee",
      })
      .setOrigin(0, 0);

    const effectText = this.add
      .text(-w / 2 + 12, h / 2 - 18, node.effect, {
        fontFamily: "sans-serif",
        fontSize: "10px",
        color: "#c8dcc0",
        wordWrap: { width: w - 24 },
      })
      .setOrigin(0, 0);

    const statusLabel =
      state === "unlocked"
        ? "Unlocked"
        : state === "unlockable"
        ? `Unlock — ${node.costSunseeds} Sunseeds`
        : `Locked — ${node.costSunseeds} Sunseeds`;

    const statusText = this.add
      .text(w / 2 - 12, -h / 2 + 6, statusLabel, {
        fontFamily: "sans-serif",
        fontSize: "11px",
        color:
          state === "unlocked"
            ? "#f2d675"
            : state === "unlockable"
            ? "#a8e0a0"
            : "#8a8a8a",
      })
      .setOrigin(1, 0);

    container.add([bg, nameText, effectText, statusText]);

    if (state === "unlockable") {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(0x4a6a44));
      bg.on("pointerout", () => bg.setFillStyle(colors[state]));
      bg.on("pointerdown", () => this.tryUnlock(node));
    }

    return container;
  }

  private tryUnlock(node: MetaNode): void {
    if (this.meta.unlockedNodes.includes(node.id)) return;
    const prereqsMet = node.prerequisiteIds.every((id) =>
      this.meta.unlockedNodes.includes(id)
    );
    if (!prereqsMet || this.meta.sunseeds < node.costSunseeds) return;

    this.meta.sunseeds -= node.costSunseeds;
    this.saveManager.save(this.meta);
    this.saveManager.unlockNode(node.id);
    this.meta = this.saveManager.load();

    this.refreshSunseedsDisplay();
    this.rebuildMetaTree();
  }

  private rebuildMetaTree(): void {
    for (const btn of this.nodeButtons) btn.destroy();
    this.nodeButtons = [];
    const nodes = metaTreesData[DOG_ANIMAL_ID] ?? [];
    const topY = 150;
    const rowHeight = 56;
    const marginX = 20;
    const btnWidth = this.scale.width - marginX * 2;

    nodes.forEach((node, i) => {
      const y = topY + i * rowHeight;
      const btn = this.buildNodeButton(
        node,
        marginX,
        y,
        btnWidth,
        rowHeight - 8
      );
      this.nodeButtons.push(btn);
    });
  }

  // --------------------------------------------------------------------
  // Instinct Mode toggle
  // --------------------------------------------------------------------

  private buildInstinctToggle(width: number, height: number): void {
    const y = height - 140;
    const container = this.add.container(width / 2, y);

    const w = 220;
    const h = 40;

    const bg = this.add.rectangle(
      0,
      0,
      w,
      h,
      this.instinctChoice ? 0x4f7d3a : 0x2a2a2a,
      1
    );
    bg.setStrokeStyle(2, 0x6b8f5a, 1);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add
      .text(0, 0, `Instinct Mode: ${this.instinctChoice ? "On" : "Off"}`, {
        fontFamily: "sans-serif",
        fontSize: "14px",
        color: "#f2f6ee",
      })
      .setOrigin(0.5);

    container.add([bg, label]);
    this.instinctToggle = container;

    bg.on("pointerdown", () => {
      this.instinctChoice = !this.instinctChoice;
      this.registry.set("instinctChoice", this.instinctChoice);
      bg.setFillStyle(this.instinctChoice ? 0x4f7d3a : 0x2a2a2a);
      label.setText(`Instinct Mode: ${this.instinctChoice ? "On" : "Off"}`);
    });
  }

  // --------------------------------------------------------------------
  // Begin a Life
  // --------------------------------------------------------------------

  private buildBeginButton(width: number, height: number): void {
    const btnWidth = Math.min(260, width * 0.75);
    const btnHeight = 56;
    const x = width / 2;
    const y = height - 60;

    const bg = this.add.rectangle(x, y, btnWidth, btnHeight, 0x3a5a34, 1);
    bg.setStrokeStyle(3, 0xf2d675, 1);
    bg.setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x, y, "Begin a Life", {
        fontFamily: "sans-serif",
        fontSize: "18px",
        color: "#f2f6ee",
      })
      .setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x4a6a44));
    bg.on("pointerout", () => bg.setFillStyle(0x3a5a34));
    bg.on("pointerdown", () => {
      this.scene.start(SCENE.World, { instinct: this.instinctChoice });
    });

    void label;
  }
}
