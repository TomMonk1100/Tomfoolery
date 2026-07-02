import { describe, it, expect } from 'vitest';
import { generateTerrain, terrainYAt, levelConfigFor } from '../levels';

describe('levels: terrain determinism per seed (§9.3c)', () => {
  it('generateTerrain produces identical points for the same level config + dims', () => {
    const cfg = levelConfigFor(9, 'pilot');
    const a = generateTerrain(cfg, 900, 500);
    const b = generateTerrain(cfg, 900, 500);
    expect(a.points).toEqual(b.points);
    expect(a.ridge).toEqual(b.ridge);
    expect(a.pad).toEqual(b.pad);
  });

  it('different level indices (different seeds) produce different terrain', () => {
    const cfgA = levelConfigFor(2, 'pilot');
    const cfgB = levelConfigFor(3, 'pilot');
    const a = generateTerrain(cfgA, 900, 500);
    const b = generateTerrain(cfgB, 900, 500);
    expect(a.points).not.toEqual(b.points);
  });

  it('levelConfigFor is a pure deterministic function of (idx, difficulty)', () => {
    const a = levelConfigFor(11, 'ace');
    const b = levelConfigFor(11, 'ace');
    expect(a).toEqual(b);
  });

  it('terrainYAt interpolates deterministically along the generated polyline', () => {
    const cfg = levelConfigFor(4, 'cadet');
    const terrain = generateTerrain(cfg, 800, 480);
    const y1 = terrainYAt(terrain.points, 123.4);
    const y2 = terrainYAt(terrain.points, 123.4);
    expect(y1).toBe(y2);
    expect(Number.isFinite(y1)).toBe(true);
  });

  it('terrainYAt never returns NaN across the full width for many seeds', () => {
    for (let idx = 0; idx < 40; idx++) {
      const cfg = levelConfigFor(idx, 'pilot');
      const terrain = generateTerrain(cfg, 700, 420);
      for (let x = 0; x <= 700; x += 25) {
        const y = terrainYAt(terrain.points, x);
        expect(Number.isFinite(y)).toBe(true);
      }
    }
  });
});
