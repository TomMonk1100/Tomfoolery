/**
 * WorldGenSystem — generates the fixed 40x40 tile grid, renders it as simple
 * Phaser rectangles, maintains a fog-of-war RenderTexture revealed around the
 * player, and implements WorldView so other systems can query tiles/nodes.
 *
 * Validation (per dev-plan Step 6 resolution #3): a grid is valid iff it has
 * >= 8 forage nodes AND >= 1 nest zone, each >= 3 tiles from any other node
 * of the SAME type. On failure, regenerate once with a new seed; if the
 * second attempt also fails, load the static src/data/fallback-layout.json.
 */
import Phaser from "phaser";
import { GameContext, System, WorldView, Vec2 } from "../core/context";
import { TileType, WorldTile, WORLD_SIZE, TILE_PX } from "../core/types";
import fallbackLayout from "../data/fallback-layout.json";

const MIN_FORAGE_NODES = 8;
const MIN_NEST_ZONES = 1;
const MIN_SAME_TYPE_SPACING = 3;

const TILE_COLORS: Record<TileType, number> = {
  grass: 0x4a7c3f,
  obstacle: 0x5b4636,
  forage: 0xd9a441,
  nest: 0xc76b4a,
  water: 0x3a6ea5,
};

/** Simple seeded PRNG (mulberry32) so regeneration attempts are reproducible per seed. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Placement {
  col: number;
  row: number;
}

export class WorldGenSystem implements System, WorldView {
  size = WORLD_SIZE;
  tilePx = TILE_PX;

  private scene: Phaser.Scene;
  private ctx: GameContext;
  private tiles: WorldTile[][] = []; // [row][col]
  private container!: Phaser.GameObjects.Container;
  private fogTexture!: Phaser.GameObjects.RenderTexture;
  private fogGraphics!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.tiles = this.generateValidGrid();
    this.renderTiles();
    this.setupFog();
  }

  // --------------------------------------------------------------------
  // Generation
  // --------------------------------------------------------------------

  private generateValidGrid(): WorldTile[][] {
    const seed1 = Date.now() & 0xffffffff;
    let grid = this.generateGrid(seed1);
    if (this.validateGrid(grid)) return grid;

    if (import.meta.env.DEV) {
      console.warn("[WorldGenSystem] first grid failed validation, regenerating with new seed");
    }

    const seed2 = (seed1 ^ 0x9e3779b9) >>> 0;
    grid = this.generateGrid(seed2);
    if (this.validateGrid(grid)) return grid;

    if (import.meta.env.DEV) {
      console.warn(
        "[WorldGenSystem] second grid failed validation, falling back to fallback-layout.json"
      );
    }
    return this.loadFallbackGrid();
  }

  private generateGrid(seed: number): WorldTile[][] {
    const rng = mulberry32(seed);
    const grid: WorldTile[][] = [];
    for (let row = 0; row < this.size; row++) {
      const rowTiles: WorldTile[] = [];
      for (let col = 0; col < this.size; col++) {
        const roll = rng();
        let type: TileType = "grass";
        if (roll < 0.08) type = "obstacle";
        else if (roll < 0.2) type = "forage";
        else if (roll < 0.23) type = "water";
        rowTiles.push({ type, revealed: false, harvested: false });
      }
      grid.push(rowTiles);
    }

    // Scatter a handful of nest zones (aim for 2-3), spaced apart, on grass tiles.
    let nestsPlaced = 0;
    let attempts = 0;
    const targetNests = 2;
    while (nestsPlaced < targetNests && attempts < 500) {
      attempts++;
      const col = Math.floor(rng() * this.size);
      const row = Math.floor(rng() * this.size);
      if (grid[row][col].type !== "grass") continue;
      if (this.tooCloseToSameType(grid, col, row, "nest", MIN_SAME_TYPE_SPACING)) {
        continue;
      }
      grid[row][col] = { type: "nest", revealed: false };
      nestsPlaced++;
    }

    return grid;
  }

  private tooCloseToSameType(
    grid: WorldTile[][],
    col: number,
    row: number,
    type: TileType,
    minSpacing: number
  ): boolean {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        if (grid[r][c].type !== type) continue;
        const dist = Math.max(Math.abs(r - row), Math.abs(c - col));
        if (dist < minSpacing) return true;
      }
    }
    return false;
  }

  private validateGrid(grid: WorldTile[][]): boolean {
    const forageNodes: Placement[] = [];
    const nestNodes: Placement[] = [];
    for (let row = 0; row < grid.length; row++) {
      for (let col = 0; col < grid[row].length; col++) {
        const t = grid[row][col].type;
        if (t === "forage") forageNodes.push({ col, row });
        else if (t === "nest") nestNodes.push({ col, row });
      }
    }

    if (forageNodes.length < MIN_FORAGE_NODES) return false;
    if (nestNodes.length < MIN_NEST_ZONES) return false;

    if (!this.allSpacedApart(forageNodes, MIN_SAME_TYPE_SPACING)) return false;
    if (!this.allSpacedApart(nestNodes, MIN_SAME_TYPE_SPACING)) return false;

    return true;
  }

  private allSpacedApart(nodes: Placement[], minSpacing: number): boolean {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.max(
          Math.abs(nodes[i].col - nodes[j].col),
          Math.abs(nodes[i].row - nodes[j].row)
        );
        if (dist < minSpacing) return false;
      }
    }
    return true;
  }

  private loadFallbackGrid(): WorldTile[][] {
    const rawTiles = (fallbackLayout as { tiles: string[][] }).tiles;
    const letterToType: Record<string, TileType> = {
      g: "grass",
      o: "obstacle",
      f: "forage",
      n: "nest",
      w: "water",
    };
    const grid: WorldTile[][] = [];
    for (let row = 0; row < rawTiles.length; row++) {
      const rowTiles: WorldTile[] = [];
      for (let col = 0; col < rawTiles[row].length; col++) {
        const letter = rawTiles[row][col];
        const type = letterToType[letter] ?? "grass";
        rowTiles.push({ type, revealed: false, harvested: false });
      }
      grid.push(rowTiles);
    }
    return grid;
  }

  // --------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------

  private renderTiles(): void {
    this.container = this.scene.add.container(0, 0);
    for (let row = 0; row < this.tiles.length; row++) {
      for (let col = 0; col < this.tiles[row].length; col++) {
        const tile = this.tiles[row][col];
        const worldX = col * this.tilePx;
        const worldY = row * this.tilePx;
        const rect = this.scene.add.rectangle(
          worldX + this.tilePx / 2,
          worldY + this.tilePx / 2,
          this.tilePx - 1,
          this.tilePx - 1,
          TILE_COLORS[tile.type]
        );
        this.container.add(rect);
      }
    }
  }

  private setupFog(): void {
    const width = this.size * this.tilePx;
    const height = this.size * this.tilePx;

    this.fogGraphics = this.scene.add.graphics();
    this.fogGraphics.setVisible(false);

    this.fogTexture = this.scene.add.renderTexture(0, 0, width, height);
    this.fogTexture.setOrigin(0, 0);
    this.fogTexture.setDepth(1000);
    this.fogTexture.fill(0x000000, 0.92);
  }

  // --------------------------------------------------------------------
  // System
  // --------------------------------------------------------------------

  update(_deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    const pos = this.ctx.getPlayerPos();
    const radius =
      this.ctx.animal.forageRadius * (1 + this.ctx.statBonus("senseRadius") / 100);
    this.revealAround(pos.x, pos.y, radius);
  }

  destroy(): void {
    this.container?.destroy(true);
    this.fogTexture?.destroy();
    this.fogGraphics?.destroy();
  }

  // --------------------------------------------------------------------
  // WorldView
  // --------------------------------------------------------------------

  tileAt(col: number, row: number): WorldTile | null {
    if (row < 0 || row >= this.tiles.length) return null;
    if (col < 0 || col >= this.tiles[row].length) return null;
    return this.tiles[row][col];
  }

  worldToTile(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor(x / this.tilePx),
      row: Math.floor(y / this.tilePx),
    };
  }

  tileToWorld(col: number, row: number): Vec2 {
    return {
      x: col * this.tilePx + this.tilePx / 2,
      y: row * this.tilePx + this.tilePx / 2,
    };
  }

  forageNodes(): Vec2[] {
    const out: Vec2[] = [];
    for (let row = 0; row < this.tiles.length; row++) {
      for (let col = 0; col < this.tiles[row].length; col++) {
        const tile = this.tiles[row][col];
        if (tile.type === "forage" && !tile.harvested) {
          out.push(this.tileToWorld(col, row));
        }
      }
    }
    return out;
  }

  nestNodes(): Vec2[] {
    const out: Vec2[] = [];
    for (let row = 0; row < this.tiles.length; row++) {
      for (let col = 0; col < this.tiles[row].length; col++) {
        if (this.tiles[row][col].type === "nest") {
          out.push(this.tileToWorld(col, row));
        }
      }
    }
    return out;
  }

  nearestFogEdge(from: Vec2): Vec2 | null {
    let best: Vec2 | null = null;
    let bestDist = Infinity;
    for (let row = 0; row < this.tiles.length; row++) {
      for (let col = 0; col < this.tiles[row].length; col++) {
        if (this.tiles[row][col].revealed) continue;
        // Only consider a tile a "fog edge" if it borders a revealed tile
        // (i.e., it's on the frontier, not deep unexplored territory).
        if (!this.bordersRevealed(col, row)) continue;
        const world = this.tileToWorld(col, row);
        const dx = world.x - from.x;
        const dy = world.y - from.y;
        const dist = dx * dx + dy * dy;
        if (dist < bestDist) {
          bestDist = dist;
          best = world;
        }
      }
    }
    return best;
  }

  private bordersRevealed(col: number, row: number): boolean {
    const neighbors = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];
    for (const [nc, nr] of neighbors) {
      const t = this.tileAt(nc, nr);
      if (t && t.revealed) return true;
    }
    // Edge-of-map tiles with no revealed neighbor yet also count if nothing
    // has been revealed at all (bootstrap case).
    return false;
  }

  revealAround(x: number, y: number, radiusPx: number): void {
    // Mark logical tiles within radius as revealed.
    const centerTile = this.worldToTile(x, y);
    const tileRadius = Math.ceil(radiusPx / this.tilePx) + 1;
    for (let dr = -tileRadius; dr <= tileRadius; dr++) {
      for (let dc = -tileRadius; dc <= tileRadius; dc++) {
        const col = centerTile.col + dc;
        const row = centerTile.row + dr;
        const tile = this.tileAt(col, row);
        if (!tile) continue;
        const world = this.tileToWorld(col, row);
        const dx = world.x - x;
        const dy = world.y - y;
        if (dx * dx + dy * dy <= radiusPx * radiusPx) {
          tile.revealed = true;
        }
      }
    }

    // Clear a soft circle in the fog RenderTexture.
    this.fogGraphics.clear();
    this.fogGraphics.fillStyle(0xffffff, 1);
    this.fogGraphics.fillCircle(0, 0, radiusPx);
    this.fogTexture.erase(this.fogGraphics, x, y);
  }

  bounds(): { width: number; height: number } {
    return { width: this.size * this.tilePx, height: this.size * this.tilePx };
  }
}
