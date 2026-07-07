# Update 3 — Execution deviations log

Per plan §0.4: deviations from the written plan, with rationale. Phase 0 executed 2026-07-07.

## Phase 0

1. **Steps 0.2 + 0.3 landed as a single test-run unit.** The plan orders "migrate weapons.json" before "grep sweep consumers", but flipping the JSON schema alone turns consumers red (rule 2: never proceed on red). Both were applied back-to-back, then tested once. No design change.
2. **Quality pure logic lives in `src/core/qualitySim.ts`, not `Quality.ts`.** Phaser cannot be imported under vitest's node environment (no DOM globals — see the note in `tests/phasertest.test.ts`). `Quality.ts` keeps the Phaser-dependent boot probe + singleton and re-exports the sim's types/constants; `qualitySim.ts` holds `settingsForTier`/`resolveTier` with its own vitest suite. Matches the repo's `*Sim.ts` pattern (rule 6).
3. **`tests/draftEligibility.test.ts` mocks `phaser` and calls the private `isDraftable` directly.** Same node-env constraint; extracting eligibility into a pure module was judged too invasive for Phase 0 (DraftSystem is the R7 load-bearing wall — Phase 1 restructures it anyway).
4. **Normalizer applied at all three `weapons.json` import sites** (WorldScene, DraftScene, MetaHubScene via `src/core/weaponCatalog.ts`), not only "where weapons load into GameContext" — the scenes import the raw JSON directly, so normalizing only the ctx copy would leave two un-normalized views of the same data.
5. **`StatBonus` did not exist as a type** (plan §3.1 references `Partial<StatBonus>`); `ctx.statBonus()` is a string-keyed lookup. Defined a new `StatBonus` interface in `types.ts` restricted to the D6 stat set (damage, cooldown, area, moveSpeed, xpGain, knockback); `SynergyData.thresholds[].bonus` uses it directly (already all-optional, so `Partial<>` is redundant).
6. **`applyWeaponOrPassive` already records `ActiveWeapon.evolutionId`** (first passive-satisfied branch, fallback `evolutions[0]`) when an evolution is picked. Slightly ahead of Phase 1 4a (which replaces this with explicit per-branch cards), but without it evolutionId would never be set for evolutions taken between Phase 0 and Phase 1.
