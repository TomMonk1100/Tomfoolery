import type { Canister, Critter, Drone, LevelConfig, Projectile, ShipStats, Terrain, Ufo } from '../types';
import type { Asteroid } from '../entities';
import { droneWorldPos } from '../entities';
import { drawNoodle, drawNoodlePiles } from '../noodles';
import type { Noodle } from '../types';
import { shade, LIGHT } from './palette';
import { terrainYAt } from '../levels';
import { addGlow } from './fx';
import { litFill, metalStroke } from './ship';

// Pure render — no gameplay mutation (§4.4). Asteroid position/collision are
// computed in entities.ts::updateAsteroids/findAsteroidHit during the fixed
// physics step; this just blits the current state.
//
// v12 Commit 6: each asteroid now rotates (simTime * rotSpeed) and reads as
// lit rock — an irregular polygon (asteroid.shape) instead of a circle, a
// lit/shadow half-plane split along the global LIGHT axis (clipped to the
// polygon), craters drawn in the rotating local frame so they turn with the
// body, and a 1px darkened contour instead of the old flat green outline.
export function drawAsteroids(ctx: CanvasRenderingContext2D, asteroids: Asteroid[], simTime: number) {
  const c = ctx;
  const lightAng = Math.atan2(LIGHT.y, LIGHT.x);
  for (const a of asteroids) {
    if (!a.alive) continue;
    const { x: ax, y: ay, r, shape, rotSpeed } = a;
    const rot = simTime * rotSpeed;
    const sides = shape.length;
    const tracePolygon = () => {
      c.beginPath();
      for (let k = 0; k < sides; k++) {
        const ang = (k / sides) * Math.PI * 2;
        const rr = r * shape[k];
        const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
        if (k === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    };

    c.save();
    c.translate(ax, ay);
    c.rotate(rot);

    tracePolygon();
    c.fillStyle = '#5a4326';
    c.fill();

    c.save();
    tracePolygon();
    c.clip();
    // Lit/shadow halves, split along the LIGHT axis: rotating the local
    // frame by lightAng maps local +x to the world LIGHT direction, so the
    // half-plane at local x<0 (facing -LIGHT, per the same dot-product
    // convention as the terrain slope shading) is the lit side.
    const maxR = r * 1.3;
    c.save();
    c.rotate(lightAng);
    c.fillStyle = 'rgba(185,164,128,0.22)';
    c.fillRect(-maxR, -maxR, maxR, maxR * 2);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, -maxR, maxR, maxR * 2);
    c.restore();
    // Craters — drawn in the rotating local frame, so they turn with the body.
    c.fillStyle = 'rgba(34, 24, 8, 0.5)';
    c.beginPath(); c.arc(-r * 0.3, -r * 0.2, r * 0.22, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(r * 0.35, r * 0.3, r * 0.15, 0, Math.PI * 2); c.fill();
    c.restore();

    tracePolygon();
    c.strokeStyle = shade('#5a4326', -0.4);
    c.lineWidth = 1;
    c.stroke();

    c.restore();
  }
}

export function drawCritters(ctx: CanvasRenderingContext2D, critters: Critter[], t: number) {
  const c = ctx;
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


// v12 Commit 6: the telegraph is now a cone aimed at the ship (instead of a
// pulsing blob) so it reads as an aimed threat, the dome brightens while
// telegraphing, and there's a dome specular + an underside glow disc while
// moving. `shipX`/`shipY` are needed to aim the cone.
export function drawUfos(
  ctx: CanvasRenderingContext2D, ufos: Ufo[], projectiles: Projectile[], stats: ShipStats,
  shipX: number, shipY: number, degraded: boolean = false
) {
  const c = ctx;
  for (const u of ufos) {
    if (!u.alive) continue;
    c.save();
    c.translate(u.x, u.y);
    c.scale(1.25, 1.25);
    if (u.telegraph > 0) {
      const dx = shipX - u.x, dy = shipY - u.y;
      const ang = Math.atan2(dy, dx);
      const len = 70, halfAngle = 0.18;
      const coneGrad = c.createLinearGradient(0, 4, Math.cos(ang) * len, 4 + Math.sin(ang) * len);
      coneGrad.addColorStop(0, 'rgba(201, 123, 61, 0.4)');
      coneGrad.addColorStop(1, 'rgba(201, 123, 61, 0)');
      addGlow(c, degraded, () => {
        c.beginPath();
        c.moveTo(0, 4);
        c.lineTo(Math.cos(ang - halfAngle) * len, 4 + Math.sin(ang - halfAngle) * len);
        c.lineTo(Math.cos(ang + halfAngle) * len, 4 + Math.sin(ang + halfAngle) * len);
        c.closePath();
        c.fillStyle = coneGrad;
        c.fill();
      });
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
    // Dome brightens during telegraph.
    c.fillStyle = u.telegraph > 0 ? 'rgba(148, 176, 61, 0.7)' : 'rgba(148, 176, 61, 0.45)';
    c.fill();
    c.strokeStyle = '#7C8F5C';
    c.stroke();
    // Dome specular.
    c.beginPath();
    c.ellipse(-2.4, -4.6, 2.2, 1, -0.3, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(244,235,218,0.4)';
    c.lineWidth = 0.7;
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
    // Underside glow disc while moving horizontally.
    if (Math.abs(u.vx) > 0) {
      addGlow(c, degraded, () => {
        const underGlow = c.createRadialGradient(0, 4, 0, 0, 4, 8);
        underGlow.addColorStop(0, 'rgba(217,164,65,0.35)');
        underGlow.addColorStop(1, 'rgba(217,164,65,0)');
        c.fillStyle = underGlow;
        c.beginPath();
        c.arc(0, 4, 8, 0, Math.PI * 2);
        c.fill();
      });
    }
    c.restore();
  }

  drawProjectileTracers(c, projectiles, '#D9A441', degraded);
}

// v12 Commit 6: capsule tracer — a short additive line along the velocity
// vector plus a bright head dot — replaces the old shadowBlur dot (slow
// path) for both hostile and ally shots. Exported so main.ts's ally
// projectile loop can reuse it in green.
export function drawProjectileTracers(
  ctx: CanvasRenderingContext2D, projectiles: { x: number; y: number; vx: number; vy: number; alive: boolean }[], color: string,
  degraded: boolean = false
) {
  const c = ctx;
  for (const p of projectiles) {
    if (!p.alive) continue;
    addGlow(c, degraded, () => {
      c.strokeStyle = color;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
      c.stroke();
      c.fillStyle = '#F4EBDA';
      c.beginPath();
      c.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      c.fill();
    });
  }
}

// §6.3 drones/companions — placeholder generic look (bee-striped/circle);
// actual per-upgrade visuals arrive in Commit 4b once real upgrades own them.
export function drawDrones(ctx: CanvasRenderingContext2D, drones: Drone[], shipX: number, shipY: number) {
  const c = ctx;
  for (const d of drones) {
    if (!d.alive) continue;
    const { x, y } = droneWorldPos(shipX, shipY, d);
    c.save();
    c.translate(x, y);
    c.beginPath();
    c.arc(0, 0, 3.2, 0, Math.PI * 2);
    c.fillStyle = d.behavior === 'shoot' ? '#C97B3D' : '#94B03D';
    c.fill();
    c.strokeStyle = '#221808';
    c.lineWidth = 0.7;
    c.stroke();
    // bee-striped placeholder look
    c.strokeStyle = '#221808';
    c.lineWidth = 0.5;
    c.beginPath(); c.moveTo(-2, -1); c.lineTo(2, -1); c.stroke();
    c.beginPath(); c.moveTo(-2.4, 0.5); c.lineTo(2.4, 0.5); c.stroke();
    c.restore();
  }
}

// §6.1 re-exported so main.ts/render callers only need to import from
// render/world.ts for the pad/asteroid/ufo/drone/noodle rendering surface.
export { drawNoodle, drawNoodlePiles };
export type { Noodle };

// §Commit 6: fuel canister pickups — gently bobbing, a soft glow behind a
// small capsule body/cap.
// v12 Commit 6: glow now pulses (alpha 0.18 + 0.1*sin) under additive
// compositing, and the body gets a 1px lit edge along its upper-left face.
export function drawCanisters(ctx: CanvasRenderingContext2D, canisters: Canister[], t: number, degraded: boolean = false) {
  const c = ctx;
  for (const can of canisters) {
    if (!can.alive) continue;
    const bobY = can.y + Math.sin(t * 2 + can.phase) * 3;
    c.save();
    c.translate(can.x, bobY);

    // §Commit 7: when degraded, the pulse itself is disabled (static alpha)
    // — addGlow still handles the composite fallback, but skip the sin()
    // math per-frame too, since that's the actual per-frame cost here.
    const glowAlpha = degraded ? 0.18 : Math.max(0, 0.18 + 0.1 * Math.sin(t * 3 + can.phase));
    addGlow(c, degraded, () => {
      const glow = c.createRadialGradient(0, 0, 0, 0, 0, 16);
      glow.addColorStop(0, `rgba(217,164,65,${glowAlpha.toFixed(3)})`);
      glow.addColorStop(1, 'rgba(217,164,65,0)');
      c.fillStyle = glow;
      c.beginPath();
      c.arc(0, 0, 16, 0, Math.PI * 2);
      c.fill();
    });

    c.fillStyle = '#D9A441';
    c.beginPath();
    if (typeof (c as any).roundRect === 'function') {
      (c as any).roundRect(-5, -7, 10, 14, 2);
    } else {
      (c as any).rect(-5, -7, 10, 14);
    }
    c.fill();
    c.strokeStyle = 'rgba(244,235,218,0.4)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-5, 5);
    c.lineTo(-5, -5);
    c.lineTo(-3, -7);
    c.stroke();
    c.fillStyle = '#F4EBDA';
    c.fillRect(-3, -9, 6, 3);
    c.restore();
  }
}

// v12 Commit 6: shared chevron drawer — 3 per side, sweeping inward (offset
// by (t*26)%14), used by both the main pad and the bonus pad.
function drawApproachChevrons(c: CanvasRenderingContext2D, xStart: number, xEnd: number, y: number, t: number, color: string) {
  const midX = (xStart + xEnd) / 2;
  c.strokeStyle = color;
  c.lineWidth = 1.5;
  const chevOffset = (t * 26) % 14;
  const drawChevron = (cx: number, dir: number) => {
    c.beginPath();
    c.moveTo(cx - dir * 3, y - 4);
    c.lineTo(cx + dir * 3, y);
    c.lineTo(cx - dir * 3, y + 4);
    c.stroke();
  };
  const leftSpan = midX - xStart - 10;
  const rightSpan = xEnd - midX - 10;
  if (leftSpan > 0) {
    for (let i = 0; i < 3; i++) drawChevron(xStart + 6 + ((i * 14 + chevOffset) % leftSpan), 1);
  }
  if (rightSpan > 0) {
    for (let i = 0; i < 3; i++) drawChevron(xEnd - 6 - ((i * 14 + chevOffset) % rightSpan), -1);
  }
}

// §Commit 6: the optional secondary "bonus" pad — a thin deck line with
// blinking end beacons and a small ×3✨ label, no-op when the level didn't
// generate one.
// v12 Commit 6: same treatment as the main pad — animated approach
// chevrons and an additive beacon halo, in the bonus pad's gold.
export function drawBonusPad(ctx: CanvasRenderingContext2D, terrain: Terrain, t: number, degraded: boolean = false) {
  if (!terrain.bonusPad) return;
  const c = ctx;
  const bp = terrain.bonusPad;
  c.save();
  c.strokeStyle = '#FFC94A';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(bp.xStart, bp.y - 3);
  c.lineTo(bp.xEnd, bp.y - 3);
  c.stroke();

  drawApproachChevrons(c, bp.xStart, bp.xEnd, bp.y - 3, t, 'rgba(255,201,74,0.5)');

  const blink = Math.floor(t * 2) % 2 === 0;
  if (blink) {
    for (const bx of [bp.xStart + 3, bp.xEnd - 3]) {
      addGlow(c, degraded, () => {
        c.beginPath();
        c.arc(bx, bp.y - 6, 8, 0, Math.PI * 2);
        c.fillStyle = 'rgba(255,201,74,0.18)';
        c.fill();
      });
      c.beginPath();
      c.arc(bx, bp.y - 6, 2.2, 0, Math.PI * 2);
      c.fillStyle = '#FFC94A';
      c.fill();
    }
  }
  c.globalAlpha = 0.7;
  c.font = '12px "JetBrains Mono", monospace';
  c.textAlign = 'center';
  c.fillStyle = '#FFC94A';
  c.fillText('×3✨', (bp.xStart + bp.xEnd) / 2, bp.y - 12);
  c.restore();
}

// v12 Commit 6: deck becomes a metal slab (rim-lit top edge, bolt dots,
// support struts down to the terrain below), and the hatching becomes an
// animated approach-chevron strip — "land here, center up."
export function drawPad(ctx: CanvasRenderingContext2D, terrain: Terrain, cfg: LevelConfig, stats: ShipStats, t: number, degraded: boolean = false) {
  const c = ctx;
  const pad = terrain.pad;
  const padVisible = !cfg.fog || stats.scanner;
  const w = pad.xEnd - pad.xStart;
  c.save();
  c.globalAlpha = padVisible ? 1 : 0.25;

  // Platform deck — metal slab.
  const deckGrad = c.createLinearGradient(0, pad.y - 4, 0, pad.y + 5);
  deckGrad.addColorStop(0, shade('#5a4a2a', 0.15));
  deckGrad.addColorStop(1, '#33260f');
  c.fillStyle = deckGrad;
  c.fillRect(pad.xStart, pad.y - 3, w, 8);

  // Rim light along the top edge.
  c.strokeStyle = 'rgba(244,235,218,0.25)';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(pad.xStart, pad.y - 3);
  c.lineTo(pad.xEnd, pad.y - 3);
  c.stroke();
  c.strokeStyle = '#94B03D';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(pad.xStart, pad.y - 3);
  c.lineTo(pad.xEnd, pad.y - 3);
  c.stroke();

  // Bolt dots along the face.
  c.fillStyle = 'rgba(20,12,4,0.6)';
  for (let i = 0; i < 4; i++) {
    const bx = pad.xStart + w * (0.15 + i * 0.23);
    c.beginPath();
    c.arc(bx, pad.y + 3, 1, 0, Math.PI * 2);
    c.fill();
  }

  // Support struts at the deck ends, down to the terrain.
  c.strokeStyle = '#33260f';
  c.lineWidth = 2;
  for (const sx of [pad.xStart + 2, pad.xEnd - 2]) {
    const groundY = terrainYAt(terrain.points, sx);
    if (groundY > pad.y + 5) {
      c.beginPath();
      c.moveTo(sx, pad.y + 5);
      c.lineTo(sx, groundY);
      c.stroke();
    }
  }

  // Animated approach chevrons — replaces the old static hatching.
  drawApproachChevrons(c, pad.xStart, pad.xEnd, pad.y - 3, t, 'rgba(148,176,61,0.5)');

  // Blinking beacon lights on both ends — halo now additive, radius 8.
  const blink = Math.floor(t * 2) % 2 === 0;
  for (const bx of [pad.xStart + 3, pad.xEnd - 3]) {
    c.beginPath();
    c.arc(bx, pad.y - 6, 2.2, 0, Math.PI * 2);
    c.fillStyle = blink ? '#94B03D' : '#3B2C16';
    c.fill();
    if (blink && padVisible) {
      addGlow(c, degraded, () => {
        c.beginPath();
        c.arc(bx, pad.y - 6, 8, 0, Math.PI * 2);
        c.fillStyle = 'rgba(148,176,61,0.18)';
        c.fill();
      });
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
