# Moon Lander v11 — Autonomous Build Plan

**Status:** Ready for single-run autonomous execution. No user input, confirmation, or clarification is permitted mid-run. Every decision is made in this document.

---

## 1. Problem definition (decomposition summary)

**Core problem.** v10 fixed the engine; v11 fixes the game. Three failures identified in the design review:

1. **The difficulty curve loses the arms race.** Level pressure ramps to ~level 15 then creeps at 0.015/level under hard caps (gravity 150, wind 30, 5 asteroids, 3 UFOs), while upgrades stack infinitely with compounding multipliers and five overlapping death-prevention layers. Deep runs end in boredom, not tension.
2. **Every level is the same task** — spawn top-center, land on the one pad. Zero objective variety.
3. **Readability & control gaps** — no pause (explicitly requested by owner), no baseline feedback on what a "safe" landing speed/angle is (locked behind an upgrade), duplicate upgrade cards look identical to fresh picks, the crash screen wastes the "one more run" moment, and the leaderboard ranks Cadet and Ace together.

Plus four confirmed code defects (§5, Commit 1).

**Confirmed scope:** pause system (required); baseline landing readability; upgrade-card stack counts; endless scaling rework + surge levels every 10th level; fuel canisters + bonus pad level variety; crash-screen run summary; leaderboard difficulty filter; Star Forge rebalance; the four bug fixes.

**Explicitly out of scope:** new upgrades, fog re-enable, WebGL, multiplayer, real-money stardust, any physics-engine change, any change to `netlify/functions/scores.mjs`.

**Constraints.** Vanilla TypeScript + Canvas2D + Web Audio, zero new runtime deps. Astro 5 site; deploy = push to GitHub (Netlify auto-builds). One agent, one session, no external data.

**Investigated and rejected:** the review flagged the wind indicator as double-applying `windMult`. Verified false against `physics.ts`: `currentWind()` does NOT apply `windMult` (only `gustMult`); `windAccel()` applies it once; the display's single `* stats.windMult` therefore matches the effective wind. **No fix — do not touch it.**

---

## 2. Non-negotiable invariants

The build FAILS if any of these break:

- I1. `src/scripts/lander-game.ts` still exports `initLanderGame(root: HTMLElement): () => void`. The ONLY permitted `src/pages/game.astro` change is adding the pause button (Commit 2).
- I2. All existing localStorage keys keep their exact names/formats. v11 adds NO new localStorage keys (pause state is transient).
- I3. `/api/scores` GET/POST payloads unchanged; `netlify/functions/scores.mjs` untouched. The leaderboard filter is client-side only.
- I4. `npx astro build` zero errors; `npx tsc --noEmit` passes; `npx vitest run` passes.
- I5. No new `package.json` `dependencies`.
- I6. All 69 upgrade ids/names/rarities unchanged. The only stat-formula change is Star Forge's rarity-weight exponent base (3 → 2, Commit 4).
- I7. Level generation for a given (idx, difficulty) stays deterministic. New rng consumers use NEW seeds (never insert calls into an existing `mulberry32` sequence before its current last use — appending after is safe).

---

## 3. Execution order

One commit per section below, in order, each with the stated commit message. Run `npx tsc --noEmit && npx vitest run` after every commit; fix forward before proceeding. Do the full verification suite (§4) after the last commit, then deploy (§4.3).

---

### Commit 1 — bug fixes (`fix: autopilot achievement flag, crash-timer leak, mid-level resize`)

All in `src/scripts/lander/main.ts`.

**1a. `landedWithAutopilot` over-broad.** `runValkyrieAutopilot()` sets `landedWithAutopilot = true` every tick, so the achievement fires even when the autopilot never lands the ship that level. Delete that line from `runValkyrieAutopilot()`. In `handleTouchdown()`, inside the existing `if (valkyrieActive)` clamp block, add `landedWithAutopilot = true;`.

**1b. Crash-timer leak.** `destroyShip()` calls `setTimeout(showCrashScreen, 600)` untracked. Add `let crashTimerId = 0;` near the other run-state lets. Replace the call with `crashTimerId = window.setTimeout(showCrashScreen, 600);`. Add `window.clearTimeout(crashTimerId);` (i) at the top of `startRun()` and (ii) in the returned `cleanup()`.

**1c. Mid-level resize strands the ship.** `resize()` regenerates terrain from cfg with new dimensions but never remaps the ship, which can leave it inside terrain or across the map from the pad. In `resize()`, capture `const oldW = width, oldH = height;` BEFORE reassigning. In the existing `if (terrain)` block, after `rebuildLayers()`, add: if `(state === 'playing' || state === 'levelComplete') && oldW > 0 && oldH > 0`, then `ship.x = ship.x / oldW * width; ship.y = ship.y / oldH * height;` followed by a ground clamp: `const gy = terrainYAt(terrain.points, ship.x); if (ship.y > gy - 12 * S) ship.y = gy - 40;`.

**1d. No wind-indicator change** (see §1, rejected).

---

### Commit 2 — pause system (`feat: pause (Esc/P, HUD button, auto-pause on tab hide)`)

**types.ts:** add `'paused'` to the `GameState` union.

**game.astro** (the one permitted edit): locate the element carrying `data-mute-sfx` and insert a sibling button before it with identical classes/styling: `<button type="button" data-pause aria-label="Pause" title="Pause (Esc/P)">⏸</button>`.

**main.ts:**

- Query `const pauseBtn = root.querySelector('[data-pause]') as HTMLElement | null;` (null-guard everywhere — the game must work if the button is absent).
- ```
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
  ```
  (Note: `lastT`/`accumulator` are declared below these functions in file order — hoisting via `let` at current position is fine since calls only happen after init; do not reorder declarations.)
- Overlay click handler: add `if (target.dataset.action === 'resume') resumeGame();`. Existing `restart` → `startRun()` and `menu` → `showStartScreen()` already behave correctly from the paused state (`startRun` resets everything; `showStartScreen` sets `state = 'start'` and stops music).
- `pauseBtn?.addEventListener('click', () => { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); });`
- `keydown()`: AFTER the existing Escape-skips-upgrade branch, add: `if ((e.key === 'Escape' || e.key === 'p' || e.key === 'P') && (state === 'playing' || state === 'paused')) { if (state === 'playing') pauseGame(); else resumeGame(); return; }`.
- `updateFrameTimers()`: add `if (state === 'paused') return;` as the first line (freezes shake, toasts, particles — a fully frozen scene).
- `updateCamera()`: add at top: `if (state === 'paused') { camLastT = t; return; }` (no zoom drift while paused).
- `draw()`: change the ship-draw condition to `state === 'playing' || state === 'levelComplete' || state === 'paused'` so the frozen scene stays visible under the overlay.
- `onVisibilityChange()`: in the `document.hidden` branch, add `pauseGame();` (safe no-op unless playing). Keep the existing `loopPaused` machinery untouched.
- `step()` already early-returns for any non-`playing` state — no change needed there. **Decision (steelmanned, upheld):** the upgrade-pick countdown (`levelComplete` state) is NOT pausable; its 20s wall-clock deadline is a deliberate design pressure and pausing it would require reworking the deadline math for marginal benefit.

---

### Commit 3 — baseline landing readability (`feat: speed/angle landing feedback without upgrades`)

**render/hud.ts:** in `updateHud`, where the speed value is written, set the element's color from tolerance: `speed < stats.landingSpeedTol * 0.8` → `#94B03D`; `< stats.landingSpeedTol` → `#D9A441`; else `#C97B3D`. Apply via `hud.speed.style.color`.

**main.ts `draw()`,** world-space (before the camera-transform `ctx.restore()`), after `drawShip`: when `state === 'playing'` and altitude (`terrainYAt(terrain.points, ship.x) - ship.y`) `< 140`, draw a readiness tick under the ship:

```
const spd = Math.hypot(ship.vx, ship.vy);
const speedOk = spd < stats.landingSpeedTol;
const angleOk = Math.abs(normalizeAngle(ship.angle)) < stats.landingAngleTol;
const col = speedOk && angleOk ? '#94B03D' : speedOk || angleOk ? '#D9A441' : '#C97B3D';
```

Render: `ctx.globalAlpha = 0.75`, a horizontal 14×3px rounded bar centered at `(ship.x, ship.y + 15 * S)` in `col`, alpha restored after. This deliberately does NOT duplicate the Echo Altimeter (which adds the numeric px/s readout and touchdown forecast) — the upgrade retains value.

---

### Commit 4 — upgrade-card stack counts + Star Forge rebalance (`feat: owned-stack badges on cards; balance: star forge 3x->2x`)

**main.ts `ensureUpgradeCardStyles()`:** append `.upg-owned{position:absolute;top:8px;right:8px;font-family:"JetBrains Mono",monospace;font-size:.6rem;letter-spacing:.06em;color:#FFFDF6;background:var(--uc);padding:2px 8px;border-radius:999px;}`.

**main.ts `renderUpgradeChoices()`:** per card, `const n = pickedUpgrades.filter((x) => x === u.id).length;` and inject `${n > 0 ? `<div class="upg-owned">owned ×${n}</div>` : ''}` inside the button, after the emblem.

**stats.ts `starForgeRarityWeight()`:** `Math.pow(3, starForgeStacks)` → `Math.pow(2, starForgeStacks)`; update the function's comment and the §7 comment above `rarityWeight` in main.ts. Grep `src/scripts/lander/upgrades.ts` for the Star Forge `desc`/text mentioning `3` and update to `2×` if present. Update any `__tests__` assertion pinning the old value (grep `starForgeRarityWeight` under `src/scripts/lander/__tests__/`).

---

### Commit 5 — endless scaling + surge levels (`feat: pressure past level 15, surge every 10th level`)

**types.ts `LevelConfig`:** add `surge: boolean;` and `projSpeed: number;`.

**levels.ts `levelConfigFor()`** — exact changes, preserving the existing `r()` call order (I7):

- `const surge = (idx + 1) % 10 === 0 && idx > 0;` (levels 10, 20, 30…).
- Gravity cap `150` → `170`.
- Wind: `windBase` gains `+ Math.max(0, idx - 20) * 0.25`; cap `30` → `40`.
- Asteroids: `Math.min(5, …)` → `Math.min(8, …)`; then `if (surge) asteroids = Math.min(10, Math.max(3, asteroids + 3));` (surge levels always have debris).
- UFOs: `Math.min(3, …)` → `Math.min(5, …)`; then `if (surge) ufos = Math.min(6, Math.max(2, ufos + 2));` (idx ≥ 8 gate still applies to the base roll; surge floor of 2 only when `idx >= 8`).
- `padWidth` floor `56` → `48`; `padSpeed` cap `46` → `58`.
- `projSpeed: (130 * (1 + Math.min(0.8, Math.max(0, idx - 10) * 0.02))) * (surge ? 1.15 : 1)` — hostile shots get faster from level 11, +80% asymptote.
- `name`: append `' — Surge'` when surge.
- Return `surge` and `projSpeed` in the config object.

**main.ts:**

- `updateUfos()`: replace the hostile-fire hard-coded `130` with `cfg.projSpeed`, the hacked-ally `130` with `cfg.projSpeed`, and the diplomacy-ally `110` with `cfg.projSpeed * 0.85` (all still `* stats.projSpeedMult`).
- Intro banner tags: `if (cfg.surge) tags.unshift('⚠ surge · +50%✨');`.
- `handleTouchdown()` payout: after the Golden Goose addition and before the stardustMult line, `if (cfg.surge) payout = Math.round(payout * 1.5);`.

**Failure handling:** if any existing test asserts the old caps, update the test to the new values (the caps are the thing intentionally changed).

---

### Commit 6 — level variety: fuel canisters + bonus pad (`feat: fuel canisters and high-risk bonus pad`)

**types.ts:** add `interface Canister { x: number; y: number; phase: number; alive: boolean }` (export it); add optional `bonusPad?: { xStart: number; xEnd: number; y: number }` to `Terrain`.

**levels.ts — canisters.** New export:

```
export function generateCanisters(cfg: LevelConfig, terrain: Terrain, width: number, idx: number): Canister[]
```

Own rng: `mulberry32(cfg.seed * 277 + 13)` (new seed — does not perturb existing sequences). `if (idx < 3) return [];`. Count = `Math.floor(rand() * 4)` (0–3). Placement, ≤30 attempts each: `x = width * (0.08 + rand() * 0.84)`; reject if within `terrain.pad.baseX ± (terrain.pad.range + 70)`; reject on canyon walls (same `t < 0.34 || t > 0.66` rule as critters when `cfg.terrain === 'canyon'`); `y = terrainYAt(terrain.points, x) - (60 + rand() * 160)`, clamped to `>= 40`. `phase = rand() * Math.PI * 2`, `alive: true`.

**levels.ts — bonus pad,** inside `generateTerrain()`, after the main-pad flatten and before the ridge block. All rng via the existing `rand` (appended after its current last use — safe per I7). Conditions: `!cfg.movingPad && cfg.terrain !== 'canyon' && rand() < 0.35`. Bonus half-width `bhw = Math.max(17, cfg.padWidth * 0.275)`. Up to 12 candidates: `bx = width * (0.08 + rand() * 0.84)`; accept the first with `Math.abs(bx - padCenter) > width * 0.28` and `bx - bhw - 30 > 0` and `bx + bhw + 30 < width`. If none accepted, no bonus pad (silent fallback). On accept: `const by = terrainYAt(points, bx);` flatten `points` in `[bx - bhw - 8, bx + bhw + 8]` to `by` with a 30px linear blend on each side (same pattern as the main-pad blend); set `terrain.bonusPad = { xStart: bx - bhw, xEnd: bx + bhw, y: by }` on the returned object.

**render/world.ts:** add `export function drawCanisters(ctx, canisters: Canister[], t: number)` — per alive canister at `(c.x, c.y + Math.sin(t * 2 + c.phase) * 3)`: 10×14px rounded-rect body `#D9A441`, 6×3px cap `#F4EBDA`, soft radial glow `rgba(217,164,65,0.25)` radius 16. Add `export function drawBonusPad(ctx, terrain: Terrain, t: number)` — no-op unless `terrain.bonusPad`; thin deck line in `#FFC94A`, two beacon dots at the ends blinking on `Math.floor(t * 2) % 2 === 0`, and a tiny `×3✨` mono label 12px above center at alpha 0.7.

**main.ts:**

- `let canisters: Canister[] = [];` — populate in `loadLevel()`: `canisters = generateCanisters(cfg, terrain, width, idx);`.
- Pickup in `step()`, immediately after the swept-contact position resolution: for each alive canister, `if (sweptSegmentCircleHit(x0, y0, ship.x, ship.y, c.x, c.y, 12 * S))` → `c.alive = false; ship.fuel = Math.min(stats.maxFuel, ship.fuel + 20); stardustAdd(5); toasts.push({ text: '⛽ +20 fuel · +5✨', t: 1.6 }); audio.select();`.
- `draw()`: call `drawCanisters(ctx, canisters, t)` and `drawBonusPad(ctx, terrain, t)` right after `drawPad(...)` (world-space).
- `handleTouchdown()`: compute `const bp = terrain.bonusPad; const onBonus = !!bp && ship.x > bp.xStart - stats.padBonus / 2 && ship.x < bp.xEnd + stats.padBonus / 2;`. Fold into the existing pad logic: `const onAnyPad = onPad || onBonus;` — use `onAnyPad` everywhere the current code uses `onPad` (sticky-pad forgiveness, rocket-skates gate, the `safe` check). On a safe landing, apply `if (onBonus && !onPad) payout = Math.round(payout * 3);` after the surge multiplier. **Documented limitation (accepted):** Scanner, Landing Lights, Pad Tractor Winch, Storm Caller, Grappling Hook, and Valkyrie all target the MAIN pad only — the bonus pad is a manual-flying reward by design; do not extend those systems.

---

### Commit 7 — crash-screen run summary + leaderboard filter (`feat: run summary on crash; leaderboard difficulty tabs`)

**types.ts `RunStats`:** add `stardustEarned: number; startedAt: number;`.

**main.ts:**

- Initialize both in `startRun()` (`stardustEarned: 0, startedAt: performance.now()`) and in the initial `runStats` literal (startedAt: 0).
- `stardustAdd()`: `if (n > 0 && state !== 'start') runStats.stardustEarned += n;` (covers landings, skips, gecko, miner, canisters, achievements mid-run — one simple rule, no per-site bookkeeping).
- `showCrashScreen()`: below the existing "Reached level…" line add: `<p class="text-xs text-muted mt-1">✨ ${runStats.stardustEarned} earned · ${mm}:${ss} flight time · ${runStats.skips} skips</p>` where `const el = Math.max(0, performance.now() - runStats.startedAt); const mm = Math.floor(el / 60000); const ss = String(Math.floor(el / 1000) % 60).padStart(2, '0');`.

**ui/overlays.ts `upgradeListHtml()`:** group duplicate ids — build a `Map<UpgradeId, number>`, render each unique upgrade once with `×${n}` appended when `n > 1`. Keep existing styling/markup shape otherwise.

**main.ts leaderboard filter:** add module-scope `let lbFilter: 'all' | Difficulty = 'all';`. In `showLeaderboard()`, add a row of four buttons above the list: `data-lb-filter="all|cadet|pilot|ace"`, mono text-xs, active one underlined/ink, others muted. Extract the row-rendering into `renderLbRows(rows: ScoreRow[])` writing into `[data-lb-list]`, filtering `lbFilter === 'all' ? rows : rows.filter((r) => r.difficulty === lbFilter)` then slicing 25; empty-after-filter message: `No ${lbFilter} scores yet.`. Wire the buttons inside `showLeaderboard()` via direct listeners (the overlay delegate only handles `data-action|data-diff|data-shop` — do not extend it): on click set `lbFilter`, restyle buttons, re-call `renderLbRows`. Client-side only (I3).

---

## 4. Verification & delivery

### 4.1 Automated

1. `npx tsc --noEmit` — zero errors.
2. `npx vitest run` — all existing suites pass (update only assertions that pin values this plan intentionally changed: Star Forge exponent, level caps).
3. New unit tests in `src/scripts/lander/__tests__/levels-v11.test.ts`:
   - `levelConfigFor(9, 'pilot').surge === true`, `levelConfigFor(10, 'pilot').surge === false`, level 0 not surge.
   - `projSpeed` at idx 0 === 130; monotonically non-decreasing over idx 0–60; ≤ 130 × 1.8 × 1.15.
   - Determinism: two `levelConfigFor(23, 'ace')` calls deep-equal.
   - `generateCanisters` for idx < 3 returns []; for idx 5 across seeds, every canister x outside the pad corridor and y ≥ 40.
   - `generateTerrain` bonus pad, when present, satisfies `|center − padCenter| > width * 0.28` and lies within bounds (probe several idx values; skip-if-absent per level is fine — assert only over levels where it generated).
4. `npx astro build` — zero errors.

### 4.2 Manual smoke (dev server, background mode per project CLAUDE.md: `astro dev --background`)

Load `/game`, then: start a run; press Escape mid-flight (pause overlay, frozen scene); P to resume; click ⏸ button; hide/reshow the tab (auto-pauses); confirm speed readout changes color as speed crosses tolerance; land, confirm the picker shows an `owned ×n` badge after picking a dupe; confirm crash screen shows the summary line; open leaderboard, click filters. Stop the server with `astro dev stop`.

### 4.3 Deploy

Commit sequence as specified, push to GitHub, wait for Netlify auto-deploy, then **curl-verify live** (memory: site broke silently on 2026-07-02): `curl -sI https://radiant-ganache-56c528.netlify.app/` and `/game` → both HTTP 200, and `curl -s .../game | grep -c lander` > 0. If 404: check the deploy permalink first (known root cause: Netlify dashboard build settings, not caching).

---

## 5. Self-review & steelman resolutions (appendix)

Issues raised in review of this plan, and their dispositions:

1. **"Pause should also pause the upgrade countdown."** Steelman upheld the original: the 20s pick timer is a design pressure and its wall-clock deadline math would need reworking. Not pausable; documented in Commit 2.
2. **"Wind indicator double-counts windMult"** (from the design review). Rejected after reading `physics.ts` — `currentWind()` never applies `windMult`; display is correct. Removed from scope.
3. **"Canister count should come from `levelConfigFor` for a single source of truth."** Rejected: inserting an `r()` call there would shift every subsequent roll and silently re-randomize all existing levels (violates I7). Canisters use an isolated seed.
4. **"Bonus pad on moving-pad/canyon levels too."** Rejected: moving-pad corridors and canyon floors make two flat zones collide with the flatten/blend logic; the 0.35 roll on the remaining ~majority of levels is enough variety for the complexity budget. Fallback (no candidates → no pad) is explicit.
5. **"`stardustAdd` counting achievement bonuses toward `stardustEarned` inflates the run summary."** Defense upheld: it IS stardust earned during the run, the one-rule implementation has no per-site drift risk, and the alternative (a flag per call site) is complexity disproportionate to a cosmetic stat.
6. **"Surge floors force UFOs before the idx ≥ 8 unlock."** Fixed in Commit 5: the surge UFO floor applies only when `idx >= 8` (level-10 surge keeps UFOs since 10 > 8; the rule guards hypothetical future renumbering).
7. **`pauseGame` referencing `lastT`/`accumulator` declared later in the file.** Verified safe (`let` + calls only post-init) and noted inline so the executor doesn't "fix" it by reordering.
8. **Second pass after fixes:** no new issues; ambiguity scan clean — every file, function, constant, seed, and fallback is named explicitly.
