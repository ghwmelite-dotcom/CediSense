import { describe, it, expect } from 'vitest';
import { computeTrustScore, getTrustLabel, getTrustColor } from './trust-score.js';

describe('computeTrustScore', () => {
  const defaults = {
    total_contributions: 0,
    on_time_contributions: 0,
    late_contributions: 0,
    missed_contributions: 0,
    groups_completed: 0,
  };

  it('returns 50 for default stats (all zeros)', () => {
    expect(computeTrustScore(defaults)).toBe(50);
  });

  it('adds +1 per on-time contribution', () => {
    expect(computeTrustScore({ ...defaults, on_time_contributions: 10, total_contributions: 10 })).toBe(60);
  });

  it('caps on-time bonus at +30', () => {
    expect(computeTrustScore({ ...defaults, on_time_contributions: 50, total_contributions: 50 })).toBe(80);
  });

  it('subtracts 3 per late contribution', () => {
    expect(computeTrustScore({ ...defaults, late_contributions: 5, total_contributions: 5 })).toBe(35);
  });

  it('subtracts 5 per missed contribution', () => {
    expect(computeTrustScore({ ...defaults, missed_contributions: 3, total_contributions: 3 })).toBe(35);
  });

  it('never goes below 0', () => {
    expect(computeTrustScore({ ...defaults, missed_contributions: 20, total_contributions: 20 })).toBe(0);
  });

  it('never goes above 100', () => {
    expect(
      computeTrustScore({
        ...defaults,
        on_time_contributions: 100,
        groups_completed: 10,
        total_contributions: 100,
      })
    ).toBe(100);
  });

  it('adds +5 per completed group, capped at +20', () => {
    expect(computeTrustScore({ ...defaults, groups_completed: 2 })).toBe(60);
    expect(computeTrustScore({ ...defaults, groups_completed: 4 })).toBe(70);
    expect(computeTrustScore({ ...defaults, groups_completed: 5 })).toBe(70); // capped at +20
    expect(computeTrustScore({ ...defaults, groups_completed: 10 })).toBe(70); // still capped
  });

  it('combines bonuses and penalties correctly', () => {
    // 50 + 10 (on-time) - 6 (2 late) - 5 (1 missed) + 10 (2 groups) = 59
    const score = computeTrustScore({
      total_contributions: 13,
      on_time_contributions: 10,
      late_contributions: 2,
      missed_contributions: 1,
      groups_completed: 2,
    });
    expect(score).toBe(59);
  });
});

describe('getTrustLabel', () => {
  it('returns Excellent for 80-100', () => {
    expect(getTrustLabel(80)).toBe('Excellent');
    expect(getTrustLabel(100)).toBe('Excellent');
    expect(getTrustLabel(90)).toBe('Excellent');
  });

  it('returns Good for 60-79', () => {
    expect(getTrustLabel(60)).toBe('Good');
    expect(getTrustLabel(79)).toBe('Good');
  });

  it('returns Fair for 40-59', () => {
    expect(getTrustLabel(40)).toBe('Fair');
    expect(getTrustLabel(59)).toBe('Fair');
  });

  it('returns Poor for 0-39', () => {
    expect(getTrustLabel(0)).toBe('Poor');
    expect(getTrustLabel(39)).toBe('Poor');
  });
});

describe('getTrustColor', () => {
  it('returns text-income for 80+', () => {
    expect(getTrustColor(80)).toBe('text-income');
  });

  it('returns text-gold for 60-79', () => {
    expect(getTrustColor(65)).toBe('text-gold');
  });

  it('returns text-muted for 40-59', () => {
    expect(getTrustColor(50)).toBe('text-muted');
  });

  it('returns text-expense for <40', () => {
    expect(getTrustColor(20)).toBe('text-expense');
  });
});
