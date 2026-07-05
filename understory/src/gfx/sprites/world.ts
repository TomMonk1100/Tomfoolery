/**
 * World sprites: tiles (32x32), props (32x32), nest (32x32), forage bush
 * (32x32), and pickups (16x16: xp mote, berry, mushroom, bone).
 *
 * DECISIONS:
 * - Prop sizes aren't stated explicitly beyond "World (32x32 tiles / props)"
 *   in PixelArt.ts, so propFlower/propPebble are treated as 32x32 like tiles
 *   (small decorative motif centered in the tile canvas), so they can be
 *   drawn directly atop a tile without separate scaling logic.
 */
import { registerSprite, SPRITE_KEYS, PALETTE, type PixelSpriteDef } from "../spriteRegistry";

const P = PALETTE;

/**
 * Normalize a hand-authored pixel grid to exactly w columns and (if given)
 * h rows: rows are right-padded/truncated to width w; the row count is
 * truncated or padded with blank rows to height h. This makes miscounted
 * rows (an easy hand-authoring mistake) impossible to ship as a width/height
 * mismatch — callers should still aim for correct authored dimensions, but
 * a stray extra/missing row degrades to a clipped/padded sprite instead of
 * a broken def.
 */
function pad(rows: string[], w: number, h: number = rows.length): string[] {
  const widthFixed = rows.map((r) => (r.length >= w ? r.slice(0, w) : r + ".".repeat(w - r.length)));
  if (widthFixed.length === h) return widthFixed;
  if (widthFixed.length > h) return widthFixed.slice(0, h);
  const blank = ".".repeat(w);
  return [...widthFixed, ...Array.from({ length: h - widthFixed.length }, () => blank)];
}

// ===========================================================================
// GRASS TILES (32x32) — three light variants for visual break-up.
// ===========================================================================
function grassTile(variant: "a" | "b" | "c"): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    let row = "";
    for (let x = 0; x < 32; x++) {
      // deterministic pseudo-random speckle pattern per variant
      const seed = (x * 7 + y * 13 + variant.charCodeAt(0) * 31) % 11;
      if (seed === 0) row += "d";
      else if (seed === 5 && variant !== "a") row += "l";
      else row += "g";
    }
    rows.push(row);
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.tileGrassA,
  palette: { g: P.grassLight, d: P.grass, l: P.leaf },
  frames: [pad(grassTile("a"), 32)],
  anims: {},
} satisfies PixelSpriteDef);
registerSprite({
  key: SPRITE_KEYS.tileGrassB,
  palette: { g: P.grass, d: P.grassDark, l: P.leaf },
  frames: [pad(grassTile("b"), 32)],
  anims: {},
} satisfies PixelSpriteDef);
registerSprite({
  key: SPRITE_KEYS.tileGrassC,
  palette: { g: P.grassLight, d: P.grassDark, l: P.grass },
  frames: [pad(grassTile("c"), 32)],
  anims: {},
} satisfies PixelSpriteDef);

// ===========================================================================
// SEAMLESS GRASS BACKGROUND (64x64) — Update 2 "seamless looping wilds".
// One low-contrast, edge-matched noise texture tiled across the whole world
// as a single TileSprite, replacing per-tile grass images (was ~1600 image
// draws; now 1). Edges are built from a periodic function of x/y so the
// tile wraps with no visible seam when repeated.
// ===========================================================================
function seamlessGrassTile(): string[] {
  const rows: string[] = [];
  const SIZE = 64;
  for (let y = 0; y < SIZE; y++) {
    let row = "";
    for (let x = 0; x < SIZE; x++) {
      // Periodic (sine-based) low-contrast speckle: since sin() is periodic
      // over the tile's own size, value at x=0 and x=SIZE naturally match,
      // so the texture tiles edge-to-edge without a visible seam.
      const n =
        Math.sin((x / SIZE) * Math.PI * 4) * Math.cos((y / SIZE) * Math.PI * 4) +
        Math.sin((x / SIZE) * Math.PI * 9 + (y / SIZE) * Math.PI * 6) * 0.3;
      if (n > 0.85) row += "d";
      else if (n < -0.9) row += "l";
      else row += "g";
    }
    rows.push(row);
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.tileGrassSeamless,
  palette: { g: P.grassLight, d: P.grass, l: P.grassDark },
  frames: [pad(seamlessGrassTile(), 64)],
  anims: {},
} satisfies PixelSpriteDef);

// ===========================================================================
// WATER TILE (32x32, 2-frame shimmer loop).
// ===========================================================================
function waterTile(phase: 0 | 1): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 32; y++) {
    let row = "";
    for (let x = 0; x < 32; x++) {
      const shimmerLine = (x + y + phase * 4) % 8;
      row += shimmerLine === 0 ? "h" : "w";
    }
    rows.push(row);
  }
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.tileWater,
  palette: { w: P.water, h: P.waterLight },
  frames: [pad(waterTile(0), 32), pad(waterTile(1), 32)],
  anims: {
    shimmer: { frames: [0, 1], frameRate: 2, repeat: -1 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// OBSTACLE TREE (32x32) — trunk + round canopy, solid silhouette.
// ===========================================================================
function treeTile(): string[] {
  const rows = pad(
    [
      "................................",
      "..........oooooooo.............",
      ".........olllllllol............",
      "........olllllllllllo..........",
      ".......olllllllllllllo.........",
      "......olllglllllglllllo........",
      ".....olllllllllllllllllo.......",
      ".....olllllglllllllllllo.......",
      "......olllllllllllglllo........",
      "......ollllllllllllllo.........",
      ".......ollllllllllllo..........",
      "........ollllllllllo...........",
      ".........oooooooooo............",
      "..............oo................".slice(0, 32),
      ".............obbo..............",
      ".............obbo..............",
      ".............obbo..............",
      ".............obbo..............",
      ".............obbo..............",
      ".............obbo..............",
      "............obbbbo.............",
      "...........obbbbbbo............",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    32,
    32
  );
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.tileObstacleTree,
  palette: { o: P.outline, l: P.grassDark, g: P.leaf, b: P.brown },
  frames: [treeTile()],
  anims: {},
} satisfies PixelSpriteDef);

// ===========================================================================
// OBSTACLE ROCK (32x32) — clustered grey boulders.
// ===========================================================================
function rockTile(): string[] {
  const rows = pad(
    [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..........oooooooooo...........",
      ".........orrrrrrrrrrro..........",
      "........orrrrdrrrrrrrro.........",
      "........orrrrrrrdrrrrro.........",
      "........orrrrrrrrrrrrro.........",
      "......oorrrrrrrrrrrrrrroo.......",
      ".....orrrrrrrrrrrrrrrrrrro.......",
      ".....orrrrdrrrrrrrrdrrrrro.......",
      ".....orrrrrrrrrrrrrrrrrrro.......",
      "......oorrrrrrrrrrrrrrroo.......",
      ".......ooorrrrrrrrrroo..........",
      "..........ooooooooo............",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    32,
    32
  );
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.tileObstacleRock,
  palette: { o: P.outline, r: "#8a8a94", d: "#6a6a76" },
  frames: [rockTile()],
  anims: {},
} satisfies PixelSpriteDef);

// ===========================================================================
// PROP FLOWER / PEBBLE (32x32 canvas, small centered motif).
// ===========================================================================
function flowerProp(): string[] {
  const rows = pad(
    [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............pp................",
      ".............ppwpp..............",
      ".............pwywp..............",
      ".............ppwpp..............",
      "..............pp................",
      "...............g................",
      "...............g................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    32,
    32
  );
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.propFlower,
  palette: { p: "#e88ec9", w: P.white, y: P.gold, g: P.grassDark },
  frames: [flowerProp()],
  anims: {},
} satisfies PixelSpriteDef);

function pebbleProp(): string[] {
  const rows = pad(
    [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..............oooo.............",
      ".............orrrro............",
      ".............orrrro............",
      "..............oooo.............",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    32,
    32
  );
  return rows;
}
registerSprite({
  key: SPRITE_KEYS.propPebble,
  palette: { o: P.outline, r: "#9a9aa4" },
  frames: [pebbleProp()],
  anims: {},
} satisfies PixelSpriteDef);

// ===========================================================================
// NEST (32x32) — twig-woven bowl with eggs; idle vs damaged (scorched/broken).
// ===========================================================================
function nestFrame(damaged: boolean): string[] {
  const rows = pad(
    [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "..........eee..eee..............",
      ".........ewkeoeewkee............",
      "..........eee..eee..............",
      "........obbbbbbbbbbbo...........",
      ".......obbbbbbbbbbbbbo..........",
      "......obbbbbbbbbbbbbbbo.........",
      "......obbbdbbbbbdbbbbbo.........",
      ".....obbbbbbbbbbbbbbbbbo........",
      ".....obbbdbbbbbbbdbbbbbo........",
      ".....obbbbbbbbbbbbbbbbbo........",
      "......obbbbbbbbbbbbbbbo.........",
      ".......obbbbbbbbbbbbbo..........",
      "........oooooooooooo...........",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    32,
    32
  ).map((r) => r.split(""));
  if (damaged) {
    // scorch marks + broken twig gaps
    rows[10] = pad(["........o..bbbbb..bbo..........."], 32)[0].split("");
    rows[13] = pad(["......obbbxbbb..bxbbbbo........."], 32)[0].split("");
    rows[15] = pad(["......obbbbb..bbbbxbbbo........."], 32)[0].split("");
    rows[8] = pad([".........ewkeo.ewk.e............"], 32)[0].split("");
  }
  return rows.map((r) => r.join(""));
}
registerSprite({
  key: SPRITE_KEYS.nest,
  palette: {
    o: P.outline,
    b: P.brown,
    d: P.darkBrown,
    e: P.cream,
    w: P.white,
    k: P.outline,
    x: "#2f2318",
  },
  frames: [nestFrame(false), nestFrame(true)],
  anims: {
    idle: { frames: [0], frameRate: 1, repeat: -1 },
    damaged: { frames: [1], frameRate: 1, repeat: -1 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// FORAGE BUSH (32x32) — full (berries) vs harvested (bare leaves).
// ===========================================================================
function forageBushFrame(full: boolean): string[] {
  const rows = pad(
    [
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "...........oooooooooo..........",
      ".........olllllllllllo.........",
      "........olllllllllllllo........",
      ".......olllglllglllglllo.......",
      ".......olllllllllllllllo.......",
      "......olllglllllglllllglo......",
      "......olllllllllllllllllo......",
      "......olllglllllglllllglo......",
      ".......olllllllllllllllo.......",
      ".......olllglllglllglllo.......",
      "........olllllllllllllo........",
      ".........olllllllllllo.........",
      "...........oooooooooo..........",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
      "................................",
    ],
    32,
    32
  ).map((r) => r.split(""));
  if (full) {
    // add berry dots at several leaf positions
    const berrySpots: [number, number][] = [
      [9, 12],
      [9, 16],
      [11, 10],
      [11, 20],
      [13, 12],
      [13, 18],
      [15, 14],
    ];
    for (const [y, x] of berrySpots) {
      if (rows[y] && rows[y][x] === "l") rows[y][x] = "r";
    }
  }
  return rows.map((r) => r.join(""));
}
registerSprite({
  key: SPRITE_KEYS.forageBush,
  palette: { o: P.outline, l: P.grassDark, g: P.leaf, r: P.danger },
  frames: [forageBushFrame(true), forageBushFrame(false)],
  anims: {
    full: { frames: [0], frameRate: 1, repeat: -1 },
    harvested: { frames: [1], frameRate: 1, repeat: -1 },
  },
} satisfies PixelSpriteDef);

// ===========================================================================
// PICKUPS (16x16) — xp mote (sparkle loop), berry, mushroom, bone.
// ===========================================================================
function xpMoteFrame(phase: 0 | 1): string[] {
  const rows = pad(
    [
      "................",
      "................",
      "................",
      "................",
      "......oo........",
      ".....oyyo.......",
      "....oyyyyo......",
      "....oyhyyo......",
      "....oyyyyo......",
      ".....oyyo.......",
      "......oo........",
      "................",
      "................",
      "................",
      "................",
      "................",
    ],
    16,
    16
  ).map((r) => r.split(""));
  if (phase === 1) {
    rows[2][6] = "y";
    rows[3][9] = "y";
    rows[11][5] = "y";
    rows[12][8] = "y";
  }
  return rows.map((r) => r.join(""));
}
registerSprite({
  key: SPRITE_KEYS.xpMote,
  palette: { o: P.outline, y: P.gold, h: P.white },
  frames: [xpMoteFrame(0), xpMoteFrame(1)],
  anims: {
    sparkle: { frames: [0, 1], frameRate: 4, repeat: -1 },
  },
} satisfies PixelSpriteDef);

registerSprite({
  key: SPRITE_KEYS.foodBerry,
  palette: { o: P.outline, r: P.danger, l: P.leaf, h: "#f0a0a0" },
  frames: [
    pad(
      [
        "................",
        "................",
        "................",
        ".......ll.......",
        "......oooo......",
        ".....orrho......",
        ".....orrro......",
        ".....orrro......",
        "......oooo......",
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
    ),
  ],
  anims: {},
} satisfies PixelSpriteDef);

registerSprite({
  key: SPRITE_KEYS.foodMushroom,
  palette: { o: P.outline, r: P.danger, w: P.white, s: P.cream },
  frames: [
    pad(
      [
        "................",
        "................",
        "................",
        "......oooo......",
        ".....orrwro.....",
        "....orrrrrro....",
        "....orwrrwro....",
        "....orrrrrro....",
        ".....oooooo.....",
        "......ssss......",
        "......ssss......",
        ".......oo.......",
        "................",
        "................",
        "................",
        "................",
      ],
      16,
      16
    ),
  ],
  anims: {},
} satisfies PixelSpriteDef);

registerSprite({
  key: SPRITE_KEYS.foodBone,
  palette: { o: P.outline, w: P.white },
  frames: [
    pad(
      [
        "................",
        "................",
        "................",
        "................",
        "..oo........oo..",
        ".owwo......owwo.",
        ".owwoooooooowwo.",
        "..owwwwwwwwwwo..",
        ".owwoooooooowwo.",
        ".owwo......owwo.",
        "..oo........oo..",
        "................",
        "................",
        "................",
        "................",
        "................",
      ],
      16,
      16
    ),
  ],
  anims: {},
} satisfies PixelSpriteDef);
