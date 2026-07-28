export interface NudgeRow {
  user_id: string;
  display_name: string;
  group_id: string;
  group_name: string;
  current_streak: number;
  contributed_this_round: number;
}

export interface Nudge {
  userId: string;
  groupId: string;
  title: string;
  body: string;
}

export function computeStreakNudges(rows: NudgeRow[], minStreak = 2): Nudge[] {
  return rows
    .filter((r) => r.contributed_this_round === 0 && r.current_streak >= minStreak)
    .map((r) => ({
      userId: r.user_id,
      groupId: r.group_id,
      title: 'Your streak is at risk 🔥',
      body: `${r.display_name}, your ${r.current_streak}-round streak in "${r.group_name}" ends if you miss this round. Contribute now to keep it alive.`,
    }));
}
