/**
 * WorldGenSystem — generates the (now 128x128, Update 3) tile grid with
 * procedural biomes, renders it as simple Phaser rectangles/sprites,
 * maintains a fog-of-war RenderTexture revealed around the player, and
 * implements WorldView so other systems can query tiles/nodes.
 *
 * Validation (per dev-plan Step 6 resolution #3, scaled for Update 3's
 * larger map — see MIN_FORAGE_NODES below): a grid is valid iff it has
 * >= MIN_FORAGE_NODES forage nodes AND >= MIN_NEST_ZONES nest zone(s), each
 * >= 3 tiles from any other node of the SAME type. On failure, regenerate
 * once with a new seed; if the second attempt also fails, load the static
 * src/data/fallback-layout.json.
 *
 * Update 3 water strategy: water is no longer an independent per-tile roll
 * (which used to produce ~all-orphan single-tile "water" that a since-
 * removed cullOrphanWater pass then erased almost entirely — the player-
 * reported "no water visible anywhere" bug). Water is now grown as coherent
 * blob ponds (growPondBlob in worldGenSim.ts) seeded mostly inside wetland
 * biome regions, with rare small ponds allowed elsewhere. findOrphanWater is
 * kept as a post-generation assertion, exercised by tests/worldGen.test.ts,
 * rather than a runtime cull — by construction by the blob grower, orphan
 * water should never occur.
 *
 * Update 3 invisible-wall fix: every obstacle/water tile must draw SOMETHING
 * even if its feature texture isn't loaded (e.g. headless/test contexts, or a
 * missing atlas frame) — see tileDrawDecision()/TILE_COLORS fallback below.
 */
import Phaser from "phaser";
import { GameContext, System, WorldView, Vec2 } from "../core/context";
import { TileType, WorldTile, WORLD_SIZE, TILE_PX } from "../core/types";
import fallbackLayout from "../data/fallback-layout.json";
import { SPRITE_KEYS, frameKey } from "../gfx/spriteRegistry";
import {
  Grid,
  carveToConnect,
  guaranteeWalkableRing,
  generateWorldGrid,
  mulberry32,
  decideTileDraw,
  TILE_COLORS,
} from "./worldGenSim";
import { biomeAt } from "./biomes";

// Update 3: scale minimums with map area rather than a flat count, so a
// bigger world still guarantees proportionally the same forage density as
// the old 48x48 (8 nodes / 2304 tiles ≈ 1 per 288 tiles), floored at the old
// literal minimum so a hypothetically small/degenerate grid still validates.
const FORAGE_NODES_PER_TILE = 8 / (48 * 48);
const MIN_FORAGE_NODES_FLOOR = 8;
const MIN_NEST_ZONES = 4;
const MAX_NEST_ZONES = 6;
const MIN_SAME_TYPE_SPACING = 3;

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
  /** Screen-locked seamless ground TileSprite (undefined if the atlas frame
   * isn't loaded and renderTiles fell back to per-tile rects). Exposed via
   * getRenderRefs() for WrapRenderSystem (Update 3 §WS-C) to scroll via
   * tilePosition instead of wrapping it like a world-space object. */
  private groundSprite?: Phaser.GameObjects.TileSprite;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.tiles = this.generateValidGrid();
    this.ensureConnectivity();
    this.renderTiles();
    this.setupFog();
  }

  /**
   * Update 2 §4 — "water uncrossable + guaranteed path": guarantee a
   * walkable ring around spawn and every nest, then flood-fill (with wrap
   * adjacency, since the world is now toroidal) from spawn and carve minimal
   * 1-tile grass channels through any obstacle/water that isolates a
   * walkable pocket. Any tile flipped walkable this way becomes "grass".
   */
  private ensureConnectivity(): void {
    // Defensive: iterate the ACTUAL tile grid dimensions, not `this.size`.
    // `this.size` is the current WORLD_SIZE constant; a stale/mismatched
    // source (e.g. an older fixed-size fallback-layout.json) could produce
    // a differently-sized `this.tiles`, and indexing past its real bounds
    // must never throw — it should just mean "nothing more to connect".
    const rows = this.tiles.length;
    const cols = this.tiles[0]?.length ?? 0;
    if (rows === 0 || cols === 0) return;

    const isWalkableType = (t: TileType) => t !== "obstacle" && t !== "water";
    const walkable: Grid = this.tiles.map((row) => row.map((t) => isWalkableType(t.type)));

    const spawnCol = Phaser.Math.Clamp(Math.floor(cols / 2), 0, cols - 1);
    const spawnRow = Phaser.Math.Clamp(Math.floor(rows / 2), 0, rows - 1);

    const forcedWalkable: [number, number][] = [
      ...guaranteeWalkableRing(walkable, spawnCol, spawnRow, true),
    ];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (this.tiles[row][col]?.type === "nest") {
          forcedWalkable.push(...guaranteeWalkableRing(walkable, col, row, true));
        }
      }
    }

    const { carved } = carveToConnect(walkable, spawnCol, spawnRow, true);

    for (const [col, row] of [...forcedWalkable, ...carved]) {
      const tile = this.tiles[row]?.[col];
      if (tile && !isWalkableType(tile.type)) {
        // Preserve biome (ground tint) — only the tile TYPE flips to grass.
        this.tiles[row][col] = { type: "grass", revealed: false, biome: tile.biome };
      }
    }
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

  /**
   * Update 3: delegates to worldGenSim.generateWorldGrid — the single pure
   * implementation of "biome assign -> blob-pond water -> biome-driven
   * obstacle/forage rolls -> spaced nest placement -> connectivity carve",
   * shared verbatim with tests/worldGen.test.ts so the test suite exercises
   * exactly what ships (no parallel logic to drift out of sync). The
   * constructor's separate `ensureConnectivity()` call afterward is a cheap,
   * idempotent no-op safety net for this path (the grid is already connected
   * coming out of generateWorldGrid) and the ONLY connectivity pass for the
   * fallback-layout.json path, which has no such guarantee baked in.
   */
  private generateGrid(seed: number): WorldTile[][] {
    return generateWorldGrid({
      seed,
      size: this.size,
      minNestZones: MIN_NEST_ZONES,
      maxNestZones: MAX_NEST_ZONES,
      minSameTypeSpacing: MIN_SAME_TYPE_SPACING,
    });
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

    const minForageNodes = Math.max(
      MIN_FORAGE_NODES_FLOOR,
      Math.round(FORAGE_NODES_PER_TILE * this.size * this.size)
    );
    if (forageNodes.length < minForageNodes) return false;
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

  /** Fixed seed used only to derive biome/ground-tint data for the static
   * fallback layout (which has no generation seed of its own — the tile
   * TYPES come from fallback-layout.json verbatim, but renderers still need
   * a `biome` per tile for ground tinting, so we compute one deterministically). */
  private static readonly FALLBACK_BIOME_SEED = 0xfa11b4c;

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
        const biome = biomeAt(WorldGenSystem.FALLBACK_BIOME_SEED, col, row);
        rowTiles.push({ type, revealed: false, harvested: false, biome });
      }
      grid.push(rowTiles);
    }
    return grid;
  }

  // --------------------------------------------------------------------
  // Rendering
  // --------------------------------------------------------------------

  /**
   * Update 2 §4 — "seamless looping wilds": ONE tileable background
   * (fx_grass_seamless via a single TileSprite) replaces the old per-tile
   * grass-variant checkerboard (~1600 individual images down to 1 draw
   * call). Obstacles/water/forage/nest still render as individual feature
   * sprites on top, and props (flowers/pebbles) are scattered individually
   * at ~1-per-12-tiles, seeded so it's stable across reloads.
   *
   * Update 3: per-tile draw choice is delegated to the pure, exported
   * `decideTileDraw()` helper (see below this class) so it's unit-testable
   * without Phaser AND so the next agent's chunked-rendering rework can call
   * the exact same decision logic per chunk instead of this whole-grid loop.
   * NOTE (for the rendering agent): this loop still builds every tile every
   * time (perf problem is explicitly out of scope for this pass) — only the
   * "what should this tile draw" decision was extracted.
   */
  private renderTiles(): void {
    this.container = this.scene.add.container(0, 0);
    const rng = mulberry32(0x5eed);
    const usesAtlas = this.scene.textures.exists(frameKey(SPRITE_KEYS.tileGrassSeamless));
    const textureExists = (key: string) => this.scene.textures.exists(frameKey(key));

    if (usesAtlas) {
      // Post-launch fix (camera-wrap follow-up): this must be a genuinely
      // screen-locked, viewport-sized TileSprite (scrollFactor 0, sized to
      // the canvas, NOT the world) so it always fully covers the camera's
      // view no matter where the now-unbounded toroidal camera sits.
      // Previously this was a world-sized (size*tilePx) quad fixed at world
      // (0,0) and parented under the wrapped statics container -- that
      // worked only while the camera was clamped inside the world rect. Once
      // WrapRenderSystem made the camera unbounded (to smooth-follow across
      // the seam), the camera could show area outside that fixed quad
      // (visible as black), AND being a child of the statics container meant
      // WrapRenderSystem's per-child wrap loop was also repositioning its
      // x/y every frame on top of the tilePosition scroll, making it drift
      // oddly. A screen-locked sprite sized to the canvas needs neither: it
      // always exactly covers the view, and staying OUTSIDE the statics
      // container means the wrap loop never touches it. Kept as a scene
      // top-level object (not added to `this.container`) and given a low
      // depth so it still draws behind every terrain feature.
      const bg = this.scene.add.tileSprite(
        0,
        0,
        this.scene.scale.width,
        this.scene.scale.height,
        frameKey(SPRITE_KEYS.tileGrassSeamless)
      );
      bg.setOrigin(0, 0);
      bg.setScrollFactor(0);
      bg.setDepth(-1);
      this.groundSprite = bg;
    }

    for (let row = 0; row < this.tiles.length; row++) {
      for (let col = 0; col < this.tiles[row].length; col++) {
        const tile = this.tiles[row][col];
        const cxp = col * this.tilePx + this.tilePx / 2;
        const cyp = row * this.tilePx + this.tilePx / 2;
        const roll = rng();

        if (!usesAtlas) {
          const rect = this.scene.add.rectangle(
            cxp,
            cyp,
            this.tilePx - 1,
            this.tilePx - 1,
            TILE_COLORS[tile.type]
          );
          this.container.add(rect);
          continue;
        }

        const decision = decideTileDraw(tile, roll, textureExists);

        if (decision.kind === "rect") {
          const rect = this.scene.add.rectangle(
            cxp,
            cyp,
            this.tilePx - 1,
            this.tilePx - 1,
            decision.color
          );
          rect.setDepth(tile.type === "obstacle" || tile.type === "water" ? 600 : 10);
          this.container.add(rect);
        } else if (decision.kind === "sprite" && decision.spriteKey) {
          const feat = this.scene.add.image(cxp, cyp, frameKey(decision.spriteKey));
          // Post-launch fix ("make the trees bigger"): trees render at 1.6x
          // the tile size, centered, so canopies read as prominent and
          // overlap neighboring tiles naturally; the collision footprint
          // (still keyed off the tile grid, not the sprite) is unchanged.
          // Every other feature (rocks, forage bushes, props) stays at the
          // plain 1x tile size.
          const scale = decision.spriteKey === SPRITE_KEYS.tileObstacleTree ? 1.6 : 1;
          feat.setDisplaySize(this.tilePx * scale, this.tilePx * scale);
          feat.setDepth(tile.type === "obstacle" || tile.type === "water" ? 600 : 10);
          this.container.add(feat);
        }
        // decision.kind === "none": nothing drawn (bare grass tile, no prop
        // rolled this tick) — the shared seamless background is enough.

        // Shore-rim strip: draw on non-water tiles that border at least one
        // water tile, so pond edges read as a shoreline. Drawn UNDER the
        // tile's own feature/rect (depth 5, below obstacle/water's 600 and
        // forage/prop's 10) so it never occludes a feature sprite.
        if (tile.type !== "water" && textureExists(SPRITE_KEYS.tileShoreRim) && this.bordersWater(col, row)) {
          const rim = this.scene.add.image(cxp, cyp, frameKey(SPRITE_KEYS.tileShoreRim));
          rim.setDisplaySize(this.tilePx, this.tilePx);
          rim.setDepth(5);
          this.container.add(rim);
        }
        // Nest tile ground only — NestSystem renders the nest itself.
      }
    }
  }

  /** True if any of the 4 orthogonal (wrap-aware) neighbors is water. */
  private bordersWater(col: number, row: number): boolean {
    const neighbors: [number, number][] = [
      [col - 1, row],
      [col + 1, row],
      [col, row - 1],
      [col, row + 1],
    ];
    for (const [nc, nr] of neighbors) {
      if (this.tileAt(nc, nr)?.type === "water") return true;
    }
    return false;
  }

  private setupFog(): void {
    const width = this.size * this.tilePx;
    const height = this.size * this.tilePx;

    this.fogGraphics = this.scene.add.graphics();
    this.fogGraphics.setVisible(false);

    this.fogTexture = this.scene.add.renderTexture(0, 0, width, height);
    this.fogTexture.setOrigin(0, 0);
    // Below enemies/player so approaching threats are never fully hidden;
    // softened so combat stays readable (Nest & Fang).
    this.fogTexture.setDepth(850);
    this.fogTexture.fill(0x000000, 0.55);
  }

  /**
   * Update 3 §WS-C contract: WrapRenderSystem (owned by the rendering agent)
   * wraps world-space display objects to their nearest copy around the
   * toroidal camera, and needs to know which of WorldGenSystem's objects are
   * "statics" (the feature container — wrapped per-child, nothing reads
   * their positions so no restore needed) vs the screen-locked ground
   * TileSprite (scrolled via tilePosition instead, since it's infinite and
   * never wrapped) vs the fog RenderTexture (world-sized, ghost-copied by
   * WrapRenderSystem itself). Returns whichever of these exist yet — this is
   * called once during WorldScene setup, after the constructor has already
   * run generation + rendering, so all three are populated by the time
   * WorldScene reads them (ground may be undefined if the atlas texture
   * wasn't loaded and rendering fell back to per-tile rects).
   */
  getRenderRefs(): {
    worldContainer?: Phaser.GameObjects.Container;
    ground?: Phaser.GameObjects.TileSprite;
    fog?: Phaser.GameObjects.RenderTexture;
  } {
    return {
      worldContainer: this.container,
      ground: this.groundSprite,
      fog: this.fogTexture,
    };
  }

  // --------------------------------------------------------------------
  // System
  // --------------------------------------------------------------------

  update(_deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    const pos = this.ctx.getPlayerPos();
    // 2.2x base for combat readability — you must see waves coming.
    const radius =
      this.ctx.animal.forageRadius *
      2.2 *
      (1 + this.ctx.statBonus("senseRadius") / 100);
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

  /** Update 2: world is toroidal, so any col/row wraps modulo the grid size. */
  private wrapIndex(v: number): number {
    return ((v % this.size) + this.size) % this.size;
  }

  tileAt(col: number, row: number): WorldTile | null {
    if (this.tiles.length === 0) return null;
    const r = this.wrapIndex(row);
    const c = this.wrapIndex(col);
    if (r < 0 || r >= this.tiles.length) return null;
    if (c < 0 || c >= this.tiles[r].length) return null;
    return this.tiles[r][c];
  }

  worldToTile(x: number, y: number): { col: number; row: number } {
    return {
      col: this.wrapIndex(Math.floor(x / this.tilePx)),
      row: this.wrapIndex(Math.floor(y / this.tilePx)),
    };
  }

  tileToWorld(col: number, row: number): Vec2 {
    const c = this.wrapIndex(col);
    const r = this.wrapIndex(row);
    return {
      x: c * this.tilePx + this.tilePx / 2,
      y: r * this.tilePx + this.tilePx / 2,
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

    // Clear a soft circle in the fog RenderTexture. Update 2: also erase at
    // wrapped mirror positions near an edge/corner so the fog doesn't show a
    // false "wall" right after the camera hard-snaps across the seam.
    this.fogGraphics.clear();
    this.fogGraphics.fillStyle(0xffffff, 1);
    this.fogGraphics.fillCircle(0, 0, radiusPx);
    const { width, height } = this.bounds();
    for (const ox of [-width, 0, width]) {
      for (const oy of [-height, 0, height]) {
        const mx = x + ox;
        const my = y + oy;
        // Skip mirrors that can't possibly touch the texture (cheap cull).
        if (mx + radiusPx < 0 || mx - radiusPx > width) continue;
        if (my + radiusPx < 0 || my - radiusPx > height) continue;
        this.fogTexture.erase(this.fogGraphics, mx, my);
      }
    }
  }

  bounds(): { width: number; height: number } {
    return { width: this.size * this.tilePx, height: this.size * this.tilePx };
  }
}
