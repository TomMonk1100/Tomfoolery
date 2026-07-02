import type { Critter, LevelConfig, Projectile, ShipStats, Terrain, Ufo } from '../types';
import type { Asteroid } from '../entities';

// Pure render — no gameplay mutation (§4.4). Asteroid position/collision are
// computed in entities.ts::updateAsteroids/findAsteroidHit during the fixed
// physics step; this just blits the current state.
export function drawAsteroids(ctx: CanvasRenderingContext2D, asteroids: Asteroid[]) {
  const c = ctx;
  for (const a of asteroids) {
    if (!a.alive) continue;
    const { x: ax, y: ay, r } = a;
    c.beginPath();
    c.arc(ax, ay, r, 0, Math.PI * 2);
    c.fillStyle = '#5a4326';
    c.fill();
    c.strokeStyle = '#7C8F5C';
    c.lineWidth = 1;
    c.stroke();
    // craters
    c.fillStyle = 'rgba(34, 24, 8, 0.5)';
    c.beginPath(); c.arc(ax - r * 0.3, ay - r * 0.2, r * 0.22, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(ax + r * 0.35, ay + r * 0.3, r * 0.15, 0, Math.PI * 2); c.fill();
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

export function drawUfos(ctx: CanvasRenderingContext2D, ufos: Ufo[], projectiles: Projectile[], stats: ShipStats) {
  const c = ctx;
  for (const u of ufos) {
    if (!u.alive) continue;
    c.save();
    c.translate(u.x, u.y);
    c.scale(1.25, 1.25);
    if (u.telegraph > 0) {
      c.beginPath();
      c.arc(0, 4, 5 + Math.sin(performance.now() / 40) * 1.5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(201, 123, 61, 0.55)';
      c.fill();
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
    c.fillStyle = 'rgba(148, 176, 61, 0.45)';
    c.fill();
    c.strokeStyle = '#7C8F5C';
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
    c.restore();
  }

  for (const p of projectiles) {
    if (!p.alive) continue;
    c.beginPath();
    c.arc(p.x, p.y, 2.8, 0, Math.PI * 2);
    c.fillStyle = '#D9A441';
    c.shadowColor = '#C97B3D';
    c.shadowBlur = 8;
    c.fill();
    c.shadowBlur = 0;
  }
}

export function drawPad(ctx: CanvasRenderingContext2D, terrain: Terrain, cfg: LevelConfig, stats: ShipStats, t: number) {
  const c = ctx;
  const pad = terrain.pad;
  const padVisible = !cfg.fog || stats.scanner;
  const w = pad.xEnd - pad.xStart;
  c.save();
  c.globalAlpha = padVisible ? 1 : 0.25;

  // Platform deck
  const deckGrad = c.createLinearGradient(0, pad.y - 4, 0, pad.y + 4);
  deckGrad.addColorStop(0, '#5a4a2a');
  deckGrad.addColorStop(1, '#33260f');
  c.fillStyle = deckGrad;
  c.fillRect(pad.xStart, pad.y - 3, w, 6);
  c.strokeStyle = '#94B03D';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(pad.xStart, pad.y - 3);
  c.lineTo(pad.xEnd, pad.y - 3);
  c.stroke();

  // Deck hatching
  c.strokeStyle = 'rgba(148,176,61,0.35)';
  c.lineWidth = 1;
  for (let x = pad.xStart + 8; x < pad.xEnd - 4; x += 14) {
    c.beginPath();
    c.moveTo(x, pad.y - 1);
    c.lineTo(x + 6, pad.y + 2);
    c.stroke();
  }

  // Blinking beacon lights on both ends
  const blink = Math.floor(t * 2) % 2 === 0;
  for (const bx of [pad.xStart + 3, pad.xEnd - 3]) {
    c.beginPath();
    c.arc(bx, pad.y - 6, 2.2, 0, Math.PI * 2);
    c.fillStyle = blink ? '#94B03D' : '#3B2C16';
    c.fill();
    if (blink && padVisible) {
      c.beginPath();
      c.arc(bx, pad.y - 6, 5, 0, Math.PI * 2);
      c.fillStyle = 'rgba(148,176,61,0.18)';
      c.fill();
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
