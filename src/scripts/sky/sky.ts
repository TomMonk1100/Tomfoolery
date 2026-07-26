/**
 * Sky appearance as a function of solar altitude, plus the horizon silhouette.
 * Pure and side-effect free so it can be unit tested without a DOM.
 */

export type RGB = [number, number, number];

/**
 * Gradient stops keyed to solar altitude in degrees. Below about -18 the sky
 * is fully dark (astronomical twilight ends); the orange band appears within a
 * few degrees of the horizon, which is why the stops bunch up around zero.
 */
const STOPS: { alt: number; top: RGB; bottom: RGB }[] = [
  { alt: -32, top: [9, 13, 30],    bottom: [17, 22, 48] },
  { alt: -18, top: [14, 20, 45],   bottom: [28, 30, 62] },
  { alt: -12, top: [22, 32, 74],   bottom: [54, 44, 86] },
  { alt: -6,  top: [40, 52, 100],  bottom: [140, 84, 88] },
  { alt: -3,  top: [46, 58, 107],  bottom: [168, 96, 86] },
  { alt: 0,   top: [74, 90, 140],  bottom: [224, 138, 74] },
  { alt: 6,   top: [126, 154, 192],bottom: [240, 176, 114] },
  { alt: 12,  top: [145, 175, 205],bottom: [238, 200, 158] },
  { alt: 20,  top: [157, 188, 216],bottom: [232, 215, 189] },
  { alt: 45,  top: [168, 203, 224],bottom: [221, 234, 240] },
  { alt: 90,  top: [156, 196, 222],bottom: [230, 240, 242] },
];

const lerp = (a: RGB, b: RGB, t: number): RGB =>
  [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];

export function skyColors(altitude: number): { top: RGB; bottom: RGB } {
  if (altitude <= STOPS[0].alt) return { top: STOPS[0].top, bottom: STOPS[0].bottom };
  const last = STOPS[STOPS.length - 1];
  if (altitude >= last.alt) return { top: last.top, bottom: last.bottom };
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i + 1];
    if (altitude >= a.alt && altitude <= b.alt) {
      const t = (altitude - a.alt) / (b.alt - a.alt);
      return { top: lerp(a.top, b.top, t), bottom: lerp(a.bottom, b.bottom, t) };
    }
  }
  return { top: last.top, bottom: last.bottom };
}

export const cssRGB = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Relative luminance (WCAG), used to decide light-on-dark vs dark-on-light. */
export function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Alpha-composite a colour over a background. */
export function composite(bg: RGB, over: RGB, alpha: number): RGB {
  return [
    bg[0] * (1 - alpha) + over[0] * alpha,
    bg[1] * (1 - alpha) + over[1] * alpha,
    bg[2] * (1 - alpha) + over[2] * alpha,
  ];
}

const INK_DARK = '#221A12';
const INK_LIGHT = '#F7F1E6';
const SCRIM_DARK: RGB = [8, 10, 20];
const SCRIM_LIGHT: RGB = [252, 248, 240];
/**
 * No single ink pair clears WCAG AA against every sky: around +5° altitude the
 * zenith sits at mid-luminance and both dark and light text bottom out near
 * 3.9:1. A scrim behind the copy is the fix. 0.35 is the smallest alpha that
 * holds 4.5:1 everywhere (worst case 5.3:1 at +5.5°) while still reading as
 * sky rather than as a panel.
 */
const SCRIM_ALPHA = 0.35;
/** Flip to light text a little before true mid-grey, where light text wins. */
const DARK_THRESHOLD = 0.30;

/**
 * Text treatment for a given sky. The band's copy sits over the TOP of the
 * gradient, so that's the colour that decides legibility — at sunset the
 * bottom is bright orange while the top is still deep blue.
 */
export function skyTheme(altitude: number) {
  const { top } = skyColors(altitude);
  const dark = luminance(top) < DARK_THRESHOLD;
  const scrim = dark ? SCRIM_DARK : SCRIM_LIGHT;
  return {
    dark,
    ink: dark ? INK_LIGHT : INK_DARK,
    dim: dark ? 'rgba(247,241,230,.72)' : 'rgba(34,26,18,.66)',
    line: dark ? 'rgba(247,241,230,.22)' : 'rgba(34,26,18,.16)',
    panel: dark ? 'rgba(10,12,24,.32)' : 'rgba(255,255,255,.36)',
    scrim: `rgba(${scrim[0]},${scrim[1]},${scrim[2]},${SCRIM_ALPHA})`,
    /** Sky as the eye actually sees it behind the copy, for contrast checks. */
    effectiveBackground: composite(top, scrim, SCRIM_ALPHA),
  };
}

/** Star opacity: none in daylight, full once astronomical twilight has ended. */
export function starOpacity(altitude: number): number {
  if (altitude > -4) return 0;
  return Math.min(1, (-altitude - 4) / 12);
}

/**
 * Deterministic ridge silhouette. Seeded so it never reflows between renders
 * or between server and client.
 */
export function ridgePath(width: number, height: number, seed: number, amplitude: number, baseline: number): string {
  let state = seed;
  const rnd = () => { state = (state * 9301 + 49297) % 233280; return state / 233280; };
  let x = 0, y = baseline;
  let d = `M0,${height} L0,${y.toFixed(1)}`;
  while (x < width) {
    x = Math.min(width, x + 40 + rnd() * 90);
    y = Math.max(height * 0.12, Math.min(height * 0.92, y + (rnd() - 0.5) * amplitude));
    d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return `${d} L${width},${height} Z`;
}

/** Colour ramp for the UV index, matching the site palette. */
export function uvColor(uv: number): string {
  if (uv < 3) return 'var(--color-accent-2)';
  if (uv < 6) return 'var(--color-signal)';
  if (uv < 8) return 'var(--color-accent-mid)';
  return 'var(--color-accent)';
}

export function uvLabel(uv: number): string {
  if (uv < 3) return 'low';
  if (uv < 6) return 'moderate';
  if (uv < 8) return 'high';
  if (uv < 11) return 'very high';
  return 'extreme';
}

/**
 * Horizon silhouette colours, derived from the sky so the ridge belongs to it —
 * warm-dark at sunset, near-black at night, cool grey at noon. A fixed grey
 * ridge reads as construction paper against a sky that is actually changing.
 *
 * The far ridge is lifted toward the sky colour (aerial perspective: distant
 * terrain takes on the colour of the air in front of it).
 */
export function ridgeColors(altitude: number): { near: string; far: string } {
  const { bottom } = skyColors(altitude);
  const shade = (factor: number, towardSky: number): string => {
    const c = bottom.map((v) => v * factor) as RGB;
    const blended = composite(c, bottom, towardSky);
    return `rgb(${blended.map((v) => Math.round(v)).join(',')})`;
  };
  return { near: shade(0.22, 0.06), far: shade(0.42, 0.3) };
}
