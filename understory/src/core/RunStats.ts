/**
 * RunStats — pure scoring & presentation helpers for run stats. No Phaser.
 * Consumed by LifeStoryScene (Screen 2 "Stats" and Screen 3 "Card Value
 * Breakdown" per GDD §5) and by the Sunseeds-award flow.
 */
import { PlayerState, RunStats, CardData } from "./types";

// ----------------------------------------------------------------------------
// Score & Sunseeds
// ----------------------------------------------------------------------------

/** Weighting constants for score composition — reasonable, tunable placeholders. */
const SCORE_WEIGHTS = {
  forage: 8, // per forage node harvested
  befriendSuccess: 40, // per successful befriend
  befriendAttempt: 5, // small credit for trying, even on failure
  evade: 15, // per successful evade
  season: 150, // per season fully completed
  distance: 0.5, // per meadow-length traveled
  xp: 1, // per total XP earned (already reflects instinct-mode multiplier)
};

/**
 * Derive a single Run Score from accumulated stats, per GDD §2.1 ("tallied
 * from foraging totals, Nests built, Bonds formed, distance migrated, and
 * Focus Actions landed cleanly"). Foraging/Social/Survival/Exploration/XP
 * are combined additively; every term is non-negative so Score never drops
 * below 0.
 */
export function scoreFromStats(player: PlayerState): number {
  const s = player.stats;
  const score =
    s.forageCount * SCORE_WEIGHTS.forage +
    s.befriendSuccesses * SCORE_WEIGHTS.befriendSuccess +
    Math.max(0, s.befriendAttempts - s.befriendSuccesses) *
      SCORE_WEIGHTS.befriendAttempt +
    s.evadeCount * SCORE_WEIGHTS.evade +
    s.seasonsCompleted * SCORE_WEIGHTS.season +
    s.distanceTraveled * SCORE_WEIGHTS.distance +
    s.totalXP * SCORE_WEIGHTS.xp;

  return Math.max(0, Math.round(score));
}

/** Sunseeds awarded = Score / 100, rounded down (GDD §2.1). */
export function sunseedsFromScore(score: number): number {
  return Math.floor(Math.max(0, score) / 100);
}

// ----------------------------------------------------------------------------
// Stats screen categories (Life Story Screen 2, GDD §5)
// ----------------------------------------------------------------------------

export interface StatCategory {
  category: string;
  rows: [string, number][];
}

/**
 * Group raw RunStats into the five Life Story categories. Values are
 * rounded for display; callers doing further math should read `stats`
 * directly instead.
 */
export function statCategories(stats: RunStats): StatCategory[] {
  const round1 = (n: number) => Math.round(n * 10) / 10;

  return [
    {
      category: "Foraging",
      rows: [
        ["Food gathered", stats.forageCount],
        ["Total XP earned", Math.round(stats.totalXP)],
      ],
    },
    {
      category: "Exploration",
      rows: [
        ["Distance traveled (meadow-lengths)", round1(stats.distanceTraveled)],
        ["Seasons completed", stats.seasonsCompleted],
      ],
    },
    {
      category: "Social",
      rows: [
        ["Friends made", stats.befriendSuccesses],
        ["Befriend attempts", stats.befriendAttempts],
      ],
    },
    {
      category: "Survival",
      rows: [
        ["Close calls evaded", stats.evadeCount],
        ["Hazard hits taken", stats.hazardHitsTaken],
      ],
    },
    {
      category: "Nest",
      rows: [["Cards drafted", stats.cardsDrafted]],
    },
  ];
}

// ----------------------------------------------------------------------------
// Card value breakdown (Life Story Screen 3, GDD §5)
// ----------------------------------------------------------------------------

export interface CardBreakdownRow {
  name: string;
  stacks: number;
  value: number;
  cost: number;
  net: number;
}

/**
 * Rank drafted cards by net contribution (value delivered minus cost
 * incurred), descending. Cards with no attributed stats yet still appear
 * (value/cost default to 0) so every drafted card is represented.
 */
export function cardBreakdown(
  player: PlayerState,
  cards: CardData[]
): CardBreakdownRow[] {
  const byId = new Map(cards.map((c) => [c.id, c]));

  const rows: CardBreakdownRow[] = player.activeCards.map((ac) => {
    const card = byId.get(ac.cardId);
    const per = player.stats.perCardStats[ac.cardId];
    const value = per?.valueDelivered ?? 0;
    const cost = per?.costIncurred ?? 0;
    return {
      name: card?.name ?? ac.cardId,
      stacks: ac.stacks,
      value: Math.round(value),
      cost: Math.round(cost),
      net: Math.round(value - cost),
    };
  });

  return rows.sort((a, b) => b.net - a.net);
}
