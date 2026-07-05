/**
 * VerbSystem — handles Forage, Nest, Befriend, Evade verbs driven by
 * classified InputEvents, plus a small Explore/Migrate XP trickle.
 *
 * Wired as `new VerbSystem(scene, ctx)` per the System contract in
 * core/context.ts. Consumes ctx.events EV.input and emits EV.forageHarvested /
 * EV.verbPerformed / EV.evadeSuccess as documented in core/types.ts.
 */
import Phaser from "phaser";
import { System, GameContext, Vec2 } from "../core/context";
import { EV, InputEvent } from "../core/types";
import { logCardValue } from "../core/playerState";

/** How long an Evade grants invulnerability / "evading" status, in ms. */
const EVADE_WINDOW_MS = 600;

/** Minimum accuracy for a Befriend attempt to succeed. */
const BEFRIEND_SUCCESS_THRESHOLD = 0.6;

/** Small XP grants for secondary/ambient actions. */
const NEST_XP = 5;
const BEFRIEND_XP = 15;
const EVADE_XP_TRICKLE = 2;
const MIGRATE_BONUS_XP = 20;
const EXPLORE_FALLBACK_XP = 1;

/** Base forage yield before percent bonuses. */
const BASE_FORAGE_YIELD = 10;

export class VerbSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  /** Remaining ms of the current evade/invulnerability window. */
  private evadeWindowRemainingMs = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.ctx.events.on(EV.input, this.onInput, this);
    this.ctx.events.on(EV.seasonChanged, this.onSeasonChanged, this);
  }

  update(deltaMs: number): void {
    if (this.evadeWindowRemainingMs > 0) {
      this.evadeWindowRemainingMs = Math.max(
        0,
        this.evadeWindowRemainingMs - deltaMs
      );
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.input, this.onInput, this);
    this.ctx.events.off(EV.seasonChanged, this.onSeasonChanged, this);
  }

  /** True while the player is inside their post-Evade invulnerability window. */
  isEvading(): boolean {
    return this.evadeWindowRemainingMs > 0;
  }

  private onInput(e: InputEvent): void {
    if (this.ctx.isPaused()) return;

    switch (e.type) {
      case "tap":
        this.handleTap(e);
        break;
      case "focusRelease":
        this.handleFocusRelease(e);
        break;
      case "swipe":
        this.handleSwipe(e);
        break;
      default:
        // "drag" is handled by MovementSystem, not verbs.
        break;
    }
  }

  private handleTap(e: InputEvent): void {
    const playerPos = this.ctx.getPlayerPos();
    const reach =
      this.ctx.animal.forageRadius *
      (1 + this.ctx.statBonus("senseRadius") / 100);

    const nearestForage = this.findNearest(
      this.ctx.world.forageNodes(),
      playerPos,
      reach
    );

    if (nearestForage) {
      this.doForage(nearestForage);
      return;
    }

    const nearestNest = this.findNearest(
      this.ctx.world.nestNodes(),
      playerPos,
      reach
    );

    if (nearestNest) {
      this.doNest();
      return;
    }

    // No forage/nest node in reach — still grant a tiny explore trickle so
    // taps around the world are never fully "wasted" for a wandering player.
    this.ctx.addXP(EXPLORE_FALLBACK_XP);
  }

  private doForage(pos: Vec2): void {
    const { col, row } = this.ctx.world.worldToTile(pos.x, pos.y);
    const tile = this.ctx.world.tileAt(col, row);
    if (tile) {
      tile.harvested = true;
    }

    const amount = BASE_FORAGE_YIELD * (1 + this.ctx.statBonus("forageYield") / 100);

    this.ctx.addXP(amount);
    this.ctx.player.stats.forageCount++;
    this.ctx.audio.blip("forage");

    this.logForageYieldCards(amount);

    this.ctx.events.emit(EV.forageHarvested, {
      x: pos.x,
      y: pos.y,
      amount,
    });
  }

  /** Attribute forage-yield value to whichever active cards boost it. */
  private logForageYieldCards(totalAmount: number): void {
    const baseline = BASE_FORAGE_YIELD;
    const bonus = totalAmount - baseline;
    if (bonus <= 0) return;

    for (const active of this.ctx.player.activeCards) {
      const card = this.ctx.cards.find((c) => c.id === active.cardId);
      if (!card) continue;
      if (card.effect.type === "forageYield") {
        const cardShare =
          (card.effect.magnitude * active.stacks) /
          Math.max(1, this.ctx.statBonus("forageYield"));
        logCardValue(this.ctx.player, card.id, bonus * cardShare, 0);
      }
    }
  }

  private doNest(): void {
    this.ctx.audio.blip("nest");
    this.ctx.addXP(NEST_XP);
    this.ctx.events.emit(EV.verbPerformed, { verb: "nest" });
  }

  private handleFocusRelease(e: InputEvent): void {
    const accuracy = e.accuracy ?? 0;
    this.ctx.player.stats.befriendAttempts++;

    const success = accuracy >= BEFRIEND_SUCCESS_THRESHOLD;
    if (success) {
      this.ctx.player.stats.befriendSuccesses++;
      this.ctx.addXP(BEFRIEND_XP);
      this.ctx.audio.blip("befriend");
    }

    this.ctx.events.emit(EV.verbPerformed, {
      verb: "befriend",
      x: e.x,
      y: e.y,
      success,
    });
  }

  private handleSwipe(e: InputEvent): void {
    this.ctx.player.stats.evadeCount++;
    this.evadeWindowRemainingMs = EVADE_WINDOW_MS;

    this.ctx.addXP(EVADE_XP_TRICKLE);
    this.ctx.audio.blip("evade");

    this.ctx.events.emit(EV.evadeSuccess);
    this.ctx.events.emit(EV.verbPerformed, {
      verb: "evade",
      x: e.x,
      y: e.y,
    });
  }

  private onSeasonChanged(): void {
    if (this.ctx.isPaused()) return;
    this.ctx.addXP(MIGRATE_BONUS_XP);
    this.ctx.events.emit(EV.verbPerformed, { verb: "migrate" });
  }

  /** Nearest position to `from` within `maxDist` px, or null. */
  private findNearest(
    candidates: Vec2[],
    from: Vec2,
    maxDist: number
  ): Vec2 | null {
    let best: Vec2 | null = null;
    let bestDist = maxDist;
    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(from.x, from.y, c.x, c.y);
      if (d <= bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }
}
