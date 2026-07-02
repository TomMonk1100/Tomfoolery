import type { Difficulty, Rarity, ShipStats, UpgradeId } from './types';

export const RARITY: Record<Rarity, { label: string; color: string; weight: number }> = {
  common:    { label: 'common',    color: '#B9A480', weight: 100 },
  uncommon:  { label: 'uncommon',  color: '#94B03D', weight: 55 },
  rare:      { label: 'rare',      color: '#7BA7C7', weight: 22 },
  epic:      { label: 'epic',      color: '#B07BD6', weight: 9 },
  legendary: { label: 'legendary', color: '#FFC94A', weight: 3.5 },
};

const DIFF_MODS: Record<Difficulty, { grav: number; wind: number; pad: number; hazard: number; tol: number; label: string; icon: string; blurb: string }> = {
  cadet: { grav: 0.85, wind: 0.7,  pad: 1.25, hazard: 0.6, tol: 1.15, label: 'Cadet', icon: '🟢', blurb: 'gentler gravity, wider pads' },
  pilot: { grav: 1,    wind: 1,    pad: 1,    hazard: 1,   tol: 1,    label: 'Pilot', icon: '🟡', blurb: 'the intended experience' },
  ace:   { grav: 1.12, wind: 1.25, pad: 0.85, hazard: 1.3, tol: 0.95, label: 'Ace',   icon: '🔴', blurb: 'heavy, gusty, unforgiving' },
};

export { DIFF_MODS };

// --- Ship stats derived from picked upgrades ------------------------------------
//
// lander-v10 commit 2 (§4.5): the old hard gameplay caps below have been
// replaced with numerical-stability FLOORS. They no longer clamp stacking
// down to some "max useful" value — they only guarantee the sim stays
// finite and the ship stays theoretically controllable in the limit.
//
// lander-v10 commit 3 (§5.1): infinite stacking. `picked` already contains
// one entry per pick (duplicates included), so this loop already applied
// each multiplicative/additive/charge effect once per stack — that part of
// the "compound forever" requirement was structurally free. What Commit 3
// actually changes:
//   - Multiplicative/additive/charge stats: unchanged formulas (they already
//     compound correctly per-stack via the loop), confirmed by monotonicity
//     tests in __tests__/stats.test.ts.
//   - Charge-based upgrades that previously ignored stacking (Shield,
//     Boomerang, Reserve Chute already used `+= 1` per stack — unchanged;
//     Phoenix already stacked per plan) — no change needed, verified below.
//   - Boolean upgrades now ALSO track a stack count (scanner, ufosFriendly,
//     chrono, star_core) so render/gameplay code can escalate at stack
//     thresholds (§5.1: Scanner 2+/3+, Alien Diplomacy 2+, Chrono 0.75^n,
//     Star Core repeats its whole +12% roll per stack — already did, since
//     the switch-case runs once per occurrence in `picked`).
//
// thrustPower base raised 145 -> 158 per §4.2 to compensate for the new
// mass/drag model's effect on level-1 feel (heavier stacks respond slower
// under the mass model, so the unloaded base thrust needed a nudge up).
export function computeStats(picked: UpgradeId[], diff: Difficulty): ShipStats {
  const tol = DIFF_MODS[diff].tol;
  const s: ShipStats = {
    maxFuel: 100,
    thrustPower: 158,
    padBonus: 0,
    landingSpeedTol: 60 * tol,
    landingAngleTol: 0.28 * tol,
    shieldCharges: 0,
    gravityMult: 1,
    scanner: 0,
    reserveCharges: 0,
    fuelBurnMult: 1,
    rotMult: 1,
    windMult: 1,
    fuelRegen: 0,
    spicyFlame: false,
    spicyStacks: 0,
    bounceCharges: 0,
    ufosFriendly: 0,
    slowmo: false,
    chronoStacks: 0,
    projSpeedMult: 1,
    phoenixCharges: 0,
    starCore: false,
    starCoreStacks: 0,
    massSum: 0,
    areaSum: 0,
    // --- lander-v10 commit 4a (§6.6): new systems' stat hooks. All start at
    // their semantic "off" default — no upgrade in this commit sets any of
    // them; Commit 4b's 50 new upgrades populate them via the same
    // picked-upgrades switch loop below.
    noodleStacks: 0,
    extraChoices: 0,
    stardustMult: 1,
    grazeFuel: 0,
    slopeLandCharges: 0,
    hoverModule: 0,
    asteroidMiner: 0,
    magnetDeflect: 0,
    tailwindTurbine: 0,
    cheeseDrillCharges: 0,
    droneCharges: 0,
    abilityDefs: [],
    padPull: 0,
    autoBrake: 0,
    kickThrusters: 0,
    luckyTier: 0,
    forecastMarker: 0,
    eggLevels: 0,
    randomDice: 0,
    sailRegen: 0,
    pocketMoon: 0,
    escortUfos: 0,
    doubleProgress: 0,
    slideLanding: 0,
    reverseGravityCharges: 0,
    midasMult: 1,
    ghostSave: 0,
    stormTowardPad: false,
    nanoRegenSec: 0,
    blackholeReserve: 0,
    antigravPaint: 0,
  };
  for (const id of picked) {
    switch (id) {
      case 'fuel_tank':       s.maxFuel += 45;                s.gravityMult *= 1.06; break;
      case 'boost_thrusters': s.thrustPower *= 1.4;           s.fuelBurnMult *= 1.15; break;
      case 'magnetic_pad':    s.padBonus += 40; s.landingSpeedTol *= 1.15; s.gravityMult *= 1.04; break;
      case 'shield':          s.shieldCharges += 1;           s.gravityMult *= 1.06; break;
      case 'gyro':            s.landingAngleTol += 0.16;      s.fuelBurnMult *= 1.08; break;
      case 'gravity_anchor':  s.gravityMult *= 0.85;          s.rotMult *= 0.88; break;
      case 'scanner':         s.scanner += 1;                 s.maxFuel -= 10; break;
      case 'feather_gear':    s.landingSpeedTol *= 1.3;       s.windMult *= 1.2; break;
      case 'reserve_chute':   s.reserveCharges += 1;          s.gravityMult *= 1.04; break;
      case 'storm_dampeners': s.windMult *= 0.5;              s.thrustPower *= 0.92; break;
      case 'fuel_scoop':      s.fuelRegen += 3;               s.maxFuel -= 15; break;
      case 'precision_jets':  s.rotMult *= 1.4;               s.fuelBurnMult *= 1.06; break;
      case 'jalapeno_injectors': s.thrustPower *= 1.3;        s.fuelBurnMult *= 1.12; s.spicyFlame = true; s.spicyStacks += 1; break;
      case 'boomerang_hull':  s.bounceCharges += 1; break;
      case 'alien_diplomacy': s.ufosFriendly += 1;            s.gravityMult *= 1.05; break;
      case 'chrono_crystal':  s.slowmo = true;                s.chronoStacks += 1; break;
      case 'overdrive_core':  s.thrustPower *= 1.55; s.rotMult *= 1.2; s.fuelBurnMult *= 1.22; break;
      case 'phoenix_feather': s.phoenixCharges += 1;          s.maxFuel -= 10; break;
      case 'star_core':
        s.thrustPower *= 1.12; s.maxFuel = Math.round(s.maxFuel * 1.12);
        s.landingSpeedTol *= 1.12; s.landingAngleTol *= 1.12; s.rotMult *= 1.12;
        s.gravityMult *= 0.92; s.projSpeedMult *= 1.2; s.starCore = true; s.starCoreStacks += 1;
        break;
    }
    // §4.2: every module stack contributes a small default drag area even
    // before the full mass-conversion of upgrade cons lands in Commit 4.
    s.areaSum += 0.02;
  }
  // §4.5 Stability floors — numerical guards only, NOT gameplay caps.
  // These only fire in degenerate stacking scenarios (hundreds of picks of
  // the same drawback-heavy upgrade) to keep the simulation finite.
  s.maxFuel = Math.max(20, s.maxFuel);
  s.thrustPower = Math.max(60, s.thrustPower);
  s.gravityMult = Math.max(0, s.gravityMult); // exact "product >= 1 px/s^2" floor applied in clampGravityProduct() below, against actual level gravity
  s.fuelBurnMult = Math.max(0.05, s.fuelBurnMult);
  s.windMult = Math.max(0, s.windMult);
  s.landingSpeedTol = Math.max(0, s.landingSpeedTol);
  s.landingAngleTol = Math.max(0, s.landingAngleTol);
  s.massSum = Math.max(-0.8, s.massSum); // keeps effectiveMass() (1 + massSum) >= 0.2 floor headroom
  s.areaSum = Math.max(0, s.areaSum);
  // §6.6 hooks: no upgrade sets these yet, but floor them anyway so Commit 4b
  // upgrades inherit the same "numerical guard, not gameplay cap" treatment
  // as everything else in this function.
  s.stardustMult = Math.max(0, s.stardustMult);
  s.midasMult = Math.max(0, s.midasMult);
  return s;
}

// §4.5: gravity product (level gravity * gravityMult) must never go to zero
// or negative — called by main.ts with the actual level gravity so the
// floor is exact regardless of how low a level's base gravity is.
export function clampGravityProduct(gLevel: number, gravityMult: number): number {
  const product = gLevel * gravityMult;
  return Math.max(1, product) / Math.max(1e-6, gLevel);
}

// §5.1: Chrono Crystal compounds — n stacks slow the world to 0.75^n below
// 120m (each additional crystal makes the bullet-time deeper, not just
// wider). No floor here beyond the physics accumulator's own DT/MAX_FRAME_TIME
// sanity — 0.75^n asymptotically approaches 0 but never reaches it or goes
// negative, so the sim stays finite at any stack count.
export function chronoTimeScale(chronoStacks: number): number {
  if (chronoStacks <= 0) return 1;
  return Math.pow(0.75, chronoStacks);
}
