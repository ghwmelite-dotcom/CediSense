import { useState } from 'react';
import type { Transaction, Category } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

const SOURCE_LABELS: Record<string, string> = {
  sms_import: 'SMS',
  csv_import: 'CSV',
  manual: 'Manual',
};

const SOURCE_STYLES: Record<string, string> = {
  sms_import:
    'bg-ghana-green/15 text-ghana-green border border-ghana-green/25',
  csv_import:
    'bg-gold/10 text-gold border border-gold/20',
  manual:
    'bg-white/8 text-muted border border-white/10',
};

interface TransactionRowProps {
  transaction: Transaction;
  categories?: Category[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transactionId: string) => void;
  /** If true the row renders in a compact import-preview context */
  compact?: boolean;
}

export function TransactionRow({
  transaction,
  categories = [],
  onEdit,
  onDelete,
  compact = false,
}: TransactionRowProps) {
  const [expanded, setExpanded] = useState(false);

  const category = categories.find((c) => c.id === transaction.category_id);
  const isCredit = transaction.type === 'credit';
  const isTransfer = transaction.type === 'transfer';

  const amountColor = isCredit
    ? 'text-income'
    : isTransfer
    ? 'text-gold'
    : 'text-expense';

  const amountSign = isCredit ? '+' : isTransfer ? '' : '-';

  const label =
    transaction.description ||
    transaction.counterparty ||
    category?.name ||
    'Transaction';

  const sourceBadgeClass =
    SOURCE_STYLES[transaction.source] ?? 'bg-white/8 text-muted border border-white/10';

  function handleRowClick() {
    if (!compact) setExpanded((prev) => !prev);
  }

  return (
    <div className="rounded-xl overflow-hidden group">
      {/* Main row */}
      <button
        onClick={handleRowClick}
        className={`w-full flex items-center gap-3 px-4 py-3 bg-ghana-surface
          transition-all duration-200 text-left
          ${compact
            ? 'cursor-default'
            : 'cursor-pointer hover:bg-white/[0.06] hover:scale-[1.005] active:scale-100 active:bg-white/10'
          }`}
        aria-expanded={expanded}
        type="button"
      >
        {/* Category icon */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-full bg-white/10 flex items-center
            justify-center text-lg transition-transform duration-200 group-hover:scale-105"
        >
          {category?.icon ?? (isCredit ? '↓' : isTransfer ? '↔' : '↑')}
        </div>

        {/* Description + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate">{label}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {transaction.counterparty && transaction.description && (
              <span className="text-muted text-xs truncate">
                {transaction.counterparty}
              </span>
            )}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold tracking-wide shrink-0 ${sourceBadgeClass}`}
            >
              {SOURCE_LABELS[transaction.source] ?? transaction.source}
            </span>
          </div>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          <p className={`text-sm font-semibold tabular-nums ${amountColor}`}>
            {amountSign}
            {formatPesewas(transaction.amount_pesewas)}
          </p>
          {transaction.fee_pesewas > 0 && (
            <p className="text-muted text-[10px] tabular-nums">
              Fee {formatPesewas(transaction.fee_pesewas)}
            </p>
          )}
        </div>
      </button>

      {/* Expanded details — animate in */}
      {expanded && !compact && (
        <div className="px-4 pb-4 bg-ghana-surface border-t border-white/5 animate-slide-down">
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {transaction.counterparty && (
              <>
                <dt className="text-muted">Counterparty</dt>
                <dd className="text-white truncate">{transaction.counterparty}</dd>
              </>
            )}
            {transaction.reference && (
              <>
                <dt className="text-muted">Reference</dt>
                <dd className="text-white truncate font-mono text-xs">
                  {transaction.reference}
                </dd>
              </>
            )}
            <dt className="text-muted">Date</dt>
            <dd className="text-white tabular-nums">{transaction.transaction_date}</dd>
            <dt className="text-muted">Type</dt>
            <dd className={`font-medium capitalize ${amountColor}`}>
              {transaction.type}
            </dd>
            {category && (
              <>
                <dt className="text-muted">Category</dt>
                <dd className="text-white">
                  {category.icon} {category.name}
                </dd>
              </>
            )}
          </dl>

          {(onEdit || onDelete) && (
            <div className="flex gap-2 mt-4">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(transaction)}
                  className="flex-1 py-2 rounded-lg bg-white/10 text-white text-sm font-medium
                    hover:bg-white/20 active:scale-95 transition-all duration-200"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(transaction.id)}
                  className="flex-1 py-2 rounded-lg bg-expense/10 text-expense text-sm font-medium
                    hover:bg-expense/20 active:scale-95 transition-all duration-200"
                >
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
