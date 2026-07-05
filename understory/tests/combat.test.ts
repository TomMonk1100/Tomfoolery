import { describe, it, expect } from "vitest";
import {
  Vec2,
  distance,
  directionTo,
  nearestTarget,
  tickCooldown,
  resetCooldown,
  CooldownState,
  computeDamage,
  computeCooldown,
  computeArea,
  computeCritChance,
  resolveWeaponStats,
  COOLDOWN_FLOOR_PCT,
  chaserSteer,
  makeLungerState,
  lungerSteer,
  LUNGER_PAUSE_MS,
  LUNGER_LUNGE_MS,
  makeChargerState,
  chargerSteer,
  CHARGER_TELEGRAPH_MS,
  CHARGER_OVERSHOOT_PX,
  makeDrifterState,
  drifterSteer,
  makeAmbusherState,
  ambusherSteer,
  AMBUSHER_CYCLE_MS,
  AMBUSHER_TELEGRAPH_MS,
  activeWaveEntries,
  bossShouldSpawn,
  shouldSpawnForEntry,
  spawnRingPoint,
  makeMoteMagnetState,
  moteStep,
  moteMagnetRadius,
  MOTE_MAGNET_START_SPEED,
  MOTE_COLLECT_RADIUS,
  contactTick,
  makeContactTickState,
  isOverlapping,
  makeBossPhaseState,
  bossPhaseCheck,
} from "../src/systems/combat/sim";
import { WELL_FED_DAMAGE_BONUS, WaveEntry } from "../src/core/types";

describe("cooldown ticking", () => {
  it("elapses when remainingMs drops to 0 or below", () => {
    const state: CooldownState = { remainingMs: 100 };
    expect(tickCooldown(state, 50)).toBe(false);
    expect(state.remainingMs).toBe(50);
    expect(tickCooldown(state, 50)).toBe(true);
    expect(state.remainingMs).toBe(0);
  });

  it("resetCooldown adds duration and clamps negative carry to 0", () => {
    const state: CooldownState = { remainingMs: -30 };
    resetCooldown(state, 1000);
    expect(state.remainingMs).toBe(970);

    const state2: CooldownState = { remainingMs: -5000 };
    resetCooldown(state2, 1000);
    expect(state2.remainingMs).toBe(0);
  });

  it("fires repeatedly over many ticks at expected cadence", () => {
    const state: CooldownState = { remainingMs: 0 };
    let fires = 0;
    for (let i = 0; i < 100; i++) {
      if (tickCooldown(state, 100)) {
        fires++;
        resetCooldown(state, 300);
      }
    }
    // 100 ticks * 100ms = 10000ms; period ~300ms => ~33 fires
    expect(fires).toBeGreaterThan(25);
    expect(fires).toBeLessThan(40);
  });
});

describe("damage formula", () => {
  it("base damage with no bonuses, no crit", () => {
    const r = computeDamage({
      baseDamage: 10,
      statBonusDamagePct: 0,
      wellFed: false,
      critRoll: 0.99,
      critChancePct: 0,
    });
    expect(r.amount).toBe(10);
    expect(r.crit).toBe(false);
  });

  it("applies statBonus damage percentage", () => {
    const r = computeDamage({
      baseDamage: 10,
      statBonusDamagePct: 50,
      wellFed: false,
      critRoll: 0.99,
      critChancePct: 0,
    });
    expect(r.amount).toBe(15);
  });

  it("applies Well-Fed multiplier", () => {
    const r = computeDamage({
      baseDamage: 10,
      statBonusDamagePct: 0,
      wellFed: true,
      critRoll: 0.99,
      critChancePct: 0,
    });
    expect(r.amount).toBeCloseTo(10 * (1 + WELL_FED_DAMAGE_BONUS), 6);
  });

  it("stacks statBonus and Well-Fed multiplicatively", () => {
    const r = computeDamage({
      baseDamage: 10,
      statBonusDamagePct: 20,
      wellFed: true,
      critRoll: 0.99,
      critChancePct: 0,
    });
    expect(r.amount).toBeCloseTo(10 * 1.2 * (1 + WELL_FED_DAMAGE_BONUS), 6);
  });

  it("crit doubles damage when roll beats chance", () => {
    const r = computeDamage({
      baseDamage: 10,
      statBonusDamagePct: 0,
      wellFed: false,
      critRoll: 0.1, // 10% < 50% chance -> crit
      critChancePct: 50,
    });
    expect(r.crit).toBe(true);
    expect(r.amount).toBe(20);
  });

  it("no crit when roll exceeds chance", () => {
    const r = computeDamage({
      baseDamage: 10,
      statBonusDamagePct: 0,
      wellFed: false,
      critRoll: 0.9,
      critChancePct: 50,
    });
    expect(r.crit).toBe(false);
    expect(r.amount).toBe(10);
  });

  it("computeCritChance sums base + statBonus", () => {
    expect(computeCritChance(10, 5)).toBe(15);
    expect(computeCritChance(undefined, 5)).toBe(5);
  });
});

describe("cooldown/area scaling", () => {
  it("computeCooldown speeds up with negative statBonus", () => {
    expect(computeCooldown(1000, -20)).toBe(800);
  });

  it("computeCooldown floors at 30% of base", () => {
    expect(computeCooldown(1000, -95)).toBe(1000 * COOLDOWN_FLOOR_PCT);
    expect(computeCooldown(1000, -1000)).toBe(1000 * COOLDOWN_FLOOR_PCT);
  });

  it("computeArea scales and floors at 0", () => {
    expect(computeArea(100, 20)).toBe(120);
    expect(computeArea(100, -200)).toBe(0);
  });

  it("resolveWeaponStats picks level index, clamped, or evolution stats", () => {
    const levels = [
      { damage: 1, cooldownMs: 100, area: 10 },
      { damage: 2, cooldownMs: 100, area: 10 },
      { damage: 3, cooldownMs: 100, area: 10 },
    ];
    const evo = { damage: 99, cooldownMs: 50, area: 999 };
    expect(resolveWeaponStats(levels, evo, 1, false).damage).toBe(1);
    expect(resolveWeaponStats(levels, evo, 2, false).damage).toBe(2);
    expect(resolveWeaponStats(levels, evo, 99, false).damage).toBe(3); // clamped
    expect(resolveWeaponStats(levels, evo, 1, true).damage).toBe(99);
  });
});

describe("target selection", () => {
  it("finds nearest candidate within range", () => {
    const from: Vec2 = { x: 0, y: 0 };
    const candidates = [
      { id: "b", x: 100, y: 0 },
      { id: "a", x: 10, y: 0 },
      { id: "c", x: 5, y: 0 },
    ];
    const best = nearestTarget(from, candidates);
    expect(best?.id).toBe("c");
  });

  it("returns null if nothing in range", () => {
    const from: Vec2 = { x: 0, y: 0 };
    const candidates = [{ id: "a", x: 1000, y: 0 }];
    expect(nearestTarget(from, candidates, 50)).toBeNull();
  });

  it("breaks ties by lowest id", () => {
    const from: Vec2 = { x: 0, y: 0 };
    const candidates = [
      { id: "z", x: 10, y: 0 },
      { id: "a", x: 10, y: 0 },
    ];
    expect(nearestTarget(from, candidates)?.id).toBe("a");
  });
});

describe("enemy steering — chaser", () => {
  it("moves directly toward target at given speed", () => {
    const step = chaserSteer({
      self: { x: 0, y: 0 },
      target: { x: 100, y: 0 },
      speed: 50,
      deltaMs: 1000,
    });
    expect(step.dx).toBeCloseTo(50, 5);
    expect(step.dy).toBeCloseTo(0, 5);
  });

  it("produces no NaN when self==target", () => {
    const step = chaserSteer({
      self: { x: 5, y: 5 },
      target: { x: 5, y: 5 },
      speed: 50,
      deltaMs: 16.6,
    });
    expect(Number.isNaN(step.dx)).toBe(false);
    expect(Number.isNaN(step.dy)).toBe(false);
    expect(step.dx).toBe(0);
    expect(step.dy).toBe(0);
  });
});

describe("enemy steering — lunger cycles pause/lunge", () => {
  it("stays put during pause, then lunges at 3x speed", () => {
    const state = makeLungerState();
    const input = { self: { x: 0, y: 0 }, target: { x: 100, y: 0 }, speed: 10, deltaMs: 100 };

    // Pause phase: no movement for < LUNGER_PAUSE_MS
    let totalPauseDx = 0;
    for (let t = 0; t < LUNGER_PAUSE_MS - 100; t += 100) {
      const step = lungerSteer(state, input);
      totalPauseDx += step.dx;
    }
    expect(totalPauseDx).toBe(0);
    expect(state.phase).toBe("pause");

    // Cross into lunge (the crossing tick itself just transitions state, no
    // movement yet — direction is captured but distance is applied starting
    // next tick).
    const crossingStep = lungerSteer(state, input);
    expect(state.phase).toBe("lunge");

    // Next tick within the lunge phase should now move at 3x speed.
    const lungeStep = lungerSteer(state, input);
    expect(lungeStep.dx).toBeGreaterThan(0);
    const lungeSpeed = Math.sqrt(lungeStep.dx ** 2 + lungeStep.dy ** 2) / (100 / 1000);
    expect(lungeSpeed).toBeCloseTo(30, 0); // 10 * 3
  });

  it("returns to pause after lunge duration elapses", () => {
    const state = makeLungerState();
    const input = { self: { x: 0, y: 0 }, target: { x: 100, y: 0 }, speed: 10, deltaMs: LUNGER_PAUSE_MS };
    lungerSteer(state, input); // crosses to lunge
    expect(state.phase).toBe("lunge");
    lungerSteer(state, { ...input, deltaMs: LUNGER_LUNGE_MS });
    expect(state.phase).toBe("pause");
  });
});

describe("enemy steering — charger telegraph then charge", () => {
  it("does not move during telegraph, then charges at 4x speed", () => {
    const state = makeChargerState();
    const input = { self: { x: 0, y: 0 }, target: { x: 100, y: 0 }, speed: 20, deltaMs: 100 };

    let telegraphMoved = false;
    for (let t = 0; t < CHARGER_TELEGRAPH_MS - 100; t += 100) {
      const step = chargerSteer(state, input);
      if (step.dx !== 0 || step.dy !== 0) telegraphMoved = true;
    }
    expect(telegraphMoved).toBe(false);
    expect(state.phase).toBe("telegraph");

    const crossStep = chargerSteer(state, input);
    expect(state.phase).toBe("charging");

    // Next tick within the charging phase moves at 4x speed (the crossing
    // tick itself only transitions state and captures direction).
    const chargeStep = chargerSteer(state, input);
    const speedMag = Math.sqrt(chargeStep.dx ** 2 + chargeStep.dy ** 2) / (100 / 1000);
    expect(speedMag).toBeCloseTo(80, 0); // 20 * 4
  });

  it("eventually returns to telegraph after overshooting target by ~200px", () => {
    const state = makeChargerState();
    const input = { self: { x: 0, y: 0 }, target: { x: 50, y: 0 }, speed: 100, deltaMs: 50 };
    // Drive through telegraph
    for (let t = 0; t < CHARGER_TELEGRAPH_MS + 50; t += 50) {
      chargerSteer(state, input);
    }
    expect(state.phase).toBe("charging");
    // Drive charge until it flips back
    let flipped = false;
    for (let i = 0; i < 200; i++) {
      chargerSteer(state, input);
      if (state.phase === "telegraph") {
        flipped = true;
        break;
      }
    }
    expect(flipped).toBe(true);
  });
});

describe("enemy steering — drifter sine weave, no NaN", () => {
  it("produces finite output across many ticks", () => {
    const state = makeDrifterState();
    let x = 0,
      y = 0;
    for (let i = 0; i < 300; i++) {
      const step = drifterSteer(state, { self: { x, y }, target: { x: 200, y: 50 }, speed: 40, deltaMs: 16.6 });
      x += step.dx;
      y += step.dy;
      expect(Number.isNaN(x)).toBe(false);
      expect(Number.isNaN(y)).toBe(false);
    }
  });
});

describe("enemy steering — ambusher telegraph cycle", () => {
  it("stays hidden, then telegraphs, then surfaces once per cycle", () => {
    const state = makeAmbusherState();
    const input = { self: { x: 0, y: 0 }, target: { x: 10, y: 10 }, speed: 0, deltaMs: 100 };

    let sawTelegraph = false;
    let sawSurface = false;
    for (let t = 0; t < AMBUSHER_CYCLE_MS + 500; t += 100) {
      const r = ambusherSteer(state, input);
      if (r.phase === "telegraph") sawTelegraph = true;
      if (r.justSurfaced) sawSurface = true;
    }
    expect(sawTelegraph).toBe(true);
    expect(sawSurface).toBe(true);
  });
});

describe("boss phase hooks", () => {
  it("fires once when crossing 66% and once when crossing 33%, not repeatedly", () => {
    const state = makeBossPhaseState();
    expect(bossPhaseCheck(state, "king-slime", 1.0)).toBeNull();
    const first = bossPhaseCheck(state, "king-slime", 0.6);
    expect(first).toEqual({ kind: "spawn-slimes", count: 4 });
    expect(bossPhaseCheck(state, "king-slime", 0.55)).toBeNull(); // already triggered this phase
    const second = bossPhaseCheck(state, "king-slime", 0.3);
    expect(second).toEqual({ kind: "spawn-slimes", count: 4 });
    expect(bossPhaseCheck(state, "king-slime", 0.1)).toBeNull();
  });

  it("dispatches per-boss actions", () => {
    expect(bossPhaseCheck(makeBossPhaseState(), "elder-gloomcap", 0.5)).toEqual({
      kind: "spore-ring",
      count: 8,
    });
    expect(bossPhaseCheck(makeBossPhaseState(), "bramble-tyrant", 0.5)).toEqual({
      kind: "rapid-charges",
      count: 3,
    });
    expect(bossPhaseCheck(makeBossPhaseState(), "the-long-dark", 0.5)).toEqual({
      kind: "spawn-wisps",
      count: 6,
    });
  });
});

describe("contact damage ticking", () => {
  it("ticks immediately on entering overlap, then every CONTACT_TICK_MS", () => {
    const state = makeContactTickState();
    expect(contactTick(state, true, 0)).toBe(true); // immediate
    expect(contactTick(state, true, 400)).toBe(false);
    expect(contactTick(state, true, 100)).toBe(true); // 500ms total
  });

  it("resets when overlap breaks then re-enters", () => {
    const state = makeContactTickState();
    contactTick(state, true, 0);
    expect(contactTick(state, false, 100)).toBe(false);
    expect(contactTick(state, true, 0)).toBe(true); // immediate again
  });

  it("isOverlapping true within combined radii", () => {
    expect(isOverlapping({ x: 0, y: 0 }, 10, { x: 15, y: 0 }, 10)).toBe(true);
    expect(isOverlapping({ x: 0, y: 0 }, 10, { x: 25, y: 0 }, 10)).toBe(false);
  });
});

describe("wave scheduling", () => {
  const waves: WaveEntry[] = [
    { atMs: 0, enemyId: "slime-green", count: 3, intervalMs: 1000 },
    { atMs: 5000, enemyId: "slime-green", count: 10, intervalMs: 500 }, // supersedes above
    { atMs: 2000, enemyId: "gloomcap", count: 2, intervalMs: 2000 },
  ];

  it("resolves supersede: latest atMs<=clock wins per enemyId", () => {
    const early = activeWaveEntries(waves, 1000);
    expect(early.find((w) => w.enemyId === "slime-green")?.count).toBe(3);
    expect(early.find((w) => w.enemyId === "gloomcap")).toBeUndefined();

    const late = activeWaveEntries(waves, 6000);
    expect(late.find((w) => w.enemyId === "slime-green")?.count).toBe(10);
    expect(late.find((w) => w.enemyId === "gloomcap")?.count).toBe(2);
  });

  it("shouldSpawnForEntry respects count cap and interval", () => {
    const entry: WaveEntry = { atMs: 0, enemyId: "x", count: 3, intervalMs: 1000 };
    expect(shouldSpawnForEntry({ entry, currentOnScreenCount: 3, msSinceLastSpawnForEntry: 5000 })).toBe(false);
    expect(shouldSpawnForEntry({ entry, currentOnScreenCount: 1, msSinceLastSpawnForEntry: 500 })).toBe(false);
    expect(shouldSpawnForEntry({ entry, currentOnScreenCount: 1, msSinceLastSpawnForEntry: 1000 })).toBe(true);
  });

  it("bossShouldSpawn is edge-triggered exactly once", () => {
    const boss = { atMs: 5000, enemyId: "king-slime" };
    expect(bossShouldSpawn(boss, 4900, 5100)).toBe(true);
    expect(bossShouldSpawn(boss, 5100, 5200)).toBe(false);
  });

  it("spawnRingPoint stays within world bounds and produces finite coords", () => {
    const bounds = { width: 1280, height: 1280 };
    for (let i = 0; i < 50; i++) {
      const p = spawnRingPoint({ x: 640, y: 640 }, 240, 427, 60, 120, bounds, Math.random);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(bounds.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(bounds.height);
      expect(Number.isNaN(p.x)).toBe(false);
      expect(Number.isNaN(p.y)).toBe(false);
    }
  });
});

describe("XP mote magnet", () => {
  it("stays put outside magnet radius", () => {
    const state = makeMoteMagnetState();
    const r = moteStep(state, { x: 0, y: 0 }, { x: 500, y: 0 }, 70, 16.6);
    expect(r.dx).toBe(0);
    expect(r.dy).toBe(0);
    expect(r.collected).toBe(false);
  });

  it("accelerates toward target once inside radius", () => {
    const state = makeMoteMagnetState();
    const target = { x: 60, y: 0 };
    const self = { x: 0, y: 0 };
    const r1 = moteStep(state, self, target, 70, 16.6);
    const speed1 = Math.sqrt(r1.dx ** 2 + r1.dy ** 2) / (16.6 / 1000);
    expect(speed1).toBeCloseTo(MOTE_MAGNET_START_SPEED, 0);

    const r2 = moteStep(state, { x: self.x + r1.dx, y: self.y + r1.dy }, target, 70, 16.6);
    const speed2 = Math.sqrt(r2.dx ** 2 + r2.dy ** 2) / (16.6 / 1000);
    expect(speed2).toBeGreaterThan(speed1); // accelerating
  });

  it("collects within MOTE_COLLECT_RADIUS", () => {
    const state = makeMoteMagnetState();
    const r = moteStep(state, { x: 0, y: 0 }, { x: MOTE_COLLECT_RADIUS - 1, y: 0 }, 70, 16.6);
    expect(r.collected).toBe(true);
  });

  it("moteMagnetRadius scales with pickupRadius statBonus", () => {
    expect(moteMagnetRadius(70, 50)).toBe(105);
    expect(moteMagnetRadius(70, 0)).toBe(70);
  });

  it("never overshoots the target within one tick", () => {
    const state = makeMoteMagnetState();
    state.speed = 100000; // pathological high speed
    const r = moteStep(state, { x: 0, y: 0 }, { x: 20, y: 0 }, 70, 1000);
    // Should clamp exactly to remaining distance (not collected since >14 away... but 20 > MOTE_COLLECT_RADIUS(14))
    const dist = Math.sqrt(r.dx ** 2 + r.dy ** 2);
    expect(dist).toBeLessThanOrEqual(20 + 1e-6);
  });
});

// ----------------------------------------------------------------------------
// Acceptance sim: headless 60s tick loop (16.6ms steps). Dog with bark-blast
// at level 3 vs continuously-spawned slime-green (hp 12, speed 45).
// Assert >=30 kills, no NaN positions/hp.
// ----------------------------------------------------------------------------
describe("acceptance sim — 60s dog bark-blast vs slime-green swarm", () => {
  it("kills >=30 slimes in 60s with no NaN state", () => {
    const STEP_MS = 16.6;
    const DURATION_MS = 60_000;

    // bark-blast level 3 stats (from src/data/weapons.json levels[2]).
    const weaponStats = { damage: 14, cooldownMs: 1200, area: 90, knockback: 50 };

    const playerPos: Vec2 = { x: 0, y: 0 };
    const cooldown: CooldownState = { remainingMs: 0 };

    interface SimEnemy {
      id: string;
      x: number;
      y: number;
      hp: number;
      alive: boolean;
    }

    let enemies: SimEnemy[] = [];
    let uid = 0;
    let kills = 0;
    let msSinceSpawn = 0;
    const SPAWN_INTERVAL_MS = 400; // continuous spawning
    const SLIME_HP = 12;
    const SLIME_SPEED = 45; // px/s
    const SPAWN_RADIUS = 300;

    let elapsed = 0;
    let rngSeed = 12345;
    const rng = () => {
      // simple deterministic LCG for reproducibility
      rngSeed = (rngSeed * 1103515245 + 12345) & 0x7fffffff;
      return (rngSeed % 10000) / 10000;
    };

    while (elapsed < DURATION_MS) {
      elapsed += STEP_MS;
      msSinceSpawn += STEP_MS;

      // Spawn
      if (msSinceSpawn >= SPAWN_INTERVAL_MS) {
        msSinceSpawn -= SPAWN_INTERVAL_MS;
        const angle = rng() * Math.PI * 2;
        enemies.push({
          id: `s${uid++}`,
          x: playerPos.x + Math.cos(angle) * SPAWN_RADIUS,
          y: playerPos.y + Math.sin(angle) * SPAWN_RADIUS,
          hp: SLIME_HP,
          alive: true,
        });
      }

      // Steer each enemy toward player (chaser behavior)
      for (const e of enemies) {
        if (!e.alive) continue;
        const step = chaserSteer({ self: e, target: playerPos, speed: SLIME_SPEED, deltaMs: STEP_MS });
        e.x += step.dx;
        e.y += step.dy;
        expect(Number.isNaN(e.x)).toBe(false);
        expect(Number.isNaN(e.y)).toBe(false);
        expect(Number.isNaN(e.hp)).toBe(false);
      }

      // Weapon cooldown/fire (aoe-pulse: hits every enemy within area+80 gate,
      // but actual pulse only damages within `area`)
      const elapsedFire = tickCooldown(cooldown, STEP_MS);
      if (elapsedFire) {
        const liveEnemies = enemies.filter((e) => e.alive);
        const canFire = liveEnemies.some(
          (e) => distance(playerPos, e) <= weaponStats.area + 80
        );
        if (canFire) {
          for (const e of liveEnemies) {
            if (distance(playerPos, e) <= weaponStats.area) {
              const { amount } = computeDamage({
                baseDamage: weaponStats.damage,
                statBonusDamagePct: 0,
                wellFed: false,
                critRoll: rng(),
                critChancePct: 0,
              });
              e.hp -= amount;
              expect(Number.isNaN(e.hp)).toBe(false);
              if (e.hp <= 0) {
                e.alive = false;
                kills++;
              }
            }
          }
          resetCooldown(cooldown, weaponStats.cooldownMs);
        }
        // if it can't fire, cooldown stays at/below 0 and we retry next tick
        // (mirrors WeaponSystem's "don't reset if no target" behavior).
      }

      // Prune dead enemies periodically to keep array bounded (pool-like).
      if (enemies.length > 200) {
        enemies = enemies.filter((e) => e.alive);
      }
    }

    expect(kills).toBeGreaterThanOrEqual(30);
  });
});
