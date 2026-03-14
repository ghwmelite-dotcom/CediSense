import type { BudgetWithSpending } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface BudgetSummaryBarProps {
  budgets: BudgetWithSpending[];
}

export function BudgetSummaryBar({ budgets }: BudgetSummaryBarProps) {
  const totalBudgeted = budgets.reduce((sum, b) => sum + b.amount_pesewas, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent_pesewas, 0);
  const percentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  const barColor =
    percentage > 100
      ? 'bg-expense'
      : percentage >= 80
      ? 'bg-gold'
      : 'bg-income';

  const percentageClamped = Math.min(percentage, 100);

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">Monthly Budget</span>
        <span className="text-sm font-semibold text-white">
          {formatPesewas(totalSpent)}{' '}
          <span className="text-muted font-normal">/ {formatPesewas(totalBudgeted)}</span>
        </span>
      </div>

      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentageClamped}%` }}
          role="progressbar"
          aria-valuenow={Math.round(percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      <div className="flex justify-end">
        <span
          className={`text-xs font-semibold ${
            percentage > 100
              ? 'text-expense'
              : percentage >= 80
              ? 'text-gold'
              : 'text-income'
          }`}
        >
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
}
