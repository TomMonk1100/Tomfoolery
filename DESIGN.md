---
version: beta
name: Hub — Hearthwood
description: Warm, earthy personal hub. Home-and-forest feel — deep bark canvas, terracotta and moss accents, alive with slow ambient motion.
colors:
  canvas:    "#171009"   # near-black, warm coffee-bark
  surface:   "#221808"   # tile surface, dark walnut
  surface-2: "#2E2110"   # raised / hover, richer walnut
  text:      "#F4EBDA"   # warm cream, not stark white
  muted:     "#B9A480"   # dried-sage tan
  border:    "#3B2C16"   # bark border
  accent:    "#C97B3D"   # terracotta / campfire
  accent-2:  "#7C8F5C"   # moss / sage green
  signal:    "#94B03D"   # jalapeño olive — rare emphasis only
  gradient:  "linear-gradient(135deg, #C97B3D 0%, #D9A441 50%, #7C8F5C 100%)"
typography:
  display:
    fontFamily: "Space Grotesk"
    fontWeight: 600
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Space Grotesk"
    fontWeight: 600
  body:
    fontFamily: "Inter"
    fontWeight: 400
    lineHeight: 1.65
  mono:
    fontFamily: "JetBrains Mono"   # labels, timestamps, live data
spacing:
  base: 4px        # scale: 4, 8, 12, 16, 24, 32, 48, 64
rounded:
  sm: 0px
  md: 2px
  lg: 4px
---

## Overview
A personal hub that should feel like walking into a cabin at dusk — warm
light, natural materials, something always quietly alive (a fire crackling,
weather moving outside). Not neon, not clinical. Auto-detects light/dark
(v6), but both are warm: bark-and-walnut at night, cream-and-linen by day —
never black-and-neon, never clinical white. Editorial bones stay (clear
hierarchy, generous spacing) so it reads as considered, not rustic-cluttered.

## Colors
Coffee-bark canvas with walnut surfaces (dark mode). Terracotta (campfire) is
the primary accent, moss/sage the secondary — together they read as
golden-hour light filtering through trees, not a screen glow. The olive
"signal" green is a quieter cousin of neon lime, reserved for live/active
states (matches the jalapeño-green nod from the original palette, just
earthier). Avoid pure black and pure white anywhere — everything is warmed.

**Light mode (v6):** warm cream/linen canvas, dark walnut text, the same
terracotta/moss/olive accent hues but deepened for contrast on a bright
background — a "sun-lit studio" counterpart to dark mode's "candlelit
evening." Dark mode's accents keep their original, more saturated values
verbatim (zero visual change for existing dark-mode users); light mode is
the new palette. See "Theming" below.

## Typography
Unchanged structurally from v1 (Space Grotesk display/heading, Inter body,
JetBrains Mono for data/labels) — the warmth comes from color and motion,
not typeface. Mono labels now read like hand-labeled jars rather than
terminal output, because of the palette shift.

## Spacing
Unchanged: 4px base, generous tile padding (24–32px), breathing room.

## Components (v3 — sharpened)
- **Tiles (bento):** walnut surface, 0–4px radius max (near-square,
  architectural), warm 1px border, subtle grain texture. On hover: lift +
  border picks up the campfire gradient, 250ms spring-ish ease. No pill
  shapes, no large soft rounding anywhere — that read as generic
  "AI-generated" and was cut deliberately in v3.
- **Buttons:** gradient fill for primary; ghost (border only) for secondary. Sharp corners.
- **Links:** gradient underline that animates in on hover.
- **Badges/tags:** mono font, small, muted tan — "live"/active states use signal olive.
- **Lava lamp (v6, replaces the old single ambient blob + orbit field):**
  four large, soft blobs drifting and morphing on 9–16s cycles via animatable
  border-radius + long-period transforms, blurred and vignette-masked so they
  dissolve to nothing well before their container edges (no hard box edges).
  Deliberately slow and hypnotic — the earlier fast blob + fast-orbiting-dots
  combo read as "too intense," so v6 consolidated ambient hero motion into
  one calmer system instead of layering several.
- **Glass nav:** sticky header with backdrop-filter blur+saturate — content
  scrolls underneath it like frosted glass, not a flat opaque bar.
- **Ember field:** a subtle canvas-based particle layer (warm floating
  motes, like fireflies/embers) drifting slowly across the whole page,
  low-opacity, GPU-cheap, paused under prefers-reduced-motion.

## Motion (v3 — pushed further)
Still warm, but more alive and kinetic than v2 — closer to a high-end
creative-agency site than a calm personal blog.
- Kinetic type: hero headline splits into words/characters that animate in
  with stagger, not just a block fade.
- Scroll-reveal is more dramatic: larger travel distance, slight scale +
  rotation on entry, snappier spring easing.
- Parallax layers: background/ambient elements move at a different scroll
  speed than foreground content for depth.
- Ambient hero blob drifts (20–30s loop) with organic SVG-filter distortion.
- Hover: 250ms, gentle spring easing, not linear.
- Page transitions via Astro's View Transitions — soft cross-fade + slight
  rise, so navigation feels like turning a page, not a hard cut.
- Live data (weather/moon/ISS widget) gets a subtle pulse on refresh so it
  reads as "alive," not static.
- CSS @property drives smoothly animated gradient angles (not just position).
- Houdini CSS Paint API used where supported (progressive enhancement,
  feature-detected — Safari stable doesn't support it yet, so there's always
  a solid CSS fallback).
- Always respect prefers-reduced-motion — cut everything to near-instant and
  pause the ember field.

## Motion (v4 — creative agency pass)
Layered on top of v3 rather than replacing it — same warm/organic feel, more
autonomous life to the page.
- **Magnetic tiles:** bento tiles subtly pull toward the cursor within a
  ~130px radius (translate, not scale), released with a springy ease.
  Disabled under prefers-reduced-motion and on coarse-pointer (touch)
  devices.
- **Scroll-velocity reactive text:** elements tagged `data-scroll-fx` skew
  and blur proportional to how fast the page is currently scrolling, decaying
  smoothly back to rest — reads as inertia, not a fixed per-position effect.
- **Autonomous orbit field:** *(superseded in v6 — folded into the lava lamp
  system below; three separate ambient-motion layers running at once was
  part of what made the hero feel too busy.)*
- **Flicker-hover:** the gradient "Tom" wordmark and nav logo get a brief
  warm-toned flicker (opacity/brightness/saturation steps, not RGB glitch)
  on hover — a candlelight flicker, not a broken-screen glitch, to stay on
  the Hearthwood side of "glitchy."
- **Distortion page transitions:** the existing SVG feTurbulence/
  feDisplacementMap filter now also runs during the view-transition
  fade, so navigating between pages has a subtle organic ripple instead of a
  plain cross-fade. Progressive enhancement — falls back to the plain v3
  cross-fade wherever the filter isn't supported.

## Theming — light/dark (v6)
Full site-wide light/dark system, CSS-custom-property driven:
- All color tokens (`--color-canvas`, `--color-ink`, accents, plus RGB-triplet
  helpers for `rgba()` compositing and nav chrome vars) are defined twice,
  once under `:root[data-theme="dark"]` and once under
  `:root[data-theme="light"]` in `global.css`. Tailwind's `@theme` block
  registers the token names (so utilities like `bg-canvas`/`text-ink` exist)
  with the dark values as the no-JS fallback; the `[data-theme]` blocks
  override them, and because Tailwind's generated utilities reference
  `var(--color-*)`, every utility class re-themes automatically with no
  per-component work.
- `data-theme` is set on `<html>` by a blocking inline script in
  `Layout.astro`'s `<head>` — runs before first paint, reads a saved
  `localStorage` choice, falls back to `prefers-color-scheme`. No flash of
  the wrong theme.
- A sun/moon toggle button lives in the nav, persists the choice to
  `localStorage`, and dispatches a `tomsite:theme-change` DOM event on
  toggle so any component that needs to react (e.g. the ember field
  re-picking its particle colors) can, without a full page reload.
- Applies everywhere, including `/game` — the page chrome (nav, tiles,
  overlay screens, HUD) all use themed Tailwind utilities/CSS vars, so they
  flip automatically. The in-canvas game rendering itself (sky, terrain,
  ship, critters) stays a fixed dark space palette by design — it's outer
  space, and a moon-lander cockpit reading dark regardless of site chrome
  is the more honest choice, the same way most games don't re-skin their
  viewport to match OS light mode.

## Outside widget — weather, sunset & ISS pass (v6)
Expanded from a compact 4-stat grid into a fuller "what's happening outside"
panel, still zero API keys, all client-side `fetch()`:
- **Weather (Open-Meteo):** current temp as the hero stat; feels-like,
  humidity, wind speed+direction, UV index, today's high/low, precipitation
  chance, and cloud cover as a secondary grid.
- **Sunset arc:** a horizon-to-horizon SVG arc graphic — sun position
  interpolated between sunrise/sunset (progress-along-arc, not full solar
  ephemeris — consistent with the widget's existing "good enough, no
  dependencies" moon-phase math), golden-hour windows highlighted near each
  horizon end, exact sunset time labeled. Re-renders every 2 minutes.
- **ISS next-pass arc:** replaced the old "distance/altitude overhead"
  numbers (removed — not that meaningful without visualizing the actual
  sky path) with next visible-pass prediction from Pollux Labs'
  `iss-api.polluxlabs.io` (free, no key, CORS-enabled; SGP4/Skyfield against
  fresh Celestrak TLEs — the direct successor to Open Notify's `iss-pass`
  endpoint, which was retired). Shows rise/set compass direction and time,
  duration, peak elevation, on the same horizon-arc visual language as the
  sunset graphic for consistency. The ISS icon sweeps gently along the arc
  on a slow sine loop — illustrative of the pass's path, not a real-time
  countdown, since the pass itself may be hours or days out.
- Both arcs use `var()`/`rgba(var(--color-*-rgb), α)` directly in SVG
  presentation attributes, so they re-theme with light/dark for free.

## Moon Lander (`/game`)
A full canvas-based roguelite mini-game, styled to match Hearthwood rather
than a typical neon arcade aesthetic — warm terrain fill, campfire-colored
ship flame, moss/terracotta HUD accents, a gradient-shaded hull with cockpit
glass and side fins. Ten hand-tuned levels of escalating difficulty (gravity,
wind, terrain shape, fog-of-war, moving pads, drifting asteroids, and — in
the last four levels — patrolling UFOs that telegraph and fire aimed shots),
procedural terrain seeded per level so layout is consistent across runs, plus
seeded decorative alien wildlife (little cow- and scurrier-shaped critters)
grazing the surface, purely cosmetic. Landing successfully offers a pick of
1-of-3 roguelite upgrades that persist for the rest of the run; crashing ends
the run and shows a stats recap. All sound — SFX plus a slow, evolving
ambient score in the spirit of old Metroid Prime environmental music (sub
drone, filtered pad, sparse metallic pings, synthetic reverb) — is
synthesized live via the Web Audio API, no audio files; a mute toggle
persists via localStorage. Touch controls appear automatically on
narrow/coarse-pointer viewports, canvas height clamps on short/landscape
mobile screens, and the game's tile is excluded from the site-wide
magnetic-hover effect so the viewport itself never drifts with the cursor
mid-flight. Keyboard (arrows/WASD/space) is primary on desktop.

**Selfie cockpit (v6):** a "take a pilot selfie" link on the title screen
opens a circular live camera preview (`getUserMedia`, mirrored like a real
mirror); "Snap" crops the frame to a circle and stores it in memory for the
session. The ship's hull was redesigned from a plain triangle to a bulbous
dome specifically to give the cockpit window room to be large enough that
the selfie actually reads as a face during flight, not a decal. No camera →
falls back to a simple helmet-silhouette default. "Change photo" retakes;
otherwise the same photo carries across levels and across restarts within
the session (not persisted to disk/localStorage — intentionally session-only).

## v7 — Professional polish pass (2026-07-01)

**Motion principle: composite, never repaint.** Every ambient animation now
animates `transform`/`opacity` only (GPU-composited). Removed the three
flash/stutter sources: (1) hero lava-lamp blobs no longer animate
`border-radius` under a 46px container blur — softness is baked into each
blob's radial gradient, shapes are static, only long-period (30–48s)
transform drift remains; (2) the animated Houdini `@property` gradient angle
on `.gradient-text` is gone — fixed 135° gradient (animating it repainted
the clipped text every frame, a known flicker source); (3) `flicker-hover`
and scroll-velocity skew/blur removed entirely — deliberate flicker reads as
a defect, not a flourish. Scroll reveals lost their rotate() tilt; page
transitions are a clean fade + rise with no SVG turbulence displacement.

**Outside widget as instrument panel.** One header row (live dot, location,
opt-in location button) → current conditions (large temp + condition +
feels/H/L, then a hairline-divided six-cell stat strip: humidity, wind, UV,
rain, clouds, moon) → two matching sky charts. The ISS chart now plots the
real predicted pass: a static trajectory whose apex height is the pass's
peak elevation on the same scale as the dashed reference dome (90° = dome
top), with rise/set compass labels and times. The old ping-pong animated
dot (pure decoration) is gone. Sun chart gained sunrise/sunset time labels.

**Moon Lander v7.** Fixed the moving-pad bug (pad travel origin was mutated
alongside the pad edges, so the reversal check never fired and the pad slid
under the terrain — the pad now ping-pongs across a pre-flattened corridor
it can never leave). All 10 levels re-audited: fog levels don't stack UFOs,
pad-travel corridors are clamped inside canyon floors, terrain blends into
pad edges instead of cliffing. Upgrade system expanded to 12, each with an
explicit tradeoff (weight → gravity, power draw → fuel burn, handling →
rotation/wind) shown as ▲/▼ lines on the pick cards; benefits always
outweigh costs, and stat clamps keep stacked drawbacks from ever bricking
the ship. New: Storm Dampeners, Fuel Scoop, Precision Jets, scanner
guidance line that punches through fog, and an on-canvas wind indicator.

## v8 — Moon Lander overhaul (2026-07-01)

Endless roguelite: the fixed 10-level array is now a deterministic procedural
generator (`levelConfigFor(idx, difficulty)`) — pressures unlock on a schedule
(wind → asteroids → canyon → moving pads → fog → UFOs), ramp over ~15 levels,
then creep forever under hard caps. Three difficulty modes (Cadet/Pilot/Ace)
retune gravity, wind, pad width, hazard counts, and landing tolerances in
parallel; best level persists per mode in localStorage.

Mobile-first sizing: canvas fills its container (full-bleed through the page
gutters below 720px), goes taller on portrait (aspect 1.15 vs 0.62), and the
ship render/collision scale (1.35–1.8x) tracks canvas width so it reads
everywhere. Touch buttons enlarged.

Reactive pilot: selfie eyes/mouth located once at capture via the FaceDetector
API (proportional fallback — the capture UI centers the face), then the
cockpit re-renders expressions live by resampling photo regions: bulged eyes +
dropped jaw under thrust, squinted eyes + lifted mouth corners on touchdown
(1.25s celebration with confetti before the upgrade pick). The default
no-selfie pilot is a cartoon face with the same three moods.

Graphics: twinkling starfield + seeded planet (some ringed) + background ridge
silhouette per level, platform-style pad with deck hatching and blinking
beacons, layered flame with radial glow, ground dust when thrusting low,
screen shake on impacts, level intro banner listing the level's hazards.

Audio: thrust is now looped noise through an LFO-wobbled bandpass + sub osc
(was a bare lowpassed sawtooth — the "low hum"). Landing/crash/laser one-shots
have real envelopes. Music adds minor-add9 chord swells and pentatonic plucks
through a feedback delay over the existing drone/reverb. SFX and music have
SEPARATE toggles (🔊/🎵) persisted as lander-sfx / lander-music (legacy
lander-muted migrates).

## v9 — Bigger pilot, fair fog, rarity powerups (2026-07-01)

Ship scale raised to 1.6–2.3x (canvas-width scaled) with a ~30px cockpit so
the live pilot expressions are unmissable. Fog reworked from "near-black wall
with a small hole" to a fair veil: lighter (0.74 vs 0.88), bigger visibility
bubble (~240px+), terrain silhouette faintly readable through it, and the
pad's beacon lights pulse through the murk. Scanner remains the hard counter.

Upgrades: 19 total across five rarity tiers — common (tan), uncommon (green),
rare (blue), epic (purple), legendary (gold) — with weighted drops
(100/55/22/9/3.5; owned upgrades roll at half weight). Rare+ cards render
with tier-colored borders and glow; a fanfare sting plays when one is
offered (bigger for epic, full shimmer for legendary). New wacky powerups:
Jalapeño Injectors (rare — +30% thrust, spicy-green exhaust / +12% burn),
Boomerang Hull (rare — bounce off terrain once per level / −15 fuel per
bounce), Alien Embassy Plates (rare — UFOs hold fire and run green lights /
gravity +5%), Chrono Crystal (epic — world runs 75% speed below 120m / fuel
drains at full speed), Overdrive Core (epic — +55% thrust +20% rotation /
+22% burn), Phoenix Feather (legendary — one golden-flash revive per run /
−10 max fuel), Star Core (legendary — all stats +12%, gravity −8%, golden
aura / UFO shots 20% faster). All crash paths route through a single
destroyShip() so the Phoenix intercepts terrain, asteroid, and projectile
deaths alike.

## v10 — Volume, worldwide leaderboard, ship modules, achievements, Hangar Shop (2026-07-01)

Sound: independent volume sliders for SFX and music (below the canvas, next
to the mute toggles), persisted as lander-sfx-vol / lander-music-vol and
applied through per-channel master gain buses.

Global leaderboard: a pre-bundled Netlify Function (netlify/functions/
scores.mjs, esbuild + @netlify/blobs, strong consistency) serves GET/POST
/api/scores backed by Netlify Blobs. One row per pilot name+difficulty
(keeps best), top 100 stored, top 25 served. Client: post from the crash
screen (pilot name persisted), browse from the start screen; degrades
gracefully to local bests if the endpoint is unreachable. CRITICAL deploy
note: manual deploys replace everything, so every deploy zip MUST include
netlify.toml + the bundled function or the API vanishes.

Ship modules: every owned upgrade adds visible hardware — saddle tanks,
aux nozzles, belly magnet, spinning gyro ring, slung anchor, shoulder dish,
feathered struts, chute pack, vent slats, nose intake, RCS pods, jalapeño
decal, boomerang chevron, embassy antenna (pulsing green orb), orbiting
chrono crystal, glowing overdrive core, gold feather decal, spinning nose
star, and an idle shield shimmer.

Achievements: 15, persisted locally, +25✨ each, unlocked via landings,
milestones (5/10/20, Ace-5), style (feather touch, bullseye, fumes,
time-lord), and events (legendary pull, phoenix revive, bounce, selfie).
In-canvas toast queue announces unlocks.

Hangar Shop: cosmetics bought with Stardust earned per landing
((5 + 2×level) × difficulty multiplier; achievements pay a bonus) — 6 hull
paints, 6 thruster trails (incl. animated Prism rainbow and Stardust), 4 sky
themes that recolor sky/stars/planet. Owned/equipped persisted locally.
Real-money Stardust packs are deliberately NOT wired: that requires a
payment provider account only Adam can create; the catalog/price data model
is ready for it.

## v10.1 — Fog removed, bigger playfield, shop scroll fix (2026-07-01)

Fog is disabled (config plumbing, overlay renderer, and beacon-pulse code all
kept dormant for a future gentler variant); level 8 renamed Ashen Fog →
Ashen Plains; Scanner re-described as the pad guidance line. Playfield now
spans the full page column (max-w-4xl wrapper removed) with the canvas cap
raised 1000 → 1200px. Fixed the overlay clipping that truncated the Hangar
Shop: flex items-center clips the top of overflowing content, so the overlay
now centers via m-auto on the child, which keeps tall screens fully
scrollable.
