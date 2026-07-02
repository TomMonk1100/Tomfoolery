// ---------------------------------------------------------------------------
// Moon Lander Roguelite — vanilla Canvas2D + Web Audio, no dependencies.
// Earth-tone ("Hearthwood") visual style to match the rest of the site.
// ---------------------------------------------------------------------------

type Vec = { x: number; y: number };

type UpgradeId =
  | 'fuel_tank' | 'boost_thrusters' | 'magnetic_pad' | 'shield'
  | 'gyro' | 'gravity_anchor' | 'scanner' | 'feather_gear' | 'reserve_chute';

interface UpgradeDef {
  id: UpgradeId;
  name: string;
  desc: string;
  icon: string;
}

const UPGRADES: UpgradeDef[] = [
  { id: 'fuel_tank', name: 'Extra Fuel Tank', desc: '+40 max fuel, refills now', icon: '⛽' },
  { id: 'boost_thrusters', name: 'Boost Thrusters', desc: '+35% thrust power', icon: '🔥' },
  { id: 'magnetic_pad', name: 'Magnetic Landing Pad', desc: 'Wider safe zone, softer landings', icon: '🧲' },
  { id: 'shield', name: 'Shield', desc: 'Survive one crash', icon: '🛡️' },
  { id: 'gyro', name: 'Gyro Stabilizer', desc: 'More forgiving landing angle', icon: '🌀' },
  { id: 'gravity_anchor', name: 'Gravity Anchor', desc: 'Reduces gravity\'s pull', icon: '⚓' },
  { id: 'scanner', name: 'Scanner', desc: 'See the pad through fog', icon: '📡' },
  { id: 'feather_gear', name: 'Feather Landing Gear', desc: 'Can land a bit harder safely', icon: '🪶' },
  { id: 'reserve_chute', name: 'Reserve Chute', desc: 'Auto-brakes once if fuel runs dry', icon: '🪂' },
];

type TerrainStyle = 'flat' | 'hills' | 'rough' | 'canyon';

interface LevelConfig {
  name: string;
  gravity: number;
  wind: number;          // base horizontal accel, px/s^2
  windGust: number;       // amplitude of oscillating extra wind
  terrain: TerrainStyle;
  padWidth: number;
  fog: boolean;
  asteroids: number;      // count of moving circular hazards
  movingPad: boolean;
  seed: number;
}

const LEVELS: LevelConfig[] = [
  { name: 'First Light',      gravity: 55,  wind: 0,   windGust: 0,  terrain: 'flat',   padWidth: 130, fog: false, asteroids: 0, movingPad: false, seed: 1 },
  { name: 'Rolling Dust',     gravity: 62,  wind: 0,   windGust: 0,  terrain: 'hills',  padWidth: 115, fog: false, asteroids: 0, movingPad: false, seed: 2 },
  { name: 'Crosswind Valley', gravity: 66,  wind: 14,  windGust: 6,  terrain: 'hills',  padWidth: 105, fog: false, asteroids: 0, movingPad: false, seed: 3 },
  { name: 'Narrow Shelf',     gravity: 70,  wind: 10,  windGust: 8,  terrain: 'rough',  padWidth: 80,  fog: false, asteroids: 0, movingPad: false, seed: 4 },
  { name: 'Debris Field',     gravity: 72,  wind: 8,   windGust: 6,  terrain: 'hills',  padWidth: 95,  fog: false, asteroids: 4, movingPad: false, seed: 5 },
  { name: 'The Canyon',       gravity: 76,  wind: 6,   windGust: 10, terrain: 'canyon', padWidth: 90,  fog: false, asteroids: 0, movingPad: false, seed: 6 },
  { name: 'Shifting Pad',     gravity: 78,  wind: 12,  windGust: 8,  terrain: 'rough',  padWidth: 85,  fog: false, asteroids: 0, movingPad: true,  seed: 7 },
  { name: 'Ashen Fog',        gravity: 80,  wind: 10,  windGust: 8,  terrain: 'hills',  padWidth: 90,  fog: true,  asteroids: 2, movingPad: false, seed: 8 },
  { name: 'The Storm',        gravity: 86,  wind: 20,  windGust: 18, terrain: 'rough',  padWidth: 75,  fog: false, asteroids: 3, movingPad: true,  seed: 9 },
  { name: 'Last Descent',     gravity: 92,  wind: 16,  windGust: 16, terrain: 'canyon', padWidth: 70,  fog: true,  asteroids: 4, movingPad: true,  seed: 10 },
];

// --- Seeded PRNG (mulberry32) so each level's terrain is stable per run ---
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface TerrainPoint { x: number; y: number; }
interface Pad { xStart: number; xEnd: number; y: number; vx: number; baseX: number; range: number; }
interface Terrain { points: TerrainPoint[]; pad: Pad; groundColor: string; width: number; height: number; }

function terrainYAt(points: TerrainPoint[], x: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return a.y + (b.y - a.y) * t;
    }
  }
  return points[points.length - 1]?.y ?? 0;
}

function generateTerrain(cfg: LevelConfig, width: number, height: number): Terrain {
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

  // Carve the pad flat around padCenter
  const padY = terrainYAt(points, padCenter);
  for (const p of points) {
    if (p.x > padCenter - padWidth / 2 - 10 && p.x < padCenter + padWidth / 2 + 10) {
      p.y = padY;
    }
  }
  // ensure last point closes at canvas edge height for fill
  points[0] = { x: 0, y: points[0].y };
  points[points.length - 1] = { x: width, y: points[points.length - 1].y };

  const pad: Pad = {
    xStart: padCenter - padWidth / 2,
    xEnd: padCenter + padWidth / 2,
    y: padY,
    vx: cfg.movingPad ? (rand() > 0.5 ? 26 : -26) : 0,
    baseX: padCenter,
    range: width * 0.22,
  };

  return { points, pad, groundColor: '#2E2110', width, height };
}

// --- Particles -------------------------------------------------------------
interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
}

function makeParticle(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number): Particle {
  return { x, y, vx, vy, life, maxLife: life, color, size };
}

// --- Audio (synthesized, no files) -----------------------------------------
class AudioEngine {
  ctx: AudioContext | null = null;
  thrustGain: GainNode | null = null;
  thrustOsc: OscillatorNode | null = null;
  noiseBuffer: AudioBuffer | null = null;
  enabled = true;

  ensure() {
    if (this.ctx) return;
    try {
      // @ts-ignore webkitAudioContext fallback for older Safari
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
      const bufferSize = this.ctx.sampleRate * 1;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    } catch (e) {
      this.enabled = false;
    }
  }

  startThrust() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || this.thrustOsc) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.05, this.ctx.currentTime + 0.08);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    this.thrustOsc = osc;
    this.thrustGain = gain;
  }

  stopThrust() {
    if (!this.ctx || !this.thrustOsc || !this.thrustGain) return;
    const osc = this.thrustOsc;
    const gain = this.thrustGain;
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);
    setTimeout(() => { try { osc.stop(); } catch (e) {} }, 150);
    this.thrustOsc = null;
    this.thrustGain = null;
  }

  private tone(freq: number, dur: number, type: OscillatorType, delay = 0, vol = 0.08) {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  landingSuccess() {
    this.tone(440, 0.18, 'sine', 0);
    this.tone(660, 0.22, 'sine', 0.12);
    this.tone(880, 0.3, 'sine', 0.24);
  }

  crash() {
    if (!this.enabled) return;
    this.ensure();
    if (!this.ctx || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(100, this.ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.6);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start();
    src.stop(this.ctx.currentTime + 0.6);
  }

  select() {
    this.tone(520, 0.08, 'triangle', 0, 0.06);
  }

  win() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'sine', i * 0.14, 0.09));
  }
}

// --- Ship stats derived from picked upgrades --------------------------------
interface ShipStats {
  maxFuel: number;
  thrustPower: number;
  padBonus: number;
  landingSpeedTol: number;
  landingAngleTol: number;
  shieldCharges: number;
  gravityMult: number;
  scanner: boolean;
  reserveCharges: number;
}

function computeStats(picked: UpgradeId[]): ShipStats {
  const s: ShipStats = {
    maxFuel: 100,
    thrustPower: 145,
    padBonus: 0,
    landingSpeedTol: 60,
    landingAngleTol: 0.28,
    shieldCharges: 0,
    gravityMult: 1,
    scanner: false,
    reserveCharges: 0,
  };
  for (const id of picked) {
    switch (id) {
      case 'fuel_tank': s.maxFuel += 40; break;
      case 'boost_thrusters': s.thrustPower *= 1.35; break;
      case 'magnetic_pad': s.padBonus += 40; s.landingSpeedTol *= 1.15; break;
      case 'shield': s.shieldCharges += 1; break;
      case 'gyro': s.landingAngleTol += 0.14; break;
      case 'gravity_anchor': s.gravityMult = Math.max(0.4, s.gravityMult * 0.85); break;
      case 'scanner': s.scanner = true; break;
      case 'feather_gear': s.landingSpeedTol *= 1.25; break;
      case 'reserve_chute': s.reserveCharges += 1; break;
    }
  }
  return s;
}

// --- Main game class ---------------------------------------------------------
type GameState = 'start' | 'playing' | 'levelComplete' | 'upgradePick' | 'crashed' | 'win';

export function initLanderGame(root: HTMLElement) {
  const canvas = root.querySelector('canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const hud = {
    fuel: root.querySelector('[data-hud="fuel"]') as HTMLElement,
    fuelBar: root.querySelector('[data-hud="fuel-bar"]') as HTMLElement,
    altitude: root.querySelector('[data-hud="altitude"]') as HTMLElement,
    speed: root.querySelector('[data-hud="speed"]') as HTMLElement,
    level: root.querySelector('[data-hud="level"]') as HTMLElement,
    upgrades: root.querySelector('[data-hud="upgrades"]') as HTMLElement,
  };
  const overlay = root.querySelector('[data-overlay]') as HTMLElement;
  const overlayContent = root.querySelector('[data-overlay-content]') as HTMLElement;
  const touchLeft = root.querySelector('[data-touch="left"]') as HTMLElement;
  const touchRight = root.querySelector('[data-touch="right"]') as HTMLElement;
  const touchThrust = root.querySelector('[data-touch="thrust"]') as HTMLElement;

  const audio = new AudioEngine();

  let state: GameState = 'start';
  let levelIndex = 0;
  let pickedUpgrades: UpgradeId[] = [];
  let stats = computeStats([]);
  let terrain: Terrain;
  let particles: Particle[] = [];
  let windPhase = 0;
  let shieldFlash = 0;
  let runStats = { crashes: 0, landings: 0 };

  let width = 0, height = 0, dpr = 1;

  const ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: 100, thrusting: false,
    reserveUsed: false,
  };

  const input = { left: false, right: false, thrust: false };

  function resize() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    width = Math.min(rect.width, 900);
    height = Math.round(width * 0.62);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (terrain) {
      terrain = generateTerrain(LEVELS[levelIndex], width, height);
    }
  }

  function setOverlay(html: string | null) {
    if (!overlay || !overlayContent) return;
    if (html === null) {
      overlay.classList.add('hidden');
      overlayContent.innerHTML = '';
    } else {
      overlay.classList.remove('hidden');
      overlayContent.innerHTML = html;
    }
  }

  function startRun() {
    levelIndex = 0;
    pickedUpgrades = [];
    stats = computeStats(pickedUpgrades);
    runStats = { crashes: 0, landings: 0 };
    loadLevel(0);
    state = 'playing';
    setOverlay(null);
  }

  function loadLevel(idx: number) {
    levelIndex = idx;
    terrain = generateTerrain(LEVELS[idx], width, height);
    ship.x = width * 0.5;
    ship.y = height * 0.12;
    ship.vx = (Math.random() - 0.5) * 20;
    ship.vy = 10;
    ship.angle = 0;
    ship.fuel = stats.maxFuel;
    ship.reserveUsed = false;
    particles = [];
    windPhase = Math.random() * 10;
  }

  function currentWind(cfg: LevelConfig, t: number) {
    return cfg.wind + Math.sin(t * 0.6) * cfg.windGust;
  }

  function emitThrusterParticles(dt: number) {
    const back = ship.angle + Math.PI;
    const px = ship.x + Math.sin(back) * 10;
    const py = ship.y - Math.cos(back) * -10 + Math.cos(ship.angle) * 10;
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = 60 + Math.random() * 40;
      const a = ship.angle + Math.PI + spread;
      particles.push(makeParticle(
        ship.x - Math.sin(ship.angle) * 12,
        ship.y + Math.cos(ship.angle) * 12,
        Math.sin(a) * speed + ship.vx * 0.3,
        -Math.cos(a) * speed + ship.vy * 0.3,
        Math.random() > 0.5 ? '#D9A441' : '#C97B3D',
        0.4 + Math.random() * 0.3,
        1.5 + Math.random() * 2
      ));
    }
  }

  function explode() {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 140;
      particles.push(makeParticle(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        Math.random() > 0.5 ? '#C97B3D' : '#94B03D',
        0.5 + Math.random() * 0.6,
        2 + Math.random() * 3
      ));
    }
  }

  function normalizeAngle(a: number) {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  function update(dt: number) {
    if (state !== 'playing') return;
    const cfg = LEVELS[levelIndex];
    windPhase += dt;

    // Rotation — direct control, simple & predictable
    const rotSpeed = 2.6;
    if (input.left) ship.angle -= rotSpeed * dt;
    if (input.right) ship.angle += rotSpeed * dt;

    // Gravity + wind
    ship.vy += cfg.gravity * stats.gravityMult * dt;
    ship.vx += currentWind(cfg, windPhase) * dt;

    // Thrust
    ship.thrusting = input.thrust && ship.fuel > 0;
    if (ship.thrusting) {
      ship.vx += Math.sin(ship.angle) * stats.thrustPower * dt;
      ship.vy -= Math.cos(ship.angle) * stats.thrustPower * dt;
      ship.fuel = Math.max(0, ship.fuel - 22 * dt);
      emitThrusterParticles(dt);
      audio.startThrust();
    } else {
      audio.stopThrust();
    }

    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;
    if (ship.x < 6) { ship.x = 6; ship.vx *= -0.4; }
    if (ship.x > width - 6) { ship.x = width - 6; ship.vx *= -0.4; }
    // Soft ceiling: thrusting straight up for too long could otherwise carry
    // the ship off the top of the (non-scrolling) canvas indefinitely.
    if (ship.y < 24) { ship.y = 24; ship.vy = Math.max(0, ship.vy); }

    // Moving pad
    if (cfg.movingPad) {
      terrain.pad.baseX += terrain.pad.vx * dt;
      if (Math.abs(terrain.pad.baseX - (terrain.pad.xStart + terrain.pad.xEnd) / 2) > terrain.pad.range) {
        terrain.pad.vx *= -1;
      }
      const shift = terrain.pad.vx * dt;
      terrain.pad.xStart += shift;
      terrain.pad.xEnd += shift;
      for (const p of terrain.points) {
        if (Math.abs(p.y - terrain.pad.y) < 1 && p.x > terrain.pad.xStart - 60 && p.x < terrain.pad.xEnd + 60) {
          p.x += shift;
        }
      }
    }

    // Particles
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt;
      p.life -= dt;
    }

    if (shieldFlash > 0) shieldFlash -= dt;

    // Ground / obstacle collision
    const groundY = terrainYAt(terrain.points, ship.x);
    if (ship.y + 9 >= groundY) {
      handleTouchdown(groundY);
    }

    // Fuel-out safety net
    if (ship.fuel <= 0 && stats.reserveCharges > 0 && !ship.reserveUsed && ship.vy > 80) {
      ship.reserveUsed = true;
      stats.reserveCharges -= 1;
      ship.vy *= 0.25;
    }
  }

  function handleTouchdown(groundY: number) {
    const cfg = LEVELS[levelIndex];
    const speed = Math.hypot(ship.vx, ship.vy);
    const angle = Math.abs(normalizeAngle(ship.angle));
    const onPad = ship.x > terrain.pad.xStart - stats.padBonus / 2 &&
                  ship.x < terrain.pad.xEnd + stats.padBonus / 2;
    const safe = onPad && speed < stats.landingSpeedTol && angle < stats.landingAngleTol;

    ship.y = groundY - 9;

    if (safe) {
      runStats.landings += 1;
      audio.landingSuccess();
      state = 'levelComplete';
      showLevelComplete();
    } else if (stats.shieldCharges > 0) {
      stats.shieldCharges -= 1;
      shieldFlash = 0.5;
      ship.vy = -Math.abs(ship.vy) * 0.35;
      ship.vx *= 0.4;
    } else {
      runStats.crashes += 1;
      explode();
      audio.crash();
      state = 'crashed';
      setTimeout(showCrashScreen, 500);
    }
  }

  function upgradeListHtml() {
    if (pickedUpgrades.length === 0) return '<p class="text-xs text-muted mt-2">No upgrades yet.</p>';
    const counts = new Map<UpgradeId, number>();
    pickedUpgrades.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    return '<div class="flex flex-wrap gap-2 mt-3">' +
      Array.from(counts.entries()).map(([id, n]) => {
        const def = UPGRADES.find((u) => u.id === id)!;
        return `<span class="badge border border-line px-2 py-1">${def.icon} ${def.name}${n > 1 ? ` ×${n}` : ''}</span>`;
      }).join('') + '</div>';
  }

  function showLevelComplete() {
    const isLast = levelIndex >= LEVELS.length - 1;
    if (isLast) {
      audio.win();
      state = 'win';
      setOverlay(`
        <div class="text-center">
          <p class="badge badge-signal">run complete</p>
          <h2 class="font-display text-3xl font-semibold mt-2">Touched down. All 10.</h2>
          <p class="text-muted mt-3">Landings: ${runStats.landings} · Crashes survived: ${stats.shieldCharges >= 0 ? runStats.crashes : 0} · Upgrades: ${pickedUpgrades.length}</p>
          ${upgradeListHtml()}
          <button data-action="restart" class="tile mt-6 px-6 py-3 inline-block cursor-pointer font-mono badge-signal">play again</button>
        </div>
      `);
      return;
    }
    setOverlay(`
      <div class="text-center">
        <p class="badge badge-signal">landed — level ${levelIndex + 1} clear</p>
        <h2 class="font-display text-2xl font-semibold mt-2">Pick an upgrade</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" data-upgrade-choices></div>
      </div>
    `);
    renderUpgradeChoices();
  }

  function renderUpgradeChoices() {
    const container = overlayContent.querySelector('[data-upgrade-choices]');
    if (!container) return;
    const rand = mulberry32(Date.now() % 100000);
    const shuffled = [...UPGRADES].sort(() => rand() - 0.5).slice(0, 3);
    container.innerHTML = shuffled.map((u) => `
      <button class="tile text-left cursor-pointer" data-pick="${u.id}">
        <span class="text-2xl">${u.icon}</span>
        <div class="font-display font-semibold mt-2">${u.name}</div>
        <div class="text-xs text-muted mt-1">${u.desc}</div>
      </button>
    `).join('');
    container.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.pick as UpgradeId;
        pickedUpgrades.push(id);
        stats = computeStats(pickedUpgrades);
        audio.select();
        loadLevel(levelIndex + 1);
        state = 'playing';
        setOverlay(null);
      });
    });
  }

  function showCrashScreen() {
    setOverlay(`
      <div class="text-center">
        <p class="badge" style="color:#C97B3D">run over</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Crashed on ${LEVELS[levelIndex].name}</h2>
        <p class="text-muted mt-3">Reached level ${levelIndex + 1} of ${LEVELS.length} · Landings this run: ${runStats.landings}</p>
        ${upgradeListHtml()}
        <button data-action="restart" class="tile mt-6 px-6 py-3 inline-block cursor-pointer font-mono">restart run</button>
      </div>
    `);
  }

  function showStartScreen() {
    state = 'start';
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">moon lander · roguelite</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Land gently. Ten times.</h2>
        <p class="text-muted mt-3 text-sm">
          ←/→ or A/D to rotate · ↑ / W / Space to thrust. Land level and slow on
          the flat pad. Each successful landing offers an upgrade — they carry
          through the run. Crash, and the run resets.
        </p>
        <button data-action="restart" class="tile mt-6 px-8 py-3 inline-block cursor-pointer font-mono badge-signal">start run</button>
      </div>
    `);
  }

  overlay?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.dataset.action === 'restart') startRun();
  });

  // --- Input ---
  function keydown(e: KeyboardEvent) {
    if (e.repeat) return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = true;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = true;
    if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) { input.thrust = true; e.preventDefault(); }
  }
  function keyup(e: KeyboardEvent) {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) input.left = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) input.right = false;
    if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) input.thrust = false;
  }
  window.addEventListener('keydown', keydown);
  window.addEventListener('keyup', keyup);

  function bindTouch(el: HTMLElement | null, on: () => void, off: () => void) {
    if (!el) return;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); on(); }, { passive: false });
    el.addEventListener('touchend', (e) => { e.preventDefault(); off(); }, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }
  bindTouch(touchLeft, () => (input.left = true), () => (input.left = false));
  bindTouch(touchRight, () => (input.right = true), () => (input.right = false));
  bindTouch(touchThrust, () => (input.thrust = true), () => (input.thrust = false));

  // --- Rendering ---
  function drawShip() {
    ctx!.save();
    ctx!.translate(ship.x, ship.y);
    ctx!.rotate(ship.angle);
    if (shieldFlash > 0) {
      ctx!.beginPath();
      ctx!.arc(0, 0, 16, 0, Math.PI * 2);
      ctx!.strokeStyle = 'rgba(148, 176, 61, 0.8)';
      ctx!.lineWidth = 2;
      ctx!.stroke();
    }
    ctx!.beginPath();
    ctx!.moveTo(0, -11);
    ctx!.lineTo(7, 9);
    ctx!.lineTo(0, 5);
    ctx!.lineTo(-7, 9);
    ctx!.closePath();
    ctx!.fillStyle = '#F4EBDA';
    ctx!.fill();
    ctx!.strokeStyle = '#C97B3D';
    ctx!.lineWidth = 1.5;
    ctx!.stroke();

    if (ship.thrusting) {
      ctx!.beginPath();
      ctx!.moveTo(-4, 8);
      ctx!.lineTo(0, 8 + 8 + Math.random() * 6);
      ctx!.lineTo(4, 8);
      ctx!.closePath();
      ctx!.fillStyle = 'rgba(217, 164, 65, 0.85)';
      ctx!.fill();
    }
    ctx!.restore();
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#1c130a');
    sky.addColorStop(1, '#12100c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    if (!terrain) return;

    // Terrain
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

    // Pad (highlighted if scanner or always visible without fog)
    const cfg = LEVELS[levelIndex];
    const padVisible = !cfg.fog || stats.scanner;
    ctx.save();
    ctx.strokeStyle = padVisible ? '#94B03D' : 'rgba(148,176,61,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(terrain.pad.xStart, terrain.pad.y);
    ctx.lineTo(terrain.pad.xEnd, terrain.pad.y);
    ctx.stroke();
    if (padVisible) {
      ctx.fillStyle = 'rgba(148,176,61,0.5)';
      for (let x = terrain.pad.xStart; x < terrain.pad.xEnd; x += 10) {
        ctx.fillRect(x, terrain.pad.y - 2, 4, 4);
      }
    }
    ctx.restore();

    // Obstacles (asteroids) — simple drifting circles, deterministic per level via seed+time
    if (cfg.asteroids > 0) {
      const rand = mulberry32(cfg.seed * 71);
      for (let i = 0; i < cfg.asteroids; i++) {
        const baseX = rand() * width;
        const baseY = height * (0.15 + rand() * 0.35);
        const r = 10 + rand() * 12;
        const speed = 20 + rand() * 20;
        const t = performance.now() / 1000;
        const ax = baseX + Math.sin(t * 0.4 + i) * 60;
        const ay = baseY + Math.cos(t * 0.3 + i * 2) * 20;
        ctx.beginPath();
        ctx.arc(ax, ay, r, 0, Math.PI * 2);
        ctx.fillStyle = '#5a4326';
        ctx.fill();
        ctx.strokeStyle = '#7C8F5C';
        ctx.lineWidth = 1;
        ctx.stroke();

        // collision with ship
        if (state === 'playing' && Math.hypot(ship.x - ax, ship.y - ay) < r + 8) {
          if (stats.shieldCharges > 0) {
            stats.shieldCharges -= 1;
            shieldFlash = 0.5;
            ship.vx *= -0.5; ship.vy *= -0.5;
          } else {
            runStats.crashes += 1;
            explode();
            audio.crash();
            state = 'crashed';
            setTimeout(showCrashScreen, 400);
          }
        }
      }
    }

    // Particles
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Ship
    if (state === 'playing' || state === 'levelComplete') drawShip();

    // Fog overlay
    if (cfg.fog) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,7,4,0.88)';
      ctx.fillRect(0, 0, width, height);
      const grad = ctx.createRadialGradient(ship.x, ship.y, 10, ship.x, ship.y, 150);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  function updateHud() {
    if (!hud.fuel) return;
    hud.fuel.textContent = `${Math.round(ship.fuel)}%`;
    if (hud.fuelBar) hud.fuelBar.style.width = `${Math.max(0, ship.fuel)}%`;
    hud.altitude.textContent = terrain ? `${Math.max(0, Math.round(terrainYAt(terrain.points, ship.x) - ship.y))}m` : '—';
    const speed = Math.hypot(ship.vx, ship.vy);
    hud.speed.textContent = `${Math.round(speed)}`;
    hud.speed.style.color = speed < stats.landingSpeedTol ? '#94B03D' : '#C97B3D';
    hud.level.textContent = `${levelIndex + 1} / ${LEVELS.length} — ${LEVELS[levelIndex]?.name ?? ''}`;
  }

  // --- Main loop ---
  let lastT = performance.now();
  let raf = 0;
  function loop(t: number) {
    const dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  showStartScreen();
  raf = requestAnimationFrame(loop);

  return function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    audio.stopThrust();
  };
}
