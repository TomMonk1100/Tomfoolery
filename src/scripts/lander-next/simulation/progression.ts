import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { UPGRADE_CATALOG } from '../content/upgrades';
import { DeterministicRng } from '../core/rng';

export function createOffer(state: GameState, rng: DeterministicRng): void {
  const available = UPGRADE_CATALOG.filter((upgrade) => !state.run.upgrades.includes(upgrade.id));
  const pool = available.length >= 3 ? available : UPGRADE_CATALOG;
  const offer: typeof state.offer = [];
  while (offer.length < 3 && offer.length < pool.length) {
    const next = rng.pick(pool).id;
    if (!offer.includes(next)) offer.push(next);
  }
  state.offer = offer;
}

export function resolveUpgrade(state: GameState, id: (typeof state.offer)[number]): boolean {
  if (state.session !== 'upgrade' || !state.offer.includes(id)) return false;
  state.run.upgrades.push(id);
  state.run.score += 100 * state.run.level;
  state.session = 'ready';
  state.run.level += 1;
  return true;
}

export function applyLandingReward(state: GameState, quality: 'soft' | 'great' | 'perfect', events: GameEvent[]): void {
  const reward = quality === 'perfect' ? 36 : quality === 'great' ? 24 : 16;
  state.run.stardust += reward; state.run.score += reward * 10; state.run.stats.landings += 1; state.run.stats.stardustEarned += reward; state.run.stats.bestLanding = quality;
  events.push({ type: 'touchdown', quality });
}
