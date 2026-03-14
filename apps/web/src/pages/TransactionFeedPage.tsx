import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Transaction, Category, Account } from '@cedisense/shared';
import { api } from '@/lib/api';
import { TransactionRow } from '@/components/transactions/TransactionRow';

const LIMIT = 20;

function groupByDate(transactions: Transaction[]): [string, Transaction[]][] {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const map = new Map<string, Transaction[]>();

  for (const txn of transactions) {
    const raw = txn.transaction_date.slice(0, 10);
    let label: string;
    if (raw === today) label = 'Today';
    else if (raw === yesterday) label = 'Yesterday';
    else {
      label = new Date(raw + 'T00:00:00').toLocaleDateString('en-GH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    const bucket = map.get(label) ?? [];
    bucket.push(txn);
    map.set(label, bucket);
  }

  return Array.from(map.entries());
}

export function TransactionFeedPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [accountFilter, setAccountFilter] = useState(searchParams.get('account_id') ?? '');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category_id') ?? '');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromFilter] = useState(searchParams.get('from') ?? '');
  const [toFilter] = useState(searchParams.get('to') ?? '');

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Intersection observer sentinel for infinite scroll
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Load categories and accounts once
  useEffect(() => {
    Promise.all([
      api.get<Category[]>('/categories'),
      api.get<Account[]>('/accounts'),
    ])
      .then(([cats, accs]) => {
        setCategories(cats);
        setAccounts(accs);
      })
      .catch(() => {/* non-fatal */});
  }, []);

  // Build query string
  const buildQuery = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      params.set('page', String(p));
      params.set('limit', String(LIMIT));
      if (accountFilter) params.set('account_id', accountFilter);
      if (categoryFilter) params.set('category_id', categoryFilter);
      if (search) params.set('search', search);
      if (fromFilter) params.set('from', fromFilter);
      if (toFilter) params.set('to', toFilter);
      return `/transactions?${params.toString()}`;
    },
    [accountFilter, categoryFilter, search, fromFilter, toFilter]
  );

  // Fetch first page whenever filters change
  useEffect(() => {
    setPage(1);
    setTransactions([]);
    setHasMore(true);
    setInitialLoading(true);
    setError(null);

    api
      .get<Transaction[]>(buildQuery(1))
      .then((items) => {
        setTransactions(items);
        setHasMore(items.length === LIMIT);
        setInitialLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message ?? 'Failed to load transactions');
        setInitialLoading(false);
      });
  }, [buildQuery]);

  // Load more pages
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const nextPage = page + 1;
    setLoading(true);

    api
      .get<Transaction[]>(buildQuery(nextPage))
      .then((items) => {
        setPage(nextPage);
        setTransactions((prev) => [...prev, ...items]);
        setHasMore(items.length === LIMIT);
      })
      .catch(() => {/* silently ignore */})
      .finally(() => setLoading(false));
  }, [loading, hasMore, page, buildQuery]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Delete handler — two-tap confirm
  async function handleDelete(id: string) {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      return;
    }
    setActionLoading(true);
    try {
      await api.delete(`/transactions/${id}`);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
      setDeleteConfirm(null);
    } catch {
      // User can retry
    } finally {
      setActionLoading(false);
    }
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="pb-24">
      {/* Sticky header — glassmorphism */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-ghana-dark/90 border-b border-white/8 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold tracking-tight">Transactions</h1>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                const params = new URLSearchParams();
                if (accountFilter) params.set('account_id', accountFilter);
                if (categoryFilter) params.set('category_id', categoryFilter);
                if (fromFilter) params.set('from', fromFilter);
                if (toFilter) params.set('to', toFilter);
                window.open(`/print/transactions?${params.toString()}`, '_blank');
              }}
              className="px-3 py-1.5 rounded-lg text-gold text-sm font-medium hover:bg-gold/10 transition-colors"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => navigate('/transactions/import')}
              className="px-3 py-1.5 rounded-lg text-gold text-sm font-medium hover:bg-gold/10 transition-colors"
            >
              Import
            </button>
          </div>
        </div>

        {/* Search input — icon inside, rounded-2xl */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search transactions…"
            className="w-full bg-white/8 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-white text-sm
              placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/60
              transition-all"
          />
        </div>

        {/* Filter chips — pill style */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className={`shrink-0 border rounded-full px-3.5 py-1.5 text-xs font-medium transition-all
              focus:outline-none focus:ring-1 focus:ring-gold/50
              ${accountFilter
                ? 'bg-gold/15 border-gold/40 text-gold'
                : 'bg-white/8 border-white/10 text-muted hover:text-white hover:border-white/20'
              }`}
          >
            <option value="" className="bg-ghana-surface text-white">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-ghana-surface text-white">
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`shrink-0 border rounded-full px-3.5 py-1.5 text-xs font-medium transition-all
              focus:outline-none focus:ring-1 focus:ring-gold/50
              ${categoryFilter
                ? 'bg-gold/15 border-gold/40 text-gold'
                : 'bg-white/8 border-white/10 text-muted hover:text-white hover:border-white/20'
              }`}
          >
            <option value="" className="bg-ghana-surface text-white">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-ghana-surface text-white">
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 pt-4">
        {/* Loading skeleton */}
        {initialLoading && (
          <div className="space-y-3 motion-safe:animate-fade-in">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-ghana-surface animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !initialLoading && (
          <div className="text-center py-12 motion-safe:animate-fade-in">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setInitialLoading(true);
                setPage(1);
                setTransactions([]);
              }}
              className="text-gold text-sm font-medium px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!initialLoading && !error && transactions.length === 0 && (
          <div className="text-center py-16 px-6 motion-safe:animate-slide-up">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gold/10 flex items-center justify-center">
                <span className="text-4xl" role="img" aria-label="No transactions">📋</span>
              </div>
              <div className="absolute inset-0 rounded-full bg-gold/5 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">No transactions yet</h2>
            <p className="text-muted text-sm mb-8 max-w-xs mx-auto">
              Add your first transaction manually or import from SMS or CSV.
            </p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="w-full py-3 rounded-xl bg-gold text-ghana-black font-semibold
                  hover:brightness-110 active:scale-[0.98] transition-all shadow-gold-glow"
              >
                Add Manually
              </button>
              <button
                type="button"
                onClick={() => navigate('/transactions/import')}
                className="w-full py-3 rounded-xl bg-white/8 border border-white/10 text-white
                  font-medium hover:bg-white/15 transition-colors"
              >
                Import SMS / CSV
              </button>
            </div>
          </div>
        )}

        {/* Date-grouped transaction list — staggered animations */}
        {!initialLoading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([dateLabel, items], groupIndex) => (
              <section
                key={dateLabel}
                className="motion-safe:animate-slide-up"
                style={{ animationDelay: `${groupIndex * 60}ms`, animationFillMode: 'both' }}
              >
                {/* Date group header with gold accent bar */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <div className="w-1 h-3.5 rounded-full bg-gold/60" />
                  <h2 className="text-muted text-xs font-semibold uppercase tracking-wider">
                    {dateLabel}
                  </h2>
                </div>

                <div className="bg-ghana-surface rounded-2xl border border-white/8 shadow-card overflow-hidden">
                  {items.map((txn, txnIndex) => (
                    <div
                      key={txn.id}
                      className={txnIndex < items.length - 1 ? 'border-b border-white/5' : ''}
                    >
                      {/* Two-tap delete confirmation banner */}
                      {deleteConfirm === txn.id && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-expense/10 border-b border-expense/20">
                          <span className="text-expense text-sm font-medium">Delete this transaction?</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-muted text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(txn.id)}
                              disabled={actionLoading}
                              className="text-expense text-xs px-3 py-1.5 rounded-lg bg-expense/20
                                hover:bg-expense/30 disabled:opacity-50 transition-colors"
                            >
                              {actionLoading ? '…' : 'Delete'}
                            </button>
                          </div>
                        </div>
                      )}
                      <TransactionRow
                        transaction={txn}
                        categories={categories}
                        onEdit={() => navigate(`/add?edit=${txn.id}`)}
                        onDelete={(id) => handleDelete(id)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-4" />

            {loading && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {!hasMore && transactions.length >= LIMIT && (
              <p className="text-center text-muted text-xs pb-4">
                All transactions loaded
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
