/**
 * Sprite registration entry point. Importing this module (or any of its
 * four sub-modules) triggers module-scope `registerSprite()` calls as a
 * side effect. `registerAllSprites()` is provided for callers who want an
 * explicit, idempotent registration step (e.g. BootScene) rather than
 * relying purely on import side effects.
 *
 * DECISIONS:
 * - registerSprite() (spriteRegistry.ts) already writes into a Map keyed by
 *   sprite key, so re-registering the same key is naturally idempotent
 *   (last write wins, no duplicate/throw). We still guard with a module
 *   flag so repeated calls are a documented no-op rather than relying only
 *   on that incidental Map behavior.
 */
import "./animals";
import "./enemies";
import "./world";
import "./ui";

let registered = false;

/** Idempotent; safe to call multiple times (e.g. from multiple scenes). */
export function registerAllSprites(): void {
  if (registered) return;
  // The imports above already ran their module-scope registerSprite() calls
  // exactly once (ES module semantics guarantee each module body executes
  // at most once), so there is nothing further to do here beyond marking
  // this function itself idempotent for callers that invoke it repeatedly.
  registered = true;
}
