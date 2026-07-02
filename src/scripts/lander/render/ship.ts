import type { FaceMap, Mood, PaintDef, ShipStats, UpgradeId } from '../types';
import { RARITY } from '../stats';
import { UPGRADES } from '../upgrades';

// §5.2: rarity color lookup for module count pips, keyed by upgrade id.
// Built once (module tables are static) rather than per-frame.
const RARITY_COLOR_BY_ID: Partial<Record<UpgradeId, string>> = {};
for (const u of UPGRADES) RARITY_COLOR_BY_ID[u.id] = RARITY[u.rarity].color;
function defaultRarityColorOf(id: UpgradeId): string {
  return RARITY_COLOR_BY_ID[id] ?? '#B9A480';
}

// §5.2: counts occurrences of each upgrade id in the picked list — this IS
// the stack count `n` that drives moduleScale(n) and the >=3 pip.
export function countStacks(pickedUpgrades: UpgradeId[]): Map<UpgradeId, number> {
  const counts = new Map<UpgradeId, number>();
  for (const id of pickedUpgrades) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

// --- Pilot face mapping -----------------------------------------------------------
// Normalized (0..1) positions of facial features within the selfie canvas.
// Filled by the FaceDetector API when the browser supports it; otherwise
// standard portrait proportions (the capture UI asks you to center your
// face, so these land close in practice).
export const DEFAULT_FACE: FaceMap = { eyeL: { x: 0.36, y: 0.42 }, eyeR: { x: 0.64, y: 0.42 }, mouth: { x: 0.5, y: 0.72 } };

export async function analyzeFace(photo: HTMLCanvasElement): Promise<FaceMap> {
  try {
    const FD = (window as any).FaceDetector;
    if (FD) {
      const detector = new FD({ maxDetectedFaces: 1, fastMode: false });
      const faces = await detector.detect(photo);
      const lm = faces?.[0]?.landmarks as { type: string; locations: { x: number; y: number }[] }[] | undefined;
      if (lm && lm.length) {
        const size = photo.width;
        const eyes = lm.filter((l) => l.type === 'eye');
        const mouth = lm.find((l) => l.type === 'mouth');
        const avg = (locs: { x: number; y: number }[]) => ({
          x: locs.reduce((a, p) => a + p.x, 0) / locs.length / size,
          y: locs.reduce((a, p) => a + p.y, 0) / locs.length / size,
        });
        if (eyes.length >= 2 && mouth) {
          const [a, b] = [avg(eyes[0].locations), avg(eyes[1].locations)];
          return {
            eyeL: a.x <= b.x ? a : b,
            eyeR: a.x <= b.x ? b : a,
            mouth: avg(mouth.locations),
          };
        }
      }
    }
  } catch (e) {
    // fall through to proportional default
  }
  return DEFAULT_FACE;
}

// Real-time expression edit on the selfie: eye/mouth regions are
// resampled from the photo and redrawn transformed inside the cockpit.
export function drawPhotoFace(
  c: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, mood: Mood,
  pilotPhoto: HTMLCanvasElement, faceMap: FaceMap
) {
  const photo = pilotPhoto;
  const ps = photo.width;
  c.drawImage(photo, x0, y0, w, h);
  if (mood === 'neutral') return;

  const eyes = [faceMap.eyeL, faceMap.eyeR];
  if (mood === 'surprised') {
    // Bulge the eyes: redraw each eye region scaled up in place
    const ew = 0.2;
    for (const eye of eyes) {
      const sx = (eye.x - ew / 2) * ps, sy = (eye.y - ew / 2) * ps, sw = ew * ps, sh = ew * ps;
      const dw = ew * w * 1.55, dh = ew * h * 1.55;
      c.drawImage(photo, sx, sy, sw, sh, x0 + eye.x * w - dw / 2, y0 + eye.y * h - dh / 2, dw, dh);
    }
    // Drop the jaw: mouth region stretched tall + dark open-mouth core
    const mw = 0.3, mh = 0.16;
    const msx = (faceMap.mouth.x - mw / 2) * ps, msy = (faceMap.mouth.y - mh / 2) * ps;
    const dw = mw * w * 0.85, dh = mh * h * 2.1;
    c.drawImage(photo, msx, msy, mw * ps, mh * ps,
      x0 + faceMap.mouth.x * w - dw / 2, y0 + faceMap.mouth.y * h - dh * 0.32, dw, dh);
    c.fillStyle = 'rgba(30, 14, 8, 0.85)';
    c.beginPath();
    c.ellipse(x0 + faceMap.mouth.x * w, y0 + faceMap.mouth.y * h + dh * 0.18, w * 0.065, h * 0.085, 0, 0, Math.PI * 2);
    c.fill();
  } else if (mood === 'happy') {
    // Squinted smiling eyes: eye regions squashed vertically
    const ew = 0.18;
    for (const eye of eyes) {
      const sx = (eye.x - ew / 2) * ps, sy = (eye.y - ew / 2) * ps, sw = ew * ps, sh = ew * ps;
      const dw = ew * w * 1.15, dh = ew * h * 0.6;
      c.drawImage(photo, sx, sy, sw, sh, x0 + eye.x * w - dw / 2, y0 + eye.y * h - dh / 2 + h * 0.012, dw, dh);
    }
    // Smile: mouth strip redrawn in three slices, corners lifted
    const mw = 0.32, mh = 0.13;
    const msx = (faceMap.mouth.x - mw / 2) * ps, msy = (faceMap.mouth.y - mh / 2) * ps;
    const sliceW = (mw * ps) / 3;
    const dSliceW = (mw * w * 1.12) / 3;
    const lift = [-0.035, 0.008, -0.035];
    for (let i = 0; i < 3; i++) {
      c.drawImage(photo, msx + i * sliceW, msy, sliceW, mh * ps,
        x0 + faceMap.mouth.x * w - (dSliceW * 3) / 2 + i * dSliceW,
        y0 + (faceMap.mouth.y + lift[i]) * h - (mh * h) / 2,
        dSliceW, mh * h);
    }
  }
}

// Cartoon face for the default (no-selfie) pilot — same moods.
export function drawDefaultPilot(c: CanvasRenderingContext2D, cockCY: number, cockR: number, mood: Mood) {
  // helmet
  c.fillStyle = 'rgba(34, 24, 8, 0.85)';
  c.beginPath();
  c.arc(0, cockCY + 0.4, cockR * 0.62, 0, Math.PI * 2);
  c.fill();
  // face plate
  c.fillStyle = '#E8D9BC';
  c.beginPath();
  c.arc(0, cockCY + 0.6, cockR * 0.46, 0, Math.PI * 2);
  c.fill();
  const ex = cockR * 0.2, ey = cockCY + 0.25;
  c.fillStyle = '#221808';
  if (mood === 'surprised') {
    c.beginPath(); c.arc(-ex, ey, cockR * 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(ex, ey, cockR * 0.12, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0, cockCY + cockR * 0.28, cockR * 0.1, cockR * 0.15, 0, 0, Math.PI * 2); c.fill();
  } else if (mood === 'happy') {
    c.strokeStyle = '#221808';
    c.lineWidth = cockR * 0.07;
    c.beginPath(); c.arc(-ex, ey + 0.02 * cockR, cockR * 0.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.beginPath(); c.arc(ex, ey + 0.02 * cockR, cockR * 0.1, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    c.beginPath(); c.arc(0, cockCY + cockR * 0.18, cockR * 0.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  } else {
    c.beginPath(); c.arc(-ex, ey, cockR * 0.07, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(ex, ey, cockR * 0.07, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#221808';
    c.lineWidth = cockR * 0.06;
    c.beginPath();
    c.moveTo(-cockR * 0.12, cockCY + cockR * 0.32);
    c.lineTo(cockR * 0.12, cockCY + cockR * 0.32);
    c.stroke();
  }
}

// §5.2: linear, unbounded per-stack growth. n=1 -> 1.0x (no visible change
// from the legacy single-pick art), each additional stack +30%. Intentionally
// uncapped — "ludicrous late-run ships that dwarf the hull" is desired
// behavior per plan §5.2/§10 item 2, not a bug to guard against.
export function moduleScale(n: number): number {
  return 1 + 0.3 * Math.max(0, n - 1);
}

// Draws `drawFn` (module art in ship-local coordinates) scaled by
// moduleScale(n) anchored at (anchorX, anchorY) — the module's attachment
// point on the hull — so growth extends outward from that point rather than
// from the ship's origin. A module whose attachment sits, say, at the flank
// (anchorX far from 0) will visibly grow away from the cockpit, never over
// it (§10 item 2). At n>=3 a small "xn" count pip is drawn next to the
// anchor in the upgrade's rarity color.
function drawModule(
  c: CanvasRenderingContext2D, n: number, anchorX: number, anchorY: number,
  rarityColor: string, drawFn: () => void
) {
  if (n <= 0) return;
  const k = moduleScale(n);
  c.save();
  c.translate(anchorX, anchorY);
  c.scale(k, k);
  c.translate(-anchorX, -anchorY);
  drawFn();
  c.restore();
  if (n >= 3) {
    c.save();
    c.font = '2.6px "JetBrains Mono", monospace';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const px = anchorX + (anchorX >= 0 ? 1 : -1) * (2.2 + 1.4 * (k - 1)) - (anchorX < 0 ? 3.2 : 0);
    const py = anchorY;
    c.fillStyle = 'rgba(23,16,9,0.75)';
    c.fillRect(px - 0.4, py - 1.6, 3.6, 3.2);
    c.fillStyle = rarityColor;
    c.fillText(`×${n}`, px, py);
    c.restore();
  }
}

// Visible hardware for each owned upgrade — the ship literally builds
// out as the run goes on. All drawn in ship-local units (pre-scaled).
// §5.2: `stackCounts` gives the pick count per owned upgrade id (n) so each
// module can be scaled via moduleScale(n) and pipped at n>=3. `rarityColor`
// maps an upgrade id to its rarity's display color (for the pip).
export function drawShipModules(
  c: CanvasRenderingContext2D,
  pickedUpgrades: UpgradeId[],
  stats: ShipStats,
  stackCounts?: Map<UpgradeId, number>,
  rarityColorOf: (id: UpgradeId) => string = defaultRarityColorOf
) {
  const owned = new Set(pickedUpgrades);
  const t = performance.now() / 1000;
  const counts = stackCounts ?? countStacks(pickedUpgrades);
  const n = (id: UpgradeId) => counts.get(id) ?? (owned.has(id) ? 1 : 0);

  if (owned.has('fuel_tank')) {
    const stacks = n('fuel_tank');
    const color = rarityColorOf('fuel_tank');
    // Saddle tanks on both flanks — each anchored to its own flank so
    // growth pushes outward, away from the hull centerline/cockpit.
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8.9, 2.6, color, () => {
        c.fillStyle = '#D9C6A3';
        c.strokeStyle = '#8a6a3c';
        c.lineWidth = 0.6;
        c.beginPath();
        c.ellipse(side * 8.9, 2.6, 1.5, 3.4, side * 0.12, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      });
    }
  }
  if (owned.has('boost_thrusters')) {
    const stacks = n('boost_thrusters');
    const color = rarityColorOf('boost_thrusters');
    // Twin auxiliary nozzles beside the main engine — anchored at the
    // engine skirt (below the hull), so growth pushes further down/out.
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 3.9, 8.4, color, () => {
        c.fillStyle = '#221808';
        c.beginPath();
        c.moveTo(side * 3.4, 7);
        c.lineTo(side * 5.4, 9.6);
        c.lineTo(side * 2.4, 8.6);
        c.closePath();
        c.fill();
      });
    }
  }
  if (owned.has('magnetic_pad')) {
    drawModule(c, n('magnetic_pad'), 0, 10, rarityColorOf('magnetic_pad'), () => {
      // Horseshoe magnet under the belly
      c.strokeStyle = '#C97B3D';
      c.lineWidth = 1.2;
      c.beginPath();
      c.arc(0, 9.4, 2.2, Math.PI, 0);
      c.stroke();
      c.strokeStyle = '#F4EBDA';
      c.beginPath(); c.moveTo(-2.2, 9.4); c.lineTo(-2.2, 10.6); c.stroke();
      c.beginPath(); c.moveTo(2.2, 9.4); c.lineTo(2.2, 10.6); c.stroke();
    });
  }
  if (owned.has('gyro')) {
    drawModule(c, n('gyro'), 0, 0.5, rarityColorOf('gyro'), () => {
      // Slowly spinning stabilizer ring around the midsection
      c.save();
      c.strokeStyle = 'rgba(148, 176, 61, 0.55)';
      c.lineWidth = 0.9;
      c.setLineDash([3, 4]);
      c.lineDashOffset = -t * 9;
      c.beginPath();
      c.ellipse(0, 0.5, 10.8, 3.4, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    });
  }
  if (owned.has('gravity_anchor')) {
    drawModule(c, n('gravity_anchor'), 0, 11, rarityColorOf('gravity_anchor'), () => {
      // Tiny anchor slung under the hull
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(0, 8.6); c.lineTo(0, 12); c.stroke();
      c.beginPath(); c.arc(0, 11.6, 1.6, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      c.beginPath(); c.arc(0, 9, 0.55, 0, Math.PI * 2); c.stroke();
    });
  }
  if (owned.has('scanner')) {
    drawModule(c, n('scanner'), 6.8, -9.4, rarityColorOf('scanner'), () => {
      // Shoulder dish, tilted skyward
      c.save();
      c.translate(6.8, -9.4);
      c.rotate(-0.5);
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, 2.4); c.lineTo(0, 0.6); c.stroke();
      c.fillStyle = '#D9C6A3';
      c.beginPath(); c.ellipse(0, 0, 2.2, 0.9, 0, 0, Math.PI); c.fill();
      c.fillStyle = '#94B03D';
      c.beginPath(); c.arc(0, -0.6, 0.5, 0, Math.PI * 2); c.fill();
      c.restore();
    });
  }
  if (owned.has('feather_gear')) {
    const stacks = n('feather_gear');
    const color = rarityColorOf('feather_gear');
    // Feather tufts on the landing struts
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8, 8, color, () => {
        c.strokeStyle = 'rgba(244, 235, 218, 0.85)';
        c.lineWidth = 0.7;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(side * (7.6 + i * 0.8), 9.4);
          c.quadraticCurveTo(side * (8.4 + i * 0.8), 8, side * (8 + i * 0.8), 6.6 + i * 0.4);
          c.stroke();
        }
      });
    }
  }
  if (owned.has('reserve_chute')) {
    drawModule(c, n('reserve_chute'), -8.7, -2.6, rarityColorOf('reserve_chute'), () => {
      // Chute pack strapped to the left flank
      c.fillStyle = '#C97B3D';
      c.strokeStyle = '#8a4a20';
      c.lineWidth = 0.6;
      c.beginPath();
      c.ellipse(-8.7, -2.6, 1.6, 2.5, -0.15, 0, Math.PI * 2);
      c.fill(); c.stroke();
      c.strokeStyle = 'rgba(244,235,218,0.6)';
      c.beginPath(); c.moveTo(-9.8, -3.6); c.lineTo(-7.6, -1.4); c.stroke();
    });
  }
  if (owned.has('storm_dampeners')) {
    const stacks = n('storm_dampeners');
    const color = rarityColorOf('storm_dampeners');
    // Vent slats on both flanks
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8.4, 0.5, color, () => {
        c.strokeStyle = '#7C8F5C';
        c.lineWidth = 0.8;
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(side * 7.6, -0.4 + i * 1.5);
          c.lineTo(side * 9.2, 0.2 + i * 1.5);
          c.stroke();
        }
      });
    }
  }
  if (owned.has('fuel_scoop')) {
    drawModule(c, n('fuel_scoop'), 0, -14.6, rarityColorOf('fuel_scoop'), () => {
      // Intake ring on the nose
      c.strokeStyle = '#B9A480';
      c.lineWidth = 1;
      c.beginPath();
      c.ellipse(0, -14.6, 2.6, 1, 0, 0, Math.PI * 2);
      c.stroke();
    });
  }
  if (owned.has('precision_jets')) {
    const stacks = n('precision_jets');
    const color = rarityColorOf('precision_jets');
    // RCS thruster pods at four corners
    for (const [px, py] of [[-6.6, -8.5], [6.6, -8.5], [-7.4, 3.6], [7.4, 3.6]] as [number, number][]) {
      drawModule(c, stacks, px, py, color, () => {
        c.fillStyle = '#F4EBDA';
        c.beginPath(); c.arc(px, py, 0.7, 0, Math.PI * 2); c.fill();
      });
    }
  }
  if (owned.has('jalapeno_injectors')) {
    drawModule(c, n('jalapeno_injectors'), 4.9, 2.4, rarityColorOf('jalapeno_injectors'), () => {
      // A proud little jalapeño painted on the hull
      c.save();
      c.translate(4.9, 2.4);
      c.rotate(0.5);
      c.fillStyle = '#94B03D';
      c.beginPath();
      c.ellipse(0, 0, 0.9, 2, 0, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#5C7642';
      c.lineWidth = 0.5;
      c.beginPath(); c.moveTo(0, -2); c.lineTo(0.5, -2.9); c.stroke();
      c.restore();
    });
  }
  if (owned.has('boomerang_hull')) {
    drawModule(c, n('boomerang_hull'), 0, 5, rarityColorOf('boomerang_hull'), () => {
      // Boomerang chevron across the lower hull
      c.strokeStyle = '#D9A441';
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(-5.4, 4);
      c.lineTo(0, 6.4);
      c.lineTo(5.4, 4);
      c.stroke();
    });
  }
  if (owned.has('alien_diplomacy')) {
    drawModule(c, n('alien_diplomacy'), -7.2, -16.4, rarityColorOf('alien_diplomacy'), () => {
      // Embassy antenna with a softly pulsing green orb
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(-4.6, -11.4); c.lineTo(-7.2, -16.4); c.stroke();
      const pulse = 0.7 + Math.sin(t * 3) * 0.3;
      c.fillStyle = `rgba(148, 176, 61, ${pulse})`;
      c.beginPath(); c.arc(-7.2, -16.9, 1, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('chrono_crystal')) {
    // A pale crystal orbiting the ship. Orbit radius (and each crystal
    // symbol's own scale) grows per stack — anchored at the ship origin
    // since it orbits rather than attaches to a fixed hull point.
    const stacks = n('chrono_crystal');
    const oa = t * 1.4;
    const orbitR = 14.5 + 2 * (stacks - 1);
    const ox = Math.cos(oa) * orbitR;
    const oy = Math.sin(oa) * orbitR - 2;
    const k = moduleScale(stacks);
    c.save();
    c.translate(ox, oy);
    c.rotate(oa);
    c.scale(k, k);
    c.fillStyle = 'rgba(123, 167, 199, 0.9)';
    c.beginPath();
    c.moveTo(0, -2); c.lineTo(1.2, 0); c.lineTo(0, 2); c.lineTo(-1.2, 0);
    c.closePath();
    c.fill();
    c.restore();
    if (stacks >= 3) {
      c.save();
      c.font = '2.6px "JetBrains Mono", monospace';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillStyle = 'rgba(23,16,9,0.75)';
      c.fillRect(ox + 1.8, oy - 1.6, 3.6, 3.2);
      c.fillStyle = rarityColorOf('chrono_crystal');
      c.fillText(`×${stacks}`, ox + 2, oy);
      c.restore();
    }
  }
  if (owned.has('overdrive_core')) {
    drawModule(c, n('overdrive_core'), 0, 3.4, rarityColorOf('overdrive_core'), () => {
      // Hot core glowing through a lower-hull porthole
      const glow = 0.55 + Math.sin(t * 5) * 0.25;
      c.fillStyle = `rgba(201, 90, 40, ${glow})`;
      c.beginPath(); c.arc(0, 3.4, 1.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#221808';
      c.lineWidth = 0.6;
      c.beginPath(); c.arc(0, 3.4, 1.5, 0, Math.PI * 2); c.stroke();
    });
  }
  if (owned.has('phoenix_feather')) {
    drawModule(c, n('phoenix_feather'), -4.9, 2.2, rarityColorOf('phoenix_feather'), () => {
      // Gold feather decal
      c.save();
      c.translate(-4.9, 2.2);
      c.rotate(-0.55);
      c.strokeStyle = '#FFC94A';
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(0, 2); c.quadraticCurveTo(1.4, -0.5, 0.3, -2.4); c.stroke();
      for (let i = 0; i < 3; i++) {
        c.beginPath();
        c.moveTo(0.45 - i * 0.1, -1.6 + i * 1.1);
        c.lineTo(-0.9, -1 + i * 1.1);
        c.stroke();
      }
      c.restore();
    });
  }
  if (owned.has('star_core')) {
    // Four-point star twinkling at the nose — grows per stack, anchored at
    // the nose tip so it extends further forward/outward, not into the
    // cockpit which sits below it.
    drawModule(c, n('star_core'), 0, -16.6, rarityColorOf('star_core'), () => {
      c.save();
      c.translate(0, -16.6);
      c.rotate(t * 0.8);
      c.fillStyle = '#FFC94A';
      c.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 === 0 ? 1.9 : 0.65;
        const a = (i / 8) * Math.PI * 2;
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      c.closePath();
      c.fill();
      c.restore();
    });
  }
  // ---------------------------------------------------------------------
  // lander-v10 commit 4b (§7): visual modules for the 50 new upgrades.
  // Every module uses drawModule/moduleScale so it grows per-stack and
  // gets the x>=3 count pip, matching the pattern established above.
  // ---------------------------------------------------------------------

  // --- Common (10 new) ---
  if (owned.has('lightweight_alloy')) {
    drawModule(c, n('lightweight_alloy'), 0, -2, rarityColorOf('lightweight_alloy'), () => {
      // lattice panel lines on hull
      c.strokeStyle = 'rgba(217, 164, 65, 0.55)';
      c.lineWidth = 0.5;
      for (let i = -2; i <= 2; i++) {
        c.beginPath(); c.moveTo(-6.5 + i * 2.6, -8); c.lineTo(-6.5 + i * 2.6 + 4, 4); c.stroke();
      }
    });
  }
  if (owned.has('wide_legs')) {
    const stacks = n('wide_legs');
    const color = rarityColorOf('wide_legs');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 11, 10.5, color, () => {
        // splayed longer legs
        c.strokeStyle = '#8a6a3c';
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(side * 5.5, 6); c.lineTo(side * 11.5, 10.5); c.stroke();
        c.beginPath(); c.moveTo(side * 13, 10.5); c.lineTo(side * 10, 10.5); c.stroke();
      });
    }
  }
  if (owned.has('fuel_lines')) {
    drawModule(c, n('fuel_lines'), 6.5, 4, rarityColorOf('fuel_lines'), () => {
      // copper piping along flank
      c.strokeStyle = '#C97B3D';
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(3.5, -6); c.lineTo(7.5, 0); c.lineTo(6, 7); c.stroke();
    });
  }
  if (owned.has('bumper_skids')) {
    drawModule(c, n('bumper_skids'), 0, 10.4, rarityColorOf('bumper_skids'), () => {
      // sled rails under feet
      c.strokeStyle = '#B9A480';
      c.lineWidth = 1.1;
      c.beginPath(); c.moveTo(-10.8, 10.4); c.lineTo(10.8, 10.4); c.stroke();
    });
  }
  if (owned.has('trim_flaps')) {
    const stacks = n('trim_flaps');
    const color = rarityColorOf('trim_flaps');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 9.5, -6, color, () => {
        // small winglets
        c.fillStyle = '#7C8F5C';
        c.beginPath();
        c.moveTo(side * 7.5, -7); c.lineTo(side * 10.5, -6); c.lineTo(side * 7.5, -4.5);
        c.closePath(); c.fill();
      });
    }
  }
  if (owned.has('solar_wings')) {
    const stacks = n('solar_wings');
    const color = rarityColorOf('solar_wings');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 13, -1, color, () => {
        // fold-out gold panels
        c.fillStyle = 'rgba(255, 233, 176, 0.85)';
        c.strokeStyle = '#D9A441';
        c.lineWidth = 0.5;
        c.fillRect(side * 9, -4, side * 8, 6);
        c.strokeRect(side * 9, -4, side * 8, 6);
      });
    }
  }
  if (owned.has('landing_lights')) {
    const stacks = n('landing_lights');
    const color = rarityColorOf('landing_lights');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 6, 9, color, () => {
        // twin lamps, light cones at low alt
        c.fillStyle = '#F4EBDA';
        c.beginPath(); c.arc(side * 6, 9, 0.8, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(244,235,218,0.18)';
        c.beginPath();
        c.moveTo(side * 6, 9); c.lineTo(side * 3, 15); c.lineTo(side * 9, 15);
        c.closePath(); c.fill();
      });
    }
  }
  if (owned.has('sticky_pads')) {
    const stacks = n('sticky_pads');
    const color = rarityColorOf('sticky_pads');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8, 10.6, color, () => {
        // goo drips on feet
        c.fillStyle = 'rgba(148, 176, 61, 0.7)';
        c.beginPath(); c.ellipse(side * 8, 10.6, 1.1, 1.6, 0, 0, Math.PI * 2); c.fill();
      });
    }
  }
  if (owned.has('nimble_fins')) {
    const stacks = n('nimble_fins');
    const color = rarityColorOf('nimble_fins');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 9.5, 6.5, color, () => {
        // extra fin pair
        c.fillStyle = '#7BA7C7';
        c.beginPath();
        c.moveTo(side * 7, 6); c.lineTo(side * 11, 8); c.lineTo(side * 7.5, 9.4);
        c.closePath(); c.fill();
      });
    }
  }
  if (owned.has('drop_tanks')) {
    const stacks = n('drop_tanks');
    const color = rarityColorOf('drop_tanks');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 10.5, 5, color, () => {
        // outboard cylinders that detach
        c.fillStyle = '#5a4326';
        c.strokeStyle = '#3B2C16';
        c.lineWidth = 0.6;
        c.beginPath(); c.ellipse(side * 10.5, 5, 1.4, 4, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      });
    }
  }

  // --- Uncommon (10 new) ---
  if (owned.has('air_brakes')) {
    drawModule(c, n('air_brakes'), 0, 6, rarityColorOf('air_brakes'), () => {
      // popped flaps when active
      c.strokeStyle = '#C97B3D';
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-7.5, 5.5); c.lineTo(-9.5, 3.5); c.stroke();
      c.beginPath(); c.moveTo(7.5, 5.5); c.lineTo(9.5, 3.5); c.stroke();
    });
  }
  if (owned.has('kick_thrusters')) {
    const stacks = n('kick_thrusters');
    const color = rarityColorOf('kick_thrusters');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8.6, 1, color, () => {
        // angled side nozzles
        c.fillStyle = '#221808';
        c.beginPath();
        c.moveTo(side * 7.6, -0.5); c.lineTo(side * 10, 1); c.lineTo(side * 7.6, 2.5);
        c.closePath(); c.fill();
      });
    }
  }
  if (owned.has('tractor_winch')) {
    drawModule(c, n('tractor_winch'), 0, 9.5, rarityColorOf('tractor_winch'), () => {
      // belly winch spool
      c.fillStyle = '#8a6a3c';
      c.beginPath(); c.arc(0, 9.5, 1.6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#3B2C16';
      c.lineWidth = 0.4;
      c.beginPath(); c.arc(0, 9.5, 1.6, 0, Math.PI * 2); c.stroke();
    });
  }
  if (owned.has('cloud_seeder')) {
    drawModule(c, n('cloud_seeder'), 0, -14.8, rarityColorOf('cloud_seeder'), () => {
      // tiny cloud puffer on nose
      c.fillStyle = 'rgba(185, 164, 128, 0.55)';
      c.beginPath(); c.arc(-0.8, -14.8, 0.9, 0, Math.PI * 2); c.arc(0.8, -14.8, 1.1, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('vampire_coils')) {
    drawModule(c, n('vampire_coils'), -6.8, -1, rarityColorOf('vampire_coils'), () => {
      // red coil windings
      c.save();
      c.strokeStyle = '#C97B3D';
      c.lineWidth = 0.7;
      c.setLineDash([1.4, 1]);
      c.beginPath(); c.ellipse(-6.8, -1, 1.5, 3.4, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    });
  }
  if (owned.has('lucky_antenna')) {
    drawModule(c, n('lucky_antenna'), 5, -15.5, rarityColorOf('lucky_antenna'), () => {
      // clover-tipped antenna
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(4, -12.5); c.lineTo(5, -15.5); c.stroke();
      c.fillStyle = '#94B03D';
      for (const [dx, dy] of [[-0.6, -16], [0.6, -16], [0, -16.9]] as [number, number][]) {
        c.beginPath(); c.arc(5 + dx, dy, 0.55, 0, Math.PI * 2); c.fill();
      }
    });
  }
  if (owned.has('stardust_condenser')) {
    drawModule(c, n('stardust_condenser'), 0, 4.6, rarityColorOf('stardust_condenser'), () => {
      // sparkling filter box
      const pulse = 0.5 + Math.sin(t * 4) * 0.3;
      c.fillStyle = `rgba(255, 201, 74, ${pulse})`;
      c.fillRect(-1.6, 3.6, 3.2, 2);
      c.strokeStyle = '#8a6a3c';
      c.lineWidth = 0.4;
      c.strokeRect(-1.6, 3.6, 3.2, 2);
    });
  }
  if (owned.has('echo_altimeter')) {
    drawModule(c, n('echo_altimeter'), -6.8, -10, rarityColorOf('echo_altimeter'), () => {
      // sonar cone pings at low alt
      c.strokeStyle = 'rgba(216, 196, 232, 0.7)';
      c.lineWidth = 0.6;
      const r = 1.4 + (Math.sin(t * 3) * 0.5 + 0.5) * 1.4;
      c.beginPath(); c.arc(-6.8, -10, r, 0, Math.PI * 2); c.stroke();
    });
  }
  if (owned.has('gecko_struts')) {
    const stacks = n('gecko_struts');
    const color = rarityColorOf('gecko_struts');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8.4, 10.6, color, () => {
        // green toe-pad feet
        c.fillStyle = '#94B03D';
        for (let i = -1; i <= 1; i++) {
          c.beginPath(); c.ellipse(side * 8.4 + i * 0.8, 10.6, 0.5, 0.8, 0, 0, Math.PI * 2); c.fill();
        }
      });
    }
  }
  if (owned.has('bounce_bumpers')) {
    drawModule(c, n('bounce_bumpers'), 0, 1, rarityColorOf('bounce_bumpers'), () => {
      // inflatable side rings
      c.strokeStyle = 'rgba(123, 167, 199, 0.6)';
      c.lineWidth = 1.6;
      c.beginPath(); c.ellipse(0, 1, 10.5, 8.5, 0, 0, Math.PI * 2); c.stroke();
    });
  }

  // --- Rare (10 new) ---
  if (owned.has('spaghetti_engine')) {
    drawModule(c, n('spaghetti_engine'), 0, 9.6, rarityColorOf('spaghetti_engine'), () => {
      // pasta pot with lid that rattles (amplitude driven by a fast sine —
      // reads as "rattling" continuously since the pot is always over a
      // hot engine; no direct thrust-state plumbed into this draw call).
      const rattle = Math.sin(t * 30) * 0.3;
      c.fillStyle = '#7C8F5C';
      c.beginPath(); c.ellipse(0, 9.6 + rattle, 2.4, 1.4, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#3B2C16';
      c.lineWidth = 0.4;
      c.beginPath(); c.ellipse(0, 9.6 + rattle, 2.4, 1.4, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 8.6 + rattle, 0.5, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('grappling_hook')) {
    drawModule(c, n('grappling_hook'), -8.8, 3, rarityColorOf('grappling_hook'), () => {
      // coiled harpoon gun
      c.fillStyle = '#221808';
      c.fillRect(-10, 2, 2.6, 1.6);
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.5;
      c.beginPath(); c.arc(-8.8, 3, 1.3, 0, Math.PI * 1.5); c.stroke();
    });
  }
  if (owned.has('hover_module')) {
    drawModule(c, n('hover_module'), 0, 12, rarityColorOf('hover_module'), () => {
      // blue underglow disc
      const pulse = 0.35 + Math.sin(t * 5) * 0.2;
      c.fillStyle = `rgba(123, 167, 199, ${pulse})`;
      c.beginPath(); c.ellipse(0, 12, 6, 2, 0, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('asteroid_miner')) {
    drawModule(c, n('asteroid_miner'), 8.6, 2, rarityColorOf('asteroid_miner'), () => {
      // pick-arm on flank
      c.strokeStyle = '#B9A480';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(7, 1); c.lineTo(9.6, 3.4); c.stroke();
      c.beginPath(); c.moveTo(9.6, 3.4); c.lineTo(10.6, 1.6); c.moveTo(9.6, 3.4); c.lineTo(11, 4); c.stroke();
    });
  }
  if (owned.has('ufo_hacker')) {
    drawModule(c, n('ufo_hacker'), 6, -12.4, rarityColorOf('ufo_hacker'), () => {
      // dish with green code-rain glow
      c.strokeStyle = '#94B03D';
      c.lineWidth = 0.6;
      c.beginPath(); c.ellipse(6, -12.4, 1.8, 0.8, 0.3, 0, Math.PI * 2); c.stroke();
      const glow = 0.4 + Math.sin(t * 8) * 0.3;
      c.fillStyle = `rgba(148, 176, 61, ${Math.max(0, glow)})`;
      c.fillRect(5.2, -13.4, 1.6, 1.6);
    });
  }
  if (owned.has('bubble_wrap')) {
    drawModule(c, n('bubble_wrap'), 0, 0, rarityColorOf('bubble_wrap'), () => {
      // bubble sheen over hull
      c.fillStyle = 'rgba(168, 216, 232, 0.25)';
      for (const [bx, by] of [[-4, -6], [3, -3], [-2, 2], [4, 5], [-5, 6]] as [number, number][]) {
        c.beginPath(); c.arc(bx, by, 1.1, 0, Math.PI * 2); c.fill();
      }
    });
  }
  if (owned.has('magnet_storm')) {
    drawModule(c, n('magnet_storm'), 0, -10.5, rarityColorOf('magnet_storm'), () => {
      // crackling coil crown
      c.save();
      c.strokeStyle = '#7BA7C7';
      c.lineWidth = 0.7;
      c.rotate(t * 2);
      c.beginPath(); c.arc(0, -10.5, 3.2, 0, Math.PI * 1.4); c.stroke();
      c.restore();
    });
  }
  if (owned.has('tailwind_turbine')) {
    drawModule(c, n('tailwind_turbine'), 0, -5, rarityColorOf('tailwind_turbine'), () => {
      // spinning turbine (spins with wind)
      c.save();
      c.translate(0, -5);
      c.rotate(t * 6);
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.6;
      for (let i = 0; i < 4; i++) {
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos((i / 4) * Math.PI * 2) * 2, Math.sin((i / 4) * Math.PI * 2) * 2); c.stroke();
      }
      c.restore();
    });
  }
  if (owned.has('moon_cheese_drill')) {
    drawModule(c, n('moon_cheese_drill'), 0, -16.8, rarityColorOf('moon_cheese_drill'), () => {
      // corkscrew drill nose
      c.strokeStyle = '#D9A441';
      c.lineWidth = 0.9;
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const yy = -14.5 - i * 0.7;
        c.moveTo(-1.1, yy); c.lineTo(1.1, yy - 0.35);
      }
      c.stroke();
    });
  }
  if (owned.has('swarm_drones')) {
    // Extra orbiting drones — actual pooled drone entities are drawn via
    // drawDrones() in render/world.ts (stats.droneCharges); this hull
    // module is the small "hive" marker on the ship itself.
    drawModule(c, n('swarm_drones'), 0, 6.5, rarityColorOf('swarm_drones'), () => {
      c.fillStyle = '#D9A441';
      c.strokeStyle = '#221808';
      c.lineWidth = 0.4;
      c.beginPath(); c.arc(0, 6.5, 1.3, 0, Math.PI * 2); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-1.3, 6.5); c.lineTo(1.3, 6.5); c.stroke();
    });
  }

  // --- Epic (10 new) ---
  if (owned.has('wormhole_pocket')) {
    drawModule(c, n('wormhole_pocket'), 0, 2, rarityColorOf('wormhole_pocket'), () => {
      // purple vortex ring on hull
      c.save();
      c.strokeStyle = '#B07BD6';
      c.lineWidth = 1;
      c.rotate(t * 2.5);
      c.beginPath(); c.ellipse(0, 2, 3, 1.4, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    });
  }
  if (owned.has('gravity_flip')) {
    drawModule(c, n('gravity_flip'), 0, 7, rarityColorOf('gravity_flip'), () => {
      // inverted pendulum gizmo
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.6;
      const swing = Math.sin(t * 2) * 0.5;
      c.beginPath(); c.moveTo(0, 5.6); c.lineTo(swing * 3, 8); c.stroke();
      c.beginPath(); c.arc(swing * 3, 8, 0.6, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('midas_hull')) {
    drawModule(c, n('midas_hull'), 0, -3, rarityColorOf('midas_hull'), () => {
      // hull turns progressively gold
      const stacks = n('midas_hull');
      c.fillStyle = `rgba(255, 201, 74, ${Math.min(0.55, 0.15 * stacks)})`;
      c.beginPath();
      c.moveTo(0, -13); c.bezierCurveTo(5.5, -13, 7.5, -7, 6.8, 0);
      c.lineTo(0, 4.5); c.lineTo(-6.8, 0); c.bezierCurveTo(-7.5, -7, -5.5, -13, 0, -13);
      c.closePath(); c.fill();
    });
  }
  if (owned.has('quantum_duplicate')) {
    // Ghost ship itself is drawn separately (drawGhostShip); the hull
    // marker here is a small mirrored-silhouette decal.
    drawModule(c, n('quantum_duplicate'), 8, -3, rarityColorOf('quantum_duplicate'), () => {
      c.save();
      c.globalAlpha = 0.5;
      c.fillStyle = '#B8C4D4';
      c.beginPath(); c.ellipse(8, -3, 1.4, 2.6, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    });
  }
  if (owned.has('storm_caller')) {
    drawModule(c, n('storm_caller'), 0, -17.4, rarityColorOf('storm_caller'), () => {
      // storm-cloud crown with mini lightning
      c.fillStyle = 'rgba(94, 107, 126, 0.75)';
      c.beginPath(); c.ellipse(0, -17.4, 3, 1.4, 0, 0, Math.PI * 2); c.fill();
      if (Math.sin(t * 9) > 0.85) {
        c.strokeStyle = '#FFE9B0';
        c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(-0.5, -17); c.lineTo(0.4, -15.6); c.lineTo(-0.2, -15.6); c.lineTo(0.6, -14); c.stroke();
      }
    });
  }
  if (owned.has('time_bank')) {
    drawModule(c, n('time_bank'), -7, 5, rarityColorOf('time_bank'), () => {
      // hourglass gauge on hull
      c.strokeStyle = '#B07BD6';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(-8, 3.6); c.lineTo(-6, 3.6); c.lineTo(-7, 5); c.lineTo(-6, 6.4); c.lineTo(-8, 6.4); c.lineTo(-7, 5); c.closePath();
      c.stroke();
    });
  }
  if (owned.has('terraformer')) {
    drawModule(c, n('terraformer'), 0, 10.8, rarityColorOf('terraformer'), () => {
      // plow blade + dust jets
      c.fillStyle = '#8a6a3c';
      c.beginPath(); c.moveTo(-5, 10.4); c.lineTo(5, 10.4); c.lineTo(3.2, 12); c.lineTo(-3.2, 12); c.closePath(); c.fill();
    });
  }
  if (owned.has('singularity_anchor')) {
    drawModule(c, n('singularity_anchor'), 0, 4, rarityColorOf('singularity_anchor'), () => {
      // tiny black orb with accretion ring
      c.fillStyle = '#0a0a12';
      c.beginPath(); c.arc(0, 4, 1.3, 0, Math.PI * 2); c.fill();
      c.save();
      c.strokeStyle = 'rgba(176, 123, 214, 0.6)';
      c.lineWidth = 0.5;
      c.rotate(t * 3);
      c.beginPath(); c.ellipse(0, 4, 2.6, 1, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
    });
  }
  if (owned.has('nano_repair')) {
    drawModule(c, n('nano_repair'), 0, 0, rarityColorOf('nano_repair'), () => {
      // silver mist shimmer
      const shimmer = 0.15 + Math.sin(t * 6) * 0.1;
      c.fillStyle = `rgba(216, 216, 224, ${Math.max(0, shimmer)})`;
      c.beginPath(); c.ellipse(0, 0, 8.5, 12, 0, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('rocket_skates')) {
    const stacks = n('rocket_skates');
    const color = rarityColorOf('rocket_skates');
    for (const side of [-1, 1]) {
      drawModule(c, stacks, side * 8, 10.8, color, () => {
        // wheeled skates on feet, sparks on slide
        c.fillStyle = '#221808';
        c.fillRect(side * 6.6, 10.2, side * 3, 1.2);
        c.fillStyle = '#B9A480';
        c.beginPath(); c.arc(side * 7, 11.4, 0.6, 0, Math.PI * 2); c.arc(side * 9, 11.4, 0.6, 0, Math.PI * 2); c.fill();
      });
    }
  }

  // --- Legendary (10 new) ---
  if (owned.has('black_hole_engine')) {
    drawModule(c, n('black_hole_engine'), 0, 8.5, rarityColorOf('black_hole_engine'), () => {
      // warping dark vortex nozzle
      c.save();
      c.rotate(t * 4);
      const grad = c.createRadialGradient(0, 8.5, 0.2, 0, 8.5, 2.6);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(1, 'rgba(59, 44, 22, 0)');
      c.fillStyle = grad;
      c.beginPath(); c.arc(0, 8.5, 2.6, 0, Math.PI * 2); c.fill();
      c.restore();
    });
  }
  if (owned.has('golden_goose')) {
    drawModule(c, n('golden_goose'), 6.5, -4, rarityColorOf('golden_goose'), () => {
      // goose in a porthole; egg pops out on landing
      c.strokeStyle = '#D9A441';
      c.lineWidth = 0.6;
      c.beginPath(); c.arc(6.5, -4, 1.8, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#F4EBDA';
      c.beginPath(); c.ellipse(6.5, -4, 1, 1.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#D9A441';
      c.beginPath(); c.moveTo(7.3, -4.4); c.lineTo(8.2, -4.1); c.lineTo(7.3, -3.8); c.closePath(); c.fill();
    });
  }
  if (owned.has('cosmic_dice')) {
    drawModule(c, n('cosmic_dice'), -8, 6, rarityColorOf('cosmic_dice'), () => {
      // giant fuzzy dice hanging off hull
      const swing = Math.sin(t * 1.6) * 0.3;
      c.save();
      c.translate(-8, 6);
      c.rotate(swing);
      c.strokeStyle = '#B9A480';
      c.lineWidth = 0.4;
      c.beginPath(); c.moveTo(0, -3); c.lineTo(0, -0.6); c.stroke();
      c.fillStyle = '#F4EBDA';
      c.fillRect(-1.4, -0.6, 2.8, 2.8);
      c.strokeStyle = '#221808';
      c.lineWidth = 0.3;
      c.strokeRect(-1.4, -0.6, 2.8, 2.8);
      c.fillStyle = '#221808';
      c.beginPath(); c.arc(-0.6, 0.2, 0.25, 0, Math.PI * 2); c.arc(0.6, 1.6, 0.25, 0, Math.PI * 2); c.fill();
      c.restore();
    });
  }
  if (owned.has('dyson_sail')) {
    drawModule(c, n('dyson_sail'), 0, -1, rarityColorOf('dyson_sail'), () => {
      // huge translucent gold sail (visibly billows with wind)
      const billow = Math.sin(t * 1.8) * 2;
      c.fillStyle = 'rgba(255, 233, 176, 0.28)';
      c.strokeStyle = 'rgba(217, 164, 65, 0.6)';
      c.lineWidth = 0.6;
      c.beginPath();
      c.moveTo(-14, -10);
      c.quadraticCurveTo(0 + billow, -4, 14, -10);
      c.lineTo(14, 12);
      c.quadraticCurveTo(0 + billow, 6, -14, 12);
      c.closePath();
      c.fill(); c.stroke();
    });
  }
  if (owned.has('pocket_moon')) {
    // Orbiting cratered moonlet — actual orbit position is computed in
    // main.ts (moonAngle); this draws it at the current orbit sample so it
    // always tracks the live gameplay position rather than a canned loop.
    drawModule(c, n('pocket_moon'), 0, 0, rarityColorOf('pocket_moon'), () => {
      const stacks = n('pocket_moon');
      const r = 32 + 6 * (stacks - 1);
      const mx = Math.cos(t * 0.9) * r;
      const my = Math.sin(t * 0.9) * r;
      c.fillStyle = '#8a8a9a';
      c.beginPath(); c.arc(mx, my, 3 + 0.4 * (stacks - 1), 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(59,44,22,0.4)';
      c.beginPath(); c.arc(mx - 0.8, my - 0.6, 0.9, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('valkyrie_autopilot')) {
    drawModule(c, n('valkyrie_autopilot'), 0, -16.2, rarityColorOf('valkyrie_autopilot'), () => {
      // winged helmet antenna
      c.strokeStyle = '#FFC94A';
      c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(0, -14.5); c.lineTo(0, -17); c.stroke();
      for (const side of [-1, 1]) {
        c.beginPath();
        c.moveTo(0, -16.6); c.quadraticCurveTo(side * 2.4, -17.4, side * 3, -15.8);
        c.stroke();
      }
    });
  }
  if (owned.has('star_forge')) {
    drawModule(c, n('star_forge'), -7.5, -13.5, rarityColorOf('star_forge'), () => {
      // tiny anvil with orbiting sparks
      c.fillStyle = '#3B2C16';
      c.fillRect(-9, -13.8, 3, 1.2);
      c.fillStyle = '#FFC94A';
      const sa = t * 5;
      c.beginPath(); c.arc(-7.5 + Math.cos(sa) * 1.8, -13.5 + Math.sin(sa) * 1.8, 0.35, 0, Math.PI * 2); c.fill();
    });
  }
  if (owned.has('antigrav_paint')) {
    drawModule(c, n('antigrav_paint'), 0, 0, rarityColorOf('antigrav_paint'), () => {
      // hull gets floating paint-drip streaks (upward drips)
      c.strokeStyle = 'rgba(216, 196, 232, 0.55)';
      c.lineWidth = 0.6;
      const drip = (Math.sin(t * 1.5) * 0.5 + 0.5) * 2;
      for (const dx of [-4, -1, 2, 5]) {
        c.beginPath(); c.moveTo(dx, 4); c.lineTo(dx, 1 - drip); c.stroke();
      }
    });
  }
  if (owned.has('mothership_favor')) {
    drawModule(c, n('mothership_favor'), 0, -18.4, rarityColorOf('mothership_favor'), () => {
      // crowned mini-UFO escort decal
      c.fillStyle = '#FFC94A';
      c.beginPath();
      c.moveTo(-1.4, -17.6); c.lineTo(-0.9, -19); c.lineTo(0, -17.9); c.lineTo(0.9, -19); c.lineTo(1.4, -17.6);
      c.closePath(); c.fill();
      c.strokeStyle = '#5a4326';
      c.lineWidth = 0.5;
      c.beginPath(); c.ellipse(0, -17, 2.2, 0.8, 0, 0, Math.PI * 2); c.stroke();
    });
  }
  if (owned.has('big_crunch')) {
    drawModule(c, n('big_crunch'), 0, 0, rarityColorOf('big_crunch'), () => {
      // pulsing spacetime ripple around ship
      const stacks = n('big_crunch');
      const pulse = (Math.sin(t * 3) * 0.5 + 0.5);
      c.strokeStyle = `rgba(176, 123, 214, ${0.15 + pulse * 0.15})`;
      c.lineWidth = 1;
      c.beginPath(); c.arc(0, -1, 19 + 2 * (stacks - 1) + pulse * 3, 0, Math.PI * 2); c.stroke();
    });
  }

  if (stats.shieldCharges > 0) {
    // Idle shield shimmer (distinct from the impact flash) — §7 table:
    // "shimmer ring (radius grows per stack)". shieldCharges already IS the
    // stack count (computeStats does `+= 1` per pick), so it doubles as n.
    const shieldStacks = stats.shieldCharges;
    c.strokeStyle = 'rgba(148, 176, 61, 0.22)';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, -1, 16.4 + 1.4 * (shieldStacks - 1), 0, Math.PI * 2);
    c.stroke();
  }
}

export interface DrawShipParams {
  ctx: CanvasRenderingContext2D;
  ship: { x: number; y: number; angle: number; thrusting: boolean };
  S: number;
  mood: Mood;
  shieldFlash: number;
  stats: ShipStats;
  pickedUpgrades: UpgradeId[];
  paint: PaintDef;
  pilotPhoto: HTMLCanvasElement | null;
  faceMap: FaceMap;
}

export function drawShip(p: DrawShipParams) {
  const { ship, S, mood, shieldFlash, stats, pickedUpgrades, paint, pilotPhoto, faceMap } = p;
  const c = p.ctx;
  c.save();
  c.translate(ship.x, ship.y);
  c.rotate(ship.angle);
  c.scale(S, S);

  if (shieldFlash > 0) {
    c.beginPath();
    c.arc(0, -1, 17, 0, Math.PI * 2);
    c.strokeStyle = 'rgba(148, 176, 61, 0.8)';
    c.lineWidth = 2;
    c.stroke();
  }

  // Star Core aura — a soft golden halo behind everything. §7 table: "nose
  // star + golden aura (aura radius per stack)" — radius grows linearly
  // with starCoreStacks, same +30%-per-stack cadence as moduleScale.
  if (stats.starCore) {
    const auraR = 26 * moduleScale(stats.starCoreStacks);
    const aura = c.createRadialGradient(0, -2, 4, 0, -2, auraR);
    aura.addColorStop(0, 'rgba(255, 201, 74, 0.22)');
    aura.addColorStop(1, 'rgba(255, 201, 74, 0)');
    c.fillStyle = aura;
    c.beginPath();
    c.arc(0, -2, auraR, 0, Math.PI * 2);
    c.fill();
  }

  // Thrust flame FIRST (behind the hull): layered + glow.
  // Jalapeño Injectors turn the exhaust spicy-green — §7 table: "greener per
  // stack", so the green channel ramps up (capped visually at 255) with
  // spicyStacks rather than being a flat on/off color.
  if (ship.thrusting) {
    const flicker = 6 + Math.random() * 7;
    const spicy = stats.spicyFlame;
    const greenAmt = Math.min(255, 176 + stats.spicyStacks * 14);
    const glowColor = spicy ? `148, ${greenAmt}, 61` : '217, 164, 65';
    const glow = c.createRadialGradient(0, 10, 1, 0, 12, 16 + flicker);
    glow.addColorStop(0, `rgba(${glowColor}, 0.5)`);
    glow.addColorStop(1, `rgba(${glowColor}, 0)`);
    c.fillStyle = glow;
    c.beginPath();
    c.arc(0, 12, 16 + flicker, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(-5, 7.5);
    c.quadraticCurveTo(0, 10 + flicker * 1.6, 5, 7.5);
    c.closePath();
    c.fillStyle = spicy ? `rgba(124, ${greenAmt}, 92, 0.75)` : 'rgba(201, 123, 61, 0.65)';
    c.fill();
    c.beginPath();
    c.moveTo(-2.6, 7.5);
    c.quadraticCurveTo(0, 9 + flicker, 2.6, 7.5);
    c.closePath();
    c.fillStyle = spicy ? 'rgba(224, 245, 200, 0.95)' : 'rgba(244, 235, 218, 0.95)';
    c.fill();
  }

  // Engine nozzle
  c.beginPath();
  c.ellipse(0, 7.5, 3.4, 2, 0, 0, Math.PI * 2);
  c.fillStyle = '#221808';
  c.fill();

  // Landing legs
  c.strokeStyle = '#8a6a3c';
  c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(-5.5, 5); c.lineTo(-9, 10); c.moveTo(-10.6, 10); c.lineTo(-7.4, 10); c.stroke();
  c.beginPath(); c.moveTo(5.5, 5); c.lineTo(9, 10); c.moveTo(7.4, 10); c.lineTo(10.6, 10); c.stroke();

  // Side fins
  c.fillStyle = '#7C8F5C';
  c.strokeStyle = '#3B2C16';
  c.lineWidth = 0.8;
  c.beginPath();
  c.moveTo(-6.5, 5.5); c.lineTo(-11, 9.5); c.lineTo(-4.5, 8);
  c.closePath(); c.fill(); c.stroke();
  c.beginPath();
  c.moveTo(6.5, 5.5); c.lineTo(11, 9.5); c.lineTo(4.5, 8);
  c.closePath(); c.fill(); c.stroke();

  // Main hull — bulbous dome, big cockpit. Colors come from the
  // equipped paint job (Hangar Shop cosmetic).
  const hullGrad = c.createLinearGradient(0, -14, 0, 8);
  hullGrad.addColorStop(0, paint.hullTop);
  hullGrad.addColorStop(1, paint.hullBot);
  c.beginPath();
  c.moveTo(0, -14);
  c.bezierCurveTo(6.5, -14, 9, -7, 8, 0);
  c.lineTo(6.5, 8);
  c.lineTo(0, 5.5);
  c.lineTo(-6.5, 8);
  c.lineTo(-8, 0);
  c.bezierCurveTo(-9, -7, -6.5, -14, 0, -14);
  c.closePath();
  c.fillStyle = hullGrad;
  c.fill();
  c.strokeStyle = paint.stroke;
  c.lineWidth = 1.4;
  c.stroke();

  // Panel lines
  c.strokeStyle = 'rgba(59, 44, 22, 0.35)';
  c.lineWidth = 0.5;
  c.beginPath(); c.moveTo(-7.2, 1.5); c.lineTo(7.2, 1.5); c.stroke();
  c.beginPath(); c.moveTo(-6.2, 4.4); c.lineTo(6.2, 4.4); c.stroke();

  // Upgrade hardware — every owned upgrade is visible on the hull.
  drawShipModules(c, pickedUpgrades, stats);

  // Cockpit — enlarged again in v9: with ship scale up to 2.3x this is
  // a ~30px porthole, so the pilot's expressions genuinely read.
  const cockR = 6.6;
  const cockCY = -4.6;
  c.save();
  c.beginPath();
  c.ellipse(0, cockCY, cockR, cockR * 1.05, 0, 0, Math.PI * 2);
  c.clip();

  if (pilotPhoto) {
    drawPhotoFace(c, -cockR, cockCY - cockR * 1.05, cockR * 2, cockR * 2.1, mood, pilotPhoto, faceMap);
  } else {
    const glassGrad = c.createRadialGradient(-1.4, cockCY - 1.6, 0.5, 0, cockCY, cockR * 1.3);
    glassGrad.addColorStop(0, '#E4F1EA');
    glassGrad.addColorStop(1, '#5B7A85');
    c.fillStyle = glassGrad;
    c.fillRect(-cockR, cockCY - cockR, cockR * 2, cockR * 2);
    drawDefaultPilot(c, cockCY, cockR, mood);
  }
  c.restore();

  // Cockpit rim + glass highlight
  c.beginPath();
  c.ellipse(0, cockCY, cockR, cockR * 1.05, 0, 0, Math.PI * 2);
  c.strokeStyle = '#221808';
  c.lineWidth = 0.9;
  c.stroke();
  c.beginPath();
  c.ellipse(-1.8, cockCY - cockR * 0.55, cockR * 0.5, cockR * 0.2, -0.4, 0, Math.PI * 2);
  c.strokeStyle = 'rgba(244, 235, 218, 0.35)';
  c.lineWidth = 0.8;
  c.stroke();

  // Nose light
  c.beginPath();
  c.arc(0, -13.2, 1.1, 0, Math.PI * 2);
  c.fillStyle = '#94B03D';
  c.fill();

  c.restore();
}

// ---------------------------------------------------------------------------
// lander-v10 commit 4a (§6.5): Ghost ship.
//
// Renders the ship at 35% alpha, mirrored across the pad center X — purely
// visual on its own. Commit 4b's Quantum Duplicate upgrade will call
// drawGhostShip once per frame near the mirrored position and hook
// checkGhostSave into the crash-handling path (main.ts::destroyShip).
// ---------------------------------------------------------------------------

// Mirrors an x coordinate across the pad center — the ghost renders as if
// the ship's run were reflected across the pad, per §6.5.
export function mirrorAcrossPad(x: number, padCenterX: number): number {
  return padCenterX + (padCenterX - x);
}

export function drawGhostShip(p: DrawShipParams & { padCenterX: number }) {
  const { padCenterX, ship, ...rest } = p;
  const c = p.ctx;
  const ghostX = mirrorAcrossPad(ship.x, padCenterX);
  c.save();
  c.globalAlpha = 0.35;
  drawShip({ ...rest, ctx: c, ship: { ...ship, x: ghostX } });
  c.restore();
}

// §6.5 hook: "Quantum Duplicate death-save roll" — a boolean/probability
// check callable from the crash-handling code path in main.ts. Returns
// false always for now (no upgrade sets stats.ghostSave yet); Commit 4b
// makes it meaningful by rolling 50% per stack of ghostSave and consuming
// one on success.
export function checkGhostSave(stats: ShipStats): boolean {
  if (!stats.ghostSave || stats.ghostSave <= 0) return false;
  return false;
}
