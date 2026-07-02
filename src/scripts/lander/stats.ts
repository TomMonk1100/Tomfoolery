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
export function computeStats(picked: UpgradeId[], diff: Difficulty): ShipStats {
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
