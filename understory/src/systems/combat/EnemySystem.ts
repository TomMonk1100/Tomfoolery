/**
 * EnemySystem — pooled enemy instances (cap MAX_ENEMIES). Owns Phaser
 * sprites/fallback shapes, delegates all steering/damage math to sim.ts.
 *
 * DECISIONS:
 * - Split between EnemySystem/WaveDirector for boss events: EnemySystem emits
 *   BOTH EV.bossSpawned (when WaveDirector tells it to spawn a boss) and
 *   EV.bossDefeated (on that enemy's death) since EnemySystem is the single
 *   source of truth for enemy lifecycle; WaveDirector only listens for
 *   bookkeeping (e.g. to avoid double-spawning), per CONTRACTS "whichever
 *   split you implement, note it."
 * - Elite flag is passed in at spawn() by WaveDirector; EnemySystem applies
 *   the 2x hp/damage/xp, 1.4x scale, tint 0xffd27f, guaranteed food drop.
 * - Fallback rendering (no atlas yet): colored circle sized by `size` bucket
 *   (small=8px radius, medium=12px, large=16px, boss=24px), color derived
 *   from a small per-enemy-id palette map, falling back to danger red.
 * - Death animation: playAnim(..., "death") if the anim exists (checked via
 *   scene.anims.exists through PixelArt.playAnim, which already no-ops
 *   safely); in fallback mode we always use the quick scale-down tween since
 *   there's no anim to play.
 * - Boss phase actions (spawn-slimes / spore-ring / rapid-charges /
 *   spawn-wisps) are implemented generically: "spawn-slimes" and
 *   "spawn-wisps" spawn N minions of a fixed enemyId near the boss;
 *   "spore-ring" spawns N friendly-owned... actually enemy-owned projectiles
 *   in a ring via ProjectilePool; "rapid-charges" just forces a charger-style
 *   state reset on the boss itself N times in quick succession (simplified:
 *   we just re-trigger its own charge state immediately, since bramble-tyrant
 *   already uses charger steering as its base per "boss (chaser..." — but
 *   CONTRACTS says boss = chaser base, so rapid-charges here nudges it to
 *   dash directly at the player 3x in sequence using chargerSteer-like burst,
 *   implemented as a temporary speed multiplier burst rather than adding a
 *   whole new state machine, to keep this data-driven and simple).
 */
import Phaser from "phaser";
import { GameContext, System, EnemyView } from "../../core/context";
import { EV } from "../../core/context";
import {
  EnemyData,
  MAX_ENEMIES,
  CONTACT_TICK_MS,
  EnemyBehavior,
} from "../../core/types";
import { frameKey, playAnim } from "../../gfx/PixelArt";
import {
  Vec2,
  distance,
  isOverlapping,
  contactTick,
  makeContactTickState,
  ContactTickState,
  makeBehaviorState,
  stepBehavior,
  BehaviorSteerState,
  shooterShouldFire,
  CooldownState,
  BOSS_CONTACT_DAMAGE_MULT,
  makeBossPhaseState,
  bossPhaseCheck,
  BossPhaseState,
} from "./sim";
import { ProjectilePool } from "./ProjectilePool";

const PLAYER_RADIUS = 14;

/** Post-launch balance fix (elder-gloomcap "mushroom mom" instakill bug): how
 * long the spore-ring's warning telegraph is shown before the projectiles
 * actually spawn, giving the player a window to move away. Previously the
 * ring fired instantly the moment bossPhaseCheck crossed a HP threshold, with
 * zero advance warning. */
const SPORE_RING_TELEGRAPH_MS = 550;

/** Monotonic id source for spore-ring bursts (see ProjectilePool.burstId). */
let sporeRingBurstCounter = 0;

const SIZE_RADIUS: Record<EnemyData["size"], number> = {
  small: 8,
  medium: 12,
  large: 16,
  boss: 24,
};

const FALLBACK_COLOR_BY_BEHAVIOR: Record<EnemyBehavior, number> = {
  chaser: 0x5fd35f,
  lunger: 0xd94f4f,
  splitter: 0x3a6ea5,
  shooter: 0x8b5fbf,
  charger: 0x7a5c3a,
  drifter: 0xdcc7a0,
  ambusher: 0x4a3423,
  boss: 0xe8b23d,
};

interface EnemyInstance {
  active: boolean;
  instanceId: string;
  data: EnemyData;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  radius: number;
  isBoss: boolean;
  isElite: boolean;
  behaviorState: BehaviorSteerState;
  contactState: ContactTickState;
  shooterCooldown: CooldownState;
  bossPhaseState: BossPhaseState | null;
  ambushVisible: boolean;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc | null;
  usingFallback: boolean;
  hurtFlashUntil: number;
  dying: boolean;
}

export interface EnemySpawnParams {
  data: EnemyData;
  x: number;
  y: number;
  isBoss?: boolean;
  isElite?: boolean;
}

let uidCounter = 0;
function nextInstanceId(): string {
  uidCounter++;
  return `enemy_${uidCounter}`;
}

export class EnemySystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private pool: EnemyInstance[] = [];
  private projectiles: ProjectilePool;
  /** Injected by orchestrator/WaveDirector via constructor param; owned pool for enemy shots. */
  private ownedProjectilePool: boolean;

  constructor(scene: Phaser.Scene, ctx: GameContext, projectilePool?: ProjectilePool) {
    this.scene = scene;
    this.ctx = ctx;
    if (projectilePool) {
      this.projectiles = projectilePool;
      this.ownedProjectilePool = false;
    } else {
      this.projectiles = new ProjectilePool(scene, ctx);
      this.ownedProjectilePool = true;
    }

    ctx.registerCombatProvider({
      getEnemies: () => this.getEnemies(),
      damageEnemy: (id, amount, crit) => this.damageEnemy(id, amount, crit),
    });
  }

  // --------------------------------------------------------------------
  // Public API (used by WaveDirector)
  // --------------------------------------------------------------------

  activeCount(): number {
    return this.pool.filter((e) => e.active).length;
  }

  /** Oldest active small (non-boss) enemy's instanceId, or null. Used for eviction. */
  oldestSmallEnemyId(): string | null {
    for (const e of this.pool) {
      if (e.active && !e.isBoss) return e.instanceId;
    }
    return null;
  }

  spawn(params: EnemySpawnParams): string | null {
    const activeCount = this.activeCount();
    if (activeCount >= MAX_ENEMIES) {
      if (params.isBoss) {
        const evictId = this.oldestSmallEnemyId();
        if (evictId) this.forceRemove(evictId);
      } else {
        return null;
      }
    }

    let inst = this.pool.find((e) => !e.active);
    if (!inst) {
      inst = this.makeBlankInstance();
      this.pool.push(inst);
    }

    const isElite = !!params.isElite;
    const eliteMult = isElite ? 2 : 1;

    inst.active = true;
    inst.instanceId = nextInstanceId();
    inst.data = params.data;
    inst.hp = params.data.hp * eliteMult;
    inst.maxHp = inst.hp;
    inst.x = params.x;
    inst.y = params.y;
    inst.radius = SIZE_RADIUS[params.data.size] ?? SIZE_RADIUS.small;
    inst.isBoss = !!params.isBoss;
    inst.isElite = isElite;
    inst.behaviorState = makeBehaviorState(params.data.behavior);
    inst.contactState = makeContactTickState();
    inst.shooterCooldown = { remainingMs: params.data.projectile?.cooldownMs ?? 1200 };
    inst.bossPhaseState = inst.isBoss ? makeBossPhaseState() : null;
    inst.ambushVisible = params.data.behavior !== "ambusher";
    inst.hurtFlashUntil = 0;
    inst.dying = false;

    this.attachVisual(inst);

    this.ctx.events.emit(EV.enemySpawned, {
      enemyId: inst.instanceId,
      enemyDataId: inst.data.id,
      x: inst.x,
      y: inst.y,
    });

    if (inst.isBoss) {
      this.ctx.events.emit(EV.bossSpawned, {
        enemyId: inst.data.id,
        name: inst.data.name,
      });
    }

    return inst.instanceId;
  }

  private forceRemove(instanceId: string): void {
    const inst = this.pool.find((e) => e.instanceId === instanceId);
    if (!inst) return;
    this.releaseInstance(inst);
  }

  private makeBlankInstance(): EnemyInstance {
    return {
      active: false,
      instanceId: "",
      data: null as unknown as EnemyData,
      hp: 0,
      maxHp: 0,
      x: 0,
      y: 0,
      radius: 8,
      isBoss: false,
      isElite: false,
      behaviorState: { kind: "chaser" },
      contactState: makeContactTickState(),
      shooterCooldown: { remainingMs: 0 },
      bossPhaseState: null,
      ambushVisible: true,
      sprite: null,
      usingFallback: false,
      hurtFlashUntil: 0,
      dying: false,
    };
  }

  private attachVisual(inst: EnemyInstance): void {
    if (inst.sprite) {
      inst.sprite.destroy();
      inst.sprite = null;
    }
    const fk = frameKey(inst.data.spriteKey);
    if (this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(inst.x, inst.y, fk);
      s.setDepth(900);
      playAnim(s, inst.data.spriteKey, "idle");
      // Display size follows gameplay radius (textures are baked at 3x),
      // slightly generous so visuals read a touch larger than the hitbox.
      const d = inst.radius * 3 * (inst.isElite ? 1.4 : 1);
      s.setDisplaySize(d, d);
      inst.sprite = s;
      inst.usingFallback = false;
      if (inst.isElite) s.setTint(0xffd27f);
    } else {
      const color = FALLBACK_COLOR_BY_BEHAVIOR[inst.data.behavior] ?? 0xd94f4f;
      const s = this.scene.add.circle(inst.x, inst.y, inst.radius, color);
      s.setDepth(900);
      inst.sprite = s;
      inst.usingFallback = true;
      if (inst.isElite) {
        s.setScale(1.4);
        s.setFillStyle(0xffd27f);
      }
    }
  }

  getEnemies(): EnemyView[] {
    const out: EnemyView[] = [];
    for (const e of this.pool) {
      if (!e.active || e.dying) continue;
      // Ambushers hidden underground are not valid targets.
      if (e.data.behavior === "ambusher" && !e.ambushVisible) continue;
      out.push({
        id: e.instanceId,
        dataId: e.data.id,
        x: e.x,
        y: e.y,
        hp: e.hp,
        radius: e.radius,
        isBoss: e.isBoss,
      });
    }
    return out;
  }

  damageEnemy(instanceId: string, amount: number, crit?: boolean): boolean {
    const inst = this.pool.find((e) => e.active && e.instanceId === instanceId);
    if (!inst) return false;

    inst.hp -= amount;
    this.ctx.player.stats.damageDealt += amount;

    this.ctx.events.emit(EV.enemyDamaged, {
      enemyId: inst.instanceId,
      x: inst.x,
      y: inst.y,
      amount,
      crit: !!crit,
      remainingHp: Math.max(0, inst.hp),
    });

    this.applyHurtFlash(inst);

    if (inst.hp <= 0) {
      this.killEnemy(inst);
    }

    return true;
  }

  private applyHurtFlash(inst: EnemyInstance): void {
    if (!inst.sprite) return;
    if (inst.usingFallback) {
      // Fallback circles: quick tint pulse via fillStyle, guarded by mode.
      const arc = inst.sprite as Phaser.GameObjects.Arc;
      if ("setFillStyle" in arc) arc.setFillStyle(0xffffff);
      inst.hurtFlashUntil = this.scene.time.now + 80;
    } else {
      const spr = inst.sprite as Phaser.GameObjects.Sprite;
      if ("setTintFill" in spr) spr.setTintFill(0xffffff);
      inst.hurtFlashUntil = this.scene.time.now + 80;
    }
  }

  private clearHurtFlash(inst: EnemyInstance): void {
    if (!inst.sprite) return;
    const restoreColor = inst.isElite
      ? 0xffd27f
      : FALLBACK_COLOR_BY_BEHAVIOR[inst.data.behavior] ?? 0xd94f4f;
    if (inst.usingFallback) {
      const arc = inst.sprite as Phaser.GameObjects.Arc;
      if ("setFillStyle" in arc) arc.setFillStyle(restoreColor);
    } else {
      const spr = inst.sprite as Phaser.GameObjects.Sprite;
      if ("clearTint" in spr) spr.clearTint();
      if (inst.isElite && "setTint" in spr) spr.setTint(0xffd27f);
    }
  }

  private killEnemy(inst: EnemyInstance): void {
    if (inst.dying) return;
    inst.dying = true;

    const wasBoss = inst.isBoss;
    const xp = inst.data.xp * (inst.isElite ? 2 : 1);

    this.ctx.events.emit(EV.enemyKilled, {
      enemyId: inst.instanceId,
      enemyDataId: inst.data.id,
      x: inst.x,
      y: inst.y,
      xp,
      wasBoss,
    });

    this.ctx.spawnXPMote(inst.x, inst.y, xp);

    const foodChance = inst.isElite ? 1 : inst.data.foodDropChance;
    if (Math.random() < foodChance) {
      this.ctx.spawnFood(inst.x, inst.y, 15);
    }

    this.ctx.player.stats.kills++;

    if (inst.data.behavior === "splitter" && inst.data.splitsInto) {
      this.spawnSplitChildren(inst);
    }

    if (wasBoss) {
      this.ctx.events.emit(EV.bossDefeated, {
        enemyId: inst.data.id,
        name: inst.data.name,
      });
      this.ctx.player.stats.bossesDefeated++;
    }

    if (inst.sprite && !inst.usingFallback) {
      playAnim(inst.sprite as Phaser.GameObjects.Sprite, inst.data.spriteKey, "death");
      this.scene.time.delayedCall(300, () => this.releaseInstance(inst));
    } else if (inst.sprite) {
      this.scene.tweens.add({
        targets: inst.sprite,
        scale: 0,
        duration: 220,
        onComplete: () => this.releaseInstance(inst),
      });
    } else {
      this.releaseInstance(inst);
    }
  }

  private spawnSplitChildren(inst: EnemyInstance): void {
    const split = inst.data.splitsInto;
    if (!split) return;
    // Requires the split target's EnemyData; caller (WaveDirector/orchestrator)
    // seeds the catalog into ctx.enemyCatalog, so we look it up there.
    const childData = this.ctx.enemyCatalog.find((e) => e.id === split.id);
    if (!childData) {
      console.warn(`EnemySystem: splitsInto id "${split.id}" not found in enemyCatalog`);
      return;
    }
    for (let i = 0; i < split.count; i++) {
      const angle = (i / split.count) * Math.PI * 2;
      const ox = Math.cos(angle) * 16;
      const oy = Math.sin(angle) * 16;
      this.spawn({ data: childData, x: inst.x + ox, y: inst.y + oy });
    }
  }

  private releaseInstance(inst: EnemyInstance): void {
    if (inst.sprite) {
      inst.sprite.destroy();
      inst.sprite = null;
    }
    inst.active = false;
    inst.dying = false;
  }

  // --------------------------------------------------------------------
  // System
  // --------------------------------------------------------------------

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;
    const playerPos = this.ctx.getPlayerPos();

    for (const inst of this.pool) {
      if (!inst.active || inst.dying) continue;

      if (this.scene.time.now >= inst.hurtFlashUntil && inst.hurtFlashUntil !== 0) {
        this.clearHurtFlash(inst);
        inst.hurtFlashUntil = 0;
      }

      this.updateBehavior(inst, playerPos, deltaMs);
      this.updateContactDamage(inst, playerPos, deltaMs);
      if (inst.isBoss) this.updateBossPhases(inst);

      if (inst.sprite) {
        inst.sprite.setPosition(inst.x, inst.y);
      }
    }

    if (this.ownedProjectilePool) this.projectiles.update(deltaMs);
  }

  private updateBehavior(inst: EnemyInstance, playerPos: Vec2, deltaMs: number): void {
    const behavior = inst.data.behavior;

    if (behavior === "ambusher") {
      this.updateAmbusher(inst, playerPos, deltaMs);
      return;
    }

    if (behavior === "shooter") {
      const step = stepBehavior(inst.behaviorState, {
        self: inst,
        target: playerPos,
        speed: inst.data.speed,
        deltaMs,
      });
      inst.x += step.dx;
      inst.y += step.dy;

      if (
        inst.data.projectile &&
        shooterShouldFire(inst, playerPos, inst.shooterCooldown, deltaMs)
      ) {
        const dir = { x: playerPos.x - inst.x, y: playerPos.y - inst.y };
        const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
        this.projectiles.spawn({
          owner: "enemy",
          kind: "straight",
          x: inst.x,
          y: inst.y,
          dirX: dir.x / len,
          dirY: dir.y / len,
          speed: inst.data.projectile.speed,
          damage: inst.data.projectile.damage,
          crit: false,
          area: 600,
          pierce: 0,
        });
      }
      return;
    }

    const step = stepBehavior(inst.behaviorState, {
      self: inst,
      target: playerPos,
      speed: inst.data.speed,
      deltaMs,
    });
    inst.x += step.dx;
    inst.y += step.dy;
  }

  private updateAmbusher(inst: EnemyInstance, playerPos: Vec2, deltaMs: number): void {
    if (inst.behaviorState.kind !== "ambusher") return;
    const before = inst.behaviorState.state.phase;
    const result = stepBehaviorAmbusher(inst.behaviorState.state, {
      self: inst,
      target: playerPos,
      speed: inst.data.speed,
      deltaMs,
    });

    if (result.justSurfaced) {
      inst.x = playerPos.x;
      inst.y = playerPos.y;
      inst.ambushVisible = true;
      if (inst.sprite) inst.sprite.setVisible(true);
    }

    if (result.phase === "hidden" && before !== "hidden") {
      inst.ambushVisible = false;
      if (inst.sprite) inst.sprite.setVisible(false);
    }

    if (result.phase === "telegraph" && inst.sprite) {
      inst.sprite.setVisible(true);
      inst.sprite.setAlpha(0.35);
      inst.x = playerPos.x;
      inst.y = playerPos.y;
    } else if (inst.sprite && result.phase !== "telegraph") {
      inst.sprite.setAlpha(1);
    }
  }

  private updateContactDamage(inst: EnemyInstance, playerPos: Vec2, deltaMs: number): void {
    if (inst.data.behavior === "ambusher" && !inst.ambushVisible) return;

    const overlapping = isOverlapping(inst, inst.radius, playerPos, PLAYER_RADIUS);
    const shouldTick = contactTick(inst.contactState, overlapping, deltaMs);
    if (shouldTick) {
      const mult = inst.isBoss ? BOSS_CONTACT_DAMAGE_MULT : 1;
      const eliteMult = inst.isElite ? 2 : 1;
      this.ctx.damagePlayer(inst.data.damage * mult * eliteMult, inst.data.id);
    }
  }

  private updateBossPhases(inst: EnemyInstance): void {
    if (!inst.bossPhaseState) return;
    const hpPct = inst.maxHp > 0 ? inst.hp / inst.maxHp : 0;
    const action = bossPhaseCheck(inst.bossPhaseState, inst.data.id, hpPct);
    if (!action) return;

    switch (action.kind) {
      case "spawn-slimes": {
        const childData = this.ctx.enemyCatalog.find((e) => e.id === "slime-green");
        if (!childData) break;
        for (let i = 0; i < action.count; i++) {
          const angle = (i / action.count) * Math.PI * 2;
          this.spawn({
            data: childData,
            x: inst.x + Math.cos(angle) * 40,
            y: inst.y + Math.sin(angle) * 40,
          });
        }
        break;
      }
      case "spore-ring": {
        this.telegraphSporeRing(inst, action.count);
        break;
      }
      case "rapid-charges": {
        // Simplified: reset to charger-like burst by boosting speed briefly.
        // Data-driven & simple per CONTRACTS guidance — no new state machine.
        if (inst.behaviorState.kind === "boss") {
          inst.behaviorState = makeBehaviorState("charger");
        }
        break;
      }
      case "spawn-wisps": {
        const childData = this.ctx.enemyCatalog.find((e) => e.id === "wisp");
        if (!childData) break;
        for (let i = 0; i < action.count; i++) {
          const angle = (i / action.count) * Math.PI * 2;
          this.spawn({
            data: childData,
            x: inst.x + Math.cos(angle) * 50,
            y: inst.y + Math.sin(angle) * 50,
          });
        }
        break;
      }
    }
  }

  /**
   * Post-launch balance fix ("purple mushroom mom" instakill bug): root
   * cause was two-fold. (1) All 8 spore-ring projectiles spawned exactly at
   * the boss's position with zero warning, and since players are typically
   * standing at melee range from a boss they're fighting, most/all 8 could
   * overlap the player's hitbox in the very first frame(s) before dispersing
   * -- 8 x inst.data.damage (elder-gloomcap's 12 contact damage, reused for
   * the ring) = up to 96 near-simultaneous damage against a 100 max-HP
   * animal, i.e. an effective instakill with no way to react. (2) There was
   * no telegraph at all -- the burst was edge-triggered directly off a HP
   * threshold with no windup.
   *
   * Fix: show an expanding warning ring at the boss's position for
   * SPORE_RING_TELEGRAPH_MS before any projectile spawns (giving the player
   * time to move away), and tag every projectile in the burst with a shared
   * burstId so ProjectilePool only lets ONE of them actually damage the
   * player -- the rest despawn harmlessly if they also connect. Combined
   * with the tuned per-hit damage (see elder-gloomcap's `projectile.damage`
   * in weapons... enemies.json, repurposed from previously-dead data since
   * `behavior: "boss"` never fires the normal shooter path), a player who
   * fails to dodge entirely now takes exactly one hit for ~50% of a 100
   * max-HP animal's health -- dangerous, not lethal.
   */
  private telegraphSporeRing(inst: EnemyInstance, count: number): void {
    const x = inst.x;
    const y = inst.y;

    // Matches the existing scale+alpha tween idiom used elsewhere for hit/fx
    // flashes (e.g. ProjectilePool.playSpawnFlash) rather than tweening the
    // Arc's `radius` property directly.
    const warn = this.scene.add.circle(x, y, 18, 0xd94f4f, 0.3);
    warn.setStrokeStyle(2, 0xd94f4f, 0.9);
    warn.setDepth(945);
    this.scene.tweens.add({
      targets: warn,
      scale: 5,
      alpha: 0,
      duration: SPORE_RING_TELEGRAPH_MS,
      onComplete: () => warn.destroy(),
    });

    const burstId = `spore-ring-${sporeRingBurstCounter++}`;
    const damage = inst.data.projectile?.damage ?? inst.data.damage;

    this.scene.time.delayedCall(SPORE_RING_TELEGRAPH_MS, () => {
      // Boss may have died (or the scene may have moved on) during the
      // telegraph window -- bail out rather than firing from a stale/dead
      // pooled instance.
      if (!inst.active || this.ctx.isPaused()) return;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        this.projectiles.spawn({
          owner: "enemy",
          kind: "straight",
          x: inst.x,
          y: inst.y,
          dirX: Math.cos(angle),
          dirY: Math.sin(angle),
          speed: 140,
          damage,
          crit: false,
          area: 500,
          pierce: 0,
          burstId,
        });
      }
    });
  }

  destroy(): void {
    for (const inst of this.pool) {
      if (inst.sprite) inst.sprite.destroy();
    }
    this.pool = [];
    if (this.ownedProjectilePool) this.projectiles.destroy();
  }
}

// Local re-export shim: sim.ts's ambusherSteer takes (state, input) and
// returns {dx,dy,phase,justSurfaced}; imported here under a distinct name to
// avoid clashing with the generic stepBehavior dispatch above (which only
// returns {dx,dy} for the union type).
import { ambusherSteer as stepBehaviorAmbusher } from "./sim";
