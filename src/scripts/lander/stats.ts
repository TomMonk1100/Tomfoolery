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
// Infinite-stacking formulas themselves (removing the "one pick per
// upgrade matters most" shape, letting duplicates compound without these
// interfering) are Commit 3's job — this commit only swaps caps for floors
// and leaves the per-upgrade formulas below untouched.
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
    massSum: 0,
    areaSum: 0,
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
  return s;
}

// §4.5: gravity product (level gravity * gravityMult) must never go to zero
// or negative — called by main.ts with the actual level gravity so the
// floor is exact regardless of how low a level's base gravity is.
export function clampGravityProduct(gLevel: number, gravityMult: number): number {
  const product = gLevel * gravityMult;
  return Math.max(1, product) / Math.max(1e-6, gLevel);
}
