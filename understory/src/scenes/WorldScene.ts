import Phaser from "phaser";
import {
  SCENE,
  REG,
  EV,
  GAME_WIDTH,
  GAME_HEIGHT,
  AnimalData,
  CardData,
  Season,
  WORLD_SIZE,
  TILE_PX,
} from "../core/types";
import { GameContext, WorldView, Vec2, AudioLike } from "../core/context";
import { createPlayerState, statBonus } from "../core/playerState";
import { AudioManager } from "../audio/AudioManager";
import { InputController } from "../core/InputController";
import { MovementSystem } from "../systems/MovementSystem";
import { WorldGenSystem } from "../systems/WorldGenSystem";
import { VerbSystem } from "../systems/VerbSystem";
import { SeasonSystem } from "../systems/SeasonSystem";
import { DraftSystem } from "../systems/DraftSystem";
import { SpriteComposer } from "../systems/SpriteComposer";
import { InstinctAI } from "../systems/InstinctAI";
import { ProjectilePool } from "../systems/combat/ProjectilePool";
import { EnemySystem } from "../systems/combat/EnemySystem";
import { WaveDirector } from "../systems/combat/WaveDirector";
import { WeaponSystem } from "../systems/combat/WeaponSystem";
import { XPMoteSystem } from "../systems/combat/XPMoteSystem";
import { HungerSystem } from "../systems/HungerSystem";
import { FoodSystem } from "../systems/FoodSystem";
import { NestSystem } from "../systems/NestSystem";
import { CompanionSystem } from "../systems/CompanionSystem";
import { registerAllSprites } from "../gfx/sprites";
import { buildAtlas, frameKey, playAnim } from "../gfx/PixelArt";
import { JuiceSystem } from "../vfx/Juice";
import { HUD } from "../ui/HUD";
import { computeFacing } from "../systems/combat/sim";
import type { System } from "../core/context";
import type { InputSource } from "../core/types";

import animalsJson from "../data/animals.json";
import cardsJson from "../data/cards.json";
import weaponsJson from "../data/weapons.json";
import passivesJson from "../data/passives.json";
import enemiesJson from "../data/enemies.json";
import fusionsJson from "../data/fusions.json";
import synergiesJson from "../data/synergies.json";
import type { WeaponData, PassiveData, EnemyData, FusionData, SynergyData } from "../core/types";
import { normalizeWeapons } from "../core/weaponCatalog";
import { MAX_LEVEL, WELL_FED_THRESHOLD, EV as EVX } from "../core/types";
import type { CombatProvider, EnemyView } from "../core/context";

const ANIMALS = animalsJson as unknown as Record<string, AnimalData>;
const CARDS = cardsJson as unknown as CardData[];
const WEAPONS = normalizeWeapons(weaponsJson);
const PASSIVES = passivesJson as unknown as PassiveData[];
const ENEMIES = enemiesJson as unknown as EnemyData[];
const FUSIONS = fusionsJson as unknown as FusionData[];
const SYNERGY_DEFS = synergiesJson as unknown as SynergyData[];

/**
 * WorldScene — owns the GameContext and constructs/updates every gameplay
 * system. This is the integration seam between the independently-built systems.
 */
export class WorldScene extends Phaser.Scene {
  private ctx!: GameContext;
  private emitter!: Phaser.Events.EventEmitter;
  private playerContainer!: Phaser.GameObjects.Container;
  private systems: System[] = [];
  private inputSource!: InputSource & Partial<System>;
  private season!: SeasonSystem;
  private world!: WorldGenSystem;
  private worldBounds = { width: WORLD_SIZE * TILE_PX, height: WORLD_SIZE * TILE_PX };

  constructor() {
    super(SCENE.World);
  }

  create(data: { instinct?: boolean; animalId?: string }): void {
    const animalId = data.animalId && ANIMALS[data.animalId] ? data.animalId : "dog";
    const animal = ANIMALS[animalId];
    const player = createPlayerState(animalId, !!data.instinct, animal.maxHp ?? 100);
    // Equip the species starting weapon.
    const startingWeaponId =
      animal.startingWeaponId ??
      WEAPONS.find((w) => w.animal === animalId && w.isStarting)?.id;
    if (startingWeaponId) {
      player.activeWeapons.push({
        weaponId: startingWeaponId,
        level: 1,
        evolved: false,
      });
    }
    this.emitter = new Phaser.Events.EventEmitter();

    // Bake the pixel-art atlas (idempotent across runs).
    try {
      registerAllSprites();
      buildAtlas(this);
    } catch (err) {
      console.warn("[WorldScene] atlas build failed, using fallback shapes", err);
    }

    const audio: AudioLike =
      (this.registry.get(REG.audio) as AudioManager | undefined) ??
      new AudioManager();

    // Player avatar (animal sprite + slot children the SpriteComposer manages).
    const cx = this.worldBounds.width / 2;
    const cy = this.worldBounds.height / 2;
    this.playerContainer = this.add.container(cx, cy);
    const animalKey = animal.spriteKey ?? `animal_${animalId}`;
    if (this.textures.exists(frameKey(animalKey))) {
      const body = this.add.sprite(0, 0, frameKey(animalKey));
      body.setDisplaySize(40, 40); // 24px map baked at 3x, shown at ~1.25 tiles
      playAnim(body, animalKey, "idle");
      this.playerSprite = body;
      this.playerSpriteKey = animalKey;
      this.playerContainer.add(body);
    } else {
      const body = this.add.ellipse(0, 0, 26, 20, 0xdcc7a0);
      body.setStrokeStyle(2, 0x7a5c3a);
      this.playerContainer.add(body);
    }
    this.playerContainer.setDepth(1000);

    // Build the shared context. `world` is filled in immediately after we
    // construct WorldGenSystem below.
    const scene = this;
    let worldRef: WorldView;
    this.ctx = {
      scene: this,
      events: this.emitter,
      player,
      animal,
      cards: CARDS,
      getPlayerPos: (): Vec2 => ({
        x: scene.playerContainer.x,
        y: scene.playerContainer.y,
      }),
      movePlayer: (dx: number, dy: number): void => {
        const w = scene.worldBounds.width;
        const h = scene.worldBounds.height;
        const curX = scene.playerContainer.x;
        const curY = scene.playerContainer.y;

        // Update 2 — water/obstacle uncrossable: slide along the free axis
        // rather than stopping dead. Each axis is checked independently
        // against the *other* axis's current (not yet moved) position, so
        // moving diagonally into a wall corner still slides along the open
        // axis instead of getting stuck.
        const isBlocked = (px: number, py: number): boolean => {
          if (!worldRef) return false;
          const t = worldRef.worldToTile(px, py);
          const tile = worldRef.tileAt(t.col, t.row);
          return !!tile && (tile.type === "water" || tile.type === "obstacle");
        };
        let nx = curX + dx;
        let ny = curY + dy;
        if (dx !== 0 && isBlocked(nx, curY)) nx = curX;
        if (dy !== 0 && isBlocked(nx, ny)) ny = curY;

        // Update 2 — toroidal wrap (Pac-Man style): position wraps modulo
        // world size instead of clamping at the edges. The camera hard-snaps
        // on wrap (acceptable seam per plan — no 9-way ghost rendering).
        const wrappedX = ((nx % w) + w) % w;
        const wrappedY = ((ny % h) + h) % h;
        const didWrap = wrappedX !== nx || wrappedY !== ny;

        scene.playerContainer.setPosition(wrappedX, wrappedY);
        if (didWrap) {
          scene.cameras.main.centerOn(wrappedX, wrappedY);
        }
        // Drive walk anim + facing from actual motion.
        if (Math.abs(dx) + Math.abs(dy) > 0.05) {
          scene.lastMoveAt = scene.time.now;
          scene.lastMoveDir = { x: dx, y: dy };
          if (scene.playerSprite && Math.abs(dx) > 0.05) {
            scene.playerSprite.setFlipX(dx < 0);
          }
        }
      },
      getFacing: (): Vec2 =>
        computeFacing(
          { x: scene.playerContainer.x, y: scene.playerContainer.y },
          scene.combat.getEnemies?.() ?? [],
          Math.max(scene.worldBounds.width, scene.worldBounds.height),
          scene.lastMoveDir
        ),
      get world(): WorldView {
        return worldRef;
      },
      season: (): Season => scene.season.currentSeason(),
      addXP: (amount: number): void => scene.addXP(amount),
      statBonus: (statType: string): number => {
        // Cards (legacy stat cards) + species passives (magnitude x stacks).
        let total = statBonus(player, CARDS, statType);
        for (const ap of player.activePassives) {
          const def = PASSIVES.find((ps) => ps.id === ap.passiveId);
          if (def && def.effect.type === statType) {
            total += def.effect.magnitude * ap.stacks;
          }
        }
        return total;
      },
      audio,
      isPaused: (): boolean => scene.scene.isPaused(SCENE.World),

      // ---- Nest & Fang combat API: catalogs + delegating stubs.
      // Systems overwrite the stubs via registerCombatProvider() in their
      // constructors; anything not yet registered stays a safe no-op.
      weapons: WEAPONS,
      passives: PASSIVES,
      enemyCatalog: ENEMIES,
      fusions: FUSIONS,
      synergyDefs: SYNERGY_DEFS,
      getEnemies: (): EnemyView[] => scene.combat.getEnemies?.() ?? [],
      damageEnemy: (id: string, amount: number, crit?: boolean): boolean =>
        scene.combat.damageEnemy?.(id, amount, crit) ?? false,
      damagePlayer: (amount: number, source: string): void =>
        scene.onPlayerDamaged(amount, source),
      spawnXPMote: (x: number, y: number, value: number): void => {
        if (scene.combat.spawnXPMote) scene.combat.spawnXPMote(x, y, value);
        else scene.addXP(value); // pre-integration fallback: instant XP
      },
      spawnFood: (x: number, y: number, heal: number): void =>
        scene.combat.spawnFood?.(x, y, heal),
      getHunger: (): number => scene.combat.getHunger?.() ?? 100,
      isWellFed: (): boolean =>
        (scene.combat.getHunger?.() ?? 100) > WELL_FED_THRESHOLD,
      getNest: () => scene.combat.getNest?.() ?? null,
      registerCombatProvider: (p: Partial<CombatProvider>): void => {
        Object.assign(scene.combat, p);
      },
    };

    // ---- Construct systems in dependency order ----
    this.world = new WorldGenSystem(this, this.ctx);
    worldRef = this.world;

    this.season = new SeasonSystem(this, this.ctx);
    const movement = new MovementSystem(this, this.ctx);
    const verbs = new VerbSystem(this, this.ctx);
    const draft = new DraftSystem(this, this.ctx);
    const composer = new SpriteComposer(this, this.ctx, this.playerContainer);

    // ---- Nest & Fang combat/survival systems ----
    const projectiles = new ProjectilePool(this, this.ctx);
    const enemies = new EnemySystem(this, this.ctx, projectiles);
    const waves = new WaveDirector(this, this.ctx, enemies);
    const weaponsSys = new WeaponSystem(this, this.ctx, projectiles);
    const motes = new XPMoteSystem(this, this.ctx);
    const hunger = new HungerSystem(this, this.ctx);
    const food = new FoodSystem(this, this.ctx, hunger);
    const nest = new NestSystem(this, this.ctx);
    const companions = new CompanionSystem(this, this.ctx);
    const juice = new JuiceSystem(this, this.ctx);
    const hudSystem = new HUD(this, this.ctx);

    this.systems = [
      juice,
      hudSystem,
      this.world,
      this.season,
      movement,
      verbs,
      projectiles,
      enemies,
      waves,
      weaponsSys,
      motes,
      hunger,
      food,
      nest,
      companions,
      draft,
      composer,
    ];

    // Input source: human controller or AI autopilot.
    this.inputSource = player.instinctMode
      ? new InstinctAI(this, this.ctx)
      : new InputController(this, this.ctx);

    // Camera follows the avatar within world bounds.
    this.cameras.main.setBounds(0, 0, this.worldBounds.width, this.worldBounds.height);
    this.cameras.main.startFollow(this.playerContainer, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor(0x14261a);

    // Unlock audio on first gesture.
    this.input.once("pointerdown", () => {
      audio.resume();
      audio.startAmbient();
    });

    // Seed the first sprite render and season mood.
    this.emitter.emit(EV.spriteDirty);
    audio.setSeasonMood(this.season.currentSeason());

    // Run end → Life Story.
    this.emitter.once(EV.runEnded, (outcome?: string) => {
      this.scene.start(SCENE.LifeStory, { player, outcome: outcome ?? "survived" });
    });
  }

  /** Player animal sprite (undefined when using the ellipse fallback). */
  private playerSprite?: Phaser.GameObjects.Sprite;
  private playerSpriteKey = "";
  private lastMoveAt = 0;
  /** Last nonzero movement direction (unnormalized); facing fallback when no enemies. Defaults to facing right. */
  private lastMoveDir: Vec2 = { x: 1, y: 0 };

  /** Live combat provider registry — systems fill this in via ctx. */
  private combat: Partial<CombatProvider> = {};

  /** Apply damage to the player, emit events, convert death to run end. */
  private onPlayerDamaged(amount: number, source: string): void {
    const p = this.ctx.player;
    if (p.hp <= 0) return;
    // Feline Grace etc.: flat % chance to dodge entirely.
    const dodge = this.ctx.statBonus("dodgePct");
    if (dodge > 0 && Math.random() * 100 < Math.min(dodge, 60)) return;
    // Thick Fur etc.: flat armor reduction, min 1 damage.
    const armor = this.ctx.statBonus("armor");
    if (armor > 0) amount = Math.max(1, amount - armor);
    this.ctx.audio.blip("playerHurt");
    p.hp = Math.max(0, p.hp - amount);
    p.stats.damageTaken += amount;
    this.emitter.emit(EVX.playerDamaged, {
      amount,
      source,
      remainingHp: p.hp,
    });
    if (p.hp <= 0) {
      this.emitter.emit(EVX.playerDied);
      this.emitter.emit(EV.runEnded, "died");
    }
  }

  /** Loyal Heart etc.: passive HP regen, applied once per frame. */
  private applyRegen(deltaMs: number): void {
    const p = this.ctx.player;
    if (p.hp <= 0 || p.hp >= p.maxHp) return;
    const regen = this.ctx.statBonus("hpRegen");
    if (regen > 0) p.hp = Math.min(p.maxHp, p.hp + (regen * deltaMs) / 1000);
  }

  private addXP(amount: number): void {
    const player = this.ctx.player;
    const gained = amount * (player.instinctMode ? 0.6 : 1);
    player.xp += gained;
    player.stats.totalXP += gained;
    while (
      player.level < MAX_LEVEL &&
      player.xp >= this.thresholdFor(player.level + 1)
    ) {
      player.level += 1;
      this.ctx.audio.blip("levelup");
      this.emitter.emit(EV.levelUp, player.level);
    }
  }

  private thresholdFor(level: number): number {
    const t = this.ctx.animal.xpToLevel;
    if (level - 1 < t.length) return t[level - 1];
    return t[t.length - 1] + (level - t.length) * 80;
  }

  update(_time: number, delta: number): void {
    if (this.scene.isPaused(SCENE.World)) return;
    if (this.inputSource.update) this.inputSource.update(delta);
    for (const s of this.systems) s.update(delta);
    this.applyRegen(delta);
    // Walk/idle animation swap based on recent movement.
    if (this.playerSprite) {
      const moving = this.time.now - this.lastMoveAt < 130;
      playAnim(this.playerSprite, this.playerSpriteKey, moving ? "walk" : "idle");
    }
  }

  // Convenience for potential external/testing use.
  getContext(): GameContext {
    return this.ctx;
  }

  static readonly size = { width: GAME_WIDTH, height: GAME_HEIGHT };
}
