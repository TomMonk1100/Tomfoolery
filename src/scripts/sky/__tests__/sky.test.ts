import { describe, it, expect } from 'vitest';
import { skyColors, skyTheme, starOpacity, luminance, ridgePath, ridgeColors, uvColor, uvLabel } from '../sky';

describe('skyColors', () => {
  it('is dark at night and light at noon', () => {
    expect(luminance(skyColors(-30).top)).toBeLessThan(0.02);
    expect(luminance(skyColors(70).top)).toBeGreaterThan(0.45);
  });

  it('puts a warm horizon under a cool zenith at sunset', () => {
    const { top, bottom } = skyColors(0);
    expect(bottom[0]).toBeGreaterThan(bottom[2]);  // horizon is red-dominant
    expect(top[2]).toBeGreaterThan(top[0]);        // zenith is blue-dominant
  });

  it('brightens steadily from night to mid-morning', () => {
    let prev = -1;
    for (let a = -32; a <= 45; a += 1) {
      const l = luminance(skyColors(a).top);
      expect(l).toBeGreaterThanOrEqual(prev);
      prev = l;
    }
  });

  it('holds a deep zenith at high sun without going dim', () => {
    // Above ~45 degrees the zenith deepens slightly (more Rayleigh overhead).
    // That is deliberate, but it must stay a nudge, not a visible darkening.
    const peak = luminance(skyColors(45).top);
    for (let a = 45; a <= 90; a += 1) {
      const l = luminance(skyColors(a).top);
      expect(peak - l).toBeLessThan(0.06);
      expect(l).toBeGreaterThan(0.45);
    }
  });

  it('clamps outside the stop range instead of extrapolating', () => {
    expect(skyColors(-200)).toEqual(skyColors(-32));
    expect(skyColors(200)).toEqual(skyColors(90));
  });

  it('never emits an out-of-range channel', () => {
    for (let a = -40; a <= 95; a += 0.5) {
      for (const c of [...skyColors(a).top, ...skyColors(a).bottom]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('skyTheme contrast', () => {
  it('always keeps body text at 4.5:1 or better against the sky it sits on', () => {
    const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const hexLum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return luminance([(n >> 16) & 255, (n >> 8) & 255, n & 255]);
    };
    for (let a = -35; a <= 90; a += 0.5) {
      const t = skyTheme(a);
      const bg = luminance(t.effectiveBackground);
      expect(contrast(hexLum(t.ink), bg)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('switches to light text before the sky gets dark enough to swallow ink', () => {
    expect(skyTheme(40).dark).toBe(false);
    expect(skyTheme(-10).dark).toBe(true);
  });
});

describe('starOpacity', () => {
  it('is zero in daylight and full in deep night', () => {
    expect(starOpacity(30)).toBe(0);
    expect(starOpacity(0)).toBe(0);
    expect(starOpacity(-18)).toBe(1);
  });
  it('fades in monotonically through twilight', () => {
    let prev = 0;
    for (let a = -4; a >= -18; a -= 0.5) {
      const o = starOpacity(a);
      expect(o).toBeGreaterThanOrEqual(prev);
      prev = o;
    }
  });
});

describe('ridgePath', () => {
  it('is deterministic for a given seed', () => {
    expect(ridgePath(1440, 150, 7, 42, 60)).toBe(ridgePath(1440, 150, 7, 42, 60));
  });
  it('differs between seeds and spans the full width', () => {
    expect(ridgePath(1440, 150, 7, 42, 60)).not.toBe(ridgePath(1440, 150, 23, 42, 60));
    expect(ridgePath(1440, 150, 7, 42, 60)).toContain('L1440,150');
  });
  it('stays inside the viewBox', () => {
    const d = ridgePath(1440, 150, 99, 60, 70);
    for (const [, , , y] of d.matchAll(/([ML])([\d.]+),([\d.]+)/g)) {
      expect(parseFloat(y)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(y)).toBeLessThanOrEqual(150);
    }
  });
});

describe('uv encoding', () => {
  it('escalates colour and label with the index', () => {
    expect(uvLabel(1)).toBe('low');
    expect(uvLabel(8.4)).toBe('very high');
    expect(uvLabel(12)).toBe('extreme');
    expect(uvColor(1)).not.toBe(uvColor(8.4));
    expect(uvColor(8.4)).toBe('var(--color-accent)');
  });
});

describe('ridgeColors', () => {
  it('is always darker than the sky it sits against', () => {
    for (let a = -35; a <= 90; a += 2) {
      const { near, far } = ridgeColors(a);
      const parse = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];
      const sky = luminance(skyColors(a).bottom);
      expect(luminance(parse(near))).toBeLessThan(sky + 0.001);
      expect(luminance(parse(far))).toBeLessThan(sky + 0.001);
    }
  });

  it('puts the near ridge darker than the far one (aerial perspective)', () => {
    for (let a = -20; a <= 80; a += 5) {
      const { near, far } = ridgeColors(a);
      const parse = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];
      expect(luminance(parse(near))).toBeLessThan(luminance(parse(far)));
    }
  });

  it('takes on the sky’s warmth at sunset and stays cool at noon', () => {
    const parse = (s: string) => s.match(/\d+/g)!.map(Number) as [number, number, number];
    const sunset = parse(ridgeColors(0).near);
    const noon = parse(ridgeColors(70).near);
    expect(sunset[0] - sunset[2]).toBeGreaterThan(0);   // red > blue at sunset
    expect(noon[2] - noon[0]).toBeGreaterThan(0);       // blue > red at noon
  });
});
