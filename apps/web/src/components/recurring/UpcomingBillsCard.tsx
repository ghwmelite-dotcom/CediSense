import { Link } from 'react-router-dom';
import type { RecurringWithStatus } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface UpcomingBillsCardProps {
  items: RecurringWithStatus[];
}

function StatusBadge({ item }: { item: RecurringWithStatus }) {
  if (item.status === 'overdue') {
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-expense/20 text-expense shrink-0">
        Overdue
      </span>
    );
  }
  if (item.status === 'due_soon') {
    const label = item.days_until_due === 0 ? 'Due today' : `Due in ${item.days_until_due}d`;
    return (
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gold/20 text-gold shrink-0">
        {label}
      </span>
    );
  }
  // upcoming
  return (
    <span className="text-xs text-muted shrink-0">Upcoming</span>
  );
}

export function UpcomingBillsCard({ items }: UpcomingBillsCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-sm">Upcoming Bills</h3>
        <Link
          to="/recurring"
          className="text-xs text-gold hover:brightness-110 transition-all"
        >
          View all →
        </Link>
      </div>

      {/* Bill rows */}
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            {item.category_icon && (
              <span
                className="text-sm shrink-0"
                role="img"
                aria-label={item.category_name ?? 'Category'}
              >
                {item.category_icon}
              </span>
            )}
            <p className="text-white text-sm truncate flex-1">{item.counterparty}</p>
            <span className="text-white text-sm font-medium shrink-0">
              {formatPesewas(item.expected_amount_pesewas)}
            </span>
            <StatusBadge item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
