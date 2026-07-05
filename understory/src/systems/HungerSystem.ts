/**
 * HungerSystem — owns PlayerState.hunger 0..100, drains it over time,
 * applies starvation damage at 0, and handles the "eat" action (called
 * directly by FoodSystem, which this worker also owns).
 *
 * DECISIONS:
 * - ctx.player.hunger is the persistence point per CONTRACTS/spec: this
 *   system reads its starting value from ctx.player.hunger in the
 *   constructor and writes back every frame (never shadows it in a
 *   separate field), so any other reader of ctx.player.hunger always sees
 *   the live value.
 * - EV.hungerChanged fires only when the rounded integer value changes
 *   frame-to-frame (spec: "on integer change"), not on every sub-integer
 *   drain tick.
 * - EV.wellFedChanged fires only on a boolean crossing of the threshold.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV, HUNGER_DRAIN_PER_SEC, WELL_FED_THRESHOLD } from "../core/types";
import {
  drainHunger,
  isWellFed,
  isStarving,
  applyEat,
} from "./nestHungerSim";

/** Base heal-per-eat before foodHeal% bonus. */
const EAT_HEAL_BASE = 15;
/** Hunger restored per eat action. */
const EAT_HUNGER_GAIN = 25;
/** Starvation damage interval and per-tick amount. */
const STARVE_TICK_MS = 2000;
const STARVE_DAMAGE = 2;

export class HungerSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private lastIntHunger: number;
  private lastWellFed: boolean;
  private starveTimerMs = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    // Persistence point: start from whatever WorldScene/createPlayerState set.
    this.lastIntHunger = Math.round(this.ctx.player.hunger);
    this.lastWellFed = isWellFed(this.ctx.player.hunger, WELL_FED_THRESHOLD);

    this.ctx.registerCombatProvider({
      getHunger: () => this.ctx.player.hunger,
    });
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    const dtSec = deltaMs / 1000;
    const drained = drainHunger(
      this.ctx.player.hunger,
      HUNGER_DRAIN_PER_SEC,
      dtSec
    );
    this.ctx.player.hunger = drained;
    this.emitIfChanged();

    if (isStarving(this.ctx.player.hunger)) {
      this.starveTimerMs += deltaMs;
      if (this.starveTimerMs >= STARVE_TICK_MS) {
        this.starveTimerMs -= STARVE_TICK_MS;
        this.ctx.damagePlayer(STARVE_DAMAGE, "starvation");
      }
    } else {
      this.starveTimerMs = 0;
    }
  }

  destroy(): void {
    // No listeners registered directly; nothing to tear down.
  }

  /**
   * Apply an eat action. Called by FoodSystem (same worker, direct call
   * rather than an event round-trip) whenever food is actually consumed.
   */
  eat(): void {
    const result = applyEat(
      this.ctx.player.hunger,
      this.ctx.player.hp,
      this.ctx.player.maxHp,
      EAT_HUNGER_GAIN,
      EAT_HEAL_BASE,
      this.ctx.statBonus("foodHeal"),
      WELL_FED_THRESHOLD
    );

    this.ctx.player.hunger = result.hunger;
    this.ctx.player.hp = result.hp;
    this.ctx.player.stats.foodEaten++;
    this.ctx.audio.blip("eat");

    this.emitIfChanged();

    this.ctx.events.emit(EV.foodEaten, {
      heal: result.heal,
      wellFed: result.wellFed,
    });
  }

  private emitIfChanged(): void {
    const intHunger = Math.round(this.ctx.player.hunger);
    if (intHunger !== this.lastIntHunger) {
      this.lastIntHunger = intHunger;
      this.ctx.events.emit(EV.hungerChanged, intHunger);
    }

    const wellFed = isWellFed(this.ctx.player.hunger, WELL_FED_THRESHOLD);
    if (wellFed !== this.lastWellFed) {
      this.lastWellFed = wellFed;
      this.ctx.events.emit(EV.wellFedChanged, wellFed);
    }
  }
}
