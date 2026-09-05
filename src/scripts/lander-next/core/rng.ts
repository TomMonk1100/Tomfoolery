export type GameplayStream = 'generation' | 'offers' | 'combat' | 'upgradeRolls' | 'decoration';

function hashSeed(seed: number, label: string): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < label.length; i += 1) h = Math.imul(h ^ label.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

export interface RngState { seed: number; cursor: number; }

export class DeterministicRng {
  private state: RngState;
  constructor(seed: number) { this.state = { seed: seed >>> 0, cursor: 0 }; }
  next(): number {
    this.state.cursor = (this.state.cursor + 1) >>> 0;
    let t = (this.state.seed + Math.imul(this.state.cursor, 0x6d2b79f5)) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1) >>> 0;
    t ^= (t + Math.imul(t ^ (t >>> 7), t | 61)) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(min: number, max: number): number { return Math.floor(this.next() * (max - min + 1)) + min; }
  pick<T>(items: readonly T[]): T { return items[Math.min(items.length - 1, Math.floor(this.next() * items.length))]; }
  snapshot(): RngState { return { ...this.state }; }
  restore(state: RngState): void { this.state = { ...state }; }
}

export interface RngStreams { [key: string]: RngState; }

export function createRngStreams(seed: number): Record<GameplayStream, DeterministicRng> {
  return {
    generation: new DeterministicRng(hashSeed(seed, 'generation')),
    offers: new DeterministicRng(hashSeed(seed, 'offers')),
    combat: new DeterministicRng(hashSeed(seed, 'combat')),
    upgradeRolls: new DeterministicRng(hashSeed(seed, 'upgradeRolls')),
    decoration: new DeterministicRng(hashSeed(seed, 'decoration')),
  };
}

export function snapshotStreams(streams: Record<GameplayStream, DeterministicRng>): RngStreams {
  return Object.fromEntries(Object.entries(streams).map(([key, rng]) => [key, rng.snapshot()]));
}
