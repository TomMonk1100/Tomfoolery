/**
 * Update 3 — SynergySystem: recomputes active tag synergies whenever the
 * player's kit changes and exposes their summed stat bonuses. WorldScene
 * merges `bonusFor()` into ctx.statBonus at the same seam where passives
 * merge, so weapons/movement/motes pick the bonuses up with zero changes.
 *
 * Emits EV.synergyChanged (payload: ActiveSynergy[]) only when the active
 * set actually changes — codex discovery + HUD chips hook this in Phase 2.
 */
import Phaser from "phaser";
import { GameContext, System } from "../core/context";
import { EV } from "../core/types";
import {
  ActiveSynergy,
  computeActiveSynergies,
  synergyStatBonus,
} from "./synergySim";

export class SynergySystem implements System {
  private ctx: GameContext;
  private active: ActiveSynergy[] = [];

  constructor(_scene: Phaser.Scene, ctx: GameContext) {
    this.ctx = ctx;
    this.ctx.events.on(EV.cardChosen, this.recompute, this);
    this.ctx.events.on(EV.weaponUpgraded, this.recompute, this);
    this.ctx.events.on(EV.weaponFused, this.recompute, this);
    this.recompute();
  }

  update(_deltaMs: number): void {
    // Event-driven; no per-frame work.
  }

  destroy(): void {
    this.ctx.events.off(EV.cardChosen, this.recompute, this);
    this.ctx.events.off(EV.weaponUpgraded, this.recompute, this);
    this.ctx.events.off(EV.weaponFused, this.recompute, this);
  }

  /** Currently active synergies (highest satisfied tier per tag). */
  activeSynergies(): ActiveSynergy[] {
    return this.active;
  }

  /** Summed percent bonus for a stat type across active synergies. */
  bonusFor(statType: string): number {
    return synergyStatBonus(this.active, statType);
  }

  recompute(): void {
    const p = this.ctx.player;
    const next = computeActiveSynergies(
      p.activeWeapons,
      p.activePassives,
      this.ctx.weapons,
      this.ctx.passives,
      this.ctx.synergyDefs
    );
    const changed =
      JSON.stringify(next.map((s) => [s.synergyId, s.tier])) !==
      JSON.stringify(this.active.map((s) => [s.synergyId, s.tier]));
    this.active = next;
    if (changed) this.ctx.events.emit(EV.synergyChanged, next);
  }
}
