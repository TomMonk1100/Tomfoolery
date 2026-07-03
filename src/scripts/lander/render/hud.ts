import { terrainYAt } from '../levels';
import type { AbilityDef, LevelConfig, ShipStats, Terrain } from '../types';

export interface HudEls {
  fuel: HTMLElement;
  fuelBar: HTMLElement;
  altitude: HTMLElement;
  speed: HTMLElement;
  level: HTMLElement;
  best: HTMLElement;
  stardust: HTMLElement;
}

export interface UpdateHudParams {
  hud: HudEls;
  ship: { x: number; y: number; vx: number; vy: number; fuel: number };
  stats: ShipStats;
  terrain: Terrain | undefined;
  levelIndex: number;
  cfg: LevelConfig | undefined;
  bestFor: () => number;
  stardust: number;
  // Narrow-viewport mode: drop the level *name* from the LVL chip ("3"
  // instead of "3 — First Light") so the HUD row never wraps or overlaps
  // the ALT/SPD chips on phone-width canvases.
  compact?: boolean;
}

// §8.7 DOM discipline: only touch the DOM when the value being displayed
// actually changed. `textContent = sameString` is not a no-op in the
// browser — it still triggers style/layout invalidation on that node — so
// at 120 physics ticks/sec (updateHud is called once per rendered frame,
// but several of these values are steady for many consecutive frames:
// level/best/stardust change only a few times per run) skipping the write
// when nothing changed avoids a meaningful amount of pointless layout work.
function setText(el: HTMLElement | undefined | null, next: string): void {
  if (!el) return;
  if (el.textContent !== next) el.textContent = next;
}

function setStyle<K extends keyof CSSStyleDeclaration>(
  el: HTMLElement | undefined | null, prop: K, next: CSSStyleDeclaration[K]
): void {
  if (!el) return;
  if (el.style[prop] !== next) el.style[prop] = next;
}

export function updateHud(p: UpdateHudParams) {
  const { hud, ship, stats, terrain, levelIndex, cfg, bestFor, stardust, compact } = p;
  if (!hud.fuel) return;
  setText(hud.fuel, `${Math.round(ship.fuel)}`);
  if (hud.fuelBar) {
    setStyle(hud.fuelBar, 'width', `${Math.max(0, Math.min(100, (ship.fuel / stats.maxFuel) * 100))}%`);
  }
  setText(hud.altitude, terrain ? `${Math.max(0, Math.round(terrainYAt(terrain.points, ship.x) - ship.y))}m` : '—');
  const speed = Math.hypot(ship.vx, ship.vy);
  setText(hud.speed, `${Math.round(speed)}`);
  setStyle(hud.speed, 'color',
    speed < stats.landingSpeedTol * 0.8 ? '#94B03D' :
    speed < stats.landingSpeedTol ? '#D9A441' : '#C97B3D');
  setText(hud.level, compact ? `${levelIndex + 1}` : `${levelIndex + 1} — ${cfg?.name ?? ''}`);
  if (hud.best) setText(hud.best, `${bestFor() || '—'}`);
  if (hud.stardust) setText(hud.stardust, `${stardust}`);
}

// ---------------------------------------------------------------------------
// lander-v10 commit 4a (§6.2): active-ability cooldown pips.
//
// Small pips drawn above the fuel bar, one per owned ability def, filled
// proportionally to (maxCooldown - cooldown) / maxCooldown (i.e. full when
// charges are ready). Only drawn when stats.abilityDefs.length > 0 — a
// no-op today since no upgrade populates abilityDefs yet, but the draw path
// is ready for Commit 4b.
// ---------------------------------------------------------------------------
export function drawAbilityPips(
  ctx: CanvasRenderingContext2D, abilityDefs: AbilityDef[], x: number, y: number
) {
  if (!abilityDefs || abilityDefs.length === 0) return;
  const c = ctx;
  const pipW = 14;
  const pipH = 4;
  const gap = 3;
  c.save();
  abilityDefs.forEach((def, i) => {
    const px = x + i * (pipW + gap);
    const ready = def.charges > 0;
    c.fillStyle = 'rgba(34, 24, 8, 0.6)';
    c.fillRect(px, y, pipW, pipH);
    const frac = def.maxCooldown > 0 ? Math.max(0, Math.min(1, (def.maxCooldown - def.cooldown) / def.maxCooldown)) : 1;
    c.fillStyle = ready ? '#94B03D' : '#7BA7C7';
    c.fillRect(px, y, pipW * frac, pipH);
    c.strokeStyle = '#221808';
    c.lineWidth = 0.6;
    c.strokeRect(px, y, pipW, pipH);
  });
  c.restore();
}
