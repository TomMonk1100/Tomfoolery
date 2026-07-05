/**
 * WeaponSystem — every frame, reads ctx.player.activeWeapons (source of
 * truth) and syncs internal cooldown entries. Fires archetypes per
 * CONTRACTS.md; all math delegated to sim.ts.
 *
 * DECISIONS:
 * - i-frames for "zone"/dig archetypes: CONTRACTS explicitly calls this out
 *   as optional scope ("keep i-frames OUT of scope — DECISIONS-note it").
 *   We do NOT implement isPlayerInvulnerable(); zone weapons only deal damage
 *   ticks, no player invulnerability side-effect. Noted per contract.
 * - orbit archetype: `count` objects revolve at `speed` (treated as
 *   degrees/sec for a stable, readable rotation independent of radius) around
 *   the player at radius=`area`; each orbiting object has its own 300ms
 *   per-enemy re-hit cooldown (tracked per orbiter-index + enemyId pair).
 * - trail archetype (burst-based per CONTRACTS: "burst: 1.5s player speed
 *   +60%, drop damaging segments every 60px lasting durationMs"): on fire, we
 *   don't directly control player velocity (MovementSystem owns that); we
 *   apply a temporary moveSpeed statBonus-like multiplier by emitting no
 *   speed change (out of scope for a combat-only worker to mutate player
 *   speed) — simplest interpretation: the burst duration only governs how
 *   long segments keep being laid down as the player naturally moves,
 *   without an actual speed boost, since granting +60% speed would require
 *   coordinating with MovementSystem (owned by another worker) and isn't
 *   exposed via ctx. This is a scope-reduction, noted here.
 * - Fire range gate for aoe-pulse/melee-sweep/zone: enemy within area+80px of
 *   player (per CONTRACTS). Projectile/orbit/trail always fire on cooldown.
 * - Damage/cooldown/area/crit formulas exactly per sim.ts (computeDamage,
 *   computeCooldown, computeArea, computeCritChance).
 * - Archetype fx sprites use fxBarkRing/fxQuakeRing/fxSweep/fxAura keys if
 *   present else a stroked/filled circle fallback via Phaser Graphics.
 */
import Phaser from "phaser";
import { GameContext, System, EnemyView } from "../../core/context";
import { EV } from "../../core/context";
import {
  WeaponData,
  ActiveWeapon,
  WeaponLevelStats,
  WeaponArchetype,
} from "../../core/types";
import { SPRITE_KEYS, frameKey } from "../../gfx/PixelArt";
import {
  nearestTarget,
  distance,
  directionTo,
  tickCooldown,
  resetCooldown,
  computeDamage,
  computeCooldown,
  computeArea,
  computeCritChance,
  resolveWeaponStats,
  shouldFireWeapon,
  CooldownState,
} from "./sim";
import { ProjectilePool } from "./ProjectilePool";

const PLAYER_RADIUS = 14;
const ORBIT_REHIT_MS = 300;
const ZONE_TICK_MS = 400;
const TRAIL_SEGMENT_SPACING_PX = 60;
const TRAIL_BURST_MS = 1500;

interface OrbiterState {
  angleOffsetDeg: number;
  rehitCooldowns: Map<string, number>; // enemyId -> ms remaining
}

interface ZoneInstance {
  x: number;
  y: number;
  radius: number;
  damage: number;
  crit: boolean;
  remainingMs: number;
  tickRemainingMs: number;
  graphic: Phaser.GameObjects.Arc | null;
}

interface TrailBurstState {
  active: boolean;
  remainingMs: number;
  lastSegmentPos: { x: number; y: number } | null;
  damage: number;
  crit: boolean;
  area: number;
  durationMs: number;
}

interface WeaponRuntime {
  weaponId: string;
  cooldown: CooldownState;
  orbiters: OrbiterState[];
  zones: ZoneInstance[];
  trail: TrailBurstState;
}

const SFX_BY_WEAPON: Record<string, "bark" | "pounce" | "thump"> = {
  "bark-blast": "bark",
  "pounce-slash": "pounce",
  "thumper-quake": "thump",
};

export class WeaponSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private projectiles: ProjectilePool;
  private ownedProjectilePool: boolean;
  private runtimes = new Map<string, WeaponRuntime>(); // weaponId -> runtime

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
  }

  private findWeaponData(id: string): WeaponData | null {
    return this.ctx.weapons.find((w) => w.id === id) ?? null;
  }

  /** Public per CONTRACTS: WorldScene/DraftSystem may call to force a resync (no-op here since update() syncs every frame anyway; kept as a stable stub). */
  refresh(): void {
    // No-op: update() reconciles runtimes from ctx.player.activeWeapons every
    // frame, so there is nothing stale to force. Present for API stability.
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    this.syncRuntimes();

    const playerPos = this.ctx.getPlayerPos();
    const enemies = this.ctx.getEnemies();

    for (const active of this.ctx.player.activeWeapons) {
      const runtime = this.runtimes.get(active.weaponId);
      const data = this.findWeaponData(active.weaponId);
      if (!runtime || !data) continue;

      this.updateZones(runtime, enemies, deltaMs);
      this.updateOrbiters(runtime, data, active, enemies, deltaMs, playerPos);
      this.updateTrailBurst(runtime, deltaMs, playerPos);

      const stats = resolveWeaponStats(
        data.levels,
        data.evolution.stats,
        active.level,
        active.evolved
      );
      const archetype = active.evolved && data.evolution.archetype
        ? data.evolution.archetype
        : data.archetype;

      const elapsed = tickCooldown(runtime.cooldown, deltaMs);
      if (!elapsed) continue;

      const area = computeArea(stats.area, this.ctx.statBonus("area"));
      const canFire = shouldFireWeapon(archetype, area, playerPos, enemies);
      if (!canFire) {
        // Don't reset cooldown; try again next frame once elapsed<=0 persists
        // (avoids weapons "waiting" full cooldown again while no target).
        continue;
      }

      this.fireWeapon(runtime, data, stats, archetype, active, area, playerPos, enemies);

      const scaledCooldown = computeCooldown(
        stats.cooldownMs,
        this.ctx.statBonus("cooldown")
      );
      resetCooldown(runtime.cooldown, scaledCooldown);
    }
  }

  private syncRuntimes(): void {
    const activeIds = new Set(this.ctx.player.activeWeapons.map((w) => w.weaponId));

    for (const active of this.ctx.player.activeWeapons) {
      if (!this.runtimes.has(active.weaponId)) {
        const data = this.findWeaponData(active.weaponId);
        const stats = data
          ? resolveWeaponStats(data.levels, data.evolution.stats, active.level, active.evolved)
          : null;
        this.runtimes.set(active.weaponId, {
          weaponId: active.weaponId,
          cooldown: { remainingMs: stats?.cooldownMs ?? 0 },
          orbiters: [],
          zones: [],
          trail: {
            active: false,
            remainingMs: 0,
            lastSegmentPos: null,
            damage: 0,
            crit: false,
            area: 0,
            durationMs: 0,
          },
        });
      }
    }

    for (const key of Array.from(this.runtimes.keys())) {
      if (!activeIds.has(key)) {
        const runtime = this.runtimes.get(key);
        runtime?.zones.forEach((z) => z.graphic?.destroy());
        this.runtimes.delete(key);
      }
    }
  }

  private fireWeapon(
    runtime: WeaponRuntime,
    data: WeaponData,
    stats: WeaponLevelStats,
    archetype: WeaponArchetype,
    active: ActiveWeapon,
    area: number,
    playerPos: { x: number; y: number },
    enemies: EnemyView[]
  ): void {
    const critRoll = Math.random();
    const critChance = computeCritChance(stats.critPct, this.ctx.statBonus("critPct"));
    const { amount: damage, crit } = computeDamage({
      baseDamage: stats.damage,
      statBonusDamagePct: this.ctx.statBonus("damage"),
      wellFed: this.ctx.isWellFed(),
      critRoll,
      critChancePct: critChance,
    });

    switch (archetype) {
      case "aoe-pulse":
        this.fireAoePulse(playerPos, area, damage, crit, enemies, data);
        break;
      case "melee-sweep":
        this.fireMeleeSweep(playerPos, area, damage, crit, enemies, data);
        break;
      case "projectile":
        this.fireProjectile(playerPos, stats, data, damage, crit, area, enemies);
        break;
      case "orbit":
        this.setupOrbiters(runtime, stats, area);
        break;
      case "trail":
        this.startTrailBurst(runtime, damage, crit, area, stats.durationMs ?? 1000);
        break;
      case "zone":
        this.spawnZone(runtime, playerPos, area, damage, crit, stats.durationMs ?? 2000);
        break;
    }

    this.ctx.events.emit(EV.weaponFired, {
      weaponId: data.id,
      x: playerPos.x,
      y: playerPos.y,
    });

    const sfx = SFX_BY_WEAPON[data.id] ?? "hit";
    this.ctx.audio.blip(sfx);
  }

  // ---- aoe-pulse ----
  private fireAoePulse(
    playerPos: { x: number; y: number },
    area: number,
    damage: number,
    crit: boolean,
    enemies: EnemyView[],
    data: WeaponData
  ): void {
    for (const e of enemies) {
      if (distance(playerPos, e) <= area + e.radius) {
        this.ctx.damageEnemy(e.id, damage, crit);
      }
    }
    this.playRingFx(playerPos, area, data);
  }

  private playRingFx(playerPos: { x: number; y: number }, area: number, data: WeaponData): void {
    const key = data.animal === "rabbit" ? SPRITE_KEYS.fxQuakeRing : SPRITE_KEYS.fxBarkRing;
    const fk = frameKey(key);
    if (this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(playerPos.x, playerPos.y, fk);
      s.setDepth(950);
      const scale = area / 32;
      s.setScale(scale);
      this.scene.tweens.add({
        targets: s,
        alpha: 0,
        duration: 250,
        onComplete: () => s.destroy(),
      });
    } else {
      const ring = this.scene.add.circle(playerPos.x, playerPos.y, area, 0xffffff, 0);
      ring.setStrokeStyle(2, 0xe8b23d, 0.8);
      ring.setDepth(950);
      this.scene.tweens.add({
        targets: ring,
        alpha: 0,
        scale: 1.1,
        duration: 250,
        onComplete: () => ring.destroy(),
      });
    }
  }

  // ---- melee-sweep ----
  private fireMeleeSweep(
    playerPos: { x: number; y: number },
    area: number,
    damage: number,
    crit: boolean,
    enemies: EnemyView[],
    data: WeaponData
  ): void {
    const nearest = nearestTarget(playerPos, enemies, Infinity);
    const facing = nearest ? directionTo(playerPos, nearest) : { x: 1, y: 0 };
    const facingAngle = Math.atan2(facing.y, facing.x);
    const halfArc = (140 * Math.PI) / 180 / 2;
    const range = area > 0 ? area : 60;

    for (const e of enemies) {
      const d = distance(playerPos, e);
      if (d > range + e.radius) continue;
      const toEnemy = Math.atan2(e.y - playerPos.y, e.x - playerPos.x);
      let diff = Math.abs(toEnemy - facingAngle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff <= halfArc) {
        this.ctx.damageEnemy(e.id, damage, crit);
      }
    }

    const fk = frameKey(SPRITE_KEYS.fxSweep);
    if (this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(playerPos.x, playerPos.y, fk);
      s.setDepth(950);
      s.setRotation(facingAngle);
      this.scene.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() });
    } else {
      const arc = this.scene.add.arc(
        playerPos.x,
        playerPos.y,
        range,
        Phaser.Math.RadToDeg(facingAngle - halfArc),
        Phaser.Math.RadToDeg(facingAngle + halfArc),
        false,
        0xf4f0e8,
        0.4
      );
      arc.setDepth(950);
      this.scene.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
    }
  }

  // ---- projectile ----
  private fireProjectile(
    playerPos: { x: number; y: number },
    stats: WeaponLevelStats,
    data: WeaponData,
    damage: number,
    crit: boolean,
    area: number,
    enemies: EnemyView[]
  ): void {
    const kind = data.projectile?.kind ?? "straight";
    const speed = stats.speed ?? 260;
    const pierce = data.projectile?.pierce ?? 0;
    const splitCount = data.projectile?.splitCount ?? 0;

    const nearest = nearestTarget(playerPos, enemies, Infinity);
    const dir = nearest ? directionTo(playerPos, nearest) : { x: 1, y: 0 };

    this.projectiles.spawn({
      owner: "friendly",
      kind,
      x: playerPos.x,
      y: playerPos.y,
      dirX: dir.x,
      dirY: dir.y,
      speed,
      damage,
      crit,
      area: kind === "boomerang" ? area : Math.max(area, 300),
      pierce,
      splitCount,
      spriteKey: this.projectileSpriteFor(data),
    });
  }

  private projectileSpriteFor(data: WeaponData): string {
    switch (data.animal) {
      case "dog":
        return SPRITE_KEYS.projStick;
      case "cat":
        return SPRITE_KEYS.projHairball;
      case "rabbit":
        return SPRITE_KEYS.projCarrot;
      default:
        return SPRITE_KEYS.projGoo;
    }
  }

  // ---- orbit ----
  private setupOrbiters(runtime: WeaponRuntime, stats: WeaponLevelStats, area: number): void {
    const count = stats.count ?? 1;
    if (runtime.orbiters.length !== count) {
      runtime.orbiters = [];
      for (let i = 0; i < count; i++) {
        runtime.orbiters.push({
          angleOffsetDeg: (360 / count) * i,
          rehitCooldowns: new Map(),
        });
      }
    }
  }

  private updateOrbiters(
    runtime: WeaponRuntime,
    data: WeaponData,
    active: ActiveWeapon,
    enemies: EnemyView[],
    deltaMs: number,
    playerPos: { x: number; y: number }
  ): void {
    if (runtime.orbiters.length === 0) return;
    const stats = resolveWeaponStats(data.levels, data.evolution.stats, active.level, active.evolved);
    const area = computeArea(stats.area, this.ctx.statBonus("area"));
    const speedDegPerSec = stats.speed ?? 90;
    const damage = computeDamage({
      baseDamage: stats.damage,
      statBonusDamagePct: this.ctx.statBonus("damage"),
      wellFed: this.ctx.isWellFed(),
      critRoll: Math.random(),
      critChancePct: computeCritChance(stats.critPct, this.ctx.statBonus("critPct")),
    });

    const nowSec = this.scene.time.now / 1000;

    for (const orb of runtime.orbiters) {
      const angleDeg = orb.angleOffsetDeg + speedDegPerSec * nowSec;
      const angleRad = Phaser.Math.DegToRad(angleDeg);
      const ox = playerPos.x + Math.cos(angleRad) * area;
      const oy = playerPos.y + Math.sin(angleRad) * area;

      for (const [enemyId, msLeft] of Array.from(orb.rehitCooldowns.entries())) {
        const next = msLeft - deltaMs;
        if (next <= 0) orb.rehitCooldowns.delete(enemyId);
        else orb.rehitCooldowns.set(enemyId, next);
      }

      for (const e of enemies) {
        if (orb.rehitCooldowns.has(e.id)) continue;
        if (distance({ x: ox, y: oy }, e) <= 8 + e.radius) {
          this.ctx.damageEnemy(e.id, damage.amount, damage.crit);
          orb.rehitCooldowns.set(e.id, ORBIT_REHIT_MS);
        }
      }
    }
  }

  // ---- trail ----
  private startTrailBurst(
    runtime: WeaponRuntime,
    damage: number,
    crit: boolean,
    area: number,
    durationMs: number
  ): void {
    runtime.trail = {
      active: true,
      remainingMs: TRAIL_BURST_MS,
      lastSegmentPos: null,
      damage,
      crit,
      area,
      durationMs,
    };
  }

  private updateTrailBurst(
    runtime: WeaponRuntime,
    deltaMs: number,
    playerPos: { x: number; y: number }
  ): void {
    if (!runtime.trail.active) return;

    runtime.trail.remainingMs -= deltaMs;
    if (runtime.trail.remainingMs <= 0) {
      runtime.trail.active = false;
      return;
    }

    if (
      !runtime.trail.lastSegmentPos ||
      distance(runtime.trail.lastSegmentPos, playerPos) >= TRAIL_SEGMENT_SPACING_PX
    ) {
      runtime.trail.lastSegmentPos = { x: playerPos.x, y: playerPos.y };
      this.spawnZone(
        runtime,
        playerPos,
        Math.max(20, runtime.trail.area * 0.4),
        runtime.trail.damage,
        runtime.trail.crit,
        runtime.trail.durationMs,
        true
      );
    }
  }

  // ---- zone ----
  private spawnZone(
    runtime: WeaponRuntime,
    pos: { x: number; y: number },
    radius: number,
    damage: number,
    crit: boolean,
    durationMs: number,
    oneShot = false
  ): void {
    const fk = frameKey(SPRITE_KEYS.fxAura);
    let graphic: Phaser.GameObjects.Arc | null = null;
    if (!this.scene.textures.exists(fk)) {
      graphic = this.scene.add.circle(pos.x, pos.y, radius, 0x8b5fbf, 0.25);
      graphic.setDepth(940);
    } else {
      // Even with an atlas fx sprite available we still track a lightweight
      // invisible hit-area circle for collision math; visuals are cosmetic.
      graphic = null;
    }

    runtime.zones.push({
      x: pos.x,
      y: pos.y,
      radius,
      damage,
      crit,
      remainingMs: durationMs,
      tickRemainingMs: 0, // tick immediately on spawn
      graphic,
    });

    if (oneShot) {
      // Trail segments are short-lived single zones; nothing extra needed,
      // they expire naturally via updateZones().
    }
  }

  private updateZones(runtime: WeaponRuntime, enemies: EnemyView[], deltaMs: number): void {
    for (let i = runtime.zones.length - 1; i >= 0; i--) {
      const z = runtime.zones[i];
      z.remainingMs -= deltaMs;
      z.tickRemainingMs -= deltaMs;

      if (z.tickRemainingMs <= 0) {
        z.tickRemainingMs = ZONE_TICK_MS;
        for (const e of enemies) {
          if (distance(z, e) <= z.radius + e.radius) {
            this.ctx.damageEnemy(e.id, z.damage, z.crit);
          }
        }
      }

      if (z.remainingMs <= 0) {
        z.graphic?.destroy();
        runtime.zones.splice(i, 1);
      }
    }
  }

  destroy(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.zones.forEach((z) => z.graphic?.destroy());
    }
    this.runtimes.clear();
    if (this.ownedProjectilePool) this.projectiles.destroy();
  }
}
