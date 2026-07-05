# Nest & Fang — Frozen Contracts (Phase 0)

Read this whole file before writing code. These contracts are FROZEN: if
something seems wrong, pick the simplest interpretation, note it in a
`// DECISIONS:` comment at the top of your file, and keep going.

## Ground rules for every worker

1. Only create/modify files you own (see ownership map). Never edit
   `src/core/*`, `WorldScene.ts`, or another worker's files.
2. Code against `src/core/types.ts` and `src/core/context.ts` as they exist —
   all combat schemas, events, and the `GameContext` combat API are already
   defined there. Import, don't redeclare.
3. Systems get `(scene, ctx)` in their constructor, implement `System`
   (`update(deltaMs)`, optional `destroy()`), communicate ONLY via `ctx.events`
   and the `ctx` API. Register live providers with
   `ctx.registerCombatProvider({...})` in your constructor.
4. Respect `ctx.isPaused()` — skip updates while paused (draft overlay up).
5. Every module must pass `npx tsc --noEmit`. Write vitest unit tests for pure
   logic in `tests/` (only the test files named in your assignment).
6. Sprite rendering: use `SPRITE_KEYS` / `iconKey()` / `frameKey()` from
   `src/gfx/PixelArt.ts`. If `scene.textures.exists(frameKey(key))` is false,
   render a plain fallback shape (circle/rect) so your system runs before the
   atlas lands. Never crash on a missing texture or animation.
7. Object-pool anything spawned repeatedly. Hard caps: `MAX_ENEMIES` (40),
   `MAX_PROJECTILES` (120) from types.ts.
8. Phaser 3.90 APIs, portrait 480x854, world = 40x40 tiles of 32px.

## File-ownership map

| Worker | Owns |
|---|---|
| A — Art | `src/gfx/PixelArt.ts` (implement `buildAtlas`), `src/gfx/sprites/animals.ts`, `enemies.ts`, `world.ts`, `ui.ts`, `src/gfx/sprites/index.ts`, `tests/sprites.test.ts` |
| B — Combat | `src/systems/combat/WeaponSystem.ts`, `EnemySystem.ts`, `WaveDirector.ts`, `XPMoteSystem.ts`, `ProjectilePool.ts`, `tests/combat.test.ts` |
| C — Content | `src/data/weapons.json`, `passives.json`, `enemies.json`, `waves.json`, `cards.json`, `animals.json`, `metaTrees.json`, `tests/content.test.ts`, update fixtures in `tests/rarityWeights.test.ts` if cards change |
| D — Nest/Hunger | `src/systems/NestSystem.ts`, `HungerSystem.ts`, `FoodSystem.ts`, `CompanionSystem.ts`, `tests/nestHunger.test.ts` |
| E — VFX | `src/vfx/Juice.ts`, `DamageNumbers.ts`, `Particles.ts`, `ScreenFX.ts` |
| F — UI | `src/scenes/DraftScene.ts`, `MetaHubScene.ts`, `LifeStoryScene.ts`, `src/ui/HUD.ts` |
| G — Audio+AI | `src/audio/AudioManager.ts`, `src/systems/InstinctAI.ts` |
| Orchestrator | everything else |

## Event payloads

All events are in `EV` (types.ts) with typed payloads: `EnemySpawnedEvent`,
`EnemyDamagedEvent`, `EnemyKilledEvent`, `PlayerDamagedEvent`,
`WeaponFiredEvent` — see types.ts. Untyped payloads are documented inline next
to each EV entry. Emit exactly these shapes.

Key flows:
- Weapon hit: WeaponSystem calls `ctx.damageEnemy(id, dmg, crit)` →
  EnemySystem applies HP, emits `EV.enemyDamaged`; on death emits
  `EV.enemyKilled` + calls `ctx.spawnXPMote` (+ `ctx.spawnFood` per
  `foodDropChance`) + increments `ctx.player.stats.kills/damageDealt`.
- Player hit: EnemySystem calls `ctx.damagePlayer(amount, sourceId)` on
  contact ticks (every `CONTACT_TICK_MS` while overlapping). WorldScene owns
  HP/death (already implemented — do NOT mutate `player.hp` directly).
- XP: XPMoteSystem magnets motes within `XP_MAGNET_RADIUS`
  (+`ctx.statBonus("pickupRadius")`%), calls `ctx.addXP(value)` on collect,
  emits `EV.xpMoteCollected`.
- Level up: WorldScene emits `EV.levelUp` → DraftSystem/DraftScene offer
  choices → on pick, DraftSystem mutates `player.activeWeapons` /
  `activePassives` / `activeCards` and emits `EV.weaponUpgraded` or
  `EV.cardChosen`. (Orchestrator wires this in integration; Worker B exposes
  `WeaponSystem.refresh()` reading player state each frame, so no coupling.)
- Damage bonus: final weapon damage = base × (1 + ctx.statBonus("damage")/100)
  × (ctx.isWellFed() ? 1 + WELL_FED_DAMAGE_BONUS : 1). WeaponSystem applies.

## Passive effect.type registry (statBonus keys)

`damage`, `cooldown` (negative = faster), `area`, `moveSpeed`, `hpRegen`,
`armor` (flat reduction), `pickupRadius`, `luck`, `critPct`, `foodHeal`,
`companionSlots`, `forageSpeed`, `dodgePct`, `wellFedBonus`.
`statBonus(type)` sums card/passive magnitudes; WorldScene merges
`activePassives` into the lookup at integration — Worker C just uses these
type strings in JSON; Worker B/D consume via `ctx.statBonus`.

## Weapons (18) — id, animal, archetype, evolution(requires)

Dog: `bark-blast`(aoe-pulse, start) → Sonic Howl(`loyal-heart`);
`tail-wag-strike`(melee-sweep) → Wag Tornado(`thick-fur`);
`fetch`(projectile/boomerang) → Double Fetch(`keen-nose`);
`zoomies`(trail) → Mach Zoomies(`big-appetite`);
`dig`(zone) → Ambush Den(`thick-fur`);
`slobber-shot`(projectile/arc) → Drool Flood(`big-appetite`).

Cat: `pounce-slash`(melee-sweep, start) → Nine Lives Pounce(`feline-grace`);
`claw-flurry`(melee-sweep) → Shredder(`predator-eye`);
`hairball-lob`(projectile/arc) → Triple Hairball(`picky-eater`);
`purr-aura`(zone) → Thunder Purr(`soft-paws`);
`midnight-prowl`(trail) → Shadow Dance(`feline-grace`);
`yarn-whip`(projectile/straight, pierce) → Yarn Storm(`predator-eye`).

Rabbit: `thumper-quake`(aoe-pulse, start) → Seismic Thump(`spring-legs`);
`bunny-barrage`(trail) → Zig-Zag Blitz(`lucky-foot`);
`carrot-toss`(projectile/split) → Carrot Volley(`nibbler`);
`lucky-clover`(orbit) → Four-Leaf Wall(`lucky-foot`);
`burrow-network`(zone) → Warren Web(`spring-legs`);
`cottontail-decoy`(zone) → Decoy Swarm(`litter-of-friends`).

## Passives (12) — id(animal): effect.type

`loyal-heart`(dog): hpRegen; `thick-fur`(dog): armor; `keen-nose`(dog):
pickupRadius; `big-appetite`(dog): foodHeal; `feline-grace`(cat): dodgePct;
`predator-eye`(cat): critPct; `soft-paws`(cat): moveSpeed;
`picky-eater`(cat): wellFedBonus; `lucky-foot`(rabbit): luck;
`spring-legs`(rabbit): moveSpeed; `litter-of-friends`(rabbit): companionSlots;
`nibbler`(rabbit): forageSpeed.

## Enemies (11) — id: behavior (spriteKey in SPRITE_KEYS)

`slime-green`: chaser; `slime-red`: lunger; `slime-blue`: splitter(→2×green);
`gloomcap`: shooter; `thorn-crawler`: charger; `wisp`: drifter;
`mudmaw`: ambusher; bosses: `king-slime`(0:2:00), `elder-gloomcap`(0:4:00),
`bramble-tyrant`(0:6:00), `the-long-dark`(0:7:40).

## Pacing targets (Worker C tunes JSON to hit these)

- Run: 8:00. Seasons flip at 2:00/4:00/6:00. Bosses per schedule above.
- XP thresholds (`animals.json`, all 3 animals): 5, 15, 30, 50, 75, 110, 150,
  200, 260, 330, then +90/level to MAX_LEVEL 20. Target 14–18 level-ups/run.
- On-screen enemies: ~5 at 0:30 ramping to ~40 (cap) by 7:00.
- Elites: one every ~45s from 1:30 (`elite: true` wave entries).
- Nest raids: scripted by NestSystem at 1:40 and 5:40 (30s warning first).
- Player baseline: 100 HP, dog 200 px/s, cat 210, rabbit 220.

## Draft integration (context for Workers C & F)

Draft pool on level-up = weapons (new, if slots free) + weapon upgrades
(owned, <L5) + evolutions (owned L5 weapon + required passive → mythic-rarity
card) + passives. `cards.json` is REPLACED by C with 18 weapon-cards + 12
passive-cards using the same CardData schema (id matches weapon/passive id,
`effect.type: "weapon"` / `"passive"`), preserving rarity/weightsByLevel
semantics so DraftSystem + rarityWeights keep working unchanged.

## Palette & sizes

Use `PALETTE` from PixelArt.ts. Sizes: 16px (small enemies, projectiles,
pickups, icons), 24px (animals, medium enemies), 32px (tiles, props, nest,
fx rings), 48px (bosses). Everything gets `outline` color edges, 2–4 frames
per anim, squash-and-stretch on slimes.
