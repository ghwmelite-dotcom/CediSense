export interface TrustScoreStats {
  total_contributions: number;
  on_time_contributions: number;
  late_contributions: number;
  missed_contributions: number;
  groups_completed: number;
}

export type TrustLabel = 'Excellent' | 'Good' | 'Fair' | 'Poor';

/**
 * Compute a trust score (0-100) from contribution statistics.
 *
 * Formula:
 * - Base: 50
 * - +1 per on-time contribution (capped at +30)
 * - -3 per late contribution
 * - -5 per missed contribution
 * - +5 per completed group (capped at +20)
 * - Clamped to [0, 100]
 */
export function computeTrustScore(stats: TrustScoreStats): number {
  const base = 50;

  const onTimeBonus = Math.min(stats.on_time_contributions, 30);
  const latepenalty = stats.late_contributions * 3;
  const missedPenalty = stats.missed_contributions * 5;
  const completionBonus = Math.min(stats.groups_completed * 5, 20);

  const raw = base + onTimeBonus - latepenalty - missedPenalty + completionBonus;

  return Math.max(0, Math.min(100, raw));
}

/**
 * Returns a human-readable label for the given trust score.
 */
export function getTrustLabel(score: number): TrustLabel {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

/**
 * Returns a Tailwind text color class for the given trust score.
 */
export function getTrustColor(score: number): string {
  if (score >= 80) return 'text-income';
  if (score >= 60) return 'text-gold';
  if (score >= 40) return 'text-muted';
  return 'text-expense';
}
