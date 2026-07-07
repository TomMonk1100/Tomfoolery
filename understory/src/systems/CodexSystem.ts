/**
 * Update 3 Phase 2 — CodexSystem: writes discoveries to MetaSave the moment
 * they happen live (evolutions/fusions/synergies), independent of the run
 * ending. Per plan §5.2: "players die; discoveries shouldn't" — every write
 * persists immediately via SaveManager, not batched to run-end.
 *
 * Read-only otherwise: CodexScene reads MetaSave directly (via SaveManager)
 * rather than through this system, so the codex is browsable from the hub
 * without a live GameContext.
 */
import Phaser from "phaser";
import { GameContext, System } from "../core/context";
import { EV } from "../core/types";
import type { SaveManager } from "../core/SaveManager";
import type { ActiveSynergy } from "./synergySim";

export class CodexSystem implements System {
  private ctx: GameContext;
  private saveManager: SaveManager;

  constructor(_scene: Phaser.Scene, ctx: GameContext, saveManager: SaveManager) {
    this.ctx = ctx;
    this.saveManager = saveManager;
    this.ctx.events.on(EV.weaponUpgraded, this.onWeaponUpgraded, this);
    this.ctx.events.on(EV.weaponFused, this.onWeaponFused, this);
    this.ctx.events.on(EV.synergyChanged, this.onSynergyChanged, this);
  }

  update(_deltaMs: number): void {
    // Event-driven; no per-frame work.
  }

  destroy(): void {
    this.ctx.events.off(EV.weaponUpgraded, this.onWeaponUpgraded, this);
    this.ctx.events.off(EV.weaponFused, this.onWeaponFused, this);
    this.ctx.events.off(EV.synergyChanged, this.onSynergyChanged, this);
  }

  private onWeaponUpgraded(payload: { weaponId: string; evolved: boolean }): void {
    if (!payload?.evolved) return;
    // DraftSystem sets ActiveWeapon.evolutionId before emitting this event
    // (both the branch-pick and legacy single-path routes do), so by the
    // time we handle it the branch id is already on the owned weapon.
    const owned = this.ctx.player.activeWeapons.find(
      (w) => w.weaponId === payload.weaponId
    );
    const evolutionId = owned?.evolutionId;
    if (evolutionId) this.saveManager.recordCodexDiscovery("evolutions", evolutionId);
  }

  private onWeaponFused(payload: { fusionId: string }): void {
    if (payload?.fusionId) {
      this.saveManager.recordCodexDiscovery("fusions", payload.fusionId);
    }
  }

  private onSynergyChanged(active: ActiveSynergy[]): void {
    for (const s of active) {
      this.saveManager.recordCodexDiscovery("synergies", s.synergyId);
    }
  }
}
