import type { RecurringCandidate, RecurringFrequency } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface CandidateCardProps {
  candidate: RecurringCandidate;
  onConfirm: (id: string) => void;
  onDismiss: (id: string) => void;
}

const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Bi-weekly',
  monthly: 'Monthly',
};

export function CandidateCard({ candidate, onConfirm, onDismiss }: CandidateCardProps) {
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
          ~{formatPesewas(candidate.avg_amount_pesewas)}/{candidate.frequency === 'weekly' ? 'week' : candidate.frequency === 'biweekly' ? '2 weeks' : 'month'}
        </span>
        <span className="text-muted">Seen {candidate.occurrence_count} times</span>
      </div>

      {/* Row 3: Confirm + Dismiss buttons */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onConfirm(candidate.id)}
          className="flex-1 py-2 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
            hover:brightness-110 active:scale-95 transition-all"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => onDismiss(candidate.id)}
          className="flex-1 py-2 rounded-xl bg-white/10 text-muted font-semibold text-sm
            hover:bg-white/20 active:scale-95 transition-all"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
