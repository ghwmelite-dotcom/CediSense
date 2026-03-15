import type { LeaderboardEntry } from '@cedisense/shared';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  /** Loading state — shows skeleton rows */
  loading?: boolean;
}

function trustScoreColor(score: number): string {
  if (score >= 80) return 'text-income';
  if (score >= 60) return 'text-gold';
  if (score >= 40) return 'text-muted';
  return 'text-expense';
}

function trustScoreBg(score: number): string {
  if (score >= 80) return 'bg-income/15 border-income/40';
  if (score >= 60) return 'bg-gold/15 border-gold/40';
  if (score >= 40) return 'bg-white/10 border-white/20';
  return 'bg-expense/15 border-expense/40';
}

const RANK_STYLES: Record<number, string> = {
  1: 'text-gold font-bold',
  2: 'text-white/80 font-semibold',
  3: 'text-amber-600 font-semibold',
};

export function Leaderboard({ entries, loading = false }: LeaderboardProps) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading leaderboard">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-xl bg-white/5 animate-pulse"
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-muted text-sm text-center py-4">
        No members to rank yet.
      </p>
    );
  }

  return (
    <div
      className="rounded-xl border border-white/10 overflow-hidden"
      role="table"
      aria-label="Group leaderboard"
    >
      {/* Header */}
      <div
        role="row"
        className="grid grid-cols-[28px_1fr_52px_52px_36px] gap-2 items-center
          px-3 py-2 bg-white/5 border-b border-white/10"
      >
        <span role="columnheader" className="text-muted text-[10px] font-semibold uppercase tracking-wide text-center">#</span>
        <span role="columnheader" className="text-muted text-[10px] font-semibold uppercase tracking-wide">Name</span>
        <span role="columnheader" className="text-muted text-[10px] font-semibold uppercase tracking-wide text-center">Score</span>
        <span role="columnheader" className="text-muted text-[10px] font-semibold uppercase tracking-wide text-center">Streak</span>
        <span role="columnheader" className="text-muted text-[10px] font-semibold uppercase tracking-wide text-center">🏅</span>
      </div>

      {/* Rows */}
      <div role="rowgroup">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const rankStyle = RANK_STYLES[rank] ?? 'text-muted font-medium';

          return (
            <div
              key={`${entry.member_name}-${rank}`}
              role="row"
              className={`grid grid-cols-[28px_1fr_52px_52px_36px] gap-2 items-center
                px-3 py-3 border-b border-white/5 last:border-b-0
                ${rank === 1 ? 'bg-gold/5' : 'bg-transparent'}
                hover:bg-white/5 transition-colors`}
            >
              {/* Rank */}
              <span
                role="cell"
                className={`text-sm text-center ${rankStyle}`}
                aria-label={`Rank ${rank}`}
              >
                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
              </span>

              {/* Name */}
              <span
                role="cell"
                className="text-white text-sm font-medium truncate"
              >
                {entry.member_name}
              </span>

              {/* Trust score */}
              <div role="cell" className="flex justify-center">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full
                    text-[11px] font-bold border
                    ${trustScoreBg(entry.trust_score)} ${trustScoreColor(entry.trust_score)}`}
                  title={`Trust score: ${entry.trust_score}`}
                >
                  {entry.trust_score}
                </span>
              </div>

              {/* Streak */}
              <div role="cell" className="flex items-center justify-center gap-0.5">
                {entry.current_streak > 0 ? (
                  <>
                    <span className="text-sm" aria-hidden="true">🔥</span>
                    <span className="text-white text-xs font-semibold">
                      {entry.current_streak}
                    </span>
                  </>
                ) : (
                  <span className="text-muted text-xs">—</span>
                )}
              </div>

              {/* Badge count */}
              <div role="cell" className="flex justify-center">
                {entry.badges_count > 0 ? (
                  <span className="text-white text-xs font-semibold">
                    {entry.badges_count}
                  </span>
                ) : (
                  <span className="text-muted text-xs">0</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
