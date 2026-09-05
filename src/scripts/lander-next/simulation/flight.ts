import { SHIP_HALF_HEIGHT, type Difficulty } from '../content/balance';
import type { InputFrame, ShipState, WorldState } from '../core/state';
import { earliestTerrainContact } from './collision';
import { evaluateLanding } from './landing';
import { computeStats } from '../../lander/stats';
import type { UpgradeId } from '../content/upgrades';
import { effectiveArea, effectiveMass, gravityAccel, thrustAccel, windAccel, clampRotationDelta } from '../../lander/physics';

export interface FlightResult { kind: 'flying' | 'landed' | 'crashed'; cause?: string; quality?: 'soft' | 'great' | 'perfect'; }

export function stepFlight(world: WorldState, input: InputFrame, dt: number, difficulty: Difficulty, upgrades: readonly UpgradeId[] = []): FlightResult {
  const ship = world.ship;
  if (!ship.alive) return { kind: 'crashed', cause: 'ship is already down' };
  const beforeX = ship.x; const beforeY = ship.y;
  const stats = computeStats([...upgrades], difficulty);
  const mass = effectiveMass({ massSum: stats.massSum, areaSum: stats.areaSum });
  const area = effectiveArea({ massSum: stats.massSum, areaSum: stats.areaSum });
  const left = input.leftHeld ? 1 : 0; const right = input.rightHeld ? 1 : 0;
  const targetOmega = (right - left) * 2.6 * stats.rotMult;
  const response = targetOmega === 0 ? 24 : 18;
  ship.angularVelocity += (targetOmega - ship.angularVelocity) * (1 - Math.exp(-response * dt));
  ship.angle = normalizeAngle(ship.angle + clampRotationDelta(ship.angularVelocity * dt));
  ship.vy += gravityAccel(world.gravity, stats.gravityMult, mass) * dt;
  ship.vx += windAccel(world.wind, stats.windMult, area, mass) * dt;
  const throttleRate = input.thrust && ship.fuel > 0 ? 1 / 0.06 : -1 / 0.04;
  ship.throttle = Math.max(0, Math.min(1, ship.throttle + throttleRate * dt));
  ship.thrusting = ship.throttle > 0 && ship.fuel > 0;
  if (ship.thrusting) { const acceleration = thrustAccel(stats.thrustPower, mass) * ship.throttle; ship.vx += Math.sin(ship.angle) * acceleration * dt; ship.vy -= Math.cos(ship.angle) * acceleration * dt; ship.fuel = Math.max(0, ship.fuel - 22 * stats.fuelBurnMult * ship.throttle * dt); }
  ship.x += ship.vx * dt; ship.y += ship.vy * dt;
  if (ship.x < 22) { ship.x = 22; ship.vx = Math.max(0, ship.vx); }
  if (ship.x > world.width - 22) { ship.x = world.width - 22; ship.vx = Math.min(0, ship.vx); }
  world.time += dt;
  const contact = earliestTerrainContact(world.terrain, beforeX, beforeY, ship.x, ship.y, SHIP_HALF_HEIGHT);
  if (!contact.hit) return { kind: 'flying' };
  ship.x = contact.x; ship.y = contact.y;
  const onPad = ship.x >= world.terrain.pad.xStart && ship.x <= world.terrain.pad.xEnd;
  const landing = evaluateLanding(ship.vx, ship.vy, ship.angle, difficulty, world.terrain.pad.vx, stats.landingSpeedTol, stats.landingAngleTol, onPad);
  if (landing.landed) {
    ship.vx = 0; ship.vy = 0; return { kind: 'landed', quality: landing.quality ?? 'soft' };
  }
  ship.alive = false; world.landing = 'crash';
  return { kind: 'crashed', cause: landing.cause || 'missed the landing pad' };
}

function normalizeAngle(angle: number): number {
  let value = (angle + Math.PI) % (Math.PI * 2);
  if (value < 0) value += Math.PI * 2;
  return value - Math.PI;
}
