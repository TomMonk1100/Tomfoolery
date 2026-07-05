/**
 * InstinctAI — drop-in substitute for InputController when
 * ctx.player.instinctMode is true. Implements both InputSource (so the
 * verb/movement systems can't tell the difference) and System (so WorldScene
 * can update() it uniformly). Also doubles as the swarm's automated
 * playtest bot, so it now actually fights instead of only wander/forage.
 *
 * All decision math lives in instinctBrain.ts (pure, Phaser-free, unit
 * tested). This file is the thin adapter: it reads ctx state into plain
 * objects every decision tick, calls decideGoal(), and turns the returned
 * target into a drag vector using the same seek/arrive/emit mechanism the
 * pre-overhaul version used (so MovementSystem/VerbSystem need no changes).
 *
 * DECISIONS:
 * - Food tracking: ctx exposes no live food-position query, so this system
 *   subscribes to EV.foodSpawned to append {x,y} to a local list and drops
 *   entries once the bot passes within EAT_RADIUS_PX (treated as consumed
 *   for tracking purposes — EV.foodEaten carries no position to correlate
 *   back to a specific item, see instinctBrain.ts DECISIONS).
 * - Forage tap-emission preserved from the old implementation: when the
 *   brain's goal is "forage" and we're within FORAGE_TAP_RANGE_PX of the
 *   target, emit one "tap" InputEvent (VerbSystem performs the harvest),
 *   exactly like the pre-overhaul forage behavior.
 * - Companion recruiting is intentionally not a goal here — no ctx API
 *   exists to target wild companions; recruiting still happens passively
 *   via CompanionSystem's proximity+dwell while the bot wanders/farms near
 *   them (see instinctBrain.ts DECISIONS).
 * - Decision cadence: goal re-evaluated every DECISION_INTERVAL_MS like the
 *   old AI, but the drag vector toward the current target is recomputed and
 *   emitted every frame (movement must stay smooth, not stepped).
 * - Wander target reuse: FARM's sparse-enemy fallback and the final
 *   no-op fallback reuse the same persistent wanderTarget/arrival-radius
 *   pattern as before so the bot doesn't dither when idle.
 */
import Phaser from "phaser";
import { GameContext, System, Vec2 } from "../core/context";
import { EV } from "../core/context";
import { InputEvent, InputSource } from "../core/types";
import {
  BrainState,
  EAT_RADIUS_PX,
  decideGoal,
  GoalDecision,
  InstinctGoal,
} from "./instinctBrain";
import { wrapDeltaVec } from "./combat/sim";

const DECISION_INTERVAL_MS = 500;
const ARRIVAL_RADIUS_PX = 24;
const FORAGE_TAP_RANGE_PX = 40;
const WANDER_RADIUS_PX = 120;
/** Cap on tracked food positions so a long run can't leak memory. */
const MAX_TRACKED_FOOD = 64;

export class InstinctAI implements InputSource, System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private extraHandlers: Array<(e: InputEvent) => void> = [];

  private timeSinceDecisionMs = 0;
  private decision: GoalDecision | null = null;
  private prevFarmGoal: "farmApproach" | "farmStrafe" | null = null;
  private wanderTarget: Vec2 | null = null;
  private currentDrag: { dragX: number; dragY: number } | null = null;
  private hasTappedCurrentTarget = false;
  private lastGoal: InstinctGoal | null = null;

  private trackedFood: Vec2[] = [];

  private onFoodSpawned = (payload: { x: number; y: number; heal?: number }) => {
    this.trackedFood.push({ x: payload.x, y: payload.y });
    if (this.trackedFood.length > MAX_TRACKED_FOOD) {
      this.trackedFood.splice(0, this.trackedFood.length - MAX_TRACKED_FOOD);
    }
  };

  private raidActive = false;
  private onRaidStarted = () => {
    this.raidActive = true;
  };
  private onRaidEnded = () => {
    this.raidActive = false;
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    this.ctx.events.on(EV.foodSpawned, this.onFoodSpawned);
    this.ctx.events.on(EV.nestRaidStarted, this.onRaidStarted);
    this.ctx.events.on(EV.nestRaidEnded, this.onRaidEnded);
  }

  on(handler: (e: InputEvent) => void): void {
    this.extraHandlers.push(handler);
  }

  private emit(event: InputEvent): void {
    this.ctx.events.emit(EV.input, event);
    for (const h of this.extraHandlers) h(event);
  }

  private pickWanderTarget(from: Vec2): Vec2 {
    const angle = Math.random() * Math.PI * 2;
    const distPx = WANDER_RADIUS_PX * (0.5 + Math.random() * 0.5);
    const bounds = this.ctx.world.bounds();
    const x = Phaser.Math.Clamp(from.x + Math.cos(angle) * distPx, 0, bounds.width);
    const y = Phaser.Math.Clamp(from.y + Math.sin(angle) * distPx, 0, bounds.height);
    return { x, y };
  }

  /** Drop tracked food the bot has effectively already reached/eaten. */
  private pruneReachedFood(pos: Vec2): void {
    this.trackedFood = this.trackedFood.filter(
      (f) => Math.hypot(f.x - pos.x, f.y - pos.y) > EAT_RADIUS_PX
    );
  }

  private buildState(): BrainState {
    const pos = this.ctx.getPlayerPos();
    const nest = this.ctx.getNest();
    const hunger = this.ctx.getHunger();
    const hpPct =
      this.ctx.player.maxHp > 0 ? this.ctx.player.hp / this.ctx.player.maxHp : 1;

    if (
      !this.wanderTarget ||
      Math.hypot(this.wanderTarget.x - pos.x, this.wanderTarget.y - pos.y) <=
        ARRIVAL_RADIUS_PX
    ) {
      this.wanderTarget = this.pickWanderTarget(pos);
    }

    return {
      playerPos: pos,
      hpPct,
      hunger,
      enemies: this.ctx.getEnemies(),
      nestPos: nest ? { x: nest.x, y: nest.y } : null,
      raidActive: this.raidActive,
      trackedFood: this.trackedFood,
      forageNodes: this.ctx.world.forageNodes(),
      fogEdge: this.ctx.world.nearestFogEdge(pos),
      wanderTarget: this.wanderTarget,
      prevFarmGoal: this.prevFarmGoal,
    };
  }

  private decide(): void {
    const pos = this.ctx.getPlayerPos();
    this.pruneReachedFood(pos);
    const state = this.buildState();
    const decision = decideGoal(state);

    if (decision.goal === "farmApproach" || decision.goal === "farmStrafe") {
      this.prevFarmGoal = decision.goal;
    } else {
      this.prevFarmGoal = null;
    }

    if (
      !this.decision ||
      this.decision.targetX !== decision.targetX ||
      this.decision.targetY !== decision.targetY ||
      this.lastGoal !== decision.goal
    ) {
      this.hasTappedCurrentTarget = false;
    }
    this.lastGoal = decision.goal;
    this.decision = decision;
  }

  update(deltaMs: number): { dragX: number; dragY: number } | null {
    if (!this.ctx.player.instinctMode) {
      this.currentDrag = null;
      return null;
    }
    if (this.ctx.isPaused()) {
      return this.currentDrag;
    }

    this.timeSinceDecisionMs += deltaMs;
    if (this.timeSinceDecisionMs >= DECISION_INTERVAL_MS || !this.decision) {
      this.timeSinceDecisionMs = 0;
      this.decide();
    } else {
      // Keep food tracking / prune fresh every frame even between decision
      // ticks so the eat goal doesn't "eat air" once we arrive early.
      this.pruneReachedFood(this.ctx.getPlayerPos());
    }

    if (!this.decision) {
      this.currentDrag = { dragX: 0, dragY: 0 };
      return this.currentDrag;
    }

    const pos = this.ctx.getPlayerPos();
    const target = { x: this.decision.targetX, y: this.decision.targetY };
    // Wrap-aware: the world seam means the shorter path to a target may be
    // "the other way around" the torus. decideGoal()'s target selection
    // itself is plain-Euclidean (see instinctBrain.ts DECISIONS), but the
    // actual steering vector toward whatever target it picked must wrap,
    // or the bot walks the long way and can stall/hug the world edge right
    // at the seam (found via live playtest after the Update 2 wrap rework).
    const bounds = this.ctx.world.bounds();
    const worldSize = Math.max(bounds.width, bounds.height);
    const wrapped = wrapDeltaVec(pos, target, worldSize);
    const dx = wrapped.x;
    const dy = wrapped.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Forage tap-harvest when within range (verb harvest performed by
    // VerbSystem in response to the emitted tap, exactly like before).
    if (this.decision.goal === "forage" && dist <= FORAGE_TAP_RANGE_PX) {
      if (!this.hasTappedCurrentTarget) {
        this.hasTappedCurrentTarget = true;
        this.emit({
          type: "tap",
          x: target.x,
          y: target.y,
          dx: 0,
          dy: 0,
          magnitude: 0,
        });
      }
      this.currentDrag = { dragX: 0, dragY: 0 };
      this.emitDrag(pos, 0, 0, 0);
      return this.currentDrag;
    }

    if (dist <= ARRIVAL_RADIUS_PX) {
      this.currentDrag = { dragX: 0, dragY: 0 };
      this.emitDrag(pos, 0, 0, 0);
      return this.currentDrag;
    }

    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const magnitude = 1; // full-speed pursuit, per instinct-mode "auto-navigate"
    this.currentDrag = { dragX: nx * magnitude, dragY: ny * magnitude };
    this.emitDrag(pos, nx, ny, magnitude);
    return this.currentDrag;
  }

  private emitDrag(pos: Vec2, dx: number, dy: number, magnitude: number): void {
    this.emit({ type: "drag", x: pos.x, y: pos.y, dx, dy, magnitude });
  }

  destroy(): void {
    this.ctx.events.off(EV.foodSpawned, this.onFoodSpawned);
    this.ctx.events.off(EV.nestRaidStarted, this.onRaidStarted);
    this.ctx.events.off(EV.nestRaidEnded, this.onRaidEnded);
    this.extraHandlers = [];
    this.decision = null;
    this.wanderTarget = null;
    this.currentDrag = null;
    this.trackedFood = [];
  }
}
