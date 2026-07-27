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
  type RibbonWindow,
} from './ribbon';
import { uvLabel } from './sky';

const LATITUDE = 32.7557;
const LONGITUDE = -98.9023;
const TIME_ZONE = 'America/Chicago';
const WEATHER_REFRESH_MS = 15 * 60_000;
const ISS_REFRESH_MS = 6 * 60 * 60_000;
const REQUEST_TIMEOUT_MS = 12_000;
const CONDITION_CACHE_TTL_MS = 2 * 60 * 60_000;
const CONDITION_CACHE_KEY = 'outside:breckenridge-condition';
const MINUTE = 60_000;
const RIBBON_LOOKBACK_MINUTES = 6 * 60;
const RIBBON_DURATION_MINUTES = 24 * 60;
const RIBBON_DESKTOP: RibbonGeometry = {
  width: 1440,
  height: 240,
  baseline: 116,
  maxAltitude: 90,
  minAltitude: -90,
  belowBand: 44,
};
const RIBBON_MOBILE: RibbonGeometry = {
  ...RIBBON_DESKTOP,
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

interface Conditions {
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
  eveningCondition: PlateCondition;
  eveningPrecipitationProbability: number;
}

interface ConditionCache {
  condition: PlateCondition;
  observedAt: number;
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

function eveningForecastIndex(times: unknown, dateKey: string): number {
  if (!Array.isArray(times)) return -1;
  const preferred = times.indexOf(`${dateKey}T20:00`);
  if (preferred >= 0) return preferred;
  return times.findIndex(
    (value) =>
      typeof value === 'string'
      && value >= `${dateKey}T18:00`
      && value <= `${dateKey}T23:59`,
  );
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
  const radius = size * 0.465;
  context.clearRect(0, 0, size, size);
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
  context.strokeStyle = 'rgba(255, 248, 225, .42)';
  context.lineWidth = Math.max(1, size * 0.008);
  context.stroke();
}

function eveningCopy(
  condition: PlateCondition,
  precipitationProbability: number,
): [string, string] {
  const rainChance = `${Math.round(precipitationProbability)}% rain chance`;
  switch (condition) {
    case 'storm':
      return ['Storm watch', `${rainChance} · storms possible`];
    case 'overcast':
      return [
        'Clouded evening',
        precipitationProbability >= 20
          ? `${rainChance} · overcast`
          : 'Cloud cover holds after sunset',
      ];
    case 'scattered':
      return [
        'Broken clouds',
        precipitationProbability >= 20
          ? rainChance
          : 'Openings after sunset',
      ];
    default:
      return [
        'Clear evening',
        precipitationProbability >= 20
          ? rainChance
          : 'Cooling after sunset',
      ];
  }
}

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
  let plateConditionExpiresAt: number | null = null;
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

  const moonTexture = new Image();
  moonTexture.decoding = 'async';
  moonTexture.src = '/images/outside/celestial/moon.webp';

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

  function renderCelestial(now: Date) {
    const { fraction, waxing } = moonIllumination(now);
    const phase = moonPhaseName(fraction, waxing);
    const illuminated = Math.round(fraction * 100);

    setField('moon-phase', phase);
    setField('moon-fraction', `${illuminated}%`);
    const portrait = query<HTMLCanvasElement>('[data-moon-portrait]');
    drawTexturedMoon(portrait, moonTexture, fraction, waxing);
  }

  function renderWeather() {
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
    setField('air-detail', `${Math.round(current.humidity)}% humidity`);
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
    const [tonightValue, tonightDetail] = eveningCopy(
      current.eveningCondition,
      current.eveningPrecipitationProbability,
    );
    setField('tonight-value', tonightValue);
    setField('tonight-detail', tonightDetail);
  }

  function renderRibbon(now: Date) {
    const svg = query<SVGSVGElement>('[data-ribbon]');
    if (!svg) return;

    const geometry = window.matchMedia('(max-width: 720px)').matches
      ? RIBBON_MOBILE
      : RIBBON_DESKTOP;
    svg.setAttribute(
      'viewBox',
      `0 0 ${geometry.width} ${geometry.height}`,
    );

    const model = buildRollingRibbon(now, LATITUDE, LONGITUDE, geometry, {
      beforeMinutes: RIBBON_LOOKBACK_MINUTES,
      durationMinutes: RIBBON_DURATION_MINUTES,
      stepMinutes: 6,
    });
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
        <mask id="outside-horizon-mask" maskUnits="userSpaceOnUse" x="0" y="${geometry.baseline - 40}" width="${geometry.width}" height="40">
          <rect x="0" y="${geometry.baseline - 40}" width="${geometry.width}" height="40" fill="url(#outside-horizon-fade)"/>
        </mask>
      </defs>`,
      `<rect x="0" y="${geometry.baseline - 40}" width="${geometry.width}" height="40" fill="url(#outside-day-wash)" mask="url(#outside-horizon-mask)"/>`,
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

    for (const mark of rollingTimelineMarks(model.window)) {
      const tickX = x(mark.minute);
      const anchor =
        tickX < 65 ? 'start' : tickX > geometry.width - 65 ? 'end' : 'middle';
      if (mark.kind === 'day') {
        fragments.push(
          `<line x1="${tickX.toFixed(1)}" y1="30" x2="${tickX.toFixed(1)}" y2="${geometry.height - 48}" stroke="var(--outside-line)" stroke-width="${strokeWidth(1)}" stroke-dasharray="3 6" vector-effect="non-scaling-stroke"/>`,
        );
      }
      fragments.push(
        `<line x1="${tickX.toFixed(1)}" y1="${geometry.baseline}" x2="${tickX.toFixed(1)}" y2="${geometry.baseline + 7}" stroke="var(--outside-line)" stroke-width="${strokeWidth(1)}" vector-effect="non-scaling-stroke"/>`,
        `<text x="${tickX.toFixed(1)}" y="${geometry.height - 16}" text-anchor="${anchor}" font-size="${fontSize(mark.kind === 'day' ? 13 : 12.5)}" font-family="var(--font-mono)" font-weight="${mark.kind === 'day' ? '650' : '400'}" letter-spacing="${mark.kind === 'day' ? '.3' : '0'}" fill="${mark.kind === 'day' ? 'var(--outside-ink)' : 'var(--outside-muted)'}">${mark.label}</text>`,
      );
    }

    for (const event of model.sunEvents) {
      const eventX = x(event.minute);
      fragments.push(
        `<circle cx="${eventX.toFixed(1)}" cy="${geometry.baseline}" r="${radius(2.7)}" fill="var(--outside-sun-line)" stroke="var(--outside-plate-edge)" stroke-width="${strokeWidth(1)}" vector-effect="non-scaling-stroke"/>`,
      );
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

    const currentMinute =
      model.window.focusMinute ?? RIBBON_LOOKBACK_MINUTES;
    const currentX = x(currentMinute);
    const sunAltitude = sunPosition(now, LATITUDE, LONGITUDE).altitude;
    const nowLabel = `NOW · ${BRECKENRIDGE_TIME.format(now)}`;
    fragments.push(
      `<text x="${currentX.toFixed(1)}" y="20" text-anchor="middle" font-size="${fontSize(13)}" font-family="var(--font-mono)" font-weight="650" letter-spacing=".25" fill="var(--outside-now)" paint-order="stroke" stroke="var(--outside-plate-edge)" stroke-width="${strokeWidth(3)}" stroke-linejoin="round">${nowLabel}</text>`,
      `<line x1="${currentX.toFixed(1)}" y1="31" x2="${currentX.toFixed(1)}" y2="${geometry.baseline}" stroke="var(--outside-now)" stroke-width="${strokeWidth(1.25)}" vector-effect="non-scaling-stroke"/>`,
    );
    fragments.push(
      `<circle cx="${currentX.toFixed(1)}" cy="${altToPlotY(sunAltitude, geometry).toFixed(1)}" r="${radius(sunAltitude > 0 ? 4.4 : 3.2)}" fill="${sunAltitude > 0 ? 'var(--outside-sun-line)' : 'var(--outside-plate-edge)'}" fill-opacity="${sunAltitude > 0 ? '1' : '.72'}" stroke="var(--outside-sun-line)" stroke-width="${strokeWidth(1.1)}" vector-effect="non-scaling-stroke"/>`,
      `<circle cx="${currentX.toFixed(1)}" cy="${altToPlotY(moonAltitude, geometry).toFixed(1)}" r="${radius(moonAltitude > 0 ? 4 : 3)}" fill="var(--outside-plate-edge)" fill-opacity="${moonAltitude > 0 ? '1' : '.68'}" stroke="var(--outside-moon-line)" stroke-opacity="${moonAltitude > 0 ? '1' : '.55'}" stroke-width="${strokeWidth(1.7)}" vector-effect="non-scaling-stroke"/>`,
    );

    svg.innerHTML = fragments.join('');
    svg.setAttribute(
      'aria-label',
      `Rolling 24-hour Sun and Moon altitude chart for Breckenridge, from ${BRECKENRIDGE_WINDOW_TIME.format(model.window.start)} to ${BRECKENRIDGE_WINDOW_TIME.format(model.window.end)}. Now ${BRECKENRIDGE_WINDOW_TIME.format(now)}. ${moonCopy.description} Solid Sun and dashed Moon lines are strong above the horizon and faint below it. Weather and daylight affect actual visibility. ${lastIssSummary}`,
    );
  }

  function render(now = new Date()) {
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
    renderWeather();
    renderRibbon(now);
  }

  async function loadWeather() {
    if (weatherInFlight) return;
    weatherInFlight = true;
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${LATITUDE}&longitude=${LONGITUDE}`
        + '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,uv_index'
        + '&hourly=weather_code,cloud_cover,precipitation_probability'
        + '&daily=temperature_2m_max,temperature_2m_min,uv_index_max,precipitation_probability_max'
        + '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FChicago&forecast_days=1';
      const data = await requestJson(url);
      const current = data.current;
      const daily = data.daily;
      const hourly = data.hourly ?? {};
      const eveningIndex = eveningForecastIndex(
        hourly.time,
        breckenridgeDateKey(new Date()),
      );
      const eveningCode = hourly.weather_code?.[eveningIndex]
        ?? current.weather_code;
      const eveningCloud = hourly.cloud_cover?.[eveningIndex]
        ?? current.cloud_cover;
      const eveningPrecipitationProbability =
        hourly.precipitation_probability?.[eveningIndex]
        ?? daily.precipitation_probability_max?.[0]
        ?? 0;
      conditions = {
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
        eveningCondition: classifyPlateCondition({
          code: eveningCode,
          cloud: eveningCloud,
        }),
        eveningPrecipitationProbability,
      };
      plateCondition = classifyPlateCondition({
        code: conditions.code,
        cloud: conditions.cloud,
        precipitation: conditions.precipitation,
      });
      plateConditionExpiresAt = Date.now() + CONDITION_CACHE_TTL_MS;
      try {
        localStorage.setItem(
          CONDITION_CACHE_KEY,
          JSON.stringify({
            condition: plateCondition,
            observedAt: Date.now(),
          } satisfies ConditionCache),
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
        conditions ? 'weather delayed · last reading' : 'weather delayed · almanac local',
      );
      if (!conditions) {
        setField('weather-desc', 'Astronomical view is live');
      }
    } finally {
      weatherInFlight = false;
    }
  }

  async function loadIss() {
    if (issInFlight) return;
    issInFlight = true;
    try {
      const url = `https://iss-api.polluxlabs.io/iss-pass?lat=${LATITUDE}&lon=${LONGITUDE}`
        + '&visible_only=true&n=3&days_ahead=10&min_elevation=10';
      const passes = (await requestJson(url)).passes ?? [];
      if (!passes.length) {
        issPassAt = null;
        issPassEndsAt = null;
        lastIssSummary = 'No visible ISS passes in the next 10 days';
        setField('iss-summary', lastIssSummary);
        renderRibbon(new Date());
        return;
      }

      const pass = passes[0];
      const rise = new Date(pass.rise.time);
      const set = new Date(pass.set.time);
      const durationSeconds = Math.round(
        pass.visible_duration_sec ?? pass.duration_sec ?? 0,
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
      lastIssSummary = `ISS · ${day} ${BRECKENRIDGE_TIME.format(rise)} · ${pass.rise.compass} → ${pass.set.compass}`
        + `${peak ? ` · ${peak}° up` : ''} · visible ${duration}`;
      setField('iss-summary', lastIssSummary);
      renderRibbon(new Date());
    } catch {
      if (abortController.signal.aborted) return;
      issPassAt = null;
      issPassEndsAt = null;
      lastIssSummary = 'ISS pass prediction temporarily unavailable';
      setField('iss-summary', lastIssSummary);
    } finally {
      issInFlight = false;
    }
  }

  const onTextureReady = () => {
    if (!destroyed) renderCelestial(new Date());
  };
  moonTexture.addEventListener('load', onTextureReady);

  render();
  void loadWeather();
  void loadIss();

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
        renderRibbon(now);
      }, 120);
    });
  resizeObserver?.observe(root);

  return () => {
    if (destroyed) return;
    destroyed = true;
    abortController.abort();
    timers.forEach((timer) => window.clearInterval(timer));
    window.clearTimeout(resizeTimer);
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
    outsideWindow.__outsideAlmanacCleanup?.();
    const root = document.getElementById('outside-band');
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
    });
  }

  outsideWindow.__outsideAlmanacInit();
}
