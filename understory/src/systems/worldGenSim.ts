/**
 * worldGenSim — pure, Phaser-free world-generation logic for Update 2's
 * "seamless looping wilds" rework, extended in Update 3 with biome-driven
 * generation + blob-pond water at 128x128. Kept separate from combat/sim.ts
 * (which is combat-only) so WorldGenSystem's connectivity/water/biome
 * guarantees can be unit-tested headlessly, same spirit as combat/sim.ts.
 * Only imports from ../core/types (itself dependency-free), never Phaser, so
 * tests/worldGen.test.ts can exercise the FULL generation pipeline
 * (generateWorldGrid below) without a DOM/Phaser scene.
 *
 * DECISIONS:
 * - Grid is addressed [row][col], boolean walkable (true = can be entered).
 * - Wrap adjacency treats the grid as a torus: col/row neighbors wrap modulo
 *   width/height, matching the toroidal world (WORLD_SIZE, wrapDelta in
 *   combat/sim.ts) rather than a plain bounded grid.
 * - "Carve a channel toward it" = multi-source BFS from the ENTIRE reachable
 *   set, over every cell (walkable or not), to the nearest unreachable
 *   walkable cell; every non-walkable cell on that shortest path is flipped
 *   to walkable ("grass channel"). Repeated until one connected component
 *   remains. This yields the minimal carve for each isolated pocket rather
 *   than a single blunt straight line, and terminates because each iteration
 *   strictly shrinks the unreachable set (Phase 0 guard caps iterations for
 *   safety against a pathological all-blocked grid).
 * - generateWorldGrid() is the SAME algorithm WorldGenSystem.generateGrid +
 *   ensureConnectivity run in production (WorldGenSystem delegates to it) —
 *   duplicated nowhere, so this is the one source of truth tests exercise.
 * - decideTileDraw() (near the bottom) is likewise the one implementation
 *   WorldGenSystem.renderTiles calls; it only needs SPRITE_KEYS/frameKey from
 *   spriteRegistry.ts (itself Phaser-free by design), so it lives here rather
 *   than in WorldGenSystem.ts (which imports the real `phaser` package and
 *   therefore cannot be imported under vitest's node environment — Phaser
 *   references DOM globals like HTMLVideoElement at module load time).
 */
import { TileType, WorldTile, Biome } from "../core/types";
import { BIOME_TABLE, biomeAt } from "./biomes";
import { SPRITE_KEYS } from "../gfx/spriteRegistry";

export type Grid = boolean[][]; // [row][col], true = walkable

function key(col: number, row: number): string {
  return `${col},${row}`;
}

function wrapCoord(v: number, size: number): number {
  return ((v % size) + size) % size;
}

function neighborsOf(
  col: number,
  row: number,
  width: number,
  height: number,
  wrap: boolean
): [number, number][] {
  const raw: [number, number][] = [
    [col - 1, row],
    [col + 1, row],
    [col, row - 1],
    [col, row + 1],
  ];
  const out: [number, number][] = [];
  for (const [c, r] of raw) {
    if (wrap) {
      out.push([wrapCoord(c, width), wrapCoord(r, height)]);
    } else if (c >= 0 && c < width && r >= 0 && r < height) {
      out.push([c, r]);
    }
  }
  return out;
}

/** Flood-fill the set of walkable cells reachable from (startCol,startRow). */
export function floodFillWalkable(
  grid: Grid,
  startCol: number,
  startRow: number,
  wrap: boolean
): Set<string> {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const visited = new Set<string>();
  if (height === 0 || width === 0) return visited;
  if (!grid[startRow]?.[startCol]) return visited;

  const stack: [number, number][] = [[startCol, startRow]];
  visited.add(key(startCol, startRow));
  while (stack.length > 0) {
    const [c, r] = stack.pop()!;
    for (const [nc, nr] of neighborsOf(c, r, width, height, wrap)) {
      const k = key(nc, nr);
      if (visited.has(k)) continue;
      if (!grid[nr][nc]) continue;
      visited.add(k);
      stack.push([nc, nr]);
    }
  }
  return visited;
}

/** Every walkable cell NOT in `reachable`. */
export function findUnreachableWalkable(
  grid: Grid,
  reachable: Set<string>
): [number, number][] {
  const out: [number, number][] = [];
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] && !reachable.has(key(c, r))) out.push([c, r]);
    }
  }
  return out;
}

/**
 * Multi-source BFS from every cell in `reachable`, over the WHOLE grid
 * (ignoring walkability), to the nearest occurrence of `target`. Returns the
 * path (inclusive of both ends) or [] if somehow unreachable (grid has no
 * cells at all).
 */
function shortestPathIgnoringWalls(
  grid: Grid,
  reachable: Set<string>,
  target: [number, number],
  wrap: boolean
): [number, number][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const targetKey = key(target[0], target[1]);

  const visited = new Set<string>(reachable);
  const parent = new Map<string, string | null>();
  const queue: [number, number][] = [];
  for (const k of reachable) {
    parent.set(k, null);
    const [c, r] = k.split(",").map(Number);
    queue.push([c, r]);
  }

  let qi = 0;
  let found = visited.has(targetKey);
  while (qi < queue.length && !found) {
    const [c, r] = queue[qi++];
    for (const [nc, nr] of neighborsOf(c, r, width, height, wrap)) {
      const nk = key(nc, nr);
      if (visited.has(nk)) continue;
      visited.add(nk);
      parent.set(nk, key(c, r));
      queue.push([nc, nr]);
      if (nk === targetKey) {
        found = true;
        break;
      }
    }
  }

  if (!visited.has(targetKey)) return []; // grid empty or target out of range

  const path: [number, number][] = [];
  let cur: string | null = targetKey;
  const guardMax = width * height + 4;
  let guard = 0;
  while (cur !== null && guard++ < guardMax) {
    const [c, r] = cur.split(",").map(Number);
    path.push([c, r]);
    if (reachable.has(cur)) break; // reached the original reachable set
    const p = parent.get(cur);
    if (p === undefined) break;
    cur = p;
  }
  return path;
}

export interface CarveResult {
  grid: Grid;
  /** Cells flipped from blocked to walkable to guarantee connectivity. */
  carved: [number, number][];
}

/**
 * Mutates `grid` in place so every walkable cell is reachable from
 * (startCol,startRow), carving the minimal number of 1-tile grass channels
 * through blocking cells. Safe against pathological inputs via an iteration
 * cap (bounded by grid area).
 */
export function carveToConnect(
  grid: Grid,
  startCol: number,
  startRow: number,
  wrap: boolean
): CarveResult {
  const carved: [number, number][] = [];
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const maxIterations = width * height + 8;

  // Guarantee the start cell itself is walkable (spawn must never be blocked).
  if (grid[startRow] && grid[startRow][startCol] === false) {
    grid[startRow][startCol] = true;
    carved.push([startCol, startRow]);
  }

  let iterations = 0;
  while (iterations++ < maxIterations) {
    const reachable = floodFillWalkable(grid, startCol, startRow, wrap);
    const unreachable = findUnreachableWalkable(grid, reachable);
    if (unreachable.length === 0) break;

    const path = shortestPathIgnoringWalls(grid, reachable, unreachable[0], wrap);
    let carvedAny = false;
    for (const [c, r] of path) {
      if (!grid[r][c]) {
        grid[r][c] = true;
        carved.push([c, r]);
        carvedAny = true;
      }
    }
    // Safety: if pathfinding failed to produce anything to carve (shouldn't
    // happen on a finite grid), force-connect the single unreachable cell
    // directly rather than looping forever.
    if (!carvedAny) {
      const [c, r] = unreachable[0];
      grid[r][c] = true;
      carved.push([c, r]);
    }
  }

  return { grid, carved };
}

/** Force a walkable ring of the 8 neighbors around (col,row) (nest/spawn safety). */
export function guaranteeWalkableRing(
  grid: Grid,
  col: number,
  row: number,
  wrap: boolean
): [number, number][] {
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const carved: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      let c = col + dc;
      let r = row + dr;
      if (wrap) {
        c = wrapCoord(c, width);
        r = wrapCoord(r, height);
      } else if (c < 0 || c >= width || r < 0 || r >= height) {
        continue;
      }
      if (!grid[r][c]) {
        grid[r][c] = true;
        carved.push([c, r]);
      }
    }
  }
  return carved;
}

// ----------------------------------------------------------------------------
// Water blob generation (Update 3 — replaces the old per-tile ~3% water roll,
// whose isolated single tiles used to be silently erased by a since-removed
// cullOrphanWater pass. Ponds are now grown as coherent blobs from seed
// points, so "orphan" (fully-isolated single-tile) water should never occur
// by construction; findOrphanWater below is kept as a construction-time
// ASSERTION helper, not a runtime cull.
// ----------------------------------------------------------------------------

export type WaterMask = boolean[][]; // [row][col], true = water

/**
 * Every water tile with zero water neighbors (4-directional, wrap-aware) —
 * i.e. a single isolated tile that reads as a stray puddle rather than part
 * of a pond. Used purely as a post-generation assertion/test hook now; the
 * generator itself is expected to produce zero of these.
 */
export function findOrphanWater(mask: WaterMask, wrap: boolean): [number, number][] {
  const height = mask.length;
  const width = mask[0]?.length ?? 0;
  const out: [number, number][] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!mask[r][c]) continue;
      const hasWaterNeighbor = neighborsOf(c, r, width, height, wrap).some(
        ([nc, nr]) => mask[nr][nc]
      );
      if (!hasWaterNeighbor) out.push([c, r]);
    }
  }
  return out;
}

/**
 * Grow a single blob pond from a seed point via randomized BFS: repeatedly
 * pop a random frontier cell, mark it water, and enqueue its not-yet-visited
 * neighbors, until `targetSize` tiles are placed or the frontier is exhausted
 * (e.g. blocked entirely by `canPlace` returning false everywhere reachable).
 * This produces organic, roughly-round blobs rather than a perfect diamond/
 * square, and never produces a lone tile when targetSize >= 2 since every
 * placed tile (after the seed) is adjacent to an already-placed tile by
 * construction.
 *
 * `canPlace(col,row)` gates which tiles are eligible (e.g. biome-restricted
 * to wetland, or "not already assigned a special tile type"). If the seed
 * itself fails `canPlace`, nothing is placed (returns []).
 */
export function growPondBlob(
  width: number,
  height: number,
  seedCol: number,
  seedRow: number,
  targetSize: number,
  wrap: boolean,
  canPlace: (col: number, row: number) => boolean,
  rng: () => number
): [number, number][] {
  if (targetSize <= 0) return [];
  if (!canPlace(seedCol, seedRow)) return [];

  const placed: [number, number][] = [[seedCol, seedRow]];
  const placedSet = new Set<string>([key(seedCol, seedRow)]);
  const frontier: [number, number][] = [[seedCol, seedRow]];
  const inFrontier = new Set<string>();

  const pushFrontierNeighbors = (c: number, r: number) => {
    for (const [nc, nr] of neighborsOf(c, r, width, height, wrap)) {
      const k = key(nc, nr);
      if (placedSet.has(k) || inFrontier.has(k)) continue;
      if (!canPlace(nc, nr)) continue;
      frontier.push([nc, nr]);
      inFrontier.add(k);
    }
  };
  pushFrontierNeighbors(seedCol, seedRow);

  while (placed.length < targetSize && frontier.length > 0) {
    const idx = Math.floor(rng() * frontier.length);
    const [c, r] = frontier.splice(idx, 1)[0];
    const k = key(c, r);
    inFrontier.delete(k);
    if (placedSet.has(k)) continue;
    placedSet.add(k);
    placed.push([c, r]);
    pushFrontierNeighbors(c, r);
  }

  return placed;
}

// ----------------------------------------------------------------------------
// Full generation pipeline (Update 3) — the single source of truth for
// "biome-driven grid + blob ponds + nests + connectivity", shared verbatim by
// WorldGenSystem (production) and tests/worldGen.test.ts (headless). Keeping
// this here (rather than duplicated inline in WorldGenSystem) means the test
// suite exercises EXACTLY what ships, not a parallel re-implementation that
// could silently drift.
// ----------------------------------------------------------------------------

/** Deterministic seeded PRNG (mulberry32); same family used throughout Understory. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateWorldGridOptions {
  seed: number;
  size: number;
  minNestZones: number;
  maxNestZones: number;
  minSameTypeSpacing: number;
}

function tooCloseToSameType(
  grid: WorldTile[][],
  col: number,
  row: number,
  type: WorldTile["type"],
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

/**
 * Grows blob ponds directly into `grid`/`biomes`. Wetland tiles are the
 * primary host (frequent, 4-24 tile ponds); a handful of rare small (4-8
 * tile) ponds are also allowed on any other waterAllowed biome. Mirrors
 * WorldGenSystem.growWaterBlobs exactly (that method now delegates here).
 */
function growWaterBlobsInto(
  grid: WorldTile[][],
  biomes: Biome[][],
  width: number,
  height: number,
  rng: () => number
): void {
  const canPlace = (col: number, row: number): boolean => {
    const r = ((row % height) + height) % height;
    const c = ((col % width) + width) % width;
    if (grid[r][c].type === "water") return false;
    return BIOME_TABLE[biomes[r][c]].waterAllowed;
  };
  const markWater = (cells: [number, number][]): void => {
    for (const [c, r] of cells) grid[r][c].type = "water";
  };

  // Tuned (see tests/worldGen.test.ts "wetland regions carry 10-25% water
  // coverage") so aggregate wetland-tile water coverage lands solidly
  // mid-range (~16-22% across sampled seeds), not just under the ceiling.
  let wetlandSeedAttempts = 0;
  const maxWetlandSeedAttempts = Math.floor((width * height) / 40);
  for (let row = 0; row < height && wetlandSeedAttempts < maxWetlandSeedAttempts; row++) {
    for (let col = 0; col < width && wetlandSeedAttempts < maxWetlandSeedAttempts; col++) {
      if (biomes[row][col] !== "wetland") continue;
      if (rng() > 1 / 60) continue;
      wetlandSeedAttempts++;
      if (!canPlace(col, row)) continue;
      const targetSize = 4 + Math.floor(rng() * 21); // 4..24
      markWater(growPondBlob(width, height, col, row, targetSize, true, canPlace, rng));
    }
  }

  let rareSeedAttempts = 0;
  const maxRareSeedAttempts = Math.floor((width * height) / 200);
  for (let row = 0; row < height && rareSeedAttempts < maxRareSeedAttempts; row++) {
    for (let col = 0; col < width && rareSeedAttempts < maxRareSeedAttempts; col++) {
      if (biomes[row][col] === "wetland") continue;
      if (!BIOME_TABLE[biomes[row][col]].waterAllowed) continue;
      if (rng() > 1 / 150) continue;
      rareSeedAttempts++;
      if (!canPlace(col, row)) continue;
      const targetSize = 4 + Math.floor(rng() * 5); // 4..8
      markWater(growPondBlob(width, height, col, row, targetSize, true, canPlace, rng));
    }
  }
}

/**
 * Full deterministic world generation: biome assignment -> blob-pond water ->
 * biome-driven obstacle/forage rolls -> spaced nest placement -> guaranteed
 * spawn/nest walkable rings -> connectivity carve (wrap-aware flood-fill from
 * the map center). Returns the finished tile grid — same shape WorldGenSystem
 * exposes via tileAt/forageNodes/etc.
 */
export function generateWorldGrid(opts: GenerateWorldGridOptions): WorldTile[][] {
  const { seed, size, minNestZones, maxNestZones, minSameTypeSpacing } = opts;
  const rng = mulberry32(seed);
  const grid: WorldTile[][] = [];
  const biomes: Biome[][] = [];

  for (let row = 0; row < size; row++) {
    const rowTiles: WorldTile[] = [];
    const rowBiomes: Biome[] = [];
    for (let col = 0; col < size; col++) {
      const biome = biomeAt(seed, col, row);
      rowBiomes.push(biome);
      rowTiles.push({ type: "grass", revealed: false, harvested: false, biome });
    }
    grid.push(rowTiles);
    biomes.push(rowBiomes);
  }

  growWaterBlobsInto(grid, biomes, size, size, rng);

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const tile = grid[row][col];
      if (tile.type === "water") continue;
      const params = BIOME_TABLE[biomes[row][col]];
      const roll = rng();
      if (roll < params.obstacleDensity) {
        tile.type = "obstacle";
      } else if (roll < params.obstacleDensity + params.forageDensity) {
        tile.type = "forage";
      }
    }
  }

  const targetNests = minNestZones + Math.floor(rng() * (maxNestZones - minNestZones + 1));
  let nestsPlaced = 0;
  let attempts = 0;
  const maxAttempts = 2000;
  while (nestsPlaced < targetNests && attempts < maxAttempts) {
    attempts++;
    const col = Math.floor(rng() * size);
    const row = Math.floor(rng() * size);
    if (grid[row][col].type !== "grass") continue;
    if (tooCloseToSameType(grid, col, row, "nest", minSameTypeSpacing)) continue;
    grid[row][col].type = "nest";
    nestsPlaced++;
  }

  // Connectivity: guarantee walkable rings at spawn (map center) + every
  // nest, then carve minimal channels so every walkable tile is reachable
  // from spawn under wrap adjacency.
  const isWalkableType = (t: WorldTile["type"]) => t !== "obstacle" && t !== "water";
  const walkable: Grid = grid.map((row) => row.map((t) => isWalkableType(t.type)));
  const spawnCol = Math.floor(size / 2);
  const spawnRow = Math.floor(size / 2);

  const forcedWalkable: [number, number][] = [
    ...guaranteeWalkableRing(walkable, spawnCol, spawnRow, true),
  ];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (grid[row][col].type === "nest") {
        forcedWalkable.push(...guaranteeWalkableRing(walkable, col, row, true));
      }
    }
  }
  const { carved } = carveToConnect(walkable, spawnCol, spawnRow, true);

  for (const [col, row] of [...forcedWalkable, ...carved]) {
    const tile = grid[row]?.[col];
    if (tile && !isWalkableType(tile.type)) {
      grid[row][col] = { type: "grass", revealed: false, biome: tile.biome };
    }
  }

  // Post-carve orphan cleanup: carving a 1-tile grass channel through a pond
  // to guarantee connectivity can, in rare cases, slice off a single water
  // tile from the rest of its blob, leaving an "orphan" puddle — exactly the
  // pre-Update-3 bug this system is meant to eliminate. Rather than special-
  // casing the carve path to avoid ponds (which would fight the connectivity
  // guarantee), it's simpler and just as correct to detect any orphan left
  // AFTER carving and convert it to grass: a single stray water tile reads as
  // a rendering glitch, not a pond, so removing it costs nothing visually
  // while preserving the "zero orphan water" guarantee tests assert on.
  const waterMask: WaterMask = grid.map((row) => row.map((t) => t.type === "water"));
  for (const [col, row] of findOrphanWater(waterMask, true)) {
    const tile = grid[row][col];
    grid[row][col] = { type: "grass", revealed: false, biome: tile.biome };
  }

  return grid;
}

// ----------------------------------------------------------------------------
// Tile draw decision (Update 3 "invisible wall" fix) — pure, Phaser-free.
// ----------------------------------------------------------------------------

/** Fallback flat colors, used whenever a tile's feature texture isn't loaded. */
export const TILE_COLORS: Record<TileType, number> = {
  grass: 0x4a7c3f,
  obstacle: 0x5b4636,
  forage: 0xd9a441,
  nest: 0xc76b4a,
  water: 0x3a6ea5,
};

/**
 * Result of deciding what a single tile should draw. Pure/Phaser-free so it
 * can be unit-tested directly (tests/worldGen.test.ts) and reused verbatim by
 * the next agent's chunked renderer.
 * - "none": nothing drawn beyond the shared background (bare grass, no prop).
 * - "rect": a plain colored rectangle (TILE_COLORS fallback) — used whenever
 *   a tile that must be visually represented (any obstacle or water tile,
 *   per the "invisible wall" fix) has no available feature texture.
 * - "sprite": draw the named SPRITE_KEYS.* frame.
 */
export type TileDrawDecision =
  | { kind: "none" }
  | { kind: "rect"; color: number }
  | { kind: "sprite"; spriteKey: string };

/**
 * Update 3 — pure per-tile draw decision, called by WorldGenSystem.renderTiles
 * so:
 *  (a) it's unit-testable without Phaser, and
 *  (b) EVERY blocking tile (obstacle or water) is GUARANTEED to yield a
 *      draw instruction — either its feature sprite (if the texture is
 *      loaded) or a TILE_COLORS fallback rectangle. This is the fix for the
 *      "invisible wall" bug: previously an obstacle tile only drew anything
 *      when `scene.textures.exists(...)` was true, so a missing/not-yet-
 *      loaded feature texture silently produced a fully invisible but still
 *      solid (blocking) tile.
 *
 * `roll` is a caller-supplied [0,1) random value (same seeded rng used for
 * the rest of renderTiles) driving the tree-vs-rock split and prop scatter,
 * so behavior/visuals stay identical to the pre-refactor inline logic.
 * `textureExists` abstracts `scene.textures.exists(frameKey(key))` so this
 * function needs no Phaser import.
 */
export function decideTileDraw(
  tile: WorldTile,
  roll: number,
  textureExists: (spriteKey: string) => boolean
): TileDrawDecision {
  if (tile.type === "water") {
    if (textureExists(SPRITE_KEYS.tileWater)) {
      return { kind: "sprite", spriteKey: SPRITE_KEYS.tileWater };
    }
    return { kind: "rect", color: TILE_COLORS.water };
  }

  if (tile.type === "obstacle") {
    const spriteKey = roll < 0.6 ? SPRITE_KEYS.tileObstacleTree : SPRITE_KEYS.tileObstacleRock;
    if (textureExists(spriteKey)) {
      return { kind: "sprite", spriteKey };
    }
    // Fallback rect guarantees a blocking tile is never fully invisible,
    // regardless of which obstacle variant was rolled.
    return { kind: "rect", color: TILE_COLORS.obstacle };
  }

  if (tile.type === "forage") {
    if (textureExists(SPRITE_KEYS.forageBush)) {
      return { kind: "sprite", spriteKey: SPRITE_KEYS.forageBush };
    }
    // Forage/grass/nest tiles are walkable, so a missing texture is a visual
    // nicety miss, not a stuck-player bug — but still render something so the
    // node reads as interactable rather than blank grass.
    return { kind: "rect", color: TILE_COLORS.forage };
  }

  if (tile.type === "grass" && roll > 0.9167) {
    // ~1 prop per 12 tiles.
    const spriteKey = roll > 0.958 ? SPRITE_KEYS.propFlower : SPRITE_KEYS.propPebble;
    if (textureExists(spriteKey)) {
      return { kind: "sprite", spriteKey };
    }
    return { kind: "none" };
  }

  // Nest tile ground only (NestSystem renders the nest itself) and plain
  // grass with no prop rolled this tick both draw nothing extra.
  return { kind: "none" };
}

/** Build a boolean water mask ([row][col], true = water) from a tile grid —
 * the shape findOrphanWater/growPondBlob operate on. Exported for tests. */
export function waterMaskFromTiles(tiles: WorldTile[][]): WaterMask {
  return tiles.map((row) => row.map((t) => t.type === "water"));
}
