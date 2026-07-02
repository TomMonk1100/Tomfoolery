// ---------------------------------------------------------------------------
// lander-v10 commit 2 (§4.4): logic out of the render path.
//
// Asteroids used to be computed and collision-tested inline inside draw()
// in main.ts (position derived from performance.now() every frame, with
// ship-collision mutation happening mid-render). That's moved here: they
// are now stateful entities generated once at loadLevel (seeded exactly as
// the old inline code so layouts are unchanged) and advanced by
// updateAsteroids(dt) during the physics/update phase. render/world.ts (or
// main.ts's draw()) only reads Asteroid.x/y/r to blit — zero gameplay
// mutation in the render path.
// ---------------------------------------------------------------------------

import { mulberry32 } from './rng';
import type { Drone, DroneBehavior, LevelConfig } from './types';

export interface Asteroid {
  baseX: number;
  baseY: number;
  r: number;
  seedIndex: number; // i — used for the same per-asteroid phase offsets as before
  x: number;          // current computed position (updated by updateAsteroids)
  y: number;
  alive: boolean;
  // v12 Commit 6: render-only — an irregular polygon shape + a rotation
  // speed so asteroids read as tumbling rock instead of a plain circle.
  // Collision still uses the circle `r` above — gameplay untouched (I1).
  shape: number[];
  rotSpeed: number;
}

// Generated once per level load. Mirrors the exact seeding the old inline
// draw()-time code used: `mulberry32(cfg.seed * 71)`, drawn in order for
// baseX/baseY/r per asteroid index — so layouts are pixel-identical.
export function generateAsteroids(cfg: LevelConfig, width: number, height: number, S: number): Asteroid[] {
  if (cfg.asteroids <= 0) return [];
  const rand = mulberry32(cfg.seed * 71);
  const list: Asteroid[] = [];
  for (let i = 0; i < cfg.asteroids; i++) {
    const baseX = rand() * width;
    const baseY = height * (0.15 + rand() * 0.35);
    const r = (10 + rand() * 12) * Math.min(1.25, S);
    // v12 Commit 6: an isolated NEW rng, seeded per-asteroid-index, so this
    // render-only polygon/spin data never perturbs the shared `rand` stream
    // above (which must stay pixel-identical for existing layouts — I1).
    const sr = mulberry32(cfg.seed * 947 + i);
    const sides = 8 + Math.floor(sr() * 3); // 8..10
    const shape: number[] = [];
    for (let k = 0; k < sides; k++) shape.push(0.72 + sr() * 0.56); // 0.72..1.28
    const rotSpeed = (sr() < 0.5 ? -1 : 1) * (0.2 + sr() * 0.4); // ±0.2..0.6 rad/s
    list.push({ baseX, baseY, r, seedIndex: i, x: baseX, y: baseY, alive: true, shape, rotSpeed });
  }
  return list;
}

// Advances asteroid orbital motion using elapsed wall/sim time `t` (seconds),
// matching the old inline formula exactly:
//   ax = baseX + sin(t*0.4 + i) * 60
//   ay = baseY + cos(t*0.3 + i*2) * 20
export function updateAsteroids(asteroids: Asteroid[], t: number): void {
  for (const a of asteroids) {
    a.x = a.baseX + Math.sin(t * 0.4 + a.seedIndex) * 60;
    a.y = a.baseY + Math.cos(t * 0.3 + a.seedIndex * 2) * 20;
  }
}

// Ship<->asteroid collision test, extracted from the old draw()-time check.
// Caller (main.ts update()) is responsible for applying shield/destroy
// consequences; this just reports which asteroid (if any) was hit.
export function findAsteroidHit(
  asteroids: Asteroid[], shipX: number, shipY: number, hitboxOffset: number
): Asteroid | null {
  for (const a of asteroids) {
    if (!a.alive) continue;
    if (Math.hypot(shipX - a.x, shipY - a.y) < a.r + hitboxOffset) return a;
  }
  return null;
}

// ---------------------------------------------------------------------------
// lander-v10 commit 4a (§6.3): drones/companions.
//
// Orbiting entities pooled up to MAX_DRONES (12 rendered). Each drone orbits
// the ship at `radius = 26 + 8*index` and advances `angle += dt * speed`.
// Two selectable behaviors:
//   - 'intercept': consumes a charge to block one incoming projectile/level.
//   - 'shoot': ally-UFO-style behavior (fires at hostile UFOs/asteroids) —
//     the actual firing logic lives in main.ts alongside the existing ally
//     projectile system (allyProjectiles) since it needs access to the UFO/
//     asteroid lists; this module only owns the pool + orbital motion.
// Wired to the generic `droneCharges` stat (§6.6) even though no upgrade
// sets it yet — Commit 4b's Swarm Drones (and friends) populate it.
// ---------------------------------------------------------------------------

export const MAX_DRONES = 12;

// Builds (or resizes) a drone pool for the current droneCharges stat count,
// clamped to MAX_DRONES rendered. Excess charges beyond MAX_DRONES simply
// don't get a rendered/orbiting drone (still fine — charges are the
// gameplay-relevant number; rendering is cosmetic and capped for sanity).
export function buildDronePool(count: number, behavior: DroneBehavior = 'intercept'): Drone[] {
  const n = Math.max(0, Math.min(MAX_DRONES, Math.floor(count)));
  const list: Drone[] = [];
  for (let i = 0; i < n; i++) {
    list.push({
      index: i,
      angle: (i / Math.max(1, n)) * Math.PI * 2,
      speed: 1.1 + i * 0.05,
      behavior,
      charges: 1,
      alive: true,
    });
  }
  return list;
}

export function droneOrbitRadius(index: number): number {
  return 26 + 8 * index;
}

// Advances every drone's orbit angle. Position is derived on demand (see
// droneWorldPos) rather than stored, so callers always read a consistent
// angle -> position mapping regardless of ship position changes mid-frame.
export function updateDrones(drones: Drone[], dt: number): void {
  for (const d of drones) {
    if (!d.alive) continue;
    d.angle += dt * d.speed;
  }
}

export function droneWorldPos(shipX: number, shipY: number, d: Drone): { x: number; y: number } {
  const r = droneOrbitRadius(d.index);
  return { x: shipX + Math.cos(d.angle) * r, y: shipY + Math.sin(d.angle) * r };
}

// ---------------------------------------------------------------------------
// lander-v10 commit 4a (§6.4): terrain mutation — terraform().
//
// Relaxes terrain points toward their local average within `radius` px of x,
// smoothing spikes/craters. Used by the (future) Terraformer upgrade and any
// other terrain-mutating mechanic. Marks the terrain static layer dirty via
// the caller-supplied `markDirty` callback, throttled by the caller using
// `shouldRebuild` below — the actual static-layer cache is Commit 5's job;
// this just implements the throttled-dirty-flag pattern against it so that
// commit can plug in without re-deriving this logic.
// ---------------------------------------------------------------------------

export function terraform(points: { x: number; y: number }[], x: number, radius: number, strength: number): void {
  if (points.length === 0 || radius <= 0 || strength <= 0) return;
  const affected = points.filter((p) => Math.abs(p.x - x) <= radius);
  if (affected.length === 0) return;
  const avgY = affected.reduce((sum, p) => sum + p.y, 0) / affected.length;
  const s = Math.max(0, Math.min(1, strength));
  for (const p of affected) {
    p.y = p.y + (avgY - p.y) * s;
  }
}

// Throttled-dirty-flag guard: at most one rebuild per REBUILD_INTERVAL_S
// seconds of sim/wall time. Callers track `lastRebuildTime` themselves
// (a plain number in main.ts's closure state) and call this each time
// terraform() (or noodle-pile deposition) marks the terrain layer dirty.
export const REBUILD_INTERVAL_S = 0.5;

export function shouldRebuild(dirty: boolean, now: number, lastRebuildTime: number): boolean {
  return dirty && (now - lastRebuildTime) >= REBUILD_INTERVAL_S;
}
