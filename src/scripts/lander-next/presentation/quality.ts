export type QualityTier = 'low' | 'medium' | 'high';
export interface QualitySettings { tier: QualityTier; pixelRatio: number; particles: number; atmosphere: boolean; }
export function qualitySettings(tier: QualityTier): QualitySettings { return tier === 'low' ? { tier, pixelRatio: 1, particles: 24, atmosphere: false } : tier === 'medium' ? { tier, pixelRatio: 1.25, particles: 48, atmosphere: true } : { tier, pixelRatio: 1.75, particles: 80, atmosphere: true }; }
