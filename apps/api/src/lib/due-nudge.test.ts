import { describe, it, expect } from 'vitest';
import { dueStage, stageMessage, FREQUENCY_WINDOW_DAYS } from './due-nudge.js';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

describe('dueStage', () => {
  const started = new Date('2026-07-01T06:00:00Z');

  it('returns 0 well inside the window', () => {
    const now = new Date(started.getTime() + 5 * DAY);
    expect(dueStage(started, 'weekly', now)).toBe(0);
  });

  it('returns 1 within 24h of the deadline', () => {
    const now = new Date(started.getTime() + 6.5 * DAY);
    expect(dueStage(started, 'weekly', now)).toBe(1);
  });

  it('returns 2 on the due day (deadline passed by <24h)', () => {
    const now = new Date(started.getTime() + 7.5 * DAY);
    expect(dueStage(started, 'weekly', now)).toBe(2);
  });

  it('returns 3 when overdue by more than 24h', () => {
    const now = new Date(started.getTime() + 9 * DAY);
    expect(dueStage(started, 'weekly', now)).toBe(3);
  });

  it('handles daily and monthly windows', () => {
    expect(dueStage(started, 'daily', new Date(started.getTime() + 20 * HOUR))).toBe(1);
    expect(dueStage(started, 'monthly', new Date(started.getTime() + 29 * DAY))).toBe(1);
    expect(dueStage(started, 'monthly', new Date(started.getTime() + 31 * DAY))).toBe(3);
  });

  it('returns 0 when round_started_at is missing', () => {
    expect(dueStage(null, 'weekly', new Date())).toBe(0);
  });
});

describe('stageMessage', () => {
  it('produces escalating copy per stage', () => {
    expect(stageMessage(1, 'Kofi', 'Osu Traders').body).toContain('due soon');
    expect(stageMessage(2, 'Kofi', 'Osu Traders').body).toContain('due today');
    expect(stageMessage(3, 'Kofi', 'Osu Traders').body.toLowerCase()).toContain('penalty');
  });

  it('includes the member and group names', () => {
    const m = stageMessage(2, 'Kofi', 'Osu Traders');
    expect(m.body).toContain('Kofi');
    expect(m.body).toContain('Osu Traders');
  });
});

describe('FREQUENCY_WINDOW_DAYS', () => {
  it('maps each frequency', () => {
    expect(FREQUENCY_WINDOW_DAYS.daily).toBe(1);
    expect(FREQUENCY_WINDOW_DAYS.weekly).toBe(7);
    expect(FREQUENCY_WINDOW_DAYS.monthly).toBe(30);
  });
});
