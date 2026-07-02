// ---------------------------------------------------------------------------
// Moon Lander Roguelite — vanilla Canvas2D + Web Audio, no dependencies.
// Earth-tone ("Hearthwood") visual style to match the rest of the site.
//
// v8 overhaul:
//  - Endless procedural levels (each harder) + Cadet/Pilot/Ace difficulty
//  - Responsive sizing: fills available width, taller canvas on portrait
//    phones, ship rendered ~1.5–1.8x bigger and scaled to the canvas
//  - Reactive pilot face: eyes/mouth located via the FaceDetector API when
//    available (proportional fallback otherwise) and re-rendered live —
//    surprised under thrust, happy on touchdown
//  - Graphics pass: starfield, seeded planet, background ridge, platform
//    pad with beacon lights, layered flame + glow, ground dust, screen
//    shake, confetti, level intro banner
//  - Audio pass: real rocket rumble (filtered noise), melodic SFX, and a
//    musical ambient score (chord swells + pentatonic plucks over the
//    drone) with SEPARATE sfx / music toggles
//
// v10: mechanical split into src/scripts/lander/* modules (commit 1).
//
// commit 2: fixed 120Hz-timestep physics engine (physics.ts) — accumulator
// RAF loop, mass/drag model, swept terrain + projectile collision (no more
// tunneling on fast falls), asteroid logic moved out of the render path
// into entities.ts, and hard gameplay caps in computeStats replaced with
// numerical-stability floors. See lander-v10-refactor-plan.md §4.
// ---------------------------------------------------------------------------

import { mulberry32 } from './rng';
import { RARITY, DIFF_MODS, computeStats, clampGravityProduct, chronoTimeScale, rollCosmicDice as rollCosmicDiceStat, starForgeRarityWeight } from './stats';
import { UPGRADES, PAINTS, TRAILS, SKIES, ACHIEVEMENTS } from './upgrades';
import { levelConfigFor, terrainYAt, generateTerrain, generateSky, generateCritters, generateUfos } from './levels';
import { makeParticle } from './particles';
import {
  generateAsteroids, updateAsteroids, findAsteroidHit, type Asteroid,
  buildDronePool, updateDrones, terraform, shouldRebuild, REBUILD_INTERVAL_S,
} from './entities';
import {
  DT, MAX_FRAME_TIME, effectiveMass, effectiveArea, gravityAccel, thrustAccel, windAccel,
  sweptGroundContact, sweptSegmentCircleHit, clampRotationDelta,
} from './physics';
import { AudioEngine } from './audio/sfx';
import { MusicEngine } from './audio/music';
import { DEFAULT_FACE, analyzeFace, drawShip, checkGhostSave } from './render/ship';
import { drawCritters, drawUfos, drawPad, drawAsteroids, drawDrones, drawNoodle, drawNoodlePiles } from './render/world';
import { updateHud as updateHudEl, drawAbilityPips } from './render/hud';
import { upgradeListHtml, shopItemHtml, trailSwatch, diffButtonsHtml } from './ui/overlays';
import { loadJSON, bestFor as bestForStored, saveBest, fetchLeaderboard as fetchLeaderboardRemote, submitScore as submitScoreRemote } from './persistence';
import { resolveReadyAbility, tickAbilityCooldowns, consumeAbilityCharge } from './abilities';
import {
  createNoodlePile, updateNoodles, compactNoodles, decayNoodlePile,
  checkNoodleSquish, applyNoodleSquish, makeNoodle, NOODLE_SQUISH_VY,
} from './noodles';
import type {
  UpgradeId, LevelConfig, Terrain, Star, Planet, Critter, Ufo, Projectile, Particle,
  ShipStats, FaceMap, Mood, GameState, Difficulty, ScoreRow, Toast, UpgradeDef, Rarity, RunStats,
  Drone, Noodle, AbilityDef,
} from './types';

// --- Main game -----------------------------------------------------------------

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
    best: root.querySelector('[data-hud="best"]') as HTMLElement,
    stardust: root.querySelector('[data-hud="stardust"]') as HTMLElement,
  };
  const overlay = root.querySelector('[data-overlay]') as HTMLElement;
  const overlayContent = root.querySelector('[data-overlay-content]') as HTMLElement;
  const touchLeft = root.querySelector('[data-touch="left"]') as HTMLElement;
  const touchRight = root.querySelector('[data-touch="right"]') as HTMLElement;
  const touchThrust = root.querySelector('[data-touch="thrust"]') as HTMLElement;
  // §6.2 active-ability slot: 4th touch button, hidden by default (CSS class
  // toggled on when the player owns >=1 active-ability upgrade — see
  // updateAbilityButtonVisibility()). No upgrade owns one yet in this
  // commit, so the button stays hidden through Commit 4a.
  const touchAbility = root.querySelector('[data-touch="ability"]') as HTMLElement | null;

  const audio = new AudioEngine();
  const music = new MusicEngine();

  // --- Separate SFX / music toggles + volume sliders ---
  const sfxBtn = root.querySelector('[data-mute-sfx]') as HTMLElement | null;
  const musicBtn = root.querySelector('[data-mute-music]') as HTMLElement | null;
  const sfxSlider = root.querySelector('[data-vol-sfx]') as HTMLInputElement | null;
  const musicSlider = root.querySelector('[data-vol-music]') as HTMLInputElement | null;
  let sfxOn = true;
  let musicOn = true;
  try {
    const legacy = localStorage.getItem('lander-muted');
    if (legacy === '1') { sfxOn = false; musicOn = false; }
    const s = localStorage.getItem('lander-sfx');
    const m = localStorage.getItem('lander-music');
    if (s !== null) sfxOn = s === '1';
    if (m !== null) musicOn = m === '1';
    const sv = parseInt(localStorage.getItem('lander-sfx-vol') ?? '90', 10);
    const mv = parseInt(localStorage.getItem('lander-music-vol') ?? '75', 10);
    audio.setVolume((isNaN(sv) ? 90 : sv) / 100);
    music.setVolume((isNaN(mv) ? 75 : mv) / 100);
    if (sfxSlider) sfxSlider.value = String(isNaN(sv) ? 90 : sv);
    if (musicSlider) musicSlider.value = String(isNaN(mv) ? 75 : mv);
  } catch (e) {}

  sfxSlider?.addEventListener('input', () => {
    audio.setVolume(parseInt(sfxSlider.value, 10) / 100);
    try { localStorage.setItem('lander-sfx-vol', sfxSlider.value); } catch (e) {}
  });
  musicSlider?.addEventListener('input', () => {
    music.setVolume(parseInt(musicSlider.value, 10) / 100);
    try { localStorage.setItem('lander-music-vol', musicSlider.value); } catch (e) {}
  });

  function applySound() {
    audio.enabled = sfxOn;
    if (!sfxOn) audio.stopThrust();
    music.setEnabled(musicOn && state !== 'start');
    if (sfxBtn) sfxBtn.textContent = sfxOn ? '🔊' : '🔇';
    if (musicBtn) musicBtn.textContent = musicOn ? '🎵' : '🔕';
    if (sfxBtn) sfxBtn.style.opacity = sfxOn ? '1' : '0.5';
    if (musicBtn) musicBtn.style.opacity = musicOn ? '1' : '0.5';
  }
  sfxBtn?.addEventListener('click', () => {
    sfxOn = !sfxOn;
    try { localStorage.setItem('lander-sfx', sfxOn ? '1' : '0'); } catch (e) {}
    applySound();
  });
  musicBtn?.addEventListener('click', () => {
    musicOn = !musicOn;
    try { localStorage.setItem('lander-music', musicOn ? '1' : '0'); } catch (e) {}
    applySound();
  });

  // --- Run state ---
  let state: GameState = 'start';
  let levelIndex = 0;
  let cfg: LevelConfig = levelConfigFor(0, 'pilot');
  let difficulty: Difficulty = 'pilot';
  try {
    const d = localStorage.getItem('lander-diff');
    if (d === 'cadet' || d === 'pilot' || d === 'ace') difficulty = d;
  } catch (e) {}

  function bestFor(d: Difficulty): number {
    return bestForStored(d);
  }

  let pickedUpgrades: UpgradeId[] = [];
  let stats = computeStats([], difficulty);
  let terrain: Terrain;
  let sky: { stars: Star[]; planet: Planet };
  let particles: Particle[] = [];
  let critters: Critter[] = [];
  let ufos: Ufo[] = [];
  let projectiles: Projectile[] = [];
  let asteroids: Asteroid[] = [];
  // §5.1 Alien Diplomacy stack 2+: ally shots fired by friendly UFOs at
  // asteroids (never at the ship). Kept separate from hostile `projectiles`
  // so the existing ship-hit collision loop never has to special-case them.
  let allyProjectiles: { x: number; y: number; vx: number; vy: number; alive: boolean; target: Asteroid }[] = [];

  // --- lander-v10 commit 4a: new-systems scaffolding state (§6) ---
  // §6.1 Noodle piles: a Float32Array parallel to terrain.points, rebuilt on
  // loadLevel. `noodles` are the falling strand particles pre-absorption.
  let noodlePile: Float32Array = new Float32Array(0);
  let noodles: Noodle[] = [];
  let thrusterParticleTick = 0; // counts thruster-particle emissions for the "every 3rd is a noodle" rule
  // §6.3 Drones — pooled per stats.droneCharges (0 today, no upgrade sets it).
  let drones: Drone[] = [];
  // §6.4 Terraform dirty-flag throttle (real static-layer cache is Commit 5's
  // job; this is the throttled-rebuild pattern it will plug into).
  let terrainDirty = false;
  let lastTerrainRebuildTime = 0;
  // §6.2 Active-ability slot: live cooldown/charge state per owned ability,
  // rebuilt from stats.abilityDefs whenever it changes (see syncAbilityDefStates).
  let abilityDefStates: AbilityDef[] = [];
  let simTime = 0; // accumulated sim seconds (fixed-step ticks only) — drives asteroid orbits, moved out of the render path per §4.4
  let windPhase = 0;
  let shieldFlash = 0;
  let shakeT = 0;
  let introT = 0;
  let celebrateT = 0;
  let bouncesUsed = 0;      // boomerang hull, per level
  let phoenixUsed = 0;      // phoenix feather, per run
  let phoenixFlashT = 0;    // golden revive flash
  let slowmoActive = false; // chrono crystal state, read by draw()
  let runStats: RunStats = { crashes: 0, landings: 0, skips: 0 };

  // --- lander-v10 commit 4b (§7): new-mechanic per-level/per-run state -----
  let lrHoldT = 0;                 // seconds L+R have been held together (gravity flip charge gesture)
  let gravityFlipActiveT = 0;      // seconds remaining of an active gravity reversal
  let gravityFlipCooldownT = 0;    // seconds remaining until gravity flip can trigger again
  let lastLeftTapT = -10;          // performance.now()/1000 of last left tap-down (double-tap detection)
  let lastRightTapT = -10;
  let geckoUsed = 0;               // Gecko Struts charges used this level
  let cheeseUsed = 0;              // Cheese Drill charges used this level
  let bubbleWrapUsed = 0;          // Bubble Wrap Hull charges used this level
  let dropTankJettisoned = false;  // Drop Tanks — fires once per level at half fuel
  let nanoAirborneT = 0;           // Nano-Repair Swarm — seconds airborne accumulator
  let valkyrieUsed = 0;            // Valkyrie Autopilot — per-run charge usage (not reset per level)
  let valkyrieActive = false;      // true while the PD-controller autopilot is flying the ship
  let cosmicDiceRoll: { up: string; down: string } | null = null; // this level's Cosmic Dice pick
  let landedWithDice = false;      // set true at touchdown if cosmic dice was active this level
  let landedWithAutopilot = false; // set true at touchdown if valkyrie autopilot flew the landing
  let moonAngle = 0;               // Pocket Moon orbit angle
  let pendingNextLevel = 1;        // level index to load next — usually levelIndex+1, but Big Crunch advances by 1+doubleProgress
  // §6.2 active-ability effect state (Commit 4b wires the actual behavior):
  let timeBankT = 0;                // seconds of 0.5x slow-mo remaining (Time Bank)
  let singularityT = 0;             // seconds of hazard-freeze remaining (Singularity Anchor)
  let grapplingT = 0;                // seconds remaining winching toward the pad (Grappling Hook)
  let grapplingTargetX = 0, grapplingTargetY = 0;
  let kickPendingLeft = false;       // one-shot flags consumed by step() — set on a detected double-tap
  let kickPendingRight = false;
  let valkyrieThrustOn = false;      // set by runValkyrieAutopilot() each tick — whether the PD controller wants thrust

  // Pilot selfie — session-only, in memory (never persisted to disk).
  let pilotPhoto: HTMLCanvasElement | null = null;
  let faceMap: FaceMap = DEFAULT_FACE;
  let cameraStream: MediaStream | null = null;

  let stardust = 0;
  try { stardust = parseInt(localStorage.getItem('lander-stardust') || '0', 10) || 0; } catch (e) {}
  function stardustAdd(n: number) {
    stardust = Math.max(0, stardust + n);
    try { localStorage.setItem('lander-stardust', String(stardust)); } catch (e) {}
  }

  let cosmetics = loadJSON('lander-cosmetics', {
    owned: ['paint_classic', 'trail_ember', 'sky_hearthwood'] as string[],
    paint: 'paint_classic',
    trail: 'trail_ember',
    sky: 'sky_hearthwood',
  });
  function saveCosmetics() {
    try { localStorage.setItem('lander-cosmetics', JSON.stringify(cosmetics)); } catch (e) {}
  }
  const equippedPaint = () => PAINTS.find((p) => p.id === cosmetics.paint) ?? PAINTS[0];
  const equippedSky = () => SKIES.find((s) => s.id === cosmetics.sky) ?? SKIES[0];
  function trailColors(): string[] {
    const t = TRAILS.find((x) => x.id === cosmetics.trail) ?? TRAILS[0];
    if (t.colors === 'rainbow') {
      const h = (performance.now() / 18) % 360;
      return [`hsl(${h.toFixed(0)}, 72%, 62%)`, `hsl(${((h + 46) % 360).toFixed(0)}, 72%, 55%)`];
    }
    if (t.colors === 'stardust') return ['#F4EBDA', '#FFE9B0', '#FFC94A'];
    return t.colors;
  }

  let achievements = loadJSON<Record<string, boolean>>('lander-achievements', {});
  let toasts: Toast[] = [];
  function unlockAch(id: string) {
    if (achievements[id]) return;
    achievements[id] = true;
    try { localStorage.setItem('lander-achievements', JSON.stringify(achievements)); } catch (e) {}
    const def = ACHIEVEMENTS.find((a) => a.id === id);
    if (def) toasts.push({ text: `🏆 ${def.icon} ${def.name}  ·  +25✨`, t: 4.2 });
    stardustAdd(25);
    audio.raritySting(2);
  }

  let pilotName = '';
  try { pilotName = localStorage.getItem('lander-pilot') || ''; } catch (e) {}

  // --- Global leaderboard client (Netlify Function + Blobs at /api/scores).
  // Fully optional: if the endpoint isn't there, everything degrades to
  // local bests and the leaderboard screen says so.
  let lbCache: ScoreRow[] | null = null;
  let lbOffline = false;

  async function fetchLeaderboard(): Promise<ScoreRow[] | null> {
    const data = await fetchLeaderboardRemote();
    if (data) {
      lbCache = data;
      lbOffline = false;
      return data;
    }
    lbOffline = true;
    return null;
  }

  async function submitScore(name: string, level: number): Promise<boolean> {
    return submitScoreRemote(name, level, difficulty);
  }

  let width = 0, height = 0, dpr = 1;
  let S = 1.6; // ship render/collision scale

  const ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: 100, thrusting: false,
    reserveUsed: false,
  };

  const input = { left: false, right: false, thrust: false };

  // --- Responsive sizing: fill the container, go taller on portrait phones ---
  function resize() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const portrait = window.innerHeight > window.innerWidth * 1.1;
    let w = Math.min(rect.width, 1200);
    const aspect = portrait ? 1.15 : 0.62;
    let h = Math.round(w * aspect);
    const maxH = Math.round(window.innerHeight * (portrait ? 0.66 : 0.72));
    if (h > maxH && maxH > 160) h = maxH;
    width = w;
    height = h;
    // Big ship — the pilot's face is a feature, so it gets real pixels.
    // Scaled to the canvas: ~1.6x on phones up to ~2.3x on desktop.
    S = Math.max(1.6, Math.min(2.3, width / 420));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (terrain) {
      terrain = generateTerrain(cfg, width, height);
      sky = generateSky(cfg, width, height);
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
    stats = computeStats(pickedUpgrades, difficulty);
    runStats = { crashes: 0, landings: 0, skips: 0 };
    phoenixUsed = 0;
    valkyrieUsed = 0; // §7: Valkyrie Autopilot charges are per-run, not per-level
    music.ensure();
    loadLevel(0);
    state = 'playing';
    setOverlay(null);
    applySound();
    if (musicOn) music.start();
  }

  function loadLevel(idx: number) {
    levelIndex = idx;
    cfg = levelConfigFor(idx, difficulty);
    terrain = generateTerrain(cfg, width, height);
    sky = generateSky(cfg, width, height);
    ship.x = width * 0.5;
    ship.y = height * 0.1;
    ship.vx = (Math.random() - 0.5) * 20;
    ship.vy = 10;
    ship.angle = 0;
    ship.fuel = stats.maxFuel;
    ship.reserveUsed = false;
    particles = [];
    critters = generateCritters(cfg, terrain, width);
    ufos = generateUfos(cfg, width, height);
    hackedUfos.clear();
    // §7 Mothership's Favor: +1 friendly escort UFO per stack that shoots
    // asteroids & hostile UFOs (con: "sky gets +1 (friendly) UFO of
    // crowding" — spawned in addition to the level's hazard UFOs, then
    // marked as hacked/friendly immediately below via hackedUfos so
    // updateUfos treats it as an ally from tick one).
    if (stats.escortUfos > 0) {
      const erand = mulberry32(cfg.seed * 919 + 5);
      for (let i = 0; i < stats.escortUfos; i++) {
        const baseY = height * (0.1 + erand() * 0.1);
        const escort: Ufo = {
          x: width * (0.15 + erand() * 0.7), y: baseY, baseY,
          vx: (erand() > 0.5 ? 1 : -1) * (16 + erand() * 10),
          phase: erand() * Math.PI * 2, fireCooldown: 1 + erand() * 1.5, telegraph: 0, alive: true,
        };
        ufos.push(escort);
        hackedUfos.add(escort);
      }
    }
    projectiles = [];
    allyProjectiles = [];
    asteroids = generateAsteroids(cfg, width, height, S);
    windPhase = Math.random() * 10;
    introT = 2.4;
    celebrateT = 0;
    bouncesUsed = 0;
    // §6.1 Noodle piles reset per level (a pile from a prior level's terrain
    // wouldn't map to this level's new terrain sample points anyway).
    noodlePile = createNoodlePile(terrain.points.length);
    noodles = [];
    // §6.3 Drone pool rebuilt from the current droneCharges stat (0 today).
    drones = buildDronePool(stats.droneCharges);
    terrainDirty = false;
    lastTerrainRebuildTime = simTime;
    // --- lander-v10 commit 4b (§7): per-level mechanic state resets --------
    lrHoldT = 0;
    gravityFlipActiveT = 0;
    gravityFlipCooldownT = 0;
    lastLeftTapT = -10;
    lastRightTapT = -10;
    geckoUsed = 0;
    cheeseUsed = 0;
    bubbleWrapUsed = 0;
    dropTankJettisoned = false;
    nanoAirborneT = 0;
    valkyrieActive = false;
    landedWithDice = false;
    landedWithAutopilot = false;
    moonAngle = 0;
    cosmicDiceRoll = stats.cosmicDiceStacks > 0 ? rollCosmicDice() : null;
    if (cosmicDiceRoll) {
      toasts.push({ text: `🎲 ${cosmicDiceRoll.up} ×2 / ${cosmicDiceRoll.down} ×0.5`, t: 3.5 });
      applyCosmicDice();
    }
    syncAbilityDefStates();
    music.setTension(Math.min(1, idx / 14));
  }

  // §7 Implementation notes: Cosmic Dice pool = {thrustPower, maxFuel,
  // rotMult, landingSpeedTol, windMult, fuelBurnMult}. Each level roll picks
  // TWO DISTINCT stats from this pool: one is doubled, one is halved.
  // fuelBurnMult×0.5 is the "good" halved-side outcome (less fuel burn is a
  // buff), so no sign inversion is needed anywhere — a straight ×2/×0.5 on
  // the raw stat value is correct for every entry in the pool. Delegates to
  // stats.ts's rollCosmicDice (exported there for direct unit testing).
  function rollCosmicDice(): { up: string; down: string } {
    const { up, down } = rollCosmicDiceStat();
    return { up: up as string, down: down as string };
  }

  // Applies the rolled Cosmic Dice pair directly onto the already-computed
  // `stats` object for this level (computeStats itself has no notion of
  // per-level dice rolls — they're layered on top, re-applied every
  // loadLevel via cosmicDiceRoll so re-rolling next level doesn't compound).
  function applyCosmicDice() {
    if (!cosmicDiceRoll) return;
    const up = cosmicDiceRoll.up as keyof ShipStats;
    const down = cosmicDiceRoll.down as keyof ShipStats;
    (stats[up] as number) = (stats[up] as number) * 2;
    (stats[down] as number) = (stats[down] as number) * 0.5;
  }

  // §6.2: rebuilds abilityDefStates from stats.abilityDefs (owned ability
  // ids) each level load — resets charges/cooldowns per level, EXCEPT
  // Phoenix Feather (tracked separately via phoenixUsed, per-run) and
  // Valkyrie Autopilot, which per §7's implementation notes is also
  // per-run (not reset between levels) — its remaining charges carry over,
  // computed as stats.phoenixCharges-style: owned stacks minus valkyrieUsed.
  function syncAbilityDefStates() {
    abilityDefStates = stats.abilityDefs.map((id) => {
      if (id === 'valkyrie_autopilot') {
        const totalStacks = pickedUpgrades.filter((u) => u === 'valkyrie_autopilot').length;
        return { id, charges: Math.max(0, totalStacks - valkyrieUsed), maxCharges: totalStacks, cooldown: 0, maxCooldown: 0 };
      }
      return { id, charges: 1, maxCharges: 1, cooldown: 0, maxCooldown: 8 };
    });
    updateAbilityButtonVisibility();
  }

  function updateAbilityButtonVisibility() {
    if (!touchAbility) return;
    touchAbility.classList.toggle('hidden', stats.abilityDefs.length === 0);
  }

  // §6.2: fires the highest-priority ready ability (first match in
  // ABILITY_PRIORITY order). Priority: Valkyrie Autopilot -> Wormhole
  // Pocket -> Time Bank -> Singularity Anchor -> Grappling Hook (§6.2,
  // resolveReadyAbility already enforces this order). No-op if none are
  // owned/ready.
  function fireAbility() {
    if (state !== 'playing' || !terrain) return;
    const def = resolveReadyAbility(abilityDefStates);
    if (!def) return;
    consumeAbilityCharge(def);
    audio.select();
    const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
    switch (def.id) {
      case 'valkyrie_autopilot':
        // §7 implementation notes: PD controller, target pad center,
        // descent 30 px/s, angle 0, kp=2.2, kd=1.6 both axes. Disables
        // input and clamps touchdown velocity so it's a guaranteed
        // landing, not a simulation gamble.
        valkyrieActive = true;
        valkyrieUsed += 1;
        break;
      case 'wormhole_pocket': {
        // Teleport 80px toward the pad (+80 per stack) — jump distance
        // scales with how many Wormhole Pocket stacks are owned.
        const stacks = pickedUpgrades.filter((u) => u === 'wormhole_pocket').length;
        const dist = 80 * Math.max(1, stacks);
        const dx = padCx - ship.x;
        const dist2Pad = Math.hypot(dx, terrain.pad.y - ship.y) || 1;
        const jump = Math.min(dist, dist2Pad);
        ship.x += (dx / dist2Pad) * jump;
        ship.fuel = Math.max(0, ship.fuel - 12);
        shakeT = Math.max(shakeT, 0.15);
        break;
      }
      case 'time_bank':
        // 3s of 0.5x slow-mo on demand (+3s bank per stack). Fuel drains
        // at real time during (handled in step() via raw dt for burn).
        timeBankT += 3;
        break;
      case 'singularity_anchor':
        // Freeze all hazards (UFOs/projectiles/asteroids) 4s/level (+2s
        // per stack).
        singularityT += 4;
        break;
      case 'grappling_hook':
        // Fire hook at the pad if within 240px, winch at 90px/s.
        if (Math.hypot(padCx - ship.x, terrain.pad.y - ship.y) <= 240) {
          grapplingT = 3;
          grapplingTargetX = padCx;
          grapplingTargetY = terrain.pad.y - 12 * S;
        }
        break;
    }
  }

  // §7 Valkyrie Autopilot: PD controller targeting the pad center at a
  // descent rate of 30px/s and angle 0. kp=2.2, kd=1.6 on both axes. Sets
  // ship.angle directly (rotation is "free" while the autopilot flies —
  // matching "disable input while active") and valkyrieThrustOn for step()
  // to apply thrust acceleration through the normal thrust path (so fuel
  // burn/particles/audio stay consistent). Deactivates once the ship is on
  // the ground (handled by the normal touchdown path, which clamps landing
  // velocity to tolerance so it always counts as a safe landing).
  function runValkyrieAutopilot(dt: number) {
    if (!terrain) { valkyrieActive = false; return; }
    const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
    const targetVy = 30;
    const kp = 2.2, kd = 1.6;
    const errX = padCx - ship.x;
    const errVx = -ship.vx;
    const desiredAx = kp * errX * 0.01 + kd * errVx * 0.01;
    const targetAngle = Math.max(-0.5, Math.min(0.5, -desiredAx));
    const errAngle = targetAngle - ship.angle;
    ship.angle += Math.max(-2.6 * dt, Math.min(2.6 * dt, errAngle * kp));

    const errVy = targetVy - ship.vy;
    valkyrieThrustOn = errVy < -kd * 4 || ship.vy > targetVy;
    landedWithAutopilot = true;
  }

  function currentWind(c: LevelConfig, t: number) {
    // §7 Cloud Seeder: gust amplitude ×gustMult (defaults 1). §7 Storm
    // Caller: wind always blows toward the pad instead of whatever
    // direction the level rolled — sign of the base wind is flipped to
    // point from ship.x toward the pad center when owned.
    const base = stats.stormTowardPad && terrain
      ? Math.abs(c.wind) * Math.sign((terrain.pad.xStart + terrain.pad.xEnd) / 2 - ship.x || 1)
      : c.wind;
    return base + Math.sin(t * 0.6) * c.windGust * stats.gustMult;
  }

  function emitThrusterParticles() {
    const colors = stats.spicyFlame ? ['#94B03D', '#D9E8B8'] : trailColors();
    for (let i = 0; i < 3; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = (70 + Math.random() * 50) * S;
      const a = ship.angle + Math.PI + spread;
      particles.push(makeParticle(
        ship.x - Math.sin(ship.angle) * 12 * S,
        ship.y + Math.cos(ship.angle) * 12 * S,
        Math.sin(a) * speed + ship.vx * 0.3,
        -Math.cos(a) * speed + ship.vy * 0.3,
        colors[Math.floor(Math.random() * colors.length)],
        0.35 + Math.random() * 0.3,
        (1.5 + Math.random() * 2) * S
      ));
    }
  }

  // §6.1: emits `stacks` noodle strands from the engine, mirroring
  // emitThrusterParticles' spawn geometry. Accepts a stack-count multiplier
  // per the plan (×n emission) even though no upgrade sets noodleStacks yet.
  function emitNoodles(stacks: number) {
    const count = Math.max(1, Math.round(stacks));
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = (50 + Math.random() * 40) * S;
      const a = ship.angle + Math.PI + spread;
      noodles.push(makeNoodle(
        ship.x - Math.sin(ship.angle) * 12 * S,
        ship.y + Math.cos(ship.angle) * 12 * S,
        Math.sin(a) * speed + ship.vx * 0.3,
        -Math.cos(a) * speed + ship.vy * 0.3
      ));
    }
  }

  function emitDust(groundY: number) {
    for (let i = 0; i < 2; i++) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      particles.push(makeParticle(
        ship.x + (Math.random() - 0.5) * 20 * S,
        groundY - 2,
        dir * (30 + Math.random() * 60),
        -(10 + Math.random() * 30),
        Math.random() > 0.5 ? 'rgba(185,164,128,0.5)' : 'rgba(122,100,70,0.5)',
        0.5 + Math.random() * 0.5,
        (2 + Math.random() * 3) * S,
        14
      ));
    }
  }

  function explode() {
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * S;
      particles.push(makeParticle(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        Math.random() > 0.5 ? '#C97B3D' : (Math.random() > 0.5 ? '#94B03D' : '#F4EBDA'),
        0.5 + Math.random() * 0.7,
        (2 + Math.random() * 3) * S,
        60
      ));
    }
    shakeT = 0.55;
  }

  function confetti() {
    const colors = ['#94B03D', '#D9A441', '#C97B3D', '#F4EBDA', '#7C8F5C'];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const speed = (60 + Math.random() * 120) * S;
      particles.push(makeParticle(
        ship.x, ship.y - 8 * S,
        Math.cos(a) * speed, Math.sin(a) * speed,
        colors[Math.floor(Math.random() * colors.length)],
        0.8 + Math.random() * 0.6,
        (1.5 + Math.random() * 2.2) * S,
        110
      ));
    }
  }

  function normalizeAngle(a: number) {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  function simulateParticles(dt: number) {
    particles = particles.filter((p) => p.life > 0);
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      p.life -= dt;
    }
  }

  // --- Frame-rate-driven cosmetic timers -------------------------------------
  // Not physics: screen shake, toast fade, phoenix flash, and the level-intro
  // banner are pure visual timers and run once per rendered frame (frameDt),
  // outside the fixed-timestep physics accumulator. See §4.1.
  function updateFrameTimers(frameDt: number) {
    if (shakeT > 0) shakeT -= frameDt;
    if (phoenixFlashT > 0) phoenixFlashT -= frameDt;
    if (toasts.length) {
      for (const toast of toasts) toast.t -= frameDt;
      toasts = toasts.filter((x) => x.t > 0);
    }
    if (state === 'levelComplete') {
      simulateParticles(frameDt);
      if (celebrateT > 0) {
        celebrateT -= frameDt;
        if (celebrateT <= 0) showLevelComplete();
      }
      return;
    }
    if (state !== 'playing') {
      slowmoActive = false;
      simulateParticles(frameDt);
      return;
    }
    if (introT > 0) introT -= frameDt;
  }

  // --- Fixed-timestep physics tick (§4.1–§4.4) --------------------------------
  // Called from the RAF loop's accumulator `while (acc >= DT) { step(DT); ... }`.
  // `dt` is always the fixed physics tick (DT), scaled by the Chrono Crystal
  // slow-mo world-time-scale (0.75) when active — see `pdt` below. Fuel drain
  // and cooldowns intentionally use the UNSCALED `dt` (raw tick time), exactly
  // as the legacy per-frame code used raw frame dt for those — that's the
  // Chrono Crystal tradeoff (world slows, fuel clock doesn't).
  function step(dt: number) {
    if (state !== 'playing') return;

    // Chrono Crystal: the world runs at 0.75^n below 120m (§5.1 — stacks
    // compound the slow-mo depth, not just its presence) — but the fuel
    // clock doesn't care (that's the tradeoff), so drains use raw dt.
    const altNow = terrain ? terrainYAt(terrain.points, ship.x) - ship.y : 999;
    slowmoActive = stats.slowmo && altNow < 120;
    const pdt = slowmoActive ? dt * chronoTimeScale(stats.chronoStacks) : dt;

    simTime += pdt;
    windPhase += pdt;

    // §6.2/§7 ability duration timers tick on raw dt (not slowed further by
    // Chrono, matching how other cooldowns already use raw dt in this fn).
    if (timeBankT > 0) timeBankT = Math.max(0, timeBankT - dt);
    if (singularityT > 0) singularityT = Math.max(0, singularityT - dt);
    if (grapplingT > 0) grapplingT = Math.max(0, grapplingT - dt);
    // Time Bank: while banked seconds remain, the world runs at 0.5x — an
    // always-available slow-mo layered independently of Chrono Crystal.
    const timeBankActive = timeBankT > 0;
    const effPdt = timeBankActive ? pdt * 0.5 : pdt;

    // §7 Gravity Flip Coil: hold L+R for 1s to trigger a reversal (duration
    // stats.gravityFlipDuration, cooldown 8s). Active reversal flips the
    // sign of gravity for its duration.
    if (gravityFlipCooldownT > 0) gravityFlipCooldownT = Math.max(0, gravityFlipCooldownT - dt);
    if (gravityFlipActiveT > 0) gravityFlipActiveT = Math.max(0, gravityFlipActiveT - dt);
    const bothHeld = input.left && input.right;
    if (stats.gravityFlipCharges > 0 && bothHeld && gravityFlipActiveT <= 0 && gravityFlipCooldownT <= 0) {
      lrHoldT += dt;
      if (lrHoldT >= 1) {
        gravityFlipActiveT = stats.gravityFlipDuration;
        gravityFlipCooldownT = 8;
        lrHoldT = 0;
        audio.select();
      }
    } else if (!bothHeld) {
      lrHoldT = 0;
    }
    // §7 Air Brakes: hold L+R (independent of the gravity-flip gesture —
    // both can be owned at once) damps velocity 20%/stack per second while
    // held, burning 3 fuel/s.
    if (stats.airBrakes > 0 && bothHeld && ship.fuel > 0) {
      const damp = Math.min(0.95, 0.2 * stats.airBrakes * dt);
      ship.vx *= (1 - damp);
      ship.vy *= (1 - damp);
      ship.fuel = Math.max(0, ship.fuel - 3 * dt);
    }

    // §7 Kick Thrusters: double-tap L or R fires a sideways impulse. Tap
    // edges are detected in keydown/bindTouch (see input.left/.right
    // transition handlers below) via lastLeftTapT/lastRightTapT timestamps
    // that get stamped on press; here we just consume the resulting
    // one-shot `kickPending` flags set by those handlers.
    if (kickPendingLeft) {
      kickPendingLeft = false;
      if (stats.kickThrusters > 0 && ship.fuel >= 4) {
        ship.vx -= 60 * stats.kickThrusters;
        ship.fuel = Math.max(0, ship.fuel - 4);
        shakeT = Math.max(shakeT, 0.08);
      }
    }
    if (kickPendingRight) {
      kickPendingRight = false;
      if (stats.kickThrusters > 0 && ship.fuel >= 4) {
        ship.vx += 60 * stats.kickThrusters;
        ship.fuel = Math.max(0, ship.fuel - 4);
        shakeT = Math.max(shakeT, 0.08);
      }
    }

    // Rotation — direct control, simple & predictable. Per-tick delta is
    // clamped to a numerical-stability floor (§4.5) — unreachable at normal
    // rotMult values, only guards against degenerate stacking. Valkyrie
    // Autopilot overrides all manual input with a PD controller (§7).
    const rotSpeed = 2.6 * stats.rotMult;
    if (valkyrieActive && terrain) {
      runValkyrieAutopilot(effPdt);
    } else {
      if (input.left) ship.angle -= clampRotationDelta(rotSpeed * effPdt);
      if (input.right) ship.angle += clampRotationDelta(rotSpeed * effPdt);
    }

    // --- §4.2 Mass & drag model -------------------------------------------
    const mass = effectiveMass({ massSum: stats.massSum, areaSum: stats.areaSum });
    const area = effectiveArea({ massSum: stats.massSum, areaSum: stats.areaSum });
    const gravMultFloored = clampGravityProduct(cfg.gravity, stats.gravityMult * (stats.antigravPaint > 0 ? 1 : 1));
    // §7 Gravity Flip Coil: while active, gravity's sign flips (still
    // respects the §4.5 "product >= 1 px/s^2" floor magnitude, just signed).
    const gravitySign = gravityFlipActiveT > 0 ? -1 : 1;

    // Gravity + wind
    ship.vy += gravitySign * gravityAccel(cfg.gravity, gravMultFloored, mass) * effPdt;
    ship.vx += windAccel(currentWind(cfg, windPhase), stats.windMult, area, mass) * effPdt;

    // §7 Pad Tractor Winch: below 100m, gentle pull toward pad center
    // (8 px/s² × stack count).
    if (stats.padPull > 0 && terrain) {
      const alt = terrainYAt(terrain.points, ship.x) - ship.y;
      if (alt < 100) {
        const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
        const dir = Math.sign(padCx - ship.x);
        ship.vx += dir * stats.padPull * effPdt;
      }
    }

    // §7 Storm Caller pull is folded into currentWind() above (wind always
    // toward the pad); nothing further needed here.

    // §7 Grappling Hook: while winching, pull the ship toward the hooked
    // pad point at 90px/s (overrides normal drift on that axis).
    if (grapplingT > 0) {
      const dx = grapplingTargetX - ship.x;
      const dy = grapplingTargetY - ship.y;
      const d = Math.hypot(dx, dy) || 1;
      const speed = 90;
      ship.vx = (dx / d) * speed;
      ship.vy = (dy / d) * speed;
    }

    // Thrust
    ship.thrusting = input.thrust && ship.fuel > 0 && !valkyrieActive;
    const autopilotThrusting = valkyrieActive && valkyrieThrustOn;
    if (ship.thrusting || autopilotThrusting) {
      ship.thrusting = true;
      const a = thrustAccel(stats.thrustPower, mass);
      ship.vx += Math.sin(ship.angle) * a * effPdt;
      ship.vy -= Math.cos(ship.angle) * a * effPdt;
      // §7 Black Hole Engine: thrust costs zero fuel below 25% of the tank.
      const freeThrust = stats.blackholeReserve > 0 && ship.fuel <= stats.maxFuel * 0.25;
      if (!freeThrust) {
        ship.fuel = Math.max(0, ship.fuel - 22 * stats.fuelBurnMult * dt);
      }
      emitThrusterParticles();
      // §6.1 Spaghetti Engine: every 3rd thruster particle is a noodle
      // instead, when the upgrade is owned (noodleStacks > 0). Emission
      // rate scales ×n with stack count.
      if (stats.noodleStacks > 0 && thrusterParticleTick % 3 === 0) {
        emitNoodles(stats.noodleStacks);
      }
      thrusterParticleTick += 1;
      audio.startThrust();
      music.duck(true);
    } else {
      // §7 Dyson Sail: +4 fuel/s ALWAYS, even thrusting (added below as a
      // flat regen rate) — but here (engines off) all engines-off regen
      // sources (Fuel Scoop, Solar Wings) apply as before.
      if (stats.fuelRegen > 0) {
        ship.fuel = Math.min(stats.maxFuel, ship.fuel + stats.fuelRegen * dt);
      }
      audio.stopThrust();
      music.duck(false);
    }
    // Dyson Sail — always-on regen regardless of thrust state (§7 table:
    // "+4 fuel/s regen ALWAYS (even thrusting)").
    if (stats.sailRegen > 0) {
      ship.fuel = Math.min(stats.maxFuel, ship.fuel + stats.sailRegen * dt);
    }
    // §7 Nano-Repair Swarm: every N seconds airborne, +1 shield charge
    // (banked up to `stacks`, i.e. Nano-Repair upgrade count).
    if (stats.nanoRegenSec > 0 && terrain) {
      const alt = terrainYAt(terrain.points, ship.x) - ship.y;
      if (alt > 20) {
        nanoAirborneT += dt;
        const nanoStacks = pickedUpgrades.filter((u) => u === 'nano_repair').length;
        if (nanoAirborneT >= stats.nanoRegenSec && stats.shieldCharges < nanoStacks) {
          nanoAirborneT = 0;
          stats.shieldCharges += 1;
          toasts.push({ text: '🔧 +1 shield charge', t: 1.6 });
        }
      } else {
        nanoAirborneT = 0;
      }
    }

    // §7 Hover Module: below 60m, auto-limit descent to 40px/s while fuel
    // lasts (6 fuel/s while hovering).
    if (stats.hoverModule > 0 && terrain) {
      const alt = terrainYAt(terrain.points, ship.x) - ship.y;
      if (alt < 60 && ship.vy > 40 && ship.fuel > 0) {
        ship.vy = 40;
        ship.fuel = Math.max(0, ship.fuel - 6 * dt);
      }
    }

    // --- §4.3 Swept integration + terrain collision -------------------------
    const x0 = ship.x, y0 = ship.y, vx0 = ship.vx, vy0 = ship.vy;
    let x1 = x0 + ship.vx * effPdt;
    let y1 = y0 + ship.vy * effPdt;
    // §7 Bounce Bumpers: screen-edge bounces become lossless (no 0.4 energy
    // loss) plus a small outward boost, instead of the default lossy bounce.
    const bumperOwned = pickedUpgrades.includes('bounce_bumpers');
    if (x1 < 6 * S) {
      x1 = 6 * S;
      ship.vx = bumperOwned ? Math.abs(ship.vx) * 1.15 : ship.vx * -0.4;
    }
    if (x1 > width - 6 * S) {
      x1 = width - 6 * S;
      ship.vx = bumperOwned ? -Math.abs(ship.vx) * 1.15 : ship.vx * -0.4;
    }
    if (y1 < 18 * S) { y1 = 18 * S; ship.vy = Math.max(0, ship.vy); }
    const vx1 = ship.vx, vy1 = ship.vy;

    const contact = sweptGroundContact(terrain, x0, y0, vx0, vy0, x1, y1, vx1, vy1, 9 * S);
    if (contact.hit) {
      ship.x = contact.x;
      ship.y = contact.y;
      ship.vx = contact.vx;
      ship.vy = contact.vy;
    } else {
      ship.x = x1;
      ship.y = y1;
    }

    // Moving pad — ping-pongs between baseX ± range along its pre-flattened
    // corridor (baseX is a fixed origin; see generateTerrain).
    if (cfg.movingPad) {
      const shift = terrain.pad.vx * effPdt;
      terrain.pad.xStart += shift;
      terrain.pad.xEnd += shift;
      const center = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      if ((terrain.pad.vx > 0 && center >= terrain.pad.baseX + terrain.pad.range) ||
          (terrain.pad.vx < 0 && center <= terrain.pad.baseX - terrain.pad.range)) {
        terrain.pad.vx *= -1;
      }
    }

    simulateParticles(effPdt);
    if (shieldFlash > 0) shieldFlash -= dt;

    // §7 Tailwind Turbine: +1 fuel/s per 10 wind speed, ×stack count.
    if (stats.tailwindTurbine > 0) {
      const windSpeed = Math.abs(currentWind(cfg, windPhase));
      ship.fuel = Math.min(stats.maxFuel, ship.fuel + (windSpeed / 10) * stats.tailwindTurbine * dt);
    }

    // §7 Drop Tanks jettison — purely cosmetic, fires once per level at
    // half fuel: spawns 2 tank-shaped particles with gravity that despawn
    // on terrain contact (they're just regular pooled particles with a
    // slightly larger size/darker color to read as "tanks", reusing the
    // same particle system splat/dust effects already use).
    if (stats.dropTankStacks > 0 && !dropTankJettisoned && ship.fuel <= stats.maxFuel * 0.5) {
      dropTankJettisoned = true;
      // "mass +0.04 (0 after jettison)" — the con is real, not just
      // cosmetic: dropping the tanks removes their mass contribution.
      stats.massSum = Math.max(-0.8, stats.massSum - 0.04 * stats.dropTankStacks);
      for (const side of [-1, 1]) {
        particles.push(makeParticle(
          ship.x + side * 9 * S, ship.y + 4 * S,
          side * 20 + ship.vx * 0.4, ship.vy * 0.2 - 10,
          '#8a6a3c', 1.6, 2.6 * S, 140
        ));
      }
    }

    // §7 Terraformer: below 40m, smooths terrain beneath the ship (radius
    // +40% per stack). Throttled via the existing §6.4 dirty-flag guard.
    if (pickedUpgrades.includes('terraformer') && terrain) {
      const alt = terrainYAt(terrain.points, ship.x) - ship.y;
      if (alt < 40) {
        const tfStacks = pickedUpgrades.filter((u) => u === 'terraformer').length;
        const radius = 50 * Math.pow(1.4, tfStacks - 1);
        terraform(terrain.points, ship.x, radius, 0.35 * dt);
        terrainDirty = true;
      }
    }

    // §6.1 Noodle piles: advance falling strands (deposit on terrain
    // contact), decay existing piles, and drop dead strands. Cheap no-ops
    // when noodlePile is empty / no noodles are airborne (the common case
    // until Commit 4b wires up the Spaghetti Engine).
    if (noodlePile.length > 0 || noodles.length > 0) {
      updateNoodles(noodles, noodlePile, terrain.points, terrainYAt, pdt, stats.noodleStacks);
      noodles = compactNoodles(noodles);
      decayNoodlePile(noodlePile, pdt);
    }

    // §6.3 Drones: advance orbit angles. Pool is empty (droneCharges=0)
    // until an upgrade sets it — updateDrones on an empty array is a no-op.
    if (drones.length > 0) updateDrones(drones, pdt);

    // §6.2 Ability cooldowns tick on raw dt (cooldowns aren't slowed by
    // Chrono Crystal), matching the fuel-drain convention elsewhere in step().
    if (abilityDefStates.length > 0) tickAbilityCooldowns(abilityDefStates, dt);

    // §6.4 Terraform: throttled-dirty-flag rebuild guard. Nothing marks
    // terrainDirty yet in this commit (no terraform() call site exists
    // until the Terraformer upgrade lands in 4b), so this never fires —
    // it's here so Commit 5's real static-layer cache has the throttle
    // logic already in place to plug into.
    if (shouldRebuild(terrainDirty, simTime, lastTerrainRebuildTime)) {
      lastTerrainRebuildTime = simTime;
      terrainDirty = false;
    }

    // Ground proximity dust while thrusting
    const groundY = terrainYAt(terrain.points, ship.x);
    if (ship.thrusting && groundY - ship.y < 80 * S) emitDust(groundY);

    // Ground collision (swept contact above already resolved tunneling;
    // this still routes into the existing touchdown/crash logic).
    if (contact.hit) {
      handleTouchdown(groundY);
    }

    // §7 Pocket Moon: orbiting moonlet — permanently blocks projectiles and
    // shatters any asteroid it touches. Also applies a small sinusoidal tug
    // to the ship (con: "sinusoidal tug ±10 px/s²").
    if (stats.pocketMoon > 0) {
      moonAngle += dt * 0.9;
      ship.vx += Math.sin(moonAngle * 1.7) * 10 * dt;
      const moonR = 32 + 6 * (stats.pocketMoon - 1);
      const moonX = ship.x + Math.cos(moonAngle) * moonR;
      const moonY = ship.y + Math.sin(moonAngle) * moonR;
      for (const a of asteroids) {
        if (a.alive && Math.hypot(moonX - a.x, moonY - a.y) < a.r + 6 * S) {
          a.alive = false;
          stardustAdd(3);
        }
      }
    }

    // §7 Singularity Anchor: while active, freezes all hazards (asteroids,
    // UFOs, projectiles) — skip their update entirely this tick.
    const hazardsFrozen = singularityT > 0;

    // §4.4: asteroid motion + collision now live in entities.ts, driven by
    // simTime (accumulated physics-tick time), not performance.now() — and
    // are no longer computed/mutated inside draw().
    if (!hazardsFrozen) updateAsteroids(asteroids, simTime);
    if (state === 'playing') {
      const hit = findAsteroidHit(asteroids, ship.x, ship.y, 8 * S);
      if (hit) {
        if (stats.asteroidMiner > 0) {
          // §7 Asteroid Miner: contact shatters the asteroid instead of
          // hurting the ship — +10 fuel, a small random kick, +10 stardust.
          hit.alive = false;
          ship.fuel = Math.min(stats.maxFuel, ship.fuel + 10);
          const kickAngle = Math.random() * Math.PI * 2;
          ship.vx += Math.cos(kickAngle) * 60;
          ship.vy += Math.sin(kickAngle) * 60;
          stardustAdd(10);
          toasts.push({ text: '⛏️ +10 fuel · +10✨', t: 1.4 });
        } else if (stats.pocketMoon > 0) {
          // A permanently-orbiting moonlet also protects on direct contact.
          hit.alive = false;
        } else if (stats.shieldCharges > 0) {
          stats.shieldCharges -= 1;
          shieldFlash = 0.5;
          ship.vx *= -0.5; ship.vy *= -0.5;
        } else if (stats.bubbleWrapCharges > bubbleWrapUsed) {
          bubbleWrapUsed += 1;
          ship.vy = Math.max(-80, ship.vy * -0.4);
          ship.vx *= 0.5;
          shakeT = Math.max(shakeT, 0.2);
        } else {
          destroyShip();
        }
      }
    }

    if (!hazardsFrozen) updateUfos(pdt);

    // Fuel-out safety net — reserve chute fires once per level.
    if (ship.fuel <= 0 && stats.reserveCharges > 0 && !ship.reserveUsed && ship.vy > 80) {
      ship.reserveUsed = true;
      ship.vy *= 0.25;
      ship.vx *= 0.6;
      audio.chuteDeploy();
    }
  }

  // Central destruction path: Phoenix Feather intercepts any lethal hit,
  // once per run — golden flash, back to the top with 60% fuel.
  function destroyShip() {
    if (stats.phoenixCharges > phoenixUsed) {
      phoenixUsed += 1;
      explode();
      phoenixFlashT = 0.9;
      ship.x = width * 0.5;
      ship.y = height * 0.12;
      ship.vx = 0;
      ship.vy = 10;
      ship.angle = 0;
      ship.fuel = Math.round(stats.maxFuel * 0.6);
      audio.phoenix();
      unlockAch('ach_phoenix');
      return;
    }
    runStats.crashes += 1;
    explode();
    audio.crash();
    state = 'crashed';
    setTimeout(showCrashScreen, 600);
  }

  function handleTouchdown(groundY: number) {
    let speed = Math.hypot(ship.vx, ship.vy);
    const angle = Math.abs(normalizeAngle(ship.angle));
    const onPad = ship.x > terrain.pad.xStart - stats.padBonus / 2 &&
                  ship.x < terrain.pad.xEnd + stats.padBonus / 2;

    // §7 Valkyrie Autopilot: guaranteed landing — clamp touchdown velocity
    // to tolerance so it's never a gamble (§7 implementation notes).
    if (valkyrieActive) {
      ship.vx = Math.min(Math.abs(ship.vx), stats.landingSpeedTol * 0.4) * Math.sign(ship.vx || 1);
      ship.vy = Math.min(ship.vy, stats.landingSpeedTol * 0.7);
      ship.angle = 0;
      speed = Math.hypot(ship.vx, ship.vy);
      valkyrieActive = false;
    }

    // §7 Sticky Landing Pads: horizontal speed forgiven ×1.2^stacks while on
    // the pad (applied to the effective speed check, not the real velocity).
    // §7 Rocket Skates: too-fast-but-level landings convert to a slide —
    // speed tol ×2 (via slideLandingMult) when angle < tol/2 (tighter angle
    // requirement than a normal safe landing).
    let effSpeedTol = stats.landingSpeedTol;
    if (onPad && stats.stickyPadStacks > 0) effSpeedTol *= Math.pow(1.2, stats.stickyPadStacks);
    let sliding = false;
    if (onPad && stats.slideLanding > 0 && angle < stats.landingAngleTol / 2 && speed < effSpeedTol * stats.slideLandingMult) {
      sliding = true;
      effSpeedTol = effSpeedTol * stats.slideLandingMult;
    }
    const safe = onPad && speed < effSpeedTol && angle < stats.landingAngleTol;

    ship.y = groundY - 9 * S;

    if (safe) {
      runStats.landings += 1;
      landedWithDice = stats.cosmicDiceStacks > 0 && !!cosmicDiceRoll;
      if (sliding) { ship.vx *= 0.3; ship.vy = 0; shakeT = Math.max(shakeT, 0.1); }
      // §7 Big Crunch Drive: each landing advances (1 + stacks) levels,
      // crediting stardust/best-level for every level advanced (§7
      // implementation notes: "stardust and best-level credit for both
      // levels" — generalized here to N levels for N stacks).
      const levelsAdvanced = 1 + stats.doubleProgress;
      const completed = levelIndex + levelsAdvanced;
      if (completed > bestFor(difficulty)) saveBest(difficulty, completed);
      audio.landingSuccess();
      confetti();

      // Stardust payout — deeper levels and harder modes pay more. Credited
      // once per level advanced (Big Crunch: both/all levels get paid).
      const diffMult = difficulty === 'ace' ? 2 : difficulty === 'pilot' ? 1.5 : 1;
      let payout = 0;
      for (let lv = levelIndex + 1; lv <= completed; lv++) {
        payout += Math.round((5 + lv * 2) * diffMult);
      }
      // §7 Golden Goose: +50✨ per landing, ×n stacks (one payout per
      // landing event, not per level advanced).
      if (stats.eggLevels > 0) payout += 50 * stats.eggLevels;
      // §7 Stardust Condenser / Midas Hull: multiply the whole payout.
      payout = Math.round(payout * stats.stardustMult * stats.midasMult);
      stardustAdd(payout);
      toasts.push({ text: `+${payout}✨`, t: 2.2 });

      // Achievement checks
      unlockAch('ach_first');
      if (completed >= 5) unlockAch('ach_l5');
      if (completed >= 10) unlockAch('ach_l10');
      if (completed >= 20) unlockAch('ach_l20');
      if (completed >= 5 && difficulty === 'ace') unlockAch('ach_ace5');
      if (speed < 15) unlockAch('ach_feather');
      if (Math.abs(ship.x - (terrain.pad.xStart + terrain.pad.xEnd) / 2) < 6) unlockAch('ach_bullseye');
      if (ship.fuel < 5) unlockAch('ach_fumes');
      if (pickedUpgrades.length >= 8) unlockAch('ach_hoarder');
      if (slowmoActive) unlockAch('ach_chrono');
      if (completed >= 5 && pickedUpgrades.length === 0) unlockAch('ach_minimalist');
      // §7 new achievements
      if (pickedUpgrades.length >= 20) unlockAch('ach_hoarder2');
      if (hasFiveStacksOfAnyUpgrade()) unlockAch('ach_stack5');
      if (landedWithDice) unlockAch('ach_dice');
      if (landedWithAutopilot) unlockAch('ach_autopilot');
      if (stats.doubleProgress > 0 && completed >= 15) unlockAch('ach_crunch');
      if (runStats.skips >= 3) unlockAch('ach_skip3');

      ship.vx = 0; ship.vy = 0; ship.angle = 0;
      state = 'levelComplete';
      celebrateT = 1.25;
      // levelIndex is advanced by loadLevel(levelIndex + levelsAdvanced) —
      // stash the target so showLevelComplete's "pick an upgrade" flow (and
      // skipUpgrade) both advance by the right amount for Big Crunch.
      pendingNextLevel = levelIndex + levelsAdvanced;
    } else if (stats.slopeLandCharges > geckoUsed && angle <= 0.35 && !onPad) {
      // §7 Gecko Struts: safe landing on any <=0.35 rad slope, anywhere —
      // does NOT complete the level, awards half stardust, refuels +15.
      geckoUsed += 1;
      const diffMult = difficulty === 'ace' ? 2 : difficulty === 'pilot' ? 1.5 : 1;
      const payout = Math.round(((5 + (levelIndex + 1) * 2) * diffMult) * 0.5);
      stardustAdd(payout);
      toasts.push({ text: `🦎 +${payout}✨ · gecko landing`, t: 2 });
      ship.fuel = Math.min(stats.maxFuel, ship.fuel + 15);
      ship.vx = 0; ship.vy = 0; ship.angle = 0;
      shakeT = 0.1;
    } else if (stats.cheeseDrillCharges > cheeseUsed) {
      // §7 Cheese Drill: touchdown anywhere drills +15 fuel — does NOT
      // complete the level.
      cheeseUsed += 1;
      ship.fuel = Math.min(stats.maxFuel, ship.fuel + 15);
      ship.vx = 0; ship.vy = -30; ship.angle = 0;
      shakeT = 0.15;
      toasts.push({ text: '🧀 +15 fuel · drilled', t: 1.6 });
    } else if (stats.bounceCharges > bouncesUsed && speed < stats.landingSpeedTol * 2.2) {
      // Boomerang Hull: eat the impact, spring back up, lose some fuel.
      bouncesUsed += 1;
      ship.fuel = Math.max(0, ship.fuel - 15);
      ship.vy = -Math.abs(ship.vy) * 0.55;
      ship.vx *= 0.7;
      ship.y = groundY - 10 * S;
      shakeT = 0.2;
      emitDust(groundY);
      audio.boing();
      unlockAch('ach_boing');
    } else if (stats.shieldCharges > 0) {
      stats.shieldCharges -= 1;
      shieldFlash = 0.5;
      ship.vy = -Math.abs(ship.vy) * 0.35;
      ship.vx *= 0.4;
      shakeT = 0.25;
    } else if (stats.bubbleWrapCharges > bubbleWrapUsed) {
      // §7 Bubble Wrap Hull: fatal impact -> huge slow bounce.
      bubbleWrapUsed += 1;
      ship.vy = Math.max(-80, ship.vy * -0.4);
      ship.vx *= 0.5;
      shakeT = 0.25;
      emitDust(groundY);
    } else if (noodlePile.length > 0 && checkNoodleSquish(noodlePile, terrain.points, ship.x).squish) {
      // §6.1 Spaghetti Engine touchdown rule: a fatal terrain impact lands
      // on a tall-enough noodle pile instead of crashing. Works anywhere on
      // terrain (not just the pad) and does NOT complete the level — only a
      // safe pad landing (the `safe` branch above) does that.
      const result = checkNoodleSquish(noodlePile, terrain.points, ship.x);
      applyNoodleSquish(noodlePile, result);
      ship.vx = 0;
      ship.vy = NOODLE_SQUISH_VY;
      shakeT = 0.15;
      emitDust(groundY);
      audio.splat();
      unlockAch('ach_pasta');
    } else {
      // §6.5 Quantum Duplicate death-save: 50% chance per stack, each stack
      // an independent extra roll (so n stacks give a compounding chance to
      // survive, not just n flat attempts at the same 50%).
      if (stats.ghostSave > 0) {
        let saved = false;
        for (let i = 0; i < stats.ghostSave; i++) {
          if (Math.random() < 0.5) { saved = true; break; }
        }
        if (saved) {
          ship.vx = 0; ship.vy = -40;
          shakeT = 0.2;
          return;
        }
      }
      destroyShip();
    }
  }

  // §7: helper for ach_stack5 — does the current picked-upgrade list
  // contain 5+ copies of any single upgrade id?
  function hasFiveStacksOfAnyUpgrade(): boolean {
    const counts = new Map<UpgradeId, number>();
    for (const id of pickedUpgrades) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const n of counts.values()) if (n >= 5) return true;
    return false;
  }

  // §7 UFO Hacker: the first N UFOs each level (N = stack count) become
  // allies that shoot other (hostile) UFOs instead of the ship. Tracked via
  // ufoHackerAllyCount + a per-UFO marker set (WeakSet-like via index on
  // the ufo object itself, since Ufo has no free boolean field — we key off
  // array position through a Set of converted indices instead).
  const hackedUfos = new Set<Ufo>();
  function updateUfos(dt: number) {
    if (stats.ufoHackerStacks > 0 && hackedUfos.size < stats.ufoHackerStacks) {
      for (const u of ufos) {
        if (hackedUfos.size >= stats.ufoHackerStacks) break;
        if (u.alive && !hackedUfos.has(u)) hackedUfos.add(u);
      }
    }
    for (const u of ufos) {
      if (!u.alive) continue;
      u.phase += dt;
      u.x += u.vx * dt;
      if (u.x < 30) { u.x = 30; u.vx *= -1; }
      if (u.x > width - 30) { u.x = width - 30; u.vx *= -1; }
      u.y = u.baseY + Math.sin(u.phase * 0.8) * 10;

      if (hackedUfos.has(u)) {
        // Hacked ally UFO: fire at the nearest hostile (non-hacked, alive)
        // UFO instead of idling/threatening the ship.
        u.fireCooldown -= dt;
        if (u.fireCooldown <= 0) {
          const target = ufos.filter((o) => o.alive && o !== u && !hackedUfos.has(o))
            .sort((a, b) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(u.x - b.x, u.y - b.y))[0];
          if (target) {
            const dx = target.x - u.x;
            const dy = target.y - u.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 130 * stats.projSpeedMult;
            const proj = { x: u.x, y: u.y, vx: (dx / dist) * speed, vy: (dy / dist) * speed, alive: true };
            (proj as any).huntsUfo = target;
            projectiles.push(proj as Projectile);
            audio.ufoFire();
          }
          u.fireCooldown = 1.8 + Math.random() * 1.4;
        }
        continue;
      }

      // Alien Embassy Plates: they see the plates, they wave, they hold fire.
      if (!stats.ufosFriendly) {
        if (u.telegraph > 0) {
          u.telegraph -= dt;
          if (u.telegraph <= 0) {
            const dx = ship.x - u.x;
            const dy = ship.y - u.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 130 * stats.projSpeedMult;
            projectiles.push({ x: u.x, y: u.y, vx: (dx / dist) * speed, vy: (dy / dist) * speed, alive: true });
            audio.ufoFire();
            u.fireCooldown = 2.4 + Math.random() * 2.2;
          }
        } else {
          u.fireCooldown -= dt;
          if (u.fireCooldown <= 0) u.telegraph = 0.35;
        }
      } else if (stats.ufosFriendly >= 2) {
        // §5.1 stack 2+: Alien Embassy Plates escalate — friendly UFOs shoot
        // asteroids for you instead of idling. Fires at the nearest alive
        // asteroid; the projectile is visually identical but only ever
        // targets asteroids (findAsteroidHit's ship-hit path never sees it
        // once `alive` is cleared on asteroid contact below).
        u.fireCooldown -= dt;
        if (u.fireCooldown <= 0) {
          const target = asteroids.filter((a) => a.alive)
            .sort((a, b) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(u.x - b.x, u.y - b.y))[0];
          if (target) {
            const dx = target.x - u.x;
            const dy = target.y - u.y;
            const dist = Math.hypot(dx, dy) || 1;
            const speed = 110 * stats.projSpeedMult;
            allyProjectiles.push({ x: u.x, y: u.y, vx: (dx / dist) * speed, vy: (dy / dist) * speed, alive: true, target });
            audio.ufoFire();
          }
          u.fireCooldown = 1.6 + Math.random() * 1.4;
        }
      }
    }

    for (const p of projectiles) {
      if (!p.alive) continue;
      const px0 = p.x, py0 = p.y;
      // §7 Deflector Coils (magnet_storm): projectiles within 90px of the
      // ship curve away — 120px/s² repulsion, ×n stacks.
      if (stats.magnetDeflect > 0) {
        const dx = p.x - ship.x, dy = p.y - ship.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0 && dist < 90) {
          const push = (120 * stats.magnetDeflect * dt) / Math.max(1, dist / 20);
          p.vx += (dx / dist) * push;
          p.vy += (dy / dist) * push;
        }
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      // §7 UFO Hacker ally shots: a projectile hunting a hostile UFO pops it
      // on contact instead of testing against the ship.
      const huntTarget = (p as any).huntsUfo as Ufo | undefined;
      if (huntTarget) {
        if (!huntTarget.alive || Math.hypot(p.x - huntTarget.x, p.y - huntTarget.y) < 10) {
          if (huntTarget.alive) huntTarget.alive = false;
          p.alive = false;
          continue;
        }
        if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) { p.alive = false; }
        continue;
      }
      if (p.x < -20 || p.x > width + 20 || p.y < -20 || p.y > height + 20) {
        p.alive = false;
        continue;
      }
      // §7 Vampire Coils: a hostile projectile passing within 30px grazes
      // the ship for +8 fuel per stack instead of always being a pure
      // threat — checked before the hit test so a near-miss still pays out
      // even on the frame it eventually connects.
      if (state === 'playing' && stats.grazeFuel > 0) {
        const graze = sweptSegmentCircleHit(px0, py0, p.x, p.y, ship.x, ship.y, 30 * S);
        if (graze && !(p as any).grazed) {
          (p as any).grazed = true;
          ship.fuel = Math.min(stats.maxFuel, ship.fuel + stats.grazeFuel);
        }
      }
      // §4.3: swept segment-vs-circle test — Star Core stacks can push
      // projectile speed high enough that a plain endpoint-distance check
      // would tunnel through the ship between two ticks.
      if (state === 'playing' && sweptSegmentCircleHit(px0, py0, p.x, p.y, ship.x, ship.y, 9 * S)) {
        p.alive = false;
        if (stats.pocketMoon > 0) {
          // Pocket Moon permanently blocks projectiles — no charge cost.
        } else if (stats.droneCharges > 0 && drones.some((d) => d.alive && d.charges > 0)) {
          const interceptor = drones.find((d) => d.alive && d.charges > 0)!;
          interceptor.charges -= 1;
        } else if (stats.shieldCharges > 0) {
          stats.shieldCharges -= 1;
          shieldFlash = 0.5;
        } else {
          destroyShip();
        }
      }
    }
    projectiles = projectiles.filter((p) => p.alive);

    // §5.1 stack 2+ Alien Diplomacy: advance ally shots and pop their
    // target asteroid on contact (small burst, +5 stardust — a lesser
    // version of the manual asteroid-clear reward, cosmetic-only otherwise).
    for (const ap of allyProjectiles) {
      if (!ap.alive) continue;
      ap.x += ap.vx * dt;
      ap.y += ap.vy * dt;
      if (ap.x < -20 || ap.x > width + 20 || ap.y < -20 || ap.y > height + 20) {
        ap.alive = false;
        continue;
      }
      if (ap.target.alive && Math.hypot(ap.x - ap.target.x, ap.y - ap.target.y) < ap.target.r) {
        ap.alive = false;
        ap.target.alive = false;
        for (let i = 0; i < 10; i++) {
          const a = Math.random() * Math.PI * 2;
          const speed = (30 + Math.random() * 80) * S;
          particles.push(makeParticle(
            ap.target.x, ap.target.y, Math.cos(a) * speed, Math.sin(a) * speed,
            '#7C8F5C', 0.4 + Math.random() * 0.4, (1.5 + Math.random() * 2) * S
          ));
        }
      } else if (!ap.target.alive) {
        ap.alive = false;
      }
    }
    allyProjectiles = allyProjectiles.filter((ap) => ap.alive);
  }

  // --- Overlays ---
  function showLevelComplete() {
    setOverlay(`
      <div class="text-center">
        <p class="badge badge-signal">landed — level ${levelIndex + 1} clear</p>
        <h2 class="font-display text-2xl font-semibold mt-2">Pick an upgrade</h2>
        <p class="text-xs text-muted mt-1">Every boon has a cost. Rarer finds, bigger swings — gold ones are an event.</p>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5" data-upgrade-choices style="grid-auto-rows:1fr;"></div>
        <button data-action="skip-upgrade" class="mt-4 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">▶ skip — travel light · +15✨</button>
      </div>
    `);
    renderUpgradeChoices();
  }

  // §5.3 Skip option: no pick, +15 stardust, advance immediately. Reachable
  // by clicking the skip link or pressing Escape while the upgrade overlay
  // is open (handled in the `keydown` listener below).
  function skipUpgrade() {
    if (state !== 'levelComplete') return;
    runStats.skips += 1;
    stardustAdd(15);
    toasts.push({ text: '+15✨ · travel light', t: 2.2 });
    audio.select();
    if (runStats.skips >= 3) unlockAch('ach_skip3');
    loadLevel(pendingNextLevel);
    state = 'playing';
    setOverlay(null);
  }

  // Weighted-by-rarity draw of 3 upgrades. §5.1: owned upgrades roll at 0.75
  // weight (was 0.5) so stacking is a genuinely viable strategy, not just a
  // rare accident — fresh options still surface more often than dupes, but
  // the gap is narrower. The same upgrade still can't appear twice in one
  // offer (`!picks.includes(u)` below) — the "distinct 3" restriction that's
  // removed is across LEVELS (a previously-owned upgrade is never excluded
  // from the pool the way it might be in a "new upgrades only" design), not
  // within a single offer.
  const DUPLICATE_WEIGHT = 0.75;
  // §7 Star Forge: multiplies rarity weights for uncommon+ rarities by
  // 3^stacks when rolling upgrade offers, then renormalizes (i.e. the
  // multiplied weight IS the renormalization basis — weighted-random draw
  // over the adjusted weights already "sums correctly" because we always
  // divide by the adjusted total, not the original one).
  function rarityWeight(rarity: Rarity): number {
    return starForgeRarityWeight(rarity, RARITY[rarity].weight, stats.starForgeStacks);
  }
  // §7 Lucky Antenna: +1 upgrade choice per offer, ×n stacks, capped at 6
  // cards rendered (plan §7 table + §10 item 6 resolution).
  function rollUpgradeChoices(): UpgradeDef[] {
    const owned = new Set(pickedUpgrades);
    const count = Math.max(3, Math.min(6, 3 + stats.extraChoices));
    const picks: UpgradeDef[] = [];
    for (let k = 0; k < count; k++) {
      const pool = UPGRADES.filter((u) => !picks.includes(u));
      const total = pool.reduce((a, u) => a + rarityWeight(u.rarity) * (owned.has(u.id) ? DUPLICATE_WEIGHT : 1), 0);
      let roll = Math.random() * total;
      for (const u of pool) {
        roll -= rarityWeight(u.rarity) * (owned.has(u.id) ? DUPLICATE_WEIGHT : 1);
        if (roll <= 0) { picks.push(u); break; }
      }
      if (picks.length <= k) picks.push(pool[pool.length - 1]);
    }
    return picks;
  }

  const RARITY_RANK: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

  function renderUpgradeChoices() {
    const container = overlayContent.querySelector('[data-upgrade-choices]');
    if (!container) return;
    const choices = rollUpgradeChoices();
    container.innerHTML = choices.map((u) => {
      const r = RARITY[u.rarity];
      const rank = RARITY_RANK.indexOf(u.rarity);
      const glow = rank >= 2 ? `box-shadow: 0 0 ${rank >= 4 ? 28 : rank >= 3 ? 20 : 13}px ${r.color}${rank >= 4 ? '77' : '44'};` : '';
      const label = rank >= 4 ? `✦ ${r.label} ✦` : r.label;
      return `
      <button class="tile text-left cursor-pointer" data-pick="${u.id}" style="border-color:${r.color}; ${glow}">
        <div class="flex items-center justify-between">
          <span class="text-2xl">${u.icon}</span>
          <span class="text-[10px] font-mono uppercase tracking-wider" style="color:${r.color}">${label}</span>
        </div>
        <div class="font-display font-semibold mt-2">${u.name}</div>
        <div class="text-xs mt-2" style="color:#94B03D">▲ ${u.pro}</div>
        <div class="text-xs mt-1" style="color:#C97B3D">▼ ${u.con}</div>
      </button>
    `;
    }).join('');

    // Rare+ offers announce themselves
    const topRank = Math.max(...choices.map((u) => RARITY_RANK.indexOf(u.rarity)));
    if (topRank >= 2) audio.raritySting(topRank);

    container.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.pick as UpgradeId;
        pickedUpgrades.push(id);
        stats = computeStats(pickedUpgrades, difficulty);
        const def = UPGRADES.find((u) => u.id === id);
        if (def?.rarity === 'legendary') unlockAch('ach_gold');
        if (id === 'jalapeno_injectors') unlockAch('ach_spicy');
        audio.select();
        loadLevel(pendingNextLevel);
        state = 'playing';
        setOverlay(null);
      });
    });
  }

  function showCrashScreen() {
    const best = bestFor(difficulty);
    const reached = levelIndex + 1;
    setOverlay(`
      <div class="text-center">
        <p class="badge" style="color:#C97B3D">run over</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Crashed on ${cfg.name}</h2>
        <p class="text-muted mt-3">Reached level ${reached} as ${DIFF_MODS[difficulty].label} · Landings: ${runStats.landings} · Best: level ${best}</p>
        ${upgradeListHtml(pickedUpgrades)}
        <div class="flex items-center justify-center gap-2 mt-5 flex-wrap">
          <input data-lb-name maxlength="12" placeholder="pilot name" value="${pilotName.replace(/"/g, '')}"
            class="bg-canvas border border-line px-3 py-2 font-mono text-sm w-36 text-center" />
          <button data-action="submit-score" class="tile px-4 py-2 cursor-pointer font-mono text-sm">🌍 post to leaderboard</button>
        </div>
        <p class="text-xs text-muted mt-1" data-lb-status></p>
        <button data-action="restart" class="tile mt-5 px-6 py-3 inline-block cursor-pointer font-mono">restart run</button>
        <div><button data-action="menu" class="mt-3 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">back to menu</button></div>
      </div>
    `);
  }

  async function handleScoreSubmit() {
    const input = overlayContent.querySelector('[data-lb-name]') as HTMLInputElement | null;
    const status = overlayContent.querySelector('[data-lb-status]') as HTMLElement | null;
    const btn = overlayContent.querySelector('[data-action="submit-score"]') as HTMLButtonElement | null;
    const name = (input?.value || '').replace(/[^a-zA-Z0-9 _\-\.]/g, '').trim().slice(0, 12);
    if (!name) {
      if (status) status.textContent = 'Give your pilot a name first.';
      return;
    }
    pilotName = name;
    try { localStorage.setItem('lander-pilot', name); } catch (e) {}
    if (btn) { btn.disabled = true; btn.textContent = 'posting…'; }
    const ok = await submitScore(name, levelIndex + 1);
    if (ok) {
      lbCache = null; // refetch next time the board opens
      if (btn) btn.textContent = 'on the board ✓';
      if (status) status.textContent = '';
      audio.select();
    } else {
      if (btn) { btn.disabled = false; btn.textContent = '🌍 post to leaderboard'; }
      if (status) status.textContent = 'Leaderboard unreachable right now — your local best is saved.';
    }
  }

  // --- Global leaderboard screen ---
  async function showLeaderboard() {
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">🌍 global leaderboard</p>
        <h2 class="font-display text-2xl font-semibold mt-2">Deepest descents, worldwide</h2>
        <div class="mt-4 text-left font-mono text-sm" data-lb-list>
          <p class="text-muted text-center text-xs">contacting mission control…</p>
        </div>
        <button data-action="menu" class="tile mt-5 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
    const list = overlayContent.querySelector('[data-lb-list]') as HTMLElement | null;
    const rows = lbCache ?? await fetchLeaderboard();
    if (!list) return;
    if (!rows || rows.length === 0) {
      list.innerHTML = `<p class="text-muted text-center text-xs">${
        lbOffline
          ? 'Global leaderboard is unreachable right now — local bests still count.'
          : 'No scores posted yet. Crash gloriously and be the first.'
      }</p>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    list.innerHTML = rows.slice(0, 25).map((r, i) => `
      <div class="flex items-center justify-between gap-3 py-1.5 ${i < rows.length - 1 ? 'border-b border-line' : ''}">
        <span class="text-muted w-8">${medals[i] ?? `${i + 1}.`}</span>
        <span class="flex-1 text-ink truncate">${String(r.name).replace(/[<>&]/g, '')}</span>
        <span class="text-muted text-xs">${DIFF_MODS[r.difficulty as Difficulty]?.icon ?? ''}</span>
        <span class="badge-signal">lvl ${r.level}</span>
      </div>
    `).join('');
  }

  // --- Achievements screen ---
  function showAchievements() {
    const unlocked = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
    setOverlay(`
      <div class="text-center max-w-lg mx-auto">
        <p class="badge badge-signal">🎖 achievements</p>
        <h2 class="font-display text-2xl font-semibold mt-2">${unlocked} / ${ACHIEVEMENTS.length} unlocked</h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-left">
          ${ACHIEVEMENTS.map((a) => {
            const got = !!achievements[a.id];
            return `<div class="border px-3 py-2 ${got ? '' : 'opacity-45'}" style="border-color: ${got ? 'var(--color-signal)' : 'var(--color-line)'}">
              <div class="font-mono text-sm">${a.icon} ${a.name}</div>
              <div class="text-xs text-muted mt-0.5">${got ? a.desc : '???'}</div>
            </div>`;
          }).join('')}
        </div>
        <button data-action="menu" class="tile mt-5 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
  }

  // --- Hangar Shop (cosmetics, paid in Stardust) ---
  function showShop(statusMsg = '') {
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">🛒 hangar shop</p>
        <h2 class="font-display text-2xl font-semibold mt-2">✨ ${stardust} stardust</h2>
        <p class="text-xs text-muted mt-1">Earned with every landing — deeper levels pay more.</p>
        ${statusMsg ? `<p class="text-xs mt-2" style="color:#C97B3D">${statusMsg}</p>` : ''}
        <div class="mt-4 text-left">
          <p class="badge">ship paint</p>
          ${PAINTS.map((p) => shopItemHtml('paint', p.id, p.name, p.price, `linear-gradient(135deg,${p.hullTop},${p.hullBot})`, cosmetics)).join('')}
          <p class="badge mt-4">thruster trail</p>
          ${TRAILS.map((td) => shopItemHtml('trail', td.id, td.name, td.price, trailSwatch(td), cosmetics)).join('')}
          <p class="badge mt-4">sky theme</p>
          ${SKIES.map((sk) => shopItemHtml('sky', sk.id, sk.name, sk.price, `linear-gradient(180deg,${sk.top},${sk.bot})`, cosmetics)).join('')}
        </div>
        <p class="text-[11px] text-muted mt-4">Stardust packs for real money aren't wired up yet — that needs a payment
        account only Tom can create. Until then: land more, earn more.</p>
        <button data-action="menu" class="tile mt-4 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
  }

  function handleShopAction(spec: string) {
    const [verb, kind, id] = spec.split(':') as [string, 'paint' | 'trail' | 'sky', string];
    const list = kind === 'paint' ? PAINTS : kind === 'trail' ? TRAILS : SKIES;
    const item = (list as { id: string; price: number }[]).find((x) => x.id === id);
    if (!item) return;
    if (verb === 'buy') {
      if (cosmetics.owned.includes(id)) return;
      if (stardust < item.price) {
        showShop(`Not enough stardust — that's ✨${item.price}.`);
        return;
      }
      stardustAdd(-item.price);
      cosmetics.owned.push(id);
      (cosmetics as any)[kind] = id;
      saveCosmetics();
      audio.raritySting(3);
      showShop();
    } else if (verb === 'equip') {
      (cosmetics as any)[kind] = id;
      saveCosmetics();
      audio.select();
      showShop();
    }
  }

  function showStartScreen() {
    state = 'start';
    music.stop();
    const thumbHtml = pilotPhoto
      ? `<img src="${pilotPhoto.toDataURL('image/png')}" alt="Pilot selfie preview" class="mx-auto rounded-full border-2 mt-4 block" style="width:64px;height:64px;border-color:var(--color-accent);" />`
      : `<div class="mx-auto rounded-full border-2 mt-4 flex items-center justify-center text-2xl" style="width:64px;height:64px;border-color:var(--color-line);" aria-hidden="true">🧑‍🚀</div>`;
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">moon lander · endless roguelite</p>
        <h2 class="font-display text-3xl font-semibold mt-2">How deep can you go?</h2>
        <p class="text-muted mt-3 text-sm">
          ←/→ or A/D to rotate · ↑ / W / Space to thrust. Land slow and level on
          the pad. Endless levels, each harder than the last. Upgrades roll in
          five rarities — every one has a real tradeoff, and the gold ones are
          worth the wait.
        </p>
        ${diffButtonsHtml(difficulty, bestFor)}
        ${thumbHtml}
        <button data-action="restart" class="tile mt-4 px-8 py-3 inline-block cursor-pointer font-mono badge-signal">start run</button>
        <div>
          <button data-action="open-selfie" class="mt-3 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">
            ${pilotPhoto ? 'change pilot photo' : 'take a pilot selfie'}
          </button>
        </div>
        <div class="flex items-center justify-center gap-4 mt-4 text-xs font-mono flex-wrap">
          <button data-action="leaderboard" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">🌍 leaderboard</button>
          <button data-action="achievements" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">🎖 achievements ${ACHIEVEMENTS.filter((a) => achievements[a.id]).length}/${ACHIEVEMENTS.length}</button>
          <button data-action="shop" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">🛒 hangar shop · ✨${stardust}</button>
        </div>
      </div>
    `);
  }

  async function openSelfieCapture() {
    setOverlay(`
      <div class="text-center max-w-sm mx-auto">
        <p class="badge badge-signal">pilot selfie</p>
        <h2 class="font-display text-xl font-semibold mt-2">Center your face</h2>
        <video
          data-selfie-video autoplay playsinline muted
          class="mx-auto mt-4 block rounded-full object-cover border-2"
          style="width:220px;height:220px;border-color:var(--color-accent);transform:scaleX(-1);"
        ></video>
        <p class="text-xs text-muted mt-3" data-selfie-status>Requesting camera access…</p>
        <div class="flex items-center justify-center gap-3 mt-4">
          <button data-action="snap-selfie" class="tile px-5 py-2 cursor-pointer font-mono badge-signal" disabled>Snap</button>
          <button data-action="cancel-selfie" class="tile px-5 py-2 cursor-pointer font-mono">Cancel</button>
        </div>
      </div>
    `);
    const video = overlayContent.querySelector('[data-selfie-video]') as HTMLVideoElement | null;
    const status = overlayContent.querySelector('[data-selfie-status]') as HTMLElement | null;
    const snapBtn = overlayContent.querySelector('[data-action="snap-selfie"]') as HTMLButtonElement | null;

    if (!navigator.mediaDevices?.getUserMedia) {
      if (status) status.textContent = "Camera not supported on this device — you'll fly with the default helmet icon.";
      return;
    }
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (video) video.srcObject = cameraStream;
      if (status) status.textContent = 'Center your face in the circle, then snap.';
      if (snapBtn) snapBtn.disabled = false;
    } catch (e) {
      if (status) status.textContent = "Camera unavailable or denied — you'll fly with the default helmet icon.";
    }
  }

  function snapSelfie() {
    const video = overlayContent.querySelector('[data-selfie-video]') as HTMLVideoElement | null;
    if (!video || !video.videoWidth) return;
    const size = 200;
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    if (!octx) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const side = Math.min(vw, vh);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;

    octx.save();
    octx.beginPath();
    octx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    octx.clip();
    octx.translate(size, 0);
    octx.scale(-1, 1);
    octx.drawImage(video, sx, sy, side, side, 0, 0, size, size);
    octx.restore();

    pilotPhoto = off;
    faceMap = DEFAULT_FACE;
    // Locate eyes/mouth once at capture; expressions re-render every frame.
    analyzeFace(off).then((m) => { faceMap = m; });
    unlockAch('ach_selfie');
    stopCameraStream();
    showStartScreen();
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
  }

  overlay?.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-action],[data-diff],[data-shop]') as HTMLElement | null;
    if (!target) return;
    if (target.dataset.diff) {
      difficulty = target.dataset.diff as Difficulty;
      try { localStorage.setItem('lander-diff', difficulty); } catch (err) {}
      audio.select();
      showStartScreen();
      return;
    }
    if (target.dataset.shop) { handleShopAction(target.dataset.shop); return; }
    if (target.dataset.action === 'restart') startRun();
    if (target.dataset.action === 'menu') showStartScreen();
    if (target.dataset.action === 'open-selfie') openSelfieCapture();
    if (target.dataset.action === 'snap-selfie') snapSelfie();
    if (target.dataset.action === 'cancel-selfie') { stopCameraStream(); showStartScreen(); }
    if (target.dataset.action === 'leaderboard') showLeaderboard();
    if (target.dataset.action === 'achievements') showAchievements();
    if (target.dataset.action === 'shop') showShop();
    if (target.dataset.action === 'submit-score') handleScoreSubmit();
    if (target.dataset.action === 'skip-upgrade') skipUpgrade();
  });

  // --- Input ---
  // §7 Kick Thrusters: double-tap detection window (ms). A second press-down
  // of the same direction within this window fires a kick impulse.
  const DOUBLE_TAP_WINDOW = 0.32;
  function registerTap(side: 'left' | 'right') {
    if (state !== 'playing' || !stats.kickThrusters) return;
    const now = performance.now() / 1000;
    if (side === 'left') {
      if (now - lastLeftTapT < DOUBLE_TAP_WINDOW) { kickPendingLeft = true; lastLeftTapT = -10; }
      else lastLeftTapT = now;
    } else {
      if (now - lastRightTapT < DOUBLE_TAP_WINDOW) { kickPendingRight = true; lastRightTapT = -10; }
      else lastRightTapT = now;
    }
  }

  function keydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && state === 'levelComplete') {
      // §5.3: Escape triggers skip while the upgrade-choice overlay is open.
      skipUpgrade();
      return;
    }
    if (e.repeat) return;
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) { input.left = true; registerTap('left'); }
    if (['ArrowRight', 'd', 'D'].includes(e.key)) { input.right = true; registerTap('right'); }
    if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) { input.thrust = true; e.preventDefault(); }
    // §6.2 active-ability slot: ArrowDown/S fires the highest-priority ready
    // ability.
    if (['ArrowDown', 's', 'S'].includes(e.key) && state === 'playing') { fireAbility(); e.preventDefault(); }
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
  bindTouch(touchLeft, () => { input.left = true; registerTap('left'); }, () => (input.left = false));
  bindTouch(touchRight, () => { input.right = true; registerTap('right'); }, () => (input.right = false));
  bindTouch(touchThrust, () => (input.thrust = true), () => (input.thrust = false));
  // §6.2: 4th touch button fires the ability on press (not hold — matches
  // "one press fires ... one ability per press"). Hidden by default via CSS
  // class, shown only when abilityDefStates is non-empty (updateAbilityButtonVisibility).
  if (touchAbility) {
    touchAbility.addEventListener('touchstart', (e) => { e.preventDefault(); if (state === 'playing') fireAbility(); }, { passive: false });
    touchAbility.addEventListener('mousedown', () => { if (state === 'playing') fireAbility(); });
  }

  // --- Rendering ---
  function currentMood(): Mood {
    if (state === 'levelComplete') return 'happy';
    if (ship.thrusting && state === 'playing') return 'surprised';
    return 'neutral';
  }

  function draw() {
    if (!ctx) return;
    const t = performance.now() / 1000;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (shakeT > 0) {
      ctx.translate((Math.random() - 0.5) * 9 * shakeT, (Math.random() - 0.5) * 9 * shakeT);
    }

    // Sky — colors come from the equipped sky theme (Hangar Shop cosmetic)
    const skyTheme = equippedSky();
    const sky_ = ctx.createLinearGradient(0, 0, 0, height);
    sky_.addColorStop(0, skyTheme.top);
    sky_.addColorStop(0.6, skyTheme.mid);
    sky_.addColorStop(1, skyTheme.bot);
    ctx.fillStyle = sky_;
    ctx.fillRect(-10, -10, width + 20, height + 20);

    if (!terrain) { ctx.restore(); return; }

    // Stars (twinkle)
    for (const s of sky.stars) {
      const tw = 0.6 + Math.sin(t * 1.5 + s.phase) * 0.4;
      ctx.globalAlpha = s.bright * tw;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = skyTheme.star;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Planet — sky themes can override the seeded palette
    const pl = sky.planet;
    const plHue = skyTheme.planet ?? pl.hue;
    const plGrad = ctx.createRadialGradient(pl.x - pl.r * 0.35, pl.y - pl.r * 0.35, pl.r * 0.15, pl.x, pl.y, pl.r);
    plGrad.addColorStop(0, plHue[0]);
    plGrad.addColorStop(1, plHue[1]);
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    ctx.fillStyle = plGrad;
    ctx.fill();
    if (pl.ring) {
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.rotate(-0.35);
      ctx.beginPath();
      ctx.ellipse(0, 0, pl.r * 1.6, pl.r * 0.38, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(185, 164, 128, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Background ridge silhouette
    ctx.beginPath();
    ctx.moveTo(0, height);
    terrain.ridge.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = '#20170c';
    ctx.fill();

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

    // Surface texture: sparse short strokes following the ground
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

    // §6.1 Noodle piles — soft rounded blob layer directly over the terrain,
    // drawn before critters/pad so they visually sit "in" the ground.
    if (noodlePile.length > 0) drawNoodlePiles(ctx, noodlePile, terrain.points);

    drawCritters(ctx, critters, t);
    drawPad(ctx, terrain, cfg, stats, t);

    // Asteroids — pure blit; position/collision computed in the physics
    // step via entities.ts (§4.4, no gameplay mutation in the render path).
    drawAsteroids(ctx, asteroids);

    drawUfos(ctx, ufos, projectiles, stats);

    // §6.3 Drones — placeholder generic look; no-op while the pool is empty.
    if (drones.length > 0) drawDrones(ctx, drones, ship.x, ship.y);

    // §6.1 Airborne noodle strands (pre-absorption into the pile).
    for (const noo of noodles) {
      if (!noo.alive) continue;
      drawNoodle(ctx, noo, S);
    }

    // Ally shots (Alien Diplomacy stack 2+, §5.1) — green to read as friendly.
    for (const ap of allyProjectiles) {
      if (!ap.alive) continue;
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, 2.8, 0, Math.PI * 2);
      ctx.fillStyle = '#94B03D';
      ctx.shadowColor = '#7C8F5C';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
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
    if (state === 'playing' || state === 'levelComplete') {
      drawShip({
        ctx, ship, S, mood: currentMood(), shieldFlash, stats, pickedUpgrades,
        paint: equippedPaint(), pilotPhoto, faceMap,
      });
    }

    // §6.2 Active-ability cooldown pips — drawn on canvas just above where
    // the DOM fuel bar sits (bottom HUD strip), only when abilities are
    // owned. No-op today (abilityDefs is always [] until Commit 4b).
    if (stats.abilityDefs.length > 0) {
      drawAbilityPips(ctx, abilityDefStates, 10, height - 34);
    }

    // Fog overlay — v9 fairness rework. The old fog was a near-black wall
    // with a small hole ("unviewable"). Now: a lighter veil, a much bigger
    // visibility bubble, the terrain silhouette stays faintly readable
    // through it, and the pad's beacons pulse through the murk so you
    // always have SOMETHING to navigate by. Scanner still trivializes it.
    if (cfg.fog) {
      ctx.save();
      ctx.fillStyle = 'rgba(10,7,4,0.74)';
      ctx.fillRect(0, 0, width, height);
      const fogR = 240 + (S - 1) * 110;
      const grad = ctx.createRadialGradient(ship.x, ship.y, 50, ship.x, ship.y, fogR);
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      // Terrain outline ghosting through the fog
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = '#4a3620';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      terrain.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      ctx.restore();

      // Pad beacons pulse through the fog
      const blinkOn = Math.floor(t * 2) % 2 === 0;
      if (blinkOn) {
        for (const bx of [terrain.pad.xStart + 3, terrain.pad.xEnd - 3]) {
          const bg = ctx.createRadialGradient(bx, terrain.pad.y - 6, 1, bx, terrain.pad.y - 6, 26);
          bg.addColorStop(0, 'rgba(148,176,61,0.5)');
          bg.addColorStop(1, 'rgba(148,176,61,0)');
          ctx.fillStyle = bg;
          ctx.beginPath();
          ctx.arc(bx, terrain.pad.y - 6, 26, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Chrono Crystal bullet-time: cool-toned vignette + indicator
    if (slowmoActive) {
      ctx.save();
      const vg = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, height * 0.85);
      vg.addColorStop(0, 'rgba(123, 167, 199, 0)');
      vg.addColorStop(1, 'rgba(123, 167, 199, 0.16)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
      ctx.font = `${Math.max(11, Math.round(width / 68))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(123, 167, 199, 0.9)';
      ctx.fillText('⌛ chrono', width - 12, height - 12);
      ctx.restore();
    }

    // §7 Valkyrie Autopilot: control lockout indicator + cyan trajectory
    // line to the pad while the PD controller is flying the ship.
    if (valkyrieActive && terrain) {
      ctx.save();
      const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = 'rgba(94, 214, 214, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y);
      ctx.lineTo(padCx, terrain.pad.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${Math.max(11, Math.round(width / 68))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(94, 214, 214, 0.9)';
      ctx.fillText('🤖 autopilot engaged', width / 2, 40);
      ctx.restore();
    }

    // Phoenix revive flash — golden wash fading out
    if (phoenixFlashT > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.55, phoenixFlashT * 0.7);
      ctx.fillStyle = '#FFC94A';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }

    // Scanner guidance — above the fog so it punches through it. §5.1
    // escalation: stack 1 = guidance line (as before); stack 2+ additionally
    // projects a touchdown-forecast marker (where current vx will carry the
    // ship by the time it reaches the pad's altitude); stack 3+ widens the
    // beam glow around the guidance line.
    if (stats.scanner && state === 'playing') {
      const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      ctx.save();
      if (stats.scanner >= 3) {
        ctx.save();
        ctx.strokeStyle = 'rgba(148,176,61,0.16)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(ship.x, ship.y);
        ctx.lineTo(padCx, terrain.pad.y);
        ctx.stroke();
        ctx.restore();
      }
      ctx.setLineDash([4, 7]);
      ctx.strokeStyle = 'rgba(148,176,61,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y);
      ctx.lineTo(padCx, terrain.pad.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(148,176,61,0.85)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padCx - 6, terrain.pad.y - 15);
      ctx.lineTo(padCx, terrain.pad.y - 8);
      ctx.lineTo(padCx + 6, terrain.pad.y - 15);
      ctx.stroke();
      ctx.restore();

      if (stats.scanner >= 2) {
        const dropDist = terrain.pad.y - ship.y;
        const fallTime = ship.vy > 5 ? dropDist / ship.vy : 1.2;
        const forecastX = Math.max(10, Math.min(width - 10, ship.x + ship.vx * Math.max(0, fallTime)));
        const forecastY = terrainYAt(terrain.points, forecastX);
        ctx.save();
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = '#7BA7C7';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(forecastX, forecastY - 3, 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(forecastX - 4, forecastY - 3);
        ctx.lineTo(forecastX + 4, forecastY - 3);
        ctx.moveTo(forecastX, forecastY - 7);
        ctx.lineTo(forecastX, forecastY + 1);
        ctx.stroke();
        ctx.restore();
      }
    }

    // §7 Echo Altimeter: independent of Scanner — touchdown-point forecast
    // marker (reused geometry) + a landing-speed readout near the ship.
    if (stats.echoAltimeterStacks > 0 && state === 'playing' && terrain) {
      const dropDist = terrainYAt(terrain.points, ship.x) - ship.y;
      const fallTime = ship.vy > 5 ? dropDist / ship.vy : 0.6;
      const forecastX = Math.max(10, Math.min(width - 10, ship.x + ship.vx * Math.max(0, fallTime)));
      const forecastY = terrainYAt(terrain.points, forecastX);
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = '#D8C4E8';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.arc(forecastX, forecastY - 3, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const spd = Math.hypot(ship.vx, ship.vy);
      ctx.font = `${Math.max(10, Math.round(width / 80))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'left';
      ctx.fillStyle = spd < stats.landingSpeedTol ? '#94B03D' : '#C97B3D';
      ctx.fillText(`${Math.round(spd)} px/s`, ship.x + 14 * S, ship.y);
      ctx.restore();
    }

    // §7 Landing Lights: below 150m, a pad arrow + touchdown marker (a
    // lighter-weight cousin of the Scanner display, independent of it).
    if (stats.landingLightStacks > 0 && state === 'playing' && terrain) {
      const alt = terrainYAt(terrain.points, ship.x) - ship.y;
      if (alt < 150) {
        const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#F4EBDA';
        ctx.beginPath();
        const dir = Math.sign(padCx - ship.x) || 1;
        ctx.moveTo(ship.x + dir * 16 * S, ship.y);
        ctx.lineTo(ship.x + dir * 10 * S, ship.y - 4 * S);
        ctx.lineTo(ship.x + dir * 10 * S, ship.y + 4 * S);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.arc(padCx, terrain.pad.y - 4, 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#F4EBDA';
        ctx.stroke();
        ctx.restore();
      }
    }

    // Wind indicator
    if ((cfg.wind > 0 || cfg.windGust > 0) && state === 'playing') {
      const w = currentWind(cfg, windPhase) * stats.windMult;
      const mag = Math.abs(w);
      if (mag > 1.5) {
        const arrows = (w > 0 ? '→' : '←').repeat(Math.min(3, Math.max(1, Math.round(mag / 12))));
        ctx.save();
        ctx.font = `${Math.max(11, Math.round(width / 68))}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(185,164,128,0.85)';
        ctx.fillText(`wind ${arrows}`, width / 2, 20);
        ctx.restore();
      }
    }

    // Level intro banner
    if (introT > 0 && state === 'playing') {
      const a = introT > 1.9 ? (2.4 - introT) / 0.5 : introT < 0.7 ? introT / 0.7 : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.max(15, Math.round(width / 34))}px "Space Grotesk", sans-serif`;
      ctx.fillStyle = '#F4EBDA';
      ctx.fillText(`Level ${levelIndex + 1} — ${cfg.name}`, width / 2, height * 0.3);
      ctx.font = `${Math.max(10, Math.round(width / 72))}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#B9A480';
      const tags: string[] = [];
      if (cfg.movingPad) tags.push('moving pad');
      if (cfg.fog) tags.push('fog');
      if (cfg.asteroids) tags.push('debris');
      if (cfg.ufos) tags.push('hostiles');
      if (cfg.wind > 8) tags.push('wind');
      if (cosmicDiceRoll) tags.push(`🎲 ${cosmicDiceRoll.up}×2 / ${cosmicDiceRoll.down}×0.5`);
      if (tags.length) ctx.fillText(tags.join(' · '), width / 2, height * 0.3 + Math.max(20, width / 34));
      ctx.restore();
    }

    ctx.restore();

    // Toast queue (achievements, stardust payouts) — drawn unshaken, top center
    toasts.slice(0, 4).forEach((toast, i) => {
      const alpha = Math.min(1, toast.t / 0.5) * Math.min(1, (4.4 - toast.t) * 2.4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha)) * 0.95;
      ctx.font = `${Math.max(12, Math.round(width / 60))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(toast.text).width;
      const ty = 38 + i * (Math.max(12, Math.round(width / 60)) + 16);
      ctx.fillStyle = 'rgba(23, 16, 9, 0.85)';
      ctx.fillRect(width / 2 - tw / 2 - 12, ty - 15, tw + 24, 24);
      ctx.strokeStyle = 'rgba(217, 164, 65, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - tw / 2 - 12, ty - 15, tw + 24, 24);
      ctx.fillStyle = '#F4EBDA';
      ctx.fillText(toast.text, width / 2, ty + 2);
      ctx.restore();
    });
  }

  function updateHud() {
    updateHudEl({
      hud, ship, stats, terrain, levelIndex, cfg, bestFor: () => bestFor(difficulty), stardust,
    });
  }

  // --- Main loop: fixed 120Hz physics accumulator (§4.1) ---------------------
  // Frame time is clamped to MAX_FRAME_TIME (0.05s) so a tab-switch stall
  // doesn't fire off hundreds of catch-up physics ticks at once. The
  // accumulator itself is what the Chrono Crystal slow-mo scales (world time
  // scale 0.75 is applied inside step() via `pdt`, per tick) — see step().
  // After draining the accumulator, render the latest state once; there is
  // no interpolation between physics ticks (120Hz sim vs <=144Hz display is
  // imperceptible without it).
  let lastT = performance.now();
  let raf = 0;
  let accumulator = 0;
  let loopPaused = false;

  function loop(t: number) {
    if (loopPaused) { raf = requestAnimationFrame(loop); return; }
    let frameDt = (t - lastT) / 1000;
    lastT = t;
    if (frameDt < 0) frameDt = 0;
    if (frameDt > MAX_FRAME_TIME) frameDt = MAX_FRAME_TIME;

    updateFrameTimers(frameDt);

    accumulator += frameDt;
    while (accumulator >= DT) {
      step(DT);
      accumulator -= DT;
    }

    draw();
    updateHud();
    raf = requestAnimationFrame(loop);
  }

  // Pause physics accumulation + stop thrust audio when the tab is hidden;
  // resume cleanly (no catch-up burst — lastT/accumulator reset on resume).
  function onVisibilityChange() {
    if (document.hidden) {
      loopPaused = true;
      audio.stopThrust();
      music.duck(false);
    } else {
      loopPaused = false;
      lastT = performance.now();
      accumulator = 0;
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  resize();
  window.addEventListener('resize', resize);
  function onOrientation() {
    setTimeout(resize, 150);
  }
  window.addEventListener('orientationchange', onOrientation);
  applySound();
  showStartScreen();
  raf = requestAnimationFrame(loop);

  return function cleanup() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', onOrientation);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    audio.stopThrust();
    music.stop();
    stopCameraStream();
  };
}
