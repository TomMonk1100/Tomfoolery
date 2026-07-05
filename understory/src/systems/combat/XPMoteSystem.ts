/**
 * XPMoteSystem — pooled XP motes (cap 200). Overflow merges value into the
 * nearest live mote rather than dropping it. Magnets toward the player inside
 * XP_MAGNET_RADIUS * (1 + statBonus("pickupRadius")/100); collects at <14px.
 *
 * DECISIONS:
 * - "Overflow merges value into nearest live mote" — nearest is measured from
 *   the spawn position requested, using plain Euclidean distance over all
 *   currently-active motes (pool is small enough that this is cheap).
 * - Sprite: xpMote (anim sparkle) if the atlas has it, else a 5px gold circle.
 */
import Phaser from "phaser";
import { GameContext, System } from "../../core/context";
import { EV } from "../../core/context";
import { SPRITE_KEYS, frameKey, playAnim } from "../../gfx/PixelArt";
import { XP_MAGNET_RADIUS } from "../../core/types";
import {
  distance,
  moteStep,
  moteMagnetRadius,
  makeMoteMagnetState,
  MoteMagnetState,
} from "./sim";

const MAX_MOTES = 200;
const FALLBACK_RADIUS = 5;

interface MoteInstance {
  active: boolean;
  x: number;
  y: number;
  value: number;
  magnetState: MoteMagnetState;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null;
}

export class XPMoteSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private pool: MoteInstance[] = [];

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    ctx.registerCombatProvider({
      spawnXPMote: (x, y, value) => this.spawnXPMote(x, y, value),
    });
  }

  activeCount(): number {
    return this.pool.filter((m) => m.active).length;
  }

  spawnXPMote(x: number, y: number, value: number): void {
    if (this.activeCount() >= MAX_MOTES) {
      const nearest = this.findNearestActive(x, y);
      if (nearest) {
        nearest.value += value;
        return;
      }
      // No active motes at all somehow (cap misconfigured) — drop silently.
      return;
    }

    let inst = this.pool.find((m) => !m.active);
    if (!inst) {
      inst = this.makeBlank();
      this.pool.push(inst);
    }

    inst.active = true;
    inst.x = x;
    inst.y = y;
    inst.value = value;
    inst.magnetState = makeMoteMagnetState();

    this.attachVisual(inst);

    this.ctx.events.emit(EV.xpMoteSpawned, { x, y, value });
  }

  private findNearestActive(x: number, y: number): MoteInstance | null {
    let best: MoteInstance | null = null;
    let bestDist = Infinity;
    for (const m of this.pool) {
      if (!m.active) continue;
      const d = distance({ x, y }, m);
      if (d < bestDist) {
        bestDist = d;
        best = m;
      }
    }
    return best;
  }

  private makeBlank(): MoteInstance {
    return {
      active: false,
      x: 0,
      y: 0,
      value: 0,
      magnetState: makeMoteMagnetState(),
      sprite: null,
    };
  }

  private attachVisual(inst: MoteInstance): void {
    if (inst.sprite) {
      inst.sprite.destroy();
      inst.sprite = null;
    }
    const fk = frameKey(SPRITE_KEYS.xpMote);
    if (this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(inst.x, inst.y, fk);
      s.setDepth(800);
      playAnim(s, SPRITE_KEYS.xpMote, "sparkle");
      inst.sprite = s;
    } else {
      const s = this.scene.add.circle(inst.x, inst.y, FALLBACK_RADIUS, 0xe8b23d);
      s.setDepth(800);
      inst.sprite = s;
    }
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    const playerPos = this.ctx.getPlayerPos();
    const radius = moteMagnetRadius(
      XP_MAGNET_RADIUS,
      this.ctx.statBonus("pickupRadius")
    );

    for (const inst of this.pool) {
      if (!inst.active) continue;

      const result = moteStep(inst.magnetState, inst, playerPos, radius, deltaMs);

      if (result.collected) {
        this.ctx.addXP(inst.value);
        this.ctx.events.emit(EV.xpMoteCollected, { value: inst.value });
        this.ctx.audio.blip("xpPickup");
        this.release(inst);
        continue;
      }

      inst.x += result.dx;
      inst.y += result.dy;
      if (inst.sprite) inst.sprite.setPosition(inst.x, inst.y);
    }
  }

  private release(inst: MoteInstance): void {
    if (inst.sprite) {
      inst.sprite.destroy();
      inst.sprite = null;
    }
    inst.active = false;
  }

  destroy(): void {
    for (const inst of this.pool) {
      if (inst.sprite) inst.sprite.destroy();
    }
    this.pool = [];
  }
}
