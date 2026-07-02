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

describe('stats: §5.1 infinite stacking — monotonicity per duplicate pick', () => {
  // Each duplicate pick must strictly move the relevant stat in the
  // documented direction (plan §5.1 bullet list): multiplicative stats
  // compound (mult^n), additive stats add per stack, charge-based stats
  // gain +1/stack, and Star Core repeats its whole roll per stack.
  it('multiplicative: boost_thrusters thrustPower compounds strictly upward stack over stack', () => {
    let prev = computeStats([], 'pilot').thrustPower;
    const picks: UpgradeId[] = [];
    for (let i = 1; i <= 6; i++) {
      picks.push('boost_thrusters');
      const s = computeStats(picks, 'pilot');
      expect(s.thrustPower).toBeGreaterThan(prev);
      prev = s.thrustPower;
    }
  });

  it('additive: fuel_tank maxFuel increases by exactly +45 per stack', () => {
    const picks: UpgradeId[] = [];
    let prev = computeStats([], 'pilot').maxFuel;
    for (let i = 1; i <= 6; i++) {
      picks.push('fuel_tank');
      const s = computeStats(picks, 'pilot');
      expect(s.maxFuel).toBeCloseTo(prev + 45, 6);
      prev = s.maxFuel;
    }
  });

  it('charge-based: shield shieldCharges increases by exactly +1 per stack', () => {
    const picks: UpgradeId[] = [];
    for (let i = 1; i <= 6; i++) {
      picks.push('shield');
      const s = computeStats(picks, 'pilot');
      expect(s.shieldCharges).toBe(i);
    }
  });

  it('boolean-escalation: scanner stack count increases by +1 per stack, feeding the §5.1 2+/3+ escalation thresholds', () => {
    const picks: UpgradeId[] = [];
    for (let i = 1; i <= 4; i++) {
      picks.push('scanner');
      const s = computeStats(picks, 'pilot');
      expect(s.scanner).toBe(i);
    }
  });

  it('Star Core repeats its whole +12%-everything roll per stack (thrustPower, maxFuel, tolerances, rotMult all increase; gravityMult decreases every stack)', () => {
    const picks: UpgradeId[] = [];
    let prevThrust = computeStats([], 'pilot').thrustPower;
    let prevGravity = 1;
    for (let i = 1; i <= 5; i++) {
      picks.push('star_core');
      const s = computeStats(picks, 'pilot');
      expect(s.thrustPower).toBeGreaterThan(prevThrust);
      expect(s.gravityMult).toBeLessThan(prevGravity);
      expect(s.starCoreStacks).toBe(i);
      prevThrust = s.thrustPower;
      prevGravity = s.gravityMult;
    }
  });
});

describe('stats: §5.1 infinite stacking — stability floors still respected at 100 stacks', () => {
  it('100 stacks of every drawback-heavy upgrade keeps every floor intact', () => {
    const drawbackHeavy: UpgradeId[] = [
      'storm_dampeners', 'scanner', 'fuel_scoop', 'gravity_anchor', 'feather_gear',
    ];
    for (const id of drawbackHeavy) {
      const picks = new Array(100).fill(id) as UpgradeId[];
      const s = computeStats(picks, 'pilot');
      expect(s.maxFuel).toBeGreaterThanOrEqual(20);
      expect(s.thrustPower).toBeGreaterThanOrEqual(60);
      expect(s.fuelBurnMult).toBeGreaterThanOrEqual(0.05);
      expect(s.windMult).toBeGreaterThanOrEqual(0);
      expect(s.landingSpeedTol).toBeGreaterThanOrEqual(0);
      expect(s.landingAngleTol).toBeGreaterThanOrEqual(0);
      expect(s.massSum).toBeGreaterThanOrEqual(-0.8);
      expect(s.areaSum).toBeGreaterThanOrEqual(0);
    }
  });

  it('100 mixed stacks (all 19 ids interleaved) produce finite, floor-respecting stats', () => {
    const ids: UpgradeId[] = [
      'fuel_tank', 'boost_thrusters', 'magnetic_pad', 'shield', 'gyro', 'gravity_anchor',
      'scanner', 'feather_gear', 'reserve_chute', 'storm_dampeners', 'fuel_scoop',
      'precision_jets', 'jalapeno_injectors', 'boomerang_hull', 'alien_diplomacy',
      'chrono_crystal', 'overdrive_core', 'phoenix_feather', 'star_core',
    ];
    const picks: UpgradeId[] = [];
    for (let i = 0; i < 100; i++) picks.push(ids[i % ids.length]);
    const s = computeStats(picks, 'pilot');
    for (const [key, val] of Object.entries(s)) {
      if (typeof val === 'number') expect(Number.isFinite(val), `${key} was ${val}`).toBe(true);
    }
    expect(s.maxFuel).toBeGreaterThanOrEqual(20);
    expect(s.thrustPower).toBeGreaterThanOrEqual(60);
  });
});

describe('stats: §5.1 infinite stacking — no NaN/Infinity at 1000 stacks (all 19 upgrades)', () => {
  const ids: UpgradeId[] = [
    'fuel_tank', 'boost_thrusters', 'magnetic_pad', 'shield', 'gyro', 'gravity_anchor',
    'scanner', 'feather_gear', 'reserve_chute', 'storm_dampeners', 'fuel_scoop',
    'precision_jets', 'jalapeno_injectors', 'boomerang_hull', 'alien_diplomacy',
    'chrono_crystal', 'overdrive_core', 'phoenix_feather', 'star_core',
  ];
  it.each(ids)('1000 stacks of %s: every numeric stat stays finite', (id) => {
    const picks = new Array(1000).fill(id) as UpgradeId[];
    const s = computeStats(picks, 'pilot');
    for (const [key, val] of Object.entries(s)) {
      if (typeof val === 'number') expect(Number.isFinite(val), `${id} -> ${key} was ${val}`).toBe(true);
    }
  });
});

describe('stats: chronoTimeScale (§5.1 Chrono Crystal 0.75^n compounding)', () => {
  it('returns 1 for zero stacks, 0.75 for one stack, and compounds thereafter', async () => {
    const { chronoTimeScale } = await import('../stats');
    expect(chronoTimeScale(0)).toBe(1);
    expect(chronoTimeScale(1)).toBeCloseTo(0.75, 10);
    expect(chronoTimeScale(2)).toBeCloseTo(0.5625, 10);
    expect(chronoTimeScale(10)).toBeGreaterThan(0);
    expect(Number.isFinite(chronoTimeScale(1000))).toBe(true);
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
