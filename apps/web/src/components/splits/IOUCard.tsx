import type { IOU } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface IOUCardProps {
  iou: IOU;
  onSettle: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function IOUCard({ iou, onSettle, onDelete }: IOUCardProps) {
  const isSettled = iou.is_settled;
  const isOwedToMe = iou.direction === 'owed_to_me';

  return (
    <div
      className={`bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3
        transition-shadow hover:shadow-lg hover:shadow-black/20
        ${isSettled ? 'opacity-60' : ''}`}
    >
      {/* Row 1: Person name + direction badge */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-white font-semibold truncate flex-1">{iou.person_name}</p>
        <div className="flex items-center gap-2 shrink-0">
          {isSettled && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-muted">
              Settled
            </span>
          )}
          {isOwedToMe ? (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-income/20 text-income">
              Owes you
            </span>
          ) : (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-expense/20 text-expense">
              You owe
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Amount + description */}
      <div className="flex items-center gap-3">
        <span
          className={`text-lg font-bold ${isOwedToMe ? 'text-income' : 'text-expense'}`}
        >
          {formatPesewas(iou.amount_pesewas)}
        </span>
        {iou.description && (
          <span className="text-muted text-sm truncate flex-1">{iou.description}</span>
        )}
      </div>

      {/* Row 3: Date + actions */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted text-xs">{formatRelativeDate(iou.created_at)}</span>
          {isSettled && iou.settled_at && (
            <span className="text-muted text-xs">
              Settled {formatShortDate(iou.settled_at)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isSettled && (
            <button
              type="button"
              onClick={() => onSettle(iou.id)}
              className="px-3 py-1.5 rounded-lg border border-gold/60 text-gold font-semibold
                text-xs hover:bg-gold/10 active:scale-95 transition-all min-h-[36px]"
            >
              Mark Paid
            </button>
          )}
          <button
            type="button"
            onClick={() => onDelete(iou.id)}
            className="px-3 py-1.5 rounded-lg border border-white/10 text-muted font-medium
              text-xs hover:bg-white/10 hover:text-white active:scale-95 transition-all min-h-[36px]"
            aria-label="Delete IOU"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
