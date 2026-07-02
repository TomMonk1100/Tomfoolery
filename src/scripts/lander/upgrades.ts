import type { AchievementDef, PaintDef, SkyDef, TrailDef, UpgradeDef } from './types';

// Every upgrade is net-positive, but nothing is free: extra hardware has
// weight (gravity), power draw (fuel burn), or handling costs. Clamps in
// computeStats() keep stacked drawbacks from ever making the ship unflyable.
export const UPGRADES: UpgradeDef[] = [
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

export const PAINTS: PaintDef[] = [
  { id: 'paint_classic',  name: 'Classic Cream',  price: 0,    hullTop: '#F4EBDA', hullBot: '#D9C6A3', stroke: '#C97B3D' },
  { id: 'paint_midnight', name: 'Midnight Iron',  price: 250,  hullTop: '#B8C4D4', hullBot: '#5E6B7E', stroke: '#7BA7C7' },
  { id: 'paint_jalapeno', name: 'Jalapeño Fresh', price: 250,  hullTop: '#D9E8B8', hullBot: '#7C8F5C', stroke: '#94B03D' },
  { id: 'paint_copper',   name: 'Sunset Copper',  price: 350,  hullTop: '#F0C8A0', hullBot: '#C97B3D', stroke: '#8a4a20' },
  { id: 'paint_violet',   name: 'Royal Violet',   price: 500,  hullTop: '#D8C4E8', hullBot: '#9B6BB3', stroke: '#B07BD6' },
  { id: 'paint_gold',     name: 'Gold Standard',  price: 1500, hullTop: '#FFE9B0', hullBot: '#D9A441', stroke: '#FFC94A' },
];

export const TRAILS: TrailDef[] = [
  { id: 'trail_ember',    name: 'Ember',        price: 0,    colors: ['#D9A441', '#C97B3D'] },
  { id: 'trail_verdant',  name: 'Verdant',      price: 200,  colors: ['#94B03D', '#7C8F5C'] },
  { id: 'trail_ice',      name: 'Glacier',      price: 300,  colors: ['#A8D8E8', '#7BA7C7'] },
  { id: 'trail_violet',   name: 'Ultraviolet',  price: 400,  colors: ['#C9A0E8', '#B07BD6'] },
  { id: 'trail_rainbow',  name: 'Prism',        price: 800,  colors: 'rainbow' },
  { id: 'trail_stardust', name: 'Stardust',     price: 1000, colors: 'stardust' },
];

export const SKIES: SkyDef[] = [
  { id: 'sky_hearthwood', name: 'Hearthwood',     price: 0,   top: '#191008', mid: '#15100a', bot: '#100d09', star: '#F4EBDA' },
  { id: 'sky_bloodmoon',  name: 'Blood Moon',     price: 400, top: '#241010', mid: '#1a0d0d', bot: '#120a0a', star: '#F4D8D8', planet: ['#a04a30', '#401812'] },
  { id: 'sky_emerald',    name: 'Emerald Nebula', price: 400, top: '#0e1a12', mid: '#0d150e', bot: '#0a100b', star: '#D8F4DD', planet: ['#4a7c5a', '#16301e'] },
  { id: 'sky_void',       name: 'The Deep Void',  price: 700, top: '#0a0a12', mid: '#08080e', bot: '#06060a', star: '#E8E8FF', planet: ['#3a3a5a', '#12121f'] },
];

export const ACHIEVEMENTS: AchievementDef[] = [
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
  // lander-v10 commit 3 (§5.3): skip option achievement.
  { id: 'ach_minimalist', icon: '🪶', name: 'Featherweight',     desc: 'Clear level 5 with zero upgrades installed' },
];
