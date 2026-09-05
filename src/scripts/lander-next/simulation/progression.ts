import type { GameEvent } from '../core/events';
import type { GameState } from '../core/state';
import { UPGRADE_CATALOG } from '../content/upgrades';
import { DeterministicRng } from '../core/rng';
import { RARITY, computeStats } from '../../lander/stats';

export function createOffer(state: GameState, rng: DeterministicRng): void {
  const pool = UPGRADE_CATALOG;
  const owned = new Set(state.run.upgrades);
  const count = Math.max(3, Math.min(6, 3 + computeStats([...state.run.upgrades], state.run.difficulty).extraChoices));
  const offer: typeof state.offer = [];
  while (offer.length < count && offer.length < pool.length) {
    const total = pool.reduce((sum, upgrade) => sum + RARITY[upgrade.rarity].weight * (owned.has(upgrade.id) ? 0.75 : 1), 0);
    let roll = rng.next() * total;
    for (const upgrade of pool) {
      roll -= RARITY[upgrade.rarity].weight * (owned.has(upgrade.id) ? 0.75 : 1);
      if (roll <= 0) { if (!offer.includes(upgrade.id)) offer.push(upgrade.id); break; }
    }
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
