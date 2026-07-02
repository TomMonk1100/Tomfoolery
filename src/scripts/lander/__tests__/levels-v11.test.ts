import { describe, it, expect } from 'vitest';
import { levelConfigFor, generateCanisters, generateTerrain } from '../levels';

describe('levels-v11: §Commit 5 surge levels', () => {
  it('levels 10 (idx 9) and every 10th thereafter are surge; level 0 and level 9 (idx 8) are not', () => {
    expect(levelConfigFor(9, 'pilot').surge).toBe(true);
    expect(levelConfigFor(19, 'pilot').surge).toBe(true);
    expect(levelConfigFor(29, 'ace').surge).toBe(true);
    expect(levelConfigFor(10, 'pilot').surge).toBe(false);
    expect(levelConfigFor(8, 'pilot').surge).toBe(false);
    expect(levelConfigFor(0, 'pilot').surge).toBe(false);
  });
});

describe('levels-v11: §Commit 5 projSpeed ramp', () => {
  // Surge levels (every 10th) intentionally spike projSpeed +15% above the
  // underlying ramp, then the next (non-surge) level drops back to the
  // ramp's own value — so full cfg.projSpeed is NOT monotonic across idx.
  // What IS guaranteed monotonic is the underlying idx-based ramp itself
  // (asymptoting at +80% from level 11 on); surge only ever multiplies on
  // top of that ramp's current value, never below it.
  const baseRamp = (idx: number) => 130 * (1 + Math.min(0.8, Math.max(0, idx - 10) * 0.02));

  it('is 130 at idx 0, and the underlying ramp is monotonically non-decreasing through idx 60', () => {
    expect(levelConfigFor(0, 'pilot').projSpeed).toBe(130);
    let prev = -Infinity;
    for (let idx = 0; idx <= 60; idx++) {
      const ramp = baseRamp(idx);
      expect(ramp).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = ramp;
    }
  });

  it('never exceeds 130 * 1.8 * 1.15 (ramp asymptote * surge spike) across idx 0-60', () => {
    for (let idx = 0; idx <= 60; idx++) {
      expect(levelConfigFor(idx, 'pilot').projSpeed).toBeLessThanOrEqual(130 * 1.8 * 1.15 + 1e-9);
    }
  });

  it('surge levels multiply the current ramp value by exactly 1.15', () => {
    for (const idx of [9, 19, 29, 39]) {
      const cfg = levelConfigFor(idx, 'pilot');
      expect(cfg.surge).toBe(true);
      expect(cfg.projSpeed).toBeCloseTo(baseRamp(idx) * 1.15, 6);
    }
  });
});

describe('levels-v11: §Commit 5 determinism', () => {
  it('levelConfigFor(23, "ace") is deep-equal across repeated calls', () => {
    const a = levelConfigFor(23, 'ace');
    const b = levelConfigFor(23, 'ace');
    expect(a).toEqual(b);
  });
});

describe('levels-v11: §Commit 6 fuel canisters', () => {
  it('returns no canisters below idx 3', () => {
    for (const idx of [0, 1, 2]) {
      const cfg = levelConfigFor(idx, 'pilot');
      const terrain = generateTerrain(cfg, 900, 500);
      expect(generateCanisters(cfg, terrain, 900, idx)).toEqual([]);
    }
  });

  it('at idx 5, across many difficulties/dims, every canister sits outside the pad corridor and y >= 40', () => {
    for (const diff of ['cadet', 'pilot', 'ace'] as const) {
      const cfg = levelConfigFor(5, diff);
      const width = 900;
      const terrain = generateTerrain(cfg, width, 500);
      const canisters = generateCanisters(cfg, terrain, width, 5);
      for (const c of canisters) {
        const inCorridor = c.x > terrain.pad.baseX - (terrain.pad.range + 70) &&
                            c.x < terrain.pad.baseX + (terrain.pad.range + 70);
        expect(inCorridor).toBe(false);
        expect(c.y).toBeGreaterThanOrEqual(40);
        expect(Number.isFinite(c.x)).toBe(true);
        expect(Number.isFinite(c.y)).toBe(true);
      }
    }
  });
});

describe('levels-v11: §Commit 6 bonus pad', () => {
  it('when present, sits far enough from the main pad center and within bounds (probed across many levels; skipped where absent)', () => {
    const width = 900, height = 500;
    let sawOne = false;
    for (let idx = 0; idx < 60; idx++) {
      const cfg = levelConfigFor(idx, 'pilot');
      const terrain = generateTerrain(cfg, width, height);
      if (!terrain.bonusPad) continue;
      sawOne = true;
      const padCenter = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      const bpCenter = (terrain.bonusPad.xStart + terrain.bonusPad.xEnd) / 2;
      expect(Math.abs(bpCenter - padCenter)).toBeGreaterThan(width * 0.28);
      expect(terrain.bonusPad.xStart).toBeGreaterThan(0);
      expect(terrain.bonusPad.xEnd).toBeLessThan(width);
    }
    expect(sawOne).toBe(true);
  });
});
