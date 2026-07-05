# Understory Update 2 — "Wild Kit" (single Sonnet 5 execution spec)

Read first: `docs/CONTRACTS.md`, `src/core/types.ts`, `src/core/context.ts`,
`src/systems/combat/WeaponSystem.ts` + `sim.ts`, `src/systems/WorldGenSystem.ts`,
`src/data/weapons.json`. Repo: `understory/` inside TomSite. All 149 vitest
tests must stay green; add tests where noted. Work in the order below.

## Operational gotchas (do not rediscover these)

- Sandbox `vite build` EPERM → build with `npx vite build --outDir /tmp/udist --emptyOutDir`; verify with `npx tsc --noEmit && npx vitest run`.
- git leaves stale `.git/*.lock` after every op → `rm -f .git/*.lock` between add/commit.
- Deploy: Netlify MCP `deploy-site` (siteId `4bdb2c96-3c9c-40ac-862c-86f4ee3ae987`) → run the returned npx command from `understory/` with `--no-wait`; then curl `https://understory-life.netlify.app/` for the new bundle hash. PWA needs two reloads to swap.
- Playtest harness: page exposes `window.__understory`. In a browser tab (hidden tabs freeze Phaser) run `g.scene.stop('MetaHubScene'); g.scene.start('WorldScene',{instinct:true,animalId:'cat'})` then pump `for(i=0;i<3600;i++){t+=16.7;g.step(t,16.7)}` and inspect `scene.getContext()`. Auto-pick drafts via `DraftScene.scene.settings.data.onPick(cards[0].id)`.

## 1. Distinct basic attacks (identity per animal)

Add player **facing** to GameContext: `getFacing(): Vec2` = **auto-aim**:
unit vector toward the nearest enemy (nearest-wrapped-delta) when any exist;
fallback to last nonzero move direction; default right. WorldScene computes it
each frame. ALL directional weapons (`arc`, `line-both`, and projectile spawn
direction) use this — attacks always point at the closest mob, VS-style.
Sprite flipX stays driven by movement, not aim. Unit-test: nearest-enemy
selection, wrap-aware, fallback when no enemies.

Extend `WeaponLevelStats`/weapon schema with optional `pattern`:
- `ring` — 360° around player (current aoe-pulse behavior)
- `arc` — cone in facing direction, `arcDeg` (default 100)
- `line-both` — two opposed narrow strikes (length `area`, width 28px) along facing, front AND back simultaneously

Starters become geometrically distinct:
- **Dog / Bark Blast**: `ring` (unchanged) — safety bubble.
- **Cat / Pounce Slash**: `arc` 90° front-only, higher damage + critPct to compensate for coverage loss.
- **Rabbit / NEW starter `scissor-kick`** (melee, `line-both`): sharp line front+behind, evolution "Guillotine Hop" (`spring-legs`) = 4-way cross strike. Thumper Quake stays in rabbit's draft pool (no longer isStarting); scissor-kick gets `isStarting`, icon `icon_scissor_kick`, new fx sprite `fx_scissor` (thin slash line, 2-frame). Update `animals.json` startingWeaponId, cards.json, sprites, tests.

Implement pattern hit-tests in `sim.ts` (pure, unit-tested: point-in-ring /
-cone / -line with facing) and visuals in WeaponSystem.

## 2. Every weapon MUST show its attack

Rule: on every activation WeaponSystem renders the hit area — fx sprite when
one exists, else a 150ms stroked-shape flash (ring/cone/line/zone circle) in
the weapon's tint. Audit all 18+new weapons headlessly (grant via
`c.player.activeWeapons.push(...)`, step, confirm a display object spawns per
`EV.weaponFired`). Known offenders to fix explicitly: `dig` (eruption ring +
dirt particles), `midnight-prowl` (shadow dash streak + strike flash),
`burrow-network` (visible hole sprites + pop-out flash), `purr-aura`
(persistent soft ring while active), trail segments (visible fading pads).
Evolved weapons: add gold tint to their fx.

## 3. Neutral pool — weapons & passives for ALL animals

Schema: `animal: "any"` now legal. Fix `DraftSystem.isDraftable` +
`applyWeaponOrPassive` + content tests to accept it. Neutral weapons (VS
analogues, animal-themed), added to `weapons.json` + cards + icons:

| id | rarity | archetype | VS analogue / behavior |
|---|---|---|---|
| `tennis-ball` | common | projectile | knife → bouncy ball, bounces off 3 enemies |
| `skunk-cloud` | uncommon | zone | garlic → stinky aura follows player, ticks + slight repel |
| `bee-swarm` | uncommon | orbit | bees orbit erratically (jittered orbit), rapid small hits |
| `acorn-mortar` | rare | projectile(arc) | bomb → lobbed acorn, 60px blast |
| `firefly-lantern` | rare | orbit | bible → 2 slow bright orbs, big hits, light halo |
| `echo-screech` | epic | projectile(straight, pierce ∞) | piercing sonic wave line, fires at nearest |
| `laser-pointer` | **mythic** | zone(special) | red dot wanders to enemy clusters 1.2s then a beam from off-screen zaps it: big AoE. Evolution "Disco Laser" (`magnet-collar`): 3 dots |

Each: 5 levels + evolution paired to a NEUTRAL passive (below). Neutral
passives (all animals, added to `passives.json` + cards):
- `magnet-collar` (uncommon) — **the requested magnet**: +45% pickupRadius/stack (XP motes AND food; FoodSystem must honor pickupRadius + drift items toward player inside radius, not walk-over-only). At 3 stacks: every 20s auto-vacuum everything on screen.
- `wild-heart` (common) — +15 maxHP/stack (heal the delta on pick).
- `alpha-scent` (rare) — +8% damage/stack.
- `four-leaf` (rare) — +12 luck/stack.
Weights: commons plentiful early, `laser-pointer` weight ≤2 at all levels
(mythic thrill). Rerun the pacing sim in `content.test.ts`; keep 13–19
level-ups. Balance sanity: neutral weapons ~10% weaker than species weapons at
equal rarity (species kit should stay core).

## 4. World rework — seamless looping wilds

- **Kill the checkerboard**: replace per-tile ground images with ONE tileable
  grass texture (new 64px `tile_grass_seamless`, low-contrast noise, no
  visible tile edges) drawn as a single `TileSprite` covering the world.
  Scatter props (flowers/pebbles/mushrooms, ~1 per 12 tiles, seeded) as
  individual images. Obstacles/water/forage/nest still render as feature
  sprites. Delete grass-variant checker logic. Perf: this replaces ~1600
  images — keep it that way.
- **Toroidal wrap (Pac-Man style)**: world 48×48. Positions wrap modulo world
  size for player, enemies, projectiles, motes, food. `movePlayer` wraps;
  camera hard-snaps on wrap (acceptable seam; do NOT build 9-way ghost
  rendering). All distance/steering/targeting math must use
  nearest-wrapped-delta (`wrapDelta(a,b,size)` helper in sim.ts, unit-tested).
  Spawn ring, XP magnet, companion follow, InstinctAI vectors, nest raid
  radius all switch to wrapped distance. Fog `revealAround` wraps too.
- **Water uncrossable + guaranteed path**: MovementSystem blocks entry into
  water/obstacle tiles (slide along the free axis, no getting stuck). Wisps
  still ignore terrain; other enemies slide the same way. WorldGen
  post-pass: flood-fill walkable tiles WITH wrap adjacency from spawn; any
  unreachable walkable region → carve a 1-tile grass channel through the
  blocking cells toward it (repeat until one connected component). Unit-test
  the flood-fill/carve on a hand-built grid (blocked lake ring case).
  Also guarantee ≥1 walkable ring around nest and spawn.

## 5. Small extras (only these — resist scope creep)

- Enemy projectiles (spore) get a brief spawn flash so shots read.
- Draft cards for neutral weapons get a paw-print corner badge ("ALL").
- HUD weapon rack grows to show evolved gold border (exists?) — verify.
- README: add Update 2 paragraph.

## Order & verification

1. sim.ts patterns + wrapDelta + tests → 2. facing + starters + scissor-kick
sprite → 3. weapon visual audit → 4. neutral content + draft "any" + magnet →
5. world (ground → collision → wrap → floodfill) → 6. balance sim + full
vitest → 7. build to /tmp, deploy, SW double-reload, headless live playtest
per harness above (assert: kills>50 in 2min instinct cat, laser-pointer
draftable, no NaN, wrap traversal works: walk player past edge, pos wraps) →
8. commit (lock dance), update `docs/playtest-checklist.md`.
