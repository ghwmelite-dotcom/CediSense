import { Link } from 'react-router-dom';
import type { RecurringWithStatus } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface UpcomingBillsCardProps {
  items: RecurringWithStatus[];
}

function StatusBadge({ item }: { item: RecurringWithStatus }) {
  if (item.status === 'overdue') {
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
          bg-gradient-to-r from-expense/20 to-expense/10
          text-expense border border-expense/25
          motion-safe:animate-red-pulse"
      >
        Overdue
      </span>
    );
  }
  if (item.status === 'due_soon') {
    const label = item.days_until_due === 0 ? 'Due today' : `Due in ${item.days_until_due}d`;
    return (
      <span
        className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0
          bg-gradient-to-r from-gold/20 to-gold/10
          text-gold border border-gold/25
          motion-safe:animate-gold-pulse"
      >
        {label}
      </span>
    );
  }
  return (
    <span className="text-xs text-muted shrink-0">Upcoming</span>
  );
}

export function UpcomingBillsCard({ items }: UpcomingBillsCardProps) {
  if (items.length === 0) return null;

  return (
    <div className="premium-card rounded-2xl p-4 overflow-hidden">
      {/* Top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-gradient-to-b from-gold to-gold/40" />
          <h3 className="text-xs text-muted uppercase tracking-widest font-semibold">Upcoming Bills</h3>
        </div>
        <Link
          to="/recurring"
          className="text-xs text-gold/80 font-medium hover:text-gold transition-colors duration-200"
        >
          View all
          <svg className="inline-block w-3 h-3 ml-1 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </Link>
      </div>

      {/* Bill rows */}
      <div className="space-y-1">
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-2 py-2 rounded-lg
              hover:bg-white/[0.04] transition-all duration-200 -mx-2
              motion-safe:animate-stagger-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
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
            <span className="text-white text-sm font-medium shrink-0 tabular-nums">
              {formatPesewas(item.expected_amount_pesewas)}
            </span>
            <StatusBadge item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
