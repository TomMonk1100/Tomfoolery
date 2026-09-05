# Moon Lander 1.0 build status

Updated: 2026-09-05

## Current recovery state

The known playable legacy runtime is restored at `/game`. The Pixi replacement remains available at `/game-next` with an explicit development label; `/game-legacy` remains available for direct comparison. No deployment is being performed as part of this recovery pass.

### Recovery work completed locally

- P0: `/game` serves the legacy experience again; `/game-next` preserves the prototype; no legacy save namespace was deleted.
- P1: portrait and landscape layout profiles, viewport-aware sizing, compact mobile HUD/control zones, centered aspect-preserving background coverage, and a larger transform-aligned ship/plume are implemented in the prototype.
- P2: the prototype uses the legacy target-angular-velocity response, throttle ramp, gravity/thrust/wind mass-area coupling, fuel burn, boundary handling, moving-pad relative velocity, and legacy landing authority.
- P3 foundation: start/new/retry/pause/settings transitions, checkpoint clearing, profile/cosmetic/achievement/audio/touch migration, keyboard focus filtering, multi-pointer ownership, listener cleanup, weighted stackable offers, and live landing guidance are implemented.
- Regression fixtures now cover recovery-specific geometry, steering, profile/checkpoint persistence, collision, landing, generation, and deterministic offers.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` | 247 passed / 23 files | Existing suite plus recovery fixtures |
| `npm run typecheck` | pass | Astro sync plus TypeScript |
| `npm run build` | pass | 48 static routes, including `/game`, `/game-legacy`, and `/game-next` |
| Pixi install | pass | `pixi.js@8.14.0` in package and lockfile |
| Generated art | present | First Light source, manifest, runtime copy |
| Browser/device matrix | not run in this pass | Physical phone/laptop interaction and screenshot measurements remain required |
| Performance budgets | not measured | No fabricated benchmark claim |
| WebGPU experiment | deferred | WebGL is the documented production path |
| 69-upgrade behavioral parity | in progress | Catalog remains intact; effect-family migration needs focused tests and wiring |

## Known limitations / next work

- `/game-next` is not a release candidate: its renderer is still a compact vector presentation and not the full legacy visual/cosmetic treatment.
- The prototype now moves pads and collides with generated hazards, but not every legacy active ability, companion, projectile, noodle, survival, and terrain-effect system is migrated into it yet.
- The prototype hangar and flight-school routes remain summaries/development content; the fully featured legacy hangar, achievements, touch layouts, leaderboard, and selfie remain on `/game`.
- Direct browser/device measurements, performance budgets, visual screenshot fixtures, and user handling review remain P1/P5/P6 gates.
- Leaderboard calls remain on the legacy route; a version-separated new-ruleset endpoint still needs implementation before public cutover.
- Controller mapping, real-device touch QA, visual screenshot fixtures, load/frame/memory measurements, and five-player usability review remain release gates.

## Rollback

Use `/game` for the stable legacy experience. Use `/game-next` for prototype comparison and `/game-legacy` as the preserved legacy copy. Do not delete the new runtime or asset sources while iterating.
