/**
 * Runtime architecture contract.
 *
 * WorldScene owns a single GameContext and passes it to every system's
 * constructor: `new SomeSystem(scene, ctx)`. Systems communicate via
 * `ctx.events` (a Phaser EventEmitter) and read/write `ctx.player` state.
 *
 * Every gameplay system implements the `System` interface so WorldScene can
 * construct, update, and tear them down uniformly. This is the seam between
 * independently-built systems — keep it stable.
 */
import Phaser from "phaser";
import {
  PlayerState,
  Season,
  Verb,
  WorldTile,
  CardData,
  AnimalData,
  WeaponData,
  PassiveData,
  EnemyData,
  FusionData,
  SynergyData,
  NestState,
} from "./types";

export interface Vec2 {
  x: number;
  y: number;
}

/** Read-only snapshot of a live enemy, for targeting (WeaponSystem, InstinctAI). */
export interface EnemyView {
  /** Unique instance id. */
  id: string;
  /** EnemyData id, e.g. "slime-green". */
  dataId: string;
  x: number;
  y: number;
  hp: number;
  /** Collision radius px. */
  radius: number;
  isBoss: boolean;
}

/** Read-only-ish view of the generated world other systems query. */
export interface WorldView {
  size: number;
  tilePx: number;
  tileAt(col: number, row: number): WorldTile | null;
  worldToTile(x: number, y: number): { col: number; row: number };
  tileToWorld(col: number, row: number): Vec2;
  /** All unharvested forage node positions in world pixels. */
  forageNodes(): Vec2[];
  /** Nest zone positions in world pixels. */
  nestNodes(): Vec2[];
  /** Nearest unrevealed ("fog edge") position for the AI, or null. */
  nearestFogEdge(from: Vec2): Vec2 | null;
  /** Reveal fog around a world position within radius px. */
  revealAround(x: number, y: number, radiusPx: number): void;
  bounds(): { width: number; height: number };
}

/**
 * The shared mutable context. Systems read `player`, move the avatar via
 * `setVelocity`, gain xp via `addXP`, and coordinate through `events`.
 */
export interface GameContext {
  scene: Phaser.Scene;
  events: Phaser.Events.EventEmitter;

  player: PlayerState;
  animal: AnimalData;
  cards: CardData[];

  /** Avatar world position (center). */
  getPlayerPos(): Vec2;
  /** Translate the avatar by (dx,dy) px; WorldScene clamps to world bounds. */
  movePlayer(dx: number, dy: number): void;
  /** Update 2: unit vector toward nearest enemy (wrap-aware); falls back to
   * last nonzero move direction, then default right. Computed once/frame by
   * WorldScene via sim.computeFacing. All directional weapons (arc,
   * line-both, projectile spawn dir) use this — sprite flipX stays driven by
   * movement, not aim. */
  getFacing(): Vec2;

  world: WorldView;

  /** Current season. */
  season(): Season;

  /** Award XP (already run through instinct multiplier by caller if needed). */
  addXP(amount: number): void;

  /** Derived stat lookups from active cards (percent bonuses). */
  statBonus(statType: string): number;

  audio: AudioLike;

  /** True while a draft/UI overlay is up and gameplay should pause. */
  isPaused(): boolean;

  // ---- Nest & Fang combat API (WorldScene delegates to systems; safe stubs
  //      exist so any system compiles/runs before its counterpart is built) ----

  /** Content catalogs loaded from src/data/. */
  weapons: WeaponData[];
  passives: PassiveData[];
  enemyCatalog: EnemyData[];
  /** Update 3: fusion recipes (fusions.json). Empty until Phase 1 content lands. */
  fusions: FusionData[];
  /** Update 3: synergy definitions (synergies.json). Empty until Phase 1 content lands. */
  synergyDefs: SynergyData[];

  /** Live enemies (empty until EnemySystem registers). */
  getEnemies(): EnemyView[];
  /** Deal damage to an enemy instance. Returns true if it existed. */
  damageEnemy(instanceId: string, amount: number, crit?: boolean): boolean;
  /** Damage the player (armor applied inside). Emits EV.playerDamaged. */
  damagePlayer(amount: number, source: string): void;
  /** Drop an XP mote at world position. */
  spawnXPMote(x: number, y: number, value: number): void;
  /** Drop a food item at world position. */
  spawnFood(x: number, y: number, heal: number): void;
  /** Current hunger 0..100. */
  getHunger(): number;
  /** True when hunger > WELL_FED_THRESHOLD. */
  isWellFed(): boolean;
  /** Nest state, or null before NestSystem registers. */
  getNest(): NestState | null;

  /** Systems register their live implementations here (called once in ctor). */
  registerCombatProvider(p: Partial<CombatProvider>): void;
}

/** The delegating functions systems may register on the context. */
export interface CombatProvider {
  getEnemies(): EnemyView[];
  damageEnemy(instanceId: string, amount: number, crit?: boolean): boolean;
  spawnXPMote(x: number, y: number, value: number): void;
  spawnFood(x: number, y: number, heal: number): void;
  getHunger(): number;
  getNest(): NestState | null;
}

/** SFX identifiers. Legacy kinds kept; combat kinds added for Nest & Fang. */
export type SfxKind =
  | "forage"
  | "befriend"
  | "nest"
  | "evade"
  | "levelup"
  | "hit"
  | "crit"
  | "enemyDeath"
  | "playerHurt"
  | "eat"
  | "bark"
  | "pounce"
  | "thump"
  | "xpPickup"
  | "bossIntro"
  | "bossDown"
  | "raidWarning"
  | "evolve";

export interface AudioLike {
  /** Called once on first user gesture to unlock/resume the AudioContext. */
  resume(): void;
  /** Fire a short synthesized SFX blip. Unknown kinds must no-op, never throw. */
  blip(kind: SfxKind): void;
  startAmbient(): void;
  setSeasonMood(season: Season): void;
}

/** Uniform lifecycle for every gameplay system. */
export interface System {
  /** Called once per frame by WorldScene. */
  update(deltaMs: number): void;
  /** Optional teardown. */
  destroy?(): void;
}

// ----------------------------------------------------------------------------
// Cross-system events — canonically defined in types.ts, re-exported here so
// both `import { EV } from "./context"` and `from "./types"` resolve.
// ----------------------------------------------------------------------------
export { EV } from "./types";
export type { VerbEvent } from "./types";
