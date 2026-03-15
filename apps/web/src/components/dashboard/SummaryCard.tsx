import { formatPesewas } from '@cedisense/shared';

interface SummaryCardProps {
  income: number;
  expenses: number;
  fees: number;
}

export function SummaryCard({ income, expenses, fees }: SummaryCardProps) {
  const net = income - expenses;

  return (
    <div className="premium-card rounded-2xl p-6 card-interactive motion-safe:animate-fade-in">
      <div className="grid grid-cols-2 gap-4">
        {/* Income column */}
        <div className="rounded-xl p-4 bg-income/[0.05]">
          <p className="section-label">Income</p>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-income/15 text-income text-xs font-bold flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </span>
            <span className="text-lg font-extrabold text-income tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPesewas(income)}</span>
          </div>
        </div>

        {/* Expenses column */}
        <div className="rounded-xl p-4 bg-expense/[0.05]">
          <p className="section-label">Expenses</p>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-expense/15 text-expense text-xs font-bold flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
            <span className="text-lg font-extrabold text-expense tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPesewas(expenses)}</span>
          </div>
          {fees > 0 && (
            <p className="text-muted-dim text-xs mt-2 pl-6.5" style={{ fontVariantNumeric: 'tabular-nums' }}>Fees: {formatPesewas(fees)}</p>
          )}
        </div>
      </div>

      {/* Net row — clean separator via background contrast */}
      <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(136, 136, 168, 0.08)' }}>
        <span className="section-label">Net</span>
        <span
          className={`text-base font-extrabold tracking-tight motion-safe:animate-fade-in ${
            net >= 0 ? 'text-income' : 'text-expense'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {net >= 0 ? '+' : '-'}{formatPesewas(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}
