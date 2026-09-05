import { BASE_THRUST, SHIP_HALF_HEIGHT, type Difficulty } from '../content/balance';
import type { InputFrame, ShipState, WorldState } from '../core/state';
import { earliestTerrainContact } from './collision';
import { evaluateLanding } from './landing';
import { computeStats } from '../../lander/stats';
import type { UpgradeId } from '../content/upgrades';

export interface FlightResult { kind: 'flying' | 'landed' | 'crashed'; cause?: string; quality?: 'soft' | 'great' | 'perfect'; }

export function stepFlight(world: WorldState, input: InputFrame, dt: number, difficulty: Difficulty, upgrades: readonly UpgradeId[] = []): FlightResult {
  const ship = world.ship;
  if (!ship.alive) return { kind: 'crashed', cause: 'ship is already down' };
  const beforeX = ship.x; const beforeY = ship.y;
  const stats = computeStats([...upgrades], difficulty);
  const gravity = world.gravity * stats.gravityMult;
  ship.thrusting = input.thrust && ship.fuel > 0;
  const thrust = ship.thrusting ? stats.thrustPower / Math.max(0.45, stats.massSum + 1) : 0;
  ship.vx += world.wind * stats.windMult * dt;
  ship.vy += gravity * dt;
  if (ship.thrusting) { ship.vy -= thrust * Math.cos(ship.angle) * dt; ship.vx += thrust * Math.sin(ship.angle) * dt; ship.fuel = Math.max(0, ship.fuel - 16 * stats.fuelBurnMult * dt); }
  ship.angularVelocity += input.rotate * 3.4 * stats.rotMult * dt;
  ship.angularVelocity *= Math.pow(0.06, dt);
  ship.angle += ship.angularVelocity * dt;
  ship.x += ship.vx * dt; ship.y += ship.vy * dt;
  ship.x = Math.max(22, Math.min(978, ship.x));
  world.time += dt;
  const contact = earliestTerrainContact(world.terrain, beforeX, beforeY, ship.x, ship.y, SHIP_HALF_HEIGHT);
  if (!contact.hit) return { kind: 'flying' };
  ship.x = contact.x; ship.y = contact.y;
  const landing = evaluateLanding(ship.vx, ship.vy, ship.angle, difficulty, world.terrain.pad.vx, stats.landingSpeedTol, stats.landingAngleTol);
  if (ship.x >= world.terrain.pad.xStart && ship.x <= world.terrain.pad.xEnd && landing.landed) {
    ship.vx = 0; ship.vy = 0; return { kind: 'landed', quality: landing.quality ?? 'soft' };
  }
  ship.alive = false; world.landing = 'crash';
  return { kind: 'crashed', cause: landing.cause || 'missed the landing pad' };
}
