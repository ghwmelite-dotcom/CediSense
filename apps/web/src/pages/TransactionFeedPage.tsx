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

  // Pagination — hasMore is true if last fetch returned a full page
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
      .catch(() => {/* non-fatal — UI degrades gracefully */});
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

    // The transactions endpoint returns { data: results, meta: {...} }.
    // Our api client unwraps ApiSuccess<T>.data, so we receive the `results` array
    // when T = Transaction[]. Meta is unavailable via this path; we infer hasMore
    // from whether the page was full.
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
      {/* Sticky header with search + filters */}
      <div className="sticky top-0 z-10 bg-ghana-dark/95 backdrop-blur border-b border-white/5 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">Transactions</h1>
          <button
            type="button"
            onClick={() => navigate('/transactions/import')}
            className="text-gold text-sm font-medium hover:text-gold/80 transition-colors"
          >
            Import
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none">
            🔍
          </span>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search transactions…"
            className="w-full bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-sm
              placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="shrink-0 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-xs
              focus:outline-none focus:ring-1 focus:ring-gold/50"
          >
            <option value="" className="bg-ghana-surface">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id} className="bg-ghana-surface">
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="shrink-0 bg-white/10 border border-white/10 rounded-lg px-3 py-2 text-white text-xs
              focus:outline-none focus:ring-1 focus:ring-gold/50"
          >
            <option value="" className="bg-ghana-surface">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-ghana-surface">
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
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-ghana-surface animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !initialLoading && (
          <div className="text-center py-12">
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setInitialLoading(true);
                setPage(1);
                setTransactions([]);
              }}
              className="text-gold text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!initialLoading && !error && transactions.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="text-5xl mb-4">📋</div>
            <h2 className="text-white text-lg font-semibold mb-2">No transactions yet</h2>
            <p className="text-muted text-sm mb-8">
              Add your first transaction manually or import from SMS or CSV.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="w-full py-3 rounded-xl bg-gold text-ghana-black font-semibold hover:bg-gold/90 transition-colors"
              >
                Add Manually
              </button>
              <button
                type="button"
                onClick={() => navigate('/transactions/import')}
                className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-colors"
              >
                Import SMS / CSV
              </button>
            </div>
          </div>
        )}

        {/* Date-grouped transaction list */}
        {!initialLoading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([dateLabel, items]) => (
              <section key={dateLabel}>
                <h2 className="text-muted text-xs font-medium uppercase tracking-wider mb-2 px-1">
                  {dateLabel}
                </h2>
                <div className="space-y-1">
                  {items.map((txn) => (
                    <div key={txn.id}>
                      {/* Two-tap delete confirmation banner */}
                      {deleteConfirm === txn.id && (
                        <div className="flex items-center justify-between px-4 py-2 bg-expense/10 border border-expense/20 rounded-xl mb-1">
                          <span className="text-expense text-sm">Delete this transaction?</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-muted text-xs px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(txn.id)}
                              disabled={actionLoading}
                              className="text-expense text-xs px-3 py-1 rounded-lg bg-expense/20 hover:bg-expense/30 disabled:opacity-50"
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
