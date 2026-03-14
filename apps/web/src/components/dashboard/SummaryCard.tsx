import { formatPesewas } from '@cedisense/shared';

interface SummaryCardProps {
  income: number;
  expenses: number;
  fees: number;
}

export function SummaryCard({ income, expenses, fees }: SummaryCardProps) {
  const net = income - expenses;

  return (
    <div className="glass-card rounded-2xl p-6 card-interactive motion-safe:animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        {/* Income column */}
        <div className="relative rounded-xl p-4 overflow-hidden bg-income/[0.06] border border-income/[0.08]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-income/20 to-transparent" />
          <p className="text-xs text-muted uppercase tracking-widest font-medium">Income</p>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-income/15 text-income text-xs font-bold flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </span>
            <span className="text-lg font-bold text-income tabular-nums">{formatPesewas(income)}</span>
          </div>
        </div>

        {/* Expenses column */}
        <div className="relative rounded-xl p-4 overflow-hidden bg-expense/[0.06] border border-expense/[0.08]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-expense/20 to-transparent" />
          <p className="text-xs text-muted uppercase tracking-widest font-medium">Expenses</p>
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-expense/15 text-expense text-xs font-bold flex-shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
            <span className="text-lg font-bold text-expense tabular-nums">{formatPesewas(expenses)}</span>
          </div>
          {fees > 0 && (
            <p className="text-muted/70 text-xs mt-2 pl-6.5">Fees: {formatPesewas(fees)}</p>
          )}
        </div>
      </div>

      {/* Net row */}
      <div className="mt-4 pt-4 border-t border-white/[0.04] flex items-center justify-between">
        <span className="text-xs text-muted uppercase tracking-widest font-medium">Net</span>
        <span
          className={`text-base font-bold tabular-nums motion-safe:animate-fade-in ${
            net >= 0 ? 'text-income' : 'text-expense'
          }`}
        >
          {net >= 0 ? '+' : '-'}{formatPesewas(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}
