import { useState, useEffect } from 'react';
import type { IOUDirection } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface AddIOUModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    person_name: string;
    amount_pesewas: number;
    direction: IOUDirection;
    description?: string;
  }) => void;
  existingNames: string[];
}

export function AddIOUModal({ open, onClose, onSave, existingNames }: AddIOUModalProps) {
  const [personName, setPersonName] = useState('');
  const [amountPesewas, setAmountPesewas] = useState(0);
  const [direction, setDirection] = useState<IOUDirection>('owed_to_me');
  const [description, setDescription] = useState('');

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setPersonName('');
      setAmountPesewas(0);
      setDirection('owed_to_me');
      setDescription('');
    }
  }, [open]);

  if (!open) return null;

  const isValid = personName.trim().length > 0 && amountPesewas > 0;

  function handleSave() {
    if (!isValid) return;
    onSave({
      person_name: personName.trim(),
      amount_pesewas: amountPesewas,
      direction,
      description: description.trim() || undefined,
    });
  }

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  const datalistId = 'iou-person-names';

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-bold">New IOU</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-white transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Person name */}
        <div className="space-y-1.5">
          <label
            htmlFor="iou-person-name"
            className="text-muted text-xs font-medium uppercase tracking-wide"
          >
            Person
          </label>
          <input
            id="iou-person-name"
            type="text"
            list={datalistId}
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            maxLength={100}
            placeholder="e.g. Kwame, Ama…"
            autoFocus
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
              text-white placeholder-muted focus:outline-none
              focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
          <datalist id={datalistId}>
            {existingNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <label
            htmlFor="iou-amount"
            className="text-muted text-xs font-medium uppercase tracking-wide"
          >
            Amount
          </label>
          <AmountInput
            id="iou-amount"
            valuePesewas={amountPesewas}
            onChange={setAmountPesewas}
            placeholder="0.00"
          />
        </div>

        {/* Direction toggle */}
        <div className="space-y-1.5">
          <p className="text-muted text-xs font-medium uppercase tracking-wide">Direction</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('owed_to_me')}
              className={`py-3 rounded-xl font-semibold text-sm transition-all active:scale-95
                ${direction === 'owed_to_me'
                  ? 'bg-income/20 border border-income/50 text-income'
                  : 'bg-white/10 border border-white/10 text-muted hover:bg-white/15'
                }`}
            >
              They owe me
            </button>
            <button
              type="button"
              onClick={() => setDirection('i_owe')}
              className={`py-3 rounded-xl font-semibold text-sm transition-all active:scale-95
                ${direction === 'i_owe'
                  ? 'bg-expense/20 border border-expense/50 text-expense'
                  : 'bg-white/10 border border-white/10 text-muted hover:bg-white/15'
                }`}
            >
              I owe them
            </button>
          </div>
        </div>

        {/* Description (optional) */}
        <div className="space-y-1.5">
          <label
            htmlFor="iou-description"
            className="text-muted text-xs font-medium uppercase tracking-wide"
          >
            Note{' '}
            <span className="normal-case text-muted/70">(optional)</span>
          </label>
          <input
            id="iou-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={200}
            placeholder="e.g. Dinner at Accra Mall, taxi split…"
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
              text-white placeholder-muted focus:outline-none
              focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 py-3 rounded-xl bg-gold text-ghana-dark font-semibold
              disabled:opacity-40 hover:brightness-110 transition-all active:scale-95"
          >
            Save IOU
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-xl bg-white/10 text-muted font-medium
              hover:bg-white/20 transition-colors active:scale-95"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
