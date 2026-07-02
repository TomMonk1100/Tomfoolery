// ---------------------------------------------------------------------------
// lander-v10 commit 5 (§8.2): pooled particle system.
//
// Was: a plain-array particle list, `particles.push(makeParticle(...))` to
// spawn, `particles = particles.filter((p) => p.life > 0)` once per tick to
// reap dead ones. Both of those allocate (push grows the backing array as it
// resizes; filter allocates a brand-new array every single call) and GC
// churns hard at emission rates of dozens of particles/second.
//
// Now: a single preallocated ring buffer of MAX_PARTICLES (1,200) `Particle`
// slots, created once. `alloc()` never grows the array — it reuses a dead
// slot if one exists, or steals the OLDEST currently-alive slot (tracked via
// a monotonic `bornAt` tick counter) when the pool is completely full. The
// simulate/draw step walks the fixed-length array and skips dead slots in
// place; there is no filter, no push, no shrink/grow, ever, after the
// initial allocation.
//
// noodles.ts (§6.1 Spaghetti Engine strands) shares this exact pool/pattern
// — see NoodlePool below — rather than maintaining its own separate
// unbounded `Noodle[]` array, per §8.2's "must also serve noodle-strand
// particles" requirement.
// ---------------------------------------------------------------------------

import type { Particle } from './types';

export const MAX_PARTICLES = 1200;

// Extra bookkeeping fields layered onto Particle slots so alloc() can find
// "the oldest alive slot" in O(1) amortized (a simple incrementing counter,
// not a timestamp — cheaper than performance.now() per spawn and avoids the
// clock-resolution ties two same-frame spawns would otherwise have).
//
// v12 Commit 5: `kind` gives particles a vocabulary beyond uniform fading
// dots — 0 dot (v11 behavior, untouched), 1 smoke (buoyant + grows), 2 spark
// (half gravity + velocity damping), 3 chunk (rotates, full gravity). `rot`/
// `vrot` are only meaningful for chunks; `grow` (px/s) only for smoke.
export const PARTICLE_DOT = 0;
export const PARTICLE_SMOKE = 1;
export const PARTICLE_SPARK = 2;
export const PARTICLE_CHUNK = 3;

interface PoolSlot extends Particle {
  alive: boolean;
  bornAt: number;
  kind: number;
  rot: number;
  vrot: number;
  grow: number;
}

export class ParticlePool {
  readonly slots: PoolSlot[];
  private nextFree = 0;      // round-robin search cursor for a free slot
  private tick = 0;          // monotonic counter stamped into bornAt

  constructor(capacity: number = MAX_PARTICLES) {
    this.slots = new Array(capacity);
    for (let i = 0; i < capacity; i++) {
      this.slots[i] = {
        x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, color: '#000', size: 0, gravity: 0,
        alive: false, bornAt: 0, kind: PARTICLE_DOT, rot: 0, vrot: 0, grow: 0,
      };
    }
  }

  get capacity(): number {
    return this.slots.length;
  }

  // Recycles a slot and (re)initializes it as a live particle. Never
  // allocates: always writes into an existing slot object. When every slot
  // is alive, evicts the one with the smallest `bornAt` (the oldest) so a
  // sustained high emission rate degrades gracefully (oldest/faintest
  // particles disappear first) instead of dropping newly-requested ones.
  //
  // v12 Commit 5: trailing `opts` is optional — every existing call site
  // (no 9th argument) compiles unchanged and produces the exact v11 slot
  // (kind 0/dot, no rotation, no growth).
  alloc(
    x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, gravity = 30,
    opts?: { kind?: number; vrot?: number; grow?: number }
  ): PoolSlot {
    const n = this.slots.length;
    let idx = -1;
    for (let i = 0; i < n; i++) {
      const s = this.slots[(this.nextFree + i) % n];
      if (!s.alive) { idx = (this.nextFree + i) % n; break; }
    }
    if (idx === -1) {
      // Pool saturated — recycle the oldest alive slot.
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
    s.life = life; s.maxLife = life; s.color = color; s.size = size; s.gravity = gravity;
    s.kind = opts?.kind ?? PARTICLE_DOT;
    s.rot = 0;
    s.vrot = opts?.vrot ?? 0;
    s.grow = opts?.grow ?? 0;
    s.alive = true;
    s.bornAt = this.tick++;
    return s;
  }

  // Advances every alive slot in place; kills any whose life has expired.
  // Zero allocations, zero array resizing — walks the fixed-length backing
  // array and mutates slots directly.
  //
  // v12 Commit 5: kind-specific physics layered on top of the shared
  // position integration. Kind 0 (dot) is byte-for-byte the v11 behavior.
  simulate(dt: number): void {
    const n = this.slots.length;
    for (let i = 0; i < n; i++) {
      const s = this.slots[i];
      if (!s.alive) continue;
      s.life -= dt;
      if (s.life <= 0) { s.alive = false; continue; }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.kind === PARTICLE_SMOKE) {
        s.vy -= 26 * dt; // buoyancy — smoke rises instead of falling
        s.size += s.grow * dt;
      } else if (s.kind === PARTICLE_SPARK) {
        s.vy += s.gravity * 0.5 * dt;
        s.vx *= 0.98; // velocity damping ×0.98/tick
        s.vy *= 0.98;
      } else if (s.kind === PARTICLE_CHUNK) {
        s.rot += s.vrot * dt;
        s.vy += s.gravity * dt;
      } else {
        s.vy += s.gravity * dt;
      }
    }
  }

  // Kills every slot (level reload) without reallocating the pool.
  clear(): void {
    for (let i = 0; i < this.slots.length; i++) this.slots[i].alive = false;
  }

  get aliveCount(): number {
    let c = 0;
    for (let i = 0; i < this.slots.length; i++) if (this.slots[i].alive) c++;
    return c;
  }
}

// Back-compat helper kept for any call site that still wants a standalone
// Particle value shape (e.g. tests) without going through a pool instance.
export function makeParticle(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, gravity = 30): Particle {
  return { x, y, vx, vy, life, maxLife: life, color, size, gravity };
}
