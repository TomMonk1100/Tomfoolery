/**
 * HazardSystem — spawns simple drifting hazard shapes per-season and applies
 * EV.hazardHit when one overlaps the player while not evading.
 *
 * Minimal/programmer-art: hazards are plain Phaser.GameObjects.Arc/Rectangle
 * that drift in a fixed direction and are recycled once off-bounds.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV, Season } from "../core/types";
import { VerbSystem } from "./VerbSystem";

interface HazardSpawnConfig {
  /** ms between spawns. */
  intervalMs: number;
  /** px/sec drift speed. */
  speed: number;
  /** Visual radius/size in px. */
  size: number;
  /** Fill color for the programmer-art shape. */
  color: number;
  /** Damage amount reported in EV.hazardHit. */
  damage: number;
}

const SEASON_TABLES: Partial<Record<Season, HazardSpawnConfig>> = {
  spring: { intervalMs: 4200, speed: 40, size: 10, color: 0xbcd8a5, damage: 5 },
  summer: { intervalMs: 3200, speed: 70, size: 16, color: 0x3a3a3a, damage: 8 },
  autumn: { intervalMs: 2600, speed: 90, size: 12, color: 0xc9a45c, damage: 7 },
  winter: { intervalMs: 2200, speed: 60, size: 20, color: 0xdfefff, damage: 10 },
};

interface ActiveHazard {
  obj: Phaser.GameObjects.Arc;
  vx: number;
  vy: number;
  damage: number;
}

export class HazardSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private verbSystem: VerbSystem | null = null;
  /** Fallback tracker if setVerbSystem() is never called — driven by EV.evadeSuccess. */
  private evadingUntilMs = 0;

  private currentTable: HazardSpawnConfig;
  private spawnTimerMs = 0;
  private hazards: ActiveHazard[] = [];

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.currentTable = this.resolveTable(this.ctx.season());

    this.ctx.events.on(EV.seasonChanged, this.onSeasonChanged, this);
    this.ctx.events.on(EV.evadeSuccess, this.onEvadeSuccess, this);
  }

  /** Optional wiring so HazardSystem can query VerbSystem.isEvading() directly. */
  setVerbSystem(v: VerbSystem): void {
    this.verbSystem = v;
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    this.spawnTimerMs += deltaMs;
    if (this.spawnTimerMs >= this.currentTable.intervalMs) {
      this.spawnTimerMs = 0;
      this.spawnHazard();
    }

    const bounds = this.ctx.world.bounds();
    const playerPos = this.ctx.getPlayerPos();
    const dt = deltaMs / 1000;

    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const h = this.hazards[i];
      h.obj.x += h.vx * dt;
      h.obj.y += h.vy * dt;

      const margin = h.obj.radius * 2;
      const offBounds =
        h.obj.x < -margin ||
        h.obj.x > bounds.width + margin ||
        h.obj.y < -margin ||
        h.obj.y > bounds.height + margin;

      if (offBounds) {
        h.obj.destroy();
        this.hazards.splice(i, 1);
        continue;
      }

      const dist = Phaser.Math.Distance.Between(
        h.obj.x,
        h.obj.y,
        playerPos.x,
        playerPos.y
      );
      const hitRadius = h.obj.radius + 12; // approximate player radius

      if (dist <= hitRadius && !this.isEvading()) {
        this.ctx.player.stats.hazardHitsTaken++;
        this.ctx.events.emit(EV.hazardHit, { amount: h.damage });
        h.obj.destroy();
        this.hazards.splice(i, 1);
      }
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.seasonChanged, this.onSeasonChanged, this);
    this.ctx.events.off(EV.evadeSuccess, this.onEvadeSuccess, this);
    for (const h of this.hazards) h.obj.destroy();
    this.hazards = [];
  }

  private isEvading(): boolean {
    if (this.verbSystem) return this.verbSystem.isEvading();
    return this.scene.time.now < this.evadingUntilMs;
  }

  private onEvadeSuccess(): void {
    // Mirror VerbSystem's EVADE_WINDOW_MS if no direct reference was wired.
    this.evadingUntilMs = this.scene.time.now + 600;
  }

  private onSeasonChanged(season: Season): void {
    this.currentTable = this.resolveTable(season);
    this.spawnTimerMs = 0;
  }

  private resolveTable(season: Season): HazardSpawnConfig {
    const table = SEASON_TABLES[season];
    if (table) return table;
    if (import.meta.env.DEV) {
      console.warn(
        `[HazardSystem] no spawn table for season "${season}", falling back to spring`
      );
    }
    return SEASON_TABLES.spring as HazardSpawnConfig;
  }

  private spawnHazard(): void {
    const bounds = this.ctx.world.bounds();
    const cfg = this.currentTable;

    // Spawn along a random edge, drift roughly toward the opposite side.
    const edge = Phaser.Math.Between(0, 3);
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;

    switch (edge) {
      case 0: // top -> down
        x = Phaser.Math.Between(0, bounds.width);
        y = -cfg.size;
        vx = Phaser.Math.FloatBetween(-0.3, 0.3) * cfg.speed;
        vy = cfg.speed;
        break;
      case 1: // bottom -> up
        x = Phaser.Math.Between(0, bounds.width);
        y = bounds.height + cfg.size;
        vx = Phaser.Math.FloatBetween(-0.3, 0.3) * cfg.speed;
        vy = -cfg.speed;
        break;
      case 2: // left -> right
        x = -cfg.size;
        y = Phaser.Math.Between(0, bounds.height);
        vx = cfg.speed;
        vy = Phaser.Math.FloatBetween(-0.3, 0.3) * cfg.speed;
        break;
      default: // right -> left
        x = bounds.width + cfg.size;
        y = Phaser.Math.Between(0, bounds.height);
        vx = -cfg.speed;
        vy = Phaser.Math.FloatBetween(-0.3, 0.3) * cfg.speed;
        break;
    }

    const obj = this.scene.add.circle(x, y, cfg.size / 2, cfg.color, 0.85);
    obj.setDepth(5);

    this.hazards.push({ obj, vx, vy, damage: cfg.damage });
  }
}
