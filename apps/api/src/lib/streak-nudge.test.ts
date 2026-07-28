import { describe, it, expect } from 'vitest';
import { computeStreakNudges } from './streak-nudge.js';

describe('computeStreakNudges', () => {
  const row = { user_id: 'u1', display_name: 'Kofi', group_id: 'g1', group_name: 'Osu Traders', current_streak: 5, contributed_this_round: 0 };

  it('nudges members with a streak at risk who have not contributed', () => {
    const nudges = computeStreakNudges([row]);
    expect(nudges).toHaveLength(1);
    expect(nudges[0].body).toContain('5');
    expect(nudges[0].body).toContain('Osu Traders');
  });

  it('skips members who already contributed this round', () => {
    expect(computeStreakNudges([{ ...row, contributed_this_round: 1 }])).toHaveLength(0);
  });

  it('skips streaks below the minimum (default 2)', () => {
    expect(computeStreakNudges([{ ...row, current_streak: 1 }])).toHaveLength(0);
    expect(computeStreakNudges([{ ...row, current_streak: 1 }], 1)).toHaveLength(1);
  });
});
