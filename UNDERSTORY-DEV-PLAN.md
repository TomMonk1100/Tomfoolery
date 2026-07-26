# Understory — Development Plan (Autonomous Build Workflow)

## Step 1: Problem Decomposition

**Core problem.** A solo hobbyist developer wants to ship a playable, deployable prototype of a one-handed mobile roguelite in a single extended session, without game-design decisions left open — the design bible is canonical and fixed. The engineering problem is: how do you sequence systems (input, world, verbs, progression, sprite compositing, meta persistence, UI) so that each layer is testable in isolation, and how do you keep scope small enough that a 10–15 minute, four-season run is actually finishable and playable by end of session, on a web stack the developer already knows (Astro/Netlify), without pulling in an engine (Godot) that requires new tooling knowledge.

**Who it affects.** Just the developer initially — this is a solo build, not a team coordination problem. The "audience" for the plan is future-Claude-executing-autonomously and the human who will playtest the output.

**Available resources.**
- Free asset sources: Kenney.nl (CC0 sprite packs, nature/animal tilesets), OpenGameArt.org (CC0/CC-BY filtered), itch.io free asset packs (check license per-pack). For MVP, placeholder programmer art (colored rectangles/circles composited in layers) removes any licensing risk and any dependency on external downloads succeeding.
- Audio: freesound.org (CC0 filter) for SFX; for lo-fi chill music, either royalty-free packs (e.g., Kevin MacLeod incompetech CC-BY, or itch.io "lofi" CC0 packs) or — safest for a zero-dependency autonomous run — procedurally generated ambient pads via Web Audio API oscillators, which requires no download and no license text.
- No external game APIs are needed; this is fully client-side with localStorage/IndexedDB for persistence.
- Existing pipeline: Netlify deploy already proven on this account (per developer's TomSite project); same account/workflow can host a second static site.

**Prior art and shortfalls.** Comparable non-combat mobile roguelites (Vampire-Survivors-likes are combat-focused and not comparable; closer analogues are "Alto's Odyssey" for one-handed touch flow, "Neko Atsume" for passive-collection loops, "Wingspan"-digital for card-drafting mechanics) each solve one slice well but none combine: fog-of-war foraging + card-draft mutation + visible sprite-layer growth + season-gated life-stages + rich end-of-run analytics in one small package. The shortfall in existing chill-genre games is usually shallow end-of-session feedback (no stat attribution) and no visible build-crafting on the avatar itself. Understory's differentiator (per-card live value/cost counters, layered visible mutation) is precisely what's hardest to retrofit later, so it must be designed into the data schema from instruction one, not bolted on.

**Minimum viable scope for one person, one session.** A single playable animal (Dog — simplest verb set, no flight/verticality complexity that Bird would require), one biome tile-based world with fog-of-war, the six core verbs functionally stubbed (Forage/Explore/Nest/Befriend/Evade/Migrate all present, but Befriend's timing minigame and Evade's hazard variety can be minimal), a reduced card pool (15–20 of the 60 cards, spanning all 6 rarities so the weighting system is provable), 2 sprite layer slots wired end-to-end (head + back) rather than all 6, one full Spring→Winter season cycle, Sunseeds meta-currency with a trimmed Dog upgrade tree (5–6 of 14 nodes), Life Story screen with a reduced but real stat set (8–10 of 20+, using the same attribution architecture so remaining stats are additive later), and Instinct Mode as a simple state-machine autopilot. This scope is deliberately vertical-sliced: every system category from the bible is touched and functionally real, just shallower in content volume, so nothing needs re-architecting to reach full spec later.

**Constraints.**
- *Technical:* Mobile Safari/Chrome performance ceilings — must avoid per-frame garbage collection churn (object pooling for tiles/particles), must keep draw calls low (sprite atlas, not per-part image tags).
- *Touch input:* Must distinguish drag (joystick) vs swipe (dash) vs hold-release (Focus Action ring) vs tap (interact) reliably on a single touch surface with no multi-touch assumptions; needs velocity/duration thresholds tuned empirically.
- *Sprite compositing:* Layered attachment (head/back/tail/paws/aura/trail) means render-order and anchor-point management per animal skeleton; must be data-driven (JSON offsets per animal type) not hardcoded per sprite.
- *Save data:* localStorage has a ~5MB synchronous ceiling and is fine for meta-progression JSON; IndexedDB is reserved for anything larger/binary (not needed at MVP scope, but the abstraction should allow swapping later).
- *Legal/licensing:* Any asset pulled from an external site must have license terms captured; MVP therefore defaults to zero external asset downloads (programmer art + procedural audio) to guarantee the autonomous run never blocks on a license check it can't verify.
- *Engine choice constraint:* Developer already knows web/TS/Astro/Netlify; Godot 4 would add GDScript/engine-export tooling and a second deploy pipeline (export templates, differing hosting), which is unjustified cost for someone optimizing for a single autonomous session and reuse of an existing CI/CD path. Phaser 3 + TypeScript wins: npm-installable, runs in the existing Node/Vite-adjacent tooling mindset, outputs a static bundle Netlify already knows how to serve, and can be wrapped later with Capacitor for app-store packaging without changing the core codebase. Godot 4 is superior for console-quality 2D lighting/shaders and has a better built-in editor for tilemaps/animation, but that advantage doesn't offset the tooling-context-switch cost for this developer and this session constraint. **Decision: Phaser 3 + TypeScript, Vite build, deployed as a static site to Netlify; Capacitor wrap deferred to a documented future step.**

## Step 2: Build Plan Generation

1. **Project scaffold.** Use `npm create vite@latest` with the vanilla-TypeScript template, then add Phaser 3 as a dependency. *Why over alternatives:* Vite gives fast HMR and a zero-config static build output (`dist/`) that Netlify's default "no build command needed, publish `dist`" pattern already matches, avoiding the exact class of Netlify misconfiguration (unset build command/publish dir) previously hit on this account. Input: none. Output: runnable `npm run dev` shell and `npm run build` producing `dist/`. Failure handling: if Phaser fails to install, pin to the last known-good published version rather than `latest`.

2. **Data schemas as JSON.** Define `cards.json` (id, name, rarity, weight-by-level, effect type, trade-off, sprite-slot target), `animals.json` (per-animal base stats, verb availability, sprite-layer anchor points), `metaTrees.json` (per-animal node graph: id, cost in Sunseeds, prerequisite ids, effect). *Why JSON over hardcoded objects:* separates content from logic so card/animal counts can grow from MVP's 15–20 cards to the full 60 without touching game code, and is trivially diffable/versionable in git. Input: design-bible values (this document authors reasonable placeholder numbers where the bible doesn't specify exact numeric weights). Output: three JSON files under `src/data/`. Failure handling: if a required field is ambiguous, default to the nearest documented rarity tier's median value and flag it in a code comment `// TODO-BALANCE`.

3. **Core loop systems, in dependency order** (each depends only on prior numbered systems being present, so each can be smoke-tested before the next starts):
   a. **Input layer** — a single `InputController` class classifying raw pointer events into drag/swipe/hold-release/tap via displacement + duration thresholds. Why first: every other verb depends on classified input, not raw events. Output: typed events (`onDrag`, `onSwipe`, `onFocusRelease`, `onTap`).
   b. **Movement** — joystick vector applied to player sprite velocity with world-bound clamping. Depends on (a).
   c. **World generation** — chunked tile grid with a fog-of-war mask texture revealed by player proximity radius. Why chunked: keeps per-frame cost bounded regardless of world size. Depends on (b) for reveal-on-move.
   d. **Verb systems** — Forage (tap on resource node → item + XP), Explore (fog reveal, already partly built in c), Nest (tap on nest zone → save/heal checkpoint), Befriend (hold-release timing ring scored against a target window), Evade (swipe-dash away from hazard hitbox), Migrate (season-transition trigger consuming accumulated migration meter). Depends on (a)+(c).
   e. **XP/draft** — XP accrual from verbs feeds a level-up threshold; on level-up, pause world, sample 3 cards from `cards.json` weighted by current level's rarity table, present choice UI, apply chosen card's effect + trade-off to a running player-state object. Depends on (d).
   f. **Sprite layering** — a `SpriteComposer` that, given player-state's active cards, resolves which head/back/tail/paws/aura/trail slot each occupies and re-renders a composited Phaser container of layered images anchored per `animals.json` offsets. Depends on (e) producing state to render.
   g. **Seasons** — a season timer (real elapsed run-time or migration-meter driven) that swaps world tileset palette/hazard tables and triggers the Migrate verb gate at each boundary. Depends on (c)+(d).
   h. **Hazards** — season-specific hazard spawners feeding Evade. Depends on (g).
   i. **Meta persistence** — on run end, serialize Sunseeds earned + per-animal Keepsakes to `localStorage` under a namespaced key; on boot, read and hydrate the meta-tree UI. Why localStorage over IndexedDB at this scope: synchronous, simpler API, well under the 5MB ceiling for JSON of this size; IndexedDB is over-engineering for a single JSON blob. Depends on nothing upstream except needing a run to complete once.
   j. **Life Story screen** — reads a `RunStats` accumulator (incremented by every verb/card-effect call throughout the run, including per-card-instance live counters of value-delivered vs cost-incurred) and renders a scrollable summary scene at run end. Depends on (d)+(e)+(i) all having written to the same stats object throughout.
   k. **Instinct Mode AI** — a simple priority state-machine (seek nearest uncollected forage node → else seek fog edge → else flee nearest hazard) substituting for InputController's human-classified events, with the ×0.6 XP multiplier and Unique-card exclusion applied at the draft-weighting step. Depends on (a) being abstracted behind an interface so AI can drive the same verb calls a human would.

4. **Art pipeline.** Start with programmer art: each sprite layer is a simple colored primitive (circle/rounded-rect/triangle) drawn to a Phaser Graphics object and baked to a texture at boot, keyed by the same slot names used in `animals.json`/`cards.json`. Why over sourcing external packs: zero license risk, zero download-failure risk, and the slot-key contract is identical whether the texture is a gray circle or a final painted PNG — swapping in real art later is a texture-swap, not a re-architecture. Output: a texture atlas generated at runtime, or pre-baked PNGs under `src/assets/sprites/` if generated once and cached to disk for perf.

5. **Audio.** Procedural ambient pad via Web Audio API (a couple of detuned oscillators through a lowpass filter and slow LFO) for the lo-fi bed, plus short synthesized blips (Web Audio `OscillatorNode` envelopes) for Forage/Befriend/Nest feedback. Why over licensed tracks: no download, no attribution file to maintain, no risk of a dead asset URL blocking the autonomous run.

6. **PWA packaging.** Add a `manifest.json` (name, icons, `display: standalone`, portrait orientation lock) and a minimal service worker (`vite-plugin-pwa` with `registerType: autoUpdate`) caching the built bundle for offline play. Why: enables "Add to Home Screen" one-handed mobile use immediately without an app-store submission, and is the documented stepping stone to a later Capacitor wrap (Capacitor can ingest the same `dist/` output).

7. **Netlify deploy.** Commit `netlify.toml` with explicit `build.command = "npm run build"` and `build.publish = "dist"` — this is a deliberate defense against the exact previously-diagnosed failure mode (sitewide 404 from unset build command/publish dir in the dashboard). Push to a new Netlify site (or a new path/site distinct from the existing TomSite project to avoid cross-contamination), then curl-verify the live URL's root and one asset path return 200 before declaring done.

8. **Playtest checklist.** A markdown checklist (not code) confirming: one full run completable start-to-finish on a real touch device, all six verbs reachable at least once, at least one card of each rarity seen across a few runs, Life Story screen populates all tracked stats without `NaN`/`undefined`, meta currency persists across a page reload, Instinct Mode completes a run unattended.

## Step 3: Plan Refinement

Changes made to the plan above and why:

- **Cut:** Bird's flight verticality is excluded from MVP entirely (not even stubbed) — the bible only requires Dog/Cat/Bird meta-trees eventually, but Dog alone exercises every core-loop system category; adding Bird's vertical-axis movement would require a second movement/collision paradigm for zero validation benefit at MVP stage.
- **Cut:** Reduced card pool from 60 to 15–20 explicitly in Step 2's schema step rather than leaving "some subset" vague — this was vague in an earlier draft and is now a hard number so the build has a concrete stopping point for content authoring.
- **Tightened:** "Sprite layering" originally said "wire up the layering system" with no scope bound; refined to name exactly two slots (head, back) as the MVP-complete set, with the remaining four slots left as no-ops in the data schema (present as fields, unpopulated) so the schema doesn't need to change shape when they're filled in later.
- **Tightened:** Audio section originally listed licensed lo-fi packs as the primary path with procedural audio as a fallback; reversed the priority — procedural audio is now primary specifically because an autonomous unattended run cannot verify a license file or confirm a download succeeded, and a silent/broken audio fetch would be a worse failure than intentionally-simple procedural sound.
- **Tightened:** Meta persistence originally hedged between localStorage and IndexedDB "depending on data size"; resolved to localStorage only for MVP, with IndexedDB explicitly deferred and not built, since introducing an async storage API adds error-handling surface (transaction failures, browser private-mode restrictions) disproportionate to a JSON blob well under quota.
- **Edge case added:** Netlify deploy step now explicitly requires a post-deploy curl verification step, because this exact class of silent failure (build succeeds, site 404s) has previously occurred on this developer's account and is cheap to catch immediately.
- **Edge case added:** Card weighting sampling must have a defined fallback if the level-scaled weight table for a given level is missing/undefined (e.g., level exceeds authored table) — falls back to the highest authored level's table rather than crashing or returning zero cards.
- **Removed redundancy:** Step 2 originally described "hazard spawning" as part of both the World Generation step and the Seasons step; consolidated into a single Hazards step (3h) that depends on Seasons, removing duplicate logic description.

## Step 4: Autonomous Execution Rewrite

Assume repo root `understory/`. All paths below are relative to this root unless stated absolute. File naming: kebab-case for files, PascalCase for TypeScript classes, camelCase for functions/variables, SCREAMING_SNAKE_CASE for constants.

**File structure tree to create:**
```
understory/
  package.json
  vite.config.ts
  netlify.toml
  index.html
  public/
    manifest.json
    icons/icon-192.png
    icons/icon-512.png
  src/
    main.ts
    data/
      cards.json
      animals.json
      metaTrees.json
    core/
      InputController.ts
      SaveManager.ts
      RunStats.ts
    scenes/
      BootScene.ts
      WorldScene.ts
      DraftScene.ts
      LifeStoryScene.ts
      MetaHubScene.ts
    systems/
      MovementSystem.ts
      WorldGenSystem.ts
      VerbSystem.ts
      DraftSystem.ts
      SpriteComposer.ts
      SeasonSystem.ts
      HazardSystem.ts
      InstinctAI.ts
    audio/
      AudioManager.ts
    assets/
      sprites/ (generated at runtime; directory created empty)
  docs/
    playtest-checklist.md
    capacitor-wrap-notes.md
```

1. Run `npm create vite@latest understory -- --template vanilla-ts` in the parent of `understory/`. If the command errors because the directory already exists, `cd understory` and run `npm init -y` then manually add a `vite.config.ts` and `tsconfig.json` matching the vanilla-ts template defaults.
2. Run `npm install phaser vite-plugin-pwa` inside `understory/`. If install fails on `phaser@latest` due to a registry error, retry once after 5 seconds; if it fails again, install `phaser@3.80.1` explicitly.
3. Create `src/data/cards.json` with an array of 18 card objects, fields: `id` (string, kebab-case), `name`, `rarity` (one of `common|uncommon|rare|epic|legendary|mythic` — six tiers per bible), `weightsByLevel` (object keyed `"1"`–`"10"`, numeric), `effect` (`{ type: string, magnitude: number }`), `tradeoff` (`{ type: string, magnitude: number }`), `spriteSlot` (one of `head|back|tail|paws|aura|trail|none`), `stacking` (boolean, true = duplicates increment `magnitude`). Distribute so every rarity tier has at least 2 cards. If unsure of a specific numeric value, set `magnitude: 1` and `weightsByLevel` decreasing by tier (common highest, mythic lowest) and add a `"_balance": "placeholder"` field for later tuning — never leave a field `null` or absent.
4. Create `src/data/animals.json` with one entry, key `"dog"`: base stats (`speed`, `forageRadius`, `xpToLevel` array for levels 1–10), `verbs` (array containing all six verb names — all present even if some are minimally implemented per the reduced scope), `spriteAnchors` (object with keys `head|back|tail|paws|aura|trail`, each `{x, y}` pixel offsets from origin; unused slots at MVP still get a real anchor value, e.g. `{x:0,y:0}`, never omitted, so the schema shape is stable when content is added later).
5. Create `src/data/metaTrees.json` with key `"dog"` containing 6 nodes: `id`, `name`, `costSunseeds`, `prerequisiteIds` (array, empty for tier-1 nodes), `effect`.
6. Implement `src/core/InputController.ts`: subscribe to Phaser's pointer events; classify a pointer-down-to-up sequence as `tap` if duration < 200ms and displacement < 10px; `swipe` if duration < 250ms and displacement >= 40px; `hold-release` if duration >= 400ms regardless of displacement; otherwise treat continuous movement while pointer is down as `drag` (emit every frame until release). If two classifications could both match (e.g., a slow drag that ends in a quick flick), the `drag` state that was already emitting takes precedence and a terminal `swipe` is only emitted if no `drag` event fired in the preceding 3 frames — this resolves the ambiguity deterministically rather than leaving it to event-order chance.
7. Implement `src/systems/MovementSystem.ts` consuming `drag` vectors from (6), clamped to world bounds read from `WorldGenSystem`.
8. Implement `src/systems/WorldGenSystem.ts`: generate a 40x40 tile grid at boot (fixed size for MVP, not infinite/chunked — infinite generation is deferred since a bounded 10–15 minute run doesn't need it), with a separate fog-of-war `RenderTexture` mask cleared in a radius around the player each frame. If tile-grid generation produces zero valid forage-node placements (e.g., a bad random seed clusters all obstacles), regenerate once with a new seed; if the second attempt also fails validation, fall back to a hardcoded known-good static layout stored as `src/data/fallback-layout.json`.
9. Implement `src/systems/VerbSystem.ts` handling Forage/Nest/Befriend/Evade/Migrate logic keyed off classified input types from (6) and world entities from (8); Explore is satisfied by the fog reveal already in (8) triggered by (7)'s movement.
10. Implement `src/systems/DraftSystem.ts`: on XP threshold crossed, pause `WorldScene`, sample 3 cards without replacement from `cards.json` using `weightsByLevel[currentLevel]`; if `currentLevel` exceeds the highest authored key in `weightsByLevel`, use the highest authored level's weights as fallback. Push `DraftScene` for the choice; on selection, apply `effect`/`tradeoff` to a `PlayerState` singleton and increment that card-instance's `RunStats` value/cost counters from turn one of being active.
11. Implement `src/systems/SpriteComposer.ts`: read `PlayerState.activeCards`, resolve `head` and `back` slot occupants (highest-priority stacked card per slot wins if multiple target the same slot; priority = rarity rank, mythic highest), render as child images positioned via `animals.json` `spriteAnchors`. Other four slots are computed but not rendered at MVP (log to console in dev mode only, guarded by `import.meta.env.DEV`).
12. Implement `src/systems/SeasonSystem.ts`: a timer counting elapsed run-seconds, dividing the target 10–15 minute run into four equal season windows; at each boundary, swap a tileset-tint value and call `HazardSystem.setSeasonTable()`.
13. Implement `src/systems/HazardSystem.ts`: spawn hazard entities from a per-season table in `animals.json`-adjacent config; if a season has no hazards defined (authoring gap), default to the Spring table rather than spawning nothing (spawning nothing silently would make a season trivially safe in a way that breaks pacing).
14. Implement `src/core/SaveManager.ts`: wraps `localStorage.getItem/setItem` under key `understory:meta:v1`; on read, `JSON.parse` inside a try/catch — if parsing throws (corrupted data) or the result fails a shape-check (missing expected top-level keys `sunseeds`/`keepsakes`/`unlockedNodes`), discard and reinitialize to a default-zero meta object rather than crashing boot.
15. Implement `src/core/RunStats.ts`: a plain object accumulator with at minimum these 10 tracked fields for MVP (subset of the bible's 20+, additive later): `distanceTraveled`, `forageCount`, `befriendAttempts`, `befriendSuccesses`, `evadeCount`, `hazardHitsTaken`, `cardsDrafted`, `seasonsCompleted`, `totalXP`, `perCardStats` (map of cardId → `{valueDelivered, costIncurred}` incremented every time that card's effect/tradeoff fires).
16. Implement `src/scenes/LifeStoryScene.ts`: render `RunStats` fields as a scrollable list, plus a per-card breakdown table sorted by `valueDelivered - costIncurred` descending. If `perCardStats` is empty (a run ended at level 1 with no drafts), render an explicit "No cards drafted this run" row rather than an empty table.
17. Implement `src/systems/InstinctAI.ts`: a priority function evaluated every ~500ms: if an unforaged node is within `forageRadius * 3`, path toward nearest one; else if an unexplored fog edge exists within the same range, path toward it; else if a hazard is within evade-trigger range, path away; else idle-wander. Wire so Instinct Mode multiplies XP gain by 0.6 and excludes any card whose `rarity` metadata marks it `"unique"` from the draft pool (filter step in `DraftSystem`, gated by a `PlayerState.instinctMode` boolean).
18. Implement `src/audio/AudioManager.ts` using raw `AudioContext`: one persistent ambient voice (two detuned sine oscillators through a `BiquadFilterNode` lowpass, slow `LFO` on filter frequency) started on first user gesture (required by browser autoplay policy — gate the start behind the first pointerdown event, not page load); short synthesized envelope blips triggered on Forage/Befriend-success/Nest events.
19. Add `public/manifest.json` (name `"Understory"`, `display: "standalone"`, `orientation: "portrait"`, two icon sizes) and configure `vite-plugin-pwa` in `vite.config.ts` with `registerType: 'autoUpdate'`.
20. Create `netlify.toml` at repo root with explicit `[build] command = "npm run build"` and `publish = "dist"`.
21. Run `npm run build` locally; if the build fails, read the first TypeScript error, fix the specific type mismatch (most likely a JSON-import typing issue — resolve by adding `"resolveJsonModule": true` to `tsconfig.json` if not already present), and rebuild. Repeat until `dist/` is produced successfully; do not proceed to deploy on a failed build.
22. Deploy `dist/` to Netlify (new site, distinct from the existing TomSite Netlify project, to avoid overwriting an unrelated deploy). After deploy completes, `curl -I` the resulting live URL root and confirm HTTP 200; if 404, check the Netlify dashboard's configured publish directory matches `dist` and redeploy — do not consider the task complete on a build-success-only signal.
23. Write `docs/playtest-checklist.md` covering: full run completion, all six verbs triggered at least once, at least one card per rarity tier drafted across 3 test runs, Life Story screen shows no `NaN`/`undefined`, meta currency persists after a hard page reload, Instinct Mode completes a run unattended within roughly 15 minutes wall-clock.
24. Write `docs/capacitor-wrap-notes.md` documenting the deferred future step: `npm install @capacitor/core @capacitor/cli`, `npx cap init`, `npx cap add ios`/`android`, point `webDir` to `dist`, note that this is NOT executed in this session — recorded only as a next step.

## Step 5: Self-Review

- **Instruction 3 (cards.json numeric values):** Placeholder balance numbers are asserted without any validation that the resulting draft distribution is actually playable (e.g., mythic could still appear too often at low levels if weight deltas are too shallow). No numeric spec given for how much weight should separate tiers.
- **Instruction 6 (input classification):** The tie-break rule ("drag state that was already emitting takes precedence") assumes a `drag` event has already fired before a `swipe` could be misclassified, but on a genuinely fast flick from a cold pointer-down, zero `drag` frames may have emitted yet — the 3-frame lookback could pass through as a false swipe on the very first movement of a session. Edge case not fully closed.
- **Instruction 8 (world gen fallback):** "Validation" of forage-node placement is referenced but the validation criteria (minimum node count? minimum spacing?) is never defined, so the regeneration trigger condition is ambiguous/unimplementable as literally written.
- **Instruction 10 (draft fallback):** Falling back to the highest authored level's weights when `currentLevel` exceeds the table is reasonable, but there's no defined behavior if `weightsByLevel` itself is missing entirely for a card (malformed data) — would this card simply never be sampled, or crash the sampler?
- **Instruction 11 (sprite slot priority):** "Priority = rarity rank" is defined for resolving slot conflicts, but no tie-break is given for two cards of the identical rarity both targeting `head` — undefined behavior on exact ties.
- **Instruction 13 (hazard fallback):** Falling back to the Spring table for an undefined season is a defined fallback, but there's no note on whether this fallback should log a warning so the authoring gap actually gets noticed and fixed rather than silently persisting.
- **Instruction 14 (save shape-check):** Defines what happens on corrupted/missing data (reinit to zero) but doesn't specify what "default-zero meta object" contains field-by-field — the shape contract is implied, not written out.
- **Instruction 18 (audio autoplay gate):** Says "gate behind the first pointerdown event," but `InputController` (instruction 6) already consumes pointerdown for game-input classification — no note on whether `AudioManager` listens independently or whether this could double-handle/interfere with input classification timing.
- **Dependency ordering:** Instruction 17 (InstinctAI) references `PlayerState.instinctMode` and filters draft-pool by a `"unique"` rarity marker, but no prior instruction (3–5) ever defines a `"unique"` designation in the card schema — instruction 3's rarity enum only lists six tiers, none named `"unique"`. This is a schema/instruction mismatch.
- **Instruction 22 (deploy):** "New site, distinct from existing TomSite Netlify project" is directionally right but never specifies how the new site is created (Netlify CLI `netlify init`? Dashboard? Which account?) — the mechanism is unspecified, which matters for a zero-mid-run-human-input constraint since some Netlify site-creation flows require interactive auth.

## Step 6: Steelman and Resolve

1. **Card balance numbers (Instr. 3).** *Defense:* This is explicitly flagged `"_balance": "placeholder"` and the plan already states real numeric tuning is a post-MVP pass; over-specifying exact weight deltas now would be false precision for values that must be playtested to set correctly anyway. *Verdict: defense holds — discard the fix.* No change; placeholder-and-flag is the correct level of rigor for build-time versus tune-time concerns.

2. **Input tie-break cold-start flick (Instr. 6).** *Defense:* A cold-start flick misclassified as swipe-instead-of-drag-then-swipe is a one-frame cosmetic difference in most cases (the dash would fire a frame earlier than "ideal"), not a functional break — swipe and drag both produce valid, intentional player actions. *Verdict: defense fails* — a swipe triggers a *dash* (a distinct verb with different game-state consequences, e.g., Evade) while a drag is *move*; misfiring a dash the player didn't intend to trigger (e.g., dashing into a hazard when they meant to start walking) is a real gameplay bug, not cosmetic. **Fix applied:** amend instruction 6 — the swipe/drag ambiguity is resolved not by a frame-lookback but by displacement-velocity: compute instantaneous velocity over the first 50ms of the gesture; if velocity exceeds a swipe-threshold px/ms from the very first sample, classify as swipe regardless of prior drag-frame history; otherwise default to drag. This removes the cold-start dependency on prior frames entirely.

3. **World-gen validation criteria undefined (Instr. 8).** *Defense:* none reasonable — an unimplementable trigger condition is a real gap. *Verdict: fix applied.* Define validation explicitly: a generated grid is valid if it contains at least 8 forage nodes and at least 1 nest zone, each at least 3 tiles apart from any other node of the same type. This is now a concrete, checkable condition.

4. **Missing weightsByLevel on a card (Instr. 10).** *Defense:* Since instruction 3 mandates every card object include `weightsByLevel` as a required field with no field ever left absent, this failure mode is prevented upstream by the schema contract, not something the sampler needs to separately guard against. *Verdict: defense holds given instruction 3's "never leave a field null or absent" rule — discard the fix*, but cross-reference added: instruction 10 now explicitly notes "this case is precluded by instruction 3's schema contract; if violated, treat as a data-authoring bug and throw a descriptive error at load time rather than silently skipping," so a genuine violation fails loud instead of silently.

5. **Sprite slot exact-rarity tie (Instr. 11).** *Defense:* With only 18 MVP cards and 2 rendered slots, the odds of two identical-rarity cards targeting the same slot in the same run are low, and the visual consequence of an arbitrary tie-break (just picking one) is minor. *Verdict: defense mostly holds, but "undefined" behavior risks nondeterministic bugs (different card each reload) which complicates debugging.* **Fix applied (lightweight):** on exact rarity tie, resolve by earliest-drafted-first (stable, deterministic, no new data needed) rather than leaving it unspecified.

6. **Hazard fallback silent (Instr. 13).** *Defense:* none — logging a warning costs nothing and directly serves catching authoring gaps. *Verdict: fix applied.* Add `console.warn('[HazardSystem] no table for season X, using Spring fallback')` guarded by dev-mode check, matching the pattern already used in instruction 11.

7. **Default-zero meta object shape unspecified (Instr. 14).** *Defense:* none — "default-zero" is genuinely ambiguous without field names. *Verdict: fix applied.* Specify explicitly: `{ sunseeds: 0, keepsakes: {}, unlockedNodes: [] }` is the canonical reinit shape, matching the three keys the shape-check itself validates against.

8. **Audio gesture-gate vs InputController conflict (Instr. 18).** *Defense:* Both listeners can coexist — DOM/Phaser pointerdown events support multiple independent subscribers with no inherent conflict; `AudioManager` merely needs to check `AudioContext.state === 'suspended'` and `.resume()` once, which doesn't consume or alter the event for `InputController`. *Verdict: defense holds — discard the fix*, but clarify in-place: add the sentence "this is a passive listener alongside InputController's, not a replacement, and does not affect input classification" to remove the ambiguity noted in Step 5 without changing behavior.

9. **`"unique"` rarity undefined but referenced by InstinctAI (Instr. 17 vs Instr. 3).** *Defense:* none — this is a genuine schema/instruction mismatch that would cause a runtime `undefined` comparison. *Verdict: fix applied.* Amend instruction 3's card schema to add a boolean field `isUnique` (default `false`) alongside `rarity`, separate from the six rarity tiers per the bible's own language ("no Unique cards" in Instinct Mode is a card-category, not a rarity-tier). Instruction 17's filter now reads `card.isUnique === true` instead of a nonexistent rarity value.

10. **Netlify site-creation mechanism unspecified (Instr. 22).** *Defense:* none — this is exactly the kind of interactive-auth dependency the workflow forbids for an autonomous run. *Verdict: fix applied.* Specify: use Netlify CLI (`netlify deploy --prod --dir=dist`) against an already-authenticated CLI session (assume prior `netlify login` has been completed once outside this run, matching how the existing TomSite pipeline already operates on this account); if the CLI reports no linked site, run `netlify init` non-interactively is not possible, so the defined fallback is to create the site via `netlify sites:create --name understory-<timestamp>` first, capture the returned site ID, then `netlify deploy --prod --dir=dist --site=<id>`. This has no interactive prompt dependency.

**Second-pass review of the fixes themselves:** The velocity-based swipe/drag fix (#2) introduces a new tunable (velocity threshold in px/ms) with no default value specified — steelmanned and resolved by setting it explicitly: `0.8 px/ms` sustained over the first 50ms, a reasonable mobile-touch flick speed, flagged `_balance: placeholder` consistent with instruction 3's precedent for tunable constants. The world-gen validation fix (#3) introduces a numeric minimum (8 forage nodes, 1 nest zone, 3-tile spacing) that itself could fail on a very small map — checked against instruction 8's fixed 40x40 grid size, which comfortably accommodates these minimums, so no further fix needed. The `isUnique` schema addition (#9) requires instruction 3's 18 placeholder cards to each get an explicit `isUnique` value rather than leaving it to the stated default — resolved by treating `false` as safe for all MVP cards except designating exactly 1 of the 18 as `isUnique: true` so the Instinct Mode exclusion path has something real to exclude and is actually exercised during playtesting per instruction 23's checklist.

## Final Resolved Autonomous Instruction Set

1. Scaffold `understory/` via `npm create vite@latest understory -- --template vanilla-ts`; fallback to manual `npm init -y` + template-matching `vite.config.ts`/`tsconfig.json` if the directory pre-exists.
2. `npm install phaser vite-plugin-pwa`; retry once after 5s on registry error; pin to `phaser@3.80.1` if `@latest` fails twice.
3. Author `src/data/cards.json`: 18 cards, fields `id, name, rarity(common|uncommon|rare|epic|legendary|mythic), isUnique(boolean, default false, exactly one card = true), weightsByLevel{"1".."10"}, effect{type,magnitude}, tradeoff{type,magnitude}, spriteSlot(head|back|tail|paws|aura|trail|none), stacking(boolean)`. Every field always present; unresolved numeric balance gets `magnitude:1` plus `"_balance":"placeholder"`. Missing `weightsByLevel` is a load-time thrown error, never silently skipped.
4. Author `src/data/animals.json`: `"dog"` entry with base stats, `xpToLevel[1..10]`, all six verb names listed, `spriteAnchors` for all six slots (even unused ones get a real `{x,y}`).
5. Author `src/data/metaTrees.json`: `"dog"` with 6 nodes (id, name, costSunseeds, prerequisiteIds, effect).
6. Build `InputController.ts`: classify tap (<200ms, <10px), swipe (instantaneous velocity ≥0.8px/ms within first 50ms, checked from the first sample regardless of prior state), hold-release (≥400ms), else drag (continuous while down).
7. Build `MovementSystem.ts` consuming drag vectors, clamped to world bounds.
8. Build `WorldGenSystem.ts`: fixed 40x40 grid; valid iff ≥8 forage nodes and ≥1 nest zone, each ≥3 tiles from same-type neighbors; regenerate once on failure, then fall back to `src/data/fallback-layout.json` (create this static known-good layout as part of this instruction).
9. Build `VerbSystem.ts`: Forage/Nest/Befriend/Evade/Migrate off classified input + world entities; Explore satisfied by fog-reveal in (8).
10. Build `DraftSystem.ts`: weighted sample of 3 without replacement; missing-table case precluded by (3)'s contract and throws loudly if violated; level-overflow uses highest authored level; Instinct Mode filters out `isUnique === true` cards.
11. Build `SpriteComposer.ts`: render `head`/`back` slots only at MVP; conflict resolution by rarity rank, exact-rarity ties resolved by earliest-drafted-first; other four slots computed and dev-mode-logged only.
12. Build `SeasonSystem.ts`: four equal-length season windows across the 10–15 min run timer.
13. Build `HazardSystem.ts`: per-season spawn tables; undefined season falls back to Spring table and emits a dev-mode `console.warn`.
14. Build `SaveManager.ts`: localStorage key `understory:meta:v1`; corrupted/missing data reinitializes to exactly `{ sunseeds: 0, keepsakes: {}, unlockedNodes: [] }`.
15. Build `RunStats.ts` with the 10 named MVP fields including `perCardStats` map.
16. Build `LifeStoryScene.ts`: render all `RunStats` fields; render explicit "No cards drafted this run" row when `perCardStats` is empty.
17. Build `InstinctAI.ts`: priority-order forage→explore→evade→wander at ~500ms cadence; 0.6× XP multiplier; excludes `isUnique` cards via (10).
18. Build `AudioManager.ts`: procedural ambient pad + synthesized blips; resume `AudioContext` on first pointerdown as a passive listener alongside `InputController`, not replacing or altering its classification.
19. Add `public/manifest.json` (portrait, standalone, two icon sizes) and configure `vite-plugin-pwa` with `autoUpdate`.
20. Add `netlify.toml`: `command = "npm run build"`, `publish = "dist"`.
21. Run `npm run build`; on TypeScript error, add `"resolveJsonModule": true` to `tsconfig.json` if that's the cause, fix, rebuild; repeat until `dist/` exists.
22. Deploy via authenticated Netlify CLI: `netlify deploy --prod --dir=dist`; if no linked site, run `netlify sites:create --name understory-<timestamp>` first, capture site ID, then `netlify deploy --prod --dir=dist --site=<id>`. After deploy, `curl -I` the live URL root and confirm 200; on 404, check publish-dir config and redeploy.
23. Write `docs/playtest-checklist.md` per the six checks listed in Step 4 instruction 23, including confirming the single `isUnique` card is excluded from a live Instinct Mode run's draft pool.
24. Write `docs/capacitor-wrap-notes.md` documenting the deferred Capacitor wrap steps as a future, not-executed-now, next action.
