export const COSMETICS = {
  paints: [
    { id: 'paint_classic', name: 'Classic Cream', price: 0, top: 0xf4ebda, bottom: 0xc97b3d },
    { id: 'paint_midnight', name: 'Midnight Iron', price: 250, top: 0xb8c4d4, bottom: 0x5e6b7e },
    { id: 'paint_jalapeno', name: 'Jalapeño Fresh', price: 250, top: 0xd9e8b8, bottom: 0x7c8f5c },
    { id: 'paint_copper', name: 'Sunset Copper', price: 350, top: 0xf0c8a0, bottom: 0xc97b3d },
    { id: 'paint_violet', name: 'Royal Violet', price: 500, top: 0xd8c4e8, bottom: 0x9b6bb3 },
    { id: 'paint_gold', name: 'Gold Standard', price: 1500, top: 0xffe9b0, bottom: 0xd9a441 },
  ],
  trails: [
    { id: 'trail_ember', name: 'Ember', price: 0, colors: [0xd9a441, 0xc97b3d] },
    { id: 'trail_verdant', name: 'Verdant', price: 200, colors: [0x94b03d, 0x7c8f5c] },
    { id: 'trail_ice', name: 'Glacier', price: 300, colors: [0xa8d8e8, 0x7ba7c7] },
    { id: 'trail_violet', name: 'Ultraviolet', price: 400, colors: [0xc9a0e8, 0xb07bd6] },
    { id: 'trail_rainbow', name: 'Prism', price: 800, colors: 'rainbow' as const },
    { id: 'trail_stardust', name: 'Stardust', price: 1000, colors: 'stardust' as const },
  ],
  skies: [
    { id: 'sky_hearthwood', name: 'Hearthwood', price: 0, top: 0x101724, mid: 0x202b35, bottom: 0x362419 },
    { id: 'sky_bloodmoon', name: 'Blood Moon', price: 400, top: 0x241010, mid: 0x1a0d0d, bottom: 0x120a0a },
    { id: 'sky_emerald', name: 'Emerald Nebula', price: 400, top: 0x0e1a12, mid: 0x0d150e, bottom: 0x0a100b },
    { id: 'sky_void', name: 'The Deep Void', price: 700, top: 0x0a0a12, mid: 0x08080e, bottom: 0x06060a },
  ],
} as const;
