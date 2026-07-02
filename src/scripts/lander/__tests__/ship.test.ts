import { describe, it, expect } from 'vitest';
import { moduleScale, countStacks } from '../render/ship';
import type { UpgradeId } from '../types';

describe('render/ship: §5.2 moduleScale(n) — linear, unbounded per-stack growth', () => {
  it('n=1 is the unscaled baseline (1.0x — legacy single-pick art unchanged)', () => {
    expect(moduleScale(1)).toBe(1);
  });

  it('n=0 (not owned) also resolves to 1.0x (drawModule short-circuits before using it, but the formula itself must not divide/blow up)', () => {
    expect(moduleScale(0)).toBe(1);
  });

  it('grows by exactly +0.30 per additional stack, unbounded', () => {
    expect(moduleScale(2)).toBeCloseTo(1.3, 10);
    expect(moduleScale(3)).toBeCloseTo(1.6, 10);
    expect(moduleScale(10)).toBeCloseTo(1 + 0.3 * 9, 10);
  });

  it('is monotonically increasing and never caps (§5.2/§10 item 2 — no scale cap)', () => {
    let prev = moduleScale(1);
    for (let n = 2; n <= 500; n++) {
      const k = moduleScale(n);
      expect(k).toBeGreaterThan(prev);
      expect(Number.isFinite(k)).toBe(true);
      prev = k;
    }
  });
});

describe('render/ship: countStacks — per-upgrade pick tally used to key moduleScale(n) and the >=3 pip', () => {
  it('counts each id occurrence independently', () => {
    const picks: UpgradeId[] = ['fuel_tank', 'fuel_tank', 'shield', 'fuel_tank', 'gyro'];
    const counts = countStacks(picks);
    expect(counts.get('fuel_tank')).toBe(3);
    expect(counts.get('shield')).toBe(1);
    expect(counts.get('gyro')).toBe(1);
    expect(counts.get('star_core')).toBeUndefined();
  });

  it('empty picks produce an empty map', () => {
    expect(countStacks([]).size).toBe(0);
  });
});
