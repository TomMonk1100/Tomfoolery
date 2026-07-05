/**
 * DraftSystem — builds and resolves the 3-card level-up draft.
 *
 * Listens for EV.levelUp, builds an offer via buildOffer() (pure-ish, unit
 * testable), then launches DraftScene (owned by another agent) and pauses
 * WorldScene until a pick resolves.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { CardData, Rarity, RARITY_ORDER, EV, SCENE } from "../core/types";
import { pickRarity } from "../core/rarityWeights";
import { applyCard, logCardValue } from "../core/playerState";

/** Consecutive no-epic+ drafts before pity forces an epic+ slot. */
const PITY_THRESHOLD = 4;

/** XP refund granted when the player skips a draft. */
const SKIP_XP_REFUND = 5;

const EPIC_PLUS: Rarity[] = ["epic", "legendary", "mythic"];

export class DraftSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  /** Consecutive drafts offered with no epic+ card shown. */
  private pityCounter = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.ctx.events.on(EV.levelUp, this.onLevelUp, this);
  }

  update(_deltaMs: number): void {
    // No per-frame work; drafts are purely event-driven.
  }

  destroy(): void {
    this.ctx.events.off(EV.levelUp, this.onLevelUp, this);
  }

  /**
   * Build a 3-distinct-card offer for the given level. Applies the pity
   * rule and instinct-mode Unique exclusion. Exposed standalone so it can be
   * unit-tested without touching the scene.
   */
  buildOffer(level: number): CardData[] {
    const player = this.ctx.player;
    const pool = this.ctx.cards.filter((c) =>
      player.instinctMode ? !c.isUnique : true
    );

    const picked: CardData[] = [];
    const pickedIds = new Set<string>();

    const forcePityEpicSlot =
      this.pityCounter >= PITY_THRESHOLD && this.hasAnyEpicPlus(pool);

    for (let slot = 0; slot < 3; slot++) {
      let rarity: Rarity;

      if (slot === 0 && forcePityEpicSlot) {
        rarity = this.pickForcedEpicPlusRarity(level, player.luck, pool, pickedIds);
      } else {
        rarity = pickRarity(level, player.luck, player.instinctMode);
      }

      const card = this.pickCardOfRarity(pool, rarity, level, pickedIds);
      if (card) {
        picked.push(card);
        pickedIds.add(card.id);
      }
    }

    // Backfill if fewer than 3 distinct cards were resolvable (tiny pools).
    if (picked.length < 3) {
      for (const card of pool) {
        if (picked.length >= 3) break;
        if (pickedIds.has(card.id)) continue;
        picked.push(card);
        pickedIds.add(card.id);
      }
    }

    // Update pity counter based on what actually appears in the offer.
    const containsEpicPlus = picked.some((c) => EPIC_PLUS.includes(c.rarity));
    this.pityCounter = containsEpicPlus ? 0 : this.pityCounter + 1;

    return picked;
  }

  private onLevelUp(level: number): void {
    const cards = this.buildOffer(level);

    const onPick = (cardId: string | null): void => {
      if (cardId) {
        const card = this.ctx.cards.find((c) => c.id === cardId);
        if (card) {
          applyCard(this.ctx.player, card);
          logCardValue(this.ctx.player, card.id, 0, 0); // seed the per-card record
          this.ctx.events.emit(EV.cardChosen, cardId);
          this.ctx.events.emit(EV.spriteDirty);
        }
      } else {
        // Skip: grant a small XP refund.
        this.ctx.addXP(SKIP_XP_REFUND);
      }

      this.scene.scene.resume(SCENE.World);
      this.scene.scene.stop(SCENE.Draft);
    };

    this.scene.scene.launch(SCENE.Draft, { cards, onPick });
    this.scene.scene.pause(SCENE.World);
  }

  private hasAnyEpicPlus(pool: CardData[]): boolean {
    return pool.some((c) => EPIC_PLUS.includes(c.rarity));
  }

  /** Roll a rarity restricted to epic/legendary/mythic, weighted by their relative weights at this level. */
  private pickForcedEpicPlusRarity(
    level: number,
    luck: number,
    pool: CardData[],
    excludeIds: Set<string>
  ): Rarity {
    const available = EPIC_PLUS.filter((r) =>
      pool.some((c) => c.rarity === r && !excludeIds.has(c.id))
    );
    if (available.length === 0) return "epic";

    // Reuse rawWeight-derived relative shares by sampling pickRarity repeatedly
    // restricted to the epic+ subset, since rarityWeights.ts only exposes a
    // full-vector roll. Approximate the "relative weights" requirement by
    // rejection-sampling pickRarity until it lands in the epic+ set, with a
    // capped retry count to avoid infinite loops when luck is extreme.
    for (let attempt = 0; attempt < 50; attempt++) {
      const r = pickRarity(level, luck, false);
      if (available.includes(r)) return r;
    }
    // Fallback: uniform among available epic+ rarities.
    return available[Phaser.Math.Between(0, available.length - 1)];
  }

  /**
   * Choose an unpicked card of the given rarity, weighted by weightsByLevel
   * at the (clamped) level. Falls back to the next lower rarity if none
   * available, all the way down to common; returns null only if the whole
   * pool is exhausted.
   */
  private pickCardOfRarity(
    pool: CardData[],
    rarity: Rarity,
    level: number,
    excludeIds: Set<string>
  ): CardData | null {
    const startIdx = RARITY_ORDER.indexOf(rarity);

    for (let idx = startIdx; idx >= 0; idx--) {
      const r = RARITY_ORDER[idx];
      const candidates = pool.filter(
        (c) => c.rarity === r && !excludeIds.has(c.id)
      );
      if (candidates.length === 0) continue;

      const chosen = this.weightedPick(candidates, level);
      if (chosen) return chosen;
    }

    return null;
  }

  private weightedPick(candidates: CardData[], level: number): CardData | null {
    if (candidates.length === 0) return null;

    const levelKey = this.clampLevelKey(candidates[0].weightsByLevel, level);

    const weights = candidates.map((c) => {
      const w = c.weightsByLevel[levelKey];
      return typeof w === "number" && w > 0 ? w : 0;
    });

    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) {
      // No usable weights at this level — uniform fallback.
      return candidates[Phaser.Math.Between(0, candidates.length - 1)];
    }

    let roll = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  /** Clamp a numeric level to the nearest authored weightsByLevel key. */
  private clampLevelKey(
    weightsByLevel: Record<string, number>,
    level: number
  ): string {
    const keys = Object.keys(weightsByLevel)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (keys.length === 0) return "1";

    const clamped = Phaser.Math.Clamp(level, keys[0], keys[keys.length - 1]);
    // Find nearest authored key <= clamped, else the smallest key.
    let best = keys[0];
    for (const k of keys) {
      if (k <= clamped) best = k;
    }
    return String(best);
  }
}
