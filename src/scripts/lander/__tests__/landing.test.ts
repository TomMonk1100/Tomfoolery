import { describe, expect, it } from 'vitest';
import { evaluateLanding } from '../landing';

const base = { vx: 0, vy: 0, angle: 0, onPad: true, speedTolerance: 10, angleTolerance: 0.2 };

describe('evaluateLanding', () => {
  it('uses combined speed, separate approach components, and wrapped attitude', () => {
    expect(evaluateLanding({ ...base, vy: 9.9 }).safe).toBe(true);
    expect(evaluateLanding({ ...base, vy: 10 }).reason).toBe('vertical-speed');
    expect(evaluateLanding({ ...base, vx: 10 }).reason).toBe('horizontal-speed');
    expect(evaluateLanding({ ...base, vx: 8, vy: 8 }).reason).toBe('combined-speed');
    expect(evaluateLanding({ ...base, angle: Math.PI * 2 - 0.1 }).safe).toBe(true);
    expect(evaluateLanding({ ...base, angle: 0.2 }).reason).toBe('tilt');
  });

  it('requires a pad and evaluates moving-pad contact relatively', () => {
    expect(evaluateLanding({ ...base, onPad: false }).reason).toBe('off-pad');
    expect(evaluateLanding({ ...base, vx: 42, vy: 12, padVelocity: { vx: 42, vy: 12 } }).safe).toBe(true);
  });
});
