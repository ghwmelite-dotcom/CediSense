import type { Category } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { CategoryPicker } from './CategoryPicker';

/** Mirrors the CategorizedTransaction shape returned by the import endpoints */
export interface CategorizedTransaction {
  type: 'credit' | 'debit' | 'transfer';
  amount_pesewas: number;
  fee_pesewas: number;
  description: string | null;
  raw_text: string;
  counterparty: string | null;
  reference: string | null;
  source: 'sms_import' | 'csv_import' | 'manual';
  transaction_date: string;
  category_id: string | null;
  categorized_by: string | null;
  account_id?: string;
}

export interface DuplicateEntry {
  transaction: CategorizedTransaction;
  existing: { id: string; transaction_date: string; amount_pesewas: number };
}

export interface ImportRowState {
  transaction: CategorizedTransaction;
  skip: boolean;
  /** Override category for this row */
  category_id: string | null;
  isDuplicate: boolean;
}

interface ImportPreviewProps {
  rows: ImportRowState[];
  duplicates: DuplicateEntry[];
  categories: Category[];
  onRowChange: (index: number, patch: Partial<ImportRowState>) => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function ImportPreview({
  rows,
  categories,
  onRowChange,
  onConfirm,
  loading = false,
}: ImportPreviewProps) {
  const importCount = rows.filter((r) => !r.skip).length;

  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted text-sm">
        No transactions parsed. Check your input and try again.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">
          {rows.length} transaction{rows.length !== 1 ? 's' : ''} found
        </span>
        <span className="text-gold font-medium">
          {importCount} will be imported
        </span>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {rows.map((row, idx) => {
          const isCredit = row.transaction.type === 'credit';
          const isTransfer = row.transaction.type === 'transfer';
          const amountColor = isCredit
            ? 'text-income'
            : isTransfer
            ? 'text-gold'
            : 'text-expense';
          const sign = isCredit ? '+' : isTransfer ? '' : '-';
          const label =
            row.transaction.description ||
            row.transaction.counterparty ||
            'Transaction';

          return (
            <div
              key={idx}
              className={`rounded-xl border transition-colors ${
                row.skip
                  ? 'border-white/5 opacity-40'
                  : row.isDuplicate
                  ? 'border-gold/30 bg-gold/5'
                  : 'border-white/10 bg-ghana-surface'
              }`}
            >
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Skip toggle */}
                <button
                  type="button"
                  onClick={() => onRowChange(idx, { skip: !row.skip })}
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    row.skip
                      ? 'border-muted bg-transparent'
                      : 'border-gold bg-gold'
                  }`}
                  aria-label={row.skip ? 'Include transaction' : 'Skip transaction'}
                >
                  {!row.skip && (
                    <svg
                      className="w-3 h-3 text-ghana-black"
                      viewBox="0 0 12 12"
                      fill="none"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{label}</p>
                  <p className="text-muted text-xs">{row.transaction.transaction_date}</p>
                </div>

                {/* Amount */}
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${amountColor}`}>
                    {sign}{formatPesewas(row.transaction.amount_pesewas)}
                  </p>
                  {row.transaction.fee_pesewas > 0 && (
                    <p className="text-muted text-[10px]">
                      Fee {formatPesewas(row.transaction.fee_pesewas)}
                    </p>
                  )}
                </div>
              </div>

              {/* Duplicate warning */}
              {row.isDuplicate && (
                <div className="mx-4 mb-2 px-3 py-1.5 rounded-lg bg-gold/10 text-gold text-xs">
                  Possible duplicate — review before importing
                </div>
              )}

              {/* Category picker (only when not skipped) */}
              {!row.skip && (
                <div className="px-4 pb-3">
                  <CategoryPicker
                    categories={categories}
                    value={row.category_id}
                    onChange={(id) => onRowChange(idx, { category_id: id })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirm button */}
      <button
        type="button"
        onClick={onConfirm}
        disabled={loading || importCount === 0}
        className="w-full py-4 rounded-xl bg-gold text-ghana-black font-semibold text-base
          hover:bg-gold/90 active:scale-[0.98] transition-all
          disabled:opacity-40 disabled:cursor-not-allowed mt-2"
      >
        {loading
          ? 'Importing…'
          : `Confirm Import (${importCount} transaction${importCount !== 1 ? 's' : ''})`}
      </button>
    </div>
  );
}
