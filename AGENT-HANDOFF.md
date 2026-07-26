# Agent handoff — tommuncie.com

You have been asked to work on Adam's personal site. This document is
everything you need. Read all of section 1 before touching anything.

Live at **https://tommuncie.com**. Written 2026-07-26. Run `git log --oneline -5`
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
npm run verify      # typecheck + 177 tests + production build
```

All three must pass. `verify` is `typecheck && test && build`; if any step
fails, fix it before pushing — a broken build means Netlify publishes nothing
and the site silently keeps serving the previous version.

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
  layouts/Layout.astro          shell: head/meta, nav, footer
  pages/                        index, about, now, coffee, art, pokemon,
                                archive/, game, 404
  scripts/sky/                  solar + lunar math, sky colours, ribbon
    astro.ts  sky.ts  ribbon.ts  __tests__/
  scripts/lander/               the Moon Lander game  ← second work area
    main.ts physics.ts entities.ts levels.ts upgrades.ts abilities.ts
    render/  audio/  ui/  __tests__/
  styles/global.css             design tokens + component classes
  content/                      markdown collections (now, pokemon, art, pastBlog)
netlify/functions/scores.mjs    leaderboard API, /api/scores
understory/                     DEAD PROJECT — see §5. Do not touch.
```

Commands:

| Command | What |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build to `dist/` |
| `npm test` | 177 tests (`src/scripts` only) |
| `npm run typecheck` | `astro sync && tsc --noEmit` |
| `npm run verify` | All three. Run before pushing. |

---

## 3. Work area A — the Outside band (the priority)

`src/components/Outside.astro` plus `src/scripts/sky/*`. Rebuilt today from
scratch. It is a **full-bleed band whose sky is computed from real solar
altitude** — the gradient, sun position, star opacity, horizon colour and text
colour all follow the actual sun for the viewer's location.

### Architecture

- `scripts/sky/astro.ts` — sun/moon altitude & azimuth, moon illuminated
  fraction, moon terminator path. Standard low-precision astronomy (Meeus
  ch. 25/47). **No API, no key.**
- `scripts/sky/sky.ts` — gradient stops by altitude, ridge colours, text
  theme + scrim, UV colour ramp.
- `scripts/sky/ribbon.ts` — geometry for the shared 24-hour axis.
- `components/Outside.astro` — markup and all DOM work, in one `<script>`.

Everything visual is computed locally. Weather (Open-Meteo), ISS passes
(polluxlabs) and reverse geocoding (bigdatacloud) are **progressive
enhancement only** — with no network the sky, sun, moon and ribbon are all
still correct. Keep it that way; do not move that math behind a fetch.

### Load-bearing constraints — do not "simplify" these

**The 0.35 scrim is not decoration.** No single text colour clears WCAG AA
against every sky: around +5° solar altitude the zenith sits at mid-luminance
and *both* dark and light text bottom out near 3.9:1. 0.35 is the smallest
alpha that holds 4.5:1 at every sun angle (worst case 5.3:1). There is a test
asserting that floor. **If it fails, fix the scrim — do not relax the test.**

**The moon terminator direction.** The dark path bows toward the dark limb when
gibbous and toward the lit limb when crescent. Backwards renders a 91% moon as
59% dark. Tested by measuring drawn area against the target fraction.

**`.full-bleed` requires `overflow-x: clip` on `html, body`** (in
`global.css`). `hidden` also stops the overflow but creates a scroll container
and silently breaks the sticky nav.

**Ribbon type scales by viewBox squeeze.** On a 390px phone an 11-unit SVG
label renders at ~4 real pixels. Font sizes and stroke widths multiply by
`RIBBON.width / svg.clientWidth`, and hour ticks thin from every 3h to every
6h. If you add anything textual to the ribbon, scale it the same way.

**Band reserves `padding-bottom: 104px`** so no content lands on the dark
horizon ridge, where neither the ink colour nor the scrim can guarantee
contrast.

**Motion rule (site-wide, learned from a real bug): animate only `transform`
and `opacity`. Never animate paint properties under a `filter`.** Doing so
caused a hero-flashing bug that took a full redesign pass to find. The sky's
`background` transition is the single sanctioned exception — it runs once a
minute, not per frame, and nothing above it is filtered. Wind and cloud
density derive from real readings and are dropped entirely under
`prefers-reduced-motion`.

### Known API gotcha

The polluxlabs ISS response nests peak elevation at
`culmination.elevation_deg`. There is no flat `max_elevation` — reading that
silently renders "0° up". This was a real bug, already fixed; don't reintroduce it.

### Ideas already scoped, not yet built

Adam wants this area sharper. These were offered and not done:

1. **24-hour temperature sparkline.** The Open-Meteo response already carries
   hourly data — this is nearly free. Highest value per effort.
2. **A real sunset-quality model.** Currently a crude string. Vivid sunsets
   come from mid- and high-altitude cloud at particular fractions, and
   Open-Meteo returns cloud cover split by level. This would be a genuinely
   novel feature rather than a restyle.
3. **Air quality** — Open-Meteo, same no-key CORS setup. Relevant in Texas.
4. **Live radar** — RainViewer has free tiles, no key.
5. **Drop the polluxlabs dependency** — compute SGP4 client-side from
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

Theme is **Hearthwood Light** — a single warm light theme. The old dark
"Prism" magenta/cyan palette and the whole `[data-theme]` toggle were
deliberately removed. **Do not reintroduce dark mode or a theme switcher.**

```
canvas    #FAF6EE   warm paper        ink       #221A12   warm near-black
surface   #FFFFFF   cards             muted     #8A7B65   secondary text
line      #E7DCC8   borders           accent    #C2673A   terracotta
accent-mid #B8862E  gold              accent-2  #5F7A45   moss
signal    #7C9A2E   olive, live states only
```

Type: Space Grotesk (display), Inter (body), JetBrains Mono (labels/data).
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
