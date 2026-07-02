# Personal Hub — Build Plan

A plan for a personal site that acts as a *home base*: a fresh, animated landing page that links out to photos, collections, write-ups, and standalone "offshoot" mini-sites. Built so adding something new is cheap, and the whole thing feels alive rather than a static résumé.

---

## 1. The concept

Think of it less as a "website" and more as your **personal portal**. One striking front page (a hub), and everything branches from it:

- **Modules** live *inside* the site (`/photos`, `/coffee`, `/cards`).
- **Offshoots** are standalone mini-sites that get their own space (`projects.site.com`, or a fun one-off you build for a trip or an experiment) but stay linked from the hub so it all feels like one universe.

The design language ties it together so even a throwaway experiment looks like it belongs to you.

**Layout pattern:** a **bento grid** hub. Tiles of different sizes — a big "now" tile, a photo tile, a collection tile, a couple of small status tiles. It's the ideal pattern for "host all sorts of things" because you just add a tile when you add a thing, and it reflows. It also reads as modern/fresh out of the box.

---

## 2. Design foundation — the DESIGN.md approach

The "design MD file" idea you're thinking of is a real, recent standard called **DESIGN.md** — a single plain-text Markdown file that captures a whole visual system (colors, type, spacing, motion, component rules) in a format an AI agent can read and build from. It was introduced via Google Stitch and exploded in early 2026; the whole point is you hand it to a coding agent and every screen it generates stays on-system instead of looking generic.

### Best sources to pull from
- **VoltAgent/awesome-design-md** — curated DESIGN.md files reverse-engineered from real brands (Stripe gradients, Linear minimal, The Verge acid-mint/ultraviolet, etc.). Free, MIT-licensed. Good for grabbing a vibe.
- **VoltAgent/awesome-claude-design** — ~68 ready-to-use DESIGN.md files built specifically for **Claude Design** (Anthropic's design workspace). Drop one in and it scaffolds a full UI kit in one shot. This is the most direct path for us since you're already in Claude.
- **designmd.ai / getdesign.md** — browsable library (100+ systems) you can filter by tags like `dark`, `minimal`, `gradient`.
- **google-labs-code/design.md** — the official spec if you want to understand the format deeply.

### How the file is structured
Two parts: a **YAML front matter** block of hard tokens (exact hex/sizes) and a **Markdown body** of prose explaining the *why* and how to apply them. Standard section order: Overview / Brand & Style → Colors → Typography → Spacing → Components → Motion (plus optional Icons, Imagery).

### Starter DESIGN.md (tailored to you)
Rather than copy a brand's file, here's a custom one to build on — dark canvas, iridescent gradient accents (leaning into the psychedelic-art side), clean editorial structure, with a jalapeño-green signal color as a personal nod. Swap any values, or grab a different file from the repos above to change the whole feel in one move.

```markdown
---
version: alpha
name: Hub — Prism
description: Dark, iridescent personal hub. Editorial structure, playful motion, gradient energy.
colors:
  canvas:    "#0B0B0F"   # near-black base
  surface:   "#15151D"   # cards / tiles
  surface-2: "#1E1E2A"   # raised / hover
  text:      "#F4F4F8"   # primary text
  muted:     "#A0A0B0"   # secondary text
  border:    "#2A2A38"
  accent:    "#C026D3"   # magenta — primary action / links
  accent-2:  "#22D3EE"   # cyan — secondary highlight
  signal:    "#84CC16"   # jalapeño green — rare emphasis only
  gradient:  "linear-gradient(135deg, #C026D3 0%, #7C3AED 50%, #22D3EE 100%)"
typography:
  display:
    fontFamily: "Space Grotesk"
    fontWeight: 600
    letterSpacing: "-0.03em"
  heading:
    fontFamily: "Space Grotesk"
    fontWeight: 600
  body:
    fontFamily: "Inter"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "JetBrains Mono"   # labels, code, timestamps
spacing:
  base: 4px        # scale: 4, 8, 12, 16, 24, 32, 48, 64
rounded:
  sm: 8px
  md: 14px
  lg: 22px
---

## Overview
A personal hub that should feel like stepping into someone's well-curated
world, not reading a CV. Confident and a little playful. Dark by default so
photos, gradients, and art pop. Editorial bones (clear hierarchy, generous
spacing) keep it from feeling chaotic even when content is dense.

## Colors
Deep near-black canvas with layered dark surfaces for tiles. The magenta→
violet→cyan gradient is the brand signature — used on the hero, key CTAs,
and hover states, never as a flat fill behind body text. The jalapeño-green
"signal" is reserved for rare moments that deserve a jolt (a live badge, a
"new" flag). Keep accents earned, not everywhere.

## Typography
Space Grotesk for display and headings gives a modern, slightly technical
character. Inter for body keeps long text comfortable. JetBrains Mono for
metadata, timestamps, and code so labels feel intentional. Tight letter-
spacing on large display sizes; normal everywhere else.

## Spacing
4px base unit, geometric-ish scale. Tiles get generous internal padding
(24–32px). Whitespace is a feature — let the grid breathe.

## Components
- **Tiles (bento):** surface color, 14–22px radius, subtle 1px border. On
  hover: lift slightly, border picks up gradient, 200ms ease.
- **Buttons:** gradient fill for primary; ghost (border only) for secondary.
- **Links:** gradient underline that animates in on hover.
- **Badges/tags:** mono font, small, muted — except "live"/"new" which use signal.

## Motion
Fast and springy, never sluggish. 150ms for micro-interactions, 250–300ms
for transitions. Use the View Transitions API for page changes so navigation
feels app-like. Optional ambient: a slow-drifting gradient in the hero and
scroll-triggered reveals as tiles enter. Respect prefers-reduced-motion.
```

---

## 3. Site architecture

```
HUB (bento landing)
├─ /about            — short "what I do" + the human stuff
├─ /now              — what I'm into right now (updated often = "fresh")
├─ /photos           — galleries by trip/theme
├─ /collections
│   ├─ /pokemon      — TCG, filterable by set/grade
│   ├─ /figures      — Smiskis & blind-box finds
│   └─ /watches      — the rotation
├─ /coffee           — brew log, gear, current beans
├─ /garage           — EV + gadget tinkering notes
├─ /retreats         — outdoor trips you organize (with a map)
├─ /art              — psychedelic / AI-art experiments
├─ /writing          — blog / longer posts
└─ OFFSHOOTS         — standalone mini-sites, linked from the hub
    ├─ projects.site.com
    └─ (one-off experiments, trip microsites, etc.)
```

**Offshoots, two ways:**
1. **Subpaths** (`site.com/cards`) — simplest, all one project.
2. **Subdomains** (`cards.site.com`) — better when an offshoot is its own app or a separate build. Easy if DNS lives on Cloudflare; each subdomain can even be its own deployment but share the DESIGN.md so they match.

Start with subpaths; graduate the bigger experiments to subdomains later.

---

## 4. Tech stack (recommendation)

| Layer | Pick | Why |
|---|---|---|
| Framework | **Astro** | Built for content-heavy personal sites. Writes pages in Markdown/MDX, drops in interactive "islands" only where needed, ships almost no JS by default → very fast. Perfect for a hub with many content types + offshoots. |
| Styling | **Tailwind** (tokens from DESIGN.md) | The DESIGN.md tokens map straight into the Tailwind theme. |
| Content | **MDX files in the repo** to start | Each photo set / collection / post is just a file. Add a file = add content. Optional later: pull from Airtable/Notion if you want to update from your phone. |
| Images | Astro image optimization + **Cloudflare Images** (or Cloudinary) | Galleries stay fast; you upload big, it serves small. |
| Hosting | **Cloudflare Pages** or **Vercel** | Generous free tier, instant deploys from GitHub, painless custom domains + subdomains. Cloudflare edges out for subdomain juggling. |
| Repo/CI | **GitHub** | Push to deploy. Version-controlled, and the DESIGN.md lives here too. |
| Analytics | Cloudflare Web Analytics or Plausible | Privacy-friendly, no cookie banner. |

**Alternative:** if you'd rather it be fully dynamic/app-like (logins, a database, live editing), **Next.js** is the heavier option. For a personal hub, Astro is the better fit — lighter, faster, less to maintain.

---

## 5. What makes it "dynamic & fresh"

Static sites feel dead because nothing changes. Bake in motion *and* freshness:

**Motion / feel**
- Animated gradient hero + scroll-reveal on tiles.
- **View Transitions** so page changes glide (Astro supports this natively).
- A **vibe switcher**: Dark (default) ⇄ Light ⇄ "Trip" mode that cranks the gradient/animation intensity. Ties straight to your aesthetic.
- Interactive galleries — filter/sort collections (by Pokémon set, by grade, by watch, etc.).
- A **map** on `/retreats` with pins for each trip.

**Freshness (so it's never stale)**
- A **/now page** — the single highest-leverage thing. "Currently brewing X, reading Y, this card just landed." Easy to update, signals the site is alive.
- A **changelog / feed** of recent additions on the hub.
- Small live-ish status tiles: "currently playing," "latest brew," "newest pull."
- Optional fun: a Scout cameo on the 404 page, a guestbook.

---

## 6. Content modules (drawn from your interests)

Each becomes a tile on the hub and a section in the site. You don't need all of them at launch — pick the 3–4 you'd actually fill first.

- **Coffee** — brew log, current beans, gear shelf. (Great recurring-update fodder.)
- **Pokémon TCG** — collection gallery, filter by set/grade, maybe market notes.
- **Figures** — Smiski + blind-box finds, "chase" wishlist.
- **Watches** — the rotation, with photos.
- **Photos** — trip and theme galleries.
- **Retreats** — the outdoor trips you plan, as little trip pages + a map. Doubles as a planning hub for the group.
- **Garage** — EV + gadget tinkering write-ups.
- **Art** — your psychedelic / AI-art experiments as a gallery; also a natural sandbox for the wildest visual ideas.
- **Writing / blog** — anything longer-form.
- **About / Now** — the connective tissue.

---

## 7. Roadmap

**Phase 0 — Decisions (you + me)**
Lock the vibe, the domain, and how we build. (Quick questions at the end.)

**Phase 1 — Foundation**
Scaffold Astro, wire in the DESIGN.md tokens, build the bento hub + `/about` + `/now`. Deploy to a live URL immediately so it's real.

**Phase 2 — Core modules**
Stand up `/photos` and 1–2 collections (likely Coffee + Pokémon). Establish the "add a file = add content" pattern.

**Phase 3 — Dynamic layer**
Vibe switcher, View Transitions, gallery filtering, scroll animations, the retreats map.

**Phase 4 — Offshoots**
Set up subdomain architecture for the first standalone mini-site, sharing the DESIGN.md so it stays on-brand.

**Phase 5 — Polish**
SEO/meta, performance pass, analytics, 404 page, finishing touches.

---

## 8. Registering your domain (your next step)

You picked **register a custom domain.** Quick guidance.

**Where to register**
- **Cloudflare Registrar** — registers at wholesale cost with no markup or upsells, and since you'll likely host on Cloudflare Pages, DNS + domain + hosting all live in one place. Easiest path.
- **Porkbun** or **Namecheap** — cheap, clean, reliable if you'd rather keep the registrar separate. Both hand off to Cloudflare/Vercel fine.
- Avoid registrars with cheap first-year teaser pricing and steep renewals.

**Picking the name**
- `.com` is still the safe default. `.me`, `.dev`, `.xyz` are good, characterful alternates and often more available.
- Patterns: your name (`adammuncie.com`), a short handle, or a vibe word. Keep it short, easy to say out loud, no hyphens/numbers.
- Grab the matching handle on any socials you care about while you're at it.
- Budget ~$10–15/yr for a common TLD; some run higher — confirm the *renewal* price, not just year one.

**The flow once registered**
1. Register the name.
2. Point DNS at the host (trivial if it's all Cloudflare; a couple of records otherwise).
3. Connect it to the deployment at build time — the host issues HTTPS automatically.
4. Subdomains for offshoots (`cards.yourname.com`) get added as records later — no extra registration.

---

## 9. Decisions — status

**Locked**
- **Vibe:** Prism (dark + psychedelic gradients). The starter DESIGN.md above is the foundation.
- **For now:** planning only — no build yet.

**Still open (whenever you're ready)**
- **Domain name** — registering one (see above); just need to land on the actual name.
- **First 3–4 modules** — which content goes live at launch. Coffee + Pokémon are natural openers.

---

*Sources for the DESIGN.md ecosystem: VoltAgent/awesome-design-md, VoltAgent/awesome-claude-design, designmd.ai, google-labs-code/design.md.*
