# UNDERSTORY — Game Design Document

**Genre:** One-handed mobile roguelite (portrait) · **Session length:** 10–15 min runs · **Aesthetic:** Lo-fi, chill, nature

**Logline:** Live one small life well. Each run is a single animal's lifetime — Spring hatchling to Winter elder — spent foraging, exploring, nesting, and making friends in a soft, unhurried world. No killing, no hordes: the "numbers go up, build goes wild" joy of Vampire Survivors, rebuilt around gathering, discovery, and gentle survival. Every upgrade visibly mutates your animal until, by Winter, it's a wildly accessorized one-of-a-kind creature worth a postcard.

**Pillars:**

1. **Chill, not passive** — light skill (timing rings, swipe-dashes) rewarded; auto-play exists but costs XP.
2. **A life, not a level** — four seasons impose changing pressures; runs end gently.
3. **Your build is your body** — every card changes the sprite; duplicates make it louder.
4. **Kind math** — every upgrade has a drawback, but the upside always clearly wins.

**Contents:** §1 Core Vision & Gameplay Loop · §2 Animals & Meta-Progression · §3 Micro-Progression & Draw Rates · §4 Item Compendium (60 items) · §5 Post-Match Analytics & Visual Evolution

---
## Section 1: Core Vision & Gameplay Loop

### Vision Statement

UNDERSTORY offers the fantasy of living one small life well. There is no war to win and nothing to kill — only a season to survive, a body to grow, a handful of creatures to befriend, and a den to make cozy before the cold arrives. The player is not a hero; they are a vole, a fledgling, a fox kit, quietly getting better at being alive. Where Vampire Survivors, Risk of Rain, and Megabonk hand the player a horde to mow down and a build to snowball against ever-thicker waves of enemies, UNDERSTORY replaces the horde with a season clock and the waves of enemies with the quiet pressure of weather, hunger, and time. The threat is never a monster; it's dusk falling before you've found shelter, or a hawk's shadow crossing a field you can't outrun in.

The design bet is that the "numbers go up, build goes wild" dopamine loop that makes those inspirations so replayable doesn't require combat to work — it requires escalating stakes, constant small decisions, and a character that visibly transforms in front of you. UNDERSTORY keeps all three. Instead of DPS stacking against bullet-hell swarms, the player stacks Forage Yield, Sense Radius, and Comfort against a tightening seasonal clock; instead of dodging projectiles, they read weather fronts and predator shadows; instead of a screen filling with explosions, an animal's silhouette fills with antlers of moss, a trailing wake of fireflies, a coat gone silver-frosted with stacked Winter cards. Every run still ends with a character unrecognizable from where it started — it's just that the escalation reads as growth and adaptation rather than destruction.

Tonally, this is a game meant to be played the way you'd sip tea: unhurried, a little melancholic at the edges (a life is finite, after all), but warm and never grim. A run is a complete, gentle narrative arc — birth to a peaceful winter's end — that fits in a commute, a lunch break, or a wind-down before bed. The "just one more run" pull comes not from chasing a higher kill-count, but from wanting to see what this particular Dog, Cat, or Bird becomes, and what story the Life Story screen will tell about it.

### Moment-to-Moment Loop: A Typical 12-Minute Run

The player picks Dog. Minute 0: Spring begins in a dew-lit meadow clearing. Thumb rests on the lower-left of the screen, dragging to establish the floating joystick and nose around nearby scent trails. First Forage nodes (berries, snails) are visible at base Sense Radius; a tap harvests instantly, but the first hold-and-release timing ring appears on a buried acorn cache — the player's first Focus Action. A near-miss teaches the sweet spot exists.

By minute 2, enough XP has accrued for Level 2: a draft of 3 cards appears (screen softly pauses, no threat during drafts). The player picks a Common Forage Yield card — a small leaf sprouts at the tail slot. Minute 3–4: Spring's milestone, "First Steps" (explore 3 fog tiles + forage 5 nodes), completes, and the life stage advances to Summer (Juvenile). The palette warms; new pressure appears — a hawk shadow sweeps the upper field, teaching Evade via a swipe-dash duck into brush.

Minutes 5–7 are Summer's core: Befriend encounters start appearing (a rabbit shares a timing-based grooming interaction), Explore reveals a pond biome gated behind Sense Radius, and card drafts land roughly every 90 seconds as XP compounds. By minute 7, the Dog has 4–5 cards stacked, its trail now a faint dust-puff, its back sprouting a small satchel. Autumn (Adult) begins at minute 8: Migrate triggers — a short traversal gauntlet crossing a windy ridge, weaving drag-move around gust zones. Surviving it banks Sunseeds early and unlocks the Nest upgrade menu.

Minutes 9–11 are Autumn's crunch: Nest investment (built from foraged materials) raises Comfort, which the player now understands will blunt Winter's Vitality drain — a visible, felt stat interlock, not a tooltip. Winter (Elder) begins at minute 11: screen desaturates to soft blue-grey, Vitality drain ticks up, and the final milestone, "Last Light" (survive to season's end without Vitality hitting 0), is the closing tension. Minute 12: "Return to the Meadow" — the run ends gently, cutting to the Life Story screen.

| Season | Life Stage | Duration | Primary Objectives | New Pressures | Milestone to Advance |
|---|---|---|---|---|---|
| Spring | Newborn | ~3 min | Learn Forage/Explore basics, first Focus Actions | Low Stamina pool, small Sense Radius | "First Steps": explore 3 tiles + forage 5 nodes |
| Summer | Juvenile | ~4 min | Befriend companions, expand map, stack early cards | Predator shadows introduced, Stamina-costly dashes | "Open Country": befriend 1 companion + reach 2nd biome |
| Autumn | Adult | ~3 min | Migrate traversal, Nest investment, build consolidation | Weather fronts (wind/rain), Migrate gauntlet | "Ready the Den": complete Migrate + raise Nest to level 2 |
| Winter | Elder | ~2 min | Endurance on banked build, final Evades | Vitality drain ramps, storms/floods | "Last Light": survive to season's end (or Vitality reaches 0 = early end) |

### Non-Combat Objective Design

**Forage** is the XP backbone: tap or Focus-Action harvest nodes (berries, roots, buried caches) for food and materials, scaled by Forage Yield (quantity) and Forage Speed (harvest animation time). Interlocks with Sense Radius, which reveals additional forage nodes on the mini-map before they're visually on-screen, and with Comfort, since a well-fed Elder suffers less Vitality drain in Winter.

**Explore** uncovers fog-of-war tiles by physically moving into them; each first-discovery grants flat XP and may reveal biome-specific forage or Befriend targets. Sense Radius also expands the passive "already-revealed" halo around the player, reducing blind wandering.

**Nest** converts foraged materials into permanent Comfort and Weather Resistance upgrades at a home node the player returns to; higher Nest levels unlock passive regen and reduce Winter Vitality drain — the clearest late-game payoff for early Forage investment.

**Befriend** triggers short timing-based social minigames (matching a rhythm, mirroring a gesture) with wild animals; success adds them as a permanent run companion granting a passive buff (e.g., a rabbit companion boosts Forage Speed) and grants XP. Charm stat improves success windows.

**Evade** handles all threat response — predator shadows, storms, floods — via hiding (duck into brush/burrow, tap-hold), outrunning (swipe-dash), or dodging (drag away from telegraphed zones). Weather Resistance and Stamina reduce the cost and increase the safe-window of these responses; successful Evades grant a small XP trickle and count toward Life Story stats, but failure only costs Vitality, never a run-ending "hit."

**Migrate** is a discrete traversal challenge bridging Autumn and Winter — a linear gauntlet of wind gusts, river crossings, and narrow ledges using drag-move and dash, rewarding clean completion with bonus Sunseeds and a Nest-upgrade unlock, and never blocking progress outright on failure (a failed Migrate costs Vitality/time but the run continues).

### Controls Specification

| Input | Action | Skill Element | Notes |
|---|---|---|---|
| Drag anywhere | Move (floating joystick) | Directional precision, sustained positioning | Joystick anchors wherever the thumb first touches; no fixed on-screen stick to reach for |
| Quick swipe | Species dash (Dog sprint / Cat pounce / Bird flap-boost) | Timing + directional flick, costs Stamina | Used for both traversal bursts and Evade reactions; Stamina cost teaches resource pacing |
| Hold-and-release (shrinking timing ring) | Focus Action (dig/pounce/dive) | Precision timing on release | Perfect release (±80ms window) = 2× yield; Good release (±200ms window) = 1.35× yield; miss = base yield, no penalty |
| Tap | Interact (harvest, greet, confirm draft) | Reflexive, low-skill-floor | Instant, no animation lock, safe default action for low-attention moments |

This scheme is comfortable one-handed in portrait because every input lives within natural thumb reach from a relaxed lower-screen grip: drag and tap use the same resting position, swipe is a short flick rather than a precise drag-to-target, and the Focus Action ring is anchored at the touch point rather than a fixed screen location, so the player never has to stretch toward a corner. No input requires multi-touch or a second hand.

### Instinct Mode

Instinct Mode is a toggle accessible at any time via a single persistent UI button, switchable mid-run without penalty to run continuity. Once active, the animal auto-navigates toward the highest-value nearby objective (forage, explore, evade) using the same underlying systems the player would otherwise control manually. While active, all XP earned is multiplied ×0.6 (a flat 40% reduction), and Unique-rarity cards are removed from the draft pool entirely — drafts instead reweight across Common through Legendary. Toggling back to active play immediately restores full XP rate and the full rarity pool for all subsequent drafts; no retroactive penalty is applied to cards already drafted.

The design rationale is an accessibility floor, not a difficulty crutch: a player who is tired, has limited mobility, or simply wants to watch a season play out can always finish a run and see a Life Story. But the XP penalty and Unique lockout ensure active play is strictly better for anyone optimizing a build, preserving the skill expression of the timing ring and dash mechanics as the game's actual mastery layer.

---

## Section 2: The Animals & Meta-Progression Trees

### 2.1 Currency Economy

UNDERSTORY runs two currency layers on purpose: one broad, one narrow. **Sunseeds** are the universal currency, earned from every run regardless of animal, and they fund breadth — general power that makes the next run of *any* species a little easier. **Keepsakes** are per-animal currencies, earned only through that animal's own milestones, and they fund depth — identity nodes that only make sense for the creature that earned them.

**Sunseeds.** At the close of a run (natural end at Winter, or early end at Vitality 0), the run's Score is tallied from foraging totals, Nests built, Bonds formed, distance migrated, and Focus Actions landed cleanly. Sunseeds awarded = Score ÷ 100, rounded down. A modest, unhurried run nets roughly 300–700 Sunseeds; a strong Elder-completion run with several Rare+ cards can push past 1,000. Instinct Mode (auto-play) still earns Sunseeds off the same formula, but its ×0.6 XP penalty naturally softens Score too, so it trends toward the lower end of that band — auto-play is a way to rest, not a way to farm currency faster.

**Keepsakes.** Each starting animal has its own Keepsake, earned in small fixed amounts (typically 1–3 per run) from species-flavored milestones rather than from Score:

- **Dog — Buried Bones.** Earned by: burying and later successfully re-digging a cache (1 Bone); befriending a wary animal that initially fled twice before trusting the Dog (2 Bones); completing a full Season without the Dog's Bond count ever dropping to zero (1 Bone); leading a group of 3+ befriended companions across a Migrate transition together (2 Bones); reaching Elder with at least one companion still present from Spring (3 Bones).
- **Cat — Whisker Charms.** Earned by: landing a Focus Action pounce in the "perfect" timing window five times in one run (1 Charm); completing an entire night phase without being detected by a threat (2 Charms); stringing together three perfect-timing Focus Actions consecutively (2 Charms); reaching a Rare+ Luck card draft and having it proc favorably at least once (1 Charm); surviving Winter's close having never taken Vitality damage from a missed timing ring (3 Charms).
- **Bird — Bright Feathers.** Earned by: discovering a hidden nesting site not visible from the main path (1 Feather); completing a Migrate leg using a flap-boost dash chain of 3+ without touching ground (2 Feathers); building a Nest that reaches maximum Comfort rating (1 Feather); weathering a storm event at full Weather Resistance with no Vitality loss (2 Feathers); reaching Elder having visited every biome edge on the current map (3 Feathers).

**Design intent.** Sunseeds represent the animal's *life in general* getting easier — more Stamina, a bit more Charm, a faster start. Keepsakes represent *that specific animal's story* — a Dog's loyalty, a Cat's precision, a Bird's wandering. This split exists deliberately to stop one-animal grinding from unlocking everything: a player who only ever plays Dog will accumulate Sunseeds quickly, but they cannot buy their way into Cat's Nine Shadows capstone or Bird's Storm Sense mastery — those require Whisker Charms or Bright Feathers, which only come from actually playing that animal. Sunseeds keep the meta-game feeling generous and cumulative; Keepsakes keep each animal's identity earned rather than purchased.

### 2.2 Dog — Pack Heart / Deep Digger / Boundless Trail

Dog's tree leans hardest into companions and sustain of any of the three animals. Where Cat rewards a single perfect moment and Bird rewards covering ground, Dog rewards *keeping others close* — the tree is shaped like a widening circle of loyalty, with sustain nodes that let a Dog player weather a long run by leaning on Bonds rather than raw stats. Branch shape: broad and interconnected, several nodes cross-reference Bond count and companion state, culminating in a capstone that breaks the single-run boundary entirely.

| Node | Branch | Tier | Effect | Cost (Sunseeds / Keepsakes) | Prerequisite |
|---|---|---|---|---|---|
| Warm Welcome | Pack Heart | 1 | +10% Charm when approaching a wary animal | 150 Sunseeds | — |
| Steady Paws | Deep Digger | 1 | +15% Forage Speed while digging | 150 Sunseeds | — |
| Long Legs | Boundless Trail | 1 | +8% Movement Speed | 150 Sunseeds | — |
| Familiar Scent | Pack Heart | 2 | Befriended animals trust 20% faster on repeat meetings | 400 Sunseeds | Warm Welcome |
| Cache Memory | Deep Digger | 2 | Buried caches show a faint marker for 1 in-run day | 400 Sunseeds | Steady Paws |
| Second Wind | Boundless Trail | 2 | Stamina regenerates 25% faster after a sprint dash | 400 Sunseeds | Long Legs |
| Shared Warmth | Pack Heart | 2 | Each active companion grants +2 Vitality regen at Nest | 450 Sunseeds | Familiar Scent |
| Root Sense | Deep Digger | 3 | Reveals one Rare+ forage node per Season | 300 Sunseeds + 4 Bones | Cache Memory |
| Trail Marking | Boundless Trail | 3 | Fast-travel between two previously visited Nests once per Season | 300 Sunseeds + 4 Bones | Second Wind |
| Loyal Circle | Pack Heart | 3 | Companion capacity +1 | 350 Sunseeds + 5 Bones | Shared Warmth |
| Old Bones | Deep Digger | 4 | Digging never depletes Stamina | 500 Sunseeds + 8 Bones | Root Sense |
| Endless Horizon | Boundless Trail | 4 | Migrate transitions no longer cost a Focus Action window | 500 Sunseeds + 8 Bones | Trail Marking |
| One of the Family (Capstone) | Pack Heart | 4 | Choose one befriended companion at Winter's close to carry it into the next run as a Spring-start ally | 600 Sunseeds + 10 Bones | Loyal Circle |
| Homeward Bound | Boundless Trail | 4 | Once per run, instantly return to the run's starting Nest at full Comfort | 450 Sunseeds + 6 Bones | Endless Horizon |

### 2.3 Cat — Nine Shadows / Perfect Pounce / Fortune's Whisker

Cat's tree is the leanest and sharpest of the three — fewer safety nets, more payoff for skill. It expresses the Cat's solitary, precise nature: nodes reward stealth, exact timing-ring execution, and turning Luck into decisive swings rather than steady accumulation. Branch shape: narrow and tall, with several Tier 2–3 nodes existing purely to widen the "perfect" timing window or convert successful pounces into Luck procs, ending in capstones that reward mastery rather than survival.

| Node | Branch | Tier | Effect | Cost (Sunseeds / Keepsakes) | Prerequisite |
|---|---|---|---|---|---|
| Soft Step | Nine Shadows | 1 | -20% detection radius from threats at night | 150 Sunseeds | — |
| Steady Eye | Perfect Pounce | 1 | Timing ring's "perfect" window +10% wider | 150 Sunseeds | — |
| Lucky Whisker | Fortune's Whisker | 1 | +10% Luck | 150 Sunseeds | — |
| Vanish | Nine Shadows | 2 | Briefly untargetable for 1s after a successful Evade | 400 Sunseeds | Soft Step |
| Coiled Spring | Perfect Pounce | 2 | Perfect-timing pounces refund half their Stamina cost | 400 Sunseeds | Steady Eye |
| Nine Lives | Nine Shadows | 2 | Once per run, a Vitality-zero hit instead leaves 1 Vitality | 450 Sunseeds | Vanish |
| Double Take | Fortune's Whisker | 2 | Rare+ card offers appear 15% more often in drafts | 400 Sunseeds | Lucky Whisker |
| Shadow Step | Nine Shadows | 3 | Move at full speed while in stealth (normally slowed) | 300 Sunseeds + 4 Charms | Nine Lives |
| Flawless Form | Perfect Pounce | 3 | Perfect-timing pounces have a 25% chance to not spend the Focus Action at all | 350 Sunseeds + 5 Charms | Coiled Spring |
| Charmed Path | Fortune's Whisker | 3 | Once per Season, reroll all three draft cards | 300 Sunseeds + 4 Charms | Double Take |
| Ghost of the Grove (Capstone) | Nine Shadows | 4 | While in stealth, Cat leaves no scent or trail — threats cannot track by scent at all | 500 Sunseeds + 8 Charms | Shadow Step |
| One True Strike (Capstone) | Perfect Pounce | 4 | Perfect-timing pounces on a Focus Action always succeed regardless of stat thresholds | 550 Sunseeds + 9 Charms | Flawless Form |
| Nine-Fold Fortune | Fortune's Whisker | 4 | Legendary and Unique cards can appear even before their normal level gate | 500 Sunseeds + 8 Charms | Charmed Path |
| Whisker's Edge | Perfect Pounce | 4 | Timing ring displays a hairline "true perfect" sub-window granting double effect | 450 Sunseeds + 7 Charms | Flawless Form |

### 2.4 Bird — Wind Rider / Master Weaver / Storm Sense

Bird's tree is the most spatial of the three: it trends toward mobility, map-knowledge, and nesting mastery rather than companions or timing. Where Dog builds a circle of loyalty and Cat sharpens a single moment, Bird's tree widens the *world* — more of the map becomes visible, reachable, and safe. Branch shape: sprawling and exploratory, with several nodes unlocking permanent map-knowledge that persists in a way the other two animals' trees don't touch.

| Node | Branch | Tier | Effect | Cost (Sunseeds / Keepsakes) | Prerequisite |
|---|---|---|---|---|---|
| Light Bones | Wind Rider | 1 | +10% flap-boost distance | 150 Sunseeds | — |
| Twig Sense | Master Weaver | 1 | +15% Comfort gained per Nest material gathered | 150 Sunseeda | — |
| Feather Guard | Storm Sense | 1 | +10% Weather Resistance | 150 Sunseeds | — |
| Updraft Instinct | Wind Rider | 2 | Flap-boost dash chains lose 20% less height per chain link | 400 Sunseeds | Light Bones |
| Woven Warmth | Master Weaver | 2 | Nests retain Comfort across Season transitions | 400 Sunseeds | Twig Sense |
| Fair Weather Eye | Storm Sense | 2 | Storm events are visible on the map 1 full day before arrival | 400 Sunseeds | Feather Guard |
| Second Wingbeat | Wind Rider | 2 | Flap-boost Stamina cost -20% | 450 Sunseeds | Updraft Instinct |
| Charted Skies | Master Weaver | 3 | Previously visited biome edges remain permanently revealed on the map across runs | 300 Sunseeds + 4 Feathers | Woven Warmth |
| Tailwind | Wind Rider | 3 | Migrate legs cost 25% less Stamina | 350 Sunseeds + 5 Feathers | Second Wingbeat |
| Storm Reader | Storm Sense | 3 | During storms, Sense Radius is unaffected by reduced visibility | 300 Sunseeds + 4 Feathers | Fair Weather Eye |
| Grand Nest (Capstone) | Master Weaver | 4 | Nests can reach a new "Grand" Comfort tier granting passive Vitality and Stamina regen even while away foraging | 550 Sunseeds + 9 Feathers | Charted Skies |
| Eye of the Storm (Capstone) | Storm Sense | 4 | Bird gains a small Vitality and Forage Yield bonus specifically *during* storm events instead of merely resisting them | 550 Sunseeds + 9 Feathers | Storm Reader |
| Endless Sky | Wind Rider | 4 | Flap-boost dashes no longer require ground contact to reset | 500 Sunseeds + 8 Feathers | Tailwind |
| Homing Instinct | Master Weaver | 4 | Once per run, instantly reveal the full current biome map | 450 Sunseeds + 7 Feathers | Charted Skies |

### 2.5 Unlock Cadence

In a new player's first ~10 runs, expect them to clear most of Tier 1 across all three branches of whichever animal they favor (roughly 450 Sunseeds total, achievable within 2–4 runs of average Score), and to have started accumulating their first Keepsakes naturally through normal play rather than deliberate farming — most players will have 3–6 Keepsakes of their starting animal's type by run 10, enough to just barely reach a single Tier 3 node if they've been focused. Sunseeds earned across those runs (roughly 3,000–5,000 cumulative) comfortably clear Tier 1 and most of Tier 2 for one animal, with some spillover left for a second animal's Tier 1 nodes, encouraging early cross-animal sampling even for players with a favorite.

Completing one full animal tree — all Tier 1–4 nodes including both capstones — targets **40–60 runs** of that animal, gated primarily by Keepsake accumulation (Tier 3–4 nodes require 4–10 Keepsakes each, and Keepsakes arrive at 1–3 per run only when their milestone conditions are actually met). Sunseeds alone will typically outpace Keepsake generation, meaning a dedicated player hits a Sunseed surplus around run 25–30 and spends the remainder of the 40–60 run arc waiting on milestone-gated Keepsakes rather than currency — a deliberate pacing choice that keeps the endgame of each tree feeling like mastery of that animal's play pattern, not a grind against a number.
## Section 3: Micro-Progression & Draw Rates

### The 3-Card Draft

The draft triggers on every level-up — foraging XP, tile exploration XP, befriending XP, and seasonal-goal XP all feed the same level meter, so a draft can interrupt any verb at any moment. When it fires, the run pauses in place (no ambient threats in UNDERSTORY, so there's no penalty for standing still) and a **card fan rises from the bottom third of the screen**, angled for one-handed thumb reach: three cards arc within a comfortable thumb-sweep of the dominant-hand corner, large enough to read at a glance, with a soft parallax tilt as the player's thumb hovers each one. Rarity is communicated by border treatment (Common: plain moss-green outline, up through Unique: a faint firefly shimmer around the card edge) so players can read value before reading text.

Each card shows its positive effect, its trade-off, and a small preview icon of the visual slot it will change. A **Skip** option sits as a small leaf-shaped button below the fan — skipping declines all three cards and grants a small XP refund (enough to noticeably close the gap to the next level, intentionally less generous than taking even the weakest offered card, so skipping is a real but costly choice rather than a trap option).

Two **meta-unlockables** (earned via the overworld/nest progression between runs, not mid-run currency) soften the draft over time:
- **Reroll Charm** — once unlocked, grants 1 free reroll of the current 3-card fan per run (replaces all three cards with a new draw at the same level-scaled weights).
- **Banish Pebble** — once unlocked, lets the player permanently remove one specific card from their personal draft pool before starting a run, for that run only re-added next run unless banished again.

Both are nest-menu unlocks earned through cumulative play (e.g., total seasons survived, total animals befriended) rather than in-run pickups, keeping the in-run draft itself simple and readable.

### Rarity Weight System

Each rarity has a base weight that scales with the player's current in-run level (**L**), capped at L = 30 for all formulas below (levels beyond 30 use the L = 30 values — runs are short enough that this is a soft ceiling, not a hard wall players will bump against often).

```
Common:     max(45 − 1.5L, 10)
Uncommon:   30                                  (flat)
Rare:       min(15 + 0.8L, 30)
Epic:       min(7 + 0.5L, 18)
Legendary:  min(2.5 + 0.25L, 9)
Unique:     0 if L < 5 or Instinct Mode active
            else min(0.5 + 0.15L, 5)
```

Raw weights are summed and each rarity's share is normalized to a percentage at the moment of each draw. This means the *relative* pull of higher rarities grows smoothly across a run — a Spring newborn sees mostly Commons and Uncommons, while an Autumn/Winter Adult or Elder sees a meaningfully richer mix — without ever fully closing off the low end (Common never drops below 10 raw weight, so it's always possible, just increasingly unlikely).

**Normalized draw-chance table** (percentages, rounded to one decimal; each row sums to 100.0%):

| Level | Common % | Uncommon % | Rare % | Epic % | Legendary % | Unique % |
|---|---|---|---|---|---|---|
| 1  | 43.7 | 30.1 | 15.9 | 7.5  | 2.8 | 0.0 |
| 5  | 37.1 | 29.7 | 18.8 | 9.4  | 3.7 | 1.2 |
| 10 | 29.4 | 29.4 | 22.5 | 11.8 | 4.9 | 2.0 |
| 15 | 21.8 | 29.1 | 26.2 | 14.1 | 6.1 | 2.7 |
| 20 | 14.6 | 29.1 | 29.1 | 16.5 | 7.3 | 3.4 |
| 25 | 9.9  | 29.7 | 29.7 | 17.8 | 8.7 | 4.2 |
| 30 | 9.8  | 29.4 | 29.4 | 17.6 | 8.8 | 4.9 |

Notable curve behavior: Common and Rare weights cross around L≈13–14 (both near 23–24%, visible as Common falls through Rare's rising line between the L=10 and L=15 rows). Uncommon stays remarkably stable (29–30%) across the entire run since it's the only flat weight in a field of shifting neighbors — it dips slightly in relative share only as Rare/Epic/Legendary/Unique claim more of the normalized pool. By L=25–30, Common and Legendary weights begin to plateau against their respective floor/cap, which is why the L=25 and L=30 rows look nearly identical — the system is intentionally "spent" by late Autumn/Winter, so late-run drafts feel consistently rich rather than ever-escalating.

### Luck

Each point of Luck the player has accumulated (from Luck-boosting cards, stacked) multiplies the raw weights of **Rare, Epic, Legendary, and Unique only** by (1 + Luck%) — Common and Uncommon are left untouched — before the whole set is normalized. This makes Luck a pure "shift the good-stuff tail wider" stat rather than a Common-suppressor, keeping it additive to build identity rather than a hard-counter to bad luck.

**Worked example — L = 15, +20% Luck (Luck multiplier = 1.20):**

Base raw weights at L=15: Common 21.5(raw not yet computed, see below), Uncommon 30, Rare 27, Epic 14.5, Legendary 6.25, Unique 2.75.

Step 1 — raw weights at L=15 (from the formulas):
- Common = max(45 − 1.5×15, 10) = max(22.5, 10) = 22.5
- Uncommon = 30
- Rare = min(15 + 0.8×15, 30) = min(27, 30) = 27
- Epic = min(7 + 0.5×15, 18) = min(14.5, 18) = 14.5
- Legendary = min(2.5 + 0.25×15, 9) = min(6.25, 9) = 6.25
- Unique = min(0.5 + 0.15×15, 5) = min(2.75, 5) = 2.75

Step 2 — apply +20% Luck to Rare/Epic/Legendary/Unique only:
- Rare' = 27 × 1.20 = 32.4
- Epic' = 14.5 × 1.20 = 17.4
- Legendary' = 6.25 × 1.20 = 7.5
- Unique' = 2.75 × 1.20 = 3.3
- Common and Uncommon unchanged: 22.5 and 30

Step 3 — sum: 22.5 + 30 + 32.4 + 17.4 + 7.5 + 3.3 = 113.1

Step 4 — normalize:
- Common: 22.5 / 113.1 = 19.9%
- Uncommon: 30 / 113.1 = 26.5%
- Rare: 32.4 / 113.1 = 28.6%
- Epic: 17.4 / 113.1 = 15.4%
- Legendary: 7.5 / 113.1 = 6.6%
- Unique: 3.3 / 113.1 = 2.9%

(Sums to 99.9% due to rounding.) Compare to the no-Luck L=15 row (21.8 / 29.1 / 26.2 / 14.1 / 6.1 / 2.7) — Luck visibly thins Common and Uncommon's *share* even though their raw weight never changed, simply because the denominator grew from the boosted rarities around them.

### Pity Rule

The system tracks a rolling counter of consecutive drafts offered without a single Epic, Legendary, or Unique card appearing among the three options. If that counter reaches **4 consecutive drafts** with no Epic+ shown, the 5th draft guarantees one of its three slots is forced to Epic-or-above (rolled normally among Epic/Legendary/Unique using their relative weights at that level, then the remaining two slots draw normally from the full pool). The counter resets to zero the moment any Epic+ is offered, whether the player picks it or not — the pity system guarantees *visibility*, not selection, preserving the meaningfulness of the choice.

### Trade-off Philosophy

Every card in UNDERSTORY carries a drawback because a purely additive draft flattens build identity into "take the biggest number" — trade-offs are what force distinct playstyles to emerge (a Forage-Yield glutton who accepts slower movement plays a different run than a Sense-Radius scout who accepts thinner Comfort), and they guarantee no card is ever strictly dead weight in every context, which keeps the draft screen a real decision rather than a formality. They also seed the quiet end-of-run attribution drama UNDERSTORY leans on ("your Elder was slow but never went hungry, because of that one Mossy Anchor you took back in Spring"). Mechanically this is enforced by the 3–5× rule: a card's positive expected value (its magnitude × how often the relevant stat matters across a run) should outweigh its negative expected value by roughly three to five times. Worked example: **Glimmerdew Paws** (+18% Forage Speed / −4% Movement Speed) — Forage Speed applies during the frequent, repeated Forage action across the whole run, while the Movement Speed cost is a flat, situational tax; at roughly 4.5× the magnitude and far higher frequency of relevant use, the positive dominates in practice even though the player still feels the slower amble between patches.

## Section 4: The Item Compendium (Part 1 — Common, Uncommon, Rare)

### Common Cards

| Name | Positive Effect | Negative Trade-off | Visual Change | Stacking Behavior |
|---|---|---|---|---|
| Clover Tuft | +10% Forage Yield | −3% Movement Speed | **Paws** — a small four-leaf clover sprouts between the toe pads | Each stack adds another clover to the paw cluster; yield and speed penalty both add linearly, cluster visibly thickens into a small tuft by stack 3 |
| Pebble Anklet | +12% Weather Resistance | −3% Stamina | **Tail** — a single smooth river pebble threaded near the tail base | Additional stacks add more pebbles in a small strand along the tail; each stack's pebble is slightly larger than the last |
| Dew Drop Charm | +9% Sense Radius | −3% Forage Speed | **Head** — one bead of dew balanced between the ears | Stacks add extra dew beads in a small arc over the head; they catch light more with each added stack |
| Firefly Speck | +10% Charm | −2% Sense Radius | **Aura** — a single tiny firefly-light mote orbiting the body | Each stack adds one more orbiting mote; by stack 3 the motes form a slow lazy ring |
| Mossy Anchor | +15% Comfort (nest) | −4% Movement Speed | **Back** — a thin patch of soft moss across the shoulders | Moss patch spreads wider and thicker across the back per stack |
| Windgrass Wisp | +11% Movement Speed | −3% Forage Yield | **Trail** — a faint ribbon of pale grass-blades trailing each step | Trail lengthens and gains extra grass-blade strands with each stack |
| Sunwarm Fluff | +13% Stamina | −4% Weather Resistance | **Back** — a small tuft of sun-bleached fluffy fur | Fluff tuft grows larger and slightly brighter (more sun-bleached) per stack |
| Quiet Paws | +10% Sense Radius | −3% Charm | **Paws** — paw pads dusted faintly grey, muting footfall shimmer | Grey dusting deepens and spreads further up each paw per stack |
| Acorn Cap Charm | +14% Forage Yield | −4% Stamina | **Head** — a tiny acorn cap worn like a tilted hat | Additional acorn caps stack in a small jaunty pile atop the head |
| Trickling Luck Bead | +8% Luck | −2% Forage Speed | **Aura** — a single faint droplet-shaped glimmer that drifts slowly | Extra beads join the drift pattern, each stack adding a slow circling glimmer |

### Uncommon Cards

| Name | Positive Effect | Negative Trade-off | Visual Change | Stacking Behavior |
|---|---|---|---|---|
| Bramblehide Wrap | +22% Weather Resistance | −5% Movement Speed | **Back** — a light lattice of thin bramble-vine wraps the flank | Lattice grows denser and wraps further around the torso per stack |
| Whispering Reeds | +20% Sense Radius | −5% Charm | **Tail** — slender reed-blades woven along the tail's length | Reeds lengthen and multiply along the tail, rustling more visibly per stack |
| Honeywell Paws | +18% Forage Yield | −5% Movement Speed | **Paws** — a faint honey-amber glaze over the paw pads | Glaze deepens in color and spreads up the ankle with each stack |
| Nimble Fernstep | +23% Movement Speed | −6% Forage Yield | **Trail** — bright fern-frond prints that flicker and fade behind each step | Frond prints multiply and linger longer on the ground per stack |
| Glowmoth Aura | +19% Charm | −5% Sense Radius | **Aura** — a soft ring of pale moth-wing light circling the body | Ring widens and gains a second faint orbiting band per stack |
| Featherdown Nest-Wrap | +24% Comfort (nest) | −6% Stamina | **Back** — a downy ruff of soft feather-fluff across the shoulders | Ruff grows fuller and puffier, extending toward the neck per stack |
| Glimmerdew Paws | +18% Forage Speed | −4% Movement Speed | **Paws** — paw pads glisten faintly with a permanent dew-sheen | Sheen intensifies and spreads to the full paw, faint droplet trail appears at higher stacks |
| Stormcoat Bristle | +21% Weather Resistance | −5% Charm | **Back** — bristly, slightly unkempt fur ridge along the spine | Ridge grows taller and bristlier, spreading further down the back per stack |
| Fourleaf Fortune | +16% Luck | −5% Forage Yield | **Aura** — a slow-spinning cluster of tiny four-leaf clovers | Cluster gains more spinning clovers and orbits slightly faster per stack |
| Sureheart Vitals | +20% Vitality | −5% Stamina | **Head** — a subtle warm rosy glow beneath the fur at the cheeks | Glow deepens in warmth and spreads further across the face per stack |

### Rare Cards

| Name | Positive Effect | Negative Trade-off | Visual Change | Stacking Behavior |
|---|---|---|---|---|
| Elderroot Crown | +32% Forage Yield | −7% Movement Speed | **Head** — a small woven crown of gnarled root-tendrils and tiny leaves | Crown grows additional root-tendrils and leaves, becoming visibly more elaborate per stack |
| Stillwater Gaze | +30% Sense Radius | −6% Charm | **Head** — eyes take on a faint still-water shimmer, reflecting surroundings | Shimmer deepens and a faint ripple-ring effect appears around the head at higher stacks |
| Kindling Ember Trail | Minor mechanic change: leaves a warm ember-trail that reveals hidden forage nodes within it for a few seconds | −6% Weather Resistance | **Trail** — a low trail of warm amber embers drifting behind each step | Trail widens and embers linger longer, revealing a larger radius per stack |
| Thistledown Drift | +35% Movement Speed | −8% Forage Yield | **Trail** — a stream of drifting thistle-seed fluff following each bound | Fluff stream thickens and drifts further behind the animal per stack |
| Hollowreed Charm | +28% Charm | −6% Sense Radius | **Aura** — a low, warm hum of visible sound-rings rippling outward | Rings ripple further and gain a second overlapping layer per stack |
| Evergreen Warden | +30% Weather Resistance | −7% Stamina | **Back** — a thick mantle of evergreen needles fused into the fur | Mantle thickens and needle-color deepens, spreading toward the tail per stack |
| Nightbloom Nest | Minor mechanic change: Nest actions also grant a small burst of XP on completion | −7% Comfort (nest) baseline (nest fills slower before the bonus triggers) | **Back** — pale moonflower blossoms bloom faintly along the spine at dusk | Additional blossoms bloom along the spine, glowing brighter at higher stacks |
| Foxfire Luckwisp | +26% Luck | −6% Forage Speed | **Aura** — a cluster of drifting green-blue foxfire embers circling lazily | Embers multiply and circle faster, trailing faint sparks per stack |
| Ironbark Vitality | +33% Vitality | −7% Movement Speed | **Back** — bark-like ridges harden faintly along the spine | Ridges spread and harden further, darkening in tone per stack |
| Wanderer's Compass Paw | Minor mechanic change: reveals the next seasonal-goal tile's general direction on the map | −8% Stamina | **Paws** — one forepaw marked with a faint spiral compass rune | Rune glows brighter and a second paw gains the marking at higher stacks |
## Section 4: The Item Compendium (Part 2 — Epic, Legendary, Unique)

### Epic Cards

Epic cards are where UNDERSTORY starts bending its own rules instead of just padding stats. Each one delivers a strong, focused power spike — a large stat swing or a small new mechanic — while keeping the animal recognizably itself, just touched by something remarkable. The trade-offs here should sting a little on paper but rarely change how a player actually plays.

| Name | Positive Effect | Negative Trade-off | Visual Change | Stacking Behavior |
|---|---|---|---|---|
| Aurora-Slick Fur | +50% Weather Resistance | −8% Movement Speed | Back: fur gains a faint shifting sheen of green-violet light | Stack 2: sheen brightens and ripples slowly; Stack 3: full-body soft glow, fur visibly rippling like curtains of light |
| Thunderhead's Hush | +45% Sense Radius during storms | −8% Charm while storm active | Aura: a small quiet halo of still air that bends falling rain around the animal | Stack 2: halo widens, rain visibly parts in an arc; Stack 3: distant thunder audibly softens near the animal |
| Migrating Star Compass | Reveals the next zone's Nest spot on the map at run start; +30% Migrate speed | −10% Forage Yield while traveling | Head: a tiny constellation of freckled light dots across the brow | Stack 2: constellation animates, slowly rotating; Stack 3: a faint trailing arc connects the dots like a drawn star-path |
| Glasswing Molt | +40% Forage Speed near flowering plants | −8% Vitality near open water | Tail: tail-tip fringe turns translucent, veined like an insect wing | Stack 2: translucency spreads halfway up tail; Stack 3: whole tail shimmers glass-clear, catching light in motion |
| Coalseam Ember-Step | Footprints briefly warm frozen ground, +35% Stamina regen on warmed ground | −6% Movement Speed on unwarmed ground | Paws: paw pads glow a low banked-ember orange | Stack 2: glow brightens, faint smoke wisps on each step; Stack 3: each footprint leaves a lingering ember-outline for several seconds |
| Whistling Reed Chorus | Nearby wild creatures periodically call out visible Forage nodes; +30% effective Sense Radius | −7% Comfort (nest feels busier, less restful) | Trail: a faint ripple of bent reeds/grass follows the animal's path | Stack 2: ripple widens and audibly rustles; Stack 3: a soft chorus of reed-whistle notes trails the animal |
| Mirror Pool Reflection | Charm checks may roll twice, take better result, +45% effective Charm | −8% Luck (reflections confuse fortune) | Aura: a thin ring of still, mirror-bright water hovers just above the ground | Stack 2: ring widens, faint duplicate silhouette visible in it; Stack 3: reflection independently mimics the animal's movements a half-beat behind |
| Sunfall Pollen Burst | Triggers a pollen cloud on big Forage hauls, +50% Forage Yield on trigger | −10% Forage Speed for a few seconds after | Back: shoulders dusted with luminous golden pollen | Stack 2: pollen cloud grows, drifts further; Stack 3: cloud lingers, catching afternoon light in visible shafts |
| Deep Root Anchor | +55% Vitality while stationary or nesting | −9% Movement Speed for a moment after moving | Paws: faint root-like tendrils briefly touch down with each step | Stack 2: tendrils reach further, visibly flex into soil; Stack 3: a small ring of temporary sprouts marks resting spots |
| Cricketsong Tempo | Stamina regenerates in rhythmic pulses timed to a soft chirping cue, +40% Stamina efficiency | −6% Sense Radius during the pulse (briefly distracted) | Aura: faint musical notes drift upward in time with the pulse | Stack 2: notes multiply, pulse audibly richer; Stack 3: a full soft chorus surrounds the animal on each pulse |

### Legendary Cards

Legendaries are build-defining wonders — the kind of card a run gets built around. Each introduces a genuine new behavior loop (autonomous helpers, chain reactions, echoing effects) rather than just a bigger number, and the negative should cost the player something they'll actually feel, not just a stat line. Visually, these are where the animal starts looking touched by something larger than itself.

| Name | Positive Effect | Negative Trade-off | Visual Change | Stacking Behavior |
|---|---|---|---|---|
| Ancient Grove Heartwood | Summons a slow-following sapling companion that autonomously forages small nodes for you | −10% Forage Yield on nodes you forage personally (grove prefers to give through the sapling) | Back: a slender sapling grows from between the shoulders, swaying independently | Stack 2: second sapling sprouts, forages in parallel; Stack 3: a small mobile grove of three saplings trails behind |
| Comet Dust Trail | Perfect-timed Evades leave a comet-dust patch that grants +40% Movement Speed to the next animal (or self) crossing it | −8% Stamina cost on all Evades (the burn takes more out of you) | Trail: sparse trail of bright dust motes behind sharp turns | Stack 2: trail becomes continuous during any Evade; Stack 3: trail ignites in a faint comet-tail streak visible from a distance |
| Everdusk Second Wind | Once per season, surviving a near-fatal hazard triggers a full Stamina and Vitality restore in a burst of dusk-colored light | −12% Weather Resistance for the rest of that season (the burst leaves you thin-skinned) | Aura: a deep violet-gold corona that only appears after the trigger, fading slowly | Stack 2: corona lingers twice as long, restore is larger; Stack 3: corona leaves faint permanent dusk-flecks in the fur after fading |
| Resonant Node Echo | A perfectly timed Forage releases an echo that instantly triggers all Forage nodes within Sense Radius | −9% Forage Yield per individual node (echoed hauls are smaller each) | Paws: a faint ring pulse visibly radiates outward from each paw on trigger | Stack 2: echo radius doubles; Stack 3: echo chains a second time at reduced strength, visible ripple-within-ripple |
| Kinfolk Migration Call | All companion animals in Sense Radius copy your current buffs at 50% strength for the rest of the season | −10% Charm (others feel your call is a bit overwhelming, harder to befriend anew) | Head: a soft ring of floating feathers/petals orbits the crown, color matching current buffs | Stack 2: orbit ring doubles in items, copy strength rises to 65%; Stack 3: ring becomes a full slow halo, briefly visible to nearby wildlife as a shimmer |
| Glacierglass Memory | Weather Resistance banked from calm periods can be spent instantly as a shield against one severe storm | −8% Stamina regen while banking (holding the charge is tiring) | Tail: tail encased faintly in clear, faintly glowing ice that doesn't melt | Stack 2: ice extends partway up the back leg, bank cap increases; Stack 3: ice develops fine internal cracks of light, bank cap doubles |
| Lantern Moth Migration | Spawns a small escort of lanternlight moths that reveal all hazards within Sense Radius as soft glowing outlines | −8% Stamina Speed at night (the moths crowd your steps) | Aura: a loose ring of tiny glowing moths circling at shoulder height | Stack 2: moth ring doubles, hazards outlined further out; Stack 3: moths form a slow-drifting lantern trail behind the animal as well |
| Wyldwood Understory Bloom | Nesting in place for a few seconds causes flowers to bloom in a radius, each providing a small rotating buff | −10% Comfort gain from the nest itself (energy goes to the bloom, not you) | Trail: flowers sprout and linger briefly wherever the animal stands still | Stack 2: bloom radius doubles, more buff variety; Stack 3: blooms persist permanently at that nest site as a small garden |
| Skyfall Feather Cloak | Grants a single free fall-negating glide once per season, leaving a trail of drifting feathers | −8% Sense Radius while gliding (wind rushing past dulls awareness) | Back: a light cloak of oversized, faintly luminous feathers drapes the shoulders | Stack 2: glide becomes twice per season, cloak visibly fuller; Stack 3: cloak feathers trail and scatter beautifully on landing, third-season charge added |
| Hollow Log Second Chance | The first hazard encounter each season is automatically evaded by ducking into a phantom hollow log that appears instantly | −10% Luck for the rest of that season (fortune is spent on the save) | Paws: faint bark-textured markings ring both front paws | Stack 2: the phantom log leaves a temporary real shelter behind for a few seconds after use; Stack 3: markings spread to all four paws, save extends to first two hazards per season |

### Unique Cards

Uniques are mythic — one per run, and each one quietly rewrites a rule of UNDERSTORY itself rather than just boosting the animal. These are the cards a whole run gets planned around and remembered for. Their negatives are deliberately not percentages: they're constraints on how the player is allowed to play, making every Unique a real commitment, not a free upgrade. As per the bible, none of these appear during Instinct Mode.

| Name | Positive Effect | Negative Trade-off | Visual Change | Stacking Behavior |
|---|---|---|---|---|
| The Second Spring | Grants the animal one full extra life stage: after Winter (Elder), the run continues into a bonus "Second Spring" stage with fresh stat baselines | You can no longer choose when the run ends — the run only ends when the Second Spring stage naturally concludes, even if you'd rather stop sooner | Aura: a permanent ring of pale new-blossom light encircles the animal from the moment it's drafted | Unique — 1 stack; the blossom-light aura, present for the rest of the run |
| Winterheart Ember | Inverts Winter's pressure: cold zones become Stamina-restoring instead of draining, and frozen hazards become safe shortcuts | You can no longer benefit from Weather Resistance cards — all Weather Resistance bonuses are set to zero for the run | Back: a small permanent ember glows beneath the fur at the base of the neck, visible even at rest | Unique — 1 stack; the neck-ember glow, present for the rest of the run |
| The Unmoved Nest | Your nest becomes permanently anchored at its first placement, and it gains a passive aura that slowly restores all stats to any animal resting within sight of it, friend or rival | Your nest cannot be moved or rebuilt for the rest of the run, even if the terrain around it becomes hazardous | Aura: a wide, gentle green-gold dome of light marks the nest's fixed location on the map at all times | Unique — 1 stack; the nest-dome marker, present for the rest of the run |
| Hazardbloom Pact | All hazards in the world are replaced by rare flowering "hazard-blooms" that grant a large Forage Yield burst if approached closely and calmly | You can no longer Evade — the Evade verb is disabled for the whole run; every close call must be walked through deliberately | Trail: a faint procession of small flowers blooms and wilts in the animal's wake, marking former hazard zones | Unique — 1 stack; the blooming trail, present for the rest of the run |
| The Comet's Bargain | Once per run, instantly skip to the final season (Winter/Elder) with all stats doubled for that season | You can no longer see or accept card drafts before the skip is used — until you trigger the bargain, all level-ups are auto-resolved randomly | Head: a small persistent shard of comet-glass rests just behind the ear, glinting even in shade | Unique — 1 stack; the comet-glass shard, present for the rest of the run |
| Old Grove's Memory | The map remembers every Nest, hazard, and rare Forage node from your previous runs and reveals them from the very start of Spring | You can no longer relocate to a newly generated map layout — this run always begins on the most recently played map | Paws: bark-like rings, faint as tree growth lines, wrap each ankle permanently | Unique — 1 stack; the bark-ring markings, present for the rest of the run |
| Kinship of the Wild Choir | Every wild animal on the map becomes permanently Charmed and follows at a distance, forming a slow-moving entourage that distracts hazards away from you | You can no longer gain Charm from drafted cards — all future Charm-boosting cards instead convert to a different random stat when drafted | Aura: a wide, soft ring of assorted small woodland silhouettes drifts loosely around the animal at all times | Unique — 1 stack; the woodland-entourage aura, present for the rest of the run |
| Everswitch Molt | At the start of each season, the animal may fully swap its visual mutation loadout between two saved sets, instantly changing which cards' visuals are shown (effects remain) | You can no longer draft new cards during Autumn — that season's drafts are permanently skipped in exchange for the swapping power | Trail: a shimmering double-afterimage trail, hinting at the "other" loadout not currently shown | Unique — 1 stack; the double-afterimage trail, present for the rest of the run |
| The Long Thaw | Freezes the season timer indefinitely once triggered — the current season never advances until you manually choose to migrate forward | You can no longer gain Vitality from Forage — Forage only yields Stamina and Luck for the rest of the run | Back: delicate frost-flower patterns bloom across the fur and never melt | Unique — 1 stack; the frost-flower fur pattern, present for the rest of the run |
| Spirit of the Understory | Transforms every hazard in the run into a one-time Rare-tier Forage opportunity the first time it's encountered, permanently clearing that hazard from the map | You can no longer re-roll or skip drafts — every 3-card draft's first option must be taken, no exceptions | Aura: a deep, slow-pulsing forest-green glow that faintly illuminates the ground the animal walks on | Unique — 1 stack; the forest-glow ground-light, present for the rest of the run |
## Section 5: Post-Match Analytics & Visual Evolution Mechanics

### Life Story Screen

The Life Story screen is a four-part sequence, each swiped through at the player's own pace (tap or swipe to advance, no forced timers).

**Screen 1 — The Life Told:** A gentle horizontal timeline rendered as a sun-path arcing across the four seasons, with small icons marking key beats (first steps, first friend, the Migrate crossing, the final evening). A soft narrated-style caption line accompanies each beat (e.g., "In Summer, a rabbit became a friend on the third try"). This screen is pure narrative, no numbers.

**Screen 2 — Stats:** The full quantitative record of the run, organized into categories (Foraging, Exploration, Social, Survival, Nest) with counters ticking upward on entry for tactile satisfaction.

**Screen 3 — Card Value Breakdown:** A ranked list of every card carried, showing stacks, positive value delivered, negative cost incurred, and net contribution — the mechanism detailed below.

**Screen 4 — Rewards:** Sunseeds earned (with the scoring formula's major contributors highlighted), per-animal Keepsakes collected, and the end-of-run portrait, with a single share button.

### Full Stat Tracking List

Tracked continuously during the run and displayed on Screen 2:

1. Food gathered — berries
2. Food gathered — roots/tubers
3. Food gathered — insects/snails
4. Food gathered — total (all types)
5. Materials gathered (Nest-building)
6. Tiles discovered (fog-of-war)
7. Biomes fully revealed
8. Friends made (successful Befriends)
9. Befriend attempts failed
10. Perfect Focus Action releases (±80ms)
11. Good Focus Action releases (±200ms)
12. Focus Actions missed
13. Close calls with predators (Evade triggered, survived)
14. Evades failed (Vitality lost to a threat)
15. Distance traveled (total, in meadow-lengths)
16. Longest single evasion (duration outrunning/hiding from one threat)
17. Storms/floods weathered
18. Nest level reached
19. Comfort at run's end
20. Highest Vitality reached
21. Lowest Vitality survived
22. Stamina spent (total dash/Focus usage)
23. Life stage reached (Newborn/Juvenile/Adult/Elder)
24. Migrate gauntlets completed
25. Cards drafted (total) and by rarity
26. Sunseeds earned this run
27. Keepsakes collected this run

### Per-Card Value Attribution System

Each equipped card instance maintains a live counter object updated every time its effect triggers, logging both a positive value delivered and a negative cost incurred in comparable units (food-equivalent or seconds, then normalized to a single "Run Score" point value at run's end). The general pattern:

- **Yield-type cards** (e.g., Forage Yield): `marginal_food += base_gain × bonus%` on every harvest.
- **Speed-type cards** (e.g., Movement Speed, Forage Speed): `time_saved += distance / (speed_with_card) − distance / (speed_without_card)` summed per movement/harvest tick, then converted to score via a seconds-to-score constant.
- **Defensive/utility cards** (e.g., Weather Resistance, Comfort): `vitality_saved += drain_avoided_this_tick`, converted to score via a vitality-to-score constant.
- **Negatives** (every card's trade-off) are costed identically and symmetrically: a −3% Movement Speed trade-off logs `time_lost` the same way a positive speed card logs `time_saved`; a −Stamina-regen trade-off logs lost Focus/dash opportunities in the same unit as the positive side. This symmetry is what makes "net contribution" a fair, defensible number rather than marketing spin.

At run's end, each card's `net_contribution = positive_value_score − negative_cost_score`, and `% of Run Score = net_contribution / total_run_score`.

**Worked example — 5-card build (Dog, ends at Level 6):**

| Card | Stacks | Positive Value Delivered | Negative Cost Incurred | Net Contribution | % of Run Score |
|---|---|---|---|---|---|
| Clover Charm (Forage Yield) | 3 | +842 food gathered (≈842 score) | ≈12s travel time lost from −3%/stack Speed (≈36 score) | +806 | 34% |
| Windward Paws (Movement Speed) | 2 | 28s travel time saved (≈28 score) | −8% Stamina regen → 3 missed dash windows (≈45 score) | −17 | −1% |
| Burrow Sense (Sense Radius) | 2 | 19 extra tiles discovered + 210 food from revealed nodes (≈391 score) | −5% Charm/stack → 1 failed Befriend attempt (≈40 score) | +351 | 15% |
| Downy Lining (Comfort/Nest) | 1 | 96 Vitality-equivalent drain avoided in Winter (≈96 score) | −10% Forage Speed → slower harvest anim (≈22 score) | +74 | 3% |
| Storm-Shrugged Coat (Weather Resistance) | 4 | 3 storms weathered with zero Vitality loss (≈510 score) | −15% Sense Radius/2 stacks → 6 forage nodes never revealed (≈118 score) | +392 | 17% |
| **Run total (incl. base XP/exploration/milestones not card-attributed)** | | | | **≈2,340 total** | **100%** |

This lets a player see, in plain language, that Clover Charm quietly carried a third of the run's value while Windward Paws was nearly a wash — informing smarter drafting next time.

### Visual Evolution Tech Design

The animal's sprite is built from a base body plus six attachment slots: **head, back, tail, paws, aura, and trail**. Every drafted card is pre-mapped to exactly one slot in its card data (e.g., all Forage Yield cards → tail; Sense Radius cards → aura; Movement Speed → trail; Weather Resistance → back; Charm → head; Stamina/dash cards → paws). This mapping is fixed per card family so players learn to visually "read" a stranger's build at a glance in future runs or on shared postcards.

**Stacking intensity tiers** escalate the same slot's attachment rather than replacing it:
- **1 stack:** subtle addition — e.g., Clover Charm at 1 stack is a single small clover leaf tucked at the tail base.
- **2–3 stacks:** visible growth — the leaf becomes a small trailing cluster of clovers and a faint golden particle drifts off the tail on movement.
- **4+ stacks:** dramatic escalation — the tail is now wreathed in a thick garland of clovers and blossoms, leaving a lingering golden pollen trail on the ground for several seconds after the animal passes.

Aura and trail slots (Sense Radius, Movement Speed families) scale similarly by radius/opacity/particle-density rather than discrete geometry, since they render as effects rather than mesh attachments.

**Slot conflicts:** when two different card families are mapped to the same slot (e.g., a Comfort card and a Weather Resistance card both targeting "back"), the system resolves via **sub-anchors** — the back slot itself contains 2–3 fixed sub-anchor points (upper-back, lower-back, shoulders) so multiple attachments can co-exist spatially. If sub-anchors are also exhausted, the system falls back to **tint blending**: the two attachments merge into one mesh whose color/material is a weighted blend based on relative stack count (e.g., a 3-stack frost-back card and a 1-stack moss-back card render as a mostly-frosted back with faint moss undertones), guaranteeing no card's visual contribution is ever silently dropped.

**End-of-run portrait:** on Screen 4, the fully mutated animal is posed against a soft painterly seasonal backdrop (matching whichever season the run ended in) and rendered as a static, shareable postcard image — the animal's final silhouette, every stacked attachment visible, with a small caption line auto-generated from the top 1–2 highest-net-contribution cards (e.g., "A Dog, wreathed in clover, who outran three storms"). The postcard is exportable as an image file directly from the Rewards screen.
