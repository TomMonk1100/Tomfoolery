# Understory — Playtest Checklist (MVP vertical slice)

Run through this on a real touch device (portrait) after each deploy.

## Core loop
- [ ] A full run completes start-to-finish (Spring → Winter → Life Story).
- [ ] Drag anywhere establishes the floating joystick and moves the Dog.
- [ ] Tap on/near a forage node harvests it (XP + counter increments, blip plays).
- [ ] Hold-and-release near a target triggers a Focus Action (Befriend) with a timing accuracy.
- [ ] Quick swipe performs a dash / Evade.
- [ ] Explore reveals fog-of-war tiles as you move.
- [ ] Nest action fires at a nest zone.
- [ ] Migrate bonus fires at a season boundary.
- [ ] All six verbs reachable at least once in a single run.

## Draft & cards
- [ ] Level-up pauses the world and raises a 3-card fan.
- [ ] Rarity borders are visually distinct (common → mythic).
- [ ] Across ~3 runs, at least one card of each rarity tier is seen.
- [ ] Skip grants a partial XP refund (less than taking a card).
- [ ] The single `isUnique` card (The Second Spring) can appear in normal play…
- [ ] …and is EXCLUDED from the draft pool during an Instinct Mode run.
- [ ] Pity: after 4 drafts with no Epic+, the 5th shows an Epic-or-above slot.

## Visual evolution
- [ ] Drafting a `head`/`back` card visibly changes the Dog sprite.
- [ ] Stacking the same card intensifies the attachment.

## Seasons & hazards
- [ ] Palette/mood shifts at each season boundary.
- [ ] Hazards appear and can be evaded; a hit costs Vitality, never ends the run.

## Meta & persistence
- [ ] Life Story shows Stats + Card Value Breakdown with no `NaN`/`undefined`.
- [ ] "No cards drafted this run" appears if a run ends at level 1.
- [ ] Sunseeds are credited and persist across a hard page reload.
- [ ] Meta hub node unlocks spend Sunseeds and stay unlocked after reload.

## Instinct Mode
- [ ] Toggle on the hub; a run completes unattended within ~15 min wall-clock.
- [ ] XP is visibly reduced (0.6×) vs active play.

## PWA
- [ ] "Add to Home Screen" installs; launches standalone in portrait.
- [ ] Loads offline after first visit (service worker precache).

## Update 2 — "Wild Kit" (verified live on understory-life.netlify.app, 2026-07-05)

Verified via headless playtest through the Claude-in-Chrome MCP, driving
`window.__understory` (the Phaser game instance) directly — `game.step(t, deltaMs)`
to fast-forward simulated time, and the context/scene APIs to inspect state,
since the sandboxed browser tab throttles real-time rAF when backgrounded.

- [x] Distinct starter attacks: Dog ring, Cat cone, Rabbit line-both
      (Scissor Kick) all fire and render their own shape.
- [x] Every weapon (incl. zone/trail types) renders a real visual — audited
      in WeaponSystem.ts, no silent no-op fire methods left.
- [x] Neutral weapon/passive pool (7 weapons + 4 passives, `animal: "any"`)
      draftable by every species; verified `laser-pointer` card data present
      with nonzero draft weight at all levels 1–20.
- [x] Seamless ground texture (no checkerboard tiles) confirmed visually in
      live screenshots.
- [x] World wraps Pac-Man style at every edge — confirmed programmatically:
      walked the player past x=1536 (world width) and position wrapped to
      x≈30 in the same move.
- [x] No NaN state: checked player hp/maxHp/xp/position after a multi-minute
      instinct run — all finite.
- [ ] **Kills > 50 in 2 min, instinct-mode Cat: NOT MET.** A clean 2-minute
      fast-forwarded instinct run (fresh start, no manual interference)
      reached **27 kills** by the 2:00 mark, level 4, hp stable at 27/100
      (survival-kiting below the 35% hp threshold cut into the back half of
      the run). This is a balance/tuning gap, not a crash — likely Cat's
      single-target cone weapon (Pounce Slash) plus the SURVIVE-mode kiting
      threshold combining to reduce effective DPS uptime. Left as a known
      follow-up; did not retune damage numbers without a full balance-sim
      re-run per CONTRACTS.md.

### Bugs found and fixed during this playtest
1. **Production crash on run start** (`WorldGenSystem.ensureConnectivity`
   TypeError): `src/data/fallback-layout.json` was still the pre-Update-2
   40×40 grid while `WORLD_SIZE` is now 48, and the procedural generator's
   strict validation rejects most random layouts, so production was
   silently falling back to the stale 40×40 file on nearly every run,
   crashing on load. Fixed by regenerating the fallback file as a proper
   48×48 grid and making `ensureConnectivity()` bounds-safe regardless.
2. **Instinct AI stalling at the world seam**: `InstinctAI.ts` turned
   `instinctBrain.ts`'s chosen target into a movement vector with a plain
   (non-wrap-aware) subtraction, so whenever the AI's target was on the far
   side of the seam it steered toward the world edge instead of through it,
   stalling combat (kill count and hp frozen for 30+ real seconds in
   testing). Fixed by routing the final steering vector through
   `wrapDeltaVec` so it always takes the shorter, wrapped path.
3. Both fixes verified live post-redeploy: fresh instinct run no longer
   crashes or stalls at the seam; kill count climbs steadily throughout.

### Update 3 Phase 4 — cat kill-rate lever applied (2026-07-07)

- **Applied the plan's "first lever"**: widened `pounce-slash.arcDeg` from
  90° to 150° (`src/data/weapons.json`). Per-level damage/cooldown/area were
  left untouched — arcDeg only changes how many enemies a single swing's
  cone catches, so it raises pack throughput without moving the L1 DPS band
  `tests/content.test.ts` already pins (5–9 DPS).
- **Could not verify live.** This session has no browser/JS-execution tool
  available (the headless-playtest technique in plan §10 needs
  `window.__understory` in a real page) — see docs/update-3-deviations.md
  #22. The ≥50 kills/2min target from Gate 4 is therefore **unverified**,
  not confirmed. Recommend a follow-up live playtest (the technique in §10
  still applies) before treating the cat kill-rate gap as closed.

### Update 3 deploy verification (2026-07-07)

- **Deploy method changed from the plan's default.** Netlify's remote
  `npm run build` failed 3x with no accessible log (see
  docs/update-3-deviations.md #24); the identical source built cleanly every
  time in this session's own sandbox. Worked around by building locally and
  deploying the verified `dist/` output directly (no remote build step).
- [x] Deploy permalink `https://6a4d5d7ad03ea25991ef733c--understory-life.netlify.app`
      → 200, `<title>Understory</title>`.
- [x] Production `https://understory-life.netlify.app` → 200, same title.
- [x] JS bundle (`/assets/index-Db0gOdLu.js`) → 200, reachable.
- [ ] **In-browser gameplay verification: NOT DONE.** No browser/JS-execution
      tool was available this session (see docs/update-3-deviations.md
      #22/#23/#26) — branching evolutions, fusions, codex discovery,
      shadows/season-ambience/postFX, and the cat kill-rate fix are all
      unverified live. Recommend a live playtest (plan §10's
      `window.__understory` technique) before treating Update 3 as fully
      shipped.
- **Follow-up for Adam**: `netlify.toml` still specifies a remote build
  (`npm run build`); the next deploy through the normal flow may hit the
  same unexplained failure. The Netlify dashboard's build log (not
  accessible through this session's tools) is the fastest way to diagnose
  it if it recurs.
