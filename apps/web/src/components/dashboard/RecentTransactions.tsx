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
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className="relative w-14 h-14 mb-4 opacity-25">
        <svg viewBox="0 0 56 56" fill="none" className="w-full h-full">
          <rect x="8" y="6" width="40" height="44" rx="6" stroke="#5A5A72" strokeWidth="2" />
          <line x1="16" y1="18" x2="40" y2="18" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="26" x2="36" y2="26" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="34" x2="32" y2="34" stroke="#5A5A72" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-muted text-xs text-center">No transactions yet. Your activity will appear here.</p>
    </div>
  );
}

export function RecentTransactions({ transactions, categories }: RecentTransactionsProps) {
  const navigate = useNavigate();

  return (
    <div className="premium-card rounded-2xl p-4">
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
          {transactions.map((txn) => (
            <TransactionRow
              key={txn.id}
              transaction={toTransaction(txn)}
              categories={categories}
              compact
            />
          ))}
        </div>
      ) : (
        <TransactionsEmptyState />
      )}
    </div>
  );
}
