import { RULESET_VERSION, STARTING_FUEL, type Difficulty } from '../content/balance';
import { createRngStreams } from './rng';
import type { GameState, LayoutProfile } from './state';
import { generateLevel } from '../content/generation';
import { computeStats } from '../../lander/stats';

export function createGameState(seed: number, difficulty: Difficulty = 'pilot', profile: LayoutProfile = 'landscape'): GameState {
  const streams = createRngStreams(seed);
  const dimensions = profile === 'portrait' ? { width: 420, height: 640 } : { width: 1000, height: 620 };
  const level = generateLevel(1, difficulty, streams.generation, dimensions);
  const ship = { x: dimensions.width * 0.22, y: 110, vx: 0, vy: 0, angle: 0, angularVelocity: 0, throttle: 0, fuel: STARTING_FUEL, alive: true, thrusting: false };
  return {
    session: 'title',
    run: {
      seed,
      rulesetVersion: RULESET_VERSION,
      difficulty,
      profile,
      level: 1,
      upgrades: [],
      score: 0,
      stardust: 0,
      stats: { landings: 0, crashes: 0, stardustEarned: 0, bestLanding: null },
      rng: Object.fromEntries(Object.entries(streams).map(([key, rng]) => [key, rng.snapshot()])),
    },
    world: { width: dimensions.width, height: dimensions.height, terrain: level.terrain, ship, hazards: level.hazards, time: 0, wind: level.wind, gravity: level.gravity, landing: 'approach', message: 'Keep the ship upright. Touch down softly.' },
    previousShip: { ...ship }, offer: [], selectedCosmetic: { paint: 'cream', trail: 'dust', sky: 'first-light' }, reducedMotion: false,
  };
}

export function beginDescent(state: GameState): void {
  const dimensions = state.run.profile === 'portrait' ? { width: 420, height: 640 } : { width: 1000, height: 620 };
  const next = generateLevel(state.run.level, state.run.difficulty, createRngStreams(state.run.seed + state.run.level).generation, dimensions);
  state.world.terrain = next.terrain; state.world.hazards = next.hazards; state.world.gravity = next.gravity; state.world.wind = next.wind;
  const stats = computeStats([...state.run.upgrades], state.run.difficulty);
  state.world.width = dimensions.width; state.world.height = dimensions.height; state.world.ship = { x: dimensions.width * 0.22, y: 110, vx: 0, vy: 0, angle: 0, angularVelocity: 0, throttle: 0, fuel: stats.maxFuel || STARTING_FUEL, alive: true, thrusting: false }; state.previousShip = { ...state.world.ship }; state.world.landing = 'approach'; state.world.message = 'Approach the illuminated pad.'; state.session = 'flying';
}
