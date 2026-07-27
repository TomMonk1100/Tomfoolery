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
  /** Lowest altitude represented by the compressed below-horizon curve. */
  minAltitude?: number;
  /** Pixel depth reserved for the below-horizon curve. */
  belowBand?: number;
}

export interface Span { from: number; to: number; }

export interface HorizonEvent {
  kind: 'rise' | 'set';
  /** Elapsed minutes from the beginning of this ribbon window. */
  minute: number;
  /** Interpolated instant of the horizon crossing. */
  at: Date;
}

export interface RibbonWindow {
  start: Date;
  end: Date;
  /** Real elapsed length of the axis. */
  durationMinutes: number;
  /** Location of the requested `now`, or null for a calendar-day ribbon. */
  focusMinute: number | null;
}

export interface RibbonModel {
  sunPath: string;
  moonPath: string;
  /** Compressed, below-horizon continuation of the solar curve. */
  sunBelowPath: string;
  /** Compressed, below-horizon continuation of the lunar curve. */
  moonBelowPath: string;
  /** Below civil twilight (-6 degrees): the "it is properly dark" spans. */
  nightSpans: Span[];
  /** Sun between -4 and +6 degrees. */
  goldenSpans: Span[];
  sunUp: Span[];
  /** When the moon is above the horizon — drives the moonrise/set labels. */
  moonUp: Span[];
  sunEvents: HorizonEvent[];
  moonEvents: HorizonEvent[];
  window: RibbonWindow;
}

export interface RollingRibbonOptions {
  /** Real elapsed time shown before `now`. Defaults to six hours. */
  beforeMinutes?: number;
  /** Total real elapsed duration of the window. Defaults to 24 hours. */
  durationMinutes?: number;
  /** Sampling interval. Defaults to six minutes. */
  stepMinutes?: number;
}

interface CelestialSample {
  m: number;
  alt: number;
  at: Date;
}

/** Elapsed minutes from the beginning of the window -> x. */
export function timeToX(
  minutes: number,
  g: RibbonGeometry,
  durationMinutes = 1440,
): number {
  return (minutes / durationMinutes) * g.width;
}

/** Altitude in degrees -> y, clamped at the horizon. */
export function altToY(deg: number, g: RibbonGeometry): number {
  const t = Math.max(0, Math.min(1, deg / g.maxAltitude));
  return g.baseline - t * (g.baseline - 6);
}

/**
 * Signed altitude -> y. Positive altitude uses the full upper plot while
 * negative altitude is compressed into a quiet lower band. This keeps the
 * continuation legible without letting an invisible body dominate the chart.
 */
export function altToPlotY(deg: number, g: RibbonGeometry): number {
  if (deg >= 0) return altToY(deg, g);

  const available = Math.max(0, g.height - g.baseline - 6);
  const band = Math.min(
    available,
    Math.max(0, g.belowBand ?? Math.min(42, available)),
  );
  const minimum = Math.min(-0.001, g.minAltitude ?? -90);
  const t = Math.max(0, Math.min(1, deg / minimum));
  return g.baseline + t * band;
}

function crossingBetween(
  from: CelestialSample,
  to: CelestialSample,
): CelestialSample {
  const denominator = from.alt - to.alt;
  const fraction = denominator === 0 ? 0.5 : from.alt / denominator;
  return {
    m: from.m + (to.m - from.m) * fraction,
    alt: 0,
    at: new Date(
      from.at.valueOf() + (to.at.valueOf() - from.at.valueOf()) * fraction,
    ),
  };
}

function clippedCurve(
  samples: CelestialSample[],
  g: RibbonGeometry,
  durationMinutes: number,
  side: 'above' | 'below',
): string {
  if (samples.length === 0) return '';
  const includes = side === 'above'
    ? (altitude: number) => altitude >= 0
    : (altitude: number) => altitude <= 0;
  const segments: CelestialSample[][] = [];
  let segment: CelestialSample[] = [];

  const append = (sample: CelestialSample) => {
    const last = segment[segment.length - 1];
    if (
      !last
      || Math.abs(last.m - sample.m) > 1e-7
      || Math.abs(last.alt - sample.alt) > 1e-7
    ) {
      segment.push(sample);
    }
  };
  const finish = () => {
    if (segment.length > 0) segments.push(segment);
    segment = [];
  };

  if (samples.length === 1 && includes(samples[0].alt)) {
    segments.push([samples[0]]);
  }

  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const sample = samples[index];
    const previousInside = includes(previous.alt);
    const inside = includes(sample.alt);

    if (previousInside && inside) {
      append(previous);
      append(sample);
    } else if (previousInside) {
      append(previous);
      append(crossingBetween(previous, sample));
      finish();
    } else if (inside) {
      append(crossingBetween(previous, sample));
      append(sample);
    }
  }
  finish();

  return segments
    .map((points) =>
      points
        .map((sample, index) => {
          const x = timeToX(sample.m, g, durationMinutes).toFixed(1);
          const y = altToPlotY(sample.alt, g).toFixed(1);
          return `${index === 0 ? 'M' : 'L'}${x},${y}`;
        })
        .join(' '))
    .join(' ');
}

function spansWhere(
  samples: CelestialSample[],
  test: (alt: number) => boolean,
  endMinute: number,
): Span[] {
  if (samples.length === 0) return [];

  const out: Span[] = [];
  let previous = samples[0];
  let previousMatches = test(previous.alt);
  let start: number | null = previousMatches ? previous.m : null;

  for (let index = 1; index < samples.length; index++) {
    const sample = samples[index];
    const matches = test(sample.alt);

    if (matches !== previousMatches) {
      // Altitude changes smoothly across a six-minute sample. Find the point
      // where the predicate flips on that straight segment rather than
      // snapping moonrise/set (and the solar spans) to the next sample.
      let low = 0;
      let high = 1;
      for (let iteration = 0; iteration < 24; iteration++) {
        const fraction = (low + high) / 2;
        const altitude =
          previous.alt + (sample.alt - previous.alt) * fraction;
        if (test(altitude) === previousMatches) low = fraction;
        else high = fraction;
      }
      const crossing =
        previous.m + (sample.m - previous.m) * ((low + high) / 2);

      if (matches) {
        start = crossing;
      } else if (start !== null) {
        out.push({ from: start, to: crossing });
        start = null;
      }
    }

    previous = sample;
    previousMatches = matches;
  }

  if (start !== null) out.push({ from: start, to: endMinute });
  return out.filter((span) => span.to - span.from > 1e-7);
}

function horizonEvents(samples: CelestialSample[]): HorizonEvent[] {
  const events: HorizonEvent[] = [];
  for (let index = 1; index < samples.length; index++) {
    const previous = samples[index - 1];
    const sample = samples[index];
    const wasAbove = previous.alt > 0;
    const isAbove = sample.alt > 0;
    if (wasAbove === isAbove) continue;

    const crossing = crossingBetween(previous, sample);
    events.push({
      kind: isAbove ? 'rise' : 'set',
      minute: crossing.m,
      at: crossing.at,
    });
  }
  return events;
}

function validateWindow(
  durationMinutes: number,
  stepMinutes: number,
  focusMinute: number | null,
) {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw new RangeError('Ribbon duration must be a positive number of minutes');
  }
  if (!Number.isFinite(stepMinutes) || stepMinutes <= 0) {
    throw new RangeError('Ribbon sample step must be a positive number of minutes');
  }
  if (
    focusMinute !== null
    && (
      !Number.isFinite(focusMinute)
      || focusMinute < 0
      || focusMinute > durationMinutes
    )
  ) {
    throw new RangeError('Ribbon focus must fall inside the window');
  }
}

function sampleOffsets(durationMinutes: number, stepMinutes: number): number[] {
  const offsets: number[] = [];
  for (let minute = 0; minute < durationMinutes; minute += stepMinutes) {
    offsets.push(minute);
  }
  if (
    offsets.length === 0
    || Math.abs(offsets[offsets.length - 1] - durationMinutes) > 1e-7
  ) {
    offsets.push(durationMinutes);
  }
  return offsets;
}

function assembleRibbon(
  sun: CelestialSample[],
  moon: CelestialSample[],
  g: RibbonGeometry,
  window: RibbonWindow,
): RibbonModel {
  const duration = window.durationMinutes;
  return {
    sunPath: clippedCurve(sun, g, duration, 'above'),
    moonPath: clippedCurve(moon, g, duration, 'above'),
    sunBelowPath: clippedCurve(sun, g, duration, 'below'),
    moonBelowPath: clippedCurve(moon, g, duration, 'below'),
    nightSpans: spansWhere(sun, (altitude) => altitude < -6, duration),
    goldenSpans: spansWhere(
      sun,
      (altitude) => altitude >= -4 && altitude <= 6,
      duration,
    ),
    sunUp: spansWhere(sun, (altitude) => altitude > 0, duration),
    moonUp: spansWhere(moon, (altitude) => altitude > 0, duration),
    sunEvents: horizonEvents(sun),
    moonEvents: horizonEvents(moon),
    window,
  };
}

/**
 * Compatibility entry point for calendar-day consumers. The live Outside
 * component uses `buildRollingRibbon()` below.
 *
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
  const durationMinutes = 1440;
  validateWindow(durationMinutes, stepMinutes, null);
  const sun: CelestialSample[] = [];
  const moon: CelestialSample[] = [];
  for (const m of sampleOffsets(durationMinutes, stepMinutes)) {
    const t = instantAtMinutes(m);
    if (!t || !Number.isFinite(t.valueOf())) continue;
    sun.push({ m, at: t, alt: sunPosition(t, lat, lon).altitude });
    moon.push({ m, at: t, alt: moonPosition(t, lat, lon).altitude });
  }
  const end = sun.findLast((sample) => sample.m === durationMinutes)?.at
    ?? new Date(dayStart.valueOf() + durationMinutes * 60_000);
  return assembleRibbon(sun, moon, g, {
    start: new Date(dayStart.valueOf()),
    end: new Date(end.valueOf()),
    durationMinutes,
    focusMinute: null,
  });
}

/**
 * Build a continuous, real-elapsed celestial window around `now`.
 *
 * The default view begins six hours ago and ends eighteen hours from now.
 * Because samples advance as absolute instants, midnight and daylight-saving
 * boundaries are ordinary points on the axis rather than seams.
 */
export function buildRollingRibbon(
  now: Date,
  lat: number,
  lon: number,
  g: RibbonGeometry,
  options: RollingRibbonOptions = {},
): RibbonModel {
  if (!Number.isFinite(now.valueOf())) {
    throw new RangeError('Ribbon focus instant must be a valid date');
  }
  const beforeMinutes = options.beforeMinutes ?? 360;
  const durationMinutes = options.durationMinutes ?? 1440;
  const stepMinutes = options.stepMinutes ?? 6;
  validateWindow(durationMinutes, stepMinutes, beforeMinutes);

  const start = new Date(now.valueOf() - beforeMinutes * 60_000);
  const end = new Date(start.valueOf() + durationMinutes * 60_000);
  const sun: CelestialSample[] = [];
  const moon: CelestialSample[] = [];
  for (const minute of sampleOffsets(durationMinutes, stepMinutes)) {
    const at = new Date(start.valueOf() + minute * 60_000);
    sun.push({ m: minute, at, alt: sunPosition(at, lat, lon).altitude });
    moon.push({ m: minute, at, alt: moonPosition(at, lat, lon).altitude });
  }
  return assembleRibbon(sun, moon, g, {
    start,
    end,
    durationMinutes,
    focusMinute: beforeMinutes,
  });
}

/** Rounded label for an hour tick. */
export function hourLabel(hour: number): string {
  const h = hour % 24;
  if (h === 0) return '12a';
  if (h === 12) return '12p';
  return h < 12 ? `${h}a` : `${h - 12}p`;
}
