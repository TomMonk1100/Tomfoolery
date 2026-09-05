// ---------------------------------------------------------------------------
// v12 graphics overhaul — shared light direction + color helpers.
//
// Every lit/shadow decision anywhere in the renderer imports LIGHT from
// here rather than hard-coding a direction, so the whole game stays under
// one consistent "sun." shade() is the one place RGB lighten/darken math
// lives; depthTint() gives deeper runs a subtly colder, moodier overlay
// without ever replacing the equipped sky theme (I5).
// ---------------------------------------------------------------------------

// Normalized sun direction — upper-left, matching the game's existing
// beacon/highlight conventions (rim lights, surface highlights, etc. all
// key off this one vector from Commit 1 onward).
export const LIGHT = { x: -0.55, y: -0.83 };

export type EnvironmentPreset = { name: 'First Light' | 'Rust Basin' | 'Blue Rift'; farRidge: string; nearRidge: string; rock: string; rockDark: string; highlight: string };

/** Authored visual bands only; collision terrain remains untouched. */
export function environmentPreset(levelIndex: number): EnvironmentPreset {
  const band = Math.floor(levelIndex / 5) % 3;
  if (band === 1) return { name: 'Rust Basin', farRidge: '#6b4a42', nearRidge: '#563c38', rock: '#795744', rockDark: '#3f2924', highlight: '#E9DFC8' };
  if (band === 2) return { name: 'Blue Rift', farRidge: '#455d70', nearRidge: '#344656', rock: '#596775', rockDark: '#293744', highlight: '#D4EEF1' };
  return { name: 'First Light', farRidge: '#344656', nearRidge: '#45515B', rock: '#796653', rockDark: '#3f382f', highlight: '#E9DFC8' };
}

// Parses a `#rrggbb` hex color, multiplies each channel by (1 + amt)
// (amt in roughly -1..1; clamped to 0-255 per channel), returns a new
// `#rrggbb` hex string. amt=0 is a no-op (returns the same color).
export function shade(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v * (1 + amt))));
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(clamp(r))}${toHex(clamp(g))}${toHex(clamp(b))}`;
}

// Deeper runs get a subtly colder, moodier tint — alpha ramps 0 -> 0.16
// linearly over levels 0..30 (clamped beyond 30), cold indigo (#1c2433).
// Painted as a plain overlay on TOP of the equipped sky theme (never
// replaces theme colors — I5).
export function depthTint(levelIndex: number): { color: string; alpha: number } {
  const alpha = Math.max(0, Math.min(0.16, (levelIndex / 30) * 0.16));
  return { color: '#1c2433', alpha };
}
