import { useState } from 'react';
import type { SusuFrequency } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface CreateGroupData {
  name: string;
  contribution_pesewas: number;
  frequency: SusuFrequency;
  max_members: number;
}

interface CreateGroupModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: CreateGroupData) => void;
}

export function CreateGroupModal({ open, onClose, onSave }: CreateGroupModalProps) {
  const [name, setName] = useState('');
  const [contributionPesewas, setContributionPesewas] = useState(0);
  const [frequency, setFrequency] = useState<SusuFrequency>('monthly');
  const [maxMembers, setMaxMembers] = useState(12);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || contributionPesewas <= 0) return;
    onSave({
      name: name.trim(),
      contribution_pesewas: contributionPesewas,
      frequency,
      max_members: maxMembers,
    });
    // Reset form
    setName('');
    setContributionPesewas(0);
    setFrequency('monthly');
    setMaxMembers(12);
  }

  function handleClose() {
    setName('');
    setContributionPesewas(0);
    setFrequency('monthly');
    setMaxMembers(12);
    onClose();
  }

  const clampMembers = (val: number) => Math.min(50, Math.max(2, val));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-group-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-md bg-ghana-dark border border-white/10 rounded-2xl
        shadow-2xl shadow-black/40 p-6 space-y-5">
        <h2 id="create-group-title" className="text-white text-lg font-bold">
          Create Susu Group
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Group name */}
          <div className="space-y-1.5">
            <label htmlFor="group-name" className="text-muted text-sm font-medium">
              Group Name
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Friday Market Susu"
              required
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold"
            />
          </div>

          {/* Contribution amount */}
          <div className="space-y-1.5">
            <label className="text-muted text-sm font-medium">
              Contribution Amount
            </label>
            <AmountInput
              valuePesewas={contributionPesewas}
              onChange={setContributionPesewas}
              placeholder="0.00"
              required
            />
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <label htmlFor="group-frequency" className="text-muted text-sm font-medium">
              Frequency
            </label>
            <select
              id="group-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as SusuFrequency)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                appearance-none cursor-pointer"
            >
              <option value="daily" className="bg-ghana-dark">Daily</option>
              <option value="weekly" className="bg-ghana-dark">Weekly</option>
              <option value="monthly" className="bg-ghana-dark">Monthly</option>
            </select>
          </div>

          {/* Max members */}
          <div className="space-y-1.5">
            <label htmlFor="group-max-members" className="text-muted text-sm font-medium">
              Max Members
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMaxMembers((v) => clampMembers(v - 1))}
                className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white
                  font-bold text-lg hover:bg-white/20 active:scale-95 transition-all
                  flex items-center justify-center shrink-0"
                aria-label="Decrease max members"
              >
                −
              </button>
              <input
                id="group-max-members"
                type="number"
                min={2}
                max={50}
                value={maxMembers}
                onChange={(e) => setMaxMembers(clampMembers(parseInt(e.target.value, 10) || 2))}
                className="flex-1 bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white text-sm text-center font-semibold focus:outline-none
                  focus:ring-2 focus:ring-gold/50 focus:border-gold"
              />
              <button
                type="button"
                onClick={() => setMaxMembers((v) => clampMembers(v + 1))}
                className="w-10 h-10 rounded-lg bg-white/10 border border-white/10 text-white
                  font-bold text-lg hover:bg-white/20 active:scale-95 transition-all
                  flex items-center justify-center shrink-0"
                aria-label="Increase max members"
              >
                +
              </button>
            </div>
            <p className="text-muted text-xs px-1">Between 2 and 50 members</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white font-semibold
                text-sm hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || contributionPesewas <= 0}
              className="flex-1 px-4 py-3 rounded-xl bg-gold text-ghana-dark font-semibold
                text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Create Group
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
