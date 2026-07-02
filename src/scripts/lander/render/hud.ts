import { terrainYAt } from '../levels';
import type { LevelConfig, ShipStats, Terrain } from '../types';

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
}

export function updateHud(p: UpdateHudParams) {
  const { hud, ship, stats, terrain, levelIndex, cfg, bestFor, stardust } = p;
  if (!hud.fuel) return;
  hud.fuel.textContent = `${Math.round(ship.fuel)}`;
  if (hud.fuelBar) hud.fuelBar.style.width = `${Math.max(0, Math.min(100, (ship.fuel / stats.maxFuel) * 100))}%`;
  hud.altitude.textContent = terrain ? `${Math.max(0, Math.round(terrainYAt(terrain.points, ship.x) - ship.y))}m` : '—';
  const speed = Math.hypot(ship.vx, ship.vy);
  hud.speed.textContent = `${Math.round(speed)}`;
  hud.speed.style.color = speed < stats.landingSpeedTol ? '#94B03D' : '#C97B3D';
  hud.level.textContent = `${levelIndex + 1} — ${cfg?.name ?? ''}`;
  if (hud.best) hud.best.textContent = `${bestFor() || '—'}`;
  if (hud.stardust) hud.stardust.textContent = `${stardust}`;
}
