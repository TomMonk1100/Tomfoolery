/**
 * PixelArt — procedural pixel-art pipeline (CONTRACT + implementation home).
 *
 * OWNERSHIP: Worker A implements this module and authors all sprite data in
 * src/gfx/sprites/*.ts. Other workers must ONLY:
 *   - reference frame keys via SPRITE_KEYS / frameKey()
 *   - call playAnim() on sprites they create
 * and must render a plain fallback shape when `scene.textures.exists(key)`
 * is false, so they run standalone before the atlas lands.
 *
 * DESIGN (frozen):
 * - Sprites are authored as string-array pixel maps: each frame is string[]
 *   (rows), each char is a palette entry, "." = transparent.
 * - Sizes: small enemies/items 16x16, animals/medium enemies 24x24,
 *   large 32x32, bosses 48x48, tiles 32x32, icons 16x16.
 * - buildAtlas() draws every registered frame to canvas textures at
 *   PIXEL_SCALE=3 with nearest-neighbor (no smoothing), registers Phaser
 *   textures named `${key}_${frameIndex}` and Phaser animations named
 *   `${key}:${animName}`.
 *
 * DECISIONS:
 * - All pure data/types/registry live in ./spriteRegistry.ts (zero Phaser
 *   imports) so tests/sprites.test.ts can import sprite data without pulling
 *   in Phaser. This file re-exports everything from there so existing
 *   `import { X } from "../gfx/PixelArt"` call sites are unaffected, and adds
 *   only the Phaser-dependent buildAtlas()/playAnim().
 * - "malformed def" guard covers: empty frames array, rows of unequal
 *   length (within or across frames), and any non-"." char missing from the
 *   def's palette. On any violation the whole sprite def is skipped (no
 *   textures, no anims) with a console.warn, never a throw.
 * - AnimDef frame indices that are out of range for a given def are skipped
 *   individually (warn + drop that frame index) rather than discarding the
 *   whole animation, so a single bad index doesn't lose idle/walk/etc.
 */
import Phaser from "phaser";
import type { PixelSpriteDef } from "./spriteRegistry";
import { frameKey, animKey, getRegisteredSprites, PIXEL_SCALE } from "./spriteRegistry";

export {
  PIXEL_SCALE,
  frameKey,
  animKey,
  registerSprite,
  getRegisteredSprites,
  SPRITE_KEYS,
  iconKey,
  PALETTE,
} from "./spriteRegistry";
export type { Palette, AnimDef, PixelSpriteDef } from "./spriteRegistry";

/** Returns null (and warns) if the def is malformed; otherwise the frame dims. */
function validateDef(def: PixelSpriteDef): { w: number; h: number } | null {
  if (!def.frames || def.frames.length === 0) {
    console.warn(`PixelArt: sprite "${def.key}" has no frames, skipping`);
    return null;
  }
  const first = def.frames[0];
  if (!first || first.length === 0) {
    console.warn(`PixelArt: sprite "${def.key}" frame 0 is empty, skipping`);
    return null;
  }
  const h = first.length;
  const w = first[0].length;
  for (let f = 0; f < def.frames.length; f++) {
    const frame = def.frames[f];
    if (frame.length !== h) {
      console.warn(
        `PixelArt: sprite "${def.key}" frame ${f} has ${frame.length} rows, expected ${h}, skipping sprite`
      );
      return null;
    }
    for (let r = 0; r < frame.length; r++) {
      if (frame[r].length !== w) {
        console.warn(
          `PixelArt: sprite "${def.key}" frame ${f} row ${r} has width ${frame[r].length}, expected ${w}, skipping sprite`
        );
        return null;
      }
      for (const ch of frame[r]) {
        if (ch === ".") continue;
        if (!(ch in def.palette)) {
          console.warn(
            `PixelArt: sprite "${def.key}" frame ${f} uses unknown palette char "${ch}", skipping sprite`
          );
          return null;
        }
      }
    }
  }
  return { w, h };
}

function renderFrameCanvas(
  frame: string[],
  palette: Record<string, string>,
  w: number,
  h: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w * PIXEL_SCALE;
  canvas.height = h * PIXEL_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < h; y++) {
    const row = frame[y];
    for (let x = 0; x < w; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * PIXEL_SCALE, y * PIXEL_SCALE, PIXEL_SCALE, PIXEL_SCALE);
    }
  }
  return canvas;
}

/**
 * Build all registered sprites into Phaser textures + animations.
 * Idempotent; safe to call once per scene boot. Implemented by Worker A.
 */
export function buildAtlas(scene: Phaser.Scene): void {
  for (const def of getRegisteredSprites().values()) {
    try {
      const dims = validateDef(def);
      if (!dims) continue;
      const { w, h } = dims;

      for (let i = 0; i < def.frames.length; i++) {
        const fk = frameKey(def.key, i);
        if (scene.textures.exists(fk)) continue;
        const canvas = renderFrameCanvas(def.frames[i], def.palette, w, h);
        const tex = scene.textures.addCanvas(fk, canvas);
        // Keep pixel art crisp under any display scaling.
        tex?.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }

      for (const [animName, animDef] of Object.entries(def.anims)) {
        const ak = animKey(def.key, animName);
        if (scene.anims.exists(ak)) continue;
        const validIndices = animDef.frames.filter((idx) => {
          const ok = idx >= 0 && idx < def.frames.length;
          if (!ok) {
            console.warn(
              `PixelArt: sprite "${def.key}" anim "${animName}" references invalid frame index ${idx}, dropping`
            );
          }
          return ok;
        });
        if (validIndices.length === 0) {
          console.warn(
            `PixelArt: sprite "${def.key}" anim "${animName}" has no valid frames, skipping anim`
          );
          continue;
        }
        scene.anims.create({
          key: ak,
          frames: validIndices.map((idx) => ({
            key: frameKey(def.key, idx),
          })),
          frameRate: animDef.frameRate,
          repeat: animDef.repeat,
        });
      }
    } catch (err) {
      console.warn(`PixelArt: failed to build sprite "${def.key}"`, err);
    }
  }
}

/**
 * Play a named animation on a sprite created from frameKey(key,0).
 * Must silently no-op if the animation doesn't exist.
 */
export function playAnim(
  sprite: Phaser.GameObjects.Sprite,
  key: string,
  anim: string
): void {
  const ak = animKey(key, anim);
  if (sprite.scene.anims.exists(ak)) sprite.play(ak, true);
}
