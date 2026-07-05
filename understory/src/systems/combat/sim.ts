/**
 * sim.ts — pure combat logic core (NO Phaser imports). Everything that can be
 * unit-tested headlessly lives here: cooldown ticking, target selection,
 * damage calc (incl. Well-Fed + statBonus multipliers), enemy steering
 * vectors per behavior, wave scheduling decisions, mote magnet motion.
 *
 * The Phaser System classes (WeaponSystem, EnemySystem, WaveDirector,
 * XPMoteSystem, ProjectilePool) are thin shells: they own game objects/sprites
 * and call these functions for all math/decisions.
 *
 * DECISIONS:
 * - "Nearest enemy within range" ties are broken by lowest instanceId
 *   (string compare) for determinism in tests.
 * - Cooldown scaling floor "30% of base" means scaledCooldown >= 0.3 * base,
 *   i.e. statBonus("cooldown") of -1000% would still be clamped to 30%.
 * - Wave supersede: entries are grouped by enemyId; only the entry with the
 *   greatest atMs <= clock (per enemyId) is "active". If none has atMs <=
 *   clock for that enemyId, it's inactive.
 * - Boss phase hooks: modeled as a pure function that inspects hpPct crossing
 *   66%/33% thresholds (edge-triggered via lastPhaseIndex) and returns a
 *   description of what to spawn/fire; EnemySystem executes it.
 */

import {
  EnemyBehavior,
  WeaponLevelStats,
  WeaponArchetype,
  WaveEntry,
  BossEntry,
  WELL_FED_DAMAGE_BONUS,
  CONTACT_TICK_MS,
} from "../../core/types";

// ----------------------------------------------------------------------------
// Generic math helpers
// ----------------------------------------------------------------------------

export interface Vec2 {
  x: number;
  y: number;
}

export function distance(a: Vec2, b: Vec2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/** Unit vector from a to b; returns {x:0,y:0} if a and b coincide. */
export function directionTo(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1e-6) return { x: 0, y: 0 };
  return { x: dx / len, y: dy / len };
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ----------------------------------------------------------------------------
// Target selection
// ----------------------------------------------------------------------------

export interface TargetCandidate {
  id: string;
  x: number;
  y: number;
}

/**
 * Nearest candidate to `from` within `maxRange` (Infinity = unbounded).
 * Ties broken by lowest id (string compare) for determinism.
 */
export function nearestTarget<T extends TargetCandidate>(
  from: Vec2,
  candidates: T[],
  maxRange: number = Infinity
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = distance(from, c);
    if (d > maxRange) continue;
    if (
      d < bestDist ||
      (d === bestDist && best !== null && c.id < best.id)
    ) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
// Cooldown ticking
// ----------------------------------------------------------------------------

export interface CooldownState {
  remainingMs: number;
}

/** Advance a cooldown timer by deltaMs; returns whether it elapsed (<=0) this tick. */
export function tickCooldown(state: CooldownState, deltaMs: number): boolean {
  state.remainingMs -= deltaMs;
  return state.remainingMs <= 0;
}

/** Reset a cooldown timer to `durationMs` (call after firing). Overflow (early trigger) is preserved as a small negative carry-over, clamped to 0 minimum start. */
export function resetCooldown(state: CooldownState, durationMs: number): void {
  state.remainingMs += durationMs;
  if (state.remainingMs < 0) state.remainingMs = 0;
}

// ----------------------------------------------------------------------------
// Weapon stat resolution & damage formula
// ----------------------------------------------------------------------------

export const COOLDOWN_FLOOR_PCT = 0.3;

export interface DamageInputs {
  baseDamage: number;
  statBonusDamagePct: number; // ctx.statBonus("damage")
  wellFed: boolean;
  critRoll: number; // 0..1, caller supplies (e.g. Math.random())
  critChancePct: number; // stat.critPct + statBonus("critPct"), 0..100
}

export interface DamageResult {
  amount: number;
  crit: boolean;
}

/** damage = stat.damage * (1 + statBonus/100) * (wellFed ? 1+bonus : 1); crit doubles. */
export function computeDamage(inputs: DamageInputs): DamageResult {
  const wellFedMult = inputs.wellFed ? 1 + WELL_FED_DAMAGE_BONUS : 1;
  let amount =
    inputs.baseDamage * (1 + inputs.statBonusDamagePct / 100) * wellFedMult;
  const crit = inputs.critRoll * 100 < inputs.critChancePct;
  if (crit) amount *= 2;
  return { amount, crit };
}

/** cooldown scaled by (1 + statBonus/100), floored at 30% of base. Negative statBonus = faster. */
export function computeCooldown(
  baseCooldownMs: number,
  statBonusCooldownPct: number
): number {
  const scaled = baseCooldownMs * (1 + statBonusCooldownPct / 100);
  return Math.max(scaled, baseCooldownMs * COOLDOWN_FLOOR_PCT);
}

/** area scaled by (1 + statBonus/100), floored at 0. */
export function computeArea(baseArea: number, statBonusAreaPct: number): number {
  return Math.max(0, baseArea * (1 + statBonusAreaPct / 100));
}

export function computeCritChance(
  baseCritPct: number | undefined,
  statBonusCritPct: number
): number {
  return (baseCritPct ?? 0) + statBonusCritPct;
}

/** Resolves the effective level stats for an active weapon (level or evolved). */
export function resolveWeaponStats(
  levels: WeaponLevelStats[],
  evolutionStats: WeaponLevelStats,
  level: number,
  evolved: boolean
): WeaponLevelStats {
  if (evolved) return evolutionStats;
  const idx = clamp(level - 1, 0, levels.length - 1);
  return levels[idx];
}

/** Whether the weapon's archetype requires an enemy in range to fire, and if so what range (relative to area). */
export function archetypeFireRange(
  archetype: WeaponArchetype,
  area: number
): number | null {
  switch (archetype) {
    case "aoe-pulse":
    case "melee-sweep":
    case "zone":
      return area + 80;
    case "projectile":
    case "orbit":
    case "trail":
      return null; // always fire (no range gate)
  }
}

/** Whether a weapon should fire this tick given cooldown elapsed + range gate. */
export function shouldFireWeapon(
  archetype: WeaponArchetype,
  area: number,
  playerPos: Vec2,
  enemies: TargetCandidate[]
): boolean {
  const range = archetypeFireRange(archetype, area);
  if (range === null) return true;
  return nearestTarget(playerPos, enemies, range) !== null;
}

// ----------------------------------------------------------------------------
// Enemy steering (per behavior)
// ----------------------------------------------------------------------------

export interface SteeringInput {
  self: Vec2;
  target: Vec2;
  speed: number; // px/s
  deltaMs: number;
}

export interface SteeringOutput {
  dx: number; // px this tick
  dy: number; // px this tick
}

/** Basic seek: full speed toward target. */
export function chaserSteer(input: SteeringInput): SteeringOutput {
  const dir = directionTo(input.self, input.target);
  const dist = input.speed * (input.deltaMs / 1000);
  return { dx: dir.x * dist, dy: dir.y * dist };
}

// ---- Lunger: pause 600ms -> 3x speed lunge 500ms cycle ----
export const LUNGER_PAUSE_MS = 600;
export const LUNGER_LUNGE_MS = 500;
export const LUNGER_SPEED_MULT = 3;

export interface LungerState {
  phase: "pause" | "lunge";
  phaseElapsedMs: number;
  /** Locked direction captured at the start of the lunge phase. */
  lungeDx: number;
  lungeDy: number;
}

export function makeLungerState(): LungerState {
  return { phase: "pause", phaseElapsedMs: 0, lungeDx: 0, lungeDy: 0 };
}

export function lungerSteer(
  state: LungerState,
  input: SteeringInput
): SteeringOutput {
  state.phaseElapsedMs += input.deltaMs;

  if (state.phase === "pause") {
    if (state.phaseElapsedMs >= LUNGER_PAUSE_MS) {
      state.phase = "lunge";
      state.phaseElapsedMs = 0;
      const dir = directionTo(input.self, input.target);
      state.lungeDx = dir.x;
      state.lungeDy = dir.y;
    }
    return { dx: 0, dy: 0 };
  }

  // lunge phase: move at fixed locked direction, 3x speed
  const dist = input.speed * LUNGER_SPEED_MULT * (input.deltaMs / 1000);
  if (state.phaseElapsedMs >= LUNGER_LUNGE_MS) {
    state.phase = "pause";
    state.phaseElapsedMs = 0;
  }
  return { dx: state.lungeDx * dist, dy: state.lungeDy * dist };
}

// ---- Splitter: same steering as chaser (split-on-death handled elsewhere) ----
export const splitterSteer = chaserSteer;

// ---- Shooter: hold at >180px, else approach; firing handled by caller ----
export const SHOOTER_HOLD_RANGE = 180;

export function shooterSteer(input: SteeringInput): SteeringOutput {
  const dist = distance(input.self, input.target);
  if (dist <= SHOOTER_HOLD_RANGE) return { dx: 0, dy: 0 };
  return chaserSteer(input);
}

export function shooterShouldFire(
  self: Vec2,
  target: Vec2,
  cooldown: CooldownState,
  deltaMs: number
): boolean {
  return (
    distance(self, target) <= SHOOTER_HOLD_RANGE + 40 &&
    tickCooldown(cooldown, deltaMs)
  );
}

// ---- Charger: telegraph 700ms -> straight charge 4x speed until past player +200px ----
export const CHARGER_TELEGRAPH_MS = 700;
export const CHARGER_SPEED_MULT = 4;
export const CHARGER_OVERSHOOT_PX = 200;

export interface ChargerState {
  phase: "telegraph" | "charging";
  phaseElapsedMs: number;
  chargeDx: number;
  chargeDy: number;
  /** Distance traveled during the current charge (for overshoot detection). */
  chargeDistTraveled: number;
  /** Distance from start-point to target at charge start (charge ends after traveling this + overshoot). */
  chargeDistToTarget: number;
}

export function makeChargerState(): ChargerState {
  return {
    phase: "telegraph",
    phaseElapsedMs: 0,
    chargeDx: 0,
    chargeDy: 0,
    chargeDistTraveled: 0,
    chargeDistToTarget: 0,
  };
}

export function chargerSteer(
  state: ChargerState,
  input: SteeringInput
): SteeringOutput {
  state.phaseElapsedMs += input.deltaMs;

  if (state.phase === "telegraph") {
    if (state.phaseElapsedMs >= CHARGER_TELEGRAPH_MS) {
      state.phase = "charging";
      state.phaseElapsedMs = 0;
      state.chargeDistTraveled = 0;
      const dir = directionTo(input.self, input.target);
      state.chargeDx = dir.x;
      state.chargeDy = dir.y;
      state.chargeDistToTarget = distance(input.self, input.target);
    }
    return { dx: 0, dy: 0 };
  }

  // charging phase: locked direction, 4x speed, until traveled past target+overshoot
  const dist = input.speed * CHARGER_SPEED_MULT * (input.deltaMs / 1000);
  state.chargeDistTraveled += dist;
  if (state.chargeDistTraveled >= state.chargeDistToTarget + CHARGER_OVERSHOOT_PX) {
    state.phase = "telegraph";
    state.phaseElapsedMs = 0;
  }
  return { dx: state.chargeDx * dist, dy: state.chargeDy * dist };
}

// ---- Drifter: sine-weave toward player, ignores obstacle tiles ----
export const DRIFTER_WEAVE_FREQ = 3; // radians/sec multiplier
export const DRIFTER_WEAVE_AMPLITUDE = 0.6; // radians of angular offset

export interface DrifterState {
  elapsedMs: number;
}

export function makeDrifterState(): DrifterState {
  return { elapsedMs: 0 };
}

export function drifterSteer(
  state: DrifterState,
  input: SteeringInput
): SteeringOutput {
  state.elapsedMs += input.deltaMs;
  const baseDir = directionTo(input.self, input.target);
  const baseAngle = Math.atan2(baseDir.y, baseDir.x);
  const weave =
    Math.sin((state.elapsedMs / 1000) * DRIFTER_WEAVE_FREQ) *
    DRIFTER_WEAVE_AMPLITUDE;
  const angle = baseAngle + weave;
  const dist = input.speed * (input.deltaMs / 1000);
  return { dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist };
}

// ---- Ambusher: invisible; every 6s telegraph shadow under player 900ms then surface + bite ----
export const AMBUSHER_CYCLE_MS = 6000;
export const AMBUSHER_TELEGRAPH_MS = 900;

export interface AmbusherState {
  cycleElapsedMs: number;
  phase: "hidden" | "telegraph" | "surfaced";
}

export function makeAmbusherState(): AmbusherState {
  return { cycleElapsedMs: 0, phase: "hidden" };
}

export interface AmbusherStepResult {
  dx: number;
  dy: number;
  phase: AmbusherState["phase"];
  justSurfaced: boolean;
}

/** Ambusher doesn't move while hidden/telegraphing; teleports under target then bites on surface. */
export function ambusherSteer(
  state: AmbusherState,
  input: SteeringInput
): AmbusherStepResult {
  state.cycleElapsedMs += input.deltaMs;
  let justSurfaced = false;

  if (state.phase === "hidden") {
    if (state.cycleElapsedMs >= AMBUSHER_CYCLE_MS - AMBUSHER_TELEGRAPH_MS) {
      state.phase = "telegraph";
    }
    return { dx: 0, dy: 0, phase: state.phase, justSurfaced };
  }

  if (state.phase === "telegraph") {
    if (state.cycleElapsedMs >= AMBUSHER_CYCLE_MS) {
      state.phase = "surfaced";
      state.cycleElapsedMs = 0;
      justSurfaced = true;
    }
    return { dx: 0, dy: 0, phase: state.phase, justSurfaced };
  }

  // surfaced: brief active biting state, then back to hidden after a short window.
  if (state.cycleElapsedMs >= 400) {
    state.phase = "hidden";
    state.cycleElapsedMs = 0;
  }
  return { dx: 0, dy: 0, phase: state.phase, justSurfaced };
}

// ---- Boss: chaser + phase hooks ----
export const BOSS_CONTACT_DAMAGE_MULT = 1.5;

export type BossPhaseAction =
  | { kind: "spawn-slimes"; count: number }
  | { kind: "spore-ring"; count: number }
  | { kind: "rapid-charges"; count: number }
  | { kind: "spawn-wisps"; count: number }
  | null;

export interface BossPhaseState {
  lastPhaseIndex: number; // -1 none, 0 = 66% crossed, 1 = 33% crossed
}

export function makeBossPhaseState(): BossPhaseState {
  return { lastPhaseIndex: -1 };
}

/** Edge-triggered: fires once when hpPct first drops below 66%, again below 33%. */
export function bossPhaseCheck(
  state: BossPhaseState,
  bossId: string,
  hpPct: number
): BossPhaseAction {
  let crossedIndex = -1;
  if (hpPct <= 0.33) crossedIndex = 1;
  else if (hpPct <= 0.66) crossedIndex = 0;

  if (crossedIndex <= state.lastPhaseIndex) return null;
  state.lastPhaseIndex = crossedIndex;

  switch (bossId) {
    case "king-slime":
      return { kind: "spawn-slimes", count: 4 };
    case "elder-gloomcap":
      return { kind: "spore-ring", count: 8 };
    case "bramble-tyrant":
      return { kind: "rapid-charges", count: 3 };
    case "the-long-dark":
      return { kind: "spawn-wisps", count: 6 };
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------
// Contact damage ticking (shared by all melee-contact behaviors incl. boss)
// ----------------------------------------------------------------------------

export interface ContactTickState {
  sinceLastTickMs: number;
  overlapping: boolean;
}

export function makeContactTickState(): ContactTickState {
  return { sinceLastTickMs: 0, overlapping: false };
}

/**
 * Returns true if a contact-damage tick should fire this frame. `overlapping`
 * must be computed by the caller (distance <= playerRadius + enemyRadius).
 * First tick fires immediately on entering overlap; subsequent ticks every
 * CONTACT_TICK_MS while overlap persists.
 */
export function contactTick(
  state: ContactTickState,
  overlapping: boolean,
  deltaMs: number
): boolean {
  if (!overlapping) {
    state.overlapping = false;
    state.sinceLastTickMs = 0;
    return false;
  }
  if (!state.overlapping) {
    // Just started overlapping — tick immediately.
    state.overlapping = true;
    state.sinceLastTickMs = 0;
    return true;
  }
  state.sinceLastTickMs += deltaMs;
  if (state.sinceLastTickMs >= CONTACT_TICK_MS) {
    state.sinceLastTickMs -= CONTACT_TICK_MS;
    return true;
  }
  return false;
}

export function isOverlapping(
  a: Vec2,
  aRadius: number,
  b: Vec2,
  bRadius: number
): boolean {
  return distance(a, b) <= aRadius + bRadius;
}

// ----------------------------------------------------------------------------
// Wave scheduling
// ----------------------------------------------------------------------------

/**
 * Given all wave entries and the run clock, resolve which entry is "active"
 * per enemyId (supersede: latest atMs <= clock wins).
 */
export function activeWaveEntries(
  waves: WaveEntry[],
  clockMs: number
): WaveEntry[] {
  const byEnemy = new Map<string, WaveEntry>();
  for (const w of waves) {
    if (w.atMs > clockMs) continue;
    const existing = byEnemy.get(w.enemyId);
    if (!existing || w.atMs > existing.atMs) {
      byEnemy.set(w.enemyId, w);
    }
  }
  return Array.from(byEnemy.values());
}

/** Whether a boss entry should spawn this tick (edge-triggered: clock just passed atMs). */
export function bossShouldSpawn(
  boss: BossEntry,
  prevClockMs: number,
  clockMs: number
): boolean {
  return prevClockMs < boss.atMs && clockMs >= boss.atMs;
}

export interface SpawnDecisionInput {
  entry: WaveEntry;
  currentOnScreenCount: number;
  msSinceLastSpawnForEntry: number;
}

/** Whether WaveDirector should spawn one more of this enemy type this tick. */
export function shouldSpawnForEntry(input: SpawnDecisionInput): boolean {
  if (input.currentOnScreenCount >= input.entry.count) return false;
  return input.msSinceLastSpawnForEntry >= input.entry.intervalMs;
}

/**
 * Pick a random point on a ring `ringMinPx`..`ringMaxPx` beyond the camera
 * viewport edge, clamped inside world bounds. `rng` in [0,1).
 */
export function spawnRingPoint(
  cameraCenter: Vec2,
  viewportHalfW: number,
  viewportHalfH: number,
  ringMinPx: number,
  ringMaxPx: number,
  worldBounds: { width: number; height: number },
  rng: () => number
): Vec2 {
  const angle = rng() * Math.PI * 2;
  // Distance from camera center to the viewport edge along this angle
  // (approximate via max of half-extents projected), then add ring offset.
  const edgeDist = Math.max(
    Math.abs(Math.cos(angle)) * viewportHalfW,
    Math.abs(Math.sin(angle)) * viewportHalfH
  );
  const ringOffset = ringMinPx + rng() * (ringMaxPx - ringMinPx);
  const dist = edgeDist + ringOffset;
  let x = cameraCenter.x + Math.cos(angle) * dist;
  let y = cameraCenter.y + Math.sin(angle) * dist;
  x = clamp(x, 0, worldBounds.width);
  y = clamp(y, 0, worldBounds.height);
  return { x, y };
}

// ----------------------------------------------------------------------------
// XP mote magnet motion
// ----------------------------------------------------------------------------

export const MOTE_MAGNET_START_SPEED = 60; // px/s
export const MOTE_MAGNET_ACCEL = 900; // px/s^2
export const MOTE_COLLECT_RADIUS = 14;

export interface MoteMagnetState {
  /** Current speed while being magnetized (0 before entering magnet radius). */
  speed: number;
}

export function makeMoteMagnetState(): MoteMagnetState {
  return { speed: 0 };
}

export interface MoteStepResult {
  dx: number;
  dy: number;
  collected: boolean;
}

/**
 * Steps a mote one tick. If within magnetRadius of target, accelerates
 * toward it (starting at MOTE_MAGNET_START_SPEED, +MOTE_MAGNET_ACCEL px/s^2);
 * otherwise stays put (speed resets to 0 so re-entering restarts the ramp).
 * Collected when within MOTE_COLLECT_RADIUS.
 */
export function moteStep(
  state: MoteMagnetState,
  self: Vec2,
  target: Vec2,
  magnetRadius: number,
  deltaMs: number
): MoteStepResult {
  const dist = distance(self, target);
  if (dist <= MOTE_COLLECT_RADIUS) {
    return { dx: 0, dy: 0, collected: true };
  }
  if (dist > magnetRadius) {
    state.speed = 0;
    return { dx: 0, dy: 0, collected: false };
  }
  if (state.speed === 0) state.speed = MOTE_MAGNET_START_SPEED;
  else state.speed += MOTE_MAGNET_ACCEL * (deltaMs / 1000);

  const dir = directionTo(self, target);
  const travel = state.speed * (deltaMs / 1000);
  // Prevent overshoot past the target within a single tick.
  const clampedTravel = Math.min(travel, dist);
  return { dx: dir.x * clampedTravel, dy: dir.y * clampedTravel, collected: false };
}

export function moteMagnetRadius(
  baseRadius: number,
  statBonusPickupRadiusPct: number
): number {
  return baseRadius * (1 + statBonusPickupRadiusPct / 100);
}

// ----------------------------------------------------------------------------
// Behavior dispatch helper (used by EnemySystem; kept here so it's testable)
// ----------------------------------------------------------------------------

export type BehaviorSteerState =
  | { kind: "chaser" }
  | { kind: "splitter" }
  | { kind: "shooter" }
  | { kind: "drifter"; state: DrifterState }
  | { kind: "lunger"; state: LungerState }
  | { kind: "charger"; state: ChargerState }
  | { kind: "ambusher"; state: AmbusherState }
  | { kind: "boss" };

export function makeBehaviorState(behavior: EnemyBehavior): BehaviorSteerState {
  switch (behavior) {
    case "lunger":
      return { kind: "lunger", state: makeLungerState() };
    case "charger":
      return { kind: "charger", state: makeChargerState() };
    case "drifter":
      return { kind: "drifter", state: makeDrifterState() };
    case "ambusher":
      return { kind: "ambusher", state: makeAmbusherState() };
    case "splitter":
      return { kind: "splitter" };
    case "shooter":
      return { kind: "shooter" };
    case "boss":
      return { kind: "boss" };
    case "chaser":
    default:
      return { kind: "chaser" };
  }
}

/** Steps whichever behavior state is active; returns a displacement for this tick. */
export function stepBehavior(
  bs: BehaviorSteerState,
  input: SteeringInput
): SteeringOutput {
  switch (bs.kind) {
    case "chaser":
    case "splitter":
    case "shooter":
    case "boss":
      // shooter caller is expected to check SHOOTER_HOLD_RANGE separately via
      // shooterSteer if hold-at-range behavior is desired; boss/chaser/splitter
      // are plain seek.
      return bs.kind === "shooter" ? shooterSteer(input) : chaserSteer(input);
    case "lunger":
      return lungerSteer(bs.state, input);
    case "charger":
      return chargerSteer(bs.state, input);
    case "drifter":
      return drifterSteer(bs.state, input);
    case "ambusher": {
      const r = ambusherSteer(bs.state, input);
      return { dx: r.dx, dy: r.dy };
    }
  }
}
