/**
 * DraftSystem — builds and resolves the 3-card level-up draft.
 *
 * Listens for EV.levelUp, builds an offer via buildOffer() (pure-ish, unit
 * testable), then launches DraftScene (owned by another agent) and pauses
 * WorldScene until a pick resolves.
 */
import Phaser from "phaser";
import { System, GameContext } from "../core/context";
import {
  CardData,
  FusionData,
  Rarity,
  RARITY_ORDER,
  EV,
  SCENE,
  WEAPON_SLOTS,
  PASSIVE_SLOTS,
} from "../core/types";
import { comboWeightMultiplier, pickRarity } from "../core/rarityWeights";
import { applyCard, logCardValue } from "../core/playerState";

/** Consecutive no-epic+ drafts before pity forces an epic+ slot. */
const PITY_THRESHOLD = 4;

/** XP refund granted when the player skips a draft. */
const SKIP_XP_REFUND = 5;

const EPIC_PLUS: Rarity[] = ["epic", "legendary", "mythic"];

export class DraftSystem implements System {
  private scene: Phaser.Scene;
  private ctx: GameContext;

  /** Consecutive drafts offered with no epic+ card shown. */
  private pityCounter = 0;

  constructor(scene: Phaser.Scene, ctx: GameContext) {
    this.scene = scene;
    this.ctx = ctx;

    this.ctx.events.on(EV.levelUp, this.onLevelUp, this);
  }

  update(_deltaMs: number): void {
    // No per-frame work; drafts are purely event-driven.
  }

  destroy(): void {
    this.ctx.events.off(EV.levelUp, this.onLevelUp, this);
  }

  /**
   * Build a 3-distinct-card offer for the given level. Applies the pity
   * rule and instinct-mode Unique exclusion. Exposed standalone so it can be
   * unit-tested without touching the scene.
   */
  buildOffer(level: number): CardData[] {
    const player = this.ctx.player;
    const pool = this.expandEvolutionBranches(
      this.ctx.cards.filter(
        (c) => (player.instinctMode ? !c.isUnique : true) && this.isDraftable(c)
      )
    );

    const picked: CardData[] = [];
    const pickedIds = new Set<string>();

    const forcePityEpicSlot =
      this.pityCounter >= PITY_THRESHOLD && this.hasAnyEpicPlus(pool);

    for (let slot = 0; slot < 3; slot++) {
      let rarity: Rarity;

      if (slot === 0 && forcePityEpicSlot) {
        rarity = this.pickForcedEpicPlusRarity(level, player.luck, pool, pickedIds);
      } else {
        rarity = pickRarity(level, player.luck, player.instinctMode);
      }

      const card = this.pickCardOfRarity(pool, rarity, level, pickedIds);
      if (card) {
        picked.push(card);
        pickedIds.add(card.id);
      }
    }

    // Backfill if fewer than 3 distinct cards were resolvable (tiny pools).
    if (picked.length < 3) {
      for (const card of pool) {
        if (picked.length >= 3) break;
        if (pickedIds.has(card.id)) continue;
        picked.push(card);
        pickedIds.add(card.id);
      }
    }

    // Update pity counter based on what actually appears in the offer.
    const containsEpicPlus = picked.some((c) => EPIC_PLUS.includes(c.rarity));
    this.pityCounter = containsEpicPlus ? 0 : this.pityCounter + 1;

    // Update 3 (D3): if a fusion recipe is satisfied (both inputs owned at
    // max level, result not owned), PREPEND one guaranteed fusion card.
    const fusion = this.availableFusion();
    if (fusion) picked.unshift(this.makeFusionCard(fusion));

    return picked;
  }

  /** First satisfied fusion recipe, or null. Max one fusion card per offer. */
  private availableFusion(): FusionData | null {
    const p = this.ctx.player;
    for (const f of this.ctx.fusions) {
      if (p.activeWeapons.some((w) => w.weaponId === f.resultWeaponId)) continue;
      const ready = f.inputs.every((id) => {
        const owned = p.activeWeapons.find((w) => w.weaponId === id);
        const data = this.ctx.weapons.find((w) => w.id === id);
        return (
          !!owned && !!data && (owned.evolved || owned.level >= data.levels.length)
        );
      });
      if (ready) return f;
    }
    return null;
  }

  /** Synthesized mythic-styled card, id "fuse::<fusionId>". */
  private makeFusionCard(fusion: FusionData): CardData {
    return {
      id: `fuse::${fusion.id}`,
      name: fusion.name,
      rarity: "mythic",
      isUnique: false,
      weightsByLevel: { "1": 1 },
      effect: { type: "weapon", magnitude: 0 },
      tradeoff: { type: "none", magnitude: 0 },
      spriteSlot: "none",
      stacking: false,
    };
  }

  /** Consume both inputs, grant the fused weapon at level 1 (frees a slot). */
  private applyFusion(fusionId: string): void {
    const p = this.ctx.player;
    const fusion = this.ctx.fusions.find((f) => f.id === fusionId);
    if (!fusion) return;
    if (p.activeWeapons.some((w) => w.weaponId === fusion.resultWeaponId)) return;
    if (!fusion.inputs.every((id) => p.activeWeapons.some((w) => w.weaponId === id)))
      return;
    for (const id of fusion.inputs) {
      const idx = p.activeWeapons.findIndex((w) => w.weaponId === id);
      if (idx >= 0) p.activeWeapons.splice(idx, 1); // in place: systems hold refs
    }
    p.activeWeapons.push({
      weaponId: fusion.resultWeaponId,
      level: 1,
      evolved: false,
    });
    // Stale WeaponSystem runtimes for the consumed inputs are removed by its
    // own syncRuntimes() pass (runtimes keyed by weaponId; grep-verified).
    this.ctx.audio.blip("evolve");
    this.ctx.events.emit(EV.weaponFused, {
      fusionId,
      resultWeaponId: fusion.resultWeaponId,
      inputs: fusion.inputs,
    });
    this.ctx.events.emit(EV.spriteDirty);
  }

  private onLevelUp(level: number): void {
    const cards = this.buildOffer(level);

    const onPick = (cardId: string | null): void => {
      if (cardId) {
        // Update 3: synthesized combo cards ("<weaponId>::<evolutionId>",
        // "fuse::<fusionId>") carry no legacy stat payload — route them
        // BEFORE the ctx.cards.find lookup (§1 coupling gotcha), skipping
        // applyCard/logCardValue entirely.
        if (cardId.includes("::")) {
          this.applyWeaponOrPassive(cardId);
          this.ctx.events.emit(EV.cardChosen, cardId);
          this.ctx.events.emit(EV.spriteDirty);
        } else {
          const card = this.ctx.cards.find((c) => c.id === cardId);
          if (card) {
            applyCard(this.ctx.player, card);
            logCardValue(this.ctx.player, card.id, 0, 0); // seed the per-card record
            this.applyWeaponOrPassive(cardId);
            this.ctx.events.emit(EV.cardChosen, cardId);
            this.ctx.events.emit(EV.spriteDirty);
          }
        }
      } else {
        // Skip: grant a small XP refund.
        this.ctx.addXP(SKIP_XP_REFUND);
      }

      this.scene.scene.resume(SCENE.World);
      this.scene.scene.stop(SCENE.Draft);
    };

    this.scene.scene.launch(SCENE.Draft, {
      cards,
      onPick,
      player: this.ctx.player,
    });
    this.scene.scene.pause(SCENE.World);
  }

  // --------------------------------------------------------------------
  // Nest & Fang: weapon/passive draft integration.
  // Card ids in cards.json match weapon/passive ids in weapons/passives.json.
  // --------------------------------------------------------------------

  /** Is this card a legal offer for the current player right now? */
  private isDraftable(card: CardData): boolean {
    const p = this.ctx.player;
    const weapon = this.ctx.weapons.find((w) => w.id === card.id);
    if (weapon) {
      // Update 2: animal "any" = neutral weapon, legal for every species.
      if (weapon.animal !== "any" && weapon.animal !== p.animalId) return false;
      const owned = p.activeWeapons.find((w) => w.weaponId === weapon.id);
      // Update 3: fusion-only weapons can never be ACQUIRED through the
      // normal draft; once owned (via fusion) their upgrade cards flow
      // through the standard leveling rules below.
      if (weapon.fusionOnly && !owned) return false;
      if (!owned) return p.activeWeapons.length < WEAPON_SLOTS;
      if (owned.evolved) return false;
      if (owned.level < weapon.levels.length) return true;
      // At max level: draftable only as an evolution — any branch whose
      // required passive is owned (Update 3: evolutions is an array; fusion-
      // only weapons have none and are never draftable this way).
      return weapon.evolutions.some((evo) =>
        p.activePassives.some((ap) => ap.passiveId === evo.requiresPassiveId)
      );
    }
    const passive = this.ctx.passives.find((ps) => ps.id === card.id);
    if (passive) {
      // Update 2: animal "any" = neutral passive, legal for every species.
      if (passive.animal !== "any" && passive.animal !== p.animalId) return false;
      const owned = p.activePassives.find((ap) => ap.passiveId === passive.id);
      if (!owned) return p.activePassives.length < PASSIVE_SLOTS;
      return owned.stacks < passive.maxStacks;
    }
    // Legacy stat cards (if any remain in cards.json) stay draftable.
    return true;
  }

  /** Update 3: expand max-level weapon cards into one synthesized card per
   * passive-satisfied evolution branch, id "<weaponId>::<evolutionId>" (two
   * satisfied branches = two distinct cards may appear in one offer). The
   * synthesized card inherits the base card's rarity/weights; its title stays
   * the weapon name while DraftScene's status line shows the branch. */
  private expandEvolutionBranches(pool: CardData[]): CardData[] {
    const p = this.ctx.player;
    const out: CardData[] = [];
    for (const c of pool) {
      const weapon = this.ctx.weapons.find((w) => w.id === c.id);
      const owned = weapon
        ? p.activeWeapons.find((w) => w.weaponId === weapon.id)
        : undefined;
      const atEvolveGate =
        weapon &&
        owned &&
        !owned.evolved &&
        owned.level >= weapon.levels.length;
      if (!weapon || !atEvolveGate) {
        out.push(c);
        continue;
      }
      const satisfied = weapon.evolutions.filter((evo) =>
        p.activePassives.some((ap) => ap.passiveId === evo.requiresPassiveId)
      );
      for (const evo of satisfied) {
        out.push({ ...c, id: `${weapon.id}::${evo.id}` });
      }
      if (satisfied.length === 0) out.push(c); // defensive; isDraftable filtered
    }
    return out;
  }

  /** Mutate activeWeapons/activePassives for a chosen weapon/passive card. */
  private applyWeaponOrPassive(cardId: string): void {
    const p = this.ctx.player;
    // Update 3: "fuse::<fusionId>" = resolve a fusion (checked before the
    // generic "::" branch route since it shares the separator).
    if (cardId.startsWith("fuse::")) {
      this.applyFusion(cardId.slice("fuse::".length));
      return;
    }
    // Update 3: "<weaponId>::<evolutionId>" = take a specific evolution branch.
    if (cardId.includes("::")) {
      const [weaponId, evolutionId] = cardId.split("::");
      const weapon = this.ctx.weapons.find((w) => w.id === weaponId);
      const owned = p.activeWeapons.find((w) => w.weaponId === weaponId);
      if (!weapon || !owned || owned.evolved) return;
      if (!weapon.evolutions.some((e) => e.id === evolutionId)) return;
      owned.evolved = true;
      owned.evolutionId = evolutionId;
      this.ctx.audio.blip("evolve");
      this.ctx.events.emit(EV.weaponUpgraded, {
        weaponId,
        level: owned.level,
        evolved: true,
      });
      return;
    }
    const weapon = this.ctx.weapons.find((w) => w.id === cardId);
    if (weapon) {
      const owned = p.activeWeapons.find((w) => w.weaponId === weapon.id);
      if (!owned) {
        p.activeWeapons.push({ weaponId: weapon.id, level: 1, evolved: false });
        this.ctx.events.emit(EV.weaponUpgraded, {
          weaponId: weapon.id,
          level: 1,
          evolved: false,
        });
      } else if (owned.level < weapon.levels.length) {
        owned.level += 1;
        this.ctx.events.emit(EV.weaponUpgraded, {
          weaponId: weapon.id,
          level: owned.level,
          evolved: false,
        });
      } else if (!owned.evolved) {
        owned.evolved = true;
        // Update 3: record which branch was taken (first satisfied branch;
        // Phase 1 replaces this with explicit per-branch draft cards).
        const branch =
          weapon.evolutions.find((evo) =>
            p.activePassives.some((ap) => ap.passiveId === evo.requiresPassiveId)
          ) ?? weapon.evolutions[0];
        owned.evolutionId = branch?.id;
        this.ctx.audio.blip("evolve");
        this.ctx.events.emit(EV.weaponUpgraded, {
          weaponId: weapon.id,
          level: owned.level,
          evolved: true,
        });
      }
      return;
    }
    const passive = this.ctx.passives.find((ps) => ps.id === cardId);
    if (passive) {
      const owned = p.activePassives.find((ap) => ap.passiveId === passive.id);
      const wasAtCap = !!owned && owned.stacks >= passive.maxStacks;
      if (!owned) p.activePassives.push({ passiveId: passive.id, stacks: 1 });
      else owned.stacks = Math.min(owned.stacks + 1, passive.maxStacks);
      // Update 2 — wild-heart: +maxHp/stack, heal the delta on pick. Special-
      // cased here (like the existing "luck" handling in applyCard) since
      // maxHp is stored player state, not a derived statBonus() lookup.
      if (passive.effect.type === "maxHp" && !wasAtCap) {
        p.maxHp += passive.effect.magnitude;
        p.hp = Math.min(p.maxHp, p.hp + passive.effect.magnitude);
      }
    }
  }

  private hasAnyEpicPlus(pool: CardData[]): boolean {
    return pool.some((c) => EPIC_PLUS.includes(c.rarity));
  }

  /** Roll a rarity restricted to epic/legendary/mythic, weighted by their relative weights at this level. */
  private pickForcedEpicPlusRarity(
    level: number,
    luck: number,
    pool: CardData[],
    excludeIds: Set<string>
  ): Rarity {
    const available = EPIC_PLUS.filter((r) =>
      pool.some((c) => c.rarity === r && !excludeIds.has(c.id))
    );
    if (available.length === 0) return "epic";

    // Reuse rawWeight-derived relative shares by sampling pickRarity repeatedly
    // restricted to the epic+ subset, since rarityWeights.ts only exposes a
    // full-vector roll. Approximate the "relative weights" requirement by
    // rejection-sampling pickRarity until it lands in the epic+ set, with a
    // capped retry count to avoid infinite loops when luck is extreme.
    for (let attempt = 0; attempt < 50; attempt++) {
      const r = pickRarity(level, luck, false);
      if (available.includes(r)) return r;
    }
    // Fallback: uniform among available epic+ rarities.
    return available[Phaser.Math.Between(0, available.length - 1)];
  }

  /**
   * Choose an unpicked card of the given rarity, weighted by weightsByLevel
   * at the (clamped) level. Falls back to the next lower rarity if none
   * available, all the way down to common; returns null only if the whole
   * pool is exhausted.
   */
  private pickCardOfRarity(
    pool: CardData[],
    rarity: Rarity,
    level: number,
    excludeIds: Set<string>
  ): CardData | null {
    const startIdx = RARITY_ORDER.indexOf(rarity);

    for (let idx = startIdx; idx >= 0; idx--) {
      const r = RARITY_ORDER[idx];
      const candidates = pool.filter(
        (c) => c.rarity === r && !excludeIds.has(c.id)
      );
      if (candidates.length === 0) continue;

      const chosen = this.weightedPick(candidates, level);
      if (chosen) return chosen;
    }

    return null;
  }

  private weightedPick(candidates: CardData[], level: number): CardData | null {
    if (candidates.length === 0) return null;

    const levelKey = this.clampLevelKey(candidates[0].weightsByLevel, level);

    const weights = candidates.map((c) => {
      const w = c.weightsByLevel[levelKey];
      const base = typeof w === "number" && w > 0 ? w : 0;
      // Update 3 (D9): combo-aware 2x weighting.
      return (
        base *
        comboWeightMultiplier(
          c.id,
          this.ctx.player.activeWeapons,
          this.ctx.player.activePassives,
          this.ctx.weapons,
          this.ctx.passives
        )
      );
    });

    const total = weights.reduce((s, w) => s + w, 0);
    if (total <= 0) {
      // No usable weights at this level — uniform fallback.
      return candidates[Phaser.Math.Between(0, candidates.length - 1)];
    }

    let roll = Math.random() * total;
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }

  /** Clamp a numeric level to the nearest authored weightsByLevel key. */
  private clampLevelKey(
    weightsByLevel: Record<string, number>,
    level: number
  ): string {
    const keys = Object.keys(weightsByLevel)
      .map((k) => parseInt(k, 10))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);

    if (keys.length === 0) return "1";

    const clamped = Phaser.Math.Clamp(level, keys[0], keys[keys.length - 1]);
    // Find nearest authored key <= clamped, else the smallest key.
    let best = keys[0];
    for (const k of keys) {
      if (k <= clamped) best = k;
    }
    return String(best);
  }
}
