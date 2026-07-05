# Understory: Nest & Fang

A one-handed mobile action roguelite — live one small, ferocious life from
Spring to Winter. Auto-attacking Vampire-Survivors-style combat against slimes
and forest horrors, with species-specific weapon kits, a nest to defend, and a
belly to keep full. Built with **Phaser 3 + TypeScript + Vite** (PWA).

**Live:** https://understory-life.netlify.app

## Run locally

```bash
cd understory
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit && vite build → dist/
npm test         # vitest (pure-logic unit tests)
```

## What's in Nest & Fang (v2 overhaul)

- **3 playable animals** — Dog (brawler), Cat (crit hunter), Rabbit (swarm-clearer),
  each with 6 species weapons (Bark Blast, Tail Wag Strike, Fetch!, Zoomies,
  Pounce Slash, Thumper Quake, Lucky Clover…), 5 levels each + an evolution
  (e.g. Bark Blast + Loyal Heart → **Sonic Howl**), and 4 species passives.
- **8-minute dense runs**: 4 seasons × 2 min, escalating waves of slimes,
  Gloomcaps, Thorn Crawlers, Wisps and Mudmaws (~5 → 40 on screen), elites
  every ~45s, and a boss at each season end — King Slime, Elder Gloomcap,
  Bramble Tyrant, The Long Dark. Level-up draft every 20–40s.
- **Nest & eating kept core**: hunger meter with a Well-Fed damage bonus,
  food drops you eat or carry, a nest that heals you and banks food for bonus
  Sunseeds — defended during two scripted nest raids per run.
- **Companions**: befriend sparrows/squirrels mid-run; they fight beside you.
- **Chunky procedural pixel art**: 65 code-generated sprites (no asset files),
  animated slimes/animals/tiles, damage numbers, particles, screen shake,
  boss banners.
- Per-species meta trees + Sunseeds, saved to localStorage; Life Story combat
  recap; Instinct Mode autopilot that actually fights (kites, eats, defends
  the nest).
- Procedural Web Audio: per-weapon SFX (bark/pounce/thump), boss stingers,
  raid alarms, ambient seasonal bed.

## Architecture

Systems are built against stable contracts in `src/core/`:
`types.ts` (data schemas, events, enums), `context.ts` (`GameContext` + `System`
interfaces), `rarityWeights.ts` and `playerState.ts` (pure, unit-tested).
`WorldScene` owns the `GameContext` and drives every system uniformly; systems
communicate via `ctx.events`. See `docs/` for the playtest checklist and the
deferred Capacitor app-store wrap.
