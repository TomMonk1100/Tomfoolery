/**
 * biomes — pure, Phaser-free biome classification for Update 3's 128x128
 * world. Kept separate (and dependency-free besides nothing) so it's
 * trivially unit-testable and importable by the next agent's chunked ground
 * renderer without pulling in any Phaser/WorldGenSystem machinery.
 *
 * DECISIONS:
 * - Deterministic from (seed, col, row): a seeded low-frequency value-noise
 *   field (bilinear-interpolated lattice noise, NOT simplex/perlin gradient
 *   noise — value noise is simpler to make byte-for-byte deterministic across
 *   engines and is plenty smooth at the low frequencies used here) drives two
 *   independent channels, "moisture" and "growth", each in [0,1].
 * - Two hashed lattices (moisture uses a different hash offset than growth)
 *   so the channels aren't just a linear function of each other — this keeps
 *   biome regions from all lining up on the same boundary.
 * - Biome assignment is a simple quadrant-style decision tree over
 *   (moisture, growth): wet+low-growth -> wetland; dry+low-growth -> scrub;
 *   high-growth -> forest; else meadow (baseline). Thresholds chosen (see
 *   MOISTURE_WET / MOISTURE_DRY / GROWTH_FOREST below) so all four biomes
 *   appear at reasonable frequency over a large map rather than one biome
 *   dominating.
 * - Pure functions of (seed, col, row) only — no mutable module state, so
 *   biomeAt is safe to call from anywhere (including inside a hot per-tile
 *   loop) and is trivially memoizable by callers if needed.
 */

export type Biome = "meadow" | "forest" | "wetland" | "scrub";

export interface BiomeParams {
  /** Multiplies the base ground-tint the next agent's chunk renderer applies. */
  groundTint: number;
  /** Relative weight of "tree" vs "rock" obstacle roll (0..1, higher = more trees). */
  obstacleTreeWeight: number;
  /** Relative weight of "rock" obstacle roll — kept explicit (not just 1-tree) for clarity/tuning. */
  obstacleRockWeight: number;
  /** Probability a non-water tile in this biome becomes an obstacle. */
  obstacleDensity: number;
  /** Probability a non-water, non-obstacle tile becomes a forage node. */
  forageDensity: number;
  /** Probability a plain tile gets a decorative prop (flower/pebble). */
  propDensity: number;
  /** Whether this biome is eligible to host generated water blobs. */
  waterAllowed: boolean;
}

/** Per-biome tuning table. Exported so the renderer/gen system share one source of truth. */
export const BIOME_TABLE: Record<Biome, BiomeParams> = {
  meadow: {
    groundTint: 0x4a7c3f, // baseline grass green (matches TILE_COLORS.grass)
    obstacleTreeWeight: 0.5,
    obstacleRockWeight: 0.5,
    obstacleDensity: 0.06,
    forageDensity: 0.12,
    propDensity: 0.08,
    waterAllowed: true, // rare ponds allowed everywhere as "else" case
  },
  forest: {
    groundTint: 0x2f5430, // darker, denser green
    obstacleTreeWeight: 0.85,
    obstacleRockWeight: 0.15,
    obstacleDensity: 0.16,
    forageDensity: 0.14,
    propDensity: 0.1,
    waterAllowed: true,
  },
  wetland: {
    groundTint: 0x3f6a4f, // muddy green-teal
    obstacleTreeWeight: 0.3,
    obstacleRockWeight: 0.1,
    obstacleDensity: 0.05,
    forageDensity: 0.1,
    propDensity: 0.05,
    waterAllowed: true, // primary pond/lake host biome
  },
  scrub: {
    groundTint: 0x8a7a4a, // dry tan-green
    obstacleTreeWeight: 0.15,
    obstacleRockWeight: 0.85,
    obstacleDensity: 0.09,
    forageDensity: 0.05,
    propDensity: 0.04,
    waterAllowed: false, // dry biome: no ponds spawn here
  },
};

// ----------------------------------------------------------------------------
// Seeded low-frequency value noise
// ----------------------------------------------------------------------------

/** Deterministic integer hash -> [0,1). Same family as mulberry32's mixing step. */
function hash2(seed: number, x: number, y: number): number {
  let h = (seed ^ (x * 374761393) ^ (y * 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

function fade(t: number): number {
  // Smoothstep (3t^2 - 2t^3) for continuous derivative at lattice points.
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Bilinear-interpolated value noise sampled at (x,y) in lattice-cell space
 * (i.e. divide world col/row by your desired frequency before calling).
 * `channelSeed` offsets the hash so independent channels (moisture/growth)
 * don't share lattice values.
 */
function valueNoise2D(seed: number, channelSeed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const sx = fade(x - x0);
  const sy = fade(y - y0);

  const s = seed ^ channelSeed;
  const n00 = hash2(s, x0, y0);
  const n10 = hash2(s, x1, y0);
  const n01 = hash2(s, x0, y1);
  const n11 = hash2(s, x1, y1);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

/** Lattice frequency: larger = smoother/larger biome regions. Tuned for a 128x128 world
 * so each biome region spans roughly 20-40 tiles across, not the whole map and not tile-noise. */
const NOISE_SCALE = 28;

const MOISTURE_CHANNEL_SEED = 0x9e3779b1;
const GROWTH_CHANNEL_SEED = 0x85ebca77;

/** Moisture value noise in [0,1] at (col,row) for the given world seed. */
export function moistureAt(seed: number, col: number, row: number): number {
  return valueNoise2D(seed, MOISTURE_CHANNEL_SEED, col / NOISE_SCALE, row / NOISE_SCALE);
}

/** Growth (vegetation density) value noise in [0,1] at (col,row) for the given world seed. */
export function growthAt(seed: number, col: number, row: number): number {
  return valueNoise2D(seed, GROWTH_CHANNEL_SEED, col / NOISE_SCALE, row / NOISE_SCALE);
}

// Thresholds chosen empirically (see tests/worldGen.test.ts biome-distribution
// assertions) so all four biomes appear at non-trivial frequency across a
// large map rather than one biome dominating.
const MOISTURE_WET = 0.6;
const MOISTURE_DRY = 0.4;
const GROWTH_FOREST = 0.6;

/**
 * Deterministic biome classification for a tile: same (seed,col,row) always
 * yields the same Biome; different seeds produce different maps.
 */
export function biomeAt(seed: number, col: number, row: number): Biome {
  const moisture = moistureAt(seed, col, row);
  const growth = growthAt(seed, col, row);

  if (moisture >= MOISTURE_WET && growth < GROWTH_FOREST) return "wetland";
  if (moisture <= MOISTURE_DRY && growth < GROWTH_FOREST) return "scrub";
  if (growth >= GROWTH_FOREST) return "forest";
  return "meadow";
}

/** Convenience: full per-tile biome params in one call. */
export function biomeParamsAt(seed: number, col: number, row: number): BiomeParams {
  return BIOME_TABLE[biomeAt(seed, col, row)];
}
