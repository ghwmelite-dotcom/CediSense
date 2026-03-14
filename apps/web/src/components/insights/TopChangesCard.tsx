import type { SpendingChange, ChangeDirection } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface TopChangesCardProps {
  changes: SpendingChange[];
}

interface DirectionBadgeProps {
  direction: ChangeDirection;
  changePct: number;
}

function DirectionBadge({ direction, changePct }: DirectionBadgeProps) {
  if (direction === 'new') {
    return (
      <span className="text-xs font-semibold text-gold bg-gold/20 px-2 py-0.5 rounded">
        NEW
      </span>
    );
  }

  if (direction === 'up') {
    return (
      <span className="text-xs font-semibold text-expense">
        ↑ {changePct.toFixed(1)}%
      </span>
    );
  }

  return (
    <span className="text-xs font-semibold text-income">
      ↓ {Math.abs(changePct).toFixed(1)}%
    </span>
  );
}

interface AmountsDisplayProps {
  direction: ChangeDirection;
  currentPesewas: number;
  previousPesewas: number;
}

function AmountsDisplay({ direction, currentPesewas, previousPesewas }: AmountsDisplayProps) {
  if (direction === 'new') {
    return (
      <span className="text-xs text-muted">{formatPesewas(currentPesewas)}</span>
    );
  }

  return (
    <span className="text-xs text-muted">
      {formatPesewas(currentPesewas)}{' '}
      <span className="text-white/30">vs</span>{' '}
      {formatPesewas(previousPesewas)}
    </span>
  );
}

export function TopChangesCard({ changes }: TopChangesCardProps) {
  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3">
      <h2 className="text-sm text-muted uppercase tracking-wide">Biggest Changes</h2>

      {changes.length === 0 ? (
        <p className="text-muted text-sm py-4 text-center">No changes to show</p>
      ) : (
        <ul className="space-y-2.5" role="list">
          {changes.map((change, index) => (
            <li
              key={`${change.category_name}-${index}`}
              className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0"
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 bg-white/10"
                aria-hidden="true"
              >
                {change.icon}
              </div>

              {/* Category name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white font-medium truncate">{change.category_name}</p>
                <AmountsDisplay
                  direction={change.direction}
                  currentPesewas={change.current_pesewas}
                  previousPesewas={change.previous_pesewas}
                />
              </div>

              {/* Direction + pct */}
              <div className="shrink-0">
                <DirectionBadge direction={change.direction} changePct={change.change_percentage} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
