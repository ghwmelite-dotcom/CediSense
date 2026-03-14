import { formatPesewas } from '@cedisense/shared';

interface SummaryCardProps {
  income: number;
  expenses: number;
  fees: number;
}

export function SummaryCard({ income, expenses, fees }: SummaryCardProps) {
  const net = income - expenses;

  return (
    <div className="bg-ghana-surface rounded-xl p-5 border border-white/10 shadow-card card-interactive motion-safe:animate-fade-in">
      <div className="grid grid-cols-2 gap-3">
        {/* Income column */}
        <div className="relative rounded-xl p-3.5 overflow-hidden bg-gradient-to-br from-income/10 to-income/5 border border-income/15">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-income/30 to-transparent" />
          <p className="text-xs text-muted uppercase tracking-widest font-medium">Income</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-income/20 text-income text-xs font-bold flex-shrink-0">↑</span>
            <span className="text-lg font-bold text-income tabular-nums">{formatPesewas(income)}</span>
          </div>
        </div>

        {/* Expenses column */}
        <div className="relative rounded-xl p-3.5 overflow-hidden bg-gradient-to-br from-expense/10 to-expense/5 border border-expense/15">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-expense/30 to-transparent" />
          <p className="text-xs text-muted uppercase tracking-widest font-medium">Expenses</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-expense/20 text-expense text-xs font-bold flex-shrink-0">↓</span>
            <span className="text-lg font-bold text-expense tabular-nums">{formatPesewas(expenses)}</span>
          </div>
          {fees > 0 && (
            <p className="text-muted text-xs mt-1.5 pl-6">Fees: {formatPesewas(fees)}</p>
          )}
        </div>
      </div>

      {/* Net row */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
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
