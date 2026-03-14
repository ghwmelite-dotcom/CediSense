import { useState } from 'react';
import type { RecurringCandidate, RecurringFrequency } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface CandidateCardProps {
  candidate: RecurringCandidate;
  onConfirm: (id: string, reminderDaysBefore: number) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
};

const PERIOD_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'week',
  biweekly: '2 weeks',
  monthly: 'month',
};

export function CandidateCard({ candidate, onConfirm, onDismiss }: CandidateCardProps) {
  const [busy, setBusy] = useState(false);
  const [reminderDays, setReminderDays] = useState(3);

  async function handleConfirm() {
    setBusy(true);
    try {
      await onConfirm(candidate.id, reminderDays);
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    try {
      await onDismiss(candidate.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3 transition-shadow hover:shadow-lg hover:shadow-black/20">
      {/* Row 1: Counterparty + frequency badge */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-white font-medium truncate">{candidate.counterparty}</p>
        <span className="bg-white/10 rounded-full px-2 py-0.5 text-xs text-muted shrink-0">
          {FREQUENCY_LABELS[candidate.frequency]}
        </span>
      </div>

      {/* Row 2: Estimated amount + occurrence count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-white font-semibold">
          ~{formatPesewas(candidate.avg_amount_pesewas)}/{PERIOD_LABELS[candidate.frequency]}
        </span>
        <span className="text-muted">Seen {candidate.occurrence_count} times</span>
      </div>

      {/* Row 3: Reminder days selector */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted">Remind me</span>
        <select
          value={reminderDays}
          onChange={(e) => setReminderDays(Number(e.target.value))}
          disabled={busy}
          className="bg-white/10 border border-white/10 rounded-lg px-2 py-1 text-white text-xs
            focus:outline-none focus:ring-2 focus:ring-gold/50 disabled:opacity-50 [color-scheme:dark]"
        >
          <option value={1}>1 day</option>
          <option value={2}>2 days</option>
          <option value={3}>3 days</option>
          <option value={5}>5 days</option>
          <option value={7}>7 days</option>
        </select>
        <span className="text-muted">before due</span>
      </div>

      {/* Row 4: Confirm + Dismiss buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy}
          className="flex-1 py-2 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
            hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[44px]"
        >
          {busy ? 'Saving…' : 'Track this'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={busy}
          className="flex-1 py-2 rounded-xl bg-white/10 text-muted font-semibold text-sm
            hover:bg-white/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed
            min-h-[44px]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
