/**
 * FoodSystem — pooled food pickups. Spawned by EnemySystem (via
 * ctx.spawnFood, delegated to this system's registered provider) and by
 * forage-bush harvests (EV.forageHarvested). Walking over food either eats
 * it immediately (hunger low) or picks it up as carried food (cap
 * CARRY_CAP), and auto-eats carried food when HP is low.
 *
 * DECISIONS:
 * - Forage integration: VerbSystem (legacy, not touched by this worker)
 *   already emits EV.forageHarvested {x,y,amount} on tap-harvest of a bush.
 *   The spec's "simplest contract-safe approach" is implemented literally:
 *   on that event, spawn 2 food items at the harvest position. XP for the
 *   harvest is already granted by VerbSystem itself — FoodSystem only adds
 *   the food drop layer on top, so no double-XP risk.
 * - "Walk over food" proximity uses a fixed PICKUP_RADIUS_PX (18) rather
 *   than a physics overlap, since FoodSystem owns plain pooled sprites, not
 *   a physics group — keeps this system self-contained per file-ownership
 *   rules.
 * - Per spec: "emit EV.foodSpawned is for spawns; for carry just update
 *   player state" — so EV.foodSpawned fires whenever a food item actually
 *   appears in the world (from ctx.spawnFood or forage harvest), and
 *   EV.foodEaten (via HungerSystem.eat) is the only signal for actual
 *   consumption. Picking up (carrying) food emits nothing; VFX/HUD workers
 *   can read ctx.player.carriedFood directly every frame if they want a
 *   counter.
 * - Auto-eat-from-carry gate: "hp < 50%% and hunger < 100, one per 1.5s
 *   max" — tracked with a cooldown timer, checked every update tick.
 */
import Phaser from "phaser";
import { System, GameContext, Vec2 } from "../core/context";
import { EV, CARRY_CAP } from "../core/types";
import { SPRITE_KEYS, frameKey, playAnim } from "../gfx/PixelArt";
import { HungerSystem } from "./HungerSystem";
import { addCarriedFood, dist } from "./nestHungerSim";

const MAX_FOOD = 60;
const PICKUP_RADIUS_PX = 18;
const EAT_IMMEDIATELY_HUNGER_THRESHOLD = 85;
const AUTO_EAT_HP_FRACTION = 0.5;
const AUTO_EAT_COOLDOWN_MS = 1500;
const FORAGE_FOOD_SPAWN_COUNT = 2;

const FOOD_KEYS = [
  SPRITE_KEYS.foodBerry,
  SPRITE_KEYS.foodMushroom,
  SPRITE_KEYS.foodBone,
] as const;

interface FoodItem {
  obj: Phaser.GameObjects.GameObject & { x: number; y: number };
  heal: number;
  active: boolean;
}

export class FoodSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;
  private hunger: HungerSystem;

  private pool: FoodItem[] = [];
  private rotateIndex = 0;
  private autoEatCooldownMs = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext, hunger: HungerSystem) {
    this.scene = scene;
    this.ctx = ctx;
    this.hunger = hunger;

    this.ctx.registerCombatProvider({
      spawnFood: (x: number, y: number, heal: number) => this.spawnFood(x, y, heal),
    });

    this.ctx.events.on(EV.forageHarvested, this.onForageHarvested, this);
  }

  update(deltaMs: number): void {
    if (this.ctx.isPaused()) return;

    if (this.autoEatCooldownMs > 0) {
      this.autoEatCooldownMs = Math.max(0, this.autoEatCooldownMs - deltaMs);
    }

    const playerPos = this.ctx.getPlayerPos();

    for (const item of this.pool) {
      if (!item.active) continue;
      const d = dist(playerPos, { x: item.obj.x, y: item.obj.y });
      if (d <= PICKUP_RADIUS_PX) {
        this.collect(item);
      }
    }

    this.maybeAutoEatCarried();
  }

  destroy(): void {
    this.ctx.events.off(EV.forageHarvested, this.onForageHarvested, this);
    for (const item of this.pool) {
      item.obj.destroy();
    }
    this.pool = [];
  }

  /** Spawn a food item at a world position. Reuses a pooled/dead slot if possible. */
  spawnFood(x: number, y: number, heal: number): void {
    const activeCount = this.pool.reduce((n, f) => n + (f.active ? 1 : 0), 0);
    if (activeCount >= MAX_FOOD) return; // hard cap, silently drop

    const key = FOOD_KEYS[this.rotateIndex % FOOD_KEYS.length];
    this.rotateIndex++;

    let slot = this.pool.find((f) => !f.active);
    if (!slot) {
      const obj = this.createSprite(x, y, key);
      slot = { obj, heal, active: true };
      this.pool.push(slot);
    } else {
      this.reviveSprite(slot.obj, x, y, key);
      slot.heal = heal;
      slot.active = true;
    }

    this.ctx.events.emit(EV.foodSpawned, { x, y, heal });
  }

  private createSprite(
    x: number,
    y: number,
    key: string
  ): Phaser.GameObjects.GameObject & { x: number; y: number } {
    if (this.scene.textures.exists(frameKey(key))) {
      const sprite = this.scene.add.sprite(x, y, frameKey(key));
      sprite.setDepth(20);
      playAnim(sprite, key, "idle");
      return sprite as unknown as Phaser.GameObjects.GameObject & {
        x: number;
        y: number;
      };
    }
    const circle = this.scene.add.circle(x, y, 6, this.fallbackColor(key));
    circle.setDepth(20);
    return circle as unknown as Phaser.GameObjects.GameObject & {
      x: number;
      y: number;
    };
  }

  private reviveSprite(
    obj: Phaser.GameObjects.GameObject & { x: number; y: number },
    x: number,
    y: number,
    key: string
  ): void {
    obj.x = x;
    obj.y = y;
    (obj as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(true);
    (obj as unknown as { setActive?: (v: boolean) => void }).setActive?.(true);
    if (
      "setTexture" in obj &&
      this.scene.textures.exists(frameKey(key))
    ) {
      (obj as unknown as Phaser.GameObjects.Sprite).setTexture(frameKey(key));
      playAnim(obj as unknown as Phaser.GameObjects.Sprite, key, "idle");
    }
  }

  private fallbackColor(key: string): number {
    if (key === SPRITE_KEYS.foodBerry) return 0xd94f4f;
    if (key === SPRITE_KEYS.foodMushroom) return 0xf4f0e8;
    return 0xdcc7a0; // bone
  }

  private collect(item: FoodItem): void {
    if (this.ctx.player.hunger < EAT_IMMEDIATELY_HUNGER_THRESHOLD) {
      this.hunger.eat();
    } else if (this.ctx.player.carriedFood < CARRY_CAP) {
      this.ctx.player.carriedFood = addCarriedFood(
        this.ctx.player.carriedFood,
        CARRY_CAP
      );
    } else {
      // Full on hunger and carry cap — food is left in the world (not
      // collected) rather than wasted silently disappearing.
      return;
    }

    this.release(item);
  }

  private release(item: FoodItem): void {
    item.active = false;
    (item.obj as unknown as { setVisible?: (v: boolean) => void }).setVisible?.(
      false
    );
    (item.obj as unknown as { setActive?: (v: boolean) => void }).setActive?.(
      false
    );
  }

  private maybeAutoEatCarried(): void {
    if (this.autoEatCooldownMs > 0) return;
    if (this.ctx.player.carriedFood <= 0) return;
    if (this.ctx.player.hunger >= 100) return;
    const hpFraction = this.ctx.player.hp / Math.max(1, this.ctx.player.maxHp);
    if (hpFraction >= AUTO_EAT_HP_FRACTION) return;

    this.ctx.player.carriedFood--;
    this.hunger.eat();
    this.autoEatCooldownMs = AUTO_EAT_COOLDOWN_MS;
  }

  private onForageHarvested(payload: { x: number; y: number; amount: number }): void {
    for (let i = 0; i < FORAGE_FOOD_SPAWN_COUNT; i++) {
      // Slight scatter so multiple items don't render fully overlapped.
      const jitterX = Phaser.Math.Between(-6, 6);
      const jitterY = Phaser.Math.Between(-6, 6);
      this.spawnFood(payload.x + jitterX, payload.y + jitterY, 15);
    }
  }
}
