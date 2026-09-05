export type LandingReason = 'safe' | 'off-pad' | 'vertical-speed' | 'horizontal-speed' | 'combined-speed' | 'tilt' | 'hazard';

export interface LandingEvaluationInput {
  vx: number;
  vy: number;
  angle: number;
  onPad: boolean;
  speedTolerance: number;
  angleTolerance: number;
  padVelocity?: { vx: number; vy: number };
}

export interface LandingEvaluation {
  safe: boolean;
  reason: LandingReason;
  totalSpeed: number;
  verticalSpeed: number;
  horizontalSpeed: number;
  angle: number;
}

export function normalizedAngle(angle: number): number {
  let value = (angle + Math.PI) % (Math.PI * 2);
  if (value < 0) value += Math.PI * 2;
  return value - Math.PI;
}

/** Pure collision/HUD landing rule. Velocities are relative to a moving pad. */
export function evaluateLanding(input: LandingEvaluationInput): LandingEvaluation {
  const padVelocity = input.padVelocity ?? { vx: 0, vy: 0 };
  const vx = input.vx - padVelocity.vx;
  const vy = input.vy - padVelocity.vy;
  const horizontalSpeed = Math.abs(vx);
  const verticalSpeed = Math.abs(vy);
  const totalSpeed = Math.hypot(vx, vy);
  const angle = Math.abs(normalizedAngle(input.angle));
  if (!input.onPad) return { safe: false, reason: 'off-pad', totalSpeed, verticalSpeed, horizontalSpeed, angle };
  if (verticalSpeed >= input.speedTolerance) return { safe: false, reason: 'vertical-speed', totalSpeed, verticalSpeed, horizontalSpeed, angle };
  if (horizontalSpeed >= input.speedTolerance) return { safe: false, reason: 'horizontal-speed', totalSpeed, verticalSpeed, horizontalSpeed, angle };
  if (totalSpeed >= input.speedTolerance) return { safe: false, reason: 'combined-speed', totalSpeed, verticalSpeed, horizontalSpeed, angle };
  if (angle >= input.angleTolerance) return { safe: false, reason: 'tilt', totalSpeed, verticalSpeed, horizontalSpeed, angle };
  return { safe: true, reason: 'safe', totalSpeed, verticalSpeed, horizontalSpeed, angle };
}
