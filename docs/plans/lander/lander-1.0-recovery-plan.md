# Moon Lander rebuild: regression review and recovery plan

**Date:** September 5, 2026<br>
**Status:** Review and plan only. No game changes made in this review.<br>
**Reviewed:** Commit `b477971` (`Rebuild Moon Lander release path`) plus the current working tree.<br>
**Audience:** Luna 5.6 or the next implementing agent.

## 1. Verdict

The current `/game` is an incomplete replacement that was promoted before it met the original plan's acceptance gates. The reported phone sizing, small background, and bad flight feel have concrete, reproducible causes. They are not inherent PixiJS limitations.

**Recovery order: restore a playable default, repair screen composition, restore the original flight response, recover missing gameplay, then improve the artwork.** Keep Pixi available for the eventual presentation upgrade. Do not attempt another engine switch or another full rewrite.

The legacy runtime is the behavioral reference. The new runtime must earn its place as the default through direct comparisons; the presence of files, catalog entries, or passing legacy tests is insufficient.

This document supersedes the original rebuild plan's implementation order and its one-size logical-world suggestion. The long-term graphics goal remains valid, but release recovery comes first.

## 2. What I verified

### Browser evidence

I started the local Astro background server and inspected `/game` and `/game-legacy` in the in-app browser. These are desktop browser viewport tests, **not physical iPhone or Android tests**, and not confirmation of what is currently deployed remotely.

| Scenario | Observed result |
| --- | --- |
| Rebuild at 390 × 844 CSS pixels | Play viewport only **326 × 202.12**, starting around y=274.72 before interaction |
| Legacy at the same 390 × 844 | Canvas **390 × 566**, starting around y=91.73 |
| Relative playable area | Rebuild has approximately **30%** of the legacy canvas area |
| Rebuild title at 390 × 844 | Title panel about **591.92 px** high inside an overlay with only **200 px** visible height and **624 px** scroll height |
| Phone after Start | Instruments and touch buttons overlap; ship is extremely small; artwork occupies upper-left portion only |
| Rebuild at 1440 × 900 | Scene approximately **1072 × 664.63**; background ends at the horizontal and vertical midpoint, leaving most of the scene dark |
| Desktop flight appearance | Primitive ship and flat ground do not visually integrate with the detailed backdrop |

The phone Start button exists but sits down inside the tiny overlay's scroll area. Automation can scroll it into view, which does not make this acceptable for a person opening the game.

### Code and test evidence

- Read the new renderer, flight model, input, generation, session, saves, progression, screens, HUD, audio, tests, and build-status document.
- Compared them with current legacy flight equations, generation, responsive sizing, upgrade behavior, and save formats.
- Ran `./node_modules/.bin/vitest run src/scripts/lander-next/__tests__`: **6 tests passed across 3 files**.
- Those tests cover a small set of generation/offer repeatability, collision, and landing cases. They do not cover responsive layout, steering parity, full upgrade behavior, saves, pause flows, or mount cleanup.
- Calculated steering response by reproducing the two current equations at 120 Hz, with no upgrades, 0.5 seconds holding right from rest, then 1 second released. This is an isolated numerical comparison, not a full interactive flight benchmark.

No game source was edited and no deployment was performed. Existing unrelated working-tree changes must remain intact.

## 3. Root causes, with source pointers

### R1 — The phone layout discarded the working mobile design

**Files:** `src/pages/game.astro:31–38,71–76`; `src/layouts/Layout.astro:176`; `src/scripts/lander-next/presentation/renderer.ts:20`.

The site already supplies a padded content container. The replacement adds another padded page wrapper and a large heading before the game. It then uses `aspect-ratio: 1000 / 620` at every breakpoint. The phone media query changes instruments and cards but never gives the game a portrait-sized viewport.

The renderer scales the entire 1000-unit world down to that width. At the measured phone width, the 36-unit hull is approximately **11.6 CSS pixels wide**, before its outline. A 72-pixel thrust button shares a scene only 200 pixels tall.

The HUD also uses `inset` on all four sides. On phone it becomes a two-row grid stretched across almost the entire canvas; row distribution pushes the vitals toward the controls. Changing font sizes alone will not repair this composition.

**Result:** less usable space, hidden primary actions, an unreadable ship, and controls competing with instruments and landing terrain.

### R2 — The background is anchored to the wrong position

**File:** `src/scripts/lander-next/presentation/renderer.ts:17,20`.

The sprite has `anchor.set(0.5)` but no position. Its center therefore remains at `(0,0)`. Width and height become 1000 × 620, so its bounds are `[-500,500] × [-310,310]`. Only its bottom-right quarter intersects the positive world viewport. This explains the top-left rectangle in the screenshot.

The source image is 1536 × 1024, but the code independently assigns a 1000 × 620 size, distorting its aspect ratio as well. Fixing the anchor alone repairs coverage positioning, not that distortion or the mismatch between painted ground and collision ground.

Pixi anchors, positions, and size/scale have distinct roles. The official examples explicitly set both anchor and position. [Pixi sprite documentation](https://pixijs.com/8.x/guides/components/scene-objects/sprite)

### R3 — It replaced the flight model instead of preserving it

**New sources:** `simulation/flight.ts:14–25`, `content/balance.ts`, `content/generation.ts`.<br>
**Reference sources:** `src/scripts/lander/main.ts:1240–1325`, `physics.ts`, `stats.ts`, `levels.ts`.

| Behavior | Current legacy | Rebuild | Consequence |
| --- | --- | --- | --- |
| Rotation | Target angular velocity `±2.6 × rotMult`; response 18 while turning, 24 while settling | Add angular acceleration `3.4 × rotMult`, damp by `0.06^dt` | Much slower turn-in and much longer coasting |
| 0.5 s right turn from rest | **66.81°** rotation | **16.07°** rotation | Only about one-quarter the angular displacement in this reference input |
| Additional rotation during 1 s after release | **5.61°** | **17.06°** | Roughly triple the unwanted coast despite the slower turn |
| Pilot first-level gravity | **55** | **83.476** | Approximately 52% stronger downward acceleration |
| Full upright net upward acceleration, base ship | **103** | **74.524** | Approximately 28% less braking authority after full throttle is reached |
| Throttle | 60 ms rise, 40 ms fall | Instant binary thrust | Removes the original short, deliberate response |
| Fuel consumption at full thrust | **22/s** | **16/s** | Changes resource balance without a documented decision |
| Initial wind | Zero for the first two levels | Positive from the first level | Removes the calm introduction |
| Wind coupling | Wind × multiplier × area / mass, including gust behavior | Wind × multiplier | Drag-area and mass tradeoffs no longer behave correctly |
| Input update ordering | Rotation updated before thrust direction | Thrust computed before rotation update | Additional behavioral mismatch |
| Edge behavior | Legacy boundary response and upgrade hooks | Clamp x to `[22,978]` without resolving outward velocity | Ship can stick at an edge while velocity accumulates |

Importing `computeStats()` preserves some numbers, but does not preserve the systems those numbers controlled. There is no evidence that the rewritten flight model was compared with the baseline before cutover.

### R4 — Visual and audio feedback no longer describe the craft

**Files:** `presentation/renderer.ts:23,28–29`; `platform/audio.ts`; `index.ts`.

- The ship rotates, but its flame is drawn in a separate world-space graphics layer at `(x, y + 30)` with a vertical ellipse. It does not rotate with the nozzle. Tilting the craft no longer gives trustworthy propulsion feedback.
- Continuous engine sound is gone. The new mixer emits a short thrust cue when Start runs, rather than starting/stopping and modulating an engine loop from actual thrust.
- The detailed modular ship, expressive pilot, attachments, and cosmetic presentation were replaced with a small rounded rectangle and a dot.
- Terrain and ship vector paths are rebuilt each frame; there are no actual textured terrain meshes, production ship atlas, or layered parallax worlds.
- The background contains apparent solid terrain that is unrelated to the collision contour. Enlarging it must not make decorative rock look like a second playable floor.

The new image asset is useful source material. Its existence does not establish that the vertical slice reached the visual target.

### R5 — The roguelite is materially incomplete

**Files:** `simulation/step.ts`, `flight.ts`, `progression.ts`, `core/state.ts`, `content/generation.ts`, `ui/screens.ts`.

- Hazards are generated and drawn but are not advanced or collided with in the simulation step.
- Pads receive a nonzero `vx` after early levels but their positions are never advanced. Landing evaluates velocity relative to a pad that visually remains stationary.
- Active abilities, shields, companions, projectiles, noodles, terraforming, and many other upgrade systems are not wired into the new loop.
- Offers sample uniformly and usually exclude owned upgrades. This removes rarity weighting and practical stacking. Offers always contain three cards, ignoring extra choices.
- Skip reward changed from 15 to 8 without justification.
- The hangar displays catalog counts, not a working shop or equip interface. Flight school is a text list, not three playable lessons.
- The HUD never computes the live shared landing-readiness rule; status remains APPROACH during normal flight.
- The landing evaluator applies new difficulty modifiers to tolerances already modified by legacy `computeStats()`, producing double difficulty scaling. It changes threshold equality from unsafe (`>=`) to safe (`>`), and can report “controlled touchdown” for an off-pad crash.
- Collision uses 32 samples plus refinement. This is better sampling, but still not exact earliest intersection against every crossed terrain segment as required by the original plan.

**Result:** a catalog with 69 names gives a false impression of gameplay completeness. Some upgrades impose their cost while their advertised benefit has no executing system.

### R6 — Lifecycle, progression, and saves need recovery work too

**Files:** `src/pages/game.astro:22–27`; `src/scripts/lander-next/index.ts`, `platform/saves.ts`, `platform/input.ts`.

| Finding | Evidence and implication |
| --- | --- |
| Returned cleanup is ignored | Page calls `void mountLander(root)` despite Astro ClientRouter navigation; old RAF/input/audio instances can survive route changes |
| Cleanup itself is incomplete | Registered window blur handler is not removed on normal destroy; initialization failure removes only a subset of handlers |
| Paused clock can stay paused | Quit/settings lead to title; Start/Retry call `beginDescent()` without resuming the clock |
| Retry preserves the run | Crash Retry restarts the same level with upgrades and score; does not restore the original run-death semantics |
| Continue can use stale data | Checkpoint is loaded once into a constant; later Start reads that original snapshot |
| Checkpoints never invalidated by the runtime | `clearCheckpoint()` exists but is not called; death/new-run policy is undefined |
| Settings are display-only | Checkbox UI is inserted, but no change handler connects it to preferences or audio |
| Keyboard input is global | Prevents game keys even in unrelated UI/text entry; ArrowUp/W thrust behavior from legacy is missing; both-turn resolves rotation to left instead of cancelling |
| Save import is incomplete | Legacy cosmetic ownership, equipped IDs, achievements, pilot/audio/touch preferences are not actually migrated |
| Cosmetic identity changed | New defaults like `cream`/`dust` replace `paint_classic`/`trail_ember`; no complete identity map |
| Loaded data loses fields | Saved equipped cosmetics and preferences are not restored; achievement validation uses an empty allowed-ID list |
| Checkpoint validation is partial | Difficulty, score, currency, and integer bounds are insufficiently checked; rewardRevision is stored but never used to prevent replayed rewards |

Legacy storage keys remain, so this is a migration correctness failure, not evidence that the legacy data was permanently deleted. Do not erase either save namespace while repairing it.

## 4. How the work went wrong

### Implementation failure

The build-status document describes M0/M1/M2 and parts of M6/M7 as completed or release-candidate work, while explicitly stating that browser/device QA was not run, performance was not measured, and upgrade parity remained in progress. It switched `/game` anyway. Its own notes even say the new leaderboard is needed “before public cutover,” after stating that cutover already happened.

The milestone gates were treated as a list of modules to create, rather than results to demonstrate. Six new domain tests and the old suite could not detect a 202-pixel phone viewport, a quarter-visible background, or new steering equations. Counts of cosmetics and upgrades were mistaken for implemented features.

### Weaknesses in my original plan

The original plan did require legacy-feel preservation, device testing, a finished vertical slice, and no cutover before gates passed. The implementation did not satisfy those instructions. But the plan also gave the builder too much room to make the wrong choices:

1. It presented a very large end-to-end rebuild when the first deliverable should have been a tightly bounded **phone/laptop layout and flight-parity demonstration**.
2. It offered 1000 × 620 as an example logical world and left portrait behavior to camera/letterboxing judgment. That was too easy to convert into a fixed landscape canvas everywhere.
3. It said “preserve feel” without supplying the exact response curves and numerical reference gestures now documented above.
4. It made art quality sound concrete through an extensive asset list, but did not put an immediately visible before/after proof next to each early milestone.

The correction is a smaller recovery sequence with numerical fixtures, device-sized screenshots, and an executable cutover checklist. Do not try to repair this failure by writing another aspirational engine roadmap.

## 5. Recovery decision: preserve behavior, replace presentation gradually

**Recommended first implementation action:** make `/game` serve the current working legacy experience again, and move the incomplete new runtime to `/game-next` with a clear development label. Keep both implementations and all saves intact. This is a proposed action for a later implementation request, not a change performed in this review.

Use the current `game-legacy.astro` and current working-tree legacy modules as the reference. Do not blindly restore an old Git version: `main.ts` and `stats.ts` have existing uncommitted improvements that must not be lost.

Recover Pixi incrementally around the known gameplay. Extract/adapt the existing equations and systems with behavioral tests. Do not keep the simplified flight implementation merely because it is smaller or cleaner. Do not mix two competing simulations in a single running game.

While feature migration is incomplete, prototype offers must be restricted to fully functional upgrades and clearly marked as a development subset. The finished replacement still must preserve the full catalog; reducing the production catalog is not the recovery strategy.

## 6. Fix specification

### A. Phone and laptop composition

**Primary files:** `game.astro`/new `game-next.astro`, scoped game styles, renderer viewport mapping, world/session creation.

1. Remove nested mobile page gutters for the game region. Keep the site's normal layout elsewhere. Reuse the legacy full-width mobile treatment.
2. Collapse/move the redundant large page heading below the game on phones. The game should start just under the navigation, as legacy does.
3. Give phone portrait a real height based on available visual viewport, not a landscape aspect ratio. Starting target: 390 × roughly 560–650 CSS pixels at 390 × 844, adjusted for actual nav/safe areas. At that size, the stage should be at least 520 px tall and within 8 px of viewport width.
4. Keep laptop landscape composition, but cap height to available viewport so controls and pad remain reachable without page scrolling during flight. Do not blindly combine a minimum height and aspect ratio that overflows shorter laptops.
5. Top-anchor a compact HUD with explicit content-sized rows (`bottom:auto`, appropriate `align-content`), rather than stretching its grid across the canvas. Keep touch controls in a separate safe bottom zone.
6. Group left/right rotation together at bottom-left, thrust at bottom-right; restore the classic alternate layout. Use at least 48 × 48 px touch targets and safe-area padding. Hide touch controls on ordinary fine-pointer desktop by default, while supporting touch-enabled laptops.
7. On phone, put Start/Continue and Retry high in a compact menu. Long hangar/upgrade content gets a properly sized scrollable sheet with an always-reachable close/back action. Do not fit 592 px of primary-menu content into 200 px.
8. Maintain visible ship, pad, and immediate landing corridor outside control occlusion. Do not fix HUD overlap by shrinking every label below legibility.

#### Resolve the world-size conflict explicitly

One fixed world for all devices is no longer a requirement. **Fixed during a run** is the important invariant.

Preferred recovery approach: choose a named logical layout profile at new-run creation—initial candidates are portrait 420 × 640 and landscape 1000 × 620—then freeze that geometry for the run. Calibrate these against legacy at representative phone/laptop sizes before locking them. Use the same equations, units, and difficulty logic; adapt spawn/pad ranges to the profile, not hard-coded x=210/x≈690 or bounds 978.

Store the profile in seed/replay/checkpoint identity. Different profiles may generate different terrain and routes, as the legacy viewport-sized game did. Do not claim cross-profile scores are identical challenges; initially use separate local records and defer new online rankings until the rule is settled.

During address-bar resizing, keyboard appearance, or rotation, change only viewport/camera presentation. Never regenerate active terrain. If a dramatic rotation cannot preserve legibility, pause with a clear orientation/continue option; resume the same state, or let the player explicitly start a new run in the other profile. Portrait must work without requiring landscape rotation.

Do not just make CSS taller while retaining `min(width/1000,height/620)`: that still makes the world and ship tiny inside a taller black rectangle.

**Acceptance:** full ship silhouette at least 36 CSS pixels wide at 360/390-pixel portrait widths, aiming to match the current legacy craft; pad and hazards similarly legible. This is a presentation target to reconcile with the legacy collider and profile calibration, not permission to invisibly change collision geometry.

### B. Background coverage and coherent graphics

**Primary file:** `presentation/renderer.ts`, then separate background/ship view modules as needed.

- Correct the centered sprite's position. In a world-space backdrop, center at `(worldWidth/2, worldHeight/2)`; in a viewport backdrop, center at the viewport midpoint outside the gameplay camera container.
- Preserve aspect ratio with a uniform cover scale: `max(targetWidth/textureWidth, targetHeight/textureHeight)`. Mask the layer to its target. Never independently force arbitrary width and height ratios.
- For the recovery slice, a viewport-space backdrop is simplest: it always covers the stage and is independent of simulation coordinates. Later parallax layers can have explicit camera coupling.
- Review portrait cropping; add a portrait composition if cover cropping eliminates the useful sky/landscape. Do not stretch the source to fit.
- Use only distant non-collidable visual forms behind the actual terrain, and distinguish them in contrast and depth. Build playable terrain from the authoritative polyline, then give it texture that follows that surface.
- Parent plume/nozzle effects to the interpolated ship transform, or rotate both their origin and direction using the same pose. At a 45° tilt, thrust feedback must clearly leave the nozzle along the opposite acceleration direction.
- Restore the recognizable pilot, leg stance, and upgrade silhouettes before adding post-processing. Reusing/rasterizing parts of the existing illustrated ship as an intermediate GPU asset is acceptable; a rounded rectangle is not the final craft.
- Add proper continuous engine feedback linked to thrust state. Reuse legacy sound behavior before attempting a new soundtrack.

**Acceptance:** no unintended blank quadrants at any target size; no image distortion; one unambiguous collision ground; craft/exhaust alignment at 0°, ±45°, and 90°; readable approach with effects on and off.

### C. Restore flight feel using the exact reference

**Primary files:** `simulation/flight.ts`, `core/state.ts`, `content/balance.ts`, `generation.ts`, `platform/input.ts`.

Restore the current legacy target-angular-velocity model, response rates, normalized angle, throttle ramp, gravity progression, early wind schedule, mass/area coupling, fuel burn, boundary response, and input ordering. Use an adapter if state names differ. Remove duplicate difficulty scaling and use the existing authoritative landing evaluator until an intentional change is separately tested.

Reference turn formula:

```ts
targetOmega = (rightHeld - leftHeld) * 2.6 * stats.rotMult;
response = targetOmega === 0 ? 24 : 18;
omega += (targetOmega - omega) * (1 - Math.exp(-response * worldDt));
angle = normalizeAngle(angle + clampRotationDelta(omega * worldDt));
```

Reference throttle: rise over 0.06 seconds, fall over 0.04 seconds; acceleration is scaled by throttle; full-throttle fuel consumption is 22 × burn multiplier per unscaled gameplay second. Preserve exceptions and slow-time behavior from the actual legacy systems.

Initial fixtures must include:

- Right/left held for 0.1, 0.25, 0.5, and 1 second, then released; opposing input and reversal.
- No-input fall, brief braking pulse, sustained vertical thrust, and angled thrust.
- Identical test state, difficulty, upgrades, fixed timestep, and input sequence in reference and adapted model.
- Expected state within numerical tolerance for pure parity extraction; the 0.5-second reference gesture should reproduce ~66.81° and ~5.61° coast, not a newly chosen “close enough” curve.
- 30/60/120 Hz rendering does not change simulation outcome; shortest-arc angle interpolation is used.

Only after parity passes should a player-approved tuning change be considered. Do not fix the sluggish rotation by multiplying the new acceleration constant until it seems better: that does not restore release/reversal behavior.

### D. Restore working game systems and honest UI

- Port the executing legacy hazard, moving-pad, ability, survival, companion, noodle, and terrain systems. Catalog aliases alone do not count.
- Restore weighted offers, stacking, extra choices, skip reward, and upgrade effect previews computed from real state.
- Keep the current legacy difficulty selection, bests, hangar/equip, achievements, touch layouts, and optional selfie reachable on the default route during migration.
- Remove false “three lessons” and available-shop claims from the prototype until those interactions exist. Do not remove functioning legacy features from `/game` to make the prototype appear complete.
- Use actual landing evaluation for HUD guidance and crash reasons, including off-pad and relative motion.
- Align rendered feet/pad and collider offsets; the current feet extend to y+24 while collision offset is 18. Decide the physical geometry explicitly and test contact visually.
- Replace sampled terrain sweeping with segment intersection/shape sweeps if it is to claim exact first-contact behavior; include sub-sample-width ridge cases.

### E. Repair state, input, saves, and lifecycle

- One lifecycle owner mounts and destroys the game for Astro navigation. Handle cancellation during async renderer/asset initialization. Remove every handler, observer, RAF, audio node, and camera stream on all exits.
- Start new run, Continue, Retry new run, practice retry, pause/resume, and quit are distinct transitions with explicit clock/input behavior. Normal roguelite death ends the run; practice may retry a descent separately.
- Resume/reset the clock on every path returning to active flight. Preserve the paused context through Settings instead of redirecting unexpectedly to title.
- Read current checkpoints when Continue is selected, validate every field, and define invalidation on death/new-run. Never silently reuse an initial stale snapshot.
- Recover profile/cosmetic/achievement identity from legacy keys with a complete mapping. Prefer retaining legacy IDs rather than renaming them. Preserve any newer earned currency with an explicit reconciliation rule; do not choose a strategy that can multiply rewards.
- Keep originals untouched during repair. Version migration and store failures explicitly; do not auto-overwrite partially recoverable saves on a failed parse.
- Connect settings controls to actual runtime behavior and persistent preferences.
- Track keyboard and pointer ownership separately; handle lost capture/cancel, both directions, ArrowUp/W/Space, active-ability controls, and focus in text fields. A release from one pointer must not clear another held input incorrectly.

## 7. Small, gated execution sequence

Each step is a separate reviewable change. Update the build-status document with evidence and correct its release-candidate designation. Do not mark the whole milestone complete because one subcomponent exists.

| Step | Deliverable | Must pass before advancing |
| --- | --- | --- |
| P0 — Restore default | Legacy at `/game`; prototype retained at `/game-next`; no save deletion | Phone and laptop legacy play still work; route navigation does not double-mount |
| P1 — Layout and background | Actual portrait viewport, compact controls/menus, corrected background transform | Screenshots and DOM measurements at the dimensions below; Start/Retry reachable without hunting; no HUD/control overlap |
| P2 — Flight parity | Exact current legacy flight behavior in the new runtime; aligned plume and engine sound | Numerical reference gestures and direct legacy/new play comparison |
| P3 — Runtime reliability | Correct start/continue/retry/pause/settings, cleanup, input ownership, save migration | State-transition, storage-fixture, navigation, and simultaneous-touch tests |
| P4 — Gameplay restoration | Actual effect systems and weighted/stackable offers; working progression/UI | Every production-offered upgrade has behavior evidence; all full-release parity gates complete |
| P5 — Visual improvement | Integrated ship, terrain, atmosphere and cosmetic assets, added incrementally | Side-by-side screenshots and play review show a real improvement over legacy without reduced legibility |
| P6 — Candidate evaluation | Fully tested prototype ready for user evaluation | Device/performance matrix, no critical regressions, complete feature parity; user confirms handling on their phone and laptop before replacing the default again |

The P6 user evaluation is a deliberate response to the reported subjective handling failure. It is not a permission prompt required after every routine local edit. Continue independent implementation while any evaluation is pending; leave the known playable default in place.

## 8. Acceptance matrix

### Layout and interaction

| Test size | Required result |
| --- | --- |
| 390 × 844 portrait | Stage near full width, height ≥520 px, top ≤120 px in default page state; primary Start visible; ship/pad readable |
| 360 × 800 portrait | Same composition without horizontal page overflow; full ship silhouette ≥36 px; controls ≥48 px |
| 320 × 568 compact | A deliberate compact layout; essential controls/primary actions reachable, no clipped menus; report any needed orientation choice honestly |
| 844 × 390 landscape | Viewport-aware compact chrome; controls and landing region visible without scrolling midflight |
| 1366 × 768 laptop | Complete scene coverage; readable craft; no unwanted touch-control clutter; game fits available flight area |
| 1440 × 900 laptop | No quarter-image background; visually coherent ground, craft and atmosphere |

Measure HUD child bounds and control bounds, not the transparent wrapper alone. Check the entire flight path and pad region; a single title screenshot cannot validate playability.

### Behavioral regressions

- Pure flight reference tests plus human input comparison; no surprise gravity/rotation/fuel changes.
- Both directions held cancel normal turning while preserving defined upgrade gestures.
- Settings → back → resume, pause → quit → new run, death → retry, and new checkpoint → Continue all advance correctly.
- New-run and death handling do not resurrect stale progression or duplicate rewards.
- Actual moving pads move; actual hazards collide; survival upgrades prevent the correct impacts and consume charges.
- Upgrade weighting/stacking tests, real catalog effect tests, and migration tests run against the new runtime.
- Repeated route navigation produces one active game instance, one input controller, and one engine audio loop.

### Physical-device and performance gate

Test on the user's phone/browser when available and a representative laptop. Record device, browser version, build, viewport, and result. Viewport emulation is useful evidence but cannot certify touch comfort, mobile GPU behavior, audio unlock, or thermal performance.

Aim for sustained 60 FPS on the target laptop and suitable recent phones; low-tier fallback may target stable 30 FPS with unchanged simulation. Profile after core repairs. Do not expand shader/particle complexity until the existing corrected scene has measured headroom.

## 9. What not to do

- Do not switch engines to solve a sprite-position or CSS-layout bug.
- Do not add bloom, more backgrounds, or more upgrade cards before restoring playability.
- Do not shrink the entire landscape world into a portrait phone and call it responsive.
- Do not claim “69 upgrades supported” because the legacy array is imported.
- Do not use passing legacy tests as proof that the new flight model is equivalent.
- Do not erase profiles/checkpoints to hide migration defects.
- Do not return to `/game` as default while browser checks remain “not run.”
- Do not commit unrelated working-tree modifications or restore deleted unrelated projects.

## 10. Builder handoff

> Repair Moon Lander using `docs/plans/lander/lander-1.0-recovery-plan.md`. The current Pixi replacement regressed mobile layout, background placement, flight feel, gameplay completeness, and runtime reliability. Follow P0–P6 in order. Preserve current legacy behavior and all existing user work/saves. Restore the known playable default first and keep the replacement on a development route. Fix measured viewport composition and background transforms, then port the exact current legacy steering/throttle/flight equations with numerical parity fixtures. Do not add another engine or retune by guesswork. Recover executing gameplay systems, not just catalog names. Record screenshots, measured layout, tests, actual device evidence, and remaining gaps. Keep the default playable while the user evaluates the repaired prototype on phone and laptop. Do not deploy without a deployment instruction.

## References

- [Original rebuild plan](./lander-1.0-rebuild-plan.md) — intended scope and gates; recovery decisions above take precedence.
- [Existing build status](./lander-1.0-build-status.md) — evidence of early cutover and acknowledged omissions.
- [New game page](../../../src/pages/game.astro), [renderer](../../../src/scripts/lander-next/presentation/renderer.ts), [flight model](../../../src/scripts/lander-next/simulation/flight.ts).
- [Legacy page](../../../src/pages/game-legacy.astro), [legacy game coordinator](../../../src/scripts/lander/main.ts), [legacy physics](../../../src/scripts/lander/physics.ts).
- [Pixi sprite documentation](https://pixijs.com/8.x/guides/components/scene-objects/sprite) — anchor, position, dimensions and scale.
- [Astro styling guidance](https://docs.astro.build/en/guides/styling/) — consult before adjusting the route's CSS and shared layout integration.

**Review outcome:** The regressions are explainable and recoverable. No recovery implementation is claimed by this document.
