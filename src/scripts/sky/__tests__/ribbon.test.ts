import { describe, it, expect } from 'vitest';
import {
  altToPlotY,
  altToY,
  buildRibbon,
  buildRollingRibbon,
  hourLabel,
  timeToX,
  type RibbonGeometry,
} from '../ribbon';

const G: RibbonGeometry = { width: 1100, height: 180, baseline: 150, maxAltitude: 90 };
const LAT = 32.7557, LON = -98.9023;
// 2026-07-26 00:00 local (CDT = UTC-5)
const JULY = new Date(Date.UTC(2026, 6, 26, 5, 0));
// 2026-12-21 00:00 local (CST = UTC-6)
const DEC = new Date(Date.UTC(2026, 11, 21, 6, 0));

describe('scales', () => {
  it('maps midnight to the left edge and the next midnight to the right', () => {
    expect(timeToX(0, G)).toBe(0);
    expect(timeToX(1440, G)).toBe(1100);
    expect(timeToX(720, G)).toBe(550);
  });

  it('can map a configurable elapsed window to the full width', () => {
    expect(timeToX(0, G, 600)).toBe(0);
    expect(timeToX(300, G, 600)).toBe(550);
    expect(timeToX(600, G, 600)).toBe(1100);
  });

  it('puts the horizon on the baseline and clamps below it', () => {
    expect(altToY(0, G)).toBe(150);
    expect(altToY(-20, G)).toBe(150);
    expect(altToY(90, G)).toBe(6);
    expect(altToY(45, G)).toBeCloseTo(78, 0);
  });

  it('compresses negative altitude into a shallow lower band', () => {
    const geometry = { ...G, belowBand: 18, minAltitude: -60 };
    expect(altToPlotY(20, geometry)).toBeLessThan(G.baseline);
    expect(altToPlotY(0, geometry)).toBe(G.baseline);
    expect(altToPlotY(-30, geometry)).toBe(159);
    expect(altToPlotY(-60, geometry)).toBe(168);
    expect(altToPlotY(-90, geometry)).toBe(168);
  });
});

describe('buildRibbon in midsummer', () => {
  const m = buildRibbon(JULY, LAT, LON, G);

  it('has the sun up for about 13.9 hours', () => {
    const total = m.sunUp.reduce((s, x) => s + (x.to - x.from), 0);
    expect(total / 60).toBeGreaterThan(13.4);
    expect(total / 60).toBeLessThan(14.3);
  });

  it('produces one continuous daytime span, not a fragmented one', () => {
    expect(m.sunUp).toHaveLength(1);
    expect(m.sunUp[0].from).toBeGreaterThan(6 * 60);   // sunrise after 6am
    expect(m.sunUp[0].to).toBeLessThan(21 * 60);       // sunset before 9pm
  });

  it('gives two golden-hour windows, morning and evening', () => {
    expect(m.goldenSpans).toHaveLength(2);
    for (const s of m.goldenSpans) {
      const mins = s.to - s.from;
      expect(mins).toBeGreaterThan(30);
      expect(mins).toBeLessThan(110);
    }
  });

  it('splits night across both ends of the day', () => {
    // local midnight is the middle of the night, so night appears twice
    expect(m.nightSpans.length).toBeGreaterThanOrEqual(2);
    expect(m.nightSpans[0].from).toBe(0);
    expect(m.nightSpans[m.nightSpans.length - 1].to).toBe(1440);
  });

  it('draws a sun curve that never dips below the baseline', () => {
    const ys = [...m.sunPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((x) => parseFloat(x[2]));
    expect(ys.length).toBeGreaterThan(50);
    for (const y of ys) expect(y).toBeLessThanOrEqual(G.baseline);
  });

  it('peaks near the known 76.5 degree noon altitude', () => {
    const ys = [...m.sunPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((x) => parseFloat(x[2]));
    const highest = Math.min(...ys);
    const alt = (G.baseline - highest) / (G.baseline - 6) * G.maxAltitude;
    expect(alt).toBeGreaterThan(74);
    expect(alt).toBeLessThan(79);
  });
});

describe('wall-clock sampling', () => {
  it('uses a location clock when one is supplied for DST-aware days', () => {
    const samples: number[] = [];
    buildRibbon(JULY, LAT, LON, G, 360, (minutes) => {
      samples.push(minutes);
      return new Date(JULY.valueOf() + minutes * 60_000);
    });
    expect(samples).toEqual([0, 360, 720, 1080, 1440]);
  });
});

describe('buildRibbon at the winter solstice', () => {
  const m = buildRibbon(DEC, LAT, LON, G);

  it('has a much shorter day than midsummer', () => {
    const total = m.sunUp.reduce((s, x) => s + (x.to - x.from), 0);
    expect(total / 60).toBeGreaterThan(9.4);
    expect(total / 60).toBeLessThan(10.4);
  });

  it('peaks far lower in the sky', () => {
    const ys = [...m.sunPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((x) => parseFloat(x[2]));
    const alt = (G.baseline - Math.min(...ys)) / (G.baseline - 6) * G.maxAltitude;
    expect(alt).toBeGreaterThan(31);  // 90 - 32.76 - 23.44 = 33.8
    expect(alt).toBeLessThan(36);
  });
});

describe('moon curve', () => {
  it('is drawn, and is broken into segments rather than one flat line', () => {
    const m = buildRibbon(JULY, LAT, LON, G);
    expect(m.moonPath.length).toBeGreaterThan(20);
    // the moon rises/sets ~50 min later each day, so on most days its curve is
    // split by the midnight boundary into two pieces
    const moves = (m.moonPath.match(/M/g) ?? []).length;
    expect(moves).toBeGreaterThanOrEqual(1);
    expect(moves).toBeLessThanOrEqual(3);
  });

  it('has the moon up for a stretch while the sky is properly dark', () => {
    // This is the relationship the shared axis exists to show. Comparing mean
    // x positions does not work: near full moon the curve wraps around local
    // midnight, so its mean lands mid-axis right next to the sun's.
    const m = buildRibbon(JULY, LAT, LON, G);
    const overlap = (a: { from: number; to: number }, b: { from: number; to: number }) =>
      Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));
    let darkAndUp = 0;
    for (const mu of m.moonUp) for (const n of m.nightSpans) darkAndUp += overlap(mu, n);
    expect(darkAndUp).toBeGreaterThan(60);
  });

  it('has the moon up for a plausible number of hours', () => {
    const m = buildRibbon(JULY, LAT, LON, G);
    const total = m.moonUp.reduce((s, x) => s + (x.to - x.from), 0);
    expect(total / 60).toBeGreaterThan(8);
    expect(total / 60).toBeLessThan(16);
  });

  it('has the moon up at a materially different time than the sun', () => {
    const m = buildRibbon(JULY, LAT, LON, G);
    const overlap = (a: { from: number; to: number }, b: { from: number; to: number }) =>
      Math.max(0, Math.min(a.to, b.to) - Math.max(a.from, b.from));
    let both = 0;
    for (const mu of m.moonUp) for (const su of m.sunUp) both += overlap(mu, su);
    const moonTotal = m.moonUp.reduce((s, x) => s + (x.to - x.from), 0);
    // three days before full, most of the moon's time up is after dark
    expect(both / moonTotal).toBeLessThan(0.5);
  });

  it('interpolates moonrise and moonset instead of snapping to six-minute samples', () => {
    const coarse = buildRibbon(JULY, LAT, LON, G, 6);
    const fine = buildRibbon(JULY, LAT, LON, G, 1);

    expect(coarse.moonUp).toHaveLength(fine.moonUp.length);
    for (let index = 0; index < coarse.moonUp.length; index++) {
      expect(coarse.moonUp[index].from).toBeCloseTo(fine.moonUp[index].from, 1);
      expect(coarse.moonUp[index].to).toBeCloseTo(fine.moonUp[index].to, 1);
    }

    const interiorEdges = coarse.moonUp
      .flatMap((span) => [span.from, span.to])
      .filter((minute) => minute > 0 && minute < 1440);
    expect(interiorEdges.length).toBeGreaterThan(0);
    expect(interiorEdges.some((minute) => Math.abs(minute % 6) > 0.01)).toBe(true);
  });
});

describe('rolling celestial window', () => {
  // 8pm CDT: the default window runs from 2pm through 2pm the next day,
  // putting local midnight inside the axis rather than at either edge.
  const now = new Date(Date.UTC(2026, 6, 27, 1, 0));
  const model = buildRollingRibbon(now, LAT, LON, G);

  it('defaults to six hours behind now and eighteen hours ahead', () => {
    expect(model.window.start.valueOf()).toBe(now.valueOf() - 6 * 60 * 60_000);
    expect(model.window.end.valueOf()).toBe(now.valueOf() + 18 * 60 * 60_000);
    expect(model.window.end.valueOf() - model.window.start.valueOf())
      .toBe(24 * 60 * 60_000);
    expect(model.window.durationMinutes).toBe(1440);
    expect(model.window.focusMinute).toBe(360);
  });

  it('continues cleanly across midnight with no calendar-day seam', () => {
    // From afternoon to afternoon, the Sun has one continuous below-horizon
    // segment spanning midnight rather than two calendar-edge fragments.
    expect((model.sunBelowPath.match(/M/g) ?? [])).toHaveLength(1);
    expect(model.sunEvents.map((event) => event.kind)).toEqual(['set', 'rise']);

    // Midnight is ten hours after the 2pm window start. There are points on
    // both sides of it inside the same path segment.
    const midnightX = timeToX(10 * 60, G);
    const xs = [...model.sunBelowPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)]
      .map((match) => Number(match[1]));
    expect(xs.some((x) => x < midnightX)).toBe(true);
    expect(xs.some((x) => x > midnightX)).toBe(true);
  });

  it('covers both window edges instead of terminating at midnight', () => {
    expect(model.sunUp).toHaveLength(2);
    expect(model.sunUp[0].from).toBe(0);
    expect(model.sunUp.at(-1)?.to).toBe(1440);

    const allSunX = [
      ...model.sunPath.matchAll(/[ML]([\d.]+),([\d.]+)/g),
      ...model.sunBelowPath.matchAll(/[ML]([\d.]+),([\d.]+)/g),
    ].map((match) => Number(match[1]));
    expect(Math.min(...allSunX)).toBe(0);
    expect(Math.max(...allSunX)).toBe(G.width);
  });

  it('draws exact horizon joins and quieter below-horizon continuations', () => {
    const aboveY = [...model.sunPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)]
      .map((match) => Number(match[2]));
    const belowY = [...model.sunBelowPath.matchAll(/[ML]([\d.]+),([\d.]+)/g)]
      .map((match) => Number(match[2]));

    expect(aboveY.some((y) => y === G.baseline)).toBe(true);
    expect(belowY.some((y) => y === G.baseline)).toBe(true);
    expect(belowY.some((y) => y > G.baseline)).toBe(true);
    expect(model.moonBelowPath.length).toBeGreaterThan(20);
  });

  it('interpolates horizon event minutes and their real instants together', () => {
    const sunset = model.sunEvents[0];
    expect(sunset.kind).toBe('set');
    expect(sunset.minute).toBeCloseTo(model.sunUp[0].to, 5);
    expect(sunset.minute % 6).not.toBeCloseTo(0, 2);
    expect(Math.abs(
      sunset.at.valueOf()
      - (model.window.start.valueOf() + sunset.minute * 60_000),
    )).toBeLessThan(1);
  });

  it('supports a custom duration and always samples the exact endpoint', () => {
    const custom = buildRollingRibbon(now, LAT, LON, G, {
      beforeMinutes: 120,
      durationMinutes: 600,
      stepMinutes: 17,
    });
    expect(custom.window.focusMinute).toBe(120);
    expect(custom.window.durationMinutes).toBe(600);
    expect(custom.window.end.valueOf() - custom.window.start.valueOf())
      .toBe(600 * 60_000);

    const allSunX = [
      ...custom.sunPath.matchAll(/[ML]([\d.]+),([\d.]+)/g),
      ...custom.sunBelowPath.matchAll(/[ML]([\d.]+),([\d.]+)/g),
    ].map((match) => Number(match[1]));
    expect(Math.min(...allSunX)).toBe(0);
    expect(Math.max(...allSunX)).toBe(G.width);
  });

  it('uses 24 real elapsed hours across a daylight-saving fallback', () => {
    const fallback = new Date('2026-11-01T07:30:00.000Z');
    const dstModel = buildRollingRibbon(fallback, LAT, LON, G, {
      beforeMinutes: 360,
      durationMinutes: 1440,
      stepMinutes: 60,
    });
    expect(dstModel.window.end.valueOf() - dstModel.window.start.valueOf())
      .toBe(24 * 60 * 60_000);

    const localHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hourCycle: 'h23',
    });
    // The local clock advances only 23 labelled hours while the physical
    // timeline still contains a full 24 elapsed hours.
    expect(localHour.format(dstModel.window.start)).toBe('20');
    expect(localHour.format(dstModel.window.end)).toBe('19');
  });

  it('rejects a focus that would fall outside the configured window', () => {
    expect(() =>
      buildRollingRibbon(now, LAT, LON, G, {
        beforeMinutes: 700,
        durationMinutes: 600,
      }),
    ).toThrow(RangeError);
  });
});

describe('hourLabel', () => {
  it('reads as a 12-hour clock', () => {
    expect(hourLabel(0)).toBe('12a');
    expect(hourLabel(6)).toBe('6a');
    expect(hourLabel(12)).toBe('12p');
    expect(hourLabel(18)).toBe('6p');
    expect(hourLabel(24)).toBe('12a');
  });
});
