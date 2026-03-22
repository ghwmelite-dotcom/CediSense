import { useState, memo } from 'react';
import type { BudgetWithSpending } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface BudgetCardProps {
  budget: BudgetWithSpending;
  onUpdate: (id: string, amount: number) => void;
  onDelete: (id: string) => void;
}

const STATUS_STYLES = {
  on_track: {
    badge: 'bg-income/15 text-income border border-income/25',
    bar: 'bg-income',
    barGlow: 'shadow-[0_0_8px_rgba(74,222,128,0.5)]',
    label: 'On track',
  },
  warning: {
    badge: 'bg-gold/15 text-gold border border-gold/25',
    bar: 'bg-gold',
    barGlow: 'shadow-[0_0_8px_rgba(212,168,67,0.5)]',
    label: 'Warning',
  },
  exceeded: {
    badge: 'bg-expense/15 text-expense border border-expense/25',
    bar: 'bg-expense',
    barGlow: 'shadow-[0_0_8px_rgba(248,113,113,0.5)]',
    label: 'Exceeded',
  },
} as const;

export const BudgetCard = memo(function BudgetCard({ budget, onUpdate, onDelete }: BudgetCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editAmount, setEditAmount] = useState(budget.amount_pesewas);
  const [saving, setSaving] = useState(false);

  const styles = STATUS_STYLES[budget.status];
  const progressWidth = Math.min(budget.percentage, 100);
  const isOver = budget.spent_pesewas > budget.amount_pesewas;
  const diff = Math.abs(budget.remaining_pesewas);

  async function handleSave() {
    if (editAmount <= 0) return;
    setSaving(true);
    try {
      await onUpdate(budget.id, editAmount);
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete(budget.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="card-interactive bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3
        hover:border-white/20 hover:shadow-card-hover"
    >
      {/* Row 1: Icon + Name + Badge */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0
            transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${budget.category_color}33` }}
        >
          <span role="img" aria-label={budget.category_name}>
            {budget.category_icon}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{budget.category_name}</p>
        </div>

        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${styles.badge}`}
        >
          {styles.label}
        </span>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-muted hover:text-white transition-colors ml-1 shrink-0
            focus-visible:outline-none focus-visible:text-white"
          aria-label={expanded ? 'Collapse budget editor' : 'Expand budget editor'}
          aria-expanded={expanded}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Row 2: Progress bar with status glow */}
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-visible">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${styles.bar} ${styles.barGlow}`}
          style={{ width: `${progressWidth}%` }}
          role="progressbar"
          aria-valuenow={Math.round(budget.percentage)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>

      {/* Row 3: Amounts */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-white font-medium tabular-nums">
          {formatPesewas(budget.spent_pesewas)}{' '}
          <span className="text-muted">/ {formatPesewas(budget.amount_pesewas)}</span>
        </span>
        <span
          className={`tabular-nums ${isOver ? 'text-expense font-semibold' : 'text-income font-medium'}`}
        >
          {isOver
            ? `${formatPesewas(diff)} over budget`
            : `${formatPesewas(diff)} remaining`}
        </span>
      </div>

      {/* Expandable edit section */}
      {expanded && (
        <div className="border-t border-white/10 pt-3 space-y-3 animate-slide-down">
          <label className="block text-xs text-muted mb-1">Monthly limit</label>
          <AmountInput
            valuePesewas={editAmount}
            onChange={setEditAmount}
            placeholder="0.00"
            disabled={saving}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || editAmount <= 0}
              className="flex-1 py-2.5 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
                hover:brightness-110 hover:shadow-gold-glow active:scale-95
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-expense/15 text-expense font-semibold text-sm
                hover:bg-expense/25 active:scale-95 transition-all duration-200
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
