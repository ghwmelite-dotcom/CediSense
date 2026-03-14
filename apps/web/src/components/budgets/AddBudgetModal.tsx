import { useState } from 'react';
import type { Category } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface AddBudgetModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (categoryId: string, amount: number) => void;
  categories: Category[];
  existingCategoryIds: string[];
}

export function AddBudgetModal({
  open,
  onClose,
  onSave,
  categories,
  existingCategoryIds,
}: AddBudgetModalProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [amount, setAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const availableCategories = categories.filter(
    (c) => c.type === 'expense' && !existingCategoryIds.includes(c.id)
  );

  async function handleSave() {
    setError(null);

    if (!selectedCategoryId) {
      setError('Please select a category.');
      return;
    }
    if (amount <= 0) {
      setError('Please enter an amount greater than zero.');
      return;
    }

    setSaving(true);
    try {
      await onSave(selectedCategoryId, amount);
      // Reset state after successful save
      setSelectedCategoryId('');
      setAmount(0);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget.');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (saving) return;
    setSelectedCategoryId('');
    setAmount(0);
    setError(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-budget-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-ghana-dark border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-5 shadow-2xl">
        <h2 id="add-budget-modal-title" className="text-white text-lg font-bold">
          New Budget
        </h2>

        {/* Category select */}
        <div className="space-y-1.5">
          <label htmlFor="budget-category" className="block text-xs text-muted font-medium">
            Category
          </label>
          {availableCategories.length === 0 ? (
            <p className="text-sm text-muted py-2">
              All expense categories already have budgets.
            </p>
          ) : (
            <select
              id="budget-category"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              disabled={saving}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                disabled:opacity-50 disabled:cursor-not-allowed appearance-none"
            >
              <option value="" className="bg-ghana-dark text-muted">
                Select a category…
              </option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id} className="bg-ghana-dark text-white">
                  {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Amount input */}
        <div className="space-y-1.5">
          <label className="block text-xs text-muted font-medium">Monthly limit</label>
          <AmountInput
            valuePesewas={amount}
            onChange={setAmount}
            placeholder="0.00"
            disabled={saving}
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-expense text-xs font-medium" role="alert">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-white/10 text-muted font-semibold text-sm
              hover:bg-white/15 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || availableCategories.length === 0}
            className="flex-1 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
              hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
