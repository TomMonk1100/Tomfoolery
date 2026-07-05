import { describe, it, expect } from "vitest";
import {
  drainHunger,
  isWellFed,
  applyEat,
  isStarving,
  addCarriedFood,
  bankCarriedFood,
  wipeBank,
  buildRaidSchedules,
  raidPhaseAt,
  raidDamageTick,
  applyNestDamage,
  applyNestHeal,
  tickRecruitTimer,
  isRecruitComplete,
  pickNearest,
  dist,
} from "../src/systems/nestHungerSim";
import {
  HUNGER_DRAIN_PER_SEC,
  WELL_FED_THRESHOLD,
  CARRY_CAP,
} from "../src/core/types";

describe("hunger drain", () => {
  it("drains at the configured rate per second", () => {
    const after1s = drainHunger(80, HUNGER_DRAIN_PER_SEC, 1);
    expect(after1s).toBeCloseTo(80 - HUNGER_DRAIN_PER_SEC, 5);
  });

  it("clamps at 0 and never goes negative", () => {
    const after = drainHunger(1, HUNGER_DRAIN_PER_SEC, 100);
    expect(after).toBe(0);
  });

  it("clamps at 100 (drain never increases hunger)", () => {
    const after = drainHunger(100, HUNGER_DRAIN_PER_SEC, 0);
    expect(after).toBe(100);
  });
});

describe("eat / heal / well-fed threshold", () => {
  it("heals with the foodHeal% bonus applied", () => {
    const result = applyEat(50, 50, 100, 25, 15, 50, WELL_FED_THRESHOLD);
    // 15 * 1.5 = 22.5
    expect(result.heal).toBeCloseTo(22.5, 5);
    expect(result.hp).toBeCloseTo(72.5, 5);
  });

  it("caps hunger at 100 on eat", () => {
    const result = applyEat(90, 50, 100, 25, 15, 0, WELL_FED_THRESHOLD);
    expect(result.hunger).toBe(100);
  });

  it("caps hp at maxHp on eat", () => {
    const result = applyEat(50, 95, 100, 25, 15, 0, WELL_FED_THRESHOLD);
    expect(result.hp).toBe(100);
  });

  it("crosses the well-fed threshold exactly once (boundary is exclusive)", () => {
    expect(isWellFed(WELL_FED_THRESHOLD, WELL_FED_THRESHOLD)).toBe(false);
    expect(isWellFed(WELL_FED_THRESHOLD + 1, WELL_FED_THRESHOLD)).toBe(true);

    const atThreshold = applyEat(
      WELL_FED_THRESHOLD - 25,
      50,
      100,
      25,
      15,
      0,
      WELL_FED_THRESHOLD
    );
    expect(atThreshold.wellFed).toBe(false);

    const overThreshold = applyEat(
      WELL_FED_THRESHOLD - 24,
      50,
      100,
      25,
      15,
      0,
      WELL_FED_THRESHOLD
    );
    expect(overThreshold.wellFed).toBe(true);
  });
});

describe("starvation", () => {
  it("is only true at exactly 0 hunger", () => {
    expect(isStarving(0)).toBe(true);
    expect(isStarving(0.01)).toBe(false);
    expect(isStarving(1)).toBe(false);
  });
});

describe("carry cap", () => {
  it("never exceeds CARRY_CAP", () => {
    let carried = 0;
    for (let i = 0; i < CARRY_CAP + 10; i++) {
      carried = addCarriedFood(carried, CARRY_CAP);
    }
    expect(carried).toBe(CARRY_CAP);
  });
});

describe("banking", () => {
  it("clears carried and accumulates into bankedFood", () => {
    const result = bankCarriedFood(10, 4);
    expect(result.bankedFood).toBe(14);
    expect(result.carriedFood).toBe(0);
    expect(result.amountBanked).toBe(4);
  });

  it("wipeBank resets to zero", () => {
    expect(wipeBank()).toBe(0);
  });
});

describe("raid schedule", () => {
  it("warns at 70s/310s and goes active at 100s/340s, ending 45s later", () => {
    const schedules = buildRaidSchedules([100_000, 340_000]);
    expect(schedules[0].warnAtMs).toBe(70_000);
    expect(schedules[0].activeAtMs).toBe(100_000);
    expect(schedules[0].endsAtMs).toBe(145_000);

    expect(schedules[1].warnAtMs).toBe(310_000);
    expect(schedules[1].activeAtMs).toBe(340_000);
    expect(schedules[1].endsAtMs).toBe(385_000);
  });

  it("phase transitions idle -> warned -> active -> ended", () => {
    const [schedule] = buildRaidSchedules([100_000]);
    expect(raidPhaseAt(0, schedule)).toBe("idle");
    expect(raidPhaseAt(69_999, schedule)).toBe("idle");
    expect(raidPhaseAt(70_000, schedule)).toBe("warned");
    expect(raidPhaseAt(99_999, schedule)).toBe("warned");
    expect(raidPhaseAt(100_000, schedule)).toBe("active");
    expect(raidPhaseAt(144_999, schedule)).toBe("active");
    expect(raidPhaseAt(145_000, schedule)).toBe("ended");
    expect(raidPhaseAt(999_999, schedule)).toBe("ended");
  });
});

describe("nest damage formula", () => {
  it("scales linearly with enemies near the nest", () => {
    expect(raidDamageTick(0)).toBe(0);
    expect(raidDamageTick(3)).toBe(9);
    expect(raidDamageTick(5, 3)).toBe(15);
  });

  it("clamps hp at 0 and reports destroyed", () => {
    const result = applyNestDamage(5, 20);
    expect(result.hp).toBe(0);
    expect(result.destroyed).toBe(true);
  });

  it("does not report destroyed while hp remains", () => {
    const result = applyNestDamage(100, 20);
    expect(result.hp).toBe(80);
    expect(result.destroyed).toBe(false);
  });

  it("heal clamps at maxHp", () => {
    expect(applyNestHeal(190, 200, 50)).toBe(200);
  });
});

describe("destroyed nest wipes bank", () => {
  it("bank goes to zero once the nest is destroyed", () => {
    // Simulated inline: bank some food, then destroy.
    let banked = bankCarriedFood(0, 5).bankedFood;
    expect(banked).toBe(5);
    banked = wipeBank();
    expect(banked).toBe(0);
  });
});

describe("recruit proximity timer", () => {
  it("advances while within radius", () => {
    let t = tickRecruitTimer(0, true, 500);
    t = tickRecruitTimer(t, true, 500);
    expect(t).toBe(1000);
  });

  it("resets to 0 on leaving the radius", () => {
    let t = tickRecruitTimer(0, true, 800);
    t = tickRecruitTimer(t, false, 500);
    expect(t).toBe(0);
  });

  it("completes once the required duration is reached", () => {
    expect(isRecruitComplete(1199, 1200)).toBe(false);
    expect(isRecruitComplete(1200, 1200)).toBe(true);
  });
});

describe("companion nearest-target selection", () => {
  it("picks the nearest candidate within radius", () => {
    const from = { x: 0, y: 0 };
    const candidates = [
      { id: "a", x: 100, y: 0 },
      { id: "b", x: 10, y: 0 },
      { id: "c", x: 50, y: 0 },
    ];
    const nearest = pickNearest(from, candidates, 120);
    expect(nearest?.id).toBe("b");
  });

  it("returns null when nothing is within radius", () => {
    const from = { x: 0, y: 0 };
    const candidates = [{ id: "a", x: 500, y: 0 }];
    expect(pickNearest(from, candidates, 120)).toBeNull();
  });

  it("returns null for an empty candidate list", () => {
    expect(pickNearest({ x: 0, y: 0 }, [], 120)).toBeNull();
  });

  it("dist matches expected Euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});
