/**
 * PlayerState helpers — pure, unit-testable, no Phaser.
 * Shared by DraftSystem (applies cards) and WorldScene (reads stat bonuses).
 */
import {
  PlayerState,
  CardData,
  makeRunStats,
  ActiveCard,
} from "./types";

export function createPlayerState(
  animalId: string,
  instinctMode = false,
  maxHp = 100
): PlayerState {
  return {
    animalId,
    level: 1,
    xp: 0,
    luck: 0,
    instinctMode,
    activeCards: [],
    hp: maxHp,
    maxHp,
    hunger: 80,
    carriedFood: 0,
    activeWeapons: [],
    activePassives: [],
    stats: makeRunStats(),
  };
}

/** Add a drafted card to the player, stacking if allowed. Returns the ActiveCard. */
export function applyCard(
  player: PlayerState,
  card: CardData
): ActiveCard {
  let entry = player.activeCards.find((c) => c.cardId === card.id);
  if (entry && card.stacking) {
    entry.stacks += 1;
  } else if (!entry) {
    entry = {
      cardId: card.id,
      stacks: 1,
      draftOrder: player.activeCards.length,
    };
    player.activeCards.push(entry);
  }
  player.stats.cardsDrafted += 1;
  if (!player.stats.perCardStats[card.id]) {
    player.stats.perCardStats[card.id] = { valueDelivered: 0, costIncurred: 0 };
  }
  if (card.effect.type === "luck") {
    player.luck += card.effect.magnitude; // stacks add
  }
  if (card.tradeoff.type === "luck") {
    player.luck += card.tradeoff.magnitude; // negative
  }
  return entry;
}

/**
 * Net percent bonus for a stat type across all active cards (effects add,
 * tradeoffs subtract), scaled by stacks.
 */
export function statBonus(
  player: PlayerState,
  cards: CardData[],
  statType: string
): number {
  const byId = new Map(cards.map((c) => [c.id, c]));
  let total = 0;
  for (const ac of player.activeCards) {
    const card = byId.get(ac.cardId);
    if (!card) continue;
    if (card.effect.type === statType) total += card.effect.magnitude * ac.stacks;
    if (card.tradeoff.type === statType)
      total += card.tradeoff.magnitude * ac.stacks;
  }
  return total;
}

/** Log positive value / negative cost against a card's per-card stats. */
export function logCardValue(
  player: PlayerState,
  cardId: string,
  value: number,
  cost: number
): void {
  const rec =
    player.stats.perCardStats[cardId] ??
    (player.stats.perCardStats[cardId] = {
      valueDelivered: 0,
      costIncurred: 0,
    });
  rec.valueDelivered += value;
  rec.costIncurred += cost;
}
