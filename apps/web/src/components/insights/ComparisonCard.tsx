import type { MonthSummary } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface ComparisonCardProps {
  current: MonthSummary;
  previous: MonthSummary;
  currentMonth: string;
  previousMonth: string;
}

function formatMonthLabel(isoMonth: string): string {
  // isoMonth expected as "YYYY-MM"
  const [year, month] = isoMonth.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' }).format(date);
}

function computeChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

interface ChangeIndicatorProps {
  label: string;
  changePct: number | null;
  /** When true: increase = bad (expenses), false: increase = good (income), null: auto (net) */
  higherIsBad?: boolean;
}

function ChangeIndicator({ label, changePct, higherIsBad = false }: ChangeIndicatorProps) {
  if (changePct === null) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="text-muted">—</span>
      </div>
    );
  }

  const isUp = changePct >= 0;
  const isPositive = higherIsBad ? !isUp : isUp;
  const colorClass = isPositive ? 'text-income' : 'text-expense';
  const arrow = isUp ? '↑' : '↓';
  const pct = Math.abs(changePct).toFixed(1);

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className={`font-semibold ${colorClass}`}>
        {arrow} {pct}%
      </span>
    </div>
  );
}

export function ComparisonCard({
  current,
  previous,
  currentMonth,
  previousMonth,
}: ComparisonCardProps) {
  const currentNet = current.total_income_pesewas - current.total_expenses_pesewas;
  const previousNet = previous.total_income_pesewas - previous.total_expenses_pesewas;

  const incomeChange = computeChange(current.total_income_pesewas, previous.total_income_pesewas);
  const expensesChange = computeChange(current.total_expenses_pesewas, previous.total_expenses_pesewas);
  const netChange = computeChange(currentNet, previousNet);

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-4">
      <h2 className="text-sm text-muted uppercase tracking-wide">Month-over-Month</h2>

      {/* Two-column comparison */}
      <div className="grid grid-cols-2 gap-3">
        {/* Previous month */}
        <div className="space-y-2.5 p-3 rounded-lg bg-white/5">
          <p className="text-xs font-medium text-muted uppercase tracking-wide">
            {formatMonthLabel(previousMonth)}
          </p>
          <div className="space-y-1.5">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wide">Income</p>
              <p className="text-sm font-semibold text-muted">
                {formatPesewas(previous.total_income_pesewas)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wide">Expenses</p>
              <p className="text-sm font-semibold text-muted">
                {formatPesewas(previous.total_expenses_pesewas)}
              </p>
            </div>
            <div className="pt-1.5 border-t border-white/10">
              <p className="text-[10px] text-muted uppercase tracking-wide">Net</p>
              <p className={`text-sm font-semibold ${previousNet >= 0 ? 'text-muted' : 'text-expense/70'}`}>
                {previousNet >= 0 ? '+' : '-'}{formatPesewas(Math.abs(previousNet))}
              </p>
            </div>
          </div>
        </div>

        {/* Current month */}
        <div className="space-y-2.5 p-3 rounded-lg bg-white/10">
          <p className="text-xs font-medium text-white uppercase tracking-wide">
            {formatMonthLabel(currentMonth)}
          </p>
          <div className="space-y-1.5">
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wide">Income</p>
              <p className="text-sm font-semibold text-white">
                {formatPesewas(current.total_income_pesewas)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted uppercase tracking-wide">Expenses</p>
              <p className="text-sm font-semibold text-white">
                {formatPesewas(current.total_expenses_pesewas)}
              </p>
            </div>
            <div className="pt-1.5 border-t border-white/10">
              <p className="text-[10px] text-muted uppercase tracking-wide">Net</p>
              <p className={`text-sm font-semibold ${currentNet >= 0 ? 'text-income' : 'text-expense'}`}>
                {currentNet >= 0 ? '+' : '-'}{formatPesewas(Math.abs(currentNet))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Change indicators */}
      <div className="border-t border-white/10 pt-3 space-y-2">
        <p className="text-xs text-muted uppercase tracking-wide mb-2">Changes vs {formatMonthLabel(previousMonth)}</p>
        <ChangeIndicator label="Income" changePct={incomeChange} higherIsBad={false} />
        <ChangeIndicator label="Expenses" changePct={expensesChange} higherIsBad={true} />
        <ChangeIndicator
          label="Net"
          changePct={netChange}
          higherIsBad={currentNet !== null && previousNet !== null ? currentNet < previousNet : false}
        />
      </div>
    </div>
  );
}
