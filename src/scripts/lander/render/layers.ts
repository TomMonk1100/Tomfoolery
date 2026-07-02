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
  ridgeFarCanvas: HTMLCanvasElement | null = null;
  ridgeNearCanvas: HTMLCanvasElement | null = null;
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

    // v12 Commit 1: 5-stop gradient instead of 3 — gives the sky a subtle
    // banded read (a shaded upper dome, a brighter equator band) instead of
    // a flat linear wash.
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, skyTheme.top);
    grad.addColorStop(0.35, shade(skyTheme.top, -0.1));
    grad.addColorStop(0.62, skyTheme.mid);
    grad.addColorStop(0.8, shade(skyTheme.mid, 0.12));
    grad.addColorStop(1, skyTheme.bot);
    ctx.fillStyle = grad;
    ctx.fillRect(-10, -10, width + 20, height + 20);

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

    const plHue = skyTheme.planet ?? planet.hue;
    const plGrad = ctx.createRadialGradient(
      planet.x - planet.r * 0.35, planet.y - planet.r * 0.35, planet.r * 0.15, planet.x, planet.y, planet.r
    );
    plGrad.addColorStop(0, plHue[0]);
    plGrad.addColorStop(1, plHue[1]);
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.r, 0, Math.PI * 2);
    ctx.fillStyle = plGrad;
    ctx.fill();
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
    if (planet.ring) {
      ctx.save();
      ctx.translate(planet.x, planet.y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, planet.r * 1.6, planet.r * 0.38, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(185, 164, 128, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // v12 Commit 2: the ridge silhouette moved out of the sky layer into
    // its own parallax plane (buildRidgeFarLayer) — sky is now gradient +
    // planet + depth tint only, at infinite parallax distance.

    // Depth tint — deeper runs read subtly colder/moodier, on TOP of the
    // equipped sky theme (never replaces it — I5).
    const tint = depthTint(levelIndex);
    if (tint.alpha > 0) {
      const tr = parseInt(tint.color.slice(1, 3), 16), tg = parseInt(tint.color.slice(3, 5), 16), tb = parseInt(tint.color.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${tr},${tg},${tb},${tint.alpha})`;
      ctx.fillRect(0, 0, width, height);
    }

    this.skyCanvas = c;
  }

  // v12 Commit 2: atmospheric perspective — the far ridge (v11's `ridge`)
  // is lighter/hazier (farther = lighter), with a haze band blended toward
  // the sky's bottom color pooling at its crest line.
  private buildRidgeFarLayer(input: LayerBuildInput) {
    const { width, height, terrain, skyTheme } = input;
    const c = makeOffscreen(width, height);
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.ridge.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = shade('#20170c', 0.35);
    ctx.fill();

    const meanY = terrain.ridge.reduce((a, p) => a + p.y, 0) / terrain.ridge.length;
    const bc = skyTheme.bot;
    const br = parseInt(bc.slice(1, 3), 16), bg = parseInt(bc.slice(3, 5), 16), bb = parseInt(bc.slice(5, 7), 16);
    const haze = ctx.createLinearGradient(0, meanY, 0, meanY + 60);
    haze.addColorStop(0, `rgba(${br},${bg},${bb},0.30)`);
    haze.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, meanY, width, 60);

    this.ridgeFarCanvas = c;
  }

  // v12 Commit 2: the near ridge is darker/closer (matches the terrain's
  // base tone) with a much fainter haze — the contrast between this and
  // the far ridge IS the depth cue.
  private buildRidgeNearLayer(input: LayerBuildInput) {
    const { width, height, terrain, skyTheme } = input;
    const c = makeOffscreen(width, height);
    const ctx = c.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.ridgeNear.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = '#20170c';
    ctx.fill();

    const meanY = terrain.ridgeNear.reduce((a, p) => a + p.y, 0) / terrain.ridgeNear.length;
    const bc = skyTheme.bot;
    const br = parseInt(bc.slice(1, 3), 16), bg = parseInt(bc.slice(3, 5), 16), bb = parseInt(bc.slice(5, 7), 16);
    const haze = ctx.createLinearGradient(0, meanY, 0, meanY + 60);
    haze.addColorStop(0, `rgba(${br},${bg},${bb},0.15)`);
    haze.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, meanY, width, 60);

    this.ridgeNearCanvas = c;
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
  //
  // v12 Commit 3: slope-lit terrain. Per-segment outward normals are dotted
  // against the global LIGHT direction to shade each ground quad, a
  // composited depth gradient restores the "ground gets darker with depth"
  // read on top, the top edge re-strokes per-segment lit/shadow instead of
  // one flat color, boulders (a new isolated rng) sit in the corridor gaps,
  // scratch texture gains per-stroke width/alpha variance, and canyon walls
  // get an ambient-occlusion pool at their base.
  private buildTerrainLayer(input: LayerBuildInput) {
    const { width, height, cfg, terrain } = input;
    const c = makeOffscreen(width, height);
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, width, height);

    // Base silhouette fill — establishes the shape the slope quads tile
    // over and gives the composited passes below something to key off of.
    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = '#2a1f10';
    ctx.fill();

    // 1. Slope shading — each segment's outward (upward-facing) normal
    // dotted against LIGHT decides how bright that patch of ground reads.
    // Quads overlap 0.75px on each side to hide seams between segments.
    const lits: number[] = [];
    for (let i = 0; i < terrain.points.length - 1; i++) {
      const p0 = terrain.points[i], p1 = terrain.points[i + 1];
      let dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy) || 1;
      dx /= len; dy /= len;
      let nx = -dy, ny = dx;
      if (ny > 0) { nx = -nx; ny = -ny; } // keep the normal pointing "up" on screen
      const lit = -(nx * LIGHT.x + ny * LIGHT.y);
      lits.push(lit);
      ctx.beginPath();
      ctx.moveTo(p0.x - 0.75, p0.y);
      ctx.lineTo(p1.x + 0.75, p1.y);
      ctx.lineTo(p1.x + 0.75, height);
      ctx.lineTo(p0.x - 0.75, height);
      ctx.closePath();
      ctx.fillStyle = shade('#3B2C16', lit * 0.22);
      ctx.fill();
    }

    // 2. Depth gradient — composited with source-atop so it only recolors
    // pixels the silhouette/slope quads already painted, restoring the
    // ground-gets-darker-with-depth read on top of the slope shading.
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.55;
    const groundGrad = ctx.createLinearGradient(0, height * 0.5, 0, height);
    groundGrad.addColorStop(0, '#3B2C16');
    groundGrad.addColorStop(1, '#221808');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // 6. Canyon AO — an ambient-occlusion pool at the base of each wall
    // (inner 60px, nearest the gap), also composited via source-atop so it
    // only darkens terrain pixels that actually exist there.
    if (cfg.terrain === 'canyon') {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      const aoTop = height * 0.15;
      const drawAo = (x0: number, x1: number) => {
        const g = ctx.createLinearGradient(0, aoTop, 0, height);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = g;
        ctx.fillRect(x0, aoTop, x1 - x0, height - aoTop);
      };
      drawAo(width * 0.32 - 60, width * 0.32);
      drawAo(width * 0.68, width * 0.68 + 60);
      ctx.restore();
    }

    // 3. Surface highlight — replaces the old single flat-color stroke:
    // lit crests catch the sun, shadowed crests go dark, per segment.
    for (let i = 0; i < terrain.points.length - 1; i++) {
      const p0 = terrain.points[i], p1 = terrain.points[i + 1];
      const lit = lits[i];
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      if (lit > 0.15) {
        ctx.strokeStyle = shade('#8a6a3c', lit * 0.5);
        ctx.lineWidth = 2;
      } else {
        ctx.strokeStyle = '#221808';
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
    }

    // 4. Boulders — an isolated rng (never interleaved with any gameplay
    // stream, I1), rejected from the pad corridor and bonus-pad zone.
    const halfW = cfg.padWidth / 2;
    const padLo = terrain.pad.baseX - (terrain.pad.range + halfW + 20);
    const padHi = terrain.pad.baseX + (terrain.pad.range + halfW + 20);
    const bonusLo = terrain.bonusPad ? terrain.bonusPad.xStart - 20 : null;
    const bonusHi = terrain.bonusPad ? terrain.bonusPad.xEnd + 20 : null;
    const br = mulberry32(cfg.seed * 431 + 19);
    const boulderCount = 8 + Math.floor(br() * 7); // 8..14
    const facingAng = Math.atan2(-LIGHT.y, -LIGHT.x);
    const angDist = (a: number, b: number) => {
      let d = Math.abs(a - b) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d;
    };
    let placed = 0, guard = 0;
    while (placed < boulderCount && guard < boulderCount * 8) {
      guard++;
      const x = br() * width;
      if (x > padLo && x < padHi) continue;
      if (bonusLo !== null && x > bonusLo && x < (bonusHi as number)) continue;
      const y = terrainYAt(terrain.points, x);
      const sides = 5 + Math.floor(br() * 2); // 5 or 6
      const baseR = 2.5 + br() * 3.5; // 2.5..6
      const verts: { x: number; y: number; ang: number }[] = [];
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2;
        const jitter = 1 + (br() - 0.5) * 0.7; // vertex jitter ±35%
        const r = baseR * jitter;
        verts.push({ x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r * 0.85, ang });
      }
      ctx.beginPath();
      verts.forEach((v, k) => (k === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y)));
      ctx.closePath();
      ctx.fillStyle = shade('#3B2C16', -0.15);
      ctx.fill();

      // Lit-side facet: the 2 vertices nearest the light-facing direction.
      const sorted = [...verts].sort((a, b) => angDist(a.ang, facingAng) - angDist(b.ang, facingAng));
      const facet = sorted.slice(0, 2);
      if (facet.length === 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(facet[0].x, facet[0].y);
        ctx.lineTo(facet[1].x, facet[1].y);
        ctx.closePath();
        ctx.fillStyle = shade('#3B2C16', 0.3);
        ctx.fill();
      }

      // Contact shadow.
      ctx.beginPath();
      ctx.ellipse(x, y + baseR * 0.3, baseR * 0.9, baseR * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(10,6,2,0.35)';
      ctx.fill();

      placed++;
    }

    // 5. Scratch texture — per-stroke width/alpha variance from the same
    // texRand stream (extra calls are safe: used nowhere else).
    const texRand = mulberry32(cfg.seed * 77 + 1);
    for (let i = 0; i < 26; i++) {
      const x = texRand() * width;
      const y = terrainYAt(terrain.points, x) + 6 + texRand() * 26;
      if (y > height - 4) continue;
      const lw = 0.6 + texRand() * 1.0; // 0.6..1.6
      const alpha = 0.25 + texRand() * 0.3; // 0.25..0.55
      ctx.strokeStyle = `rgba(74, 54, 32, ${alpha.toFixed(3)})`;
      ctx.lineWidth = lw;
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
    this.buildRidgeFarLayer(input);
    this.buildRidgeNearLayer(input);
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
    return !!(
      this.skyCanvas && this.starCanvasA && this.starCanvasB &&
      this.ridgeFarCanvas && this.ridgeNearCanvas && this.terrainCanvas
    );
  }
}

// v12 Commit 2: blitLayers() split into one function per parallax plane so
// main.ts's draw() can wrap each in its own `withParallax(factor, ...)`
// transform. `blitSky` is screen-fixed (called before the camera save, at
// "infinite" distance — no factor needed). The others are called inside a
// parallax transform at their assigned factor.

export function blitSky(ctx: CanvasRenderingContext2D, cache: LayerCache): void {
  if (cache.skyCanvas) ctx.drawImage(cache.skyCanvas, 0, 0);
}

// `twinkle` false => degradation guard has disabled twinkle (§8.5): draw
// the full star layer once at flat alpha instead of two phase-offset
// blits. `t` is seconds (performance.now()/1000) driving the two
// independent sine phases (offset by PI so the subsets visibly
// counter-twinkle rather than moving in lockstep).
export function blitStars(ctx: CanvasRenderingContext2D, cache: LayerCache, t: number, twinkle: boolean): void {
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
}

export function blitRidge(ctx: CanvasRenderingContext2D, cache: LayerCache, which: 'far' | 'near'): void {
  const canvas = which === 'far' ? cache.ridgeFarCanvas : cache.ridgeNearCanvas;
  if (canvas) ctx.drawImage(canvas, 0, 0);
}

export function blitTerrain(ctx: CanvasRenderingContext2D, cache: LayerCache): void {
  if (cache.terrainCanvas) ctx.drawImage(cache.terrainCanvas, 0, 0);
}
