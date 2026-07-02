import { describe, it, expect, beforeEach } from 'vitest';
import { ParticlePool, MAX_PARTICLES, makeParticle } from '../particles';
import { DegradationGuard, DEGRADE_THRESHOLD_MS, RECOVER_THRESHOLD_MS, DEGRADE_FRAMES, RECOVER_FRAMES } from '../perf';
import { levelConfigFor, generateTerrain, generateSky } from '../levels';
import { SKIES } from '../upgrades';

// ---------------------------------------------------------------------------
// §8.2 Particle pool — never grows past capacity, recycles the oldest slot.
// ---------------------------------------------------------------------------
describe('particles: ParticlePool never allocates beyond MAX_PARTICLES', () => {
  it('capacity stays fixed at MAX_PARTICLES regardless of alloc() count', () => {
    const pool = new ParticlePool();
    expect(pool.capacity).toBe(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES * 3; i++) {
      pool.alloc(i, i, 0, 0, '#fff', 1, 1);
    }
    // The backing array itself never resizes — capacity is identical before
    // and after allocating 3x its size worth of particles.
    expect(pool.capacity).toBe(MAX_PARTICLES);
    expect(pool.slots.length).toBe(MAX_PARTICLES);
  });

  it('alloc() reuses a dead slot instead of growing when one is free', () => {
    const pool = new ParticlePool(10);
    for (let i = 0; i < 5; i++) pool.alloc(i, 0, 0, 0, '#fff', 1, 1);
    expect(pool.aliveCount).toBe(5);
    // Kill one, then alloc one more — should land back at capacity 10, not 11.
    pool.slots[2].alive = false;
    pool.alloc(99, 0, 0, 0, '#f00', 1, 1);
    expect(pool.capacity).toBe(10);
    expect(pool.aliveCount).toBe(5);
  });

  it('when saturated, alloc() evicts the OLDEST alive slot (smallest bornAt), never grows', () => {
    const pool = new ParticlePool(4);
    for (let i = 0; i < 4; i++) pool.alloc(i, 0, 0, 0, '#fff', 100, 1); // long life, all stay alive
    expect(pool.aliveCount).toBe(4);
    expect(pool.capacity).toBe(4);
    // Pool is full (0 dead slots) — next alloc must recycle, not grow.
    const evicted = pool.alloc(999, 0, 0, 0, '#0f0', 100, 1);
    expect(pool.capacity).toBe(4);
    expect(pool.aliveCount).toBe(4);
    // The evicted (returned) slot should be the one originally born first (x === 0).
    expect(evicted.x).toBe(999);
    const xs = pool.slots.map((s) => s.x).sort((a, b) => a - b);
    expect(xs).toEqual([1, 2, 3, 999]); // x===0 (oldest, bornAt=0) got evicted
  });

  it('simulate() kills expired slots in place with zero array resizing', () => {
    const pool = new ParticlePool(5);
    pool.alloc(0, 0, 0, 0, '#fff', 0.01, 1);
    pool.simulate(0.02); // life goes negative -> dies
    expect(pool.aliveCount).toBe(0);
    expect(pool.capacity).toBe(5);
  });

  it('makeParticle back-compat helper still produces a plain Particle shape', () => {
    const p = makeParticle(1, 2, 3, 4, '#abc', 0.5, 2, 10);
    expect(p).toMatchObject({ x: 1, y: 2, vx: 3, vy: 4, color: '#abc', life: 0.5, maxLife: 0.5, size: 2, gravity: 10 });
  });
});

// ---------------------------------------------------------------------------
// §8.5 Degradation guard — EMA-driven state machine, synthetic frame times.
// ---------------------------------------------------------------------------
describe('perf: DegradationGuard state transitions', () => {
  it('does not degrade from a brief spike shorter than DEGRADE_FRAMES', () => {
    const guard = new DegradationGuard();
    for (let i = 0; i < DEGRADE_FRAMES - 5; i++) guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(guard.degraded).toBe(false);
  });

  it('flips to degraded after DEGRADE_FRAMES consecutive frames above threshold', () => {
    const guard = new DegradationGuard();
    let degraded = false;
    for (let i = 0; i < DEGRADE_FRAMES; i++) degraded = guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(degraded).toBe(true);
    expect(guard.degraded).toBe(true);
  });

  it('a real dip below threshold resets the consecutive-above streak, so a short resumed bad streak does not immediately re-degrade', () => {
    // The guard is an EMA, not a raw frame counter (deliberately — "low-pass
    // enough to ignore single-frame spikes" per perf.ts's docstring), so it
    // responds to a change in input gradually. Keep the initial bad streak
    // well short of DEGRADE_FRAMES (20 of 60) so it can't trip the guard on
    // its own, then feed enough good frames to fully cool the EMA back down
    // (confirmed via emaMs) before resuming a bad streak.
    const guard = new DegradationGuard();
    for (let i = 0; i < 20; i++) guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(guard.degraded).toBe(false);
    for (let i = 0; i < 40; i++) guard.sample(1);
    expect(guard.emaMs).toBeLessThan(RECOVER_THRESHOLD_MS);
    // EMA is now cold. Resuming a DEGRADE_FRAMES-1-long bad streak isn't
    // enough to flip the guard: it first has to climb back over the
    // DEGRADE_THRESHOLD_MS before "above" starts counting at all, so far
    // fewer than DEGRADE_FRAMES of the resumed samples actually register as
    // consecutive-above — proving the earlier streak was genuinely reset,
    // not just carried over.
    for (let i = 0; i < DEGRADE_FRAMES - 1; i++) guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(guard.degraded).toBe(false);
    // It does eventually degrade once enough consecutive bad samples land
    // after the EMA re-crosses the threshold.
    let degraded = false;
    for (let i = 0; i < 50 && !degraded; i++) degraded = guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(degraded).toBe(true);
  });

  it('recovers to normal once the EMA has converged below the recovery threshold for RECOVER_FRAMES consecutive samples', () => {
    // Convergence takes a handful of samples before the EMA itself first
    // dips under RECOVER_THRESHOLD_MS (it starts near the degraded average
    // and decays geometrically toward the new input) — belowCount only
    // starts accumulating once that happens, so the guard needs more than
    // exactly RECOVER_FRAMES raw samples fed in to observe a full
    // RECOVER_FRAMES-long streak of ema-below-threshold. Feed comfortably
    // more than that and assert the guard does eventually recover.
    const guard = new DegradationGuard();
    for (let i = 0; i < DEGRADE_FRAMES; i++) guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(guard.degraded).toBe(true);
    let degraded = true;
    for (let i = 0; i < RECOVER_FRAMES + 50; i++) degraded = guard.sample(RECOVER_THRESHOLD_MS - 5);
    expect(degraded).toBe(false);
    expect(guard.emaMs).toBeLessThan(RECOVER_THRESHOLD_MS);
  });

  it('stays degraded through the dead zone between the two thresholds (neither streak advances nor resets)', () => {
    const guard = new DegradationGuard();
    for (let i = 0; i < DEGRADE_FRAMES; i++) guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(guard.degraded).toBe(true);
    // Frame times in the dead zone (between RECOVER and DEGRADE thresholds)
    // shouldn't trigger recovery no matter how many of them arrive.
    for (let i = 0; i < RECOVER_FRAMES * 2; i++) guard.sample((DEGRADE_THRESHOLD_MS + RECOVER_THRESHOLD_MS) / 2);
    expect(guard.degraded).toBe(true);
  });

  it('reset() clears all state back to a fresh guard', () => {
    const guard = new DegradationGuard();
    for (let i = 0; i < DEGRADE_FRAMES; i++) guard.sample(DEGRADE_THRESHOLD_MS + 10);
    expect(guard.degraded).toBe(true);
    guard.reset();
    expect(guard.degraded).toBe(false);
    expect(guard.emaMs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// §8.1 Static layer cache — rebuilds only when dirty AND the throttle window
// has elapsed. LayerCache touches `document.createElement('canvas')`; there's
// no jsdom dependency in this project (plan §1 permits only vitest as a new
// dev-dependency), so a minimal fake `document`/2D-context stand-in is
// installed for just this describe block — enough surface for layers.ts's
// gradient/path calls to no-op safely without asserting on pixels.
// ---------------------------------------------------------------------------
describe('render/layers: LayerCache.tryRebuildTerrain respects the dirty flag + throttle', () => {
  let createElementCalls = 0;

  function fakeGradient() {
    return { addColorStop: () => {} };
  }

  function fakeCtx(): any {
    return new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => fakeGradient();
          return () => {};
        },
      }
    );
  }

  beforeEach(() => {
    createElementCalls = 0;
    (globalThis as any).document = {
      createElement: () => {
        createElementCalls++;
        return { width: 0, height: 0, getContext: () => fakeCtx() };
      },
    };
  });

  it('does not rebuild when dirty is false, and rebuilds at most once per REBUILD_INTERVAL_S while dirty', async () => {
    const { LayerCache, REBUILD_INTERVAL_S } = await import('../render/layers');
    const cfg = levelConfigFor(0, 'pilot');
    const terrain = generateTerrain(cfg, 800, 500);
    const { stars, planet } = generateSky(cfg, 800, 500);
    const cache = new LayerCache();

    cache.build({ width: 800, height: 500, cfg, terrain, stars, planet, skyTheme: SKIES[0], levelIndex: 0 });
    expect(cache.ready).toBe(true);

    // Not dirty — repeated calls must never trigger a rebuild (no new canvas created).
    createElementCalls = 0;
    expect(cache.tryRebuildTerrain(0)).toBe(false);
    expect(cache.tryRebuildTerrain(10)).toBe(false);
    expect(createElementCalls).toBe(0);

    // Dirty, but throttle window hasn't elapsed yet (lastRebuildTime starts at 0).
    cache.markTerrainDirty();
    expect(cache.tryRebuildTerrain(REBUILD_INTERVAL_S - 0.01)).toBe(false);
    expect(createElementCalls).toBe(0);
    expect(cache.isDirty).toBe(true); // still pending — not silently dropped

    // Throttle window elapsed — exactly one rebuild happens now.
    expect(cache.tryRebuildTerrain(REBUILD_INTERVAL_S)).toBe(true);
    expect(createElementCalls).toBe(1);
    expect(cache.isDirty).toBe(false);

    // Immediately calling again (still within the new throttle window, and
    // no longer dirty) must not rebuild again.
    createElementCalls = 0;
    expect(cache.tryRebuildTerrain(REBUILD_INTERVAL_S + 0.05)).toBe(false);
    expect(createElementCalls).toBe(0);

    // Mark dirty again immediately — still throttled until another full
    // interval has passed since the LAST rebuild (not since markTerrainDirty).
    cache.markTerrainDirty();
    expect(cache.tryRebuildTerrain(REBUILD_INTERVAL_S + 0.1)).toBe(false);
    expect(cache.tryRebuildTerrain(REBUILD_INTERVAL_S * 2)).toBe(true);
    expect(createElementCalls).toBe(1);
  });

  it('splitStars divides the star list into two disjoint subsets covering every star exactly once', async () => {
    const { splitStars } = await import('../render/layers');
    const stars = Array.from({ length: 37 }, (_, i) => ({ x: i, y: i, r: 1, phase: 0, bright: 0.5 }));
    const [a, b] = splitStars(stars);
    expect(a.length + b.length).toBe(stars.length);
    const seen = new Set([...a, ...b].map((s) => s.x));
    expect(seen.size).toBe(stars.length);
  });
});
