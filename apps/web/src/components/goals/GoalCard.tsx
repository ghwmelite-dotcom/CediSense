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

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3">
      {/* Row 1: name + deadline badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-white font-medium truncate">{goal.name}</span>
        <div className="shrink-0">
          {goal.deadline && goal.days_remaining !== null && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${
                goal.days_remaining > 0
                  ? 'text-muted border-white/10'
                  : 'text-expense border-expense/30 bg-expense/10'
              }`}
            >
              {goal.days_remaining > 0 ? `${goal.days_remaining} days left` : 'Overdue'}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: progress bar */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gold transition-all duration-500"
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {/* Row 3: amounts + percentage */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {formatPesewas(goal.current_pesewas)}{' '}
          <span className="text-white/40">/</span>{' '}
          {formatPesewas(goal.target_pesewas)}
        </span>
        <span className="text-gold font-medium">{goal.percentage.toFixed(1)}%</span>
      </div>

      {/* Row 4: contribute button */}
      {!contributing && !editing && (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setContributing(true)}
            className="border border-gold text-gold rounded-lg px-3 py-1.5 text-sm
              hover:bg-gold/10 transition-colors active:scale-95"
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
            className="text-muted text-sm px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            Edit
          </button>
        </div>
      )}

      {/* Contribute inline form */}
      {contributing && (
        <div className="space-y-2 pt-1">
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
                disabled:opacity-40 hover:bg-gold/90 transition-colors active:scale-95"
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
                hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="space-y-3 pt-1 border-t border-white/10">
          <div className="space-y-1">
            <label className="text-muted text-xs">Goal name</label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              maxLength={100}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm placeholder-muted focus:outline-none
                focus:ring-2 focus:ring-gold/50 focus:border-gold"
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
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold [color-scheme:dark]"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleUpdateSave}
              disabled={!editName.trim() || editTargetPesewas <= 0}
              className="flex-1 py-2 rounded-lg bg-gold text-ghana-black text-sm font-semibold
                disabled:opacity-40 hover:bg-gold/90 transition-colors active:scale-95"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg bg-white/10 text-muted text-sm
                hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onDelete(goal.id)}
              className="px-4 py-2 rounded-lg bg-expense/20 text-expense text-sm
                hover:bg-expense/30 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
