# Update 3 — Execution deviations log

Per plan §0.4: deviations from the written plan, with rationale. Phase 0 executed 2026-07-07.

## Phase 0

1. **Steps 0.2 + 0.3 landed as a single test-run unit.** The plan orders "migrate weapons.json" before "grep sweep consumers", but flipping the JSON schema alone turns consumers red (rule 2: never proceed on red). Both were applied back-to-back, then tested once. No design change.
2. **Quality pure logic lives in `src/core/qualitySim.ts`, not `Quality.ts`.** Phaser cannot be imported under vitest's node environment (no DOM globals — see the note in `tests/phasertest.test.ts`). `Quality.ts` keeps the Phaser-dependent boot probe + singleton and re-exports the sim's types/constants; `qualitySim.ts` holds `settingsForTier`/`resolveTier` with its own vitest suite. Matches the repo's `*Sim.ts` pattern (rule 6).
3. **`tests/draftEligibility.test.ts` mocks `phaser` and calls the private `isDraftable` directly.** Same node-env constraint; extracting eligibility into a pure module was judged too invasive for Phase 0 (DraftSystem is the R7 load-bearing wall — Phase 1 restructures it anyway).
4. **Normalizer applied at all three `weapons.json` import sites** (WorldScene, DraftScene, MetaHubScene via `src/core/weaponCatalog.ts`), not only "where weapons load into GameContext" — the scenes import the raw JSON directly, so normalizing only the ctx copy would leave two un-normalized views of the same data.
5. **`StatBonus` did not exist as a type** (plan §3.1 references `Partial<StatBonus>`); `ctx.statBonus()` is a string-keyed lookup. Defined a new `StatBonus` interface in `types.ts` restricted to the D6 stat set (damage, cooldown, area, moveSpeed, xpGain, knockback); `SynergyData.thresholds[].bonus` uses it directly (already all-optional, so `Partial<>` is redundant).
6. **`applyWeaponOrPassive` already records `ActiveWeapon.evolutionId`** (first passive-satisfied branch, fallback `evolutions[0]`) when an evolution is picked. Slightly ahead of Phase 1 4a (which replaces this with explicit per-branch cards), but without it evolutionId would never be set for evolutions taken between Phase 0 and Phase 1.

## Phase 1 (executed 2026-07-07)

7. **Gate 1's live dev-run fusion sanity replaced by a scripted vitest** (`tests/fusion.test.ts` "Gate 1 sanity"). The sandbox cannot run a Phaser dev server (§10: verify logic with vitest, not vite dev); the test drives the real DraftSystem apply path from empty kit → both inputs maxed → guaranteed fusion offer → fused weapon owned. A true in-browser check happens at Phase 4's live playtest.
8. **Fused weapons have cards.json entries; `isDraftable` blocks them only when un-owned.** The plan gives fused weapons 3 levels (§9.1 "keeps late drafts meaningful") but says they're "never draftable through the normal path" — with no card they could never level past 1, and content.test enforces one card per weapon. Resolution: acquisition is fusion-only, upgrades flow through the normal draft.
9. **D9 combo weighting landed in Phase 1** (plan never assigns it to a phase; Phase 4's kill criterion assumes it exists). `comboWeightMultiplier` in rarityWeights.ts (pure + tested), wired into DraftSystem.weightedPick. "Progresses a synergy tag" implemented as: card shares a tag with ≥1 owned item.
10. **Synergy bonus stat mappings** (per §4b "map to nearest existing field"): xpGain → pickupRadius (no xpGain hook exists; bigger mote magnet ≈ more XP collected), knockback → area (no statBonus("knockback") hook). synergies.json stores the mapped fields so Phase 2's codex shows real effects; sonic-3 folds its knockback into area (+30% total).
11. **Fusion card makes a 4-card offer** ("prepend" per §4c). DraftScene shrinks card width 130→108 when 4 cards are present (4×130 overflows the 480px viewport).

## Phase 2 (executed 2026-07-07)

12. **No pause menu exists in this build** (grepped WorldScene/HUD/scenes — only `scene.isPaused()`, no overlay). Per plan §9.5's own stated default, Codex is reachable from MetaHubScene only. Not a deviation from instructions so much as executing the documented fallback, logged here for traceability.
13. **CodexScene's scroll list is a from-scratch drag-container** (mask + pointer delta, clamped). Grepped DraftScene/MetaHubScene/InputController for a reusable scroll pattern per plan §5.1's "reuse DraftScene's touch-scroll approach if present" — none exists anywhere in the codebase, so built the "otherwise simple drag-scroll container" fallback the plan names explicitly.
14. **NEW-badge tracking uses a `codexSeen` snapshot (MetaSave), not per-id timestamps.** Plan §5.1 allows either ("store a seen-set or timestamp"). A seen-set is simpler to migrate and test; `markCodexSeen()` copies `codex` → `codexSeen` when CodexScene closes.
15. **Draft-card footer/tag-chip logic has no dedicated vitest.** It's presentational glue inside a Phaser Scene (same category as the pre-existing `describeCard`/`isNeutralCard`, never unit-tested) reading data already covered by `content.test.ts`/`fusion.test.ts`. Rule 6 (`*Sim.ts` + vitest) applies to new pure logic; this isn't pure logic, it's rendering.
