import { describe, expect, it } from 'vitest';
import {
  aqiLabel,
  assessSunsetPotential,
  buildTemperatureTrace,
  formatAirDetail,
  parseOpenMeteoAirQuality,
  parseOpenMeteoHourly,
  validateForecastHours,
  type ForecastHour,
} from '../forecast';
import type { RibbonWindow } from '../ribbon';

const HOUR = 60 * 60_000;
const START = Date.parse('2026-07-27T12:00:00.000Z');
const window: RibbonWindow = {
  start: new Date(START),
  end: new Date(START + 24 * HOUR),
  durationMinutes: 24 * 60,
  focusMinute: 6 * 60,
};

function hour(
  offset: number,
  values: Partial<Omit<ForecastHour, 'at'>> = {},
): ForecastHour {
  return {
    at: START + offset * HOUR,
    temperature: 80,
    weatherCode: 0,
    lowCloud: 10,
    midCloud: 30,
    highCloud: 45,
    precipitationProbability: 5,
    ...values,
  };
}

describe('Open-Meteo hourly parsing', () => {
  it('turns Unix seconds into absolute milliseconds without viewer timezone math', () => {
    const parsed = parseOpenMeteoHourly({
      time: [1785175200, 'bad', 1785178800],
      temperature_2m: [91.2, 999, 92.5],
      weather_code: [0, 0, 2],
      cloud_cover_low: [8, 9, 110],
      cloud_cover_mid: [20, 21, -5],
      cloud_cover_high: [42, 43, 60],
      precipitation_probability: [4, 5, 140],
    });

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({
      at: 1785175200 * 1000,
      temperature: 91.2,
      lowCloud: 8,
    });
    expect(parsed[1]).toMatchObject({
      at: 1785178800 * 1000,
      temperature: 92.5,
      lowCloud: 100,
      midCloud: 0,
      precipitationProbability: 100,
    });
  });

  it('keeps absent forecast values null instead of inventing zeroes', () => {
    expect(parseOpenMeteoHourly({
      time: [1785175200],
      temperature_2m: [null],
    })[0]).toMatchObject({
      temperature: null,
      lowCloud: null,
      midCloud: null,
      highCloud: null,
    });
  });

  it('validates serialized cache hours and drops malformed entries', () => {
    expect(validateForecastHours([
      hour(1),
      { ...hour(0), lowCloud: 130 },
      { ...hour(0), temperature: 90 },
      { at: 'not-a-number', temperature: 82 },
    ])).toMatchObject([
      { at: START, lowCloud: 100 },
      { at: START + HOUR },
    ]);
  });

  it('bounds cached hours and turns impossible readings into unavailable data', () => {
    expect(validateForecastHours([
      hour(-2),
      { ...hour(0), temperature: 999, weatherCode: 400 },
      hour(2),
    ], {
      minAt: START - HOUR,
      maxAt: START + HOUR,
    })).toEqual([
      expect.objectContaining({
        at: START,
        temperature: null,
        weatherCode: null,
      }),
    ]);
  });
});

describe('24-hour temperature trace', () => {
  it('shares the ribbon x axis and places warmer readings higher', () => {
    const trace = buildTemperatureTrace(
      [
        hour(0, { temperature: 72 }),
        hour(12, { temperature: 90 }),
        hour(24, { temperature: 78 }),
      ],
      window,
      { width: 1200, top: 140, bottom: 170 },
    );

    expect(trace).not.toBeNull();
    expect(trace?.points[0].x).toBe(0);
    expect(trace?.points[1].x).toBe(600);
    expect(trace?.points[2].x).toBe(1200);
    expect(trace?.points[1].y).toBeLessThan(trace?.points[0].y ?? 0);
    expect(trace?.min).toBe(72);
    expect(trace?.max).toBe(90);
  });

  it('uses at least a 12 degree scale so tiny changes are not exaggerated', () => {
    const trace = buildTemperatureTrace(
      [hour(0, { temperature: 79 }), hour(1, { temperature: 80 })],
      window,
      { width: 1200, top: 140, bottom: 170 },
    );
    expect((trace?.scaleMax ?? 0) - (trace?.scaleMin ?? 0)).toBe(12);
  });

  it('breaks the path across missing-hour gaps', () => {
    const trace = buildTemperatureTrace(
      [hour(0), hour(1), hour(3), hour(4)],
      window,
      { width: 1200, top: 140, bottom: 170 },
    );
    expect(trace?.path.match(/M/g)).toHaveLength(2);
  });

  it('renders no plausible-looking line from fewer than two valid readings', () => {
    expect(buildTemperatureTrace(
      [hour(0), hour(1, { temperature: null })],
      window,
      { width: 1200, top: 140, bottom: 170 },
    )).toBeNull();
  });
});

describe('sunset cloud-layer potential', () => {
  const sunsetAt = START + 8.5 * HOUR;

  const aroundSunset = (
    values: Partial<Omit<ForecastHour, 'at'>>,
  ): ForecastHour[] => [
    hour(8, values),
    hour(9, values),
  ];

  it('calls partial upper cloud with little low cloud promising', () => {
    expect(assessSunsetPotential(aroundSunset({
      lowCloud: 12,
      midCloud: 28,
      highCloud: 52,
    }), sunsetAt)?.band).toBe('promising');
  });

  it('calls a nearly cloudless layer mix subtle instead of promising color', () => {
    expect(assessSunsetPotential(aroundSunset({
      lowCloud: 5,
      midCloud: 4,
      highCloud: 8,
    }), sunsetAt)?.band).toBe('subtle');
  });

  it('lets dense low cloud, storms, or high rain chance override upper layers', () => {
    expect(assessSunsetPotential(aroundSunset({
      lowCloud: 82,
    }), sunsetAt)?.band).toBe('obscured');
    expect(assessSunsetPotential(aroundSunset({
      weatherCode: 95,
    }), sunsetAt)?.band).toBe('obscured');
    expect(assessSunsetPotential(aroundSunset({
      precipitationProbability: 75,
    }), sunsetAt)?.band).toBe('obscured');
  });

  it('uses mixed for a layer balance that does not support a stronger claim', () => {
    expect(assessSunsetPotential(aroundSunset({
      lowCloud: 48,
      midCloud: 40,
      highCloud: 55,
    }), sunsetAt)?.band).toBe('mixed');
  });

  it('weights the hour nearest sunset more heavily across midnight', () => {
    const lateSunset = START + 12.25 * HOUR;
    const potential = assessSunsetPotential([
      hour(11, { lowCloud: 5, midCloud: 10, highCloud: 10 }),
      hour(12, { lowCloud: 15, midCloud: 35, highCloud: 60 }),
      hour(13, { lowCloud: 25, midCloud: 45, highCloud: 70 }),
    ], lateSunset);

    expect(potential?.sampleCount).toBe(3);
    expect(potential?.highCloud).toBeGreaterThan(45);
    expect(potential?.band).toBe('promising');
  });

  it('returns unavailable when fewer than two complete layer samples exist', () => {
    expect(assessSunsetPotential([
      hour(8),
      hour(9, { highCloud: null }),
    ], sunsetAt)).toBeNull();
  });
});

describe('Open-Meteo air quality parsing and formatting', () => {
  it('maps US AQI bands to concise field-note labels', () => {
    expect(aqiLabel(28)).toBe('good');
    expect(aqiLabel(72)).toBe('moderate');
    expect(aqiLabel(125)).toBe('sensitive');
    expect(aqiLabel(175)).toBe('unhealthy');
    expect(aqiLabel(250)).toBe('very unhealthy');
    expect(aqiLabel(340)).toBe('hazardous');
  });

  it('parses both live Open-Meteo payloads and cached air-quality objects', () => {
    expect(parseOpenMeteoAirQuality({
      current: { us_aqi: 28, pm2_5: 6.4, dust: 12 },
    })).toEqual({
      usAqi: 28,
      pm25: 6.4,
      dust: 12,
    });

    expect(parseOpenMeteoAirQuality({
      usAqi: 64,
      pm25: 14.2,
      dust: null,
    })).toEqual({
      usAqi: 64,
      pm25: 14.2,
      dust: null,
    });
  });

  it('drops out-of-range or empty air-quality payloads', () => {
    expect(parseOpenMeteoAirQuality(null)).toBeNull();
    expect(parseOpenMeteoAirQuality({
      current: { us_aqi: -5, pm2_5: 'bad', dust: 99999 },
    })).toBeNull();
  });

  it('enriches humidity with AQI when available and falls back cleanly when offline', () => {
    expect(formatAirDetail(42.4, { usAqi: 28, pm25: 5.1, dust: 8 })).toBe(
      '42% humidity · AQI 28 good',
    );
    expect(formatAirDetail(42.4, null)).toBe('42% humidity');
    expect(formatAirDetail(42.4, { usAqi: null, pm25: 5.1, dust: 8 })).toBe(
      '42% humidity',
    );
  });
});
