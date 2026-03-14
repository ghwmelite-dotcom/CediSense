import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Account, Category, TransactionType } from '@cedisense/shared';
import { api, ApiRequestError } from '@/lib/api';
import { AmountInput } from '@/components/transactions/AmountInput';
import { CategoryPicker } from '@/components/transactions/CategoryPicker';

const TYPE_OPTIONS: { value: TransactionType; label: string; color: string }[] = [
  { value: 'credit', label: 'Income', color: 'text-income' },
  { value: 'debit', label: 'Expense', color: 'text-expense' },
  { value: 'transfer', label: 'Transfer', color: 'text-gold' },
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
        // Pre-select primary account
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
    <div className="p-4 md:p-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Go back"
        >
          ←
        </button>
        <h1 className="text-white text-xl font-bold">
          {editId ? 'Edit Transaction' : 'Add Transaction'}
        </h1>
      </div>

      {loadingRef ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-ghana-surface animate-pulse" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Type segmented control */}
          <div>
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
              Type
            </label>
            <div className="flex gap-1 bg-white/5 rounded-xl p-1">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setType(opt.value);
                    setCategoryId(null);
                  }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    type === opt.value
                      ? `bg-ghana-surface ${opt.color} shadow-sm`
                      : 'text-muted hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
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
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
              Account
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold appearance-none"
            >
              <option value="" className="bg-ghana-surface text-muted">Select account…</option>
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
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
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
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder="What was this for?"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            />
          </div>

          {/* Counterparty */}
          <div>
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
              Counterparty{' '}
              <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={counterparty}
              onChange={(e) => setCounterparty(e.target.value)}
              maxLength={200}
              placeholder="Person or business name"
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-muted text-xs font-medium uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
                focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                [color-scheme:dark]"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-expense/10 border border-expense/20 text-expense text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-gold text-ghana-black font-semibold text-base
              hover:bg-gold/90 active:scale-[0.98] transition-all
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Save Transaction'}
          </button>
        </form>
      )}
    </div>
  );
}
