import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Account, Category, TransactionType } from '@cedisense/shared';
import { api, ApiRequestError } from '@/lib/api';
import { AmountInput } from '@/components/transactions/AmountInput';
import { CategoryPicker } from '@/components/transactions/CategoryPicker';

const TYPE_OPTIONS: { value: TransactionType; label: string; icon: string; activeClass: string }[] = [
  { value: 'credit', label: 'Income', icon: '↑', activeClass: 'bg-income/[0.12] text-income border-income/25' },
  { value: 'debit', label: 'Expense', icon: '↓', activeClass: 'bg-expense/[0.12] text-expense border-expense/25' },
  { value: 'transfer', label: 'Transfer', icon: '⇄', activeClass: 'bg-gold/[0.12] text-gold border-gold/25' },
];

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AddTransactionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  // Form state
  const [type, setType] = useState<TransactionType>('debit');
  const [amountPesewas, setAmountPesewas] = useState(0);
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [date, setDate] = useState(todayISODate());

  // Reference data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRef, setLoadingRef] = useState(true);

  // Load accounts + categories
  useEffect(() => {
    Promise.all([
      api.get<Account[]>('/accounts'),
      api.get<Category[]>('/categories'),
    ])
      .then(([accs, cats]) => {
        setAccounts(accs);
        setCategories(cats);
        const primary = accs.find((a) => a.is_primary === 1);
        if (primary && !accountId) setAccountId(primary.id);
      })
      .finally(() => setLoadingRef(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!accountId) {
      setError('Please select an account.');
      return;
    }
    if (amountPesewas <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/transactions', {
        account_id: accountId,
        category_id: categoryId || undefined,
        type,
        amount_pesewas: amountPesewas,
        fee_pesewas: 0,
        description: description.trim() || undefined,
        counterparty: counterparty.trim() || undefined,
        source: 'manual',
        transaction_date: date,
      });
      navigate('/transactions');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Determine category filter based on transaction type
  const categoryTypeFilter =
    type === 'credit' ? 'income' : type === 'debit' ? 'expense' : 'transfer';

  return (
    <div className="p-4 md:p-6 pb-32 motion-safe:animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center
            text-white hover:bg-white/[0.07] transition-all min-h-[44px]"
          aria-label="Go back"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white text-xl font-bold font-display tracking-tight">
          {editId ? 'Edit Transaction' : 'Add Transaction'}
        </h1>
      </div>

      {loadingRef ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-2xl skeleton" />
          ))}
        </div>
      ) : (
        /* Premium card container */
        <div className="glass-card rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            {/* Transaction type toggle */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Type
              </label>
              <div className="flex gap-2 bg-black/20 rounded-2xl p-1.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setType(opt.value);
                      setCategoryId(null);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 min-h-[44px] ${
                      type === opt.value
                        ? `${opt.activeClass}`
                        : 'border-transparent text-muted hover:text-white'
                    }`}
                  >
                    <span className="mr-1 opacity-60">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Amount
              </label>
              <AmountInput
                valuePesewas={amountPesewas}
                onChange={setAmountPesewas}
                required
              />
            </div>

            {/* Account */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Account
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                required
                className="input-premium appearance-none"
              >
                <option value="" className="bg-ghana-surface text-muted">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} className="bg-ghana-surface text-white">
                    {a.name}
                    {a.is_primary === 1 ? ' (Primary)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Category
              </label>
              <CategoryPicker
                categories={categories}
                value={categoryId}
                onChange={setCategoryId}
                filterType={categoryTypeFilter}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                placeholder="What was this for?"
                className="input-premium"
              />
            </div>

            {/* Counterparty */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Counterparty{' '}
                <span className="normal-case font-normal text-muted/40">(optional)</span>
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                maxLength={200}
                placeholder="Person or business name"
                className="input-premium"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-muted/70 text-xs font-semibold uppercase tracking-wider mb-3">
                Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input-premium [color-scheme:dark]"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="px-4 py-3 rounded-xl bg-expense/[0.06] border border-expense/[0.08] text-expense/90 text-sm
                motion-safe:animate-slide-down flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-gold w-full py-4 text-base min-h-[52px]"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                'Save Transaction'
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
