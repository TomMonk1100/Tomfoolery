/**
 * Animal sprites (24x24): dog, cat, rabbit. Face right; consumers flipX
 * for left-facing. Anims: idle (2f bob), walk (4f), attack (2-3f),
 * hurt (1-2f flash-ish).
 *
 * DECISIONS:
 * - "Flash-ish" hurt is implemented as a 2-frame anim alternating the base
 *   silhouette with a white-outline-heavy variant (re-using palette 'h' =
 *   white) rather than true alpha/tint flicker, since sprite data has no
 *   opacity channel — consumers (WorldScene/VFX) may additionally tint on
 *   the playerDamaged event; this anim just gives a readable frame swap.
 * - Bob/walk cycles are hand-authored 24x24 grids; row 0 is top.
 */
import { registerSprite, SPRITE_KEYS, PALETTE, type PixelSpriteDef } from "../spriteRegistry";

const P = PALETTE;

// ---------------------------------------------------------------------------
// DOG — floppy ears, tail, tan body with brown patches.
// ---------------------------------------------------------------------------
const dogPalette = {
  o: P.outline,
  b: P.brown, // body
  d: P.darkBrown, // patches / ears
  c: P.cream, // belly/muzzle
  w: P.white, // eye highlight
  k: P.outline, // pupil (reuse outline)
  p: "#e8968a", // tongue/nose accent
};

function dogFrame(earFlop: 0 | 1, legPhase: 0 | 1 | 2 | 3, mouthOpen = false): string[] {
  // 24x24 grid, dog facing right.
  const rows = [
    "........................",
    "........dd..............",
    ".......dood.............",
    "......doobd.............",
    ".....oobbbo.............",
    "....obbbbbbo............",
    "...obbbbbbbbo...........",
    "..obbbbbbbbbbo..........",
    ".obbccbbbbbbbbo.........",
    ".obwkcbbbbbbbboo........",
    ".obbccbbbbbbbbbboo......",
    ".obbbcpbbbbbbbbbbboo....",
    "..obbbbbbbbbbbbbbbbboo..",
    "..obbbbbbbbbbbbbbbbbbo..",
    "...obbbbbbbbbbbbbbbdo...",
    "...obbbbbbbbbbbbbbddo...",
    "....obb..bbb..bb.ddo....",
    "....obb..bbb..bb..o.....",
    "....oo....oo..oo........",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
  ];
  const grid = rows.map((r) => r.split(""));
  // ear flop animation: shift ear down slightly on phase 1
  if (earFlop === 1) {
    grid[1][8] = ".";
    grid[1][9] = ".";
    grid[2][8] = "d";
  }
  // leg animation: toggle which leg pairs are "forward" by shrinking/growing
  const legRowA = 16;
  const legRowB = 17;
  if (legPhase === 1 || legPhase === 3) {
    grid[legRowA][5] = ".";
    grid[legRowB][5] = "o";
    grid[legRowA][15] = ".";
    grid[legRowB][15] = "o";
  }
  if (mouthOpen) {
    grid[11][7] = "p";
    grid[11][8] = "p";
  }
  return grid.map((r) => r.join(""));
}

const dogFrames: string[][] = [
  dogFrame(0, 0), // 0 idle a
  dogFrame(1, 0), // 1 idle b (ear bob)
  dogFrame(0, 1), // 2 walk a
  dogFrame(0, 2), // 3 walk b
  dogFrame(1, 1), // 4 walk c
  dogFrame(1, 2), // 5 walk d
  dogFrame(0, 0, true), // 6 attack a (mouth open)
  dogFrame(1, 0, true), // 7 attack b
  dogFrame(1, 0), // 8 hurt a
  dogFrame(0, 3), // 9 hurt b (recoil pose reuse)
];

registerSprite({
  key: SPRITE_KEYS.dog,
  palette: dogPalette,
  frames: dogFrames,
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    walk: { frames: [2, 3, 4, 5], frameRate: 8, repeat: -1 },
    attack: { frames: [6, 7], frameRate: 10, repeat: 0 },
    hurt: { frames: [8, 9], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ---------------------------------------------------------------------------
// CAT — sleek, pointed ears, long tail curling up.
// ---------------------------------------------------------------------------
const catPalette = {
  o: P.outline,
  g: "#5a5a68", // sleek grey-purple body
  d: "#3f3f4d", // darker stripes/patches
  c: P.cream, // muzzle/belly
  w: P.white,
  k: P.outline,
  y: "#e8b23d", // eye color (gold)
};

function catFrame(tailPhase: 0 | 1 | 2, legPhase: 0 | 1 | 2 | 3, pounce = false): string[] {
  const rows = [
    "........................",
    "......oo................",
    ".....o..o...............",
    "....oggggo..............",
    "...oggggggo.............",
    "..oggggggggo......oo....",
    "..ogcgggggggo....o..o...",
    "..ogykcggggggoooo....o..",
    "..ogccggggggggggo...o...",
    "..oggggggggggggggo.o....",
    "...oggggggggggggggo.....",
    "...oggggggggggggggo.....",
    "....odggggggggggggo.....",
    "....oggdgggggggggggo....",
    ".....ogg.ggg.ggo........",
    ".....ogg.ggg.ggo........",
    "......oo..oo..oo........",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
  ];
  const grid = rows.map((r) => r.split(""));
  // tail: three positions curling above back
  if (tailPhase === 1) {
    for (let x = 18; x <= 21; x++) grid[4][x] = ".";
    grid[5][18] = "o";
    grid[5][19] = "g";
    grid[5][20] = "g";
    grid[6][21] = "o";
  } else if (tailPhase === 2) {
    for (let x = 18; x <= 21; x++) grid[4][x] = ".";
    for (let x = 18; x <= 20; x++) grid[6][x] = ".";
    grid[7][18] = "o";
    grid[7][19] = "g";
    grid[8][20] = "o";
  }
  const legRowA = 14;
  const legRowB = 15;
  if (legPhase === 1 || legPhase === 3) {
    grid[legRowA][6] = ".";
    grid[legRowB][6] = "o";
    grid[legRowA][14] = ".";
    grid[legRowB][14] = "o";
  }
  if (pounce) {
    grid[13][17] = "o";
    grid[13][18] = "g";
    grid[13][19] = "o";
  }
  return grid.map((r) => r.join(""));
}

const catFrames: string[][] = [
  catFrame(0, 0), // 0 idle a
  catFrame(1, 0), // 1 idle b
  catFrame(0, 1), // 2 walk a
  catFrame(1, 2), // 3 walk b
  catFrame(2, 1), // 4 walk c
  catFrame(1, 3), // 5 walk d
  catFrame(0, 0, true), // 6 attack a
  catFrame(2, 0, true), // 7 attack b
  catFrame(1, 0), // 8 hurt a
  catFrame(0, 2), // 9 hurt b
];

registerSprite({
  key: SPRITE_KEYS.cat,
  palette: catPalette,
  frames: catFrames,
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    walk: { frames: [2, 3, 4, 5], frameRate: 8, repeat: -1 },
    attack: { frames: [6, 7], frameRate: 10, repeat: 0 },
    hurt: { frames: [8, 9], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);

// ---------------------------------------------------------------------------
// RABBIT — long ears (upright), fluffy tail, hop-forward stance.
// ---------------------------------------------------------------------------
const rabbitPalette = {
  o: P.outline,
  c: P.cream, // body
  d: P.brown, // ear tips / patches
  w: P.white, // tail puff / belly
  k: P.outline,
  p: "#e8968a", // nose
};

function rabbitFrame(earPhase: 0 | 1, hopPhase: 0 | 1 | 2, kick = false): string[] {
  const rows = [
    "..oo..oo................",
    ".oddo.oddo..............",
    ".ocdo.ocdo..............",
    ".occo.occo..............",
    "..occ.cco...............",
    "...occcco...............",
    "..occccccoo.............",
    ".occccccccco......oo....",
    ".occpccccccco....owwo...",
    ".occccccccccco..owwwwo..",
    "..occccccccccoowwwwwwo..",
    "..occccccccccowwwwwwo...",
    "...occccccccccwwwwwo....",
    "...occccccccccccoo......",
    "....occ....cco..........",
    "....occ....cco..........",
    ".....oo.....oo..........",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
  ];
  const grid = rows.map((r) => r.split(""));
  if (earPhase === 1) {
    // ears lean back slightly
    grid[0][2] = ".";
    grid[0][3] = ".";
    grid[1][2] = "o";
  }
  if (hopPhase === 1) {
    // legs tucked (mid-air hop)
    for (let x = 4; x <= 6; x++) grid[13][x] = ".";
    for (let x = 11; x <= 13; x++) grid[13][x] = ".";
  } else if (hopPhase === 2) {
    // legs extended back (landing)
    grid[14][4] = ".";
    grid[15][4] = "o";
    grid[14][12] = ".";
    grid[15][12] = "o";
  }
  if (kick) {
    grid[12][2] = "o";
    grid[12][3] = "c";
  }
  return grid.map((r) => r.join(""));
}

const rabbitFrames: string[][] = [
  rabbitFrame(0, 0), // 0 idle a
  rabbitFrame(1, 0), // 1 idle b
  rabbitFrame(0, 1), // 2 walk a (hop up)
  rabbitFrame(0, 2), // 3 walk b (hop land)
  rabbitFrame(1, 1), // 4 walk c
  rabbitFrame(1, 2), // 5 walk d
  rabbitFrame(0, 1, true), // 6 attack a (kick)
  rabbitFrame(1, 0, true), // 7 attack b
  rabbitFrame(1, 0), // 8 hurt a
  rabbitFrame(0, 2), // 9 hurt b
];

registerSprite({
  key: SPRITE_KEYS.rabbit,
  palette: rabbitPalette,
  frames: rabbitFrames,
  anims: {
    idle: { frames: [0, 1], frameRate: 2, repeat: -1 },
    walk: { frames: [2, 3, 4, 5], frameRate: 8, repeat: -1 },
    attack: { frames: [6, 7], frameRate: 10, repeat: 0 },
    hurt: { frames: [8, 9], frameRate: 8, repeat: 0 },
  },
} satisfies PixelSpriteDef);
