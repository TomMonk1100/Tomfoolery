import { describe, it, expect } from 'vitest';
import {
  createNoodlePile, updateNoodles, compactNoodles, decayNoodlePile,
  checkNoodleSquish, applyNoodleSquish, makeNoodle, noodleCapFor,
  NOODLE_BASE_CAP, NOODLE_CAP_PER_STACK, NOODLE_SQUISH_THRESHOLD, NOODLE_DEPOSIT_PER_HIT,
} from '../noodles';
import { terraform, buildDronePool, updateDrones, droneOrbitRadius, MAX_DRONES, shouldRebuild, REBUILD_INTERVAL_S } from '../entities';
import { terrainYAt, generateTerrain, levelConfigFor } from '../levels';
import { resolveReadyAbility, tickAbilityCooldowns, consumeAbilityCharge, ABILITY_PRIORITY } from '../abilities';
import type { AbilityDef, TerrainPoint } from '../types';

// ---------------------------------------------------------------------------
// §6.1 Noodle piles — deposit/decay math is bounded.
// ---------------------------------------------------------------------------
describe('noodles: pile deposit math is bounded by the per-segment cap', () => {
  it('noodleCapFor(0) equals the base cap; each stack adds NOODLE_CAP_PER_STACK', () => {
    expect(noodleCapFor(0)).toBe(NOODLE_BASE_CAP);
    expect(noodleCapFor(1)).toBe(NOODLE_BASE_CAP + NOODLE_CAP_PER_STACK);
    expect(noodleCapFor(3)).toBe(NOODLE_BASE_CAP + NOODLE_CAP_PER_STACK * 3);
  });

  it('never allows pile height to exceed the stack-aware cap, however many noodles land', () => {
    const cfg = levelConfigFor(2, 'pilot');
    const terrain = generateTerrain(cfg, 800, 480);
    const pile = createNoodlePile(terrain.points.length);
    const stacks = 2;
    const cap = noodleCapFor(stacks);
    // Drop far more noodles than needed to saturate one segment.
    const targetX = terrain.points[5].x;
    const noodles = Array.from({ length: 200 }, () => makeNoodle(targetX, terrain.points[5].y - 1, 0, 500, 10));
    updateNoodles(noodles, pile, terrain.points, terrainYAt, 1 / 30, stacks);
    for (let i = 0; i < pile.length; i++) {
      expect(pile[i]).toBeLessThanOrEqual(cap);
      expect(pile[i]).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(pile[i])).toBe(true);
    }
  });

  it('pile height is never negative after repeated decay', () => {
    const pile = createNoodlePile(10);
    pile[3] = 5;
    for (let i = 0; i < 100; i++) decayNoodlePile(pile, 1 / 30);
    for (let i = 0; i < pile.length; i++) {
      expect(pile[i]).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(pile[i])).toBe(true);
    }
  });

  it('decay reduces height by DECAY_PER_SEC * dt per tick, floored at 0', () => {
    const pile = createNoodlePile(4);
    pile[0] = 1;
    decayNoodlePile(pile, 1); // 0.8px/s * 1s = 0.8px
    expect(pile[0]).toBeCloseTo(0.2, 5);
    decayNoodlePile(pile, 1); // would go negative — must floor at 0
    expect(pile[0]).toBe(0);
  });

  it('a single noodle deposit adds exactly NOODLE_DEPOSIT_PER_HIT to its segment (below cap)', () => {
    const cfg = levelConfigFor(2, 'pilot');
    const terrain = generateTerrain(cfg, 800, 480);
    const pile = createNoodlePile(terrain.points.length);
    const targetX = terrain.points[7].x;
    const noodles = [makeNoodle(targetX, terrain.points[7].y - 1, 0, 500, 10)];
    updateNoodles(noodles, pile, terrain.points, terrainYAt, 1 / 30, 0);
    const total = Array.from(pile).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(NOODLE_DEPOSIT_PER_HIT, 5);
  });

  it('checkNoodleSquish reports squish only at/above the threshold and applyNoodleSquish depletes without going negative', () => {
    const points: TerrainPoint[] = [{ x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: 100 }];
    const pile = createNoodlePile(points.length);
    pile[1] = NOODLE_SQUISH_THRESHOLD - 1;
    let result = checkNoodleSquish(pile, points, 10);
    expect(result.squish).toBe(false);

    pile[1] = NOODLE_SQUISH_THRESHOLD;
    result = checkNoodleSquish(pile, points, 10);
    expect(result.squish).toBe(true);
    applyNoodleSquish(pile, result);
    expect(pile[1]).toBeGreaterThanOrEqual(0);
    expect(pile[1]).toBeLessThan(NOODLE_SQUISH_THRESHOLD);

    // Depleting a small pile below the deplete amount floors at 0, not negative.
    pile[1] = 2;
    const smallResult = { squish: true, segmentIndex: 1, newHeight: Math.max(0, pile[1] - 10) };
    applyNoodleSquish(pile, smallResult);
    expect(pile[1]).toBe(0);
  });

  it('noodles are compacted (removed) once dead, regardless of how they died', () => {
    const n1 = makeNoodle(0, 0, 0, 0, 0.001);
    const n2 = makeNoodle(0, 0, 0, 0, 10);
    n1.alive = false;
    const list = compactNoodles([n1, n2]);
    expect(list).toHaveLength(1);
    expect(list[0]).toBe(n2);
  });
});

// ---------------------------------------------------------------------------
// §6.4 terraform() — smooths without NaN/exploding values.
// ---------------------------------------------------------------------------
describe('entities: terraform() smooths terrain without NaN or explosion', () => {
  it('relaxes a spike toward its local average within radius', () => {
    const points = [
      { x: 0, y: 100 }, { x: 10, y: 100 }, { x: 20, y: -500 }, { x: 30, y: 100 }, { x: 40, y: 100 },
    ];
    terraform(points, 20, 25, 1);
    // The spike at x=20 should move toward the local average, not stay at -500.
    expect(points[2].y).toBeGreaterThan(-500);
    for (const p of points) expect(Number.isFinite(p.y)).toBe(true);
  });

  it('never produces NaN/Infinity across repeated applications', () => {
    const points = Array.from({ length: 40 }, (_, i) => ({ x: i * 10, y: Math.sin(i) * 1000 }));
    for (let i = 0; i < 50; i++) {
      terraform(points, (i * 7) % 400, 40, 0.5);
    }
    for (const p of points) {
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Number.isNaN(p.y)).toBe(false);
    }
  });

  it('is a no-op for radius<=0, strength<=0, or empty points (guards, no crash)', () => {
    const points = [{ x: 0, y: 5 }, { x: 10, y: 5 }];
    const before = JSON.parse(JSON.stringify(points));
    terraform(points, 5, 0, 1);
    terraform(points, 5, 10, 0);
    terraform([], 5, 10, 1);
    expect(points).toEqual(before);
  });

  it('strength=1 moves affected points exactly to the local average', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 100 }, { x: 20, y: 0 }];
    terraform(points, 10, 15, 1);
    const avg = (0 + 100 + 0) / 3;
    for (const p of points) expect(p.y).toBeCloseTo(avg, 5);
  });

  it('shouldRebuild throttles to at most once per REBUILD_INTERVAL_S while dirty', () => {
    expect(shouldRebuild(true, 0.1, 0)).toBe(false);
    expect(shouldRebuild(true, REBUILD_INTERVAL_S, 0)).toBe(true);
    expect(shouldRebuild(false, 999, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// §6.3 Drones — pool never exceeds MAX_DRONES (12).
// ---------------------------------------------------------------------------
describe('entities: drone pool respects the 12-drone cap', () => {
  it('buildDronePool never returns more than MAX_DRONES entries, even when asked for more', () => {
    expect(MAX_DRONES).toBe(12);
    const pool = buildDronePool(999);
    expect(pool.length).toBeLessThanOrEqual(MAX_DRONES);
    expect(pool.length).toBe(MAX_DRONES);
  });

  it('buildDronePool(0) returns an empty pool; negative counts clamp to 0', () => {
    expect(buildDronePool(0)).toHaveLength(0);
    expect(buildDronePool(-5)).toHaveLength(0);
  });

  it('orbit radius grows by 8px per index, base 26px', () => {
    expect(droneOrbitRadius(0)).toBe(26);
    expect(droneOrbitRadius(1)).toBe(34);
    expect(droneOrbitRadius(11)).toBe(26 + 8 * 11);
  });

  it('updateDrones advances angle by dt * speed and never mutates dead drones', () => {
    const pool = buildDronePool(3);
    const before = pool.map((d) => d.angle);
    updateDrones(pool, 1);
    pool.forEach((d, i) => expect(d.angle).toBeCloseTo(before[i] + d.speed, 10));

    pool[0].alive = false;
    const frozenAngle = pool[0].angle;
    updateDrones(pool, 5);
    expect(pool[0].angle).toBe(frozenAngle);
  });
});

// ---------------------------------------------------------------------------
// §6.2 Active-ability priority resolver.
// ---------------------------------------------------------------------------
describe('abilities: priority resolver picks the correct highest-priority ready entry', () => {
  function def(id: AbilityDef['id'], charges: number): AbilityDef {
    return { id, charges, maxCharges: 1, cooldown: 0, maxCooldown: 8 };
  }

  it('returns null when no abilities are owned', () => {
    expect(resolveReadyAbility([])).toBeNull();
  });

  it('returns null when owned abilities exist but none have charge', () => {
    const owned = [def('wormhole_pocket', 0), def('time_bank', 0)];
    expect(resolveReadyAbility(owned)).toBeNull();
  });

  it('picks the highest-priority ready ability, skipping unready higher-priority ones', () => {
    // Priority order: valkyrie_autopilot > wormhole_pocket > time_bank >
    // singularity_anchor > grappling_hook. Valkyrie is owned but not ready;
    // wormhole_pocket is owned and ready — it should win even though
    // time_bank/grappling_hook are also ready (lower priority).
    const owned = [
      def('valkyrie_autopilot', 0),
      def('wormhole_pocket', 2),
      def('time_bank', 1),
      def('grappling_hook', 1),
    ];
    const resolved = resolveReadyAbility(owned);
    expect(resolved?.id).toBe('wormhole_pocket');
  });

  it('picks valkyrie_autopilot when it is ready, regardless of what else is owned/ready', () => {
    const owned = [
      def('grappling_hook', 1),
      def('singularity_anchor', 1),
      def('valkyrie_autopilot', 1),
    ];
    const resolved = resolveReadyAbility(owned);
    expect(resolved?.id).toBe('valkyrie_autopilot');
  });

  it('falls through to a lower-priority ability not present at all in the owned set', () => {
    // grappling_hook is last in ABILITY_PRIORITY; if it's the only owned+ready one, it wins.
    const owned = [def('grappling_hook', 3)];
    expect(resolveReadyAbility(owned)?.id).toBe('grappling_hook');
  });

  it('ABILITY_PRIORITY matches the exact plan order', () => {
    expect(ABILITY_PRIORITY).toEqual([
      'valkyrie_autopilot', 'wormhole_pocket', 'time_bank', 'singularity_anchor', 'grappling_hook',
    ]);
  });

  it('consumeAbilityCharge decrements charges and starts cooldown; tickAbilityCooldowns regenerates over time', () => {
    const d = def('time_bank', 1);
    consumeAbilityCharge(d);
    expect(d.charges).toBe(0);
    expect(d.cooldown).toBe(d.maxCooldown);
    // Ticking less than the full cooldown shouldn't regenerate yet.
    tickAbilityCooldowns([d], d.maxCooldown - 1);
    expect(d.charges).toBe(0);
    // Finishing the cooldown regenerates exactly one charge.
    tickAbilityCooldowns([d], 1);
    expect(d.charges).toBe(1);
  });

  it('consumeAbilityCharge on an already-depleted ability is a no-op (never goes negative)', () => {
    const d = def('grappling_hook', 0);
    consumeAbilityCharge(d);
    expect(d.charges).toBe(0);
  });
});
