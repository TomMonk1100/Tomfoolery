/**
 * InputController — classifies raw Phaser pointer gestures into the
 * InputEvent taxonomy (tap / swipe / drag / focusRelease) and emits them via
 * ctx.events. Implements InputSource so InstinctAI can be a drop-in
 * substitute for a human player.
 *
 * Classification rules (per UNDERSTORY-DEV-PLAN.md Step 6 final resolution):
 *  - tap: duration < 200ms AND total displacement < 10px.
 *  - swipe: instantaneous velocity >= 0.8 px/ms sampled over the first 50ms
 *    of the gesture, checked from the first move sample regardless of any
 *    prior drag state. This removes the cold-start ambiguity called out in
 *    the dev plan's self-review.
 *  - hold-release (focusRelease): pointer held >= 400ms then released.
 *    Accuracy is a placeholder shrinking-ring simulation:
 *    accuracy = 1 - min(1, |heldMs-800|/800), clamped to [0,1].
 *  - drag: while pointer is down and it is not (yet) classified as a swipe,
 *    emits every frame with dx,dy = normalized vector from the joystick
 *    anchor (first touch point) to the current pointer, magnitude =
 *    clamp(distance/60, 0, 1). On release, emits one final
 *    {type:"drag", dx:0, dy:0, magnitude:0} to zero out movement.
 */
import Phaser from "phaser";
import { GameContext, EV } from "./context";
import { InputEvent, InputSource } from "./types";

const TAP_MAX_MS = 200;
const TAP_MAX_DISPLACEMENT = 10;
const SWIPE_VELOCITY_THRESHOLD = 0.8; // px/ms — _balance: placeholder
const SWIPE_SAMPLE_WINDOW_MS = 50;
const HOLD_MIN_MS = 400;
const FOCUS_RELEASE_TARGET_MS = 800;
const DRAG_MAX_DISTANCE = 60;

interface GestureState {
  pointerId: number;
  anchorX: number;
  anchorY: number;
  startTime: number;
  lastX: number;
  lastY: number;
  /** True once this gesture has been committed to "swipe" and should stop dragging. */
  isSwipe: boolean;
  /** True once we've taken our first move sample (for the 50ms velocity check). */
  firstMoveSampleTaken: boolean;
}

export class InputController implements InputSource {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private extraHandlers: Array<(e: InputEvent) => void> = [];
  private gesture: GestureState | null = null;
  private currentDrag: { dragX: number; dragY: number } | null = null;

  private onPointerDown = (pointer: Phaser.Input.Pointer) => {
    this.gesture = {
      pointerId: pointer.id,
      anchorX: pointer.x,
      anchorY: pointer.y,
      startTime: this.scene.time.now,
      lastX: pointer.x,
      lastY: pointer.y,
      isSwipe: false,
      firstMoveSampleTaken: false,
    };
    this.currentDrag = { dragX: 0, dragY: 0 };
  };

  private onPointerMove = (pointer: Phaser.Input.Pointer) => {
    const g = this.gesture;
    if (!g || g.pointerId !== pointer.id) return;
    if (!pointer.isDown) return;

    const now = this.scene.time.now;
    const elapsed = now - g.startTime;
    g.lastX = pointer.x;
    g.lastY = pointer.y;

    if (!g.isSwipe && !g.firstMoveSampleTaken) {
      g.firstMoveSampleTaken = true;
      // Check instantaneous velocity over the first 50ms of the gesture,
      // from the very first move sample regardless of prior state.
      if (elapsed <= SWIPE_SAMPLE_WINDOW_MS) {
        const ddx = pointer.x - g.anchorX;
        const ddy = pointer.y - g.anchorY;
        const dist = Math.sqrt(ddx * ddx + ddy * ddy);
        const dt = Math.max(1, elapsed);
        const velocity = dist / dt;
        if (velocity >= SWIPE_VELOCITY_THRESHOLD && dist > 0) {
          g.isSwipe = true;
          const nx = ddx / dist;
          const ny = ddy / dist;
          this.emit({
            type: "swipe",
            x: pointer.x,
            y: pointer.y,
            dx: nx,
            dy: ny,
            magnitude: velocity,
          });
          // Swipe committed: stop driving drag for this gesture.
          this.currentDrag = { dragX: 0, dragY: 0 };
          return;
        }
      }
    }

    if (g.isSwipe) return;

    // Otherwise this is a drag (joystick) sample.
    const dx = pointer.x - g.anchorX;
    const dy = pointer.y - g.anchorY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clamped = Math.min(1, dist / DRAG_MAX_DISTANCE);
    const nx = dist > 0 ? dx / dist : 0;
    const ny = dist > 0 ? dy / dist : 0;
    this.currentDrag = { dragX: nx * clamped, dragY: ny * clamped };
    this.emit({
      type: "drag",
      x: pointer.x,
      y: pointer.y,
      dx: nx,
      dy: ny,
      magnitude: clamped,
    });
  };

  private onPointerUp = (pointer: Phaser.Input.Pointer) => {
    const g = this.gesture;
    if (!g || g.pointerId !== pointer.id) return;

    const now = this.scene.time.now;
    const heldMs = now - g.startTime;
    const dx = pointer.x - g.anchorX;
    const dy = pointer.y - g.anchorY;
    const displacement = Math.sqrt(dx * dx + dy * dy);

    if (!g.isSwipe) {
      if (heldMs < TAP_MAX_MS && displacement < TAP_MAX_DISPLACEMENT) {
        this.emit({
          type: "tap",
          x: pointer.x,
          y: pointer.y,
          dx: 0,
          dy: 0,
          magnitude: 0,
        });
      } else if (heldMs >= HOLD_MIN_MS) {
        const accuracy = Math.max(
          0,
          Math.min(
            1,
            1 - Math.abs(heldMs - FOCUS_RELEASE_TARGET_MS) / FOCUS_RELEASE_TARGET_MS
          )
        );
        this.emit({
          type: "focusRelease",
          x: pointer.x,
          y: pointer.y,
          dx: 0,
          dy: 0,
          magnitude: accuracy,
          accuracy,
        });
      }
      // Zero out drag on release regardless of which branch fired above,
      // since a drag may have been emitting frames before a late tap/hold
      // classification resolves.
      this.emit({
        type: "drag",
        x: pointer.x,
        y: pointer.y,
        dx: 0,
        dy: 0,
        magnitude: 0,
      });
    }

    this.gesture = null;
    this.currentDrag = null;
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
    scene.input.on("pointerdown", this.onPointerDown);
    scene.input.on("pointermove", this.onPointerMove);
    scene.input.on("pointerup", this.onPointerUp);
    scene.input.on("pointerupoutside", this.onPointerUp);
  }

  private emit(event: InputEvent): void {
    this.ctx.events.emit(EV.input, event);
    for (const h of this.extraHandlers) h(event);
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[InputController]", event.type, event);
    }
  }

  on(handler: (e: InputEvent) => void): void {
    this.extraHandlers.push(handler);
  }

  update(_deltaMs: number): { dragX: number; dragY: number } | null {
    return this.currentDrag;
  }

  destroy(): void {
    this.scene.input.off("pointerdown", this.onPointerDown);
    this.scene.input.off("pointermove", this.onPointerMove);
    this.scene.input.off("pointerup", this.onPointerUp);
    this.scene.input.off("pointerupoutside", this.onPointerUp);
    this.extraHandlers = [];
    this.gesture = null;
    this.currentDrag = null;
  }
}
