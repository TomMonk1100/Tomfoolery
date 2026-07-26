import { describe, it, expect } from 'vitest';
import { sunPosition, moonPosition, moonIllumination, moonPhaseName, moonDarkPath } from '../astro';

// Breckenridge, TX — the widget's default location.
const LAT = 32.7557, LON = -98.9023;

describe('sunPosition', () => {
  it('puts the sun near its known noon altitude for late July at 32.75N', () => {
    // Solar declination ~+19.3 on Jul 26 -> noon altitude ~= 90 - 32.76 + 19.3 = 76.5
    let max = -90;
    for (let m = 0; m < 1440; m += 2) {
      const d = new Date(Date.UTC(2026, 6, 26, 0, 0) + m * 60000);
      max = Math.max(max, sunPosition(d, LAT, LON).altitude);
    }
    expect(max).toBeGreaterThan(74);
    expect(max).toBeLessThan(79);
  });

  it('crosses zero twice a day, ~13.9h apart in late July', () => {
    const alts: number[] = [];
    for (let m = 0; m < 1440; m++) {
      const d = new Date(Date.UTC(2026, 6, 26, 5, 0) + m * 60000); // local-day window
      alts.push(sunPosition(d, LAT, LON).altitude);
    }
    const crossings: number[] = [];
    for (let i = 1; i < alts.length; i++) {
      if ((alts[i - 1] < 0) !== (alts[i] < 0)) crossings.push(i);
    }
    expect(crossings).toHaveLength(2);
    const daylightHours = (crossings[1] - crossings[0]) / 60;
    expect(daylightHours).toBeGreaterThan(13.5);
    expect(daylightHours).toBeLessThan(14.2);
  });

  it('is far below the horizon at local solar midnight', () => {
    const d = new Date(Date.UTC(2026, 6, 27, 6, 40)); // ~01:40 local CDT
    expect(sunPosition(d, LAT, LON).altitude).toBeLessThan(-25);
  });

  it('rises in the northeast and sets in the northwest in summer', () => {
    // find the two horizon crossings and check their azimuths
    let rise = 0, set = 0, prev = sunPosition(new Date(Date.UTC(2026, 6, 26, 5, 0)), LAT, LON).altitude;
    for (let m = 1; m < 1440; m++) {
      const d = new Date(Date.UTC(2026, 6, 26, 5, 0) + m * 60000);
      const a = sunPosition(d, LAT, LON).altitude;
      if (prev < 0 && a >= 0) rise = m;
      if (prev >= 0 && a < 0) set = m;
      prev = a;
    }
    const az = (m: number) => sunPosition(new Date(Date.UTC(2026, 6, 26, 5, 0) + m * 60000), LAT, LON).azimuth;
    expect(az(rise)).toBeGreaterThan(55);  // N of due east
    expect(az(rise)).toBeLessThan(75);
    expect(az(set)).toBeGreaterThan(285);  // N of due west
    expect(az(set)).toBeLessThan(305);
  });
});

describe('moonIllumination', () => {
  it('reports 2026-07-26 as a ~93% waxing gibbous, three days before full', () => {
    const { fraction, waxing } = moonIllumination(new Date(Date.UTC(2026, 6, 26, 23, 0)));
    expect(fraction).toBeGreaterThan(0.88);
    expect(fraction).toBeLessThan(0.97);
    expect(waxing).toBe(true);
    expect(moonPhaseName(fraction, waxing)).toBe('waxing gibbous');
    // full moon lands 2026-07-29
    expect(moonIllumination(new Date(Date.UTC(2026, 6, 29, 12, 0))).fraction).toBeGreaterThan(0.99);
  });

  it('sets `waxing` in agreement with the direction the fraction is moving', () => {
    // This is the real invariant: the flag must flip exactly at full and new.
    // Asserting it against an outside source is what got this wrong the first time.
    const hour = 3600000;
    let checked = 0;
    for (let i = 0; i < 24 * 60; i++) {
      const t = Date.UTC(2026, 5, 1) + i * hour;
      const a = moonIllumination(new Date(t));
      // Skip the hours around new and full, where the fraction turns around and
      // a finite difference can straddle the turning point. (A one-DAY step
      // near new moon jumps clean over it, which is how this first failed.)
      if (a.fraction < 0.04 || a.fraction > 0.96) continue;
      const b = moonIllumination(new Date(t + hour));
      expect(a.waxing).toBe(b.fraction > a.fraction);
      checked++;
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('completes a full cycle in ~29.5 days', () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const f = (days: number) => moonIllumination(new Date(start.valueOf() + days * 86400000)).fraction;
    // count new moons (local minima below 2%) across a year
    let newMoons = 0;
    for (let d = 1; d < 364; d++) {
      if (f(d) < 0.02 && f(d) <= f(d - 1) && f(d) <= f(d + 1)) newMoons++;
    }
    expect(newMoons).toBeGreaterThanOrEqual(11);
    expect(newMoons).toBeLessThanOrEqual(13);
  });

  it('stays within [0,1] all year', () => {
    for (let d = 0; d < 366; d++) {
      const { fraction } = moonIllumination(new Date(Date.UTC(2026, 0, 1) + d * 86400000));
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    }
  });
});

describe('moonDarkPath', () => {
  // Measure the drawn dark area analytically: the region between the limb
  // semicircle and the terminator semi-ellipse.
  const litFraction = (f: number, waxing: boolean) => {
    const r = 100;
    const path = moonDarkPath(0, 0, r, f, waxing);
    const m = path.match(/A ([\d.]+),([\d.]+) 0 0 (\d) [-\d.]+,[-\d.]+ A ([\d.]+),/);
    const rx = parseFloat(m![4]);
    const gibbous = f > 0.5;
    // gibbous -> dark = half disc minus half ellipse; crescent -> half plus half
    const half = Math.PI * r * r / 2;
    const halfEllipse = Math.PI * r * rx / 2;
    const darkArea = gibbous ? half - halfEllipse : half + halfEllipse;
    return 1 - darkArea / (Math.PI * r * r);
  };

  it('draws 91% lit as 91% lit', () => {
    expect(litFraction(0.91, false)).toBeCloseTo(0.91, 2);
  });

  it('is correct across the whole cycle, both directions', () => {
    for (const f of [0.03, 0.15, 0.3, 0.5, 0.7, 0.85, 0.97]) {
      expect(litFraction(f, true)).toBeCloseTo(f, 2);
      expect(litFraction(f, false)).toBeCloseTo(f, 2);
    }
  });

  it('puts the dark limb on the right when waning and the left when waxing', () => {
    // limb sweep flag: 1 traces the right limb, 0 the left
    const sweep = (waxing: boolean) => moonDarkPath(0, 0, 10, 0.8, waxing).match(/A 10,10 0 0 (\d)/)![1];
    expect(sweep(false)).toBe('1'); // waning -> dark on right
    expect(sweep(true)).toBe('0');  // waxing -> dark on left
  });
});
