/**
 * Understory — shared type contracts.
 * ALL systems build against these interfaces. Do not change field names
 * without updating every consumer; agents depend on this being stable.
 */

// ----------------------------------------------------------------------------
// Slots, rarities, verbs, seasons
// ----------------------------------------------------------------------------

export type SpriteSlot = "head" | "back" | "tail" | "paws" | "aura" | "trail";
export type SpriteSlotOrNone = SpriteSlot | "none";

export const SPRITE_SLOTS: SpriteSlot[] = [
  "head",
  "back",
  "tail",
  "paws",
  "aura",
  "trail",
];

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
];

/** Rank used for slot-conflict resolution; higher wins. */
export const RARITY_RANK: Record<Rarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

export type Verb =
  | "forage"
  | "explore"
  | "nest"
  | "befriend"
  | "evade"
  | "migrate";

export type Season = "spring" | "summer" | "autumn" | "winter";
export const SEASON_ORDER: Season[] = ["spring", "summer", "autumn", "winter"];

export const LIFE_STAGE: Record<Season, string> = {
  spring: "Newborn",
  summer: "Juvenile",
  autumn: "Adult",
  winter: "Elder",
};

// ----------------------------------------------------------------------------
// Input events (emitted by InputController)
// ----------------------------------------------------------------------------

export type InputEventType = "tap" | "swipe" | "drag" | "focusRelease";

export interface InputEvent {
  type: InputEventType;
  /** World/screen x,y of the pointer at the moment of emission. */
  x: number;
  y: number;
  /** Normalized drag direction & magnitude (for "drag"); unit-ish vector. */
  dx: number;
  dy: number;
  /** For swipe: direction vector. For focusRelease: accuracy 0..1. */
  magnitude: number;
  /** For focusRelease: 0..1 where 1 == perfect release. */
  accuracy?: number;
}

/** Anything that can drive the verb systems — a human InputController or the AI. */
export interface InputSource {
  /** Register a listener for classified input events. */
  on(handler: (e: InputEvent) => void): void;
  /** Per-frame update; returns the current drag vector if a drag is active. */
  update(deltaMs: number): { dragX: number; dragY: number } | null;
  destroy(): void;
}

// ----------------------------------------------------------------------------
// Data schemas (mirror the JSON files in src/data/)
// ----------------------------------------------------------------------------

export interface CardEffect {
  type: string;
  magnitude: number;
}

export interface CardData {
  id: string;
  name: string;
  rarity: Rarity;
  isUnique: boolean;
  weightsByLevel: Record<string, number>; // keys "1".."10"
  effect: CardEffect;
  tradeoff: CardEffect;
  spriteSlot: SpriteSlotOrNone;
  stacking: boolean;
  _balance?: string;
}

export interface AnimalData {
  name: string;
  speed: number;
  forageRadius: number;
  xpToLevel: number[]; // index 0 == level 1 threshold
  verbs: Verb[];
  spriteAnchors: Record<SpriteSlot, { x: number; y: number }>;
  /** Combat overhaul fields (Nest & Fang). WorldScene applies defaults if absent. */
  maxHp?: number; // default 100
  startingWeaponId?: string; // e.g. "bark-blast"
  spriteKey?: string; // atlas key, e.g. "animal_dog"
}

export interface MetaNode {
  id: string;
  name: string;
  costSunseeds: number;
  prerequisiteIds: string[];
  effect: string;
}

// ----------------------------------------------------------------------------
// Player state (mutated during a run by draft/verbs)
// ----------------------------------------------------------------------------

export interface ActiveCard {
  cardId: string;
  stacks: number;
  draftOrder: number; // for deterministic tie-breaks (earliest-drafted-first)
}

/** A weapon the player currently wields. Levels 1..5; evolved replaces level scaling. */
export interface ActiveWeapon {
  weaponId: string;
  level: number;
  evolved: boolean;
}

export interface ActivePassive {
  passiveId: string;
  stacks: number;
}

export interface PlayerState {
  animalId: string;
  level: number;
  xp: number;
  luck: number; // additive Luck% from cards, e.g. 20 == +20%
  instinctMode: boolean;
  activeCards: ActiveCard[]; // ordered by draftOrder
  // ---- Nest & Fang combat state ----
  hp: number;
  maxHp: number;
  /** 0..100. Above WELL_FED_THRESHOLD grants Well-Fed damage bonus. */
  hunger: number;
  /** Carried (unbanked) food count, max CARRY_CAP. */
  carriedFood: number;
  activeWeapons: ActiveWeapon[]; // max WEAPON_SLOTS
  activePassives: ActivePassive[];
  // Live run stats accumulator (see RunStats).
  stats: RunStats;
}

// ----------------------------------------------------------------------------
// Run stats
// ----------------------------------------------------------------------------

export interface PerCardStat {
  valueDelivered: number;
  costIncurred: number;
}

export interface RunStats {
  distanceTraveled: number;
  forageCount: number;
  befriendAttempts: number;
  befriendSuccesses: number;
  evadeCount: number;
  hazardHitsTaken: number;
  cardsDrafted: number;
  seasonsCompleted: number;
  totalXP: number;
  perCardStats: Record<string, PerCardStat>;
  // ---- Nest & Fang combat stats ----
  kills: number;
  damageDealt: number;
  damageTaken: number;
  foodEaten: number;
  foodBanked: number;
  nestRaidsSurvived: number;
  bossesDefeated: number;
  companionsRecruited: number;
}

export function makeRunStats(): RunStats {
  return {
    distanceTraveled: 0,
    forageCount: 0,
    befriendAttempts: 0,
    befriendSuccesses: 0,
    evadeCount: 0,
    hazardHitsTaken: 0,
    cardsDrafted: 0,
    seasonsCompleted: 0,
    totalXP: 0,
    perCardStats: {},
    kills: 0,
    damageDealt: 0,
    damageTaken: 0,
    foodEaten: 0,
    foodBanked: 0,
    nestRaidsSurvived: 0,
    bossesDefeated: 0,
    companionsRecruited: 0,
  };
}

// ----------------------------------------------------------------------------
// Meta / save
// ----------------------------------------------------------------------------

export interface MetaSave {
  sunseeds: number;
  keepsakes: Record<string, number>;
  unlockedNodes: string[];
}

export function defaultMeta(): MetaSave {
  return { sunseeds: 0, keepsakes: {}, unlockedNodes: [] };
}

// ----------------------------------------------------------------------------
// World
// ----------------------------------------------------------------------------

export type TileType = "grass" | "obstacle" | "forage" | "nest" | "water";

export interface WorldTile {
  type: TileType;
  revealed: boolean;
  /** For forage nodes: whether already harvested. */
  harvested?: boolean;
}

export const WORLD_SIZE = 40;
export const TILE_PX = 32;

// ----------------------------------------------------------------------------
// Global game constants
// ----------------------------------------------------------------------------

export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 854; // portrait 9:16-ish
export const RUN_LENGTH_MS = 8 * 60 * 1000; // 8 minute dense run (4 seasons x 2 min)
export const INSTINCT_XP_MULT = 0.6;

// Scene keys — shared so scenes reference each other by constant.
export const SCENE = {
  Boot: "BootScene",
  Meta: "MetaHubScene",
  World: "WorldScene",
  Draft: "DraftScene",
  LifeStory: "LifeStoryScene",
} as const;

// Registry keys for cross-scene shared singletons.
export const REG = {
  playerState: "playerState",
  meta: "meta",
  saveManager: "saveManager",
  audio: "audio",
} as const;

// ----------------------------------------------------------------------------
// Cross-system events (names emitted/consumed via ctx.events).
// Defined here (dependency-free) and re-exported from context.ts.
// ----------------------------------------------------------------------------
export const EV = {
  input: "input", // (InputEvent) — raw classified input
  levelUp: "levelUp", // (level:number) — request a draft
  cardChosen: "cardChosen", // (cardId:string) — draft resolved
  verbPerformed: "verbPerformed", // ({verb:Verb, ...}) — a verb fired
  forageHarvested: "forageHarvested", // ({x,y,amount})
  seasonChanged: "seasonChanged", // (season:Season)
  hazardHit: "hazardHit", // ({amount}) — legacy, removed with HazardSystem
  evadeSuccess: "evadeSuccess",
  runEnded: "runEnded", // (outcome?: RunOutcome) — go to Life Story
  spriteDirty: "spriteDirty", // () — SpriteComposer should re-render
  // ---- Nest & Fang combat events (payload shapes in docs/CONTRACTS.md) ----
  enemySpawned: "enemySpawned", // (EnemySpawnedEvent)
  enemyDamaged: "enemyDamaged", // (EnemyDamagedEvent) — for damage numbers / hit flash
  enemyKilled: "enemyKilled", // (EnemyKilledEvent)
  playerDamaged: "playerDamaged", // (PlayerDamagedEvent)
  playerDied: "playerDied", // () — WorldScene converts to runEnded("died")
  weaponFired: "weaponFired", // (WeaponFiredEvent)
  weaponUpgraded: "weaponUpgraded", // ({weaponId, level, evolved})
  xpMoteSpawned: "xpMoteSpawned", // ({x, y, value})
  xpMoteCollected: "xpMoteCollected", // ({value})
  foodSpawned: "foodSpawned", // ({x, y, heal})
  foodEaten: "foodEaten", // ({heal, wellFed:boolean})
  hungerChanged: "hungerChanged", // (hunger:number 0..100)
  wellFedChanged: "wellFedChanged", // (wellFed:boolean)
  nestDamaged: "nestDamaged", // ({hp, maxHp})
  nestRaidStarted: "nestRaidStarted", // ({season:Season})
  nestRaidEnded: "nestRaidEnded", // ({survived:boolean})
  foodBanked: "foodBanked", // ({count, total})
  bossSpawned: "bossSpawned", // ({enemyId, name})
  bossDefeated: "bossDefeated", // ({enemyId, name})
  companionRecruited: "companionRecruited", // ({companionId})
  screenShake: "screenShake", // ({intensity:number 0..1, durationMs})
} as const;

export type VerbEvent = { verb: Verb; x: number; y: number; success?: boolean };

// ----------------------------------------------------------------------------
// Nest & Fang — combat data schemas (mirror src/data/*.json)
// ----------------------------------------------------------------------------

export type RunOutcome = "survived" | "died";

/** Every weapon maps onto one of six engine archetypes implemented by WeaponSystem. */
export type WeaponArchetype =
  | "aoe-pulse" // radial ring from player (Bark Blast, Thumper Quake)
  | "melee-sweep" // arc swing anchored to player (Tail Wag, Claw Flurry)
  | "projectile" // spawned missile: straight/arc/boomerang/split via params (Fetch!, Carrot Toss)
  | "orbit" // objects circling player (Lucky Clover)
  | "trail" // damaging path left by movement/burst (Zoomies, Bunny Barrage)
  | "zone"; // placed/held damaging area (Purr Aura, Dig eruption, Slobber puddle)

export interface WeaponLevelStats {
  damage: number;
  cooldownMs: number;
  /** Radius (aoe/zone/orbit), arc length px (sweep), or lifetime range px (projectile/trail). */
  area: number;
  /** Projectile/orbit speed px/s. */
  speed?: number;
  /** Projectile count / orbit count / trail segments. */
  count?: number;
  /** Zone/trail lifetime. */
  durationMs?: number;
  knockback?: number; // px impulse
  slowPct?: number; // 0..100 enemy slow while affected
  critPct?: number; // 0..100 chance of 2x
}

export interface WeaponEvolution {
  /** Evolved display name, e.g. "Sonic Howl". */
  name: string;
  /** Passive that must be owned (any stacks) for evolution to be offered at weapon L5. */
  requiresPassiveId: string;
  stats: WeaponLevelStats;
  description: string;
  /** Optional archetype override (e.g. Zoomies trail -> Mach Zoomies zone). */
  archetype?: WeaponArchetype;
}

export interface WeaponData {
  id: string;
  name: string;
  /** "dog" | "cat" | "rabbit" — weapons are species-specific. */
  animal: string;
  archetype: WeaponArchetype;
  isStarting: boolean;
  rarity: Rarity; // draft weighting bucket
  /** Exactly 5 entries, level 1..5. */
  levels: WeaponLevelStats[];
  evolution: WeaponEvolution;
  description: string;
  /** Atlas frame key for the draft card / HUD icon, e.g. "icon_bark_blast". */
  icon: string;
  /** Projectile behavior params, only for archetype "projectile". */
  projectile?: {
    kind: "straight" | "arc" | "boomerang" | "split";
    splitCount?: number;
    pierce?: number;
  };
}

export interface PassiveData {
  id: string;
  name: string;
  /** Species-specific, matching WeaponData.animal. */
  animal: string;
  rarity: Rarity;
  effect: CardEffect; // reuses {type, magnitude}; types listed in CONTRACTS.md
  description: string;
  icon: string;
  maxStacks: number;
}

export type EnemyBehavior =
  | "chaser" // steady beeline (Green Slime)
  | "lunger" // pause -> fast lunge (Red Slime)
  | "splitter" // tanky, splitsInto on death (Blue Slime)
  | "shooter" // stationary/slow, fires projectile (Gloomcap)
  | "charger" // telegraphed straight-line charge (Thorn Crawler)
  | "drifter" // erratic sine drift, ignores obstacles (Will-o-Wisp)
  | "ambusher" // spawns under player with telegraph (Mudmaw)
  | "boss"; // scripted per-boss pattern in EnemySystem

export interface EnemyData {
  id: string;
  name: string;
  hp: number;
  speed: number; // px/s
  damage: number; // contact damage per hit (0.5s contact tick)
  xp: number; // XP mote value dropped
  behavior: EnemyBehavior;
  size: "small" | "medium" | "large" | "boss";
  /** Atlas key, e.g. "enemy_slime_green". */
  spriteKey: string;
  splitsInto?: { id: string; count: number };
  projectile?: { speed: number; damage: number; cooldownMs: number };
  /** 0..1 chance to drop a food item on death. */
  foodDropChance: number;
}

export interface WaveEntry {
  /** Run-clock ms at which this wave becomes active. */
  atMs: number;
  enemyId: string;
  /** Sustained on-screen target for this enemy type while wave active. */
  count: number;
  /** Spawn interval while below count. */
  intervalMs: number;
  /** Elite: 2x size/hp/damage/xp, guaranteed food drop. */
  elite?: boolean;
}

export interface BossEntry {
  atMs: number;
  enemyId: string;
}

export interface WavesFile {
  waves: WaveEntry[];
  bosses: BossEntry[]; // 4 entries, one per season end
}

export interface NestState {
  hp: number;
  maxHp: number;
  bankedFood: number;
  raidActive: boolean;
  /** World-pixel center of the nest. */
  x: number;
  y: number;
}

// ---- Nest & Fang combat constants ----
export const WEAPON_SLOTS = 4;
export const PASSIVE_SLOTS = 4;
export const MAX_ENEMIES = 40;
export const MAX_PROJECTILES = 120;
export const WELL_FED_THRESHOLD = 50; // hunger > 50 => Well-Fed
export const WELL_FED_DAMAGE_BONUS = 0.15;
export const HUNGER_DRAIN_PER_SEC = 100 / 150; // full -> empty in 2.5 min if never eating
export const CARRY_CAP = 5;
export const NEST_MAX_HP = 200;
export const NEST_HEAL_PER_SEC = 8;
export const XP_MAGNET_RADIUS = 70; // px, before Keen Nose bonuses
export const COMPANION_CAP = 2;
export const CONTACT_TICK_MS = 500;
export const MAX_LEVEL = 20;

// ---- Combat event payload types ----
export interface EnemyDamagedEvent {
  enemyId: string; // instance id
  x: number;
  y: number;
  amount: number;
  crit: boolean;
  remainingHp: number;
}
export interface EnemyKilledEvent {
  enemyId: string;
  enemyDataId: string;
  x: number;
  y: number;
  xp: number;
  wasBoss: boolean;
}
export interface EnemySpawnedEvent {
  enemyId: string;
  enemyDataId: string;
  x: number;
  y: number;
}
export interface PlayerDamagedEvent {
  amount: number;
  source: string; // enemyDataId or "raid" etc.
  remainingHp: number;
}
export interface WeaponFiredEvent {
  weaponId: string;
  x: number;
  y: number;
}
