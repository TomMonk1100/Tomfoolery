// ---------------------------------------------------------------------------
// lander-v10 commit 4a (§6.2): active-ability slot resolver.
//
// A single priority-ordered list of ability ids. One press fires the
// highest-priority READY ability (has charge) — first match wins, no-op if
// none are ready. `abilityDefs` (stats.ts §6.6) carries the owned defs; no
// upgrade populates it yet, so ABILITY_PRIORITY exists purely as scaffolding
// for Commit 4b's Valkyrie Autopilot / Wormhole Pocket / Time Bank /
// Singularity Anchor / Grappling Hook upgrades to hook into.
// ---------------------------------------------------------------------------

import type { AbilityDef, AbilityId } from './types';

// Priority order per plan §6.2 — first ready entry in this order wins.
export const ABILITY_PRIORITY: AbilityId[] = [
  'valkyrie_autopilot',
  'wormhole_pocket',
  'time_bank',
  'singularity_anchor',
  'grappling_hook',
];

export function isAbilityReady(def: AbilityDef): boolean {
  return def.charges > 0;
}

// Resolves which ability (if any) should fire on a single ability-button
// press: walks ABILITY_PRIORITY in order and returns the first owned def
// (matched by id against the `owned` list) that has charge. Returns null if
// no owned ability is ready (or none are owned) — a true no-op, matching the
// plan's "no-op if none are ready" requirement.
export function resolveReadyAbility(owned: AbilityDef[]): AbilityDef | null {
  const byId = new Map(owned.map((d) => [d.id, d] as const));
  for (const id of ABILITY_PRIORITY) {
    const def = byId.get(id);
    if (def && isAbilityReady(def)) return def;
  }
  return null;
}

// Ticks cooldowns for every owned ability def: when `cooldown` reaches 0 and
// charges < maxCharges, regenerates one charge and resets cooldown to
// maxCooldown (a simple regen-over-time model; Commit 4b's per-upgrade
// tables define the actual maxCooldown/maxCharges values per ability).
export function tickAbilityCooldowns(owned: AbilityDef[], dt: number): void {
  for (const def of owned) {
    if (def.charges >= def.maxCharges) { def.cooldown = 0; continue; }
    if (def.cooldown > 0) {
      def.cooldown = Math.max(0, def.cooldown - dt);
      if (def.cooldown === 0) {
        def.charges = Math.min(def.maxCharges, def.charges + 1);
        if (def.charges < def.maxCharges) def.cooldown = def.maxCooldown;
      }
    }
  }
}

// Consumes one charge from a resolved ability (caller has already decided
// which ability's effect to actually apply) and starts its cooldown if it's
// not already regenerating.
export function consumeAbilityCharge(def: AbilityDef): void {
  if (def.charges <= 0) return;
  def.charges -= 1;
  if (def.cooldown <= 0 && def.maxCooldown > 0) def.cooldown = def.maxCooldown;
}
