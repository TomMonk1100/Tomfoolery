import { COSMETICS } from '../content/cosmetics';
import { UPGRADE_IDS, type UpgradeId } from '../content/upgrades';
import { RULESET_VERSION } from '../content/balance';
import type { Difficulty } from '../content/balance';
import type { GameState } from '../core/state';

export const PROFILE_KEY = 'lander-profile-v1';
export const CHECKPOINT_KEY = 'lander-checkpoint-v1';
export interface Profile { version: 1; migratedFromLegacy: boolean; stardust: number; cosmetics: { paints: string[]; trails: string[]; skies: string[]; equipped: { paint: string; trail: string; sky: string } }; achievements: string[]; bests: Record<Difficulty, number>; preferences: { reducedMotion: boolean; quality: 'low' | 'medium' | 'high' }; }
export interface Checkpoint { version: 1; rulesetVersion: string; seed: number; difficulty: Difficulty; nextLevel: number; upgrades: UpgradeId[]; stardust: number; score: number; rewardRevision: number; }

const defaultProfile = (): Profile => ({ version: 1, migratedFromLegacy: false, stardust: 0, cosmetics: { paints: ['cream'], trails: ['dust'], skies: ['first-light'], equipped: { paint: 'cream', trail: 'dust', sky: 'first-light' } }, achievements: [], bests: { cadet: 0, pilot: 0, ace: 0 }, preferences: { reducedMotion: false, quality: 'high' } });
function number(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number { return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : fallback; }
function known(values: unknown, allowed: readonly string[], fallback: string[]): string[] { return Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string' && allowed.includes(v)) : fallback; }

export function loadProfile(storage: Storage | null): { profile: Profile; storageAvailable: boolean } {
  const profile = defaultProfile(); if (!storage) return { profile, storageAvailable: false };
  try {
    const raw = storage.getItem(PROFILE_KEY); const legacyDust = number(storage.getItem('lander-stardust') ? Number(storage.getItem('lander-stardust')) : 0, 0, 1_000_000);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Profile>; profile.stardust = number(parsed.stardust, legacyDust, 1_000_000); profile.migratedFromLegacy = parsed.migratedFromLegacy === true;
      if (parsed.cosmetics) { profile.cosmetics.paints = known(parsed.cosmetics.paints, COSMETICS.paints.map((x) => x.id), profile.cosmetics.paints); profile.cosmetics.trails = known(parsed.cosmetics.trails, COSMETICS.trails.map((x) => x.id), profile.cosmetics.trails); profile.cosmetics.skies = known(parsed.cosmetics.skies, COSMETICS.skies.map((x) => x.id), profile.cosmetics.skies); }
      if (parsed.achievements) profile.achievements = known(parsed.achievements, [], []);
      for (const difficulty of ['cadet', 'pilot', 'ace'] as const) profile.bests[difficulty] = number(parsed.bests?.[difficulty], number(storage.getItem(`lander-best-${difficulty}`) ? Number(storage.getItem(`lander-best-${difficulty}`)) : 0, 0), 10_000_000);
      return { profile, storageAvailable: true };
    }
    for (const difficulty of ['cadet', 'pilot', 'ace'] as const) profile.bests[difficulty] = number(storage.getItem(`lander-best-${difficulty}`) ? Number(storage.getItem(`lander-best-${difficulty}`)) : 0, 0, 10_000_000);
    profile.stardust = legacyDust; profile.migratedFromLegacy = true; storage.setItem(PROFILE_KEY, JSON.stringify(profile)); return { profile, storageAvailable: true };
  } catch { return { profile, storageAvailable: false }; }
}

export function saveProfile(storage: Storage | null, profile: Profile): boolean { if (!storage) return false; try { storage.setItem(PROFILE_KEY, JSON.stringify(profile)); return true; } catch { return false; } }
export function saveCheckpoint(storage: Storage | null, checkpoint: Omit<Checkpoint, 'version' | 'rulesetVersion'>): boolean { if (!storage) return false; try { storage.setItem(CHECKPOINT_KEY, JSON.stringify({ ...checkpoint, version: 1, rulesetVersion: RULESET_VERSION })); return true; } catch { return false; } }
export function loadCheckpoint(storage: Storage | null): Checkpoint | null { if (!storage) return null; try { const parsed = JSON.parse(storage.getItem(CHECKPOINT_KEY) || 'null') as Checkpoint | null; if (!parsed || parsed.version !== 1 || parsed.rulesetVersion !== RULESET_VERSION || !Number.isFinite(parsed.seed) || !Number.isFinite(parsed.nextLevel) || !Array.isArray(parsed.upgrades) || !parsed.upgrades.every((id) => UPGRADE_IDS.includes(id))) return null; return parsed; } catch { return null; } }
export function clearCheckpoint(storage: Storage | null): void { try { storage?.removeItem(CHECKPOINT_KEY); } catch { /* best effort */ } }

export function checkpointFor(state: GameState): Omit<Checkpoint, 'version' | 'rulesetVersion'> { return { seed: state.run.seed, difficulty: state.run.difficulty, nextLevel: state.run.level, upgrades: [...state.run.upgrades], stardust: state.run.stardust, score: state.run.score, rewardRevision: state.run.stats.landings }; }
