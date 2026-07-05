/**
 * worldGenSim — pure, Phaser-free world-generation logic for Update 2's
 * "seamless looping wilds" rework. Kept separate from combat/sim.ts (which is
 * combat-only) so WorldGenSystem's connectivity guarantee can be unit-tested
 * headlessly, same spirit as combat/sim.ts.
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
 */

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
