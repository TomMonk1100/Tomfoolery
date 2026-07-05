/**
 * SeasonSystem — divides the run timer into four equal season windows
 * (spring/summer/autumn/winter per SEASON_ORDER) and emits EV.seasonChanged
 * at each boundary. WorldScene wires `ctx.season()` to `currentSeason()`.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV, RUN_LENGTH_MS, SEASON_ORDER, Season } from "../core/types";

const WINDOW_MS = RUN_LENGTH_MS / SEASON_ORDER.length;

export class SeasonSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private elapsedMs = 0;
  private seasonIndex = 0;
  private runEndedEmitted = false;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    if (this.runEndedEmitted) return;

    this.elapsedMs += deltaMs;

    const targetIndex = Math.min(
      SEASON_ORDER.length - 1,
      Math.floor(this.elapsedMs / WINDOW_MS)
    );

    while (this.seasonIndex < targetIndex) {
      this.seasonIndex++;
      this.announceSeason(SEASON_ORDER[this.seasonIndex]);
    }

    // Final winter window elapsed: end the run.
    if (
      this.seasonIndex === SEASON_ORDER.length - 1 &&
      this.elapsedMs >= RUN_LENGTH_MS
    ) {
      this.runEndedEmitted = true;
      this.ctx.events.emit(EV.runEnded);
    }
  }

  destroy(): void {
    // No listeners registered; nothing to tear down.
  }

  currentSeason(): Season {
    return SEASON_ORDER[this.seasonIndex];
  }

  /** 0..1 progress through the whole run. */
  progress(): number {
    return Phaser.Math.Clamp(this.elapsedMs / RUN_LENGTH_MS, 0, 1);
  }

  private announceSeason(season: Season): void {
    this.ctx.player.stats.seasonsCompleted++;
    this.ctx.audio.setSeasonMood(season);
    this.ctx.events.emit(EV.seasonChanged, season);
  }
}
