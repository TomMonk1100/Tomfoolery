// ---------------------------------------------------------------------------
// v12 Commit 7 (§Commit 7): the shared gate for every additive ('lighter')
// composite added across this plan — flame glow, ground light pool, beacon
// halos, tracer shots, the UFO telegraph cone, the spark particle pass, and
// the canister pulse. Every one of those call sites routes through here so
// the DegradationGuard has exactly one lever to pull.
//
// When NOT degraded: normal behavior, 'lighter' compositing (real bloom).
// When degraded: falls back to plain source-over at 0.6x alpha instead of
// disabling the effect outright — cheaper to composite, still reads. The
// 0.6x is applied by scaling whatever globalAlpha was already in effect
// (not replacing it), so callers that were already dimmed for another
// reason (e.g. drawPad's fog-visibility alpha) compound correctly.
// ---------------------------------------------------------------------------

export function addGlow(ctx: CanvasRenderingContext2D, degraded: boolean, fn: () => void): void {
  ctx.save();
  if (degraded) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ctx.globalAlpha * 0.6;
  } else {
    ctx.globalCompositeOperation = 'lighter';
  }
  fn();
  ctx.restore();
}
