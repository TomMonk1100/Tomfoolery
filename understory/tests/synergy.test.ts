/**
 * Update 3 Phase 1b — synergy tag math (plan §4b) against the real JSON
 * content plus synthetic fixtures for threshold/tier edges.
 */
import { describe, it, expect } from "vitest";
import weaponsJson from "../src/data/weapons.json";
import passivesJson from "../src/data/passives.json";
import synergiesJson from "../src/data/synergies.json";
import { PassiveData, SynergyData, WeaponData } from "../src/core/types";
import {
  computeActiveSynergies,
  countTags,
  synergyStatBonus,
} from "../src/systems/synergySim";

const weapons = weaponsJson as unknown as WeaponData[];
const passives = passivesJson as unknown as PassiveData[];
const synergyDefs = synergiesJson as unknown as SynergyData[];

const aw = (weaponId: string) => ({ weaponId, level: 1, evolved: false });
const ap = (passiveId: string, stacks = 1) => ({ passiveId, stacks });

describe("synergy content (synergies.json + tags)", () => {
  it("defines all six tags with thresholds at 2 and 3", () => {
    expect(synergyDefs).toHaveLength(6);
    const tags = new Set(synergyDefs.map((s) => s.tag));
    expect(tags).toEqual(new Set(["sonic", "feral", "verdant", "swift", "lucky", "pack"]));
    for (const s of synergyDefs) {
      expect(s.thresholds.map((t) => t.count)).toEqual([2, 3]);
    }
  });

  it("every weapon and passive carries 1-2 tags from the six", () => {
    const valid = new Set(synergyDefs.map((s) => s.tag));
    for (const item of [...weapons, ...passives]) {
      expect(item.tags, item.id).toBeDefined();
      expect(item.tags!.length).toBeGreaterThanOrEqual(1);
      expect(item.tags!.length).toBeLessThanOrEqual(2);
      for (const t of item.tags!) expect(valid.has(t), `${item.id}: ${t}`).toBe(true);
    }
  });

  it("bonus fields use only plumbed statBonus stat types", () => {
    const plumbed = new Set(["damage", "cooldown", "area", "moveSpeed", "pickupRadius"]);
    for (const s of synergyDefs) {
      for (const th of s.thresholds) {
        for (const key of Object.keys(th.bonus)) {
          expect(plumbed.has(key), `${s.id}: ${key}`).toBe(true);
        }
      }
    }
  });
});

describe("computeActiveSynergies", () => {
  it("counts distinct items, not stacks or levels", () => {
    const counts = countTags(
      [aw("bark-blast")],
      [ap("alpha-scent", 5)],
      weapons,
      passives
    );
    expect(counts["sonic"]).toBe(2); // bark-blast + alpha-scent, stacks ignored
  });

  it("below threshold: no active synergy", () => {
    const active = computeActiveSynergies(
      [aw("bark-blast")],
      [],
      weapons,
      passives,
      synergyDefs
    );
    expect(active).toHaveLength(0);
  });

  it("2 sonic items activate tier 1; 3 activate tier 2 (highest wins, not cumulative)", () => {
    const two = computeActiveSynergies(
      [aw("bark-blast"), aw("echo-screech")],
      [],
      weapons,
      passives,
      synergyDefs
    );
    expect(two).toHaveLength(1);
    expect(two[0]).toMatchObject({ tag: "sonic", tier: 1, count: 2 });
    expect(synergyStatBonus(two, "area")).toBe(10);

    const three = computeActiveSynergies(
      [aw("bark-blast"), aw("echo-screech")],
      [ap("alpha-scent")],
      weapons,
      passives,
      synergyDefs
    );
    expect(three[0]).toMatchObject({ tag: "sonic", tier: 2, count: 3 });
    expect(synergyStatBonus(three, "area")).toBe(30); // total, not 10+30
  });

  it("stacks with passive bonuses at the statBonus seam (sums across tags)", () => {
    // pack 2 (+5 dmg) + feral 2 (+8 dmg) both active -> +13 damage total.
    const active = computeActiveSynergies(
      [aw("fetch"), aw("slobber-shot"), aw("pounce-slash"), aw("claw-flurry")],
      [],
      weapons,
      passives,
      synergyDefs
    );
    expect(synergyStatBonus(active, "damage")).toBe(5 + 8);
    expect(synergyStatBonus(active, "area")).toBe(5);
  });

  it("recomputes correctly after a fusion consumes inputs (tags recount)", () => {
    // Before: bee-swarm (pack) + fetch (pack) => pack tier 1.
    const before = computeActiveSynergies(
      [aw("bee-swarm"), aw("fetch")],
      [],
      weapons,
      passives,
      synergyDefs
    );
    expect(before.map((s) => s.tag)).toEqual(["pack"]);
    // After a hypothetical fusion consuming both: single fused weapon with
    // union tags [pack, lucky] -> only 1 item per tag, nothing active.
    const glowhive: WeaponData = {
      ...weapons.find((w) => w.id === "bee-swarm")!,
      id: "glowhive-test",
      tags: ["pack", "lucky"],
    };
    const after = computeActiveSynergies(
      [aw("glowhive-test")],
      [],
      [...weapons, glowhive],
      passives,
      synergyDefs
    );
    expect(after).toHaveLength(0);
  });

  it("negative cooldown bonus means faster (swift tier 2)", () => {
    const active = computeActiveSynergies(
      [aw("zoomies"), aw("midnight-prowl"), aw("yarn-whip")],
      [],
      weapons,
      passives,
      synergyDefs
    );
    expect(active[0]).toMatchObject({ tag: "swift", tier: 2 });
    expect(synergyStatBonus(active, "cooldown")).toBe(-8);
    expect(synergyStatBonus(active, "moveSpeed")).toBe(12);
  });
});
