import type { SusuAnalytics } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface GroupAnalyticsProps {
  analytics: SusuAnalytics;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'gold' | 'income' | 'expense' | 'default';
}) {
  const valueClass =
    accent === 'gold'
      ? 'text-gold'
      : accent === 'income'
        ? 'text-income'
        : accent === 'expense'
          ? 'text-expense'
          : 'text-white';

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-1">
      <p className="text-muted text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-muted text-xs">{sub}</p>}
    </div>
  );
}

export function GroupAnalytics({ analytics }: GroupAnalyticsProps) {
  const {
    total_contributed_pesewas,
    total_payouts_pesewas,
    penalty_pool_pesewas,
    contribution_rate,
    on_time_rate,
    rounds_completed,
    total_rounds,
    projected_completion_date,
    per_round,
    per_member,
  } = analytics;

  // Find the max total_pesewas for bar chart scaling
  const maxRoundPesewas = per_round.reduce(
    (max, r) => Math.max(max, r.total_pesewas),
    1
  );

  const onTimeAccent: 'income' | 'gold' | 'expense' =
    on_time_rate >= 80 ? 'income' : on_time_rate >= 50 ? 'gold' : 'expense';

  const contribAccent: 'income' | 'gold' | 'expense' =
    contribution_rate >= 80 ? 'income' : contribution_rate >= 50 ? 'gold' : 'expense';

  return (
    <div className="space-y-6">
      {/* Summary stats — 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Total Saved"
          value={formatPesewas(total_contributed_pesewas)}
          accent="gold"
        />
        <StatCard
          label="Total Payouts"
          value={formatPesewas(total_payouts_pesewas)}
          accent="income"
        />
        <StatCard
          label="Contribution Rate"
          value={`${contribution_rate}%`}
          sub="of expected contributions"
          accent={contribAccent}
        />
        <StatCard
          label="On-Time Rate"
          value={`${on_time_rate}%`}
          sub="paid without penalties"
          accent={onTimeAccent}
        />
      </div>

      {/* Rounds progress + projected completion */}
      <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-muted text-xs font-semibold uppercase tracking-wide">
            Rounds Progress
          </p>
          <span className="text-gold font-bold text-sm">
            {rounds_completed} / {total_rounds}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-2.5 rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuenow={rounds_completed}
          aria-valuemin={0}
          aria-valuemax={total_rounds}
        >
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${total_rounds > 0 ? (rounds_completed / total_rounds) * 100 : 0}%` }}
          />
        </div>

        {projected_completion_date && (
          <p className="text-muted text-xs">
            Projected completion:{' '}
            <span className="text-white font-medium">
              {new Date(projected_completion_date).toLocaleDateString('en-GH', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </p>
        )}

        {penalty_pool_pesewas > 0 && (
          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <p className="text-expense text-xs font-medium">Penalty Pool</p>
            <span className="text-expense font-bold text-sm">
              {formatPesewas(penalty_pool_pesewas)}
            </span>
          </div>
        )}
      </div>

      {/* Per-round bar chart */}
      {per_round.length > 0 && (
        <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-4">
          <p className="text-muted text-xs font-semibold uppercase tracking-wide">
            Contributions Per Round
          </p>
          <div className="space-y-2">
            {per_round.map((r) => {
              const barPct = Math.round((r.total_pesewas / maxRoundPesewas) * 100);
              const expectedPct = Math.round(
                (r.expected > 0 ? r.contributions / r.expected : 1) * 100
              );

              return (
                <div key={r.round} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted font-medium">Round {r.round}</span>
                    <span className="text-white font-semibold">
                      {formatPesewas(r.total_pesewas)}
                      <span className="text-muted font-normal ml-1.5">
                        ({r.contributions}/{r.expected})
                      </span>
                    </span>
                  </div>
                  <div className="h-5 bg-white/5 rounded-md overflow-hidden relative">
                    {/* Expected fill (dimmed) */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gold/15 rounded-md transition-all duration-300"
                      style={{ width: `${expectedPct}%` }}
                    />
                    {/* Actual fill */}
                    <div
                      className="absolute inset-y-0 left-0 bg-gold/70 rounded-md transition-all duration-300"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-muted text-[10px]">
            Bar length = total saved; inner fill = contributions vs expected members
          </p>
        </div>
      )}

      {/* Per-member table */}
      {per_member.length > 0 && (
        <div className="bg-ghana-surface border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-muted text-xs font-semibold uppercase tracking-wide">
              Member Breakdown
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {per_member.map((m, idx) => {
              const pct = m.contributions > 0 ? Math.round((m.on_time / m.contributions) * 100) : 100;
              const scoreClass =
                pct >= 80
                  ? 'text-income'
                  : pct >= 50
                    ? 'text-gold'
                    : 'text-expense';

              return (
                <div
                  key={`${m.member_name}-${idx}`}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  {/* Rank */}
                  <span className="text-muted text-xs font-bold w-5 text-center shrink-0">
                    {idx + 1}
                  </span>

                  {/* Name + on-time badge */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-white text-sm font-semibold truncate">{m.member_name}</p>
                    <p className="text-muted text-xs">
                      {m.contributions} contribution{m.contributions !== 1 ? 's' : ''}
                      {' · '}
                      <span className={scoreClass}>{m.on_time} on-time</span>
                    </p>
                  </div>

                  {/* Total */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-gold font-bold text-sm">{formatPesewas(m.total_pesewas)}</p>
                    <p className={`text-xs font-medium ${scoreClass}`}>{pct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
