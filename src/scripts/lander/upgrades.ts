import type { AchievementDef, PaintDef, SkyDef, TrailDef, UpgradeDef } from './types';

// Every upgrade is net-positive, but nothing is free: extra hardware has
// weight (gravity), power draw (fuel burn), or handling costs. Clamps in
// computeStats() keep stacked drawbacks from ever making the ship unflyable.
export const UPGRADES: UpgradeDef[] = [
  // --- common: reliable bread-and-butter (15: 5 existing + 10 new) ---
  { id: 'fuel_tank',       rarity: 'common',    name: 'Extra Fuel Tank',  icon: '⛽', pro: '+45 max fuel, refills now',                 con: 'Heavier — gravity +6%', desc: "Carry more fuel every level, but the tank makes you heavier.", },
  { id: 'gyro',            rarity: 'common',    name: 'Gyro Stabilizer',  icon: '🌀', pro: 'Much more forgiving landing angle',         con: 'Power draw — fuel burns 8% faster', desc: "Tilted landings are forgiven much more — fuel burns a bit faster.", },
  { id: 'precision_jets',  rarity: 'common',    name: 'Precision Jets',   icon: '🚀', pro: 'Rotate 40% faster',                         con: 'Jets sip fuel — burn +6%', desc: "Turn quicker. Costs a little extra fuel.", },
  { id: 'magnetic_pad',    rarity: 'common',    name: 'Magnetic Grapple', icon: '🧲', pro: 'Wider catch zone, +15% landing tolerance',  con: 'Magnet weight — gravity +4%', desc: "The pad catches you more easily, but the magnet weighs you down.", },
  { id: 'feather_gear',    rarity: 'common',    name: 'Feather Gear',     icon: '🪶', pro: 'Land 30% harder safely',                    con: 'Lightweight — wind pushes 20% more', desc: "Land harder without crashing — but wind pushes you around more.", },
  { id: 'lightweight_alloy', rarity: 'common',  name: 'Lightweight Alloy', icon: '🧱', pro: 'mass −0.05 (floor §4.5)',                  con: 'speed tol ×0.96', desc: "Lighter ship, easier to fly — but land a touch softer.", },
  { id: 'wide_legs',       rarity: 'common',    name: 'Wide-Stance Legs', icon: '🦿', pro: 'angle tolerance +0.10 rad',                 con: 'mass +0.03', desc: "Land at steeper angles safely. Slightly heavier.", },
  { id: 'fuel_lines',      rarity: 'common',    name: 'Slick Fuel Lines', icon: '🧪', pro: 'burn ×0.93',                                con: 'thrust ×0.96', desc: "Fuel lasts longer, but the engine pushes a little less.", },
  { id: 'bumper_skids',    rarity: 'common',    name: 'Bumper Skids',     icon: '🛷', pro: 'speed tol ×1.12',                           con: 'rotation ×0.95', desc: "Land faster without crashing, but you turn a bit slower.", },
  { id: 'trim_flaps',      rarity: 'common',    name: 'Trim Flaps',       icon: '🪁', pro: 'wind ×0.85',                                con: 'burn ×1.04', desc: "Wind bothers you less. Burns slightly more fuel.", },
  { id: 'solar_wings',     rarity: 'common',    name: 'Solar Wings',      icon: '☀️', pro: '+1.5 fuel/s regen (engines off)',           con: 'dragArea +0.06', desc: "Fuel slowly refills while your engine is off — the wings catch more wind.", },
  { id: 'landing_lights',  rarity: 'common',    name: 'Landing Lights',   icon: '🔦', pro: 'below 150 m: pad arrow + touchdown marker', con: 'max fuel −5', desc: "Near the ground, an arrow shows where you will touch down. Slightly smaller tank.", },
  { id: 'sticky_pads',     rarity: 'common',    name: 'Sticky Landing Pads', icon: '🥾', pro: 'horizontal speed forgiven ×1.2 on pad',  con: 'mass +0.03', desc: "Sliding sideways onto the pad is forgiven more. Slightly heavier.", },
  { id: 'nimble_fins',     rarity: 'common',    name: 'Nimble Fins',      icon: '🐟', pro: 'rotation ×1.15',                            con: 'wind ×1.08', desc: "Turn faster, but wind pushes you more.", },
  { id: 'drop_tanks',      rarity: 'common',    name: 'Drop Tanks',       icon: '🛢️', pro: '+20 max fuel; tanks visibly jettison at half fuel', con: 'mass +0.04 (0 after jettison)', desc: "Extra fuel in tanks that drop off when half-used. A little heavy until then.", },
  // --- uncommon: build-shapers (15: 5 existing + 10 new) ---
  { id: 'boost_thrusters', rarity: 'uncommon',  name: 'Boost Thrusters',  icon: '🔥', pro: '+40% thrust power',                        con: 'Burns fuel 15% faster', desc: "Much stronger engine, but it drinks fuel faster.", },
  { id: 'scanner',         rarity: 'uncommon',  name: 'Scanner',          icon: '📡', pro: 'Guidance line pointing straight to the pad', con: 'Housing costs 10 max fuel', desc: "A line always points straight to the pad. Costs some tank space.", },
  { id: 'reserve_chute',   rarity: 'uncommon',  name: 'Reserve Chute',    icon: '🪂', pro: 'Auto-brakes once per level if tank runs dry', con: 'Chute pack — gravity +4%', desc: "If you run out of fuel, a chute slows you once per level. Slightly heavier.", },
  { id: 'fuel_scoop',      rarity: 'uncommon',  name: 'Fuel Scoop',       icon: '♻️', pro: 'Regain 3 fuel/s while engines are off',     con: 'Scoop replaces 15 max fuel', desc: "Refuel while your engine is off, but the tank is smaller.", },
  { id: 'storm_dampeners', rarity: 'uncommon',  name: 'Storm Dampeners',  icon: '🌬️', pro: 'Wind pushes you 50% less',                  con: 'Vents bleed 8% thrust', desc: "Wind pushes you half as much — engine slightly weaker.", },
  { id: 'air_brakes',      rarity: 'uncommon',  name: 'Air Brakes',       icon: '🛑', pro: 'hold L+R: damp velocity 20%/s (×n)',        con: '3 fuel/s while braking', desc: "Hold both turn keys to slow down fast. Braking costs fuel.", },
  { id: 'kick_thrusters',  rarity: 'uncommon',  name: 'Kick Thrusters',   icon: '🦵', pro: 'double-tap L/R: 60 px/s sideways impulse (×n)', con: '4 fuel per kick', desc: "Double-tap left or right for a quick sideways dodge. Each kick costs fuel.", },
  { id: 'tractor_winch',   rarity: 'uncommon',  name: 'Pad Tractor Winch', icon: '🪝', pro: 'below 100 m, gentle pull toward pad center (8 px/s² ×n)', con: 'mass +0.05', desc: "Near the ground, the pad gently pulls you toward its center. Slightly heavier.", },
  { id: 'cloud_seeder',    rarity: 'uncommon',  name: 'Cloud Seeder',     icon: '🌧️', pro: 'gust amplitude ×0.4',                       con: 'thrust ×0.95', desc: "Gusts get much calmer. Engine slightly weaker.", },
  { id: 'vampire_coils',   rarity: 'uncommon',  name: 'Vampire Coils',    icon: '🧛', pro: 'projectile passing within 30 px: +8 fuel (graze)', con: 'projectile speed ×1.1', desc: "Enemy shots that barely miss you give you fuel — but shots fly faster.", },
  { id: 'lucky_antenna',   rarity: 'uncommon',  name: 'Lucky Antenna',    icon: '🍀', pro: '+1 upgrade choice per offer (×n, max 6 cards rendered)', con: 'max fuel −5', desc: "One extra card to choose from after each landing. Slightly smaller tank.", },
  { id: 'stardust_condenser', rarity: 'uncommon', name: 'Stardust Condenser', icon: '✨', pro: 'stardust payouts ×1.3',                 con: 'mass +0.04', desc: "Earn more stardust from everything. Slightly heavier.", },
  { id: 'echo_altimeter',  rarity: 'uncommon',  name: 'Echo Altimeter',   icon: '🦇', pro: 'touchdown-point forecast marker + landing-speed readout', con: 'burn ×1.05', desc: "Shows where you will land and how fast you are falling. Burns a bit more fuel.", },
  { id: 'gecko_struts',    rarity: 'uncommon',  name: 'Gecko Struts',     icon: '🦎', pro: '+1 charge/level: safe landing on any ≤0.35 rad slope (no level-complete, half stardust, refuels +15)', con: 'mass +0.05', desc: "Once per level, safely stick to a gentle slope and top up fuel. Slightly heavier.", },
  { id: 'bounce_bumpers',  rarity: 'uncommon',  name: 'Bounce Bumpers',   icon: '🎈', pro: 'screen-edge bounces lossless + outward boost', con: 'dragArea +0.05', desc: "Screen edges bounce you back with a boost. Catches a bit more wind.", },
  // --- rare: run-changers with personality (15: 5 existing + 10 new) ---
  { id: 'shield',          rarity: 'rare',      name: 'Shield',           icon: '🛡️', pro: 'Survive one impact (recharges each level)', con: 'Plating — gravity +6%', desc: "Survive one crash per level. The plating makes you heavier.", },
  { id: 'gravity_anchor',  rarity: 'rare',      name: 'Gravity Anchor',   icon: '⚓', pro: 'Gravity pulls 15% less',                   con: 'Sluggish — rotation 12% slower', desc: "You fall slower, but you also turn slower.", },
  { id: 'jalapeno_injectors', rarity: 'rare',   name: 'Jalapeño Injectors', icon: '🌶️', pro: '+30% thrust, exhaust burns spicy-green',  con: 'Spicy fuel burns 12% faster', desc: "Spicy fuel: much stronger engine, burns noticeably faster.", },
  { id: 'boomerang_hull',  rarity: 'rare',      name: 'Boomerang Hull',   icon: '🪃', pro: 'Bounce off terrain instead of crashing (1/level)', con: 'Each bounce shakes out 15 fuel', desc: "Bounce off the ground instead of crashing, once per level — each bounce spills fuel.", },
  { id: 'alien_diplomacy', rarity: 'rare',      name: 'Alien Embassy Plates', icon: '👽', pro: 'UFOs recognize you and hold fire',      con: 'Ceremonial plating — gravity +5%', desc: "UFOs stop shooting at you. The ceremonial plating is heavy.", },
  { id: 'spaghetti_engine', rarity: 'rare',     name: 'Spaghetti Engine', icon: '🍝', pro: 'exhaust drops noodles that pile on terrain; piles ≥8 px turn fatal terrain hits into soft squish landings (§6.1)', con: 'burn ×1.10', desc: "Your exhaust drops noodles that pile up and cushion crashes. Burns more fuel.", },
  { id: 'grappling_hook',  rarity: 'rare',      name: 'Grappling Hook',   icon: '🪝', pro: 'ability (§6.2): fire hook at pad within 240 px, winch at 90 px/s; 1 charge/level (+1 per stack)', con: 'max fuel −10', desc: "Press down near the pad to hook on and reel yourself in. Smaller tank.", },
  { id: 'hover_module',    rarity: 'rare',      name: 'Hover Module',     icon: '🛸', pro: 'below 60 m, auto-limit descent to 40 px/s while fuel lasts', con: '6 fuel/s while hovering', desc: "Near the ground, the ship slows your fall automatically — hovering costs fuel.", },
  { id: 'asteroid_miner',  rarity: 'rare',      name: 'Asteroid Miner',   icon: '⛏️', pro: 'asteroid contact shatters it: +10 fuel, small kick, +10✨', con: 'shatter kick 60 px/s random', desc: "Hitting an asteroid breaks it and gives you fuel — with a random shove.", },
  { id: 'ufo_hacker',      rarity: 'rare',      name: 'UFO Hacker',       icon: '📶', pro: 'first UFO each level becomes an ally that shoots other UFOs (×n UFOs)', con: 'max fuel −8', desc: "The first UFO each level switches sides and fights for you. Smaller tank.", },
  { id: 'bubble_wrap',     rarity: 'rare',      name: 'Bubble Wrap Hull', icon: '🫧', pro: '+1 charge/level: fatal impact → huge slow bounce (vy ×−0.4, capped 80)', con: 'dragArea +0.08', desc: "Once per level, a deadly crash becomes a big soft bounce. Catches more wind.", },
  { id: 'magnet_storm',    rarity: 'rare',      name: 'Deflector Coils',  icon: '🧲', pro: 'projectiles curve away (120 px/s² repulsion within 90 px, ×n)', con: 'rotation ×0.92', desc: "Enemy shots curve away from you. You turn slightly slower.", },
  { id: 'tailwind_turbine', rarity: 'rare',     name: 'Tailwind Turbine', icon: '🌀', pro: '+1 fuel/s per 10 wind speed (×n)',          con: 'wind ×1.1', desc: "Windy levels feed you fuel — but the wind blows harder.", },
  { id: 'moon_cheese_drill', rarity: 'rare',    name: 'Cheese Drill',     icon: '🧀', pro: '+1 charge/level: touchdown anywhere drills +15 fuel (no level-complete)', con: 'mass +0.05', desc: "Once per level, touch down anywhere to drill up extra fuel. Slightly heavier.", },
  { id: 'swarm_drones',    rarity: 'rare',      name: 'Swarm Drones',     icon: '🐝', pro: '+1 orbiting drone; each blocks 1 projectile/level (§6.3)', con: 'burn ×1.06', desc: "A drone orbits you and blocks one shot per level. Burns a bit more fuel.", },
  // --- epic: bend the rules (12: 2 existing + 10 new) ---
  { id: 'chrono_crystal',  rarity: 'epic',      name: 'Chrono Crystal',   icon: '⏳', pro: 'Time slows 25% below 120m altitude',        con: 'Fuel still drains at full speed', desc: "Time slows down near the ground — but fuel drains at full speed.", },
  { id: 'overdrive_core',  rarity: 'epic',      name: 'Overdrive Core',   icon: '🧨', pro: '+55% thrust, +20% rotation',               con: 'Guzzler — fuel burn +22%', desc: "Way more power and faster turning. Guzzles fuel.", },
  { id: 'wormhole_pocket', rarity: 'epic',      name: 'Wormhole Pocket',  icon: '🕳️', pro: 'ability: teleport 80 px toward pad (+80 per stack); 1 charge/level', con: '12 fuel per jump', desc: "Press down to teleport toward the pad, once per level. Each jump costs fuel.", },
  { id: 'gravity_flip',    rarity: 'epic',      name: 'Gravity Flip Coil', icon: '🙃', pro: 'hold L+R 1 s: gravity reverses 2 s (cooldown 8 s; duration +1 s per stack)', con: 'burn ×1.10', desc: "Hold both turn keys to briefly fall upward. Burns more fuel.", },
  { id: 'midas_hull',      rarity: 'epic',      name: 'Midas Hull',       icon: '🏆', pro: 'stardust payouts ×3 (compounds)',           con: 'mass +0.08', desc: "Triple stardust from everything. Noticeably heavier.", },
  { id: 'quantum_duplicate', rarity: 'epic',    name: 'Quantum Duplicate', icon: '👯', pro: 'on fatal crash: 50% chance the ghost crashed instead (per stack: independent extra roll)', con: 'max fuel −15', desc: "A fatal crash has a coin-flip chance of hitting your ghost twin instead. Smaller tank.", },
  { id: 'storm_caller',    rarity: 'epic',      name: 'Storm Caller',     icon: '⛈️', pro: 'wind always blows toward the pad',          con: 'wind strength ×1.25', desc: "The wind always blows you toward the pad — but it blows harder.", },
  { id: 'time_bank',       rarity: 'epic',      name: 'Time Bank',        icon: '⏱️', pro: 'ability: 3 s of 0.5× slow-mo on demand (+3 s bank per stack), recharges each level', con: 'fuel drains at real time during', desc: "Press down for a few seconds of slow motion, refilled each level. Fuel drains at normal speed.", },
  { id: 'terraformer',     rarity: 'epic',      name: 'Terraformer',      icon: '🚜', pro: 'below 40 m, smooths terrain beneath ship (§6.4; radius +40% per stack)', con: 'burn ×1.12', desc: "Near the ground, the terrain beneath you flattens itself. Burns more fuel.", },
  { id: 'singularity_anchor', rarity: 'epic',   name: 'Singularity Anchor', icon: '🌑', pro: 'ability: freeze all hazards 4 s/level (+2 s per stack)', con: 'max fuel −12', desc: "Press down to freeze every hazard for a few seconds each level. Smaller tank.", },
  { id: 'nano_repair',     rarity: 'epic',      name: 'Nano-Repair Swarm', icon: '🔧', pro: 'every 20 s airborne, +1 shield charge (max bank = stacks)', con: 'burn ×1.08', desc: "Stay airborne long enough and repairs grant you a spare shield. Burns a bit more fuel.", },
  { id: 'rocket_skates',   rarity: 'epic',      name: 'Rocket Skates',    icon: '🛼', pro: 'too-fast-but-level pad landings convert to a slide-to-stop along the pad (speed tol ×2 if angle < tol/2)', con: 'effective pad width ×0.9', desc: "Come in too fast but level? You slide along the pad to a stop. The pad is effectively narrower.", },
  // --- legendary: an event (12: 2 existing + 10 new) ---
  { id: 'phoenix_feather', rarity: 'legendary', name: 'Phoenix Feather',  icon: '🐦‍🔥', pro: 'Rise from one crash per run (60% fuel)',   con: 'The feather nests in the tank — max fuel −10', desc: "Rise from one crash per run with most of your fuel. Slightly smaller tank.", },
  { id: 'star_core',       rarity: 'legendary', name: 'Star Core',        icon: '🌟', pro: 'EVERYTHING +12%, gravity −8%',              con: 'Your glow draws 20% faster UFO fire', desc: "Everything about your ship gets better — but UFOs shoot at you more often.", },
  { id: 'black_hole_engine', rarity: 'legendary', name: 'Black Hole Engine', icon: '⚫', pro: 'thrust costs zero fuel below 25% tank',   con: 'mass +0.12', desc: "Below a quarter tank, thrusting costs no fuel at all. Very heavy.", },
  { id: 'golden_goose',    rarity: 'legendary', name: 'Golden Goose',     icon: '🪿', pro: '+50✨ per landing (×n)',                    con: 'mass +0.06', desc: "A big pile of stardust after every landing. Slightly heavy.", },
  { id: 'cosmic_dice',     rarity: 'legendary', name: 'Cosmic Dice',      icon: '🎲', pro: 'each level: one random stat ×2 (shown in intro banner)', con: 'same roll: another stat ×0.5', desc: "Each level, one random stat doubles and another is cut in half.", },
  { id: 'dyson_sail',      rarity: 'legendary', name: 'Dyson Sail',       icon: '⛵', pro: '+4 fuel/s regen ALWAYS (even thrusting)',    con: 'dragArea +0.20', desc: "Fuel constantly refills, even while thrusting — the huge sail catches lots of wind.", },
  { id: 'pocket_moon',     rarity: 'legendary', name: 'Pocket Moon',      icon: '🌖', pro: 'orbiting moonlet permanently blocks projectiles & shatters asteroids it touches', con: 'sinusoidal tug ±10 px/s²', desc: "A tiny moon orbits you, blocking shots and smashing asteroids — its pull tugs you around.", },
  { id: 'valkyrie_autopilot', rarity: 'legendary', name: 'Valkyrie Autopilot', icon: '🤖', pro: 'ability, 1/run (+1 per stack): full auto perfect landing from any state', con: 'max fuel −20', desc: "Once per run, press down and the ship lands itself perfectly. Smaller tank.", },
  { id: 'star_forge',      rarity: 'legendary', name: 'Star Forge',       icon: '🌠', pro: 'rarity weights ×2 toward rare+ in all future offers (compounds)', con: 'max fuel −10', desc: "Rare and better cards show up far more often from now on. Slightly smaller tank.", },
  { id: 'antigrav_paint',  rarity: 'legendary', name: 'Antigrav Paint',   icon: '🎨', pro: 'gravity coupling ×0.8',                     con: 'rotation ×0.9', desc: "Special paint makes you fall slower — turning is a bit slower.", },
  { id: 'mothership_favor', rarity: 'legendary', name: "Mothership's Favor", icon: '👑', pro: '+1 friendly escort UFO that shoots asteroids & hostile UFOs', con: 'sky gets +1 (friendly) UFO of crowding', desc: "A friendly UFO escorts you and shoots down hazards. The sky gets more crowded.", },
  { id: 'big_crunch',      rarity: 'legendary', name: 'Big Crunch Drive', icon: '🌌', pro: 'each landing advances 2 levels (rewards for both)', con: 'you face the harder config immediately', desc: "Every landing skips ahead two levels, with rewards for both — danger ramps twice as fast.", },
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
  // lander-v10 commit 4a (§6.1/§7): noodle-pile squish-landing achievement.
  // Reachable in this commit whenever noodlePile has height (currently only
  // possible if a future upgrade sets noodleStacks — added now since the
  // touchdown code path that unlocks it lives in this commit).
  { id: 'ach_pasta', icon: '🍝', name: 'Soft Landing',          desc: 'Survive a fatal impact via a noodle pile squish' },
  // lander-v10 commit 4b (§7): 6 new achievements from the 69-upgrade catalog.
  { id: 'ach_hoarder2',   icon: '🐉', name: "Dragon's Hoard",    desc: 'Carry 20 upgrades at once' },
  { id: 'ach_stack5',     icon: '🧬', name: 'Mono-Build',        desc: 'Stack 5 copies of one upgrade' },
  { id: 'ach_dice',       icon: '🎲', name: 'Roll the Bones',    desc: 'Land with Cosmic Dice active' },
  { id: 'ach_autopilot',  icon: '🤖', name: 'Hands Off',         desc: 'Land via Valkyrie Autopilot' },
  { id: 'ach_crunch',     icon: '🌌', name: 'Big Crunch',        desc: 'Reach level 15 with Big Crunch Drive' },
  { id: 'ach_skip3',      icon: '🚶', name: 'Purist',            desc: 'Skip 3 upgrade offers in one run' },
];
