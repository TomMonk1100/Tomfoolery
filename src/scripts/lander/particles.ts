import type { Particle } from './types';

export function makeParticle(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, gravity = 30): Particle {
  return { x, y, vx, vy, life, maxLife: life, color, size, gravity };
}
