# Moon Lander 1.0 — Full Rebuild Plan for Luna 5.6

> **Recovery review — September 5, 2026:** The first implementation regressed phone layout, background placement, flight behavior, and feature completeness. Follow [the recovery plan](./lander-1.0-recovery-plan.md) before continuing this roadmap. Its recovery order, viewport decisions, and cutover gates take precedence.

**Status:** Planning only. No game implementation is authorized by this document alone. Begin implementation when the user asks to build it.

**Repository:** `/Users/adammuncie/TomSite`<br>
**Research date:** September 4, 2026<br>
**Intended builder:** Luna 5.6<br>
**Objective:** Rebuild Moon Lander as a polished browser game with a substantially new visual presentation, while preserving its precise flight, endless roguelite progression, strange upgrades, and warm illustrated atmosphere.

## 1. The recommendation

Build a new TypeScript game runtime around **PixiJS 8**, with **WebGL as the production renderer**, a separate deterministic simulation, and HTML/CSS menus and instruments. Create a richly illustrated 2D game with layered depth, textured terrain, animated modular ships, atmospheric lighting, and carefully composed effects. Here, “2.5D” describes the presentation: gameplay remains on a two-dimensional plane; a 3D world and perspective camera are not required.

Evaluate Pixi's WebGPU renderer in a bounded compatibility experiment after the vertical slice works. Enable it as an optional graphics setting only if the exact shipped shaders, assets, and target devices pass. Pixi currently describes WebGL as its recommended production renderer and WebGPU as experimental because of browser inconsistencies. Do not assume selecting WebGPU guarantees higher performance. [Pixi renderer documentation](https://pixijs.com/8.x/guides/components/renderers)

The greatest visual improvement should come from **art direction, actual production assets, animation, lighting, and composition**, supported by GPU rendering. A larger particle count or a bloom filter over the existing Canvas drawings is not the requested rebuild.

Keep Astro as the site shell. Do not migrate the personal website to another framework or introduce React just to host the game. Pixi is a rendering library, not a complete game framework: this plan explicitly assigns lifecycle, input, audio, saves, and progression to small game-owned modules.

### Decisions Luna should treat as defaults

| Area | Decision |
| --- | --- |
| Gameplay | Preserve the side-view lander and endless run structure |
| Rendering | PixiJS 8, WebGL production baseline |
| Optional renderer | WebGPU only after compatibility and performance gates |
| Simulation | Pure TypeScript, fixed 120 Hz, independent of renderer |
| Physics engine | Keep and rebuild the custom flight model; no general rigid-body engine initially |
| Presentation | Illustrated lunar diorama, smooth rotation, layered depth |
| Interface | Semantic HTML/CSS over and around the canvas |
| Audio | Web Audio mixer with authored samples and procedural engine response |
| Content | Preserve all 69 existing upgrades, delivered in tested batches |
| Progression | Preserve cosmetics, achievements, Stardust, and difficulty identities |
| New release features | Interactive training, reliable checkpoint resume, build inspection, complete settings and recovery flows |
| Integration | Develop beside the legacy game; switch `/game` only after release gates |
| Deployment | Prepare a release candidate; publish only under a later deployment instruction |

## 2. What exists today

These findings come from reading the current working-tree source. This planning pass did not run a live playtest or benchmark. Existing comments and older plans sometimes describe earlier implementations; use current executable code as the behavioral reference.

| Current source | What it contributes | Rebuild treatment |
| --- | --- | --- |
| `src/pages/game.astro` | Site integration, canvas, DOM HUD, touch controls, menus | Preserve site integration; replace the game shell in stages |
| `src/scripts/lander-game.ts` | Compatibility export for initialization | Preserve until cutover; avoid breaking existing imports |
| `src/scripts/lander/main.ts` | 3,326-line game coordinator containing simulation, UI, input, effects, persistence calls | Reference behavior; do not copy it into another giant file |
| `physics.ts` | 120 Hz timestep, mass/thrust/wind model, swept collision helpers | Characterize, isolate, and correct collision edge cases |
| `landing.ts` | Pure shared landing evaluator using velocity relative to a moving pad | Preserve as the foundation of contact results and HUD advice |
| `stats.ts`, `upgrades.ts`, `abilities.ts` | Upgrade definitions, derived stats, charge and active-ability behavior | Preserve IDs; migrate through explicit contracts |
| `levels.ts`, `rng.ts` | Procedural terrain, hazards, difficulty schedule, seeded generation | Rebuild into viewport-independent worlds and separate random streams |
| `entities.ts`, `noodles.ts`, `particles.ts` | Hazards, companions, terrain alteration, gameplay noodles, cosmetic effects | Separate gameplay entities from expendable visual particles |
| `render/ship.ts` | 1,541-line procedural ship and upgrade presentation, some nonvisual helpers | Replace presentation; move any gameplay helper out of rendering |
| `render/world.ts`, `render/layers.ts`, `render/palette.ts` | Illustrated landscape, cached layers, three visual environment presets | Use as identity reference; replace the rendering system |
| `audio/`, `ui/`, `persistence.ts` | Sound, mission guidance, menus, browser storage and score client | Preserve useful behavior through new adapters |
| `netlify/functions/scores.mjs` and its tests | Existing public leaderboard with validation and bounded writes | Keep legacy compatibility and separate new ruleset scores |
| `src/scripts/lander/__tests__/` | Existing physics, content, landing, persistence, and rendering checks | Reuse behavioral cases; replace tests tied to obsolete rendering internals |

The current catalog contains **69 upgrades, 6 paints, 6 trails, 4 sky cosmetics, and 23 achievements**. Preserve these identities. The existing game already has render-pose interpolation in `main.ts`, despite an older comment in `physics.ts` saying otherwise. It also already has effects, camera motion, mobile performance adjustments, and landing guidance. The rebuild should improve and integrate these features rather than present them as newly invented.

### Core identity to preserve

- Rotate, thrust, manage inertia and fuel, and touch down softly with appropriate attitude.
- Landing depends on combined speed and angle; moving pads require relative velocity.
- Land, collect rewards, choose a meaningful upgrade with a tradeoff, descend again.
- Cadet, Pilot, and Ace remain distinct tunings of the same game.
- Stackable upgrades produce ridiculous but understandable builds: spaghetti exhaust, jalapeño thrust, pocket moons, UFO diplomacy, drones, ghost saves, and gravity tricks.
- Wind, gusts, asteroids, moving pads, fog, UFO fire, pickups, optional risky pads, and periodic surges create escalating pressure.
- Stardust funds cosmetics; the little pilot, optional selfie, alien wildlife, and understated humor keep the game personal.
- Cream hulls, copper, moss, dusty rock, deep blue skies, and warm paper interfaces connect it to Tomfoolery.

### Problems the architecture should fix

1. **Viewport-dependent gameplay.** `resize()` currently regenerates terrain and rescales the ship position. Rebuild so browser chrome, orientation changes, and window resizing cannot change collision geometry or rescue/kill a run.
2. **Mixed randomness.** Terrain is seeded, but spawning, offers, combat, and other gameplay use `Math.random()` in several places. Reproducible runs need explicit gameplay random streams separated from visual randomness.
3. **Mixed ownership.** Rendering, simulation, UI timers, audio, camera, and persistence are entangled. Rendering must never make a gameplay decision.
4. **Collision assumptions.** The terrain sweep uses a small sample count followed by a binary search. This is not a proof against crossing a narrow ridge and emerging above terrain in one step. Add adversarial tests and implement reliable earliest-contact detection.
5. **Reading under pressure.** Upgrade selection currently has a 20-second timeout. Make normal-mode offers untimed in 1.0; retain a timed option only if later requested.
6. **Release continuity.** Saves have legacy keys and a schema marker, rather than a complete migration and checkpoint contract. Upgrade this without erasing progression.

## 3. Engine research and selection

These are source-backed capability observations plus project-specific judgments, not comparative benchmarks. Recheck exact stable package versions and APIs at implementation start; pin chosen versions and commit the lockfile. Do not install unpinned `latest` dependencies as part of this planning task.

| Candidate | Current relevant capabilities | Fit and decision |
| --- | --- | --- |
| **PixiJS 8** | GPU 2D scene graph, WebGL and WebGPU renderers, meshes, filters, sprites, asset loading | **Recommended.** Strong fit for textured illustration and custom lander physics in the existing TypeScript/Astro project. Requires our own game services. [Renderers](https://pixijs.com/8.x/guides/components/renderers), [architecture](https://pixijs.com/8.x/guides/concepts/architecture) |
| **Phaser 4** | Released modern WebGL renderer, RenderNodes, filters, lighting, GPU sprite layers, game framework features | **Runner-up.** Prefer if integrated game framework services become more valuable than renderer flexibility. It is a real current release, not the old unreleased Phaser 4 roadmap. Do not assume its modern renderer is WebGPU. [Official renderer overview](https://phaser.io/news/2026/04/phaser-4-renderer-faster-cleaner-and-built-for-modern-games) |
| **Three.js WebGPURenderer + TSL** | WebGPU with WebGL2 fallback; node-material/shader workflow | Best alternative if the direction changes to actual 3D terrain, a modeled ship, and an orthographic camera. Greater art and runtime scope for this game. [Official guide](https://threejs.org/manual/en/webgpurenderer) |
| **PlayCanvas** | WebGL2/WebGPU game engine; animation, input, audio, asset streaming, glTF and compressed assets | Strong browser-first choice for a true 3D rebuild. Do not introduce a second engine alongside Pixi. [Engine repository and capabilities](https://github.com/playcanvas/engine) |
| **Babylon.js** | Broad 3D engine with WebGL and WebGPU support | Capable but more engine than the chosen illustrated 2D direction needs. [Specifications](https://www.babylonjs.com/specifications/) |
| **Babylon Lite** | New WebGPU-exclusive, data-oriented renderer described by the project | Worth monitoring as a leading-edge option, but a WebGPU-only requirement conflicts with this release's fallback strategy. Treat vendor performance comparisons as vendor claims, not measurements for Moon Lander. [Official overview](https://www.babylonjs.com/lite/) |
| **Godot 4 web export** | Editor-based production workflow; current stable documentation describes WebAssembly/WebGL2 Compatibility rendering and single-thread web exports | Reasonable for a future native-first project. Less direct reuse of this site's TypeScript; current stable docs do not promise WebGPU export. [Web export documentation](https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html) |

**Do not choose an engine by showcase screenshots alone.** Any of these can make an attractive game. The recommendation optimizes for preserving this game's feel, making the artwork meaningfully better, and giving Luna an implementation that can be developed and verified in small pieces.

### Leading-edge techniques: adopt, evaluate, or defer

| Technique | Decision | Application |
| --- | --- | --- |
| GPU-batched sprite atlases and cached static composition | Adopt | Ship modules, rocks, wildlife, particles, world decoration |
| Textured terrain meshes | Adopt | Geometry comes from the collision surface; material detail supplies visual richness |
| Layered parallax and atmosphere | Adopt | A few deliberately composed planes, with gameplay silhouettes protected |
| Emissive masks, local light overlays, restrained bloom | Adopt | Thrusters, pad lamps, pickups, and rare upgrades |
| Normal-mapped 2D lighting | Evaluate in the vertical slice | Ship and foreground rock only; maintain a baked-light fallback |
| Local heat distortion | Evaluate after basic effects pass | Small thruster region; never distort HUD or pad-readiness indicators |
| WebGPU/WGSL | Optional renderer experiment | Same gameplay; dual-compatible effects or explicit visual fallback |
| KTX2/Basis textures | Evaluate only if measured texture memory demands it | Confirm the selected Pixi loader and backend support before committing; a Three.js loader is not a Pixi integration |
| Workers/OffscreenCanvas | Defer unless profiling identifies a bottleneck | A worker for expensive generation may help; do not split the whole runtime preemptively |
| GPU compute particles | Defer | Decorative only if ever added; collisions, noodles, and hazards remain CPU-authoritative |
| Ray tracing, Gaussian splats, fluid simulation, volumetric ray marching | Out of 1.0 | Poor match for a small, readable, mutable lander scene and the intended asset pipeline |
| Full ECS framework, Rust/WASM simulation, multiplayer | Out of 1.0 | No demonstrated need; preserve a simple testable runtime |

Pixi's performance guidance supports using spritesheets, controlling draw order, and avoiding constantly rebuilt graphics. Its filters support custom shader effects, but dual-renderer shaders require an appropriate GPU program as well as a GL program. [Performance guidance](https://pixijs.com/8.x/guides/concepts/performance-tips), [filter documentation](https://pixijs.com/8.x/guides/components/filters)

WebGPU availability still depends on browser, operating system, GPU, and secure context; a successful device initialization matters more than a browser-name check. Workers and OffscreenCanvas are available tools, not automatic performance improvements. [WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)

## 4. The 1.0 experience

### Release scope

Ship one excellent endless game, supported by an interactive flight school and a complete hangar. Do not add a separate story campaign, accounts, real-money shop, or a content service.

Required at release:

- A title scene showing the actual world and ship, a clear Start/Continue choice, and one-action access to practice.
- Three short interactive lessons: thrust and braking; drift and rotation; controlled touchdown. Target two to three minutes total, skippable and replayable.
- Endless progression with the existing difficulty identities and all 69 upgrade identities.
- Three finished environment families expanding **First Light, Rust Basin, and Blue Rift**. Keep the current five-level visual-band cadence initially; make later changes an explicit balance decision.
- Existing hazard and companion families with distinct animation and telegraphs.
- Untimed upgrade choice, actual before/after stat previews, skip reward, and a readable installed-build view.
- Landing celebration, short actionable crash diagnosis, and fast retry.
- Hangar, all existing cosmetics and achievements, local bests, and a version-separated community leaderboard.
- Keyboard and touch support; controller support as a release task with real-device verification.
- Audio/settings accessibility, robust pause/resume, and between-descent checkpoint continuation.
- Loading, missing-asset, renderer-failure, storage-unavailable, and offline-score states that remain usable.

Do not silently cut the catalog to make the deadline. If a feature cannot meet its release gate, record the specific blocker and proposed scope change for the user.

### First five minutes

1. The title screen is an animated view of a cream ship above a quiet moon, with landing lights visible immediately.
2. Start offers flight school once without trapping experienced players in it.
3. First descent teaches a single clear objective: slow down and keep the ship upright over the pad.
4. A successful landing compresses the legs, pushes out a dust ring, changes the pad lamps, and gives a compact performance readout.
5. The first upgrade choice visibly previews a ship change and explains its actual benefit and cost.
6. Failure explains the cause using the authoritative landing result: for example, excessive sideways speed relative to the pad. Retry does not require navigating the hangar.

### Intentional behavior changes

These are proposals for the rebuild, not descriptions of current behavior:

- Normal upgrade offers become untimed.
- Resizing becomes presentation-only.
- Hazard and pickup visuals become more legible; collision geometry is deliberately reconciled with them.
- Run randomness becomes reproducible from a seed and ruleset version.
- New bests are stored separately from legacy records if collision, generation, or balancing changes invalidate direct comparison.
- A checkpoint resumes at the beginning of the next descent after an upgrade choice, not at an arbitrary midair moment.
- Active abilities keep the existing priority resolution initially, but the HUD identifies exactly which ability will fire next. A selector is a later design option, not an unplanned rewrite.

## 5. Art direction: a handmade lunar expedition

### Visual target

Imagine a tiny, lovingly maintained expedition ship drifting through a painted lunar diorama. Rock has layered mineral texture, dust catches engine light, distant ridges fade into cold air, and the pilot remains expressive enough to care about. Machinery feels tactile and slightly improvised. Humor comes from the objects and their motion.

Use crisp silhouettes with textured interiors. Avoid generic neon space UI, photorealistic assets mixed with flat vectors, excessive blur, constant camera shaking, and uniform glow around every object. Important gameplay edges must survive the lowest graphics setting.

| Element | Target |
| --- | --- |
| Hull | Cream enamel, copper seams, gentle material texture, dark readable underside |
| Pilot | Small expressive portrait; idle blink, concentration, alarm, relief |
| Terrain | Painted strata and craters, authored rock motifs, a clear playable surface |
| Sky | Deep indigo and warm dusk; restrained stars and a composed celestial focal point |
| Lighting | Consistent upper-left ambient key; localized warm engine and pad illumination |
| Interface | Warm paper and dark instrument panels, existing site typography, authored icon set |
| Rarity | Color plus emblem and text; no reliance on hue alone |
| Motion | Mechanical settling, soft dust, readable anticipation, brief expressive reactions |

Starting palette: cream `#F4EBDA`, copper `#C97B3D`, moss `#7C8F5C`, night `#101724`, slate `#45515B`, pale signal `#D4EEF1`. These are direction anchors, not a requirement to reuse every existing color.

### World composition and render order

1. Sky gradient and subtle painted atmosphere.
2. Stars and celestial bodies.
3. Far ridge, low contrast.
4. Middle ridge and sparse ambient detail.
5. Near ridge and restrained weather.
6. Playable terrain mesh, pad structures, and surface decoration.
7. Gameplay objects: ship, hazards, pickups, companions, projectiles.
8. Foreground dust and effects with an opacity limit around the flight corridor.
9. Critical in-world indicators above atmosphere and post-processing.
10. DOM instruments, controls, and menus outside world effects.

The pad, ship, and dangerous projectiles have protected contrast. Fog may complicate navigation, but must not make a lethal projectile indistinguishable from an ambient star. The camera should show both ship and intended landing region, with restrained velocity look-ahead and a stable final approach.

### Ship production specification

- Build the ship as a compact hierarchy of textured parts: hull, cockpit, left/right legs, engine, and attachment sockets.
- Define socket coordinates and layering in data so every upgrade uses the same attachment conventions.
- Provide hull idle, thrust ramp, side-jet pulses, leg compression, shield impact, crash breakup, and revive animation.
- Use transformation animation for mechanical parts; a small spritesheet for the pilot and engine detail.
- Keep a constant gameplay hull unless an upgrade explicitly changes it. Visual module bulk must not silently enlarge the collider.
- At high stack counts, summarize repeated attachments into deliberate combined silhouettes and intensity tiers; do not draw hundreds of overlapping parts.
- Provide an expanded hangar preview for appreciating detail. The actual flight sprite must still read at its minimum on-screen size.
- Preserve the selfie as optional, session-only portrait substitution. The default portrait must be polished enough that camera access is unnecessary.

### Signature moments

| Event | Required visual and audio treatment |
| --- | --- |
| Main thrust | Authored plume, responsive intensity, subtle local ground light, continuous engine sound |
| Near-ground thrust | Dust emitted along the actual surface, with falloff by altitude |
| Perfect landing | Short leg compression, low dust ring, lamp sequence, distinct soft touchdown sound |
| Hard crash | Clear impact origin, limited fragments, brief flash, cause-specific results |
| Shield save | Local impact ripple and charge decrement; ship remains readable |
| Spaghetti Engine | Visible noodles with matching gameplay accumulation; clearly different from cosmetic particles |
| Chrono/Time Bank | Restrained perimeter treatment and altered ambience; instruments stay sharp |
| UFO attack | Consistent charge-up cue, projectile silhouette, and directional sound |
| Legendary choice | Brief presentation beat with unique emblem and preview; promptly skippable |

Use hit-stop as presentation after an authoritative result, or model it explicitly in the simulation clock. Do not let a reduced-motion setting change the outcome of a run.

### Asset deliverables and pipeline

Art is a first-class milestone. Temporary primitives are acceptable during the simulation extraction, but do not count as finished art.

| Asset group | Minimum deliverable |
| --- | --- |
| Ship | Layered source, socket map, base hull, legs, cockpit, engine, pilot expressions |
| Upgrades | 69 consistent card icons; module/effect mapping for every upgrade; bespoke treatment for signature upgrades |
| Environments | Three coordinated terrain materials, three ridge sets, decoration sets, atmosphere presets |
| Hazards | Asteroid variations, hostile/friendly UFO states, readable projectile and telegraph art |
| Other entities | Fuel pickup, primary/bonus pads, drones, pocket moon, wildlife, noodle assets |
| Effects | Plume, smoke, dust, spark, shock ring, shield ripple, revive and teleport assets |
| Menus | Title treatment, difficulty/rarity emblems, control glyphs, achievement icons |
| Sound | Engine layers, maneuver cues, landing/crash variants, hazard cues, UI sounds, music/ambience stems |

Store editable art under `assets/sources/lander/` and game-ready bundles under `public/game/lander/`. Include an asset manifest with ID, source, license, dimensions, atlas/frame names, anchor/socket metadata where relevant, and bundle membership. Generate a contact sheet to inspect consistency.

Use one coordinated art source workflow: commissioned/authored illustration or generated concept assets followed by cleanup and consistent slicing. Do not gather unrelated stock sprites. Keep original source files and attribution. Do not invent licenses or claim missing assets are finished.

Start with PNG/WebP atlas textures and JSON frame metadata; ship normal resolution and reduced-resolution bundles. Use padding/extrusion to prevent atlas seams. Budget decoded texture memory as well as network bytes: a compressed image file still expands when loaded. Evaluate [Pixi AssetPack](https://pixijs.io/assetpack/) for reproducible builds and [Pixi Assets](https://pixijs.com/8.x/guides/components/assets) for bundle loading. KTX2 needs a separately verified integration; [Three's KTX2 loader](https://threejs.org/docs/pages/KTX2Loader.html) is useful evidence of the technique, not a dependency recommendation for Pixi.

## 6. Architecture and contracts

Create the new implementation under `src/scripts/lander-next/` initially. Keep legacy code available as a reference until cutover. This is a proposed structure; files should only be created when their milestone needs them.

```text
src/scripts/lander-next/
  index.ts                    # async mount, cleanup, public lifecycle only
  core/
    clock.ts                  # fixed ticks, pause, interpolation
    state.ts                  # serializable world/run types
    events.ts                 # typed simulation events
    rng.ts                    # named streams and serializable state
    session.ts                # screen/run state transitions
  simulation/
    step.ts                   # ordered system orchestration
    flight.ts                 # thrust, rotation, mass, fuel, wind
    collision.ts              # earliest contacts and collision shapes
    landing.ts                # authoritative shared landing evaluator
    hazards.ts                # asteroids, UFOs, projectiles
    upgrades.ts               # effect application, derived stats
    abilities.ts              # charges, priority, activation
    companions.ts             # drones, moon, friendly UFOs
    terrain-effects.ts        # terraforming and gameplay noodle piles
    progression.ts            # rewards, achievements, next level
  content/
    upgrades.ts               # catalog and stable IDs
    cosmetics.ts
    achievements.ts
    biomes.ts
    generation.ts             # seeded level generation and validation
    balance.ts                # named constants and ruleset version
  presentation/
    renderer.ts               # Pixi setup, capability and error handling
    world-view.ts
    ship-view.ts
    entity-views.ts
    effects.ts                # bounded decorative pools
    camera.ts
    quality.ts
    assets.ts
    shaders/                  # backend-specific implementations as needed
  platform/
    input.ts                  # keyboard, pointer, gamepad -> actions
    audio.ts                  # mixer and cue routing
    saves.ts                  # validation, migrations, checkpoints
    leaderboard.ts            # optional network adapter
    portrait.ts               # camera lifecycle, session-only photo
  ui/
    hud.ts
    screens.ts
    accessibility.ts
  __tests__/
```

### Non-negotiable boundaries

- Simulation imports no Pixi, DOM, Web Audio, network, or browser storage modules.
- Rendering consumes read-only state and events; it cannot award Stardust, roll an upgrade, save a ship, advance a level, or modify collision terrain.
- Cosmetic randomness cannot consume gameplay random numbers.
- DOM and controller inputs become a common action representation sampled at fixed ticks.
- All progression changes happen once through explicit transitions. A duplicate click or event cannot pay a reward twice.
- Saves serialize domain data, never scene objects, textures, DOM nodes, or functions.
- The application owns one scheduling loop. Disable any automatic second Pixi ticker if using an application-owned loop.
- Module size is a review signal: split by responsibility before a coordinator becomes another thousand-line function. Do not split merely to satisfy an arbitrary line count.

### Minimal conceptual interfaces

```ts
// Illustrative contracts; define the referenced domain types in implementation.
interface InputFrame {
  rotate: -1 | 0 | 1;
  thrust: boolean;
  abilityPressed: boolean;
  bothTurnHeld: boolean;
  kickLeftPressed: boolean;
  kickRightPressed: boolean;
}

interface RunIdentity {
  seed: number;
  rulesetVersion: string;
  difficulty: 'cadet' | 'pilot' | 'ace';
}

// It is acceptable to mutate owned domain state for performance.
// Events are consumed once, independent of the number of rendered frames.
// stepSimulation(state, input, fixedDt, events): void
// render(previousState, currentState, alpha, visualDt): void
// mountLander(root, options): Promise<{ destroy(): void }>
```

Do not introduce an ECS library or generic plugin bus before there is a demonstrated requirement. Plain typed systems and stable entity IDs are sufficient.

## 7. Simulation, controls, and fairness

### Preserve feel before rebalancing

Record the current equations and constants into baseline fixtures before changing them. Starting reference values include fuel 100, thrust power 158, Pilot speed tolerance 60, Pilot angle tolerance 0.28 radians, and a fixed timestep of `1 / 120`. These are existing game units, not real SI units. Capture rotation inertia, throttle ramp, fuel burn, wind response, gravity floors, and upgrade modifiers from the current code too.

Do not replace this with stock arcade physics. A general physics package may be appropriate for purely decorative debris later, but must not redefine thrust, landing, or upgrade behavior during the visual rebuild.

### Fixed simulation and clock domains

- Use a 120 Hz simulation and interpolate between previous/current poses for rendering, including angle wraparound.
- Clamp frame accumulation to the existing 50 ms starting limit; process at most six fixed steps per frame and track dropped time in diagnostics. Severe stalls must not trigger unlimited catch-up.
- Keep separate fixed unscaled gameplay time, slowed world time, and cosmetic presentation time.
- Preserve the intended slow-motion tradeoff: world motion slows while fuel and designated charge timers continue in their defined unscaled gameplay domain. Pausing stops both gameplay domains.
- Reset accumulator and held input on pause, blur, visibility loss, scene destruction, and device disconnect.
- Synchronize previous/current render poses on teleport, spawn, revive, and scene changes to avoid interpolation streaks.
- Gameplay randomness is deterministic within the documented runtime/ruleset. Do not promise bit-identical cross-browser floating-point replay without testing it.

### World coordinates and responsive layout

Select a fixed logical world size during the baseline milestone, initially using a representative legacy desktop level such as 1000 × 620 game units. Document the mapping and recalibration against a captured legacy run; this is a new ruleset if geometry changes.

Generate terrain, pads, and hazards in world units. Keep the same level state when the viewport changes. Resize only the viewport, camera, render resolution, and HUD.

In portrait, fit the same world with a camera that keeps ship and target landing area visible, or use controlled letterboxing if necessary. Do not shrink the entire game until the ship becomes unreadable. During the vertical slice, verify a minimum useful ship size, reachable controls, and a visible approach corridor. If portrait requires a different presentation camera, it still cannot change geometry or physics.

### Collision and landing

1. Share one authoritative landing evaluator between HUD, contact handling, and crash advice.
2. Detect earliest contact against the actual terrain polyline segments crossed by the ship sweep; do not rely on endpoint penetration being monotonic.
3. Define the hull/landing-foot shapes explicitly, with a debug overlay. Reconcile visual legs with these shapes.
4. Moving pads use continuous relative motion for contact and pad-relative velocity for landing classification.
5. Decide and test precedence for simultaneous pad, terrain, projectile, shield, bounce, ghost, and revive events. Start with legacy precedence and document intentional corrections.
6. Terraforming and noodles update the authoritative collision representation and visual surface together. Rendering quality cannot change pile height or collision outcomes.
7. Bound numerical extremes without silently deleting upgrade effects. Test representative high-stack builds and use safe arithmetic for compounding values.

### Randomness

Derive named streams from the run seed: `generation`, `offers`, `combat`, `upgradeRolls`, and `decoration`. Save their states at checkpoints. Use a separate presentation seed/stream for particles and camera detail. Changing quality or opening the hangar must not change the next offer or enemy shot.

### Input

- Preserve keyboard mappings after recording the current bindings; provide a visible controls screen and remapping.
- Use Pointer Events with pointer capture for multi-touch controls. Handle cancel/lost capture and simultaneous rotate/thrust.
- Preserve both current touch layouts: corner and classic. Controls respect device safe areas and use large touch targets.
- Keep existing both-turn and double-tap upgrade gestures, with explicit detection windows and precedence tests. Provide accessible alternate bindings for these actions.
- Ignore gameplay keys while a text field or menu owns input. Prevent page scrolling only for handled game actions while the game has focus.
- Gamepad: mapped rotate, thrust, ability, pause; deadzone and disconnect handling. Begin with digital-equivalent thrust so controller users do not gain an undocumented analog-control advantage.

## 8. Upgrade migration and content completion

Create `docs/plans/lander/lander-1.0-upgrade-matrix.md` during implementation. Generate its initial rows from the current 69-entry catalog; do not manually invent the inventory.

Each row must contain: stable ID, rarity, current behavior, tradeoff, stacking rule, charge/reset domain, affected systems, visual attachment/effect, player-facing explanation, tests, and completion status.

Migrate in this order:

1. Fuel, thrust, rotation, mass/drag, landing tolerance, pad effects, and straightforward passives.
2. Shields, bounces, emergency saves, revives, and contact-modifying upgrades.
3. Active abilities, gravity changes, slow motion, teleport, grapple, and autopilot.
4. UFO allegiance, drones, escorts, pocket moon, projectile interactions, and hazard rewards.
5. Noodles, terraforming, drilling, and terrain-dependent behavior.
6. Rarity manipulation, reward multipliers, random stat effects, level skipping, and deep-stack interactions.

Every upgrade requires an implementation and a visual/UI mapping. A card with a name and an inert stat flag is incomplete. Cosmetic quality reductions may simplify how an upgrade looks; they may not remove its behavior.

Offer generation preserves rarity weighting, duplicate weighting, no duplicate IDs within one offer, extra-choice limits, and skip reward until a documented balance pass changes them. Compute card previews through the actual stat derivation function so copy cannot contradict gameplay.

For abilities, distinguish per-level charges, per-run charges, cooldown replenishment, and duration. The current catalog text and historical comments may disagree with code: record the conflict, choose the intended contract, and test it rather than accidentally preserving a contradiction.

### Level generation and balancing

- Preserve the current early hazard introduction order and every-tenth-level surge concept as the starting point.
- Separate biome appearance from difficulty and equipped sky cosmetics. A biome must not silently override a purchased sky.
- Add generation validation for spawn clearance, pad placement, terrain intersections, and bounded hazard density.
- Validate at least 1,000 seeds/configurations per difficulty with deterministic checks before release.
- Use scripted reference pilots as diagnostics for fuel margins and obvious impossibility, not as proof that levels are fun or universally beatable.
- Keep a balance report for levels 1, 5, 10, 20, and 50, plus selected extreme builds.
- No new upgrade catalog expansion until all existing entries and their important interactions are complete.

## 9. UI, audio, saves, and services

### Screens and accessibility

Implement explicit states: boot/loading, title, training, ready, flying, paused, landed/result, upgrade choice, crashed/result, hangar, achievements, settings, leaderboard, and recoverable error.

Use a transition table to define allowed actions. For example, picking an upgrade is only valid from upgrade choice and awards/advances once. Pause returns to its prior state; it does not discard an offer. Menus have keyboard focus management and focus restoration.

HUD: fuel, altitude, descent, drift, attitude, landing status, next active ability/charges, and level/best. Update DOM values only when needed; use around 10–20 Hz for numeric text while keeping simulation and canvas smooth. Status changes should appear promptly.

Use text and symbols as well as color. Provide reduced motion, shake strength, flash reduction, separate music/SFX volumes, control layout, remapping, and quality settings. Keep menus readable at 200% zoom and on narrow phones. Screen-reader support should cover menus and meaningful state announcements; do not claim the real-time visual flight game is fully nonvisual-accessible without a separate design.

### Audio

Create master, music, SFX, and ambience buses. Unlock audio from an explicit player gesture, resume suspended contexts safely, and avoid duplicate sources on remount. Keep the procedural engine responsive to actual thrust while authored samples add tactile character.

Use layered ambience/music that changes with danger and approach, but throttle cue repetition. Hazard cues must remain audible under thrust. Stop all owned nodes and camera streams on destruction. Camera denial and unsupported audio cannot prevent play.

### Save migration

Inventory and import the actual legacy formats for:

```text
lander-schema
lander-best-cadet / lander-best-pilot / lander-best-ace
lander-stardust
lander-cosmetics
lander-achievements
lander-pilot
lander-diff
lander-muted
lander-sfx / lander-music
lander-sfx-vol / lander-music-vol
lander-touch-layout
```

Keep legacy keys intact. Add a validated versioned profile, for example `lander-profile-v1`, containing schema version, migration marker, currency, owned/equipped cosmetic IDs, achievement IDs, preferences, and new-ruleset bests. Store legacy bests as labeled historical records.

Validate parsed objects, finite bounded numbers, arrays, known IDs, and enum values. Preserve recognized data when one field is corrupt. The old schema marker `10` is not the same as the new product version `1.0`; use explicitly named fields.

Migration must be idempotent: repeating initialization cannot duplicate currency or rewards. Write the validated new profile before marking import complete, and leave old data available for recovery. On storage failure, continue in memory and show a concise unsaved-progress indicator.

Add a separate checkpoint envelope with run seed, ruleset, difficulty, next level, upgrades, remaining run-scoped charges, run stats, RNG states, and the profile/reward revision needed to prevent repeated payouts. Commit the checkpoint only after an offer is resolved. Resume at the next ready screen. If versions are incompatible, preserve the profile and explain why the old run cannot continue.

Do not save or upload the pilot photo. It remains session-only unless the user later requests persistence.

### Leaderboard

The existing endpoint accepts client-reported scores. Its validation and warm-instance rate limiter are useful, but they do not verify that a run occurred. Preserve the community nature of the feature and never label it cheat-proof.

Use a separate new-ruleset endpoint/store or an explicitly versioned contract; do not mix new scores into legacy rankings. Preserve old GET/POST behavior for the legacy game. Record difficulty and ruleset server-side after validation. Score submission remains an explicit user action. Network failure must not block local play or discard local bests.

Do not add server replay verification, accounts, payments, or cloud saves in 1.0. If competition becomes a product goal, design authoritative verification as a separate project.

## 10. Performance and compatibility budgets

These are proposed acceptance targets, not measurements of the current or future game. Record actual hardware, browser version, resolution, quality, and build ID with every result. A failing target requires optimization or an explicitly documented adjustment, not a fabricated pass.

| Metric | Initial target |
| --- | --- |
| Standard desktop play | Sustained 60 FPS on a representative integrated-GPU laptop |
| Target phones | Sustained 60 FPS on a recent midrange Android and iPhone where feasible |
| Low tier | Stable 30 FPS on the declared minimum device, with identical gameplay |
| Frame pacing | In a 60 Hz test, p95 frame interval at or below 20 ms after warmup; report p99/stalls too |
| Simulation cost | p95 total simulation work per rendered frame below 3 ms on the reference laptop |
| Initial playable transfer | At most 5 MB compressed including first-biome assets, excluding optional later music/cosmetics |
| Playable load time | At most 5 seconds on a defined 10 Mbps / 100 ms-latency cold-cache test |
| Decoded texture working set | Aim below 96 MiB on mobile low/medium; account for render targets and duplicate resolutions |
| Lifecycle stability | Ten route entries/exits and ten restarts without growing listener, audio, or scene-object counts |
| Soak | Twenty minutes of representative play with stable memory trend and no unrecovered renderer failure |

Quality tiers:

- **Low:** reduced atlas resolution, capped pixel ratio, minimal decorative particles, baked lighting, no distortion/bloom.
- **Medium:** standard textures, bounded dust, local glow, normal world detail.
- **High:** selected normal lighting, richer ambience, restrained bloom and local distortion within budget.

The same ship, hazards, pickups, gameplay noodles, collision shapes, and telegraphs exist on every tier. Only decorative work scales down. Use hysteresis for automatic quality changes; avoid switching repeatedly in a single descent. Prefer tier changes at safe transitions and allow a manual override.

### Browser and failure matrix

Test current stable Chromium, Firefox, and Safari on desktop; actual iOS Safari and Android Chrome on phones. Record exact versions during implementation rather than pretending this plan freezes future browser support. Use headless browser tests for automation, but real devices for touch, GPU behavior, thermal load, and audio.

Test WebGL explicitly even on WebGPU-capable hardware. If offering WebGPU, exercise startup failure and device loss. Recreate the renderer on a fresh canvas when changing backend; preserve domain state, pause, and show a Resume control. Do not assume contexts can be switched on a canvas already initialized for another API.

If no supported GPU renderer initializes, show an accessible error with Retry and diagnostics. Do not assume Pixi provides a production Canvas2D fallback. Keep all critical visuals within the proven WebGL path.

## 11. Implementation milestones for Luna

Work sequentially in reviewable increments. After each milestone, update `docs/plans/lander/lander-1.0-build-status.md` with changed files, commands, actual results, screenshots when relevant, unresolved issues, and the next task. Do not mark later milestones complete because their scaffolding exists.

### M0 — Baseline and protected starting point

**Work:** Read `AGENTS.md`, this plan, the current game modules, tests, and older lander plans. Inspect `git status`; this planning pass observed pre-existing modifications to `main.ts`/`stats.ts`, reorganized documentation, and many unrelated deletions. Preserve them. Do not reset, clean, restore deleted projects, or stage unrelated files.

Capture current controls, flight constants, representative scenarios, storage fixtures, content inventory, screenshots, and performance. Run existing relevant tests and record pre-existing failures.

**Gate:** A written parity checklist, all 69 upgrade rows, save fixtures, and a known baseline. No claim of a regression without a baseline comparison.

### M1 — New runtime and one graybox descent

**Work:** Pin PixiJS 8 after checking current compatible stable APIs. Add the isolated runtime and a temporary `/game-next` development route. Establish lifecycle cleanup, one clock, input actions, pure simulation, fixed world coordinates, and a simple ship/terrain/pad. Preserve flight feel before adding visual complexity.

**Gate:** Start → fly → land/crash → retry works on keyboard and touch. Resize does not alter the world. Repeated mounting does not leak. The core simulation runs in tests without a DOM or GPU.

### M2 — Art pipeline and finished vertical slice

**Work:** Finish one ship, one First Light environment, one primary pad, one hazard, one fuel pickup, essential effects, and a polished HUD. Add a representative upgrade offer with Fuel Tank, Shield, and Jalapeño Injectors. Build atlases and contact sheets. Compare production WebGL with an optional WebGPU spike using the exact same scene.

**Gate:** One complete descent looks unmistakably rebuilt at desktop and phone sizes. Ship/pad/hazard readability survives low quality. Asset sources exist. The slice meets initial load/frame targets on recorded hardware. Document whether WebGPU passes, fails, or remains deferred.

**Stop expansion if this gate fails.** Fix the art direction, readability, or renderer problems before migrating the catalog. This is a quality gate, not a request to stop asking the user after every routine change.

### M3 — Collision, generation, and full flight systems

**Work:** Complete robust collision, seeded streams, moving pads, wind/gusts, pickups, bonus pads, asteroids, UFOs, projectile telegraphs, and authoritative landing feedback. Introduce the typed event pipeline and cause-specific crash results.

**Gate:** Collision regression cases, moving-pad cases, generation validation, deterministic runs, and pause/resize behavior pass. No renderer-triggered gameplay mutations.

### M4 — Upgrade catalog and progression

**Work:** Migrate all six batches in Section 8. Complete skip, offers, derived-stat preview, build inspection, charge reset rules, rewards, achievements, and long-run progression. Give every entry its final UI/visual mapping.

**Gate:** All 69 matrix rows complete, all 23 achievements reachable or explicitly corrected with a reason, important combined builds tested, no inert upgrades or undocumented catalog cuts.

### M5 — Complete world and presentation

**Work:** Finish Rust Basin and Blue Rift, cosmetics, wildlife, ship attachment combinations, music/SFX, hangar previews, and signature effects. Ensure purchased skies and paints remain identifiable in every biome.

**Gate:** Three finished environments, all existing cosmetics, consistent iconography, no placeholder art in the release path, no gameplay telegraphs hidden by weather or effects.

### M6 — Product flows and continuity

**Work:** Finish training, title/continue, pause, settings, accessibility, remapping, controller support, save migration, checkpoints, optional selfie, leaderboard separation, and failure recovery.

**Gate:** Full new-player and returning-player journeys work; malformed/blocked storage is safe; old progression imports once; camera/network denial does not prevent play; all menus are usable with keyboard and touch.

### M7 — Release candidate and cutover

**Work:** Run the complete acceptance suite and real-device matrix. Optimize measured bottlenecks. Prepare cutover so `/game` uses the new runtime, and retain a reversible legacy route or build flag for one release cycle. Isolate legacy and new score contracts and avoid dual-writing saves without an explicit migration design.

**Gate:** All release requirements in Section 13 pass, known limitations are recorded, and rollback is documented. Prepare deploy instructions and artifacts. Do not publish merely because local implementation is finished.

## 12. Verification strategy

### High-value automated checks

- Flight characterization: no-input fall, hover, thrust ramp, rotation response, fuel exhaustion, and representative upgraded builds.
- Landing thresholds just below, exactly at, and just above limits; normalized angles and combined-speed failures.
- Moving-pad velocity and contact; off-pad edge contact; a narrow ridge crossed within one tick; starting penetration; simultaneous events.
- Shield/bounce/revive ordering and charge resets; teleport interpolation reset; slow-motion clock behavior.
- Same seed and tick inputs yield matching domain results under 30/60/120 Hz render schedules. Quality changes consume no gameplay RNG.
- Noodle and terraforming surfaces agree with collision state at every quality tier.
- Every catalog ID maps to implemented behavior and presentation; each major effect family has meaningful behavior tests.
- High-stack finite-state tests and selected interaction tests, including slow-motion plus fuel regeneration, friendly UFOs plus escorts, and multiple death-save effects.
- Migration from clean, valid legacy, partially corrupt, already migrated, and unavailable storage; interrupted checkpoint writes; no duplicate payouts.
- Full screen flow tests: start, land, choose/skip, crash, retry, pause, settings, continue, and failed score submission.
- Lifecycle tests around Astro navigation and async initialization cancellation.

### Visual and manual checks

Use fixed seeds and frozen visual clocks for screenshot fixtures. Cover three biomes, desktop/portrait/landscape, low/high quality, a bare ship, a crowded upgrade build, fog/UFO telegraphs, landing, crash, and all menus. Review images at actual play size, not just enlarged crops.

Test multi-touch rotate+thrust, pointer cancellation, browser address-bar changes, orientation, device sleep, tab switching, audio unlock, gamepad disconnect, 200% zoom, reduced motion, and renderer recovery on actual supported devices.

Before release, have at least five unfamiliar players attempt training and an initial run. Record where they misunderstand drift, landing speed, upgrades, and retry. A useful starting target is that four of five can explain a crash and find Retry without help; revise the interface if this fails. This is a proposed usability gate, not a completed study.

### Repository commands during implementation

Use the existing package scripts and preserve unrelated checks:

```sh
npm run typecheck
npm run test
npm run build
npm run verify
```

Use targeted tests while iterating, then the full appropriate checks at release. Add new browser/asset/budget scripts when implemented; do not claim nonexistent scripts already ran. The current `npm test` covers `src/scripts` and `netlify/tests`.

When starting development, follow the repository instruction:

```sh
astro dev --background
astro dev status
astro dev logs
astro dev stop
```

Use the installed local Astro executable if the bare command is unavailable. Do not change to a foreground server workflow. Read the official Astro guides before relevant route/component integration work: [routing](https://docs.astro.build/en/guides/routing/), [components](https://docs.astro.build/en/basics/astro-components/), and [view-transition lifecycle](https://docs.astro.build/en/guides/view-transitions/). Mount once per active game root, cancel unfinished initialization on navigation, and destroy the previous instance before replacing it.

## 13. Definition of 1.0 done

- [ ] The graphics are visibly rebuilt: authored textured assets, animated modular ship, layered worlds, cohesive effects, finished menus.
- [ ] The original lander feel and humor survive, with documented intentional rule changes.
- [ ] All 69 upgrades, 23 achievements, 6 paints, 6 trails, and 4 sky cosmetics are accounted for and functional.
- [ ] Three completed environment families and the full endless progression work.
- [ ] Training, start/continue, offer/skip, crash/retry, hangar, settings, and pause are complete.
- [ ] One authoritative simulation controls landing, rewards, hazards, and upgrades; renderer settings cannot affect outcomes.
- [ ] Resizing and orientation never regenerate an active level or alter its physical state.
- [ ] Old progression migrates idempotently, remains recoverable, and does not mingle incomparable scores.
- [ ] Checkpoint resume cannot duplicate rewards and handles incompatible versions honestly.
- [ ] Keyboard, touch, and declared controller support pass their tests.
- [ ] WebGL passes the supported browser/device matrix; any optional WebGPU setting has its own recorded gate.
- [ ] Performance, load, memory, soak, and lifecycle budgets are measured and pass or have user-accepted adjustments.
- [ ] Missing assets, denied camera, blocked storage, offline scores, and renderer failure have usable flows.
- [ ] No placeholder art, inert upgrade flags, broken menu controls, or fabricated benchmark results remain.
- [ ] Repository checks pass, or pre-existing unrelated failures are clearly distinguished and reported.
- [ ] Release notes, asset credits, known limitations, build-status evidence, and rollback instructions exist.

## 14. Risks and scope controls

| Risk | Response |
| --- | --- |
| Another renderer refactor without a visible leap | Require finished assets and a polished M2 vertical slice before catalog expansion |
| Full catalog overwhelms implementation | Migrate by effect family with an explicit 69-row matrix and narrow tests |
| WebGPU consumes the schedule | Keep WebGL the release path; bound the experiment to the finished slice |
| Normal lighting and shaders fight the art | Start with baked light and simple overlays; add complexity only when visibly beneficial |
| New geometry changes game feel | Characterize current behavior first; document a new ruleset and separate records |
| Mobile controls obscure the pad | Solve viewport composition and safe zones in M1/M2, not at release |
| Deep stacks produce visual or numeric overload | Aggregate decorative attachments, bound visual pools, and test safe domain arithmetic |
| Saves or rewards duplicate across crashes | Versioned validated state, explicit reward revisions, atomic envelope writes where possible, recovery tests |
| Existing work is overwritten | Inspect the dirty tree first; preserve unrelated changes and never use destructive cleanup |
| Art or device testing is unavailable | Record the exact missing deliverable; continue independent work without pretending the gate passed |

Defer daily challenges, replay sharing, offline installation/PWA, account sync, multiplayer, verified competitive leaderboards, new upgrade expansions, and native packaging until 1.0 is stable. Reproducible seeds and clean platform adapters leave room for these later.

## 15. Copy-paste implementation prompt for Luna 5.6

> Implement the Moon Lander rebuild described in `docs/plans/lander/lander-1.0-rebuild-plan.md`. Start with M0, then work through the milestones in order. Preserve the user's existing uncommitted work. Use PixiJS 8 with the documented WebGL production baseline, a pure 120 Hz TypeScript simulation, and DOM UI. Preserve the current game's core feel, stable catalog IDs, humor, cosmetics, and progression. Build a finished visual vertical slice before expanding to all 69 upgrades. Keep the old game available until the release gates pass. Track actual evidence and outstanding work in `docs/plans/lander/lander-1.0-build-status.md`. Use current official documentation for the exact pinned APIs; do not invent engine features or test results. Complete the full release scope through reviewable milestones, and report specific blockers honestly. Prepare the release candidate and rollback instructions; do not deploy unless I explicitly ask you to deploy.

---

**Planning deliverable:** This file contains the recommendation and implementation specification. It does not claim that the new runtime, artwork, benchmarks, migration, or release checks have been implemented or completed.
