/**
 * NestSystem — places and maintains the Nest: heals/banks food for a nearby
 * player, and runs the two scripted raid windows (warning -> active ->
 * ended) where nearby live enemies chip away at nest HP.
 *
 * DECISIONS:
 * - Nest position is queried from ctx.world.nestNodes() on the FIRST
 *   update() tick (not the constructor), per spec, since WorldGenSystem may
 *   still be initializing world data when systems are constructed. If no
 *   nest node exists by then, falls back to the center of the world
 *   (ctx.world.bounds() / 2).
 * - Raid engine: this worker cannot steer EnemySystem, so raid "damage" is
 *   abstract per spec — every 2s during an active raid, nest HP -= 3 *
 *   (live enemies within 250px of the nest). Players defend by killing
 *   enemies near the nest; there is no direct nest/enemy collision here.
 * - Raid clock accumulates ctx.isPaused()-respecting delta itself (a local
 *   runClockMs), since there's no shared "run clock" exposed on ctx/types.
 *   This means the two raid windows are relative to when NestSystem starts
 *   ticking (effectively run start, since WorldScene constructs all systems
 *   up front), matching the "run-clock 100000ms/340000ms" spec.
 * - Destroyed nest (hp hits 0): bankedFood wiped, raid force-ended
 *   {survived:false}, and the nest stops healing/banking/raiding for the
 *   rest of the run (checked via a `destroyed` flag) — sprite plays
 *   "damaged" anim/fallback tint permanently.
 */
import Phaser from "phaser";
import { System, GameContext, Vec2 } from "../core/context";
import { EV, NestState, NEST_MAX_HP, NEST_HEAL_PER_SEC } from "../core/types";
import { SPRITE_KEYS, frameKey, playAnim } from "../gfx/PixelArt";
import {
  buildRaidSchedules,
  raidPhaseAt,
  raidDamageTick,
  applyNestDamage,
  applyNestHeal,
  bankCarriedFood,
  wipeBank,
  dist,
  RaidPhase,
  RaidSchedule,
} from "./nestHungerSim";

const PLAYER_NEAR_NEST_PX = 48;
const RAID_ENEMY_RADIUS_PX = 250;
const RAID_DAMAGE_TICK_MS = 2000;
const RAID_PER_ENEMY_DAMAGE = 3;

export class NestSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private nest: NestState | null = null;
  private sprite: Phaser.GameObjects.GameObject | null = null;
  private located = false;
  private destroyed = false;

  private runClockMs = 0;
  private schedules: RaidSchedule[] = buildRaidSchedules();
  private phaseByIndex: RaidPhase[] = this.schedules.map(() => "idle");
  private raidDamageTimerMs = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.ctx.registerCombatProvider({
      getNest: () => this.nest,
    });
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    if (!this.located) {
      this.locateNest();
    }
    if (!this.nest) return;

    this.runClockMs += deltaMs;

    if (!this.destroyed) {
      this.tickPlayerProximity(deltaMs);
    }

    this.tickRaidClock(deltaMs);
  }

  destroy(): void {
    if (this.sprite) {
      (this.sprite as unknown as { destroy: () => void }).destroy();
      this.sprite = null;
    }
  }

  private locateNest(): void {
    this.located = true;
    const nodes = this.ctx.world.nestNodes();
    let pos: Vec2;
    if (nodes.length > 0) {
      pos = nodes[0];
    } else {
      const bounds = this.ctx.world.bounds();
      pos = { x: bounds.width / 2, y: bounds.height / 2 };
      console.warn("[NestSystem] no nest node found in world, using center fallback");
    }

    this.nest = {
      hp: NEST_MAX_HP,
      maxHp: NEST_MAX_HP,
      bankedFood: 0,
      raidActive: false,
      x: pos.x,
      y: pos.y,
    };

    this.createSprite(pos.x, pos.y);
  }

  private createSprite(x: number, y: number): void {
    const key = SPRITE_KEYS.nest;
    if (this.scene.textures.exists(frameKey(key))) {
      const sprite = this.scene.add.sprite(x, y, frameKey(key));
      sprite.setDepth(500);
      playAnim(sprite, key, "idle");
      this.sprite = sprite;
    } else {
      const circle = this.scene.add.circle(x, y, 16, 0x7a5c3a);
      circle.setDepth(500);
      this.sprite = circle;
    }
  }

  private tickPlayerProximity(deltaMs: number): void {
    if (!this.nest) return;
    const playerPos = this.ctx.getPlayerPos();
    const d = dist(playerPos, { x: this.nest.x, y: this.nest.y });
    if (d > PLAYER_NEAR_NEST_PX) return;

    // Heal.
    this.nest.hp = applyNestHeal(
      this.nest.hp,
      this.nest.maxHp,
      NEST_HEAL_PER_SEC * (deltaMs / 1000)
    );

    // Auto-bank carried food.
    if (this.ctx.player.carriedFood > 0) {
      const result = bankCarriedFood(
        this.nest.bankedFood,
        this.ctx.player.carriedFood
      );
      this.nest.bankedFood = result.bankedFood;
      this.ctx.player.carriedFood = result.carriedFood;
      this.ctx.player.stats.foodBanked += result.amountBanked;
      this.ctx.events.emit(EV.foodBanked, {
        count: result.amountBanked,
        total: this.nest.bankedFood,
      });
    }
  }

  private tickRaidClock(deltaMs: number): void {
    if (!this.nest || this.destroyed) return;

    for (let i = 0; i < this.schedules.length; i++) {
      const schedule = this.schedules[i];
      const phase = raidPhaseAt(this.runClockMs, schedule);
      const prevPhase = this.phaseByIndex[i];
      if (phase === prevPhase) continue;
      this.phaseByIndex[i] = phase;

      if (phase === "warned") {
        this.ctx.events.emit(EV.nestRaidStarted, { season: this.ctx.season() });
      } else if (phase === "active") {
        this.nest.raidActive = true;
      } else if (phase === "ended" && prevPhase === "active") {
        this.endRaid();
      }
    }

    const anyActive = this.phaseByIndex.some((p) => p === "active");
    if (anyActive && this.nest.raidActive && !this.destroyed) {
      this.raidDamageTimerMs += deltaMs;
      if (this.raidDamageTimerMs >= RAID_DAMAGE_TICK_MS) {
        this.raidDamageTimerMs -= RAID_DAMAGE_TICK_MS;
        this.applyRaidDamageTick();
      }
    }
  }

  private applyRaidDamageTick(): void {
    if (!this.nest) return;
    const enemies = this.ctx.getEnemies();
    const nearCount = enemies.reduce((n, e) => {
      const d = dist({ x: e.x, y: e.y }, { x: this.nest!.x, y: this.nest!.y });
      return d <= RAID_ENEMY_RADIUS_PX ? n + 1 : n;
    }, 0);

    const dmg = raidDamageTick(nearCount, RAID_PER_ENEMY_DAMAGE);
    if (dmg <= 0) return;

    const result = applyNestDamage(this.nest.hp, dmg);
    this.nest.hp = result.hp;
    this.ctx.events.emit(EV.nestDamaged, { hp: this.nest.hp, maxHp: this.nest.maxHp });

    if (result.destroyed) {
      this.destroyNest();
    }
  }

  private endRaid(): void {
    if (!this.nest) return;
    const survived = this.nest.hp > 0 && !this.destroyed;
    this.nest.raidActive = false;
    if (survived) {
      this.ctx.player.stats.nestRaidsSurvived++;
    }
    this.ctx.events.emit(EV.nestRaidEnded, { survived });
  }

  private destroyNest(): void {
    if (!this.nest || this.destroyed) return;
    this.destroyed = true;
    this.nest.bankedFood = wipeBank();
    this.nest.raidActive = false;
    this.ctx.events.emit(EV.nestRaidEnded, { survived: false });

    if (this.sprite) {
      playAnim(
        this.sprite as unknown as Phaser.GameObjects.Sprite,
        SPRITE_KEYS.nest,
        "damaged"
      );
      const asShape = this.sprite as unknown as { setFillStyle?: (c: number) => void };
      asShape.setFillStyle?.(0x4a3423);
    }
  }
}
