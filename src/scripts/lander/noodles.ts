// ---------------------------------------------------------------------------
// lander-v10 commit 4a (§6.1): Noodle piles — the Spaghetti Engine mechanic.
//
// A "noodle" is a distinct thruster-exhaust particle (3-segment wavy strand)
// that falls under gravity like any other particle, but on reaching the
// terrain it deposits into a height-map parallel to the terrain's sample
// points instead of just despawning. Piles decay slowly over time, and a
// sufficiently tall pile turns an otherwise-fatal terrain impact into a soft
// squish landing (see checkNoodleSquish, called from the touchdown path).
//
// No upgrade sets stats.noodleStacks yet — this module is pure scaffolding
// for Commit 4b's Spaghetti Engine upgrade. The stack-count parameter is
// threaded through every entry point so wiring it up later is a one-line
// change (pass stats.noodleStacks instead of 0/1).
// ---------------------------------------------------------------------------

import type { Noodle, Terrain, TerrainPoint } from './types';

export const NOODLE_DEPOSIT_PER_HIT = 1.2;    // px added to a segment per noodle landing in it
export const NOODLE_BASE_CAP = 26;             // px, base per-segment cap (stack 0/1)
export const NOODLE_CAP_PER_STACK = 10;        // px, additional cap per Spaghetti Engine stack
export const NOODLE_DECAY_PER_SEC = 0.8;       // px/s pile height decay
export const NOODLE_SQUISH_THRESHOLD = 8;      // px — pile height at contact needed for a soft landing
export const NOODLE_SQUISH_DEPLETE = 10;       // px removed from the pile on a squish landing
export const NOODLE_SQUISH_VY = -60;           // px/s gentle bounce-up velocity after a squish landing

export const NOODLE_COLORS = ['#F4EBDA', '#E8D9A0'] as const;

// Per-segment cap given a Spaghetti Engine stack count (0 = not owned, still
// usable — the plan requires the emission/cap math to accept a stack-count
// multiplier "even though no upgrade sets it yet").
export function noodleCapFor(stacks: number): number {
  return NOODLE_BASE_CAP + NOODLE_CAP_PER_STACK * Math.max(0, stacks);
}

// A pile height-map is just a Float32Array parallel to `terrain.points`
// (one entry per sample point / segment start). Callers create one per
// level load, sized to the terrain's point count.
export function createNoodlePile(pointCount: number): Float32Array {
  return new Float32Array(Math.max(0, pointCount));
}

// Finds the terrain segment index (into the points array) closest to x —
// used both to deposit a noodle and to look up pile height at contact.
export function segmentIndexAt(points: TerrainPoint[], x: number): number {
  if (points.length === 0) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i++) {
    const d = Math.abs(points[i].x - x);
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

// Spawns one noodle particle at (x, y) with a small outward/upward kick,
// mirroring the thruster particle spawn pattern in main.ts::emitThrusterParticles.
export function makeNoodle(x: number, y: number, vx: number, vy: number, life = 1.1): Noodle {
  return { x, y, vx, vy, life, maxLife: life, seed: Math.random() * Math.PI * 2, alive: true };
}

// ---------------------------------------------------------------------------
// lander-v10 commit 5 (§8.2): pooled noodle strands.
//
// Noodles used to live in their own unbounded `noodles: Noodle[]` array in
// main.ts, grown via `.push(makeNoodle(...))` and reaped every tick via
// `compactNoodles` (an `Array.filter`, i.e. a fresh allocation every call).
// Per §8.2 ("must also serve noodle-strand particles from noodles.ts —
// route them through the same pool"), NoodlePool below is the exact same
// fixed-capacity ring-buffer/oldest-eviction pattern as particles.ts's
// ParticlePool, just sized much smaller (noodles are a rare, throttled
// emission — every 3rd thruster particle, at most — never anywhere near
// 1,200 concurrent). The free-standing `updateNoodles`/`compactNoodles`
// pure-array functions above are kept as-is (existing tests exercise them
// directly against plain arrays), and the pool's own simulate() reuses the
// exact same per-noodle physics so behavior is identical either way.
// ---------------------------------------------------------------------------

export const MAX_NOODLES = 180;

interface NoodleSlot extends Noodle {
  bornAt: number;
}

export class NoodlePool {
  readonly slots: NoodleSlot[];
  private nextFree = 0;
  private tick = 0;

  constructor(capacity: number = MAX_NOODLES) {
    this.slots = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.slots[i] = { x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, seed: 0, alive: false, bornAt: 0 };
    }
  }

  get capacity(): number {
    return this.slots.length;
  }

  alloc(x: number, y: number, vx: number, vy: number, life = 1.1): NoodleSlot {
    const n = this.slots.length;
    let idx = -1;
    for (let i = 0; i < n; i++) {
      const s = this.slots[(this.nextFree + i) % n];
      if (!s.alive) { idx = (this.nextFree + i) % n; break; }
    }
    if (idx === -1) {
      let oldest = 0;
      let oldestBorn = Infinity;
      for (let i = 0; i < n; i++) {
        if (this.slots[i].bornAt < oldestBorn) { oldestBorn = this.slots[i].bornAt; oldest = i; }
      }
      idx = oldest;
    }
    this.nextFree = (idx + 1) % n;
    const s = this.slots[idx];
    s.x = x; s.y = y; s.vx = vx; s.vy = vy;
    s.life = life; s.maxLife = life; s.seed = Math.random() * Math.PI * 2;
    s.alive = true;
    s.bornAt = this.tick++;
    return s;
  }

  // Same fall/deposit/decay rules as updateNoodles(), applied in place over
  // the fixed-length slot array — zero allocations, no filter.
  simulate(
    pile: Float32Array,
    points: TerrainPoint[],
    terrainYAt: (points: TerrainPoint[], x: number) => number,
    dt: number,
    stacks: number,
    gravity = 220
  ): void {
    const cap = noodleCapFor(stacks);
    const n = this.slots.length;
    for (let i = 0; i < n; i++) {
      const noo = this.slots[i];
      if (!noo.alive) continue;
      noo.vy += gravity * dt;
      noo.x += noo.vx * dt;
      noo.y += noo.vy * dt;
      noo.life -= dt;
      const groundY = terrainYAt(points, noo.x);
      if (noo.y >= groundY || noo.life <= 0) {
        if (noo.y >= groundY) {
          const idx = segmentIndexAt(points, noo.x);
          if (idx >= 0 && idx < pile.length) {
            pile[idx] = Math.min(cap, Math.max(0, pile[idx] + NOODLE_DEPOSIT_PER_HIT));
          }
        }
        noo.alive = false;
      }
    }
  }

  clear(): void {
    for (let i = 0; i < this.slots.length; i++) this.slots[i].alive = false;
  }
}

// Advances noodle physics (falls under gravity like a particle) and, when a
// noodle reaches the terrain, deposits it into the pile and kills it (it
// never renders as a loose particle again once absorbed).
export function updateNoodles(
  noodles: Noodle[],
  pile: Float32Array,
  points: TerrainPoint[],
  terrainYAt: (points: TerrainPoint[], x: number) => number,
  dt: number,
  stacks: number,
  gravity = 220
): void {
  const cap = noodleCapFor(stacks);
  for (const noo of noodles) {
    if (!noo.alive) continue;
    noo.vy += gravity * dt;
    noo.x += noo.vx * dt;
    noo.y += noo.vy * dt;
    noo.life -= dt;
    const groundY = terrainYAt(points, noo.x);
    if (noo.y >= groundY || noo.life <= 0) {
      if (noo.y >= groundY) {
        const idx = segmentIndexAt(points, noo.x);
        if (idx >= 0 && idx < pile.length) {
          pile[idx] = Math.min(cap, Math.max(0, pile[idx] + NOODLE_DEPOSIT_PER_HIT));
        }
      }
      noo.alive = false;
    }
  }
}

// Removes dead noodles — call once per tick after updateNoodles, mirroring
// the particles.filter((p) => p.life > 0) pattern used elsewhere.
export function compactNoodles(noodles: Noodle[]): Noodle[] {
  return noodles.filter((n) => n.alive);
}

// Decays every segment's pile height toward 0 — bounded, never negative.
export function decayNoodlePile(pile: Float32Array, dt: number): void {
  const drop = NOODLE_DECAY_PER_SEC * dt;
  for (let i = 0; i < pile.length; i++) {
    pile[i] = Math.max(0, pile[i] - drop);
  }
}

// §6.1 touchdown rule: if the pile height at the contact segment is >= the
// squish threshold, an otherwise-fatal terrain impact becomes a soft squish
// landing instead. Pure decision function — caller (physics/touchdown code)
// applies the velocity zeroing / bounce and pile depletion; this only
// reports whether the squish applies and by how much to deplete the pile.
export interface NoodleSquishResult {
  squish: boolean;
  segmentIndex: number;
  newHeight: number;
}

export function checkNoodleSquish(pile: Float32Array, points: TerrainPoint[], contactX: number): NoodleSquishResult {
  const idx = segmentIndexAt(points, contactX);
  const height = idx >= 0 && idx < pile.length ? pile[idx] : 0;
  if (height >= NOODLE_SQUISH_THRESHOLD) {
    const newHeight = Math.max(0, height - NOODLE_SQUISH_DEPLETE);
    return { squish: true, segmentIndex: idx, newHeight };
  }
  return { squish: false, segmentIndex: idx, newHeight: height };
}

// Applies a confirmed squish result to the pile (separated from the check so
// callers can decide/branch before mutating — matches the rest of the
// codebase's "detect then apply" pattern, e.g. sweptGroundContact/handleTouchdown).
export function applyNoodleSquish(pile: Float32Array, result: NoodleSquishResult): void {
  if (result.segmentIndex >= 0 && result.segmentIndex < pile.length) {
    pile[result.segmentIndex] = result.newHeight;
  }
}

// --- Rendering ----------------------------------------------------------------
// Draws a single falling noodle as 2 quadratic curves (a 3-segment wavy
// strand), alternating between the two pale colors.
export function drawNoodle(ctx: CanvasRenderingContext2D, noo: Noodle, S: number) {
  const c = ctx;
  const len = 6 * S;
  const wob = Math.sin(noo.seed + performance.now() / 220) * 2 * S;
  c.save();
  c.globalAlpha = Math.max(0, noo.life / noo.maxLife);
  c.strokeStyle = NOODLE_COLORS[Math.floor(noo.seed) % NOODLE_COLORS.length];
  c.lineWidth = 1 * S;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(noo.x - len / 2, noo.y);
  c.quadraticCurveTo(noo.x - len / 4 + wob, noo.y - len / 3, noo.x, noo.y);
  c.quadraticCurveTo(noo.x + len / 4 - wob, noo.y + len / 3, noo.x + len / 2, noo.y);
  c.stroke();
  c.restore();
}

// Renders the noodle piles as a soft rounded blob layer sitting on top of
// the terrain (called from render/world.ts after the terrain fill/stroke).
export function drawNoodlePiles(ctx: CanvasRenderingContext2D, pile: Float32Array, points: TerrainPoint[]) {
  if (pile.length === 0) return;
  const c = ctx;
  c.save();
  for (let i = 0; i < pile.length && i < points.length; i++) {
    const h = pile[i];
    if (h < 0.5) continue;
    const p = points[i];
    const w = 16 + h * 0.6;
    c.beginPath();
    c.ellipse(p.x, p.y - h * 0.35, w / 2, h * 0.7, 0, 0, Math.PI * 2);
    c.fillStyle = 'rgba(232, 217, 160, 0.85)';
    c.fill();
    c.strokeStyle = 'rgba(244, 235, 218, 0.6)';
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();
}
