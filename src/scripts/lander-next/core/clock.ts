import { FIXED_DT, MAX_FRAME_TIME } from '../content/balance';

export interface ClockResult { steps: number; alpha: number; droppedTime: number; }

export class FixedClock {
  private accumulator = 0;
  private last = 0;
  paused = false;
  droppedTime = 0;

  reset(now = performance.now()): void { this.last = now; this.accumulator = 0; }
  advance(now: number, step: (dt: number) => void): ClockResult {
    if (!this.last) this.reset(now);
    const elapsed = Math.min(MAX_FRAME_TIME, Math.max(0, (now - this.last) / 1000));
    this.last = now;
    if (this.paused) return { steps: 0, alpha: 0, droppedTime: 0 };
    this.accumulator += elapsed;
    let steps = 0;
    while (this.accumulator >= FIXED_DT && steps < 6) { step(FIXED_DT); this.accumulator -= FIXED_DT; steps += 1; }
    if (this.accumulator >= FIXED_DT) { this.droppedTime += this.accumulator; this.accumulator = 0; }
    return { steps, alpha: this.accumulator / FIXED_DT, droppedTime: this.droppedTime };
  }
  pause(now = performance.now()): void { this.paused = true; this.reset(now); }
  resume(now = performance.now()): void { this.paused = false; this.reset(now); }
}
