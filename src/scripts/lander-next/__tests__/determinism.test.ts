import { describe, expect, it } from 'vitest';
import { createRngStreams } from '../core/rng';
import { generateLevel, validateLevel } from '../content/generation';
import { createGameState } from '../core/session';
import { createOffer } from '../simulation/progression';

describe('lander-next deterministic domain', () => {
  it('generates the same level and offer for the same seed', () => {
    const a = createRngStreams(4217); const b = createRngStreams(4217);
    expect(generateLevel(10, 'pilot', a.generation)).toEqual(generateLevel(10, 'pilot', b.generation));
    const first = createGameState(4217); const second = createGameState(4217); createOffer(first, a.offers); createOffer(second, b.offers); expect(first.offer).toEqual(second.offer);
  });
  it('validates a sample of generated levels without changing gameplay RNG', () => {
    for (let seed = 0; seed < 100; seed += 1) { const level = generateLevel(1 + seed % 20, 'pilot', createRngStreams(seed).generation); expect(validateLevel(level)).toEqual([]); }
  });
});
