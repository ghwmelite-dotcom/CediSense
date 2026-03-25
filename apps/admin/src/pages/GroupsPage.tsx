import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable } from '@/components/shared/DataTable';
import type { Column } from '@/components/shared/DataTable';
import { api } from '@/lib/api';

// ─── API shapes ───────────────────────────────────────────────────────────────

interface AdminGroupRow extends Record<string, unknown> {
  id: string;
  name: string;
  variant: string;
  member_count: number;
  contribution_pesewas: number;
  frequency: string;
  current_round: number | null;
  total_rounds: number | null;
  is_active: 0 | 1;
}

interface GroupsResponse {
  items: AdminGroupRow[];
  cursor: string | null;
  has_more: boolean;
}

// ─── Filter types ─────────────────────────────────────────────────────────────

type VariantFilter =
  | 'all'
  | 'rotating'
  | 'accumulating'
  | 'goal_based'
  | 'funeral_fund'
  | 'welfare';

type ActiveFilter = 'all' | 'active' | 'inactive';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatGHS(pesewas: number): string {
  return `₵${(pesewas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatFrequency(freq: string): string {
  return freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase();
}

function formatVariant(variant: string): string {
  return variant.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const VARIANT_BADGE: Record<string, { label: string; className: string }> = {
  rotating: { label: 'Rotating', className: 'bg-info/10 text-info' },
  accumulating: { label: 'Accumulating', className: 'bg-gold/10 text-gold' },
  goal_based: { label: 'Goal-Based', className: 'bg-flame/10 text-flame' },
  funeral_fund: { label: 'Funeral Fund', className: 'bg-white/8 text-white/60' },
  welfare: { label: 'Welfare', className: 'bg-income/10 text-income' },
};

function VariantBadge({ variant }: { variant: string }) {
  const config = VARIANT_BADGE[variant];
  if (!config) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/40 capitalize">
        {formatVariant(variant)}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function StatusBadge({ active }: { active: 0 | 1 }) {
  return active ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-income/10 text-income">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-expense/10 text-expense">
      Inactive
    </span>
  );
}

// ─── Columns definition ───────────────────────────────────────────────────────

const COLUMNS: Column<AdminGroupRow>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => (
      <span className="font-medium text-white">{row.name || '—'}</span>
    ),
  },
  {
    key: 'variant',
    header: 'Variant',
    render: (row) => <VariantBadge variant={row.variant} />,
  },
  {
    key: 'member_count',
    header: 'Members',
    render: (row) => (
      <span className="tabular-nums">{row.member_count}</span>
    ),
  },
  {
    key: 'contribution_pesewas',
    header: 'Contribution',
    render: (row) => (
      <span className="tabular-nums font-medium text-income">
        {formatGHS(row.contribution_pesewas)}
      </span>
    ),
  },
  {
    key: 'frequency',
    header: 'Frequency',
    render: (row) => (
      <span className="text-white/60 text-xs capitalize">
        {formatFrequency(row.frequency)}
      </span>
    ),
  },
  {
    key: 'current_round',
    header: 'Rounds',
    render: (row) =>
      row.current_round !== null && row.total_rounds !== null ? (
        <span className="tabular-nums text-white/60 text-xs">
          {row.current_round} / {row.total_rounds}
        </span>
      ) : (
        <span className="text-white/30">—</span>
      ),
  },
  {
    key: 'is_active',
    header: 'Status',
    render: (row) => <StatusBadge active={row.is_active} />,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GroupsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [groups, setGroups] = useState<AdminGroupRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters — read initial values from URL
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [variant, setVariant] = useState<VariantFilter>(
    (searchParams.get('variant') as VariantFilter) ?? 'all'
  );
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>(
    (searchParams.get('active') as ActiveFilter) ?? 'all'
  );

  // Debounce search with a ref so we can clear it
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync URL params whenever filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchInput) params.q = searchInput;
    if (variant !== 'all') params.variant = variant;
    if (activeFilter !== 'all') params.active = activeFilter;
    setSearchParams(params, { replace: true });
  }, [searchInput, variant, activeFilter, setSearchParams]);

  // Fetch first page
  const fetchFirstPage = useCallback(
    async (q: string, v: VariantFilter, a: ActiveFilter) => {
      setIsLoading(true);
      setError('');
      try {
        const qs = new URLSearchParams({ limit: '20' });
        if (q) qs.set('q', q);
        if (v !== 'all') qs.set('variant', v);
        if (a !== 'all') qs.set('active', a === 'active' ? '1' : '0');

        const data = await api.get<GroupsResponse>(`/admin/groups?${qs}`);
        setGroups(data.items);
        setCursor(data.cursor);
        setHasMore(data.has_more);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load groups.');
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Trigger fetch on filter changes (debounce only search text)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFirstPage(searchInput, variant, activeFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, variant, activeFilter, fetchFirstPage]);

  // Load next page
  const handleLoadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '20', cursor });
      if (searchInput) qs.set('q', searchInput);
      if (variant !== 'all') qs.set('variant', variant);
      if (activeFilter !== 'all') qs.set('active', activeFilter === 'active' ? '1' : '0');

      const data = await api.get<GroupsResponse>(`/admin/groups?${qs}`);
      setGroups((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more groups.');
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading, searchInput, variant, activeFilter]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Susu Groups</h1>
        <p className="text-white/40 text-sm mt-1">Manage all susu groups and their members</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
            />
          </svg>
          <input
            type="search"
            placeholder="Search group name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-premium pl-9 py-2.5 text-sm"
            aria-label="Search groups"
          />
        </div>

        {/* Variant filter */}
        <select
          value={variant}
          onChange={(e) => setVariant(e.target.value as VariantFilter)}
          className="input-premium py-2.5 text-sm w-auto min-w-[160px]"
          aria-label="Filter by variant"
        >
          <option value="all">All Variants</option>
          <option value="rotating">Rotating</option>
          <option value="accumulating">Accumulating</option>
          <option value="goal_based">Goal-Based</option>
          <option value="funeral_fund">Funeral Fund</option>
          <option value="welfare">Welfare</option>
        </select>

        {/* Active filter */}
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value as ActiveFilter)}
          className="input-premium py-2.5 text-sm w-auto min-w-[140px]"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Table */}
      <DataTable<AdminGroupRow>
        columns={COLUMNS}
        data={groups}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onRowClick={(row) => navigate(`/groups/${row.id}`)}
        emptyMessage="No groups match your search."
      />
    </div>
  );
}
