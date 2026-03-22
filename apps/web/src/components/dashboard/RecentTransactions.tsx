import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Category, Transaction } from '@cedisense/shared';
import type { DashboardRecentTransaction } from '@cedisense/shared';
import { TransactionRow } from '../transactions/TransactionRow';

interface RecentTransactionsProps {
  transactions: DashboardRecentTransaction[];
  categories: Category[];
}

function toTransaction(drt: DashboardRecentTransaction): Transaction {
  return {
    ...drt,
    user_id: '',
    raw_text: null,
    categorized_by: null,
    import_batch_id: null,
    updated_at: drt.created_at,
  };
}

function TransactionsEmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="relative w-16 h-16 mb-5 motion-safe:animate-float">
        <svg viewBox="0 0 64 64" fill="none" className="w-full h-full">
          <rect x="8" y="6" width="48" height="52" rx="8" stroke="#5A5A72" strokeWidth="1.5" opacity="0.4" />
          <line x1="18" y1="20" x2="46" y2="20" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />
          <line x1="18" y1="28" x2="42" y2="28" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" opacity="0.25" />
          <line x1="18" y1="36" x2="38" y2="36" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" opacity="0.2" />
          <line x1="18" y1="44" x2="34" y2="44" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" opacity="0.15" />
          <circle cx="46" cy="46" r="12" fill="#14142A" stroke="#D4A843" strokeWidth="1.5" opacity="0.35" />
          <path d="M46 40v12M40 46h12" stroke="#D4A843" strokeWidth="1.5" strokeLinecap="round" opacity="0.35" />
        </svg>
      </div>
      <h3 className="text-text-primary font-semibold text-sm mb-1">No activity yet</h3>
      <p className="text-muted text-xs text-center max-w-[220px] leading-relaxed mb-4">
        Your recent transactions will appear here as you start tracking.
      </p>
      <button
        type="button"
        onClick={() => navigate('/transactions/add')}
        className="text-xs font-medium px-5 py-2 rounded-xl bg-gold/[0.08] text-gold hover:bg-gold/[0.14] transition-colors duration-200"
      >
        Add a transaction
      </button>
    </div>
  );
}

export const RecentTransactions = memo(function RecentTransactions({ transactions, categories }: RecentTransactionsProps) {
  const navigate = useNavigate();

  return (
    <div className="premium-card rounded-2xl p-4 overflow-hidden">
      {/* Top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-gold to-gold/40" />
          <p className="text-xs text-muted uppercase tracking-widest font-semibold">Recent Transactions</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="text-gold/80 text-xs font-medium hover:text-gold transition-colors"
        >
          See all
          <svg className="inline-block w-3 h-3 ml-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
      {transactions.length > 0 ? (
        <div className="space-y-1">
          {transactions.map((txn, i) => (
            <div
              key={txn.id}
              className="motion-safe:animate-stagger-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <TransactionRow
                transaction={toTransaction(txn)}
                categories={categories}
                compact
              />
            </div>
          ))}
        </div>
      ) : (
        <TransactionsEmptyState />
      )}
    </div>
  );
});
