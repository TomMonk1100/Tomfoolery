# Tomfoolery

Tom's personal Astro site, including the living almanac and Moon Lander.

## Project map

- `src/` — pages, components, styles, and browser-side features
- `public/` — published images and static assets
- `assets/` — source image materials
- `netlify/` and `netlify.toml` — score API and hosting configuration
- `scripts/` — build and release checks
- `docs/` — guides, reviews, and historical implementation plans

`AGENTS.md`, `AGENT-HANDOFF.md`, and `DESIGN.md` remain at the root because
they are active project instructions.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev -- --background` | Start a local development server |
| `npm run typecheck` | Check Astro and TypeScript |
| `npm test` | Run site, game, and score tests |
| `npm run verify` | Run all release checks and production build |

Generated output and retired material are excluded from version control. The
`_cleanup-review/` folder is a local review area; remove it only after its
contents have been checked.
