import { terrainAt } from '../content/generation';
import type { TerrainState } from '../core/state';

export interface SweepContact { hit: boolean; t: number; x: number; y: number; }

function penetrating(terrain: TerrainState, x: number, y: number, halfHeight: number): boolean {
  return y + halfHeight >= terrainAt(terrain.points, x);
}

export function earliestTerrainContact(terrain: TerrainState, x0: number, y0: number, x1: number, y1: number, halfHeight: number): SweepContact {
  if (penetrating(terrain, x0, y0, halfHeight)) return { hit: true, t: 0, x: x0, y: y0 };
  const samples = 32;
  let previousT = 0;
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    const x = x0 + (x1 - x0) * t; const y = y0 + (y1 - y0) * t;
    if (penetrating(terrain, x, y, halfHeight)) {
      let lo = previousT; let hi = t;
      for (let j = 0; j < 12; j += 1) {
        const mid = (lo + hi) / 2;
        const mx = x0 + (x1 - x0) * mid; const my = y0 + (y1 - y0) * mid;
        if (penetrating(terrain, mx, my, halfHeight)) hi = mid; else lo = mid;
      }
      return { hit: true, t: hi, x: x0 + (x1 - x0) * hi, y: y0 + (y1 - y0) * hi };
    }
    previousT = t;
  }
  return { hit: false, t: 1, x: x1, y: y1 };
}

export function segmentCircleHit(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number, radius: number): boolean {
  const dx = x1 - x0; const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / lenSq));
  const px = x0 + dx * t; const py = y0 + dy * t;
  return Math.hypot(px - cx, py - cy) <= radius;
}
