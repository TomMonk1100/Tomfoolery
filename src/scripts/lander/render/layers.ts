// ---------------------------------------------------------------------------
// lander-v10 commit 5 (§8.1): static layer cache.
//
// draw() used to rebuild the sky gradient, iterate every star, and re-stroke
// the entire terrain polyline + surface texture from scratch every single
// frame — none of that changes frame-to-frame except the star twinkle
// phase, so it's pure repeated work. This module prerenders three offscreen
// canvases once per loadLevel/resize:
//
//   (a) sky   — sky gradient + planet + background ridge silhouette
//   (b) stars — the star field at full brightness, split into two
//               non-overlapping subsets (see splitStars) so twinkle can be
//               faked with two globalAlpha blits instead of a per-star loop
//   (c) terrain — terrain fill + stroke + surface texture strokes
//
// Per frame, main.ts's draw() now blits (a), then blits (b) twice (each
// subset canvas at its own phase-offset sine alpha — zero per-star work),
// then blits (c). Noodle piles and terraform() edits (both already mutate
// `terrain.points` in place) call markTerrainDirty(); the throttle re-uses
// entities.ts's shouldRebuild/REBUILD_INTERVAL_S (the 4a placeholder this
// was always meant to plug into) so a rebuild only actually happens at most
// once every 0.5s even if terraform() fires every tick while the ship
// hovers over the same spot.
// ---------------------------------------------------------------------------

import { mulberry32 } from '../rng';
import { shouldRebuild, REBUILD_INTERVAL_S } from '../entities';
import { terrainYAt } from '../levels';
import { shade, depthTint, LIGHT } from './palette';
import type { LevelConfig, SkyDef, Star, Terrain } from '../types';

export { REBUILD_INTERVAL_S };

function makeOffscreen(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// Splits the star list into two disjoint subsets (alternating by index) so
// each subset can be blitted as a single globalAlpha pass — the "2
// alternating alpha masks" in §8.1. Splitting by parity keeps both subsets
// visually even (no clustering) without needing to sort/bucket by anything.
export function splitStars(stars: Star[]): [Star[], Star[]] {
  const a: Star[] = [];
  const b: Star[] = [];
  for (let i = 0; i < stars.length; i++) (i % 2 === 0 ? a : b).push(stars[i]);
  return [a, b];
}

function paintStarSubset(ctx: CanvasRenderingContext2D, subset: Star[], skyTheme: SkyDef) {
  ctx.fillStyle = skyTheme.star;
  for (const s of subset) {
    ctx.globalAlpha = s.bright;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export interface LayerBuildInput {
  width: number;
  height: number;
  cfg: LevelConfig;
  terrain: Terrain;
  stars: Star[];
  planet: { x: number; y: number; r: number; hue: [string, string]; ring: boolean };
  skyTheme: SkyDef;
  levelIndex: number;
}

export class LayerCache {
  skyCanvas: HTMLCanvasElement | null = null;
  starCanvasA: HTMLCanvasElement | null = null;
  starCanvasB: HTMLCanvasElement | null = null;
  terrainCanvas: HTMLCanvasElement | null = null;

  private width = 0;
  private height = 0;
  private dirty = false;
  private lastRebuildTime = 0;
  private lastInput: LayerBuildInput | null = null;

  // (a) sky gradient + planet + ridge — rebuilt on loadLevel/resize only
  // (never dirtied by gameplay: nothing in-run mutates the sky/planet/ridge).
  private buildSkyLayer(input: LayerBuildInput) {
    const { width, height, terrain, planet, skyTheme, levelIndex } = input;
    const c = makeOffscreen(width, height);
    const ctx = c.getContext('2d', { alpha: false })!;
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, skyTheme.top);

    // v12 Commit 1: 5-stop gradient instead of 3 — gives the sky a subtle
    // banded read (a shaded upper dome, a brighter equator band) instead of
    // a flat linear wash.
    grad.addColorStop(0.35, shade(skyTheme.top, -0.1));
    grad.addColorStop(0.62, skyTheme.mid);
    grad.addColorStop(0.8, shade(skyTheme.mid, 0.12));
    grad.addColorStop(1, skyTheme.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(-10, -10, width + 20, height + 20);

    const plHue = skyTheme.planet ?? planet.hue;
    const plGrad = ctx.createRadialGradient(
    // Horizon glow band — warm dusk light pooling above the ridge line.
    // Additive so it reads as a soft glow rather than a hard color patch.
    const glowFrom = height * 0.55, glowTo = height * 0.78;
    const glowGrad = ctx.createLinearGradient(0, glowFrom, 0, glowTo);
    const glowColor = shade(skyTheme.bot, 0.25);
    const gr = parseInt(glowColor.slice(1, 3), 16), gg = parseInt(glowColor.slice(3, 5), 16), gb = parseInt(glowColor.slice(5, 7), 16);
    glowGrad.addColorStop(0, `rgba(${gr},${gg},${gb},0)`);
    glowGrad.addColorStop(0.5, `rgba(${gr},${gg},${gb},0.35)`);
    glowGrad.addColorStop(1, `rgba(${gr},${gg},${gb},0)`);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, glowFrom, width, glowTo - glowFrom);
    ctx.restore();

      planet.x - planet.r * 0.35, planet.y - planet.r * 0.35, planet.r * 0.15, planet.x, planet.y, planet.r
    );
    plGrad.addColorStop(0, plHue[0]);
    plGrad.addColorStop(1, plHue[1]);
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.r, 0, Math.PI * 2);
    ctx.fillStyle = plGrad;
    ctx.fill();
    if (planet.ring) {
      ctx.save();
    // Crescent shadow — lit from the same sun as everything else (LIGHT).
    ctx.save();
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(planet.x + LIGHT.x * planet.r * 0.45, planet.y + LIGHT.y * planet.r * 0.45, planet.r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();
    ctx.restore();
      ctx.translate(planet.x, planet.y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, planet.r * 1.6, planet.r * 0.38, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(185, 164, 128, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.ridge.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = '#20170c';
    ctx.fill();

    this.skyCanvas = c;
  }

  // (b) star field, full brightness, split into two phase-offset subsets.
  private buildStarLayers(input: LayerBuildInput) {
    const { width, height, stars, skyTheme } = input;
    const [subsetA, subsetB] = splitStars(stars);
    const ca = makeOffscreen(width, height);
    const cb = makeOffscreen(width, height);
    paintStarSubset(ca.getContext('2d')!, subsetA, skyTheme);
    paintStarSubset(cb.getContext('2d')!, subsetB, skyTheme);
    this.starCanvasA = ca;
    this.starCanvasB = cb;
  }

  // (c) terrain fill + stroke + surface texture — the layer noodle piles
  // and terraform() invalidate (terrain.points mutates in place under
  // both mechanics).
  private buildTerrainLayer(input: LayerBuildInput) {
    const { width, height, cfg, terrain } = input;
    const c = makeOffscreen(width, height);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

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

    this.terrainCanvas = c;
  }

  // Full rebuild of all three layers — call on loadLevel/resize.
  build(input: LayerBuildInput): void {
    this.width = input.width;
    this.height = input.height;
    this.lastInput = input;
    this.buildSkyLayer(input);
    this.buildStarLayers(input);
    this.buildTerrainLayer(input);
    this.dirty = false;
  }

  // Terraform()/noodle-pile edits call this. The actual rebuild is deferred
  // to the throttled tryRebuildTerrain() below (§6.4/§8.1: at most once per
  // REBUILD_INTERVAL_S while dirty).
  markTerrainDirty(): void {
    this.dirty = true;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  // Call once per physics tick with the current sim time; rebuilds ONLY
  // layer (c) (sky/stars are untouched by terrain edits) when dirty and the
  // throttle window has elapsed. Returns true iff a rebuild happened.
  tryRebuildTerrain(now: number): boolean {
    if (!this.lastInput) return false;
    if (!shouldRebuild(this.dirty, now, this.lastRebuildTime)) return false;
    this.lastRebuildTime = now;
    this.dirty = false;
    this.buildTerrainLayer(this.lastInput);
    return true;
  }

  get ready(): boolean {
    return !!(this.skyCanvas && this.starCanvasA && this.starCanvasB && this.terrainCanvas);
  }
}

// Per-frame blit helper. `twinkle` false => degradation guard has disabled
// twinkle (§8.5): draw the full star layer once at flat alpha instead of
// two phase-offset blits. `t` is seconds (performance.now()/1000) driving
// the two independent sine phases (offset by PI so the subsets visibly
// counter-twinkle rather than moving in lockstep).
export function blitLayers(ctx: CanvasRenderingContext2D, cache: LayerCache, t: number, twinkle: boolean): void {
  if (!cache.ready) return;
  if (cache.skyCanvas) ctx.drawImage(cache.skyCanvas, 0, 0);
  if (twinkle) {
    const alphaA = 0.6 + Math.sin(t * 1.5) * 0.4;
    const alphaB = 0.6 + Math.sin(t * 1.5 + Math.PI) * 0.4;
    ctx.globalAlpha = Math.max(0, Math.min(1, alphaA));
    if (cache.starCanvasA) ctx.drawImage(cache.starCanvasA, 0, 0);
    ctx.globalAlpha = Math.max(0, Math.min(1, alphaB));
    if (cache.starCanvasB) ctx.drawImage(cache.starCanvasB, 0, 0);
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 1;
    if (cache.starCanvasA) ctx.drawImage(cache.starCanvasA, 0, 0);
    if (cache.starCanvasB) ctx.drawImage(cache.starCanvasB, 0, 0);
  }
  if (cache.terrainCanvas) ctx.drawImage(cache.terrainCanvas, 0, 0);
}
