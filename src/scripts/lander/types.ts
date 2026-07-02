// ---------------------------------------------------------------------------
// Shared types for the Moon Lander game modules.
// Moved verbatim (mechanical split) from the original lander-game.ts.
// ---------------------------------------------------------------------------

export type UpgradeId =
  | 'fuel_tank' | 'boost_thrusters' | 'magnetic_pad' | 'shield'
  | 'gyro' | 'gravity_anchor' | 'scanner' | 'feather_gear' | 'reserve_chute'
  | 'storm_dampeners' | 'fuel_scoop' | 'precision_jets'
  | 'jalapeno_injectors' | 'boomerang_hull' | 'alien_diplomacy'
  | 'chrono_crystal' | 'overdrive_core' | 'phoenix_feather' | 'star_core';

// --- Rarity tiers ------------------------------------------------------------
// Weighted drop rates: commons carry a run, legendaries are an event. Cards
// are colored by tier and rare+ offers get a glow and a sound sting.
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  pro: string;   // the benefit — always worth more than the cost
  con: string;   // the tradeoff — real, but never crippling
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

// --- Ship stats derived from picked upgrades ------------------------------------
export interface ShipStats {
  maxFuel: number;
  thrustPower: number;
  padBonus: number;
  landingSpeedTol: number;
  landingAngleTol: number;
  shieldCharges: number;
  gravityMult: number;
  scanner: boolean;
  reserveCharges: number;
  fuelBurnMult: number;
  rotMult: number;
  windMult: number;
  fuelRegen: number;
  spicyFlame: boolean;     // jalapeño injectors — green-hot exhaust
  bounceCharges: number;   // boomerang hull — terrain bounces per level
  ufosFriendly: boolean;   // alien diplomacy — UFOs hold fire
  slowmo: boolean;         // chrono crystal — bullet-time near the ground
  projSpeedMult: number;   // star core drawback — faster UFO shots
  phoenixCharges: number;  // phoenix feather — revives per run
  starCore: boolean;       // star core — golden aura visual
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
