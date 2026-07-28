import type { SusuFrequency } from '@cedisense/shared';

export const FREQUENCY_WINDOW_DAYS: Record<SusuFrequency, number> = {
  daily: 1,
  weekly: 7,
  monthly: 30,
};

export type DueStage = 0 | 1 | 2 | 3;

/**
 * Compute the due-nudge stage for a group round.
 * 0 = comfortably inside window · 1 = due within 24h · 2 = due day (deadline
 * just passed) · 3 = overdue >24h (penalty risk).
 */
export function dueStage(
  roundStartedAt: string | Date | null,
  frequency: SusuFrequency,
  now: Date = new Date()
): DueStage {
  if (!roundStartedAt) return 0;
  const started = roundStartedAt instanceof Date ? roundStartedAt : new Date(roundStartedAt.replace(' ', 'T') + 'Z');
  if (isNaN(started.getTime())) return 0;

  const windowMs = FREQUENCY_WINDOW_DAYS[frequency] * 24 * 3600 * 1000;
  const elapsed = now.getTime() - started.getTime();
  const remaining = windowMs - elapsed;
  const DAY = 24 * 3600 * 1000;

  if (remaining > DAY) return 0;
  if (remaining > 0) return 1;
  if (remaining > -DAY) return 2;
  return 3;
}

export interface DueMessage {
  title: string;
  body: string;
}

export function stageMessage(stage: DueStage, displayName: string, groupName: string): DueMessage {
  switch (stage) {
    case 1:
      return {
        title: 'Contribution due soon ⏰',
        body: `${displayName}, your contribution in "${groupName}" is due soon. A quick tap keeps the group on track.`,
      };
    case 2:
      return {
        title: 'Contribution due today ⚠️',
        body: `${displayName}, your contribution in "${groupName}" is due today. The group is counting on you.`,
      };
    case 3:
      return {
        title: 'Penalty risk — contribute now 🚨',
        body: `${displayName}, your contribution in "${groupName}" is overdue and a penalty may apply. Contribute now to avoid it.`,
      };
    default:
      return { title: '', body: '' };
  }
}
