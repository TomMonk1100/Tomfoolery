/**
 * MetaHubScene — "The Meadow": run-start hub. Lets the player pick their
 * animal, spend Sunseeds on that animal's meta-tree, then launches a run via
 * "Begin Life" (normal) or "Instinct Mode" (AI-driven, XP-penalized).
 *
 * DECISIONS:
 * - metaTrees.json keys are "dog"/"cat"/"rabbit" with node ids that are
 *   already unique per species (e.g. "warm-welcome" for dog vs
 *   "silent-approach" for cat) — NOT species-prefixed strings. SaveManager's
 *   `unlockedNodes: string[]` is a flat list shared across all three trees;
 *   since ids don't collide across species this is safe as-is and requires
 *   no migration. Preserved the exact purchase logic (prereqs + cost check)
 *   from the previous single-species version, just re-pointed at the
 *   selected animal's node list.
 * - Selection is a scene-local var (`selectedAnimalId`), default "dog", not
 *   persisted — matches "Selection stored in a scene-local var" in the spec.
 * - Audio: previous MetaHubScene never unlocked audio itself (WorldScene
 *   does it on first pointerdown). Kept that behavior — no audio calls here
 *   beyond reading REG.audio indirectly through nothing (out of scope).
 * - animals.json is read directly for name/sprite/speed; kit blurbs and
 *   starting-weapon icons are hand-authored per CONTRACTS.md weapon list
 *   (dog starts bark-blast, cat starts pounce-slash, rabbit starts
 *   thumper-quake — matches animals.json startingWeaponId already).
 */
import Phaser from "phaser";
import {
  SCENE,
  REG,
  MetaNode,
  MetaSave,
  AnimalData,
  WeaponData,
  QualityPref,
} from "../core/types";
import { Quality } from "../core/Quality";
import { normalizeWeapons } from "../core/weaponCatalog";
import metaTreesJson from "../data/metaTrees.json";
import animalsJson from "../data/animals.json";
import weaponsJson from "../data/weapons.json";
import { SaveManager } from "../core/SaveManager";
import { PALETTE, frameKey, iconKey } from "../gfx/spriteRegistry";
import { buildAtlas, playAnim } from "../gfx/PixelArt";
import { registerAllSprites } from "../gfx/sprites";

type MetaTrees = Record<string, MetaNode[]>;
const metaTreesData = metaTreesJson as MetaTrees;
const ANIMALS = animalsJson as unknown as Record<string, AnimalData>;
const WEAPONS = normalizeWeapons(weaponsJson);

const ANIMAL_IDS = ["dog", "cat", "rabbit"] as const;
type AnimalId = (typeof ANIMAL_IDS)[number];

const ANIMAL_BLURB: Record<AnimalId, string> = {
  dog: "Loyal brawler — barks, fetch & zoomies",
  cat: "Precision hunter — crits & pounces",
  rabbit: "Lucky swarm-clearer — thumps & clovers",
};

const UI = {
  bg: 0x101d14,
  panel: 0x203520,
  panelDark: 0x172619,
  panelSoft: 0x2d4628,
  dimLine: 0x42573a,
  gold: 0xf0c95a,
};

function hex(n: string): number {
  return parseInt(n.replace("#", ""), 16);
}

export class MetaHubScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private meta!: MetaSave;

  private sunseedsText?: Phaser.GameObjects.Text;
  private nodeButtons: Phaser.GameObjects.Container[] = [];
  private instinctChoice = false;

  private selectedAnimalId: AnimalId = "dog";
  private animalPanels: Partial<Record<AnimalId, Phaser.GameObjects.Container>> = {};
  private animalPanelBgs: Partial<Record<AnimalId, Phaser.GameObjects.Rectangle>> = {};

  private treeContainer?: Phaser.GameObjects.Container;
  private treeHeading?: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE.Meta);
  }

  create(): void {
    const sm = this.registry.get(REG.saveManager) as SaveManager | undefined;
    if (!sm) {
      // eslint-disable-next-line no-console
      console.warn(
        "[MetaHubScene] REG.saveManager missing from registry; " +
          "meta progression will not persist this session."
      );
    }
    this.saveManager = sm ?? new SaveManager();
    this.meta = this.saveManager.load();

    this.instinctChoice = Boolean(this.registry.get("instinctChoice"));

    // Bake the atlas so animal sprites/icons are available for the panels
    // and meta tree without depending on WorldScene having run first.
    try {
      registerAllSprites();
      buildAtlas(this);
    } catch (err) {
      console.warn("[MetaHubScene] atlas build failed, using fallback shapes", err);
    }

    const width = this.scale.width;
    const height = this.scale.height;

    this.buildBackdrop(width, height);

    this.buildTitle(width);
    this.buildSunseedsDisplay(width);
    this.buildQualityToggle(width);
    this.buildAnimalSelect(width);
    this.buildMetaTree(width, height);
    this.buildButtons(width, height);
  }

  private buildBackdrop(width: number, height: number): void {
    this.add.rectangle(0, 0, width, height, UI.bg, 1).setOrigin(0, 0);
    this.add.circle(84, 112, 150, 0x315936, 0.22);
    this.add.circle(width - 56, height - 128, 190, 0x4f3f1e, 0.28);
    this.add.rectangle(12, 12, width - 24, height - 24, UI.panelDark, 0.26)
      .setStrokeStyle(1, UI.dimLine, 0.75);
    for (let y = 120; y < height - 110; y += 36) {
      this.add.line(0, 0, 24, y, width - 24, y, 0x2b3c2c, 0.22).setOrigin(0, 0);
    }
  }

  // --------------------------------------------------------------------
  // Header
  // --------------------------------------------------------------------

  private buildTitle(width: number): void {
    this.add
      .text(width / 2, 12, "A SMALL WILD LIFE", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.gold,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 28, "UNDERSTORY", {
        fontFamily: "monospace",
        fontSize: "34px",
        color: PALETTE.white,
      })
      .setOrigin(0.5, 0)
      .setShadow(0, 3, "#000000", 4);

    this.add
      .text(width / 2, 67, "Choose a creature. Grow a tree. Begin a life.", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.cream,
      })
      .setOrigin(0.5, 0);
  }

  private buildSunseedsDisplay(width: number): void {
    this.add.rectangle(width / 2, 94, 172, 28, UI.panel, 0.92)
      .setStrokeStyle(1, UI.gold, 0.65);
    this.sunseedsText = this.add
      .text(width / 2, 86, `Sunseeds: ${this.meta.sunseeds}`, {
        fontFamily: "monospace",
        fontSize: "15px",
        color: PALETTE.gold,
      })
      .setOrigin(0.5, 0);
  }

  private refreshSunseedsDisplay(): void {
    this.sunseedsText?.setText(`Sunseeds: ${this.meta.sunseeds}`);
  }

  /** Update 3 (D10): cycle graphics quality auto -> high -> low, persisted. */
  private buildQualityToggle(width: number): void {
    const label = (): string =>
      `GFX: ${(this.meta.quality ?? "auto").toUpperCase()}`;
    const txt = this.add
      .text(width - 10, 16, label(), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.cream,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    txt.on("pointerover", () => txt.setColor(PALETTE.gold));
    txt.on("pointerout", () => txt.setColor(PALETTE.cream));
    txt.on("pointerdown", () => {
      const order: QualityPref[] = ["auto", "high", "low"];
      const next =
        order[(order.indexOf(this.meta.quality ?? "auto") + 1) % order.length];
      this.meta.quality = next;
      this.saveManager.save(this.meta);
      Quality.setPref(next);
      txt.setText(label());
    });
  }

  // --------------------------------------------------------------------
  // Animal select
  // --------------------------------------------------------------------

  private buildAnimalSelect(width: number): void {
    const panelW = Math.floor((width - 24 - 16) / 3); // 12px margins + 8px gaps x2
    const panelH = 132;
    const y = 126;
    const marginX = 12;
    const gap = 8;

    ANIMAL_IDS.forEach((id, i) => {
      const x = marginX + i * (panelW + gap);
      const panel = this.buildAnimalPanel(id, x, y, panelW, panelH);
      this.animalPanels[id] = panel;
    });

    this.refreshAnimalSelection();
  }

  private buildAnimalPanel(
    id: AnimalId,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const animal = ANIMALS[id];
    const container = this.add.container(x + w / 2, y + h / 2);

    const bg = this.add.rectangle(0, 0, w, h, UI.panel, 0.96);
    bg.setStrokeStyle(2, UI.dimLine, 1);
    this.animalPanelBgs[id] = bg;

    const spriteKey = animal.spriteKey ?? `animal_${id}`;
    let sprite: Phaser.GameObjects.GameObject;
    if (this.textures.exists(frameKey(spriteKey))) {
      const s = this.add.sprite(0, -h / 2 + 34, frameKey(spriteKey));
      s.setDisplaySize(24 * 3.2, 24 * 3.2);
      playAnim(s, spriteKey, "idle");
      sprite = s;
    } else {
      const s = this.add.ellipse(0, -h / 2 + 34, 40, 30, hex(PALETTE.cream));
      s.setStrokeStyle(2, hex(PALETTE.brown));
      sprite = s;
    }

    const nameText = this.add
      .text(0, 6, animal.name, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.white,
      })
      .setOrigin(0.5, 0);

    const blurb = this.add
      .text(0, 27, ANIMAL_BLURB[id], {
        fontFamily: "monospace",
        fontSize: "9px",
        color: "#dce7c9",
        align: "center",
        wordWrap: { width: w - 10 },
      })
      .setOrigin(0.5, 0);

    const startWeapon = WEAPONS.find(
      (wp) => wp.id === animal.startingWeaponId
    );
    let weaponIcon: Phaser.GameObjects.GameObject;
    if (startWeapon && this.textures.exists(frameKey(iconKey(startWeapon.id)))) {
      const img = this.add.image(0, h / 2 - 12, frameKey(iconKey(startWeapon.id)));
      img.setDisplaySize(16, 16);
      weaponIcon = img;
    } else {
      const label = this.add
        .text(0, h / 2 - 18, startWeapon?.name ?? "", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: PALETTE.grassLight,
        })
        .setOrigin(0.5, 0);
      weaponIcon = label;
    }

    container.add([bg, sprite, nameText, blurb, weaponIcon]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on("pointerdown", () => {
      this.selectedAnimalId = id;
      this.refreshAnimalSelection();
      this.rebuildMetaTree();
    });

    return container;
  }

  private refreshAnimalSelection(): void {
    for (const id of ANIMAL_IDS) {
      const bg = this.animalPanelBgs[id];
      if (!bg) continue;
      const selected = id === this.selectedAnimalId;
      bg.setStrokeStyle(selected ? 3 : 2, selected ? hex(PALETTE.gold) : hex(PALETTE.brown), 1);
      bg.setFillStyle(hex(PALETTE.darkBrown), selected ? 1 : 0.9);
    }
  }

  // --------------------------------------------------------------------
  // Meta tree
  // --------------------------------------------------------------------

  private buildMetaTree(width: number, height: number): void {
    void height;
    const nodes = metaTreesData[this.selectedAnimalId] ?? [];

    this.treeHeading = this.add
      .text(width / 2, 274, this.treeHeadingText(), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE.leaf,
      })
      .setOrigin(0.5, 0);

    this.treeContainer = this.add.container(0, 0);

    const topY = 304;
    const rowHeight = 52;
    const marginX = 16;
    const btnWidth = width - marginX * 2;

    nodes.forEach((node, i) => {
      const y = topY + i * rowHeight;
      const btn = this.buildNodeButton(node, marginX, y, btnWidth, rowHeight - 8);
      this.nodeButtons.push(btn);
      this.treeContainer?.add(btn);
    });
  }

  private treeHeadingText(): string {
    const name = ANIMALS[this.selectedAnimalId]?.name ?? this.selectedAnimalId;
    return `${name} — Meta Tree`;
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
      locked: UI.panelDark,
      unlockable: UI.panelSoft,
      unlocked: 0x254529,
    };
    const strokeColors: Record<string, number> = {
      locked: UI.dimLine,
      unlockable: UI.gold,
      unlocked: hex(PALETTE.grassLight),
    };

    const bg = this.add.rectangle(0, 0, w, h, colors[state], 1);
    bg.setStrokeStyle(2, strokeColors[state], 1);

    const nameText = this.add
      .text(-w / 2 + 10, -h / 2 + 5, node.name, {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.white,
      })
      .setOrigin(0, 0);

    const effectText = this.add
      .text(-w / 2 + 10, h / 2 - 16, node.effect, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.cream,
        wordWrap: { width: w - 20 },
      })
      .setOrigin(0, 0);

    const statusLabel =
      state === "unlocked"
        ? "Unlocked"
        : state === "unlockable"
        ? `Unlock — ${node.costSunseeds}`
        : `Locked — ${node.costSunseeds}`;

    const statusText = this.add
      .text(w / 2 - 10, -h / 2 + 5, statusLabel, {
        fontFamily: "monospace",
        fontSize: "10px",
        color:
          state === "unlocked"
            ? PALETTE.gold
            : state === "unlockable"
            ? PALETTE.grassLight
            : PALETTE.brown,
      })
      .setOrigin(1, 0);

    container.add([bg, nameText, effectText, statusText]);

    if (state === "unlockable") {
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerover", () => bg.setFillStyle(hex(PALETTE.grassLight)));
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
    this.treeHeading?.setText(this.treeHeadingText());

    const nodes = metaTreesData[this.selectedAnimalId] ?? [];
    const topY = 250;
    const rowHeight = 50;
    const marginX = 16;
    const btnWidth = this.scale.width - marginX * 2;

    nodes.forEach((node, i) => {
      const y = topY + i * rowHeight;
      const btn = this.buildNodeButton(node, marginX, y, btnWidth, rowHeight - 8);
      this.nodeButtons.push(btn);
      this.treeContainer?.add(btn);
    });
  }

  // --------------------------------------------------------------------
  // Begin Life / Instinct Mode
  // --------------------------------------------------------------------

  private buildButtons(width: number, height: number): void {
    const bigW = Math.min(280, width * 0.8);
    const bigH = 56;
    const x = width / 2;
    const bigY = height - 82;

    const bigBg = this.add.rectangle(x, bigY, bigW, bigH, UI.panelSoft, 1);
    bigBg.setStrokeStyle(3, UI.gold, 1);
    bigBg.setInteractive({ useHandCursor: true });

    const bigLabel = this.add
      .text(x, bigY, "Begin Life", {
        fontFamily: "monospace",
        fontSize: "19px",
        color: PALETTE.white,
      })
      .setOrigin(0.5);

    bigBg.on("pointerover", () => bigBg.setFillStyle(hex(PALETTE.grassLight)));
    bigBg.on("pointerout", () => bigBg.setFillStyle(hex(PALETTE.grass)));
    bigBg.on("pointerdown", () => {
      this.scene.start(SCENE.World, {
        instinct: false,
        animalId: this.selectedAnimalId,
      });
    });
    void bigLabel;

    const smallW = Math.min(220, width * 0.65);
    const smallH = 36;
    const smallY = height - 30;

    const smallBg = this.add.rectangle(x, smallY, smallW, smallH, hex(PALETTE.outline), 0.9);
    smallBg.setStrokeStyle(2, hex(PALETTE.purple), 1);
    smallBg.setInteractive({ useHandCursor: true });

    const smallLabel = this.add
      .text(x, smallY, "Instinct Mode: Auto-run", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.cream,
      })
      .setOrigin(0.5);

    smallBg.on("pointerover", () => smallBg.setFillStyle(hex(PALETTE.purple), 0.5));
    smallBg.on("pointerout", () => smallBg.setFillStyle(hex(PALETTE.outline), 0.9));
    smallBg.on("pointerdown", () => {
      this.scene.start(SCENE.World, {
        instinct: true,
        animalId: this.selectedAnimalId,
      });
    });
    void smallLabel;

    this.buildCodexButton(width);
  }

  /** Update 3 (Phase 2 §5.3): Codex entry point. No pause menu exists in
   * this build (grepped WorldScene/HUD — none), so the hub is the sole
   * entry point per the plan's stated default; logged in
   * docs/update-3-deviations.md. */
  private buildCodexButton(width: number): void {
    const txt = this.add
      .text(10, 16, "📖 Codex", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: PALETTE.cream,
      })
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    txt.on("pointerover", () => txt.setColor(PALETTE.gold));
    txt.on("pointerout", () => txt.setColor(PALETTE.cream));
    txt.on("pointerdown", () => this.scene.start(SCENE.Codex));
    void width;
  }
}
