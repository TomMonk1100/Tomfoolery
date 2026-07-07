/**
 * One-off generator for src/data/fallback-layout.json (Update 3: regenerated
 * at 128x128 to match the new WORLD_SIZE). Run with:
 *   npx vite-node scripts/gen-fallback-layout.ts
 * Uses the SAME generateWorldGrid pipeline as production/tests (no parallel
 * logic), so the fallback snapshot is a realistic, connectivity-guaranteed,
 * zero-orphan-water, biome-correct 128x128 grid — just frozen to a fixed
 * seed so the fallback path (which loads this file verbatim, without biome
 * data) is deterministic across runs.
 *
 * Output format matches the existing loader (WorldGenSystem.loadFallbackGrid):
 * { "tiles": string[][] } with rows of single-character tile-type letters
 * (g=grass, o=obstacle, f=forage, n=nest, w=water).
 */
import { writeFileSync } from "node:fs";
import { generateWorldGrid } from "../src/systems/worldGenSim";

const FALLBACK_SEED = 0xf0ba1c;

const grid = generateWorldGrid({
  seed: FALLBACK_SEED,
  size: 128,
  minNestZones: 4,
  maxNestZones: 6,
  minSameTypeSpacing: 3,
});

const typeToLetter: Record<string, string> = {
  grass: "g",
  obstacle: "o",
  forage: "f",
  nest: "n",
  water: "w",
};

const tiles: string[][] = grid.map((row) => row.map((tile) => typeToLetter[tile.type] ?? "g"));

const out = { tiles };
writeFileSync(new URL("../src/data/fallback-layout.json", import.meta.url), JSON.stringify(out));

// Quick sanity summary printed to stdout for the run log.
const counts: Record<string, number> = { g: 0, o: 0, f: 0, n: 0, w: 0 };
for (const row of tiles) for (const c of row) counts[c] = (counts[c] ?? 0) + 1;
console.log("fallback-layout.json regenerated at 128x128. Tile counts:", counts);
