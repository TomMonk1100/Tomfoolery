import { BASE_GRAVITY, BASE_WIND, DIFFICULTY, WORLD_HEIGHT, WORLD_WIDTH, type Difficulty } from './balance';
import { DeterministicRng } from '../core/rng';
import type { HazardState, TerrainState } from '../core/state';

export interface GeneratedLevel { terrain: TerrainState; hazards: HazardState[]; gravity: number; wind: number; }

export function terrainAt(points: readonly { x: number; y: number }[], x: number): number {
  if (x <= points[0].x) return points[0].y;
  if (x >= points[points.length - 1].x) return points[points.length - 1].y;
  for (let i = 1; i < points.length; i += 1) {
    if (x <= points[i].x) {
      const a = points[i - 1]; const b = points[i];
      const t = (x - a.x) / (b.x - a.x);
      return a.y + (b.y - a.y) * t;
    }
  }
  return WORLD_HEIGHT - 80;
}

export function generateLevel(level: number, difficulty: Difficulty, rng: DeterministicRng, dimensions = { width: WORLD_WIDTH, height: WORLD_HEIGHT }): GeneratedLevel {
  const worldWidth = dimensions.width; const worldHeight = dimensions.height;
  const segments = 24;
  const padWidth = Math.max(worldWidth * 0.18, Math.min(worldWidth * 0.3, 148 - Math.min(38, level * 1.2)));
  const padX = worldWidth * 0.7 + rng.int(-Math.floor(worldWidth * 0.1), Math.floor(worldWidth * 0.1));
  const points = [{ x: 0, y: worldHeight - 62 }];
  let y = worldHeight - 82;
  for (let i = 1; i <= segments; i += 1) {
    const x = (worldWidth / segments) * i;
    const wave = Math.sin(i * 0.85 + level * 0.23) * (level < 4 ? 12 : 25);
    y = Math.max(worldHeight - 180, Math.min(worldHeight - 42, y + rng.int(-16, 16) + wave * 0.24));
    if (x > padX - padWidth && x < padX + padWidth) y = worldHeight - 82;
    points.push({ x, y });
  }
  const padY = terrainAt(points, padX);
  const hazardCount = Math.min(5, Math.floor(level / 3));
  const hazards: HazardState[] = [];
  for (let i = 0; i < hazardCount; i += 1) {
    const x = rng.int(Math.floor(worldWidth * 0.18), Math.floor(worldWidth * 0.88)); const yHazard = rng.int(110, Math.max(150, Math.floor(padY - 120)));
    hazards.push({ id: i, x, y: yHazard, vx: rng.int(-24, 24), vy: rng.int(-8, 8), radius: 12 + rng.int(0, 7), alive: true });
  }
  const mod = DIFFICULTY[difficulty];
  return {
    terrain: { points, pad: { xStart: padX - padWidth / 2, xEnd: padX + padWidth / 2, y: padY, vx: level > 3 ? 14 : 0, baseX: padX, range: level > 3 ? 60 : 0 } },
    hazards,
    gravity: BASE_GRAVITY * mod.gravity * (1 + Math.min(0.7, level * 0.018)),
    wind: BASE_WIND * mod.wind * (1 + Math.min(1.5, level * 0.03)),
  };
}

export function validateLevel(level: GeneratedLevel): string[] {
  const errors: string[] = [];
  const { points, pad } = level.terrain;
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) errors.push('terrain contains non-finite geometry');
  if (pad.xStart < 0 || pad.xEnd > WORLD_WIDTH || pad.xEnd <= pad.xStart) errors.push('pad outside world bounds');
  if (Math.abs(terrainAt(points, (pad.xStart + pad.xEnd) / 2) - pad.y) > 0.01) errors.push('pad is not seated on terrain');
  if (level.hazards.some((hazard) => hazard.y + hazard.radius >= terrainAt(points, hazard.x))) errors.push('hazard intersects terrain');
  return errors;
}
