# Moon Lander v12 — Graphics Overhaul: Autonomous Build Plan

**Status:** Ready for single-run autonomous execution. No user input, confirmation, or clarification is permitted mid-run. Every decision is made in this document.

---

## 1. Problem definition (decomposition summary)

**Core problem.** The game plays well (v10 engine, v11 design pass) but *looks* amateur. Concrete deficits, verified against the current render code:

- **No light.** Nothing has a light direction. Terrain is a flat 2-stop vertical gradient (`layers.ts buildTerrainLayer`); asteroids are perfect circles with two static craters; the ship hull has no rim lighting; nothing casts a shadow.
- **No depth.** One static ridge silhouette baked into the sky layer. The dynamic camera (zoom to 1.6×) moves everything in lockstep, so zooming reads as "scaling a flat picture," not moving through a world.
- **Weak materials.** Sky is a 3-stop gradient with no horizon treatment. Terrain "texture" is 26 one-pixel scratches. The pad is a rectangle with hatching. Projectiles are dots.
- **Flat effects.** All glow is plain alpha — no additive (`lighter`) compositing anywhere, so flames, beacons, and explosions never *bloom*. Particles are uniform fading circles: no smoke, sparks, debris, growth, or rotation. Crashes have shake but no impact frame or hit-stop.
- **Flat ship hardware.** The ~60 upgrade modules in `drawShipModules` (ship.ts) — the most-looked-at pixels in a long run, since the ship literally builds out per pick — are all single flat fills with a stroke: no lit/shadow facets, no material distinction (a fuel tank, a crystal, and an antenna all read as the same matte sticker), and only a handful animate. The hull is one 2-stop gradient.
- **Doodle critters.** The cows/scurriers are charming but read as unshaded line doodles floating on the ground — no contact shadow, one bob animation, no reaction to a rocket landing next to them.
- **No ambient life.** The sky twinkles and that's it.

**What "next level" means here:** a consistent global light source, parallax depth, physically-suggestive materials (slope-shaded terrain, lit asteroids), additive light bloom, a real particle vocabulary (smoke/sparks/debris), grounding shadows, and impact juice — the standard kit that separates polished indie 2D games from programmer art. Style stays **Hearthwood** (earth tones, warm light, the site's palette) — this is a fidelity upgrade, not a restyle.

**Baseline:** v11 is in the tree (pause, canisters, bonus pad, surge levels). This plan builds on it.

**Constraints.** Canvas2D + vanilla TS, zero new runtime deps, must hold 60fps on a mid phone (the §8.5 DegradationGuard is the safety net and gets new gates). All static cost goes into the existing `LayerCache`; per-frame additions are strictly bounded.

**Rejected alternatives.**
- **WebGL/PixiJS renderer:** rejected. ~2,000 lines of working Canvas2D draw code (ship modules alone are 1,300 lines) would need porting; entity count (~30) doesn't need GPU batching; bundle-size and re-tuning risk for zero gameplay benefit. Canvas2D with layer caching + additive compositing reaches the target look.
- **Full-canvas post-processing (blur bloom, chromatic aberration):** rejected — requires per-frame `getImageData`/`filter` passes costing 5–15ms on mobile. Additive gradients give 90% of the bloom read for ~0 cost.
- **Per-frame dynamic terrain lighting:** rejected — slope shading is static per level; prerendering it into the cached terrain layer is free at runtime.

---

## 2. Non-negotiable invariants

- I1. `initLanderGame` export unchanged; `game.astro` untouched; no gameplay-affecting change anywhere — collision radii, physics, stats, and RNG call order in existing seeded sequences are frozen (new render randomness uses NEW `mulberry32` seeds only).
- I2. No new localStorage keys; `/api/scores` untouched; no new `dependencies`.
- I3. The `LayerCache` architecture is preserved and extended — nothing that is static per level may be drawn per frame.
- I4. Every new per-frame effect has a DegradationGuard gate specified in this plan (§Commit 7). `npx tsc --noEmit`, `npx vitest run`, `npx astro build` all pass after every commit.
- I5. Cosmetic SKIES/PAINTS/TRAILS purchases keep visible identity — depth tinting and lighting layer ON TOP of theme colors, never replace them.
- I6. The Hearthwood palette anchors everything: `#94B03D #D9A441 #C97B3D #B9A480 #F4EBDA #7C8F5C` plus the existing browns. New shading derives from these via lighten/darken, no new hue families except the cold depth-tint (§Commit 1).

---

## 3. Execution order

Nine commits, in order, message as stated. After each: `npx tsc --noEmit && npx vitest run`. Fix forward.

---

### Commit 1 — global light + sky/palette foundation (`gfx: light direction, layered sky, depth tint, vignette`)

**New module `src/scripts/lander/render/palette.ts`:**

- `export const LIGHT = { x: -0.55, y: -0.83 };` — normalized sun direction (upper-left). Every lit/shadow decision in later commits imports this; never hard-code another light direction.
- `export function shade(hex: string, amt: number): string` — parse `#rrggbb`, multiply RGB by `(1 + amt)` clamped 0–255, return hex. (`amt` −1..1.)
- `export function depthTint(levelIndex: number): { color: string; alpha: number }` — returns `rgba` overlay parameters: alpha ramps 0 → 0.16 over levels 0→30 (clamped), color `#1c2433` (cold indigo). Deeper runs get subtly colder and moodier without replacing the equipped sky theme (I5).

**layers.ts `buildSkyLayer`:**

- Replace the 3-stop gradient with 5 stops: `skyTheme.top` at 0, `skyTheme.top` shaded −0.1 at 0.35, `skyTheme.mid` at 0.62, `skyTheme.mid` shaded +0.12 at 0.8, `skyTheme.bot` at 1.
- **Horizon glow band:** after the gradient, a linear gradient band from `height*0.55` to `height*0.78`, transparent → `rgba` of `skyTheme.bot` lightened +0.25 at alpha 0.35 → transparent, painted with `globalCompositeOperation = 'lighter'`, then composite restored. This is the warm dusk-light pooling above the ridge line.
- **Depth tint:** `LayerBuildInput` gains `levelIndex: number` (main.ts `rebuildLayers()` passes it). After everything else in the sky layer, fill the whole canvas with `depthTint(levelIndex)` color at its alpha (normal compositing).
- Planet: add a thin crescent shadow — overlay a circle offset by `LIGHT * planet.r * 0.45` filled `rgba(0,0,0,0.28)` clipped to the planet circle, so the planet is lit from the same sun as everything else.

**Vignette (main.ts):** module-level `let vignetteCanvas: HTMLCanvasElement | null`. Build in `resize()`: radial gradient centered, transparent to `rgba(15,10,4,0.22)` from radius `0.62*max(width,height)` to corner. Blit as the LAST draw call in `draw()` (after toasts, screen-space). One `drawImage`, zero per-frame gradient work.

---

### Commit 2 — parallax depth (`gfx: 3-plane parallax with atmospheric perspective`)

**types.ts `Terrain`:** add `ridgeNear: TerrainPoint[];`.

**levels.ts `generateTerrain`:** after the existing ridge block, generate `ridgeNear` with its own NEW rng `mulberry32(cfg.seed * 613 + 29)` (I1: appended, never interleaved): 28 points, base `height * (cfg.terrain === 'canyon' ? 0.55 : 0.62)`, amplitude sines ×40 and ×22 (taller, closer). Return it in the Terrain object.

**layers.ts:** split rendering into FIVE cached canvases: `skyCanvas` (gradient + planet + depth tint, NO ridges anymore), `starCanvasA/B` (unchanged), `ridgeFarCanvas` (the existing `terrain.ridge` silhouette), `ridgeNearCanvas` (new), `terrainCanvas` (unchanged content, upgraded in Commit 3).

- Atmospheric perspective: `ridgeFar` filled with `shade('#20170c', +0.35)` blended toward the sky (lighter = farther); on top of its silhouette, a haze band — linear gradient from its mean crest y, `skyTheme.bot` at alpha 0.30 fading to 0 over 60px downward. `ridgeNear` filled `#20170c` with alpha-0.15 haze. Terrain (Commit 3) stays darkest/sharpest. That contrast IS the depth.

**main.ts `draw()` — parallax blitting.** Replace the single `blitLayers` call inside the camera transform with:

1. Sky: blit BEFORE the camera `save()` — screen-fixed (infinite distance).
2. Helper `function withParallax(factor: number, fn: () => void)`: `ctx.save(); const z = 1 + (camZoom - 1) * factor; ctx.translate(width/2, height/2); ctx.scale(z, z); ctx.translate(-(width/2 + (camX - width/2) * factor), -(height/2 + (camY - height/2) * factor)); fn(); ctx.restore();` — at `camZoom === 1` this is the identity for any factor.
3. Stars at factor 0.12 (twinkle logic moves inside this call, same two-blit trick), `ridgeFar` at 0.3, `ridgeNear` at 0.55, then the existing full camera transform (factor 1.0) for terrain + all entities + ship, exactly as now.

`blitLayers()` is refactored into `blitSky`, `blitStars`, `blitRidge(far|near)`, `blitTerrain` exports; the degradation-guard twinkle flag keeps working. When the guard is tripped, all factors collapse to 1.0 (single transform — §Commit 7).

---

### Commit 3 — terrain material pass (`gfx: slope-lit terrain, boulders, surface highlight`)

All inside `layers.ts buildTerrainLayer` (prerendered — zero runtime cost; rebuild is throttled to 0.5s under terraform, and 41 segments keep it well under 2ms):

1. **Slope shading.** For each terrain segment `i`, compute the outward normal; `lit = -(nx * LIGHT.x + ny * LIGHT.y)` (−1..1). Draw each segment as a filled quad (p[i] → p[i+1] → down to canvas bottom) with `fillStyle = shade('#3B2C16', lit * 0.22)`. Overlap each quad 0.75px horizontally to kill seams.
2. **Depth gradient.** Over the whole terrain silhouette (one path, `source-atop` composite on the terrain canvas), the existing vertical gradient `#3B2C16 → #221808` at `globalAlpha 0.55` — restores the ground-gets-darker read on top of slope shading.
3. **Surface highlight.** Along the top edge, per segment: if `lit > 0.15`, stroke that segment 2px in `shade('#8a6a3c', lit * 0.5)`; else 1.5px `#221808` (shadowed crests go dark, lit crests catch sun).
4. **Boulders.** NEW rng `mulberry32(cfg.seed * 431 + 19)`: 8–14 rocks. Placement: `x = rand() * width`, rejected within the pad corridor (`pad.baseX ± (pad.range + halfW + 20)`) and the bonus-pad zone if present; `y = terrainYAt(x)`. Each: an irregular 5–6-gon (radius 2.5–6px, vertex jitter ±35%), body `shade('#3B2C16', -0.15)`, lit-side facet (the 2 vertices nearest LIGHT direction get a `shade(+0.3)` sub-polygon), 1px dark contact shadow ellipse at its base.
5. **Scratch texture:** keep the 26 strokes but vary `lineWidth` 0.6–1.6 and alpha 0.25–0.55 from the existing `texRand` stream (extra `texRand()` calls are safe — this rng is used nowhere else).
6. **Canyon AO:** when `cfg.terrain === 'canyon'`, two vertical gradients at the wall bases (inner 60px of each wall, `rgba(0,0,0,0.3)` → 0) — walls read as towering.

---

### Commit 4 — ship lighting, flame, shadow (`gfx: layered additive flame, ground light pool, contact shadow`)

**main.ts:** track `let thrustHeldT = 0;` — in `step()`, `thrustHeldT = ship.thrusting ? thrustHeldT + dt : 0;`. Pass `thrustT: Math.min(1, thrustHeldT / 0.25)` into `drawShip` (add to its args interface).

**ship.ts flame rework** (the `if (ship.thrusting)` block, ~line 1149):

- Three nested tapered flame shapes via quadratic beziers from the nozzle: outer (length `(16 + flicker*6) * thrustT`, half-width 5, `rgba(217,164,65,0.35)`), mid (×0.72 size, `#C97B3D` at 0.7), core (×0.4, `#F4EBDA` at 0.9). Spicy flame keeps its green channel substitution.
- The radial glow gradient (kept per-frame, as documented) now draws with `globalCompositeOperation = 'lighter'`, radius `(18 + flicker) * thrustT` — actual bloom. Composite restored immediately.
- Flame ramps in over 0.25s of held thrust (`thrustT`) instead of popping to full size.

**Ground light pool (main.ts `draw()`, world-space, after terrain blit, before ship):** when `ship.thrusting` and `alt < 120`: radial gradient ellipse at `(ship.x, groundY)`, radii `(46 + alt*0.15, 12)`, flame color at alpha `0.30 * (1 - alt/120) * thrustT`, composite `'lighter'`. The engine visibly lights the ground on descent.

**Contact shadow (same location, always when `state==='playing'||'levelComplete'` and `alt < 280`):** soft ellipse at `(ship.x, terrainYAt(ship.x) - 1)`, half-width `26 * S * (0.35 + 0.65 * (1 - alt/280))`, height ratio 0.22, `rgba(10,6,2, 0.30 * (1 - alt/280))`. This is the single biggest depth cue in the game and doubles as a landing-height aid.

**Hull rim light (ship.ts, hull section):** after the hull fill, stroke the upper-left hull contour (the existing hull path) with `rgba(244,235,218,0.35)` width 1.2 clipped to the hull — consistent with `LIGHT`. Cockpit glass: add a small white specular arc (alpha 0.5) at the upper-left of the canopy ellipse.

---

### Commit 5 — particle vocabulary + impact juice (`gfx: smoke/spark/debris particles, hit-stop, landing dust ring`)

**particles.ts:** extend the pooled slot with `kind: 0|1|2|3` (dot, smoke, spark, chunk), `rot`, `vrot`, `grow` (px/s). `alloc()` gains one optional trailing arg `opts?: { kind?: number; vrot?: number; grow?: number }` — **all existing call sites compile unchanged** (defaults = dot, 0, 0). `simulate()`: smoke gets buoyancy (`vy -= 26*dt`) and `size += grow*dt`; chunks get `rot += vrot*dt` and full gravity; sparks get 0.5× gravity and velocity damping ×0.98/tick. Pool capacity unchanged (1,200).

**main.ts particle draw loop:** branch on kind — dot: current arc; smoke: arc at `alpha * 0.45` (soft, since it also grows); spark: 
line segment from `(x,y)` to `(x - vx*0.02, y - vy*0.02)`, width 1.5, drawn with `'lighter'` (batch: set composite once before the loop for sparks by drawing them in a second pass — collect indices is overkill; instead just set/restore composite per spark, they number <25); chunk: rotated filled triangle (size as half-width).

**explode():** recompose — 1 white flash (a 'dot' at size `26*S`, life 0.09, color `#FFF6E0`), 12 chunks (`#5a4326`/`#3B2C16`, vrot ±6, life 0.9–1.4), 18 sparks (`#FFC94A`, speeds ×1.4), 14 smoke (`grow: 18`, life 1.2–1.8, grays `rgba(60,48,30,*)`), plus 20 of the existing dots. Total ≤ 65 ≈ current budget.

**Landing dust ring (handleTouchdown, safe branch):** 16 dust dots emitted horizontally outward both directions along the ground (`vy` −5..−20, `vx` ±(40–110)), warm dust colors, life 0.5–0.9 — a satisfying ground "poof" under the confetti.

**Thruster smoke:** every 4th `emitThrusterParticles()` call also allocates one smoke particle (`grow: 10`, life 0.8) — the trail leaves a faint dissipating plume.

**Hit-stop (main.ts):** `let hitStopT = 0;`. Set `0.07` in `destroyShip()` (both phoenix and crash paths) and `0.04` in the safe-landing branch. In `loop()`: `if (hitStopT > 0) { hitStopT -= rawFrameMs / 1000; draw(); updateHud(); raf = requestAnimationFrame(loop); return; }` placed AFTER `perfGuard.sample` and `lastT = t` bookkeeping (so resume doesn't produce a catch-up burst — `lastT` must keep updating during the freeze). Physics, frame timers, and the accumulator all freeze for 40–70ms at the moment of impact; the explosion flash renders frozen for 2–4 frames. This is the cheapest, highest-value juice in the plan.

---

### Commit 6 — entity + pad material pass (`gfx: lit rotating asteroid polygons, UFO beam, tracer shots, pad deck`)

**entities.ts `generateAsteroids`:** each asteroid gains render-only fields `shape: number[]` (8–10 radial multipliers 0.72–1.28 from the existing per-asteroid rng if one exists, else NEW `mulberry32(cfg.seed * 947 + i)`) and `rotSpeed: number` (±0.2–0.6 rad/s). **Collision stays the circle `r` — gameplay untouched (I1).**

**world.ts `drawAsteroids(ctx, asteroids, simTime)`** (main.ts passes `simTime`): per asteroid — rotate by `simTime * rotSpeed`; draw the shape polygon (`r * shape[k]` at each angle) filled `#5a4326`; lit half: clip to the polygon, fill a half-plane oriented toward `LIGHT` with `rgba(185,164,128,0.22)`; shadow half `rgba(0,0,0,0.25)`; keep 2 craters (positions rotate with the body); drop the green outline (reads as sticker), replace with a 1px `shade('#5a4326', -0.4)` contour.

**UFO telegraph beam (world.ts):** replace the pulsing blob with a cone: gradient-filled triangle from the UFO underside toward the ship's current position (length 70, half-angle ~0.18 rad), `rgba(201,123,61,0.4)` → transparent, drawn with `'lighter'`, plus the dome brightening to `rgba(148,176,61,0.7)` during telegraph. Requires ship position — add `shipX, shipY` params to `drawUfos` (main.ts passes them). Dome gets a specular arc; underside gets a faint `'lighter'` glow disc when `Math.abs(u.vx) > 0`.

**Projectiles (world.ts):** capsule tracer — line from `(p.x, p.y)` to `(p.x - p.vx*0.045, p.y - p.vy*0.045)`, width 3, round caps, `#D9A441`, plus a 2.2px head dot in `#F4EBDA`, both under `'lighter'`; delete the per-projectile `shadowBlur` (slow path). Ally shots same geometry in green.

**Pad (world.ts `drawPad`):** deck becomes a metal slab — 8px tall gradient `shade('#5a4a2a',+0.15) → #33260f`, 1px `#F4EBDA`-at-0.25 top edge (rim light), 4 bolt dots along the face, and the deck ends get small support struts down to terrain (2px lines). Replace hatching with an **animated approach chevron strip**: 3 chevrons per side sweeping inward (offset by `(t * 26) % 14`), `rgba(148,176,61,0.5)` — the pad visibly says "land here, center up." Beacons keep blinking but their halo now draws with `'lighter'` radius 8. Bonus pad gets the same treatment in `#FFC94A` with `×3✨` kept.

**Canisters:** glow pulses (`alpha 0.18 + 0.1*sin(t*3 + phase)`) under `'lighter'`; body gets a 1px lit edge.

---

### Commit 7 — ambient life + degradation gates (`gfx: shooting stars, wind streaks, perf gates`)

**Shooting stars (main.ts):** module lets `nextShootingStarT` (init `8 + Math.random()*14` s of simTime) and `shootingStar: {x,y,vx,vy,life} | null`. When `simTime` passes the mark and state is `playing`: spawn at a random top-third point, velocity ~(±420, 160) px/s, life 0.7; schedule the next at +8–22s. Draw screen-space (above parallax, below vignette): a fading `'lighter'` streak (line along velocity, length ∝ speed×0.06, alpha ∝ life). Advance it in `updateFrameTimers` (it's cosmetic, frame-time domain). Never spawns while `perfGuard.degraded`.

**Wind streaks (main.ts draw, world-space):** when `Math.abs(currentWind(cfg, windPhase)) > 12` and not degraded: maintain 5 reusable streak slots (module array, no pool needed) — faint horizontal lines (length 30–60, alpha 0.10, `#B9A480`) drifting at `wind * 6` px/s, wrapping at screen edges, y in the upper 60%. Communicates wind direction ambiently (complements the HUD arrows).

**DegradationGuard gates — the complete list (I4):** when `perfGuard.degraded` is true:

1. Parallax factors collapse to 1.0 (one transform, one blit path) — Commit 2.
2. Star twinkle → single flat blit (existing behavior, unchanged).
3. ALL `'lighter'` composites fall back to `source-over` at 0.6× alpha: flame glow, ground light pool, beacon halos, tracer shots, UFO beam, spark pass, horizon band is baked (no cost), shooting stars (disabled entirely), canister pulse (static alpha).
   Implementation: one helper in a new `render/fx.ts` — `export function addGlow(ctx, degraded, fn)` that sets composite + calls `fn` + restores; every call site listed above routes through it.
4. Particle emission already halves via `emitCount()` (unchanged); smoke `grow` halves too (smoke overdraw is the expensive part).
5. Contact shadow and slope-shaded terrain are prerendered/cheap — never gated.

**Perf acceptance:** with all effects on, the added per-frame cost is ≤ ~15 gradient fills + ~4 extra `drawImage` blits + composite toggles — well inside budget; the guard covers the long tail.

---

### Commit 8 — ship hull + upgrade-module material kit (`gfx: faceted lighting for hull and all 60+ ship modules`)

The ship builds out module-by-module over a run — this is the game's signature visual and it must carry the same light language as the world. All work in `ship.ts`. **Hard perf rule:** `drawShipModules` runs every frame inside the ship transform; the kit uses NO per-frame gradient allocations — all shading is flat two-tone/three-tone facets via `shade()` from `palette.ts`.

**The material kit** — four helpers added at the top of ship.ts, each drawing in ship-local coordinates with `LIGHT` imported from palette.ts:

- `litFill(c, path: () => void, base: string, facet = 0.22)` — runs `path()`, fills `base`; then clips to the same path and fills the LIGHT-facing half-plane with `rgba(244,235,218, facet)` and the opposite half with `rgba(20,12,4, facet*0.8)`. Every solid module body routes through this — one call site change per module, instant lit/shadow read.
- `metalStroke(c, path, base)` — 0.7px contour in `shade(base, -0.45)` (replaces the assorted hard-coded stroke colors; outlines get consistent weight and warmth).
- `glassFill(c, path, tint)` — body at alpha 0.45 + a 1-facet specular dot offset toward LIGHT (domes, crystals, canopies, bubbles).
- `emissive(c, drawFn, degraded)` — routes through Commit 7's `addGlow` (additive when not degraded): running lights, crystal cores, coil arcs, the antenna beacon.

**Material assignment — every module block in `drawShipModules` is touched once, mechanically, by category** (the switch from flat fill → kit call is 2–4 lines each):

- *Metal bodies* (fuel_tank saddle tanks, drop_tanks, boost/kick/precision nozzles, tractor_winch drum, gecko/wide legs, bumper_skids, air_brakes flaps, moon_cheese_drill, asteroid_miner, storm_dampeners, fuel_lines, trim_flaps, lucky_antenna mast, echo_altimeter, cloud_seeder, hover_module, grappling_hook, spaghetti_engine pot, ufo_hacker dish, magnet/magnetic_pad horseshoes, gravity_anchor, mothership/valkyrie fittings): `litFill` + `metalStroke`.
- *Glass/crystal* (chrono_crystal, star_core nose star, cosmic_dice, wormhole_pocket lens, bubble_wrap, quantum housings, midas_hull gilding accents, time_bank face): `glassFill`, with `emissive` cores for chrono/star_core/singularity/black_hole_engine.
- *Cloth/organic* (reserve_chute pack, feather_gear, solar_wings membranes, dyson_sail, sticky_pads, nimble_fins): `litFill` at facet 0.14 (softer material) + `metalStroke` on spars only.
- *Emissive points* (landing_lights, scanner dish rim, vampire_coils arcs, alien_diplomacy plates, ufo running lights on hacked hardware, phoenix_feather ember, pocket_moon glow): `emissive`.

**Animation pass (cheap, sin/t only — no new state):** scanner + ufo_hacker dishes get a slow sweep rotation; lucky_antenna tip blinks; solar_wings/dyson_sail shimmer alpha with `sin(t*2)`; vampire_coils arc flicker; drop_tanks vanish after jettison (already stat-driven — verify `dropTankJettisoned` visual state matches, keying off `stats.massSum` change is NOT reliable — add a `jettisoned` flag to DrawShipParams passed from main.ts); pocket_moon (drawn in main.ts) gets a crescent shadow matching the planet treatment from Commit 1.

**Hull upgrade (drawShip):** hull gradient becomes 3-stop (`paint.hullTop`, `paint.hullTop` shaded −0.08 at 0.55, `paint.hullBot`) — one gradient per frame as now, cached per paint id in a module map keyed `paint.id` (gradients are in ship-local coords, safe to cache like the aura). Panel lines gain rivet dots at intersections. Engine nozzle gets an inner `emissive` ring while thrusting. Landing legs become two-tone struts (`litFill` triangles instead of bare strokes) with foot pads. Legs' knee joints get 1px highlight dots. The Commit 4 rim light and canopy specular complete the hull.

**Stack pips:** the `×n` pip (n≥3) gets a rounded chip in the rarity color at alpha 0.9 on `rgba(23,16,9,0.85)` — same data, crisper read.

**Cost check:** kit calls are clip+2 fills replacing 1 fill — on a maxed 20-module ship that's ~60 extra flat fills in ship-local space, trivial next to the existing per-frame text/ellipse work. No gate needed; if `perfGuard.degraded`, `emissive` already collapses via `addGlow`.

---

### Commit 9 — critters & fauna reactions (`gfx: shaded critters with shadows, idle life, ship reactions`)

All in `world.ts drawCritters` (+ a small render-state addition). Critters are decorative — nothing here touches gameplay (I1); "reactions" are render-side position/pose offsets only.

- **Grounding:** each critter gets a soft contact-shadow ellipse (`rgba(10,6,2,0.3)`, width ∝ body size) — same treatment as the ship's Commit 4 shadow, instantly seats them ON the terrain instead of floating.
- **Shading:** bodies route through the Commit 8 `litFill`/`metalStroke` kit (facet 0.14) — the cow's belly falls into shadow, its back catches the sun.
- **Idle life (per-critter phase-driven, no state):** cows — ear flick every ~4s (`sin` threshold on phase), tail swish, occasional head dip (grazing); scurriers — leg scuttle shuffle (2px x-jitter at 6Hz for 0.4s bursts), antennae eyes blink (glow dots scale to 0 for 2 frames every ~3s).
- **Ship awareness (render-only pose):** `drawCritters` gains `shipX, shipY` params (main.ts passes them). Within 120px of the ship: cows raise their head toward it (head ellipse offset 1.5px shipward, eyes track); scurriers turn to face away and lean 8° (pre-flee pose). Within 55px while `ship.thrusting`: both squash 15% vertically (bracing in the thruster wash) and 2 dust dots/frame kick up at their feet via the existing `emitCount`'d particle pool — main.ts owns particle emission, so this check lives in main.ts `step()` (a 3-line loop over critters, cheap at ≤6 critters), not in the draw call.
- **Landing celebration:** on the safe-landing branch (`handleTouchdown`), critters within 200px get a render flag window (`celebrateT` already exists — reuse it): cows do a 2px hop on a `sin` arc, scurriers spin once. Pure pose math off `celebrateT`, zero new state.

---

## 4. Verification & delivery

1. `npx tsc --noEmit`; `npx vitest run` — existing suites must pass untouched EXCEPT: extend `__tests__` with (a) `particles` — `alloc` without opts behaves identically to v11 (kind 0, no growth/rotation), pool capacity still 1,200; (b) asteroid `shape`/`rotSpeed` determinism for a fixed seed; (c) `shade('#3B2C16', 0) === '#3B2C16'`, monotonic lighten/darken; (d) `withParallax` identity at `camZoom === 1` (extract the transform math into a testable pure helper `parallaxTransform(factor, camX, camY, camZoom, w, h)` returning the matrix numbers).
2. `npx astro build` — zero errors.
3. Manual smoke (`astro dev --background`, then `astro dev stop`): level 1 — flame ramps/blooms, contact shadow grows on descent, ground lights up under thrust, dust ring + brief hit-stop on landing; level 5+ — asteroids rotate and read as lit rock; zoom near pad — ridges visibly slide (parallax); crash — flash + freeze-frame + chunks/sparks/smoke; pick 6+ upgrades across categories — modules show lit/shadow facets, crystals glow, dishes sweep, stack pips read at ×3; hover low over a cow — it braces and dust kicks up; land — nearby critters hop; check one purchased sky theme AND one purchased paint still read correctly; throttle CPU 6× in devtools — confirm the degraded path renders correctly (no composite glow, single transform).
4. Deploy: commit sequence, push, wait for Netlify, then curl-verify live (memory: 2026-07-02 incident): `curl -sI https://radiant-ganache-56c528.netlify.app/` and `/game` → 200; `curl -s .../game | grep -c lander` > 0.

---

## 5. Self-review & steelman resolutions (appendix)

1. **"Just use WebGL/Pixi if the goal is 'best we can do'."** Rejected (defense holds): the deficits are art-direction deficits, not renderer-capability deficits. Every technique in this plan (directional shading, parallax, additive bloom, particles, shadows) is fully achievable in Canvas2D at this entity count; a renderer port risks the entire working game for zero visible gain at 30 entities.
2. **"Per-spark composite toggling will thrash state."** Considered; spark counts are <25/frame and toggles are cheap, but resolved anyway: route through the single `addGlow` helper and draw sparks as one grouped pass inside one toggle (the particle draw loop orders by kind via four sequential passes over the pool — pool is 1,200 slots iterated once per pass; 4 passes is still trivial vs. per-slot work). Fix applied to Commit 5.
3. **"Parallax breaks the fog overlay / scanner lines,"** which draw in the factor-1.0 world transform. Verified safe: fog, scanner, and all guidance overlays already render inside the full camera transform and reference world coordinates; parallax only affects the DECORATIVE layers behind terrain. No change needed.
4. **"Hit-stop will desync the accumulator / trigger the degradation guard."** Fix applied in Commit 5's spec: `lastT` keeps updating during the freeze so no catch-up burst; `perfGuard.sample` still sees real frame times (the freeze draws cheap frames, it doesn't stall RAF), so no false trip.
5. **"Depth tint fights purchased sky themes"** (I5). Resolution: tint is an overlay at max alpha 0.16 on top of the theme gradient, and the manual-smoke checklist explicitly verifies a purchased theme. Upheld with the verification step added.
6. **"Slope-shaded quads will show seams at segment joins."** Fix applied: 0.75px horizontal overlap per quad plus the composite depth gradient on top hides any residual banding.
7. **"`drawUfos`/`drawAsteroids` signature changes ripple."** Verified: both are called only from main.ts `draw()` — two call sites total, updated in the same commits.
8. **"Hand-redraw all 60+ modules individually instead of a kit."** Rejected (defense holds): bespoke art per module is weeks of work with inconsistent results; the four-helper material kit gives every module the same light language in 2–4 mechanical lines each, and the per-category assignment list makes the pass unambiguous. Hero animation is reserved for the modules that earn it (dishes, crystals, sails).
9. **"Critter 'reactions' are gameplay creep."** Resolved: all reactions are pose offsets computed in the draw call from existing state (`phase`, `celebrateT`, ship distance); the ONLY main.ts addition is the dust-emission loop in `step()`, which allocates from the existing pool under the existing `emitCount` budget. Critter positions in the data model never change.
10. **"Caching hull gradients per paint id can go stale."** Verified safe: gradient coords are ship-local constants; the only variables are the paint's two hex stops, which are immutable per paint id — same reasoning as the existing `getAuraGradient` cache.
11. **Second pass after fixes:** clean. Every new rng is seeded and isolated; every effect names its trigger, cost domain (prerendered vs per-frame), and degradation gate; no step depends on user input.
