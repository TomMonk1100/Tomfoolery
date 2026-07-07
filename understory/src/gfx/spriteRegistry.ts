/**
 * spriteRegistry — pure data layer for the pixel-art pipeline. Zero Phaser
 * imports so it (and everything that only imports from here) can be loaded
 * by vitest without touching `window`/Phaser's runtime side effects.
 *
 * PixelArt.ts re-exports everything below so existing
 * `import { SPRITE_KEYS } from "../gfx/PixelArt"` call sites keep working.
 * Sprite data files (src/gfx/sprites/*.ts) and tests/sprites.test.ts must
 * import ONLY from this file, never from PixelArt.ts.
 */

export const PIXEL_SCALE = 3;

/** char -> CSS color. "." is always transparent and must not appear here. */
export type Palette = Record<string, string>;

export interface AnimDef {
  /** Frame indices into `frames`. */
  frames: number[];
  frameRate: number;
  /** -1 = loop forever, 0 = play once. */
  repeat: number;
}

export interface PixelSpriteDef {
  key: string;
  /** Each frame: array of equal-length strings. All frames same dimensions. */
  frames: string[][];
  palette: Palette;
  /** Named animations, e.g. { idle: {...}, walk: {...}, death: {...} }. */
  anims: Record<string, AnimDef>;
}

const registry = new Map<string, PixelSpriteDef>();

/** Register a sprite definition (call at module scope in src/gfx/sprites/*). */
export function registerSprite(def: PixelSpriteDef): void {
  registry.set(def.key, def);
}

export function getRegisteredSprites(): ReadonlyMap<string, PixelSpriteDef> {
  return registry;
}

/** Texture key for a specific frame of a sprite. */
export function frameKey(key: string, frame = 0): string {
  return `${key}_${frame}`;
}

/** Phaser animation key. */
export function animKey(key: string, anim: string): string {
  return `${key}:${anim}`;
}

// ---------------------------------------------------------------------------
// CANONICAL SPRITE KEYS — the shared vocabulary between Workers A, B, D, E, F.
// Worker A MUST register a sprite for every key. Consumers MUST use these
// constants (never string literals).
// ---------------------------------------------------------------------------
export const SPRITE_KEYS = {
  // Animals (24x24; anims: idle, walk, attack, hurt; face right, flipX for left)
  dog: "animal_dog",
  cat: "animal_cat",
  rabbit: "animal_rabbit",
  // Enemies (anims: idle, move, death)
  slimeGreen: "enemy_slime_green", // 16
  slimeRed: "enemy_slime_red", // 16
  slimeBlue: "enemy_slime_blue", // 24
  gloomcap: "enemy_gloomcap", // 24
  thornCrawler: "enemy_thorn_crawler", // 24
  wisp: "enemy_wisp", // 16
  mudmaw: "enemy_mudmaw", // 24
  bossKingSlime: "boss_king_slime", // 48
  bossElderGloomcap: "boss_elder_gloomcap", // 48
  bossBrambleTyrant: "boss_bramble_tyrant", // 48
  bossLongDark: "boss_long_dark", // 48
  // Companions (16x16; idle, walk, attack)
  companionSparrow: "companion_sparrow",
  companionSquirrel: "companion_squirrel",
  // Projectiles & effects (16x16 unless noted; anims optional)
  projStick: "proj_stick",
  projHairball: "proj_hairball",
  projCarrot: "proj_carrot",
  projGoo: "proj_goo",
  projSpore: "proj_spore",
  projClover: "proj_clover",
  fxBarkRing: "fx_bark_ring", // 32, anim: pulse (play once)
  fxSweep: "fx_sweep", // 32, anim: swing (play once)
  fxQuakeRing: "fx_quake_ring", // 32
  fxDust: "fx_dust",
  fxAura: "fx_aura", // 32, anim: pulse loop
  fxScissor: "fx_scissor", // 32, anim: slash (play once), 2-frame thin line — Update 2 scissor-kick
  // Pickups (16x16)
  xpMote: "pickup_xp_mote", // anim: sparkle loop
  foodBerry: "pickup_food_berry",
  foodMushroom: "pickup_food_mushroom",
  foodBone: "pickup_food_bone",
  // World (32x32 tiles / props)
  tileGrassA: "tile_grass_a",
  tileGrassB: "tile_grass_b",
  tileGrassC: "tile_grass_c",
  tileGrassSeamless: "tile_grass_seamless", // 64 — Update 2: single tileable background, replaces the per-tile grass checkerboard
  tileWater: "tile_water", // anim: shimmer loop (2 frames)
  tileShoreRim: "tile_shore_rim", // Update 3: shore-edge strip drawn on pond border tiles
  tileObstacleTree: "tile_obstacle_tree",
  tileObstacleRock: "tile_obstacle_rock",
  propFlower: "prop_flower",
  propPebble: "prop_pebble",
  nest: "world_nest", // 32; anims: idle, damaged
  forageBush: "world_forage_bush", // anims: full, harvested
  // UI icons (16x16) — one per weapon + passive; naming: icon_<id kebab->snake>
  // e.g. weapon "bark-blast" -> "icon_bark_blast". Worker A generates the full
  // set from the ids listed in docs/CONTRACTS.md §Weapons/§Passives.
} as const;

/** Icon key for a weapon/passive id, e.g. "bark-blast" -> "icon_bark_blast". */
export function iconKey(id: string): string {
  return `icon_${id.replace(/-/g, "_")}`;
}

/** Shared 16-color palette (workers may add sprite-local accents sparingly). */
export const PALETTE = {
  outline: "#1a1423",
  white: "#f4f0e8",
  cream: "#dcc7a0",
  brown: "#7a5c3a",
  darkBrown: "#4a3423",
  grassLight: "#7bb661",
  grass: "#4a7c3f",
  grassDark: "#2f5430",
  leaf: "#a8d878",
  water: "#3a6ea5",
  waterLight: "#6fa8dc",
  slime: "#5fd35f",
  danger: "#d94f4f",
  gold: "#e8b23d",
  purple: "#8b5fbf",
  shadow: "#00000055",
} as const;
