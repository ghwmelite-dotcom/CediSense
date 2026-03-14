import { useState } from 'react';
import type { SavingsGoalWithProgress } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface GoalCardProps {
  goal: SavingsGoalWithProgress;
  onContribute: (id: string, amount: number) => void;
  onUpdate: (id: string, data: { name?: string; target_pesewas?: number; deadline?: string | null }) => void;
  onDelete: (id: string) => void;
}

export function GoalCard({ goal, onContribute, onUpdate, onDelete }: GoalCardProps) {
  const [contributing, setContributing] = useState(false);
  const [contributionPesewas, setContributionPesewas] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(goal.name);
  const [editTargetPesewas, setEditTargetPesewas] = useState(goal.target_pesewas);
  const [editDeadline, setEditDeadline] = useState(goal.deadline ?? '');

  const clampedPct = Math.min(goal.percentage, 100);
  const isCompleted = goal.percentage >= 100;

  function handleContributeSubmit() {
    if (contributionPesewas <= 0) return;
    onContribute(goal.id, contributionPesewas);
    setContributing(false);
    setContributionPesewas(0);
  }

  function handleUpdateSave() {
    onUpdate(goal.id, {
      name: editName.trim() || undefined,
      target_pesewas: editTargetPesewas > 0 ? editTargetPesewas : undefined,
      deadline: editDeadline || null,
    });
    setEditing(false);
  }

  const deadlineBadgeClass =
    goal.days_remaining !== null && goal.days_remaining <= 0
      ? 'text-expense border-expense/30 bg-expense/10'
      : goal.days_remaining !== null && goal.days_remaining <= 7
      ? 'text-gold border-gold/30 bg-gold/10'
      : 'text-muted border-white/10';

  return (
    <div
      className="card-interactive bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3
        hover:border-white/20 hover:shadow-card-hover"
    >
      {/* Row 1: name + deadline badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-white font-medium truncate">{goal.name}</span>
        <div className="shrink-0 flex items-center gap-2">
          {isCompleted && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-income/15 text-income border border-income/25 font-semibold">
              Complete
            </span>
          )}
          {!isCompleted && goal.deadline && goal.days_remaining !== null && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${deadlineBadgeClass}`}
            >
              {goal.days_remaining > 0 ? `${goal.days_remaining}d left` : 'Overdue'}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: progress bar with gold glow */}
      <div className="h-2 rounded-full bg-white/10 overflow-visible">
        <div
          className="h-full rounded-full bg-gold transition-all duration-700 ease-out
            shadow-[0_0_10px_rgba(212,168,67,0.45)]"
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {/* Row 3: amounts + percentage */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted tabular-nums">
          {formatPesewas(goal.current_pesewas)}{' '}
          <span className="text-white/40">/</span>{' '}
          {formatPesewas(goal.target_pesewas)}
        </span>
        <span className="text-gold font-semibold tabular-nums">
          {goal.percentage.toFixed(1)}%
        </span>
      </div>

      {/* Row 4: action buttons */}
      {!contributing && !editing && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setContributing(true)}
            className="border border-gold/50 text-gold rounded-lg px-3 py-1.5 text-sm font-medium
              bg-gold/5 hover:bg-gold/15 hover:border-gold hover:shadow-[0_0_12px_rgba(212,168,67,0.2)]
              active:scale-95 transition-all duration-200"
          >
            Contribute
          </button>
          <button
            type="button"
            onClick={() => {
              setEditName(goal.name);
              setEditTargetPesewas(goal.target_pesewas);
              setEditDeadline(goal.deadline ?? '');
              setEditing(true);
            }}
            className="text-muted text-sm px-3 py-1.5 rounded-lg hover:bg-white/10
              hover:text-white transition-all duration-200"
          >
            Edit
          </button>
        </div>
      )}

      {/* Contribute inline form */}
      {contributing && (
        <div className="space-y-2 pt-1 animate-slide-down">
          <AmountInput
            valuePesewas={contributionPesewas}
            onChange={setContributionPesewas}
            placeholder="0.00"
            className="text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleContributeSubmit}
              disabled={contributionPesewas <= 0}
              className="flex-1 py-2 rounded-lg bg-gold text-ghana-black text-sm font-semibold
                disabled:opacity-40 hover:brightness-110 hover:shadow-gold-glow
                active:scale-95 transition-all duration-200"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setContributing(false);
                setContributionPesewas(0);
              }}
              className="px-4 py-2 rounded-lg bg-white/10 text-muted text-sm
                hover:bg-white/20 hover:text-white transition-all duration-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="space-y-3 pt-1 border-t border-white/10 animate-slide-down">
          <div className="space-y-1">
            <label className="text-muted text-xs">Goal name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm placeholder:text-muted focus:outline-none
                focus:ring-2 focus:ring-gold/30 focus:border-gold/60 transition-all duration-200"
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted text-xs">Target amount</label>
            <AmountInput
              valuePesewas={editTargetPesewas}
              onChange={setEditTargetPesewas}
            />
          </div>
          <div className="space-y-1">
            <label className="text-muted text-xs">Deadline (optional)</label>
            <input
              type="date"
              value={editDeadline}
              onChange={(e) => setEditDeadline(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/30
                focus:border-gold/60 transition-all duration-200 [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpdateSave}
              disabled={!editName.trim() || editTargetPesewas <= 0}
              className="flex-1 py-2 rounded-lg bg-gold text-ghana-black text-sm font-semibold
                disabled:opacity-40 hover:brightness-110 hover:shadow-gold-glow
                active:scale-95 transition-all duration-200"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-white/10 text-muted text-sm
                hover:bg-white/20 hover:text-white transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onDelete(goal.id)}
              className="px-4 py-2 rounded-lg bg-expense/15 text-expense text-sm
                hover:bg-expense/25 transition-all duration-200"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
