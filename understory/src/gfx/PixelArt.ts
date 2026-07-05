/**
 * PixelArt — procedural pixel-art pipeline (CONTRACT + implementation home).
 *
 * OWNERSHIP: Worker A implements this module and authors all sprite data in
 * src/gfx/sprites/*.ts. Other workers must ONLY:
 *   - reference frame keys via SPRITE_KEYS / frameKey()
 *   - call playAnim() on sprites they create
 * and must render a plain fallback shape when `scene.textures.exists(key)`
 * is false, so they run standalone before the atlas lands.
 *
 * DESIGN (frozen):
 * - Sprites are authored as string-array pixel maps: each frame is string[]
 *   (rows), each char is a palette entry, "." = transparent.
 * - Sizes: small enemies/items 16x16, animals/medium enemies 24x24,
 *   large 32x32, bosses 48x48, tiles 32x32, icons 16x16.
 * - buildAtlas() draws every registered frame to canvas textures at
 *   PIXEL_SCALE=3 with nearest-neighbor (no smoothing), registers Phaser
 *   textures named `${key}_${frameIndex}` and Phaser animations named
 *   `${key}:${animName}`.
 */
import Phaser from "phaser";

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

/**
 * Build all registered sprites into Phaser textures + animations.
 * Idempotent; safe to call once per scene boot. Implemented by Worker A.
 */
export function buildAtlas(scene: Phaser.Scene): void {
  // Worker A: canvas-render every frame of every registered def at
  // PIXEL_SCALE with imageSmoothingEnabled=false, addCanvas texture per
  // frame under frameKey(), then scene.anims.create per AnimDef under
  // animKey() using generateFrameNames-equivalent single-frame entries.
  void scene;
  throw new Error("PixelArt.buildAtlas: implemented by Worker A");
}

/**
 * Play a named animation on a sprite created from frameKey(key,0).
 * Must silently no-op if the animation doesn't exist.
 */
export function playAnim(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  anim: string
): void {
  const ak = animKey(key, anim);
  if (sprite.scene.anims.exists(ak)) sprite.play(ak, true);
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
  // Pickups (16x16)
  xpMote: "pickup_xp_mote", // anim: sparkle loop
  foodBerry: "pickup_food_berry",
  foodMushroom: "pickup_food_mushroom",
  foodBone: "pickup_food_bone",
  // World (32x32 tiles / props)
  tileGrassA: "tile_grass_a",
  tileGrassB: "tile_grass_b",
  tileGrassC: "tile_grass_c",
  tileWater: "tile_water", // anim: shimmer loop (2 frames)
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
