import { PILOT_ANGLE_TOLERANCE, PILOT_SPEED_TOLERANCE, type Difficulty } from '../content/balance';
import { evaluateLanding as evaluateLegacyLanding } from '../../lander/landing';

export type LandingResult = { landed: boolean; quality: 'soft' | 'great' | 'perfect' | null; cause: string; speed: number; angle: number; };

export function evaluateLanding(vx: number, vy: number, angle: number, _difficulty: Difficulty, relativePadVx = 0, speedTolerance = PILOT_SPEED_TOLERANCE, angleTolerance = PILOT_ANGLE_TOLERANCE, onPad = true): LandingResult {
  const result = evaluateLegacyLanding({ vx, vy, angle, onPad, speedTolerance, angleTolerance, padVelocity: { vx: relativePadVx, vy: 0 } });
  const quality = result.safe ? result.totalSpeed < speedTolerance * 0.24 && result.angle < angleTolerance * 0.28 ? 'perfect' : result.totalSpeed < speedTolerance * 0.58 ? 'great' : 'soft' : null;
  const cause = result.safe ? 'controlled touchdown' : result.reason === 'off-pad' ? 'missed the landing pad' : result.reason === 'tilt' ? `attitude ${Math.round(result.angle * 57.3)}°` : `too fast (${Math.round(result.totalSpeed)} u/s)`;
  return { landed: result.safe, quality, cause, speed: result.totalSpeed, angle: result.angle };
}
