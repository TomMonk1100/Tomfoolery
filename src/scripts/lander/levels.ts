import { mulberry32 } from './rng';
import { DIFF_MODS } from './stats';
import type {
  Critter, Difficulty, LevelConfig, Pad, Planet, Star, Terrain, TerrainPoint, TerrainStyle, Ufo,
} from './types';

// --- Endless level generator -------------------------------------------------
// First ten levels keep their hand-picked names; everything about the config
// is procedural and deterministic per (level index, difficulty). Pressure
// unlocks on a schedule (wind → asteroids → canyon → moving pads → fog →
// UFOs) and then keeps creeping upward forever, with hard caps so deep runs
// stay physically possible.
const LEVEL_NAMES = [
  'First Light', 'Rolling Dust', 'Crosswind Valley', 'Narrow Shelf', 'Debris Field',
  'The Canyon', 'Shifting Pad', 'Ashen Plains', 'The Storm', 'Last Descent',
];
const NAME_ADJ = ['Silent', 'Iron', 'Hollow', 'Burning', 'Frozen', 'Crimson', 'Wandering', 'Shattered', 'Pale', 'Deep', 'Broken', 'Static'];
const NAME_NOUN = ['Reach', 'Basin', 'Divide', 'Expanse', 'Ridge', 'Verge', 'Steppe', 'Rift', 'Plateau', 'Maw', 'Hollows', 'Drift'];

export function levelConfigFor(idx: number, diff: Difficulty): LevelConfig {
  const m = DIFF_MODS[diff];
  const r = mulberry32(idx * 7919 + 101);

  const ramp = Math.min(1, idx / 14);              // main climb over ~15 levels
  const creep = Math.max(0, idx - 14) * 0.015;     // gentle endless creep after

  const gravity = Math.min(150, (55 + idx * 4 + creep * 60) * m.grav);

  const windBase = idx < 2 ? 0 : (6 + 18 * ramp + creep * 20) * (0.45 + r() * 0.65);
  const wind = Math.min(30, windBase * m.wind);
  const windGust = wind * (0.5 + r() * 0.5);

  const styles: TerrainStyle[] =
    idx < 1 ? ['flat'] :
    idx < 3 ? ['flat', 'hills'] :
    idx < 5 ? ['hills', 'rough'] :
    ['hills', 'rough', 'canyon'];
  const terrain = styles[Math.floor(r() * styles.length)];

  const padWidth = Math.max(56, (130 - idx * 5 - creep * 30) * m.pad);

  const movingPad = idx >= 6 && r() < Math.min(0.65, 0.32 + idx * 0.015);
  // Fog is disabled for now — even after the v9 visibility rework it read
  // as "unviewable" in real play. All the plumbing (config flag, overlay
  // renderer, scanner counter, beacon pulses) is kept so it can return
  // later as a rarer, gentler variant.
  const fog = false;
  void r(); // burn the roll fog used to consume, keeping level seeds stable
  const asteroids = idx >= 4 && r() < 0.55 ? Math.min(5, Math.round((2 + Math.floor(idx / 5)) * m.hazard)) : 0;
  const ufos = idx >= 8 && r() < 0.45 ? Math.min(3, Math.max(1, Math.round((1 + Math.floor(idx / 9)) * m.hazard))) : 0;

  const name = idx < LEVEL_NAMES.length
    ? LEVEL_NAMES[idx]
    : `${NAME_ADJ[Math.floor(r() * NAME_ADJ.length)]} ${NAME_NOUN[Math.floor(r() * NAME_NOUN.length)]}`;

  return {
    name,
    gravity,
    wind,
    windGust,
    terrain,
    padWidth,
    fog,
    asteroids,
    movingPad,
    padSpeed: movingPad ? Math.min(46, 24 + idx * 1.1) : 0,
    ufos,
    seed: idx * 13 + 7,
  };
}

export function terrainYAt(points: TerrainPoint[], x: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return points[points.length - 1]?.y ?? 0;
}

export function generateTerrain(cfg: LevelConfig, width: number, height: number): Terrain {
  const rand = mulberry32(cfg.seed * 9973 + 17);
  const groundBase = height * 0.72;
  const points: TerrainPoint[] = [];
  const padWidth = cfg.padWidth;
  let padCenter = width * (0.35 + rand() * 0.3);

  const segments = 40;
  const step = width / segments;

  if (cfg.terrain === 'flat') {
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const noise = Math.sin(i * 0.7) * 8;
      points.push({ x, y: groundBase + noise });
    }
  } else if (cfg.terrain === 'hills') {
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const y = groundBase - Math.sin(i * 0.55 + rand() * 2) * 34 - Math.sin(i * 0.13) * 20;
      points.push({ x, y });
    }
  } else if (cfg.terrain === 'rough') {
    let y = groundBase;
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      y += (rand() - 0.5) * 26;
      y = Math.max(height * 0.5, Math.min(height * 0.85, y));
      points.push({ x, y });
    }
  } else {
    // canyon: tall walls in the outer thirds, gap in the middle down to a low pad
    padCenter = width * 0.5;
    for (let i = 0; i <= segments; i++) {
      const x = i * step;
      const t = x / width;
      let y: number;
      if (t < 0.32) {
        y = height * 0.18 + Math.sin(i * 0.4) * 14; // left wall, tall
      } else if (t > 0.68) {
        y = height * 0.18 + Math.sin(i * 0.4 + 3) * 14; // right wall, tall
      } else {
        y = groundBase + 20; // canyon floor, low
      }
      points.push({ x, y });
    }
  }

  const halfW = padWidth / 2;

  // Moving pads: clamped travel range + terrain flattened across the ENTIRE
  // travel corridor at generation time, so the pad can never be below ground.
  let range = 0;
  if (cfg.movingPad) {
    if (cfg.terrain === 'canyon') {
      padCenter = width * 0.5;
      const floorMin = width * 0.35 + halfW;
      const floorMax = width * 0.65 - halfW;
      range = Math.max(30, Math.min(padCenter - floorMin, floorMax - padCenter));
    } else {
      padCenter = Math.min(Math.max(padCenter, width * 0.3), width * 0.7);
      range = Math.min(width * 0.18, padCenter - halfW - 24, width - padCenter - halfW - 24);
    }
  }

  // Flatten the pad zone (or full travel corridor), blending edges over
  // ~46px so terrain slopes into the pad instead of cliffing at its lip.
  const padY = terrainYAt(points, padCenter);
  const flatFrom = padCenter - (cfg.movingPad ? range + halfW + 14 : halfW + 10);
  const flatTo = padCenter + (cfg.movingPad ? range + halfW + 14 : halfW + 10);
  const blendDist = 46;
  for (const p of points) {
    if (p.x >= flatFrom && p.x <= flatTo) {
      p.y = padY;
    } else if (p.x > flatFrom - blendDist && p.x < flatFrom) {
      const t = (flatFrom - p.x) / blendDist;
      p.y = padY + (p.y - padY) * t;
    } else if (p.x < flatTo + blendDist && p.x > flatTo) {
      const t = (p.x - flatTo) / blendDist;
      p.y = padY + (p.y - padY) * t;
    }
  }
  points[0] = { x: 0, y: points[0].y };
  points[points.length - 1] = { x: width, y: points[points.length - 1].y };

  // Distant background ridge — pure decoration, sits behind the playfield.
  const ridge: TerrainPoint[] = [];
  const rr = mulberry32(cfg.seed * 401 + 3);
  const ridgeBase = height * (cfg.terrain === 'canyon' ? 0.42 : 0.52);
  for (let i = 0; i <= 24; i++) {
    const x = (i / 24) * width;
    ridge.push({ x, y: ridgeBase - Math.sin(i * 0.7 + rr() * 3) * 26 - Math.sin(i * 0.23 + rr()) * 34 });
  }

  const pad: Pad = {
    xStart: padCenter - halfW,
    xEnd: padCenter + halfW,
    y: padY,
    vx: cfg.movingPad ? (rand() > 0.5 ? 1 : -1) * cfg.padSpeed : 0,
    baseX: padCenter, // fixed travel origin — never mutated after this
    range,
  };

  return { points, ridge, pad, width, height };
}

const PLANET_HUES: [string, string][] = [
  ['#8a5a30', '#3a2812'], ['#6e7c4a', '#2c3418'], ['#9c7a3a', '#463010'],
  ['#7c5a4a', '#301c14'], ['#5a6e6a', '#1e2c28'],
];

export function generateSky(cfg: LevelConfig, width: number, height: number): { stars: Star[]; planet: Planet } {
  const rand = mulberry32(cfg.seed * 733 + 11);
  const stars: Star[] = [];
  const count = Math.round((width * height) / 9000);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height * 0.75,
      r: 0.5 + rand() * 1.3,
      phase: rand() * Math.PI * 2,
      bright: 0.25 + rand() * 0.55,
    });
  }
  const planet: Planet = {
    x: width * (0.12 + rand() * 0.76),
    y: height * (0.1 + rand() * 0.16),
    r: 18 + rand() * 26,
    hue: PLANET_HUES[Math.floor(rand() * PLANET_HUES.length)],
    ring: rand() > 0.6,
  };
  return { stars, planet };
}

export function generateCritters(cfg: LevelConfig, terrain: Terrain, width: number): Critter[] {
  const rand = mulberry32(cfg.seed * 31337 + 7);
  const count = 3 + Math.floor(rand() * 3);
  const critters: Critter[] = [];
  let attempts = 0;
  while (critters.length < count && attempts < 50) {
    attempts++;
    const x = 20 + rand() * (width - 40);
    if (x > terrain.pad.baseX - terrain.pad.range - 70 && x < terrain.pad.baseX + terrain.pad.range + 70) continue;
    if (cfg.terrain === 'canyon') {
      const t = x / width;
      if (t < 0.34 || t > 0.66) continue;
    }
    critters.push({
      x,
      baseY: terrainYAt(terrain.points, x),
      kind: rand() > 0.55 ? 'cow' : 'scurrier',
      phase: rand() * Math.PI * 2,
      facing: rand() > 0.5 ? 1 : -1,
    });
  }
  return critters;
}

export function generateUfos(cfg: LevelConfig, width: number, height: number): Ufo[] {
  const count = cfg.ufos;
  if (count === 0) return [];
  const rand = mulberry32(cfg.seed * 555 + 3);
  const list: Ufo[] = [];
  for (let i = 0; i < count; i++) {
    const baseY = height * (0.12 + rand() * 0.14);
    list.push({
      x: width * (0.2 + rand() * 0.6),
      y: baseY,
      baseY,
      vx: (rand() > 0.5 ? 1 : -1) * (18 + rand() * 14),
      phase: rand() * Math.PI * 2,
      fireCooldown: 1.5 + rand() * 2,
      telegraph: 0,
      alive: true,
    });
  }
  return list;
}
