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

export function RecentTransactions({ transactions, categories }: RecentTransactionsProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted uppercase tracking-wide">Recent Transactions</p>
        <button
          type="button"
          onClick={() => navigate('/transactions')}
          className="text-gold text-sm font-medium hover:text-gold/80 transition-colors"
        >
          See all →
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
        <div className="text-center py-6">
          <p className="text-muted text-sm">No transactions yet</p>
        </div>
      )}
    </div>
  );
}
