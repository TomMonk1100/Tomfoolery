/**
 * InstinctAI — drop-in substitute for InputController when
 * ctx.player.instinctMode is true. Implements both InputSource (so the
 * verb/movement systems can't tell the difference) and System (so WorldScene
 * can update() it uniformly).
 *
 * Priority per ~500ms decision tick (dev-plan Step 4 instr. 17 / GDD Instinct
 * Mode section):
 *   1. nearest unharvested forage node within forageRadius*3 -> seek it,
 *      emit a "tap" once within forage range.
 *   2. else nearest fog edge -> seek it.
 *   3. else flee nearest hazard -> move directly away from it.
 *   4. else idle-wander -> gentle pseudo-random wander target.
 *
 * Movement itself is driven every frame (not just every tick) by emitting
 * synthetic "drag" InputEvents toward the current target, exactly like a
 * human joystick drag, so MovementSystem needs no AI-specific branches.
 *
 * The 0.6x Instinct Mode XP multiplier and isUnique draft exclusion are
 * handled by other systems (DraftSystem / XP award path), not here.
 */
import Phaser from "phaser";
import { GameContext, System, Vec2 } from "../core/context";
import { EV } from "../core/context";
import { InputEvent, InputSource } from "../core/types";

const DECISION_INTERVAL_MS = 500;
const FORAGE_SEEK_RANGE_MULT = 3;
const ARRIVAL_RADIUS_PX = 24;
/** Distance at which the AI considers itself "within forage range" to tap-harvest. */
const FORAGE_TAP_RANGE_PX = 40;
const HAZARD_FLEE_RANGE_PX = 160;
const WANDER_RADIUS_PX = 120;

type TargetKind = "forage" | "fogEdge" | "flee" | "wander" | "none";

interface HazardLike extends Vec2 {
  /** Optional radius, defaults handled defensively if absent. */
  radius?: number;
}

export class InstinctAI implements InputSource, System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private extraHandlers: Array<(e: InputEvent) => void> = [];

  private timeSinceDecisionMs = 0;
  private target: Vec2 | null = null;
  private targetKind: TargetKind = "none";
  private wanderTarget: Vec2 | null = null;
  private currentDrag: { dragX: number; dragY: number } | null = null;
  private hasTappedCurrentTarget = false;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  on(handler: (e: InputEvent) => void): void {
    this.extraHandlers.push(handler);
  }

  private emit(event: InputEvent): void {
    this.ctx.events.emit(EV.input, event);
    for (const h of this.extraHandlers) h(event);
  }

  /**
   * Attempts to find nearby hazards via a loose duck-typed lookup on ctx.
   * WorldView/GameContext contracts don't define a hazard list at this
   * layer (HazardSystem owns that), so this checks an optional registry
   * value defensively and no-ops if absent — Instinct AI degrades
   * gracefully to forage/explore/wander-only behavior until HazardSystem
   * publishes something to query.
   */
  private findNearestHazard(from: Vec2): HazardLike | null {
    const anyScene = this.scene as unknown as {
      registry?: Phaser.Data.DataManager;
    };
    const hazards = anyScene.registry?.get("activeHazards") as
      | HazardLike[]
      | undefined;
    if (!hazards || hazards.length === 0) return null;
    let best: HazardLike | null = null;
    let bestDist = Infinity;
    for (const h of hazards) {
      const dx = h.x - from.x;
      const dy = h.y - from.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        best = h;
      }
    }
    if (best && Math.sqrt(bestDist) <= HAZARD_FLEE_RANGE_PX) return best;
    return null;
  }

  private pickWanderTarget(from: Vec2): Vec2 {
    const angle = Math.random() * Math.PI * 2;
    const dist = WANDER_RADIUS_PX * (0.5 + Math.random() * 0.5);
    const bounds = this.ctx.world.bounds();
    const x = Phaser.Math.Clamp(
      from.x + Math.cos(angle) * dist,
      0,
      bounds.width
    );
    const y = Phaser.Math.Clamp(
      from.y + Math.sin(angle) * dist,
      0,
      bounds.height
    );
    return { x, y };
  }

  private decide(): void {
    const pos = this.ctx.getPlayerPos();
    const forageRange =
      this.ctx.animal.forageRadius *
      FORAGE_SEEK_RANGE_MULT *
      (1 + this.ctx.statBonus("senseRadius") / 100);

    // 1. Nearest unharvested forage node within range.
    const forageNodes = this.ctx.world.forageNodes();
    let nearestForage: Vec2 | null = null;
    let nearestForageDist = Infinity;
    for (const node of forageNodes) {
      const dx = node.x - pos.x;
      const dy = node.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestForageDist) {
        nearestForageDist = dist;
        nearestForage = node;
      }
    }
    if (nearestForage && nearestForageDist <= forageRange) {
      this.setTarget(nearestForage, "forage");
      return;
    }

    // 2. Else nearest fog edge.
    const fogEdge = this.ctx.world.nearestFogEdge(pos);
    if (fogEdge) {
      this.setTarget(fogEdge, "fogEdge");
      return;
    }

    // 3. Else flee nearest hazard.
    const hazard = this.findNearestHazard(pos);
    if (hazard) {
      const dx = pos.x - hazard.x;
      const dy = pos.y - hazard.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const fleeTarget: Vec2 = {
        x: pos.x + (dx / dist) * WANDER_RADIUS_PX,
        y: pos.y + (dy / dist) * WANDER_RADIUS_PX,
      };
      this.setTarget(fleeTarget, "flee");
      return;
    }

    // 4. Idle-wander.
    if (
      !this.wanderTarget ||
      this.distTo(pos, this.wanderTarget) <= ARRIVAL_RADIUS_PX
    ) {
      this.wanderTarget = this.pickWanderTarget(pos);
    }
    this.setTarget(this.wanderTarget, "wander");
  }

  private setTarget(target: Vec2, kind: TargetKind): void {
    if (
      !this.target ||
      this.target.x !== target.x ||
      this.target.y !== target.y ||
      this.targetKind !== kind
    ) {
      this.hasTappedCurrentTarget = false;
    }
    this.target = target;
    this.targetKind = kind;
  }

  private distTo(a: Vec2, b: Vec2): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    return Math.sqrt(dx * dx + dy * dy);
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
    if (this.timeSinceDecisionMs >= DECISION_INTERVAL_MS || !this.target) {
      this.timeSinceDecisionMs = 0;
      this.decide();
    }

    if (!this.target) {
      this.currentDrag = { dragX: 0, dragY: 0 };
      return this.currentDrag;
    }

    const pos = this.ctx.getPlayerPos();
    const dx = this.target.x - pos.x;
    const dy = this.target.y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Forage tap-harvest when within range.
    if (this.targetKind === "forage" && dist <= FORAGE_TAP_RANGE_PX) {
      if (!this.hasTappedCurrentTarget) {
        this.hasTappedCurrentTarget = true;
        this.emit({
          type: "tap",
          x: this.target.x,
          y: this.target.y,
          dx: 0,
          dy: 0,
          magnitude: 0,
        });
      }
      this.currentDrag = { dragX: 0, dragY: 0 };
      this.emit({
        type: "drag",
        x: pos.x,
        y: pos.y,
        dx: 0,
        dy: 0,
        magnitude: 0,
      });
      return this.currentDrag;
    }

    if (dist <= ARRIVAL_RADIUS_PX) {
      this.currentDrag = { dragX: 0, dragY: 0 };
      this.emit({
        type: "drag",
        x: pos.x,
        y: pos.y,
        dx: 0,
        dy: 0,
        magnitude: 0,
      });
      return this.currentDrag;
    }

    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    const magnitude = 1; // full-speed pursuit, per instinct-mode "auto-navigate"
    this.currentDrag = { dragX: nx * magnitude, dragY: ny * magnitude };
    this.emit({
      type: "drag",
      x: pos.x,
      y: pos.y,
      dx: nx,
      dy: ny,
      magnitude,
    });
    return this.currentDrag;
  }

  destroy(): void {
    this.extraHandlers = [];
    this.target = null;
    this.wanderTarget = null;
    this.currentDrag = null;
  }
}
