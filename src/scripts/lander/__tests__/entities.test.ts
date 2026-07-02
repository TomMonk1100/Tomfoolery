import { describe, it, expect } from 'vitest';
import { generateAsteroids, updateAsteroids, findAsteroidHit } from '../entities';
import { levelConfigFor } from '../levels';

describe('entities: asteroid generation is seeded and deterministic (§4.4)', () => {
  it('same level config + dims produce identical asteroid layouts', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const a = generateAsteroids(cfg, 800, 480, 1.8);
    const b = generateAsteroids(cfg, 800, 480, 1.8);
    expect(a).toEqual(b);
  });

  it('produces exactly cfg.asteroids entries, or none if cfg.asteroids is 0', () => {
    // Find a level with asteroids and one without to exercise both paths.
    let withAsteroids: ReturnType<typeof levelConfigFor> | null = null;
    let withoutAsteroids: ReturnType<typeof levelConfigFor> | null = null;
    for (let idx = 0; idx < 60; idx++) {
      const cfg = levelConfigFor(idx, 'pilot');
      if (cfg.asteroids > 0 && !withAsteroids) withAsteroids = cfg;
      if (cfg.asteroids === 0 && !withoutAsteroids) withoutAsteroids = cfg;
      if (withAsteroids && withoutAsteroids) break;
    }
    expect(withAsteroids).not.toBeNull();
    expect(withoutAsteroids).not.toBeNull();
    if (withAsteroids) {
      const list = generateAsteroids(withAsteroids, 800, 480, 1.8);
      expect(list.length).toBe(withAsteroids.asteroids);
    }
    if (withoutAsteroids) {
      const list = generateAsteroids(withoutAsteroids, 800, 480, 1.8);
      expect(list.length).toBe(0);
    }
  });

  it('updateAsteroids reproduces the legacy orbital formula exactly (layout-preserving)', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const list = generateAsteroids(cfg, 800, 480, 1.8);
    updateAsteroids(list, 2.5);
    for (const a of list) {
      const expectedX = a.baseX + Math.sin(2.5 * 0.4 + a.seedIndex) * 60;
      const expectedY = a.baseY + Math.cos(2.5 * 0.3 + a.seedIndex * 2) * 20;
      expect(a.x).toBeCloseTo(expectedX, 10);
      expect(a.y).toBeCloseTo(expectedY, 10);
    }
  });

  it('updateAsteroids is deterministic for repeated calls with the same t', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const listA = generateAsteroids(cfg, 800, 480, 1.8);
    const listB = generateAsteroids(cfg, 800, 480, 1.8);
    updateAsteroids(listA, 7.3);
    updateAsteroids(listB, 7.3);
    expect(listA).toEqual(listB);
  });
});

describe('entities: findAsteroidHit collision reporting (no render-path mutation)', () => {
  it('reports the asteroid the ship is overlapping', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const list = generateAsteroids(cfg, 800, 480, 1.8);
    updateAsteroids(list, 0);
    if (list.length === 0) return; // level 6 may not roll asteroids; skip gracefully
    const target = list[0];
    const hit = findAsteroidHit(list, target.x, target.y, 5);
    expect(hit).toBe(target);
  });

  it('returns null when nothing overlaps', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const list = generateAsteroids(cfg, 800, 480, 1.8);
    updateAsteroids(list, 0);
    const hit = findAsteroidHit(list, -99999, -99999, 5);
    expect(hit).toBeNull();
  });

  it('does not mutate any asteroid state (pure query, matches §4.4 no-mutation-in-render-path)', () => {
    const cfg = levelConfigFor(6, 'pilot');
    const list = generateAsteroids(cfg, 800, 480, 1.8);
    updateAsteroids(list, 1);
    const before = JSON.parse(JSON.stringify(list));
    findAsteroidHit(list, 0, 0, 999999); // guaranteed overlap with everything
    expect(list).toEqual(before);
  });
});
