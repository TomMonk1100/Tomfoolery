import { createRngStreams } from '../core/rng';
import type { GameEvent } from '../core/events';
import type { GameState, InputFrame } from '../core/state';
import { stepFlight } from './flight';
import { applyLandingReward, createOffer } from './progression';
import { segmentCircleHit } from './collision';

export const NO_INPUT: InputFrame = { rotate: 0, leftHeld: false, rightHeld: false, thrust: false, abilityPressed: false, bothTurnHeld: false, kickLeftPressed: false, kickRightPressed: false };

export function stepSimulation(state: GameState, input: InputFrame, dt: number, events: GameEvent[]): void {
  if (state.session !== 'flying') return;
  const pad = state.world.terrain.pad;
  if (pad.range > 0) { const center = pad.baseX + Math.sin((state.world.time + dt) * 0.7) * pad.range; const halfWidth = (pad.xEnd - pad.xStart) / 2; pad.xStart = center - halfWidth; pad.xEnd = center + halfWidth; pad.vx = Math.cos((state.world.time + dt) * 0.7) * pad.range * 0.7; }
  for (const hazard of state.world.hazards) { if (!hazard.alive) continue; hazard.x += hazard.vx * dt; hazard.y += hazard.vy * dt; if (hazard.x < hazard.radius || hazard.x > state.world.width - hazard.radius) { hazard.x = Math.max(hazard.radius, Math.min(state.world.width - hazard.radius, hazard.x)); hazard.vx *= -1; } if (hazard.y < 70 || hazard.y > state.world.height * 0.62) { hazard.y = Math.max(70, Math.min(state.world.height * 0.62, hazard.y)); hazard.vy *= -1; } }
  state.previousShip = { ...state.world.ship };
  const result = stepFlight(state.world, input, dt, state.run.difficulty, state.run.upgrades);
  if (result.kind === 'flying' && state.world.hazards.some((hazard) => hazard.alive && segmentCircleHit(state.previousShip.x, state.previousShip.y, state.world.ship.x, state.world.ship.y, hazard.x, hazard.y, hazard.radius + 16))) { state.session = 'crashed'; state.world.ship.alive = false; state.world.landing = 'crash'; state.world.message = 'A drifting hazard found the ship.'; state.run.stats.crashes += 1; events.push({ type: 'crash', cause: state.world.message }); return; }
  if (result.kind === 'landed') {
    state.session = 'landed'; state.world.landing = result.quality === 'perfect' ? 'great' : 'good'; state.world.message = 'A clean touchdown.';
    applyLandingReward(state, result.quality ?? 'soft', events);
    createOffer(state, createRngStreams(state.run.seed + state.run.level).offers); state.session = 'upgrade'; events.push({ type: 'upgrade-offer' });
  } else if (result.kind === 'crashed') {
    state.session = 'crashed'; state.run.stats.crashes += 1; state.world.message = result.cause ?? 'Impact with the moon.'; events.push({ type: 'crash', cause: state.world.message });
  }
}
