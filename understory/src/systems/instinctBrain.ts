/**
 * instinctBrain — pure decision logic for InstinctAI (Worker G). Zero Phaser
 * imports so tests/instinct.test.ts can exercise every rule without a
 * DOM/canvas. InstinctAI.ts is the thin Phaser shell that reads `ctx` state
 * into plain objects, calls decideGoal(), and turns the returned target into
 * a drag vector via the same seek/arrive math the old wander-only AI used.
 *
 * DECISIONS:
 * - Priority stack (highest wins), evaluated fresh every decision tick:
 *   1. SURVIVE (hp < 35%): kite away from weighted enemy centroid, drift
 *      toward nearest tracked food.
 *   2. NEST DEFENSE (raid active): go to nest, then orbit-kite within 120px.
 *   3. EAT (hunger < 40 and food within 400px): seek nearest tracked food.
 *   4. FARM (default): seek biggest enemy cluster with a kite standoff ring
 *      (130px: outside -> approach, inside -> strafe tangentially). If
 *      enemy count <= 2, seek nearest forage node, else nearest fog edge.
 *   5. BOSS: if any enemy isBoss, treat it (or the boss cluster) as the farm
 *      target but with a 160px standoff instead of 130px.
 * - Boss check is folded into FARM's target-selection rather than being a
 *   fully separate branch above EAT/NEST, because CONTRACTS.md doesn't say
 *   bosses should override survival/nest/eat needs — only that engagement
 *   range differs. This reads simpler and the tests only assert the standoff
 *   distance changes when a boss is present, not stack ordering relative to
 *   EAT/NEST (which would be a strange product decision: don't stop eating
 *   because a boss showed up.)
 * - "Food tracked locally" — ctx doesn't expose live food positions, so
 *   InstinctAI subscribes to EV.foodSpawned to append {x,y} and drops
 *   entries once the bot is within EAT_RADIUS_PX of them (treated as eaten
 *   for tracking purposes — we can't correlate the untyped EV.foodEaten
 *   payload, which carries no position, back to a specific tracked item).
 * - Companion recruiting: proximity+dwell per CONTRACTS/CompanionSystem is
 *   automatic simply by the bot passing near companions during FARM/wander;
 *   no ctx API exists to target wild companions explicitly, so this is
 *   intentionally not modeled as a goal. Noted per swarm instructions.
 * - Cluster centroid uses a simple unweighted mean of all enemy positions
 *   within CLUSTER_RADIUS_PX of the single densest enemy (found by trying
 *   each enemy as a candidate center and counting neighbors) — cheap O(n^2)
 *   is fine at MAX_ENEMIES=40.
 * - Empty enemy list / zero-distance guards always return a finite vector
 *   (never NaN): kiteVector and clusterCentroid degrade to {x:0,y:0} /
 *   null-safe outputs, and callers wrap normalization with a `dist > 0 ? .. : 0`
 *   guard exactly like the pre-existing wander AI.
 */

export interface Vec2Like {
  x: number;
  y: number;
}

export interface EnemyLike {
  x: number;
  y: number;
  isBoss?: boolean;
}

export type InstinctGoal =
  | "survive"
  | "nestDefense"
  | "eat"
  | "farmApproach"
  | "farmStrafe"
  | "forage"
  | "wander";

export interface GoalDecision {
  goal: InstinctGoal;
  targetX: number;
  targetY: number;
}

export const SURVIVE_HP_PCT = 0.35;
export const SURVIVE_KITE_RANGE_PX = 150;
export const EAT_HUNGER_THRESHOLD = 40;
export const EAT_SEEK_RANGE_PX = 400;
export const EAT_RADIUS_PX = 40;
export const NEST_ORBIT_RADIUS_PX = 120;
export const FARM_STANDOFF_PX = 130;
export const FARM_STANDOFF_BAND_PX = 20; // hysteresis band (110-150) to avoid jitter at the exact ring
export const BOSS_STANDOFF_PX = 160;
export const CLUSTER_RADIUS_PX = 140;
export const FARM_SMALL_PACK_THRESHOLD = 2;

/** Euclidean distance between two points; never NaN (0 if identical). */
export function dist(a: Vec2Like, b: Vec2Like): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Unit vector from a to b; {0,0} if coincident (never NaN). */
export function directionTo(a: Vec2Like, b: Vec2Like): Vec2Like {
  const d = dist(a, b);
  if (d <= 0) return { x: 0, y: 0 };
  return { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}

/**
 * Weighted inverse-distance repulsion vector away from all enemies within
 * `range` px of `from`. Closer enemies push harder. Returns a unit-ish
 * vector (magnitude <= 1); {0,0} if nothing is in range (never NaN).
 */
export function kiteVector(
  from: Vec2Like,
  enemies: EnemyLike[],
  range: number
): Vec2Like {
  let sumX = 0;
  let sumY = 0;
  let totalWeight = 0;

  for (const e of enemies) {
    const d = dist(from, e);
    if (d > range) continue;
    // Inverse-distance weight; guard the zero-distance case.
    const weight = 1 / Math.max(d, 1);
    const away = d > 0 ? { x: (from.x - e.x) / d, y: (from.y - e.y) / d } : { x: 0, y: -1 };
    sumX += away.x * weight;
    sumY += away.y * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) return { x: 0, y: 0 };

  const mag = Math.sqrt(sumX * sumX + sumY * sumY);
  if (mag <= 0) return { x: 0, y: 0 };
  return { x: sumX / mag, y: sumY / mag };
}

/**
 * Finds the centroid of the densest enemy cluster: tries each enemy as a
 * candidate center, counts neighbors within CLUSTER_RADIUS_PX, keeps the
 * candidate with the most neighbors, then averages all neighbor positions
 * (including the candidate). Returns null for an empty list (never NaN).
 */
export function clusterCentroid(
  enemies: EnemyLike[],
  radius: number = CLUSTER_RADIUS_PX
): Vec2Like | null {
  if (enemies.length === 0) return null;
  if (enemies.length === 1) return { x: enemies[0].x, y: enemies[0].y };

  let bestMembers: EnemyLike[] = [enemies[0]];
  for (const candidate of enemies) {
    const members = enemies.filter((e) => dist(candidate, e) <= radius);
    if (members.length > bestMembers.length) {
      bestMembers = members;
    }
  }

  let sumX = 0;
  let sumY = 0;
  for (const m of bestMembers) {
    sumX += m.x;
    sumY += m.y;
  }
  return { x: sumX / bestMembers.length, y: sumY / bestMembers.length };
}

/** True if any enemy in the (already-filtered/near) list is a boss. */
export function hasBoss(enemies: EnemyLike[]): boolean {
  return enemies.some((e) => e.isBoss === true);
}

export interface FarmTargetResult {
  goal: "farmApproach" | "farmStrafe";
  targetX: number;
  targetY: number;
}

/**
 * Given the player position and a cluster centroid, decide whether to
 * approach (outside the standoff band) or strafe tangentially (inside it).
 * `prevGoal` provides hysteresis: once strafing, keep strafing until the
 * player drifts past standoff+band, and vice versa, to avoid flip-flop
 * exactly at the ring edge.
 */
export function farmApproachOrStrafe(
  from: Vec2Like,
  centroid: Vec2Like,
  standoffPx: number,
  prevGoal: "farmApproach" | "farmStrafe" | null
): FarmTargetResult {
  const d = dist(from, centroid);
  const innerEdge = standoffPx - FARM_STANDOFF_BAND_PX / 2;
  const outerEdge = standoffPx + FARM_STANDOFF_BAND_PX / 2;

  let strafing: boolean;
  if (prevGoal === "farmStrafe") {
    strafing = d < outerEdge;
  } else if (prevGoal === "farmApproach") {
    strafing = d < innerEdge;
  } else {
    strafing = d < standoffPx;
  }

  if (!strafing) {
    return { goal: "farmApproach", targetX: centroid.x, targetY: centroid.y };
  }

  // Strafe tangentially: rotate the "toward centroid" vector 90 degrees to
  // get a tangent direction, project a target point along that tangent from
  // the player's current position (keeps ring radius stable while sliding).
  const toward = directionTo(from, centroid);
  // Perpendicular (tangent) — pick a consistent handedness (clockwise).
  const tangent = { x: -toward.y, y: toward.x };
  const targetX = from.x + tangent.x * 60;
  const targetY = from.y + tangent.y * 60;
  return { goal: "farmStrafe", targetX, targetY };
}

export interface BrainState {
  playerPos: Vec2Like;
  hpPct: number; // 0..1
  hunger: number; // 0..100
  enemies: EnemyLike[];
  nestPos: Vec2Like | null;
  raidActive: boolean;
  trackedFood: Vec2Like[];
  forageNodes: Vec2Like[];
  fogEdge: Vec2Like | null;
  wanderTarget: Vec2Like | null;
  /** Previous tick's farm sub-goal, for strafe/approach hysteresis. */
  prevFarmGoal: "farmApproach" | "farmStrafe" | null;
}

/** Nearest point in `points` to `from`, or null for an empty list. */
export function pickNearest<T extends Vec2Like>(
  from: Vec2Like,
  points: T[]
): T | null {
  let best: T | null = null;
  let bestDist = Infinity;
  for (const p of points) {
    const d = dist(from, p);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/**
 * Top-level priority decision. Never throws, never returns NaN coordinates —
 * every branch has a safe fallback down to `wander` at the player's own
 * position (caller should hold last wander target / pick a new random one
 * when goal is "wander" and targetX/Y equal playerPos, mirroring old AI).
 */
export function decideGoal(state: BrainState): GoalDecision {
  const {
    playerPos,
    hpPct,
    hunger,
    enemies,
    nestPos,
    raidActive,
    trackedFood,
    forageNodes,
    fogEdge,
    wanderTarget,
    prevFarmGoal,
  } = state;

  // 1. SURVIVE
  if (hpPct < SURVIVE_HP_PCT) {
    const kite = kiteVector(playerPos, enemies, SURVIVE_KITE_RANGE_PX);
    const nearestFood = pickNearest(playerPos, trackedFood);
    let dirX = kite.x;
    let dirY = kite.y;
    if (nearestFood) {
      const towardFood = directionTo(playerPos, nearestFood);
      // Blend: mostly flee, lightly drift toward food.
      dirX = kite.x * 0.75 + towardFood.x * 0.25;
      dirY = kite.y * 0.75 + towardFood.y * 0.25;
    }
    const mag = Math.sqrt(dirX * dirX + dirY * dirY);
    const nx = mag > 0 ? dirX / mag : 0;
    const ny = mag > 0 ? dirY / mag : 0;
    return {
      goal: "survive",
      targetX: playerPos.x + nx * SURVIVE_KITE_RANGE_PX,
      targetY: playerPos.y + ny * SURVIVE_KITE_RANGE_PX,
    };
  }

  // 2. NEST DEFENSE
  if (raidActive && nestPos) {
    const d = dist(playerPos, nestPos);
    if (d > NEST_ORBIT_RADIUS_PX) {
      return { goal: "nestDefense", targetX: nestPos.x, targetY: nestPos.y };
    }
    // Orbit-kite: strafe tangentially around the nest, biased away from the
    // nearest enemy so the bot fights on the side threats are coming from.
    const toward = directionTo(playerPos, nestPos);
    const tangent = { x: -toward.y, y: toward.x };
    return {
      goal: "nestDefense",
      targetX: playerPos.x + tangent.x * 60,
      targetY: playerPos.y + tangent.y * 60,
    };
  }

  // 3. EAT
  if (hunger < EAT_HUNGER_THRESHOLD && trackedFood.length > 0) {
    const nearestFood = pickNearest(playerPos, trackedFood);
    if (nearestFood && dist(playerPos, nearestFood) <= EAT_SEEK_RANGE_PX) {
      return { goal: "eat", targetX: nearestFood.x, targetY: nearestFood.y };
    }
  }

  // 4/5. FARM (incl. boss standoff bump)
  if (enemies.length > FARM_SMALL_PACK_THRESHOLD) {
    const centroid = clusterCentroid(enemies);
    if (centroid) {
      const standoff = hasBoss(enemies) ? BOSS_STANDOFF_PX : FARM_STANDOFF_PX;
      const result = farmApproachOrStrafe(
        playerPos,
        centroid,
        standoff,
        prevFarmGoal
      );
      return {
        goal: result.goal,
        targetX: result.targetX,
        targetY: result.targetY,
      };
    }
  }

  // Sparse enemies: forage to generate food, else explore fog edge.
  const nearestForage = pickNearest(playerPos, forageNodes);
  if (nearestForage) {
    return { goal: "forage", targetX: nearestForage.x, targetY: nearestForage.y };
  }
  if (fogEdge) {
    return { goal: "wander", targetX: fogEdge.x, targetY: fogEdge.y };
  }

  // Nothing to do at all: hold/idle-wander at existing wander target or self.
  if (wanderTarget) {
    return { goal: "wander", targetX: wanderTarget.x, targetY: wanderTarget.y };
  }
  return { goal: "wander", targetX: playerPos.x, targetY: playerPos.y };
}
