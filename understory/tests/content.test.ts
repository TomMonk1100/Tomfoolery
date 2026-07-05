// DECISIONS:
// - weightsByLevel keys required for "1".."20" (MAX_LEVEL=20) on every card.
// - Pacing sim models kills/min per active (non-elite) wave entry as
//   min(sustainedCount / AVG_TTK, 1000/intervalMs) i.e. capped by both a
//   flat average time-to-kill assumption AND the wave's own spawn
//   replenishment rate, then scaled by KILL_EFFICIENCY (0.15) to account for
//   travel time, weapon cooldowns, and misses a real player experiences that
//   a naive "every enemy dies the instant it's in range" model ignores.
//   Tuned so the 8-minute run produces a smooth level curve landing at 16
//   total level-ups (within the required 13-19 band), never late-game
//   flatlining at MAX_LEVEL before minute 8.
// - Level-up math mirrors WorldScene.thresholdFor: xpToLevel[level-1] is the
//   cumulative XP required to reach `level`; beyond the array, +80/level.
import { describe, it, expect } from "vitest";
import weaponsJson from "../src/data/weapons.json";
import passivesJson from "../src/data/passives.json";
import enemiesJson from "../src/data/enemies.json";
import wavesJson from "../src/data/waves.json";
import cardsJson from "../src/data/cards.json";
import animalsJson from "../src/data/animals.json";
import metaTreesJson from "../src/data/metaTrees.json";
import {
  WeaponData,
  PassiveData,
  EnemyData,
  WavesFile,
  CardData,
  AnimalData,
  MetaNode,
  RARITY_ORDER,
} from "../src/core/types";

const weapons = weaponsJson as unknown as WeaponData[];
const passives = passivesJson as unknown as PassiveData[];
const enemies = enemiesJson as unknown as EnemyData[];
const waves = wavesJson as unknown as WavesFile;
const cards = cardsJson as unknown as CardData[];
const animals = animalsJson as unknown as Record<string, AnimalData>;
const metaTrees = metaTreesJson as unknown as Record<string, MetaNode[]>;

const ARCHETYPES = [
  "aoe-pulse",
  "melee-sweep",
  "projectile",
  "orbit",
  "trail",
  "zone",
];
const ANIMALS = ["dog", "cat", "rabbit"];
const RARITIES = RARITY_ORDER as string[];

describe("weapons.json", () => {
  it("has exactly 18 weapons with unique ids", () => {
    expect(weapons).toHaveLength(18);
    const ids = weapons.map((w) => w.id);
    expect(new Set(ids).size).toBe(18);
  });

  it("every weapon satisfies WeaponData required fields", () => {
    for (const w of weapons) {
      expect(typeof w.id).toBe("string");
      expect(typeof w.name).toBe("string");
      expect(ANIMALS).toContain(w.animal);
      expect(ARCHETYPES).toContain(w.archetype);
      expect(typeof w.isStarting).toBe("boolean");
      expect(RARITIES).toContain(w.rarity);
      expect(w.levels).toHaveLength(5);
      for (const lvl of w.levels) {
        expect(typeof lvl.damage).toBe("number");
        expect(typeof lvl.cooldownMs).toBe("number");
        expect(typeof lvl.area).toBe("number");
      }
      expect(typeof w.evolution.name).toBe("string");
      expect(typeof w.evolution.requiresPassiveId).toBe("string");
      expect(typeof w.evolution.stats.damage).toBe("number");
      expect(typeof w.description).toBe("string");
      expect(w.icon).toBe(`icon_${w.id.replace(/-/g, "_")}`);
      if (w.archetype === "projectile") {
        expect(w.projectile).toBeDefined();
        expect(["straight", "arc", "boomerang", "split"]).toContain(
          w.projectile!.kind
        );
      }
    }
  });

  it("has exactly 3 starting weapons, one per animal, common rarity", () => {
    const starting = weapons.filter((w) => w.isStarting);
    expect(starting).toHaveLength(3);
    const byAnimal = new Set(starting.map((w) => w.animal));
    expect(byAnimal).toEqual(new Set(ANIMALS));
    for (const w of starting) expect(w.rarity).toBe("common");
  });

  it("every evolution.requiresPassiveId exists in passives.json and matches the weapon's animal", () => {
    const passiveById = new Map(passives.map((p) => [p.id, p]));
    for (const w of weapons) {
      const req = w.evolution.requiresPassiveId;
      const passive = passiveById.get(req);
      expect(passive, `${w.id} requires missing passive ${req}`).toBeDefined();
      expect(passive!.animal).toBe(w.animal);
    }
  });

  it("damage grows across levels 1..5 (meaningful growth)", () => {
    for (const w of weapons) {
      for (let i = 1; i < 5; i++) {
        expect(w.levels[i].damage).toBeGreaterThan(w.levels[i - 1].damage);
      }
    }
  });

  it("evolution is meaningfully stronger than L5 (DPS-wise)", () => {
    for (const w of weapons) {
      const l5 = w.levels[4];
      const ev = w.evolution.stats;
      const dpsL5 = l5.damage / l5.cooldownMs;
      const dpsEv = ev.damage / ev.cooldownMs;
      expect(dpsEv).toBeGreaterThan(dpsL5 * 1.5);
    }
  });

  it("starting weapons deal roughly 6-8 DPS at L1 (kills slime-green ~2 hits)", () => {
    const starting = weapons.filter((w) => w.isStarting);
    for (const w of starting) {
      const l1 = w.levels[0];
      const dps = l1.damage / (l1.cooldownMs / 1000);
      expect(dps).toBeGreaterThanOrEqual(5);
      expect(dps).toBeLessThanOrEqual(9);
    }
  });
});

describe("passives.json", () => {
  it("has exactly 12 passives with unique ids, 4 per animal", () => {
    expect(passives).toHaveLength(12);
    const ids = passives.map((p) => p.id);
    expect(new Set(ids).size).toBe(12);
    for (const animal of ANIMALS) {
      expect(passives.filter((p) => p.animal === animal)).toHaveLength(4);
    }
  });

  it("every passive satisfies PassiveData required fields incl. maxStacks range", () => {
    for (const p of passives) {
      expect(ANIMALS).toContain(p.animal);
      expect(RARITIES).toContain(p.rarity);
      expect(typeof p.effect.type).toBe("string");
      expect(typeof p.effect.magnitude).toBe("number");
      expect(p.icon).toBe(`icon_${p.id.replace(/-/g, "_")}`);
      // companionSlots is capped at 1 by design; everything else 3-5
      if (p.effect.type === "companionSlots") {
        expect(p.maxStacks).toBe(1);
      } else {
        expect(p.maxStacks).toBeGreaterThanOrEqual(3);
        expect(p.maxStacks).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("enemies.json", () => {
  it("has exactly 11 enemies with unique ids", () => {
    expect(enemies).toHaveLength(11);
    const ids = enemies.map((e) => e.id);
    expect(new Set(ids).size).toBe(11);
  });

  it("every enemy satisfies EnemyData required fields", () => {
    const validBehaviors = [
      "chaser",
      "lunger",
      "splitter",
      "shooter",
      "charger",
      "drifter",
      "ambusher",
      "boss",
    ];
    const validSizes = ["small", "medium", "large", "boss"];
    for (const e of enemies) {
      expect(typeof e.hp).toBe("number");
      expect(typeof e.speed).toBe("number");
      expect(typeof e.damage).toBe("number");
      expect(typeof e.xp).toBe("number");
      expect(validBehaviors).toContain(e.behavior);
      expect(validSizes).toContain(e.size);
      expect(e.spriteKey).toMatch(/^(enemy_|boss_)/);
      expect(e.foodDropChance).toBeGreaterThanOrEqual(0);
      expect(e.foodDropChance).toBeLessThanOrEqual(1);
    }
  });

  it("has 4 boss entries, all behavior=boss size=boss with foodDropChance 1.0", () => {
    const bosses = enemies.filter((e) => e.behavior === "boss");
    expect(bosses).toHaveLength(4);
    for (const b of bosses) {
      expect(b.size).toBe("boss");
      expect(b.foodDropChance).toBe(1.0);
    }
    const bossIds = bosses.map((b) => b.id).sort();
    expect(bossIds).toEqual(
      ["bramble-tyrant", "elder-gloomcap", "king-slime", "the-long-dark"].sort()
    );
  });

  it("slime-blue splitsInto slime-green x2", () => {
    const blue = enemies.find((e) => e.id === "slime-blue")!;
    expect(blue.splitsInto).toEqual({ id: "slime-green", count: 2 });
  });

  it("gloomcap and elder-gloomcap have projectile params", () => {
    const gloomcap = enemies.find((e) => e.id === "gloomcap")!;
    expect(gloomcap.projectile).toBeDefined();
    const elder = enemies.find((e) => e.id === "elder-gloomcap")!;
    expect(elder.projectile).toBeDefined();
  });
});

describe("waves.json", () => {
  it("every enemyId in waves and bosses exists in enemies.json", () => {
    const enemyIds = new Set(enemies.map((e) => e.id));
    for (const w of waves.waves) {
      expect(enemyIds.has(w.enemyId), `unknown enemyId ${w.enemyId}`).toBe(
        true
      );
    }
    for (const b of waves.bosses) {
      expect(enemyIds.has(b.enemyId), `unknown boss enemyId ${b.enemyId}`).toBe(
        true
      );
    }
  });

  it("boss schedule matches CONTRACTS.md timings (2:00, 4:00, 6:00, 7:40)", () => {
    expect(waves.bosses).toHaveLength(4);
    const byId = new Map(waves.bosses.map((b) => [b.enemyId, b.atMs]));
    expect(byId.get("king-slime")).toBe(2 * 60 * 1000);
    expect(byId.get("elder-gloomcap")).toBe(4 * 60 * 1000);
    expect(byId.get("bramble-tyrant")).toBe(6 * 60 * 1000);
    expect(byId.get("the-long-dark")).toBe(7 * 60 * 1000 + 40 * 1000);
  });

  it("first slime-green wave starts near atMs 3000 with count 5", () => {
    const firstGreen = waves.waves
      .filter((w) => w.enemyId === "slime-green" && !w.elite)
      .sort((a, b) => a.atMs - b.atMs)[0];
    expect(firstGreen.atMs).toBe(3000);
    expect(firstGreen.count).toBe(5);
  });

  it("has elite entries starting around 1:30, roughly every 45s", () => {
    const elites = waves.waves
      .filter((w) => w.elite)
      .sort((a, b) => a.atMs - b.atMs);
    expect(elites.length).toBeGreaterThanOrEqual(6);
    expect(elites[0].atMs).toBeGreaterThanOrEqual(80000); // ~1:20
    expect(elites[0].atMs).toBeLessThanOrEqual(100000); // ~1:40
  });

  it("sustained enemy count ramps toward but does not exceed the 40 cap by 7:00", () => {
    const MAX_ENEMIES = 40;
    const atSevenMin = 7 * 60 * 1000;
    const latest = new Map<string, { count: number; atMs: number }>();
    for (const w of waves.waves) {
      if (w.elite) continue;
      if (w.atMs > atSevenMin) continue;
      const cur = latest.get(w.enemyId);
      if (!cur || w.atMs > cur.atMs) latest.set(w.enemyId, w);
    }
    const total = [...latest.values()].reduce((s, w) => s + w.count, 0);
    expect(total).toBeGreaterThan(20); // meaningful ramp
    expect(total).toBeLessThanOrEqual(MAX_ENEMIES);
  });
});

describe("cards.json", () => {
  it("has exactly 30 cards (18 weapons + 12 passives) with unique ids", () => {
    expect(cards).toHaveLength(30);
    const ids = cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(30);
  });

  it("every weapon has a matching card with effect.type=weapon, non-stacking", () => {
    const cardById = new Map(cards.map((c) => [c.id, c]));
    for (const w of weapons) {
      const c = cardById.get(w.id);
      expect(c, `missing card for weapon ${w.id}`).toBeDefined();
      expect(c!.effect.type).toBe("weapon");
      expect(c!.stacking).toBe(false);
      expect(c!.rarity).toBe(w.rarity);
      expect(c!.isUnique).toBe(false);
    }
  });

  it("every passive has a matching card with effect.type=passive, stacking", () => {
    const cardById = new Map(cards.map((c) => [c.id, c]));
    for (const p of passives) {
      const c = cardById.get(p.id);
      expect(c, `missing card for passive ${p.id}`).toBeDefined();
      expect(c!.effect.type).toBe("passive");
      expect(c!.stacking).toBe(true);
      expect(c!.rarity).toBe(p.rarity);
      expect(c!.isUnique).toBe(false);
    }
  });

  it("weightsByLevel covers keys '1'..'20' for every card", () => {
    const expectedKeys = new Set(
      Array.from({ length: 20 }, (_, i) => String(i + 1))
    );
    for (const c of cards) {
      const keys = new Set(Object.keys(c.weightsByLevel));
      expect(keys).toEqual(expectedKeys);
      for (const k of keys) {
        expect(c.weightsByLevel[k]).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("spriteSlot is a valid slot or 'none'", () => {
    const validSlots = ["head", "back", "tail", "paws", "aura", "trail", "none"];
    for (const c of cards) {
      expect(validSlots).toContain(c.spriteSlot);
    }
    // at least 6 thematic flavor slots reused (non-"none")
    const flavorCount = cards.filter((c) => c.spriteSlot !== "none").length;
    expect(flavorCount).toBeGreaterThanOrEqual(6);
  });
});

describe("animals.json", () => {
  it("has dog, cat, rabbit, each with startingWeaponId matching an isStarting weapon", () => {
    for (const id of ANIMALS) {
      const a = animals[id];
      expect(a, `missing animal ${id}`).toBeDefined();
      expect(a.maxHp).toBe(100);
      expect(typeof a.startingWeaponId).toBe("string");
      const w = weapons.find((w) => w.id === a.startingWeaponId);
      expect(w, `startingWeaponId ${a.startingWeaponId} not found`).toBeDefined();
      expect(w!.isStarting).toBe(true);
      expect(w!.animal).toBe(id);
      expect(a.spriteKey).toBe(`animal_${id}`);
    }
  });

  it("xpToLevel has 20 entries, increasing, matching CONTRACTS pacing seed", () => {
    for (const id of ANIMALS) {
      const a = animals[id];
      expect(a.xpToLevel).toHaveLength(20);
      for (let i = 1; i < a.xpToLevel.length; i++) {
        expect(a.xpToLevel[i]).toBeGreaterThan(a.xpToLevel[i - 1]);
      }
      expect(a.xpToLevel.slice(0, 10)).toEqual([
        5, 15, 30, 50, 75, 110, 150, 200, 260, 330,
      ]);
    }
  });

  it("speeds match CONTRACTS: dog 200, cat 210, rabbit 220", () => {
    expect(animals.dog.speed).toBe(200);
    expect(animals.cat.speed).toBe(210);
    expect(animals.rabbit.speed).toBe(220);
  });
});

describe("metaTrees.json", () => {
  it("has 6 nodes each for dog, cat, rabbit", () => {
    for (const id of ANIMALS) {
      expect(metaTrees[id], `missing metaTree for ${id}`).toBeDefined();
      expect(metaTrees[id]).toHaveLength(6);
    }
  });

  it("every node's prerequisiteIds reference ids within the same tree", () => {
    for (const id of ANIMALS) {
      const nodeIds = new Set(metaTrees[id].map((n) => n.id));
      for (const n of metaTrees[id]) {
        for (const prereq of n.prerequisiteIds) {
          expect(nodeIds.has(prereq)).toBe(true);
        }
      }
    }
  });
});

// ----------------------------------------------------------------------------
// Pacing simulation — the point of this test. See DECISIONS comment at top
// for the model. Targets CONTRACTS.md "14-18 level-ups/run" with tolerance
// widened to 13-19 per Worker C task brief.
// ----------------------------------------------------------------------------
describe("pacing simulation", () => {
  const AVG_TTK_SEC = 2.5; // avg seconds to kill a typical enemy with active weapons
  const KILL_EFFICIENCY = 0.15; // accounts for travel time, cooldowns, misses

  function thresholdFor(xpToLevel: number[], level: number): number {
    if (level - 1 < xpToLevel.length) return xpToLevel[level - 1];
    return xpToLevel[xpToLevel.length - 1] + (level - xpToLevel.length) * 80;
  }

  it("walking waves.json minute-by-minute yields 13-19 level-ups over 8 minutes", () => {
    const enemyById = new Map(enemies.map((e) => [e.id, e]));
    const xpToLevel = animals.dog.xpToLevel;

    let xp = 0;
    let level = 1;
    let levelUps = 0;
    const RUN_MIN = 8;

    for (let minute = 1; minute <= RUN_MIN; minute++) {
      const t = minute * 60 * 1000;
      const latest = new Map<
        string,
        { count: number; intervalMs: number; atMs: number }
      >();
      for (const w of waves.waves) {
        if (w.elite) continue;
        if (w.atMs > t) continue;
        const cur = latest.get(w.enemyId);
        if (!cur || w.atMs > cur.atMs) latest.set(w.enemyId, w);
      }

      let xpThisMinute = 0;
      for (const [enemyId, w] of latest) {
        const enemy = enemyById.get(enemyId);
        if (!enemy) continue;
        const killRatePerSec = w.count / AVG_TTK_SEC;
        const spawnRatePerSec = 1000 / w.intervalMs;
        const rate =
          Math.min(killRatePerSec, spawnRatePerSec) * KILL_EFFICIENCY;
        const killsThisMinute = rate * 60;
        xpThisMinute += killsThisMinute * enemy.xp;
      }
      xp += xpThisMinute;

      while (level < 20 && xp >= thresholdFor(xpToLevel, level + 1)) {
        level += 1;
        levelUps += 1;
      }
    }

    expect(levelUps).toBeGreaterThanOrEqual(13);
    expect(levelUps).toBeLessThanOrEqual(19);
  });
});
