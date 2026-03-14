import { useState } from 'react';
import type { RecurringWithStatus, RecurringFrequency } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface RecurringCardProps {
  item: RecurringWithStatus;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
};

const FREQUENCY_OPTIONS: { value: RecurringFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly', label: 'Monthly' },
];

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecurringCard({ item, onUpdate, onDelete }: RecurringCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editAmount, setEditAmount] = useState(item.expected_amount_pesewas);
  const [editFrequency, setEditFrequency] = useState<RecurringFrequency>(item.frequency);
  const [editReminderDays, setEditReminderDays] = useState(item.reminder_days_before);
  const [editNextDueDate, setEditNextDueDate] = useState(item.next_due_date);
  const [editIsActive, setEditIsActive] = useState(item.is_active);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(item.id, {
        expected_amount_pesewas: editAmount,
        frequency: editFrequency,
        reminder_days_before: editReminderDays,
        next_due_date: editNextDueDate,
        is_active: editIsActive,
      });
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await onDelete(item.id);
    } finally {
      setSaving(false);
    }
  }

  function StatusBadge() {
    if (item.status === 'overdue') {
      return (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
            bg-gradient-to-r from-expense/20 to-expense/10
            text-expense border border-expense/25"
        >
          Overdue
        </span>
      );
    }
    if (item.status === 'due_soon') {
      const label = item.days_until_due === 0 ? 'Due today' : `Due in ${item.days_until_due} days`;
      return (
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
            bg-gradient-to-r from-gold/20 to-gold/10
            text-gold border border-gold/25"
        >
          {label}
        </span>
      );
    }
    // upcoming
    return (
      <span className="text-xs text-muted shrink-0 tabular-nums">
        Due {formatDueDate(item.next_due_date)}
      </span>
    );
  }

  return (
    <div
      className="card-interactive bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3
        hover:border-white/20 hover:shadow-card-hover"
    >
      {/* Row 1: Icon + name + frequency chip + expand toggle */}
      <div className="flex items-center gap-2">
        {item.category_icon && (
          <span
            className="text-base shrink-0"
            role="img"
            aria-label={item.category_name ?? 'Category'}
          >
            {item.category_icon}
          </span>
        )}
        <p className="text-white font-medium truncate flex-1">{item.counterparty}</p>
        <span
          className="bg-white/[0.07] border border-white/10 rounded-full px-2 py-0.5
            text-xs text-muted shrink-0"
        >
          {FREQUENCY_LABELS[item.frequency]}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="text-muted hover:text-white transition-colors ml-1 shrink-0
            focus-visible:outline-none focus-visible:text-white"
          aria-label={expanded ? 'Collapse editor' : 'Expand editor'}
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

      {/* Row 2: Expected amount + status badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-white text-sm font-semibold tabular-nums">
          {formatPesewas(item.expected_amount_pesewas)}
        </span>
        <StatusBadge />
      </div>

      {/* Expandable edit section */}
      {expanded && (
        <div className="border-t border-white/10 pt-3 space-y-3 animate-slide-down">
          {/* Expected amount */}
          <div className="space-y-1">
            <label className="text-xs text-muted">Expected amount</label>
            <AmountInput
              valuePesewas={editAmount}
              onChange={setEditAmount}
              disabled={saving}
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1">
            <label className="text-xs text-muted">Frequency</label>
            <select
              value={editFrequency}
              onChange={(e) => setEditFrequency(e.target.value as RecurringFrequency)}
              disabled={saving}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/30
                focus:border-gold/60 disabled:opacity-50 [color-scheme:dark] transition-all duration-200"
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder days */}
          <div className="space-y-1">
            <label className="text-xs text-muted">Remind me (days before)</label>
            <input
              type="number"
              min={0}
              max={30}
              value={editReminderDays}
              onChange={(e) => setEditReminderDays(Number(e.target.value))}
              disabled={saving}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/30
                focus:border-gold/60 disabled:opacity-50 [color-scheme:dark] transition-all duration-200"
            />
          </div>

          {/* Next due date */}
          <div className="space-y-1">
            <label className="text-xs text-muted">Next due date</label>
            <input
              type="date"
              value={editNextDueDate}
              onChange={(e) => setEditNextDueDate(e.target.value)}
              disabled={saving}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/30
                focus:border-gold/60 disabled:opacity-50 [color-scheme:dark] transition-all duration-200"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Active</span>
            <button
              type="button"
              role="switch"
              aria-checked={editIsActive}
              onClick={() => setEditIsActive((prev) => !prev)}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full
                transition-colors duration-200
                focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-50
                ${editIsActive ? 'bg-gold shadow-[0_0_10px_rgba(212,168,67,0.35)]' : 'bg-white/20'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow
                  transition-transform duration-200
                  ${editIsActive ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
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
}
