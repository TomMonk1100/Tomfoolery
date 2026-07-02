// ---------------------------------------------------------------------------
// Moon Lander Roguelite — vanilla Canvas2D + Web Audio, no dependencies.
// Earth-tone ("Hearthwood") visual style to match the rest of the site.
//
// v8 overhaul:
//  - Endless procedural levels (each harder) + Cadet/Pilot/Ace difficulty
//  - Responsive sizing: fills available width, taller canvas on portrait
//    phones, ship rendered ~1.5–1.8x bigger and scaled to the canvas
//  - Reactive pilot face: eyes/mouth located via the FaceDetector API when
//    available (proportional fallback otherwise) and re-rendered live —
//    surprised under thrust, happy on touchdown
//  - Graphics pass: starfield, seeded planet, background ridge, platform
//    pad with beacon lights, layered flame + glow, ground dust, screen
//    shake, confetti, level intro banner
//  - Audio pass: real rocket rumble (filtered noise), melodic SFX, and a
//    musical ambient score (chord swells + pentatonic plucks over the
//    drone) with SEPARATE sfx / music toggles
// ---------------------------------------------------------------------------

type UpgradeId =
  | 'fuel_tank' | 'boost_thrusters' | 'magnetic_pad' | 'shield'
  | 'gyro' | 'gravity_anchor' | 'scanner' | 'feather_gear' | 'reserve_chute'
  | 'storm_dampeners' | 'fuel_scoop' | 'precision_jets'
  | 'jalapeno_injectors' | 'boomerang_hull' | 'alien_diplomacy'
  | 'chrono_crystal' | 'overdrive_core' | 'phoenix_feather' | 'star_core';

// --- Rarity tiers ------------------------------------------------------------
// Weighted drop rates: commons carry a run, legendaries are an event. Cards
// are colored by tier and rare+ offers get a glow and a sound sting.
type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const RARITY: Record<Rarity, { label: string; color: string; weight: number }> = {
  common:    { label: 'common',    color: '#B9A480', weight: 100 },
  uncommon:  { label: 'uncommon',  color: '#94B03D', weight: 55 },
  rare:      { label: 'rare',      color: '#7BA7C7', weight: 22 },
  epic:      { label: 'epic',      color: '#B07BD6', weight: 9 },
  legendary: { label: 'legendary', color: '#FFC94A', weight: 3.5 },
};

interface UpgradeDef {
  id: UpgradeId;
  name: string;
  pro: string;   // the benefit — always worth more than the cost
  con: string;   // the tradeoff — real, but never crippling
  icon: string;
  rarity: Rarity;
}

// Every upgrade is net-positive, but nothing is free: extra hardware has
// weight (gravity), power draw (fuel burn), or handling costs. Clamps in
// computeStats() keep stacked drawbacks from ever making the ship unflyable.
const UPGRADES: UpgradeDef[] = [
  // --- common: reliable bread-and-butter ---
  { id: 'fuel_tank',       rarity: 'common',    name: 'Extra Fuel Tank',  icon: '⛽', pro: '+45 max fuel, refills now',                 con: 'Heavier — gravity +6%' },
  { id: 'gyro',            rarity: 'common',    name: 'Gyro Stabilizer',  icon: '🌀', pro: 'Much more forgiving landing angle',         con: 'Power draw — fuel burns 8% faster' },
  { id: 'precision_jets',  rarity: 'common',    name: 'Precision Jets',   icon: '🚀', pro: 'Rotate 40% faster',                         con: 'Jets sip fuel — burn +6%' },
  { id: 'magnetic_pad',    rarity: 'common',    name: 'Magnetic Grapple', icon: '🧲', pro: 'Wider catch zone, +15% landing tolerance',  con: 'Magnet weight — gravity +4%' },
  { id: 'feather_gear',    rarity: 'common',    name: 'Feather Gear',     icon: '🪶', pro: 'Land 30% harder safely',                    con: 'Lightweight — wind pushes 20% more' },
  // --- uncommon: build-shapers ---
  { id: 'boost_thrusters', rarity: 'uncommon',  name: 'Boost Thrusters',  icon: '🔥', pro: '+40% thrust power',                        con: 'Burns fuel 15% faster' },
  { id: 'scanner',         rarity: 'uncommon',  name: 'Scanner',          icon: '📡', pro: 'Guidance line pointing straight to the pad', con: 'Housing costs 10 max fuel' },
  { id: 'reserve_chute',   rarity: 'uncommon',  name: 'Reserve Chute',    icon: '🪂', pro: 'Auto-brakes once per level if tank runs dry', con: 'Chute pack — gravity +4%' },
  { id: 'fuel_scoop',      rarity: 'uncommon',  name: 'Fuel Scoop',       icon: '♻️', pro: 'Regain 3 fuel/s while engines are off',     con: 'Scoop replaces 15 max fuel' },
  { id: 'storm_dampeners', rarity: 'uncommon',  name: 'Storm Dampeners',  icon: '🌬️', pro: 'Wind pushes you 50% less',                  con: 'Vents bleed 8% thrust' },
  // --- rare: run-changers with personality ---
  { id: 'shield',          rarity: 'rare',      name: 'Shield',           icon: '🛡️', pro: 'Survive one impact (recharges each level)', con: 'Plating — gravity +6%' },
  { id: 'gravity_anchor',  rarity: 'rare',      name: 'Gravity Anchor',   icon: '⚓', pro: 'Gravity pulls 15% less',                   con: 'Sluggish — rotation 12% slower' },
  { id: 'jalapeno_injectors', rarity: 'rare',   name: 'Jalapeño Injectors', icon: '🌶️', pro: '+30% thrust, exhaust burns spicy-green',  con: 'Spicy fuel burns 12% faster' },
  { id: 'boomerang_hull',  rarity: 'rare',      name: 'Boomerang Hull',   icon: '🪃', pro: 'Bounce off terrain instead of crashing (1/level)', con: 'Each bounce shakes out 15 fuel' },
  { id: 'alien_diplomacy', rarity: 'rare',      name: 'Alien Embassy Plates', icon: '👽', pro: 'UFOs recognize you and hold fire',      con: 'Ceremonial plating — gravity +5%' },
  // --- epic: bend the rules ---
  { id: 'chrono_crystal',  rarity: 'epic',      name: 'Chrono Crystal',   icon: '⏳', pro: 'Time slows 25% below 120m altitude',        con: 'Fuel still drains at full speed' },
  { id: 'overdrive_core',  rarity: 'epic',      name: 'Overdrive Core',   icon: '🧨', pro: '+55% thrust, +20% rotation',               con: 'Guzzler — fuel burn +22%' },
  // --- legendary: an event ---
  { id: 'phoenix_feather', rarity: 'legendary', name: 'Phoenix Feather',  icon: '🐦‍🔥', pro: 'Rise from one crash per run (60% fuel)',   con: 'The feather nests in the tank — max fuel −10' },
  { id: 'star_core',       rarity: 'legendary', name: 'Star Core',        icon: '🌟', pro: 'EVERYTHING +12%, gravity −8%',              con: 'Your glow draws 20% faster UFO fire' },
];

// --- Cosmetics: the Hangar Shop ------------------------------------------------
// Bought with Stardust (✨), which is earned by landing. The catalog is
// deliberately data-driven so a real-money Stardust pack rail (Stripe etc.)
// can be added later without touching game code.
interface PaintDef { id: string; name: string; price: number; hullTop: string; hullBot: string; stroke: string; }
interface TrailDef { id: string; name: string; price: number; colors: string[] | 'rainbow' | 'stardust'; }
interface SkyDef { id: string; name: string; price: number; top: string; mid: string; bot: string; star: string; planet?: [string, string]; }

const PAINTS: PaintDef[] = [
  { id: 'paint_classic',  name: 'Classic Cream',  price: 0,    hullTop: '#F4EBDA', hullBot: '#D9C6A3', stroke: '#C97B3D' },
  { id: 'paint_midnight', name: 'Midnight Iron',  price: 250,  hullTop: '#B8C4D4', hullBot: '#5E6B7E', stroke: '#7BA7C7' },
  { id: 'paint_jalapeno', name: 'Jalapeño Fresh', price: 250,  hullTop: '#D9E8B8', hullBot: '#7C8F5C', stroke: '#94B03D' },
  { id: 'paint_copper',   name: 'Sunset Copper',  price: 350,  hullTop: '#F0C8A0', hullBot: '#C97B3D', stroke: '#8a4a20' },
  { id: 'paint_violet',   name: 'Royal Violet',   price: 500,  hullTop: '#D8C4E8', hullBot: '#9B6BB3', stroke: '#B07BD6' },
  { id: 'paint_gold',     name: 'Gold Standard',  price: 1500, hullTop: '#FFE9B0', hullBot: '#D9A441', stroke: '#FFC94A' },
];

const TRAILS: TrailDef[] = [
  { id: 'trail_ember',    name: 'Ember',        price: 0,    colors: ['#D9A441', '#C97B3D'] },
  { id: 'trail_verdant',  name: 'Verdant',      price: 200,  colors: ['#94B03D', '#7C8F5C'] },
  { id: 'trail_ice',      name: 'Glacier',      price: 300,  colors: ['#A8D8E8', '#7BA7C7'] },
  { id: 'trail_violet',   name: 'Ultraviolet',  price: 400,  colors: ['#C9A0E8', '#B07BD6'] },
  { id: 'trail_rainbow',  name: 'Prism',        price: 800,  colors: 'rainbow' },
  { id: 'trail_stardust', name: 'Stardust',     price: 1000, colors: 'stardust' },
];

const SKIES: SkyDef[] = [
  { id: 'sky_hearthwood', name: 'Hearthwood',     price: 0,   top: '#191008', mid: '#15100a', bot: '#100d09', star: '#F4EBDA' },
  { id: 'sky_bloodmoon',  name: 'Blood Moon',     price: 400, top: '#241010', mid: '#1a0d0d', bot: '#120a0a', star: '#F4D8D8', planet: ['#a04a30', '#401812'] },
  { id: 'sky_emerald',    name: 'Emerald Nebula', price: 400, top: '#0e1a12', mid: '#0d150e', bot: '#0a100b', star: '#D8F4DD', planet: ['#4a7c5a', '#16301e'] },
  { id: 'sky_void',       name: 'The Deep Void',  price: 700, top: '#0a0a12', mid: '#08080e', bot: '#06060a', star: '#E8E8FF', planet: ['#3a3a5a', '#12121f'] },
];

// --- Achievements ---------------------------------------------------------------
interface AchievementDef { id: string; name: string; desc: string; icon: string; }

const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_first',    icon: '🛬', name: 'Grounded',            desc: 'Land safely for the first time' },
  { id: 'ach_l5',       icon: '🕳️', name: 'Five Deep',           desc: 'Clear level 5' },
  { id: 'ach_l10',      icon: '🔟', name: 'Double Digits',       desc: 'Clear level 10' },
  { id: 'ach_l20',      icon: '🌌', name: 'Twenty Leagues',      desc: 'Clear level 20' },
  { id: 'ach_ace5',     icon: '🔴', name: 'No Assists',          desc: 'Clear level 5 on Ace' },
  { id: 'ach_feather',  icon: '🪶', name: 'Feather Touch',       desc: 'Land slower than 15' },
  { id: 'ach_bullseye', icon: '🎯', name: 'Bullseye',            desc: 'Land dead center on the pad' },
  { id: 'ach_fumes',    icon: '⛽', name: 'On Fumes',            desc: 'Land with less than 5 fuel' },
  { id: 'ach_hoarder',  icon: '🎒', name: 'Hoarder',             desc: 'Carry 8 upgrades at once' },
  { id: 'ach_gold',     icon: '✨', name: 'Gold Rush',           desc: 'Pick a legendary upgrade' },
  { id: 'ach_spicy',    icon: '🌶️', name: 'Spicy Exhaust',       desc: 'Install the Jalapeño Injectors' },
  { id: 'ach_phoenix',  icon: '🐦‍🔥', name: 'Second Sunrise',      desc: 'Rise from the ashes' },
  { id: 'ach_boing',    icon: '🪃', name: 'Boing',               desc: 'Bounce off the terrain and live' },
  { id: 'ach_selfie',   icon: '🤳', name: 'Face of the Program', desc: 'Take a pilot selfie' },
  { id: 'ach_chrono',   icon: '⌛', name: 'Time Lord',           desc: 'Land while time is slowed' },
];

type TerrainStyle = 'flat' | 'hills' | 'rough' | 'canyon';

interface LevelConfig {
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
type Difficulty = 'cadet' | 'pilot' | 'ace';

const DIFF_MODS: Record<Difficulty, { grav: number; wind: number; pad: number; hazard: number; tol: number; label: string; icon: string; blurb: string }> = {
  cadet: { grav: 0.85, wind: 0.7,  pad: 1.25, hazard: 0.6, tol: 1.15, label: 'Cadet', icon: '🟢', blurb: 'gentler gravity, wider pads' },
  pilot: { grav: 1,    wind: 1,    pad: 1,    hazard: 1,   tol: 1,    label: 'Pilot', icon: '🟡', blurb: 'the intended experience' },
  ace:   { grav: 1.12, wind: 1.25, pad: 0.85, hazard: 1.3, tol: 0.95, label: 'Ace',   icon: '🔴', blurb: 'heavy, gusty, unforgiving' },
};

// --- Seeded PRNG (mulberry32) so each level's layout is stable per index ---
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Endless level generator -------------------------------------------------
// First ten levels keep their hand-picked names; everything about the config
// is procedural and deterministic per (level index, difficulty). Pressure
// unlocks on a schedule (wind → asteroids → canyon → moving pads → fog →
// UFOs) and then keeps creeping upward forever, with hard caps so deep runs
// stay physically possible.
const LEVEL_NAMES = [
  'First Light', 'Rolling Dust', 'Crosswind Valley', 'Narrow Shelf', 'Debris Field',
  'The Canyon', 'Shifting Pad', 'Ashen Plains', 'The Storm', 'Last Descent',
];
const NAME_ADJ = ['Silent', 'Iron', 'Hollow', 'Burning', 'Frozen', 'Crimson', 'Wandering', 'Shattered', 'Pale', 'Deep', 'Broken', 'Static'];
const NAME_NOUN = ['Reach', 'Basin', 'Divide', 'Expanse', 'Ridge', 'Verge', 'Steppe', 'Rift', 'Plateau', 'Maw', 'Hollows', 'Drift'];

function levelConfigFor(idx: number, diff: Difficulty): LevelConfig {
  const m = DIFF_MODS[diff];
  const r = mulberry32(idx * 7919 + 101);

  const ramp = Math.min(1, idx / 14);              // main climb over ~15 levels
  const creep = Math.max(0, idx - 14) * 0.015;     // gentle endless creep after

  const gravity = Math.min(150, (55 + idx * 4 + creep * 60) * m.grav);

  const windBase = idx < 2 ? 0 : (6 + 18 * ramp + creep * 20) * (0.45 + r() * 0.65);
  const wind = Math.min(30, windBase * m.wind);
  const windGust = wind * (0.5 + r() * 0.5);

  const styles: TerrainStyle[] =
    idx < 1 ? ['flat'] :
    idx < 3 ? ['flat', 'hills'] :
    idx < 5 ? ['hills', 'rough'] :
    ['hills', 'rough', 'canyon'];
  const terrain = styles[Math.floor(r() * styles.length)];

  const padWidth = Math.max(56, (130 - idx * 5 - creep * 30) * m.pad);

  const movingPad = idx >= 6 && r() < Math.min(0.65, 0.32 + idx * 0.015);
  // Fog is disabled for now — even after the v9 visibility rework it read
  // as "unviewable" in real play. All the plumbing (config flag, overlay
  // renderer, scanner counter, beacon pulses) is kept so it can return
  // later as a rarer, gentler variant.
  const fog = false;
  void r(); // burn the roll fog used to consume, keeping level seeds stable
  const asteroids = idx >= 4 && r() < 0.55 ? Math.min(5, Math.round((2 + Math.floor(idx / 5)) * m.hazard)) : 0;
  const ufos = idx >= 8 && r() < 0.45 ? Math.min(3, Math.max(1, Math.round((1 + Math.floor(idx / 9)) * m.hazard))) : 0;

  const name = idx < LEVEL_NAMES.length
    ? LEVEL_NAMES[idx]
    : `${NAME_ADJ[Math.floor(r() * NAME_ADJ.length)]} ${NAME_NOUN[Math.floor(r() * NAME_NOUN.length)]}`;

  return {
    name,
    gravity,
    wind,
    windGust,
    terrain,
    padWidth,
    fog,
    asteroids,
    movingPad,
    padSpeed: movingPad ? Math.min(46, 24 + idx * 1.1) : 0,
    ufos,
    seed: idx * 13 + 7,
  };
}

interface TerrainPoint { x: number; y: number; }
interface Pad { xStart: number; xEnd: number; y: number; vx: number; baseX: number; range: number; }
interface Terrain { points: TerrainPoint[]; ridge: TerrainPoint[]; pad: Pad; width: number; height: number; }

function terrainYAt(points: TerrainPoint[], x: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return points[points.length - 1]?.y ?? 0;
}

function generateTerrain(cfg: LevelConfig, width: number, height: number): Terrain {
  const rand = mulberry32(cfg.seed * 9973 + 17);
  const groundBase = height * 0.72;
  const points: TerrainPoint[] = [];
  const padWidth = cfg.padWidth;
  let padCenter = width * (0.35 + rand() * 0.3);

  const segments = 40;
  const step = width / segments;

  if (cfg.terrain === 'flat') {
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const noise = Math.sin(i * 0.7) * 8;
      points.push({ x, y: groundBase + noise });
    }
  } else if (cfg.terrain === 'hills') {
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const y = groundBase - Math.sin(i * 0.55 + rand() * 2) * 34 - Math.sin(i * 0.13) * 20;
      points.push({ x, y });
    }
  } else if (cfg.terrain === 'rough') {
    let y = groundBase;
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      y += (rand() - 0.5) * 26;
      y = Math.max(height * 0.5, Math.min(height * 0.85, y));
      points.push({ x, y });
    }
  } else {
    // canyon: tall walls in the outer thirds, gap in the middle down to a low pad
    padCenter = width * 0.5;
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const t = x / width;
      let y: number;
      if (t < 0.32) {
        y = height * 0.18 + Math.sin(i * 0.4) * 14; // left wall, tall
      } else if (t > 0.68) {
        y = height * 0.18 + Math.sin(i * 0.4 + 3) * 14; // right wall, tall
      } else {
        y = groundBase + 20; // canyon floor, low
      }
      points.push({ x, y });
    }
  }

  const halfW = padWidth / 2;

  // Moving pads: clamped travel range + terrain flattened across the ENTIRE
  // travel corridor at generation time, so the pad can never be below ground.
  let range = 0;
  if (cfg.movingPad) {
    if (cfg.terrain === 'canyon') {
      padCenter = width * 0.5;
      const floorMin = width * 0.35 + halfW;
      const floorMax = width * 0.65 - halfW;
      range = Math.max(30, Math.min(padCenter - floorMin, floorMax - padCenter));
    } else {
      padCenter = Math.min(Math.max(padCenter, width * 0.3), width * 0.7);
      range = Math.min(width * 0.18, padCenter - halfW - 24, width - padCenter - halfW - 24);
    }
  }

  // Flatten the pad zone (or full travel corridor), blending edges over
  // ~46px so terrain slopes into the pad instead of cliffing at its lip.
  const padY = terrainYAt(points, padCenter);
  const flatFrom = padCenter - (cfg.movingPad ? range + halfW + 14 : halfW + 10);
  const flatTo = padCenter + (cfg.movingPad ? range + halfW + 14 : halfW + 10);
  const blendDist = 46;
  for (const p of points) {
    if (p.x >= flatFrom && p.x <= flatTo) {
      p.y = padY;
    } else if (p.x > flatFrom - blendDist && p.x < flatFrom) {
      const t = (flatFrom - p.x) / blendDist;
      p.y = padY + (p.y - padY) * t;
    } else if (p.x < flatTo + blendDist && p.x > flatTo) {
      const t = (p.x - flatTo) / blendDist;
      p.y = padY + (p.y - padY) * t;
    }
  }
  points[0] = { x: 0, y: points[0].y };
  points[points.length - 1] = { x: width, y: points[points.length - 1].y };

  // Distant background ridge — pure decoration, sits behind the playfield.
  const ridge: TerrainPoint[] = [];
  const rr = mulberry32(cfg.seed * 401 + 3);
  const ridgeBase = height * (cfg.terrain === 'canyon' ? 0.42 : 0.52);
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * width;
    ridge.push({ x, y: ridgeBase - Math.sin(i * 0.7 + rr() * 3) * 26 - Math.sin(i * 0.23 + rr()) * 34 });
  }

  const pad: Pad = {
    xStart: padCenter - halfW,
    xEnd: padCenter + halfW,
    y: padY,
    vx: cfg.movingPad ? (rand() > 0.5 ? 1 : -1) * cfg.padSpeed : 0,
    baseX: padCenter, // fixed travel origin — never mutated after this
    range,
  };

  return { points, ridge, pad, width, height };
}

// --- Background décor: stars + a seeded planet -------------------------------
interface Star { x: number; y: number; r: number; phase: number; bright: number; }
interface Planet { x: number; y: number; r: number; hue: [string, string]; ring: boolean; }

const PLANET_HUES: [string, string][] = [
  ['#8a5a30', '#3a2812'], ['#6e7c4a', '#2c3418'], ['#9c7a3a', '#463010'],
  ['#7c5a4a', '#301c14'], ['#5a6e6a', '#1e2c28'],
];

function generateSky(cfg: LevelConfig, width: number, height: number): { stars: Star[]; planet: Planet } {
  const rand = mulberry32(cfg.seed * 733 + 11);
  const stars: Star[] = [];
  const count = Math.round((width * height) / 9000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height * 0.75,
      r: 0.5 + rand() * 1.3,
      phase: rand() * Math.PI * 2,
      bright: 0.25 + rand() * 0.55,
    });
  }
  const planet: Planet = {
    x: width * (0.12 + rand() * 0.76),
    y: height * (0.1 + rand() * 0.16),
    r: 18 + rand() * 26,
    hue: PLANET_HUES[Math.floor(rand() * PLANET_HUES.length)],
    ring: rand() > 0.6,
  };
  return { stars, planet };
}

// --- Decorative alien wildlife — cosmetic, seeded per level ------------------
interface Critter {
  x: number; baseY: number; kind: 'cow' | 'scurrier'; phase: number; facing: 1 | -1;
}

function generateCritters(cfg: LevelConfig, terrain: Terrain, width: number): Critter[] {
  const rand = mulberry32(cfg.seed * 31337 + 7);
  const count = 3 + Math.floor(rand() * 3);
  const critters: Critter[] = [];
  let attempts = 0;
  while (critters.length < count && attempts < 50) {
    attempts++;
    const x = 20 + rand() * (width - 40);
    if (x > terrain.pad.baseX - terrain.pad.range - 70 && x < terrain.pad.baseX + terrain.pad.range + 70) continue;
    if (cfg.terrain === 'canyon') {
      const t = x / width;
      if (t < 0.34 || t > 0.66) continue;
    }
    critters.push({
      x,
      baseY: terrainYAt(terrain.points, x),
      kind: rand() > 0.55 ? 'cow' : 'scurrier',
      phase: rand() * Math.PI * 2,
      facing: rand() > 0.5 ? 1 : -1,
    });
  }
  return critters;
}

// --- UFO hazards -------------------------------------------------------------
interface Ufo {
  x: number; y: number; baseY: number; vx: number; phase: number;
  fireCooldown: number; telegraph: number; alive: boolean;
}
interface Projectile {
  x: number; y: number; vx: number; vy: number; alive: boolean;
}

function generateUfos(cfg: LevelConfig, width: number, height: number): Ufo[] {
  const count = cfg.ufos;
  if (count === 0) return [];
  const rand = mulberry32(cfg.seed * 555 + 3);
  const list: Ufo[] = [];
  for (let i = 0; i < count; i++) {
    const baseY = height * (0.12 + rand() * 0.14);
    list.push({
      x: width * (0.2 + rand() * 0.6),
      y: baseY,
      baseY,
      vx: (rand() > 0.5 ? 1 : -1) * (18 + rand() * 14),
      phase: rand() * Math.PI * 2,
      fireCooldown: 1.5 + rand() * 2,
      telegraph: 0,
      alive: true,
    });
  }
  return list;
}

// --- Particles ----------------------------------------------------------------
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
  gravity: number;
}

function makeParticle(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, gravity = 30): Particle {
  return { x, y, vx, vy, life, maxLife: life, color, size, gravity };
}

// --- Shared AudioContext ------------------------------------------------------
let sharedAudioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (sharedAudioCtx) return sharedAudioCtx;
  try {
    // @ts-ignore webkitAudioContext fallback for older Safari
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedAudioCtx = new Ctx();
  } catch (e) {
    sharedAudioCtx = null;
  }
  return sharedAudioCtx;
}

// --- SFX engine ----------------------------------------------------------------
// v8: the old thrust was a single lowpassed sawtooth — the "low hum" complaint.
// Now it's a proper rocket rumble: looped noise through a wobbling bandpass +
// a sub oscillator, with real envelopes on every one-shot.
class AudioEngine {
  ctx: AudioContext | null = null;
  out: GainNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  thrustNodes: { noise: AudioBufferSourceNode; sub: OscillatorNode; lfo: OscillatorNode; gain: GainNode } | null = null;
  enabled = true;
  vol = 0.9; // 0..1 user volume, applied on the master sfx bus

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(0.9 * this.vol, this.ctx.currentTime, 0.05);
  }

  ensure() {
    if (this.ctx) return;
    const shared = getAudioCtx();
    if (!shared) { this.enabled = false; return; }
    try {
      this.ctx = shared;
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.9 * this.vol;
      this.out.connect(this.ctx.destination);
      const bufferSize = this.ctx.sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.enabled = false;
    }
  }

  startThrust() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.out || !this.noiseBuffer || this.thrustNodes) return;
    const t0 = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    noise.loop = true;

    const band = this.ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 620;
    band.Q.value = 0.7;

    const low = this.ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1600;

    // Slow wobble on the bandpass = the characteristic rocket "flutter"
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 7 + Math.random() * 3;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(band.frequency);

    const sub = this.ctx.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 46;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.16, t0 + 0.1);

    noise.connect(band);
    band.connect(low);
    low.connect(gain);
    sub.connect(subGain);
    subGain.connect(gain);
    gain.connect(this.out);

    noise.start();
    sub.start();
    lfo.start();
    this.thrustNodes = { noise, sub, lfo, gain };
  }

  stopThrust() {
    if (!this.ctx || !this.thrustNodes) return;
    const { noise, sub, lfo, gain } = this.thrustNodes;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.15);
    setTimeout(() => {
      try { noise.stop(); sub.stop(); lfo.stop(); } catch (e) {}
    }, 200);
    this.thrustNodes = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, delay = 0, vol = 0.08, sweepTo?: number) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.out) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(dur: number, fromFreq: number, toFreq: number, vol: number, delay = 0) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.out || !this.noiseBuffer) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(fromFreq, t0);
    filter.frequency.exponentialRampToValueAtTime(toFreq, t0 + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.out);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  landingSuccess() {
    // touchdown "pssh" + a bright little arpeggio
    this.noiseBurst(0.25, 1800, 300, 0.1);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.06 + i * 0.09, 0.09));
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f * 2, 0.12, 'triangle', 0.06 + i * 0.09, 0.02));
  }

  crash() {
    this.noiseBurst(0.6, 2400, 90, 0.26);
    this.tone(60, 0.5, 'sine', 0, 0.22, 32);
  }

  select() {
    this.tone(620, 0.07, 'triangle', 0, 0.06);
    this.tone(930, 0.06, 'triangle', 0.05, 0.04);
  }

  ufoFire() {
    this.tone(900, 0.18, 'sawtooth', 0, 0.06, 180);
  }

  chuteDeploy() {
    this.noiseBurst(0.35, 900, 2200, 0.09);
  }

  boing() {
    this.tone(160, 0.3, 'sine', 0, 0.12, 480);
    this.tone(80, 0.2, 'triangle', 0, 0.08, 160);
  }

  phoenix() {
    this.noiseBurst(0.7, 500, 3400, 0.12);
    [440, 554.37, 659.25, 880].forEach((f, i) => this.tone(f, 0.4, 'sine', 0.1 + i * 0.09, 0.09));
    this.tone(1760, 0.6, 'sine', 0.5, 0.03);
  }

  // Rarity fanfares: rank 2 = rare, 3 = epic, 4 = legendary
  raritySting(rank: number) {
    if (rank >= 4) {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, 0.5, 'sine', i * 0.11, 0.09));
      this.noiseBurst(0.8, 4000, 8000, 0.03, 0.2);
      this.tone(2093, 0.7, 'triangle', 0.55, 0.025);
    } else if (rank >= 3) {
      [523.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, 0.35, 'sine', i * 0.1, 0.08));
    } else {
      [659.25, 987.77].forEach((f, i) => this.tone(f, 0.25, 'sine', i * 0.09, 0.07));
    }
  }
}

// --- Music engine ---------------------------------------------------------------
// v8: still 100% synthesized and never-repeating, but now *musical* — the sub
// drone and cavern reverb remain, joined by slow minor-add9 chord swells and
// sparse pentatonic plucks through a feedback delay. Tension (level depth)
// darkens the filter and widens the reverb like before.
class MusicEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  dry: GainNode | null = null;
  wet: GainNode | null = null;
  reverb: ConvolverNode | null = null;
  delay: DelayNode | null = null;
  padFilter: BiquadFilterNode | null = null;
  droneNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
  running = false;
  enabled = true;
  tension = 0;
  timeouts: ReturnType<typeof setTimeout>[] = [];
  chordStep = 0;
  vol = 0.75;      // 0..1 user volume
  ducked = false;  // thrust ducking state, so volume changes re-apply correctly

  private applyLevel(timeConstant = 0.4) {
    if (!this.ctx || !this.master) return;
    const target = this.running ? (this.ducked ? 0.45 : 0.75) * this.vol : 0;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, timeConstant);
  }

  setVolume(v: number) {
    this.vol = Math.max(0, Math.min(1, v));
    this.applyLevel(0.08);
  }

  private buildReverb(ctx: AudioContext): ConvolverNode {
    const len = Math.floor(ctx.sampleRate * 3.2);
    const impulse = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const decay = Math.pow(1 - i / len, 2.6);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    return conv;
  }

  ensure() {
    if (this.ctx) return;
    const shared = getAudioCtx();
    if (!shared) { this.enabled = false; return; }
    const ctx = shared;
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    this.dry = ctx.createGain();
    this.dry.gain.value = 0.8;
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.55;
    this.reverb = this.buildReverb(ctx);
    this.dry.connect(this.master);
    this.wet.connect(this.reverb);
    this.reverb.connect(this.master);

    // Feedback delay for the plucks — gives them space + rhythm
    this.delay = ctx.createDelay(1.5);
    this.delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    this.delay.connect(fb);
    fb.connect(this.delay);
    this.delay.connect(this.wet);

    // Sub drone — two slow-beating low sines
    [55, 82.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = 0.045 - i * 0.012;
      osc.connect(gain);
      gain.connect(this.dry!);
      gain.connect(this.wet!);
      osc.start();
      this.droneNodes.push({ osc, gain });
    });

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.045;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 1.4;
    lfo.connect(lfoGain);
    this.droneNodes.forEach(({ osc }) => lfoGain.connect(osc.frequency));
    lfo.start();

    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 640;
    this.padFilter.Q.value = 2;
    this.padFilter.connect(this.wet);
    this.padFilter.connect(this.dry);
  }

  // A-minor-ish progression, voiced low and soft: Am9 → F(add9) → C(add9) → Em
  private static CHORDS: number[][] = [
    [110, 164.81, 246.94, 329.63],
    [87.31, 130.81, 220, 261.63],
    [98, 146.83, 196, 293.66],
    [82.41, 123.47, 164.81, 246.94],
  ];
  private static SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

  private playChord() {
    if (!this.ctx || !this.padFilter || !this.running) return;
    const chord = MusicEngine.CHORDS[this.chordStep % MusicEngine.CHORDS.length];
    this.chordStep++;
    const t0 = this.ctx.currentTime;
    const dur = 9;
    chord.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (i % 2 === 0 ? -4 : 4);
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.028 - i * 0.004, t0 + 3);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(this.padFilter!);
      osc.start(t0);
      osc.stop(t0 + dur + 0.1);
    });
  }

  private playPluck() {
    if (!this.ctx || !this.delay || !this.running) return;
    // Stay on chord tones half the time so it always sounds intentional
    const chord = MusicEngine.CHORDS[(this.chordStep + MusicEngine.CHORDS.length - 1) % MusicEngine.CHORDS.length];
    const pool = Math.random() > 0.5 ? chord.map((f) => f * 2) : MusicEngine.SCALE;
    const freq = pool[Math.floor(Math.random() * pool.length)];
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.05, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    osc.connect(gain);
    gain.connect(this.delay);
    gain.connect(this.wet!);
    osc.start(t0);
    osc.stop(t0 + 1.5);
  }

  private playRumble() {
    if (!this.ctx || !this.wet || !this.dry || !this.running) return;
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(38 + Math.random() * 14, t0);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.08, t0 + 0.8);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.5);
    osc.connect(gain);
    gain.connect(this.dry);
    gain.connect(this.wet);
    osc.start(t0);
    osc.stop(t0 + 3.6);
  }

  private schedule(fn: () => void, min: number, spread: number) {
    const loop = () => {
      if (!this.running) return;
      fn();
      this.timeouts.push(setTimeout(loop, min + Math.random() * spread));
    };
    this.timeouts.push(setTimeout(loop, 300 + Math.random() * 1200));
  }

  start() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.master) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    if (!this.running) {
      this.running = true;
      this.schedule(() => this.playChord(), 8000, 3000);
      this.schedule(() => this.playPluck(), 1600, 2600 - this.tension * 800);
      this.schedule(() => this.playRumble(), 11000, 12000);
    }
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.applyLevel(1.2);
  }

  stop() {
    this.running = false;
    this.timeouts.forEach((t) => clearTimeout(t));
    this.timeouts = [];
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.8);
  }

  duck(active: boolean) {
    if (this.ducked === active) return;
    this.ducked = active;
    if (!this.running) return;
    this.applyLevel(0.3);
  }

  setTension(t: number) {
    this.tension = Math.max(0, Math.min(1, t));
    if (this.padFilter && this.ctx) {
      this.padFilter.frequency.setTargetAtTime(640 - this.tension * 320, this.ctx.currentTime, 1.5);
    }
    if (this.wet && this.ctx) {
      this.wet.gain.setTargetAtTime(0.55 + this.tension * 0.15, this.ctx.currentTime, 1.5);
    }
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
    else this.start();
  }
}

// --- Ship stats derived from picked upgrades ------------------------------------
interface ShipStats {
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

function computeStats(picked: UpgradeId[], diff: Difficulty): ShipStats {
  const tol = DIFF_MODS[diff].tol;
  const s: ShipStats = {
    maxFuel: 100,
    thrustPower: 145,
    padBonus: 0,
    landingSpeedTol: 60 * tol,
    landingAngleTol: 0.28 * tol,
    shieldCharges: 0,
    gravityMult: 1,
    scanner: false,
    reserveCharges: 0,
    fuelBurnMult: 1,
    rotMult: 1,
    windMult: 1,
    fuelRegen: 0,
    spicyFlame: false,
    bounceCharges: 0,
    ufosFriendly: false,
    slowmo: false,
    projSpeedMult: 1,
    phoenixCharges: 0,
    starCore: false,
  };
  for (const id of picked) {
    switch (id) {
      case 'fuel_tank':       s.maxFuel += 45;                s.gravityMult *= 1.06; break;
      case 'boost_thrusters': s.thrustPower *= 1.4;           s.fuelBurnMult *= 1.15; break;
      case 'magnetic_pad':    s.padBonus += 40; s.landingSpeedTol *= 1.15; s.gravityMult *= 1.04; break;
      case 'shield':          s.shieldCharges += 1;           s.gravityMult *= 1.06; break;
      case 'gyro':            s.landingAngleTol += 0.16;      s.fuelBurnMult *= 1.08; break;
      case 'gravity_anchor':  s.gravityMult *= 0.85;          s.rotMult *= 0.88; break;
      case 'scanner':         s.scanner = true;               s.maxFuel -= 10; break;
      case 'feather_gear':    s.landingSpeedTol *= 1.3;       s.windMult *= 1.2; break;
      case 'reserve_chute':   s.reserveCharges += 1;          s.gravityMult *= 1.04; break;
      case 'storm_dampeners': s.windMult *= 0.5;              s.thrustPower *= 0.92; break;
      case 'fuel_scoop':      s.fuelRegen += 3;               s.maxFuel -= 15; break;
      case 'precision_jets':  s.rotMult *= 1.4;               s.fuelBurnMult *= 1.06; break;
      case 'jalapeno_injectors': s.thrustPower *= 1.3;        s.fuelBurnMult *= 1.12; s.spicyFlame = true; break;
      case 'boomerang_hull':  s.bounceCharges += 1; break;
      case 'alien_diplomacy': s.ufosFriendly = true;          s.gravityMult *= 1.05; break;
      case 'chrono_crystal':  s.slowmo = true; break;
      case 'overdrive_core':  s.thrustPower *= 1.55; s.rotMult *= 1.2; s.fuelBurnMult *= 1.22; break;
      case 'phoenix_feather': s.phoenixCharges += 1;          s.maxFuel -= 10; break;
      case 'star_core':
        s.thrustPower *= 1.12; s.maxFuel = Math.round(s.maxFuel * 1.12);
        s.landingSpeedTol *= 1.12; s.landingAngleTol *= 1.12; s.rotMult *= 1.12;
        s.gravityMult *= 0.92; s.projSpeedMult *= 1.2; s.starCore = true;
        break;
    }
  }
  // Safety clamps: stacked drawbacks can sting, but never brick the ship.
  s.maxFuel = Math.max(50, s.maxFuel);
  s.thrustPower = Math.max(105, s.thrustPower);
  s.gravityMult = Math.min(1.35, Math.max(0.5, s.gravityMult));
  s.rotMult = Math.min(2.2, Math.max(0.55, s.rotMult));
  s.windMult = Math.max(0.15, s.windMult);
  s.fuelBurnMult = Math.min(1.8, Math.max(0.6, s.fuelBurnMult));
  s.landingSpeedTol = Math.min(115, s.landingSpeedTol);
  s.landingAngleTol = Math.min(0.62, s.landingAngleTol);
  return s;
}

// --- Pilot face mapping -----------------------------------------------------------
// Normalized (0..1) positions of facial features within the selfie canvas.
// Filled by the FaceDetector API when the browser supports it; otherwise
// standard portrait proportions (the capture UI asks you to center your
// face, so these land close in practice).
interface FaceMap { eyeL: { x: number; y: number }; eyeR: { x: number; y: number }; mouth: { x: number; y: number }; }
const DEFAULT_FACE: FaceMap = { eyeL: { x: 0.36, y: 0.42 }, eyeR: { x: 0.64, y: 0.42 }, mouth: { x: 0.5, y: 0.72 } };

async function analyzeFace(photo: HTMLCanvasElement): Promise<FaceMap> {
  try {
    const FD = (window as any).FaceDetector;
    if (FD) {
      const detector = new FD({ maxDetectedFaces: 1, fastMode: false });
      const faces = await detector.detect(photo);
      const lm = faces?.[0]?.landmarks as { type: string; locations: { x: number; y: number }[] }[] | undefined;
      if (lm && lm.length) {
        const size = photo.width;
        const eyes = lm.filter((l) => l.type === 'eye');
        const mouth = lm.find((l) => l.type === 'mouth');
        const avg = (locs: { x: number; y: number }[]) => ({
          x: locs.reduce((a, p) => a + p.x, 0) / locs.length / size,
          y: locs.reduce((a, p) => a + p.y, 0) / locs.length / size,
        });
        if (eyes.length >= 2 && mouth) {
          const [a, b] = [avg(eyes[0].locations), avg(eyes[1].locations)];
          return {
            eyeL: a.x <= b.x ? a : b,
            eyeR: a.x <= b.x ? b : a,
            mouth: avg(mouth.locations),
          };
        }
      }
    }
  } catch (e) {
    // fall through to proportional default
  }
  return DEFAULT_FACE;
}

type Mood = 'neutral' | 'surprised' | 'happy';

// --- Main game -----------------------------------------------------------------
type GameState = 'start' | 'playing' | 'levelComplete' | 'crashed';

export function initLanderGame(root: HTMLElement) {
  const canvas = root.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const hud = {
    fuel: root.querySelector('[data-hud="fuel"]') as HTMLElement,
    fuelBar: root.querySelector('[data-hud="fuel-bar"]') as HTMLElement,
    altitude: root.querySelector('[data-hud="altitude"]') as HTMLElement,
    speed: root.querySelector('[data-hud="speed"]') as HTMLElement,
    level: root.querySelector('[data-hud="level"]') as HTMLElement,
    best: root.querySelector('[data-hud="best"]') as HTMLElement,
    stardust: root.querySelector('[data-hud="stardust"]') as HTMLElement,
  };
  const overlay = root.querySelector('[data-overlay]') as HTMLElement;
  const overlayContent = root.querySelector('[data-overlay-content]') as HTMLElement;
  const touchLeft = root.querySelector('[data-touch="left"]') as HTMLElement;
  const touchRight = root.querySelector('[data-touch="right"]') as HTMLElement;
  const touchThrust = root.querySelector('[data-touch="thrust"]') as HTMLElement;

  const audio = new AudioEngine();
  const music = new MusicEngine();

  // --- Separate SFX / music toggles + volume sliders ---
  const sfxBtn = root.querySelector('[data-mute-sfx]') as HTMLElement | null;
  const musicBtn = root.querySelector('[data-mute-music]') as HTMLElement | null;
  const sfxSlider = root.querySelector('[data-vol-sfx]') as HTMLInputElement | null;
  const musicSlider = root.querySelector('[data-vol-music]') as HTMLInputElement | null;
  let sfxOn = true;
  let musicOn = true;
  try {
    const legacy = localStorage.getItem('lander-muted');
    if (legacy === '1') { sfxOn = false; musicOn = false; }
    const s = localStorage.getItem('lander-sfx');
    const m = localStorage.getItem('lander-music');
    if (s !== null) sfxOn = s === '1';
    if (m !== null) musicOn = m === '1';
    const sv = parseInt(localStorage.getItem('lander-sfx-vol') ?? '90', 10);
    const mv = parseInt(localStorage.getItem('lander-music-vol') ?? '75', 10);
    audio.setVolume((isNaN(sv) ? 90 : sv) / 100);
    music.setVolume((isNaN(mv) ? 75 : mv) / 100);
    if (sfxSlider) sfxSlider.value = String(isNaN(sv) ? 90 : sv);
    if (musicSlider) musicSlider.value = String(isNaN(mv) ? 75 : mv);
  } catch (e) {}

  sfxSlider?.addEventListener('input', () => {
    audio.setVolume(parseInt(sfxSlider.value, 10) / 100);
    try { localStorage.setItem('lander-sfx-vol', sfxSlider.value); } catch (e) {}
  });
  musicSlider?.addEventListener('input', () => {
    music.setVolume(parseInt(musicSlider.value, 10) / 100);
    try { localStorage.setItem('lander-music-vol', musicSlider.value); } catch (e) {}
  });

  function applySound() {
    audio.enabled = sfxOn;
    if (!sfxOn) audio.stopThrust();
    music.setEnabled(musicOn && state !== 'start');
    if (sfxBtn) sfxBtn.textContent = sfxOn ? '🔊' : '🔇';
    if (musicBtn) musicBtn.textContent = musicOn ? '🎵' : '🔕';
    if (sfxBtn) sfxBtn.style.opacity = sfxOn ? '1' : '0.5';
    if (musicBtn) musicBtn.style.opacity = musicOn ? '1' : '0.5';
  }
  sfxBtn?.addEventListener('click', () => {
    sfxOn = !sfxOn;
    try { localStorage.setItem('lander-sfx', sfxOn ? '1' : '0'); } catch (e) {}
    applySound();
  });
  musicBtn?.addEventListener('click', () => {
    musicOn = !musicOn;
    try { localStorage.setItem('lander-music', musicOn ? '1' : '0'); } catch (e) {}
    applySound();
  });

  // --- Run state ---
  let state: GameState = 'start';
  let levelIndex = 0;
  let cfg: LevelConfig = levelConfigFor(0, 'pilot');
  let difficulty: Difficulty = 'pilot';
  try {
    const d = localStorage.getItem('lander-diff');
    if (d === 'cadet' || d === 'pilot' || d === 'ace') difficulty = d;
  } catch (e) {}

  function bestFor(d: Difficulty): number {
    try { return parseInt(localStorage.getItem(`lander-best-${d}`) || '0', 10) || 0; } catch (e) { return 0; }
  }
  function saveBest(d: Difficulty, v: number) {
    try { localStorage.setItem(`lander-best-${d}`, String(v)); } catch (e) {}
  }

  let pickedUpgrades: UpgradeId[] = [];
  let stats = computeStats([], difficulty);
  let terrain: Terrain;
  let sky: { stars: Star[]; planet: Planet };
  let particles: Particle[] = [];
  let critters: Critter[] = [];
  let ufos: Ufo[] = [];
  let projectiles: Projectile[] = [];
  let windPhase = 0;
  let shieldFlash = 0;
  let shakeT = 0;
  let introT = 0;
  let celebrateT = 0;
  let bouncesUsed = 0;      // boomerang hull, per level
  let phoenixUsed = 0;      // phoenix feather, per run
  let phoenixFlashT = 0;    // golden revive flash
  let slowmoActive = false; // chrono crystal state, read by draw()
  let runStats = { crashes: 0, landings: 0 };

  // Pilot selfie — session-only, in memory (never persisted to disk).
  let pilotPhoto: HTMLCanvasElement | null = null;
  let faceMap: FaceMap = DEFAULT_FACE;
  let cameraStream: MediaStream | null = null;

  // --- Persistent progression: Stardust, cosmetics, achievements, pilot name ---
  function loadJSON<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return { ...fallback, ...JSON.parse(raw) };
    } catch (e) {}
    return fallback;
  }

  let stardust = 0;
  try { stardust = parseInt(localStorage.getItem('lander-stardust') || '0', 10) || 0; } catch (e) {}
  function stardustAdd(n: number) {
    stardust = Math.max(0, stardust + n);
    try { localStorage.setItem('lander-stardust', String(stardust)); } catch (e) {}
  }

  let cosmetics = loadJSON('lander-cosmetics', {
    owned: ['paint_classic', 'trail_ember', 'sky_hearthwood'] as string[],
    paint: 'paint_classic',
    trail: 'trail_ember',
    sky: 'sky_hearthwood',
  });
  function saveCosmetics() {
    try { localStorage.setItem('lander-cosmetics', JSON.stringify(cosmetics)); } catch (e) {}
  }
  const equippedPaint = () => PAINTS.find((p) => p.id === cosmetics.paint) ?? PAINTS[0];
  const equippedSky = () => SKIES.find((s) => s.id === cosmetics.sky) ?? SKIES[0];
  function trailColors(): string[] {
    const t = TRAILS.find((x) => x.id === cosmetics.trail) ?? TRAILS[0];
    if (t.colors === 'rainbow') {
      const h = (performance.now() / 18) % 360;
      return [`hsl(${h.toFixed(0)}, 72%, 62%)`, `hsl(${((h + 46) % 360).toFixed(0)}, 72%, 55%)`];
    }
    if (t.colors === 'stardust') return ['#F4EBDA', '#FFE9B0', '#FFC94A'];
    return t.colors;
  }

  let achievements = loadJSON<Record<string, boolean>>('lander-achievements', {});
  interface Toast { text: string; t: number; }
  let toasts: Toast[] = [];
  function unlockAch(id: string) {
    if (achievements[id]) return;
    achievements[id] = true;
    try { localStorage.setItem('lander-achievements', JSON.stringify(achievements)); } catch (e) {}
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (def) toasts.push({ text: `🏆 ${def.icon} ${def.name}  ·  +25✨`, t: 4.2 });
    stardustAdd(25);
    audio.raritySting(2);
  }

  let pilotName = '';
  try { pilotName = localStorage.getItem('lander-pilot') || ''; } catch (e) {}

  // --- Global leaderboard client (Netlify Function + Blobs at /api/scores).
  // Fully optional: if the endpoint isn't there, everything degrades to
  // local bests and the leaderboard screen says so.
  interface ScoreRow { name: string; level: number; difficulty: Difficulty; }
  let lbCache: ScoreRow[] | null = null;
  let lbOffline = false;

  async function fetchLeaderboard(): Promise<ScoreRow[] | null> {
    try {
      const res = await fetch('/api/scores', { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('bad payload');
      lbCache = data;
      lbOffline = false;
      return data;
    } catch (e) {
      lbOffline = true;
      return null;
    }
  }

  async function submitScore(name: string, level: number): Promise<boolean> {
    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, level, difficulty }),
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  let width = 0, height = 0, dpr = 1;
  let S = 1.6; // ship render/collision scale

  const ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: 100, thrusting: false,
    reserveUsed: false,
  };

  const input = { left: false, right: false, thrust: false };

  // --- Responsive sizing: fill the container, go taller on portrait phones ---
  function resize() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    let w = Math.min(rect.width, 1200);
    const aspect = portrait ? 1.15 : 0.62;
    let h = Math.round(w * aspect);
    const maxH = Math.round(window.innerHeight * (portrait ? 0.66 : 0.72));
    if (h > maxH && maxH > 160) h = maxH;
    width = w;
    height = h;
    // Big ship — the pilot's face is a feature, so it gets real pixels.
    // Scaled to the canvas: ~1.6x on phones up to ~2.3x on desktop.
    S = Math.max(1.6, Math.min(2.3, width / 420));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (terrain) {
      terrain = generateTerrain(cfg, width, height);
      sky = generateSky(cfg, width, height);
    }
  }

  function setOverlay(html: string | null) {
    if (!overlay || !overlayContent) return;
    if (html === null) {
      overlay.classList.add('hidden');
      overlayContent.innerHTML = '';
    } else {
      overlay.classList.remove('hidden');
      overlayContent.innerHTML = html;
    }
  }

  function startRun() {
    levelIndex = 0;
    pickedUpgrades = [];
    stats = computeStats(pickedUpgrades, difficulty);
    runStats = { crashes: 0, landings: 0 };
    phoenixUsed = 0;
    music.ensure();
    loadLevel(0);
    state = 'playing';
    setOverlay(null);
    applySound();
    if (musicOn) music.start();
  }

  function loadLevel(idx: number) {
    levelIndex = idx;
    cfg = levelConfigFor(idx, difficulty);
    terrain = generateTerrain(cfg, width, height);
    sky = generateSky(cfg, width, height);
    ship.x = width * 0.5;
    ship.y = height * 0.1;
    ship.vx = (Math.random() - 0.5) * 20;
    ship.vy = 10;
    ship.angle = 0;
    ship.fuel = stats.maxFuel;
    ship.reserveUsed = false;
    particles = [];
    critters = generateCritters(cfg, terrain, width);
    ufos = generateUfos(cfg, width, height);
    projectiles = [];
    windPhase = Math.random() * 10;
    introT = 2.4;
    celebrateT = 0;
    bouncesUsed = 0;
    music.setTension(Math.min(1, idx / 14));
  }

  function currentWind(c: LevelConfig, t: number) {
    return c.wind + Math.sin(t * 0.6) * c.windGust;
  }

  function emitThrusterParticles() {
    const colors = stats.spicyFlame ? ['#94B03D', '#D9E8B8'] : trailColors();
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = (70 + Math.random() * 50) * S;
      const a = ship.angle + Math.PI + spread;
      particles.push(makeParticle(
        ship.x - Math.sin(ship.angle) * 12 * S,
        ship.y + Math.cos(ship.angle) * 12 * S,
        Math.sin(a) * speed + ship.vx * 0.3,
        -Math.cos(a) * speed + ship.vy * 0.3,
        colors[Math.floor(Math.random() * colors.length)],
        0.35 + Math.random() * 0.3,
        (1.5 + Math.random() * 2) * S
      ));
    }
  }

  function emitDust(groundY: number) {
    for (let i = 0; i < 2; i++) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      particles.push(makeParticle(
        ship.x + (Math.random() - 0.5) * 20 * S,
        groundY - 2,
        dir * (30 + Math.random() * 60),
        -(10 + Math.random() * 30),
        Math.random() > 0.5 ? 'rgba(185,164,128,0.5)' : 'rgba(122,100,70,0.5)',
        0.5 + Math.random() * 0.5,
        (2 + Math.random() * 3) * S,
        14
      ));
    }
  }

  function explode() {
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * S;
      particles.push(makeParticle(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        Math.random() > 0.5 ? '#C97B3D' : (Math.random() > 0.5 ? '#94B03D' : '#F4EBDA'),
        0.5 + Math.random() * 0.7,
        (2 + Math.random() * 3) * S,
        60
      ));
    }
    shakeT = 0.55;
  }

  function confetti() {
    const colors = ['#94B03D', '#D9A441', '#C97B3D', '#F4EBDA', '#7C8F5C'];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const speed = (60 + Math.random() * 120) * S;
      particles.push(makeParticle(
        ship.x, ship.y - 8 * S,
        Math.cos(a) * speed, Math.sin(a) * speed,
        colors[Math.floor(Math.random() * colors.length)],
        0.8 + Math.random() * 0.6,
        (1.5 + Math.random() * 2.2) * S,
        110
      ));
    }
  }

  function normalizeAngle(a: number) {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  function simulateParticles(dt: number) {
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
  }

  function update(dt: number) {
    if (shakeT > 0) shakeT -= dt;
    if (phoenixFlashT > 0) phoenixFlashT -= dt;
    if (toasts.length) {
      for (const toast of toasts) toast.t -= dt;
      toasts = toasts.filter((x) => x.t > 0);
    }

    // Post-landing celebration: happy pilot + confetti settle, then upgrades.
    if (state === 'levelComplete') {
      simulateParticles(dt);
      if (celebrateT > 0) {
        celebrateT -= dt;
        if (celebrateT <= 0) showLevelComplete();
      }
      return;
    }
    if (state !== 'playing') {
      slowmoActive = false;
      simulateParticles(dt);
      return;
    }

    // Chrono Crystal: the world runs at 75% below 120m — but the fuel
    // clock doesn't care (that's the tradeoff), so drains use raw dt.
    const altNow = terrain ? terrainYAt(terrain.points, ship.x) - ship.y : 999;
    slowmoActive = stats.slowmo && altNow < 120;
    const pdt = slowmoActive ? dt * 0.75 : dt;

    windPhase += pdt;
    if (introT > 0) introT -= dt;

    // Rotation — direct control, simple & predictable
    const rotSpeed = 2.6 * stats.rotMult;
    if (input.left) ship.angle -= rotSpeed * pdt;
    if (input.right) ship.angle += rotSpeed * pdt;

    // Gravity + wind
    ship.vy += cfg.gravity * stats.gravityMult * pdt;
    ship.vx += currentWind(cfg, windPhase) * stats.windMult * pdt;

    // Thrust
    ship.thrusting = input.thrust && ship.fuel > 0;
    if (ship.thrusting) {
      ship.vx += Math.sin(ship.angle) * stats.thrustPower * pdt;
      ship.vy -= Math.cos(ship.angle) * stats.thrustPower * pdt;
      ship.fuel = Math.max(0, ship.fuel - 22 * stats.fuelBurnMult * dt);
      emitThrusterParticles();
      audio.startThrust();
      music.duck(true);
    } else {
      if (stats.fuelRegen > 0) {
        ship.fuel = Math.min(stats.maxFuel, ship.fuel + stats.fuelRegen * dt);
      }
      audio.stopThrust();
      music.duck(false);
    }

    ship.x += ship.vx * pdt;
    ship.y += ship.vy * pdt;
    if (ship.x < 6 * S) { ship.x = 6 * S; ship.vx *= -0.4; }
    if (ship.x > width - 6 * S) { ship.x = width - 6 * S; ship.vx *= -0.4; }
    if (ship.y < 18 * S) { ship.y = 18 * S; ship.vy = Math.max(0, ship.vy); }

    // Moving pad — ping-pongs between baseX ± range along its pre-flattened
    // corridor (baseX is a fixed origin; see generateTerrain).
    if (cfg.movingPad) {
      const shift = terrain.pad.vx * pdt;
      terrain.pad.xStart += shift;
      terrain.pad.xEnd += shift;
      const center = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      if ((terrain.pad.vx > 0 && center >= terrain.pad.baseX + terrain.pad.range) ||
          (terrain.pad.vx < 0 && center <= terrain.pad.baseX - terrain.pad.range)) {
        terrain.pad.vx *= -1;
      }
    }

    simulateParticles(pdt);
    if (shieldFlash > 0) shieldFlash -= dt;

    // Ground proximity dust while thrusting
    const groundY = terrainYAt(terrain.points, ship.x);
    if (ship.thrusting && groundY - ship.y < 80 * S) emitDust(groundY);

    // Ground collision
    if (ship.y + 9 * S >= groundY) {
      handleTouchdown(groundY);
    }

    updateUfos(pdt);

    // Fuel-out safety net — reserve chute fires once per level.
    if (ship.fuel <= 0 && stats.reserveCharges > 0 && !ship.reserveUsed && ship.vy > 80) {
      ship.reserveUsed = true;
      ship.vy *= 0.25;
      ship.vx *= 0.6;
      audio.chuteDeploy();
    }
  }

  // Central destruction path: Phoenix Feather intercepts any lethal hit,
  // once per run — golden flash, back to the top with 60% fuel.
  function destroyShip() {
    if (stats.phoenixCharges > phoenixUsed) {
      phoenixUsed += 1;
      explode();
      phoenixFlashT = 0.9;
      ship.x = width * 0.5;
      ship.y = height * 0.12;
      ship.vx = 0;
      ship.vy = 10;
      ship.angle = 0;
      ship.fuel = Math.round(stats.maxFuel * 0.6);
      audio.phoenix();
      unlockAch('ach_phoenix');
      return;
    }
    runStats.crashes += 1;
    explode();
    audio.crash();
    state = 'crashed';
    setTimeout(showCrashScreen, 600);
  }

  function handleTouchdown(groundY: number) {
    const speed = Math.hypot(ship.vx, ship.vy);
    const angle = Math.abs(normalizeAngle(ship.angle));
    const onPad = ship.x > terrain.pad.xStart - stats.padBonus / 2 &&
                  ship.x < terrain.pad.xEnd + stats.padBonus / 2;
    const safe = onPad && speed < stats.landingSpeedTol && angle < stats.landingAngleTol;

    ship.y = groundY - 9 * S;

    if (safe) {
      runStats.landings += 1;
      const completed = levelIndex + 1;
      if (completed > bestFor(difficulty)) saveBest(difficulty, completed);
      audio.landingSuccess();
      confetti();

      // Stardust payout — deeper levels and harder modes pay more.
      const diffMult = difficulty === 'ace' ? 2 : difficulty === 'pilot' ? 1.5 : 1;
      const payout = Math.round((5 + completed * 2) * diffMult);
      stardustAdd(payout);
      toasts.push({ text: `+${payout}✨`, t: 2.2 });

      // Achievement checks
      unlockAch('ach_first');
      if (completed >= 5) unlockAch('ach_l5');
      if (completed >= 10) unlockAch('ach_l10');
      if (completed >= 20) unlockAch('ach_l20');
      if (completed >= 5 && difficulty === 'ace') unlockAch('ach_ace5');
      if (speed < 15) unlockAch('ach_feather');
      if (Math.abs(ship.x - (terrain.pad.xStart + terrain.pad.xEnd) / 2) < 6) unlockAch('ach_bullseye');
      if (ship.fuel < 5) unlockAch('ach_fumes');
      if (pickedUpgrades.length >= 8) unlockAch('ach_hoarder');
      if (slowmoActive) unlockAch('ach_chrono');

      ship.vx = 0; ship.vy = 0; ship.angle = 0;
      state = 'levelComplete';
      celebrateT = 1.25;
    } else if (stats.bounceCharges > bouncesUsed && speed < stats.landingSpeedTol * 2.2) {
      // Boomerang Hull: eat the impact, spring back up, lose some fuel.
      bouncesUsed += 1;
      ship.fuel = Math.max(0, ship.fuel - 15);
      ship.vy = -Math.abs(ship.vy) * 0.55;
      ship.vx *= 0.7;
      ship.y = groundY - 10 * S;
      shakeT = 0.2;
      emitDust(groundY);
      audio.boing();
      unlockAch('ach_boing');
    } else if (stats.shieldCharges > 0) {
      stats.shieldCharges -= 1;
      shieldFlash = 0.5;
      ship.vy = -Math.abs(ship.vy) * 0.35;
      ship.vx *= 0.4;
      shakeT = 0.25;
    } else {
      destroyShip();
    }
  }

  function updateUfos(dt: number) {
    for (const u of ufos) {
      if (!u.alive) continue;
      u.phase += dt;
      u.x += u.vx * dt;
      if (u.x < 30) { u.x = 30; u.vx *= -1; }
      if (u.x > width - 30) { u.x = width - 30; u.vx *= -1; }
      u.y = u.baseY + Math.sin(u.phase * 0.8) * 10;

      // Alien Embassy Plates: they see the plates, they wave, they hold fire.
      if (!stats.ufosFriendly) {
        if (u.telegraph > 0) {
          u.telegraph -= dt;
          if (u.telegraph <= 0) {
            const dx = ship.x - u.x;
            const dy = ship.y - u.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 130 * stats.projSpeedMult;
            projectiles.push({ x: u.x, y: u.y, vx: (dx / dist) * speed, vy: (dy / dist) * speed, alive: true });
            audio.ufoFire();
            u.fireCooldown = 2.4 + Math.random() * 2.2;
          }
        } else {
          u.fireCooldown -= dt;
          if (u.fireCooldown <= 0) u.telegraph = 0.35;
        }
      }
    }

    for (const p of projectiles) {
      if (!p.alive) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        p.alive = false;
        continue;
      }
      if (state === 'playing' && Math.hypot(p.x - ship.x, p.y - ship.y) < 9 * S) {
        p.alive = false;
        if (stats.shieldCharges > 0) {
          stats.shieldCharges -= 1;
          shieldFlash = 0.5;
        } else {
          destroyShip();
        }
      }
    }
    projectiles = projectiles.filter((p) => p.alive);
  }

  // --- Overlays ---
  function upgradeListHtml() {
    if (pickedUpgrades.length === 0) return '<p class="text-xs text-muted mt-2">No upgrades yet.</p>';
    const counts = new Map<UpgradeId, number>();
    pickedUpgrades.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    return '<div class="flex flex-wrap gap-2 mt-3 justify-center">' +
      Array.from(counts.entries()).map(([id, n]) => {
        const def = UPGRADES.find((u) => u.id === id)!;
        const color = RARITY[def.rarity].color;
        return `<span class="badge border px-2 py-1" style="border-color:${color}">${def.icon} ${def.name}${n > 1 ? ` ×${n}` : ''}</span>`;
      }).join('') + '</div>';
  }

  function showLevelComplete() {
    setOverlay(`
      <div class="text-center">
        <p class="badge badge-signal">landed — level ${levelIndex + 1} clear</p>
        <h2 class="font-display text-2xl font-semibold mt-2">Pick an upgrade</h2>
        <p class="text-xs text-muted mt-1">Every boon has a cost. Rarer finds, bigger swings — gold ones are an event.</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" data-upgrade-choices></div>
      </div>
    `);
    renderUpgradeChoices();
  }

  // Weighted-by-rarity draw of 3 distinct upgrades. Owned upgrades roll at
  // half weight so fresh options surface, but stacking stays possible.
  function rollUpgradeChoices(): UpgradeDef[] {
    const owned = new Set(pickedUpgrades);
    const picks: UpgradeDef[] = [];
    for (let k = 0; k < 3; k++) {
      const pool = UPGRADES.filter((u) => !picks.includes(u));
      const total = pool.reduce((a, u) => a + RARITY[u.rarity].weight * (owned.has(u.id) ? 0.5 : 1), 0);
      let roll = Math.random() * total;
      for (const u of pool) {
        roll -= RARITY[u.rarity].weight * (owned.has(u.id) ? 0.5 : 1);
        if (roll <= 0) { picks.push(u); break; }
      }
      if (picks.length <= k) picks.push(pool[pool.length - 1]);
    }
    return picks;
  }

  const RARITY_RANK: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  function renderUpgradeChoices() {
    const container = overlayContent.querySelector('[data-upgrade-choices]');
    if (!container) return;
    const choices = rollUpgradeChoices();
    container.innerHTML = choices.map((u) => {
      const r = RARITY[u.rarity];
      const rank = RARITY_RANK.indexOf(u.rarity);
      const glow = rank >= 2 ? `box-shadow: 0 0 ${rank >= 4 ? 28 : rank >= 3 ? 20 : 13}px ${r.color}${rank >= 4 ? '77' : '44'};` : '';
      const label = rank >= 4 ? `✦ ${r.label} ✦` : r.label;
      return `
      <button class="tile text-left cursor-pointer" data-pick="${u.id}" style="border-color:${r.color}; ${glow}">
        <div class="flex items-center justify-between">
          <span class="text-2xl">${u.icon}</span>
          <span class="text-[10px] font-mono uppercase tracking-wider" style="color:${r.color}">${label}</span>
        </div>
        <div class="font-display font-semibold mt-2">${u.name}</div>
        <div class="text-xs mt-2" style="color:#94B03D">▲ ${u.pro}</div>
        <div class="text-xs mt-1" style="color:#C97B3D">▼ ${u.con}</div>
      </button>
    `;
    }).join('');

    // Rare+ offers announce themselves
    const topRank = Math.max(...choices.map((u) => RARITY_RANK.indexOf(u.rarity)));
    if (topRank >= 2) audio.raritySting(topRank);

    container.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.pick as UpgradeId;
        pickedUpgrades.push(id);
        stats = computeStats(pickedUpgrades, difficulty);
        const def = UPGRADES.find((u) => u.id === id);
        if (def?.rarity === 'legendary') unlockAch('ach_gold');
        if (id === 'jalapeno_injectors') unlockAch('ach_spicy');
        audio.select();
        loadLevel(levelIndex + 1);
        state = 'playing';
        setOverlay(null);
      });
    });
  }

  function showCrashScreen() {
    const best = bestFor(difficulty);
    const reached = levelIndex + 1;
    setOverlay(`
      <div class="text-center">
        <p class="badge" style="color:#C97B3D">run over</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Crashed on ${cfg.name}</h2>
        <p class="text-muted mt-3">Reached level ${reached} as ${DIFF_MODS[difficulty].label} · Landings: ${runStats.landings} · Best: level ${best}</p>
        ${upgradeListHtml()}
        <div class="flex items-center justify-center gap-2 mt-5 flex-wrap">
          <input data-lb-name maxlength="12" placeholder="pilot name" value="${pilotName.replace(/"/g, '')}"
            class="bg-canvas border border-line px-3 py-2 font-mono text-sm w-36 text-center" />
          <button data-action="submit-score" class="tile px-4 py-2 cursor-pointer font-mono text-sm">🌍 post to leaderboard</button>
        </div>
        <p class="text-xs text-muted mt-1" data-lb-status></p>
        <button data-action="restart" class="tile mt-5 px-6 py-3 inline-block cursor-pointer font-mono">restart run</button>
        <div><button data-action="menu" class="mt-3 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">back to menu</button></div>
      </div>
    `);
  }

  async function handleScoreSubmit() {
    const input = overlayContent.querySelector('[data-lb-name]') as HTMLInputElement | null;
    const status = overlayContent.querySelector('[data-lb-status]') as HTMLElement | null;
    const btn = overlayContent.querySelector('[data-action="submit-score"]') as HTMLButtonElement | null;
    const name = (input?.value || '').replace(/[^a-zA-Z0-9 _\-\.]/g, '').trim().slice(0, 12);
    if (!name) {
      if (status) status.textContent = 'Give your pilot a name first.';
      return;
    }
    pilotName = name;
    try { localStorage.setItem('lander-pilot', name); } catch (e) {}
    if (btn) { btn.disabled = true; btn.textContent = 'posting…'; }
    const ok = await submitScore(name, levelIndex + 1);
    if (ok) {
      lbCache = null; // refetch next time the board opens
      if (btn) btn.textContent = 'on the board ✓';
      if (status) status.textContent = '';
      audio.select();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = '🌍 post to leaderboard'; }
      if (status) status.textContent = 'Leaderboard unreachable right now — your local best is saved.';
    }
  }

  // --- Global leaderboard screen ---
  async function showLeaderboard() {
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">🌍 global leaderboard</p>
        <h2 class="font-display text-2xl font-semibold mt-2">Deepest descents, worldwide</h2>
        <div class="mt-4 text-left font-mono text-sm" data-lb-list>
          <p class="text-muted text-center text-xs">contacting mission control…</p>
        </div>
        <button data-action="menu" class="tile mt-5 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
    const list = overlayContent.querySelector('[data-lb-list]') as HTMLElement | null;
    const rows = lbCache ?? await fetchLeaderboard();
    if (!list) return;
    if (!rows || rows.length === 0) {
      list.innerHTML = `<p class="text-muted text-center text-xs">${
        lbOffline
          ? 'Global leaderboard is unreachable right now — local bests still count.'
          : 'No scores posted yet. Crash gloriously and be the first.'
      }</p>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = rows.slice(0, 25).map((r, i) => `
      <div class="flex items-center justify-between gap-3 py-1.5 ${i < rows.length - 1 ? 'border-b border-line' : ''}">
        <span class="text-muted w-8">${medals[i] ?? `${i + 1}.`}</span>
        <span class="flex-1 text-ink truncate">${String(r.name).replace(/[<>&]/g, '')}</span>
        <span class="text-muted text-xs">${DIFF_MODS[r.difficulty as Difficulty]?.icon ?? ''}</span>
        <span class="badge-signal">lvl ${r.level}</span>
      </div>
    `).join('');
  }

  // --- Achievements screen ---
  function showAchievements() {
    const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
    setOverlay(`
      <div class="text-center max-w-lg mx-auto">
        <p class="badge badge-signal">🎖 achievements</p>
        <h2 class="font-display text-2xl font-semibold mt-2">${unlocked} / ${ACHIEVEMENTS.length} unlocked</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-left">
          ${ACHIEVEMENTS.map((a) => {
            const got = !!achievements[a.id];
            return `<div class="border px-3 py-2 ${got ? '' : 'opacity-45'}" style="border-color: ${got ? 'var(--color-signal)' : 'var(--color-line)'}">
              <div class="font-mono text-sm">${a.icon} ${a.name}</div>
              <div class="text-xs text-muted mt-0.5">${got ? a.desc : '???'}</div>
            </div>`;
          }).join('')}
        </div>
        <button data-action="menu" class="tile mt-5 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
  }

  // --- Hangar Shop (cosmetics, paid in Stardust) ---
  function shopItemHtml(kind: 'paint' | 'trail' | 'sky', id: string, name: string, price: number, swatch: string): string {
    const owned = cosmetics.owned.includes(id);
    const equipped = cosmetics[kind] === id;
    const action = equipped ? '' : owned
      ? `<button data-shop="equip:${kind}:${id}" class="badge border border-line px-2 py-1 cursor-pointer hover:border-accent">equip</button>`
      : `<button data-shop="buy:${kind}:${id}" class="badge border border-line px-2 py-1 cursor-pointer hover:border-accent">✨ ${price}</button>`;
    return `
      <div class="flex items-center gap-3 py-2 border-b border-line">
        <span class="inline-block w-9 h-5 border border-line shrink-0" style="background:${swatch}"></span>
        <span class="flex-1 text-left font-mono text-sm ${equipped ? 'badge-signal' : 'text-ink'}">${name}${equipped ? ' · equipped' : ''}</span>
        ${action}
      </div>`;
  }

  function showShop(statusMsg = '') {
    const trailSwatch = (td: TrailDef) => td.colors === 'rainbow'
      ? 'linear-gradient(90deg,#e05a5a,#d9a441,#94b03d,#7ba7c7,#b07bd6)'
      : td.colors === 'stardust'
        ? 'linear-gradient(90deg,#F4EBDA,#FFC94A)'
        : `linear-gradient(90deg,${(td.colors as string[]).join(',')})`;
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">🛒 hangar shop</p>
        <h2 class="font-display text-2xl font-semibold mt-2">✨ ${stardust} stardust</h2>
        <p class="text-xs text-muted mt-1">Earned with every landing — deeper levels pay more.</p>
        ${statusMsg ? `<p class="text-xs mt-2" style="color:#C97B3D">${statusMsg}</p>` : ''}
        <div class="mt-4 text-left">
          <p class="badge">ship paint</p>
          ${PAINTS.map((p) => shopItemHtml('paint', p.id, p.name, p.price, `linear-gradient(135deg,${p.hullTop},${p.hullBot})`)).join('')}
          <p class="badge mt-4">thruster trail</p>
          ${TRAILS.map((td) => shopItemHtml('trail', td.id, td.name, td.price, trailSwatch(td))).join('')}
          <p class="badge mt-4">sky theme</p>
          ${SKIES.map((sk) => shopItemHtml('sky', sk.id, sk.name, sk.price, `linear-gradient(180deg,${sk.top},${sk.bot})`)).join('')}
        </div>
        <p class="text-[11px] text-muted mt-4">Stardust packs for real money aren't wired up yet — that needs a payment
        account only Tom can create. Until then: land more, earn more.</p>
        <button data-action="menu" class="tile mt-4 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
  }

  function handleShopAction(spec: string) {
    const [verb, kind, id] = spec.split(':') as [string, 'paint' | 'trail' | 'sky', string];
    const list = kind === 'paint' ? PAINTS : kind === 'trail' ? TRAILS : SKIES;
    const item = (list as { id: string; price: number }[]).find((x) => x.id === id);
    if (!item) return;
    if (verb === 'buy') {
      if (cosmetics.owned.includes(id)) return;
      if (stardust < item.price) {
        showShop(`Not enough stardust — that's ✨${item.price}.`);
        return;
      }
      stardustAdd(-item.price);
      cosmetics.owned.push(id);
      cosmetics[kind] = id;
      saveCosmetics();
      audio.raritySting(3);
      showShop();
    } else if (verb === 'equip') {
      cosmetics[kind] = id;
      saveCosmetics();
      audio.select();
      showShop();
    }
  }

  function diffButtonsHtml() {
    return `<div class="flex gap-2 justify-center mt-4">${(Object.keys(DIFF_MODS) as Difficulty[]).map((d) => {
      const mod = DIFF_MODS[d];
      const active = d === difficulty;
      return `<button data-diff="${d}" class="tile px-4 py-2 cursor-pointer text-center" style="${active ? 'border-color: var(--color-accent);' : 'opacity:0.65;'}">
        <div class="font-mono text-sm">${mod.icon} ${mod.label}</div>
        <div class="text-[10px] text-muted mt-0.5">${mod.blurb}</div>
        <div class="text-[10px] font-mono mt-1 badge-signal">best: ${bestFor(d) || '—'}</div>
      </button>`;
    }).join('')}</div>`;
  }

  function showStartScreen() {
    state = 'start';
    music.stop();
    const thumbHtml = pilotPhoto
      ? `<img src="${pilotPhoto.toDataURL('image/png')}" alt="Pilot selfie preview" class="mx-auto rounded-full border-2 mt-4 block" style="width:64px;height:64px;border-color:var(--color-accent);" />`
      : `<div class="mx-auto rounded-full border-2 mt-4 flex items-center justify-center text-2xl" style="width:64px;height:64px;border-color:var(--color-line);" aria-hidden="true">🧑‍🚀</div>`;
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">moon lander · endless roguelite</p>
        <h2 class="font-display text-3xl font-semibold mt-2">How deep can you go?</h2>
        <p class="text-muted mt-3 text-sm">
          ←/→ or A/D to rotate · ↑ / W / Space to thrust. Land slow and level on
          the pad. Endless levels, each harder than the last. Upgrades roll in
          five rarities — every one has a real tradeoff, and the gold ones are
          worth the wait.
        </p>
        ${diffButtonsHtml()}
        ${thumbHtml}
        <button data-action="restart" class="tile mt-4 px-8 py-3 inline-block cursor-pointer font-mono badge-signal">start run</button>
        <div>
          <button data-action="open-selfie" class="mt-3 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">
            ${pilotPhoto ? 'change pilot photo' : 'take a pilot selfie'}
          </button>
        </div>
        <div class="flex items-center justify-center gap-4 mt-4 text-xs font-mono flex-wrap">
          <button data-action="leaderboard" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">🌍 leaderboard</button>
          <button data-action="achievements" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">🎖 achievements ${ACHIEVEMENTS.filter((a) => achievements[a.id]).length}/${ACHIEVEMENTS.length}</button>
          <button data-action="shop" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">🛒 hangar shop · ✨${stardust}</button>
        </div>
      </div>
    `);
  }

  async function openSelfieCapture() {
    setOverlay(`
      <div class="text-center max-w-sm mx-auto">
        <p class="badge badge-signal">pilot selfie</p>
        <h2 class="font-display text-xl font-semibold mt-2">Center your face</h2>
        <video
          data-selfie-video autoplay playsinline muted
          class="mx-auto mt-4 block rounded-full object-cover border-2"
          style="width:220px;height:220px;border-color:var(--color-accent);transform:scaleX(-1);"
        ></video>
        <p class="text-xs text-muted mt-3" data-selfie-status>Requesting camera access…</p>
        <div class="flex items-center justify-center gap-3 mt-4">
          <button data-action="snap-selfie" class="tile px-5 py-2 cursor-pointer font-mono badge-signal" disabled>Snap</button>
          <button data-action="cancel-selfie" class="tile px-5 py-2 cursor-pointer font-mono">Cancel</button>
        </div>
      </div>
    `);
    const video = overlayContent.querySelector('[data-selfie-video]') as HTMLVideoElement | null;
    const status = overlayContent.querySelector('[data-selfie-status]') as HTMLElement | null;
    const snapBtn = overlayContent.querySelector('[data-action="snap-selfie"]') as HTMLButtonElement | null;

    if (!navigator.mediaDevices?.getUserMedia) {
      if (status) status.textContent = "Camera not supported on this device — you'll fly with the default helmet icon.";
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (video) video.srcObject = cameraStream;
      if (status) status.textContent = 'Center your face in the circle, then snap.';
      if (snapBtn) snapBtn.disabled = false;
    } catch (e) {
      if (status) status.textContent = "Camera unavailable or denied — you'll fly with the default helmet icon.";
    }
  }

  function snapSelfie() {
    const video = overlayContent.querySelector('[data-selfie-video]') as HTMLVideoElement | null;
    if (!video || !video.videoWidth) return;
    const size = 200;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    if (!octx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    octx.save();
    octx.beginPath();
    octx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    octx.clip();
    octx.translate(size, 0);
    octx.scale(-1, 1);
    octx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
    octx.restore();

    pilotPhoto = off;
    faceMap = DEFAULT_FACE;
    // Locate eyes/mouth once at capture; expressions re-render every frame.
    analyzeFace(off).then((m) => { faceMap = m; });
    unlockAch('ach_selfie');
    stopCameraStream();
    showStartScreen();
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
  }

  overlay?.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action],[data-diff],[data-shop]') as HTMLElement | null;
    if (!target) return;
    if (target.dataset.diff) {
      difficulty = target.dataset.diff as Difficulty;
      try { localStorage.setItem('lander-diff', difficulty); } catch (err) {}
      audio.select();
      showStartScreen();
      return;
    }
    if (target.dataset.shop) { handleShopAction(target.dataset.shop); return; }
    if (target.dataset.action === 'restart') startRun();
    if (target.dataset.action === 'menu') showStartScreen();
    if (target.dataset.action === 'open-selfie') openSelfieCapture();
    if (target.dataset.action === 'snap-selfie') snapSelfie();
    if (target.dataset.action === 'cancel-selfie') { stopCameraStream(); showStartScreen(); }
    if (target.dataset.action === 'leaderboard') showLeaderboard();
    if (target.dataset.action === 'achievements') showAchievements();
    if (target.dataset.action === 'shop') showShop();
    if (target.dataset.action === 'submit-score') handleScoreSubmit();
  });

  // --- Input ---
  function keydown(e: KeyboardEvent) {
    if (e.repeat) return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = true;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = true;
    if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) { input.thrust = true; e.preventDefault(); }
  }
  function keyup(e: KeyboardEvent) {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = false;
    if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) input.thrust = false;
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  function bindTouch(el: HTMLElement | null, on: () => void, off: () => void) {
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); off(); }, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindTouch(touchLeft, () => (input.left = true), () => (input.left = false));
  bindTouch(touchRight, () => (input.right = true), () => (input.right = false));
  bindTouch(touchThrust, () => (input.thrust = true), () => (input.thrust = false));

  // --- Rendering ---
  function currentMood(): Mood {
    if (state === 'levelComplete') return 'happy';
    if (ship.thrusting && state === 'playing') return 'surprised';
    return 'neutral';
  }

  // Real-time expression edit on the selfie: eye/mouth regions are
  // resampled from the photo and redrawn transformed inside the cockpit.
  function drawPhotoFace(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, mood: Mood) {
    const photo = pilotPhoto!;
    const ps = photo.width;
    c.drawImage(photo, x0, y0, w, h);
    if (mood === 'neutral') return;

    const eyes = [faceMap.eyeL, faceMap.eyeR];
    if (mood === 'surprised') {
      // Bulge the eyes: redraw each eye region scaled up in place
      const ew = 0.2;
      for (const eye of eyes) {
        const sx = (eye.x - ew / 2) * ps, sy = (eye.y - ew / 2) * ps, sw = ew * ps, sh = ew * ps;
        const dw = ew * w * 1.55, dh = ew * h * 1.55;
        c.drawImage(photo, sx, sy, sw, sh, x0 + eye.x * w - dw / 2, y0 + eye.y * h - dh / 2, dw, dh);
      }
      // Drop the jaw: mouth region stretched tall + dark open-mouth core
      const mw = 0.3, mh = 0.16;
      const msx = (faceMap.mouth.x - mw / 2) * ps, msy = (faceMap.mouth.y - mh / 2) * ps;
      const dw = mw * w * 0.85, dh = mh * h * 2.1;
      c.drawImage(photo, msx, msy, mw * ps, mh * ps,
        x0 + faceMap.mouth.x * w - dw / 2, y0 + faceMap.mouth.y * h - dh * 0.32, dw, dh);
      c.fillStyle = 'rgba(30, 14, 8, 0.85)';
      c.beginPath();
      c.ellipse(x0 + faceMap.mouth.x * w, y0 + faceMap.mouth.y * h + dh * 0.18, w * 0.065, h * 0.085, 0, 0, Math.PI * 2);
      c.fill();
    } else if (mood === 'happy') {
      // Squinted smiling eyes: eye regions squashed vertically
      const ew = 0.18;
      for (const eye of eyes) {
        const sx = (eye.x - ew / 2) * ps, sy = (eye.y - ew / 2) * ps, sw = ew * ps, sh = ew * ps;
        const dw = ew * w * 1.15, dh = ew * h * 0.6;
        c.drawImage(photo, sx, sy, sw, sh, x0 + eye.x * w - dw / 2, y0 + eye.y * h - dh / 2 + h * 0.012, dw, dh);
      }
      // Smile: mouth strip redrawn in three slices, corners lifted
      const mw = 0.32, mh = 0.13;
      const msx = (faceMap.mouth.x - mw / 2) * ps, msy = (faceMap.mouth.y - mh / 2) * ps;
      const sliceW = (mw * ps) / 3;
      const dSliceW = (mw * w * 1.12) / 3;
      const lift = [-0.035, 0.008, -0.035];
      for (let i = 0; i < 3; i++) {
        c.drawImage(photo, msx + i * sliceW, msy, sliceW, mh * ps,
          x0 + faceMap.mouth.x * w - (dSliceW * 3) / 2 + i * dSliceW,
          y0 + (faceMap.mouth.y + lift[i]) * h - (mh * h) / 2,
          dSliceW, mh * h);
      }
    }
  }

  // Cartoon face for the default (no-selfie) pilot — same moods.
  function drawDefaultPilot(c: CanvasRenderingContext2D, cockCY: number, cockR: number, mood: Mood) {
    // helmet
    c.fillStyle = 'rgba(34, 24, 8, 0.85)';
    c.beginPath();
    c.arc(0, cockCY + 0.4, cockR * 0.62, 0, Math.PI * 2);
    c.fill();
    // face plate
    c.fillStyle = '#E8D9BC';
    c.beginPath();
    c.arc(0, cockCY + 0.6, cockR * 0.46, 0, Math.PI * 2);
    c.fill();
    const ex = cockR * 0.2, ey = cockCY + 0.25;
    c.fillStyle = '#221808';
    if (mood === 'surprised') {
      c.beginPath(); c.arc(-ex, ey, cockR * 0.12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(ex, ey, cockR * 0.12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(0, cockCY + cockR * 0.28, cockR * 0.1, cockR * 0.15, 0, 0, Math.PI * 2); c.fill();
    } else if (mood === 'happy') {
      c.strokeStyle = '#221808';
      c.lineWidth = cockR * 0.07;
      c.beginPath(); c.arc(-ex, ey + 0.02 * cockR, cockR * 0.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      c.beginPath(); c.arc(ex, ey + 0.02 * cockR, cockR * 0.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      c.beginPath(); c.arc(0, cockCY + cockR * 0.18, cockR * 0.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    } else {
      c.beginPath(); c.arc(-ex, ey, cockR * 0.07, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(ex, ey, cockR * 0.07, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#221808';
      c.lineWidth = cockR * 0.06;
      c.beginPath();
      c.moveTo(-cockR * 0.12, cockCY + cockR * 0.32);
      c.lineTo(cockR * 0.12, cockCY + cockR * 0.32);
      c.stroke();
    }
  }

  // Visible hardware for each owned upgrade — the ship literally builds
  // out as the run goes on. All drawn in ship-local units (pre-scaled).
  function drawShipModules(c: CanvasRenderingContext2D) {
    const owned = new Set(pickedUpgrades);
    const t = performance.now() / 1000;

    if (owned.has('fuel_tank')) {
      // Saddle tanks on both flanks
      for (const side of [-1, 1]) {
        c.fillStyle = '#D9C6A3';
        c.strokeStyle = '#8a6a3c';
        c.lineWidth = 0.6;
        c.beginPath();
        c.ellipse(side * 8.9, 2.6, 1.5, 3.4, side * 0.12, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }
    }
    if (owned.has('boost_thrusters')) {
      // Twin auxiliary nozzles beside the main engine
      c.fillStyle = '#221808';
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(side * 3.4, 7);
        c.lineTo(side * 5.4, 9.6);
        c.lineTo(side * 2.4, 8.6);
        c.closePath();
        c.fill();
      }
    }
    if (owned.has('magnetic_pad')) {
      // Horseshoe magnet under the belly
      c.strokeStyle = '#C97B3D';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 9.4, 2.2, Math.PI, 0);
      c.stroke();
      c.strokeStyle = '#F4EBDA';
      c.beginPath(); c.moveTo(-2.2, 9.4); c.lineTo(-2.2, 10.6); c.stroke();
      c.beginPath(); c.moveTo(2.2, 9.4); c.lineTo(2.2, 10.6); c.stroke();
    }
    if (owned.has('gyro')) {
      // Slowly spinning stabilizer ring around the midsection
      c.save();
      c.strokeStyle = 'rgba(148, 176, 61, 0.55)';
      c.lineWidth = 0.9;
      c.setLineDash([3, 4]);
      c.lineDashOffset = -t * 9;
      c.beginPath();
      c.ellipse(0, 0.5, 10.8, 3.4, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (owned.has('gravity_anchor')) {
      // Tiny anchor slung under the hull
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(0, 8.6); c.lineTo(0, 12); c.stroke();
      c.beginPath(); c.arc(0, 11.6, 1.6, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      c.beginPath(); c.arc(0, 9, 0.55, 0, Math.PI * 2); c.stroke();
    }
    if (owned.has('scanner')) {
      // Shoulder dish, tilted skyward
      c.save();
      c.translate(6.8, -9.4);
      c.rotate(-0.5);
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, 2.4); c.lineTo(0, 0.6); c.stroke();
      c.fillStyle = '#D9C6A3';
      c.beginPath(); c.ellipse(0, 0, 2.2, 0.9, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#94B03D';
      c.beginPath(); c.arc(0, -0.6, 0.5, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    if (owned.has('feather_gear')) {
      // Feather tufts on the landing struts
      c.strokeStyle = 'rgba(244, 235, 218, 0.85)';
      c.lineWidth = 0.7;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(side * (7.6 + i * 0.8), 9.4);
          c.quadraticCurveTo(side * (8.4 + i * 0.8), 8, side * (8 + i * 0.8), 6.6 + i * 0.4);
          c.stroke();
        }
      }
    }
    if (owned.has('reserve_chute')) {
      // Chute pack strapped to the left flank
      c.fillStyle = '#C97B3D';
      c.strokeStyle = '#8a4a20';
      c.lineWidth = 0.6;
      c.beginPath();
      c.ellipse(-8.7, -2.6, 1.6, 2.5, -0.15, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.strokeStyle = 'rgba(244,235,218,0.6)';
      c.beginPath(); c.moveTo(-9.8, -3.6); c.lineTo(-7.6, -1.4); c.stroke();
    }
    if (owned.has('storm_dampeners')) {
      // Vent slats on both flanks
      c.strokeStyle = '#7C8F5C';
      c.lineWidth = 0.8;
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(side * 7.6, -0.4 + i * 1.5);
          c.lineTo(side * 9.2, 0.2 + i * 1.5);
          c.stroke();
        }
      }
    }
    if (owned.has('fuel_scoop')) {
      // Intake ring on the nose
      c.strokeStyle = '#B9A480';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, -14.6, 2.6, 1, 0, 0, Math.PI * 2);
      c.stroke();
    }
    if (owned.has('precision_jets')) {
      // RCS thruster pods at four corners
      c.fillStyle = '#F4EBDA';
      for (const [px, py] of [[-6.6, -8.5], [6.6, -8.5], [-7.4, 3.6], [7.4, 3.6]] as [number, number][]) {
        c.beginPath(); c.arc(px, py, 0.7, 0, Math.PI * 2); c.fill();
      }
    }
    if (owned.has('jalapeno_injectors')) {
      // A proud little jalapeño painted on the hull
      c.save();
      c.translate(4.9, 2.4);
      c.rotate(0.5);
      c.fillStyle = '#94B03D';
      c.beginPath();
      c.ellipse(0, 0, 0.9, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#5C7642';
      c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, -2); c.lineTo(0.5, -2.9); c.stroke();
      c.restore();
    }
    if (owned.has('boomerang_hull')) {
      // Boomerang chevron across the lower hull
      c.strokeStyle = '#D9A441';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-5.4, 4);
      c.lineTo(0, 6.4);
      c.lineTo(5.4, 4);
      c.stroke();
    }
    if (owned.has('alien_diplomacy')) {
      // Embassy antenna with a softly pulsing green orb
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(-4.6, -11.4); c.lineTo(-7.2, -16.4); c.stroke();
      const pulse = 0.7 + Math.sin(t * 3) * 0.3;
      c.fillStyle = `rgba(148, 176, 61, ${pulse})`;
      c.beginPath(); c.arc(-7.2, -16.9, 1, 0, Math.PI * 2); c.fill();
    }
    if (owned.has('chrono_crystal')) {
      // A pale crystal orbiting the ship
      const oa = t * 1.4;
      const ox = Math.cos(oa) * 14.5;
      const oy = Math.sin(oa) * 14.5 - 2;
      c.save();
      c.translate(ox, oy);
      c.rotate(oa);
      c.fillStyle = 'rgba(123, 167, 199, 0.9)';
      c.beginPath();
      c.moveTo(0, -2); c.lineTo(1.2, 0); c.lineTo(0, 2); c.lineTo(-1.2, 0);
      c.closePath();
      c.fill();
      c.restore();
    }
    if (owned.has('overdrive_core')) {
      // Hot core glowing through a lower-hull porthole
      const glow = 0.55 + Math.sin(t * 5) * 0.25;
      c.fillStyle = `rgba(201, 90, 40, ${glow})`;
      c.beginPath(); c.arc(0, 3.4, 1.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#221808';
      c.lineWidth = 0.6;
      c.beginPath(); c.arc(0, 3.4, 1.5, 0, Math.PI * 2); c.stroke();
    }
    if (owned.has('phoenix_feather')) {
      // Gold feather decal
      c.save();
      c.translate(-4.9, 2.2);
      c.rotate(-0.55);
      c.strokeStyle = '#FFC94A';
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(1.4, -0.5, 0.3, -2.4); c.stroke();
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(0.45 - i * 0.1, -1.6 + i * 1.1);
        c.lineTo(-0.9, -1 + i * 1.1);
        c.stroke();
      }
      c.restore();
    }
    if (owned.has('star_core')) {
      // Four-point star twinkling at the nose
      c.save();
      c.translate(0, -16.6);
      c.rotate(t * 0.8);
      c.fillStyle = '#FFC94A';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 1.9 : 0.65;
        const a = (i / 8) * Math.PI * 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.restore();
    }
    if (stats.shieldCharges > 0) {
      // Idle shield shimmer (distinct from the impact flash)
      c.strokeStyle = 'rgba(148, 176, 61, 0.22)';
      c.lineWidth = 1;
      c.beginPath();
      c.arc(0, -1, 16.4, 0, Math.PI * 2);
      c.stroke();
    }
  }

  function drawShip() {
    const c = ctx!;
    const mood = currentMood();
    c.save();
    c.translate(ship.x, ship.y);
    c.rotate(ship.angle);
    c.scale(S, S);

    if (shieldFlash > 0) {
      c.beginPath();
      c.arc(0, -1, 17, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(148, 176, 61, 0.8)';
      c.lineWidth = 2;
      c.stroke();
    }

    // Star Core aura — a soft golden halo behind everything
    if (stats.starCore) {
      const aura = c.createRadialGradient(0, -2, 4, 0, -2, 26);
      aura.addColorStop(0, 'rgba(255, 201, 74, 0.22)');
      aura.addColorStop(1, 'rgba(255, 201, 74, 0)');
      c.fillStyle = aura;
      c.beginPath();
      c.arc(0, -2, 26, 0, Math.PI * 2);
      c.fill();
    }

    // Thrust flame FIRST (behind the hull): layered + glow.
    // Jalapeño Injectors turn the exhaust spicy-green.
    if (ship.thrusting) {
      const flicker = 6 + Math.random() * 7;
      const spicy = stats.spicyFlame;
      const glowColor = spicy ? '148, 176, 61' : '217, 164, 65';
      const glow = c.createRadialGradient(0, 10, 1, 0, 12, 16 + flicker);
      glow.addColorStop(0, `rgba(${glowColor}, 0.5)`);
      glow.addColorStop(1, `rgba(${glowColor}, 0)`);
      c.fillStyle = glow;
      c.beginPath();
      c.arc(0, 12, 16 + flicker, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(-5, 7.5);
      c.quadraticCurveTo(0, 10 + flicker * 1.6, 5, 7.5);
      c.closePath();
      c.fillStyle = spicy ? 'rgba(124, 143, 92, 0.75)' : 'rgba(201, 123, 61, 0.65)';
      c.fill();
      c.beginPath();
      c.moveTo(-2.6, 7.5);
      c.quadraticCurveTo(0, 9 + flicker, 2.6, 7.5);
      c.closePath();
      c.fillStyle = spicy ? 'rgba(224, 245, 200, 0.95)' : 'rgba(244, 235, 218, 0.95)';
      c.fill();
    }

    // Engine nozzle
    c.beginPath();
    c.ellipse(0, 7.5, 3.4, 2, 0, 0, Math.PI * 2);
    c.fillStyle = '#221808';
    c.fill();

    // Landing legs
    c.strokeStyle = '#8a6a3c';
    c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(-5.5, 5); c.lineTo(-9, 10); c.moveTo(-10.6, 10); c.lineTo(-7.4, 10); c.stroke();
    c.beginPath(); c.moveTo(5.5, 5); c.lineTo(9, 10); c.moveTo(7.4, 10); c.lineTo(10.6, 10); c.stroke();

    // Side fins
    c.fillStyle = '#7C8F5C';
    c.strokeStyle = '#3B2C16';
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-6.5, 5.5); c.lineTo(-11, 9.5); c.lineTo(-4.5, 8);
    c.closePath(); c.fill(); c.stroke();
    c.beginPath();
    c.moveTo(6.5, 5.5); c.lineTo(11, 9.5); c.lineTo(4.5, 8);
    c.closePath(); c.fill(); c.stroke();

    // Main hull — bulbous dome, big cockpit. Colors come from the
    // equipped paint job (Hangar Shop cosmetic).
    const paint = equippedPaint();
    const hullGrad = c.createLinearGradient(0, -14, 0, 8);
    hullGrad.addColorStop(0, paint.hullTop);
    hullGrad.addColorStop(1, paint.hullBot);
    c.beginPath();
    c.moveTo(0, -14);
    c.bezierCurveTo(6.5, -14, 9, -7, 8, 0);
    c.lineTo(6.5, 8);
    c.lineTo(0, 5.5);
    c.lineTo(-6.5, 8);
    c.lineTo(-8, 0);
    c.bezierCurveTo(-9, -7, -6.5, -14, 0, -14);
    c.closePath();
    c.fillStyle = hullGrad;
    c.fill();
    c.strokeStyle = paint.stroke;
    c.lineWidth = 1.4;
    c.stroke();

    // Panel lines
    c.strokeStyle = 'rgba(59, 44, 22, 0.35)';
    c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(-7.2, 1.5); c.lineTo(7.2, 1.5); c.stroke();
    c.beginPath(); c.moveTo(-6.2, 4.4); c.lineTo(6.2, 4.4); c.stroke();

    // Upgrade hardware — every owned upgrade is visible on the hull.
    drawShipModules(c);

    // Cockpit — enlarged again in v9: with ship scale up to 2.3x this is
    // a ~30px porthole, so the pilot's expressions genuinely read.
    const cockR = 6.6;
    const cockCY = -4.6;
    c.save();
    c.beginPath();
    c.ellipse(0, cockCY, cockR, cockR * 1.05, 0, 0, Math.PI * 2);
    c.clip();

    if (pilotPhoto) {
      drawPhotoFace(c, -cockR, cockCY - cockR * 1.05, cockR * 2, cockR * 2.1, mood);
    } else {
      const glassGrad = c.createRadialGradient(-1.4, cockCY - 1.6, 0.5, 0, cockCY, cockR * 1.3);
      glassGrad.addColorStop(0, '#E4F1EA');
      glassGrad.addColorStop(1, '#5B7A85');
      c.fillStyle = glassGrad;
      c.fillRect(-cockR, cockCY - cockR, cockR * 2, cockR * 2);
      drawDefaultPilot(c, cockCY, cockR, mood);
    }
    c.restore();

    // Cockpit rim + glass highlight
    c.beginPath();
    c.ellipse(0, cockCY, cockR, cockR * 1.05, 0, 0, Math.PI * 2);
    c.strokeStyle = '#221808';
    c.lineWidth = 0.9;
    c.stroke();
    c.beginPath();
    c.ellipse(-1.8, cockCY - cockR * 0.55, cockR * 0.5, cockR * 0.2, -0.4, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(244, 235, 218, 0.35)';
    c.lineWidth = 0.8;
    c.stroke();

    // Nose light
    c.beginPath();
    c.arc(0, -13.2, 1.1, 0, Math.PI * 2);
    c.fillStyle = '#94B03D';
    c.fill();

    c.restore();
  }

  function drawCritters(t: number) {
    const c = ctx!;
    for (const critter of critters) {
      const bob = Math.sin(t * 1.6 + critter.phase) * 1.1;
      c.save();
      c.translate(critter.x, critter.baseY + bob);
      c.scale(critter.facing * 1.2, 1.2);
      if (critter.kind === 'cow') {
        c.strokeStyle = '#3B2C16';
        c.lineWidth = 1.1;
        [-4, -1.6, 1.6, 4].forEach((lx) => {
          c.beginPath();
          c.moveTo(lx, 3.2);
          c.lineTo(lx, 7);
          c.stroke();
        });
        c.beginPath();
        c.ellipse(0, 0, 7, 4.4, 0, 0, Math.PI * 2);
        c.fillStyle = '#B9A480';
        c.fill();
        c.stroke();
        c.fillStyle = '#7C8F5C';
        c.beginPath(); c.ellipse(-2, -1, 1.6, 1.2, 0.4, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(3, 1, 1.3, 1, -0.3, 0, Math.PI * 2); c.fill();
        c.beginPath();
        c.ellipse(6.8, -1.5, 2.5, 2.1, 0, 0, Math.PI * 2);
        c.fillStyle = '#B9A480';
        c.fill();
        c.stroke();
        c.beginPath();
        c.moveTo(6.2, -3.3); c.lineTo(5.2, -6.2);
        c.moveTo(8.2, -3.1); c.lineTo(9.2, -6.2);
        c.strokeStyle = '#3B2C16';
        c.lineWidth = 0.7;
        c.stroke();
        c.fillStyle = '#94B03D';
        c.beginPath(); c.arc(5.2, -6.6, 0.9, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(9.2, -6.6, 0.9, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#221808';
        c.beginPath(); c.arc(7.8, -1.8, 0.55, 0, Math.PI * 2); c.fill();
      } else {
        c.beginPath();
        c.arc(0, 0, 2.8, 0, Math.PI * 2);
        c.fillStyle = '#7C8F5C';
        c.fill();
        c.strokeStyle = '#3B2C16';
        c.lineWidth = 0.7;
        c.stroke();
        c.beginPath();
        c.moveTo(-1.8, 2); c.lineTo(-2.8, 4);
        c.moveTo(1.8, 2); c.lineTo(2.8, 4);
        c.stroke();
        c.beginPath();
        c.moveTo(-1, -2.3); c.lineTo(-1.6, -4.3);
        c.moveTo(1, -2.3); c.lineTo(1.6, -4.3);
        c.stroke();
        c.fillStyle = '#94B03D';
        c.beginPath(); c.arc(-1.6, -4.6, 0.65, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(1.6, -4.6, 0.65, 0, Math.PI * 2); c.fill();
      }
      c.restore();
    }
  }

  function drawUfos() {
    const c = ctx!;
    for (const u of ufos) {
      if (!u.alive) continue;
      c.save();
      c.translate(u.x, u.y);
      c.scale(1.25, 1.25);
      if (u.telegraph > 0) {
        c.beginPath();
        c.arc(0, 4, 5 + Math.sin(performance.now() / 40) * 1.5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(201, 123, 61, 0.55)';
        c.fill();
      }
      const bodyGrad = c.createLinearGradient(0, -5, 0, 5);
      bodyGrad.addColorStop(0, '#5a4326');
      bodyGrad.addColorStop(1, '#2E2110');
      c.beginPath();
      c.ellipse(0, 0, 13, 5, 0, 0, Math.PI * 2);
      c.fillStyle = bodyGrad;
      c.fill();
      c.strokeStyle = '#94B03D';
      c.lineWidth = 1;
      c.stroke();
      c.beginPath();
      c.ellipse(0, -3, 6, 4.5, 0, Math.PI, 0);
      c.fillStyle = 'rgba(148, 176, 61, 0.45)';
      c.fill();
      c.strokeStyle = '#7C8F5C';
      c.stroke();
      for (let i = -1; i <= 1; i++) {
        c.beginPath();
        c.arc(i * 7, 1.5, 1.1, 0, Math.PI * 2);
        // Friendly (diplomacy) UFOs run green running-lights instead of amber
        c.fillStyle = stats.ufosFriendly
          ? ((Math.floor(performance.now() / 300) + i) % 2 === 0 ? '#94B03D' : '#7C8F5C')
          : ((Math.floor(performance.now() / 300) + i) % 2 === 0 ? '#D9A441' : '#C97B3D');
        c.fill();
      }
      c.restore();
    }

    for (const p of projectiles) {
      if (!p.alive) continue;
      c.beginPath();
      c.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
      c.fillStyle = '#D9A441';
      c.shadowColor = '#C97B3D';
      c.shadowBlur = 8;
      c.fill();
      c.shadowBlur = 0;
    }
  }

  function drawPad(t: number) {
    const c = ctx!;
    const pad = terrain.pad;
    const padVisible = !cfg.fog || stats.scanner;
    const w = pad.xEnd - pad.xStart;
    c.save();
    c.globalAlpha = padVisible ? 1 : 0.25;

    // Platform deck
    const deckGrad = c.createLinearGradient(0, pad.y - 4, 0, pad.y + 4);
    deckGrad.addColorStop(0, '#5a4a2a');
    deckGrad.addColorStop(1, '#33260f');
    c.fillStyle = deckGrad;
    c.fillRect(pad.xStart, pad.y - 3, w, 6);
    c.strokeStyle = '#94B03D';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(pad.xStart, pad.y - 3);
    c.lineTo(pad.xEnd, pad.y - 3);
    c.stroke();

    // Deck hatching
    c.strokeStyle = 'rgba(148,176,61,0.35)';
    c.lineWidth = 1;
    for (let x = pad.xStart + 8; x < pad.xEnd - 4; x += 14) {
      c.beginPath();
      c.moveTo(x, pad.y - 1);
      c.lineTo(x + 6, pad.y + 2);
      c.stroke();
    }

    // Blinking beacon lights on both ends
    const blink = Math.floor(t * 2) % 2 === 0;
    for (const bx of [pad.xStart + 3, pad.xEnd - 3]) {
      c.beginPath();
      c.arc(bx, pad.y - 6, 2.2, 0, Math.PI * 2);
      c.fillStyle = blink ? '#94B03D' : '#3B2C16';
      c.fill();
      if (blink && padVisible) {
        c.beginPath();
        c.arc(bx, pad.y - 6, 5, 0, Math.PI * 2);
        c.fillStyle = 'rgba(148,176,61,0.18)';
        c.fill();
      }
      c.strokeStyle = '#8a6a3c';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(bx, pad.y - 4);
      c.lineTo(bx, pad.y - 2);
      c.stroke();
    }
    c.restore();
  }

  function draw() {
    if (!ctx) return;
    const t = performance.now() / 1000;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 9 * shakeT, (Math.random() - 0.5) * 9 * shakeT);
    }

    // Sky — colors come from the equipped sky theme (Hangar Shop cosmetic)
    const skyTheme = equippedSky();
    const sky_ = ctx.createLinearGradient(0, 0, 0, height);
    sky_.addColorStop(0, skyTheme.top);
    sky_.addColorStop(0.6, skyTheme.mid);
    sky_.addColorStop(1, skyTheme.bot);
    ctx.fillStyle = sky_;
    ctx.fillRect(-10, -10, width + 20, height + 20);

    if (!terrain) { ctx.restore(); return; }

    // Stars (twinkle)
    for (const s of sky.stars) {
      const tw = 0.6 + Math.sin(t * 1.5 + s.phase) * 0.4;
      ctx.globalAlpha = s.bright * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = skyTheme.star;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Planet — sky themes can override the seeded palette
    const pl = sky.planet;
    const plHue = skyTheme.planet ?? pl.hue;
    const plGrad = ctx.createRadialGradient(pl.x - pl.r * 0.35, pl.y - pl.r * 0.35, pl.r * 0.15, pl.x, pl.y, pl.r);
    plGrad.addColorStop(0, plHue[0]);
    plGrad.addColorStop(1, plHue[1]);
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    ctx.fillStyle = plGrad;
    ctx.fill();
    if (pl.ring) {
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, pl.r * 1.6, pl.r * 0.38, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(185, 164, 128, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Background ridge silhouette
    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.ridge.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = '#20170c';
    ctx.fill();

    // Terrain
    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    const groundGrad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    groundGrad.addColorStop(0, '#3B2C16');
    groundGrad.addColorStop(1, '#221808');
    ctx.fillStyle = groundGrad;
    ctx.fill();
    ctx.strokeStyle = '#4a3620';
    ctx.lineWidth = 2;
    ctx.beginPath();
    terrain.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // Surface texture: sparse short strokes following the ground
    ctx.strokeStyle = 'rgba(74, 54, 32, 0.5)';
    ctx.lineWidth = 1;
    const texRand = mulberry32(cfg.seed * 77 + 1);
    for (let i = 0; i < 26; i++) {
      const x = texRand() * width;
      const y = terrainYAt(terrain.points, x) + 6 + texRand() * 26;
      if (y > height - 4) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 4 + texRand() * 8, y + (texRand() - 0.5) * 3);
      ctx.stroke();
    }

    drawCritters(t);
    drawPad(t);

    // Asteroids
    if (cfg.asteroids > 0) {
      const rand = mulberry32(cfg.seed * 71);
      for (let i = 0; i < cfg.asteroids; i++) {
        const baseX = rand() * width;
        const baseY = height * (0.15 + rand() * 0.35);
        const r = (10 + rand() * 12) * Math.min(1.25, S);
        const ax = baseX + Math.sin(t * 0.4 + i) * 60;
        const ay = baseY + Math.cos(t * 0.3 + i * 2) * 20;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, Math.PI * 2);
        ctx.fillStyle = '#5a4326';
        ctx.fill();
        ctx.strokeStyle = '#7C8F5C';
        ctx.lineWidth = 1;
        ctx.stroke();
        // craters
        ctx.fillStyle = 'rgba(34, 24, 8, 0.5)';
        ctx.beginPath(); ctx.arc(ax - r * 0.3, ay - r * 0.2, r * 0.22, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ax + r * 0.35, ay + r * 0.3, r * 0.15, 0, Math.PI * 2); ctx.fill();

        if (state === 'playing' && Math.hypot(ship.x - ax, ship.y - ay) < r + 8 * S) {
          if (stats.shieldCharges > 0) {
            stats.shieldCharges -= 1;
            shieldFlash = 0.5;
            ship.vx *= -0.5; ship.vy *= -0.5;
          } else {
            destroyShip();
          }
        }
      }
    }

    drawUfos();

    // Particles
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ship
    if (state === 'playing' || state === 'levelComplete') drawShip();

    // Fog overlay — v9 fairness rework. The old fog was a near-black wall
    // with a small hole ("unviewable"). Now: a lighter veil, a much bigger
    // visibility bubble, the terrain silhouette stays faintly readable
    // through it, and the pad's beacons pulse through the murk so you
    // always have SOMETHING to navigate by. Scanner still trivializes it.
    if (cfg.fog) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,7,4,0.74)';
      ctx.fillRect(0, 0, width, height);
      const fogR = 240 + (S - 1) * 110;
      const grad = ctx.createRadialGradient(ship.x, ship.y, 50, ship.x, ship.y, fogR);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Terrain outline ghosting through the fog
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#4a3620';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      terrain.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();

      // Pad beacons pulse through the fog
      const blinkOn = Math.floor(t * 2) % 2 === 0;
      if (blinkOn) {
        for (const bx of [terrain.pad.xStart + 3, terrain.pad.xEnd - 3]) {
          const bg = ctx.createRadialGradient(bx, terrain.pad.y - 6, 1, bx, terrain.pad.y - 6, 26);
          bg.addColorStop(0, 'rgba(148,176,61,0.5)');
          bg.addColorStop(1, 'rgba(148,176,61,0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(bx, terrain.pad.y - 6, 26, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Chrono Crystal bullet-time: cool-toned vignette + indicator
    if (slowmoActive) {
      ctx.save();
      const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.85);
      vg.addColorStop(0, 'rgba(123, 167, 199, 0)');
      vg.addColorStop(1, 'rgba(123, 167, 199, 0.16)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${Math.max(11, Math.round(width / 68))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(123, 167, 199, 0.9)';
      ctx.fillText('⌛ chrono', width - 12, height - 12);
      ctx.restore();
    }

    // Phoenix revive flash — golden wash fading out
    if (phoenixFlashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, phoenixFlashT * 0.7);
      ctx.fillStyle = '#FFC94A';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Scanner guidance — above the fog so it punches through it
    if (stats.scanner && state === 'playing') {
      const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      ctx.save();
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = 'rgba(148,176,61,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y);
      ctx.lineTo(padCx, terrain.pad.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(148,176,61,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padCx - 6, terrain.pad.y - 15);
      ctx.lineTo(padCx, terrain.pad.y - 8);
      ctx.lineTo(padCx + 6, terrain.pad.y - 15);
      ctx.stroke();
      ctx.restore();
    }

    // Wind indicator
    if ((cfg.wind > 0 || cfg.windGust > 0) && state === 'playing') {
      const w = currentWind(cfg, windPhase) * stats.windMult;
      const mag = Math.abs(w);
      if (mag > 1.5) {
        const arrows = (w > 0 ? '→' : '←').repeat(Math.min(3, Math.max(1, Math.round(mag / 12))));
        ctx.save();
        ctx.font = `${Math.max(11, Math.round(width / 68))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(185,164,128,0.85)';
        ctx.fillText(`wind ${arrows}`, width / 2, 20);
        ctx.restore();
      }
    }

    // Level intro banner
    if (introT > 0 && state === 'playing') {
      const a = introT > 1.9 ? (2.4 - introT) / 0.5 : introT < 0.7 ? introT / 0.7 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(15, Math.round(width / 34))}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = '#F4EBDA';
      ctx.fillText(`Level ${levelIndex + 1} — ${cfg.name}`, width / 2, height * 0.3);
      ctx.font = `${Math.max(10, Math.round(width / 72))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#B9A480';
      const tags: string[] = [];
      if (cfg.movingPad) tags.push('moving pad');
      if (cfg.fog) tags.push('fog');
      if (cfg.asteroids) tags.push('debris');
      if (cfg.ufos) tags.push('hostiles');
      if (cfg.wind > 8) tags.push('wind');
      if (tags.length) ctx.fillText(tags.join(' · '), width / 2, height * 0.3 + Math.max(20, width / 34));
      ctx.restore();
    }

    ctx.restore();

    // Toast queue (achievements, stardust payouts) — drawn unshaken, top center
    toasts.slice(0, 4).forEach((toast, i) => {
      const alpha = Math.min(1, toast.t / 0.5) * Math.min(1, (4.4 - toast.t) * 2.4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.95;
      ctx.font = `${Math.max(12, Math.round(width / 60))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(toast.text).width;
      const ty = 38 + i * (Math.max(12, Math.round(width / 60)) + 16);
      ctx.fillStyle = 'rgba(23, 16, 9, 0.85)';
      ctx.fillRect(width / 2 - tw / 2 - 12, ty - 15, tw + 24, 24);
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - tw / 2 - 12, ty - 15, tw + 24, 24);
      ctx.fillStyle = '#F4EBDA';
      ctx.fillText(toast.text, width / 2, ty + 2);
      ctx.restore();
    });
  }

  function updateHud() {
    if (!hud.fuel) return;
    hud.fuel.textContent = `${Math.round(ship.fuel)}`;
    if (hud.fuelBar) hud.fuelBar.style.width = `${Math.max(0, Math.min(100, (ship.fuel / stats.maxFuel) * 100))}%`;
    hud.altitude.textContent = terrain ? `${Math.max(0, Math.round(terrainYAt(terrain.points, ship.x) - ship.y))}m` : '—';
    const speed = Math.hypot(ship.vx, ship.vy);
    hud.speed.textContent = `${Math.round(speed)}`;
    hud.speed.style.color = speed < stats.landingSpeedTol ? '#94B03D' : '#C97B3D';
    hud.level.textContent = `${levelIndex + 1} — ${cfg?.name ?? ''}`;
    if (hud.best) hud.best.textContent = `${bestFor(difficulty) || '—'}`;
    if (hud.stardust) hud.stardust.textContent = `${stardust}`;
  }

  // --- Main loop ---
  let lastT = performance.now();
  let raf = 0;
  function loop(t: number) {
    const dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  function onOrientation() {
    setTimeout(resize, 150);
  }
  window.addEventListener('orientationchange', onOrientation);
  applySound();
  showStartScreen();
  raf = requestAnimationFrame(loop);

  return function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', onOrientation);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    audio.stopThrust();
    music.stop();
    stopCameraStream();
  };
}
