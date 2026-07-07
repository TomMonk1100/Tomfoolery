# Update 3 — "Symbiosis" — Autonomous Build Plan

**Status: PLANNED — not yet executed.** Scope confirmed by Adam 2026-07-07: enhanced procedural graphics (no external assets), all three combo systems (branching evolutions + codex, weapon fusions, synergy tags), shipped as one update with internally deploy-green phases.

---

## 0. Executor rules (read first)

This plan is written for step-by-step execution by a smaller model. Rules:

1. Execute phases in order (0 → 4). Do not start a phase until the previous phase's **Gate** passes.
2. Run `npm test` after every numbered step. Never proceed on red.
3. Sandbox build check: `npx vite build --outDir /tmp/udist` (building into the repo mount throws EPERM — known, see §10).
4. If a file, function, or field named here doesn't match reality, `grep` for the identifier, adapt minimally, and log the deviation in `docs/update-3-deviations.md` (create it on first deviation). Do not silently improvise designs.
5. **Do-not-touch list** (§10) is absolute — these are hard-won production fixes.
6. All new pure logic goes in `*Sim.ts`/`*.ts` files with zero Phaser imports + a vitest suite, matching the existing `sim.ts`/`worldGenSim.ts` pattern.

## 1. Current state (grounding)

- 26 weapons (`src/data/weapons.json`), each with exactly **one** evolution gated on one passive (`evolution.requiresPassiveId`). 16 passives, 11 enemies, 3 playable animals (dog/cat/rabbit) + `"any"` neutral pool.
- Evolution discovery today: invisible until a maxed weapon happens to show `EVOLVE →` in a draft (`src/scenes/DraftScene.ts:292`). No codex, no recipe hints. This is the core UX gap.
- Draft eligibility: `DraftSystem.isDraftable` / `applyWeaponOrPassive` (`src/systems/DraftSystem.ts:137-200`). **Coupling gotcha:** `onPick` resolves the picked id via `this.ctx.cards.find(...)` and only applies effects if a card is found — any runtime-synthesized card id must be handled *before* that lookup (Phase 1 depends on this).
- Graphics: procedural pixel pipeline — string pixel-maps in `src/gfx/sprites/*` via `spriteRegistry.ts` → `PixelArt.ts` atlas, PIXEL_SCALE 3, `pixelArt: true`. Single static frame per sprite, no animation, no shadows, no post-processing. Evolved weapons get only a gold tint (`WeaponSystem.tintIfEvolved`).
- Phaser **3.80.1** — built-in FX pipelines (`postFX.addBloom/addVignette`) available, WebGL only.
- VFX layer exists: `src/vfx/Juice.ts`, `Particles.ts`, `DamageNumbers.ts`, `ScreenFX.ts`.
- 178 vitest green. Stats from passives merge into `statBonus` in `WorldScene` — synergies reuse that exact seam.
- Known balance gap: instinct-cat ~27 kills/2min vs ≥50 target.

## 2. Key decisions (made — do not re-litigate during execution)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Graphics stay 100% procedural (frames, palettes, particles, postFX). No image assets. | Cheaper model can't produce consistent art; zero licensing risk; style stays coherent. |
| D2 | `evolution` → `evolutions[]`; 12 designated weapons get a second branch, the other 14 keep one path. | "More combos" without 26 new balance problems. Branches capped to signature weapons. |
| D3 | Fusion rule: **both input weapons at max level** (evolved or not) → guaranteed fusion card in the *next* draft. Fusion consumes both weapons, grants 1 fused weapon (3 levels), freeing a weapon slot. | Simple to teach ("max both, fuse"); freed slot is the incentive; guaranteed offer avoids RNG frustration. |
| D4 | Fused weapons are ordinary `weapons.json` entries with `fusionOnly: true`; recipes live in `fusions.json`. | Reuses the entire WeaponSystem untouched — fused weapons are just data. |
| D5 | Fusion recipes are within-species or neutral only (players can never own cross-species weapons). | Hard constraint from animal-locked drafting. |
| D6 | Synergy bonuses are **stat-only** in this update (damage%, cooldown%, area%, moveSpeed%, xpGain%). No bespoke behaviors. | Bespoke effects are the scope bomb; stat sets ship safely through the existing statBonus seam. |
| D7 | Codex shows **all recipes up front**; discovery state only controls art/flavor reveal + NEW badges. | Adam's stated goal is "a clear way to understand how to get to them" — hiding recipes defeats it. |
| D8 | Weapon VFX v2 is built per **archetype** (8 templates: aoe-pulse, melee-sweep, projectile, trail, zone, orbit + evolved/fused variants), not per weapon. | 8 templates instead of 34+ bespoke effects. |
| D9 | Draft weighting gets combo-awareness: cards that progress an owned weapon's evolution requirement or an active synergy tag get 2× weight (in `rarityWeights.ts`, pure + tested). | Antidote to draft-pool dilution (top sink risk, §8 R1). |
| D10 | Quality tiers (high/low) auto-detected once per boot; low disables postFX and halves particle budgets; manual override persisted in MetaSave. | Mobile perf insurance without blocking the visual upgrade on desktop. |

## 3. Phase 0 — Foundations (schema + scaffolds)

Everything later depends on this. Small, mechanical, fully test-covered.

1. **`src/core/types.ts`:**
   - `WeaponEvolution` gains `id: string`.
   - `WeaponData.evolution: WeaponEvolution` → `evolutions: WeaponEvolution[]`; add optional `tags?: string[]`, `fusionOnly?: boolean`.
   - `PassiveData` gains optional `tags?: string[]`.
   - `ActiveWeapon` gains `evolutionId?: string` (which branch was taken).
   - New: `FusionData { id; name; inputs: [string, string]; resultWeaponId; description; icon }` and `SynergyData { id; name; tag; thresholds: { count: number; bonus: Partial<StatBonus> }[]; description; icon }`.
   - `MetaSave` gains `codex: { evolutions: string[]; fusions: string[]; synergies: string[] }` (discovered ids) and `quality?: "auto" | "high" | "low"`. Bump the save version; migration fills defaults. Extend `tests/save.test.ts` for old→new migration.
2. **Migrate `src/data/weapons.json`:** wrap every `evolution` object as `evolutions: [ { id: "<weaponId>-evo-a", ...existing } ]` (script it with python3, verify count 26). Add a defensive normalizer where weapons load into GameContext: if a legacy `evolution` key is seen, convert it.
3. **Grep sweep for `.evolution`** (DraftSystem, DraftScene, WeaponSystem, HUD, tests) → update to `evolutions` array access. Where old code read "the" evolution of an evolved weapon, resolve via `ActiveWeapon.evolutionId` with fallback to `evolutions[0]`.
4. Create `src/data/fusions.json` and `src/data/synergies.json` as `[]`; load them into GameContext alongside weapons/passives; expose as `ctx.fusions` / `ctx.synergyDefs`.
5. **`src/core/Quality.ts`:** detect tier at boot — `renderer.type === Phaser.WEBGL` AND a 3-second fps probe ≥ 45 → high, else low; MetaSave override wins. Expose `{ postFX: boolean; particleScale: number (1 | 0.5) }`. Settings toggle button in `MetaHubScene` (cycle auto/high/low).

**Gate 0:** all tests green (fixtures updated); `/tmp/udist` build succeeds; dev boot shows a run where an existing single-path evolution still triggers (add a vitest for `isDraftable` evolution eligibility against the new array schema).

## 4. Phase 1 — Combo core (evolutions v2, synergies, fusions)

### 4a. Branching evolutions

Add branch B (`<weaponId>-evo-b`) to these 12: `bark-blast`, `zoomies`, `pounce-slash`, `midnight-prowl`, `scissor-kick`, `lucky-clover`, `tennis-ball`, `bee-swarm`, `skunk-cloud`, `acorn-mortar`, `echo-screech`, `laser-pointer`.

Design rule per branch B: **same DPS budget ±10% as branch A, different identity** — pick a different passive gate (must be legal for the weapon's animal, prefer one A doesn't use) and change pattern/archetype toward utility (bigger area / lower damage, or added knockback, or faster cooldown / smaller hit). Name it thematically (e.g. bark-blast A "Sonic Howl" stays; B "Guard Bark" gated on `thick-fur`, smaller radius, huge knockback, -30% cooldown).

Engine changes (`DraftSystem`):

- `isDraftable`: weapon at max level, not evolved → eligible if **any** `evolutions[i].requiresPassiveId` is owned.
- `buildOffer`: for each satisfied branch, synthesize a distinct card with id `"<weaponId>::<evolutionId>"` (two branches satisfied = two cards may appear in one offer).
- `onPick`: **before** the `ctx.cards.find` lookup, detect `::` ids and route them straight to `applyWeaponOrPassive` (see §1 coupling gotcha) — synthesized cards carry no legacy stat payload, so `applyCard`/`logCardValue` are skipped for them.
- `applyWeaponOrPassive`: parse `::`, set `owned.evolved = true; owned.evolutionId = <id>`, emit the existing `EV.weaponUpgraded` with `evolved: true`.
- `WeaponSystem`: everywhere `data.evolution` was read for an evolved weapon, resolve the branch via `evolutionId`.
- `DraftScene`: card title shows the branch name (`EVOLVE → Guard Bark`).

Tests: eligibility matrix (0/1/2 branches satisfied), pick-applies-correct-branch, stats resolve per branch.

### 4b. Synergy tags

Six tags; every weapon and passive gets 1–2. Assignment table (executor applies verbatim to the JSON files):

| Tag | Weapons | Passives |
|-----|---------|----------|
| `sonic` | bark-blast, echo-screech, thumper-quake, purr-aura | alpha-scent |
| `feral` | pounce-slash, claw-flurry, tail-wag-strike, scissor-kick | predator-eye, wild-heart |
| `verdant` | dig, burrow-network, carrot-toss, skunk-cloud, acorn-mortar | nibbler, big-appetite |
| `swift` | zoomies, midnight-prowl, bunny-barrage, yarn-whip | spring-legs, feline-grace |
| `lucky` | lucky-clover, tennis-ball, firefly-lantern, laser-pointer | lucky-foot, four-leaf, picky-eater |
| `pack` | cottontail-decoy, bee-swarm, fetch, hairball-lob, slobber-shot | loyal-heart, litter-of-friends, thick-fur, keen-nose, magnet-collar, soft-paws |

`synergies.json` — thresholds at 2 and 3 owned items sharing the tag:

- sonic: 2 → +10% area; 3 → +20% area, +10% knockback
- feral: 2 → +8% damage; 3 → +18% damage
- verdant: 2 → +10% xpGain; 3 → +20% xpGain, +5% area
- swift: 2 → +6% moveSpeed; 3 → +12% moveSpeed, −8% cooldown
- lucky: 2 → +8% xpGain; 3 → −10% cooldown, +8% damage
- pack: 2 → +5% damage, +5% area; 3 → +12% damage, +10% knockback

If a bonus field has no existing `StatBonus` equivalent, map to the nearest existing field and log the deviation — do **not** add new stat plumbing.

Engine: new pure module `src/systems/synergySim.ts` (`computeActiveSynergies(activeWeapons, activePassives, weapons, passives, synergyDefs) → { synergyId, tier, bonus }[]`) + `SynergySystem.ts` that recomputes on `EV.cardChosen` and `EV.weaponUpgraded`, emits `EV.synergyChanged` (add to the EV enum in `types.ts`, re-export pattern per §10), and exposes `activeBonuses`. `WorldScene` merges `activeBonuses` into `statBonus` at the exact spot activePassives merge today. Vitest: threshold math, stacking with passives, recompute on fusion (inputs removed → tags recount).

### 4c. Fusions

`fusions.json` — 8 recipes (respecting D5):

| id | inputs | result (new weapon) | identity |
|----|--------|--------------------|----------|
| thunder-fetch | bark-blast + fetch | Thunder Fetch (dog, projectile) | boomerang that detonates an AoE pulse on catch |
| slip-n-blitz | zoomies + slobber-shot | Slip 'n' Blitz (dog, trail) | slick trail that slows + damages |
| wildcat-cyclone | pounce-slash + claw-flurry | Wildcat Cyclone (cat, melee-sweep, pattern ring) | 360° shred |
| tangle-storm | hairball-lob + yarn-whip | Tangle Storm (cat, projectile) | piercing multi-shot |
| seismic-kick | scissor-kick + thumper-quake | Seismic Kick (rabbit, aoe-pulse) | line kick + quake ring |
| clover-cascade | lucky-clover + bunny-barrage | Clover Cascade (rabbit, orbit) | orbiting clovers emit trail bursts |
| glowhive | bee-swarm + firefly-lantern | Glowhive (any, orbit) | double-ring orbit, high tick rate |
| cannonade | tennis-ball + acorn-mortar | Cannonade (any, projectile) | arcing volley of 3 |

Each result is a full `weapons.json` entry: `fusionOnly: true`, 3 levels, `evolutions: []`, tags = union of both inputs' tags. DPS budget: level-3 fused ≤ 1.3× the sum of both inputs' max-level DPS (it frees a slot — that's already the power gain).

Engine (`DraftSystem`):

- `isDraftable`: `fusionOnly` weapons are never draftable through the normal path; empty `evolutions` must not crash the max-level check (guard the array access).
- `buildOffer`: if any recipe's two inputs are both owned at max level and result not owned → **prepend** a guaranteed fusion card, id `"fuse::<fusionId>"`, styled mythic. Max one fusion card per offer.
- Apply: remove both input `ActiveWeapon`s, push `{ weaponId: resultWeaponId, level: 1, evolved: false }`, emit new `EV.weaponFused` (VFX + codex hooks) and `EV.spriteDirty`. The consumed input weapons' runtime state in `WeaponSystem` must be cleaned up (grep how weapon runtimes are keyed; remove stale entries).
- `DraftScene`: fusion card renders both input icons + "⚡ FUSE".

Sprites: 8 new pixel-maps in `src/gfx/sprites/ui.ts` (icons) following the existing string-map format.

**Gate 1:** vitest green including new suites (branch matrix, synergy math, fusion injection/apply/slot-free); dev-run sanity: force a fusion via console (`window.__understory`) and confirm the fused weapon fires.

## 5. Phase 2 — Discovery UX (codex + in-run hints)

This phase is the answer to "a clear way to understand how to get to them." Combos without this are invisible content.

1. **CodexScene** (`src/scenes/CodexScene.ts`, register `SCENE.Codex`): three tabs — Evolutions, Fusions, Synergies. One scrollable list per tab (reuse DraftScene's touch-scroll approach if present; otherwise simple drag-scroll container). Entry row = icon + name + one recipe line:
   - Evolution: `Bark Blast Lv5 + Loyal Heart → Sonic Howl`
   - Fusion: `Bark Blast MAX + Fetch MAX → Thunder Fetch`
   - Synergy: `2× sonic → +10% area · 3× → +20% area +10% knockback`
   - Per D7 all recipes are always readable; undiscovered entries are desaturated with "???" flavor text; discovered entries show full description. `NEW` badge for entries discovered since the codex was last opened (store a seen-set or timestamp in MetaSave).
2. **Discovery writes:** on `EV.weaponUpgraded` with `evolved: true` → record evolutionId; on `EV.weaponFused` → record fusionId; on `EV.synergyChanged` reaching a threshold → record synergyId. Persist via SaveManager immediately (players die; discoveries shouldn't).
3. **Entry points:** button in `MetaHubScene` ("Codex") and in the pause overlay (grep for how pause is implemented; if there is no pause menu, add codex access only in MetaHub and log deviation).
4. **Draft card enrichment** (`DraftScene`): weapon cards gain a footer line — below max: `Evolves: Sonic Howl (needs Loyal Heart)` (first unsatisfied branch, or the satisfied one); if a fusion partner is owned: `Fuses with Fetch!`. All cards render their tag(s) as small colored chips (6 fixed tag colors, defined once).
5. **HUD synergy chips** (`src/ui/HUD.ts`): active synergy tags as compact chips (e.g. `sonic 2/3`), max 3 shown, positioned to not collide with existing HUD on a 390×844 portrait viewport — verify with a screenshot.

**Gate 2:** codex opens from hub; discovery persists across reload (extend `tests/save.test.ts`); draft cards show recipe hints; HUD screenshot reviewed for overlap; tests green.

## 6. Phase 3 — Graphics (enhanced procedural)

Ordered so each step is independently shippable; if the phase runs long, ship 1–4 and defer 5–6.

1. **Animation frames.** Extend the sprite registry schema: an entry may provide `animFrames: string[][]` (additional pixel-maps, same dimensions as the base — validate and throw at build time on mismatch). `PixelArt.ts` emits them as atlas frames `<key>_f1..n`; existing single-frame entries are untouched. Author 1 extra walk frame for the 3 player animals and all 11 enemies — mechanical rule: copy the base map, shift leg/wing/foot pixels 1px (legs forward→back), leave body rows intact. Playback: in `SpriteComposer` (player/companions) and `EnemySystem`, alternate base↔f1 at a rate proportional to speed (swap every ~180ms at full speed, hold base when idle) + a subtle idle bob via a yoyo tween (±1px, ~900ms). No Phaser AnimationManager needed — a frame-swap timer is simpler and pool-friendly.
2. **Shadows.** One shared ellipse texture (procedural, ~12×5px, black, alpha 0.25) under player, enemies, companions. Offset stays fixed during the idle bob (bob the sprite, not the shadow — cheap depth cue).
3. **Season ambience.** Driven by the existing `SeasonSystem` events: (a) a fullscreen multiply-blend tint rect — spring `0xf2fff2`, summer `0xfff8e8`, autumn `0xffe8d0`, winter `0xe8f0ff`, alpha 0.12, lerp over 2s on season change; (b) one ambient particle emitter per season via `Particles.ts` — spring petals, summer fireflies (only these glow), autumn leaves, winter snow — drifting across the camera view, count = `12 × Quality.particleScale`, fully pooled.
4. **Weapon VFX v2** — replace `tintIfEvolved` gold tint. Build 8 archetype templates with three grades: base (current look, slightly enriched), **evolved** (afterimage/echo: aoe-pulse gets a second delayed ring, projectiles get a 4-point trail, melee-sweep gets an arc afterimage, zone gets edge shimmer, orbit gets orbital sparkles, trail gets brighter pulse), **fused** (evolved variant + dual-hue: tint alternates between both input weapons' colors). Hard budget per activation: ≤ `10 × Quality.particleScale` particles; reuse ProjectilePool discipline (no per-shot allocations).
5. **PostFX** (WebGL + Quality.high only): `camera.postFX.addVignette(0.5, 0.5, 0.85, 0.35)` and `addBloom` at low strength (≈0.6, blur 1) so pixel art reads crisp, glow-y things (fireflies, evolved VFX, XP motes) pop but edges don't smear. Single kill-switch: `const ENABLE_POSTFX = true` in `Quality.ts`.
6. **Screenshot review gate:** run dev, capture 4 screenshots (one per season, mid-combat, via the headless `window.__understory.step()` technique + canvas `toDataURL`), save to `docs/update-3-screens/`, and present to Adam before sign-off. **If bloom looks bad, flip the kill-switch and ship without it — do not tune endlessly.**

**Gate 3:** tests green (registry validation test for frame dimensions); fps probe ≥55 on desktop dev and ≥40 with Chrome 4× CPU throttle; screenshots reviewed; low-quality tier verified to boot with postFX off.

## 7. Phase 4 — Balance, verification, deploy

1. **DPS budget report.** Pure sim (extend existing combat sims): compute theoretical DPS for every weapon at L1 / Lmax / each evolution / fused L3, single-target and vs a 5-pack. Emit `docs/balance-report.md` table. Tune JSON until: base weapons within ±25% of their rarity band's mean; evolved ≈ 2.0–2.4× base max; fused ≤ 1.3× sum of inputs (D3 rationale).
2. **Cat kill-rate fix** (known gap): target ≥50 kills/2min instinct cat. First lever: widen pounce-slash cone `arcDeg` and add pierce at L3+; re-run the sim + live bot after each change. Don't touch the SURVIVE-kiting threshold in `instinctBrain.ts` (see §10).
3. **Live headless playtests** (technique in §10): full 8-min instinct runs × 3 animals on a local build; additionally a scripted run that force-picks toward `thunder-fetch` to prove a fusion is reachable by ~minute 4-5 and the codex records it.
4. **Deploy:** commit (with `rm -f .git/*.lock` between git ops); copy source without node_modules/dist to a clean dir outside the repo; deploy via Netlify MCP `deploy-site` (siteId `4bdb2c96-3c9c-40ac-862c-86f4ee3ae987`); **verify the deploy-permalink first**, then production; post-deploy: curl 200 + title check, then live headless playtest on understory-life.netlify.app (background-tab throttling gotcha — use manual `.step()`); update `docs/playtest-checklist.md`.

**Gate 4 (ship):** balance report within bands; ≥50 kills/2min cat; 3 full runs clean; fusion + codex verified live; no console errors on prod.

## 8. Risks that could sink it

- **R1 — Draft-pool dilution (top risk).** ~20 new draftable states (branches, fusions) make hitting any specific combo feel random; the game gets *worse* while having more content. Mitigations baked in: D9 combo-aware 2× weighting, guaranteed fusion offers (D3), and recipe hints on cards (Phase 2.4) so players steer. **Kill criterion:** if the Phase 4 bot can't reach a fusion by minute 5 in most runs, raise weighting before shipping.
- **R2 — Schema migration breaking prod saves.** MetaSave version bump + migration test is mandatory (Phase 0.1). The weapons.json normalizer is defense-in-depth. Lesson learned from the fallback-layout 48×48 incident: **when a schema changes, grep for every consumer, including JSON fixtures.**
- **R3 — Mobile perf collapse.** Frames + particles + bloom on a mid phone. Mitigations: quality tiers (D10), hard particle budgets, throttled-Chrome gate in Phase 3. If low tier still can't hold 40fps, drop ambient particles first, animation frames last.
- **R4 — Bloom vs pixel-art aesthetic.** Subtle settings + screenshot gate + one-line kill-switch. Time-boxed by instruction (Phase 3.6).
- **R5 — Balance combinatorics.** Fusion + synergies + evolved could multiply into a trivializing build. The DPS budget report (Phase 4.1) is the guardrail; synergies being stat-only (D6) keeps the surface analyzable.
- **R6 — Executor drift.** A cheaper model rewriting wrap math or worldgen validation "while it's in there" would reintroduce shipped production bugs. Hence the do-not-touch list (§10) and the deviations log (§0.4).
- **R7 — DraftSystem is now the load-bearing wall.** Three features (branches, fusions, weighting) all land in one file. Mitigation: each lands as a separate step with its own vitest suite before the next begins; the eligibility matrix test is written *before* fusions are added.

## 9. Open questions (defaults chosen; flag to Adam, don't block)

1. Fused weapons: 3 levels (chosen) vs single fixed level. Default keeps late drafts meaningful.
2. Second branches for exactly 12 weapons (chosen) vs all 26. All-26 adds ~2 phases of content+balance work; revisit as Update 3.5 if the 12 land well.
3. Codex completion reward (e.g. cosmetic or meta-currency on 100%)? Deferred — hook exists (codex arrays in MetaSave), nothing built.
4. Audio pass (AudioManager only blips today)? Out of scope; fusion gets the existing `evolve` blip pitched down.
5. Pause-menu codex access if no pause menu exists today? Executor logs what it finds; MetaHub access is the guaranteed path.

## 10. Do-not-touch list + environment gotchas (appendix)

**Do not modify** (shipped production fixes; changing them reintroduces live bugs):

- `sim.ts` wrap math (`wrapDelta`/`wrapDistance`/`wrapDeltaVec`) and `computeFacing`.
- `InstinctAI.ts` final steering through `wrapDeltaVec` (seam-freeze fix).
- `worldGenSim.ts` validation + `ensureConnectivity`, and `src/data/fallback-layout.json` (48×48 — regenerate only if WORLD_SIZE ever changes, which this update must not do).
- `instinctBrain.ts` target selection (plain-Euclidean by design) and the SURVIVE hp<35% threshold.
- `EV` gotcha: events are defined in `types.ts`, re-exported from `context.ts` — new events (`synergyChanged`, `weaponFused`) follow that exact pattern.

**Environment:**

- Sandbox: `vite build` into the mount throws EPERM → `--outDir /tmp/udist`. Verify logic with vitest, not `astro/vite dev`.
- Git in sandbox leaves stale locks → `rm -f .git/*.lock` between operations.
- Deploy = Netlify MCP `deploy-site` (uploads source, builds remotely). Copy source to a clean dir outside the repo first (understory is untracked inside TomSite's git).
- Phaser fully freezes in hidden tabs. Headless playtest: `window.__understory` exposes the game; pump `game.step(t += 16.7, 16.7)` in a console loop; poll `scene.getScenes(true)` for `DraftScene`, call `draft.pick(i)` (throws a harmless error after applying), then `draft.scene.stop()` + resume WorldScene.
- Always verify live with curl + a headless playtest after deploy — a green Netlify build has lied before.
