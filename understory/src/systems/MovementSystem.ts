/**
 * MovementSystem — consumes classified "drag" input as a joystick vector and
 * "swipe" input as a short dash impulse, integrates displacement per frame,
 * and applies it via ctx.movePlayer. Also accumulates distanceTraveled.
 */
import Phaser from "phaser";
import { GameContext, System } from "../core/context";
import { EV } from "../core/context";
import { InputEvent } from "../core/types";

const DASH_DURATION_MS = 180;
const DASH_SPEED_MULT = 2.2; // _balance: placeholder
/** How quickly the target drag vector decays toward zero if no fresh drag arrives. */
const DRAG_STALE_MS = 150;
const DRAG_DECAY_PER_MS = 1 / 200; // magnitude units/ms

export class MovementSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private targetDx = 0;
  private targetDy = 0;
  private targetMagnitude = 0;
  private lastDragAt = -Infinity;

  private dashTimeRemainingMs = 0;
  private dashDx = 0;
  private dashDy = 0;

  private onInput = (e: InputEvent) => {
    if (e.type === "drag") {
      this.targetDx = e.dx;
      this.targetDy = e.dy;
      this.targetMagnitude = e.magnitude;
      this.lastDragAt = this.scene.time.now;
    } else if (e.type === "swipe") {
      // Normalize the swipe direction (dx,dy already ~unit vector from
      // InputController, but guard against zero-length just in case).
      const len = Math.sqrt(e.dx * e.dx + e.dy * e.dy);
      if (len > 0) {
        this.dashDx = e.dx / len;
        this.dashDy = e.dy / len;
        this.dashTimeRemainingMs = DASH_DURATION_MS;
      }
    }
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    ctx.events.on(EV.input, this.onInput);
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    // Decay the drag target toward zero if no fresh drag event has arrived
    // recently (e.g., pointer released and the final zeroing event was
    // already consumed, or input source stopped emitting).
    if (this.scene.time.now - this.lastDragAt > DRAG_STALE_MS) {
      const decay = DRAG_DECAY_PER_MS * deltaMs;
      this.targetMagnitude = Math.max(0, this.targetMagnitude - decay);
    }

    const speed =
      this.ctx.animal.speed * (1 + this.ctx.statBonus("moveSpeed") / 100);

    let dx = 0;
    let dy = 0;

    if (this.dashTimeRemainingMs > 0) {
      const dashSpeed = speed * DASH_SPEED_MULT;
      dx += this.dashDx * dashSpeed * 1 * (deltaMs / 1000);
      dy += this.dashDy * dashSpeed * 1 * (deltaMs / 1000);
      this.dashTimeRemainingMs -= deltaMs;
    }

    if (this.targetMagnitude > 0) {
      dx += this.targetDx * speed * this.targetMagnitude * (deltaMs / 1000);
      dy += this.targetDy * speed * this.targetMagnitude * (deltaMs / 1000);
    }

    if (dx !== 0 || dy !== 0) {
      this.ctx.movePlayer(dx, dy);
      const movedDist = Math.sqrt(dx * dx + dy * dy);
      this.ctx.player.stats.distanceTraveled += movedDist / 32;
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.input, this.onInput);
  }
}
