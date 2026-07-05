/**
 * Pure data validation for the sprite registry. Deliberately imports ONLY
 * from spriteRegistry.ts + the sprite data modules — never PixelArt.ts or
 * Phaser — so this test can run in plain vitest/node without a DOM/canvas.
 */
import { describe, it, expect } from "vitest";
import {
  getRegisteredSprites,
  SPRITE_KEYS,
  iconKey,
} from "../src/gfx/spriteRegistry";
// Side-effect imports: populate the registry.
import "../src/gfx/sprites/animals";
import "../src/gfx/sprites/enemies";
import "../src/gfx/sprites/world";
import "../src/gfx/sprites/ui";

// key -> expected square size, for keys where CONTRACTS.md/PixelArt.ts pins
// a specific size class. Icons are matched by prefix below instead of here.
const EXPECTED_SIZE: Record<string, number> = {
  [SPRITE_KEYS.dog]: 24,
  [SPRITE_KEYS.cat]: 24,
  [SPRITE_KEYS.rabbit]: 24,
  [SPRITE_KEYS.slimeGreen]: 16,
  [SPRITE_KEYS.slimeRed]: 16,
  [SPRITE_KEYS.slimeBlue]: 24,
  [SPRITE_KEYS.gloomcap]: 24,
  [SPRITE_KEYS.thornCrawler]: 24,
  [SPRITE_KEYS.wisp]: 16,
  [SPRITE_KEYS.mudmaw]: 24,
  [SPRITE_KEYS.bossKingSlime]: 48,
  [SPRITE_KEYS.bossElderGloomcap]: 48,
  [SPRITE_KEYS.bossBrambleTyrant]: 48,
  [SPRITE_KEYS.bossLongDark]: 48,
  [SPRITE_KEYS.companionSparrow]: 16,
  [SPRITE_KEYS.companionSquirrel]: 16,
  [SPRITE_KEYS.projStick]: 16,
  [SPRITE_KEYS.projHairball]: 16,
  [SPRITE_KEYS.projCarrot]: 16,
  [SPRITE_KEYS.projGoo]: 16,
  [SPRITE_KEYS.projSpore]: 16,
  [SPRITE_KEYS.projClover]: 16,
  [SPRITE_KEYS.fxBarkRing]: 32,
  [SPRITE_KEYS.fxSweep]: 32,
  [SPRITE_KEYS.fxQuakeRing]: 32,
  [SPRITE_KEYS.fxDust]: 16,
  [SPRITE_KEYS.fxAura]: 32,
  [SPRITE_KEYS.xpMote]: 16,
  [SPRITE_KEYS.foodBerry]: 16,
  [SPRITE_KEYS.foodMushroom]: 16,
  [SPRITE_KEYS.foodBone]: 16,
  [SPRITE_KEYS.tileGrassA]: 32,
  [SPRITE_KEYS.tileGrassB]: 32,
  [SPRITE_KEYS.tileGrassC]: 32,
  [SPRITE_KEYS.tileGrassSeamless]: 64,
  [SPRITE_KEYS.tileWater]: 32,
  [SPRITE_KEYS.tileObstacleTree]: 32,
  [SPRITE_KEYS.tileObstacleRock]: 32,
  [SPRITE_KEYS.propFlower]: 32,
  [SPRITE_KEYS.propPebble]: 32,
  [SPRITE_KEYS.nest]: 32,
  [SPRITE_KEYS.forageBush]: 32,
};

// The 18 weapon ids from docs/CONTRACTS.md §Weapons.
const WEAPON_IDS = [
  "bark-blast",
  "tail-wag-strike",
  "fetch",
  "zoomies",
  "dig",
  "slobber-shot",
  "pounce-slash",
  "claw-flurry",
  "hairball-lob",
  "purr-aura",
  "midnight-prowl",
  "yarn-whip",
  "thumper-quake",
  "scissor-kick",
  "bunny-barrage",
  "carrot-toss",
  "lucky-clover",
  "burrow-network",
  "cottontail-decoy",
  // Update 2 — neutral weapons (animal: "any")
  "tennis-ball",
  "skunk-cloud",
  "bee-swarm",
  "acorn-mortar",
  "firefly-lantern",
  "echo-screech",
  "laser-pointer",
];

// The 12 passive ids from docs/CONTRACTS.md §Passives.
const PASSIVE_IDS = [
  "loyal-heart",
  "thick-fur",
  "keen-nose",
  "big-appetite",
  "feline-grace",
  "predator-eye",
  "soft-paws",
  "picky-eater",
  "lucky-foot",
  "spring-legs",
  "litter-of-friends",
  "nibbler",
  // Update 2 — neutral passives (animal: "any")
  "magnet-collar",
  "wild-heart",
  "alpha-scent",
  "four-leaf",
];

describe("sprite registry", () => {
  const registry = getRegisteredSprites();

  it("registers a def for every canonical SPRITE_KEYS value", () => {
    for (const [name, key] of Object.entries(SPRITE_KEYS)) {
      expect(registry.has(key), `missing sprite def for SPRITE_KEYS.${name} ("${key}")`).toBe(true);
    }
  });

  it("every def has at least one frame, all frames equal dimensions", () => {
    for (const [key, def] of registry) {
      expect(def.frames.length, `"${key}" has no frames`).toBeGreaterThan(0);
      const h = def.frames[0].length;
      const w = def.frames[0][0]?.length ?? 0;
      expect(h, `"${key}" frame 0 has zero height`).toBeGreaterThan(0);
      expect(w, `"${key}" frame 0 has zero width`).toBeGreaterThan(0);
      def.frames.forEach((frame, i) => {
        expect(frame.length, `"${key}" frame ${i} height mismatch`).toBe(h);
        frame.forEach((row, r) => {
          expect(row.length, `"${key}" frame ${i} row ${r} width mismatch`).toBe(w);
        });
      });
    }
  });

  it("every def's frame size matches its size class where one is pinned", () => {
    for (const [key, expectedSize] of Object.entries(EXPECTED_SIZE)) {
      const def = registry.get(key);
      expect(def, `no def registered for "${key}"`).toBeDefined();
      if (!def) continue;
      const h = def.frames[0].length;
      const w = def.frames[0][0].length;
      expect(w, `"${key}" width should be ${expectedSize}`).toBe(expectedSize);
      expect(h, `"${key}" height should be ${expectedSize}`).toBe(expectedSize);
    }
  });

  it("every icon def is 16x16", () => {
    for (const [key, def] of registry) {
      if (!key.startsWith("icon_")) continue;
      const h = def.frames[0].length;
      const w = def.frames[0][0].length;
      expect(w, `icon "${key}" width should be 16`).toBe(16);
      expect(h, `icon "${key}" height should be 16`).toBe(16);
    }
  });

  it("every non-'.' char in every frame resolves in that def's palette", () => {
    for (const [key, def] of registry) {
      def.frames.forEach((frame, fi) => {
        frame.forEach((row, ri) => {
          for (const ch of row) {
            if (ch === ".") continue;
            expect(
              ch in def.palette,
              `"${key}" frame ${fi} row ${ri} uses char "${ch}" not in palette`
            ).toBe(true);
          }
        });
      });
    }
  });

  it("every anim references valid frame indices", () => {
    for (const [key, def] of registry) {
      for (const [animName, anim] of Object.entries(def.anims)) {
        for (const idx of anim.frames) {
          expect(
            idx >= 0 && idx < def.frames.length,
            `"${key}" anim "${animName}" references out-of-range frame index ${idx}`
          ).toBe(true);
        }
      }
    }
  });

  it("has an icon registered for every weapon id", () => {
    for (const id of WEAPON_IDS) {
      expect(registry.has(iconKey(id)), `missing icon for weapon "${id}" (${iconKey(id)})`).toBe(true);
    }
  });

  it("has an icon registered for every passive id", () => {
    for (const id of PASSIVE_IDS) {
      expect(registry.has(iconKey(id)), `missing icon for passive "${id}" (${iconKey(id)})`).toBe(true);
    }
  });
});
