# Moon Lander v10 — Autonomous Build Plan

**Status:** Ready for single-run autonomous execution. No user input, confirmation, or clarification is permitted mid-run. Every decision is made in this document.

---

## 1. Problem definition (decomposition summary)

**Core problem.** The game at `src/scripts/lander-game.ts` is a single 3,033-line file. Physics uses variable-timestep Euler integration (feel varies with display refresh rate; fast falls can tunnel through terrain), gameplay logic leaks into the render path (asteroid collision runs inside `draw()`), every frame rebuilds gradients and iterates all stars/particles with GC churn, and the upgrade system hard-clamps stats so stacking dies at the caps. There are 19 upgrades across 5 rarities, no skip option, and each upgrade's ship module renders at fixed size regardless of stack count.

**Confirmed scope (owner-approved):**
1. Refactor the monolith into modules; keep the page's public behavior identical.
2. Upgrade the **custom** physics engine (owner explicitly chose this over Matter.js/Planck.js): fixed 120 Hz timestep, swept terrain collision, mass/drag model. Zero new runtime dependencies.
3. Performance overhaul: prerendered static layers, particle pooling, logic out of the render path, degradation guard.
4. Infinite stacking: every upgrade can be picked repeatedly forever; effects compound on every stack with **no hard gameplay caps** (only numerical-stability floors), and the upgrade's visual module grows with each stack.
5. Add a **Skip** option to the upgrade screen.
6. Add **10 new upgrades per rarity** (50 new; 69 total), including the Spaghetti Engine (soft-noodle crash protection) and other novel mechanics.

**Constraints.** Vanilla TypeScript + Canvas2D + Web Audio only. Astro 5 site, built with `astro build`, deployed by pushing to GitHub (Netlify auto-deploys). Must keep working: `initLanderGame(root)` export consumed by `src/pages/game.astro`; the `/api/scores` Netlify function contract; all existing `localStorage` keys; the Hearthwood visual palette; mobile touch controls.

**Feasibility.** One agent, one session. No external data or APIs needed. The only dev-dependency addition permitted is `vitest` (unit tests for pure modules).

**Rejected alternatives.** Physics library (owner rejected: bundle size, re-tuning risk). WebGL renderer (unneeded for this entity count; Canvas2D with layer caching hits 60 fps easily). Web Worker physics (complexity disproportionate to a ~30-entity sim).

---

## 2. Non-negotiable invariants

The build FAILS if any of these break:

- I1. `src/scripts/lander-game.ts` still exists and still exports `initLanderGame(root: HTMLElement): () => void` (it may become a thin re-export). `src/pages/game.astro` requires no changes other than (optionally) the 4th touch button described in §6.6.
- I2. All existing localStorage keys keep their exact names and formats: `lander-best-{cadet|pilot|ace}`, `lander-diff`, `lander-sfx`, `lander-music`, `lander-sfx-vol`, `lander-music-vol`, `lander-stardust`, `lander-cosmetics`, `lander-achievements`, `lander-pilot`, legacy `lander-muted`. New data uses NEW keys only.
- I3. `/api/scores` GET/POST payloads unchanged (`{name, level, difficulty}`); `netlify/functions/scores.mjs` is not modified.
- I4. `npx astro build` completes with zero errors; `npx tsc --noEmit` (or `astro check` if configured) passes.
- I5. No new entries in `package.json` `dependencies`. `vitest` may be added to `devDependencies`.
- I6. The 19 existing upgrade ids keep their ids, names, and rarities (their stat formulas change per §5 to support infinite stacking).

---

## 3. Target file structure

Create `src/scripts/lander/` and split the monolith as follows. Move code verbatim first, then modify — do the mechanical split as its own commit so regressions bisect cleanly.

```
src/scripts/lander-game.ts        → thin re-export: export { initLanderGame } from './lander/main';
src/scripts/lander/
  main.ts          init, RAF loop with fixed-step accumulator, wiring, cleanup
  types.ts         shared interfaces (ShipStats, LevelConfig, entities, etc.)
  rng.ts           mulberry32
  physics.ts       the new engine: step(), sweptGroundContact(), integrators
  stats.ts         RARITY, computeStats(), stacking formulas
  upgrades.ts      UPGRADES table (all 69), skip logic, choice rolling
  levels.ts        levelConfigFor, generateTerrain, generateSky, critters, ufos
  entities.ts      update logic for UFOs, projectiles, asteroids, drones, noodles
  particles.ts     pooled particle system
  render/
    layers.ts      offscreen static-layer cache (sky, stars, planet, ridge, terrain, texture)
    ship.ts        drawShip, drawShipModules (with stack-growth), pilot faces
    world.ts       pad, critters, ufos, asteroids, noodles, effects overlays
    hud.ts         toasts, banners, wind/chrono indicators
  audio/
    sfx.ts         AudioEngine (+ new one-shots: spaghetti splat, warp, dice, egg)
    music.ts       MusicEngine
  ui/
    overlays.ts    start/crash/level-complete/shop/achievements/leaderboard/selfie screens
  persistence.ts   loadJSON/save helpers, stardust, cosmetics, achievements, schema tag
```

Write `localStorage.setItem('lander-schema', '10')` on first load of the new build. If a future read finds unexpected JSON in any key, fall back to that key's default rather than throwing (wrap every parse in try/catch — the current code already does this; preserve that behavior everywhere).

---

## 4. Physics engine upgrade (custom, zero-dependency)

### 4.1 Fixed timestep
- Physics tick `DT = 1/120` s. In the RAF loop, accumulate frame time (clamped to 0.05 s max per frame to survive tab-switch stalls), run `while (acc >= DT) { step(DT); acc -= DT; }`, then render the latest state (no interpolation — at 120 Hz sim vs ≤144 Hz display the error is imperceptible).
- Chrono Crystal slow-mo multiplies the *accumulated* time (world time scale 0.75), while fuel drain and cooldown timers use raw frame dt exactly as today.
- Pause the loop on `document.visibilitychange` → hidden (stop accumulating; also stop thrust audio). Resume cleanly.

### 4.2 Mass & drag model
- Each upgrade defines `mass` (see table §7 — the values replace today's ad-hoc "gravity +X%" cons) and `dragArea` (default 0.02 per module stack).
- `mass = 1 + Σ(def.mass × stacks)`; `area = 1 + Σ(def.dragArea × stacks)`.
- Gravity force: `Fg = g_level × mass`. Thrust: `a = thrustForce / mass`. Wind: `a_wind = wind × windMult × area / mass`.
- Consequence: heavy builds fall harder AND respond slower — real weight. To keep level-1 feel identical, raise base `thrustPower` 145 → 158 and verify the §9 feel checklist. **Fallback:** implement a boolean `MASS_MODEL` flag in `physics.ts`; if the §9 sim test fails after two tuning iterations, ship with `MASS_MODEL = false` (legacy multiplier behavior — still correct, just less rich) and leave the flag for later tuning. Do not loop tuning more than twice.

### 4.3 Swept terrain collision (no tunneling)
- After integrating a step, if `y_new + 9S ≥ terrainYAt(x_new)` OR the segment (x_old,y_old)→(x_new,y_new) crosses the terrain polyline (check via 5-point parametric sampling of `terrainYAt` along the segment), binary-search the contact parameter t (4 iterations), place the ship at contact, and run `handleTouchdown` with the velocity at contact. At 120 Hz + ≤115 px/s landings this makes tunneling impossible even on canyon spikes.
- Same swept treatment for projectile→ship tests (segment vs circle) since Star Core stacks can push projectile speed high.

### 4.4 Logic out of the render path
- Move asteroid position computation and asteroid↔ship collision from `draw()` into `entities.ts::updateAsteroids(dt)`. Asteroids become stateful entities generated at `loadLevel` (seeded exactly as today so layouts are unchanged).
- `draw()` must contain zero gameplay mutations. Grep-verify: no writes to `ship`, `stats`, `state` inside `render/`.

### 4.5 Stability floors (NOT gameplay caps)
Infinite stacking removes the old clamps in `computeStats`. Replace them with floors that only guarantee the simulation stays finite and the ship stays controllable in the limit:
- `mass ≥ 0.2`, `fuelBurnMult ≥ 0.05`, `windMult ≥ 0`, `thrustPower ≥ 60`, `maxFuel ≥ 20`, `gravity product ≥ 1 px/s²` (never zero/negative), rotation speed applied per-tick clamped to `π/2` per tick (numerical guard only — unreachable below ~180 stacks).
- Everything else grows without bound. That is the point.

---

## 5. Infinite stacking rules

### 5.1 Effects — compound forever
`computeStats` iterates every pick (already does); each duplicate applies its full effect again:
- Multiplicative stats compound: n Boost Thrusters = `1.4^n` thrust and `1.15^n` burn.
- Additive stats add per stack: n Fuel Tanks = `+45n` fuel.
- Charge-based upgrades gain +1 charge per stack (Shield, Boomerang, Reserve Chute, Phoenix — Phoenix already stacks; extend the same pattern to all).
- Boolean upgrades gain a defined per-stack escalation (each table row in §7 has a "per extra stack" column; existing booleans: Scanner +1 → stack 2+ adds a touchdown-forecast marker then wider beam glow; Alien Diplomacy stack 2+ makes UFOs shoot asteroids for you; Chrono stack n slows to `0.75^n` below 120 m; Star Core repeats its +12%-everything roll per stack).
- Duplicate-weight rule change: owned upgrades currently roll at 0.5 weight; change to **0.75** so stacking is a viable strategy, and remove the "distinct 3" restriction only for already-owned upgrades (the same upgrade may appear at most once per offer, as today — the stack grows across levels, not within one offer).

### 5.2 Visuals — modules grow per stack
- In `render/ship.ts`, `drawShipModules` receives the stack count `n` per upgrade and draws the module scaled by `moduleScale(n) = 1 + 0.30 × (n − 1)` — linear, unbounded, clearly visible each stack. Apply via `c.save(); c.scale(k,k)` around each module's local drawing, anchored at the module's attachment point so it grows outward from the hull.
- At `n ≥ 3`, additionally draw a small `×n` count pip in the module's rarity color next to it.
- Where duplication reads better than scaling, do both at a smaller rate: Fuel Tank draws an extra tank pair per stack (up to 3 pairs) then scales; Precision Jets adds pods; Swarm Drones adds a drone per stack.
- The physics hitbox stays constant (`9S`) regardless of visual bulk — fairness over realism. The wind `area` term (§4.2) is how bulk affects gameplay.
- Ludicrous late-run ships that dwarf the hull are **intended behavior**, not a bug. Do not cap module scale.

### 5.3 Skip option
On the level-complete screen, under the three upgrade cards, render:
`[ ▶ skip — travel light · +15✨ ]`
- Clicking it awards +15 stardust (with toast), plays `audio.select()`, and advances to the next level with no pick.
- Track `runStats.skips`. New achievement `ach_minimalist` ("Featherweight — clear level 5 with zero upgrades installed").
- Keyboard: `Escape` triggers skip while the upgrade overlay is open.

---

## 6. New systems required by the new upgrades

Implement these once in `entities.ts`/`physics.ts`; the upgrade table references them by name.

- **6.1 Noodle piles (Spaghetti Engine).** While thrusting with the upgrade, every 3rd thruster particle is a "noodle": a 3-segment wavy strand (drawn as 2 quadratic curves, pale `#F4EBDA`/`#E8D9A0`) that falls under gravity and, on reaching the terrain, deposits into a `noodlePile` height-map (array parallel to terrain points; +1.2 px height per noodle within its segment, per-segment cap 26 px, decays 0.8 px/s). Render piles as a soft rounded blob layer over the terrain. **Touchdown rule:** if pile height at contact ≥ 8 px, an otherwise-fatal terrain impact becomes a soft squish landing — velocity zeroed, ship bounces up gently (`vy = −60`), pile height at that segment reduced by 10 px, splat SFX, no crash. Works anywhere on terrain, not just the pad; does not complete the level (only a safe pad landing does). Stacks: noodle emission ×n, per-segment cap +10 px per stack.
- **6.2 Active-ability slot.** New input: `ArrowDown`/`S` key + a 4th touch button (`data-touch="ability"` — add to `game.astro`; render it only when the player owns ≥1 active-ability upgrade, hidden otherwise via a class toggle). One press fires the highest-priority ready ability; priority order (first ready wins, one ability per press): Valkyrie Autopilot → Wormhole Pocket → Time Bank → Singularity Anchor → Grappling Hook. Each ability defines its own cooldown/charges in the table. Draw small cooldown pips above the fuel bar when abilities are owned.
- **6.3 Drones/companions.** Orbiting entities (angle += dt × speed, radius 26 + 8×index) that can intercept projectiles (consume drone charge for the level) or shoot (ally UFO). Pooled, max 12 rendered.
- **6.4 Terrain mutation.** `terraform(x, radius, strength)`: relaxes terrain points toward their local average within radius (smoothing spikes). Recompute the terrain static layer (§8.1) at most once per 0.5 s when dirty — never per frame.
- **6.5 Ghost ship.** Renders the ship at 35% alpha mirrored across the pad center X; pure visual except for the Quantum Duplicate death-save roll.
- **6.6 Stat modifier hooks.** Extend `ShipStats` with: `noodleStacks, extraChoices, stardustMult, grazeFuel, slopeLandCharges, hoverModule, asteroidMiner, magnetDeflect, tailwindTurbine, cheeseDrillCharges, droneCharges, abilityDefs[], padPull, autoBrake, kickThrusters, luckyTier, forecastMarker, eggLevels, randomDice, sailRegen, pocketMoon, escortUfos, doubleProgress, slideLanding, reverseGravityCharges, midasMult, ghostSave, stormTowardPad, nanoRegenSec, blackholeReserve, antigravPaint` (exact semantics per table). Booleans become numbers (stack counts) wherever stacking escalates.

---

## 7. The 69-upgrade catalog

Existing 19 keep id/name/rarity; their stat lines below are the NEW stacking-aware versions (mass replaces gravity-cons per §4.2; conversion: old "gravity +X%" → mass +0.0X). New upgrades marked ●. "Per stack" means the same effect applies again on each duplicate pick unless noted.

### Common (15 total — 5 existing + 10 new)

| id | icon | name | pro (per stack) | con (per stack) | visual module |
|---|---|---|---|---|---|
| fuel_tank | ⛽ | Extra Fuel Tank | +45 max fuel, refill now | mass +0.06 | saddle tanks (duplicate then scale) |
| gyro | 🌀 | Gyro Stabilizer | angle tolerance +0.16 rad | burn ×1.08 | spinning dashed ring |
| precision_jets | 🚀 | Precision Jets | rotation ×1.4 | burn ×1.06 | RCS pods (add pods per stack) |
| magnetic_pad | 🧲 | Magnetic Grapple | pad catch +40 px, speed tol ×1.15 | mass +0.04 | horseshoe magnet |
| feather_gear | 🪶 | Feather Gear | speed tol ×1.3 | wind ×1.2 | strut feathers |
| ● lightweight_alloy | 🧱 | Lightweight Alloy | mass −0.05 (floor §4.5) | speed tol ×0.96 | lattice panel lines on hull |
| ● wide_legs | 🦿 | Wide-Stance Legs | angle tolerance +0.10 rad | mass +0.03 | splayed longer legs |
| ● fuel_lines | 🧪 | Slick Fuel Lines | burn ×0.93 | thrust ×0.96 | copper piping along flank |
| ● bumper_skids | 🛷 | Bumper Skids | speed tol ×1.12 | rotation ×0.95 | sled rails under feet |
| ● trim_flaps | 🪁 | Trim Flaps | wind ×0.85 | burn ×1.04 | small winglets |
| ● solar_wings | ☀️ | Solar Wings | +1.5 fuel/s regen (engines off) | dragArea +0.06 | fold-out gold panels |
| ● landing_lights | 🔦 | Landing Lights | below 150 m: pad arrow + touchdown marker | max fuel −5 | twin lamps, light cones at low alt |
| ● sticky_pads | 🥾 | Sticky Landing Pads | horizontal speed forgiven ×1.2 on pad | mass +0.03 | goo drips on feet |
| ● nimble_fins | 🐟 | Nimble Fins | rotation ×1.15 | wind ×1.08 | extra fin pair |
| ● drop_tanks | 🛢️ | Drop Tanks | +20 max fuel; tanks visibly jettison at half fuel | mass +0.04 (0 after jettison) | outboard cylinders that detach |

### Uncommon (15 total — 5 existing + 10 new)

| id | icon | name | pro (per stack) | con (per stack) | mechanic/visual |
|---|---|---|---|---|---|
| boost_thrusters | 🔥 | Boost Thrusters | thrust ×1.4 | burn ×1.15 | aux nozzles |
| scanner | 📡 | Scanner | guidance line; stack 2: touchdown forecast; 3+: beam glow | max fuel −10 | shoulder dish |
| reserve_chute | 🪂 | Reserve Chute | +1 auto-brake charge/level | mass +0.04 | chute pack |
| fuel_scoop | ♻️ | Fuel Scoop | +3 fuel/s engines-off regen | max fuel −15 | nose intake ring |
| storm_dampeners | 🌬️ | Storm Dampeners | wind ×0.5 | thrust ×0.92 | vent slats |
| ● air_brakes | 🛑 | Air Brakes | hold L+R: damp velocity 20%/s (×n) | 3 fuel/s while braking | popped flaps when active |
| ● kick_thrusters | 🦵 | Kick Thrusters | double-tap L/R: 60 px/s sideways impulse (×n) | 4 fuel per kick | angled side nozzles |
| ● tractor_winch | 🪝 | Pad Tractor Winch | below 100 m, gentle pull toward pad center (8 px/s² ×n) | mass +0.05 | belly winch spool |
| ● cloud_seeder | 🌧️ | Cloud Seeder | gust amplitude ×0.4 | thrust ×0.95 | tiny cloud puffer on nose |
| ● vampire_coils | 🧛 | Vampire Coils | projectile passing within 30 px: +8 fuel (graze) | projectile speed ×1.1 | red coil windings |
| ● lucky_antenna | 🍀 | Lucky Antenna | +1 upgrade choice per offer (×n, max 6 cards rendered) | max fuel −5 | clover-tipped antenna |
| ● stardust_condenser | ✨ | Stardust Condenser | stardust payouts ×1.3 | mass +0.04 | sparkling filter box |
| ● echo_altimeter | 🦇 | Echo Altimeter | touchdown-point forecast marker + landing-speed readout | burn ×1.05 | sonar cone pings at low alt |
| ● gecko_struts | 🦎 | Gecko Struts | +1 charge/level: safe landing on any ≤0.35 rad slope (no level-complete, half stardust, refuels +15) | mass +0.05 | green toe-pad feet |
| ● bounce_bumpers | 🎈 | Bounce Bumpers | screen-edge bounces lossless + outward boost | dragArea +0.05 | inflatable side rings |

### Rare (15 total — 5 existing + 10 new)

| id | icon | name | pro (per stack) | con (per stack) | mechanic/visual |
|---|---|---|---|---|---|
| shield | 🛡️ | Shield | +1 impact charge (recharges each level) | mass +0.06 | shimmer ring (radius grows per stack) |
| gravity_anchor | ⚓ | Gravity Anchor | mass-gravity coupling ×0.85 (gravity only, not inertia) | rotation ×0.88 | hanging anchor |
| jalapeno_injectors | 🌶️ | Jalapeño Injectors | thrust ×1.3, spicy-green flame (greener per stack) | burn ×1.12 | hull jalapeño decal |
| boomerang_hull | 🪃 | Boomerang Hull | +1 terrain bounce/level | −15 fuel per bounce | gold chevron |
| alien_diplomacy | 👽 | Alien Embassy Plates | UFOs hold fire; stack 2+: UFOs shoot asteroids for you | mass +0.05 | antenna orb |
| ● spaghetti_engine | 🍝 | Spaghetti Engine | exhaust drops noodles that pile on terrain; piles ≥8 px turn fatal terrain hits into soft squish landings (§6.1) | burn ×1.10 | pasta pot with lid that rattles while thrusting; noodly exhaust strands |
| ● grappling_hook | 🪝 | Grappling Hook | ability (§6.2): fire hook at pad within 240 px, winch at 90 px/s; 1 charge/level (+1 per stack) | max fuel −10 | coiled harpoon gun |
| ● hover_module | 🛸 | Hover Module | below 60 m, auto-limit descent to 40 px/s while fuel lasts | 6 fuel/s while hovering | blue underglow disc |
| ● asteroid_miner | ⛏️ | Asteroid Miner | asteroid contact shatters it: +10 fuel, small kick, +10✨ | shatter kick 60 px/s random | pick-arm on flank |
| ● ufo_hacker | 📶 | UFO Hacker | first UFO each level becomes an ally that shoots other UFOs (×n UFOs) | max fuel −8 | dish with green code-rain glow |
| ● bubble_wrap | 🫧 | Bubble Wrap Hull | +1 charge/level: fatal impact → huge slow bounce (vy ×−0.4, capped 80) | dragArea +0.08 | bubble sheen over hull |
| ● magnet_storm | 🧲 | Deflector Coils | projectiles curve away (120 px/s² repulsion within 90 px, ×n) | rotation ×0.92 | crackling coil crown |
| ● tailwind_turbine | 🌀 | Tailwind Turbine | +1 fuel/s per 10 wind speed (×n) | wind ×1.1 | spinning turbine (spins with wind) |
| ● moon_cheese_drill | 🧀 | Cheese Drill | +1 charge/level: touchdown anywhere drills +15 fuel (no level-complete) | mass +0.05 | corkscrew drill nose |
| ● swarm_drones | 🐝 | Swarm Drones | +1 orbiting drone; each blocks 1 projectile/level (§6.3) | burn ×1.06 | orbiting bee-striped drones |

### Epic (12 total — 2 existing + 10 new)

| id | icon | name | pro (per stack) | con (per stack) | mechanic/visual |
|---|---|---|---|---|---|
| chrono_crystal | ⏳ | Chrono Crystal | time ×0.75 below 120 m (compounds: 0.75^n) | fuel drains at real time | orbiting crystal (bigger per stack) |
| overdrive_core | 🧨 | Overdrive Core | thrust ×1.55, rotation ×1.2 | burn ×1.22 | glowing porthole core |
| ● wormhole_pocket | 🕳️ | Wormhole Pocket | ability: teleport 80 px toward pad (+80 per stack); 1 charge/level | 12 fuel per jump | purple vortex ring on hull |
| ● gravity_flip | 🙃 | Gravity Flip Coil | hold L+R 1 s: gravity reverses 2 s (cooldown 8 s; duration +1 s per stack) | burn ×1.10 | inverted pendulum gizmo |
| ● midas_hull | 🏆 | Midas Hull | stardust payouts ×3 (compounds) | mass +0.08 | hull turns progressively gold |
| ● quantum_duplicate | 👯 | Quantum Duplicate | on fatal crash: 50% chance the ghost crashed instead (per stack: independent extra roll) | max fuel −15 | mirrored 35%-alpha ghost ship (§6.5) |
| ● storm_caller | ⛈️ | Storm Caller | wind always blows toward the pad | wind strength ×1.25 | storm-cloud crown with mini lightning |
| ● time_bank | ⏱️ | Time Bank | ability: 3 s of 0.5× slow-mo on demand (+3 s bank per stack), recharges each level | fuel drains at real time during | hourglass gauge on hull |
| ● terraformer | 🚜 | Terraformer | below 40 m, smooths terrain beneath ship (§6.4; radius +40% per stack) | burn ×1.12 | plow blade + dust jets |
| ● singularity_anchor | 🌑 | Singularity Anchor | ability: freeze all hazards 4 s/level (+2 s per stack) | max fuel −12 | tiny black orb with accretion ring |
| ● nano_repair | 🔧 | Nano-Repair Swarm | every 20 s airborne, +1 shield charge (max bank = stacks) | burn ×1.08 | silver mist shimmer |
| ● rocket_skates | 🛼 | Rocket Skates | too-fast-but-level pad landings convert to a slide-to-stop along the pad (speed tol ×2 if angle < tol/2) | effective pad width ×0.9 | wheeled skates on feet, sparks on slide |

### Legendary (12 total — 2 existing + 10 new)

| id | icon | name | pro (per stack) | con (per stack) | mechanic/visual |
|---|---|---|---|---|---|
| phoenix_feather | 🐦‍🔥 | Phoenix Feather | +1 revive/run (60% fuel) | max fuel −10 | gold feather decal (flames per stack) |
| star_core | 🌟 | Star Core | EVERYTHING ×1.12, gravity coupling ×0.92 | projectile speed ×1.2 | nose star + golden aura (aura radius per stack) |
| ● black_hole_engine | ⚫ | Black Hole Engine | thrust costs zero fuel below 25% tank | mass +0.12 | warping dark vortex nozzle |
| ● golden_goose | 🪿 | Golden Goose | +50✨ per landing (×n) | mass +0.06 | goose in a porthole; egg pops out on landing |
| ● cosmic_dice | 🎲 | Cosmic Dice | each level: one random stat ×2 (shown in intro banner) | same roll: another stat ×0.5 | giant fuzzy dice hanging off hull |
| ● dyson_sail | ⛵ | Dyson Sail | +4 fuel/s regen ALWAYS (even thrusting) | dragArea +0.20 | huge translucent gold sail (visibly billows with wind) |
| ● pocket_moon | 🌖 | Pocket Moon | orbiting moonlet permanently blocks projectiles & shatters asteroids it touches | sinusoidal tug ±10 px/s² | orbiting cratered moonlet (radius per stack) |
| ● valkyrie_autopilot | 🤖 | Valkyrie Autopilot | ability, 1/run (+1 per stack): full auto perfect landing from any state | max fuel −20 | winged helmet antenna; control lockout + cyan trajectory during |
| ● star_forge | 🌠 | Star Forge | rarity weights ×3 toward rare+ in all future offers (compounds) | max fuel −10 | tiny anvil with orbiting sparks |
| ● antigrav_paint | 🎨 | Antigrav Paint | gravity coupling ×0.8 | rotation ×0.9 | hull gets floating paint-drip streaks (upward drips) |
| ● mothership_favor | 👑 | Mothership's Favor | +1 friendly escort UFO that shoots asteroids & hostile UFOs | sky gets +1 (friendly) UFO of crowding | crowned mini-UFO escort |
| ● big_crunch | 🌌 | Big Crunch Drive | each landing advances 2 levels (rewards for both) | you face the harder config immediately | pulsing spacetime ripple around ship |

**Implementation notes for the table.** Valkyrie Autopilot: on trigger, disable input, run a PD controller (target: pad center, descent 30 px/s, angle 0; gains kp=2.2, kd=1.6 on both axes; force success by clamping touchdown velocity to tolerance — it is a guaranteed landing, not a simulation gamble). Cosmic Dice pool: thrustPower, maxFuel, rotMult, landingSpeedTol, windMult, fuelBurnMult (burn ×0.5 is the "good" side when rolled as the halved stat — pick doubled/halved stats distinctly). Big Crunch: `levelIndex += 2` on completion; stardust and best-level credit for both levels. Star Forge: multiply RARITY weights for uncommon+ by 3^stacks when rolling, renormalize. All ability charges reset per level except per-run ones (Phoenix, Valkyrie).

New achievements (add 8): `ach_minimalist` (clear L5 with 0 upgrades), `ach_pasta` (survive via spaghetti squish), `ach_hoarder2` ("Dragon's Hoard" — 20 upgrades), `ach_stack5` ("Mono-Build" — 5 stacks of one upgrade), `ach_dice` (land with Cosmic Dice active), `ach_autopilot` (Valkyrie landing), `ach_crunch` (reach L15 with Big Crunch), `ach_skip3` ("Purist" — skip 3 offers in one run).

---

## 8. Performance overhaul

1. **Static layer cache (`render/layers.ts`).** On `loadLevel`/`resize`, prerender to offscreen canvases: (a) sky gradient + planet + ridge; (b) star field at full brightness; (c) terrain fill + stroke + surface texture. Per frame: blit (a), blit (b) through 2 alternating alpha masks for twinkle (two `globalAlpha` blits of pre-split star subsets at phase-offset sine alphas — zero per-star loops), blit (c). Noodle piles and terraform edits mark layer (c) dirty (rebuild throttled to 2 Hz).
2. **Particle pool (`particles.ts`).** Preallocated ring buffer of 1,200; `alloc()` recycles oldest when full; simulate/draw only alive slots; zero allocations and zero `Array.filter` per frame.
3. **Render batching.** Group particle draws by color where possible; hoist `ctx.font` sets out of loops; reuse gradient objects for ship flame/aura (recreate only when S changes).
4. **Context options.** `canvas.getContext('2d', { alpha: false })`.
5. **Degradation guard.** Track EMA of frame time; if >22 ms for 60 consecutive frames: halve particle emission rates and disable star twinkle (single static blit). If it recovers <14 ms for 300 frames, restore. Log nothing to console in production.
6. **No logic in draw** (§4.4) and **pause when hidden** (§4.1).
7. **DOM discipline.** HUD text writes only when the displayed value actually changed (cache last string).

---

## 9. Execution order & verification (run exactly this sequence)

1. `git checkout -b lander-v10` in `/Users/adammuncie/TomSite`.
2. **Commit 1 — mechanical split.** Create `src/scripts/lander/` per §3, move code with zero behavior change, thin re-export. Verify: `npx astro build` passes; play one manual level via `astro dev --background` if a browser is available, else rely on build + tests.
3. **Commit 2 — physics engine** (§4) + unit tests. Add `vitest` to devDependencies with `npm i -D vitest`. Tests (in `src/scripts/lander/__tests__/`): (a) fixed-step determinism — same inputs ⇒ identical trajectories across two runs; (b) no-tunneling property — drop ship at 400 px/s onto canyon terrain from 50 seeded positions, assert contact always detected; (c) `terrainYAt`/`generateTerrain` determinism per seed; (d) mass-model sanity — more mass ⇒ shorter hover distance per fuel unit. Feel checklist (only if a browser is available; otherwise skip — the sim tests are the gate): level 1 landable within 3 attempts, thrust feels unchanged.
4. **Commit 3 — stacking + skip** (§5) + tests: computeStats monotonicity (each duplicate strictly changes the stat in the documented direction), floors respected at 100 stacks, no NaN/Infinity at 1,000 stacks of every upgrade.
5. **Commit 4 — new systems + 50 upgrades** (§6–7) + tests: every upgrade id unique; every rarity has exactly 15/15/15/12/12 members; `computeStats` handles 1,000 random picks without NaN; noodle pile deposit/decay math bounded.
6. **Commit 5 — performance pass** (§8). Verify with a 10 s scripted busy-scene run under `vitest` fake-canvas? No — canvas perf can't be unit-tested; instead assert structurally: no allocations in `particles.step` (pool test), layers rebuilt only on dirty flag (spy test).
7. **Commit 6 — new achievements, overlay text updates** (start screen blurb mentions stacking + skip), schema tag.
8. Final gate: `npx tsc --noEmit` (if `tsconfig` supports it; else `npx astro check` if installed, else rely on build), `npx vitest run`, `npx astro build` — all green.
9. Merge to `master`/`main`, push to GitHub (Netlify auto-deploys). Then verify the deployed page at `radiant-ganache-56c528.netlify.app/game` returns HTTP 200.

**Failure handling.** Any step's failure: fix and re-run that step, maximum two fix attempts, then if still failing, revert the failing commit, keep all prior green commits, push what is green, and write `LANDER-V10-STATUS.md` at repo root documenting exactly what shipped and what was reverted and why. Never push a red build. If `vitest` cannot be installed (registry unreachable), proceed without tests but double the manual-verification list in each commit and note it in `LANDER-V10-STATUS.md`.

---

## 10. Self-review & steelman resolution log

Issues found on audit, argued, and resolved:

1. *"Infinite multiplicative gravity reduction (Anchor/Star Core stacks) → gravity ~0, game trivial."* Defense: the player earned it over dozens of levels; the level generator's gravity also climbs forever, so the product converges to a tug-of-war, and the §4.5 floor (≥1 px/s²) prevents degenerate zero-G. **Defense holds — no cap added.**
2. *"Module scale 1+0.30(n−1) unbounded will cover the cockpit."* Defense attempted: it's the fun. Partially fails: the pilot face is a headline feature. **Resolved:** modules anchor outward from the hull (§5.2), so growth extends away from center; cockpit never occluded. No scale cap.
3. *"Ability priority list makes some upgrades unusable together."* Defense: one-press determinism matters more for an autonomous build than configurable bindings; priority ordered by rarity of the moment (a ready Autopilot is always the right press). **Defense holds.**
4. *"Mass model changes feel; §9 feel checklist needs a human."* Fails as originally written (no human available mid-run). **Resolved:** added the deterministic sim tests in §9.3 as the actual gate and the `MASS_MODEL=false` fallback flag in §4.2.
5. *"Terraform + noodle piles mutate terrain → static terrain layer cache invalidation could thrash."* **Resolved:** dirty-flag rebuild throttled to 2 Hz (§6.4, §8.1).
6. *"Lucky Antenna stacking (6+ cards) breaks the 3-column overlay grid."* **Resolved:** render cap of 6 cards (§ table), grid becomes `sm:grid-cols-3` two rows — no CSS change needed.
7. *"Big Crunch + best-level leaderboard could post skipped levels."* Defense: level reached is level reached; the drive is legendary-rare and the difficulty cost is real. **Defense holds — post actual levelIndex.**
8. *"Where do jettisoned Drop Tanks go?"* Under-specified. **Resolved:** spawn 2 tank-shaped particles with gravity, purely cosmetic, despawn on terrain contact.

Second pass over the resolutions found no new issues introduced.

*— End of plan. Hand this file to the build agent as its sole instruction source.*
