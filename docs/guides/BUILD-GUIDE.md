# Tomfoolery + Moon Lander: explicit implementation guide

**Owner:** Tom. **Repository:** `/Users/adammuncie/TomSite`. **Date:** September 4, 2026.

## 0. Instructions for the implementing AI

Build the changes specified below. Focus on **a substantial visual overhaul of the website** and **better visuals and flight physics in Moon Lander**. Work sequentially, one numbered task at a time. Do not start a redesign interview, create more planning documents, delegate to more agents, replace the framework, or expand scope.

Read this guide once. Read only files needed for the current task. Make the change, run its acceptance checks, record the result in the checklist at the end, and continue. Repair failed checks before proceeding. Never describe an unchecked feature as finished. If something needs an unavailable personal image, use the specified fallback and record the limitation.

This guide supplies decisions; do not substitute a generic template or add decorative features to appear productive. Prefer the existing dependencies and renderer. Ask the user only for an actual blocker, not ordinary implementation decisions.

### Current workspace: unfinished work exists

An earlier implementation was interrupted. **The current files are partially edited, uncommitted, and not release-verified. No changes have been deployed.** Inspect `git status --short` and relevant diffs before editing. Continue useful work; do not reset the repository or assume the changes are complete.

Edited files at handoff:

- Site: `src/pages/index.astro`, `coffee.astro`, `art/index.astro`, `pokemon/index.astro`, `src/styles/global.css`.
- New site component: `src/components/GameFeature.astro`.
- Game: `src/pages/game.astro`, `src/scripts/lander/main.ts`, `types.ts`, `upgrades.ts`, `render/hud.ts`, `render/layers.ts`.
- New game helper: `src/scripts/lander/ui/mission.ts`.
- Separate unfinished reliability work: `netlify/functions/scores.mjs`, `netlify/functions/scores.test.mjs`, `package.json`, `RELIABILITY-NOTES.md`. Preserve it; validate it before any release. Do not expand leaderboard scope in this project.

Known issues requiring inspection, not blind assumptions:

1. Early game preview had pale difficulty labels on pale buttons. Confirm the eventual styles fix contrast.
2. Desktop briefly showed touch buttons. Confirm these appear only for touch/coarse-pointer layouts or an explicit control preference.
3. Initial title screen scrolled the page automatically. Only active gameplay/retry should intentionally reposition the viewport.
4. Current HUD says `DESCENT` while `render/hud.ts` calculates total speed using `Math.hypot(vx, vy)`. Correct the label/value mismatch.
5. HUD landing status currently duplicates collision rules and can say SAFE away from a pad. Task 6 replaces this with one shared evaluator.
6. The new lesson is currently an instruction screen, not an interactive tutorial. Task 7 specifies the required behavior.

## 1. Non-negotiable boundaries

- Read `AGENTS.md`, `AGENT-HANDOFF.md`, and relevant portions of `DESIGN.md`. **Do not open `HANDOFF.md`.**
- Keep Astro, TypeScript, Tailwind, Canvas 2D, Web Audio, and current Netlify hosting. No React/Phaser/Three.js migration. Do not create a new Sites project.
- Site identity remains **Tom**, warm and light. The game can have a dark space palette. No site theme switcher.
- Keep existing URLs, canonical domain, published personal writing, redirects, and image originals.
- Preserve local astronomical calculations, Breckenridge-only image atlas, weather fallbacks, and the existing 32-frame delivery pipeline. Keep fog disabled in Moon Lander.
- Preserve saved currency, cosmetics, achievements, upgrade IDs, and both `corner` and `classic` touch layouts. Never clear storage to make a test pass.
- Do not invent card photos, acquisition dates, biography details, collection sizes, or activity dates.
- Do not print secrets, `.env` contents, or credential-bearing Git remote URLs. Never use `git add -A`.
- Existing Astro guides: [components](https://docs.astro.build/en/basics/astro-components/), [styling](https://docs.astro.build/en/guides/styling/), [content](https://docs.astro.build/en/guides/content-collections/), [routing](https://docs.astro.build/en/guides/routing/). Consult the one relevant to the task, not every guide repeatedly.

## 2. Exact visual direction

### Website: a photographic personal journal

Use these existing colors: paper `#FAF6EE`, ink `#221A12`, muted text `#6F604A`, rules `#E7DCC8`. Terracotta `#C2673A`, moss `#5F7A45`, and gold `#B8862E` are decorative accents; use existing darker ink tokens for small colored text.

Keep the self-hosted fonts: Space Grotesk for headings, Inter for prose, JetBrains Mono for short labels. Desktop content maximum width: approximately 1120px. Gutters: 24px phone, 40px tablet, centered desktop. Section gaps: 48px phone / 80px desktop. Body: 17–18px, line-height 1.6. Functional labels: at least 12px. Homepage headline: fluid 44–80px, line-height about 1.0; never clipped at 360px width.

Use large real photographs, strong editorial headings, fine rules, and restrained shadows. Make the page hierarchy visible before animation runs. Avoid repeated generic cards, excessive rounded boxes, neon gradients, scroll blur, and cursor-following effects. Keep decorative image tilt below 2 degrees; do not tilt text or controls.

### Game: illustrated lunar expedition

Use a dark blue-black sky (`#101923`), distant blue-gray ridges (`#344656`), middle slate ridges (`#45515B`), warm foreground rock (`#796653`), cream highlights (`#E9DFC8`), and amber station lights (`#E0B665`) as the first environment's starting palette. These are art-direction constants, not physics values.

Make foreground collision surfaces, distant scenery, and the ship visibly distinct. The ship remains the existing charming mechanical lander. Use matching drawn icons rather than emoji for principal instruments. Existing cosmetic themes must remain recognizable and selectable.

## 3. Task A — finish the homepage

Files: `src/pages/index.astro`, `src/components/GameFeature.astro`, `src/styles/global.css`.

1. Keep/refine the new opening: large headline on the left, existing portrait on the right, short introduction, clear Now and About links. On phones, stack text then portrait and keep the introduction concise.
2. Immediately below, show a real coffee photograph and a larger Moon Lander feature. Game feature: illustration, a short heading, at most two sentences, and visible Play button. Make the image and copy one balanced composition; avoid a narrow text column creating an excessively tall feature.
3. Place the almanac after those features. Preserve its functional markup/data hooks. Improve hierarchy and contrast through presentation only; do not rewrite its controller.
4. Follow with current notes, then a separately labeled archive rediscovery, then a compact section index.
5. Use natural copy. Remove phrases explaining the implementation such as “without pretending it was written yesterday.” Do not hard-code “this summer” into evergreen labels.

**Pass:** at 390px and 1280px there is no clipped text or horizontal overflow; Tom and the site's purpose are clear; Play is easy to find; the almanac still loads its local astronomy and live conditions; all navigation works.

## 4. Task B — finish the remaining website pages

Work in this order; reuse shared visual classes rather than duplicating CSS.

| Page | Required result |
| --- | --- |
| Coffee | A composed heading/lead-photo layout followed by a responsive gallery. Clicking any photo opens a native `<dialog>` viewer with image, existing alt/caption, Previous, Next, Close, Escape handling, and focus returned to the opener. Arrow keys navigate only while viewer is open. Phone controls fit the screen. |
| Art | Present the existing work as a large featured piece with title and available medium/story. Do not leave one tiny card in an otherwise empty four-column grid. Link to its detail page. |
| Pokémon | Present cards/stories honestly. Where no photo exists, use a handsome typographic story panel, not fabricated card art or a broken placeholder. Remove claims of set/grade filtering unless useful data and working controls exist. With the present two entries, prioritize presentation over filters. |
| Now | Preserve actual text/date; strengthen heading, image composition, and the hierarchy of interests/log entries. |
| About | Preserve biography; strengthen portrait and introductory composition. Keep prose to a readable width. |
| Archive | Keep working text search and original exclusions. Add a clear featured essay and year selection for blog posts, including All years and an empty result message. Keep navigation to tweets working. |
| Detail pages | Make headings, metadata, image margins, reading width, and newer/older links consistent with the section pages. |

**Pass:** visit every changed route; open/close/navigate the gallery using keyboard; filter/reset Archive; verify no false promises, broken image paths, invisible text, or loss of existing content.

## 5. Task C — overhaul game presentation before physics

Files: `src/pages/game.astro`; `src/scripts/lander/render/{layers,world,ship,palette,fx,hud}.ts`; `src/scripts/lander/ui/`; `main.ts` only where wiring is needed.

1. Title screen: actual game world behind a restrained readable panel, game name, one Start action, compact difficulty selection. Put lesson/hangar/achievements/settings in secondary positions. The entire primary action must fit a 390×844 viewport. Do not blur the world into an unrecognizable brown background.
2. First environment: apply the palette above, brighten distant planes enough to separate them, add consistent upper-left rim lighting, restrained surface texture, and an unmistakable lit landing station. Reuse existing offscreen caches, planet, particles, and parallax.
3. Add three authored **visual presets**: First Light (slate/amber), Rust Basin (rust/cream), and Blue Rift (blue-gray/pale cyan). Select by level bands of five; combine with existing cosmetic themes through restrained accents and ridge/rock design. Do not overwrite equipped sky colors. Decorative presets must not change collision geometry.
4. Use `game-`/`mission-` classes scoped to the game. Do not depend on site light-card text colors inside dark overlays.
5. HUD: fuel, altitude, vertical descent, horizontal drift, attitude, landing status; put best/currency into a compact secondary area. Never hide the spawning ship or pad. Settings hold sound sliders; no permanently overflowing settings row.
6. Upgrade cards: retain existing benefits/costs, visibly distinguish them, show current stack count and selected upgrade's effect. Hangar must preview the actual selected cosmetic or an accurate renderer-based sample. Keep rarity readable without relying only on color.
7. Retune existing thrust, dust, landing pulse, and camera effects as one sequence. No new full-screen flash or obscuring smoke. Reduced motion disables shake and large animated movement.

**Pass:** desktop and phone screenshots visibly improve on the old brown scene; controls contrast correctly; all menus fit or scroll accessibly; touch layouts remain selectable; no performance-heavy scenery is rebuilt every frame.

## 6. Task D — upgrade flight physics in small, testable steps

**Goal:** responsive thrust, controllable rotational inertia, smoother rendering, and fair, explainable landings. Preserve the existing roguelite mechanics. Do not attempt a realistic orbital simulator.

### D1. Preserve the simulation foundation

Keep the current 120Hz fixed step (`DT = 1/120`), `MAX_FRAME_TIME`, swept collision helpers, mass/area model, and upgrade clamps in `physics.ts` and `stats.ts`. Positions use existing logical game coordinates, positive Y downward; angles are radians, zero upright. Do not relabel these as real meters without introducing an explicit display conversion. For now show `u` and `u/s` or unitless values consistently.

Do not multiply physics by device pixel ratio. Do not put new movement calculations inside the draw function. Keep the existing simulation/time-slowing conventions; review how `dt`, `pdt`, and `effPdt` are used before integrating.

### D2. Add limited rotational inertia

Add a transient angular velocity, initialized to zero on spawn/restart. Keep it out of persistent saves.

Use target angular velocity `(right - left) * 2.6 * stats.rotMult`. Smooth toward the target with `omega += (target - omega) * (1 - exp(-response * stepDt))`. Start with response `18 / second` while turning and `24 / second` on release. This should feel responsive with a short controlled settle, not slippery endless spinning.

Integrate `angle += omega * stepDt`, then normalize the angle using the existing helper. Preserve existing rotation stability limits. When autopilot or an ability explicitly sets attitude, bypass this manual controller and synchronize/reset its angular velocity so control does not snap when it ends. Left+right means zero target. Keep upgrade rotation multipliers working.

### D3. Make thrust engage smoothly without delaying emergency braking

Add transient throttle `[0,1]`. Move linearly toward 1 over 0.06 seconds when held and toward 0 over 0.04 seconds when released. Use effective simulation time; reset throttle on death/restart. No fuel means throttle and engine force are zero immediately.

Multiply the existing thrust acceleration by throttle. Charge existing fuel consumption proportionally to actual throttle, retaining each upgrade's exemptions and time convention. Scale flame/audio intensity with throttle. Preserve autopilot behavior unless its own tests support the new ramp. Do not change base gravity, base thrust 158, or default fuel capacity in this step.

### D4. One landing evaluator shared by collision and HUD

Create a pure `evaluateLanding(...)` helper in a new game physics helper module. Input includes contact-point velocity, normalized angle, eligible pad/overlap, current effective speed and angle tolerances, and existing special-upgrade modifiers. Return `{safe, reason, totalSpeed, verticalSpeed, horizontalSpeed, angle}`.

Preserve the existing combined-speed condition `hypot(vx,vy) < effectiveSpeedTolerance` and angle condition `abs(normalizedAngle) < effectiveAngleTolerance`, along with current pad eligibility and special rules. Do not replace these with unrelated limits. Moving pads must use relative velocity, so a ship moving with its platform is not penalized for the platform's motion. Derive pad velocity from simulation movement, not rendered pixel positions. Preserve bonus pads, sliding, bounce, shields, and rescue mechanics explicitly.

At impact, evaluate using swept-contact velocity/position and the contacted pad. HUD evaluates the same rules at the current approach, never displaying SAFE above unrelated terrain. Label good flight conditions `WITHIN LIMITS` before actual contact; landing is confirmed only by collision. Give separate reasons for off-pad, excess vertical speed, excess sideways speed, tilt, and hazard. When total speed fails but each component alone is below the limit, say `combined approach speed too high`.

### D5. Render interpolation

Store previous and current simulation poses. Draw the ship at `lerp(previous,current, accumulator/DT)` with shortest-path angle interpolation. Do not write the interpolated pose back to simulation or collision state. Camera, ship-attached effects, and ship should use the same rendered pose. On teleport/spawn/resize/pause-resume, set previous=current to prevent a streak across the screen.

### Required physics tests

- Identical seed and time-stamped input produce matching simulation state at simulated 30, 60, and 120fps render schedules, within `1e-6` for pure deterministic numeric fields. Test schedules without deliberately dropped/clamped time.
- Release rotation settles predictably; opposing input stays finite; upgraded rotation remains bounded.
- Throttle stays in `[0,1]`; zero fuel produces no thrust; fuel never becomes negative.
- Landing just below/above each tolerance; angle wrap near ±π; off-pad; combined-speed failure; a moving-pad landing using relative velocity.
- Existing high-speed collision tests still prevent tunneling. Include representative sliding/bounce/autopilot interactions.
- Pause/resume and interpolation never advance the simulation or teleport the ship.

**Pass:** all existing physics tests pass or are updated only for deliberately documented behavior; new tests cover these outcomes; keyboard and touch controls remain responsive in manual play. Do not weaken tests just to accept a broken implementation.

## 7. Task E — finish the playable loop

1. First start gets a Ready state so players can identify ship and target. Subsequent retries should be quick.
2. Optional lesson is an actual safe practice sequence: show thrust prompt until the player thrusts, rotation prompt until they rotate, then landing guidance. Allow Skip at every stage. Practice grants no currency, achievements, or leaderboard entry. Retry practice without penalty.
3. Show the specific evaluator reason on crash, one useful correction, and a dominant Retry action. Successful landing briefly celebrates, then opens upgrades.
4. Only capture flight keys while actively controlling the game. Ignore text inputs, textareas, contenteditable, and modifier shortcuts. Space must work in a pilot name and activate focused menu buttons normally.
5. Move focus into opened menus; trap only modal interaction; Escape closes settings/lesson appropriately or pauses play. Restore focus on close. Clear held input on blur, pause, and visibility changes.

**Pass:** manually complete title → lesson → exit → start → pause → settings → resume → crash → retry. Complete a real landing and choose an upgrade. Check both phone touch layouts. Type a name containing a space without submitting a public score.

## 8. Task F — verify and release only completed work

Start preview with `npm run dev -- --background`. Manage it with `npm run astro -- dev status`, `dev logs`, and `dev stop`. Reuse one server. If the environment kills detached processes, retain its parent terminal session; do not start servers repeatedly.

Run focused tests after each logical physics change. Run `npm run verify` after integration, then rerun only after further changes/failures. This command includes assets, types, tests, social cards, and production build. Unfinished leaderboard tests must pass too; do not remove them to obtain a green build.

Browser-check 360×800, 390×844, 768×1024, and 1280×800. Check homepage, Coffee viewer, Art, Pokémon, Now, About, Archive search/filter, a detail page, and all game flows above. Check reduced motion and keyboard focus. Do not claim actual iPhone testing from a resized desktop window.

Measure a 60-second normal run and a demanding later-level run on the available device. Target 60fps; document device and measured frame times. Decorative quality may degrade; physics rate and input behavior must not. Check scene contrast and HUD readability at low visual quality. Real-user Core Web Vitals are a later measurement, not something a local build proves.

Before deployment: review diff, ensure only intended files are staged by explicit path, preserve saves, and use the existing Netlify release path. This plan itself authorizes no hosting migration, account changes, or purchase. Deploy only under the user's current deployment authorization, then verify the live homepage, game, and read-only score endpoint. Report what shipped and any remaining limitations plainly.

## Completion checklist and handoff format

- [ ] A: Homepage composition and responsive checks
- [ ] B: All section/detail pages and gallery/search interactions
- [ ] C: Game artwork, presets, menus, HUD, and cosmetics
- [ ] D: Physics controller, landing evaluator, interpolation, regression tests
- [ ] E: Practice lesson and complete play/retry/reward flow
- [ ] F: Integrated checks, browser checks, performance evidence, authorized release

At each stopping point add only: **task completed; files changed; check and result; known issue; exact next task**. Keep the final user summary short. Do not restart this planning process.
