/**
 * Pure selection model for the Breckenridge photographic sky plates.
 *
 * Astronomy remains local and authoritative. Weather chooses one of four
 * visual families, while the sun's actual motion chooses one of eight
 * time-of-day moments. DOM loading and crossfades belong to the component.
 */

import { sunPosition } from './astro';

export const PLATE_CONDITIONS = Object.freeze([
  'clear',
  'scattered',
  'overcast',
  'storm',
] as const);

export type PlateCondition = (typeof PLATE_CONDITIONS)[number];

/**
 * Stable chronological order for one solar cycle. Keep this in sync with the
 * generated plate manifest and its on-disk directory names.
 */
export const SOLAR_MOMENTS = Object.freeze([
  'night',
  'predawn',
  'sunrise',
  'morning',
  'noon',
  'golden',
  'sunset',
  'blue-hour',
] as const);

export type SolarMoment = (typeof SOLAR_MOMENTS)[number];

export const BRECKENRIDGE_PLATE_LOCATION = Object.freeze({
  name: 'Breckenridge, TX',
  latitude: 32.7557,
  longitude: -98.9023,
  timeZone: 'America/Chicago',
} as const);

export const PLATE_ASSET_ROOT = '/images/outside/plates';
export const PLATE_BLEND_MINUTES = 12;
export const MAX_PLATE_BLEND_MINUTES = 30;

export const PLATE_MANIFEST = Object.freeze({
  version: 1,
  location: BRECKENRIDGE_PLATE_LOCATION,
  conditions: PLATE_CONDITIONS,
  solarMoments: SOLAR_MOMENTS,
  assetRoot: PLATE_ASSET_ROOT,
} as const);

export interface PlateWeatherSnapshot {
  /** Open-Meteo WMO weather code. */
  code?: number | null;
  /** Current total cloud cover, 0–100 percent. */
  cloud?: number | null;
  /** Current precipitation intensity in millimetres per hour. */
  precipitation?: number | null;
}

const STORM_CODES = new Set([65, 82, 95, 96, 99]);
const OVERCAST_CODES = new Set([
  3, 45, 48,
  51, 53, 55, 56, 57,
  61, 63, 66, 67,
  71, 73, 75, 77,
  80, 81, 85, 86,
]);
const SCATTERED_CODES = new Set([1, 2]);

const finiteOr = (value: number | null | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * Map live weather to the four authored visual families.
 *
 * Severe/current precipitation wins over cloud cover, then explicit weather
 * codes win over the cloud percentage. This prevents a thunderstorm code with
 * a stale low cloud reading from incorrectly selecting a clear plate.
 */
export function classifyPlateCondition(weather: PlateWeatherSnapshot | null | undefined): PlateCondition {
  const code = finiteOr(weather?.code, 0);
  const cloud = Math.max(0, Math.min(100, finiteOr(weather?.cloud, 0)));
  const precipitation = Math.max(0, finiteOr(weather?.precipitation, 0));

  if (STORM_CODES.has(code) || precipitation >= 2.5) return 'storm';
  if (OVERCAST_CODES.has(code) || precipitation > 0 || cloud >= 80) return 'overcast';
  if (SCATTERED_CODES.has(code) || cloud >= 20) return 'scattered';
  return 'clear';
}

export interface SolarMomentAnchor {
  moment: SolarMoment;
  /** Absolute Unix timestamp in milliseconds. */
  at: number;
  /** Solar altitude at the authored moment. */
  altitude: number;
  /** True on the morning climb, false on the evening descent, null at extrema. */
  rising: boolean | null;
}

export interface PlateSchedule {
  readonly location: typeof BRECKENRIDGE_PLATE_LOCATION;
  readonly around: number;
  /**
   * Multiple consecutive solar cycles, sorted by timestamp, so callers can
   * safely resolve frames across local midnight without rebuilding.
   */
  readonly anchors: readonly SolarMomentAnchor[];
}

interface SolarSample {
  at: number;
  altitude: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SAMPLE_STEP = 2 * MINUTE;
const SCHEDULE_RADIUS = 36 * HOUR;

function assertTimestamp(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new RangeError(`${label} must be a valid date or timestamp`);
  return value;
}

function timestamp(value: Date | number, label: string): number {
  return assertTimestamp(value instanceof Date ? value.valueOf() : value, label);
}

function crossingTime(a: SolarSample, b: SolarSample, threshold: number): number {
  const span = b.altitude - a.altitude;
  if (span === 0) return a.at;
  const mix = Math.max(0, Math.min(1, (threshold - a.altitude) / span));
  return a.at + (b.at - a.at) * mix;
}

function freezeAnchor(anchor: SolarMomentAnchor): SolarMomentAnchor {
  return Object.freeze(anchor);
}

/**
 * Build a location-specific solar schedule for the single authored atlas.
 *
 * A rolling absolute-time window deliberately avoids browser-time-zone math:
 * `sunPosition()` receives real instants, so Breckenridge remains correct even
 * when the viewer's computer is set to another time zone.
 */
export function buildBreckenridgeSolarSchedule(around: Date | number): PlateSchedule {
  const center = timestamp(around, 'around');
  const start = center - SCHEDULE_RADIUS;
  const end = center + SCHEDULE_RADIUS;
  const samples: SolarSample[] = [];

  for (let at = start; at <= end; at += SAMPLE_STEP) {
    samples.push({
      at,
      altitude: sunPosition(
        new Date(at),
        BRECKENRIDGE_PLATE_LOCATION.latitude,
        BRECKENRIDGE_PLATE_LOCATION.longitude,
      ).altitude,
    });
  }

  const anchors: SolarMomentAnchor[] = [];
  const addCrossing = (
    a: SolarSample,
    b: SolarSample,
    threshold: number,
    rising: boolean,
    moment: SolarMoment,
  ) => {
    const crossed = rising
      ? a.altitude < threshold && b.altitude >= threshold
      : a.altitude > threshold && b.altitude <= threshold;
    if (!crossed) return;
    anchors.push(freezeAnchor({
      moment,
      at: crossingTime(a, b, threshold),
      altitude: threshold,
      rising,
    }));
  };

  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    addCrossing(a, b, -9, true, 'predawn');
    addCrossing(a, b, 0, true, 'sunrise');
    addCrossing(a, b, 18, true, 'morning');
    addCrossing(a, b, 18, false, 'golden');
    addCrossing(a, b, 0, false, 'sunset');
    addCrossing(a, b, -9, false, 'blue-hour');
  }

  for (let i = 1; i < samples.length - 1; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const c = samples[i + 1];
    const climbedInto = b.altitude > a.altitude;
    const climbsOut = c.altitude > b.altitude;
    if (climbedInto && !climbsOut) {
      anchors.push(freezeAnchor({
        moment: 'noon',
        at: b.at,
        altitude: b.altitude,
        rising: null,
      }));
    } else if (!climbedInto && climbsOut) {
      anchors.push(freezeAnchor({
        moment: 'night',
        at: b.at,
        altitude: b.altitude,
        rising: null,
      }));
    }
  }

  anchors.sort((a, b) => a.at - b.at);
  if (anchors.length < SOLAR_MOMENTS.length + 2) {
    throw new Error('Could not build a complete Breckenridge solar schedule');
  }

  return Object.freeze({
    location: BRECKENRIDGE_PLATE_LOCATION,
    around: center,
    anchors: Object.freeze(anchors),
  });
}

export interface PlateFrame {
  /** Plate visible before the next boundary. */
  from: SolarMoment;
  /** Chronologically following plate; preload this even when mix is zero. */
  to: SolarMoment;
  /** Smooth 0–1 opacity mix, non-zero only inside the short boundary window. */
  mix: number;
  /** Midpoint between the two authored solar anchors. */
  boundaryAt: number | null;
  transitioning: boolean;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothstep = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

/**
 * Resolve the sharp plate frame for an instant.
 *
 * Most of the day `mix` is zero. It rises only during a short window centred
 * on the midpoint between adjacent authored moments, avoiding hours of
 * double-exposure ghosting while keeping the handoff unobtrusive.
 */
export function plateFrameAt(
  now: Date | number,
  schedule: PlateSchedule,
  blendMinutes = PLATE_BLEND_MINUTES,
): PlateFrame {
  const at = timestamp(now, 'now');
  const anchors = schedule.anchors;
  if (anchors.length < 2) throw new RangeError('schedule must contain at least two anchors');

  const safeBlendMinutes = Math.max(
    0,
    Math.min(
      MAX_PLATE_BLEND_MINUTES,
      Number.isFinite(blendMinutes) ? blendMinutes : PLATE_BLEND_MINUTES,
    ),
  );
  const blendWindow = safeBlendMinutes * MINUTE;
  const halfWindow = blendWindow / 2;

  if (blendWindow > 0) {
    for (let i = 0; i < anchors.length - 1; i++) {
      const from = anchors[i];
      const to = anchors[i + 1];
      const boundaryAt = from.at + (to.at - from.at) / 2;
      const start = boundaryAt - halfWindow;
      const end = boundaryAt + halfWindow;
      if (at >= start && at <= end) {
        const mix = smoothstep((at - start) / blendWindow);
        return {
          from: from.moment,
          to: to.moment,
          mix,
          boundaryAt,
          transitioning: mix > 0 && mix < 1,
        };
      }
    }
  }

  // Outside a transition window, choose the nearest authored anchor. Midpoint
  // boundaries make this stable through the night→predawn wrap.
  let current = 0;
  for (let i = 0; i < anchors.length - 1; i++) {
    const boundaryAt = anchors[i].at + (anchors[i + 1].at - anchors[i].at) / 2;
    if (at >= boundaryAt) current = i + 1;
    else break;
  }
  const next = Math.min(current + 1, anchors.length - 1);
  return {
    from: anchors[current].moment,
    to: anchors[next].moment,
    mix: 0,
    boundaryAt: current === next
      ? null
      : anchors[current].at + (anchors[next].at - anchors[current].at) / 2,
    transitioning: false,
  };
}

export function isPlateCondition(value: unknown): value is PlateCondition {
  return typeof value === 'string' && (PLATE_CONDITIONS as readonly string[]).includes(value);
}

export function isSolarMoment(value: unknown): value is SolarMoment {
  return typeof value === 'string' && (SOLAR_MOMENTS as readonly string[]).includes(value);
}

/**
 * Extension-free public path. The compositor may append `.avif`, `.webp`, or
 * `.png` without accepting arbitrary path fragments from weather data.
 */
export function plateAssetBase(condition: PlateCondition, moment: SolarMoment): string {
  if (!isPlateCondition(condition)) throw new TypeError(`Unknown plate condition: ${String(condition)}`);
  if (!isSolarMoment(moment)) throw new TypeError(`Unknown solar moment: ${String(moment)}`);
  return `${PLATE_ASSET_ROOT}/${condition}/${moment}`;
}
