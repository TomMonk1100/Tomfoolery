/**
 * Particles — pooled small-square particle system driven entirely by
 * ctx.events. No coupling to combat internals beyond reading event payloads
 * and PALETTE colors.
 *
 * DECISIONS:
 * - Family tinting is a prefix match on `enemyDataId` (spec: "slime green/red
 *   /blue via enemyDataId prefix match, purple for gloomcap"). Anything else
 *   (gloomcap handled explicitly, thorn-crawler/wisp/mudmaw/bosses) falls back
 *   to PALETTE.outline-ish neutral (brown) since no other family color was
 *   specified — simplest interpretation, keeps bosses/others readable without
 *   inventing new palette entries.
 * - EV.weaponFired aoe-pulse puff: only fires for weaponId containing "bark"
 *   or "thumper" per spec's explicit optional carve-out; every other weapon
 *   fire is fully ignored (too frequent).
 * - Global particle budget (220) skips only *cosmetic* spawns (sparks, hit
 *   fx, small pops); boss shower and any future "important" bursts are never
 *   throttled per spec ("keep boss/level-up ones"). enemyKilled bursts count
 *   as cosmetic and are throttled like the rest — the spec's protected list
 *   only names boss/level-up VFX, which live in ScreenFX/Juice, not here.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import {
  EV,
  EnemyKilledEvent,
  EnemyDamagedEvent,
  PlayerDamagedEvent,
  WeaponFiredEvent,
} from "../core/types";
const POOL_SIZE = 180;
const GLOBAL_BUDGET = 220;

interface Particle {
  rect: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
  ageMs: number;
  lifeMs: number;
  startSize: number;
  active: boolean;
  drag: number;
}

function familyColor(enemyDataId: string): number {
  if (enemyDataId.startsWith("slime-green")) return 0x5fd35f;
  if (enemyDataId.startsWith("slime-red")) return 0xd94f4f;
  if (enemyDataId.startsWith("slime-blue")) return 0x3a6ea5;
  if (enemyDataId.startsWith("gloomcap")) return 0x8b5fbf;
  return 0x7a5c3a; // neutral fallback family color
}

export class Particles implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private pool: Particle[] = [];
  /** Tracked delayed timer so a stuck slow-mo can never persist. */
  private slowMoTimer: Phaser.Time.TimerEvent | null = null;

  private onEnemyKilled = (payload: EnemyKilledEvent): void => {
    try {
      if (!this.hasBudget()) return;
      const count = Phaser.Math.Between(8, 12);
      this.burst(payload.x, payload.y, count, familyColor(payload.enemyDataId), {
        speedMin: 40,
        speedMax: 120,
        lifeMs: 400,
        sizeMin: 3,
        sizeMax: 5,
        drag: 0.9,
      });
    } catch (err) {
      console.warn("[Particles] enemyKilled handler failed", err);
    }
  };

  private onEnemyDamaged = (payload: EnemyDamagedEvent): void => {
    try {
      if (!this.hasBudget()) return;
      this.burst(payload.x, payload.y, Phaser.Math.Between(2, 3), 0xf4f0e8, {
        speedMin: 60,
        speedMax: 140,
        lifeMs: 250,
        sizeMin: 2,
        sizeMax: 3,
        drag: 0.85,
      });
    } catch (err) {
      console.warn("[Particles] enemyDamaged handler failed", err);
    }
  };

  private onPlayerDamaged = (_payload: PlayerDamagedEvent): void => {
    try {
      const pos = this.ctx.getPlayerPos();
      // Player-hit feedback is never throttled by the cosmetic budget —
      // it's rare (contact-tick gated) and important for readability.
      this.burst(pos.x, pos.y, 6, 0xd94f4f, {
        speedMin: 50,
        speedMax: 130,
        lifeMs: 350,
        sizeMin: 3,
        sizeMax: 5,
        drag: 0.88,
      });
    } catch (err) {
      console.warn("[Particles] playerDamaged handler failed", err);
    }
  };

  private onFoodSpawned = (payload: { x: number; y: number; heal: number }): void => {
    try {
      if (!this.hasBudget()) return;
      this.burst(payload.x, payload.y, 4, 0x7bb661, {
        speedMin: 20,
        speedMax: 50,
        lifeMs: 300,
        sizeMin: 2,
        sizeMax: 3,
        drag: 0.9,
      });
    } catch (err) {
      console.warn("[Particles] foodSpawned handler failed", err);
    }
  };

  private onBossDefeated = (): void => {
    try {
      const pos = this.ctx.getPlayerPos();
      // Boss shower is explicitly protected from the cosmetic budget.
      this.burst(pos.x, pos.y, 40, 0xe8b23d, {
        speedMin: 60,
        speedMax: 200,
        lifeMs: 700,
        sizeMin: 3,
        sizeMax: 5,
        drag: 0.92,
      });
      this.triggerSlowMo();
    } catch (err) {
      console.warn("[Particles] bossDefeated handler failed", err);
    }
  };

  private onWeaponFired = (payload: WeaponFiredEvent): void => {
    try {
      if (!this.hasBudget()) return;
      const id = payload.weaponId ?? "";
      if (!(id.includes("bark") || id.includes("thumper"))) return;
      this.burst(payload.x, payload.y, 4, 0xf4f0e8, {
        speedMin: 15,
        speedMax: 40,
        lifeMs: 220,
        sizeMin: 2,
        sizeMax: 3,
        drag: 0.9,
      });
    } catch (err) {
      console.warn("[Particles] weaponFired handler failed", err);
    }
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    for (let i = 0; i < POOL_SIZE; i++) {
      const rect = scene.add.rectangle(0, 0, 4, 4, 0xffffff);
      rect.setDepth(1500);
      rect.setVisible(false);
      rect.setActive(false);
      this.pool.push({
        rect,
        vx: 0,
        vy: 0,
        ageMs: 0,
        lifeMs: 400,
        startSize: 4,
        active: false,
        drag: 0.9,
      });
    }

    ctx.events.on(EV.enemyKilled, this.onEnemyKilled);
    ctx.events.on(EV.enemyDamaged, this.onEnemyDamaged);
    ctx.events.on(EV.playerDamaged, this.onPlayerDamaged);
    ctx.events.on(EV.foodSpawned, this.onFoodSpawned);
    ctx.events.on(EV.bossDefeated, this.onBossDefeated);
    ctx.events.on(EV.weaponFired, this.onWeaponFired);
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.ageMs += deltaMs;
      const t = Math.min(1, p.ageMs / p.lifeMs);
      const dtSec = deltaMs / 1000;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.rect.x += p.vx * dtSec;
      p.rect.y += p.vy * dtSec;
      p.rect.setAlpha(1 - t);
      const scale = 1 - 0.6 * t;
      p.rect.setDisplaySize(p.startSize * scale, p.startSize * scale);
      if (t >= 1) {
        p.active = false;
        p.rect.setVisible(false);
        p.rect.setActive(false);
      }
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.enemyKilled, this.onEnemyKilled);
    this.ctx.events.off(EV.enemyDamaged, this.onEnemyDamaged);
    this.ctx.events.off(EV.playerDamaged, this.onPlayerDamaged);
    this.ctx.events.off(EV.foodSpawned, this.onFoodSpawned);
    this.ctx.events.off(EV.bossDefeated, this.onBossDefeated);
    this.ctx.events.off(EV.weaponFired, this.onWeaponFired);
    if (this.slowMoTimer) {
      this.slowMoTimer.remove();
      this.slowMoTimer = null;
    }
    this.scene.time.timeScale = 1;
    for (const p of this.pool) p.rect.destroy();
    this.pool = [];
  }

  /** Active-particle count against the global cosmetic budget. */
  private activeCount(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  private hasBudget(): boolean {
    return this.activeCount() < GLOBAL_BUDGET;
  }

  private burst(
    x: number,
    y: number,
    count: number,
    color: number,
    opts: {
      speedMin: number;
      speedMax: number;
      lifeMs: number;
      sizeMin: number;
      sizeMax: number;
      drag: number;
    }
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.pool.find((p) => !p.active);
      if (!slot) return; // pool exhausted, drop silently
      const angle = Math.random() * Math.PI * 2;
      const speed = Phaser.Math.FloatBetween(opts.speedMin, opts.speedMax);
      const size = Phaser.Math.FloatBetween(opts.sizeMin, opts.sizeMax);
      slot.rect.setFillStyle(color);
      slot.rect.setPosition(x, y);
      slot.rect.setDisplaySize(size, size);
      slot.rect.setAlpha(1);
      slot.rect.setVisible(true);
      slot.rect.setActive(true);
      slot.vx = Math.cos(angle) * speed;
      slot.vy = Math.sin(angle) * speed;
      slot.ageMs = 0;
      slot.lifeMs = opts.lifeMs;
      slot.startSize = size;
      slot.drag = opts.drag;
      slot.active = true;
    }
  }

  /** Brief slow-mo on boss defeat; timer is tracked so restore can never stick. */
  private triggerSlowMo(): void {
    if (this.slowMoTimer) {
      this.slowMoTimer.remove();
      this.slowMoTimer = null;
    }
    this.scene.time.timeScale = 0.4;
    this.slowMoTimer = this.scene.time.addEvent({
      delay: 350,
      callback: () => {
        this.scene.time.timeScale = 1;
        this.slowMoTimer = null;
      },
    });
  }
}
