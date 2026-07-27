# Outside photographic atlas

Source masters for the Breckenridge living almanac.

## Contents

- `anchors/` — the four approved art-direction frames and their prompts.
- `plates/` — 32 full-resolution PNG masters: four weather families across
  eight astronomical moments. `plates/manifest.json` is the stable source
  contract and `plates/contact-sheet.png` is the QA overview.
- `celestial/` — the project-bound raster source used for the photographic
  Moon texture, plus an archived sun-compositing experiment retained for
  provenance.

The plates deliberately contain no baked sun, moon, stars, text, or artificial
weather graphics. They carry authored landscape, light, weather, and atmosphere
only. Because the fixed camera has no calibrated bearing or field of view, the
browser does not project a runtime sun or moon into the photograph. Live
celestial truth appears in the daylight readout, textured lunar portrait, and
semantic twenty-four-hour sun/moon chart.

## Delivery build

Run:

```sh
npm run build:sky-plates
```

This deterministically creates desktop, mobile, and narrow-phone AVIF/WebP
variants under `public/images/outside/plates/`, records their dimensions,
hashes, condition-aware crops, encoder settings, and budgets in the delivery
manifest, and fails if an output exceeds its file-size budget.

The website currently requests WebP for broad compatibility. AVIF siblings are
kept as ready delivery assets for a future type-aware loader.

## Celestial source prompts

The built-in image generation workflow created:

- `moon-chroma.png`: a centered, neutral gray-beige, detailed full Moon on a
  flat green key. The keyed `moon-alpha.png` remains the runtime texture for
  the browser's lunar portrait and phase rendering.
- `sun-screen.png`: an archived ImageGen experiment for a centered, white-gold
  daylight solar disc with a restrained photographic corona fading to pure
  black. It is retained only for source provenance and visual reference; it is
  not copied into or loaded by the production site.

Both final prompts and their source experiments are retained below, but only
the Moon texture is runtime-used. The sun experiment should not be reintroduced
as an in-scene celestial body without a calibrated camera bearing and field of
view. Vector geometry remains reserved for the semantic twenty-four-hour data
chart.

Final prompt set:

> Moon — Create one isolated, centered, photorealistic full Moon disc as a
> neutral phase texture: accurate-looking gray-beige maria and crater detail,
> crisp circular limb, no halo, stars, clouds, fantasy detail, text, or
> watermark, on one perfectly uniform green chroma-key field.

> Sun — Create one isolated, centered, photorealistic daylight sun for
> screen-blend compositing: a slightly overexposed white disc, narrow pale-gold
> edge, delicate irregular white-gold rays, and restrained optical bloom that
> fades completely to a perfectly uniform pure-black field; no colored corona,
> icon styling, graphic starburst, lens-flare polygons, text, or watermark.
