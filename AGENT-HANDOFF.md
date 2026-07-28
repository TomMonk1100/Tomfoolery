# Agent handoff — tommuncie.com

You have been asked to work on Adam's personal site. This document is
everything you need. Read all of section 1 before touching anything.

Live at **https://tommuncie.com**. Updated 2026-07-27. Run `git log --oneline -5`
for where things actually stand — this file describes the shape of the project,
not a snapshot of its history.

---

## 1. How to ship — read this first

### The one rule

**Commit to git and push to `main`. Never deploy any other way.**

```bash
git add <specific paths>
git commit -m "..."
git push origin main          # Netlify builds and publishes automatically, ~15s
```

That's it. The site is git-linked to `github.com/TomMonk1100/Tomfoolery`.
Pushing to `main` triggers a Netlify build. There is no separate deploy step.

### What went wrong this morning, so you don't repeat it

On 2026-07-26 another AI tool was asked to add a photo gallery. It built the
pages inside **its own copy** of the project and published that copy directly
with the Netlify CLI. Its copy was made from a pre-July-3 snapshot, so
publishing it **silently deleted from the live site**:

- the entire `/archive` section (30 blog posts + 14,684 tweets)
- all the `netlify.toml` redirects
- the `/api/scores` serverless function, which broke the game's leaderboard

Nobody noticed until Adam did. Recovery took scraping the published HTML off
the live site to rebuild what had been lost.

**The lesson is not "be careful with the CLI." It is: never publish build
output. Only ever push source to git.** A `netlify deploy` replaces the whole
site with whatever is in your working directory — anything not in your copy
ceases to exist in production.

### Therefore, never do any of these

| Don't | Why |
|---|---|
| `netlify deploy` / `netlify deploy --prod` | Replaces the entire live site with your local copy. This is exactly what broke it. |
| Drag-and-drop deploy at app.netlify.com | Same failure mode. |
| Netlify MCP `deploy-site` | Same. Also fails from sandboxes with opaque 400/404s. |
| Publish `dist/` anywhere, ever | `dist/` is build output. Netlify builds it itself. |
| `git add -A` or `git add .` | See §5 — sweeps in unrelated files and a 7MB photo folder. |
| `git push --force` | No. |
| Commit `HANDOFF.md` | Gitignored deliberately. Leave it alone entirely — do not read it, move it, or reference it. |

### Before every push, run

```bash
npm run verify      # atlas/assets gates + typecheck + 232 tests + production build
```

Every gate must pass. `verify` checks the photographic atlas, content image
paths, tracked social cards, types, tests, and production build; if any step fails, fix it before
pushing — a broken build means Netlify publishes nothing and the site silently
keeps serving the previous version. `netlify.toml` runs the same `verify`
command so the production build cannot bypass the atlas/test gates.

### After every push, verify live

Do not assume the deploy worked. Netlify has published broken states before.

```bash
sleep 30
for u in / /coffee /archive /archive/tweets /now /about /art /pokemon /game \
         /api/scores /robots.txt /sitemap-index.xml; do
  echo "$(curl -s -o /dev/null -w '%{http_code}' -L https://tommuncie.com$u)  $u"
done
# every one must be 200

# the archive is the canary — it must report exactly 30
curl -sL https://tommuncie.com/archive \
  | grep -oE 'href="/archive/blog/[a-z0-9-]+"' | sort -u | wc -l
```

If `/archive` returns anything other than 30, or `/api/scores` is not 200,
**stop and tell Adam** — that is the signature of the failure above.

---

## 2. Project shape

Astro 7 + Tailwind 4. Static output. Node ≥ 22.12.

```
src/
  components/Outside.astro      the weather/info band  ← main work area
  components/EntryTrail.astro   newer/older + contextual content navigation
  layouts/Layout.astro          shell: head/meta, nav, footer
  pages/                        index, about, now, coffee, art, pokemon,
                                archive/, game, 404
  scripts/sky/                  astronomy, plate selection/compositor, ribbon
    astro.ts  plates.ts  plate-compositor.ts  outside-controller.ts forecast.ts
    sky.ts  ribbon.ts  __tests__/
  scripts/lander/               the Moon Lander game  ← second work area
    main.ts physics.ts entities.ts levels.ts upgrades.ts abilities.ts
    render/  audio/  ui/  __tests__/
  styles/global.css             design tokens + component classes
  content/                      markdown collections (now, pokemon, art, pastBlog)
netlify/functions/scores.mjs    leaderboard API, /api/scores
scripts/build-social-cards.mjs  tracked 1200×630 card generator + size guard
scripts/check-content-assets.mjs frontmatter image-path release guard
understory/                     DEAD PROJECT — see §5. Do not touch.
```

Commands:

| Command | What |
|---|---|
| `astro dev --background` | Required background-mode local dev server |
| `npm run build` | Verify tracked social cards + production build to `dist/` |
| `npm run build:social-cards` | Explicitly refresh the tracked section cards |
| `npm run build:sky-plates` | Rebuild and budget-check the photographic atlas |
| `npm run check:content-assets` | Fail on broken content frontmatter image paths |
| `npm run check:social-cards` | Verify the tracked homepage/section cards are 1200×630 |
| `npm run check:sky-plates` | Verify every plate path, hash, dimension, and budget |
| `npm test` | 232 tests (`src/scripts` only) |
| `npm run typecheck` | `astro sync && tsc --noEmit` |
| `npm run verify` | Atlas/content gates + typecheck + tests + social cards/build. |

---

## 3. Work area A — the Outside band (the priority)

`src/components/Outside.astro` plus `src/scripts/sky/*`. It is a **full-bleed
living almanac fixed to Breckenridge, Texas**. A 32-frame photographic atlas
(four weather families × eight astronomical moments) supplies the scene while
local astronomy drives slice selection, the daylight countdown, the textured
Moon-phase portrait, and the shared sun/Moon/temperature chart. The plot is a rolling
24-hour window from six hours behind now through eighteen hours ahead. Solid
above-horizon curves join faint below-horizon continuations across midnight,
while the paper-ledger Night Watch row gives the interpolated local lunar
visibility window without placing a false Moon in the photographed landscape.
Open-Meteo's hourly model adds a restrained temperature trace, and cloud layers
around the next real sunset produce an explicitly heuristic sunset potential.

### Architecture

- `scripts/sky/astro.ts` — sun/moon altitude & azimuth, moon illuminated
  fraction, moon terminator path. Standard low-precision astronomy (Meeus
  ch. 25/47). **No API, no key.**
- `scripts/sky/plates.ts` — pure Breckenridge solar schedule, weather-family
  classification, stable atlas keys, and short slice boundaries.
- `scripts/sky/plate-compositor.ts` — two decoded raster slots, current/next
  preloading, race cancellation, graceful retention, and reduced-motion
  handling.
- `scripts/sky/ribbon.ts` — geometry for the shared 24-hour axis.
- `scripts/sky/forecast.ts` — safe Unix-hour parsing, temperature-trace
  geometry, and the tested sunset cloud-layer heuristic.
- `scripts/sky/outside-controller.ts` — DOM/data lifecycle, local astronomical
  frame, lunar portrait, chart, Open-Meteo, and ISS enhancement.
- `components/Outside.astro` — semantic editorial markup only.
- `assets/sources/outside/` — full-resolution masters, prompts, anchors, and
  contact sheet. `npm run build:sky-plates` deterministically writes the
  budgeted AVIF/WebP delivery matrix to `public/images/outside/plates/`.

The atlas is intentionally Breckenridge-only for now. Do not relabel these
Texas images as another city or restore the old geolocation button until a
second location atlas exists. Weather (Open-Meteo) and ISS passes are
**progressive enhancement only** — with no network the current photographic
moment, Moon phase, daylight countdown, and ribbon remain correct. Keep the
astronomy local; do not move it behind a fetch. The fixed-camera plates have no
calibrated bearing or field of view, so do not project a free-moving sun or Moon
into the photograph; the live celestial truth belongs in the readouts and chart.

### Load-bearing constraints — do not "simplify" these

**Do not continuously blend the generated landscapes.** Small authored
vegetation and cloud differences double-expose if two frames overlap for
minutes. `plateFrameAt()` chooses a sharp nearest slice; the compositor only
makes a short decoded photographic handoff near the astronomical boundary.
It preloads the current and next frame only.

**The photographic wash is functional.** The scene uses localized warm or
dark washes behind copy and a ruled translucent ledger. Do not replace them
with one global gray film, and do not remove them without checking contrast
against all 32 plates.

**The moon terminator direction.** The dark path bows toward the dark limb when
gibbous and toward the lit limb when crescent. Backwards renders a 91% moon as
59% dark. Tested by measuring drawn area against the target fraction.

**`.full-bleed` requires `overflow-x: clip` on `html, body`** (in
`global.css`). `hidden` also stops the overflow but creates a scroll container
and silently breaks the sticky nav.

**Ribbon geometry is responsive and rolling.** Desktop above 1080px uses a
restrained 1440×200 coordinate system; tablet keeps 1440×240 and mobile keeps
the taller 600×240 geometry so the full 24-hour window stays full-width and
readable without horizontal scrolling. Type and marker radii scale by
`geometry.width / svg.clientWidth`; non-scaling strokes retain their authored
CSS-pixel weight. The temperature trace shares that time axis but stays in the
otherwise-unused lower band; its display range is at least 12°F so tiny changes
never look dramatic. Timeline ticks come from real Breckenridge instants, not fixed
minute-of-day values, so midnight and DST are transitions rather than chart
seams.

**Moon visibility means geometry, not a clear-sky promise.** The Moon curve and
Night Watch window represent when it is above the Breckenridge horizon. Cloud
and daylight can still prevent an actual sighting, so keep the formal wording
as "above horizon." Keep event copy outside the SVG; putting long rise/set text
on the plot clips on narrow viewports.

**Sunset potential is a model, not a promise.** It is calculated from
proximity-weighted low/mid/high cloud layers, rain probability, and storm codes
within 90 minutes of the next actual sunset. Keep the label "Sunset potential"
and the Promising/Mixed/Subtle/Obscured vocabulary. If fewer than two complete
samples exist, say the layer data is unavailable; never invent a quality.

**Mobile is a split composition.** The image stage is 460px tall; the chart,
Night Watch, four field-note chapters, and ISS line continue on warm paper below
it. The photographed hero contains the daylight countdown but not the lunar
portrait. Mobile plate crops are real art-direction variants, not browser crops
of the panoramic desktop file: 720×960 for narrow phones and 960×768 for wider
mobile.

**Motion rule (site-wide, learned from a real bug): animate only `transform`
and `opacity`. Never animate paint properties under a `filter`.** Doing so
caused a hero-flashing bug that took a full redesign pass to find. Plate
handoffs follow this rule and become immediate under `prefers-reduced-motion`.

### Known API gotcha

The polluxlabs ISS response nests peak elevation at
`culmination.elevation_deg`. There is no flat `max_elevation` — reading that
silently renders "0° up". This was a real bug, already fixed; don't reintroduce it.

### Ideas already scoped, not yet built

Adam wants this area sharper. These were offered and not done:

1. **Air quality** — Open-Meteo, same no-key CORS setup. Relevant in Texas.
2. **Live radar** — RainViewer has free tiles, no key.
3. **Drop the polluxlabs dependency** — compute SGP4 client-side from
   Celestrak TLEs (`satellite.js`, ~30kb). Removes a hobby-proxy single point
   of failure and unlocks a week of passes plus Starlink trains.

---

## 4. Work area B — Moon Lander

`src/pages/game.astro` (shell) + `src/scripts/lander/` (logic).
Endless procedural canvas-2D roguelite. ~130 tests. Leaderboard at
`/api/scores` via `netlify/functions/scores.mjs` + Netlify Blobs.

### Decisions to preserve unless Adam says otherwise

- **Fog is disabled.** Reworked twice; Adam still found it unplayable and said
  "take it out for now." Plumbing is dormant (`cfg.fog`, overlay renderer,
  beacon pulses). **Do not re-enable without asking.**
- **Two touch layouts**, toggled by `[data-action="toggle-controls"]` and the
  🎮 button, persisted in `localStorage` key `lander-touch-layout`: `corner`
  (default) and `classic` (added for Scott, a Discord playtester). Three
  `[data-tc-zone]` containers; `applyTouchLayout()` re-seats the same button
  nodes so listeners survive. **Don't collapse back to two zones.**
- **Portrait-first.** Landscape works but wasn't specially designed; Adam
  deprioritised it.
- **Fuel is a chip in the top HUD row, not a bottom bar.** A bottom bar
  collided with terrain, whose `groundBase` sits ~72% down and varies by level.
- **Canvas sizing:** portrait `aspect` 1.45, `maxH` 0.78 of viewport. These two
  bind against each other — raising one alone just changes which one is
  binding. Resize reads `visualViewport.height`, not `window.innerHeight`, so
  the canvas doesn't jump when the mobile address bar collapses.
- **Ship spawn is `Math.max(40, height*0.05)`** — can't go higher without
  spawning behind the ~32px top HUD row on short mobile canvases.
- **`#lander-root` is excluded from the site's tile hover effects.** Re-adding
  it makes the viewport drift toward the mouse mid-flight.
- Overlay/modal centring: use `m-auto` on the child, **not**
  `flex items-center` — the latter clips content taller than the container and
  makes it unscrollable.

### Testing the leaderboard

Hit `/api/scores` directly in a browser to see crash stacks. POST test entries
with the name `TEST PILOT` — it's filtered out of displayed results.

---

## 5. Traps specific to this repo

**`understory/` is a dead project.** A Phaser game Adam has retired. It is
still in the tree but is **not** part of the Astro build, must **not** be
linked from the site, and should not be worked on. It is excluded from
`tsconfig.json` and from `npm test` — if you widen either, you will inherit
405 pre-existing type errors that have nothing to do with your work. An agent
already made the mistake of treating "Understory isn't linked from the hub" as
a bug and wiring it in; that was reverted.

**Never `git add -A`.** It stages the whole repo regardless of your working
directory. `public/uploads/` holds ~7MB of unoptimised phone originals that are
deliberately gitignored, and running `git add -A` from a subdirectory has
previously swept in unrelated uncommitted work. Always name paths explicitly.

**`HANDOFF.md` is gitignored and stays that way.** Don't commit it, don't move
it, don't open it.

**The two places the domain is written down** are `site` in
`astro.config.mjs` and the `Sitemap:` line in `public/robots.txt`. They drive
canonical tags, all 45 sitemap URLs and the Open Graph image URL. Change them
together or not at all.

**Content decisions that look like omissions but aren't:**
- `/archive` deliberately excludes replies, retweets, and 6 unpublished draft
  posts. They're personal and were never published. Don't add them.
- `/photos` and `/retreats` 301 to `/now` (a deliberate July 3 restructure).
  Those redirects stay.
- **`/coffee` must never redirect.** It briefly 301'd to `/now` during that
  restructure; it is a real page again (the latte gallery). Re-adding that rule
  silently sends every visitor away from the gallery.

**If the sandbox you're in can't delete files** (`unlink` returns EPERM on the
synced folder, which breaks `astro build` and leaves stranded `.git/*.lock`
files): clone to `/tmp`, work there, commit and push from there. `/tmp` has
full permissions. Rename stray locks rather than deleting them:
`mv .git/index.lock .git/index.lock.bak`.

---

## 6. Design system

`DESIGN.md` at the repo root is the full spec. Tokens live in
`src/styles/global.css` under `@theme`.

The homepage's **Recently Tended** row is build-time content, not a second CMS:
`index.astro` chooses the newest Now, Art, Pokémon, and old-blog entry with a
stable ID tie-break. Detail pages use `EntryTrail.astro` for unambiguous
newer/older navigation and small contextual paths into neighboring sections.

`Layout.astro` owns canonical, Open Graph, Twitter, article-date, image-alt,
and noindex metadata. Every major section passes a 1200×630 image from
`public/images/social/`; detail pages reuse their section card while retaining
their own title, description, canonical URL, type, and published time.
`npm run build` verifies every tracked card before Astro runs; refresh them
explicitly with `npm run build:social-cards` after changing the card brief.
The image-generated homepage card is the tracked `public/og.png` master.

Theme is **Hearthwood Light** — a single warm light theme. The old dark
"Prism" magenta/cyan palette and the whole `[data-theme]` toggle were
deliberately removed. **Do not reintroduce dark mode or a theme switcher.**

```
canvas    #FAF6EE   warm paper        ink       #221A12   warm near-black
surface   #FFFFFF   cards             muted     #6F604A   readable secondary text
line      #E7DCC8   borders           accent    #C2673A   terracotta
accent-mid #B8862E  gold              accent-2  #5F7A45   moss
signal    #7C9A2E   graphical signal  faint     #8A7B65   decoration only
```

Actual text accents use the darker `accent-ink`, `gold-ink`, `moss-ink`, and
`signal-ink` tokens; do not use the brighter graphical accents for small text.
Type: self-hosted variable Space Grotesk (display), Inter (body), and JetBrains
Mono (labels/data). There is no Google Fonts request.
Corners are sharp — radius tokens are 0/2/4px. No pill shapes, no large soft
rounding.

Site persona is **"Tom," not Adam.** All site copy says Tom.

---

## 7. Working style Adam expects

He describes himself as not knowing much about web development, and wants
agents to build and decide autonomously rather than asking about
implementation details. He has standing permission for you to **push to
production without asking**, provided `npm run verify` passes and you
curl-verify the live site afterward.

Loop him in only for things that need his own hands: accounts, payments,
domain/DNS changes, and supplying his own photos or collection data.

Two things he values, learned from experience with agents on this repo:

- **Say what you actually did, including what didn't work.** Don't report
  success you haven't verified.
- **Verify his recollections against the repo.** He has described past fixes
  that turned out never to have been made — check `git log` before assuming
  prior work landed.
