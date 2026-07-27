# Breckenridge sky plate prompt set

The complete matrix was generated with the built-in image generation workflow
as controlled `lighting-weather` edits.

## Canonical edit target

`../anchors/breckenridge-noon-clear.png`

Every prompt treated this image as the geometry authority and repeated the same
invariants:

- Preserve the fixed camera and 1983 × 793 panoramic crop.
- Preserve the horizon, Hubbard Creek water, hills, tree positions and
  silhouettes, foreground geometry, proportions, and left-center copy space.
- Change only sky weather, atmospheric light, exposure, and time-of-day color.
- Keep a premium photorealistic editorial landscape treatment.
- Exclude visible sun, moon, stars, artificial lights, text, people, buildings,
  roads, logos, and watermarks.
- Avoid fantasy rendering, exaggerated HDR, flat cloud ceilings, crushed
  foregrounds, game-engine imagery, and camera or geography changes.

## Time prompts

| Moment | Lighting direction |
| --- | --- |
| `night` | Deep navy night with readable cool landscape separation and no celestial objects. |
| `predawn` | Cobalt or steel-blue sky with restrained lavender and faint warm horizon light. |
| `sunrise` | Soft coral, peach, pale gold, and dusty rose from below the horizon; no visible solar disc. |
| `morning` | Crisp early daylight with fresh atmospheric clarity and restrained warmth. |
| `noon` | Neutral high daylight with realistic color and clear distant depth. |
| `golden` | Low late-afternoon warmth, long soft shadows, and controlled amber edge light. |
| `sunset` | Sun below the horizon, warm afterglow transitioning into cool upper sky. |
| `blue-hour` | Post-sunset cobalt, slate blue, and cool lavender before full night. |

## Condition prompts

| Condition | Weather direction |
| --- | --- |
| `clear` | Open sky with no clouds beyond extremely faint distant atmospheric wisps. |
| `scattered` | Naturally scaled separated cumulus and thin high cloud with dimensional cool undersides; never a close ceiling. |
| `overcast` | Dry, layered, luminous stratiform cloud with broad-scale depth and soft diffused light; never featureless gray. |
| `storm` | Structured Texas thunderstorm depth with a distant rain shaft; emotionally charged but not apocalyptic, with no lightning or tornado. |

The scattered and storm families also used their approved anchor frames as
weather-character references while retaining the clear-noon master as the
geometry authority. The overcast-noon frame established the overcast weather
character for the rest of that family.
