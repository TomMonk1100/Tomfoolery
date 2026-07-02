// ---------------------------------------------------------------------------
// lander-v10 commit 5 (§8.5): degradation guard.
//
// Tracks an exponential moving average (EMA) of frame time. If it stays
// above DEGRADE_THRESHOLD_MS (22ms, i.e. sub-45fps) for DEGRADE_FRAMES (60)
// CONSECUTIVE frames, the guard flips to "degraded": callers should halve
// particle emission rates and disable star twinkle (fall back to a single
// static blit of the star layer, per render/layers.ts's blitLayers(...,
// twinkle=false)). If frame time recovers below RECOVER_THRESHOLD_MS (14ms)
// for RECOVER_FRAMES (300) consecutive frames, it flips back to normal.
//
// Pure state machine, no DOM/canvas/console access — easy to drive with a
// synthetic sequence of frame times in tests, and safe to import from
// main.ts without pulling in any browser-only globals.
// ---------------------------------------------------------------------------

export const DEGRADE_THRESHOLD_MS = 22;
export const RECOVER_THRESHOLD_MS = 14;
export const DEGRADE_FRAMES = 60;
export const RECOVER_FRAMES = 300;
export const EMA_ALPHA = 0.1; // smoothing factor — low-pass enough to ignore single-frame spikes

export class DegradationGuard {
  private ema = 0;
  private primed = false;
  private aboveCount = 0;   // consecutive frames with ema > DEGRADE_THRESHOLD_MS
  private belowCount = 0;   // consecutive frames with ema < RECOVER_THRESHOLD_MS
  private degradedState = false;

  get degraded(): boolean {
    return this.degradedState;
  }

  get emaMs(): number {
    return this.ema;
  }

  // Feed one frame's duration (milliseconds). Returns the (possibly updated)
  // degraded state after processing this sample.
  sample(frameMs: number): boolean {
    if (!this.primed) {
      this.ema = frameMs;
      this.primed = true;
    } else {
      this.ema = this.ema + EMA_ALPHA * (frameMs - this.ema);
    }

    if (this.ema > DEGRADE_THRESHOLD_MS) {
      this.aboveCount += 1;
      this.belowCount = 0;
    } else if (this.ema < RECOVER_THRESHOLD_MS) {
      this.belowCount += 1;
      this.aboveCount = 0;
    } else {
      // In the dead zone between the two thresholds — neither streak advances,
      // but neither resets either (a brief dip/spike shouldn't erase progress
      // toward a state flip that's otherwise consistent).
    }

    if (!this.degradedState && this.aboveCount >= DEGRADE_FRAMES) {
      this.degradedState = true;
      this.belowCount = 0;
    } else if (this.degradedState && this.belowCount >= RECOVER_FRAMES) {
      this.degradedState = false;
      this.aboveCount = 0;
    }

    return this.degradedState;
  }

  reset(): void {
    this.ema = 0;
    this.primed = false;
    this.aboveCount = 0;
    this.belowCount = 0;
    this.degradedState = false;
  }
}

// ---------------------------------------------------------------------------
// v12 Commit 2 (§Commit 2): parallax transform math, factored out as a pure
// function so it can be unit-tested without a canvas. `factor` is how much
// of the camera's zoom/pan a given plane feels: 0 = screen-fixed ("infinite"
// distance, e.g. the sky), 1 = the normal full camera transform (terrain +
// entities). Returns the three transform steps main.ts's withParallax()
// applies in order: translate(tx1,ty1) -> scale(z,z) -> translate(tx2,ty2).
//
// Identity proof at camZoom === 1: updateCamera() clamps camX/camY to
// exactly width/2, height/2 whenever the viewport (width/camZoom) fills the
// full level width (i.e. camZoom === 1), so (camX - width/2) and
// (camY - height/2) are both 0 regardless of factor, making z = 1 and
// tx2/ty2 collapse to -width/2/-height/2 for every factor — the same result
// the existing factor-1.0 camera transform already produces. Covered by
// __tests__/perf.test.ts.
// ---------------------------------------------------------------------------
export function parallaxTransform(
  factor: number,
  camX: number,
  camY: number,
  camZoom: number,
  width: number,
  height: number
): { tx1: number; ty1: number; z: number; tx2: number; ty2: number } {
  const z = 1 + (camZoom - 1) * factor;
  return {
    tx1: width / 2,
    ty1: height / 2,
    z,
    tx2: -(width / 2 + (camX - width / 2) * factor),
    ty2: -(height / 2 + (camY - height / 2) * factor),
  };
}
