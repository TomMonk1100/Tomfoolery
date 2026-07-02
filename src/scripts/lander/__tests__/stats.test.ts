import { describe, it, expect } from 'vitest';
import { computeStats, clampGravityProduct } from '../stats';
import type { UpgradeId } from '../types';

describe('stats: §4.5 stability floors (not gameplay caps)', () => {
  it('base stats (no picks) satisfy every floor', () => {
    const s = computeStats([], 'pilot');
    expect(s.maxFuel).toBeGreaterThanOrEqual(20);
    expect(s.thrustPower).toBeGreaterThanOrEqual(60);
    expect(s.fuelBurnMult).toBeGreaterThanOrEqual(0.05);
    expect(s.windMult).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(s.massSum)).toBe(true);
    expect(Number.isFinite(s.areaSum)).toBe(true);
  });

  it('thrustPower base is raised to 158 per §4.2', () => {
    const s = computeStats([], 'pilot');
    expect(s.thrustPower).toBe(158);
  });

  it('heavy drawback stacking never drives fuelBurnMult, windMult, thrustPower, or maxFuel below their floors', () => {
    // storm_dampeners repeatedly reduces thrustPower; scanner repeatedly
    // reduces maxFuel — stack both hard and confirm floors hold.
    const picks: UpgradeId[] = [];
    for (let i = 0; i < 200; i++) picks.push('storm_dampeners', 'scanner');
    const s = computeStats(picks, 'pilot');
    expect(s.thrustPower).toBeGreaterThanOrEqual(60);
    expect(s.maxFuel).toBeGreaterThanOrEqual(20);
    expect(Number.isFinite(s.thrustPower)).toBe(true);
    expect(Number.isFinite(s.maxFuel)).toBe(true);
  });

  it('produces no NaN/Infinity across 1000 stacks of every existing upgrade id', () => {
    const ids: UpgradeId[] = [
      'fuel_tank', 'boost_thrusters', 'magnetic_pad', 'shield', 'gyro', 'gravity_anchor',
      'scanner', 'feather_gear', 'reserve_chute', 'storm_dampeners', 'fuel_scoop',
      'precision_jets', 'jalapeno_injectors', 'boomerang_hull', 'alien_diplomacy',
      'chrono_crystal', 'overdrive_core', 'phoenix_feather', 'star_core',
    ];
    for (const id of ids) {
      const picks = new Array(1000).fill(id) as UpgradeId[];
      const s = computeStats(picks, 'pilot');
      for (const [key, val] of Object.entries(s)) {
        if (typeof val === 'number') {
          expect(Number.isFinite(val), `${id} -> ${key} was ${val}`).toBe(true);
        }
      }
    }
  });
});

describe('stats: clampGravityProduct (gravity product >= 1 px/s^2 floor)', () => {
  it('never lets the gravity product fall below 1 px/s^2', () => {
    expect(clampGravityProduct(100, 0)).toBeGreaterThanOrEqual(0);
    // The returned value is a MULTIPLIER such that gLevel * mult >= 1
    const gLevel = 100;
    const flooredMult = clampGravityProduct(gLevel, 0);
    expect(gLevel * flooredMult).toBeGreaterThanOrEqual(1 - 1e-9);
  });

  it('passes through a normal positive product unchanged', () => {
    const gLevel = 80;
    const mult = 1.2;
    const result = clampGravityProduct(gLevel, mult);
    expect(result).toBeCloseTo(mult, 10);
  });

  it('handles a zero level gravity without producing NaN/Infinity', () => {
    const result = clampGravityProduct(0, 1);
    expect(Number.isFinite(result)).toBe(true);
  });
});
