import { describe, it, expect } from "vitest";
import {
  floodFillWalkable,
  findUnreachableWalkable,
  carveToConnect,
  guaranteeWalkableRing,
  Grid,
} from "../src/systems/worldGenSim";

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
