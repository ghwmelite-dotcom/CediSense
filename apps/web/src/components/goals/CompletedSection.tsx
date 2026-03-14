import { useState } from 'react';
import type { SavingsGoalWithProgress } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface CompletedSectionProps {
  goals: SavingsGoalWithProgress[];
}

export function CompletedSection({ goals }: CompletedSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (goals.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-muted text-sm hover:text-white/70
          transition-colors w-full text-left"
        aria-expanded={expanded}
      >
        <span className="font-medium">Completed ({goals.length})</span>
        <span className="ml-auto text-xs">{expanded ? '▼' : '▶'}</span>
      </button>

      {/* Completed goal list */}
      {expanded && (
        <div className="space-y-3">
          {goals.map((goal) => (
            <div
              key={goal.id}
              className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3 opacity-75"
            >
              {/* Row 1: name + checkmark badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-white font-medium truncate">{goal.name}</span>
                <span
                  className="shrink-0 text-xs px-2 py-0.5 rounded-full border
                    text-income border-income/30 bg-income/10"
                >
                  ✓ Complete
                </span>
              </div>

              {/* Row 2: progress bar at 100% in income green */}
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-full rounded-full bg-income" />
              </div>

              {/* Row 3: amounts + percentage */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">
                  {formatPesewas(goal.current_pesewas)}{' '}
                  <span className="text-white/40">/</span>{' '}
                  {formatPesewas(goal.target_pesewas)}
                </span>
                <span className="text-income font-medium">100.0%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
