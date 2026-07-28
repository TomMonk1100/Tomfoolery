import { describe, expect, it } from 'vitest';
import {
  OUTSIDE_PLATE_PRESENTATIONS,
  moonEditorialCopy,
  nextSunsetAt,
  parseRecentWeatherCache,
  platePresentationFor,
  rollingTimelineMarks,
  shouldCommitPlatePresentation,
  weatherForecastUrl,
} from '../outside-controller';
import {
  PLATE_CONDITIONS,
  SOLAR_MOMENTS,
  buildBreckenridgeSolarSchedule,
} from '../plates';

describe('Outside plate presentation atlas', () => {
  it('authors contrast and focal treatment for every condition and moment', () => {
    for (const condition of PLATE_CONDITIONS) {
      expect(Object.keys(OUTSIDE_PLATE_PRESENTATIONS[condition])).toEqual(
        [...SOLAR_MOMENTS],
      );

      for (const moment of SOLAR_MOMENTS) {
        const authored = platePresentationFor(condition, moment);
        expect(['light', 'dark']).toContain(authored.tone);
        expect(['soft', 'balanced', 'strong']).toContain(authored.contrast);
        expect(['horizon', 'oak-line', 'cloud-field', 'rain-core'])
          .toContain(authored.focal);
      }
    }
  });

  it('uses dark, locally protected copy over the dramatic storm family', () => {
    for (const moment of SOLAR_MOMENTS) {
      const authored = platePresentationFor('storm', moment);
      expect(authored.tone).toBe('dark');
      expect(authored.focal).toBe('rain-core');
    }
    expect(platePresentationFor('storm', 'sunset').contrast).toBe('strong');
  });

  it('keeps bright authored plates on warm dark-ink treatments', () => {
    expect(platePresentationFor('clear', 'sunrise').tone).toBe('light');
    expect(platePresentationFor('clear', 'noon').tone).toBe('light');
    expect(platePresentationFor('overcast', 'predawn').tone).toBe('light');
  });
});

describe('atomic plate presentation commit', () => {
  it('commits only once the requested raster is visible', () => {
    expect(shouldCommitPlatePresentation('shown')).toBe(true);
    expect(shouldCommitPlatePresentation('unchanged')).toBe(true);
    expect(shouldCommitPlatePresentation('retained')).toBe(false);
    expect(shouldCommitPlatePresentation('superseded')).toBe(false);
    expect(shouldCommitPlatePresentation('destroyed')).toBe(false);
  });
});

describe('Moon horizon labels', () => {
  it('describes a cross-midnight visibility window without clipping the time', () => {
    const now = new Date('2026-07-27T20:38:00.000Z'); // 3:38 PM CDT
    const copy = moonEditorialCopy(false, [
      {
        kind: 'rise',
        minute: 243,
        at: new Date('2026-07-28T00:41:00.000Z'),
      },
      {
        kind: 'set',
        minute: 948,
        at: new Date('2026-07-28T12:26:00.000Z'),
      },
    ], now);

    expect(copy.status).toBe('below horizon · rises 7:41 PM');
    expect(copy.summary).toBe('7:41 PM → 7:26 AM tomorrow');
    expect(copy.description).toContain('sets 7:26 AM tomorrow');
  });
});

describe('rolling timeline labels', () => {
  it('turns midnight into a labelled transition inside the window', () => {
    const start = new Date('2026-07-27T14:38:00.000Z'); // 9:38 AM CDT
    const end = new Date(start.valueOf() + 24 * 60 * 60_000);
    expect(rollingTimelineMarks({
      start,
      end,
      durationMinutes: 1440,
      focusMinute: 360,
    })).toEqual([
      { minute: 142, label: '12p', kind: 'time' },
      { minute: 502, label: '6p', kind: 'time' },
      { minute: 862, label: 'TUE · 12A', kind: 'day' },
      { minute: 1222, label: '6a', kind: 'time' },
    ]);
  });
});

describe('next sunset selection', () => {
  it('continues to the following day after tonight’s sunset has passed', () => {
    const now = new Date('2026-07-28T03:00:00.000Z'); // 10 PM CDT Monday
    const sunset = nextSunsetAt(
      buildBreckenridgeSolarSchedule(now),
      now,
    );

    expect(sunset).not.toBeNull();
    expect((sunset ?? 0) - now.valueOf()).toBeGreaterThan(18 * 60 * 60_000);
    expect((sunset ?? 0) - now.valueOf()).toBeLessThan(26 * 60 * 60_000);
  });
});

describe('Outside weather request', () => {
  it('requests one bounded rolling temperature and cloud-layer window', () => {
    const url = new URL(weatherForecastUrl());
    const hourly = url.searchParams.get('hourly')?.split(',') ?? [];

    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('past_hours')).toBe('6');
    expect(url.searchParams.get('forecast_hours')).toBe('30');
    expect(url.searchParams.get('forecast_days')).toBe('2');
    expect(hourly).toEqual(expect.arrayContaining([
      'temperature_2m',
      'weather_code',
      'cloud_cover_low',
      'cloud_cover_mid',
      'cloud_cover_high',
      'precipitation_probability',
    ]));
  });
});

describe('recent weather snapshot', () => {
  const now = Date.parse('2026-07-27T20:00:00.000Z');
  const snapshot = {
    observedAt: now - 10 * 60_000,
    conditions: {
      temperature: 94,
      apparentTemperature: 96,
      high: 98,
      low: 74,
      code: 1,
      humidity: 35,
      windSpeed: 11,
      windDirection: 190,
      uv: 2.1,
      precipitation: 0,
      precipitationProbability: 5,
      cloud: 12,
      forecastHours: [
        {
          at: now,
          temperature: 94,
          weatherCode: 1,
          lowCloud: 4,
          midCloud: 20,
          highCloud: 35,
          precipitationProbability: 5,
        },
      ],
    },
  };

  it('accepts a fully validated snapshot for an explicitly recent reading', () => {
    expect(parseRecentWeatherCache(snapshot, now)).toMatchObject({
      observedAt: snapshot.observedAt,
      conditions: {
        temperature: 94,
        forecastHours: [{ at: now, highCloud: 35 }],
      },
    });
  });

  it('rejects expired, future-dated, and malformed cached weather', () => {
    expect(parseRecentWeatherCache({
      ...snapshot,
      observedAt: now - 31 * 60_000,
    }, now)).toBeNull();
    expect(parseRecentWeatherCache({
      ...snapshot,
      observedAt: now + 1,
    }, now)).toBeNull();
    expect(parseRecentWeatherCache({
      ...snapshot,
      conditions: { ...snapshot.conditions, temperature: '94' },
    }, now)).toBeNull();
    expect(parseRecentWeatherCache({
      ...snapshot,
      conditions: { ...snapshot.conditions, humidity: 900 },
    }, now)).toBeNull();
  });
});
