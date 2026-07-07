import { describe, it, expect } from "vitest";
import {
  floodFillWalkable,
  findUnreachableWalkable,
  carveToConnect,
  guaranteeWalkableRing,
  findOrphanWater,
  growPondBlob,
  generateWorldGrid,
  mulberry32,
  decideTileDraw,
  waterMaskFromTiles,
  Grid,
  WaterMask,
} from "../src/systems/worldGenSim";
import { biomeAt, moistureAt, growthAt, BIOME_TABLE, Biome } from "../src/systems/biomes";
import type { WorldTile } from "../src/core/types";

/** Build a Grid from an array of strings: "#" = blocked, "." = walkable. */
function gridFromRows(rows: string[]): Grid {
  return rows.map((row) => row.split("").map((ch) => ch === "."));
}

describe("floodFillWalkable", () => {
  it("finds all connected walkable cells from a start point", () => {
    const grid = gridFromRows([".....", ".###.", ".#.#.", ".###.", "....."]);
    const reachable = floodFillWalkable(grid, 0, 0, false);
    // Everything except the isolated "." at (2,2) inside the ring.
    expect(reachable.has("0,0")).toBe(true);
    expect(reachable.has("4,4")).toBe(true);
    expect(reachable.has("2,2")).toBe(false); // walled off by the ring
  });

  it("returns empty set when the start cell itself is blocked", () => {
    const grid = gridFromRows(["#.", ".."]);
    expect(floodFillWalkable(grid, 0, 0, false).size).toBe(0);
  });

  it("wrap=true lets flood-fill cross the grid seam", () => {
    // A grid where the only walkable path between two pockets goes off one
    // edge and back in on the other (torus wrap), blocked otherwise.
    const grid = gridFromRows([".####.", "######", "######", "######", "######", "######"]);
    const noWrap = floodFillWalkable(grid, 0, 0, false);
    const wrapped = floodFillWalkable(grid, 0, 0, true);
    // Without wrap, (5,0) is unreachable (blocked by the run of #s); with
    // wrap, col 0 and col 5 are adjacent across the seam.
    expect(noWrap.has("5,0")).toBe(false);
    expect(wrapped.has("5,0")).toBe(true);
  });
});

describe("findUnreachableWalkable", () => {
  it("lists walkable cells outside the reachable set", () => {
    const grid = gridFromRows([".....", ".###.", ".#.#.", ".###.", "....."]);
    const reachable = floodFillWalkable(grid, 0, 0, false);
    const unreachable = findUnreachableWalkable(grid, reachable);
    expect(unreachable).toEqual([[2, 2]]);
  });
});

describe("carveToConnect — blocked lake ring case", () => {
  it("carves through a solid ring to reconnect an isolated walkable island", () => {
    // A 5x5 grid: a walkable island at (2,2) fully surrounded by a blocked
    // "lake" ring, itself inside an open field reachable from (0,0).
    const rows = [".....", ".###.", ".#.#.", ".###.", "....."];
    const grid = gridFromRows(rows);

    const before = floodFillWalkable(grid, 0, 0, false);
    expect(before.has("2,2")).toBe(false);

    const { grid: carvedGrid, carved } = carveToConnect(grid, 0, 0, false);

    expect(carved.length).toBeGreaterThan(0);
    const after = floodFillWalkable(carvedGrid, 0, 0, false);
    expect(after.has("2,2")).toBe(true);
    // Every walkable cell is now reachable — single connected component.
    expect(findUnreachableWalkable(carvedGrid, after)).toEqual([]);
  });

  it("is a no-op (no carving) when the grid is already fully connected", () => {
    const grid = gridFromRows([".....", ".....", "....."]);
    const { carved } = carveToConnect(grid, 0, 0, false);
    expect(carved).toEqual([]);
  });

  it("guarantees the start cell is walkable even if it starts blocked", () => {
    const grid = gridFromRows(["#..", "...", "..."]);
    const { grid: carvedGrid, carved } = carveToConnect(grid, 0, 0, false);
    expect(carvedGrid[0][0]).toBe(true);
    expect(carved).toContainEqual([0, 0]);
  });

  it("reconnects multiple isolated pockets, not just the first", () => {
    // Two separate isolated single-cell pockets in one grid.
    const rows = [
      "..........",
      ".########.",
      ".#.......#",
      ".#.######.",
      ".#.#....#.",
      ".#.#.##.#.",
      ".#.#.#.#..",
      ".#...#....",
      ".#########",
      "..........",
    ];
    const grid = gridFromRows(rows);
    const { grid: carvedGrid } = carveToConnect(grid, 0, 0, false);
    const reachable = floodFillWalkable(carvedGrid, 0, 0, false);
    expect(findUnreachableWalkable(carvedGrid, reachable)).toEqual([]);
  });

  it("respects wrap adjacency when carving (torus)", () => {
    const grid = gridFromRows([".####.", "######", "######", "######", "######", "######"]);
    const { grid: carvedGrid } = carveToConnect(grid, 0, 0, true);
    const reachable = floodFillWalkable(carvedGrid, 0, 0, true);
    expect(findUnreachableWalkable(carvedGrid, reachable)).toEqual([]);
  });
});

describe("guaranteeWalkableRing", () => {
  it("forces all 8 neighbors walkable around a point", () => {
    const grid = gridFromRows(["###", "###", "###"]);
    const carved = guaranteeWalkableRing(grid, 1, 1, false);
    expect(carved.length).toBe(9); // 3x3 including center
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        expect(grid[r][c]).toBe(true);
      }
    }
  });

  it("wraps around edges when the point is at a corner and wrap=true", () => {
    const grid = gridFromRows(["###", "###", "###"]);
    const carved = guaranteeWalkableRing(grid, 0, 0, true);
    expect(carved.length).toBe(9);
    // wrapped neighbor (-1,-1) => (2,2)
    expect(grid[2][2]).toBe(true);
  });
});

// ============================================================================
// Update 3 — biomes, blob-pond water, invisible-wall fix, full pipeline.
// ============================================================================

const WORLD_SIZE_128 = 128;

describe("findOrphanWater", () => {
  it("returns [] for an empty mask", () => {
    const mask: WaterMask = [
      [false, false],
      [false, false],
    ];
    expect(findOrphanWater(mask, true)).toEqual([]);
  });

  it("flags a single isolated water tile with no water neighbors", () => {
    const mask: WaterMask = [
      [false, false, false],
      [false, true, false],
      [false, false, false],
    ];
    expect(findOrphanWater(mask, false)).toEqual([[1, 1]]);
  });

  it("does not flag two adjacent water tiles", () => {
    const mask: WaterMask = [
      [false, false, false],
      [false, true, true],
      [false, false, false],
    ];
    expect(findOrphanWater(mask, false)).toEqual([]);
  });

  it("respects wrap adjacency (edge water tiles wrapping to each other are not orphans)", () => {
    // (0,0) and (2,0) are adjacent under wrap on a width-3 grid.
    const mask: WaterMask = [[true, false, true]];
    expect(findOrphanWater(mask, false)).toEqual([
      [0, 0],
      [2, 0],
    ]); // no wrap: both isolated
    expect(findOrphanWater(mask, true)).toEqual([]); // wrap: adjacent to each other
  });
});

describe("growPondBlob", () => {
  it("grows exactly targetSize tiles when space allows, all mutually connected", () => {
    const canPlace = () => true;
    const rng = mulberry32(7);
    const cells = growPondBlob(20, 20, 10, 10, 12, false, canPlace, rng);
    expect(cells.length).toBe(12);

    // Every cell (after the seed) must be adjacent to some other placed cell —
    // i.e. the blob is one connected component, never a stray tile.
    const mask: WaterMask = Array.from({ length: 20 }, () => Array(20).fill(false));
    for (const [c, r] of cells) mask[r][c] = true;
    const reachable = floodFillWalkable(mask, cells[0][0], cells[0][1], false);
    expect(reachable.size).toBe(cells.length);
  });

  it("returns [] when the seed itself fails canPlace", () => {
    const cells = growPondBlob(10, 10, 5, 5, 6, false, () => false, mulberry32(1));
    expect(cells).toEqual([]);
  });

  it("stops early (fewer than targetSize) when canPlace boxes it in", () => {
    // Only a 2x2 region is placeable; ask for far more than that.
    const canPlace = (c: number, r: number) => c >= 4 && c <= 5 && r >= 4 && r <= 5;
    const cells = growPondBlob(10, 10, 4, 4, 100, false, canPlace, mulberry32(3));
    expect(cells.length).toBeLessThanOrEqual(4);
    expect(cells.length).toBeGreaterThan(0);
  });
});

describe("biomeAt determinism and distribution", () => {
  it("same seed produces an identical biome map sample", () => {
    const seed = 42;
    const sampleA: Biome[] = [];
    const sampleB: Biome[] = [];
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 16; col++) {
        sampleA.push(biomeAt(seed, col, row));
        sampleB.push(biomeAt(seed, col, row));
      }
    }
    expect(sampleA).toEqual(sampleB);
  });

  it("different seeds produce different biome maps", () => {
    const sampleA: Biome[] = [];
    const sampleB: Biome[] = [];
    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        sampleA.push(biomeAt(1, col, row));
        sampleB.push(biomeAt(999999, col, row));
      }
    }
    expect(sampleA).not.toEqual(sampleB);
  });

  it("moistureAt/growthAt stay within [0,1]", () => {
    for (let i = 0; i < 200; i++) {
      const col = (i * 13) % 128;
      const row = (i * 7) % 128;
      const m = moistureAt(555, col, row);
      const g = growthAt(555, col, row);
      expect(m).toBeGreaterThanOrEqual(0);
      expect(m).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
    }
  });

  it("all four biomes appear at non-trivial frequency over a large map", () => {
    const counts: Record<Biome, number> = { meadow: 0, forest: 0, wetland: 0, scrub: 0 };
    const seed = 20260705;
    for (let row = 0; row < WORLD_SIZE_128; row++) {
      for (let col = 0; col < WORLD_SIZE_128; col++) {
        counts[biomeAt(seed, col, row)]++;
      }
    }
    const total = WORLD_SIZE_128 * WORLD_SIZE_128;
    for (const biome of Object.keys(counts) as Biome[]) {
      expect(counts[biome], `${biome} count`).toBeGreaterThan(total * 0.02);
    }
  });
});

describe("generateWorldGrid (full Update 3 pipeline)", () => {
  const baseOpts = {
    size: WORLD_SIZE_128,
    minNestZones: 4,
    maxNestZones: 6,
    minSameTypeSpacing: 3,
  };

  it("is deterministic: same seed -> identical grid", () => {
    const gridA = generateWorldGrid({ ...baseOpts, seed: 12345 });
    const gridB = generateWorldGrid({ ...baseOpts, seed: 12345 });
    expect(gridA).toEqual(gridB);
  });

  it("produces zero orphan water tiles (blob-pond construction guarantee)", () => {
    for (const seed of [1, 2, 3, 42, 999]) {
      const grid = generateWorldGrid({ ...baseOpts, seed });
      const mask = waterMaskFromTiles(grid);
      const orphans = findOrphanWater(mask, true);
      expect(orphans, `seed ${seed} produced orphan water at ${JSON.stringify(orphans)}`).toEqual(
        []
      );
    }
  });

  it("wetland regions carry 10-25% water coverage", () => {
    // Sample across several seeds and aggregate wetland-tile water coverage,
    // since any single seed's wetland region size/shape varies.
    let wetlandTiles = 0;
    let wetlandWaterTiles = 0;
    for (const seed of [1, 2, 3, 4, 5, 42, 100, 999]) {
      const grid = generateWorldGrid({ ...baseOpts, seed });
      for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
          if (grid[row][col].biome !== "wetland") continue;
          wetlandTiles++;
          if (grid[row][col].type === "water") wetlandWaterTiles++;
        }
      }
    }
    expect(wetlandTiles).toBeGreaterThan(0);
    const coverage = wetlandWaterTiles / wetlandTiles;
    expect(coverage, `wetland water coverage was ${coverage}`).toBeGreaterThanOrEqual(0.1);
    expect(coverage, `wetland water coverage was ${coverage}`).toBeLessThanOrEqual(0.25);
  });

  it("connectivity: flood-fill from spawn reaches every walkable tile at 128x128 (wrap on)", () => {
    const grid = generateWorldGrid({ ...baseOpts, seed: 777 });
    const isWalkableType = (t: WorldTile["type"]) => t !== "obstacle" && t !== "water";
    const walkable: Grid = grid.map((row) => row.map((t) => isWalkableType(t.type)));
    const spawnCol = Math.floor(WORLD_SIZE_128 / 2);
    const spawnRow = Math.floor(WORLD_SIZE_128 / 2);
    const reachable = floodFillWalkable(walkable, spawnCol, spawnRow, true);
    const unreachable = findUnreachableWalkable(walkable, reachable);
    expect(unreachable).toEqual([]);
  });

  it("meets scaled forage-node and nest-count targets", () => {
    const grid = generateWorldGrid({ ...baseOpts, seed: 55555 });
    let forage = 0;
    let nests = 0;
    for (const row of grid) {
      for (const tile of row) {
        if (tile.type === "forage") forage++;
        if (tile.type === "nest") nests++;
      }
    }
    // Scaled minimum: old 8 nodes / 48^2 tiles, floored at 8.
    const expectedMinForage = Math.max(8, Math.round((8 / (48 * 48)) * WORLD_SIZE_128 * WORLD_SIZE_128));
    expect(forage).toBeGreaterThanOrEqual(expectedMinForage);
    expect(nests).toBeGreaterThanOrEqual(4);
    expect(nests).toBeLessThanOrEqual(6);
  });

  it("generates a 128x128 grid within a reasonable time (<=2s)", () => {
    const start = Date.now();
    generateWorldGrid({ ...baseOpts, seed: 24680 });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThanOrEqual(2000);
  });
});

describe("decideTileDraw (invisible-wall fix)", () => {
  const noTextures = () => false;
  const allTextures = () => true;

  it("obstacle tiles always yield a draw instruction, even with no textures loaded", () => {
    const tile: WorldTile = { type: "obstacle", revealed: false };
    const decision = decideTileDraw(tile, 0.3, noTextures);
    expect(decision.kind).not.toBe("none");
    expect(decision.kind).toBe("rect");
  });

  it("water tiles always yield a draw instruction, even with no textures loaded", () => {
    const tile: WorldTile = { type: "water", revealed: false };
    const decision = decideTileDraw(tile, 0.9, noTextures);
    expect(decision.kind).not.toBe("none");
    expect(decision.kind).toBe("rect");
  });

  it("obstacle/water tiles prefer a sprite when a texture IS available", () => {
    const obstacle: WorldTile = { type: "obstacle", revealed: false };
    const water: WorldTile = { type: "water", revealed: false };
    expect(decideTileDraw(obstacle, 0.1, allTextures).kind).toBe("sprite");
    expect(decideTileDraw(water, 0.1, allTextures).kind).toBe("sprite");
  });

  it("every obstacle/water tile in a generated grid yields a non-'none' decision regardless of texture availability", () => {
    const grid = generateWorldGrid({
      seed: 909090,
      size: WORLD_SIZE_128,
      minNestZones: 4,
      maxNestZones: 6,
      minSameTypeSpacing: 3,
    });
    const rng = mulberry32(0x5eed);
    for (const row of grid) {
      for (const tile of row) {
        const roll = rng();
        if (tile.type === "obstacle" || tile.type === "water") {
          const decision = decideTileDraw(tile, roll, noTextures);
          expect(decision.kind, `${tile.type} tile drew "none"`).not.toBe("none");
        }
      }
    }
  });

  it("plain grass with no prop roll draws nothing", () => {
    const tile: WorldTile = { type: "grass", revealed: false };
    const decision = decideTileDraw(tile, 0.1, allTextures);
    expect(decision.kind).toBe("none");
  });
});
