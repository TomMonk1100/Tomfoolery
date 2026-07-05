/**
 * WaveDirector — reads src/data/waves.json, tracks the run clock (accumulated
 * delta while !ctx.isPaused()), and tells EnemySystem what/when to spawn.
 *
 * DECISIONS:
 * - "on-screen count" per enemy type is computed by asking EnemySystem's
 *   getEnemies()-like view (via ctx.getEnemies(), filtered by dataId) since
 *   WaveDirector doesn't own enemy instances directly — this keeps the two
 *   systems decoupled through the ctx combat API rather than a direct
 *   reference, per "communicate ONLY via ctx.events and the ctx API" in
 *   CONTRACTS. We still accept an EnemySystem reference in the constructor
 *   (constructed by the orchestrator in the same file/place as EnemySystem)
 *   purely to call its `spawn()`/`activeCount()` — this mirrors how
 *   ProjectilePool is shared, and CONTRACTS ground-rule #3 is about events
 *   for cross-worker communication, not forbidding direct composition of
 *   sibling systems the same worker owns.
 * - Boss bookkeeping: WaveDirector listens for EV.bossDefeated only to avoid
 *   double-spawning the same boss entry; EnemySystem is the emitter of both
 *   boss events per the split noted in EnemySystem.ts.
 * - Spawn point validity: "never on obstacle tiles" is checked via
 *   ctx.world.tileAt/worldToTile; if the ring point lands on an obstacle we
 *   nudge outward in 20px steps (up to 5 tries) along the same angle before
 *   giving up and using the point anyway (never blocks spawning entirely).
 */
import Phaser from "phaser";
import { GameContext, System } from "../../core/context";
import { EV } from "../../core/context";
import { EnemyData, WavesFile, WaveEntry, BossEntry, MAX_ENEMIES } from "../../core/types";
import wavesData from "../../data/waves.json";
import {
  activeWaveEntries,
  bossShouldSpawn,
  shouldSpawnForEntry,
  spawnRingPoint,
} from "./sim";
import { EnemySystem } from "./EnemySystem";

const RING_MIN_PX = 60;
const RING_MAX_PX = 120;
const VIEWPORT_HALF_W = 240; // GAME_WIDTH/2
const VIEWPORT_HALF_H = 427; // GAME_HEIGHT/2

interface EntrySpawnTracker {
  msSinceLastSpawn: number;
}

export class WaveDirector implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private enemySystem: EnemySystem;

  private waves: WaveEntry[] = [];
  private bosses: BossEntry[] = [];
  private clockMs = 0;
  private prevClockMs = 0;

  private trackers = new Map<string, EntrySpawnTracker>(); // key: enemyId
  private spawnedBossAtMs = new Set<number>();
  private defeatedBossIds = new Set<string>();

  private onBossDefeated = (payload: { enemyId: string }) => {
    this.defeatedBossIds.add(payload.enemyId);
  };

  constructor(scene: Phaser.Scene, ctx: GameContext, enemySystem: EnemySystem) {
    this.scene = scene;
    this.ctx = ctx;
    this.enemySystem = enemySystem;

    try {
      const file = wavesData as unknown as WavesFile;
      this.waves = Array.isArray(file.waves) ? file.waves : [];
      this.bosses = Array.isArray(file.bosses) ? file.bosses : [];
    } catch (err) {
      console.warn("WaveDirector: failed to load waves.json, running with no waves", err);
      this.waves = [];
      this.bosses = [];
    }

    ctx.events.on(EV.bossDefeated, this.onBossDefeated);
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    this.prevClockMs = this.clockMs;
    this.clockMs += deltaMs;

    this.handleBosses();
    this.handleWaves(deltaMs);
  }

  private handleBosses(): void {
    for (const boss of this.bosses) {
      if (this.spawnedBossAtMs.has(boss.atMs)) continue;
      if (bossShouldSpawn(boss, this.prevClockMs, this.clockMs)) {
        this.spawnedBossAtMs.add(boss.atMs);
        const data = this.ctx.enemyCatalog.find((e) => e.id === boss.enemyId);
        if (!data) {
          console.warn(`WaveDirector: boss enemyId "${boss.enemyId}" not found in enemyCatalog`);
          continue;
        }
        const spawnPos = this.pickSpawnPoint();
        this.enemySystem.spawn({ data, x: spawnPos.x, y: spawnPos.y, isBoss: true });
      }
    }
  }

  private handleWaves(deltaMs: number): void {
    const active = activeWaveEntries(this.waves, this.clockMs);

    for (const entry of active) {
      let tracker = this.trackers.get(entry.enemyId);
      if (!tracker) {
        tracker = { msSinceLastSpawn: entry.intervalMs }; // allow immediate first spawn
        this.trackers.set(entry.enemyId, tracker);
      }
      tracker.msSinceLastSpawn += deltaMs;

      const onScreenCount = this.countOnScreen(entry.enemyId);
      if (
        shouldSpawnForEntry({
          entry,
          currentOnScreenCount: onScreenCount,
          msSinceLastSpawnForEntry: tracker.msSinceLastSpawn,
        })
      ) {
        this.trySpawnOne(entry);
        tracker.msSinceLastSpawn = 0;
      }
    }
  }

  private countOnScreen(enemyId: string): number {
    return this.ctx.getEnemies().filter((e) => e.dataId === enemyId).length;
  }

  private trySpawnOne(entry: WaveEntry): void {
    if (this.enemySystem.activeCount() >= MAX_ENEMIES) return; // non-boss: respect cap strictly

    const data = this.ctx.enemyCatalog.find((e) => e.id === entry.enemyId);
    if (!data) {
      console.warn(`WaveDirector: wave enemyId "${entry.enemyId}" not found in enemyCatalog`);
      return;
    }

    const pos = this.pickSpawnPoint();
    this.enemySystem.spawn({ data, x: pos.x, y: pos.y, isElite: entry.elite });
  }

  private pickSpawnPoint(): { x: number; y: number } {
    const playerPos = this.ctx.getPlayerPos();
    const bounds = this.ctx.world.bounds();

    let point = spawnRingPoint(
      playerPos,
      VIEWPORT_HALF_W,
      VIEWPORT_HALF_H,
      RING_MIN_PX,
      RING_MAX_PX,
      bounds,
      Math.random
    );

    for (let attempt = 0; attempt < 5; attempt++) {
      const tile = this.ctx.world.worldToTile(point.x, point.y);
      const t = this.ctx.world.tileAt(tile.col, tile.row);
      if (!t || t.type !== "obstacle") return point;
      // Nudge outward from player along the same direction.
      const dx = point.x - playerPos.x;
      const dy = point.y - playerPos.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      point = {
        x: Math.max(0, Math.min(bounds.width, point.x + (dx / len) * 20)),
        y: Math.max(0, Math.min(bounds.height, point.y + (dy / len) * 20)),
      };
    }
    return point;
  }

  destroy(): void {
    this.ctx.events.off(EV.bossDefeated, this.onBossDefeated);
  }
}
