import { createRngStreams } from '../core/rng';
import type { GameEvent } from '../core/events';
import type { GameState, InputFrame } from '../core/state';
import { stepFlight } from './flight';
import { applyLandingReward, createOffer } from './progression';

export const NO_INPUT: InputFrame = { rotate: 0, thrust: false, abilityPressed: false, bothTurnHeld: false, kickLeftPressed: false, kickRightPressed: false };

export function stepSimulation(state: GameState, input: InputFrame, dt: number, events: GameEvent[]): void {
  if (state.session !== 'flying') return;
  state.previousShip = { ...state.world.ship };
  const result = stepFlight(state.world, input, dt, state.run.difficulty, state.run.upgrades);
  if (result.kind === 'landed') {
    state.session = 'landed'; state.world.landing = result.quality === 'perfect' ? 'great' : 'good'; state.world.message = 'A clean touchdown.';
    applyLandingReward(state, result.quality ?? 'soft', events);
    createOffer(state, createRngStreams(state.run.seed + state.run.level).offers); state.session = 'upgrade'; events.push({ type: 'upgrade-offer' });
  } else if (result.kind === 'crashed') {
    state.session = 'crashed'; state.run.stats.crashes += 1; state.world.message = result.cause ?? 'Impact with the moon.'; events.push({ type: 'crash', cause: state.world.message });
  }
}
