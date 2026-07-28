/**
 * Pure weather-forecast models for the Outside almanac.
 *
 * Open-Meteo is requested with `timeformat=unixtime`, so every hour remains
 * an absolute instant even when the viewer is outside Breckenridge or a
 * daylight-saving boundary falls inside the chart.
 */

import type { RibbonWindow } from './ribbon';

const HOUR_MS = 60 * 60_000;
const STORM_CODES = new Set([65, 82, 95, 96, 99]);

export interface ForecastHour {
  /** Absolute Unix timestamp in milliseconds. */
  at: number;
  temperature: number | null;
  weatherCode: number | null;
  lowCloud: number | null;
  midCloud: number | null;
  highCloud: number | null;
  precipitationProbability: number | null;
}

interface OpenMeteoHourly {
  time?: unknown;
  temperature_2m?: unknown;
  weather_code?: unknown;
  cloud_cover_low?: unknown;
  cloud_cover_mid?: unknown;
  cloud_cover_high?: unknown;
  precipitation_probability?: unknown;
}

export interface TemperatureTraceGeometry {
  width: number;
  top: number;
  bottom: number;
  /** Minimum visible Fahrenheit range. Prevents tiny changes looking severe. */
  minSpan?: number;
}

export interface TemperatureTracePoint {
  at: number;
  temperature: number;
  x: number;
  y: number;
}

export interface TemperatureTrace {
  path: string;
  points: readonly TemperatureTracePoint[];
  min: number;
  max: number;
  scaleMin: number;
  scaleMax: number;
}

export type SunsetPotentialBand =
  | 'promising'
  | 'mixed'
  | 'subtle'
  | 'obscured';

export interface SunsetPotential {
  band: SunsetPotentialBand;
  sampleCount: number;
  lowCloud: number;
  midCloud: number;
  highCloud: number;
  precipitationProbability: number;
}

const finite = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const percentage = (value: unknown): number | null => {
  const number = finite(value);
  return number === null ? null : Math.max(0, Math.min(100, number));
};

const ranged = (
  value: unknown,
  minimum: number,
  maximum: number,
): number | null => {
  const number = finite(value);
  return number !== null && number >= minimum && number <= maximum
    ? number
    : null;
};

const valueAt = (value: unknown, index: number): unknown =>
  Array.isArray(value) ? value[index] : undefined;

function normalizeHour(value: unknown): ForecastHour | null {
  if (!value || typeof value !== 'object') return null;
  const hour = value as Partial<ForecastHour>;
  const at = finite(hour.at);
  if (at === null) return null;
  return {
    at,
    temperature: ranged(hour.temperature, -150, 160),
    weatherCode: ranged(hour.weatherCode, 0, 99),
    lowCloud: percentage(hour.lowCloud),
    midCloud: percentage(hour.midCloud),
    highCloud: percentage(hour.highCloud),
    precipitationProbability: percentage(hour.precipitationProbability),
  };
}

/**
 * Zip an Open-Meteo hourly object into safe, absolute forecast samples.
 * Malformed timestamps are discarded; missing variables remain explicitly
 * null so a renderer never turns absent data into a plausible-looking zero.
 */
export function parseOpenMeteoHourly(
  input: OpenMeteoHourly | null | undefined,
): ForecastHour[] {
  const times = Array.isArray(input?.time) ? input.time : [];
  const hours: ForecastHour[] = [];

  for (let index = 0; index < times.length; index++) {
    const seconds = finite(times[index]);
    if (seconds === null) continue;
    const hour = normalizeHour({
      at: seconds * 1000,
      temperature: valueAt(input?.temperature_2m, index),
      weatherCode: valueAt(input?.weather_code, index),
      lowCloud: valueAt(input?.cloud_cover_low, index),
      midCloud: valueAt(input?.cloud_cover_mid, index),
      highCloud: valueAt(input?.cloud_cover_high, index),
      precipitationProbability: valueAt(
        input?.precipitation_probability,
        index,
      ),
    });
    if (hour) hours.push(hour);
  }

  return hours.sort((a, b) => a.at - b.at);
}

/** Validate the serialized hourly samples stored in the recent-weather cache. */
export function validateForecastHours(
  input: unknown,
  bounds?: { minAt: number; maxAt: number },
): ForecastHour[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<number>();
  return input
    .map(normalizeHour)
    .filter((hour): hour is ForecastHour => hour !== null)
    .filter((hour) =>
      !bounds || (hour.at >= bounds.minAt && hour.at <= bounds.maxAt)
    )
    .sort((a, b) => a.at - b.at)
    .filter((hour) => {
      if (seen.has(hour.at)) return false;
      seen.add(hour.at);
      return true;
    });
}

/**
 * Build a truthful, compact temperature line inside an existing ribbon axis.
 * Missing stretches longer than 90 minutes start a new path segment instead
 * of visually interpolating across data the service did not provide.
 */
export function buildTemperatureTrace(
  hours: readonly ForecastHour[],
  window: RibbonWindow,
  geometry: TemperatureTraceGeometry,
): TemperatureTrace | null {
  const start = window.start.valueOf();
  const end = window.end.valueOf();
  const values = hours
    .filter(
      (hour): hour is ForecastHour & { temperature: number } =>
        hour.at >= start
        && hour.at <= end
        && typeof hour.temperature === 'number'
        && Number.isFinite(hour.temperature),
    )
    .sort((a, b) => a.at - b.at);

  if (values.length < 2) return null;

  const temperatures = values.map((hour) => hour.temperature);
  const min = Math.min(...temperatures);
  const max = Math.max(...temperatures);
  const minimumSpan = Math.max(1, geometry.minSpan ?? 12);
  const span = Math.max(minimumSpan, max - min);
  const midpoint = (min + max) / 2;
  const scaleMin = midpoint - span / 2;
  const scaleMax = midpoint + span / 2;
  const duration = Math.max(1, end - start);
  const height = Math.max(1, geometry.bottom - geometry.top);
  const points: TemperatureTracePoint[] = values.map((hour) => {
    const x = ((hour.at - start) / duration) * geometry.width;
    const ratio = (hour.temperature - scaleMin) / (scaleMax - scaleMin);
    return {
      at: hour.at,
      temperature: hour.temperature,
      x,
      y: geometry.bottom - Math.max(0, Math.min(1, ratio)) * height,
    };
  });

  const path = points
    .map((point, index) => {
      const previous = points[index - 1];
      const command =
        !previous || point.at - previous.at > 90 * 60_000 ? 'M' : 'L';
      return `${command}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(' ');

  return {
    path,
    points,
    min,
    max,
    scaleMin,
    scaleMax,
  };
}

/**
 * Estimate color potential from the cloud-layer mix around one real sunset.
 *
 * This is intentionally a restrained heuristic, not a visibility promise:
 * partial mid/high cloud can catch color, while dense low cloud, storms, or a
 * high rain probability can obscure it. Open-Meteo's layers are area
 * fractions for the forecast grid cell, not a camera view of the west horizon.
 */
export function assessSunsetPotential(
  hours: readonly ForecastHour[],
  sunsetAt: number,
): SunsetPotential | null {
  if (!Number.isFinite(sunsetAt)) return null;
  const samples = hours.filter(
    (
      hour,
    ): hour is ForecastHour & {
      lowCloud: number;
      midCloud: number;
      highCloud: number;
    } =>
      Math.abs(hour.at - sunsetAt) <= 90 * 60_000
      && hour.lowCloud !== null
      && hour.midCloud !== null
      && hour.highCloud !== null,
  );
  if (samples.length < 2) return null;

  let weightTotal = 0;
  let lowTotal = 0;
  let midTotal = 0;
  let highTotal = 0;
  let precipitationProbability = 0;
  let storm = false;

  for (const sample of samples) {
    const distanceHours = Math.abs(sample.at - sunsetAt) / HOUR_MS;
    const weight = 1 / (1 + distanceHours);
    weightTotal += weight;
    lowTotal += sample.lowCloud * weight;
    midTotal += sample.midCloud * weight;
    highTotal += sample.highCloud * weight;
    precipitationProbability = Math.max(
      precipitationProbability,
      sample.precipitationProbability ?? 0,
    );
    if (
      sample.weatherCode !== null
      && STORM_CODES.has(Math.round(sample.weatherCode))
    ) {
      storm = true;
    }
  }

  const lowCloud = lowTotal / weightTotal;
  const midCloud = midTotal / weightTotal;
  const highCloud = highTotal / weightTotal;
  const upperCloud = Math.max(midCloud, highCloud);
  let band: SunsetPotentialBand;

  if (lowCloud >= 75 || precipitationProbability >= 70 || storm) {
    band = 'obscured';
  } else if (lowCloud <= 35 && upperCloud >= 20 && upperCloud <= 75) {
    band = 'promising';
  } else if (lowCloud <= 35 && upperCloud < 20) {
    band = 'subtle';
  } else {
    band = 'mixed';
  }

  return {
    band,
    sampleCount: samples.length,
    lowCloud,
    midCloud,
    highCloud,
    precipitationProbability,
  };
}
