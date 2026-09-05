import { describe, expect, it } from 'vitest';
import { earliestTerrainContact, segmentCircleHit } from '../simulation/collision';

describe('lander-next collision', () => {
  it('finds the earliest contact over a narrow ridge inside one tick', () => {
    const terrain = { points: [{ x: 0, y: 500 }, { x: 480, y: 500 }, { x: 500, y: 330 }, { x: 520, y: 500 }, { x: 1000, y: 500 }], pad: { xStart: 700, xEnd: 800, y: 500, vx: 0, baseX: 750, range: 0 } };
    const hit = earliestTerrainContact(terrain, 450, 250, 550, 520, 18);
    expect(hit.hit).toBe(true); expect(hit.x).toBeLessThan(500); expect(hit.t).toBeLessThan(0.5);
  });
  it('detects a projectile that crosses the ship between frames', () => { expect(segmentCircleHit(0, 0, 100, 0, 50, 0, 4)).toBe(true); expect(segmentCircleHit(0, 0, 100, 0, 50, 10, 4)).toBe(false); });
});
