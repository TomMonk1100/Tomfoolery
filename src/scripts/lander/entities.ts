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
import type { LevelConfig } from './types';

export interface Asteroid {
  baseX: number;
  baseY: number;
  r: number;
  seedIndex: number; // i — used for the same per-asteroid phase offsets as before
  x: number;          // current computed position (updated by updateAsteroids)
  y: number;
  alive: boolean;
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
    list.push({ baseX, baseY, r, seedIndex: i, x: baseX, y: baseY, alive: true });
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
