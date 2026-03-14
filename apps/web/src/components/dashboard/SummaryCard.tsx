import { formatPesewas } from '@cedisense/shared';

interface SummaryCardProps {
  income: number;
  expenses: number;
  fees: number;
}

export function SummaryCard({ income, expenses, fees }: SummaryCardProps) {
  const net = income - expenses;

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-income/10 rounded-lg p-3">
          <p className="text-sm text-muted uppercase tracking-wide">Income</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-income text-sm">↑</span>
            <span className="text-xl font-semibold text-income">{formatPesewas(income)}</span>
          </div>
        </div>
        <div className="bg-expense/10 rounded-lg p-3">
          <p className="text-sm text-muted uppercase tracking-wide">Expenses</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-expense text-sm">↓</span>
            <span className="text-xl font-semibold text-expense">{formatPesewas(expenses)}</span>
          </div>
          {fees > 0 && (
            <p className="text-muted text-xs mt-1">Fees: {formatPesewas(fees)}</p>
          )}
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5 text-center">
        <span className="text-sm text-muted">Net: </span>
        <span className={`text-sm font-semibold ${net >= 0 ? 'text-income' : 'text-expense'}`}>
          {net >= 0 ? '+' : '-'}{formatPesewas(Math.abs(net))}
        </span>
      </div>
    </div>
  );
}
