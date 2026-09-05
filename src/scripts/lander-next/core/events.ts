export type GameEvent =
  | { type: 'thrust-start' }
  | { type: 'touchdown'; quality: 'soft' | 'great' | 'perfect' }
  | { type: 'crash'; cause: string }
  | { type: 'upgrade-offer' }
  | { type: 'fuel-pickup' }
  | { type: 'renderer-failure'; message: string };
