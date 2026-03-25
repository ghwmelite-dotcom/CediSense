import type { ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

function SkeletonRow({ colCount }: { colCount: number }) {
  return (
    <tr>
      {Array.from({ length: colCount }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 rounded bg-ghana-elevated/70 animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  onRowClick,
  emptyMessage = 'No data found.',
}: DataTableProps<T>) {
  const showSkeleton = isLoading && data.length === 0;
  const showEmpty = !isLoading && data.length === 0;

  return (
    <div className="bg-ghana-surface rounded-xl border border-white/5 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          {/* Header */}
          <thead>
            <tr className="bg-ghana-elevated/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-xs text-white/50 uppercase tracking-wider font-medium whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {showSkeleton
              ? Array.from({ length: 5 }).map((_, i) => (
                  <SkeletonRow key={i} colCount={columns.length} />
                ))
              : data.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(row)}
                    className={[
                      'border-b border-white/5 last:border-b-0 transition-colors',
                      onRowClick
                        ? 'cursor-pointer hover:bg-ghana-elevated/30'
                        : 'hover:bg-ghana-elevated/10',
                    ].join(' ')}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className="px-4 py-3 text-white/80 whitespace-nowrap">
                        {col.render
                          ? col.render(row)
                          : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* Empty state */}
      {showEmpty && (
        <div className="flex items-center justify-center py-12 text-white/30 text-sm">
          {emptyMessage}
        </div>
      )}

      {/* Load more */}
      {hasMore && !isLoading && (
        <div className="flex justify-center py-4 border-t border-white/5">
          <button
            onClick={onLoadMore}
            className="px-5 py-2 rounded-lg text-sm text-white/60 hover:text-white bg-ghana-elevated/50 hover:bg-ghana-elevated transition-colors"
          >
            Load more
          </button>
        </div>
      )}

      {/* Loading more indicator */}
      {isLoading && data.length > 0 && (
        <div className="flex justify-center py-4 border-t border-white/5">
          <span className="text-sm text-white/30 animate-pulse">Loading…</span>
        </div>
      )}
    </div>
  );
}
