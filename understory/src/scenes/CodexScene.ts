/**
 * CodexScene — Update 3 Phase 2. Browsable reference for every combo in the
 * game: evolution branches, weapon fusions, tag synergies. Launched from
 * MetaHubScene's "Codex" button (no pause-menu exists in this build — see
 * docs/update-3-deviations.md — so the hub is the only entry point, per
 * plan §9.5's stated default).
 *
 * D7: ALL recipes are always fully readable, discovered or not — nothing is
 * hidden. Discovery state only controls: (a) the description/flavor line
 * ("???" until triggered live at least once) and (b) a NEW badge for entries
 * discovered since the codex was last closed. Recipe headers (weapon names,
 * gates, tag math) are never gated.
 *
 * No existing scroll widget in the codebase to reuse (grepped DraftScene/
 * MetaHubScene/InputController — none), so this builds a minimal drag-to-
 * scroll list: a masked viewport container translated by pointer delta,
 * clamped to content bounds.
 */
import Phaser from "phaser";
import { SCENE, REG, SynergyData, FusionData, WeaponData, PassiveData } from "../core/types";
import { normalizeWeapons } from "../core/weaponCatalog";
import weaponsJson from "../data/weapons.json";
import passivesJson from "../data/passives.json";
import fusionsJson from "../data/fusions.json";
import synergiesJson from "../data/synergies.json";
import type { SaveManager } from "../core/SaveManager";
import type { CodexState } from "../core/types";
import { PALETTE, frameKey, iconKey } from "../gfx/spriteRegistry";
import { buildAtlas } from "../gfx/PixelArt";
import { registerAllSprites } from "../gfx/sprites";

const WEAPONS = normalizeWeapons(weaponsJson);
const PASSIVES = passivesJson as unknown as PassiveData[];
const FUSIONS = fusionsJson as unknown as FusionData[];
const SYNERGY_DEFS = synergiesJson as unknown as SynergyData[];

type Tab = "evolutions" | "fusions" | "synergies";
const TABS: { id: Tab; label: string }[] = [
  { id: "evolutions", label: "Evolutions" },
  { id: "fusions", label: "Fusions" },
  { id: "synergies", label: "Synergies" },
];

function hex(n: string): number {
  return parseInt(n.replace("#", ""), 16);
}

/** "+10% area" style tokens from a StatBonus-ish object. */
function formatBonus(bonus: object): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(bonus as Record<string, number | undefined>)) {
    if (typeof v !== "number" || v === 0) continue;
    const sign = v > 0 ? "+" : "";
    parts.push(`${sign}${v}% ${k}`);
  }
  return parts.join(", ") || "no bonus";
}

interface Row {
  id: string;
  discovered: boolean;
  isNew: boolean;
  iconId: string;
  header: string;
  flavor: string;
}

export class CodexScene extends Phaser.Scene {
  private saveManager!: SaveManager;
  private meta!: { codex: CodexState; codexSeen: CodexState };
  private activeTab: Tab = "evolutions";

  private tabButtons: Phaser.GameObjects.Container[] = [];
  private listContainer!: Phaser.GameObjects.Container;
  private listMaskGfx!: Phaser.GameObjects.Graphics;
  private viewportTop = 0;
  private viewportH = 0;
  private contentH = 0;
  private dragStartY = 0;
  private containerStartY = 0;
  private dragging = false;

  constructor() {
    super(SCENE.Codex);
  }

  create(): void {
    const sm = this.registry.get(REG.saveManager) as SaveManager | undefined;
    this.saveManager = sm as SaveManager;
    this.meta = this.saveManager.load();

    try {
      registerAllSprites();
      buildAtlas(this);
    } catch (err) {
      console.warn("[CodexScene] atlas build failed, using fallback shapes", err);
    }

    const width = this.scale.width;
    const height = this.scale.height;
    this.add.rectangle(0, 0, width, height, hex(PALETTE.outline), 1).setOrigin(0, 0);

    this.add
      .text(width / 2, 16, "CODEX", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: PALETTE.white,
      })
      .setOrigin(0.5, 0);

    this.buildTabs(width);
    this.buildCloseButton(width);

    this.viewportTop = 96;
    this.viewportH = height - this.viewportTop - 60;
    this.listContainer = this.add.container(0, this.viewportTop);
    this.buildMask(width);
    this.bindDragScroll(width);

    this.rebuildList();
  }

  // --------------------------------------------------------------------
  // Tabs
  // --------------------------------------------------------------------

  private buildTabs(width: number): void {
    const tabW = width / TABS.length;
    TABS.forEach((tab, i) => {
      const x = tabW * i + tabW / 2;
      const y = 54;
      const c = this.add.container(x, y);
      const bg = this.add.rectangle(0, 0, tabW - 6, 32, hex(PALETTE.grassDark), 1);
      const label = this.add
        .text(0, 0, tab.label, {
          fontFamily: "monospace",
          fontSize: "12px",
          color: PALETTE.white,
        })
        .setOrigin(0.5);
      bg.setInteractive({ useHandCursor: true });
      bg.on("pointerdown", () => {
        this.activeTab = tab.id;
        this.rebuildList();
      });
      c.add([bg, label]);
      c.setData("bg", bg);
      this.tabButtons.push(c);
    });
    this.refreshTabHighlight();
  }

  private refreshTabHighlight(): void {
    TABS.forEach((tab, i) => {
      const bg = this.tabButtons[i].getData("bg") as Phaser.GameObjects.Rectangle;
      bg.setFillStyle(
        hex(tab.id === this.activeTab ? PALETTE.grass : PALETTE.grassDark),
        1
      );
    });
  }

  private buildCloseButton(width: number): void {
    const btn = this.add
      .text(width - 12, 16, "✕", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE.cream,
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    btn.on("pointerdown", () => this.close());
  }

  private close(): void {
    // Clears NEW badges for everything discovered so far (plan §5.1).
    this.saveManager.markCodexSeen();
    this.scene.start(SCENE.Meta);
  }

  // --------------------------------------------------------------------
  // Scroll viewport
  // --------------------------------------------------------------------

  private buildMask(width: number): void {
    this.listMaskGfx = this.make.graphics({});
    this.listMaskGfx.fillRect(0, this.viewportTop, width, this.viewportH);
    const mask = this.listMaskGfx.createGeometryMask();
    this.listContainer.setMask(mask);
  }

  private bindDragScroll(width: number): void {
    const hitZone = this.add
      .zone(0, this.viewportTop, width, this.viewportH)
      .setOrigin(0, 0)
      .setInteractive();
    hitZone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = true;
      this.dragStartY = p.y;
      this.containerStartY = this.listContainer.y;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!this.dragging) return;
      const delta = p.y - this.dragStartY;
      this.listContainer.y = this.clampScrollY(this.containerStartY + delta);
    });
    this.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.input.on("pointerupoutside", () => {
      this.dragging = false;
    });
  }

  private clampScrollY(y: number): number {
    const minY = Math.min(this.viewportTop, this.viewportTop + this.viewportH - this.contentH);
    const maxY = this.viewportTop;
    return Phaser.Math.Clamp(y, minY, maxY);
  }

  // --------------------------------------------------------------------
  // List content
  // --------------------------------------------------------------------

  private rebuildList(): void {
    this.refreshTabHighlight();
    this.listContainer.removeAll(true);
    this.listContainer.y = this.viewportTop;

    const rows = this.buildRows(this.activeTab);
    const width = this.scale.width;
    const rowH = 74;
    const gap = 6;

    rows.forEach((row, i) => {
      const y = i * (rowH + gap);
      this.listContainer.add(this.buildRow(row, width, y, rowH));
    });

    this.contentH = rows.length * (rowH + gap);
  }

  private buildRows(tab: Tab): Row[] {
    if (tab === "evolutions") return this.evolutionRows();
    if (tab === "fusions") return this.fusionRows();
    return this.synergyRows();
  }

  private evolutionRows(): Row[] {
    const passiveName = (id: string): string =>
      PASSIVES.find((p) => p.id === id)?.name ?? id;
    const rows: Row[] = [];
    for (const w of WEAPONS) {
      for (const evo of w.evolutions) {
        const discovered = this.meta.codex.evolutions.includes(evo.id);
        const seen = this.meta.codexSeen.evolutions.includes(evo.id);
        rows.push({
          id: evo.id,
          discovered,
          isNew: discovered && !seen,
          iconId: w.id,
          header: `${w.name} Lv${w.levels.length} + ${passiveName(evo.requiresPassiveId)} → ${evo.name}`,
          flavor: discovered ? evo.description : "???",
        });
      }
    }
    return rows;
  }

  private fusionRows(): Row[] {
    const weaponName = (id: string): string =>
      WEAPONS.find((w) => w.id === id)?.name ?? id;
    return FUSIONS.map((f) => {
      const discovered = this.meta.codex.fusions.includes(f.id);
      const seen = this.meta.codexSeen.fusions.includes(f.id);
      return {
        id: f.id,
        discovered,
        isNew: discovered && !seen,
        iconId: f.resultWeaponId,
        header: `${weaponName(f.inputs[0])} MAX + ${weaponName(f.inputs[1])} MAX → ${f.name}`,
        flavor: discovered ? f.description : "???",
      };
    });
  }

  private synergyRows(): Row[] {
    return SYNERGY_DEFS.map((s) => {
      const discovered = this.meta.codex.synergies.includes(s.id);
      const seen = this.meta.codexSeen.synergies.includes(s.id);
      const [t1, t2] = s.thresholds;
      const header =
        `2× ${s.tag} → ${formatBonus(t1.bonus)}` +
        (t2 ? ` · 3× → ${formatBonus(t2.bonus)}` : "");
      return {
        id: s.id,
        discovered,
        isNew: discovered && !seen,
        iconId: "", // no per-item weapon icon; tag chip drawn instead
        header,
        flavor: discovered ? s.description : "???",
      };
    });
  }

  private buildRow(row: Row, width: number, y: number, h: number): Phaser.GameObjects.Container {
    const c = this.add.container(width / 2, y + h / 2);
    const alpha = row.discovered ? 1 : 0.55;

    const bg = this.add.rectangle(0, 0, width - 20, h, hex(PALETTE.grassDark), 0.9 * alpha);
    bg.setStrokeStyle(2, hex(row.discovered ? PALETTE.gold : PALETTE.outline), 1);
    c.add(bg);

    const iconSize = 40;
    const iconX = -width / 2 + 20 + iconSize / 2 + 4;
    if (row.iconId) {
      const key = frameKey(iconKey(row.iconId), 0);
      if (this.textures.exists(key)) {
        const img = this.add.image(iconX, 0, key);
        img.setDisplaySize(iconSize, iconSize);
        img.setAlpha(alpha);
        c.add(img);
      }
    }

    const textX = iconX + iconSize / 2 + 10;
    const header = this.add.text(textX, -h / 2 + 10, row.header, {
      fontFamily: "monospace",
      fontSize: "11px",
      color: PALETTE.white,
      wordWrap: { width: width - 20 - iconSize - 40 },
    });
    header.setAlpha(alpha);
    c.add(header);

    const flavor = this.add.text(textX, header.y + header.height + 4, row.flavor, {
      fontFamily: "monospace",
      fontSize: "10px",
      color: row.discovered ? PALETTE.cream : PALETTE.grassLight,
      wordWrap: { width: width - 20 - iconSize - 40 },
      fontStyle: row.discovered ? "normal" : "italic",
    });
    flavor.setPosition(textX, -h / 2 + 10 + header.height + 4);
    c.add(flavor);

    if (row.isNew) {
      const badge = this.add
        .text(width / 2 - 16, -h / 2 + 6, "NEW", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: PALETTE.outline,
          backgroundColor: PALETTE.gold,
          padding: { x: 3, y: 1 },
        })
        .setOrigin(1, 0);
      c.add(badge);
    }

    return c;
  }
}
