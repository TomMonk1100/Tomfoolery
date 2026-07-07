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
  resolveEvolution,
} from "../../core/types";
import { SPRITE_KEYS, frameKey, playAnim } from "../../gfx/PixelArt";
import {
  distance,
  tickCooldown,
  resetCooldown,
  computeDamage,
  computeCooldown,
  computeArea,
  computeCritChance,
  resolveWeaponStats,
  shouldFireWeapon,
  isInPattern,
  CooldownState,
} from "./sim";
import { WeaponPattern } from "../../core/types";
import { ProjectilePool } from "./ProjectilePool";

const PLAYER_RADIUS = 14;
const ORBIT_REHIT_MS = 300;
const ZONE_TICK_MS = 400;
const TRAIL_SEGMENT_SPACING_PX = 60;
const TRAIL_BURST_MS = 1500;

interface OrbiterState {
  angleOffsetDeg: number;
  rehitCooldowns: Map<string, number>; // enemyId -> ms remaining
  /** Fixed post-launch bug: orbiters dealt damage but drew nothing, so
   * orbit-archetype weapons (lucky-clover, bee-swarm, firefly-lantern,
   * glowhive, clover-cascade) were reported live as invisible attacks. */
  graphic: Phaser.GameObjects.Arc | null;
}

interface ZoneInstance {
  x: number;
  y: number;
  radius: number;
  damage: number;
  crit: boolean;
  remainingMs: number;
  tickRemainingMs: number;
  graphic: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite | null;
}

/** Update 2 §3: every weapon must SHOW its attack. Per-weapon zone tint so
 * dig/burrow-network read as dirt, purr-aura as its established purple, etc.
 * (previously spawnZone rendered NOTHING when the fx_aura atlas texture
 * existed — this was the root cause of "invisible" dig/purr-aura/
 * burrow-network/trail-segment weapons; fixed in spawnZone below.) */
const ZONE_TINT_BY_WEAPON: Record<string, number> = {
  dig: 0x4a3423,
  "burrow-network": 0x4a3423,
  "purr-aura": 0x8b5fbf,
  "cottontail-decoy": 0xf4f0e8,
  zoomies: 0xe8b23d,
  "bunny-barrage": 0xdcc7a0,
  "midnight-prowl": 0x3a2f4a,
  "skunk-cloud": 0x9ad35f,
  "laser-pointer": 0xd94f4f,
};
const DEFAULT_ZONE_TINT = 0x8b5fbf;
const GOLD_TINT = 0xe8b23d;
/** Update 3 (D8, scoped): fused weapons alternate between GOLD_TINT and this
 * purple each fire, approximating "dual-hue: tint alternates between both
 * input weapons' colors" (plan §6.4) without needing a per-weapon canonical
 * color, which doesn't exist in the data model -- see
 * docs/update-3-deviations.md. */
const FUSED_TINT_B = 0x8b5fbf;

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

  /** Update 2 §2: evolved weapons get a gold tint on their fx, whatever kind of display object it is. */
  /** Update 3: per-weapon-id fire parity counter driving the fused dual-hue
   * alternation (§6.4). Keyed by weaponId, not by ActiveWeapon instance --
   * a slot only ever holds one weapon at a time so this is equivalent and
   * needs no cleanup on weapon removal (stale entries are harmless). */
  private fusedTintParity = new Map<string, number>();

  /** Grade-aware tint: base (undefined, caller's own color) / evolved (gold,
   * unchanged from Update 2) / fused (alternates gold <-> purple per fire). */
  private weaponGradeTint(data: WeaponData): number {
    if (!data.fusionOnly) return GOLD_TINT;
    const n = (this.fusedTintParity.get(data.id) ?? 0) + 1;
    this.fusedTintParity.set(data.id, n);
    return n % 2 === 0 ? FUSED_TINT_B : GOLD_TINT;
  }

  private tintIfEvolved(
    obj: Phaser.GameObjects.GameObject,
    evolved: boolean,
    data?: WeaponData
  ): void {
    if (!evolved) return;
    const tint = data ? this.weaponGradeTint(data) : GOLD_TINT;
    const anyObj = obj as unknown as {
      setTint?: (c: number) => unknown;
      setFillStyle?: (c: number, a?: number) => unknown;
      setStrokeStyle?: (w: number, c: number, a?: number) => unknown;
      fillAlpha?: number;
    };
    if (typeof anyObj.setTint === "function") anyObj.setTint(tint);
    else if (typeof anyObj.setFillStyle === "function") anyObj.setFillStyle(tint, anyObj.fillAlpha ?? 0.4);
    else if (typeof anyObj.setStrokeStyle === "function") anyObj.setStrokeStyle(2, tint, 0.9);
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
    const facing = this.ctx.getFacing();

    for (const active of this.ctx.player.activeWeapons) {
      const runtime = this.runtimes.get(active.weaponId);
      const data = this.findWeaponData(active.weaponId);
      if (!runtime || !data) continue;

      this.updateZones(runtime, enemies, deltaMs);
      this.updateOrbiters(runtime, data, active, enemies, deltaMs, playerPos);
      this.updateTrailBurst(runtime, deltaMs, playerPos, data, active.evolved);

      // Update 3: resolve the taken evolution branch (fallback: first branch;
      // fusion-only weapons have none — evolved stats then never apply).
      const evo = resolveEvolution(data, active);
      const stats = resolveWeaponStats(
        data.levels,
        evo?.stats ?? data.levels[data.levels.length - 1],
        active.level,
        active.evolved
      );
      const archetype = active.evolved && evo?.archetype
        ? evo.archetype
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

      this.fireWeapon(runtime, data, stats, archetype, active, area, playerPos, enemies, facing);

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
          ? resolveWeaponStats(
              data.levels,
              resolveEvolution(data, active)?.stats ??
                data.levels[data.levels.length - 1],
              active.level,
              active.evolved
            )
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
        runtime?.orbiters.forEach((o) => o.graphic?.destroy());
        this.runtimes.delete(key);
      }
    }
  }

  /** Effective pattern for this fire: evolution override (if evolved) else base, defaulting per-archetype for backward compatibility. */
  private resolvePattern(data: WeaponData, active: ActiveWeapon): WeaponPattern {
    const explicit = active.evolved
      ? resolveEvolution(data, active)?.pattern ?? data.pattern
      : data.pattern;
    if (explicit) return explicit;
    // No explicit pattern: preserve pre-Update-2 behavior per archetype.
    return data.archetype === "melee-sweep" ? "arc" : "ring";
  }

  private resolveArcDeg(data: WeaponData): number {
    // Legacy melee-sweep (no explicit pattern) used a fixed 140deg cone.
    return data.arcDeg ?? (data.pattern ? 100 : 140);
  }

  private fireWeapon(
    runtime: WeaponRuntime,
    data: WeaponData,
    stats: WeaponLevelStats,
    archetype: WeaponArchetype,
    active: ActiveWeapon,
    area: number,
    playerPos: { x: number; y: number },
    enemies: EnemyView[],
    facing: { x: number; y: number }
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

    const pattern = this.resolvePattern(data, active);
    const arcDeg = this.resolveArcDeg(data);

    switch (archetype) {
      case "aoe-pulse":
        this.fireAoePulse(playerPos, area, damage, crit, enemies, data, facing, pattern, arcDeg, active.evolved);
        break;
      case "melee-sweep":
        this.fireMeleeSweep(playerPos, area, damage, crit, enemies, data, facing, pattern, arcDeg, active.evolved);
        break;
      case "projectile":
        this.fireProjectile(playerPos, stats, data, damage, crit, area, enemies, facing, active.evolved);
        break;
      case "orbit":
        this.setupOrbiters(runtime, stats, area, data, active.evolved);
        break;
      case "trail":
        this.startTrailBurst(runtime, damage, crit, area, stats.durationMs ?? 1000, data, playerPos, facing, active.evolved);
        break;
      case "zone":
        this.spawnZone(runtime, playerPos, area, damage, crit, stats.durationMs ?? 2000, false, data, active.evolved);
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
    data: WeaponData,
    facing: { x: number; y: number },
    pattern: WeaponPattern,
    arcDeg: number,
    evolved: boolean
  ): void {
    for (const e of enemies) {
      const delta = { x: e.x - playerPos.x, y: e.y - playerPos.y };
      if (isInPattern(pattern, delta, facing, area + e.radius, { arcDeg })) {
        this.ctx.damageEnemy(e.id, damage, crit);
      }
    }
    this.playRingFx(playerPos, area, data, evolved);
  }

  private playRingFx(
    playerPos: { x: number; y: number },
    area: number,
    data: WeaponData,
    evolved: boolean
  ): void {
    const key = data.animal === "rabbit" ? SPRITE_KEYS.fxQuakeRing : SPRITE_KEYS.fxBarkRing;
    const fk = frameKey(key);
    if (this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(playerPos.x, playerPos.y, fk);
      s.setDepth(950);
      const scale = area / 32;
      s.setScale(scale);
      this.tintIfEvolved(s, evolved, data);
      this.scene.tweens.add({
        targets: s,
        alpha: 0,
        duration: 250,
        onComplete: () => s.destroy(),
      });
    } else {
      const ring = this.scene.add.circle(playerPos.x, playerPos.y, area, 0xffffff, 0);
      ring.setStrokeStyle(2, evolved ? this.weaponGradeTint(data) : 0xe8b23d, 0.8);
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
    data: WeaponData,
    facing: { x: number; y: number },
    pattern: WeaponPattern,
    arcDeg: number,
    evolved: boolean
  ): void {
    const facingAngle = Math.atan2(facing.y, facing.x);
    const range = area > 0 ? area : 60;
    const halfWidth = 14;

    for (const e of enemies) {
      const delta = { x: e.x - playerPos.x, y: e.y - playerPos.y };
      if (isInPattern(pattern, delta, facing, range + e.radius, { arcDeg, halfWidth: halfWidth + e.radius })) {
        this.ctx.damageEnemy(e.id, damage, crit);
      }
    }

    this.playMeleeFx(playerPos, range, facingAngle, pattern, arcDeg, halfWidth, data, evolved);
  }

  private playMeleeFx(
    playerPos: { x: number; y: number },
    range: number,
    facingAngle: number,
    pattern: WeaponPattern,
    arcDeg: number,
    halfWidth: number,
    data: WeaponData,
    evolved: boolean
  ): void {
    const fk = frameKey(SPRITE_KEYS.fxSweep);
    if (this.scene.textures.exists(fk) && pattern === "arc") {
      const s = this.scene.add.sprite(playerPos.x, playerPos.y, fk);
      s.setDepth(950);
      s.setRotation(facingAngle);
      this.tintIfEvolved(s, evolved, data);
      this.scene.tweens.add({ targets: s, alpha: 0, duration: 200, onComplete: () => s.destroy() });
      return;
    }

    if (pattern === "line-both" || pattern === "cross") {
      this.playLineFx(playerPos, range, halfWidth, facingAngle, pattern === "cross", evolved, data);
      return;
    }

    const halfArcRad = ((arcDeg * Math.PI) / 180) / 2;
    const arc = this.scene.add.arc(
      playerPos.x,
      playerPos.y,
      range,
      Phaser.Math.RadToDeg(facingAngle - halfArcRad),
      Phaser.Math.RadToDeg(facingAngle + halfArcRad),
      false,
      evolved ? this.weaponGradeTint(data) : 0xf4f0e8,
      0.4
    );
    arc.setDepth(950);
    this.scene.tweens.add({ targets: arc, alpha: 0, duration: 200, onComplete: () => arc.destroy() });
  }

  /** Thin front+back slash strip (line-both), or +2 more at 90deg for cross. */
  private playLineFx(
    playerPos: { x: number; y: number },
    length: number,
    halfWidth: number,
    facingAngle: number,
    cross: boolean,
    evolved: boolean,
    data: WeaponData
  ): void {
    const fk = frameKey(SPRITE_KEYS.fxScissor);
    const angles = cross
      ? [facingAngle, facingAngle + Math.PI / 2]
      : [facingAngle];
    for (const angle of angles) {
      if (this.scene.textures.exists(fk)) {
        const s = this.scene.add.sprite(playerPos.x, playerPos.y, fk);
        s.setDepth(950);
        s.setRotation(angle);
        s.setDisplaySize(length * 2, halfWidth * 2);
        this.tintIfEvolved(s, evolved, data);
        this.scene.tweens.add({ targets: s, alpha: 0, duration: 150, onComplete: () => s.destroy() });
      } else {
        const rect = this.scene.add.rectangle(
          playerPos.x,
          playerPos.y,
          length * 2,
          halfWidth * 2,
          evolved ? GOLD_TINT : 0xf4f0e8,
          0.45
        );
        rect.setRotation(angle);
        rect.setDepth(950);
        this.scene.tweens.add({ targets: rect, alpha: 0, duration: 150, onComplete: () => rect.destroy() });
      }
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
    enemies: EnemyView[],
    facing: { x: number; y: number },
    evolved: boolean
  ): void {
    const kind = data.projectile?.kind ?? "straight";
    const speed = stats.speed ?? 260;
    const pierce = data.projectile?.pierce ?? 0;
    const splitCount = data.projectile?.splitCount ?? 0;

    // Update 2: all projectiles spawn toward the shared facing (nearest-enemy
    // auto-aim, wrap-aware), not a locally-recomputed nearest target.
    const dir = facing;

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
      tint: evolved ? this.weaponGradeTint(data) : undefined,
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
  private setupOrbiters(
    runtime: WeaponRuntime,
    stats: WeaponLevelStats,
    area: number,
    data: WeaponData,
    evolved: boolean
  ): void {
    const count = stats.count ?? 1;
    if (runtime.orbiters.length !== count) {
      for (const old of runtime.orbiters) old.graphic?.destroy();
      runtime.orbiters = [];
      const color = evolved ? this.weaponGradeTint(data) : 0xf4f0e8;
      for (let i = 0; i < count; i++) {
        const g = this.scene.add.circle(0, 0, 8, color, 0.9);
        g.setStrokeStyle(1.5, 0x1a1423, 0.8);
        g.setDepth(950);
        runtime.orbiters.push({
          angleOffsetDeg: (360 / count) * i,
          rehitCooldowns: new Map(),
          graphic: g,
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
    const stats = resolveWeaponStats(
      data.levels,
      resolveEvolution(data, active)?.stats ?? data.levels[data.levels.length - 1],
      active.level,
      active.evolved
    );
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
      orb.graphic?.setPosition(ox, oy);

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
    durationMs: number,
    data: WeaponData,
    playerPos: { x: number; y: number },
    facing: { x: number; y: number },
    evolved: boolean
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
    // Update 2 §2: midnight-prowl (and other trail weapons) get an immediate
    // dash-streak flash at burst start so the attack reads instantly, not just
    // via the trailing segments laid down as the player moves.
    this.playDashStreak(playerPos, facing, area, data, evolved);
  }

  private playDashStreak(
    playerPos: { x: number; y: number },
    facing: { x: number; y: number },
    area: number,
    data: WeaponData,
    evolved: boolean
  ): void {
    const angle = Math.atan2(facing.y, facing.x);
    const length = Math.max(40, area);
    const tint = evolved ? this.weaponGradeTint(data) : ZONE_TINT_BY_WEAPON[data.id] ?? DEFAULT_ZONE_TINT;
    const streak = this.scene.add.rectangle(
      playerPos.x + facing.x * length * 0.3,
      playerPos.y + facing.y * length * 0.3,
      length,
      10,
      tint,
      0.5
    );
    streak.setRotation(angle);
    streak.setDepth(945);
    this.scene.tweens.add({
      targets: streak,
      alpha: 0,
      scaleX: 1.4,
      duration: 220,
      onComplete: () => streak.destroy(),
    });
  }

  private updateTrailBurst(
    runtime: WeaponRuntime,
    deltaMs: number,
    playerPos: { x: number; y: number },
    data: WeaponData,
    evolved: boolean
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
        true,
        data,
        evolved
      );
    }
  }

  // ---- zone ----
  /**
   * Update 2 §2 fix: previously, when the fx_aura atlas texture existed, this
   * set `graphic = null` ("visuals are cosmetic") and rendered NOTHING at
   * all — the root cause behind dig/purr-aura/burrow-network/cottontail-decoy
   * and every trail weapon's segments (zoomies/bunny-barrage/midnight-prowl)
   * being invisible. Now every zone always gets a real, per-weapon-tinted
   * display object (the atlas fx_aura sprite playing its pulse loop when
   * available, else a tinted fallback circle), attached to the ZoneInstance
   * exactly like the old fallback path so the existing cleanup in
   * updateZones() (`z.graphic?.destroy()`) keeps working unchanged.
   */
  private spawnZone(
    runtime: WeaponRuntime,
    pos: { x: number; y: number },
    radius: number,
    damage: number,
    crit: boolean,
    durationMs: number,
    oneShot: boolean,
    data: WeaponData,
    evolved: boolean
  ): void {
    const fk = frameKey(SPRITE_KEYS.fxAura);
    const tint = evolved ? this.weaponGradeTint(data) : ZONE_TINT_BY_WEAPON[data.id] ?? DEFAULT_ZONE_TINT;
    let graphic: Phaser.GameObjects.Arc | Phaser.GameObjects.Sprite;
    if (this.scene.textures.exists(fk)) {
      const s = this.scene.add.sprite(pos.x, pos.y, fk);
      s.setDepth(940);
      s.setScale(radius / 16);
      s.setTint(tint);
      s.setAlpha(oneShot ? 0.55 : 0.4);
      playAnim(s, SPRITE_KEYS.fxAura, "pulse");
      graphic = s;
    } else {
      const c = this.scene.add.circle(pos.x, pos.y, radius, tint, oneShot ? 0.35 : 0.25);
      c.setDepth(940);
      graphic = c;
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
