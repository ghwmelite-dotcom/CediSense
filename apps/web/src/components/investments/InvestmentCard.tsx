import { useState, memo } from 'react';
import type { InvestmentWithReturns, InvestmentType } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { AmountInput } from '@/components/transactions/AmountInput';

interface InvestmentCardProps {
  investment: InvestmentWithReturns;
  onUpdate: (id: string, data: Partial<{ current_value_pesewas: number; notes: string }>) => void;
  onMature: (id: string) => void;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<InvestmentType, string> = {
  tbill: 'T-Bill',
  mutual_fund: 'Mutual Fund',
  fixed_deposit: 'Fixed Deposit',
  other: 'Other',
};

const TYPE_BADGE: Record<InvestmentType, string> = {
  tbill: 'bg-gold/20 text-gold border-gold/30',
  mutual_fund: 'bg-income/20 text-income border-income/30',
  fixed_deposit: 'bg-[#FF6B35]/20 text-[#FF6B35] border-[#FF6B35]/30',
  other: 'bg-white/10 text-muted border-white/20',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export const InvestmentCard = memo(function InvestmentCard({ investment, onUpdate, onMature, onDelete }: InvestmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editValue, setEditValue] = useState(investment.current_value_pesewas ?? 0);
  const [editNotes, setEditNotes] = useState(investment.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const returnPesewas =
    investment.current_value_computed_pesewas - investment.amount_pesewas;
  const returnsPositive = returnPesewas >= 0;
  const approachingMaturity =
    !investment.is_matured &&
    investment.days_to_maturity !== null &&
    investment.days_to_maturity <= 30 &&
    investment.days_to_maturity >= 0;

  async function handleSave() {
    setSaving(true);
    try {
      await onUpdate(investment.id, {
        current_value_pesewas: editValue > 0 ? editValue : undefined,
        notes: editNotes.trim() || undefined,
      });
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleMature() {
    await onMature(investment.id);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await onDelete(investment.id);
  }

  return (
    <div
      className={`bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3 transition-opacity ${
        investment.is_matured ? 'opacity-70' : ''
      }`}
    >
      {/* Row 1: name + type badge + institution */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-semibold text-base leading-tight truncate">
              {investment.name}
            </h3>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                border ${TYPE_BADGE[investment.type]}`}
            >
              {TYPE_LABELS[investment.type]}
            </span>
            {investment.is_matured && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium
                  bg-income/20 text-income border border-income/30"
              >
                Matured
              </span>
            )}
          </div>
          {investment.institution && (
            <p className="text-muted text-xs mt-0.5 truncate">{investment.institution}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-muted hover:text-white transition-colors text-sm ml-2 shrink-0 mt-0.5"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse details' : 'Expand details'}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Row 2: amounts */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-muted text-xs uppercase tracking-wide mb-0.5">Invested</p>
          <p className="text-white font-semibold text-sm">
            {formatPesewas(investment.amount_pesewas)}
          </p>
        </div>
        <div>
          <p className="text-muted text-xs uppercase tracking-wide mb-0.5">Current Value</p>
          <p className="text-white font-semibold text-sm">
            {formatPesewas(investment.current_value_computed_pesewas)}
          </p>
        </div>
        <div>
          <p className="text-muted text-xs uppercase tracking-wide mb-0.5">Return</p>
          <p
            className={`font-semibold text-sm ${
              returnsPositive ? 'text-income' : 'text-expense'
            }`}
          >
            {returnsPositive ? '+' : ''}
            {formatPesewas(returnPesewas)}
          </p>
        </div>
      </div>

      {/* Row 3: rate + purchase date + maturity */}
      <div className="flex items-center gap-4 text-xs text-muted flex-wrap">
        {investment.rate_percent !== null && (
          <span>
            <span className="text-white/60">Rate:</span>{' '}
            <span className="text-white font-medium">{investment.rate_percent}%</span>
          </span>
        )}
        <span>
          <span className="text-white/60">Purchased:</span>{' '}
          <span className="text-white/80">{formatDate(investment.purchase_date)}</span>
        </span>
        {investment.maturity_date && (
          <span>
            <span className="text-white/60">Matures:</span>{' '}
            <span className="text-white/80">{formatDate(investment.maturity_date)}</span>
            {investment.days_to_maturity !== null && !investment.is_matured && (
              <span
                className={`ml-1 font-medium ${
                  approachingMaturity ? 'text-gold' : 'text-white/60'
                }`}
              >
                ({investment.days_to_maturity}d)
              </span>
            )}
          </span>
        )}
      </div>

      {/* Mature action button (approaching maturity) */}
      {approachingMaturity && !investment.is_matured && (
        <button
          type="button"
          onClick={handleMature}
          className="w-full py-2 rounded-xl bg-gold/20 border border-gold/40 text-gold
            text-sm font-semibold hover:bg-gold/30 transition-colors active:scale-95"
        >
          Mark as Matured
        </button>
      )}

      {/* Expandable section */}
      {expanded && (
        <div className="space-y-3 pt-3 border-t border-white/10">
          {/* Update current value (for mutual funds or any investment) */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Update Current Value
            </label>
            <AmountInput
              valuePesewas={editValue}
              onChange={setEditValue}
              placeholder="0.00"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-muted text-xs font-medium uppercase tracking-wide">
              Notes
            </label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes…"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                text-white text-sm placeholder-muted resize-none
                focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
                disabled:opacity-40 hover:brightness-110 transition-all active:scale-95"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="px-4 py-2.5 rounded-xl bg-white/10 text-muted text-sm font-medium
                hover:bg-white/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                confirmDelete
                  ? 'bg-expense text-white hover:bg-expense/90'
                  : 'bg-expense/10 text-expense hover:bg-expense/20'
              }`}
            >
              {confirmDelete ? 'Confirm' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
