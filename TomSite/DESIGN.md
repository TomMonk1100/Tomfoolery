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
weather moving outside). Not neon, not clinical. Dark by default, but warm
dark: bark and walnut, not black-and-neon. Editorial bones stay (clear
hierarchy, generous spacing) so it reads as considered, not rustic-cluttered.

## Colors
Coffee-bark canvas with walnut surfaces. Terracotta (campfire) is the
primary accent, moss/sage the secondary — together they read as golden-hour
light filtering through trees, not a screen glow. The olive "signal" green
is a quieter cousin of neon lime, reserved for live/active states (matches
the jalapeño-green nod from the original palette, just earthier). Avoid pure
black and pure white anywhere — everything is warmed.

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
- **Ambient blob:** a soft, slow-drifting blurred gradient shape, now with
  organic SVG feTurbulence/feDisplacementMap wobble instead of a plain blur —
  reads as living light, not a static CSS gradient.
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
- **Autonomous orbit field:** small dots drift in slow circular/counter-
  circular orbits around the hero, independent of scroll or cursor — a bit of
  ambient life even when the page is idle.
- **Flicker-hover:** the gradient "Tom" wordmark and nav logo get a brief
  warm-toned flicker (opacity/brightness/saturation steps, not RGB glitch)
  on hover — a candlelight flicker, not a broken-screen glitch, to stay on
  the Hearthwood side of "glitchy."
- **Distortion page transitions:** the existing SVG feTurbulence/
  feDisplacementMap filter now also runs during the view-transition
  fade, so navigating between pages has a subtle organic ripple instead of a
  plain cross-fade. Progressive enhancement — falls back to the plain v3
  cross-fade wherever the filter isn't supported.

## Moon Lander (`/game`)
A full canvas-based roguelite mini-game, styled to match Hearthwood rather
than a typical neon arcade aesthetic — warm terrain fill, campfire-colored
ship flame, moss/terracotta HUD accents. Ten hand-tuned levels of escalating
difficulty (gravity, wind, terrain shape, fog-of-war, moving pads, drifting
asteroids), procedural terrain seeded per level so layout is consistent
across runs. Landing successfully offers a pick of 1-of-3 roguelite upgrades
that persist for the rest of the run; crashing ends the run and shows a
stats recap. All sound is synthesized live via the Web Audio API — no audio
files. Touch controls appear automatically on narrow/coarse-pointer
viewports; keyboard (arrows/WASD/space) is primary on desktop.
