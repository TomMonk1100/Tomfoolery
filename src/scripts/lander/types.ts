// ---------------------------------------------------------------------------
// Shared types for the Moon Lander game modules.
// Moved verbatim (mechanical split) from the original lander-game.ts.
// ---------------------------------------------------------------------------

export type UpgradeId =
  | 'fuel_tank' | 'boost_thrusters' | 'magnetic_pad' | 'shield'
  | 'gyro' | 'gravity_anchor' | 'scanner' | 'feather_gear' | 'reserve_chute'
  | 'storm_dampeners' | 'fuel_scoop' | 'precision_jets'
  | 'jalapeno_injectors' | 'boomerang_hull' | 'alien_diplomacy'
  | 'chrono_crystal' | 'overdrive_core' | 'phoenix_feather' | 'star_core'
  // --- lander-v10 commit 4b (§7): 50 new upgrades ---
  // Common (10 new)
  | 'lightweight_alloy' | 'wide_legs' | 'fuel_lines' | 'bumper_skids' | 'trim_flaps'
  | 'solar_wings' | 'landing_lights' | 'sticky_pads' | 'nimble_fins' | 'drop_tanks'
  // Uncommon (10 new)
  | 'air_brakes' | 'kick_thrusters' | 'tractor_winch' | 'cloud_seeder' | 'vampire_coils'
  | 'lucky_antenna' | 'stardust_condenser' | 'echo_altimeter' | 'gecko_struts' | 'bounce_bumpers'
  // Rare (10 new)
  | 'spaghetti_engine' | 'grappling_hook' | 'hover_module' | 'asteroid_miner' | 'ufo_hacker'
  | 'bubble_wrap' | 'magnet_storm' | 'tailwind_turbine' | 'moon_cheese_drill' | 'swarm_drones'
  // Epic (10 new)
  | 'wormhole_pocket' | 'gravity_flip' | 'midas_hull' | 'quantum_duplicate' | 'storm_caller'
  | 'time_bank' | 'terraformer' | 'singularity_anchor' | 'nano_repair' | 'rocket_skates'
  // Legendary (10 new)
  | 'black_hole_engine' | 'golden_goose' | 'cosmic_dice' | 'dyson_sail' | 'pocket_moon'
  | 'valkyrie_autopilot' | 'star_forge' | 'antigrav_paint' | 'mothership_favor' | 'big_crunch';

// --- Rarity tiers ------------------------------------------------------------
// Weighted drop rates: commons carry a run, legendaries are an event. Cards
// are colored by tier and rare+ offers get a glow and a sound sting.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  pro: string;   // the benefit — always worth more than the cost
  con: string;   // the tradeoff — real, but never crippling
  desc: string;  // one-line plain-English summary for upgrade cards — no jargon
  icon: string;
  rarity: Rarity;
}

// --- Cosmetics: the Hangar Shop ------------------------------------------------
// Bought with Stardust (✨), which is earned by landing. The catalog is
// deliberately data-driven so a real-money Stardust pack rail (Stripe etc.)
// can be added later without touching game code.
export interface PaintDef { id: string; name: string; price: number; hullTop: string; hullBot: string; stroke: string; }
export interface TrailDef { id: string; name: string; price: number; colors: string[] | 'rainbow' | 'stardust'; }
export interface SkyDef { id: string; name: string; price: number; top: string; mid: string; bot: string; star: string; planet?: [string, string]; }

// --- Achievements ---------------------------------------------------------------
export interface AchievementDef { id: string; name: string; desc: string; icon: string; }

export type TerrainStyle = 'flat' | 'hills' | 'rough' | 'canyon';

export interface LevelConfig {
  name: string;
  gravity: number;
  wind: number;          // base horizontal accel, px/s^2
  windGust: number;       // amplitude of oscillating extra wind
  terrain: TerrainStyle;
  padWidth: number;
  fog: boolean;
  asteroids: number;      // count of moving circular hazards
  movingPad: boolean;
  padSpeed: number;       // px/s pad travel speed when movingPad
  ufos: number;           // count of patrolling UFO hazards
  seed: number;
}

// --- Difficulty modes -------------------------------------------------------
// Not just "harder and harder": three parallel tunings of the same endless
// ladder. Cadet softens physics and hazards, Ace sharpens everything.
export type Difficulty = 'cadet' | 'pilot' | 'ace';

export interface TerrainPoint { x: number; y: number; }
export interface Pad { xStart: number; xEnd: number; y: number; vx: number; baseX: number; range: number; }
export interface Terrain { points: TerrainPoint[]; ridge: TerrainPoint[]; pad: Pad; width: number; height: number; }

// --- Background décor: stars + a seeded planet -------------------------------
export interface Star { x: number; y: number; r: number; phase: number; bright: number; }
export interface Planet { x: number; y: number; r: number; hue: [string, string]; ring: boolean; }

// --- Decorative alien wildlife — cosmetic, seeded per level ------------------
export interface Critter {
  x: number; baseY: number; kind: 'cow' | 'scurrier'; phase: number; facing: 1 | -1;
}

// --- UFO hazards -------------------------------------------------------------
export interface Ufo {
  x: number; y: number; baseY: number; vx: number; phase: number;
  fireCooldown: number; telegraph: number; alive: boolean;
}
export interface Projectile {
  x: number; y: number; vx: number; vy: number; alive: boolean;
}

// --- Particles ----------------------------------------------------------------
export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  gravity: number;
}

// --- §6.1 Noodle piles (Spaghetti Engine) ------------------------------------
// A "noodle" is a distinct falling particle (3-segment wavy strand) that
// deposits into a height-map (noodlePile.ts) on terrain contact instead of
// just despawning like a normal particle.
export interface Noodle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  seed: number; // per-noodle wobble phase for the wavy-strand draw
  alive: boolean;
}

// --- §6.3 Drones/companions ---------------------------------------------------
export type DroneBehavior = 'intercept' | 'shoot';
export interface Drone {
  index: number;         // orbit slot — radius = 26 + 8*index
  angle: number;         // current orbit angle (radians)
  speed: number;         // angular speed, rad/s
  behavior: DroneBehavior;
  charges: number;       // intercept: blocks remaining this level; shoot: ignored (fires freely)
  alive: boolean;
}

// --- Ship stats derived from picked upgrades ------------------------------------
//
// lander-v10 commit 3 (§5.1): booleans that used to mean "owned" now carry a
// STACK COUNT instead (0 = not owned, n = picked n times), so every module's
// per-stack escalation (§5.1 bullet list) has a number to key off. Truthiness
// checks (`if (stats.scanner)`) still work unchanged since 0 is falsy and any
// positive count is truthy — call sites that only cared about "owned or not"
// needed zero changes; call sites that escalate at stack 2+/3+ read the count.
export interface ShipStats {
  maxFuel: number;
  thrustPower: number;
  padBonus: number;
  landingSpeedTol: number;
  landingAngleTol: number;
  shieldCharges: number;
  gravityMult: number;
  scanner: number;         // stacks: 1 = guidance line, 2+ = touchdown forecast, 3+ = beam glow
  reserveCharges: number;
  fuelBurnMult: number;
  rotMult: number;
  windMult: number;
  fuelRegen: number;
  spicyFlame: boolean;     // jalapeño injectors — green-hot exhaust (greener per stack via spicyStacks)
  spicyStacks: number;     // jalapeño injectors stack count — flame color ramps with it
  bounceCharges: number;   // boomerang hull — terrain bounces per level
  ufosFriendly: number;    // alien diplomacy stacks: 1 = UFOs hold fire, 2+ = UFOs shoot asteroids for you
  slowmo: boolean;         // chrono crystal — bullet-time near the ground
  chronoStacks: number;    // chrono crystal stack count — time mult compounds 0.75^n
  projSpeedMult: number;   // star core drawback — faster UFO shots
  phoenixCharges: number;  // phoenix feather — revives per run
  starCore: boolean;       // star core — golden aura visual
  starCoreStacks: number;  // star core stack count — aura radius grows with it
  // --- physics §4.2 mass & drag model ---
  massSum: number;         // Σ(def.mass × stacks) — fed into physics.effectiveMass()
  areaSum: number;         // Σ(def.dragArea × stacks) — fed into physics.effectiveArea()

  // --- lander-v10 commit 4a (§6.6): stat modifier hooks for systems built in
  // this commit but not yet wired to any upgrade (that's Commit 4b). All
  // default to a semantically "off" value (0 / false / [] / 1 as noted below)
  // so existing gameplay is byte-for-byte unaffected until upgrades populate
  // them. Booleans are numbers (stack counts) wherever the plan's §6
  // mechanics escalate per stack, matching the pattern already established
  // above (scanner, ufosFriendly, chronoStacks, starCoreStacks, spicyStacks).
  noodleStacks: number;        // §6.1 Spaghetti Engine — noodle emission ×n, pile cap +10px×n
  extraChoices: number;        // Lucky Antenna — +1 upgrade choice per offer, per stack
  stardustMult: number;        // Stardust Condenser / Midas Hull — multiplies stardust payouts
  grazeFuel: number;           // Vampire Coils — fuel gained per projectile graze
  slopeLandCharges: number;    // Gecko Struts — safe-landing-on-slope charges per level
  hoverModule: number;         // Hover Module — stack count (descent auto-limit near ground)
  asteroidMiner: number;       // Asteroid Miner — stack count (asteroid contact shatters for fuel/stardust)
  magnetDeflect: number;       // Deflector Coils — stack count (projectile repulsion strength ×n)
  tailwindTurbine: number;     // Tailwind Turbine — stack count (fuel/s per wind speed ×n)
  cheeseDrillCharges: number;  // Moon Cheese Drill — drill charges per level
  droneCharges: number;        // §6.3 Swarm Drones — orbiting companion count / intercept charges
  abilityDefs: AbilityId[];    // §6.2 active-ability slot — owned ability ids, in acquisition order
  padPull: number;             // Pad Tractor Winch — pull accel (px/s^2) toward pad center, ×n
  autoBrake: number;           // Reserve Chute — auto-brake charges per level (already reserveCharges; kept generic per §6.6 list)
  kickThrusters: number;       // Kick Thrusters — stack count (sideways impulse strength ×n)
  luckyTier: number;           // Star Forge — rarity weight multiplier tier (compounds ×3^n)
  forecastMarker: number;      // Echo Altimeter / Scanner 2+ — touchdown forecast marker stack
  eggLevels: number;           // Golden Goose — stack count (stardust per landing ×n)
  randomDice: number;          // Cosmic Dice — stack count (extra dice rolls per level)
  sailRegen: number;           // Dyson Sail — always-on fuel regen rate
  pocketMoon: number;          // Pocket Moon — stack count (orbiting moonlet radius/count)
  escortUfos: number;          // Mothership's Favor — friendly escort UFO count
  doubleProgress: number;      // Big Crunch Drive — stack count (levels advanced per landing, base 1)
  slideLanding: number;        // Rocket Skates — stack count (slide-to-stop tolerance mult)
  reverseGravityCharges: number; // Gravity Flip Coil — charges per level
  midasMult: number;           // Midas Hull — stardust payout multiplier (compounds)
  ghostSave: number;           // §6.5 Quantum Duplicate — death-save roll count (independent rolls per stack)
  stormTowardPad: boolean;     // Storm Caller — wind always blows toward the pad
  nanoRegenSec: number;        // Nano-Repair Swarm — seconds-airborne interval for +1 shield charge
  blackholeReserve: number;    // Black Hole Engine — stack count (thrust free below 25% tank)
  antigravPaint: number;       // Antigrav Paint — stack count (gravity coupling reduction)

  // --- lander-v10 commit 4b (§7): additional stat hooks for mechanics the
  // original §6.6 list didn't enumerate a dedicated field for. Same
  // "0/false is off" convention as above.
  airBrakes: number;           // Air Brakes — stack count (hold L+R velocity damp %/s ×n)
  gustMult: number;            // Cloud Seeder — multiplies level windGust amplitude (compounds down)
  stickyPadStacks: number;     // Sticky Landing Pads — stack count (on-pad horizontal speed forgiveness ×n)
  landingLightStacks: number;  // Landing Lights — stack count (below 150m pad arrow + touchdown marker)
  dropTankStacks: number;      // Drop Tanks — stack count (jettison cosmetic fires once per level at half fuel)
  ufoHackerStacks: number;     // UFO Hacker — stack count (first N UFOs/level become allies)
  bubbleWrapCharges: number;   // Bubble Wrap Hull — charges/level (fatal impact -> huge slow bounce)
  gravityFlipCharges: number;  // Gravity Flip Coil — charges/level (hold L+R 1s to reverse gravity)
  gravityFlipDuration: number; // Gravity Flip Coil — reversal duration seconds (2 + 1×extra stacks)
  slideLandingMult: number;    // Rocket Skates — landingSpeedTol multiplier applied only when angle < tol/2
  cosmicDiceStacks: number;    // Cosmic Dice — stack count (extra rolls per level, each an independent pair)
  bigCrunchStacks: number;     // Big Crunch Drive — stack count (levels advanced per landing = 1 + stacks)
  starForgeStacks: number;     // Star Forge — stack count (rarity weight ×3^n toward uncommon+)
  echoAltimeterStacks: number; // Echo Altimeter — stack count (forecast + landing-speed readout)
}

// --- §6.2 Active-ability slot -------------------------------------------------
// Priority-ordered list of ability ids the resolver checks in order, firing
// the first one that is "ready" (has charge). No upgrade sets abilityDefs
// yet (Commit 4b wires Valkyrie Autopilot etc. in) — this is the generic
// mechanism the later upgrades hook into.
export type AbilityId =
  | 'valkyrie_autopilot' | 'wormhole_pocket' | 'time_bank' | 'singularity_anchor' | 'grappling_hook';

export interface AbilityDef {
  id: AbilityId;
  charges: number;      // current ready charges (0 = not ready)
  maxCharges: number;   // for cooldown-pip rendering
  cooldown: number;     // seconds remaining until next charge regens (0 = full)
  maxCooldown: number;  // full cooldown duration, for pip fill fraction
}

// --- Per-run tallies (not persisted mid-run; achievements/toasts read these) --
export interface RunStats {
  crashes: number;
  landings: number;
  skips: number; // §5.3 — level-complete screens skipped ("travel light")
}

// --- Pilot face mapping -----------------------------------------------------------
// Normalized (0..1) positions of facial features within the selfie canvas.
// Filled by the FaceDetector API when the browser supports it; otherwise
// standard portrait proportions (the capture UI asks you to center your
// face, so these land close in practice).
export interface FaceMap { eyeL: { x: number; y: number }; eyeR: { x: number; y: number }; mouth: { x: number; y: number }; }

export type Mood = 'neutral' | 'surprised' | 'happy';

// --- Main game -----------------------------------------------------------------
export type GameState = 'start' | 'playing' | 'levelComplete' | 'crashed';

// --- Global leaderboard client (Netlify Function + Blobs at /api/scores).
export interface ScoreRow { name: string; level: number; difficulty: Difficulty; }

export interface Toast { text: string; t: number; }
