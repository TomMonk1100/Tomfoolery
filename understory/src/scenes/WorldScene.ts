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
import { HazardSystem } from "../systems/HazardSystem";
import { DraftSystem } from "../systems/DraftSystem";
import { SpriteComposer } from "../systems/SpriteComposer";
import { InstinctAI } from "../systems/InstinctAI";
import type { System } from "../core/context";
import type { InputSource } from "../core/types";

import animalsJson from "../data/animals.json";
import cardsJson from "../data/cards.json";
import weaponsJson from "../data/weapons.json";
import passivesJson from "../data/passives.json";
import enemiesJson from "../data/enemies.json";
import type { WeaponData, PassiveData, EnemyData } from "../core/types";
import { MAX_LEVEL, WELL_FED_THRESHOLD, EV as EVX } from "../core/types";
import type { CombatProvider, EnemyView } from "../core/context";

const ANIMALS = animalsJson as unknown as Record<string, AnimalData>;
const CARDS = cardsJson as unknown as CardData[];
const WEAPONS = weaponsJson as unknown as WeaponData[];
const PASSIVES = passivesJson as unknown as PassiveData[];
const ENEMIES = enemiesJson as unknown as EnemyData[];

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
  private hud!: Phaser.GameObjects.Text;
  private worldBounds = { width: WORLD_SIZE * TILE_PX, height: WORLD_SIZE * TILE_PX };

  constructor() {
    super(SCENE.World);
  }

  create(data: { instinct?: boolean }): void {
    const animal = ANIMALS.dog;
    const player = createPlayerState("dog", !!data.instinct);
    this.emitter = new Phaser.Events.EventEmitter();

    const audio: AudioLike =
      (this.registry.get(REG.audio) as AudioManager | undefined) ??
      new AudioManager();

    // Player avatar (a base body + slot children the SpriteComposer manages).
    const cx = this.worldBounds.width / 2;
    const cy = this.worldBounds.height / 2;
    this.playerContainer = this.add.container(cx, cy);
    const body = this.add.ellipse(0, 0, 26, 20, 0xdcc7a0);
    body.setStrokeStyle(2, 0x7a5c3a);
    this.playerContainer.add(body);
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
        const nx = Phaser.Math.Clamp(
          scene.playerContainer.x + dx,
          12,
          scene.worldBounds.width - 12
        );
        const ny = Phaser.Math.Clamp(
          scene.playerContainer.y + dy,
          12,
          scene.worldBounds.height - 12
        );
        scene.playerContainer.setPosition(nx, ny);
      },
      get world(): WorldView {
        return worldRef;
      },
      season: (): Season => scene.season.currentSeason(),
      addXP: (amount: number): void => scene.addXP(amount),
      statBonus: (statType: string): number =>
        statBonus(player, CARDS, statType),
      audio,
      isPaused: (): boolean => scene.scene.isPaused(SCENE.World),

      // ---- Nest & Fang combat API: catalogs + delegating stubs.
      // Systems overwrite the stubs via registerCombatProvider() in their
      // constructors; anything not yet registered stays a safe no-op.
      weapons: WEAPONS,
      passives: PASSIVES,
      enemyCatalog: ENEMIES,
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
    const hazards = new HazardSystem(this, this.ctx);
    const draft = new DraftSystem(this, this.ctx);
    const composer = new SpriteComposer(this, this.ctx, this.playerContainer);
    if (typeof hazards.setVerbSystem === "function") {
      hazards.setVerbSystem(verbs);
    }

    this.systems = [
      this.world,
      this.season,
      movement,
      verbs,
      hazards,
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

    // HUD (fixed to the camera).
    this.hud = this.add
      .text(12, 12, "", {
        fontFamily: "system-ui, sans-serif",
        fontSize: "16px",
        color: "#eef6ec",
      })
      .setScrollFactor(0)
      .setDepth(5000);

    // Unlock audio on first gesture.
    this.input.once("pointerdown", () => {
      audio.resume();
      audio.startAmbient();
    });

    // Seed the first sprite render and season mood.
    this.emitter.emit(EV.spriteDirty);
    audio.setSeasonMood(this.season.currentSeason());

    // Run end → Life Story.
    this.emitter.once(EV.runEnded, () => {
      this.scene.start(SCENE.LifeStory, { player });
    });
  }

  /** Live combat provider registry — systems fill this in via ctx. */
  private combat: Partial<CombatProvider> = {};

  /** Apply damage to the player, emit events, convert death to run end. */
  private onPlayerDamaged(amount: number, source: string): void {
    const p = this.ctx.player;
    if (p.hp <= 0) return;
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
    this.updateHud();
  }

  private updateHud(): void {
    const p = this.ctx.player;
    const season = this.season.currentSeason();
    const stage = { spring: "Newborn", summer: "Juvenile", autumn: "Adult", winter: "Elder" }[
      season
    ];
    const pct = Math.round(this.season.progress() * 100);
    this.hud.setText(
      `${season[0].toUpperCase() + season.slice(1)} · ${stage}\n` +
        `Lv ${p.level}  XP ${Math.floor(p.xp)}  Forage ${p.stats.forageCount}\n` +
        `Run ${pct}%${p.instinctMode ? "  · Instinct" : ""}`
    );
  }

  // Convenience for potential external/testing use.
  getContext(): GameContext {
    return this.ctx;
  }

  static readonly size = { width: GAME_WIDTH, height: GAME_HEIGHT };
}
