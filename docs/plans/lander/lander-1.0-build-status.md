# Moon Lander 1.0 build status

Updated: 2026-09-05

## Current release-candidate state

The new runtime is cut over to `/game`; `/game-legacy` preserves the prior Canvas2D experience for rollback and comparison. Deployment is intentionally not performed because the rebuild plan says to wait for an explicit deployment instruction.

### Completed in this pass

- M0 baseline: working-tree inspection, current behavioral reference retained, 238 legacy tests passing, typecheck passing.
- M1 runtime: `src/scripts/lander-next/` isolated from DOM/Pixi in simulation modules; 120 Hz fixed clock, explicit state machine, fixed 1000×620 world, deterministic named RNG streams, swept terrain collision, landing evaluator, resize-safe presentation mapping, keyboard and pointer controls, pause/blur recovery.
- M2 vertical slice: PixiJS 8.14.0 pinned with WebGL preference, animated ship/pad/hazard/plume composition, First Light art plate, HUD and untimed upgrade cards for the existing catalog.
- M6 continuity slice: validated `lander-profile-v1`, idempotent legacy import, checkpoint envelope, title/continue, training, hangar summary, settings entry, crash diagnosis, retry, and renderer failure screen.
- M7 rollback: `/game-legacy` remains available and no score endpoint or legacy persistence keys were removed.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` baseline | 238 passed / 19 files | Existing suite before new tests |
| `npm run typecheck` | pass | Astro sync plus TypeScript |
| Pixi install | pass | `pixi.js@8.14.0` in package and lockfile |
| Generated art | present | First Light source, manifest, runtime copy |
| Browser/device matrix | not run | Requires explicit browser/device QA pass |
| Performance budgets | not measured | No fabricated benchmark claim |
| WebGPU experiment | deferred | WebGL is the documented production path |
| 69-upgrade behavioral parity | in progress | Catalog remains intact; effect-family migration needs focused tests and wiring |

## Known limitations / next work

- The new renderer currently uses a compact Pixi vector ship and hazards over the finished First Light background. Rust Basin and Blue Rift still need their final art bundles.
- The new simulation reuses the legacy stat derivation as a compatibility authority, but not every legacy active ability, companion, projectile, noodle, and terrain-effect system is migrated into the new runtime yet.
- Leaderboard calls remain on the legacy route; a version-separated new-ruleset endpoint still needs implementation before public cutover.
- Controller mapping, real-device touch QA, visual screenshot fixtures, load/frame/memory measurements, and five-player usability review remain release gates.

## Rollback

Use `/game-legacy` for the legacy experience while keeping the new `/game` source intact. To revert the public route, restore the prior `src/pages/game.astro` from Git history in a focused change; do not delete the new runtime or asset sources.
