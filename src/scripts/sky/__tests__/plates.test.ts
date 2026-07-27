import { describe, expect, it } from 'vitest';
import {
  MAX_PLATE_BLEND_MINUTES,
  PLATE_CONDITIONS,
  PLATE_MANIFEST,
  SOLAR_MOMENTS,
  buildBreckenridgeSolarSchedule,
  classifyPlateCondition,
  plateAssetBase,
  plateFrameAt,
  type PlateSchedule,
  type SolarMomentAnchor,
} from '../plates';

const summer = buildBreckenridgeSolarSchedule(new Date('2026-07-26T18:00:00Z'));
const winter = buildBreckenridgeSolarSchedule(new Date('2026-12-21T18:00:00Z'));

const anchorsForOneCycle = (schedule: PlateSchedule): readonly SolarMomentAnchor[] => {
  const start = schedule.anchors.findIndex((anchor, index) =>
    anchor.moment === 'night' &&
    schedule.anchors.slice(index, index + SOLAR_MOMENTS.length)
      .every((item, offset) => item.moment === SOLAR_MOMENTS[offset]));
  expect(start).toBeGreaterThanOrEqual(0);
  return schedule.anchors.slice(start, start + SOLAR_MOMENTS.length);
};

describe('stable plate manifest', () => {
  it('keeps condition and solar-moment keys in their authored order', () => {
    expect(PLATE_CONDITIONS).toEqual(['clear', 'scattered', 'overcast', 'storm']);
    expect(SOLAR_MOMENTS).toEqual([
      'night', 'predawn', 'sunrise', 'morning',
      'noon', 'golden', 'sunset', 'blue-hour',
    ]);
    expect(PLATE_MANIFEST.conditions).toBe(PLATE_CONDITIONS);
    expect(PLATE_MANIFEST.solarMoments).toBe(SOLAR_MOMENTS);
  });
});

describe('classifyPlateCondition', () => {
  it('gives severe weather and current precipitation precedence over cloud cover', () => {
    expect(classifyPlateCondition({ code: 95, cloud: 0 })).toBe('storm');
    expect(classifyPlateCondition({ code: 0, cloud: 0, precipitation: 3 })).toBe('storm');
    expect(classifyPlateCondition({ code: 2, cloud: 30, precipitation: 2.5 })).toBe('storm');
  });

  it('uses explicit wet/overcast codes before lower cloud readings', () => {
    expect(classifyPlateCondition({ code: 3, cloud: 2 })).toBe('overcast');
    expect(classifyPlateCondition({ code: 61, cloud: 5 })).toBe('overcast');
    expect(classifyPlateCondition({ code: 86, cloud: 5 })).toBe('overcast');
    expect(classifyPlateCondition({ code: 0, cloud: 5, precipitation: 0.1 })).toBe('overcast');
  });

  it('falls through cloud thresholds from overcast to scattered to clear', () => {
    expect(classifyPlateCondition({ code: 0, cloud: 90 })).toBe('overcast');
    expect(classifyPlateCondition({ code: 0, cloud: 45 })).toBe('scattered');
    expect(classifyPlateCondition({ code: 2, cloud: 0 })).toBe('scattered');
    expect(classifyPlateCondition({ code: 0, cloud: 19.9 })).toBe('clear');
    expect(classifyPlateCondition(null)).toBe('clear');
  });
});

describe('Breckenridge solar schedule', () => {
  it('orders all eight authored moments in summer and winter', () => {
    expect(anchorsForOneCycle(summer).map((anchor) => anchor.moment)).toEqual(SOLAR_MOMENTS);
    expect(anchorsForOneCycle(winter).map((anchor) => anchor.moment)).toEqual(SOLAR_MOMENTS);
  });

  it('labels morning crossings as rising and evening crossings as setting', () => {
    for (const schedule of [summer, winter]) {
      const cycle = anchorsForOneCycle(schedule);
      for (const moment of ['predawn', 'sunrise', 'morning'] as const) {
        expect(cycle.find((anchor) => anchor.moment === moment)?.rising).toBe(true);
      }
      for (const moment of ['golden', 'sunset', 'blue-hour'] as const) {
        expect(cycle.find((anchor) => anchor.moment === moment)?.rising).toBe(false);
      }
      expect(cycle.find((anchor) => anchor.moment === 'noon')?.rising).toBeNull();
      expect(cycle.find((anchor) => anchor.moment === 'night')?.rising).toBeNull();
    }
  });

  it('reflects the longer, higher summer day', () => {
    const duration = (schedule: PlateSchedule) => {
      const cycle = anchorsForOneCycle(schedule);
      return cycle.find((anchor) => anchor.moment === 'sunset')!.at -
        cycle.find((anchor) => anchor.moment === 'sunrise')!.at;
    };
    const noonAltitude = (schedule: PlateSchedule) =>
      anchorsForOneCycle(schedule).find((anchor) => anchor.moment === 'noon')!.altitude;

    expect(duration(summer)).toBeGreaterThan(duration(winter));
    expect(noonAltitude(summer)).toBeGreaterThan(noonAltitude(winter) + 35);
  });

  it('wraps blue hour through night into predawn across local midnight', () => {
    const moments = summer.anchors.map((anchor) => anchor.moment);
    const night = moments.findIndex((moment, index) =>
      moment === 'night' && moments[index - 1] === 'blue-hour' && moments[index + 1] === 'predawn');
    expect(night).toBeGreaterThan(0);

    // 2026-07-26 00:30 in Breckenridge (CDT).
    const frame = plateFrameAt(new Date('2026-07-26T05:30:00Z'), summer, 0);
    expect(frame.from).toBe('night');
    expect(frame.to).toBe('predawn');
    expect(frame.mix).toBe(0);
  });
});

describe('plateFrameAt', () => {
  const simpleAnchors: readonly SolarMomentAnchor[] = [
    { moment: 'night', at: 0, altitude: -30, rising: null },
    { moment: 'predawn', at: 60 * 60_000, altitude: -9, rising: true },
    { moment: 'sunrise', at: 2 * 60 * 60_000, altitude: 0, rising: true },
  ];
  const simple: PlateSchedule = {
    location: PLATE_MANIFEST.location,
    around: 60 * 60_000,
    anchors: simpleAnchors,
  };
  const boundary = 30 * 60_000;

  it('keeps a sharp frame outside the short boundary window', () => {
    expect(plateFrameAt(boundary - 7 * 60_000, simple).mix).toBe(0);
    const after = plateFrameAt(boundary + 7 * 60_000, simple);
    expect(after.from).toBe('predawn');
    expect(after.to).toBe('sunrise');
    expect(after.mix).toBe(0);
  });

  it('smoothly blends from zero through one and never escapes that range', () => {
    const start = plateFrameAt(boundary - 6 * 60_000, simple);
    const middle = plateFrameAt(boundary, simple);
    const end = plateFrameAt(boundary + 6 * 60_000, simple);
    expect(start.mix).toBe(0);
    expect(middle.mix).toBeCloseTo(0.5, 8);
    expect(end.mix).toBe(1);
    for (const offset of [-100, -6, 0, 6, 100]) {
      const mix = plateFrameAt(boundary + offset * 60_000, simple).mix;
      expect(mix).toBeGreaterThanOrEqual(0);
      expect(mix).toBeLessThanOrEqual(1);
    }
  });

  it('clamps unreasonable blend-window inputs', () => {
    const farInsideRequestedWindow = boundary - 20 * 60_000;
    expect(plateFrameAt(farInsideRequestedWindow, simple, 10_000).mix).toBe(0);
    expect(MAX_PLATE_BLEND_MINUTES).toBeLessThan(60);
    expect(plateFrameAt(boundary, simple, -5).mix).toBe(0);
  });
});

describe('plateAssetBase', () => {
  it('returns a safe extension-free asset path for every manifest entry', () => {
    for (const condition of PLATE_CONDITIONS) {
      for (const moment of SOLAR_MOMENTS) {
        expect(plateAssetBase(condition, moment))
          .toBe(`/images/outside/plates/${condition}/${moment}`);
      }
    }
  });

  it('rejects runtime path fragments outside the stable enums', () => {
    expect(() => plateAssetBase('../storm' as never, 'noon')).toThrow(TypeError);
    expect(() => plateAssetBase('clear', '../../archive' as never)).toThrow(TypeError);
  });
});
