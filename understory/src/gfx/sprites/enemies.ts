/**
 * Enemy, boss, companion, projectile, and fx sprites.
 *
 * DECISIONS:
 * - "fxDust" has no explicit size in CONTRACTS.md/PixelArt.ts comments; since
 *   it accompanies footstep/impact effects like other unlisted-size fx and
 *   pickups default to 16, treat it as 16x16 (small, transient).
 * - Slimes get squash-and-stretch across their `move` anim frames per
 *   CONTRACTS.md; `death` is a 2-3f squish/poof.
 * - Boss sprites are 48x48 "crowned/elaborated" versions of their base
 *   silhouette (bigger, with a gold crown/spike accent) rather than wholly
 *   new designs, to keep them instantly readable as "big versions of X".
 * - Companion sparrow/squirrel get idle/walk/attack per CONTRACTS.md (16x16,
 *   simple silhouettes distinct from enemies at a glance).
 * - `pad(rows, w)` normalizes hand-authored rows to exact width w by
 *   right-padding with "." or throwing away nothing (rows must already be
 *   <= w); this keeps frame authoring readable while guaranteeing the
 *   uniform-width invariant PixelArt.buildAtlas requires.
 */
import { registerSprite, SPRITE_KEYS, PALETTE, type PixelSpriteDef } from "../spriteRegistry";

const P = PALETTE;

/**
 * Normalize a hand-authored pixel grid to exactly w columns and (if given)
 * h rows: rows are right-padded/truncated to width w; row count is
 * truncated/padded with blank rows to height h. Prevents a miscounted row
 * (easy to do by hand) from shipping as a width/height-mismatched def.
 */
function pad(rows: string[], w: number, h: number = rows.length): string[] {
  const widthFixed = rows.map((r) => (r.length >= w ? r.slice(0, w) : r + ".".repeat(w - r.length)));
  if (widthFixed.length === h) return widthFixed;
  if (widthFixed.length > h) return widthFixed.slice(0, h);
  const blank = ".".repeat(w);
  return [...widthFixed, ...Array.from({ length: h - widthFixed.length }, () => blank)];
}

// ===========================================================================
// SLIMES (green 16x16 chaser, red 16x16 lunger, blue 24x24 splitter)
// Glossy blobs with two eyes; move anim = squash <-> stretch; death = poof.
// ===========================================================================
function slimeFrames16(g: string, h: string): string[][] {
  const idle = pad(
    [
      "................",
      "................",
      "....oooooo......",
      "...ohhgggo......",
      "..oghwkgwko.....",
      "..ogggggggo.....",
      ".ogggggggggo....",
      ".ogggggggggo....",
      ".ogggggggggo....",
      "..oggggggggo....",
      "..oggggggggo....",
      "...oooooooo.....",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  const wide = pad(
    [
      "................",
      "................",
      "................",
      "...oooooooooo...",
      "..ohhggggggggo..",
      ".ogwkgggggwkgo..",
      ".ogggggggggggo..",
      ".oggggggggggggo.",
      "..ogggggggggggo.",
      "...oooooooooo...",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  const tall = pad(
    [
      "................",
      "....oooooo......",
      "...ohhgggo......",
      "...ogwkgo.......",
      "...ogggggo......",
      "...ogggggo......",
      "...ogggggo......",
      "...ogggggo......",
      "...ogggggo......",
      "...ogggggo......",
      "....oooooo......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  const poofA = pad(
    [
      "................",
      "................",
      "...o......o.....",
      "..ogo....ogo....",
      "....o.oo.o......",
      "......gg........",
      "....o.gg.o......",
      "...ogo..ogo.....",
      "..og......go....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  const poofB = pad(
    [
      "................",
      "................",
      "................",
      "..o..........o..",
      "................",
      "...o........o...",
      "................",
      "......o..o......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  return [idle, wide, tall, poofA, poofB];
}

const slimeGreenPalette = {
  o: P.outline,
  g: P.slime,
  h: "#8fe88f",
  k: P.outline,
  w: P.white,
};
registerSprite({
  key: SPRITE_KEYS.slimeGreen,
  palette: slimeGreenPalette,
  frames: slimeFrames16("g", "h"),
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [1, 2], frameRate: 6, repeat: -1 },
    death: { frames: [3, 4], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

const slimeRedPalette = {
  o: P.outline,
  g: P.danger,
  h: "#f0a0a0",
  k: P.outline,
  w: P.white,
};
registerSprite({
  key: SPRITE_KEYS.slimeRed,
  palette: slimeRedPalette,
  frames: slimeFrames16("g", "h"),
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [0, 2], frameRate: 10, repeat: -1 }, // lunger: sharper alternation
    death: { frames: [3, 4], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

function slimeFrames24(): string[][] {
  const idle = pad(
    [
      "........................",
      "........................",
      "........................",
      ".......oooooooooo.......",
      "......ohhggggggggo......",
      ".....ogwkgggggwkgo......",
      ".....ogggggggggggo......",
      "....ogggggggggggggo.....",
      "....ogggggggggggggo.....",
      "....ogggggggggggggo.....",
      "....ogggggggggggggo.....",
      ".....ogggggggggggo......",
      ".....ogggggggggggo......",
      "......oooooooooooo......",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  const wide = pad(
    [
      "........................",
      "........................",
      "........................",
      "........................",
      ".....oooooooooooooo.....",
      "....ohhgggggggggggo.....",
      "....ogwkgggggggwkgo.....",
      "...ogggggggggggggggo....",
      "...ogggggggggggggggo....",
      "....oggggggggggggggo....",
      ".....oooooooooooooo.....",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  const tall = pad(
    [
      "........................",
      "........................",
      "........oooooooo........",
      ".......ohhgggggo........",
      ".......ogwkgwko.........",
      ".......ogggggggo........",
      ".......ogggggggo........",
      ".......ogggggggo........",
      ".......ogggggggo........",
      ".......ogggggggo........",
      ".......ogggggggo........",
      ".......ogggggggo........",
      "........oooooooo........",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  const poofA = pad(
    [
      "........................",
      "........................",
      "......o........o.......",
      ".....ogo......ogo.......",
      "........oo..oo..........",
      ".........gggg...........",
      ".......o..gg..o.........",
      "......ogo....ogo........",
      ".....og........go.......",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  const poofB = pad(
    [
      "........................",
      "........................",
      "........................",
      "....o..............o....",
      "........................",
      "......o..........o......",
      "........................",
      "..........o..o..........",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  return [idle, wide, tall, poofA, poofB];
}

const slimeBluePalette = {
  o: P.outline,
  g: P.waterLight,
  h: "#bfe3f5",
  k: P.outline,
  w: P.white,
};
registerSprite({
  key: SPRITE_KEYS.slimeBlue,
  palette: slimeBluePalette,
  frames: slimeFrames24(),
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [1, 2], frameRate: 5, repeat: -1 },
    death: { frames: [3, 4], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// GLOOMCAP (24x24 shooter) — purple mushroom with a spotted cap and stalk.
// ===========================================================================
const gloomcapPalette = {
  o: P.outline,
  m: P.purple,
  d: "#5f3f7f", // cap shadow
  s: P.cream, // stalk
  w: P.white, // spots
  k: P.outline, // eyes
  y: "#e8b23d", // glow spore accent
};
function gloomcapFrame(capPhase: 0 | 1, spore = false): string[] {
  const rows = pad(
    [
      "........................",
      "........................",
      ".......dmmmmmmmmd.......",
      "......dmmmmmmmmmmd......",
      ".....mmmwmmmmwmmmmm.....",
      "....mmmmmmmmmmmmmmmm....",
      "....mmmwmmmmmmmwmmmm....",
      "....mmmmmmmmmmmmmmmm....",
      ".....mmmmmmmmmmmmmm.....",
      "......oooooooooooo......",
      ".......sskssssssoo......",
      ".......ssssssssss.......",
      "........ssssssss........",
      "........ssssssss........",
      "........ss....ss........",
      "........ss....ss........",
      "........oo....oo........",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  if (capPhase === 1) {
    // cap "breathes" — shrink shadow row slightly (idle bob)
    rows[2] = pad(["........mmmmmmmmm......."], 24)[0];
  }
  if (spore) {
    rows[6] = pad(["....mmmyyymmmmmyyymmm..."], 24)[0];
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.gloomcap,
  palette: gloomcapPalette,
  frames: [gloomcapFrame(0), gloomcapFrame(1), gloomcapFrame(0, true), gloomcapFrame(1, true)],
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [0, 1], frameRate: 3, repeat: -1 },
    death: { frames: [2, 3], frameRate: 6, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// THORN CRAWLER (24x24 charger) — segmented bramble body with thorn spikes.
// ===========================================================================
const thornPalette = {
  o: P.outline,
  b: P.grassDark,
  l: P.leaf,
  t: P.darkBrown, // thorns
  k: P.outline,
  w: P.white,
};
function thornFrame(segShift: 0 | 1 | 2): string[] {
  const rows = pad(
    [
      "........................",
      "........................",
      "........................",
      "...t..t..t..t..t..t.....",
      "..oobbbboobbbboobbbo....",
      ".otbbbbbbbbbbbbbbbbto...",
      ".obblbbbwkbblbbbwkblo...",
      ".obbbbbbbbbbbbbbbbbbo...",
      ".otbbbbbbbbbbbbbbbbto...",
      "..obbllbbbbllbbbllbo....",
      "...obbbbbbbbbbbbbbo.....",
      "...t..t..t..t..t..t.....",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  if (segShift === 1) {
    // shift thorn row markers to suggest crawling motion
    rows[3] = pad(["....t..t..t..t..t..t...."], 24)[0];
    rows[11] = pad(["....t..t..t..t..t..t...."], 24)[0];
  } else if (segShift === 2) {
    rows[3] = pad(["..t..t..t..t..t..t......"], 24)[0];
    rows[11] = pad(["..t..t..t..t..t..t......"], 24)[0];
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.thornCrawler,
  palette: thornPalette,
  frames: [thornFrame(0), thornFrame(1), thornFrame(2), thornFrame(0)],
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [0, 1, 2, 1], frameRate: 8, repeat: -1 },
    death: { frames: [3, 0], frameRate: 4, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// WISP (16x16 drifter) — wavering flame with a small face.
// ===========================================================================
const wispPalette = {
  o: P.outline,
  y: P.gold,
  r: P.danger,
  w: P.white,
  k: P.outline,
};
function wispFrame(lean: 0 | 1 | 2, dim = false): string[] {
  const flameChar = dim ? "r" : "y";
  const rows = pad(
    [
      "................",
      ".......oo.......",
      "......oyyo......",
      ".....oyyyyo.....",
      ".....oyrryo.....",
      "....oyyrryyo....",
      "....oywkwkyo....",
      "....oyyyyyyo....",
      ".....oyyyyo.....",
      ".....oyyyyo......",
      "......oyyo......",
      ".......oo.......",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  if (lean === 1) {
    rows[1] = pad([".......ooo......"], 16)[0];
    rows[2] = pad(["......oyyyo....."], 16)[0];
  } else if (lean === 2) {
    rows[1] = pad(["......ooo......."], 16)[0];
    rows[2] = pad([".....oyyyo......"], 16)[0];
  }
  void flameChar;
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.wisp,
  palette: wispPalette,
  frames: [wispFrame(0), wispFrame(1), wispFrame(2), wispFrame(0, true)],
  anims: {
    idle: { frames: [0, 1], frameRate: 4, repeat: -1 },
    move: { frames: [1, 0, 2, 0], frameRate: 6, repeat: -1 },
    death: { frames: [3, 0], frameRate: 5, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// MUDMAW (24x24 ambusher) — open earthen jaw bursting from the ground.
// ===========================================================================
const mudmawPalette = {
  o: P.outline,
  b: P.darkBrown,
  d: "#2f2318", // deep shadow
  t: P.cream, // teeth
  r: P.danger, // throat
  w: P.white,
};
function mudmawFrame(jaw: 0 | 1 | 2): string[] {
  const openness = jaw; // 0 closed-ish, 1 mid, 2 wide
  const rows = pad(
    [
      "........................",
      "........................",
      "........................",
      "..bbbbbbbbbbbbbbbbbb....",
      ".bddddddddddddddddddb...",
      ".bdtttttttttttttttdb....",
      ".bdt..............tdb...",
      ".bdt..rrrrrrrrrr..tdb...",
      ".bdt..rrrrrrrrrr..tdb...",
      ".bdt..............tdb...",
      ".bdtttttttttttttttdb....",
      ".bddddddddddddddddddb...",
      "..bbbbbbbbbbbbbbbbbb....",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
      "........................",
    ],
    24,
    24
  );
  if (openness === 0) {
    // closed: collapse the throat rows
    rows[7] = pad([".bdt..tttttttt....tdb..."], 24)[0];
    rows[8] = pad([".bdt..............tdb..."], 24)[0];
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.mudmaw,
  palette: mudmawPalette,
  frames: [mudmawFrame(0), mudmawFrame(1), mudmawFrame(2), mudmawFrame(1)],
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [0, 1, 2, 1], frameRate: 5, repeat: -1 },
    death: { frames: [0, 0], frameRate: 3, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// BOSSES (48x48) — bigger, crowned/elaborated versions of a base silhouette.
// ===========================================================================
function scaleUpBlockPattern(frame16: string[], scale: number, targetSize: number): string[] {
  // Nearest-neighbor upscale a small pattern into a targetSize x targetSize
  // grid, centered, then let caller add crown/accents.
  const srcSize = frame16.length;
  const out: string[] = Array.from({ length: targetSize }, () => ".".repeat(targetSize));
  const outRows = out.map((r) => r.split(""));
  const offset = Math.floor((targetSize - srcSize * scale) / 2);
  for (let y = 0; y < srcSize; y++) {
    for (let x = 0; x < srcSize; x++) {
      const ch = frame16[y][x];
      if (ch === ".") continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const ty = offset + y * scale + sy;
          const tx = offset + x * scale + sx;
          if (ty >= 0 && ty < targetSize && tx >= 0 && tx < targetSize) {
            outRows[ty][tx] = ch;
          }
        }
      }
    }
  }
  return outRows.map((r) => r.join(""));
}

function addCrown(rows: string[], topRow: number, leftCol: number, width: number): string[] {
  const out = rows.map((r) => r.split(""));
  // simple 3-spike crown using 'c' (must be added to caller's palette)
  const spikeCols = [leftCol, leftCol + Math.floor(width / 2), leftCol + width - 1];
  for (const col of spikeCols) {
    if (topRow >= 0 && col >= 0 && col < out[0].length) out[topRow][col] = "c";
    if (topRow + 1 >= 0 && col >= 0 && col < out[0].length) out[topRow + 1][col] = "c";
  }
  if (topRow + 1 < out.length) {
    for (let x = leftCol; x < leftCol + width; x++) {
      if (x >= 0 && x < out[0].length) out[topRow + 1][x] = "c";
    }
  }
  return out.map((r) => r.join(""));
}

// King Slime — scaled-up green slime + gold crown.
const bossKingSlimePalette = { ...slimeGreenPalette, c: P.gold };
function kingSlimeFrame(idx: 0 | 1 | 2 | 3 | 4): string[] {
  const base = slimeFrames16("g", "h")[idx];
  const big = scaleUpBlockPattern(base, 3, 48);
  return idx < 3 ? addCrown(big, 6, 16, 16) : big;
}
registerSprite({
  key: SPRITE_KEYS.bossKingSlime,
  palette: bossKingSlimePalette,
  frames: [kingSlimeFrame(0), kingSlimeFrame(1), kingSlimeFrame(2), kingSlimeFrame(3), kingSlimeFrame(4)],
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [1, 2], frameRate: 4, repeat: -1 },
    death: { frames: [3, 4], frameRate: 6, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// Elder Gloomcap — scaled-up gloomcap + crown of spore spikes.
const bossElderGloomcapPalette = { ...gloomcapPalette, c: P.gold };
function elderGloomcapFrame(idx: 0 | 1 | 2 | 3): string[] {
  const base24 = [gloomcapFrame(0), gloomcapFrame(1), gloomcapFrame(0, true), gloomcapFrame(1, true)][idx];
  const big = scaleUpBlockPattern(base24, 2, 48);
  return idx < 2 ? addCrown(big, 2, 14, 20) : big;
}
registerSprite({
  key: SPRITE_KEYS.bossElderGloomcap,
  palette: bossElderGloomcapPalette,
  frames: [elderGloomcapFrame(0), elderGloomcapFrame(1), elderGloomcapFrame(2), elderGloomcapFrame(3)],
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [0, 1], frameRate: 3, repeat: -1 },
    death: { frames: [2, 3], frameRate: 5, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// Bramble Tyrant — scaled-up thorn crawler + crown of extra thorns.
const bossBrambleTyrantPalette = { ...thornPalette, c: P.gold };
function brambleTyrantFrame(idx: 0 | 1 | 2 | 3): string[] {
  const base24 = [thornFrame(0), thornFrame(1), thornFrame(2), thornFrame(0)][idx];
  const big = scaleUpBlockPattern(base24, 2, 48);
  return idx < 3 ? addCrown(big, 4, 14, 20) : big;
}
registerSprite({
  key: SPRITE_KEYS.bossBrambleTyrant,
  palette: bossBrambleTyrantPalette,
  frames: [brambleTyrantFrame(0), brambleTyrantFrame(1), brambleTyrantFrame(2), brambleTyrantFrame(3)],
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    move: { frames: [0, 1, 2, 1], frameRate: 6, repeat: -1 },
    death: { frames: [3, 0], frameRate: 4, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// The Long Dark — scaled-up wisp (final boss), doubled flame + crown embers.
const bossLongDarkPalette = { ...wispPalette, c: P.purple };
function longDarkFrame(idx: 0 | 1 | 2 | 3): string[] {
  const base16 = [wispFrame(0), wispFrame(1), wispFrame(2), wispFrame(0, true)][idx];
  const big = scaleUpBlockPattern(base16, 3, 48);
  return idx < 3 ? addCrown(big, 2, 16, 16) : big;
}
registerSprite({
  key: SPRITE_KEYS.bossLongDark,
  palette: bossLongDarkPalette,
  frames: [longDarkFrame(0), longDarkFrame(1), longDarkFrame(2), longDarkFrame(3)],
  anims: {
    idle: { frames: [0, 1], frameRate: 4, repeat: -1 },
    move: { frames: [1, 0, 2, 0], frameRate: 6, repeat: -1 },
    death: { frames: [3, 0], frameRate: 5, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// COMPANIONS (16x16) — sparrow (small flitting bird), squirrel (bushy tail).
// ===========================================================================
const sparrowPalette = {
  o: P.outline,
  b: P.brown,
  c: P.cream,
  w: P.white,
  k: P.outline,
  y: P.gold,
};
function sparrowFrame(wingUp: boolean, peck = false): string[] {
  const rows = pad(
    [
      "................",
      "................",
      "......obbo......",
      ".....obwkbo.....",
      "....obbbbbbo....",
      "...obbbbbbbboo..",
      "..occbbbbbboo...",
      "..occbbbbbo.....",
      "...occcbbo......",
      "....occboo......",
      ".....oyo........",
      ".....oyo........",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  if (wingUp) {
    rows[5] = pad(["..obbbboboo....."], 16)[0];
    rows[6] = pad([".occbbo..oo....."], 16)[0];
  }
  if (peck) {
    rows[3] = pad([".....obwkboo...."], 16)[0];
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.companionSparrow,
  palette: sparrowPalette,
  frames: [sparrowFrame(false), sparrowFrame(true), sparrowFrame(false, true), sparrowFrame(true, true)],
  anims: {
    idle: { frames: [0, 1], frameRate: 4, repeat: -1 },
    walk: { frames: [0, 1, 0, 1], frameRate: 8, repeat: -1 },
    attack: { frames: [2, 3], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

const squirrelPalette = {
  o: P.outline,
  b: P.brown,
  d: P.darkBrown,
  c: P.cream,
  w: P.white,
  k: P.outline,
};
function squirrelFrame(tailUp: boolean, nibble = false): string[] {
  const rows = pad(
    [
      "................",
      "..oo............",
      ".obbo...ooo.....",
      "obbbbo.obbbo....",
      "obwkbbobbbbbo...",
      ".obbbbbbbbbbo...",
      "..obccbbbbbbo...",
      "..obccbbbbbo....",
      "...obbbbbo......",
      "....oo.oo.......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  );
  if (tailUp) {
    for (let x = 7; x <= 11; x++) rows[2] = rows[2]; // keep row (tail already up in base)
    rows[1] = pad(["..oo....ooo....."], 16)[0];
  }
  if (nibble) {
    rows[4] = pad(["obwkbbobbbcbo..."], 16)[0];
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.companionSquirrel,
  palette: squirrelPalette,
  frames: [squirrelFrame(false), squirrelFrame(true), squirrelFrame(false, true), squirrelFrame(true, true)],
  anims: {
    idle: { frames: [0, 1], frameRate: 3, repeat: -1 },
    walk: { frames: [0, 1, 0, 1], frameRate: 6, repeat: -1 },
    attack: { frames: [2, 3], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// PROJECTILES (16x16) — simple, readable silhouettes, single or 2-frame spin.
// ===========================================================================
function registerSimpleProjectile(
  key: string,
  palette: Record<string, string>,
  frameRows: string[][],
  spin = true
) {
  const frames = frameRows.map((r) => pad(r, 16));
  registerSprite({
    key,
    palette,
    frames,
    anims:
      frames.length > 1 && spin
        ? { spin: { frames: frames.map((_, i) => i), frameRate: 10, repeat: -1 } }
        : {},
  } satisfies PixelSpriteDef);
}

registerSimpleProjectile(
  SPRITE_KEYS.projStick,
  { o: P.outline, b: P.brown, d: P.darkBrown },
  [
    [
      "................",
      "................",
      "................",
      "..........oo....",
      ".........obdo...",
      "........obdo....",
      ".......obdo.....",
      "......obdo......",
      ".....obdo.......",
      "....obdo........",
      "...oo...........",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    [
      "................",
      "................",
      "......oo........",
      ".....obdo.......",
      "....obdo........",
      "...obdo.........",
      "..obdo..........",
      ".oo.............",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ]
);

registerSimpleProjectile(
  SPRITE_KEYS.projHairball,
  { o: P.outline, g: "#9a8f7a", h: "#c9c0ae" },
  [
    [
      "................",
      "................",
      "................",
      ".......oooo.....",
      "......ohggo.....",
      ".....ogghgo.....",
      ".....oggggo.....",
      ".....ohggo......",
      "......oooo......",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ],
  false
);

registerSimpleProjectile(
  SPRITE_KEYS.projCarrot,
  { o: P.outline, r: "#e8823d", l: P.leaf },
  [
    [
      "................",
      ".......ll.......",
      "......llll......",
      ".......ll.......",
      ".......oo.......",
      "......orro......",
      "......orro......",
      ".......oro......",
      ".......oro......",
      "........oro.....",
      "........oo......",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ],
  false
);

registerSimpleProjectile(
  SPRITE_KEYS.projGoo,
  { o: P.outline, g: P.slime, h: "#8fe88f" },
  [
    [
      "................",
      "................",
      "................",
      "......oooo......",
      ".....ohggo......",
      ".....ogggo......",
      "......oggo......",
      "......oo........",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    [
      "................",
      "................",
      "................",
      "......oooo......",
      ".....oggho......",
      ".....ogggo......",
      "......ogo.......",
      "......oo........",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ]
);

registerSimpleProjectile(
  SPRITE_KEYS.projSpore,
  { o: P.outline, p: P.purple, y: P.gold },
  [
    [
      "................",
      "................",
      "................",
      "......oooo......",
      ".....opyypo......".slice(0, 16),
      ".....oppppo.....",
      "......oppo......",
      "......oo........",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ],
  false
);

registerSimpleProjectile(
  SPRITE_KEYS.projClover,
  { o: P.outline, l: P.leaf, g: P.grass },
  [
    [
      "................",
      "................",
      ".....oo..oo.....",
      "....olgo.olgo...",
      ".....oo..oo.....",
      "......ooo.......",
      ".....oo.oo......",
      "....olgo.olgo...",
      ".....oo...oo....",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
  ],
  false
);

// ===========================================================================
// FX (32x32 rings/sweep/aura, 16x16 dust) — play-once or looping accents.
// ===========================================================================
function ring32(rMin: number, rMax: number, color: string): string[] {
  const size = 32;
  const cx = 15.5;
  const cy = 15.5;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      row += d >= rMin && d <= rMax ? color : ".";
    }
    rows.push(row);
  }
  return rows;
}

const barkRingPalette = { r: P.gold };
registerSprite({
  key: SPRITE_KEYS.fxBarkRing,
  palette: barkRingPalette,
  frames: [ring32(3, 5, "r"), ring32(7, 9, "r"), ring32(11, 13, "r"), ring32(14, 15.5, "r")],
  anims: {
    pulse: { frames: [0, 1, 2, 3], frameRate: 12, repeat: 0 },
  },
} satisfies PixelSpriteDef);

function sweepFrame(angleStartDeg: number, angleEndDeg: number): string[] {
  const size = 32;
  const cx = 15.5;
  const cy = 15.5;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ang < 0) ang += 360;
      const inArc = ang >= angleStartDeg && ang <= angleEndDeg;
      row += d <= 14 && d >= 4 && inArc ? "s" : ".";
    }
    rows.push(row);
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.fxSweep,
  palette: { s: P.white },
  frames: [sweepFrame(0, 40), sweepFrame(30, 90), sweepFrame(70, 140)],
  anims: {
    swing: { frames: [0, 1, 2], frameRate: 14, repeat: 0 },
  },
} satisfies PixelSpriteDef);

registerSprite({
  key: SPRITE_KEYS.fxQuakeRing,
  palette: { r: P.darkBrown },
  frames: [ring32(2, 4, "r"), ring32(6, 9, "r"), ring32(10, 13, "r"), ring32(13, 15.5, "r")],
  anims: {
    pulse: { frames: [0, 1, 2, 3], frameRate: 10, repeat: 0 },
  },
} satisfies PixelSpriteDef);

function dustFrame(spread: number): string[] {
  const rows = pad(
    [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  ).map((r) => r.split(""));
  const cx = 7;
  const cy = 8;
  const offsets = [
    [0, 0],
    [spread, 0],
    [-spread, 0],
    [0, spread],
    [0, -spread],
  ];
  for (const [ox, oy] of offsets) {
    const x = cx + ox;
    const y = cy + oy;
    if (y >= 0 && y < 16 && x >= 0 && x < 16) rows[y][x] = "d";
  }
  return rows.map((r) => r.join(""));
}
registerSprite({
  key: SPRITE_KEYS.fxDust,
  palette: { d: P.cream },
  frames: [dustFrame(1), dustFrame(2), dustFrame(3)],
  anims: {
    puff: { frames: [0, 1, 2], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

registerSprite({
  key: SPRITE_KEYS.fxAura,
  palette: { a: P.purple },
  frames: [ring32(10, 12, "a"), ring32(11, 13, "a"), ring32(12, 14, "a")],
  anims: {
    pulse: { frames: [0, 1, 2, 1], frameRate: 4, repeat: -1 },
  },
} satisfies PixelSpriteDef);

// Update 2 — scissor-kick: thin horizontal slash line through the sprite's
// center (rotated per-instance by WeaponSystem to match facing). 2 frames:
// a hairline, then a brighter/thicker flash for the "hit" beat.
function scissorLineFrame(thickness: number, color: string): string[] {
  const size = 32;
  const cy = 15.5;
  const rows: string[] = [];
  for (let y = 0; y < size; y++) {
    let row = "";
    for (let x = 0; x < size; x++) {
      row += Math.abs(y - cy) <= thickness ? color : ".";
    }
    rows.push(row);
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.fxScissor,
  palette: { s: P.white, h: P.gold },
  frames: [scissorLineFrame(0.6, "s"), scissorLineFrame(1.4, "h")],
  anims: {
    slash: { frames: [0, 1], frameRate: 20, repeat: 0 },
  },
} satisfies PixelSpriteDef);
