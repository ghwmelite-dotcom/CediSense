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

/** Unique empty state for Transactions page */
function TransactionsEmptyState({ onAdd, onImport }: { onAdd: () => void; onImport: () => void }) {
  return (
    <div className="text-center py-20 px-6 motion-safe:animate-slide-up">
      {/* Unique illustration: receipt/list */}
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="relative w-24 h-28">
          {/* Main receipt shape */}
          <svg viewBox="0 0 96 112" fill="none" className="w-full h-full motion-safe:animate-float">
            {/* Receipt body */}
            <rect x="16" y="8" width="64" height="88" rx="8" fill="#171727" stroke="#D4A843" strokeWidth="1" strokeOpacity="0.2" />
            {/* Zigzag bottom */}
            <path d="M16 96 L24 88 L32 96 L40 88 L48 96 L56 88 L64 96 L72 88 L80 96" stroke="#D4A843" strokeWidth="1" strokeOpacity="0.15" fill="none" />
            {/* Lines representing text */}
            <line x1="28" y1="28" x2="68" y2="28" stroke="#8B8BA3" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
            <line x1="28" y1="40" x2="60" y2="40" stroke="#8B8BA3" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.2" />
            <line x1="28" y1="52" x2="64" y2="52" stroke="#8B8BA3" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.3" />
            <line x1="28" y1="64" x2="52" y2="64" stroke="#8B8BA3" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.2" />
            {/* Gold cedi symbol */}
            <text x="48" y="82" textAnchor="middle" fill="#D4A843" fontSize="14" fontWeight="bold" opacity="0.4">₵</text>
          </svg>
          {/* Ambient glow */}
          <div className="absolute inset-0 bg-gold/[0.04] blur-2xl rounded-full scale-150" />
        </div>
      </div>
      <h2 className="text-text-primary text-lg font-semibold mb-2">Your financial journey begins</h2>
      <p className="text-muted text-sm mb-8 max-w-xs mx-auto leading-relaxed">
        Every great financial story starts with a single entry. Record your first transaction or import from SMS.
      </p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          type="button"
          onClick={onAdd}
          className="btn-gold w-full py-3 text-sm"
        >
          Add Manually
        </button>
        <button
          type="button"
          onClick={onImport}
          className="w-full py-3 rounded-xl bg-white/[0.03] border border-[#1F1F35]/60 text-text-primary
            font-medium text-sm hover:bg-white/[0.05] transition-all min-h-[44px]"
        >
          Import SMS / CSV
        </button>
      </div>
    </div>
  );
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

  // Delete handler -- two-tap confirm
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
      {/* Sticky header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-ghana-dark/95 border-b border-[#1F1F35]/40 px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-text-primary text-xl font-bold font-display tracking-tight">Transactions</h1>
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
              className="px-3.5 py-2 rounded-xl text-[#FF6B35]/70 text-sm font-medium hover:bg-white/[0.03] hover:text-[#FF6B35] transition-all min-h-[44px]"
            >
              Export
            </button>
            <button
              type="button"
              onClick={() => navigate('/transactions/import')}
              className="px-3.5 py-2 rounded-xl text-[#FF6B35]/70 text-sm font-medium hover:bg-white/[0.03] hover:text-[#FF6B35] transition-all min-h-[44px]"
            >
              Import
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-dim pointer-events-none"
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
            placeholder="Search transactions..."
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-text-primary text-sm
              placeholder-muted-dim/60 border border-[#1F1F35]/60
              bg-[#13132260]
              focus:outline-none focus:border-[#FF6B35]/30 focus:bg-ghana-surface
              focus:shadow-[0_0_0_3px_rgba(255,107,53,0.08)]
              transition-all duration-200"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all
              focus:outline-none focus:ring-1 focus:ring-[rgba(255,107,53,0.5)]
              ${accountFilter
                ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/25 text-[#FF6B35]'
                : 'bg-white/[0.03] border border-[#1F1F35]/60 text-muted hover:text-text-primary hover:border-[#1F1F35]'
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
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all
              focus:outline-none focus:ring-1 focus:ring-[rgba(255,107,53,0.5)]
              ${categoryFilter
                ? 'bg-[#FF6B35]/10 border border-[#FF6B35]/25 text-[#FF6B35]'
                : 'bg-white/[0.03] border border-[#1F1F35]/60 text-muted hover:text-text-primary hover:border-[#1F1F35]'
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
              <div key={i} className="h-16 rounded-2xl skeleton" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !initialLoading && (
          <div className="text-center py-16 motion-safe:animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-expense/[0.06] flex items-center justify-center">
              <svg className="w-7 h-7 text-expense/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-muted text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setInitialLoading(true);
                setPage(1);
                setTransactions([]);
              }}
              className="text-gold text-sm font-medium px-5 py-2.5 rounded-xl bg-gold/[0.06] hover:bg-gold/[0.1] transition-colors min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!initialLoading && !error && transactions.length === 0 && (
          <TransactionsEmptyState
            onAdd={() => navigate('/add')}
            onImport={() => navigate('/transactions/import')}
          />
        )}

        {/* Date-grouped transaction list */}
        {!initialLoading && !error && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map(([dateLabel, items], groupIndex) => (
              <section
                key={dateLabel}
                className="motion-safe:animate-slide-up"
                style={{ animationDelay: `${groupIndex * 60}ms`, animationFillMode: 'both' }}
              >
                {/* Date group header */}
                <div className="flex items-center gap-2.5 mb-2 px-1">
                  <div className="w-0.5 h-3 rounded-full bg-[#FF6B35]/40" />
                  <h2 className="text-muted-dim text-xs font-semibold uppercase tracking-wider">
                    {dateLabel}
                  </h2>
                </div>

                <div className="premium-card rounded-2xl overflow-hidden">
                  {items.map((txn, txnIndex) => (
                    <div
                      key={txn.id}
                      className={txnIndex < items.length - 1 ? 'border-b border-[#1F1F35]/40' : ''}
                    >
                      {/* Two-tap delete confirmation banner */}
                      {deleteConfirm === txn.id && (
                        <div className="flex items-center justify-between px-4 py-2.5 bg-expense/[0.06] border-b border-expense/[0.08]">
                          <span className="text-expense text-sm font-medium">Delete this transaction?</span>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(null)}
                              className="text-muted text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] transition-colors min-h-[32px]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(txn.id)}
                              disabled={actionLoading}
                              className="text-expense text-xs px-3 py-1.5 rounded-lg bg-expense/[0.1]
                                hover:bg-expense/[0.15] disabled:opacity-50 transition-colors min-h-[32px]"
                            >
                              {actionLoading ? '...' : 'Delete'}
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
                <div className="w-5 h-5 border-2 border-[#FF6B35]/40 border-t-[#FF6B35] rounded-full animate-spin" />
              </div>
            )}

            {!hasMore && transactions.length >= LIMIT && (
              <p className="text-center text-muted-dim/50 text-xs pb-4">
                All transactions loaded
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
