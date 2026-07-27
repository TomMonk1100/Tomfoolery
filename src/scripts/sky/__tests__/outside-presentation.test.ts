import { describe, expect, it } from 'vitest';
import {
  OUTSIDE_PLATE_PRESENTATIONS,
  breckenridgeInstantAtMinutes,
  platePresentationFor,
  shouldCommitPlatePresentation,
} from '../outside-controller';
import { PLATE_CONDITIONS, SOLAR_MOMENTS } from '../plates';

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

describe('Breckenridge civil-time sampling', () => {
  it('gaps nonexistent spring-forward minutes and stays monotonic', () => {
    // 2027-03-14 00:00 CST; clocks jump from 01:59 to 03:00.
    const dayStart = new Date('2027-03-14T06:00:00Z');
    expect(breckenridgeInstantAtMinutes(dayStart, 120)).toBeNull();
    expect(breckenridgeInstantAtMinutes(dayStart, 150)).toBeNull();

    const instants = Array.from(
      { length: 241 },
      (_, index) => breckenridgeInstantAtMinutes(dayStart, index * 6),
    )
      .filter((instant): instant is Date => instant !== null)
      .map((instant) => instant.valueOf());

    for (let index = 1; index < instants.length; index++) {
      expect(instants[index]).toBeGreaterThan(instants[index - 1]);
    }
  });
});
