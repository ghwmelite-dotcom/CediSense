import { useState, useEffect } from 'react';
import { AmountInput } from '@/components/transactions/AmountInput';

interface AddGoalModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, target: number, deadline?: string) => void;
}

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function AddGoalModal({ open, onClose, onSave }: AddGoalModalProps) {
  const [name, setName] = useState('');
  const [targetPesewas, setTargetPesewas] = useState(0);
  const [deadline, setDeadline] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setName('');
      setTargetPesewas(0);
      setDeadline('');
    }
  }, [open]);

  if (!open) return null;

  const isValid = name.trim().length > 0 && targetPesewas > 0;

  function handleSave() {
    if (!isValid) return;
    onSave(name.trim(), targetPesewas, deadline || undefined);
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center
        bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-md bg-ghana-dark rounded-xl p-6 space-y-5
          border border-white/10 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-bold">New Savings Goal</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Goal name */}
        <div className="space-y-1.5">
          <label className="text-muted text-xs font-medium uppercase tracking-wide">
            Goal Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Emergency fund, New laptop…"
            autoFocus
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
              text-white placeholder-muted focus:outline-none
              focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
        </div>

        {/* Target amount */}
        <div className="space-y-1.5">
          <label className="text-muted text-xs font-medium uppercase tracking-wide">
            Target Amount
          </label>
          <AmountInput
            valuePesewas={targetPesewas}
            onChange={setTargetPesewas}
            placeholder="0.00"
          />
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <label className="text-muted text-xs font-medium uppercase tracking-wide">
            Deadline{' '}
            <span className="normal-case text-muted/70">(optional)</span>
          </label>
          <input
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            min={getTodayString()}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
              text-white focus:outline-none focus:ring-2 focus:ring-gold/50
              focus:border-gold transition-colors [color-scheme:dark]"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 py-3 rounded-xl bg-gold text-ghana-black font-semibold
              disabled:opacity-40 hover:bg-gold/90 transition-colors active:scale-95"
          >
            Save Goal
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-white/10 text-muted font-medium
              hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
