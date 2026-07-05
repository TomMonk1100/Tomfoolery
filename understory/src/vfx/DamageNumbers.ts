/**
 * DamageNumbers — pooled floating combat text. Listens ONLY to ctx.events;
 * zero coupling to combat internals.
 *
 * DECISIONS:
 * - "bitmap-style text" is interpreted as a regular Phaser BitmapText-less
 *   `Text` object styled with a monospace bold font (no bitmap font asset
 *   exists in the atlas pipeline owned by Worker A/E boundaries), which is
 *   the simplest interpretation that satisfies the visual spec without
 *   inventing a new asset dependency.
 * - EV.xpMoteCollected is explicitly skipped per spec (too frequent).
 * - Pool size 48 (>= required 40).
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import { EV, EnemyDamagedEvent } from "../core/types";

const POOL_SIZE = 48;
const FLOAT_PX = 28;
const FLOAT_MS = 550;
const HEAL_FLOAT_MS = 650;

interface PooledText {
  obj: Phaser.GameObjects.Text;
  ageMs: number;
  lifeMs: number;
  startY: number;
  vx: number;
  active: boolean;
}

export class DamageNumbers implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private pool: PooledText[] = [];

  private onEnemyDamaged = (payload: EnemyDamagedEvent): void => {
    try {
      this.spawn({
        x: payload.x,
        y: payload.y - 10,
        text: Math.round(payload.amount).toString(),
        crit: !!payload.crit,
        color: payload.crit ? "#e8b23d" : "#f4f0e8",
        size: payload.crit ? 17 : 13,
      });
    } catch (err) {
      console.warn("[DamageNumbers] enemyDamaged handler failed", err);
    }
  };

  private onFoodEaten = (): void => {
    try {
      const pos = this.ctx.getPlayerPos();
      this.spawn({
        x: pos.x,
        y: pos.y - 10,
        text: "+heal",
        crit: false,
        color: "#7bb661",
        size: 14,
      });
    } catch (err) {
      console.warn("[DamageNumbers] foodEaten handler failed", err);
    }
  };

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    for (let i = 0; i < POOL_SIZE; i++) {
      const obj = scene.add.text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#f4f0e8",
      });
      obj.setOrigin(0.5, 0.5);
      obj.setDepth(2000);
      obj.setVisible(false);
      obj.setActive(false);
      this.pool.push({
        obj,
        ageMs: 0,
        lifeMs: FLOAT_MS,
        startY: 0,
        vx: 0,
        active: false,
      });
    }

    ctx.events.on(EV.enemyDamaged, this.onEnemyDamaged);
    ctx.events.on(EV.foodEaten, this.onFoodEaten);
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    for (const p of this.pool) {
      if (!p.active) continue;
      p.ageMs += deltaMs;
      const t = Math.min(1, p.ageMs / p.lifeMs);
      p.obj.y = p.startY - FLOAT_PX * t;
      p.obj.x += p.vx * (deltaMs / 1000);
      p.obj.setAlpha(1 - t);
      if (t >= 1) {
        p.active = false;
        p.obj.setVisible(false);
        p.obj.setActive(false);
      }
    }
  }

  destroy(): void {
    this.ctx.events.off(EV.enemyDamaged, this.onEnemyDamaged);
    this.ctx.events.off(EV.foodEaten, this.onFoodEaten);
    for (const p of this.pool) p.obj.destroy();
    this.pool = [];
  }

  private spawn(opts: {
    x: number;
    y: number;
    text: string;
    crit: boolean;
    color: string;
    size: number;
  }): void {
    const slot = this.pool.find((p) => !p.active);
    if (!slot) return; // pool exhausted, drop silently

    const jitterX = (Math.random() - 0.5) * 14;
    slot.obj.setText(opts.text);
    slot.obj.setColor(opts.color);
    slot.obj.setFontSize(opts.size);
    slot.obj.setPosition(opts.x + jitterX, opts.y);
    slot.obj.setAlpha(1);
    slot.obj.setScale(opts.crit ? 1.3 : 1);
    slot.obj.setVisible(true);
    slot.obj.setActive(true);
    slot.startY = opts.y;
    slot.vx = jitterX * 0.6;
    slot.ageMs = 0;
    slot.lifeMs = opts.text === "+heal" ? HEAL_FLOAT_MS : FLOAT_MS;
    slot.active = true;

    if (opts.crit) {
      this.scene.tweens.add({
        targets: slot.obj,
        scale: 1.0,
        duration: 140,
        ease: "Back.Out",
      });
    }
  }
}
