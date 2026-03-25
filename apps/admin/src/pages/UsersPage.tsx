import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable } from '@/components/shared/DataTable';
import type { Column } from '@/components/shared/DataTable';
import { api } from '@/lib/api';
import type { UserRole } from '@cedisense/shared';

// ─── Admin user shape returned from GET /admin/users ─────────────────────────

interface AdminUserRow extends Record<string, unknown> {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  groups_count: number;
  created_at: string;
  is_active: 0 | 1;
}

interface UsersResponse {
  items: AdminUserRow[];
  cursor: string | null;
  has_more: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const ROLE_BADGE: Record<UserRole, { label: string; className: string }> = {
  user: { label: 'User', className: 'bg-white/5 text-white/50' },
  admin: { label: 'Admin', className: 'bg-info/10 text-info' },
  superadmin: { label: 'Superadmin', className: 'bg-gold/10 text-gold' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const { label, className } = ROLE_BADGE[role] ?? ROLE_BADGE.user;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
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

const COLUMNS: Column<AdminUserRow>[] = [
  {
    key: 'name',
    header: 'Name',
    render: (row) => (
      <span className="font-medium text-white">{row.name || '—'}</span>
    ),
  },
  {
    key: 'phone',
    header: 'Phone',
    render: (row) => <span className="font-mono text-sm">{row.phone}</span>,
  },
  {
    key: 'role',
    header: 'Role',
    render: (row) => <RoleBadge role={row.role} />,
  },
  {
    key: 'groups_count',
    header: 'Groups',
    render: (row) => (
      <span className="tabular-nums">{row.groups_count}</span>
    ),
  },
  {
    key: 'created_at',
    header: 'Created',
    render: (row) => (
      <span className="text-white/50 text-xs">{formatDate(row.created_at)}</span>
    ),
  },
  {
    key: 'is_active',
    header: 'Status',
    render: (row) => <StatusBadge active={row.is_active} />,
  },
];

// ─── Filters bar ─────────────────────────────────────────────────────────────

type RoleFilter = 'all' | UserRole;
type StatusFilter = 'all' | 'active' | 'inactive';

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UsersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters — read initial values from URL
  const [searchInput, setSearchInput] = useState(searchParams.get('q') ?? '');
  const [role, setRole] = useState<RoleFilter>((searchParams.get('role') as RoleFilter) ?? 'all');
  const [status, setStatus] = useState<StatusFilter>((searchParams.get('status') as StatusFilter) ?? 'all');

  // Debounce search with a ref so we can clear it
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync URL params whenever filters change
  useEffect(() => {
    const params: Record<string, string> = {};
    if (searchInput) params.q = searchInput;
    if (role !== 'all') params.role = role;
    if (status !== 'all') params.status = status;
    setSearchParams(params, { replace: true });
  }, [searchInput, role, status, setSearchParams]);

  // Fetch first page whenever filters change (debounced for search)
  const fetchFirstPage = useCallback(async (q: string, r: RoleFilter, s: StatusFilter) => {
    setIsLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({ limit: '20' });
      if (q) qs.set('q', q);
      if (r !== 'all') qs.set('role', r);
      if (s !== 'all') qs.set('status', s);

      const data = await api.get<UsersResponse>(`/admin/users?${qs}`);
      setUsers(data.items);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger fetch on filter changes (debounce only search text)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFirstPage(searchInput, role, status);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, role, status, fetchFirstPage]);

  // Load next page
  const handleLoadMore = useCallback(async () => {
    if (!cursor || isLoading) return;
    setIsLoading(true);
    try {
      const qs = new URLSearchParams({ limit: '20', cursor });
      if (searchInput) qs.set('q', searchInput);
      if (role !== 'all') qs.set('role', role);
      if (status !== 'all') qs.set('status', status);

      const data = await api.get<UsersResponse>(`/admin/users?${qs}`);
      setUsers((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more users.');
    } finally {
      setIsLoading(false);
    }
  }, [cursor, isLoading, searchInput, role, status]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Users</h1>
        <p className="text-white/40 text-sm mt-1">Manage all registered users</p>
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search name or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="input-premium pl-9 py-2.5 text-sm"
            aria-label="Search users"
          />
        </div>

        {/* Role filter */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleFilter)}
          className="input-premium py-2.5 text-sm w-auto min-w-[140px]"
          aria-label="Filter by role"
        >
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="superadmin">Superadmin</option>
        </select>

        {/* Status filter */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
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
      <DataTable<AdminUserRow>
        columns={COLUMNS}
        data={users}
        isLoading={isLoading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        onRowClick={(row) => navigate(`/users/${row.id}`)}
        emptyMessage="No users match your search."
      />
    </div>
  );
}
