/**
 * Solar and lunar position, computed locally — no API, no key, works offline.
 *
 * Standard low-precision astronomy (Meeus, "Astronomical Algorithms", ch. 25
 * and 47). Accurate to roughly ±0.5° for the sun and ±0.3° for the moon, which
 * is far tighter than a 1000px-wide chart can express. The point of doing this
 * properly rather than interpolating a sine between sunrise and sunset is that
 * the twilight phases and the moon's (very different, faster-drifting) arc both
 * come out right.
 */

const RAD = Math.PI / 180;
/** Obliquity of the ecliptic. */
const OBLIQUITY = 23.4397 * RAD;
/** Mean distance to the sun, km — used for the moon's phase angle. */
const SUN_DIST_KM = 149598000;

export interface Equatorial { ra: number; dec: number; }
export interface Horizontal { altitude: number; azimuth: number; }

/** Days since the J2000.0 epoch. */
function toDays(date: Date): number {
  return date.valueOf() / 86400000 - 0.5 + 2440588 - 2451545;
}

function rightAscension(l: number, b: number): number {
  return Math.atan2(
    Math.sin(l) * Math.cos(OBLIQUITY) - Math.tan(b) * Math.sin(OBLIQUITY),
    Math.cos(l)
  );
}

function declination(l: number, b: number): number {
  return Math.asin(
    Math.sin(b) * Math.cos(OBLIQUITY) + Math.cos(b) * Math.sin(OBLIQUITY) * Math.sin(l)
  );
}

/** Greenwich mean sidereal time, corrected for observer longitude. */
function siderealTime(d: number, lw: number): number {
  return RAD * (280.16 + 360.9856235 * d) - lw;
}

function altitude(H: number, phi: number, dec: number): number {
  return Math.asin(
    Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H)
  );
}

function azimuth(H: number, phi: number, dec: number): number {
  // Measured from north, clockwise, so it lines up with compass bearings.
  return Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi))
    + Math.PI;
}

function sunCoords(d: number): Equatorial {
  const M = RAD * (357.5291 + 0.98560028 * d);          // mean anomaly
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const L = M + C + RAD * 102.9372 + Math.PI;           // ecliptic longitude
  return { dec: declination(L, 0), ra: rightAscension(L, 0) };
}

function moonCoords(d: number): Equatorial & { dist: number } {
  const L = RAD * (218.316 + 13.176396 * d);  // mean longitude
  const M = RAD * (134.963 + 13.064993 * d);  // mean anomaly
  const F = RAD * (93.272 + 13.229350 * d);   // argument of latitude
  const l = L + RAD * 6.289 * Math.sin(M);    // ecliptic longitude
  const b = RAD * 5.128 * Math.sin(F);        // ecliptic latitude
  const dist = 385001 - 20905 * Math.cos(M);  // km
  return { ra: rightAscension(l, b), dec: declination(l, b), dist };
}

/** Sun altitude and azimuth in DEGREES. Altitude is negative below the horizon. */
export function sunPosition(date: Date, lat: number, lon: number): Horizontal {
  const lw = RAD * -lon, phi = RAD * lat, d = toDays(date);
  const c = sunCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  return { altitude: altitude(H, phi, c.dec) / RAD, azimuth: (azimuth(H, phi, c.dec) / RAD) % 360 };
}

/** Moon altitude and azimuth in DEGREES. */
export function moonPosition(date: Date, lat: number, lon: number): Horizontal {
  const lw = RAD * -lon, phi = RAD * lat, d = toDays(date);
  const c = moonCoords(d);
  const H = siderealTime(d, lw) - c.ra;
  return { altitude: altitude(H, phi, c.dec) / RAD, azimuth: (azimuth(H, phi, c.dec) / RAD) % 360 };
}

/**
 * Illuminated fraction (0–1) and whether the moon is waxing.
 * `waxing` decides which limb is lit, which is what the terminator drawing needs.
 */
export function moonIllumination(date: Date): { fraction: number; waxing: boolean } {
  const d = toDays(date);
  const s = sunCoords(d);
  const m = moonCoords(d);

  // Geocentric elongation between sun and moon.
  const phi = Math.acos(
    Math.sin(s.dec) * Math.sin(m.dec) +
    Math.cos(s.dec) * Math.cos(m.dec) * Math.cos(s.ra - m.ra)
  );
  // Phase angle at the moon (sun–moon–earth).
  const inc = Math.atan2(SUN_DIST_KM * Math.sin(phi), m.dist - SUN_DIST_KM * Math.cos(phi));
  // Position angle of the bright limb; its sign gives waxing vs waning.
  const angle = Math.atan2(
    Math.cos(s.dec) * Math.sin(s.ra - m.ra),
    Math.sin(s.dec) * Math.cos(m.dec) - Math.cos(s.dec) * Math.sin(m.dec) * Math.cos(s.ra - m.ra)
  );

  return { fraction: (1 + Math.cos(inc)) / 2, waxing: angle < 0 };
}

/** Human name for an illuminated fraction + direction. */
export function moonPhaseName(fraction: number, waxing: boolean): string {
  if (fraction < 0.02) return 'new moon';
  if (fraction > 0.98) return 'full moon';
  const quarter = Math.abs(fraction - 0.5) < 0.04;
  if (quarter) return waxing ? 'first quarter' : 'last quarter';
  const shape = fraction < 0.5 ? 'crescent' : 'gibbous';
  return `${waxing ? 'waxing' : 'waning'} ${shape}`;
}

/**
 * SVG path for the DARK portion of a moon disc, to be drawn over a lit circle.
 *
 * The terminator is an ellipse whose semi-minor axis is r·|1−2f|. It bows
 * toward the dark limb when gibbous and toward the lit limb when crescent —
 * getting that backwards renders a 91% moon as 59% dark, so it is worth
 * stating explicitly rather than tuning by eye.
 */
export function moonDarkPath(cx: number, cy: number, r: number, fraction: number, waxing: boolean): string {
  const rx = Math.abs(1 - 2 * fraction) * r;
  const gibbous = fraction > 0.5;
  // Northern hemisphere: waning moons are lit on the left, so the dark limb is
  // the right one. Top→bottom with sweep 1 traces the right limb, 0 the left.
  const limbSweep = waxing ? 0 : 1;
  const termSweep = gibbous ? (waxing ? 1 : 0) : (waxing ? 0 : 1);
  return `M ${cx},${cy - r} A ${r},${r} 0 0 ${limbSweep} ${cx},${cy + r} ` +
         `A ${rx.toFixed(3)},${r} 0 0 ${termSweep} ${cx},${cy - r} Z`;
}
