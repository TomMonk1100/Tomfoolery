import { describe, expect, it } from 'vitest';
import { evaluateLanding } from '../simulation/landing';

describe('lander-next landing authority', () => {
  it('classifies quality and moving-pad relative velocity', () => { expect(evaluateLanding(0, 8, 0, 'pilot', 0).quality).toBe('perfect'); expect(evaluateLanding(22, 22, 0, 'pilot', 14).landed).toBe(true); expect(evaluateLanding(70, 0, 0, 'pilot', 0).cause).toContain('too fast'); });
  it('normalizes wrapped angles', () => { expect(evaluateLanding(0, 12, Math.PI * 2 - 0.1, 'pilot').landed).toBe(true); expect(evaluateLanding(0, 12, Math.PI / 2, 'pilot').landed).toBe(false); });
});
