import { DIFFICULTY, PILOT_ANGLE_TOLERANCE, PILOT_SPEED_TOLERANCE, type Difficulty } from '../content/balance';

export type LandingResult = { landed: boolean; quality: 'soft' | 'great' | 'perfect' | null; cause: string; speed: number; angle: number; };

export function evaluateLanding(vx: number, vy: number, angle: number, difficulty: Difficulty, relativePadVx = 0, speedTolerance = PILOT_SPEED_TOLERANCE, angleTolerance = PILOT_ANGLE_TOLERANCE): LandingResult {
  const speed = Math.hypot(vx - relativePadVx, vy);
  const normalizedAngle = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
  const tuning = DIFFICULTY[difficulty];
  const maxSpeed = speedTolerance * tuning.landingSpeed;
  const maxAngle = angleTolerance * tuning.landingAngle;
  if (speed > maxSpeed) return { landed: false, quality: null, cause: `too fast (${Math.round(speed)} u/s)`, speed, angle: normalizedAngle };
  if (normalizedAngle > maxAngle) return { landed: false, quality: null, cause: `attitude ${Math.round(normalizedAngle * 57.3)}°`, speed, angle: normalizedAngle };
  const quality = speed < maxSpeed * 0.24 && normalizedAngle < maxAngle * 0.28 ? 'perfect' : speed < maxSpeed * 0.58 ? 'great' : 'soft';
  return { landed: true, quality, cause: 'controlled touchdown', speed, angle: normalizedAngle };
}
