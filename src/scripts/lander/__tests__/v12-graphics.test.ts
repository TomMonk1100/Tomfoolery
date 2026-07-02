import { describe, it, expect } from 'vitest';
import { ParticlePool, MAX_PARTICLES, PARTICLE_DOT } from '../particles';
import { parallaxTransform } from '../perf';
import { shade } from '../render/palette';
import { generateAsteroids } from '../entities';
import { levelConfigFor } from '../levels';
import { mulberry32 } from '../rng';

// ---------------------------------------------------------------------------
// v12 §4 Verification & delivery item 1(a): particles — alloc() without opts
// behaves identically to v11 (kind 0/dot, no growth/rotation), pool capacity
// unchanged.
// ---------------------------------------------------------------------------
describe('particles: alloc() opts are backward-compatible (v12 Commit 5)', () => {
  it('alloc() without a trailing opts arg produces kind 0 (dot), no rotation, no growth', () => {
    const pool = new ParticlePool();
    const p = pool.alloc(1, 2, 3, 4, '#fff', 0.5, 2, 30);
    expect(p.kind).toBe(PARTICLE_DOT);
    expect(p.rot).toBe(0);
    expect(p.vrot).toBe(0);
    expect(p.grow).toBe(0);
  });

  it('pool capacity is still MAX_PARTICLES after the kind/rot/vrot/grow extension', () => {
    const pool = new ParticlePool();
    expect(pool.capacity).toBe(MAX_PARTICLES);
    expect(pool.slots.length).toBe(MAX_PARTICLES);
  });

  it('a kind-0 (dot) particle simulates exactly as in v11 — position integrates from vx/vy, then vy += gravity*dt, nothing else', () => {
    const pool = new ParticlePool(4);
    pool.alloc(0, 0, 10, 0, '#fff', 10, 1, 30);
    pool.simulate(0.1);
    const s = pool.slots[0];
    expect(s.x).toBeCloseTo(1, 10);
    expect(s.y).toBeCloseTo(0, 10);
    expect(s.vy).toBeCloseTo(3, 10);
    expect(s.vx).toBeCloseTo(10, 10); // unchanged — no damping applies to kind 0
    expect(s.size).toBeCloseTo(1, 10); // unchanged — no growth applies to kind 0
  });
});

// ---------------------------------------------------------------------------
// v12 §4 item 1(b): asteroid shape/rotSpeed determinism + isolation from the
// shared baseX/baseY/r stream (I1 — existing layouts stay pixel-identical).
// ---------------------------------------------------------------------------
describe('entities: asteroid shape/rotSpeed are seeded, deterministic, and isolated (v12 Commit 6)', () => {
  it('same config produces identical shape arrays and rotSpeeds across calls', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const a = generateAsteroids(cfg, 800, 480, 1.8);
    const b = generateAsteroids(cfg, 800, 480, 1.8);
    for (let i = 0; i < a.length; i++) {
      expect(a[i].shape).toEqual(b[i].shape);
      expect(a[i].rotSpeed).toBe(b[i].rotSpeed);
    }
  });

  it('shape has 8-10 vertices, each multiplier in [0.72, 1.28]; rotSpeed magnitude in [0.2, 0.6]', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const list = generateAsteroids(cfg, 800, 480, 1.8);
    for (const a of list) {
      expect(a.shape.length).toBeGreaterThanOrEqual(8);
      expect(a.shape.length).toBeLessThanOrEqual(10);
      for (const m of a.shape) {
        expect(m).toBeGreaterThanOrEqual(0.72);
        expect(m).toBeLessThanOrEqual(1.28);
      }
      expect(Math.abs(a.rotSpeed)).toBeGreaterThanOrEqual(0.2);
      expect(Math.abs(a.rotSpeed)).toBeLessThanOrEqual(0.6);
    }
  });

  it('baseX/baseY/r still match the original shared rng stream exactly — the new isolated shape/rotSpeed rng never perturbs it (I1)', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const width = 800, height = 480, S = 1.8;
    const list = generateAsteroids(cfg, width, height, S);
    const rand = mulberry32(cfg.seed * 71);
    for (const a of list) {
      const expectedBaseX = rand() * width;
      const expectedBaseY = height * (0.15 + rand() * 0.35);
      const expectedR = (10 + rand() * 12) * Math.min(1.25, S);
      expect(a.baseX).toBeCloseTo(expectedBaseX, 10);
      expect(a.baseY).toBeCloseTo(expectedBaseY, 10);
      expect(a.r).toBeCloseTo(expectedR, 10);
    }
  });
});

// ---------------------------------------------------------------------------
// v12 §4 item 1(c): shade() — identity at amt=0, monotonic lighten/darken.
// ---------------------------------------------------------------------------
describe('render/palette: shade() — hex lighten/darken (v12 Commit 1)', () => {
  const toNum = (hex: string) => parseInt(hex.replace('#', ''), 16);

  it('amt=0 is the identity (case-insensitive hex match)', () => {
    expect(shade('#3B2C16', 0).toLowerCase()).toBe('#3b2c16');
  });

  it('positive amt lightens, negative amt darkens', () => {
    const base = '#3B2C16';
    expect(toNum(shade(base, 0.2))).toBeGreaterThan(toNum(base));
    expect(toNum(shade(base, -0.2))).toBeLessThan(toNum(base));
  });

  it('is monotonically non-decreasing as amt increases across [-0.9, 0.9]', () => {
    const base = '#3B2C16';
    let prev = toNum(shade(base, -0.9));
    for (let a = -0.8; a <= 0.9001; a += 0.1) {
      const v = toNum(shade(base, a));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

// ---------------------------------------------------------------------------
// v12 §4 item 1(d): withParallax's underlying pure transform math —
// identity at camZoom===1 for any factor; factor 1.0 matches the existing
// full-camera transform at any zoom; factor 0 is always screen-fixed.
// ---------------------------------------------------------------------------
describe('perf: parallaxTransform — identity at camZoom===1, matches full camera at factor 1.0 (v12 Commit 2)', () => {
  it('camZoom===1 collapses to the same transform for any factor', () => {
    const width = 800, height = 480, camX = width / 2, camY = height / 2, camZoom = 1;
    for (const factor of [0, 0.12, 0.3, 0.55, 1]) {
      const m = parallaxTransform(factor, camX, camY, camZoom, width, height);
      expect(m.z).toBeCloseTo(1, 10);
      expect(m.tx1).toBeCloseTo(width / 2, 10);
      expect(m.ty1).toBeCloseTo(height / 2, 10);
      expect(m.tx2).toBeCloseTo(-camX, 10);
      expect(m.ty2).toBeCloseTo(-camY, 10);
    }
  });

  it('at camZoom !== 1, factor 1.0 matches the existing full-camera transform exactly', () => {
    const width = 800, height = 480, camX = 420, camY = 300, camZoom = 1.6;
    const m = parallaxTransform(1, camX, camY, camZoom, width, height);
    expect(m.z).toBeCloseTo(camZoom, 10);
    expect(m.tx2).toBeCloseTo(-camX, 10);
    expect(m.ty2).toBeCloseTo(-camY, 10);
  });

  it('factor 0 is screen-fixed ("infinite distance") regardless of camZoom/camX/camY', () => {
    const width = 800, height = 480;
    const m = parallaxTransform(0, 999, 111, 2.4, width, height);
    expect(m.z).toBeCloseTo(1, 10);
    expect(m.tx2).toBeCloseTo(-width / 2, 10);
    expect(m.ty2).toBeCloseTo(-height / 2, 10);
  });
});
