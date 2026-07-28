---
version: v11
name: Tomfoolery — Hearthwood Light
description: A warm editorial personal hub with a living West Texas almanac, quietly tended collections, and high-contrast paper typography.
colors:
  canvas:    "#FAF6EE"   # warm paper
  surface:   "#FFFFFF"   # cards
  surface-2: "#F4ECDD"   # raised / hover paper
  text:      "#221A12"   # warm near-black
  muted:     "#6F604A"   # AA secondary copy on all paper surfaces
  border:    "#E7DCC8"   # ruled paper border
  accent:    "#C2673A"   # terracotta graphics / focus
  accent-2:  "#5F7A45"   # moss graphics
  signal:    "#7C9A2E"   # live-state graphics
  gradient:  "linear-gradient(135deg, #A64E28 0%, #886018 50%, #56703D 100%)"
typography:
  display:
    fontFamily: "Space Grotesk Variable"
    fontWeight: 600
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Space Grotesk Variable"
    fontWeight: 600
  body:
    fontFamily: "Inter Variable"
    fontWeight: 400
    lineHeight: 1.65
  mono:
    fontFamily: "JetBrains Mono Variable"   # labels, timestamps, live data
spacing:
  base: 4px        # scale: 4, 8, 12, 16, 24, 32, 48, 64
rounded:
  sm: 0px
  md: 2px
  lg: 4px
---

## Overview
A personal hub that feels like a living almanac laid out on a warm studio
table: paper, field notes, collections, and the weather moving outside. It is
cinematic without becoming a visual-effects demo and emotional without
sacrificing legibility. The single light theme keeps strong editorial bones —
clear hierarchy, generous spacing, ruled details, and restrained motion — so
the site reads as considered rather than rustic-cluttered.

## Colors
Warm cream canvas, white cards, and dark walnut copy form the permanent paper
palette. Terracotta, old gold, moss, and olive carry the golden-hour identity.
The brighter accent values belong to borders, focus rings, charts, and small
graphic signals. Actual text uses the darker `accent-ink`, `gold-ink`,
`moss-ink`, and `signal-ink` variants. `#6F604A` is the only muted text color;
the older `#8A7B65` survives as `faint` for non-text decoration because it does
not meet normal-text contrast on the paper surfaces.

## Typography
Space Grotesk for display/heading, Inter for body, and JetBrains Mono for
data/labels. The Latin variable cuts are self-hosted from Fontsource and use
`font-display: swap`; the site makes no Google Fonts request. Functional mono
labels stay at least 12px.

## Spacing
Unchanged: 4px base, generous tile padding (24–32px), breathing room.

## Components (v3 — sharpened)
- **Tiles (bento):** white paper surface, warm 1px rule, and a restrained 10px
  card radius. On hover: small lift + accent border, 250ms spring-ish ease.
  Controls and small elements retain the sharper 0–4px scale.
- **Buttons:** gradient fill for primary; ghost (border only) for secondary. Sharp corners.
- **Links:** gradient underline that animates in on hover.
- **Badges/tags:** mono font, small, muted tan — "live"/active states use signal olive.
- **Hero motes:** three tiny, contained embers around the greeting. They move
  only with transform/opacity and never become a full-page particle field.
- **Glass nav:** a compact sticky index with all seven primary destinations
  visible on desktop. Phones keep `now` and `play` immediate and place the
  remaining sections in a native `index` disclosure, preserving the short
  header and keyboard semantics. The paper veil uses blur+saturate so content
  still passes beneath it without compromising the small mono link contrast.

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

## Theming — Hearthwood Light
There is one CSS-custom-property-driven light theme. Tailwind's `@theme`
registers the warm-paper tokens so utilities and hand-written components share
the same source of truth. Do not restore the removed dark-mode toggle: the
photographic almanac already carries its own authored day/night contrast
treatment, while the surrounding site remains a stable editorial surface.
The in-canvas Moon Lander continues to use a fixed space palette by design.

## Outside — living almanac (v11)

A cinematic/editorial field report fixed to Breckenridge, Texas. The background
is a 32-frame photographic atlas: clear, scattered, overcast, and storm weather
families across night, predawn, sunrise, morning, noon, golden hour, sunset, and
blue hour. Local solar calculations choose the authored moment; live Open-Meteo
conditions choose its weather family.

- **Photographic, not synthetic.** No CSS/SVG landscape, procedural cloud
  volume, or baked celestial object. Two decoded raster slots hold only the
  current and next plate and make a short opacity handoff near a solar boundary.
- **Living celestial truth.** Local astronomy updates the daylight countdown,
  textured Moon-phase portrait, and rolling 24-hour chart once a minute. The
  fixed-camera plate has no calibrated bearing or field of view, so the browser
  does not pretend to project a free-moving celestial body into it. The shared
  SVG is data visualization only. Its window runs from six hours behind now to
  eighteen hours ahead; strong above-horizon Sun and Moon curves become quiet
  dotted continuations below the horizon and pass through a labelled midnight
  without a calendar-day seam. A thin Open-Meteo temperature model shares the
  same time axis in the chart's lower band and uses a minimum 12°F display
  range so small fluctuations are not exaggerated. The formal language says
  "above horizon" because weather and daylight still govern real-world
  visibility.
- **Sunset potential, not a promise.** The next real astronomical sunset is
  sampled against low-, mid-, and high-cloud layers, rain probability, and
  storm codes. The tested heuristic reports Promising, Mixed, Subtle, or
  Obscured; incomplete layer data reports unavailable. It never claims a
  colorful sunset or clear view as fact.
- **Editorial hierarchy.** Location masthead → large current conditions →
  sunset/sunrise countdown → paper-ledger Night Watch and fixed chart key →
  rolling celestial and temperature field lines → lunar visibility sentence →
  one ruled four-chapter ledger (Exposure, Air, Water, Sunset potential) → ISS
  sentence. The Moon
  portrait no longer floats over the photographed landscape. Local warm/dark
  washes protect the copy without flattening the whole image. The desktop
  calibration above 1080px uses a 1440×200 plot and a 680–760px band; tablet
  retains 1440×240, while mobile retains its taller 600×240 plot and split
  composition.
- **Truthful location scope.** The old geolocation control is removed until
  another location has its own atlas; Texas imagery must never be relabeled as
  New York or another city.
- **Mobile art direction.** A 460px cinematic scene hands off to Night Watch,
  the full-width non-scrolling chart, and the ledger on warm paper. Supporting
  type stays at least 12px and the chart uses a dedicated 600×240 coordinate
  system. Every plate has real condition-aware crops at 720×960 for narrow
  phones and 960×768 for wider mobile.
- **Progressive enhancement.** The photographic solar moment, daylight
  countdown, lunar phase, and celestial chart work with no network. The
  current plate request starts before the low-priority Moon texture and
  deferred ribbon/ISS work. Weather refreshes every 15 minutes; a fully
  validated 30-minute snapshot can fill a repeat visit immediately and is
  visibly labelled as a recent reading while the live refresh runs. ISS
  remains optional.

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
