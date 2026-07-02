import type { Difficulty, ScoreRow } from './types';

// --- Persistent progression: Stardust, cosmetics, achievements, pilot name ---
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return { ...fallback, ...JSON.parse(raw) };
  } catch (e) {}
  return fallback;
}

export function bestFor(d: Difficulty): number {
  try { return parseInt(localStorage.getItem(`lander-best-${d}`) || '0', 10) || 0; } catch (e) { return 0; }
}

export function saveBest(d: Difficulty, v: number) {
  try { localStorage.setItem(`lander-best-${d}`, String(v)); } catch (e) {}
}

// --- Global leaderboard client (Netlify Function + Blobs at /api/scores).
// Fully optional: if the endpoint isn't there, everything degrades to
// local bests and the leaderboard screen says so.
export async function fetchLeaderboard(): Promise<ScoreRow[] | null> {
  try {
    const res = await fetch('/api/scores', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('bad payload');
    return data;
  } catch (e) {
    return null;
  }
}

export async function submitScore(name: string, level: number, difficulty: Difficulty): Promise<boolean> {
  try {
    const res = await fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, level, difficulty }),
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}
