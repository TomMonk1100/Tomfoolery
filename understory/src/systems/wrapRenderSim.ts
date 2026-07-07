import { Vec2 } from "../core/context";
import { wrapDelta } from "./combat/sim";

/**
 * Update 3 §WS-C — pure math for the seamless toroidal camera.
 *
 * The world is a torus of `size` px per axis. The camera is never clamped;
 * instead every world-space object is *displayed* at whichever wrapped copy
 * (pos ± k*size) lies nearest the camera center, so the seam is invisible.
 * Logic always keeps truth positions in [0, size); only rendering shifts.
 */

/** Canonical wrap of a coordinate into [0, size). */
export function wrapMod(v: number, size: number): number {
  return ((v % size) + size) % size;
}

/**
 * The wrapped copy of coordinate `v` nearest to `ref`.
 * e.g. size=1536, v=1530, ref=10 → -6 (the copy just left of the seam).
 */
export function nearestWrappedCoord(v: number, ref: number, size: number): number {
  return v + Math.round((ref - v) / size) * size;
}

/** Vector form of nearestWrappedCoord. */
export function nearestWrappedPos(pos: Vec2, ref: Vec2, size: number): Vec2 {
  return {
    x: nearestWrappedCoord(pos.x, ref.x, size),
    y: nearestWrappedCoord(pos.y, ref.y, size),
  };
}

/**
 * One smooth-follow step of the camera center toward the player along the
 * torus (shortest wrapped direction), frame-rate independent.
 * Returns the new camera center, canonically wrapped into [0, size).
 */
export function cameraStep(
  center: Vec2,
  target: Vec2,
  size: number,
  deltaMs: number,
  followPerFrame = 0.12
): Vec2 {
  // 0.12/frame at 60fps → equivalent exponential smoothing for any delta.
  const f = 1 - Math.pow(1 - followPerFrame, deltaMs / (1000 / 60));
  return {
    x: wrapMod(center.x + wrapDelta(center.x, target.x, size) * f, size),
    y: wrapMod(center.y + wrapDelta(center.y, target.y, size) * f, size),
  };
}

/**
 * Offsets for the 3 ghost copies of a world-sized overlay (fog) so the
 * 2x2 block {base, +ox, +oy, +both} always covers the viewport. Valid
 * whenever the viewport is smaller than the world (true here: view ≤ ~1100
 * vs world 1536).
 */
export function ghostOffsets(
  scrollX: number,
  scrollY: number,
  size: number
): { ox: number; oy: number } {
  return { ox: scrollX < 0 ? -size : size, oy: scrollY < 0 ? -size : size };
}
