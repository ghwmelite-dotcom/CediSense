import { useState, useEffect } from 'react';
import type { InvestmentType } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

export interface AddInvestmentModalSaveData {
  type: InvestmentType;
  name: string;
  institution: string;
  amount_pesewas: number;
  rate_percent: number | null;
  purchase_date: string;
  maturity_date: string | null;
  current_value_pesewas: number | null;
  notes: string;
}

interface AddInvestmentModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: AddInvestmentModalSaveData) => void;
}

const TYPE_OPTIONS: Array<{ value: InvestmentType; label: string }> = [
  { value: 'tbill', label: 'T-Bill (Treasury Bill)' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'fixed_deposit', label: 'Fixed Deposit' },
  { value: 'other', label: 'Other' },
];

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getInitialState(): AddInvestmentModalSaveData {
  return {
    type: 'tbill',
    name: '',
    institution: '',
    amount_pesewas: 0,
    rate_percent: null,
    purchase_date: getTodayString(),
    maturity_date: null,
    current_value_pesewas: null,
    notes: '',
  };
}

export function AddInvestmentModal({ open, onClose, onSave }: AddInvestmentModalProps) {
  const [form, setForm] = useState<AddInvestmentModalSaveData>(getInitialState);
  const [rateStr, setRateStr] = useState('');
  const [saving, setSaving] = useState(false);

  const showRate = form.type === 'tbill' || form.type === 'fixed_deposit';
  const showMaturity = form.type === 'tbill' || form.type === 'fixed_deposit';
  const showCurrentValue = form.type === 'mutual_fund';

  useEffect(() => {
    if (open) {
      setForm(getInitialState());
      setRateStr('');
    }
  }, [open]);

  if (!open) return null;

  const isValid =
    form.name.trim().length > 0 &&
    form.amount_pesewas > 0 &&
    form.purchase_date.length > 0;

  function set<K extends keyof AddInvestmentModalSaveData>(key: K, value: AddInvestmentModalSaveData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleRateChange(raw: string) {
    const sanitized = raw.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d*).*/, '$1');
    setRateStr(sanitized);
    const parsed = parseFloat(sanitized);
    set('rate_percent', isNaN(parsed) ? null : parsed);
  }

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        institution: form.institution.trim(),
        rate_percent: showRate ? form.rate_percent : null,
        maturity_date: showMaturity ? form.maturity_date : null,
        current_value_pesewas: showCurrentValue ? form.current_value_pesewas : null,
        notes: form.notes.trim(),
      });
    } finally {
      setSaving(false);
    }
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
        className="w-full max-w-md bg-ghana-dark rounded-xl border border-white/10 shadow-xl
          max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-bold">Add Investment</h2>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-white transition-colors text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Investment Type
            </label>
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value as InvestmentType)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold transition-colors [color-scheme:dark]"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Investment Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={100}
              placeholder="e.g. 91-Day T-Bill, Databank Brokerage…"
              autoFocus
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-muted focus:outline-none
                focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>

          {/* Institution */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Institution{' '}
              <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <input
              type="text"
              value={form.institution}
              onChange={(e) => set('institution', e.target.value)}
              maxLength={100}
              placeholder="e.g. Bank of Ghana, Databank…"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white placeholder-muted focus:outline-none
                focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>

          {/* Amount invested */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Amount Invested
            </label>
            <AmountInput
              valuePesewas={form.amount_pesewas}
              onChange={(v) => set('amount_pesewas', v)}
              placeholder="0.00"
            />
          </div>

          {/* Rate % — T-Bills and Fixed Deposits */}
          {showRate && (
            <div className="space-y-1.5">
              <label className="text-muted text-xs font-medium uppercase tracking-wide">
                Interest Rate %
              </label>
              <div
                className="flex items-center bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  focus-within:ring-2 focus-within:ring-gold/50 focus-within:border-gold"
              >
                <input
                  type="text"
                  inputMode="decimal"
                  value={rateStr}
                  onChange={(e) => handleRateChange(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent text-white text-lg font-semibold
                    placeholder-muted focus:outline-none"
                />
                <span className="text-muted text-sm ml-2">%</span>
              </div>
            </div>
          )}

          {/* Purchase date */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Purchase Date
            </label>
            <input
              type="date"
              value={form.purchase_date}
              onChange={(e) => set('purchase_date', e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold transition-colors [color-scheme:dark]"
            />
          </div>

          {/* Maturity date — T-Bills and Fixed Deposits */}
          {showMaturity && (
            <div className="space-y-1.5">
              <label className="text-muted text-xs font-medium uppercase tracking-wide">
                Maturity Date{' '}
                <span className="normal-case text-muted/70">(optional)</span>
              </label>
              <input
                type="date"
                value={form.maturity_date ?? ''}
                onChange={(e) => set('maturity_date', e.target.value || null)}
                min={form.purchase_date}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white focus:outline-none focus:ring-2 focus:ring-gold/50
                  focus:border-gold transition-colors [color-scheme:dark]"
              />
            </div>
          )}

          {/* Current value — Mutual Funds */}
          {showCurrentValue && (
            <div className="space-y-1.5">
              <label className="text-muted text-xs font-medium uppercase tracking-wide">
                Current Value{' '}
                <span className="normal-case text-muted/70">(optional)</span>
              </label>
              <AmountInput
                valuePesewas={form.current_value_pesewas ?? 0}
                onChange={(v) => set('current_value_pesewas', v > 0 ? v : null)}
                placeholder="0.00"
              />
            </div>
          )}

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Notes{' '}
              <span className="normal-case text-muted/70">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm placeholder-muted resize-none
                focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isValid || saving}
              className="flex-1 py-3 rounded-xl bg-gold text-ghana-dark font-semibold
                disabled:opacity-40 hover:brightness-110 transition-all active:scale-95"
            >
              {saving ? 'Saving…' : 'Add Investment'}
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
    </div>
  );
}
