# Understory 2.0 — "Nest & Fang" Overhaul Plan
### Opus-orchestrated Sonnet 5 swarm · single-run autonomous execution

**Goal:** Transform the current bland walking-simulator into a Vampire Survivors-style
action roguelite: animals auto-attacking waves of slimes and forest horrors with
species-specific kits, while keeping the nest/eating identity. Chunky pixel art,
~8-minute dense runs, Dog + Cat + Rabbit roster.

---

## Part I — Diagnosis (Step 1: Problem Decomposition)

### Why the current build isn't fun

Audit of the live code (`src/`, 4,046 lines) found four root causes:

1. **No threat, no agency.** "Hazards" are drifting `Phaser.GameObjects.Arc`
   circles you walk around. There are no enemies, no attacks, no damage numbers,
   no death. The player has nothing to *do* except tap forage nodes.
2. **Unreadable programmer art.** The player is an ellipse (`add.ellipse(0,0,26,20)`),
   the world is 1,600 flat-colored rectangles, hazards are circles. Nothing has a
   silhouette, animation, or identity — the user literally "doesn't know what is what."
3. **Dead pacing.** `RUN_LENGTH_MS = 12 min` with XP arriving in trickles of 1–20.
   First level-up can take minutes. Vampire Survivors levels you up every ~20–30s
   in the early game; that cadence IS the game.
4. **Card effects are invisible.** All 18 cards modify passive stats (forageYield,
   senseRadius, comfort). No card changes what happens on screen.

### What's worth keeping (don't rebuild these)

- **Architecture:** the `System` contract, `GameContext`, event bus (`ctx.events`),
  and scene flow (Boot → MetaHub → World → Draft overlay → LifeStory) are solid.
  The swarm plugs new systems into this seam.
- **DraftSystem + rarityWeights:** unit-tested, GDD-curve rarity draft with pity.
  Reuse as the level-up upgrade picker — just feed it weapons/upgrades instead of charms.
- **Seasons:** 4-season run clock is a great wave-escalation skeleton.
- **SaveManager, meta-tree, Sunseeds, Life Story, InstinctAI autopilot:** all reusable.
- **Nest + Forage verbs:** these become the identity mechanics (below).

### Constraints

- Sandbox: `vite build` may hit EPERM cache errors — verify with `tsc --noEmit` +
  `vitest` instead; full build happens at deploy time (known issue, see memory).
- No external asset files: all art must be **generated at boot from pixel-map data**
  (string arrays → canvas → texture atlas). This is deterministic and agent-authorable.
- Deploy target: existing Netlify site `understory-life.netlify.app`. Must curl-verify
  live after deploy (site broke silently once before).
- Mobile-first portrait (480×854), one-handed touch. Auto-attack fits this perfectly.

### Feasibility

All mechanics (auto-fire weapons, wave spawner, pixel-atlas generation, hit
feedback) are standard Phaser 3 patterns. Scope fits a single orchestrated
swarm session: ~4,000 existing lines grow to an estimated ~9,000–10,000.

---

## Part II — Game Design Target (Steps 2–3: Plan + Refinement)

### The new core loop (8 minutes, 4 seasons × 2 min)

```
Move (joystick) → weapons auto-fire at nearby enemies → enemies drop XP motes
→ motes vacuum to player → level up every 20–40s → 3-card draft
  (new weapon / weapon upgrade / passive) → power spike →
forage food between waves → eat to heal + keep Well-Fed damage bonus →
return to NEST to bank food & trigger nest upgrades → defend nest during raids →
season boss at each 2-min mark → Winter finale boss → Life Story + Sunseeds
```

**Hunger & eating (kept, made to matter):** a hunger meter drains slowly. Above
50% you're **Well-Fed**: +15% damage and visible golden outline. Eating foraged
berries/mushrooms heals 15–30 HP. Food can be eaten on pickup or carried (max 5).

**Nest (kept, made to matter):** one nest per map. Standing in it regenerates HP
fast and banks carried food — banked food converts to Sunseeds at run end. Twice
per run (end of Spring, end of Autumn) a **Nest Raid** warning fires: a slime wave
beelines for the nest; if nest HP hits 0 you lose the banked-food bonus (run
continues). Defending it is the periodic "defense" beat that breaks up roaming.

**Befriend (kept, repurposed):** befriendable critters spawn rarely; walking to
one and holding the interact recruits it as a **companion** that fights alongside
you (VS-style minion). Max 2.

### Animal kits (species-specific attacks & upgrades)

Each animal: 1 starting weapon + 5 unlockable weapons + 4 species passives.
Weapons level 1→5 via draft; each weapon has an **evolution** when maxed and
paired with its catalyst passive (VS formula).

**DOG — brawler, mid-range bursts**
| Weapon | Behavior | Evolution |
|---|---|---|
| Bark Blast (start) | Radial shockwave ring, knockback | **Sonic Howl** — screen-wide roar, fear |
| Tail Wag Strike | Sweeping melee arc behind/beside | **Wag Tornado** — persistent spin aura |
| Fetch! | Boomerang stick, pierces, returns | **Double Fetch** — two sticks, homing return |
| Zoomies | Speed burst leaving a damaging dust trail | **Mach Zoomies** — trail ignites |
| Dig | Burrow (i-frames) → eruption AoE | **Ambush Den** — leaves a trap pit |
| Slobber Shot | Arcing goo glob, slows enemies | **Drool Flood** — slowing puddle field |

Passives: Loyal Heart (+regen), Thick Fur (+armor), Keen Nose (+pickup radius), Big Appetite (food heals more).

**CAT — precision, crits, mobility**
Pounce Slash (start, dash-strike at nearest), Claw Flurry (rapid frontal shreds),
Hairball Lob (arcing bounce projectile), Purr Aura (damage+slow field),
Midnight Prowl (brief stealth, next hit ×4 crit), Yarn Whip (long line snap).
Evolutions incl. **Nine Lives** (revive once). Passives: Feline Grace (dodge %),
Predator Eye (+crit), Soft Paws (+move speed), Picky Eater (Well-Fed threshold lower, bonus higher).

**RABBIT — swarm clear, luck, speed**
Thumper Quake (start, AoE ground-pound rings), Bunny Barrage (rapid-hop contact
trail), Carrot Toss (thrown veg, splits in 3), Lucky Clover (orbiting clovers),
Burrow Network (teleport between dug holes), Cottontail Decoy (taunt dummy).
Passives: Lucky Foot (+luck/rarity), Spring Legs (+speed), Litter of Friends
(+companion slot), Nibbler (forage faster).

### Enemy bestiary (slimes + fictional forest horrors)

| Enemy | Look | Behavior |
|---|---|---|
| Green Slime | classic blob, squish anim | slow chaser, the popcorn enemy |
| Red Slime | smaller, angry eyes | fast lunger |
| Blue Slime | big, crowned droplet | tanky, splits into 2 greens on death |
| Gloomcap | purple mushroom | stationary, lobs spore puffs |
| Thorn Crawler | bramble centipede | charges in straight lines |
| Will-o-Wisp | flickering flame ghost | erratic drift, phases through obstacles |
| Mudmaw | earth jaw | ambusher, emerges under player |
| **Season bosses** | | Spring: **King Slime** (splits repeatedly) · Summer: **Elder Gloomcap** (spore rings) · Autumn: **Bramble Tyrant** (charge + thorn walls) · Winter: **The Long Dark** (wisp swarm master, final) |

Wave escalation: ~5 enemies on screen at 0:30 → ~40 by Winter. Spawns come from
off-screen ring, VS-style. Elites (2× size, tinted, drop food) every ~45s.

### Visual overhaul — procedural pixel-art pipeline

- **`PixelArt` module:** sprites defined as string-array pixel maps with a palette
  legend, rendered to one canvas atlas at boot, nearest-neighbor scaled 3×.
  Every agent authors art as *data*, deterministic and reviewable.
- Every creature gets 2–4 frame animations: idle bob, walk, attack, hurt-flash,
  death squish/poof. Slimes squash-and-stretch on hop.
- **World:** grass gets 3 tile variants + scattered flowers/pebbles; trees are
  2-tile sprites with shadow; water gets a 2-frame shimmer; nest is a cozy
  stick-ring with leaf bedding. Fog-of-war stays but softens.
- **Juice (non-negotiable):** damage numbers, white hit-flash, death particles,
  XP motes that magnet-fly to the player, screen shake on big hits, level-up
  flash + sound, Well-Fed golden outline, boss intro banner, floating "+food" text.
- HUD redo: HP bar, hunger bar, weapon icon rack with level pips, season dial,
  boss HP bar. Draft cards get pixel-art icons and rarity glow.

### Pacing retune

- `RUN_LENGTH_MS` 12 min → **8 min**. XP curve retuned so level-ups land every
  20–40s (~14–18 drafts per run; XP thresholds: 5, 15, 30, 50, 75, 110, 150, 200, 260, 330, then +90).
- Move speed +25% baseline. Forage is instant-on-touch (no hold).
- Instinct Mode autopilot must be extended to fight (kite + eat + defend nest) —
  it doubles as the automated playtest bot.

---

## Part III — Autonomous Swarm Instruction Set (Step 4, resolved via Steps 5–6)

**Topology:** 1 Opus orchestrator + 7 Sonnet 5 workers across 3 phases.
Workers only touch files they own; the orchestrator owns all shared files and
integration. All coordination happens through frozen contracts written in Phase 0.

### Phase 0 — Orchestrator (Opus), solo: contracts & scaffolding

1. `cd understory`; `npm install`; confirm `npx tsc --noEmit` and `npx vitest run` pass (baseline green).
2. Extend `src/core/types.ts` with frozen combat schemas — `EnemyData`,
   `WeaponData` (id, animal, tier, cooldownMs, damage, area, projectile params,
   evolution pair), `WaveEntry`, `FoodItem`, `NestState`, `CompanionData`; new
   events: `EV.enemyKilled, EV.playerDamaged, EV.weaponFired, EV.xpMoteCollected,
   EV.foodEaten, EV.nestDamaged, EV.nestRaidStarted, EV.bossSpawned, EV.bossDefeated,
   EV.companionRecruited`. Change `RUN_LENGTH_MS` to `8 * 60 * 1000`.
3. Extend `GameContext` in `src/core/context.ts`: `getEnemies(): EnemyView[]`,
   `damagePlayer(n, source)`, `spawnXPMote(x, y, value)`, `hunger` accessors.
   Stub implementations in `WorldScene` so every worker compiles standalone.
4. Create `src/gfx/PixelArt.ts` **interface only** (typed function signatures +
   doc comments): `definePixelSprite(key, frames: string[][], palette)`,
   `buildAtlas(scene)`, `play(sprite, anim)`. Worker A implements it.
5. Write `docs/CONTRACTS.md` capturing: file-ownership map (below), event
   payload shapes, data-JSON schemas with one fully-worked example each, palette
   (16 named colors), sprite size grid (16px small / 24px medium / 48px boss),
   and the pacing table from Part II.
6. Commit: `overhaul: phase 0 contracts`.

**File-ownership map (no two workers share a file):**

| Worker | Owns |
|---|---|
| A — Art pipeline | `src/gfx/PixelArt.ts`, `src/gfx/sprites/animals.ts`, `src/gfx/sprites/enemies.ts`, `src/gfx/sprites/world.ts`, `src/gfx/sprites/ui.ts` |
| B — Combat core | `src/systems/combat/WeaponSystem.ts`, `EnemySystem.ts`, `WaveDirector.ts`, `XPMoteSystem.ts`, `ProjectilePool.ts` |
| C — Content data | `src/data/weapons.json`, `enemies.json`, `waves.json`, `passives.json`, rewrite `cards.json` + `animals.json` (cat, rabbit added) |
| D — Nest/hunger/companions | `src/systems/NestSystem.ts`, `HungerSystem.ts`, `CompanionSystem.ts`, `FoodSystem.ts` |
| E — Juice/VFX | `src/vfx/Juice.ts`, `DamageNumbers.ts`, `Particles.ts`, `ScreenFX.ts` |
| F — UI/scenes | `src/scenes/DraftScene.ts`, `MetaHubScene.ts` (animal select), `LifeStoryScene.ts`, `src/ui/HUD.ts` |
| G — Audio + AI | `src/audio/AudioManager.ts` (combat SFX), `src/systems/InstinctAI.ts` (fighting autopilot) |
| Orchestrator | `types.ts`, `context.ts`, `WorldScene.ts`, `WorldGenSystem.ts`, `HazardSystem.ts` (deleted), `SeasonSystem.ts`, tests, deploy |

### Phase 1 — Workers A, B, C, D in parallel (`isolation: worktree`)

Each worker prompt must include: the full text of `docs/CONTRACTS.md`, its
file-ownership row, the design spec for its slice (from Part II), and these
standing orders — *"Only create/modify files you own. Code against the contract
interfaces; never import another worker's files. Every module must pass
`npx tsc --noEmit`. Write vitest unit tests for all pure logic in `tests/`.
If a contract is ambiguous, choose the simplest interpretation, note it in a
`DECISIONS` comment at the top of the file, and continue — do not stop."*

- **A:** Implement `PixelArt`, then author every sprite in Part II as pixel-map
  data: 3 animals (idle/walk/attack/hurt ×4 directions collapsed to L/R flip),
  7 enemies + 4 bosses (idle/move/death), world tiles/props, food/XP-mote/UI icons.
  Acceptance: a `sprites.test.ts` that validates every frame parses, dimensions
  match the grid, and all palette chars resolve.
- **B:** Weapon auto-fire engine (cooldown loop, nearest-enemy targeting, area /
  projectile / orbit / trail archetypes — every weapon in `weapons.json` maps to
  one of 6 archetypes), enemy steering + contact damage + HP/death, `WaveDirector`
  reading `waves.json` keyed to season progress, XP motes with magnet pickup,
  object pooling throughout (≤40 enemies, ≤120 projectiles). Renders placeholder
  rects if atlas keys missing (integration swaps them automatically since sprites
  are keyed by contract names). Acceptance: vitest sim test — headless 60s tick
  loop kills ≥30 enemies with dog starting weapon at level 3.
- **C:** All JSON content: 18 weapons (6/animal) with 5 levels + evolution each,
  12 passives, 11 enemy stat blocks, wave tables for 4 seasons hitting the
  escalation curve, retuned XP thresholds in `animals.json` for all 3 animals.
  Acceptance: `content.test.ts` validates every file against contract schemas,
  every evolution references an existing weapon+passive pair, and simulated
  8-min XP income (from wave table kill values) yields 14–18 level-ups.
- **D:** Hunger drain + Well-Fed state, food drops/carry/bank, nest heal zone +
  nest HP + two scripted raids, companion recruit/follow/attack. Acceptance:
  vitest on hunger math, banking conversion, raid trigger timing.

**Failure handling:** if a worker's final report shows failing tests or type
errors, the orchestrator fixes trivial issues (<15 lines) itself; otherwise it
re-messages that worker once via SendMessage with the exact error output. After
one retry, orchestrator takes ownership and completes the slice itself.

### Phase 2 — Workers E, F, G in parallel (after Phase 1 merge)

Orchestrator first merges Phase 1 worktrees, rewrites `WorldScene.ts` to
construct the new systems (delete `HazardSystem`, fold Verb forage/nest/befriend
handling into FoodSystem/NestSystem/CompanionSystem), swaps the ellipse player
for the atlas sprite, and confirms `tsc` + full vitest suite green. Commit:
`overhaul: phase 1 integrated`. Then dispatch:

- **E:** damage numbers, hit-flash, death particles, mote trails, screen shake,
  level-up burst, boss banner, Well-Fed outline. Hooks only via `ctx.events` —
  zero coupling to combat internals.
- **F:** HUD (HP/hunger/weapon rack/season dial/boss bar), DraftScene redo with
  pixel icons + weapon-level pips, MetaHub animal-select with the 3 animals +
  per-animal meta trees (extend existing 6-node dog tree pattern), LifeStory
  combat stats (kills, damage dealt, food eaten, nest defended).
- **G:** SFX for bark/pounce/thump/hits/slime-squish/eat/levelup/boss (procedural
  WebAudio, follow existing `AudioManager` idiom), plus InstinctAI rewrite:
  seek clusters → kite → eat below 50% hunger → return to nest on raid warning.

### Phase 3 — Orchestrator: integration, balance, deploy, verify

1. Merge Phase 2. Full pass: `npx tsc --noEmit && npx vitest run`.
2. **Automated playtest:** run the InstinctAI bot headless (vitest, fake timers,
   3 seeds × 3 animals) asserting: run reaches Winter, ≥12 level-ups, player
   death rate <100%, no NaN stats, boss spawns fire. Tune `waves.json` /
   `weapons.json` numbers (max 3 tuning iterations) until assertions pass.
3. Attempt `npm run build`. If sandbox EPERM: verify via `tsc` + vitest only and
   build during deploy (Netlify builds from repo settings) — do not treat local
   build failure alone as a blocker.
4. Update `README.md` (new loop, roster, kit tables). Commit `overhaul: nest & fang`.
5. Deploy to the existing Netlify site (`understory-life.netlify.app`). Then
   **curl-verify**: fetch `/` (expect 200 + new bundle hash) and the JS bundle
   (expect weapon ids present, e.g. grep `bark-blast`). If 404/stale, check the
   deploy permalink first, then dashboard build settings (known failure mode).
6. Report: what shipped, balance numbers, known gaps, playtest checklist update
   in `docs/playtest-checklist.md`.

---

## Part IV — Self-Review & Steelman Log (Steps 5–6, resolved)

Issues found on audit of the instruction set, and their resolution:

1. **Worker B and Worker A both need sprite keys before integration.** *Fix
   applied:* contract names all atlas keys in Phase 0; B renders fallback rects
   keyed by the same names, so merge is a no-op swap. *(Steelman on "just
   sequence A before B" rejected — costs a full phase of parallelism.)*
2. **VerbSystem deletion could orphan InputController gestures.** *Fix applied:*
   Phase 2 explicitly assigns gesture re-mapping (tap = interact/eat, hold =
   recruit) to the orchestrator's WorldScene rewrite, not to any worker.
3. **`cards.json` rewrite (C) breaks existing `rarityWeights` tests.** *Fix
   applied:* C owns updating `tests/rarityWeights.test.ts` fixtures; contract
   keeps the rarity/weight schema unchanged so the pure logic is untouched.
4. **Balance tuning could loop forever.** *Fix applied:* hard cap of 3 tuning
   iterations, then ship with a `KNOWN-TUNING.md` note. *(Steelman held partially:
   perfect balance is not a launch blocker for a v2 draft.)*
5. **"Deploy to Netlify" was underspecified.** *Fix applied:* step 5 names the
   site, the two-check curl verification, and the known 404 root cause to check.
6. **Risk: 3 animals × full kits inflates Worker C beyond one context.** Steelman
   defense rejected — mitigated instead: C's weapons all map to B's 6 archetypes,
   so each weapon is ~20 lines of JSON, not code. Kept in scope.
7. **Second pass** (post-fix review): fixes introduced no new file-ownership
   collisions; ownership map re-audited — `tests/` shared between C and
   orchestrator resolved by giving C only `content.test.ts` + rarity fixtures.

**This instruction set is ready for single-run execution.** Kick off by giving
the Opus orchestrator Part II (design spec) + Part III (instructions) verbatim.
