/**
 * ProjectilePool — generic pooled projectiles shared by WeaponSystem (friendly
 * shots) and EnemySystem (enemy shots, e.g. Gloomcap). Caps at MAX_PROJECTILES.
 *
 * Thin shell: owns Phaser sprites; all math (movement, arc/lob, boomerang
 * out-and-back, pierce/hit counting) lives inline here since it's simple
 * per-projectile bookkeeping, but the direction/lob vectors are computed via
 * sim.ts helpers where shared (directionTo).
 *
 * DECISIONS:
 * - "arc" (lobbed) projectiles use a simple parabolic height offset purely
 *   for the sprite's visual y-offset (scale pulse as a cheap fake-3D lob);
 *   ground-plane motion is linear toward the landing point, arriving at
 *   `speed` average pace over `area` px range, then dealing AoE 40px damage
 *   once and despawning.
 * - "boomerang" travels out to `area` px from its spawn point then reverses
 *   back toward its origin's *current* thrower position is NOT tracked (no
 *   coupling back to player each frame needed) — instead it reverses back
 *   along the same line to its spawn origin. Simplest interpretation per
 *   CONTRACTS ambiguity.
 * - Friendly projectiles ignore the player and hit enemies; enemy projectiles
 *   ignore enemies and hit the player only. This is enforced by the `owner`
 *   flag passed at spawn time.
 * - Pierce count: number of *additional* enemies a projectile may hit beyond
 *   the first (so pierce=0 means despawn after first hit unless it's a
 *   split/boomerang special-case below).
 */
import Phaser from "phaser";
import { GameContext } from "../../core/context";
import { MAX_PROJECTILES } from "../../core/types";
import { frameKey } from "../../gfx/PixelArt";
import { directionTo, distance, Vec2 } from "./sim";

export type ProjectileOwner = "friendly" | "enemy";
export type ProjectileKind = "straight" | "arc" | "boomerang" | "split";

export interface ProjectileSpawnParams {
  owner: ProjectileOwner;
  kind: ProjectileKind;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number; // px/s
  damage: number;
  crit: boolean;
  area: number; // range for straight/arc landing distance; boomerang out-distance
  pierce: number; // additional hits allowed beyond the first
  splitCount?: number;
  spriteKey?: string;
  /** Depth override; defaults to 950 per CONTRACTS. */
  weaponId?: string;
  /** Internal: generation depth to prevent infinite split recursion. */
  splitGeneration?: number;
}

interface ProjectileInstance {
  active: boolean;
  owner: ProjectileOwner;
  kind: ProjectileKind;
  x: number;
  y: number;
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  speed: number;
  damage: number;
  crit: boolean;
  area: number;
  pierce: number;
  hitsLanded: number;
  splitCount: number;
  splitGeneration: number;
  travelled: number;
  boomerangReturning: boolean;
  hitEnemyIds: Set<string>;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null;
  usingFallback: boolean;
}

const DEFAULT_FALLBACK_RADIUS = 4;
const DEPTH = 950;
const MAX_SPLIT_GENERATIONS = 1;

export class ProjectilePool {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private pool: ProjectileInstance[] = [];

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  /** Number of currently-active projectiles (for cap checks by callers). */
  activeCount(): number {
    return this.pool.filter((p) => p.active).length;
  }

  spawn(params: ProjectileSpawnParams): void {
    if (this.activeCount() >= MAX_PROJECTILES) return;

    let inst = this.pool.find((p) => !p.active);
    if (!inst) {
      inst = this.makeBlankInstance();
      this.pool.push(inst);
    }

    inst.active = true;
    inst.owner = params.owner;
    inst.kind = params.kind;
    inst.x = params.x;
    inst.y = params.y;
    inst.originX = params.x;
    inst.originY = params.y;
    inst.dirX = params.dirX;
    inst.dirY = params.dirY;
    inst.speed = params.speed;
    inst.damage = params.damage;
    inst.crit = params.crit;
    inst.area = params.area;
    inst.pierce = params.pierce;
    inst.hitsLanded = 0;
    inst.splitCount = params.splitCount ?? 0;
    inst.splitGeneration = params.splitGeneration ?? 0;
    inst.travelled = 0;
    inst.boomerangReturning = false;
    inst.hitEnemyIds.clear();

    this.attachVisual(inst, params.spriteKey);
  }

  private makeBlankInstance(): ProjectileInstance {
    return {
      active: false,
      owner: "friendly",
      kind: "straight",
      x: 0,
      y: 0,
      originX: 0,
      originY: 0,
      dirX: 1,
      dirY: 0,
      speed: 0,
      damage: 0,
      crit: false,
      area: 0,
      pierce: 0,
      hitsLanded: 0,
      splitCount: 0,
      splitGeneration: 0,
      travelled: 0,
      boomerangReturning: false,
      hitEnemyIds: new Set(),
      sprite: null,
      usingFallback: false,
    };
  }

  private attachVisual(inst: ProjectileInstance, spriteKey?: string): void {
    if (inst.sprite) {
      inst.sprite.destroy();
      inst.sprite = null;
    }
    const fk = spriteKey ? frameKey(spriteKey) : null;
    if (fk && this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(inst.x, inst.y, fk);
      s.setDepth(DEPTH);
      inst.sprite = s;
      inst.usingFallback = false;
    } else {
      const color = inst.owner === "friendly" ? 0xe8b23d : 0x8b5fbf;
      const s = this.scene.add.circle(
        inst.x,
        inst.y,
        DEFAULT_FALLBACK_RADIUS,
        color
      );
      s.setDepth(DEPTH);
      inst.sprite = s;
      inst.usingFallback = true;
    }
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    const dt = deltaMs / 1000;

    for (const inst of this.pool) {
      if (!inst.active) continue;

      this.stepMotion(inst, dt, deltaMs);
      this.checkCollisions(inst);
      this.checkExpiry(inst);

      if (inst.sprite) {
        inst.sprite.setPosition(inst.x, inst.y);
      }
    }
  }

  private stepMotion(inst: ProjectileInstance, dt: number, deltaMs: number): void {
    const step = inst.speed * dt;
    switch (inst.kind) {
      case "straight":
      case "split":
        inst.x += inst.dirX * step;
        inst.y += inst.dirY * step;
        inst.travelled += step;
        break;
      case "arc":
        inst.x += inst.dirX * step;
        inst.y += inst.dirY * step;
        inst.travelled += step;
        break;
      case "boomerang":
        if (!inst.boomerangReturning) {
          inst.x += inst.dirX * step;
          inst.y += inst.dirY * step;
          inst.travelled += step;
          if (inst.travelled >= inst.area) {
            inst.boomerangReturning = true;
            inst.hitEnemyIds.clear(); // allow re-hitting each enemy at most twice total (out + back)
          }
        } else {
          const dir = directionTo(
            { x: inst.x, y: inst.y },
            { x: inst.originX, y: inst.originY }
          );
          inst.x += dir.x * step;
          inst.y += dir.y * step;
        }
        break;
    }
  }

  private checkCollisions(inst: ProjectileInstance): void {
    if (inst.owner === "friendly") {
      const enemies = this.ctx.getEnemies();
      for (const e of enemies) {
        if (inst.hitEnemyIds.has(e.id)) continue;
        const projRadius = inst.usingFallback ? DEFAULT_FALLBACK_RADIUS : 6;
        if (distance({ x: inst.x, y: inst.y }, e) <= projRadius + e.radius) {
          this.applyHit(inst, e.id, e.x, e.y);
          if (this.isSpent(inst)) return;
        }
      }
    } else {
      const playerPos = this.ctx.getPlayerPos();
      const projRadius = inst.usingFallback ? DEFAULT_FALLBACK_RADIUS : 6;
      const PLAYER_RADIUS = 14;
      if (distance({ x: inst.x, y: inst.y }, playerPos) <= projRadius + PLAYER_RADIUS) {
        this.ctx.damagePlayer(inst.damage, "projectile");
        this.despawn(inst);
      }
    }
  }

  private applyHit(
    inst: ProjectileInstance,
    enemyId: string,
    ex: number,
    ey: number
  ): void {
    this.ctx.damageEnemy(enemyId, inst.damage, inst.crit);
    inst.hitEnemyIds.add(enemyId);
    inst.hitsLanded++;

    if (inst.kind === "arc" && inst.hitsLanded === 1) {
      // AoE 40px around landing point on first hit (and also on natural landing—handled in checkExpiry).
      this.aoeAt(ex, ey, 40, inst);
    }

    if (
      inst.kind === "straight" &&
      inst.splitCount > 0 &&
      inst.splitGeneration < MAX_SPLIT_GENERATIONS &&
      inst.hitsLanded === 1
    ) {
      this.spawnSplitChildren(inst, ex, ey);
    }
  }

  private aoeAt(x: number, y: number, radius: number, source: ProjectileInstance): void {
    const enemies = this.ctx.getEnemies();
    for (const e of enemies) {
      if (e.id === undefined) continue;
      if (source.hitEnemyIds.has(e.id) && distance({ x, y }, e) > radius) continue;
      if (distance({ x, y }, e) <= radius && !source.hitEnemyIds.has(e.id)) {
        this.ctx.damageEnemy(e.id, source.damage, source.crit);
        source.hitEnemyIds.add(e.id);
      }
    }
  }

  private spawnSplitChildren(
    inst: ProjectileInstance,
    x: number,
    y: number
  ): void {
    const baseAngle = Math.atan2(inst.dirY, inst.dirX);
    const spreadRad = (30 * Math.PI) / 180;
    const n = inst.splitCount;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const angle = baseAngle + t * spreadRad * 2;
      this.spawn({
        owner: inst.owner,
        kind: "straight",
        x,
        y,
        dirX: Math.cos(angle),
        dirY: Math.sin(angle),
        speed: inst.speed,
        damage: inst.damage * 0.6,
        crit: inst.crit,
        area: inst.area,
        pierce: 0,
        splitCount: 0,
        splitGeneration: inst.splitGeneration + 1,
      });
    }
  }

  private isSpent(inst: ProjectileInstance): boolean {
    const spent = inst.hitsLanded > inst.pierce + 1;
    if (inst.kind !== "boomerang" && inst.hitsLanded >= inst.pierce + 1) {
      this.despawn(inst);
      return true;
    }
    return spent;
  }

  private checkExpiry(inst: ProjectileInstance): void {
    if (!inst.active) return;
    switch (inst.kind) {
      case "straight":
      case "split":
        if (inst.travelled >= Math.max(inst.area, 400)) this.despawn(inst);
        break;
      case "arc":
        if (inst.travelled >= inst.area) {
          this.aoeAt(inst.x, inst.y, 40, inst);
          this.despawn(inst);
        }
        break;
      case "boomerang":
        if (
          inst.boomerangReturning &&
          distance({ x: inst.x, y: inst.y }, { x: inst.originX, y: inst.originY }) < 8
        ) {
          this.despawn(inst);
        }
        break;
    }
  }

  private despawn(inst: ProjectileInstance): void {
    inst.active = false;
    if (inst.sprite) {
      inst.sprite.destroy();
      inst.sprite = null;
    }
  }

  destroy(): void {
    for (const inst of this.pool) {
      if (inst.sprite) inst.sprite.destroy();
    }
    this.pool = [];
  }
}
