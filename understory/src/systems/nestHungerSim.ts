/**
 * nestHungerSim — pure logic for Worker D's domain (hunger, food carry/bank,
 * nest raids, companion recruiting/targeting). Zero Phaser imports so
 * tests/nestHunger.test.ts can exercise every rule without a DOM/canvas.
 *
 * DECISIONS:
 * - Hunger/eat/starve, carry/bank, raid clock, recruit timer, and companion
 *   targeting are all modeled as small pure functions operating on plain
 *   state objects owned by the thin Phaser System classes. This file never
 *   imports Phaser or `ctx` — systems pass in whatever numbers they read
 *   from `ctx`/`player` and apply the returned deltas.
 * - Raid schedule: CONTRACTS.md says "1:40 and 5:40 (30s warning first)" but
 *   the per-worker spec says "run-clock 100000ms and 340000ms ... at T-30s
 *   emit warning". 100000ms = 1:40 and 340000ms = 5:40, so both docs agree;
 *   we implement warnings at 70_000ms/310_000ms (T-30s) and raid-active at
 *   100_000ms/340_000ms, each raid lasting 45_000ms.
 * - Starvation ticks every 2s while hunger is exactly 0 (not "<= 0"; hunger
 *   is clamped to [0,100] so 0 is the only floor value).
 * - Well-fed crossing fires only on the transition (not every frame at rest
 *   above/below threshold), tracked by the caller diffing previous value.
 */

// ----------------------------------------------------------------------------
// Hunger drain / eat / starve
// ----------------------------------------------------------------------------

export interface HungerDrainResult {
  hunger: number;
  /** True if this tick crossed from >=WELL_FED_THRESHOLD-side transitions. */
  changed: boolean;
}

/** Drain hunger by rate*dtSec, clamped to [0,100]. */
export function drainHunger(
  hunger: number,
  ratePerSec: number,
  dtSec: number
): number {
  return clamp(hunger - ratePerSec * dtSec, 0, 100);
}

/** True if `hunger` is strictly above the well-fed threshold. */
export function isWellFed(hunger: number, threshold: number): boolean {
  return hunger > threshold;
}

export interface EatResult {
  hunger: number;
  hp: number;
  heal: number;
  wellFed: boolean;
}

/**
 * Apply an eat action: +hungerGain (cap 100), heal = baseHeal * (1 +
 * foodHealBonusPct/100) applied to hp (cap maxHp).
 */
export function applyEat(
  hunger: number,
  hp: number,
  maxHp: number,
  hungerGain: number,
  baseHeal: number,
  foodHealBonusPct: number,
  wellFedThreshold: number
): EatResult {
  const newHunger = clamp(hunger + hungerGain, 0, 100);
  const heal = baseHeal * (1 + foodHealBonusPct / 100);
  const newHp = clamp(hp + heal, 0, maxHp);
  return {
    hunger: newHunger,
    hp: newHp,
    heal,
    wellFed: isWellFed(newHunger, wellFedThreshold),
  };
}

/** True if hunger is at the starvation floor (0). */
export function isStarving(hunger: number): boolean {
  return hunger <= 0;
}

// ----------------------------------------------------------------------------
// Carry / bank
// ----------------------------------------------------------------------------

/** Clamp carried food to the cap; returns the new carried count. */
export function addCarriedFood(carried: number, cap: number): number {
  return Math.min(carried + 1, cap);
}

export interface BankResult {
  bankedFood: number;
  carriedFood: number;
  amountBanked: number;
}

/** Move all carried food into the bank; carried resets to 0. */
export function bankCarriedFood(
  bankedFood: number,
  carriedFood: number
): BankResult {
  return {
    bankedFood: bankedFood + carriedFood,
    carriedFood: 0,
    amountBanked: carriedFood,
  };
}

/** Wipe the bank (nest destroyed). */
export function wipeBank(): number {
  return 0;
}

// ----------------------------------------------------------------------------
// Nest raid clock & damage
// ----------------------------------------------------------------------------

export interface RaidSchedule {
  warnAtMs: number;
  activeAtMs: number;
  endsAtMs: number;
}

export const RAID_DURATION_MS = 45_000;
export const RAID_WARNING_LEAD_MS = 30_000;

/** The two scripted raid windows, derived from their active-at timestamps. */
export function buildRaidSchedules(
  activeAtMsList: number[] = [100_000, 340_000]
): RaidSchedule[] {
  return activeAtMsList.map((activeAtMs) => ({
    warnAtMs: activeAtMs - RAID_WARNING_LEAD_MS,
    activeAtMs,
    endsAtMs: activeAtMs + RAID_DURATION_MS,
  }));
}

export type RaidPhase = "idle" | "warned" | "active" | "ended";

/**
 * Given the run clock and a schedule, and the phase already fired for it,
 * returns the phase that SHOULD be active now — caller diffs against last
 * known phase to decide whether to emit a transition event exactly once.
 */
export function raidPhaseAt(nowMs: number, schedule: RaidSchedule): RaidPhase {
  if (nowMs >= schedule.endsAtMs) return "ended";
  if (nowMs >= schedule.activeAtMs) return "active";
  if (nowMs >= schedule.warnAtMs) return "warned";
  return "idle";
}

/** Damage dealt to the nest in one raid-damage tick. */
export function raidDamageTick(enemiesNearNest: number, perEnemyDamage = 3): number {
  return enemiesNearNest * perEnemyDamage;
}

export interface NestHpResult {
  hp: number;
  destroyed: boolean;
}

export function applyNestDamage(hp: number, amount: number): NestHpResult {
  const newHp = clamp(hp - amount, 0, Infinity);
  return { hp: newHp, destroyed: newHp <= 0 };
}

export function applyNestHeal(hp: number, maxHp: number, amount: number): number {
  return clamp(hp + amount, 0, maxHp);
}

// ----------------------------------------------------------------------------
// Companion recruit proximity timer & targeting
// ----------------------------------------------------------------------------

/**
 * Advance (or reset) the recruit proximity timer. If `withinRadius` is
 * false, the timer resets to 0 (per spec: "resets on leaving radius").
 */
export function tickRecruitTimer(
  currentMs: number,
  withinRadius: boolean,
  dtMs: number
): number {
  if (!withinRadius) return 0;
  return currentMs + dtMs;
}

export function isRecruitComplete(
  timerMs: number,
  requiredMs = 1200
): boolean {
  return timerMs >= requiredMs;
}

export interface Point {
  x: number;
  y: number;
}

/** Squared distance helper (avoids sqrt in hot loops/tests). */
export function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function dist(a: Point, b: Point): number {
  return Math.sqrt(distSq(a, b));
}

/**
 * Pick the nearest candidate to `from` within `maxRadius` (or unlimited if
 * omitted). Returns null if candidates is empty or none are in range.
 */
export function pickNearest<T extends Point>(
  from: Point,
  candidates: T[],
  maxRadius = Infinity
): T | null {
  let best: T | null = null;
  let bestDistSq = maxRadius * maxRadius;
  for (const c of candidates) {
    const d = distSq(from, c);
    if (d <= bestDistSq) {
      bestDistSq = d;
      best = c;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
// Misc
// ----------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
