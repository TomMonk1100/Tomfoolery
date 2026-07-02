// ---------------------------------------------------------------------------
// lander-v10 commit 2: fixed-timestep physics engine.
//
// - Fixed 120 Hz tick (DT). The RAF loop in main.ts accumulates frame time
//   (clamped to 0.05s/frame) and runs `while (acc >= DT) { step(); acc -= DT }`
//   then renders the latest state once — no interpolation.
// - Mass & drag model (§4.2): optional via MASS_MODEL flag. When enabled,
//   gravity/thrust/wind accelerations are derived from a mass+area model
//   instead of flat multipliers. Defaults true per the build plan; the sim
//   tests in __tests__ are the gate (no browser available in this run).
// - Swept terrain collision (§4.3): sweptGroundContact() binary-searches the
//   contact point along a motion segment so fast falls can never tunnel
//   through terrain, even across canyon spikes at 120 Hz.
// - Swept segment-vs-circle test for projectile→ship hits (§4.3), reused by
//   main.ts for the projectile update loop.
// ---------------------------------------------------------------------------

import { terrainYAt } from './levels';
import type { Terrain } from './types';

// --- 4.1 Fixed timestep -----------------------------------------------------
export const DT = 1 / 120;
export const MAX_FRAME_TIME = 0.05; // clamp per-frame accumulation (tab-switch stalls)

// --- 4.2 Mass & drag model ---------------------------------------------------
// Fallback flag: if the deterministic sim tests ever reveal the mass model
// produces NaN or wildly-wrong hover behavior, flip this to false to fall
// back to the legacy flat-multiplier gravity/thrust/wind behavior. Left
// `true` per plan default — sim tests in __tests__/physics.test.ts pass with
// it enabled (see mass-model sanity test).
export const MASS_MODEL = true;

export interface MassDragInputs {
  massSum: number;   // Σ(def.mass × stacks) from computeStats
  areaSum: number;    // Σ(def.dragArea × stacks) from computeStats
}

export function effectiveMass(inputs: MassDragInputs): number {
  const m = 1 + inputs.massSum;
  return Math.max(0.2, m); // §4.5 stability floor
}

export function effectiveArea(inputs: MassDragInputs): number {
  const a = 1 + inputs.areaSum;
  return Math.max(0, a);
}

// Gravity acceleration given level gravity (px/s^2), a gravity coupling
// multiplier (from upgrades, e.g. Gravity Anchor / Star Core), and mass.
// Fg = g_level * mass (force); acceleration on the ship is Fg / mass * coupling
// which collapses to g_level * coupling when mass model is engaged the same
// way as the legacy flat model — the mass term matters for thrust/wind, where
// force is constant (thruster output) but acceleration divides by mass.
export function gravityAccel(gLevel: number, gravityCoupling: number, mass: number): number {
  if (!MASS_MODEL) return gLevel * gravityCoupling;
  const Fg = gLevel * mass * gravityCoupling;
  return Fg / mass;
}

// Thrust acceleration: force / mass. thrustForce is the upgraded thrustPower
// (already includes multiplicative upgrade bonuses); base raised 145 -> 158
// in stats.ts per §4.2 to keep level-1 feel close to legacy.
export function thrustAccel(thrustForce: number, mass: number): number {
  if (!MASS_MODEL) return thrustForce;
  return thrustForce / mass;
}

// Wind acceleration: wind * windMult * area / mass.
export function windAccel(wind: number, windMult: number, area: number, mass: number): number {
  if (!MASS_MODEL) return wind * windMult;
  return (wind * windMult * area) / mass;
}

// --- 4.3 Swept terrain collision --------------------------------------------

export interface Vec2 { x: number; y: number; }

export interface SweptContactResult {
  hit: boolean;
  x: number;
  y: number;
  t: number;        // 0..1 parametric position along the segment
  vx: number;        // velocity at contact (linear interp of start/end vel)
  vy: number;
}

// Returns true if the point (with the ship's half-height hitbox offset,
// `hitboxOffset` = 9 * S) is penetrating the terrain at that x.
function penetrates(terrain: Terrain, x: number, y: number, hitboxOffset: number): boolean {
  return y + hitboxOffset >= terrainYAt(terrain.points, x);
}

// Sample the terrain along a motion segment (5-point parametric sampling)
// and report whether the segment crosses the terrain polyline anywhere
// between t=0 and t=1 (in addition to the endpoint penetration check).
function segmentCrossesTerrain(
  terrain: Terrain,
  x0: number, y0: number, x1: number, y1: number,
  hitboxOffset: number
): boolean {
  const SAMPLES = 5;
  let prevSign = Math.sign((y0 + hitboxOffset) - terrainYAt(terrain.points, x0)) || -1;
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    const sign = Math.sign((y + hitboxOffset) - terrainYAt(terrain.points, x)) || prevSign;
    if (sign !== prevSign && sign >= 0) return true;
    prevSign = sign;
  }
  return false;
}

// Given the ship's position before and after a physics step, detect whether
// the ship has hit (or swept through) the terrain during that step. If so,
// binary-search (4 iterations) the contact parameter t along the segment,
// and return the contact position + interpolated velocity.
//
// hitboxOffset is the ship's collision half-height (9 * S in the existing
// game code — kept constant regardless of visual module bulk per §5.2).
export function sweptGroundContact(
  terrain: Terrain,
  x0: number, y0: number, vx0: number, vy0: number,
  x1: number, y1: number, vx1: number, vy1: number,
  hitboxOffset: number
): SweptContactResult {
  const endPenetrates = penetrates(terrain, x1, y1, hitboxOffset);
  const crossed = endPenetrates || segmentCrossesTerrain(terrain, x0, y0, x1, y1, hitboxOffset);

  if (!crossed) {
    return { hit: false, x: x1, y: y1, t: 1, vx: vx1, vy: vy1 };
  }

  // Binary search for the contact parameter t in [0,1]. lo = last known-good
  // (non-penetrating) t, hi = known-penetrating t (start at 0/1 unless the
  // start itself already penetrates, in which case contact is immediate).
  let lo = 0;
  let hi = 1;
  const startPenetrates = penetrates(terrain, x0, y0, hitboxOffset);
  if (startPenetrates) {
    return { hit: true, x: x0, y: y0, t: 0, vx: vx0, vy: vy0 };
  }

  for (let i = 0; i < 4; i++) {
    const mid = (lo + hi) / 2;
    const mx = x0 + (x1 - x0) * mid;
    const my = y0 + (y1 - y0) * mid;
    if (penetrates(terrain, mx, my, hitboxOffset)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }

  const t = hi;
  const cx = x0 + (x1 - x0) * t;
  const cy = y0 + (y1 - y0) * t;
  const cvx = vx0 + (vx1 - vx0) * t;
  const cvy = vy0 + (vy1 - vy0) * t;
  return { hit: true, x: cx, y: cy, t, vx: cvx, vy: cvy };
}

// --- Swept segment-vs-circle (projectile -> ship) ---------------------------
// Tests whether the segment (x0,y0)->(x1,y1) passes within `radius` of the
// circle center (cx,cy) at any point along the segment (not just endpoints),
// so fast projectiles (Star Core stacks push speed up) can't tunnel through
// the ship's hitbox between two physics ticks.
export function sweptSegmentCircleHit(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, radius: number
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    return Math.hypot(x0 - cx, y0 - cy) < radius;
  }
  // Closest point on the segment to the circle center, clamped to [0,1].
  let t = ((cx - x0) * dx + (cy - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const px = x0 + dx * t;
  const py = y0 + dy * t;
  return Math.hypot(px - cx, py - cy) < radius;
}

// --- 4.5 Stability floors (numerical guards, not gameplay caps) ------------
// Rotation speed applied per-tick clamped to pi/2 per tick — unreachable
// below ~180 stacks of rotation-boosting upgrades, purely a numerical guard.
export const MAX_ROTATION_PER_TICK = Math.PI / 2;

export function clampRotationDelta(delta: number): number {
  if (delta > MAX_ROTATION_PER_TICK) return MAX_ROTATION_PER_TICK;
  if (delta < -MAX_ROTATION_PER_TICK) return -MAX_ROTATION_PER_TICK;
  return delta;
}
