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

    this.add.rectangle(0, 0, width, height, hex(PALETTE.outline), 1).setOrigin(0, 0);

    this.buildTitle(width);
    this.buildSunseedsDisplay(width);
    this.buildQualityToggle(width);
    this.buildAnimalSelect(width);
    this.buildMetaTree(width, height);
    this.buildButtons(width, height);
  }

  // --------------------------------------------------------------------
  // Header
  // --------------------------------------------------------------------

  private buildTitle(width: number): void {
    this.add
      .text(width / 2, 16, "UNDERSTORY", {
        fontFamily: "monospace",
        fontSize: "26px",
        color: PALETTE.white,
      })
      .setOrigin(0.5, 0);

    this.add
      .text(width / 2, 44, "Nest & Fang", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.gold,
      })
      .setOrigin(0.5, 0);
  }

  private buildSunseedsDisplay(width: number): void {
    this.sunseedsText = this.add
      .text(width / 2, 66, `Sunseeds: ${this.meta.sunseeds}`, {
        fontFamily: "monospace",
        fontSize: "14px",
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
    const panelH = 118;
    const y = 94;
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

    const bg = this.add.rectangle(0, 0, w, h, hex(PALETTE.darkBrown), 0.9);
    bg.setStrokeStyle(2, hex(PALETTE.brown), 1);
    this.animalPanelBgs[id] = bg;

    const spriteKey = animal.spriteKey ?? `animal_${id}`;
    let sprite: Phaser.GameObjects.GameObject;
    if (this.textures.exists(frameKey(spriteKey))) {
      const s = this.add.sprite(0, -h / 2 + 34, frameKey(spriteKey));
      s.setDisplaySize(24 * 3, 24 * 3);
      playAnim(s, spriteKey, "idle");
      sprite = s;
    } else {
      const s = this.add.ellipse(0, -h / 2 + 34, 40, 30, hex(PALETTE.cream));
      s.setStrokeStyle(2, hex(PALETTE.brown));
      sprite = s;
    }

    const nameText = this.add
      .text(0, 4, animal.name, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: PALETTE.white,
      })
      .setOrigin(0.5, 0);

    const blurb = this.add
      .text(0, 20, ANIMAL_BLURB[id], {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.cream,
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
          fontSize: "8px",
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
      .text(width / 2, 222, this.treeHeadingText(), {
        fontFamily: "monospace",
        fontSize: "14px",
        color: PALETTE.leaf,
      })
      .setOrigin(0.5, 0);

    this.treeContainer = this.add.container(0, 0);

    const topY = 250;
    const rowHeight = 50;
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
      locked: hex(PALETTE.outline),
      unlockable: hex(PALETTE.grass),
      unlocked: hex(PALETTE.grassDark),
    };
    const strokeColors: Record<string, number> = {
      locked: hex(PALETTE.brown),
      unlockable: hex(PALETTE.grassLight),
      unlocked: hex(PALETTE.gold),
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
    const bigH = 52;
    const x = width / 2;
    const bigY = height - 76;

    const bigBg = this.add.rectangle(x, bigY, bigW, bigH, hex(PALETTE.grass), 1);
    bigBg.setStrokeStyle(3, hex(PALETTE.gold), 1);
    bigBg.setInteractive({ useHandCursor: true });

    const bigLabel = this.add
      .text(x, bigY, "Begin Life", {
        fontFamily: "monospace",
        fontSize: "18px",
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
      .text(x, smallY, "Instinct Mode", {
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
