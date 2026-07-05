# Understory

A one-handed mobile nature roguelite — live one small life well, from Spring
hatchling to Winter elder, foraging, exploring, nesting, and befriending in a
soft, unhurried world. MVP vertical slice built with **Phaser 3 + TypeScript +
Vite** (PWA-installable).

**Live:** https://understory-life.netlify.app

## Run locally

```bash
cd understory
npm install
npm run dev      # http://localhost:5173
npm run build    # tsc --noEmit && vite build → dist/
npm test         # vitest (pure-logic unit tests)
```

## What's in the MVP

- Playable **Dog** with all six verbs (Forage, Explore, Nest, Befriend, Evade, Migrate).
- Touch input: drag joystick, swipe dash, hold-release Focus Action, tap interact.
- 40×40 tile world with fog-of-war revealed by Sense Radius.
- Four-season run clock (Spring→Winter) with per-season hazards.
- 3-card draft on level-up: 18 cards across all six rarities, GDD rarity-weight
  curve, Luck tail-widening, 4-draft pity, one `isUnique` card excluded in Instinct Mode.
- Visible sprite evolution (head/back slots wired; four more computed).
- Sunseeds meta-currency + Dog meta-tree (6 nodes), saved to localStorage.
- Life Story screen: stats + per-card value/cost breakdown.
- Instinct Mode autopilot (0.6× XP).
- Procedural Web Audio ambient bed + SFX (no external assets — programmer art throughout).

## Architecture

Systems are built against stable contracts in `src/core/`:
`types.ts` (data schemas, events, enums), `context.ts` (`GameContext` + `System`
interfaces), `rarityWeights.ts` and `playerState.ts` (pure, unit-tested).
`WorldScene` owns the `GameContext` and drives every system uniformly; systems
communicate via `ctx.events`. See `docs/` for the playtest checklist and the
deferred Capacitor app-store wrap.
