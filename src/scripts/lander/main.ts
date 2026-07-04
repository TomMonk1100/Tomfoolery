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
import { levelConfigFor, terrainYAt, generateTerrain, generateSky, generateCritters, generateUfos, generateCanisters } from './levels';
import { ParticlePool, PARTICLE_SMOKE, PARTICLE_SPARK, PARTICLE_CHUNK } from './particles';
import {
  generateAsteroids, updateAsteroids, findAsteroidHit, type Asteroid,
  buildDronePool, updateDrones, terraform,
} from './entities';
import {
  DT, MAX_FRAME_TIME, effectiveMass, effectiveArea, gravityAccel, thrustAccel, windAccel,
  sweptGroundContact, sweptSegmentCircleHit, clampRotationDelta,
} from './physics';
import { AudioEngine } from './audio/sfx';
import { MusicEngine } from './audio/music';
import { DEFAULT_FACE, analyzeFace, drawShip, checkGhostSave } from './render/ship';
import { drawCritters, drawUfos, drawPad, drawAsteroids, drawDrones, drawNoodle, drawNoodlePiles, drawCanisters, drawBonusPad, drawProjectileTracers } from './render/world';
import { updateHud as updateHudEl, drawAbilityPips } from './render/hud';
import { upgradeListHtml, shopItemHtml, trailSwatch, diffButtonsHtml } from './ui/overlays';
import { loadJSON, bestFor as bestForStored, saveBest, fetchLeaderboard as fetchLeaderboardRemote, submitScore as submitScoreRemote, writeSchemaTag } from './persistence';
import { resolveReadyAbility, tickAbilityCooldowns, consumeAbilityCharge } from './abilities';
import {
  createNoodlePile, checkNoodleSquish, applyNoodleSquish, NOODLE_SQUISH_VY, NoodlePool, decayNoodlePile,
} from './noodles';
import { LayerCache, blitSky, blitStars, blitRidge, blitTerrain } from './render/layers';
import { addGlow } from './render/fx';
import { DegradationGuard, parallaxTransform } from './perf';
import type {
  UpgradeId, LevelConfig, Terrain, Star, Planet, Critter, Ufo, Projectile, Particle,
  ShipStats, FaceMap, Mood, GameState, Difficulty, ScoreRow, Toast, UpgradeDef, Rarity, RunStats,
  Drone, Noodle, AbilityDef, Canister,
} from './types';

// --- Main game -----------------------------------------------------------------

export function initLanderGame(root: HTMLElement) {
  const canvas = root.querySelector('canvas') as HTMLCanvasElement;
  // §8.4: opaque backing store — the game canvas never composites over page
  // content (it always fully repaints via the sky/terrain layers below), so
  // alpha blending on the canvas itself is pure overhead the browser can skip.
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return () => {};

  // §3: mark this save as having loaded under the v10 schema at least once.
  writeSchemaTag();

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
  const pauseBtn = root.querySelector('[data-pause]') as HTMLElement | null;
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
  pauseBtn?.addEventListener('click', () => { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); });

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
  // §8.2: preallocated ring-buffer particle pool (1,200 slots) — replaces
  // the old plain-array `particles: Particle[]` that grew via .push() and
  // was reaped every tick via a fresh `.filter()` allocation.
  const particlePool = new ParticlePool();
  let critters: Critter[] = [];
  let ufos: Ufo[] = [];
  let projectiles: Projectile[] = [];
  let asteroids: Asteroid[] = [];
  // §Commit 6: fuel canister pickups for this level — refuel + small stardust.
  let canisters: Canister[] = [];
  // §5.1 Alien Diplomacy stack 2+: ally shots fired by friendly UFOs at
  // asteroids (never at the ship). Kept separate from hostile `projectiles`
  // so the existing ship-hit collision loop never has to special-case them.
  let allyProjectiles: { x: number; y: number; vx: number; vy: number; alive: boolean; target: Asteroid }[] = [];

  // --- lander-v10 commit 4a: new-systems scaffolding state (§6) ---
  // §6.1 Noodle piles: a Float32Array parallel to terrain.points, rebuilt on
  // loadLevel. §8.2: noodle strands (pre-absorption) now live in the same
  // fixed-capacity ring-buffer pool pattern as particlePool, rather than an
  // unbounded array grown via .push()/reaped via .filter().
  let noodlePile: Float32Array = new Float32Array(0);
  const noodlePool = new NoodlePool();
  let thrusterParticleTick = 0; // counts thruster-particle emissions for the "every 3rd is a noodle" rule
  // §6.3 Drones — pooled per stats.droneCharges (0 today, no upgrade sets it).
  let drones: Drone[] = [];
  // §6.2 Active-ability slot: live cooldown/charge state per owned ability,
  // rebuilt from stats.abilityDefs whenever it changes (see syncAbilityDefStates).
  let abilityDefStates: AbilityDef[] = [];
  let simTime = 0; // accumulated sim seconds (fixed-step ticks only) — drives asteroid orbits, moved out of the render path per §4.4
  let windPhase = 0;
  let shieldFlash = 0;
  // Spawn-grace immunity: set at loadLevel and on Phoenix revive so a level
  // never kills you before you've had a chance to react — asteroids/UFO
  // shots are harmless while this counts down; terrain crashes still count
  // (piloting mistakes should still matter).
  let invulnT = 0;
  const SPAWN_INVULN_S = 4;
  const REVIVE_INVULN_S = 3;
  let shakeT = 0;
  // v12 Commit 5: hit-stop — freezes physics/frame-timer advancement for a
  // few frames at the moment of impact (set in destroyShip()/handleTouchdown,
  // consumed in loop()). The cheapest, highest-value juice in the plan.
  let hitStopT = 0;
  let introT = 0;
  let celebrateT = 0;
  let bouncesUsed = 0;      // boomerang hull, per level
  let phoenixUsed = 0;      // phoenix feather, per run
  let phoenixFlashT = 0;    // golden revive flash
  let slowmoActive = false; // chrono crystal state, read by draw()
  let runStats: RunStats = { crashes: 0, landings: 0, skips: 0, stardustEarned: 0, startedAt: 0 };

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
  let crashTimerId = 0;              // tracked so the crash-screen setTimeout can be cleared on restart/cleanup (Commit 1b)

  // Pilot selfie — session-only, in memory (never persisted to disk).
  let pilotPhoto: HTMLCanvasElement | null = null;
  let faceMap: FaceMap = DEFAULT_FACE;
  let cameraStream: MediaStream | null = null;

  let stardust = 0;
  try { stardust = parseInt(localStorage.getItem('lander-stardust') || '0', 10) || 0; } catch (e) {}
  function stardustAdd(n: number) {
    stardust = Math.max(0, stardust + n);
    try { localStorage.setItem('lander-stardust', String(stardust)); } catch (e) {}
    // §Commit 7: track total stardust earned this run for the crash-screen
    // summary — one simple rule (any positive add outside the start screen
    // counts) rather than per-call-site bookkeeping (§5 resolution 5).
    if (n > 0 && state !== 'start') runStats.stardustEarned += n;
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

  // Haptic feedback for touch play — no-ops silently on devices/browsers
  // without the Vibration API (desktop, iOS Safari). Kept to short pulses:
  // thrust-start is a tick, landing is a light double-tap, crash is a buzz.
  function haptic(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
  }

  // --- Dynamic camera zoom -------------------------------------------------
  // Each level starts at zoom 1 (the full-terrain wide view — the world is
  // exactly one canvas, so 1.0 IS "zoomed out"). As the ship closes on the
  // landing pad the camera lerps smoothly toward CAM_MAX_ZOOM, keeping the
  // ship slightly above the viewport center and clamping the view to the
  // world bounds so the prerendered layers always fill the screen. Render-
  // only: physics, input, and the DOM HUD are untouched.
  const CAM_MAX_ZOOM = 1.6;
  let camZoom = 1, camX = 0, camY = 0, camLastT = 0;
  function updateCamera(t: number) {
    if (state === 'paused') { camLastT = t; return; }
    const dt = Math.min(0.05, Math.max(0, t - (camLastT || t)));
    camLastT = t;
    let target = 1;
    if ((state === 'playing' || state === 'levelComplete') && terrain) {
      const padCx = (terrain.pad.xStart + terrain.pad.xEnd) / 2;
      const dist = Math.hypot(ship.x - padCx, ship.y - terrain.pad.y);
      // Begin tightening within ~40% of the level height from the pad,
      // reaching full zoom by ~16%.
      const far = height * 0.42, near = height * 0.16;
      const p = Math.max(0, Math.min(1, (far - dist) / (far - near)));
      const eased = p * p * (3 - 2 * p); // smoothstep — no snapping
      target = 1 + eased * (CAM_MAX_ZOOM - 1);
    }
    camZoom += (target - camZoom) * Math.min(1, dt * 2.5);
    if (Math.abs(camZoom - 1) < 0.002) camZoom = 1;
    const vw = width / camZoom, vh = height / camZoom;
    // Ship slightly above center (focus sits a touch below the ship);
    // clamped so we never show past the world edges — at zoom 1 this
    // collapses to the identity transform.
    let fx = ship.x, fy = ship.y + vh * 0.07;
    fx = Math.max(vw / 2, Math.min(width - vw / 2, fx));
    fy = Math.max(vh / 2, Math.min(height - vh / 2, fy));
    camX = fx; camY = fy;
  }

  // v12 Commit 2: parallax helper — applies a camera transform scaled by
  // `factor` (0 = screen-fixed/infinite distance, 1 = the normal full
  // camera transform) around the same center as the real camera. At
  // camZoom === 1 this collapses to the identity for ANY factor (see
  // parallaxTransform() in perf.ts / __tests__ for the pure math + proof).
  // §Commit 7: when the degradation guard trips, all callers pass 1.0 so
  // every plane renders in lockstep (one effective transform).
  function withParallax(factor: number, fn: () => void) {
    if (!ctx) return;
    // §Commit 7 gate 1: collapse every plane to the same 1.0 (full-camera)
    // transform under degradation — one effective transform, no per-plane
    // drift math, matching the "single transform" acceptance criterion.
    const effFactor = perfGuard.degraded ? 1 : factor;
    const m = parallaxTransform(effFactor, camX, camY, camZoom, width, height);
    ctx.save();
    ctx.translate(m.tx1, m.ty1);
    ctx.scale(m.z, m.z);
    ctx.translate(m.tx2, m.ty2);
    fn();
    ctx.restore();
  }

  // §8.1 static layer cache — rebuilt on loadLevel/resize; terrain layer
  // rebuilds are additionally throttled per-tick via layerCache.tryRebuildTerrain().
  const layerCache = new LayerCache();
  // v12 Commit 1: prerendered vignette — one radial gradient built in
  // resize(), blitted as a single drawImage() at the end of every draw().
  let vignetteCanvas: HTMLCanvasElement | null = null;
  // §8.5 degradation guard — EMA of frame time; halves particle emission and
  // disables star twinkle under sustained load, restores when it recovers.
  const perfGuard = new DegradationGuard();

  const ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0, fuel: 100, thrusting: false,
    reserveUsed: false,
  };

  const input = { left: false, right: false, thrust: false };

  // v12 Commit 4: how long thrust has been continuously held (seconds),
  // reset to 0 the instant it releases — drives the flame's 0.25s ramp-in
  // (drawShip's thrustT) instead of it popping to full size every tap.
  let thrustHeldT = 0;

  // v12 Commit 7: ambient life. Shooting stars are screen-space, scheduled
  // against simTime, advanced in updateFrameTimers (frame-time domain —
  // cosmetic, like shakeT). Wind streaks are a fixed pool of 5 reusable
  // slots (no ParticlePool needed at this size), world-space, lazily
  // initialized to random positions/phases on first use.
  let nextShootingStarT = 8 + Math.random() * 14;
  let shootingStar: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
  const WIND_STREAK_COUNT = 5;
  let windStreaks: { x: number; y: number; len: number }[] | null = null;

  // Mobile performance mode: coarse-pointer devices on narrow viewports get
  // a lower DPR cap (biggest fill-rate win on phone GPUs) and reduced
  // particle emission from the first frame, instead of waiting for the
  // degradation guard to notice jank mid-run. The guard still layers on top
  // for dynamic conditions.
  let mobilePerf = false;

  // --- Responsive sizing: fill the container, go taller on portrait phones ---
  // Uses visualViewport height (falls back to innerHeight) so the canvas
  // doesn't jump/resize as the mobile browser address bar collapses or
  // reappears during scroll/play — innerHeight changes with the chrome,
  // visualViewport.height is the actually-visible area.
  function viewportHeight() {
    return window.visualViewport?.height ?? window.innerHeight;
  }
  function resize() {
    const rect = canvas.parentElement!.getBoundingClientRect();
    const vh = viewportHeight();
    mobilePerf = window.matchMedia('(pointer: coarse)').matches && window.innerWidth < 820;
    const portrait = vh > window.innerWidth * 1.1;
    let w = Math.min(rect.width, 1200);
    const aspect = portrait ? 1.15 : 0.62;
    let h = Math.round(w * aspect);
    const maxH = Math.round(vh * (portrait ? 0.66 : 0.72));
    if (h > maxH && maxH > 160) h = maxH;
    const oldW = width, oldH = height;
    width = w;
    height = h;
    // Big ship — the pilot's face is a feature, so it gets real pixels.
    // Scaled to the canvas: ~1.6x on phones up to ~2.3x on desktop.
    S = Math.max(1.6, Math.min(2.3, width / 420));
    dpr = Math.min(window.devicePixelRatio || 1, mobilePerf ? 1.5 : 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (terrain) {
      terrain = generateTerrain(cfg, width, height);
      sky = generateSky(cfg, width, height);
      rebuildLayers();
      if ((state === 'playing' || state === 'levelComplete') && oldW > 0 && oldH > 0) {
        ship.x = ship.x / oldW * width;
        ship.y = ship.y / oldH * height;
        const gy = terrainYAt(terrain.points, ship.x);
        if (ship.y > gy - 12 * S) ship.y = gy - 40;
      }
    }
    // v12 Commit 1: rebuild the vignette whenever canvas dims change —
    // radial gradient, centered, transparent to rgba(15,10,4,0.22) from
    // 0.62*max(w,h) out to the corner. One-time cost; blitted every frame.
    if (width > 0 && height > 0) {
      const vc = document.createElement('canvas');
      vc.width = width; vc.height = height;
      const vctx = vc.getContext('2d')!;
      const cx = width / 2, cy = height / 2;
      const innerR = 0.62 * Math.max(width, height);
      const outerR = Math.hypot(cx, cy);
      const vgrad = vctx.createRadialGradient(cx, cy, innerR, cx, cy, Math.max(innerR + 1, outerR));
      vgrad.addColorStop(0, 'rgba(15,10,4,0)');
      vgrad.addColorStop(1, 'rgba(15,10,4,0.22)');
      vctx.fillStyle = vgrad;
      vctx.fillRect(0, 0, width, height);
      vignetteCanvas = vc;
    }
  }

  // §8.1: (re)prerenders all three static layers (sky/planet/ridge, star
  // field, terrain) from the current cfg/terrain/sky/width/height. Called on
  // resize() and loadLevel() — both already regenerate terrain/sky from
  // scratch, so the cache would be stale otherwise. Not called per-frame.
  function rebuildLayers() {
    if (!terrain || !sky || width <= 0 || height <= 0) return;
    layerCache.build({
      width, height, cfg, terrain,
      stars: sky.stars, planet: sky.planet, skyTheme: equippedSky(),
      levelIndex,
    });
  }

  function setOverlay(html: string | null) {
    if (!overlay || !overlayContent) return;
    if (html === null) {
      overlay.classList.add('hidden');
      overlayContent.innerHTML = '';
    } else {
      overlay.classList.remove('hidden');
      overlayContent.innerHTML = html;
      // Crash/level-complete/shop screens can be taller than the canvas and
      // scroll internally (overlay has overflow-y-auto), but if the player
      // had scrolled the *page* down mid-flight (chasing the ship lower on
      // a tall level, or just page bounce on mobile), the sticky site nav
      // can end up covering the top of the game entirely with no obvious
      // way back short of manually scrolling up. Snap the game back into
      // view under the nav every time an overlay opens — #lander-root's
      // scroll-margin-top (game.astro) keeps this clear of the sticky nav.
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function pauseGame() {
    if (state !== 'playing') return;
    state = 'paused';
    audio.stopThrust();
    music.duck(false);
    setOverlay(`
      <div class="text-center">
        <p class="badge badge-signal">paused</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Take a breath</h2>
        <button data-action="resume" class="tile mt-5 px-8 py-3 inline-block cursor-pointer font-mono badge-signal">resume</button>
        <div class="flex items-center justify-center gap-4 mt-4 text-xs font-mono">
          <button data-action="restart" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">restart run</button>
          <button data-action="menu" class="text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">back to menu</button>
        </div>
      </div>`);
  }
  function resumeGame() {
    if (state !== 'paused') return;
    state = 'playing';
    setOverlay(null);
    lastT = performance.now();
    accumulator = 0;
    canvas.focus({ preventScroll: true });
  }
  // Note: lastT/accumulator are declared below these functions in file order
  // (near the RAF loop) — hoisting via `let` at current position is fine
  // since calls only happen after init; do not reorder declarations.

  function startRun() {
    // Focus the canvas so keyboard input goes to the game, not the page.
    canvas.tabIndex = -1;
    canvas.style.outline = 'none';
    canvas.focus({ preventScroll: true });
    window.clearTimeout(crashTimerId);
    levelIndex = 0;
    pickedUpgrades = [];
    stats = computeStats(pickedUpgrades, difficulty);
    runStats = { crashes: 0, landings: 0, skips: 0, stardustEarned: 0, startedAt: performance.now() };
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
    particlePool.clear();
    invulnT = SPAWN_INVULN_S;
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
    canisters = generateCanisters(cfg, terrain, width, idx);
    windPhase = Math.random() * 10;
    // Snap the camera back to the wide view so every level starts zoomed
    // out with the whole terrain (and the pad) visible.
    camZoom = 1; camX = width / 2; camY = height / 2;
    introT = 2.4;
    celebrateT = 0;
    bouncesUsed = 0;
    // §6.1 Noodle piles reset per level (a pile from a prior level's terrain
    // wouldn't map to this level's new terrain sample points anyway).
    noodlePile = createNoodlePile(terrain.points.length);
    noodlePool.clear();
    // §6.3 Drone pool rebuilt from the current droneCharges stat (0 today).
    drones = buildDronePool(stats.droneCharges);
    // §8.1: fresh terrain/sky this level — rebuild all three static layers.
    rebuildLayers();
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

  // §8.5: emission counts below are the "normal" rates; halved (rounded, min
  // 1) when the degradation guard has tripped. `emitCount(n)` centralizes
  // that so every emitter applies the same rule.
  function emitCount(n: number): number {
    // Degraded (guard tripped) halves emission; mobile perf mode trims to
    // 60% preemptively. Degraded wins when both apply.
    const scale = perfGuard.degraded ? 0.5 : mobilePerf ? 0.6 : 1;
    return scale === 1 ? n : Math.max(1, Math.round(n * scale));
  }

  function emitThrusterParticles() {
    const colors = stats.spicyFlame ? ['#94B03D', '#D9E8B8'] : trailColors();
    const count = emitCount(3);
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = (70 + Math.random() * 50) * S;
      const a = ship.angle + Math.PI + spread;
      particlePool.alloc(
        ship.x - Math.sin(ship.angle) * 12 * S,
        ship.y + Math.cos(ship.angle) * 12 * S,
        Math.sin(a) * speed + ship.vx * 0.3,
        -Math.cos(a) * speed + ship.vy * 0.3,
        colors[Math.floor(Math.random() * colors.length)],
        0.35 + Math.random() * 0.3,
        (1.5 + Math.random() * 2) * S
      );
    }

    // v12 Commit 5: every 4th thruster-particle emission also leaves a
    // faint dissipating smoke plume trailing the flame.
    if (thrusterParticleTick % 4 === 0) {
      particlePool.alloc(
        ship.x - Math.sin(ship.angle) * 12 * S,
        ship.y + Math.cos(ship.angle) * 12 * S,
        ship.vx * 0.2,
        ship.vy * 0.2 + 10,
        'rgba(80,66,42,0.4)',
        0.8,
        (2 + Math.random()) * S,
        0,
        // §Commit 7 gate 4: smoke `grow` halves under degradation (smoke
        // overdraw is the expensive part of the particle vocabulary).
        { kind: PARTICLE_SMOKE, grow: perfGuard.degraded ? 5 : 10 }
      );
    }
  }

  // §6.1: emits `stacks` noodle strands from the engine, mirroring
  // emitThrusterParticles' spawn geometry. Accepts a stack-count multiplier
  // per the plan (×n emission). §8.2: routed through the pooled NoodlePool
  // instead of `noodles.push(makeNoodle(...))`. §8.5: also halved under
  // sustained frame-time pressure, same as regular thruster particles.
  function emitNoodles(stacks: number) {
    const count = emitCount(Math.max(1, Math.round(stacks)));
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 0.6;
      const speed = (50 + Math.random() * 40) * S;
      const a = ship.angle + Math.PI + spread;
      noodlePool.alloc(
        ship.x - Math.sin(ship.angle) * 12 * S,
        ship.y + Math.cos(ship.angle) * 12 * S,
        Math.sin(a) * speed + ship.vx * 0.3,
        -Math.cos(a) * speed + ship.vy * 0.3
      );
    }
  }

  function emitDust(groundY: number) {
    const count = emitCount(2);
    for (let i = 0; i < count; i++) {
      const dir = Math.random() > 0.5 ? 1 : -1;
      particlePool.alloc(
        ship.x + (Math.random() - 0.5) * 20 * S,
        groundY - 2,
        dir * (30 + Math.random() * 60),
        -(10 + Math.random() * 30),
        Math.random() > 0.5 ? 'rgba(185,164,128,0.5)' : 'rgba(122,100,70,0.5)',
        0.5 + Math.random() * 0.5,
        (2 + Math.random() * 3) * S,
        14
      );
    }
  }

  // v12 Commit 5: recomposed from one uniform 50-dot burst into a real
  // particle vocabulary — a white impact flash, rotating debris chunks,
  // additive sparks, buoyant smoke, plus the original dot spread. Total
  // emission (1+12+18+14+20=65) stays close to the v11 budget (50).
  // v12 Commit 5: a satisfying ground "poof" under the landing confetti —
  // 16 dust dots kicked outward both directions along the ground.
  function emitLandingDustRing(groundY: number) {
    const count = emitCount(16);
    for (let i = 0; i < count; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      const speed = 40 + Math.random() * 70; // 40..110
      particlePool.alloc(
        ship.x + (Math.random() - 0.5) * 10 * S,
        groundY - 2,
        dir * speed,
        -(5 + Math.random() * 15), // vy -5..-20
        Math.random() > 0.5 ? 'rgba(185,164,128,0.5)' : 'rgba(122,100,70,0.5)',
        0.5 + Math.random() * 0.4,
        (2 + Math.random() * 2) * S,
        14
      );
    }
  }

  function explode() {
    const flashCount = emitCount(1);
    for (let i = 0; i < flashCount; i++) {
      particlePool.alloc(ship.x, ship.y, 0, 0, '#FFF6E0', 0.09, 26 * S);
    }

    const chunkCount = emitCount(12);
    for (let i = 0; i < chunkCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * S;
      particlePool.alloc(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        Math.random() > 0.5 ? '#5a4326' : '#3B2C16',
        0.9 + Math.random() * 0.5,
        (2 + Math.random() * 3) * S,
        60,
        { kind: PARTICLE_CHUNK, vrot: (Math.random() - 0.5) * 12 }
      );
    }

    const sparkCount = emitCount(18);
    for (let i = 0; i < sparkCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * 1.4 * S;
      particlePool.alloc(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        '#FFC94A',
        0.5 + Math.random() * 0.7,
        (2 + Math.random() * 3) * S,
        60,
        { kind: PARTICLE_SPARK }
      );
    }

    const smokeCount = emitCount(14);
    for (let i = 0; i < smokeCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 60) * S;
      particlePool.alloc(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        `rgba(60,48,30,${(0.35 + Math.random() * 0.3).toFixed(2)})`,
        1.2 + Math.random() * 0.6,
        (2 + Math.random() * 3) * S,
        60,
        // §Commit 7 gate 4: smoke `grow` halves under degradation.
        { kind: PARTICLE_SMOKE, grow: perfGuard.degraded ? 9 : 18 }
      );
    }

    const dotCount = emitCount(20);
    for (let i = 0; i < dotCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (40 + Math.random() * 160) * S;
      particlePool.alloc(
        ship.x, ship.y, Math.cos(a) * speed, Math.sin(a) * speed,
        Math.random() > 0.5 ? '#C97B3D' : (Math.random() > 0.5 ? '#94B03D' : '#F4EBDA'),
        0.5 + Math.random() * 0.7,
        (2 + Math.random() * 3) * S,
        60
      );
    }

    shakeT = 0.55;
  }

  function confetti() {
    const colors = ['#94B03D', '#D9A441', '#C97B3D', '#F4EBDA', '#7C8F5C'];
    const count = emitCount(26);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
      const speed = (60 + Math.random() * 120) * S;
      particlePool.alloc(
        ship.x, ship.y - 8 * S,
        Math.cos(a) * speed, Math.sin(a) * speed,
        colors[Math.floor(Math.random() * colors.length)],
        0.8 + Math.random() * 0.6,
        (1.5 + Math.random() * 2.2) * S,
        110
      );
    }
  }

  function normalizeAngle(a: number) {
    let x = a % (Math.PI * 2);
    if (x > Math.PI) x -= Math.PI * 2;
    if (x < -Math.PI) x += Math.PI * 2;
    return x;
  }

  // §8.2: advances the pool in place — zero allocations, zero Array.filter.
  function simulateParticles(dt: number) {
    particlePool.simulate(dt);
  }

  // --- Frame-rate-driven cosmetic timers -------------------------------------
  // Not physics: screen shake, toast fade, phoenix flash, and the level-intro
  // banner are pure visual timers and run once per rendered frame (frameDt),
  // outside the fixed-timestep physics accumulator. See §4.1.
  function updateFrameTimers(frameDt: number) {
    if (state === 'paused') return;
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

    // v12 Commit 7: shooting stars — own motion/life advance here (frame-
    // time domain, same as shakeT/phoenixFlashT above), spawn scheduled
    // against simTime (set by step()'s fixed-timestep tick). Never spawns
    // while the degradation guard is tripped.
    if (shootingStar) {
      shootingStar.life -= frameDt;
      shootingStar.x += shootingStar.vx * frameDt;
      shootingStar.y += shootingStar.vy * frameDt;
      if (shootingStar.life <= 0) shootingStar = null;
    }
    if (!perfGuard.degraded && simTime >= nextShootingStarT) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      shootingStar = {
        x: Math.random() * width,
        y: height * Math.random() * 0.33,
        vx: dir * 420,
        vy: 160,
        life: 0.7,
      };
      nextShootingStarT = simTime + 8 + Math.random() * 14;
    }

    // v12 Commit 7: wind streak advancement — a fixed 5-slot pool (lazily
    // seeded to random positions on first use), reused every frame rather
    // than pooled. Positions wrap at the canvas edges.
    if (terrain) {
      const windNow = currentWind(cfg, windPhase);
      if (Math.abs(windNow) > 12 && !perfGuard.degraded) {
        if (!windStreaks) {
          windStreaks = [];
          for (let i = 0; i < WIND_STREAK_COUNT; i++) {
            windStreaks.push({ x: Math.random() * width, y: height * Math.random() * 0.6, len: 30 + Math.random() * 30 });
          }
        }
        for (const s of windStreaks) {
          s.x += windNow * 6 * frameDt;
          if (s.x > width + s.len) s.x = -s.len;
          if (s.x < -s.len) s.x = width + s.len;
        }
      }
    }
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
    // v12 Commit 4: track continuous-thrust duration for the flame's
    // ramp-in (drawShip's thrustT = min(1, thrustHeldT / 0.25)).
    thrustHeldT = ship.thrusting ? thrustHeldT + dt : 0;

    // v12 Commit 9: critters brace and kick up dust when the ship thrusts
    // within 55px of them. Cheap at <=6 critters; particle emission is
    // owned by main.ts (world.ts's drawCritters is render-only, I1).
    if (ship.thrusting) {
      for (const critter of critters) {
        if (Math.hypot(critter.x - ship.x, critter.baseY - ship.y) < 55) {
          for (let i = 0; i < emitCount(2); i++) {
            particlePool.alloc(
              critter.x + (Math.random() - 0.5) * 4,
              critter.baseY - 1,
              (Math.random() - 0.5) * 50,
              -(10 + Math.random() * 20),
              Math.random() > 0.5 ? 'rgba(185,164,128,0.5)' : 'rgba(122,100,70,0.5)',
              0.4 + Math.random() * 0.3,
              (1.5 + Math.random() * 1.5) * S,
              14
            );
          }
        }
      }
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

    // §Commit 6: fuel canister pickups — swept ship-motion segment vs. each
    // alive canister's position.
    for (const c of canisters) {
      if (!c.alive) continue;
      if (sweptSegmentCircleHit(x0, y0, ship.x, ship.y, c.x, c.y, 12 * S)) {
        c.alive = false;
        ship.fuel = Math.min(stats.maxFuel, ship.fuel + 20);
        stardustAdd(5);
        toasts.push({ text: '⛽ +20 fuel · +5✨', t: 1.6 });
        audio.select();
      }
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
    if (invulnT > 0) invulnT -= dt;

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
        particlePool.alloc(
          ship.x + side * 9 * S, ship.y + 4 * S,
          side * 20 + ship.vx * 0.4, ship.vy * 0.2 - 10,
          '#8a6a3c', 1.6, 2.6 * S, 140
        );
      }
    }

    // §7 Terraformer: below 40m, smooths terrain beneath the ship (radius
    // +40% per stack). terraform() mutates terrain.points in place, which
    // invalidates layerCache's cached terrain canvas (§8.1) — mark it dirty;
    // the actual repaint is throttled to at most once per REBUILD_INTERVAL_S
    // (0.5s) below, so a ship hovering in place doesn't thrash the cache
    // even though terraform() itself runs every physics tick it's active.
    if (pickedUpgrades.includes('terraformer') && terrain) {
      const alt = terrainYAt(terrain.points, ship.x) - ship.y;
      if (alt < 40) {
        const tfStacks = pickedUpgrades.filter((u) => u === 'terraformer').length;
        const radius = 50 * Math.pow(1.4, tfStacks - 1);
        terraform(terrain.points, ship.x, radius, 0.35 * dt);
        layerCache.markTerrainDirty();
      }
    }

    // §6.1 Noodle piles: advance falling strands (deposit on terrain
    // contact), decay existing piles, and drop dead strands. Cheap no-ops
    // when noodlePile is empty / no noodles are airborne.
    //
    // Note on §8.1 caching: unlike terraform(), pile height changes do NOT
    // mark layerCache's terrain canvas dirty. Piles decay a little every
    // single tick they're non-empty, so baking them into the cached canvas
    // would force a rebuild almost every frame — exactly the per-frame churn
    // §8.1 exists to eliminate. Instead drawNoodlePiles() renders the height
    // map as a cheap live overlay directly over the blitted terrain each
    // frame (bounded by segment count, not a full canvas repaint), which is
    // both correct (always current) and fast.
    if (noodlePile.length > 0 || noodlePool.slots.some((s) => s.alive)) {
      noodlePool.simulate(noodlePile, terrain.points, terrainYAt, pdt, stats.noodleStacks);
      decayNoodlePile(noodlePile, pdt);
    }

    // §6.3 Drones: advance orbit angles. Pool is empty (droneCharges=0)
    // until an upgrade sets it — updateDrones on an empty array is a no-op.
    if (drones.length > 0) updateDrones(drones, pdt);

    // §6.2 Ability cooldowns tick on raw dt (cooldowns aren't slowed by
    // Chrono Crystal), matching the fuel-drain convention elsewhere in step().
    if (abilityDefStates.length > 0) tickAbilityCooldowns(abilityDefStates, dt);

    // §6.4/§8.1: terraform() (above) may have marked layerCache's terrain
    // canvas dirty this tick. Repaint it now if dirty AND the throttle
    // window (REBUILD_INTERVAL_S = 0.5s) has elapsed since the last
    // repaint — layerCache.tryRebuildTerrain owns both the dirty-flag check
    // and the throttle internally (built on the same shouldRebuild() guard
    // entities.ts exports).
    layerCache.tryRebuildTerrain(simTime);

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
      if (hit && invulnT <= 0) {
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
      hitStopT = 0.07;
      phoenixFlashT = 0.9;
      ship.x = width * 0.5;
      ship.y = height * 0.12;
      ship.vx = 0;
      ship.vy = 10;
      ship.angle = 0;
      ship.fuel = Math.round(stats.maxFuel * 0.6);
      invulnT = REVIVE_INVULN_S;
      audio.phoenix();
      unlockAch('ach_phoenix');
      return;
    }
    runStats.crashes += 1;
    explode();
    hitStopT = 0.07;
    audio.crash();
    haptic([40, 30, 60]);
    state = 'crashed';
    crashTimerId = window.setTimeout(showCrashScreen, 600);
  }

  function handleTouchdown(groundY: number) {
    let speed = Math.hypot(ship.vx, ship.vy);
    const angle = Math.abs(normalizeAngle(ship.angle));
    const onPad = ship.x > terrain.pad.xStart - stats.padBonus / 2 &&
                  ship.x < terrain.pad.xEnd + stats.padBonus / 2;
    // §Commit 6: the optional high-risk/high-reward bonus pad counts as a
    // valid landing surface everywhere onPad currently gates the safe-
    // landing logic; onBonus is also tracked separately so a safe landing
    // there can pay out its own 3x bonus below.
    const bp = terrain.bonusPad;
    const onBonus = !!bp && ship.x > bp.xStart - stats.padBonus / 2 && ship.x < bp.xEnd + stats.padBonus / 2;
    const onAnyPad = onPad || onBonus;

    // §7 Valkyrie Autopilot: guaranteed landing — clamp touchdown velocity
    // to tolerance so it's never a gamble (§7 implementation notes).
    if (valkyrieActive) {
      ship.vx = Math.min(Math.abs(ship.vx), stats.landingSpeedTol * 0.4) * Math.sign(ship.vx || 1);
      ship.vy = Math.min(ship.vy, stats.landingSpeedTol * 0.7);
      ship.angle = 0;
      speed = Math.hypot(ship.vx, ship.vy);
      valkyrieActive = false;
      landedWithAutopilot = true;
    }

    // §7 Sticky Landing Pads: horizontal speed forgiven ×1.2^stacks while on
    // the pad (applied to the effective speed check, not the real velocity).
    // §7 Rocket Skates: too-fast-but-level landings convert to a slide —
    // speed tol ×2 (via slideLandingMult) when angle < tol/2 (tighter angle
    // requirement than a normal safe landing).
    let effSpeedTol = stats.landingSpeedTol;
    if (onAnyPad && stats.stickyPadStacks > 0) effSpeedTol *= Math.pow(1.2, stats.stickyPadStacks);
    let sliding = false;
    if (onAnyPad && stats.slideLanding > 0 && angle < stats.landingAngleTol / 2 && speed < effSpeedTol * stats.slideLandingMult) {
      sliding = true;
      effSpeedTol = effSpeedTol * stats.slideLandingMult;
    }
    const safe = onAnyPad && speed < effSpeedTol && angle < stats.landingAngleTol;

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
      emitLandingDustRing(groundY);
      hitStopT = 0.04;
      haptic([15, 40, 15]);

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
      if (cfg.surge) payout = Math.round(payout * 1.5);
      if (onBonus && !onPad) payout = Math.round(payout * 3);
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
            const speed = cfg.projSpeed * stats.projSpeedMult;
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
            const speed = cfg.projSpeed * stats.projSpeedMult;
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
            const speed = cfg.projSpeed * 0.85 * stats.projSpeedMult;
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
        if (invulnT > 0) {
          // Spawn-grace immunity: shot harmlessly deflects, no charge spent.
        } else if (stats.pocketMoon > 0) {
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
          particlePool.alloc(
            ap.target.x, ap.target.y, Math.cos(a) * speed, Math.sin(a) * speed,
            '#7C8F5C', 0.4 + Math.random() * 0.4, (1.5 + Math.random() * 2) * S
          );
        }
      } else if (!ap.target.alive) {
        ap.alive = false;
      }
    }
    allyProjectiles = allyProjectiles.filter((ap) => ap.alive);
  }

  // --- Overlays ---

  // --- Upgrade picker ------------------------------------------------------
  // Redesigned card screen: large illustrated cards (inline SVG emblems, no
  // external images), bold names, one plain-English line per upgrade
  // (u.desc), hover lift + rarity glow, a "Pick one" heading and a visible
  // countdown. When the countdown runs out the run auto-skips ("travel
  // light") so the game never stalls.
  const UPGRADE_PICK_SECONDS = 20;
  let upgradeTimerId = 0;
  function clearUpgradeTimer() {
    if (upgradeTimerId) { window.clearInterval(upgradeTimerId); upgradeTimerId = 0; }
  }
  function ensureUpgradeCardStyles() {
    if (document.getElementById('upg-card-style')) return;
    const st = document.createElement('style');
    st.id = 'upg-card-style';
    st.textContent = `
      .upg-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:10px;
        padding:20px 14px 16px;border:1.5px solid var(--uc);border-radius:16px;text-align:center;
        cursor:pointer;width:100%;
        background:linear-gradient(160deg,var(--uc-tint) 0%,rgba(255,255,255,0) 46%),linear-gradient(180deg,#FDF8ED,#F1E6CF);
        box-shadow:0 2px 10px -6px rgba(34,26,18,.25),0 0 var(--uc-glow) var(--uc-glowc);
        transition:transform .16s ease,box-shadow .16s ease;}
      .upg-card:hover,.upg-card:focus-visible{transform:translateY(-6px) scale(1.03);
        box-shadow:0 14px 32px -10px rgba(34,26,18,.35),0 0 calc(var(--uc-glow) + 12px) var(--uc-glowc);}
      .upg-card:active{transform:translateY(-2px) scale(1.01);}
      .upg-card .upg-emblem{filter:drop-shadow(0 3px 6px rgba(34,26,18,.18));transition:transform .16s ease;}
      .upg-card:hover .upg-emblem{transform:scale(1.07);}
      .upg-name{font-weight:700;font-size:1.02rem;line-height:1.2;color:var(--color-ink);}
      .upg-desc{font-size:.8rem;line-height:1.35;color:#5D5140;}
      .upg-rarity{margin-top:auto;font-family:"JetBrains Mono",monospace;font-size:.62rem;
        letter-spacing:.14em;text-transform:uppercase;color:var(--uc);}
      .upg-body{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0;flex:1;}
      .upg-timerbar{height:6px;border-radius:3px;background:var(--color-line);overflow:hidden;}
      .upg-timerbar>div{height:100%;border-radius:3px;transition:width .1s linear;
        background:linear-gradient(90deg,var(--color-accent-mid),var(--color-accent));}
      .upg-owned{position:absolute;top:8px;right:8px;font-family:"JetBrains Mono",monospace;font-size:.6rem;letter-spacing:.06em;color:#FFFDF6;background:var(--uc);padding:2px 8px;border-radius:999px;}
      /* Mobile: horizontal compact cards — emblem left, text right — so a
         full offer (3-6 cards) fits the overlay with minimal scrolling and
         every card stays a big, easy tap target. */
      @media (max-width: 520px){
        .upg-card{flex-direction:row;text-align:left;padding:12px 14px;gap:12px;align-items:center;}
        .upg-card .upg-emblem{width:60px;height:60px;flex-shrink:0;}
        .upg-body{align-items:flex-start;gap:4px;}
        .upg-name{font-size:.95rem;}
        .upg-desc{font-size:.76rem;}
        .upg-rarity{margin-top:2px;}
        .upg-card:hover{transform:none;}
      }
    `;
    document.head.appendChild(st);
  }

  // Inline SVG emblem: hex badge on a tinted ring in the rarity color, the
  // upgrade glyph centered, radiating spokes for epic+ tiers.
  function upgradeEmblemSvg(u: UpgradeDef): string {
    const c = RARITY[u.rarity].color;
    const rank = RARITY_RANK.indexOf(u.rarity);
    const cx = 42, cy = 42;
    const hex = Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      return `${(cx + Math.cos(a) * 29).toFixed(1)},${(cy + Math.sin(a) * 29).toFixed(1)}`;
    }).join(' ');
    const rays = rank >= 3
      ? Array.from({ length: 8 }, (_, i) => {
          const a = (Math.PI / 4) * i + Math.PI / 8;
          const x1 = cx + Math.cos(a) * 33, y1 = cy + Math.sin(a) * 33;
          const x2 = cx + Math.cos(a) * 40, y2 = cy + Math.sin(a) * 40;
          return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${c}" stroke-width="${rank >= 4 ? 3 : 2.2}" stroke-linecap="round" opacity="0.85"/>`;
        }).join('')
      : '';
    return `<svg class="upg-emblem" width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="31" fill="${c}16" stroke="${c}55" stroke-width="1.5"/>
      <polygon points="${hex}" fill="#FFFDF6" stroke="${c}" stroke-width="2"/>
      ${rays}
      <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="central" font-size="30">${u.icon}</text>
    </svg>`;
  }

  function showLevelComplete() {
    ensureUpgradeCardStyles();
    setOverlay(`
      <div class="text-center">
        <p class="badge badge-signal">landed — level ${levelIndex + 1} clear</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Pick one</h2>
        <p class="text-xs text-muted mt-1">Every boon has a cost. Rarer finds, bigger swings — gold ones are an event.</p>
        <div class="flex items-center justify-center gap-3 mt-3 max-w-sm mx-auto">
          <div class="upg-timerbar flex-1"><div data-upg-bar style="width:100%"></div></div>
          <span class="font-mono text-sm tabular-nums" data-upg-secs>${UPGRADE_PICK_SECONDS}</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5" data-upgrade-choices style="grid-auto-rows:1fr;"></div>
        <button data-action="skip-upgrade" class="mt-4 text-xs font-mono text-muted hover:text-ink transition-colors cursor-pointer underline underline-offset-2">▶ skip — travel light · +15✨</button>
      </div>
    `);
    renderUpgradeChoices();
    startUpgradeCountdown();
  }

  function startUpgradeCountdown() {
    clearUpgradeTimer();
    const deadline = performance.now() + UPGRADE_PICK_SECONDS * 1000;
    const bar = overlayContent.querySelector('[data-upg-bar]') as HTMLElement | null;
    const secs = overlayContent.querySelector('[data-upg-secs]') as HTMLElement | null;
    upgradeTimerId = window.setInterval(() => {
      if (state !== 'levelComplete') { clearUpgradeTimer(); return; }
      const left = Math.max(0, deadline - performance.now());
      if (bar) bar.style.width = `${(left / (UPGRADE_PICK_SECONDS * 1000)) * 100}%`;
      if (secs) {
        secs.textContent = String(Math.ceil(left / 1000));
        secs.style.color = left < 5000 ? 'var(--color-accent)' : '';
      }
      if (left <= 0) {
        clearUpgradeTimer();
        skipUpgrade(); // time's up — travel light, keep the run moving
      }
    }, 100);
  }

  // §5.3 Skip option: no pick, +15 stardust, advance immediately. Reachable
  // by clicking the skip link or pressing Escape while the upgrade overlay
  // is open (handled in the `keydown` listener below).
  function skipUpgrade() {
    if (state !== 'levelComplete') return;
    clearUpgradeTimer();
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
  // 2^stacks when rolling upgrade offers, then renormalizes (i.e. the
  // multiplied weight IS the renormalization basis — weighted-random draw
  // over the adjusted weights already "sums correctly" because we always
  // divide by the adjusted total, not the original one). Rebalanced from
  // 3^stacks in Commit 4 of the v11 plan.
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
      const glowPx = rank >= 4 ? 30 : rank >= 3 ? 22 : rank >= 2 ? 14 : 0;
      const label = rank >= 4 ? `✦ ${r.label} ✦` : r.label;
      const n = pickedUpgrades.filter((x) => x === u.id).length;
      return `
      <button class="upg-card" data-pick="${u.id}"
        style="--uc:${r.color};--uc-tint:${r.color}26;--uc-glow:${glowPx}px;--uc-glowc:${glowPx ? `${r.color}${rank >= 4 ? '66' : '44'}` : 'transparent'};">
        ${upgradeEmblemSvg(u)}
        ${n > 0 ? `<div class="upg-owned">owned ×${n}</div>` : ''}
        <span class="upg-body">
          <span class="upg-name">${u.name}</span>
          <span class="upg-desc">${u.desc}</span>
          <span class="upg-rarity">${label}</span>
        </span>
      </button>
    `;
    }).join('');

    // Rare+ offers announce themselves
    const topRank = Math.max(...choices.map((u) => RARITY_RANK.indexOf(u.rarity)));
    if (topRank >= 2) audio.raritySting(topRank);

    container.querySelectorAll('[data-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        clearUpgradeTimer();
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
    const el = Math.max(0, performance.now() - runStats.startedAt);
    const mm = Math.floor(el / 60000);
    const ss = String(Math.floor(el / 1000) % 60).padStart(2, '0');
    setOverlay(`
      <div class="text-center">
        <p class="badge" style="color:#C97B3D">run over</p>
        <h2 class="font-display text-3xl font-semibold mt-2">Crashed on ${cfg.name}</h2>
        <p class="text-muted mt-3">Reached level ${reached} as ${DIFF_MODS[difficulty].label} · Landings: ${runStats.landings} · Best: level ${best}</p>
        <p class="text-xs text-muted mt-1">✨ ${runStats.stardustEarned} earned · ${mm}:${ss} flight time · ${runStats.skips} skips</p>
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

  // §Commit 7: client-side-only leaderboard difficulty filter — payloads
  // to/from /api/scores are unchanged (I3), this only affects which rows
  // of the already-fetched result set are displayed.
  let lbFilter: 'all' | Difficulty = 'all';

  function renderLbRows(rows: ScoreRow[]) {
    const list = overlayContent.querySelector('[data-lb-list]') as HTMLElement | null;
    if (!list) return;
    const filtered = lbFilter === 'all' ? rows : rows.filter((r) => r.difficulty === lbFilter);
    if (filtered.length === 0) {
      list.innerHTML = `<p class="text-muted text-center text-xs">No ${lbFilter} scores yet.</p>`;
      return;
    }
    const medals = ['🥇', '🥈', '🥉'];
    const shown = filtered.slice(0, 25);
    list.innerHTML = shown.map((r, i) => `
      <div class="flex items-center justify-between gap-3 py-1.5 ${i < shown.length - 1 ? 'border-b border-line' : ''}">
        <span class="text-muted w-8">${medals[i] ?? `${i + 1}.`}</span>
        <span class="flex-1 text-ink truncate">${String(r.name).replace(/[<>&]/g, '')}</span>
        <span class="text-muted text-xs">${DIFF_MODS[r.difficulty as Difficulty]?.icon ?? ''}</span>
        <span class="badge-signal">lvl ${r.level}</span>
      </div>
    `).join('');
  }

  // --- Global leaderboard screen ---
  async function showLeaderboard() {
    // px/py padding keeps these comfortable thumb targets on phones.
    const filterBtnClass = (active: boolean) =>
      `cursor-pointer px-2 py-1.5 ${active ? 'text-ink underline underline-offset-2' : 'text-muted hover:text-ink transition-colors'}`;
    setOverlay(`
      <div class="text-center max-w-md mx-auto">
        <p class="badge badge-signal">🌍 global leaderboard</p>
        <h2 class="font-display text-2xl font-semibold mt-2">Deepest descents, worldwide</h2>
        <div class="flex items-center justify-center gap-3 mt-3 text-xs font-mono" data-lb-filters>
          ${(['all', 'cadet', 'pilot', 'ace'] as const).map((f) => `
            <button data-lb-filter="${f}" class="${filterBtnClass(f === lbFilter)}">${f === 'all' ? 'all' : DIFF_MODS[f].label.toLowerCase()}</button>
          `).join('')}
        </div>
        <div class="mt-4 text-left font-mono text-sm" data-lb-list>
          <p class="text-muted text-center text-xs">contacting mission control…</p>
        </div>
        <button data-action="menu" class="tile mt-5 px-6 py-2 inline-block cursor-pointer font-mono text-sm">back</button>
      </div>
    `);
    // Wired directly (not via the overlay's data-action delegate, which only
    // handles data-action|data-diff|data-shop — kept that way per plan).
    const filterRow = overlayContent.querySelector('[data-lb-filters]') as HTMLElement | null;
    filterRow?.querySelectorAll('[data-lb-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        lbFilter = (btn as HTMLElement).dataset.lbFilter as 'all' | Difficulty;
        filterRow.querySelectorAll('[data-lb-filter]').forEach((b) => {
          b.className = filterBtnClass((b as HTMLElement).dataset.lbFilter === lbFilter);
        });
        if (lbCache) renderLbRows(lbCache);
      });
    });
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
    renderLbRows(rows);
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
          ←/→ or A/D to rotate · ↑ / W / Space to thrust · ↓ / S for your active
          ability. Land slow and level on the pad. Endless levels, each harder
          than the last. 69 upgrades across five rarities, every one with a
          real tradeoff — and every one stacks forever, so a duplicate pick is
          never wasted. Don't like what's offered? Skip it for a stardust
          bonus and travel light.
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
    if (target.dataset.action === 'resume') resumeGame();
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
    // While actually flying, game keys must never scroll the page. This
    // runs before the e.repeat gate below because held-key repeat events
    // scroll too. Deliberately scoped to state === 'playing' only — on the
    // title screen, crash screen, and upgrade picker the player may need
    // to scroll normally.
    if (state === 'playing' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (e.key === 'Escape' && state === 'levelComplete') {
      // §5.3: Escape triggers skip while the upgrade-choice overlay is open.
      skipUpgrade();
      return;
    }
    if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && (state === 'playing' || state === 'paused')) {
      if (state === 'playing') pauseGame(); else resumeGame();
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

  // bindTouch also toggles a `.is-pressed` class for immediate visual
  // feedback on tap (mobile browsers don't reliably show :active once
  // touch-action:none + preventDefault are in play) — the CSS in game.astro
  // brightens/scales the button on that class.
  function bindTouch(el: HTMLElement | null, on: () => void, off: () => void) {
    if (!el) return;
    const press = (e: Event) => { e.preventDefault(); el.classList.add('is-pressed'); on(); };
    const release = (e: Event) => { e.preventDefault(); el.classList.remove('is-pressed'); off(); };
    el.addEventListener('touchstart', press, { passive: false });
    el.addEventListener('touchend', release, { passive: false });
    el.addEventListener('touchcancel', release, { passive: false });
    el.addEventListener('mousedown', () => { el.classList.add('is-pressed'); on(); });
    el.addEventListener('mouseup', () => { el.classList.remove('is-pressed'); off(); });
    el.addEventListener('mouseleave', () => { el.classList.remove('is-pressed'); off(); });
  }
  bindTouch(touchLeft, () => { input.left = true; registerTap('left'); }, () => (input.left = false));
  bindTouch(touchRight, () => { input.right = true; registerTap('right'); }, () => (input.right = false));
  bindTouch(touchThrust, () => { input.thrust = true; haptic(10); }, () => (input.thrust = false));
  // §6.2: 4th touch button fires the ability on press (not hold — matches
  // "one press fires ... one ability per press"). Hidden by default via CSS
  // class, shown only when abilityDefStates is non-empty (updateAbilityButtonVisibility).
  if (touchAbility) {
    touchAbility.addEventListener('touchstart', (e) => {
      e.preventDefault();
      touchAbility.classList.add('is-pressed');
      if (state === 'playing') { fireAbility(); haptic(10); }
    }, { passive: false });
    touchAbility.addEventListener('touchend', (e) => { e.preventDefault(); touchAbility.classList.remove('is-pressed'); }, { passive: false });
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

    if (!terrain) { ctx.restore(); return; }

    // Dynamic camera: everything world-anchored (terrain, entities, ship,
    // fog, guidance overlays) renders inside this transform; screen-space
    // HUD elements (pips, vignettes, banners, toasts) render after it pops.
    updateCamera(t);

    // §8.1/v12 Commit 2: sky gradient + planet + horizon glow were
    // previously rebuilt from scratch every frame; now prerendered once per
    // loadLevel/resize into layerCache's offscreen canvas and just blitted
    // here. Sky sits at "infinite" distance — blitted BEFORE the camera
    // zoom/pan transform (still inside the shake-translate, so screen shake
    // still reads) so it never pans or zooms with the ship.
    blitSky(ctx, layerCache);

    // v12 Commit 2: parallax depth planes, each feeling a fraction of the
    // camera's zoom/pan via withParallax's factor (0 = screen-fixed,
    // 1 = full camera motion). Stars barely drift (0.12), the far ridge a
    // bit more (0.3), the near ridge noticeably more (0.55) — terrain and
    // everything else below still gets the full 1.0 transform, unchanged.
    // Twinkle (and, per §Commit 7, the parallax itself) is disabled when
    // the degradation guard is tripped.
    withParallax(0.12, () => blitStars(ctx!, layerCache, t, !perfGuard.degraded));
    withParallax(0.3, () => blitRidge(ctx!, layerCache, 'far'));
    withParallax(0.55, () => blitRidge(ctx!, layerCache, 'near'));

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camZoom, camZoom);
    ctx.translate(-camX, -camY);

    blitTerrain(ctx, layerCache);

    // §6.1 Noodle piles — soft rounded blob layer directly over the terrain,
    // drawn before critters/pad so they visually sit "in" the ground.
    if (noodlePile.length > 0) drawNoodlePiles(ctx, noodlePile, terrain.points);

    drawCritters(ctx, critters, t, ship.x, ship.y, ship.thrusting, celebrateT);
    drawPad(ctx, terrain, cfg, stats, t, perfGuard.degraded);
    drawCanisters(ctx, canisters, t, perfGuard.degraded);
    drawBonusPad(ctx, terrain, t, perfGuard.degraded);

    // Asteroids — pure blit; position/collision computed in the physics
    // step via entities.ts (§4.4, no gameplay mutation in the render path).
    drawAsteroids(ctx, asteroids, simTime);

    drawUfos(ctx, ufos, projectiles, stats, ship.x, ship.y, perfGuard.degraded);

    // §6.3 Drones — placeholder generic look; no-op while the pool is empty.
    if (drones.length > 0) drawDrones(ctx, drones, ship.x, ship.y);

    // §6.1 Airborne noodle strands (pre-absorption into the pile).
    for (const noo of noodlePool.slots) {
      if (!noo.alive) continue;
      drawNoodle(ctx, noo, S);
    }

    // Ally shots (Alien Diplomacy stack 2+, §5.1) — same capsule-tracer
    // geometry as hostile shots (v12 Commit 6), in green to read as friendly.
    drawProjectileTracers(ctx, allyProjectiles, '#94B03D', perfGuard.degraded);

    // §8.3 Particles. True draw-call batching (accumulating same-color
    // particles into one path + one fill()) doesn't apply cleanly here: each
    // particle fades independently via its own life/maxLife ratio driving
    // globalAlpha, so even two particles that share a base color essentially
    // never share the same alpha on a given frame — a single batched fill()
    // can't vary alpha per sub-path. What IS free to skip is the redundant
    // `fillStyle` write when this particle's color happens to match the
    // previous one in pool order (a common case: a whole emission burst,
    // e.g. one explode()/confetti() call, shares one palette and lands in
    // adjacent pool slots) — that's the one real, zero-risk piece of
    // "group by color" available under the current per-particle-alpha model.
    // v12 Commit 5: branch on `kind` — dot/smoke still batch through the
    // shared arc + color-cache path below (smoke just draws softer/fading
    // in at 0.45x alpha since it also grows); spark and chunk get their own
    // draw calls (a line segment under additive compositing, and a rotated
    // triangle) since neither can reuse the arc/fillStyle-cache shape.
    // Spark counts are always <25/frame (explode() emits 18 max), so a
    // per-spark save/restore composite toggle is cheap — no need to batch
    // them into a separate pass.
    let lastParticleColor = '';
    for (const p of particlePool.slots) {
      if (!p.alive) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      if (p.kind === PARTICLE_SPARK) {
        // §Commit 7: routed through addGlow so the degradation guard can
        // fall back to a cheap source-over stroke instead of additive.
        ctx.globalAlpha = alpha;
        addGlow(ctx, perfGuard.degraded, () => {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
          ctx.stroke();
        });
        lastParticleColor = '';
        continue;
      }
      if (p.kind === PARTICLE_CHUNK) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.beginPath();
        ctx.moveTo(0, -p.size);
        ctx.lineTo(p.size, p.size);
        ctx.lineTo(-p.size, p.size);
        ctx.closePath();
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.restore();
        lastParticleColor = '';
        continue;
      }
      ctx.globalAlpha = p.kind === PARTICLE_SMOKE ? alpha * 0.45 : alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      if (p.color !== lastParticleColor) {
        ctx.fillStyle = p.color;
        lastParticleColor = p.color;
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // v12 Commit 4: ground light pool + contact shadow, world-space, drawn
    // after everything else on the ground but before the ship itself — the
    // engine visibly lights the ground on descent, and the shadow is the
    // single biggest depth cue in the game (also doubles as a landing aid).
    const shipThrustT = Math.min(1, thrustHeldT / 0.25);
    if (terrain && (state === 'playing' || state === 'levelComplete' || state === 'paused')) {
      const groundYNow = terrainYAt(terrain.points, ship.x);
      const altNow2 = groundYNow - ship.y;

      if (ship.thrusting && altNow2 < 120) {
        const spicy = stats.spicyFlame;
        const greenAmt = Math.min(255, 176 + stats.spicyStacks * 14);
        const flameColor = spicy ? `148, ${greenAmt}, 61` : '217, 164, 65';
        const poolAlpha = 0.3 * (1 - altNow2 / 120) * shipThrustT;
        if (poolAlpha > 0.003) {
          // §Commit 7: routed through addGlow for the degradation fallback.
          addGlow(ctx, perfGuard.degraded, () => {
            const rx = 46 + altNow2 * 0.15, ry = 12;
            ctx.translate(ship.x, groundYNow);
            ctx.scale(rx / ry, 1);
            const poolGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
            poolGrad.addColorStop(0, `rgba(${flameColor}, ${poolAlpha})`);
            poolGrad.addColorStop(1, `rgba(${flameColor}, 0)`);
            ctx.fillStyle = poolGrad;
            ctx.beginPath();
            ctx.arc(0, 0, ry, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      if (altNow2 < 280) {
        const shadowAlpha = 0.30 * (1 - altNow2 / 280);
        if (shadowAlpha > 0.003) {
          const hw = 26 * S * (0.35 + 0.65 * (1 - altNow2 / 280));
          ctx.beginPath();
          ctx.ellipse(ship.x, groundYNow - 1, hw, hw * 0.22, 0, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(10, 6, 2, ${shadowAlpha})`;
          ctx.fill();
        }
      }
    }

    // Ship
    if (state === 'playing' || state === 'levelComplete' || state === 'paused') {
      drawShip({
        ctx, ship, S, mood: currentMood(), shieldFlash, stats, pickedUpgrades,
        paint: equippedPaint(), pilotPhoto, faceMap, thrustT: shipThrustT,
        degraded: perfGuard.degraded, invulnT,
      });
    }

    // §Commit 3: baseline landing readability — a small readiness tick under
    // the ship near the ground, independent of any upgrade (Echo Altimeter
    // still adds the numeric px/s readout + touchdown forecast on top).
    if (state === 'playing' && terrain && terrainYAt(terrain.points, ship.x) - ship.y < 140) {
      const spd = Math.hypot(ship.vx, ship.vy);
      const speedOk = spd < stats.landingSpeedTol;
      const angleOk = Math.abs(normalizeAngle(ship.angle)) < stats.landingAngleTol;
      const col = speedOk && angleOk ? '#94B03D' : speedOk || angleOk ? '#D9A441' : '#C97B3D';
      ctx.save();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = col;
      const barW = 14, barH = 3, barR = 1.5;
      const bx = ship.x - barW / 2, by = ship.y + 15 * S;
      ctx.beginPath();
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(bx, by, barW, barH, barR);
      } else {
        (ctx as any).rect(bx, by, barW, barH);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
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

    // §7 Valkyrie Autopilot: cyan trajectory line to the pad while the PD
    // controller is flying the ship (world-space; the OSD text is drawn in
    // screen space after the camera pops).
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

    // --- end of world-space rendering: pop the dynamic-camera transform ---
    ctx.restore();

    // §6.2 Active-ability cooldown pips — screen-space, just above where the
    // DOM fuel bar sits (bottom HUD strip), only when abilities are owned.
    if (stats.abilityDefs.length > 0) {
      drawAbilityPips(ctx, abilityDefStates, 10, height - 34);
    }

    // Chrono Crystal bullet-time: cool-toned vignette + indicator (screen)
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

    // §7 Valkyrie Autopilot OSD text (screen-space)
    if (valkyrieActive) {
      ctx.save();
      ctx.font = `${Math.max(11, Math.round(width / 68))}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(94, 214, 214, 0.9)';
      ctx.fillText('🤖 autopilot engaged', width / 2, 40);
      ctx.restore();
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
      if (cfg.surge) tags.unshift('⚠ surge · +50%✨');
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

    // v12 Commit 7: shooting star — screen-space ambient life, above the
    // world/parallax layers but below the vignette (drawn last, below).
    // §Commit 7 gate list: disabled entirely (not just un-spawned) while
    // the degradation guard is tripped.
    if (shootingStar && !perfGuard.degraded) {
      const alpha = Math.max(0, Math.min(1, shootingStar.life / 0.7));
      const speed = Math.hypot(shootingStar.vx, shootingStar.vy);
      const len = speed * 0.06;
      const ux = shootingStar.vx / (speed || 1), uy = shootingStar.vy / (speed || 1);
      addGlow(ctx, false, () => {
        ctx.strokeStyle = `rgba(244, 235, 218, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(shootingStar!.x, shootingStar!.y);
        ctx.lineTo(shootingStar!.x - ux * len, shootingStar!.y - uy * len);
        ctx.stroke();
      });
    }

    // v12 Commit 7: wind streaks — ambient wind-direction cue, screen-space,
    // faint drifting lines communicating wind direction (complements the
    // HUD arrows). Disabled while degraded.
    if (windStreaks && terrain && !perfGuard.degraded) {
      const windNow = currentWind(cfg, windPhase);
      if (Math.abs(windNow) > 12) {
        ctx.save();
        ctx.strokeStyle = '#B9A480';
        ctx.globalAlpha = 0.10;
        ctx.lineWidth = 1;
        for (const s of windStreaks) {
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x + (windNow > 0 ? s.len : -s.len), s.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

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

    // v12 Commit 1: vignette — LAST draw call, screen-space, one drawImage.
    if (vignetteCanvas) ctx.drawImage(vignetteCanvas, 0, 0);
  }

  function updateHud() {
    updateHudEl({
      hud, ship, stats, terrain, levelIndex, cfg, bestFor: () => bestFor(difficulty), stardust,
      compact: width < 480,
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
    const rawFrameMs = Math.max(0, t - lastT);
    // §8.5: the degradation guard needs the UN-clamped frame time — the
    // MAX_FRAME_TIME clamp below exists to stop the physics accumulator
    // from "catching up" in a huge burst after a tab-switch stall, but that
    // same stall is exactly the kind of jank the guard should notice and
    // react to, so it's sampled before clamping.
    perfGuard.sample(rawFrameMs);

    let frameDt = rawFrameMs / 1000;
    lastT = t;
    if (frameDt < 0) frameDt = 0;
    if (frameDt > MAX_FRAME_TIME) frameDt = MAX_FRAME_TIME;

    // v12 Commit 5: hit-stop — freeze physics + frame timers for a few
    // frames at the moment of impact (set in destroyShip()/handleTouchdown).
    // lastT already advanced above, so resuming afterward doesn't produce
    // an accumulator catch-up burst; perfGuard already sampled the real
    // frame time above, so a frozen (cheap) frame can't false-trip it.
    if (hitStopT > 0) {
      hitStopT -= rawFrameMs / 1000;
      draw();
      updateHud();
      raf = requestAnimationFrame(loop);
      return;
    }

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
      pauseGame();
    } else {
      loopPaused = false;
      lastT = performance.now();
      accumulator = 0;
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  resize();
  window.addEventListener('resize', resize);
  // visualViewport fires its own resize event when the address bar
  // collapses/expands or the on-screen keyboard opens, independent of
  // window's resize event on some mobile browsers — listen to both.
  let vvResizeT = 0;
  function onVisualViewportResize() {
    window.clearTimeout(vvResizeT);
    vvResizeT = window.setTimeout(resize, 60);
  }
  window.visualViewport?.addEventListener('resize', onVisualViewportResize);
  function onOrientation() {
    setTimeout(resize, 150);
  }
  window.addEventListener('orientationchange', onOrientation);
  applySound();
  showStartScreen();
  raf = requestAnimationFrame(loop);

  return function cleanup() {
    clearUpgradeTimer();
    window.clearTimeout(crashTimerId);
    window.clearTimeout(vvResizeT);
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('resize', onVisualViewportResize);
    window.removeEventListener('orientationchange', onOrientation);
    window.removeEventListener('keydown', keydown);
    window.removeEventListener('keyup', keyup);
    document.removeEventListener('visibilitychange', onVisibilityChange);
    audio.stopThrust();
    music.stop();
    stopCameraStream();
  };
}
