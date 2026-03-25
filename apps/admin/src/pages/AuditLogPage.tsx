import { useState, useEffect, useCallback } from 'react';
import { DataTable } from '@/components/shared/DataTable';
import type { Column } from '@/components/shared/DataTable';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

type ActionType =
  | 'user_deactivated'
  | 'user_reactivated'
  | 'pin_reset'
  | 'role_changed'
  | 'group_deactivated'
  | 'group_reactivated'
  | 'member_removed'
  | 'message_deleted';

type TargetType = 'user' | 'group' | 'member' | 'message';

interface AuditLogItem {
  id: string;
  created_at: string;
  admin_name: string;
  action: ActionType;
  target_type: TargetType;
  target_id: string;
  details: Record<string, unknown> | null;
  [key: string]: unknown;
}

interface AuditLogResponse {
  items: AuditLogItem[];
  cursor: string | null;
  has_more: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Actions' },
  { value: 'user_deactivated', label: 'user_deactivated' },
  { value: 'user_reactivated', label: 'user_reactivated' },
  { value: 'pin_reset', label: 'pin_reset' },
  { value: 'role_changed', label: 'role_changed' },
  { value: 'group_deactivated', label: 'group_deactivated' },
  { value: 'group_reactivated', label: 'group_reactivated' },
  { value: 'member_removed', label: 'member_removed' },
  { value: 'message_deleted', label: 'message_deleted' },
];

const TARGET_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'user', label: 'user' },
  { value: 'group', label: 'group' },
  { value: 'member', label: 'member' },
  { value: 'message', label: 'message' },
];

// ── Badge helpers ──────────────────────────────────────────────────────────

function actionBadgeClass(action: ActionType): string {
  if (
    action === 'user_deactivated' ||
    action === 'group_deactivated' ||
    action === 'member_removed' ||
    action === 'message_deleted'
  ) {
    return 'bg-expense/15 text-expense border border-expense/25';
  }
  if (action === 'user_reactivated' || action === 'group_reactivated') {
    return 'bg-income/15 text-income border border-income/25';
  }
  if (action === 'role_changed') {
    return 'bg-gold/15 text-gold border border-gold/25';
  }
  if (action === 'pin_reset') {
    return 'bg-info/15 text-info border border-info/25';
  }
  return 'bg-white/10 text-white/60 border border-white/15';
}

// ── Formatters ─────────────────────────────────────────────────────────────

function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return { date, time };
}

function truncateDetails(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const str = JSON.stringify(details);
  return str.length > 50 ? str.slice(0, 50) + '…' : str;
}

// ── Columns ────────────────────────────────────────────────────────────────

const COLUMNS: Column<AuditLogItem>[] = [
  {
    key: 'created_at',
    header: 'Timestamp',
    render: (row) => {
      const { date, time } = formatDateTime(row.created_at);
      return (
        <div className="flex flex-col leading-tight">
          <span className="text-white/80 text-xs font-medium">{date}</span>
          <span className="text-white/40 text-xs">{time}</span>
        </div>
      );
    },
  },
  {
    key: 'admin_name',
    header: 'Admin',
    render: (row) => (
      <span className="text-white/80 text-sm font-medium">{row.admin_name}</span>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    render: (row) => (
      <span
        className={[
          'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide',
          actionBadgeClass(row.action),
        ].join(' ')}
      >
        {row.action}
      </span>
    ),
  },
  {
    key: 'target_type',
    header: 'Target Type',
    render: (row) => (
      <span className="text-white/60 text-sm capitalize">{row.target_type}</span>
    ),
  },
  {
    key: 'target_id',
    header: 'Target ID',
    render: (row) => (
      <span className="text-muted font-mono text-xs">{row.target_id}</span>
    ),
  },
  {
    key: 'details',
    header: 'Details',
    render: (row) => (
      <span
        className="text-white/40 text-xs font-mono max-w-[200px] truncate block"
        title={row.details ? JSON.stringify(row.details) : undefined}
      >
        {truncateDetails(row.details)}
      </span>
    ),
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export function AuditLogPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [actionFilter, setActionFilter] = useState('');
  const [targetFilter, setTargetFilter] = useState('');

  // Build query string
  function buildQuery(nextCursor?: string | null): string {
    const params = new URLSearchParams({ limit: '20' });
    if (actionFilter) params.set('action', actionFilter);
    if (targetFilter) params.set('target_type', targetFilter);
    if (nextCursor) params.set('cursor', nextCursor);
    return `/admin/audit-log?${params.toString()}`;
  }

  const fetchInitial = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<AuditLogResponse>(buildQuery());
      setItems(data.items);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log.');
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, targetFilter]);

  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  async function handleLoadMore() {
    if (!hasMore || isLoading) return;
    setIsLoading(true);
    try {
      const data = await api.get<AuditLogResponse>(buildQuery(cursor));
      setItems((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 motion-safe:animate-fade-in">
      {/* Page header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold font-display text-white tracking-tight">
          Audit Log
        </h1>
        <p className="text-sm text-muted">
          All admin actions across users, groups, and messages.
        </p>
      </div>

      {/* Kente accent */}
      <div className="h-[2px] w-16 rounded-full bg-gradient-to-r from-flame via-gold to-income opacity-70 motion-safe:animate-kente-reveal" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Action filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="action-filter"
            className="text-[10px] font-semibold uppercase tracking-label text-white/30"
          >
            Action
          </label>
          <select
            id="action-filter"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="bg-ghana-elevated border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80
              focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40
              hover:border-white/20 transition-colors cursor-pointer min-w-[180px]"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target type filter */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="target-filter"
            className="text-[10px] font-semibold uppercase tracking-label text-white/30"
          >
            Target Type
          </label>
          <select
            id="target-filter"
            value={targetFilter}
            onChange={(e) => setTargetFilter(e.target.value)}
            className="bg-ghana-elevated border border-white/10 rounded-lg px-3 py-2 text-sm text-white/80
              focus:outline-none focus:ring-1 focus:ring-gold/40 focus:border-gold/40
              hover:border-white/20 transition-colors cursor-pointer min-w-[140px]"
          >
            {TARGET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Active filter chips */}
        {(actionFilter || targetFilter) && (
          <div className="flex items-center gap-2 mt-4">
            {actionFilter && (
              <button
                type="button"
                onClick={() => setActionFilter('')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-flame/15 text-flame border border-flame/25 hover:bg-flame/25 transition-colors"
              >
                {actionFilter}
                <span aria-hidden="true" className="text-flame/60">×</span>
              </button>
            )}
            {targetFilter && (
              <button
                type="button"
                onClick={() => setTargetFilter('')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-info/15 text-info border border-info/25 hover:bg-info/25 transition-colors"
              >
                {targetFilter}
                <span aria-hidden="true" className="text-info/60">×</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl border border-expense/20 flex items-center gap-2">
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          {error}
        </div>
      )}

      {/* Table */}
      <DataTable<AuditLogItem>
        columns={COLUMNS}
        data={items}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={() => void handleLoadMore()}
        emptyMessage="No audit log entries found."
      />
    </div>
  );
}
