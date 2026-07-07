/**
 * UI icons (16x16) — one per weapon (18) + passive (12), registered under
 * iconKey(id). Simplified emblem per weapon/passive concept, single frame,
 * no anims (draft cards / HUD render them static).
 *
 * DECISIONS:
 * - Icons are static (no anims) since CONTRACTS.md only requires "16x16
 *   icons" for draft/HUD display; nothing calls playAnim() on an icon key.
 * - Kept a consistent visual language: dog weapons lean warm brown/gold,
 *   cat weapons cool purple/grey, rabbit weapons green/cream, so the draft
 *   UI reads species-grouping at a glance even before reading text.
 */
import { registerSprite, iconKey, PALETTE, type PixelSpriteDef } from "../spriteRegistry";

const P = PALETTE;

function pad(rows: string[], w: number): string[] {
  return rows.map((r) => (r.length >= w ? r.slice(0, w) : r + ".".repeat(w - r.length)));
}

function icon(id: string, palette: Record<string, string>, rows: string[]) {
  registerSprite({
    key: iconKey(id),
    palette,
    frames: [pad(rows, 16)],
    anims: {},
  } satisfies PixelSpriteDef);
}

const blank16 = [
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
];

function withRows(overrides: Record<number, string>): string[] {
  const rows = [...blank16];
  for (const [i, r] of Object.entries(overrides)) rows[Number(i)] = r;
  return rows;
}

// ---------------------------------------------------------------------------
// DOG WEAPONS (6)
// ---------------------------------------------------------------------------
icon(
  "bark-blast",
  { o: P.outline, r: P.gold },
  withRows({
    5: "......oooo......",
    6: ".....o....o.....",
    7: "....o..oo..o....",
    8: "....o.oOo.o.....".replace("O", "o"),
    9: "....o..oo..o....",
    10: ".....o....o.....",
    11: "......oooo......",
  })
);
icon(
  "tail-wag-strike",
  { o: P.outline, b: P.brown },
  withRows({
    4: "..........oo...",
    5: ".........obbo...",
    6: "........obbo....",
    7: ".......obbo.....",
    8: "......obbo......",
    9: ".....oo.........",
    10: "....o...........",
  })
);
icon(
  "fetch",
  { o: P.outline, b: P.brown, d: P.darkBrown },
  withRows({
    3: "..........oo...",
    4: ".........obdo...",
    5: "........obdo....",
    6: ".......obdo.....",
    7: "......obdo......",
    8: ".....obdo.......",
    9: "....oo..........",
  })
);
icon(
  "zoomies",
  { o: P.outline, y: P.gold },
  withRows({
    5: "..o..............",
    6: "...o.............".slice(0, 16),
    7: "....o.oo.oo......",
    8: ".....o.......o...",
    9: "......ooooooo....",
    10: "................",
  })
);
icon(
  "dig",
  { o: P.outline, b: P.darkBrown },
  withRows({
    3: "......oo........",
    4: ".....obbo.......",
    5: ".....obbo.......",
    6: "......oo........",
    7: "................",
    8: "....bbbbbbb.....",
    9: "...bbbbbbbbb....",
  })
);
icon(
  "slobber-shot",
  { o: P.outline, g: "#9ad3a0" },
  withRows({
    5: "......oo........",
    6: ".....oggo.......",
    7: ".....oggo..oo...",
    8: "......oo..ogoo..",
    9: "..........ogo...",
    10: "...........o....",
  })
);

// ---------------------------------------------------------------------------
// CAT WEAPONS (6)
// ---------------------------------------------------------------------------
icon(
  "pounce-slash",
  { o: P.outline, w: P.white },
  withRows({
    4: "..o..........",
    5: "...o.........",
    6: "....o..o.....",
    7: ".....o..o....",
    8: "......o..o...",
    9: ".......o..o..",
  })
);
icon(
  "claw-flurry",
  { o: P.outline, w: P.white },
  withRows({
    3: ".o..o..o........",
    4: "..o..o..o.......",
    5: "...o..o..o......",
    6: "....o..o..o.....",
    7: ".....o..o..o....",
  })
);
icon(
  "hairball-lob",
  { o: P.outline, g: "#9a8f7a", h: "#c9c0ae" },
  withRows({
    5: "......oooo......",
    6: ".....ohggo......",
    7: ".....ogggo......",
    8: ".....ohggo......",
    9: "......oooo......",
  })
);
icon(
  "purr-aura",
  { o: P.outline, p: P.purple },
  withRows({
    4: "....oooooo......",
    5: "...o......o.....",
    6: "..o...oo...o....",
    7: "..o..o..o..o....",
    8: "..o...oo...o....",
    9: "...o......o.....",
    10: "....oooooo......",
  })
);
icon(
  "midnight-prowl",
  { o: P.outline, p: "#3a2f4a" },
  withRows({
    5: "....oo..........",
    6: "...opoo.........",
    7: "..opppoo........",
    8: ".opppppoo.......",
    9: "..oooooo........",
  })
);
icon(
  "yarn-whip",
  { o: P.outline, r: P.danger },
  withRows({
    4: "....oooo........",
    5: "...orrrro.......",
    6: "...orroro.......",
    7: "...orrrro.......",
    8: "....oooo........",
    9: "......o.........",
    10: ".......o........",
    11: "........o.......",
  })
);

// ---------------------------------------------------------------------------
// RABBIT WEAPONS (6)
// ---------------------------------------------------------------------------
icon(
  "thumper-quake",
  { o: P.outline, c: P.cream },
  withRows({
    4: "......oo........",
    5: "......cc........",
    6: "......cc........",
    7: "................",
    8: "....oooooooo....",
    9: "...o........o...",
  })
);
icon(
  "scissor-kick",
  { o: P.outline, w: P.white },
  withRows({
    4: "...o.........o..",
    5: "....o.......o...",
    6: ".....o.....o....",
    7: "......ooooo.....",
    8: ".....o.....o....",
    9: "....o.......o...",
    10: "...o.........o..",
  })
);
icon(
  "bunny-barrage",
  { o: P.outline, c: P.cream },
  withRows({
    5: "..oo..oo..oo....",
    6: "..cc..cc..cc....",
    7: "................",
    8: "................",
  })
);
icon(
  "carrot-toss",
  { o: P.outline, r: "#e8823d", l: P.leaf },
  withRows({
    3: "......ll........",
    4: ".....llll.......",
    5: "......oo........",
    6: ".....orro.......",
    7: ".....orro.......",
    8: "......oro.......",
    9: "......oro.......",
    10: ".......o........",
  })
);
icon(
  "lucky-clover",
  { o: P.outline, l: P.leaf, g: P.grass },
  withRows({
    4: "....oo..oo......",
    5: "...olgo.olgo....",
    6: "....oo..oo......",
    7: ".....ooo........",
    8: "....oo.oo.......",
    9: "...olgo.olgo....",
    10: "....oo...oo.....",
  })
);
icon(
  "burrow-network",
  { o: P.outline, b: P.darkBrown },
  withRows({
    5: "....oooooooo....",
    6: "...obbbbbbbbo...",
    7: "...ob.bb.bb.o...",
    8: "...obb.bb.bbo...",
    9: "....oooooooo....",
  })
);
icon(
  "cottontail-decoy",
  { o: P.outline, w: P.white },
  withRows({
    5: "....oo.....oo...",
    6: "...owwo...owwo..",
    7: "....oo.....oo...",
    8: "................",
    9: "......oo........",
    10: ".....owwo.......",
    11: "......oo........",
  })
);

// ---------------------------------------------------------------------------
// PASSIVES (12)
// ---------------------------------------------------------------------------
icon(
  "loyal-heart",
  { o: P.outline, r: P.danger },
  withRows({
    4: "...oo..oo.......",
    5: "..orroorro......",
    6: "..orrrrrro......",
    7: "...orrrro.......",
    8: "....orro........",
    9: ".....o..........",
  })
);
icon(
  "thick-fur",
  { o: P.outline, b: P.brown },
  withRows({
    4: "...bb.bb.bb.....",
    5: "..bbbbbbbbbb....",
    6: ".bbbbbbbbbbbb...",
    7: ".bbbbbbbbbbbb...",
    8: "..bbbbbbbbbb....",
  })
);
icon(
  "keen-nose",
  { o: P.outline, p: "#e8968a" },
  withRows({
    5: "......oo........",
    6: ".....opoo.......",
    7: "....opppoo......",
    8: ".....opoo.......",
    9: "......oo........",
  })
);
icon(
  "big-appetite",
  { o: P.outline, r: P.danger },
  withRows({
    4: "....oooo........",
    5: "...orrrro.......",
    6: "...orrrro.......",
    7: "....oooo........",
    8: "....o..o........",
    9: "...o....o.......",
  })
);
icon(
  "feline-grace",
  { o: P.outline, p: "#5a5a68" },
  withRows({
    5: "...o............",
    6: "....o...........",
    7: ".....o..........",
    8: "......o.o.......",
    9: ".......o..o.....",
    10: "..........o.....",
  })
);
icon(
  "predator-eye",
  { o: P.outline, y: P.gold, k: P.outline },
  withRows({
    6: "...oooooooo.....",
    7: "..oyyyyyyyyo....",
    8: "..oykoookyo.....",
    9: "..oyyyyyyyyo....",
    10: "...oooooooo.....",
  })
);
icon(
  "soft-paws",
  { o: P.outline, c: P.cream },
  withRows({
    5: "..oo..oo..oo....",
    6: ".oco.oco.oco....",
    7: "..oo..oo..oo....",
  })
);
icon(
  "picky-eater",
  { o: P.outline, r: P.danger },
  withRows({
    5: "....oooo........",
    6: "...orrrro.......",
    7: "...orXrro.......".replace("X", "o"),
    8: "...orrrro.......",
    9: "....oooo........",
  })
);
icon(
  "lucky-foot",
  { o: P.outline, c: P.cream },
  withRows({
    4: "....oo..........",
    5: "...occo.........",
    6: "...occo.........",
    7: "....oo..........",
    8: "....oo..........",
    9: "...occco........",
  })
);
icon(
  "spring-legs",
  { o: P.outline, c: P.cream },
  withRows({
    5: "....oo..........",
    6: "....oo..........",
    7: "...oooo.........",
    8: "..o....o........",
    9: ".o......o.......",
  })
);
icon(
  "litter-of-friends",
  { o: P.outline, c: P.cream },
  withRows({
    6: "..oo..oo..oo....",
    7: ".occo.occo.occo.".slice(0, 16),
    8: "..oo..oo..oo....",
  })
);
// ---------------------------------------------------------------------------
// NEUTRAL WEAPONS (7) — Update 2, animal:"any"
// ---------------------------------------------------------------------------
icon(
  "tennis-ball",
  { o: P.outline, y: "#d9e84f" },
  withRows({
    5: "......oooo......",
    6: ".....oyyyyo.....",
    7: "....oyy..yyo....",
    8: "....oy....yo....",
    9: "....oyy..yyo....",
    10: ".....oyyyyo.....",
    11: "......oooo......",
  })
);
icon(
  "skunk-cloud",
  { o: P.outline, w: P.white, k: P.outline },
  withRows({
    4: "....oooooooo....",
    5: "...oyyyyyyyyo...".replace(/y/g, "w"),
    6: "..owwkwwwwkwwo..",
    7: "..owwwwwwwwwwo..",
    8: "...owwwwwwwo....",
    9: "....oo..oo......",
  })
);
icon(
  "bee-swarm",
  { o: P.outline, y: P.gold, k: P.outline },
  withRows({
    5: "...oo....oo.....",
    6: "..oyko...oyko....",
    7: "...oo....oo.....",
    8: "................",
    9: "....oo...oo.....",
    10: "...oyko..oyko...",
    11: "....oo...oo.....",
  })
);
icon(
  "acorn-mortar",
  { o: P.outline, b: P.darkBrown, l: P.leaf },
  withRows({
    4: ".....ll.........",
    5: "....llll........",
    6: ".....oo.........",
    7: "....obbo........",
    8: "....obbo........",
    9: "....obbo........",
    10: ".....oo.........",
  })
);
icon(
  "firefly-lantern",
  { o: P.outline, y: P.gold },
  withRows({
    4: "....oooo........",
    5: "...oyyyyo.......",
    6: "..oyyyyyyo......",
    7: "...oyyyyo.......",
    8: "....oooo........",
    9: ".....oo.........",
  })
);
icon(
  "echo-screech",
  { o: P.outline, w: P.white },
  withRows({
    5: "..o.............",
    6: "..o.o...........",
    7: "..o.o.o.........",
    8: "..o.o.o.o.......",
    9: "..o.o.o.........",
    10: "..o.o...........",
    11: "..o.............",
  })
);
icon(
  "laser-pointer",
  { o: P.outline, r: P.danger },
  withRows({
    4: "..............o.",
    5: ".............o..",
    6: "............o...",
    7: "...........o....",
    8: "..........o.....",
    9: ".........orro...",
    10: "..........oo....",
  })
);

// ---------------------------------------------------------------------------
// NEUTRAL PASSIVES (4) — Update 2, animal:"any"
// ---------------------------------------------------------------------------
icon(
  "magnet-collar",
  { o: P.outline, r: P.danger, w: P.white },
  withRows({
    5: "..oo........oo..",
    6: ".orro......orro.",
    7: ".orro......orro.",
    8: ".orro......orro.",
    9: "..oo........oo..",
    10: "................",
  })
);
icon(
  "wild-heart",
  { o: P.outline, r: P.danger, g: P.grass },
  withRows({
    4: "...oo..oo.......",
    5: "..orroorro......",
    6: "..orrrrrro......",
    7: "...orrrro.......",
    8: "....orro........",
    9: "....gggg........",
  })
);
icon(
  "alpha-scent",
  { o: P.outline, y: P.gold },
  withRows({
    4: "....oo..oo......",
    5: "...oyyooyyyo....",
    6: "..oyyyyyyyyyo...",
    7: "...oyyyyyyo.....",
    8: "....oyyyyo......",
    9: ".....oyyo.......",
  })
);
icon(
  "four-leaf",
  { o: P.outline, l: P.leaf, g: P.grass },
  withRows({
    4: "....oo..oo......",
    5: "...olgo.olgo....",
    6: "....oo..oo......",
    7: ".....ooo........",
    8: "....oo.oo.......",
    9: "...olgo.olgo....",
    10: "....oo...oo.....",
  })
);

icon(
  "nibbler",
  { o: P.outline, r: "#e8823d", l: P.leaf },
  withRows({
    5: ".....ll.........",
    6: "....llll........",
    7: ".....oo.........",
    8: "....orro........",
    9: "....orro........",
    10: ".....oo.........",
  })
);

// ---------------------------------------------------------------------------
// Update 3 — fused weapon icons (8). Dual-nature emblems: each hints at both
// input weapons. Same 16x16 withRows format as everything above.
// ---------------------------------------------------------------------------
icon(
  "thunder-fetch",
  { o: P.outline, b: P.brown, g: P.gold },
  withRows({
    3: "......bb........",
    4: ".....bbbb.......",
    5: ".....bbbb.......",
    6: "......bb...g....",
    7: ".........gg.....",
    8: "........gg......",
    9: ".......ggg......",
    10: "......gg........",
    11: ".....g..........",
  })
);
icon(
  "slip-n-blitz",
  { o: P.outline, w: P.waterLight, c: P.cream },
  withRows({
    4: "..w.............",
    5: "..ww....w.......",
    6: "...www..ww......",
    7: "....wwwwww......",
    8: "......wwwwcc....",
    9: ".......wwwwcc...",
    10: "........ww..cc..",
    11: ".............c..",
  })
);
icon(
  "wildcat-cyclone",
  { o: P.outline, p: P.purple, w: P.white },
  withRows({
    3: ".....ppp........",
    4: "...pp...pp......",
    5: "..p...ww..p.....",
    6: "..p..w..w..p....",
    7: "..p..w.ww..p....",
    8: "...p..ww..p.....",
    9: "....pp...pp.....",
    10: "......ppp.......",
  })
);
icon(
  "tangle-storm",
  { o: P.outline, p: P.purple, c: P.cream },
  withRows({
    4: "...cc...cc......",
    5: "..cppc.cppc.....",
    6: "..cppccppc......",
    7: "...ccppcc.......",
    8: "....cppc........",
    9: "...cc..cc.......",
    10: "..c......c......",
  })
);
icon(
  "seismic-kick",
  { o: P.outline, b: P.brown, g: P.gold },
  withRows({
    4: "......gg........",
    5: ".....g..g.......",
    6: "....g....g......",
    7: "...g..bb..g.....",
    8: "......bb........",
    9: "....bbbbbb......",
    10: "..bbb....bbb....",
    11: ".bb........bb...",
  })
);
icon(
  "clover-cascade",
  { o: P.outline, l: P.grassLight, g: P.gold },
  withRows({
    3: "...ll...........",
    4: "..llll..........",
    5: "...ll....ll.....",
    6: ".........llll...",
    7: "..........ll....",
    8: "....g...........",
    9: "...ggg....ll....",
    10: "....g....llll...",
    11: "..........ll....",
  })
);
icon(
  "glowhive",
  { o: P.outline, g: P.gold, s: P.slime },
  withRows({
    3: ".....gggg.......",
    4: "....g....g......",
    5: "...g..ss..g.....",
    6: "...g.s..s.g.....",
    7: "...g..ss..g.....",
    8: "....g....g......",
    9: ".....gggg.......",
    11: "..s....s....s...",
  })
);
icon(
  "cannonade",
  { o: P.outline, d: P.darkBrown, g: P.gold },
  withRows({
    3: "....g...g...g...",
    4: "...g...g...g....",
    6: "..dd...dd...dd..",
    7: ".dddd.dddd.dddd.",
    8: ".dddd.dddd.dddd.",
    9: "..dd...dd...dd..",
  })
);
