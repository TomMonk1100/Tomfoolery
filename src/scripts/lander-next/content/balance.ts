export const RULESET_VERSION = 'lander-1.0-next';
export const WORLD_WIDTH = 1000;
export const WORLD_HEIGHT = 620;
export const FIXED_DT = 1 / 120;
export const MAX_FRAME_TIME = 0.05;
export const STARTING_FUEL = 100;
export const SHIP_RADIUS = 14;
export const SHIP_HALF_HEIGHT = 18;
export const BASE_THRUST = 158;
export const BASE_GRAVITY = 82;
export const BASE_WIND = 3;
export const PILOT_SPEED_TOLERANCE = 60;
export const PILOT_ANGLE_TOLERANCE = 0.28;

export type Difficulty = 'cadet' | 'pilot' | 'ace';

export const DIFFICULTY = {
  cadet: { gravity: 0.82, wind: 0.68, landingSpeed: 1.2, landingAngle: 1.16 },
  pilot: { gravity: 1, wind: 1, landingSpeed: 1, landingAngle: 1 },
  ace: { gravity: 1.18, wind: 1.32, landingSpeed: 0.82, landingAngle: 0.9 },
} as const;

export interface UpgradeModifiers {
  maxFuel: number;
  thrustPower: number;
  landingSpeedTol: number;
  landingAngleTol: number;
  gravityMult: number;
  windMult: number;
  fuelBurnMult: number;
  rotMult: number;
  shieldCharges: number;
}

export const DEFAULT_MODIFIERS: UpgradeModifiers = {
  maxFuel: STARTING_FUEL,
  thrustPower: BASE_THRUST,
  landingSpeedTol: PILOT_SPEED_TOLERANCE,
  landingAngleTol: PILOT_ANGLE_TOLERANCE,
  gravityMult: 1,
  windMult: 1,
  fuelBurnMult: 1,
  rotMult: 1,
  shieldCharges: 0,
};
