/**
 * Browser controller for the Outside living almanac.
 *
 * The authored Breckenridge plates provide the photographic atmosphere.
 * Local astronomy remains authoritative for the current slice, chart, Moon
 * phase, and daylight countdown. Network data only enhances the weather and
 * ISS readings; a failed request never takes the almanac itself offline.
 */

import {
  moonDarkPath,
  moonDistanceKm,
  moonIllumination,
  moonPosition,
  moonPhaseName,
  sunPosition,
} from './astro';
import {
  createPlateCompositor,
  type PlateShowStatus,
  type RasterPlate,
} from './plate-compositor';
import {
  SOLAR_MOMENTS,
  buildBreckenridgeSolarSchedule,
  classifyPlateCondition,
  isPlateCondition,
  plateAssetBase,
  plateFrameAt,
  type PlateCondition,
  type PlateSchedule,
  type SolarMoment,
} from './plates';
import {
  altToPlotY,
  buildRollingRibbon,
  hourLabel,
  timeToX,
  type HorizonEvent,
  type RibbonGeometry,
  type RibbonModel,
  type RibbonWindow,
} from './ribbon';
import {
  assessSunsetPotential,
  buildTemperatureTrace,
  formatAirDetail,
  parseOpenMeteoAirQuality,
  parseOpenMeteoHourly,
  validateForecastHours,
  type AirQualityReading,
  type ForecastHour,
  type SunsetPotentialBand,
} from './forecast';
import { uvLabel } from './sky';

const LATITUDE = 32.7557;
const LONGITUDE = -98.9023;
const TIME_ZONE = 'America/Chicago';
const WEATHER_REFRESH_MS = 15 * 60_000;
const ISS_REFRESH_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;
const CONDITION_CACHE_TTL_MS = 2 * 60 * 60_000;
const CONDITION_CACHE_KEY = 'outside:breckenridge-condition';
const WEATHER_CACHE_TTL_MS = 30 * 60_000;
const WEATHER_CACHE_KEY = 'outside:breckenridge-weather';
const ISS_CACHE_KEY = 'outside:breckenridge-iss';
const MINUTE = 60_000;
const RIBBON_LOOKBACK_MINUTES = 6 * 60;
const RIBBON_DURATION_MINUTES = 24 * 60;
const RIBBON_DESKTOP: RibbonGeometry = {
  width: 1440,
  height: 200,
  baseline: 96,
  maxAltitude: 90,
  minAltitude: -90,
  belowBand: 34,
};
const RIBBON_TABLET: RibbonGeometry = {
  width: 1440,
  height: 240,
  baseline: 116,
  maxAltitude: 90,
  minAltitude: -90,
  belowBand: 44,
};
const RIBBON_MOBILE: RibbonGeometry = {
  ...RIBBON_TABLET,
  width: 600,
};

const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Rime fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  56: 'Freezing drizzle',
  57: 'Heavy freezing drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  66: 'Freezing rain',
  67: 'Heavy freezing rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Thunderstorm with hail',
};

export type OutsidePlateTone = 'light' | 'dark';
export type OutsidePlateContrast = 'soft' | 'balanced' | 'strong';
export type OutsidePlateFocal =
  | 'horizon'
  | 'oak-line'
  | 'cloud-field'
  | 'rain-core';

export interface OutsidePlatePresentation {
  readonly tone: OutsidePlateTone;
  readonly contrast: OutsidePlateContrast;
  readonly focal: OutsidePlateFocal;
}

const presentation = (
  tone: OutsidePlateTone,
  contrast: OutsidePlateContrast,
  focal: OutsidePlateFocal,
): OutsidePlatePresentation => Object.freeze({ tone, contrast, focal });

/**
 * Copy contrast and crop focus are authored with the same condition/moment
 * granularity as the plate atlas. This avoids forcing a dark storm sunset
 * through the same treatment as a pale clear sunrise.
 */
export const OUTSIDE_PLATE_PRESENTATIONS = Object.freeze({
  clear: Object.freeze({
    night: presentation('dark', 'soft', 'oak-line'),
    predawn: presentation('dark', 'soft', 'horizon'),
    sunrise: presentation('light', 'soft', 'oak-line'),
    morning: presentation('light', 'soft', 'oak-line'),
    noon: presentation('light', 'soft', 'oak-line'),
    golden: presentation('light', 'soft', 'oak-line'),
    sunset: presentation('dark', 'balanced', 'oak-line'),
    'blue-hour': presentation('dark', 'soft', 'oak-line'),
  }),
  scattered: Object.freeze({
    night: presentation('dark', 'balanced', 'cloud-field'),
    predawn: presentation('dark', 'balanced', 'cloud-field'),
    sunrise: presentation('light', 'soft', 'cloud-field'),
    morning: presentation('light', 'soft', 'cloud-field'),
    noon: presentation('light', 'soft', 'cloud-field'),
    golden: presentation('light', 'balanced', 'cloud-field'),
    sunset: presentation('dark', 'balanced', 'cloud-field'),
    'blue-hour': presentation('dark', 'balanced', 'cloud-field'),
  }),
  overcast: Object.freeze({
    night: presentation('dark', 'balanced', 'cloud-field'),
    predawn: presentation('light', 'balanced', 'cloud-field'),
    sunrise: presentation('light', 'balanced', 'cloud-field'),
    morning: presentation('light', 'soft', 'cloud-field'),
    noon: presentation('light', 'soft', 'cloud-field'),
    golden: presentation('light', 'balanced', 'cloud-field'),
    sunset: presentation('dark', 'balanced', 'cloud-field'),
    'blue-hour': presentation('dark', 'balanced', 'cloud-field'),
  }),
  storm: Object.freeze({
    night: presentation('dark', 'balanced', 'rain-core'),
    predawn: presentation('dark', 'strong', 'rain-core'),
    sunrise: presentation('dark', 'strong', 'rain-core'),
    morning: presentation('dark', 'strong', 'rain-core'),
    noon: presentation('dark', 'strong', 'rain-core'),
    golden: presentation('dark', 'strong', 'rain-core'),
    sunset: presentation('dark', 'strong', 'rain-core'),
    'blue-hour': presentation('dark', 'strong', 'rain-core'),
  }),
} satisfies Record<
  PlateCondition,
  Readonly<Record<SolarMoment, OutsidePlatePresentation>>
>);

export function platePresentationFor(
  condition: PlateCondition,
  moment: SolarMoment,
): OutsidePlatePresentation {
  return OUTSIDE_PLATE_PRESENTATIONS[condition][moment];
}

export function shouldCommitPlatePresentation(
  status: PlateShowStatus,
): boolean {
  return status === 'shown' || status === 'unchanged';
}

export interface Conditions {
  temperature: number;
  apparentTemperature: number;
  high: number;
  low: number;
  code: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  uv: number;
  precipitation: number;
  precipitationProbability: number;
  cloud: number;
  forecastHours: ForecastHour[];
  airQuality?: AirQualityReading | null;
}

interface ConditionCache {
  condition: PlateCondition;
  observedAt: number;
}

interface RecentWeatherCache {
  observedAt: number;
  conditions: Conditions;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

interface OutsideWindow extends Window {
  __outsideAlmanacCleanup?: () => void;
  __outsideAlmanacInit?: () => void;
  __outsideAlmanacLifecycleBound?: boolean;
  __outsideAlmanacRoot?: HTMLElement;
}

const CONDITION_NUMBER_RANGES = Object.freeze([
  ['temperature', -150, 160],
  ['apparentTemperature', -180, 200],
  ['high', -150, 160],
  ['low', -150, 160],
  ['code', 0, 99],
  ['humidity', 0, 100],
  ['windSpeed', 0, 300],
  ['windDirection', 0, 360],
  ['uv', 0, 50],
  ['precipitation', 0, 500],
  ['precipitationProbability', 0, 100],
  ['cloud', 0, 100],
] as const);

/**
 * Validate the short-lived full weather snapshot used to avoid an empty hero
 * on repeat visits. Expired, future-dated, or malformed values are ignored.
 */
export function parseRecentWeatherCache(
  input: unknown,
  now = Date.now(),
): RecentWeatherCache | null {
  if (!input || typeof input !== 'object') return null;
  const cached = input as Partial<RecentWeatherCache>;
  const observedAt =
    typeof cached.observedAt === 'number' && Number.isFinite(cached.observedAt)
      ? cached.observedAt
      : null;
  if (observedAt === null) return null;
  const age = now - observedAt;
  if (age < 0 || age > WEATHER_CACHE_TTL_MS) return null;
  if (!cached.conditions || typeof cached.conditions !== 'object') return null;

  const candidate = cached.conditions as Partial<Conditions>;
  for (const [field, minimum, maximum] of CONDITION_NUMBER_RANGES) {
    const value = candidate[field];
    if (
      typeof value !== 'number'
      || !Number.isFinite(value)
      || value < minimum
      || value > maximum
    ) {
      return null;
    }
  }
  const forecastHours = validateForecastHours(candidate.forecastHours, {
    minAt: observedAt - 8 * 60 * 60_000,
    maxAt: observedAt + 36 * 60 * 60_000,
  });
  const airQuality = parseOpenMeteoAirQuality(candidate.airQuality);

  return {
    observedAt,
    conditions: {
      temperature: candidate.temperature as number,
      apparentTemperature: candidate.apparentTemperature as number,
      high: candidate.high as number,
      low: candidate.low as number,
      code: candidate.code as number,
      humidity: candidate.humidity as number,
      windSpeed: candidate.windSpeed as number,
      windDirection: candidate.windDirection as number,
      uv: candidate.uv as number,
      precipitation: candidate.precipitation as number,
      precipitationProbability: candidate.precipitationProbability as number,
      cloud: candidate.cloud as number,
      forecastHours,
      airQuality,
    },
  };
}

/** Stable, testable Open-Meteo request for the chart and next sunset. */
export function weatherForecastUrl(): string {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(LATITUDE));
  url.searchParams.set('longitude', String(LONGITUDE));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,uv_index',
  );
  url.searchParams.set(
    'hourly',
    'temperature_2m,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation_probability',
  );
  url.searchParams.set(
    'daily',
    'temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max',
  );
  url.searchParams.set('temperature_unit', 'fahrenheit');
  url.searchParams.set('wind_speed_unit', 'mph');
  url.searchParams.set('timezone', TIME_ZONE);
  url.searchParams.set('timeformat', 'unixtime');
  url.searchParams.set('past_hours', '6');
  url.searchParams.set('forecast_hours', '30');
  url.searchParams.set('forecast_days', '2');
  return url.toString();
}

/** No-key Open-Meteo Air Quality request for Breckenridge (`02 Air` cell). */
export function airQualityUrl(): string {
  const url = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
  url.searchParams.set('latitude', String(LATITUDE));
  url.searchParams.set('longitude', String(LONGITUDE));
  url.searchParams.set('current', 'us_aqi,pm2_5,dust');
  return url.toString();
}

const BRECKENRIDGE_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const BRECKENRIDGE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

const BRECKENRIDGE_WEEKDAY = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'short',
});

const BRECKENRIDGE_WINDOW_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: TIME_ZONE,
  weekday: 'long',
  hour: 'numeric',
  minute: '2-digit',
});

function numberPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  return Number(parts.find((part) => part.type === type)?.value ?? 0);
}

function zonedParts(date: Date): ZonedParts {
  const parts = BRECKENRIDGE_PARTS.formatToParts(date);
  return {
    year: numberPart(parts, 'year'),
    month: numberPart(parts, 'month'),
    day: numberPart(parts, 'day'),
    hour: numberPart(parts, 'hour'),
    minute: numberPart(parts, 'minute'),
    second: numberPart(parts, 'second'),
  };
}

function breckenridgeDateKey(now: Date): string {
  const parts = zonedParts(now);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

const compass = (degrees: number) =>
  ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][
    Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16
  ];

function formatDuration(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.round(milliseconds / MINUTE));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function breckenridgeDayOrdinal(date: Date): number {
  const parts = zonedParts(date);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / 86_400_000);
}

function formatRelativeEventTime(at: Date, reference: Date): string {
  const dayDifference =
    breckenridgeDayOrdinal(at) - breckenridgeDayOrdinal(reference);
  const suffix = dayDifference === 0
    ? ''
    : dayDifference === 1
      ? ' tomorrow'
      : ` ${BRECKENRIDGE_WEEKDAY.format(at)}`;
  return `${BRECKENRIDGE_TIME.format(at)}${suffix}`;
}

export interface RollingTimelineMark {
  minute: number;
  label: string;
  kind: 'time' | 'day';
}

/** Six-hour clock marks generated from real instants across date/DST seams. */
export function rollingTimelineMarks(
  window: RibbonWindow,
): RollingTimelineMark[] {
  const marks: RollingTimelineMark[] = [];
  const hour = 60 * MINUTE;
  const start = window.start.valueOf();
  const firstHour = Math.ceil(start / hour) * hour;

  for (let value = firstHour; value <= window.end.valueOf(); value += hour) {
    const at = new Date(value);
    const parts = zonedParts(at);
    if (parts.minute !== 0 || parts.hour % 6 !== 0) continue;
    const isDayBoundary = parts.hour === 0;
    marks.push({
      minute: (value - start) / MINUTE,
      label: isDayBoundary
        ? `${BRECKENRIDGE_WEEKDAY.format(at).toUpperCase()} · 12A`
        : hourLabel(parts.hour),
      kind: isDayBoundary ? 'day' : 'time',
    });
  }
  return marks;
}

/** Resolve the next authored sunset anchor, including the following day. */
export function nextSunsetAt(
  schedule: PlateSchedule,
  now: Date,
): number | null {
  const value = now.valueOf();
  if (!Number.isFinite(value)) return null;
  return schedule.anchors.find(
    (anchor) => anchor.moment === 'sunset' && anchor.at > value,
  )?.at ?? null;
}

interface MoonEditorialCopy {
  status: string;
  summary: string;
  description: string;
}

export function moonEditorialCopy(
  isAboveHorizon: boolean,
  events: readonly HorizonEvent[],
  now: Date,
): MoonEditorialCopy {
  const future = events.filter((event) => event.at.valueOf() >= now.valueOf());
  const nextRise = future.find((event) => event.kind === 'rise');
  const nextSet = future.find((event) => event.kind === 'set');

  if (isAboveHorizon) {
    if (!nextSet) {
      return {
        status: 'above horizon',
        summary: 'Above now',
        description: 'The Moon is above the horizon now.',
      };
    }
    const setTime = formatRelativeEventTime(nextSet.at, now);
    return {
      status: `above horizon · sets ${setTime}`,
      summary: `Above now → ${setTime}`,
      description: `The Moon is above the horizon now and sets ${setTime}.`,
    };
  }

  if (!nextRise) {
    return {
      status: 'below horizon',
      summary: 'Below horizon',
      description: 'The Moon is below the horizon.',
    };
  }

  const followingSet = future.find(
    (event) =>
      event.kind === 'set'
      && event.at.valueOf() > nextRise.at.valueOf(),
  );
  const riseTime = formatRelativeEventTime(nextRise.at, now);
  if (!followingSet) {
    return {
      status: `below horizon · rises ${riseTime}`,
      summary: `Rises ${riseTime}`,
      description: `The Moon is below the horizon and rises ${riseTime}.`,
    };
  }

  const setTime = formatRelativeEventTime(followingSet.at, now);
  return {
    status: `below horizon · rises ${riseTime}`,
    summary: `${riseTime} → ${setTime}`,
    description:
      `The Moon is below the horizon, rises ${riseTime}, and sets ${setTime}.`,
  };
}

function pathEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function plateAsset(condition: PlateCondition, moment: SolarMoment): RasterPlate {
  const base = plateAssetBase(condition, moment);
  const variant = window.matchMedia('(max-width: 420px)').matches
    ? 'narrow'
    : window.matchMedia('(max-width: 720px)').matches
      ? 'mobile'
      : 'desktop';
  return {
    key: `${condition}:${moment}:${variant}`,
    src: `${base}-${variant}.webp`,
  };
}

function followingMoment(moment: SolarMoment): SolarMoment {
  const index = SOLAR_MOMENTS.indexOf(moment);
  return SOLAR_MOMENTS[(index + 1) % SOLAR_MOMENTS.length];
}

function drawTexturedMoon(
  canvas: HTMLCanvasElement | null,
  texture: HTMLImageElement,
  fraction: number,
  waxing: boolean,
) {
  if (!canvas || !texture.complete || texture.naturalWidth === 0) return;
  const context = canvas.getContext('2d');
  if (!context) return;

  const size = canvas.width;
  const center = size / 2;
  const radius = size * 0.42;
  const bezelRadius = size * 0.475;
  context.clearRect(0, 0, size, size);

  // Brass observatory bezel ring + 24 degree ticks
  context.save();
  context.strokeStyle = 'rgba(189, 132, 42, 0.34)';
  context.lineWidth = Math.max(1, size * 0.006);
  context.beginPath();
  context.arc(center, center, bezelRadius, 0, Math.PI * 2);
  context.stroke();
  for (let tick = 0; tick < 24; tick++) {
    const angle = (tick * Math.PI) / 12;
    const isCardinal = tick % 6 === 0;
    const inner = bezelRadius - size * (isCardinal ? 0.036 : 0.02);
    context.beginPath();
    context.moveTo(
      center + Math.cos(angle) * inner,
      center + Math.sin(angle) * inner,
    );
    context.lineTo(
      center + Math.cos(angle) * bezelRadius,
      center + Math.sin(angle) * bezelRadius,
    );
    context.strokeStyle = isCardinal
      ? 'rgba(189, 132, 42, 0.65)'
      : 'rgba(33, 26, 19, 0.24)';
    context.lineWidth = Math.max(1, size * (isCardinal ? 0.01 : 0.006));
    context.stroke();
  }
  context.restore();

  context.save();
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.clip();
  context.drawImage(
    texture,
    center - radius,
    center - radius,
    radius * 2,
    radius * 2,
  );

  if (typeof Path2D === 'function') {
    try {
      const dark = new Path2D(
        moonDarkPath(center, center, radius, fraction, waxing),
      );
      context.fillStyle = fraction < 0.04
        ? 'rgba(4, 7, 11, .96)'
        : 'rgba(4, 7, 11, .82)';
      context.fill(dark);
    } catch {
      // The phase name and fraction stay correct in older canvas engines; a
      // full photographic disc is a safer fallback than breaking the frame.
    }
  }
  context.restore();

  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.strokeStyle = 'rgba(255, 248, 225, .52)';
  context.lineWidth = Math.max(1, size * 0.008);
  context.stroke();
}

const SUNSET_POTENTIAL_LABELS: Readonly<Record<SunsetPotentialBand, string>> =
  Object.freeze({
    promising: 'Promising',
    mixed: 'Mixed',
    subtle: 'Subtle',
    obscured: 'Obscured',
  });

/**
 * Mount one Outside instance and return an idempotent teardown.
 */
export function mountOutside(root: HTMLElement): () => void {
  const query = <T extends Element>(selector: string) =>
    root.querySelector<T>(selector);
  const setField = (name: string, value: string) => {
    root.querySelectorAll<HTMLElement>(`[data-field="${name}"]`)
      .forEach((element) => {
        if (element.textContent !== value) element.textContent = value;
      });
  };

  const slotA = query<HTMLImageElement>('[data-plate-slot="a"]');
  const slotB = query<HTMLImageElement>('[data-plate-slot="b"]');
  if (!slotA || !slotB) return () => {};

  const abortController = new AbortController();
  const compositor = createPlateCompositor({
    slots: [slotA, slotB],
    crossfadeMs: 1400,
    onLoadError: ({ phase }) => {
      if (phase === 'current') root.dataset.plateLoad = 'retained';
    },
  });

  let destroyed = false;
  let conditions: Conditions | null = null;
  let plateCondition: PlateCondition = 'clear';
  let schedule: PlateSchedule = buildBreckenridgeSolarSchedule(Date.now());
  let issPassAt: number | null = null;
  let issPassEndsAt: number | null = null;
  let lastIssSummary = 'Finding the next visible pass…';
  let resizeTimer: number | undefined;
  let platePresentationRequest = 0;
  let weatherInFlight = false;
  let issInFlight = false;
  let usingRecentWeather = false;
  let ribbonStarted = false;
  let plateConditionExpiresAt: number | null = null;
  let deferredStartupTimer: number | undefined;
  let deferredStartupIdle: number | undefined;
  const timers: number[] = [];

  try {
    const remembered = localStorage.getItem(CONDITION_CACHE_KEY);
    if (remembered) {
      const cached = JSON.parse(remembered) as Partial<ConditionCache>;
      const age = Date.now() - Number(cached.observedAt);
      if (
        isPlateCondition(cached.condition)
        && Number.isFinite(age)
        && age >= 0
        && age <= CONDITION_CACHE_TTL_MS
      ) {
        plateCondition = cached.condition;
        plateConditionExpiresAt =
          Number(cached.observedAt) + CONDITION_CACHE_TTL_MS;
      }
    }
  } catch {
    // Storage is an optional optimization only.
  }

  try {
    const remembered = localStorage.getItem(WEATHER_CACHE_KEY);
    if (remembered) {
      const cached = parseRecentWeatherCache(JSON.parse(remembered));
      if (cached) {
        conditions = cached.conditions;
        usingRecentWeather = true;
        plateCondition = classifyPlateCondition({
          code: conditions.code,
          cloud: conditions.cloud,
          precipitation: conditions.precipitation,
        });
        plateConditionExpiresAt =
          cached.observedAt + CONDITION_CACHE_TTL_MS;
        root.dataset.weather = 'recent';
        setField('source-status', 'recent weather · refreshing');
      } else {
        localStorage.removeItem(WEATHER_CACHE_KEY);
      }
    }
  } catch {
    // The weather snapshot is a repeat-load optimization only.
  }

  const moonTexture = new Image();
  moonTexture.decoding = 'async';
  moonTexture.setAttribute('fetchpriority', 'low');

  async function requestJson(url: string) {
    const requestController = new AbortController();
    const abortRequest = () => requestController.abort();
    if (abortController.signal.aborted) abortRequest();
    else {
      abortController.signal.addEventListener('abort', abortRequest, {
        once: true,
      });
    }
    const timeout = window.setTimeout(abortRequest, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: requestController.signal });
      if (!response.ok) {
        throw new Error(`Request returned ${response.status}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
      abortController.signal.removeEventListener('abort', abortRequest);
    }
  }

  function expireStalePlateCondition(now: Date) {
    if (
      plateConditionExpiresAt === null
      || now.valueOf() < plateConditionExpiresAt
    ) {
      return;
    }

    plateCondition = 'clear';
    plateConditionExpiresAt = null;
    root.dataset.weather = conditions ? 'stale' : 'offline';
    setField(
      'source-status',
      conditions
        ? 'weather delayed · last reading'
        : 'weather delayed · almanac local',
    );
    try {
      localStorage.removeItem(CONDITION_CACHE_KEY);
    } catch {
      // Storage is optional.
    }
  }

  function ensureSchedule(now: Date) {
    if (Math.abs(now.valueOf() - schedule.around) > 12 * 60 * 60_000) {
      schedule = buildBreckenridgeSolarSchedule(now);
    }
  }

  function updatePlate(now: Date) {
    expireStalePlateCondition(now);
    ensureSchedule(now);
    const frame = plateFrameAt(now, schedule);
    const moment = frame.mix >= 0.5 ? frame.to : frame.from;
    const next = frame.mix >= 0.5 ? followingMoment(frame.to) : frame.to;
    const condition = plateCondition;
    const authored = platePresentationFor(condition, moment);
    const request = ++platePresentationRequest;

    if (compositor.activeKey === null) {
      // Before the first photograph is available, use a solar-appropriate
      // fallback instead of the static daytime gradient. Later replacement
      // failures never alter the treatment of the retained active plate.
      root.dataset.condition = condition;
      root.dataset.moment = moment;
      root.dataset.tone = authored.tone;
      root.dataset.contrast = authored.contrast;
      root.dataset.focal = authored.focal;
      root.dataset.plateFallback = 'solar';
      root.dataset.plateLoad = 'loading';
    }

    void compositor.show({
      current: plateAsset(condition, moment),
      next: plateAsset(condition, next),
    }).then((result) => {
      if (destroyed || request !== platePresentationRequest) return;
      root.dataset.plateLoad = result.status;
      if (!shouldCommitPlatePresentation(result.status)) return;

      // Commit the visual state as one unit only after the matching raster is
      // visible. A failed replacement therefore retains both the old plate and
      // its exact contrast/focal treatment.
      root.dataset.condition = condition;
      root.dataset.moment = moment;
      root.dataset.tone = authored.tone;
      root.dataset.contrast = authored.contrast;
      root.dataset.focal = authored.focal;
      delete root.dataset.plateFallback;
    });
  }

  function renderDaylight(now: Date) {
    ensureSchedule(now);
    const nextEvent = schedule.anchors.find(
      (anchor) =>
        anchor.at > now.valueOf()
        && (anchor.moment === 'sunrise' || anchor.moment === 'sunset'),
    );
    setField(
      'daylight-label',
      nextEvent?.moment === 'sunset' ? 'sunset in' : 'sunrise in',
    );
    setField(
      'daylight-value',
      nextEvent ? formatDuration(nextEvent.at - now.valueOf()) : '—',
    );
  }

  let activeRibbonModel: RibbonModel | null = null;
  let activeRibbonGeometry: RibbonGeometry = RIBBON_DESKTOP;

  function renderCelestial(now: Date) {
    const { fraction, waxing } = moonIllumination(now);
    const phase = moonPhaseName(fraction, waxing);
    const illuminated = Math.round(fraction * 100);

    setField('moon-phase', phase);
    setField('moon-fraction', `${illuminated}%`);
    const portrait = query<HTMLCanvasElement>('[data-moon-portrait]');
    drawTexturedMoon(portrait, moonTexture, fraction, waxing);

    const telemetryEl = query<HTMLElement>('[data-field="moon-telemetry"]');
    if (telemetryEl && !telemetryEl.hidden) {
      const distKm = moonDistanceKm(now);
      const pos = moonPosition(now, LATITUDE, LONGITUDE);
      telemetryEl.textContent =
        `${distKm.toLocaleString('en-US')} km away · ${Math.round(pos.altitude)}° alt ${compass(pos.azimuth)}`;
    }
  }

  function renderWeather(now: Date) {
    if (!conditions) return;
    const current = conditions;
    setField('weather-temp', `${Math.round(current.temperature)}°`);
    setField('weather-desc', WEATHER_CODES[current.code] ?? 'Current conditions');
    setField('weather-feelslike', `${Math.round(current.apparentTemperature)}°`);
    setField('weather-high', `${Math.round(current.high)}°`);
    setField('weather-low', `${Math.round(current.low)}°`);
    setField('exposure-value', `UV ${current.uv.toFixed(1)}`);
    setField('exposure-detail', `${uvLabel(current.uv)} · current`);
    setField(
      'air-value',
      `${Math.round(current.windSpeed)} mph ${compass(current.windDirection)}`,
    );
    setField('air-detail', formatAirDetail(current.humidity, current.airQuality));
    setField(
      'water-value',
      `${Math.round(current.precipitationProbability)}% rain`,
    );
    setField(
      'water-detail',
      current.precipitation > 0
        ? `${current.precipitation.toFixed(1)} mm falling now`
        : 'No rain falling now',
    );

    // 01 Exposure: UV semicircular gauge needle (-90deg to +90deg for UV 0..11)
    const uvNeedle = query<SVGGElement>('[data-gauge="uv-needle"]');
    if (uvNeedle) {
      const uvClamped = Math.max(0, Math.min(11, current.uv));
      const uvAngle = -90 + (uvClamped / 11) * 180;
      uvNeedle.setAttribute(
        'transform',
        `translate(24, 22) rotate(${uvAngle.toFixed(1)})`,
      );
    }

    // 02 Air: Wind compass needle
    const windNeedle = query<SVGGElement>('[data-gauge="wind-needle"]');
    if (windNeedle) {
      const windDeg = ((current.windDirection % 360) + 360) % 360;
      windNeedle.setAttribute(
        'transform',
        `translate(16, 16) rotate(${windDeg.toFixed(1)})`,
      );
    }

    // 03 Water: 12-hour precipitation probability spark-bars
    const rainSpark = query<SVGSVGElement>('[data-gauge="rain-spark"]');
    if (rainSpark) {
      const nowMs = now.valueOf();
      const upcoming = current.forecastHours
        .filter((h) => h.at >= nowMs - 45 * MINUTE)
        .slice(0, 12);
      const bars: string[] = [
        '<line x1="1" y1="20" x2="59" y2="20" stroke="currentColor" stroke-opacity="0.22" stroke-width="1" />',
      ];
      const count = Math.max(1, upcoming.length);
      for (let i = 0; i < 12; i++) {
        const sample = upcoming[Math.min(i, count - 1)];
        const prob = Math.max(
          0,
          Math.min(
            100,
            sample?.precipitationProbability ?? current.precipitationProbability,
          ),
        );
        const barH = Math.max(2, (prob / 100) * 16.5);
        const barX = 2 + i * 4.8;
        const barY = 20 - barH;
        const fill = prob >= 50 ? 'var(--outside-sun-line)' : 'currentColor';
        const opacity = (0.28 + (prob / 100) * 0.68).toFixed(2);
        bars.push(
          `<rect x="${barX.toFixed(1)}" y="${barY.toFixed(1)}" width="3.1" height="${barH.toFixed(1)}" rx="1" fill="${fill}" fill-opacity="${opacity}" />`,
        );
      }
      rainSpark.innerHTML = bars.join('');
    }

    ensureSchedule(now);
    const nextSunset = nextSunsetAt(schedule, now);
    const sunsetPotential = nextSunset !== null
      ? assessSunsetPotential(current.forecastHours, nextSunset)
      : null;
    if (nextSunset !== null && sunsetPotential) {
      const sunsetTime = formatRelativeEventTime(
        new Date(nextSunset),
        now,
      );
      setField(
        'sunset-value',
        `${SUNSET_POTENTIAL_LABELS[sunsetPotential.band]} · ${sunsetTime}`,
      );
      setField(
        'sunset-detail',
        `H ${Math.round(sunsetPotential.highCloud)} · M ${Math.round(sunsetPotential.midCloud)} · L ${Math.round(sunsetPotential.lowCloud)}%`,
      );
      const highEl = query<SVGElement>('[data-gauge="cloud-high"]');
      const midEl = query<SVGElement>('[data-gauge="cloud-mid"]');
      const lowEl = query<SVGElement>('[data-gauge="cloud-low"]');
      if (highEl) {
        highEl.setAttribute(
          'opacity',
          (0.18 + (sunsetPotential.highCloud / 100) * 0.82).toFixed(2),
        );
      }
      if (midEl) {
        midEl.setAttribute(
          'opacity',
          (0.18 + (sunsetPotential.midCloud / 100) * 0.82).toFixed(2),
        );
      }
      if (lowEl) {
        lowEl.setAttribute(
          'opacity',
          (0.16 + (sunsetPotential.lowCloud / 100) * 0.84).toFixed(2),
        );
      }
    } else {
      setField('sunset-value', 'Layer data unavailable');
      setField('sunset-detail', 'No cloud-layer estimate');
    }
  }

  function renderRibbon(now: Date) {
    const svg = query<SVGSVGElement>('[data-ribbon]');
    if (!svg) return;
    ribbonStarted = true;

    const geometry = window.matchMedia('(max-width: 720px)').matches
      ? RIBBON_MOBILE
      : window.matchMedia('(min-width: 1081px)').matches
        ? RIBBON_DESKTOP
        : RIBBON_TABLET;
    svg.setAttribute(
      'viewBox',
      `0 0 ${geometry.width} ${geometry.height}`,
    );

    const model = buildRollingRibbon(now, LATITUDE, LONGITUDE, geometry, {
      beforeMinutes: RIBBON_LOOKBACK_MINUTES,
      durationMinutes: RIBBON_DURATION_MINUTES,
      stepMinutes: 6,
    });
    activeRibbonModel = model;
    activeRibbonGeometry = geometry;

    const temperatureTop =
      geometry.baseline + (geometry.belowBand ?? 0)
      + (geometry.height === RIBBON_DESKTOP.height ? 7 : 9);
    const temperatureBottom = geometry.height - 34;
    const temperatureTrace = conditions
      ? buildTemperatureTrace(conditions.forecastHours, model.window, {
        width: geometry.width,
        top: temperatureTop,
        bottom: temperatureBottom,
        minSpan: 12,
      })
      : null;
    setField(
      'temperature-range',
      temperatureTrace
        ? `rolling 24 hours · ${Math.round(temperatureTrace.min)}°–${Math.round(temperatureTrace.max)}°`
        : 'rolling 24 hours',
    );
    // The visible plot stays intentionally concise. A longer event-only model
    // lets the Night Watch sentence include the Moon's following set even when
    // it falls just beyond the 24-hour chart.
    const lunarOutlook = buildRollingRibbon(
      now,
      LATITUDE,
      LONGITUDE,
      geometry,
      {
        beforeMinutes: 0,
        durationMinutes: 36 * 60,
        stepMinutes: 6,
      },
    );
    const moonAltitude = moonPosition(now, LATITUDE, LONGITUDE).altitude;
    const moonCopy = moonEditorialCopy(
      moonAltitude > 0,
      lunarOutlook.moonEvents,
      now,
    );
    setField('moon-horizon', moonCopy.status);
    setField('moon-visibility-summary', moonCopy.summary);

    const renderedWidth = svg.clientWidth || geometry.width;
    const scale = Math.min(
      2.4,
      Math.max(1, geometry.width / renderedWidth),
    );
    const fontSize = (base: number) => (base * scale).toFixed(1);
    const radius = (base: number) => (base * Math.min(scale, 2)).toFixed(2);
    const strokeWidth = (base: number) => base.toFixed(2);
    const x = (value: number) =>
      timeToX(value, geometry, model.window.durationMinutes);
    const fragments: string[] = [];

    const washStops: string[] = [];
    for (
      let minute = 0;
      minute <= model.window.durationMinutes;
      minute += 60
    ) {
      const sample = new Date(model.window.start.valueOf() + minute * MINUTE);
      const altitude = sunPosition(sample, LATITUDE, LONGITUDE).altitude;
      let color = '#152542';
      let opacity = 0.22;
      if (altitude > 12) {
        color = '#f5ead1';
        opacity = 0.06;
      } else if (altitude > -2) {
        color = '#e7a45f';
        opacity = 0.15;
      } else if (altitude > -10) {
        color = '#77728f';
        opacity = 0.18;
      }
      washStops.push(
        `<stop offset="${((minute / model.window.durationMinutes) * 100).toFixed(2)}%" stop-color="${color}" stop-opacity="${opacity}"/>`,
      );
    }

    fragments.push(
      `<defs>
        <linearGradient id="outside-day-wash" x1="0" y1="0" x2="1" y2="0">
          ${washStops.join('')}
        </linearGradient>
        <linearGradient id="outside-horizon-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fff" stop-opacity="0"/>
          <stop offset="58%" stop-color="#fff" stop-opacity=".52"/>
          <stop offset="100%" stop-color="#fff" stop-opacity=".92"/>
        </linearGradient>
        <linearGradient id="outside-sun-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--outside-sun-line)" stop-opacity=".26"/>
          <stop offset="68%" stop-color="var(--outside-sun-line)" stop-opacity=".08"/>
          <stop offset="100%" stop-color="var(--outside-sun-line)" stop-opacity="0"/>
        </linearGradient>
        <linearGradient id="outside-moon-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--outside-moon-line)" stop-opacity=".12"/>
          <stop offset="100%" stop-color="var(--outside-moon-line)" stop-opacity="0"/>
        </linearGradient>
        <mask id="outside-horizon-mask" maskUnits="userSpaceOnUse" x="0" y="${geometry.baseline - 40}" width="${geometry.width}" height="40">
          <rect x="0" y="${geometry.baseline - 40}" width="${geometry.width}" height="40" fill="url(#outside-horizon-fade)"/>
        </mask>
      </defs>`,
      `<rect x="0" y="${geometry.baseline - 40}" width="${geometry.width}" height="40" fill="url(#outside-day-wash)" mask="url(#outside-horizon-mask)"/>`,
    );

    if (model.moonAreaPath) {
      fragments.push(
        `<path d="${pathEscape(model.moonAreaPath)}" fill="url(#outside-moon-area-grad)"/>`,
      );
    }
    if (model.sunAreaPath) {
      fragments.push(
        `<path d="${pathEscape(model.sunAreaPath)}" fill="url(#outside-sun-area-grad)"/>`,
      );
    }

    fragments.push(
      `<line x1="0" y1="${geometry.baseline}" x2="${geometry.width}" y2="${geometry.baseline}" stroke="var(--outside-line)" stroke-width="${strokeWidth(1)}" vector-effect="non-scaling-stroke"/>`,
    );

    if (model.sunBelowPath) {
      fragments.push(
        `<path d="${pathEscape(model.sunBelowPath)}" fill="none" stroke="var(--outside-sun-line)" stroke-opacity=".85" stroke-width="${strokeWidth(1.15)}" stroke-dasharray="2 7" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      );
    }
    if (model.moonBelowPath) {
      fragments.push(
        `<path d="${pathEscape(model.moonBelowPath)}" fill="none" stroke="var(--outside-moon-line)" stroke-opacity=".5" stroke-width="${strokeWidth(1.05)}" stroke-dasharray="2 8" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      );
    }
    if (model.moonPath) {
      fragments.push(
        `<path class="outside-almanac__moon-curve" d="${pathEscape(model.moonPath)}" fill="none" stroke="var(--outside-moon-line)" stroke-width="${strokeWidth(1.9)}" stroke-dasharray="8 6" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      );
    }
    if (model.sunPath) {
      fragments.push(
        `<path d="${pathEscape(model.sunPath)}" fill="none" stroke="var(--outside-sun-line)" stroke-width="${strokeWidth(2.4)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`,
      );
    }
    if (temperatureTrace) {
      fragments.push(
        `<line x1="0" y1="${(temperatureTop - 5).toFixed(1)}" x2="${geometry.width}" y2="${(temperatureTop - 5).toFixed(1)}" stroke="var(--outside-line)" stroke-opacity=".48" stroke-width="${strokeWidth(1)}" vector-effect="non-scaling-stroke"/>`,
        `<path class="outside-almanac__temperature-curve" d="${pathEscape(temperatureTrace.path)}" fill="none" stroke="var(--outside-temperature-line)" stroke-width="${strokeWidth(1.65)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>`,
      );
    }

    for (const mark of rollingTimelineMarks(model.window)) {
      const tickX = x(mark.minute);
      const anchor =
        tickX < 65 ? 'start' : tickX > geometry.width - 65 ? 'end' : 'middle';
      if (mark.kind === 'day') {
        fragments.push(
          `<line x1="${tickX.toFixed(1)}" y1="30" x2="${tickX.toFixed(1)}" y2="${(temperatureTop - 7).toFixed(1)}" stroke="var(--outside-line)" stroke-width="${strokeWidth(1)}" stroke-dasharray="3 6" vector-effect="non-scaling-stroke"/>`,
        );
      }
      fragments.push(
        `<line x1="${tickX.toFixed(1)}" y1="${geometry.baseline}" x2="${tickX.toFixed(1)}" y2="${geometry.baseline + 7}" stroke="var(--outside-line)" stroke-width="${strokeWidth(1)}" vector-effect="non-scaling-stroke"/>`,
        `<text x="${tickX.toFixed(1)}" y="${geometry.height - 16}" text-anchor="${anchor}" font-size="${fontSize(mark.kind === 'day' ? 13 : 12.5)}" font-family="var(--font-mono)" font-weight="${mark.kind === 'day' ? '650' : '400'}" letter-spacing="${mark.kind === 'day' ? '.3' : '0'}" fill="${mark.kind === 'day' ? 'var(--outside-ink)' : 'var(--outside-muted)'}">${mark.label}</text>`,
      );
    }

    const currentMinute =
      model.window.focusMinute ?? RIBBON_LOOKBACK_MINUTES;
    const currentX = x(currentMinute);

    for (const event of model.sunEvents) {
      const eventX = x(event.minute);
      fragments.push(
        `<circle cx="${eventX.toFixed(1)}" cy="${geometry.baseline}" r="${radius(3.2)}" fill="var(--outside-sun-line)" stroke="var(--outside-plate-edge)" stroke-width="${strokeWidth(1.2)}" vector-effect="non-scaling-stroke"/>`,
      );
      if (
        Math.abs(eventX - currentX) > 76
        && eventX > 52
        && eventX < geometry.width - 52
      ) {
        const arrow = event.kind === 'rise' ? '↑' : '↓';
        const label = `${arrow} ${BRECKENRIDGE_TIME.format(event.at)}`;
        fragments.push(
          `<text x="${eventX.toFixed(1)}" y="${(geometry.baseline - 8).toFixed(1)}" text-anchor="middle" font-size="${fontSize(10.5)}" font-family="var(--font-mono)" fill="var(--outside-sun-line)" opacity="0.92">${label}</text>`,
        );
      }
    }
    for (const event of model.moonEvents) {
      const eventX = x(event.minute);
      fragments.push(
        `<circle class="outside-almanac__moon-event" cx="${eventX.toFixed(1)}" cy="${geometry.baseline}" r="${radius(2.8)}" fill="var(--outside-plate-edge)" stroke="var(--outside-moon-line)" stroke-width="${strokeWidth(1.35)}" vector-effect="non-scaling-stroke"/>`,
      );
    }

    if (
      issPassAt !== null
      && issPassAt >= model.window.start.valueOf()
      && issPassAt <= model.window.end.valueOf()
    ) {
      const passMinute = (issPassAt - model.window.start.valueOf()) / MINUTE;
      const passX = x(passMinute);
      fragments.push(
        `<line x1="${passX.toFixed(1)}" y1="${geometry.baseline}" x2="${passX.toFixed(1)}" y2="54" stroke="var(--color-signal)" stroke-width="${strokeWidth(1.25)}" vector-effect="non-scaling-stroke"/>`,
        `<circle cx="${passX.toFixed(1)}" cy="54" r="${radius(3.2)}" fill="var(--color-signal)"/>`,
        `<text x="${passX.toFixed(1)}" y="43" text-anchor="${passX > geometry.width - 70 ? 'end' : 'middle'}" font-size="${fontSize(12)}" font-family="var(--font-mono)" fill="var(--color-signal)">ISS</text>`,
      );
    }

    const sunAltitude = sunPosition(now, LATITUDE, LONGITUDE).altitude;
    const sunY = altToPlotY(sunAltitude, geometry);
    const moonY = altToPlotY(moonAltitude, geometry);
    const nowLabel = `NOW · ${BRECKENRIDGE_TIME.format(now)}`;
    fragments.push(
      `<text x="${currentX.toFixed(1)}" y="20" text-anchor="middle" font-size="${fontSize(13)}" font-family="var(--font-mono)" font-weight="650" letter-spacing=".25" fill="var(--outside-now)" paint-order="stroke" stroke="var(--outside-plate-edge)" stroke-width="${strokeWidth(3)}" stroke-linejoin="round">${nowLabel}</text>`,
      `<line x1="${currentX.toFixed(1)}" y1="31" x2="${currentX.toFixed(1)}" y2="${geometry.baseline}" stroke="var(--outside-now)" stroke-width="${strokeWidth(1.25)}" vector-effect="non-scaling-stroke"/>`,
    );

    // Rich Solar Compass-Ray Emblem & Lunar Orbital Ring
    const sunRays = sunAltitude > 0
      ? `<circle cx="0" cy="0" r="${radius(9.2)}" fill="none" stroke="var(--outside-sun-line)" stroke-opacity=".35" stroke-width="${strokeWidth(1)}" stroke-dasharray="1.5 2.5" vector-effect="non-scaling-stroke"/>
         <path d="M0,-12 L0,-8.5 M0,8.5 L0,12 M-12,0 L-8.5,0 M8.5,0 L12,0 M-8.2,-8.2 L-5.8,-5.8 M5.8,5.8 L8.2,8.2 M8.2,-8.2 L5.8,-5.8 M-5.8,5.8 L-8.2,8.2" stroke="var(--outside-sun-line)" stroke-opacity=".75" stroke-width="${strokeWidth(1.15)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`
      : '';
    fragments.push(
      `<g transform="translate(${currentX.toFixed(1)}, ${sunY.toFixed(1)})">
        ${sunRays}
        <circle cx="0" cy="0" r="${radius(sunAltitude > 0 ? 4.8 : 3.4)}" fill="${sunAltitude > 0 ? 'var(--outside-sun-line)' : 'var(--outside-plate-edge)'}" fill-opacity="${sunAltitude > 0 ? '1' : '.72'}" stroke="var(--outside-sun-line)" stroke-width="${strokeWidth(1.3)}" vector-effect="non-scaling-stroke"/>
      </g>`,
      `<g transform="translate(${currentX.toFixed(1)}, ${moonY.toFixed(1)})">
        <circle cx="0" cy="0" r="${radius(moonAltitude > 0 ? 7.2 : 4.8)}" fill="none" stroke="var(--outside-moon-line)" stroke-opacity="${moonAltitude > 0 ? '.35' : '.2'}" stroke-width="${strokeWidth(1)}" vector-effect="non-scaling-stroke"/>
        <circle cx="0" cy="0" r="${radius(moonAltitude > 0 ? 4.2 : 3)}" fill="var(--outside-plate-edge)" fill-opacity="${moonAltitude > 0 ? '1' : '.68'}" stroke="var(--outside-moon-line)" stroke-opacity="${moonAltitude > 0 ? '1' : '.55'}" stroke-width="${strokeWidth(1.7)}" vector-effect="non-scaling-stroke"/>
      </g>`,
      `<g data-scrub-group style="opacity:0; pointer-events:none; transition:opacity 140ms ease">
        <line data-scrub-line x1="0" y1="24" x2="0" y2="${(temperatureBottom + 4).toFixed(1)}" stroke="var(--outside-sun-line)" stroke-opacity=".78" stroke-width="${strokeWidth(1.15)}" stroke-dasharray="2 3" vector-effect="non-scaling-stroke"/>
        <circle data-scrub-sun cx="0" cy="${geometry.baseline}" r="${radius(4.6)}" fill="none" stroke="var(--outside-sun-line)" stroke-width="${strokeWidth(1.6)}" vector-effect="non-scaling-stroke"/>
        <circle data-scrub-moon cx="0" cy="${geometry.baseline}" r="${radius(4.2)}" fill="none" stroke="var(--outside-moon-line)" stroke-width="${strokeWidth(1.5)}" vector-effect="non-scaling-stroke"/>
      </g>`,
      `<g data-shooting-star-layer style="pointer-events:none"></g>`,
    );

    svg.innerHTML = fragments.join('');
    svg.setAttribute(
      'aria-label',
      `Rolling 24-hour Sun and Moon altitude and hourly temperature model chart for Breckenridge, from ${BRECKENRIDGE_WINDOW_TIME.format(model.window.start)} to ${BRECKENRIDGE_WINDOW_TIME.format(model.window.end)}. Now ${BRECKENRIDGE_WINDOW_TIME.format(now)}. ${moonCopy.description} Solid Sun and dashed Moon lines are strong above the horizon and faint below it. ${temperatureTrace ? `The hourly temperature model ranges from ${Math.round(temperatureTrace.min)} to ${Math.round(temperatureTrace.max)} degrees Fahrenheit.` : 'The hourly temperature model is unavailable.'} Weather and daylight affect actual visibility. Sunset potential is a cloud-layer heuristic, not a visibility guarantee. ${lastIssSummary}`,
    );
  }

  function render(
    now = new Date(),
    options: { ribbon?: boolean } = {},
  ) {
    if (destroyed) return;
    if (issPassEndsAt !== null && issPassEndsAt <= now.valueOf()) {
      issPassAt = null;
      issPassEndsAt = null;
      lastIssSummary = 'Finding the next visible pass…';
      setField('iss-summary', lastIssSummary);
      void loadIss();
    }
    updatePlate(now);
    renderDaylight(now);
    renderCelestial(now);
    renderWeather(now);
    if (options.ribbon !== false) renderRibbon(now);
  }

  async function loadWeather() {
    if (weatherInFlight) return;
    weatherInFlight = true;
    try {
      const [data, airQuality] = await Promise.all([
        requestJson(weatherForecastUrl()),
        requestJson(airQualityUrl())
          .then(parseOpenMeteoAirQuality)
          .catch(() => conditions?.airQuality ?? null),
      ]);
      const current = data.current;
      const daily = data.daily;
      const hourly = data.hourly ?? {};
      const receivedAt = Date.now();
      const candidate: Conditions = {
        temperature: current.temperature_2m,
        apparentTemperature: current.apparent_temperature,
        high: daily.temperature_2m_max?.[0] ?? current.temperature_2m,
        low: daily.temperature_2m_min?.[0] ?? current.temperature_2m,
        code: current.weather_code,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        windDirection: current.wind_direction_10m,
        uv: current.uv_index ?? daily.uv_index_max?.[0] ?? 0,
        precipitation: current.precipitation ?? 0,
        precipitationProbability: daily.precipitation_probability_max?.[0] ?? 0,
        cloud: current.cloud_cover,
        forecastHours: parseOpenMeteoHourly(hourly),
        airQuality,
      };
      const validated = parseRecentWeatherCache({
        observedAt: receivedAt,
        conditions: candidate,
      }, receivedAt);
      if (!validated) throw new Error('Weather response was incomplete');
      conditions = validated.conditions;
      usingRecentWeather = false;
      plateCondition = classifyPlateCondition({
        code: conditions.code,
        cloud: conditions.cloud,
        precipitation: conditions.precipitation,
      });
      plateConditionExpiresAt = receivedAt + CONDITION_CACHE_TTL_MS;
      try {
        localStorage.setItem(
          CONDITION_CACHE_KEY,
          JSON.stringify({
            condition: plateCondition,
            observedAt: receivedAt,
          } satisfies ConditionCache),
        );
        localStorage.setItem(
          WEATHER_CACHE_KEY,
          JSON.stringify({
            observedAt: receivedAt,
            conditions,
          } satisfies RecentWeatherCache),
        );
      } catch {
        // Storage is an optional optimization only.
      }
      root.dataset.weather = 'live';
      setField('source-status', 'weather live · almanac local');
      render(new Date());
    } catch (error) {
      if (abortController.signal.aborted) return;
      root.dataset.weather = conditions ? 'stale' : 'offline';
      setField(
        'source-status',
        conditions
          ? usingRecentWeather
            ? 'weather delayed · recent reading'
            : 'weather delayed · last reading'
          : 'weather delayed · almanac local',
      );
      if (!conditions) {
        setField('weather-desc', 'Astronomical view is live');
      }
    } finally {
      weatherInFlight = false;
    }
  }

  function applyIssPass(pass: {
    rise: { time: string; compass?: string };
    set?: { time?: string; compass?: string };
    visible_duration_sec?: number;
    duration_sec?: number;
    culmination?: { elevation_deg?: number };
  }) {
    const rise = new Date(pass.rise.time);
    const set = pass.set?.time ? new Date(pass.set.time) : new Date(NaN);
    const durationSeconds = Math.max(
      0,
      Math.round(pass.visible_duration_sec ?? pass.duration_sec ?? 0),
    );
    const today = breckenridgeDateKey(new Date());
    issPassAt = rise.valueOf();
    issPassEndsAt = Number.isFinite(set.valueOf())
      ? set.valueOf()
      : rise.valueOf() + durationSeconds * 1000;
    const day = breckenridgeDateKey(rise) === today
      ? 'Tonight'
      : new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'long',
      }).format(rise);
    const duration = `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;
    const peak = Math.round(pass.culmination?.elevation_deg ?? 0);
    const path = pass.rise.compass && pass.set?.compass
      ? ` · ${pass.rise.compass} → ${pass.set.compass}`
      : '';
    lastIssSummary = `ISS · ${day} ${BRECKENRIDGE_TIME.format(rise)}${path}`
      + `${peak ? ` · ${peak}° up` : ''} · visible ${duration}`;
    setField('iss-summary', lastIssSummary);
    renderRibbon(new Date());
  }

  async function loadIss() {
    if (issInFlight) return;
    issInFlight = true;
    try {
      const url = `https://iss-api.polluxlabs.io/iss-pass?lat=${LATITUDE}&lon=${LONGITUDE}`
        + '&visible_only=true&n=3&days_ahead=10&min_elevation=10';
      const rawPasses = (await requestJson(url)).passes;
      const nowMs = Date.now();
      const passes = Array.isArray(rawPasses)
        ? rawPasses.filter((p) => {
          const riseMs = Date.parse(p?.rise?.time ?? '');
          const setMs = Date.parse(p?.set?.time ?? '');
          return (
            Number.isFinite(riseMs)
            && (Number.isFinite(setMs) ? setMs > nowMs : riseMs > nowMs)
          );
        })
        : [];
      if (!passes.length) {
        issPassAt = null;
        issPassEndsAt = null;
        lastIssSummary = 'No visible ISS passes in the next 10 days';
        setField('iss-summary', lastIssSummary);
        renderRibbon(new Date());
        return;
      }

      const pass = passes[0];
      try {
        localStorage.setItem(ISS_CACHE_KEY, JSON.stringify(pass));
      } catch {
        // Storage is optional.
      }
      applyIssPass(pass);
    } catch {
      if (abortController.signal.aborted) return;
      try {
        const cachedRaw = localStorage.getItem(ISS_CACHE_KEY);
        if (cachedRaw) {
          const cachedPass = JSON.parse(cachedRaw);
          const riseMs = Date.parse(cachedPass?.rise?.time ?? '');
          const setMs = Date.parse(cachedPass?.set?.time ?? '');
          if (
            Number.isFinite(riseMs)
            && (Number.isFinite(setMs) ? setMs > Date.now() : riseMs > Date.now())
          ) {
            applyIssPass(cachedPass);
            return;
          }
        }
      } catch {
        // Ignore invalid cache.
      }
      issPassAt = null;
      issPassEndsAt = null;
      lastIssSummary = 'ISS pass prediction temporarily unavailable';
      setField('iss-summary', lastIssSummary);
    } finally {
      issInFlight = false;
    }
  }

  // Interactive 24-hour Time-Scrubber Loupe
  const ribbonSvg = query<SVGSVGElement>('[data-ribbon]');
  const scrubPill = query<HTMLElement>('[data-field="ribbon-scrub"]');
  if (ribbonSvg && scrubPill) {
    const updateScrub = (clientX: number) => {
      if (!activeRibbonModel) return;
      const rect = ribbonSvg.getBoundingClientRect();
      if (rect.width <= 0) return;
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const minute = ratio * activeRibbonModel.window.durationMinutes;
      const sampleAt = new Date(
        activeRibbonModel.window.start.valueOf() + minute * MINUTE,
      );
      const sunPos = sunPosition(sampleAt, LATITUDE, LONGITUDE);
      const moonPos = moonPosition(sampleAt, LATITUDE, LONGITUDE);
      const svgX = ratio * activeRibbonGeometry.width;
      const sunY = altToPlotY(sunPos.altitude, activeRibbonGeometry);
      const moonY = altToPlotY(moonPos.altitude, activeRibbonGeometry);

      const scrubGroup = ribbonSvg.querySelector<SVGGElement>('[data-scrub-group]');
      const scrubSun = ribbonSvg.querySelector<SVGCircleElement>('[data-scrub-sun]');
      const scrubMoon = ribbonSvg.querySelector<SVGCircleElement>('[data-scrub-moon]');
      if (scrubGroup) {
        scrubGroup.style.opacity = '1';
        scrubGroup.setAttribute('transform', `translate(${svgX.toFixed(1)}, 0)`);
      }
      if (scrubSun) scrubSun.setAttribute('cy', sunY.toFixed(1));
      if (scrubMoon) scrubMoon.setAttribute('cy', moonY.toFixed(1));

      scrubPill.hidden = false;
      scrubPill.textContent =
        `${BRECKENRIDGE_TIME.format(sampleAt)} · Sun ${Math.round(sunPos.altitude)}° ${compass(sunPos.azimuth)} · Moon ${Math.round(moonPos.altitude)}° ${compass(moonPos.azimuth)}`;
    };

    const clearScrub = () => {
      const scrubGroup = ribbonSvg.querySelector<SVGGElement>('[data-scrub-group]');
      if (scrubGroup) scrubGroup.style.opacity = '0';
      scrubPill.hidden = true;
    };

    ribbonSvg.addEventListener(
      'pointermove',
      (e: PointerEvent) => updateScrub(e.clientX),
      { signal: abortController.signal },
    );
    ribbonSvg.addEventListener(
      'pointerdown',
      (e: PointerEvent) => updateScrub(e.clientX),
      { signal: abortController.signal },
    );
    ribbonSvg.addEventListener('pointerleave', clearScrub, {
      signal: abortController.signal,
    });
    ribbonSvg.addEventListener('pointercancel', clearScrub, {
      signal: abortController.signal,
    });
  }

  // Easter Egg: Night Watch Moon Medallion -> Lunar Distance Telemetry + Shooting Star
  const moonTrigger = query<HTMLButtonElement>('[data-moon-trigger]');
  if (moonTrigger) {
    moonTrigger.addEventListener(
      'click',
      () => {
        const now = new Date();
        const telemetryEl = query<HTMLElement>('[data-field="moon-telemetry"]');
        if (telemetryEl) {
          const distKm = moonDistanceKm(now);
          const pos = moonPosition(now, LATITUDE, LONGITUDE);
          telemetryEl.hidden = false;
          telemetryEl.textContent =
            `✦ ${distKm.toLocaleString('en-US')} km away · ${Math.round(pos.altitude)}° alt ${compass(pos.azimuth)}`;
        }
        const starLayer = query<SVGGElement>('[data-shooting-star-layer]');
        if (
          starLayer
          && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          const startX = Math.round(activeRibbonGeometry.width * (0.18 + Math.random() * 0.45));
          const startY = Math.round(14 + Math.random() * 24);
          starLayer.innerHTML = `<g transform="translate(${startX}, ${startY})">
            <line x1="-52" y1="-12" x2="0" y2="0" stroke="var(--outside-sun-line)" stroke-width="1.8" stroke-linecap="round" opacity="0.85" />
            <circle cx="0" cy="0" r="2.6" fill="#fffaf0" />
          </g>`;
          const meteor = starLayer.firstElementChild as SVGGElement | null;
          meteor?.animate(
            [
              { transform: `translate(${startX}px, ${startY}px) scale(0.7)`, opacity: 0 },
              { transform: `translate(${startX + 70}px, ${startY + 16}px) scale(1)`, opacity: 1, offset: 0.22 },
              { transform: `translate(${startX + 260}px, ${startY + 58}px) scale(0.85)`, opacity: 0 },
            ],
            { duration: 920, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' },
          );
        }
      },
      { signal: abortController.signal },
    );
  }

  const onTextureReady = () => {
    if (!destroyed) renderCelestial(new Date());
  };
  moonTexture.addEventListener('load', onTextureReady);

  const initialNow = new Date();
  // Start the high-priority photographic request before the Moon texture,
  // large SVG, and optional ISS request compete for the first frame.
  render(initialNow, { ribbon: false });
  moonTexture.src = '/images/outside/celestial/moon.webp';
  void loadWeather();

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  const finishDeferredStartup = () => {
    if (destroyed) return;
    renderRibbon(new Date());
    void loadIss();
  };
  if (idleWindow.requestIdleCallback) {
    deferredStartupIdle = idleWindow.requestIdleCallback(
      finishDeferredStartup,
      { timeout: 800 },
    );
  } else {
    deferredStartupTimer = window.setTimeout(finishDeferredStartup, 250);
  }

  timers.push(
    window.setInterval(() => render(new Date()), MINUTE),
    window.setInterval(() => void loadWeather(), WEATHER_REFRESH_MS),
    window.setInterval(() => void loadIss(), ISS_REFRESH_MS),
  );

  const resizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(() => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        const now = new Date();
        updatePlate(now);
        if (ribbonStarted) renderRibbon(now);
      }, 120);
    });
  resizeObserver?.observe(root);

  return () => {
    if (destroyed) return;
    destroyed = true;
    abortController.abort();
    timers.forEach((timer) => window.clearInterval(timer));
    window.clearTimeout(resizeTimer);
    window.clearTimeout(deferredStartupTimer);
    if (deferredStartupIdle !== undefined) {
      idleWindow.cancelIdleCallback?.(deferredStartupIdle);
    }
    resizeObserver?.disconnect();
    moonTexture.removeEventListener('load', onTextureReady);
    compositor.destroy();
  };
}

/**
 * Bind the controller once across Astro view transitions. The current module
 * supplies the latest init function while one durable lifecycle listener owns
 * page swaps, preventing duplicate intervals after navigation.
 */
export function installOutsideLifecycle() {
  const outsideWindow = window as OutsideWindow;
  outsideWindow.__outsideAlmanacInit = () => {
    const root = document.getElementById('outside-band');
    if (
      root
      && root === outsideWindow.__outsideAlmanacRoot
      && outsideWindow.__outsideAlmanacCleanup
    ) {
      return;
    }

    outsideWindow.__outsideAlmanacCleanup?.();
    outsideWindow.__outsideAlmanacRoot = root ?? undefined;
    outsideWindow.__outsideAlmanacCleanup = root
      ? mountOutside(root)
      : undefined;
  };

  if (!outsideWindow.__outsideAlmanacLifecycleBound) {
    outsideWindow.__outsideAlmanacLifecycleBound = true;
    document.addEventListener('astro:page-load', () => {
      outsideWindow.__outsideAlmanacInit?.();
    });
    document.addEventListener('astro:before-swap', () => {
      outsideWindow.__outsideAlmanacCleanup?.();
      outsideWindow.__outsideAlmanacCleanup = undefined;
      outsideWindow.__outsideAlmanacRoot = undefined;
    });
  }

  outsideWindow.__outsideAlmanacInit();
}
