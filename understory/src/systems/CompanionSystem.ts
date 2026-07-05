/**
 * CompanionSystem — spawns befriendable critters (sparrow/squirrel
 * alternating), lets the player recruit them by standing close for a
 * sustained window, and has recruited companions follow + auto-attack.
 *
 * DECISIONS:
 * - "Revealed non-obstacle tile 200-400px from player": scans the world
 *   grid via ctx.world.tileAt/worldToTile/tileToWorld (WorldView has no
 *   direct "revealed tiles" query), filtering `revealed && type !==
 *   "obstacle" && type !== "water"`, then picks a uniformly random
 *   candidate whose distance to the player falls in [200,400]. If none
 *   qualify after a bounded number of attempts, falls back to any revealed
 *   non-obstacle/non-water tile at any distance; if the world has nothing
 *   revealed yet, skips spawning that cycle (warns once) rather than
 *   crashing.
 * - Recruit radius/time and follow/attack numbers are taken verbatim from
 *   the spec: 24px for 1.2s to recruit; follow offset 40-60px (lerped);
 *   attack nearest enemy within 120px every 1.5s for 6 dmg.
 * - Only one uninvited (unrecruited) companion may exist on the map at a
 *   time, per spec ("up to 1 on the map at a time"); this cap is
 *   independent of COMPANION_CAP, which limits *recruited* companions.
 * - Companion sprites are plain circles (fallback) or SPRITE_KEYS.companion*
 *   sprites when the atlas has them; "attack" plays a tiny hop tween
 *   (scale/y punch) since Worker D doesn't own VFX/Particles.
 */
import Phaser from "phaser";
import { System, GameContext, Vec2, EnemyView } from "../core/context";
import { EV, COMPANION_CAP } from "../core/types";
import { SPRITE_KEYS, frameKey, playAnim } from "../gfx/PixelArt";
import {
  tickRecruitTimer,
  isRecruitComplete,
  pickNearest,
  dist,
} from "./nestHungerSim";

const SPAWN_INTERVAL_MS = 60_000;
const DESPAWN_MS = 25_000;
const RECRUIT_RADIUS_PX = 24;
const RECRUIT_REQUIRED_MS = 1200;
const SPAWN_MIN_DIST = 200;
const SPAWN_MAX_DIST = 400;
const SPAWN_ATTEMPTS = 60;

const FOLLOW_OFFSET_MIN = 40;
const FOLLOW_OFFSET_MAX = 60;
const FOLLOW_LERP = 0.08;
const ATTACK_RADIUS_PX = 120;
const ATTACK_INTERVAL_MS = 1500;
const ATTACK_DAMAGE = 6;

type CompanionKind = "sparrow" | "squirrel";

interface WildCompanion {
  kind: CompanionKind;
  obj: Phaser.GameObjects.GameObject & { x: number; y: number };
  ageMs: number;
  recruitTimerMs: number;
}

interface RecruitedCompanion {
  kind: CompanionKind;
  obj: Phaser.GameObjects.GameObject & { x: number; y: number };
  offsetAngle: number;
  offsetDist: number;
  attackTimerMs: number;
}

export class CompanionSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  private spawnTimerMs = SPAWN_INTERVAL_MS; // spawn first candidate at t=60s
  private nextKind: CompanionKind = "sparrow";
  private wild: WildCompanion | null = null;
  private recruited: RecruitedCompanion[] = [];
  private warnedNoSpawnTile = false;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    this.tickSpawnTimer(deltaMs);
    this.tickWild(deltaMs);
    this.tickRecruited(deltaMs);
  }

  destroy(): void {
    if (this.wild) {
      (this.wild.obj as unknown as { destroy: () => void }).destroy();
      this.wild = null;
    }
    for (const c of this.recruited) {
      (c.obj as unknown as { destroy: () => void }).destroy();
    }
    this.recruited = [];
  }

  private tickSpawnTimer(deltaMs: number): void {
    if (this.wild) return; // only one wild companion at a time
    this.spawnTimerMs += deltaMs;
    if (this.spawnTimerMs >= SPAWN_INTERVAL_MS) {
      this.spawnTimerMs = 0;
      this.trySpawnWild();
    }
  }

  private trySpawnWild(): void {
    const playerPos = this.ctx.getPlayerPos();
    const pos = this.pickSpawnTile(playerPos);
    if (!pos) {
      if (!this.warnedNoSpawnTile) {
        this.warnedNoSpawnTile = true;
        console.warn("[CompanionSystem] no valid spawn tile found, skipping spawn cycle");
      }
      return;
    }

    const kind = this.nextKind;
    this.nextKind = kind === "sparrow" ? "squirrel" : "sparrow";

    const obj = this.createSprite(pos.x, pos.y, kind);
    this.wild = { kind, obj, ageMs: 0, recruitTimerMs: 0 };
  }

  /** Random revealed non-obstacle/non-water tile 200-400px from player. */
  private pickSpawnTile(playerPos: Vec2): Vec2 | null {
    const world = this.ctx.world;
    const inRange: Vec2[] = [];
    const fallbackAny: Vec2[] = [];

    for (let attempt = 0; attempt < SPAWN_ATTEMPTS; attempt++) {
      const col = Phaser.Math.Between(0, world.size - 1);
      const row = Phaser.Math.Between(0, world.size - 1);
      const tile = world.tileAt(col, row);
      if (!tile || !tile.revealed) continue;
      if (tile.type === "obstacle" || tile.type === "water") continue;

      const worldPos = world.tileToWorld(col, row);
      fallbackAny.push(worldPos);
      const d = dist(playerPos, worldPos);
      if (d >= SPAWN_MIN_DIST && d <= SPAWN_MAX_DIST) {
        inRange.push(worldPos);
      }
    }

    if (inRange.length > 0) {
      return inRange[Phaser.Math.Between(0, inRange.length - 1)];
    }
    if (fallbackAny.length > 0) {
      return fallbackAny[Phaser.Math.Between(0, fallbackAny.length - 1)];
    }
    return null;
  }

  private tickWild(deltaMs: number): void {
    if (!this.wild) return;
    const w = this.wild;
    w.ageMs += deltaMs;

    const playerPos = this.ctx.getPlayerPos();
    const d = dist(playerPos, { x: w.obj.x, y: w.obj.y });
    const within = d <= RECRUIT_RADIUS_PX;
    w.recruitTimerMs = tickRecruitTimer(w.recruitTimerMs, within, deltaMs);

    if (isRecruitComplete(w.recruitTimerMs, RECRUIT_REQUIRED_MS)) {
      this.recruit(w);
      return;
    }

    if (w.ageMs >= DESPAWN_MS) {
      (w.obj as unknown as { destroy: () => void }).destroy();
      this.wild = null;
    }
  }

  private recruit(w: WildCompanion): void {
    const cap = COMPANION_CAP + this.ctx.statBonus("companionSlots");
    if (this.recruited.length >= cap) {
      // At cap: despawn the wild companion without recruiting rather than
      // let it linger uninteractable.
      (w.obj as unknown as { destroy: () => void }).destroy();
      this.wild = null;
      return;
    }

    this.recruited.push({
      kind: w.kind,
      obj: w.obj,
      offsetAngle: Phaser.Math.FloatBetween(0, Math.PI * 2),
      offsetDist: Phaser.Math.FloatBetween(FOLLOW_OFFSET_MIN, FOLLOW_OFFSET_MAX),
      attackTimerMs: 0,
    });
    this.wild = null;

    this.ctx.player.stats.companionsRecruited++;
    this.ctx.player.stats.befriendSuccesses++;
    this.ctx.audio.blip("befriend");
    this.ctx.events.emit(EV.companionRecruited, { companionId: w.kind });
  }

  private tickRecruited(deltaMs: number): void {
    if (this.recruited.length === 0) return;
    const playerPos = this.ctx.getPlayerPos();
    const enemies = this.ctx.getEnemies();
    const dtSec = deltaMs / 1000;

    for (const c of this.recruited) {
      const targetX = playerPos.x + Math.cos(c.offsetAngle) * c.offsetDist;
      const targetY = playerPos.y + Math.sin(c.offsetAngle) * c.offsetDist;
      c.obj.x = Phaser.Math.Linear(c.obj.x, targetX, FOLLOW_LERP);
      c.obj.y = Phaser.Math.Linear(c.obj.y, targetY, FOLLOW_LERP);

      c.attackTimerMs += deltaMs;
      if (c.attackTimerMs >= ATTACK_INTERVAL_MS) {
        const target = pickNearest(
          { x: c.obj.x, y: c.obj.y },
          enemies,
          ATTACK_RADIUS_PX
        ) as EnemyView | null;
        if (target) {
          c.attackTimerMs = 0;
          this.ctx.damageEnemy(target.id, ATTACK_DAMAGE);
          this.playAttackHop(c);
        }
      }
      void dtSec; // reserved for future smoothing; lerp above is frame-based
    }
  }

  private playAttackHop(c: RecruitedCompanion): void {
    const obj = c.obj as unknown as { scaleY?: number };
    const tweenTarget = c.obj as unknown as Phaser.GameObjects.Components.Transform;
    if (!this.scene.tweens) return;
    this.scene.tweens.add({
      targets: tweenTarget,
      scaleY: 0.7,
      duration: 80,
      yoyo: true,
      ease: "Quad.easeOut",
    });
    void obj;
  }

  private createSprite(
    x: number,
    y: number,
    kind: CompanionKind
  ): Phaser.GameObjects.GameObject & { x: number; y: number } {
    const key =
      kind === "sparrow" ? SPRITE_KEYS.companionSparrow : SPRITE_KEYS.companionSquirrel;
    if (this.scene.textures.exists(frameKey(key))) {
      const sprite = this.scene.add.sprite(x, y, frameKey(key));
      sprite.setDepth(990);
      playAnim(sprite, key, "idle");
      return sprite as unknown as Phaser.GameObjects.GameObject & {
        x: number;
        y: number;
      };
    }
    const color = kind === "sparrow" ? 0xc9a45c : 0x8b5fbf;
    const circle = this.scene.add.circle(x, y, 8, color);
    circle.setDepth(990);
    return circle as unknown as Phaser.GameObjects.GameObject & {
      x: number;
      y: number;
    };
  }
}
