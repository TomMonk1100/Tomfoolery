export const COSMETICS = {
  paints: [
    { id: 'cream', name: 'Cream enamel', price: 0, top: 0xf4ebda, bottom: 0xc97b3d },
    { id: 'moss', name: 'Moss signal', price: 60, top: 0xd6e2ba, bottom: 0x7c8f5c },
    { id: 'blueprint', name: 'Blueprint', price: 120, top: 0xd4eef1, bottom: 0x52758c },
    { id: 'copper', name: 'Copperfield', price: 180, top: 0xffd0a6, bottom: 0xb45d30 },
    { id: 'night', name: 'Night watch', price: 240, top: 0x9fb2c8, bottom: 0x293c55 },
    { id: 'stardust', name: 'Stardust', price: 400, top: 0xfff6b8, bottom: 0x8f65d8 },
  ],
  trails: [
    { id: 'dust', name: 'Dust ribbon', price: 0, colors: [0xd4b58a] },
    { id: 'copper', name: 'Copper sparks', price: 50, colors: [0xffc477, 0xc97b3d] },
    { id: 'moss', name: 'Moss pollen', price: 90, colors: [0xd7e79d, 0x7c8f5c] },
    { id: 'signal', name: 'Signal blue', price: 150, colors: [0xd4eef1, 0x73b9c5] },
    { id: 'rainbow', name: 'Rainbow trouble', price: 220, colors: 'rainbow' as const },
    { id: 'stardust', name: 'Stardust wake', price: 360, colors: 'stardust' as const },
  ],
  skies: [
    { id: 'first-light', name: 'First Light', price: 0, top: 0x101724, mid: 0x44515b, bottom: 0xc89266 },
    { id: 'rust-basin', name: 'Rust Basin', price: 120, top: 0x241721, mid: 0x714137, bottom: 0xd08c55 },
    { id: 'blue-rift', name: 'Blue Rift', price: 220, top: 0x0b182c, mid: 0x29516d, bottom: 0x8cb4b9 },
    { id: 'paper-moon', name: 'Paper Moon', price: 300, top: 0x4e4b59, mid: 0xb29b8b, bottom: 0xe5d2b2 },
  ],
} as const;
