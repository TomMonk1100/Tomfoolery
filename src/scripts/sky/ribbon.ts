/**
 * The shared 24-hour axis: sun and moon altitude curves, twilight shading,
 * golden hour and the ISS pass, all on one timeline.
 *
 * The point of one axis instead of two side-by-side arcs is that it makes the
 * relationships legible — that the ISS crosses well after dark, or that the
 * moon is already up before sunset. Geometry only; the component does the DOM.
 */

import { sunPosition, moonPosition } from './astro';

export interface RibbonGeometry {
  width: number;
  height: number;
  /** y of the horizon line. */
  baseline: number;
  /** Altitude in degrees mapped to the top of the plot. */
  maxAltitude: number;
}

export interface Span { from: number; to: number; }

export interface RibbonModel {
  sunPath: string;
  moonPath: string;
  /** Below civil twilight (-6 degrees): the "it is properly dark" spans. */
  nightSpans: Span[];
  /** Sun between -4 and +6 degrees. */
  goldenSpans: Span[];
  sunUp: Span[];
  /** When the moon is above the horizon — drives the moonrise/set labels. */
  moonUp: Span[];
}

/** Minutes since local midnight -> x. */
export function timeToX(minutes: number, g: RibbonGeometry): number {
  return (minutes / 1440) * g.width;
}

/** Altitude in degrees -> y, clamped at the horizon. */
export function altToY(deg: number, g: RibbonGeometry): number {
  const t = Math.max(0, Math.min(1, deg / g.maxAltitude));
  return g.baseline - t * (g.baseline - 6);
}

function curve(
  samples: { m: number; alt: number }[],
  g: RibbonGeometry
): string {
  // Break the path wherever the body is below the horizon so we do not draw a
  // flat line along the baseline for half the day.
  let d = '';
  let open = false;
  for (const s of samples) {
    if (s.alt <= 0) { open = false; continue; }
    const x = timeToX(s.m, g).toFixed(1);
    const y = altToY(s.alt, g).toFixed(1);
    d += `${open ? ' L' : ' M'}${x},${y}`;
    open = true;
  }
  return d.trim();
}

function spansWhere(
  samples: { m: number; alt: number }[],
  test: (alt: number) => boolean,
  stepMinutes: number
): Span[] {
  const out: Span[] = [];
  let start: number | null = null;
  for (const s of samples) {
    if (test(s.alt)) {
      if (start === null) start = s.m;
    } else if (start !== null) {
      out.push({ from: start, to: s.m });
      start = null;
    }
  }
  if (start !== null) out.push({ from: start, to: 1440 });
  return out.filter((s) => s.to - s.from >= stepMinutes);
}

/**
 * Build the day's geometry. `dayStart` must be local midnight for the location.
 * Sampling every 6 minutes is enough for a curve this size and keeps the whole
 * build under a millisecond. Locations with daylight-saving transitions can
 * provide `instantAtMinutes` so wall-clock x positions remain correct on
 * 23/25-hour days.
 */
export function buildRibbon(
  dayStart: Date,
  lat: number,
  lon: number,
  g: RibbonGeometry,
  stepMinutes = 6,
  instantAtMinutes: (minutes: number) => Date | null = (minutes: number) =>
    new Date(dayStart.valueOf() + minutes * 60000),
): RibbonModel {
  const sun: { m: number; alt: number }[] = [];
  const moon: { m: number; alt: number }[] = [];
  for (let m = 0; m <= 1440; m += stepMinutes) {
    const t = instantAtMinutes(m);
    if (!t || !Number.isFinite(t.valueOf())) continue;
    sun.push({ m, alt: sunPosition(t, lat, lon).altitude });
    moon.push({ m, alt: moonPosition(t, lat, lon).altitude });
  }
  return {
    sunPath: curve(sun, g),
    moonPath: curve(moon, g),
    nightSpans: spansWhere(sun, (a) => a < -6, stepMinutes),
    goldenSpans: spansWhere(sun, (a) => a >= -4 && a <= 6, stepMinutes),
    sunUp: spansWhere(sun, (a) => a > 0, stepMinutes),
    moonUp: spansWhere(moon, (a) => a > 0, stepMinutes),
  };
}

/** Rounded label for an hour tick. */
export function hourLabel(hour: number): string {
  const h = hour % 24;
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
