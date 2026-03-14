import type { InvestmentSummary, InvestmentType } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface InvestmentSummaryCardProps {
  summary: InvestmentSummary;
}

const TYPE_LABELS: Record<InvestmentType, string> = {
  tbill: 'T-Bills',
  mutual_fund: 'Mutual Funds',
  fixed_deposit: 'Fixed Deposits',
  other: 'Other',
};

export function InvestmentSummaryCard({ summary }: InvestmentSummaryCardProps) {
  const returnsPesewas = summary.total_returns_pesewas;
  const returnsPositive = returnsPesewas >= 0;
  const returnPct =
    summary.total_invested_pesewas > 0
      ? ((returnsPesewas / summary.total_invested_pesewas) * 100).toFixed(2)
      : '0.00';

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-2xl p-5 space-y-4">
      {/* Portfolio value */}
      <div>
        <p className="text-muted text-xs font-medium uppercase tracking-wide mb-1">
          Total Portfolio
        </p>
        <p className="text-white text-3xl font-bold tracking-tight">
          {formatPesewas(summary.total_current_value_pesewas)}
        </p>
      </div>

      {/* Returns row */}
      <div className="flex items-center gap-6">
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide mb-0.5">
            Total Returns
          </p>
          <p
            className={`text-lg font-semibold ${
              returnsPositive ? 'text-income' : 'text-expense'
            }`}
          >
            {returnsPositive ? '+' : ''}
            {formatPesewas(returnsPesewas)}
          </p>
        </div>
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide mb-0.5">
            Return %
          </p>
          <p
            className={`text-lg font-semibold ${
              returnsPositive ? 'text-income' : 'text-expense'
            }`}
          >
            {returnsPositive ? '+' : ''}
            {returnPct}%
          </p>
        </div>
      </div>

      {/* Breakdown by type */}
      {summary.by_type.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
          {summary.by_type.map((item) => (
            <span
              key={item.type}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full
                bg-white/5 border border-white/10 text-xs text-muted"
            >
              <span className="text-white/70 font-medium">
                {TYPE_LABELS[item.type]}
              </span>
              <span>{formatPesewas(item.total_pesewas)}</span>
              <span className="text-white/30">({item.count})</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
