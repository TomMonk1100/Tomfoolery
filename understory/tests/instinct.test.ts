import { describe, it, expect } from "vitest";
import {
  decideGoal,
  kiteVector,
  clusterCentroid,
  farmApproachOrStrafe,
  directionTo,
  dist,
  pickNearest,
  hasBoss,
  BrainState,
  SURVIVE_HP_PCT,
  FARM_STANDOFF_PX,
  BOSS_STANDOFF_PX,
  EAT_HUNGER_THRESHOLD,
  NEST_ORBIT_RADIUS_PX,
} from "../src/systems/instinctBrain";

function baseState(overrides: Partial<BrainState> = {}): BrainState {
  return {
    playerPos: { x: 0, y: 0 },
    hpPct: 1,
    hunger: 100,
    enemies: [],
    nestPos: null,
    raidActive: false,
    trackedFood: [],
    forageNodes: [],
    fogEdge: null,
    wanderTarget: null,
    prevFarmGoal: null,
    ...overrides,
  };
}

describe("dist / directionTo / pickNearest — NaN safety", () => {
  it("dist is 0 for identical points", () => {
    expect(dist({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  it("directionTo returns {0,0} for coincident points (never NaN)", () => {
    const d = directionTo({ x: 3, y: 3 }, { x: 3, y: 3 });
    expect(d.x).toBe(0);
    expect(d.y).toBe(0);
    expect(Number.isNaN(d.x)).toBe(false);
    expect(Number.isNaN(d.y)).toBe(false);
  });

  it("pickNearest returns null for an empty list", () => {
    expect(pickNearest({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe("kiteVector", () => {
  it("returns {0,0} for an empty enemy list (no NaN)", () => {
    const v = kiteVector({ x: 0, y: 0 }, [], 150);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it("points away from a single nearby enemy", () => {
    const v = kiteVector({ x: 0, y: 0 }, [{ x: 100, y: 0 }], 150);
    expect(v.x).toBeLessThan(0);
    expect(Math.abs(v.y)).toBeLessThan(0.01);
  });

  it("ignores enemies outside range", () => {
    const v = kiteVector({ x: 0, y: 0 }, [{ x: 1000, y: 0 }], 150);
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it("weights closer enemies more heavily (resultant biased toward fleeing the closer one)", () => {
    // One enemy close on the +x side, one far on the -x side within range.
    const v = kiteVector(
      { x: 0, y: 0 },
      [
        { x: 20, y: 0 }, // close, pushes strongly toward -x
        { x: -140, y: 0 }, // far, pushes toward +x but weaker
      ],
      150
    );
    // Net direction should still point away from the close one (negative x).
    expect(v.x).toBeLessThan(0);
  });

  it("never returns NaN when an enemy is exactly at the player's position", () => {
    const v = kiteVector({ x: 10, y: 10 }, [{ x: 10, y: 10 }], 150);
    expect(Number.isNaN(v.x)).toBe(false);
    expect(Number.isNaN(v.y)).toBe(false);
  });
});

describe("clusterCentroid", () => {
  it("returns null for an empty list", () => {
    expect(clusterCentroid([])).toBeNull();
  });

  it("returns the single enemy position for a list of one", () => {
    const c = clusterCentroid([{ x: 5, y: 7 }]);
    expect(c).toEqual({ x: 5, y: 7 });
  });

  it("finds the densest cluster centroid, ignoring a distant outlier", () => {
    const enemies = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
      { x: 2000, y: 2000 }, // far outlier, should not pull the centroid
    ];
    const c = clusterCentroid(enemies, 140);
    expect(c).not.toBeNull();
    expect(c!.x).toBeLessThan(50);
    expect(c!.y).toBeLessThan(50);
  });
});

describe("hasBoss", () => {
  it("false for empty/no-boss lists", () => {
    expect(hasBoss([])).toBe(false);
    expect(hasBoss([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it("true when any enemy isBoss", () => {
    expect(hasBoss([{ x: 0, y: 0, isBoss: true }])).toBe(true);
  });
});

describe("farmApproachOrStrafe standoff ring", () => {
  it("approaches when outside the standoff band", () => {
    const r = farmApproachOrStrafe(
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      FARM_STANDOFF_PX,
      null
    );
    expect(r.goal).toBe("farmApproach");
  });

  it("strafes when inside the standoff band", () => {
    const r = farmApproachOrStrafe(
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      FARM_STANDOFF_PX,
      null
    );
    expect(r.goal).toBe("farmStrafe");
  });

  it("flips from approach to strafe once within ~130px (110-150 band)", () => {
    // Well outside -> approach.
    const far = farmApproachOrStrafe(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      FARM_STANDOFF_PX,
      "farmApproach"
    );
    expect(far.goal).toBe("farmApproach");

    // Comfortably inside 130 -> strafe.
    const near = farmApproachOrStrafe(
      { x: 0, y: 0 },
      { x: 90, y: 0 },
      FARM_STANDOFF_PX,
      "farmApproach"
    );
    expect(near.goal).toBe("farmStrafe");
  });

  it("uses a 160px standoff for boss engagements", () => {
    // At distance 145: outside the normal 130 standoff (approach) but
    // inside the wider 160 boss standoff (strafe) — the bot engages a
    // boss from farther away than a regular cluster.
    const bossRange = farmApproachOrStrafe(
      { x: 0, y: 0 },
      { x: 145, y: 0 },
      BOSS_STANDOFF_PX,
      null
    );
    expect(bossRange.goal).toBe("farmStrafe");

    const normalRange = farmApproachOrStrafe(
      { x: 0, y: 0 },
      { x: 145, y: 0 },
      FARM_STANDOFF_PX,
      null
    );
    expect(normalRange.goal).toBe("farmApproach");
  });

  it("strafe target position stays finite (no NaN) even at zero distance", () => {
    const r = farmApproachOrStrafe(
      { x: 5, y: 5 },
      { x: 5, y: 5 },
      FARM_STANDOFF_PX,
      "farmStrafe"
    );
    expect(Number.isNaN(r.targetX)).toBe(false);
    expect(Number.isNaN(r.targetY)).toBe(false);
  });
});

describe("decideGoal priority stack", () => {
  it("SURVIVE triggers under 35% hp and points away from threats", () => {
    const state = baseState({
      hpPct: SURVIVE_HP_PCT - 0.01,
      enemies: [{ x: 50, y: 0 }],
      playerPos: { x: 0, y: 0 },
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("survive");
    // Target should be on the opposite side of the enemy (negative x).
    expect(d.targetX).toBeLessThan(0);
  });

  it("does not trigger SURVIVE at exactly the threshold (boundary exclusive)", () => {
    const state = baseState({
      hpPct: SURVIVE_HP_PCT,
      enemies: [{ x: 50, y: 0 }],
    });
    const d = decideGoal(state);
    expect(d.goal).not.toBe("survive");
  });

  it("SURVIVE drifts toward food while still fleeing", () => {
    const state = baseState({
      hpPct: 0.1,
      enemies: [{ x: 100, y: 0 }],
      trackedFood: [{ x: -50, y: 0 }],
      playerPos: { x: 0, y: 0 },
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("survive");
    expect(d.targetX).toBeLessThan(0); // still fleeing away from enemy at +x
  });

  it("NEST DEFENSE overrides FARM while a raid is active", () => {
    const state = baseState({
      hpPct: 1,
      raidActive: true,
      nestPos: { x: 500, y: 500 },
      playerPos: { x: 0, y: 0 },
      enemies: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 30, y: 30 },
      ],
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("nestDefense");
  });

  it("NEST DEFENSE orbits once within 120px of the nest", () => {
    const state = baseState({
      raidActive: true,
      nestPos: { x: 50, y: 0 },
      playerPos: { x: 0, y: 0 }, // distance 50 < 120
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("nestDefense");
    // Orbit target should not be the nest position itself.
    expect(d.targetX === 50 && d.targetY === 0).toBe(false);
  });

  it("EAT triggers on low hunger with nearby tracked food", () => {
    const state = baseState({
      hunger: EAT_HUNGER_THRESHOLD - 1,
      trackedFood: [{ x: 100, y: 0 }],
      playerPos: { x: 0, y: 0 },
      enemies: [],
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("eat");
    expect(d.targetX).toBe(100);
  });

  it("EAT does not trigger if hunger is fine even with food nearby", () => {
    const state = baseState({
      hunger: 90,
      trackedFood: [{ x: 100, y: 0 }],
      playerPos: { x: 0, y: 0 },
    });
    const d = decideGoal(state);
    expect(d.goal).not.toBe("eat");
  });

  it("EAT does not trigger if food is beyond seek range", () => {
    const state = baseState({
      hunger: 5,
      trackedFood: [{ x: 5000, y: 0 }],
      playerPos: { x: 0, y: 0 },
    });
    const d = decideGoal(state);
    expect(d.goal).not.toBe("eat");
  });

  it("FARM keeps a 110-150px standoff and flips inside 130px", () => {
    const clustered = [
      { x: 200, y: 0 },
      { x: 210, y: 0 },
      { x: 190, y: 10 },
    ];
    const far = decideGoal(
      baseState({ playerPos: { x: 0, y: 0 }, enemies: clustered })
    );
    expect(far.goal).toBe("farmApproach");

    const closeClustered = [
      { x: 60, y: 0 },
      { x: 70, y: 0 },
      { x: 50, y: 10 },
    ];
    const near = decideGoal(
      baseState({ playerPos: { x: 0, y: 0 }, enemies: closeClustered })
    );
    expect(near.goal).toBe("farmStrafe");
  });

  it("boss standoff extends engagement range to 160px", () => {
    const bossCluster = [
      { x: 145, y: 0, isBoss: true },
      { x: 150, y: 5 },
      { x: 140, y: -5 },
    ];
    const d = decideGoal(
      baseState({ playerPos: { x: 0, y: 0 }, enemies: bossCluster })
    );
    // Centroid ~145px away: outside the normal 130 standoff (would be
    // "approach" for a non-boss cluster) but inside the wider 160 boss
    // standoff, so the bot is already close enough to strafe/engage.
    expect(d.goal).toBe("farmStrafe");
  });

  it("falls back to forage when enemy count is small (<=2)", () => {
    const state = baseState({
      enemies: [{ x: 10, y: 10 }],
      forageNodes: [{ x: 300, y: 300 }],
      playerPos: { x: 0, y: 0 },
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("forage");
    expect(d.targetX).toBe(300);
  });

  it("falls back to wander at fog edge when nothing else is available", () => {
    const state = baseState({
      enemies: [],
      forageNodes: [],
      fogEdge: { x: 77, y: 88 },
      playerPos: { x: 0, y: 0 },
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("wander");
    expect(d.targetX).toBe(77);
    expect(d.targetY).toBe(88);
  });

  it("returns a clean wander/self target with no NaN for a totally empty world", () => {
    const state = baseState({
      enemies: [],
      forageNodes: [],
      fogEdge: null,
      wanderTarget: null,
      playerPos: { x: 42, y: 24 },
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("wander");
    expect(Number.isNaN(d.targetX)).toBe(false);
    expect(Number.isNaN(d.targetY)).toBe(false);
  });

  it("reuses an existing wanderTarget when nothing else is available", () => {
    const state = baseState({
      enemies: [],
      forageNodes: [],
      fogEdge: null,
      wanderTarget: { x: 9, y: 9 },
    });
    const d = decideGoal(state);
    expect(d.goal).toBe("wander");
    expect(d.targetX).toBe(9);
    expect(d.targetY).toBe(9);
  });
});
