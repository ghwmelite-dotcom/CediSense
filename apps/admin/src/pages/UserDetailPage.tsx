import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { DataTable } from '@/components/shared/DataTable';
import type { Column } from '@/components/shared/DataTable';
import { api, ApiRequestError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@cedisense/shared';

// ─── API shapes ───────────────────────────────────────────────────────────────

interface AdminUserDetail {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  country_code: string | null;
  role: UserRole;
  is_active: 0 | 1;
  created_at: string;
  trust_score: number | null;
  groups: AdminUserGroup[];
  accounts: AdminUserAccount[];
}

interface AdminUserGroup extends Record<string, unknown> {
  id: string;
  name: string;
  variant: string;
  member_count: number;
  is_active: boolean;
  joined_at: string;
}

interface AdminUserAccount extends Record<string, unknown> {
  id: string;
  name: string;
  type: string;
  provider: string | null;
  balance_pesewas: number;
  is_primary: 0 | 1;
  created_at: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatGHS(pesewas: number) {
  return `GHS ${(pesewas / 100).toFixed(2)}`;
}

function roleBadgeClass(role: UserRole) {
  if (role === 'superadmin') return 'bg-gold/10 text-gold';
  if (role === 'admin') return 'bg-info/10 text-info';
  return 'bg-white/5 text-white/50';
}

function roleLabel(role: UserRole) {
  if (role === 'superadmin') return 'Superadmin';
  if (role === 'admin') return 'Admin';
  return 'User';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-white/[0.04] last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-sm text-white/80 text-right">{children}</span>
    </div>
  );
}

// ─── Reset PIN Modal ──────────────────────────────────────────────────────────

interface ResetPinModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
}

function ResetPinModal({ open, onClose, userId }: ResetPinModalProps) {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setPin('');
      setConfirmPin('');
      setError('');
      setSuccess(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pin.length !== 4) {
      setError('PIN must be exactly 4 digits.');
      return;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.post(`/admin/users/${userId}/reset-pin`, { pin });
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else {
        setError('Failed to reset PIN. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    if (!loading) onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label="Reset user PIN"
    >
      <div
        className="bg-ghana-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-white mb-1">Reset PIN</h2>
        <p className="text-sm text-white/50 mb-5">Set a new 4-digit PIN for this user.</p>

        {success ? (
          <div className="text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-income/10 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-white/70">PIN has been reset successfully.</p>
            <button onClick={onClose} className="btn-primary px-6 py-2.5 text-sm w-full">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-expense/[0.08] text-expense text-sm px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="section-label block mb-1.5">New PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="────"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input-premium text-center text-xl tracking-[0.5em] placeholder:tracking-[0.2em]"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="section-label block mb-1.5">Confirm PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="────"
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="input-premium text-center text-xl tracking-[0.5em] placeholder:tracking-[0.2em]"
                required
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || pin.length < 4 || confirmPin.length < 4}
                className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
                Reset PIN
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Groups columns ───────────────────────────────────────────────────────────

const GROUP_COLUMNS: Column<AdminUserGroup>[] = [
  {
    key: 'name',
    header: 'Group',
    render: (row) => <span className="font-medium text-white">{row.name}</span>,
  },
  {
    key: 'variant',
    header: 'Type',
    render: (row) => (
      <span className="capitalize text-white/60 text-xs">{row.variant.replace(/_/g, ' ')}</span>
    ),
  },
  {
    key: 'member_count',
    header: 'Members',
    render: (row) => <span className="tabular-nums">{row.member_count}</span>,
  },
  {
    key: 'joined_at',
    header: 'Joined',
    render: (row) => (
      <span className="text-white/50 text-xs">{formatDate(row.joined_at)}</span>
    ),
  },
  {
    key: 'is_active',
    header: 'Status',
    render: (row) =>
      row.is_active ? (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-income/10 text-income">Active</span>
      ) : (
        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-white/5 text-white/40">Inactive</span>
      ),
  },
];

// ─── Accounts columns ─────────────────────────────────────────────────────────

const ACCOUNT_COLUMNS: Column<AdminUserAccount>[] = [
  {
    key: 'name',
    header: 'Account',
    render: (row) => (
      <span className="font-medium text-white flex items-center gap-1.5">
        {row.name}
        {row.is_primary === 1 && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-gold/10 text-gold">
            Primary
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    render: (row) => (
      <span className="capitalize text-white/60 text-xs">{row.type}</span>
    ),
  },
  {
    key: 'provider',
    header: 'Provider',
    render: (row) => (
      <span className="text-white/50 text-xs">{row.provider ?? '—'}</span>
    ),
  },
  {
    key: 'balance_pesewas',
    header: 'Balance',
    render: (row) => (
      <span className="tabular-nums font-medium text-income">
        {formatGHS(row.balance_pesewas)}
      </span>
    ),
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const isSuperadmin = authUser?.role === 'superadmin';

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal state
  const [showResetPin, setShowResetPin] = useState(false);
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);
  const [showChangeRole, setShowChangeRole] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [changeRoleLoading, setChangeRoleLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchUser = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<AdminUserDetail>(`/admin/users/${id}`);
      setUser(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  // Deactivate / Reactivate
  async function handleToggleActive() {
    if (!user) return;
    setDeactivateLoading(true);
    setActionError('');
    const endpoint = user.is_active === 1 ? 'deactivate' : 'reactivate';
    try {
      await api.patch(`/admin/users/${user.id}/${endpoint}`);
      setShowDeactivate(false);
      await fetchUser();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setActionError(err.message);
      } else {
        setActionError('Action failed. Please try again.');
      }
    } finally {
      setDeactivateLoading(false);
    }
  }

  // Change Role
  async function handleChangeRole() {
    if (!user || !pendingRole) return;
    setChangeRoleLoading(true);
    setActionError('');
    try {
      await api.patch(`/admin/users/${user.id}/role`, { role: pendingRole });
      setShowChangeRole(false);
      setPendingRole(null);
      await fetchUser();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setActionError(err.message);
      } else {
        setActionError('Role change failed. Please try again.');
      }
    } finally {
      setChangeRoleLoading(false);
    }
  }

  // ── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-8 w-48 rounded-lg bg-ghana-elevated/50 animate-pulse" />
        <div className="bg-ghana-surface rounded-2xl border border-white/5 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 rounded bg-ghana-elevated/50 animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6 lg:p-8">
        <button
          onClick={() => navigate('/users')}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Users
        </button>
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl">
          {error || 'User not found.'}
        </div>
      </div>
    );
  }

  const isActive = user.is_active === 1;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/users')}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Users
      </button>

      {/* Action error banner */}
      {actionError && (
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-expense/60 hover:text-expense ml-4" aria-label="Dismiss">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Profile card ───────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-ghana-surface rounded-2xl border border-white/5 p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-ghana-elevated flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white/40">
                {(user.name || user.phone)[0].toUpperCase()}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{user.name || 'Unnamed User'}</h1>
              <p className="text-white/50 text-sm font-mono mt-0.5">{user.phone}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleBadgeClass(user.role)}`}>
                  {roleLabel(user.role)}
                </span>
                {isActive ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-income/10 text-income">
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-expense/10 text-expense">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Details */}
          <div>
            <InfoRow label="Email">{user.email ?? <span className="text-white/30">—</span>}</InfoRow>
            <InfoRow label="Country">{user.country_code ?? <span className="text-white/30">—</span>}</InfoRow>
            <InfoRow label="Member Since">{formatDate(user.created_at)}</InfoRow>
            <InfoRow label="Trust Score">
              {user.trust_score !== null ? (
                <span
                  className={
                    user.trust_score >= 80
                      ? 'text-income font-semibold'
                      : user.trust_score >= 60
                      ? 'text-warning font-semibold'
                      : 'text-expense font-semibold'
                  }
                >
                  {user.trust_score}
                </span>
              ) : (
                <span className="text-white/30">N/A</span>
              )}
            </InfoRow>
            <InfoRow label="Groups">{user.groups.length}</InfoRow>
            <InfoRow label="Accounts">{user.accounts.length}</InfoRow>
          </div>
        </div>

        {/* ── Quick actions ──────────────────────────────────────────────── */}
        <div className="bg-ghana-surface rounded-2xl border border-white/5 p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
            Quick Actions
          </h2>

          {/* Reset PIN */}
          <button
            onClick={() => setShowResetPin(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-ghana-elevated/50 hover:bg-ghana-elevated text-white/70 hover:text-white transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            Reset PIN
          </button>

          {/* Deactivate / Reactivate */}
          <button
            onClick={() => setShowDeactivate(true)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-sm font-medium ${
              isActive
                ? 'bg-expense/[0.08] hover:bg-expense/[0.14] text-expense'
                : 'bg-income/[0.08] hover:bg-income/[0.14] text-income'
            }`}
          >
            {isActive ? (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                Deactivate User
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reactivate User
              </>
            )}
          </button>

          {/* Change Role — superadmin only */}
          {isSuperadmin && (
            <div className="space-y-2 pt-1">
              <label className="section-label block">Change Role</label>
              <select
                value={pendingRole ?? user.role}
                onChange={(e) => {
                  const selected = e.target.value as UserRole;
                  if (selected !== user.role) {
                    setPendingRole(selected);
                    setShowChangeRole(true);
                  }
                }}
                className="input-premium py-2.5 text-sm w-full"
                aria-label="Change user role"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ── Groups section ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          Groups
          <span className="text-xs text-white/40 font-normal">({user.groups.length})</span>
        </h2>
        <DataTable<AdminUserGroup>
          columns={GROUP_COLUMNS}
          data={user.groups}
          onRowClick={(row) => navigate(`/groups/${row.id}`)}
          emptyMessage="This user has no groups."
        />
      </section>

      {/* ── Accounts section ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold text-white mb-3 flex items-center gap-2">
          Accounts
          <span className="text-xs text-white/40 font-normal">({user.accounts.length})</span>
        </h2>
        <DataTable<AdminUserAccount>
          columns={ACCOUNT_COLUMNS}
          data={user.accounts}
          emptyMessage="This user has no accounts."
        />
      </section>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Reset PIN modal */}
      <ResetPinModal
        open={showResetPin}
        onClose={() => setShowResetPin(false)}
        userId={user.id}
      />

      {/* Deactivate / Reactivate confirm */}
      <ConfirmModal
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={handleToggleActive}
        title={isActive ? 'Deactivate User' : 'Reactivate User'}
        description={
          isActive
            ? `Are you sure you want to deactivate ${user.name || user.phone}? They will no longer be able to sign in.`
            : `Are you sure you want to reactivate ${user.name || user.phone}? They will regain access to the app.`
        }
        confirmLabel={isActive ? 'Deactivate' : 'Reactivate'}
        variant={isActive ? 'danger' : 'warning'}
        loading={deactivateLoading}
      />

      {/* Change Role confirm */}
      <ConfirmModal
        open={showChangeRole}
        onClose={() => {
          setShowChangeRole(false);
          setPendingRole(null);
        }}
        onConfirm={handleChangeRole}
        title="Change Role"
        description={`Change ${user.name || user.phone}'s role to ${pendingRole ? roleLabel(pendingRole) : ''}? This will immediately affect their access level.`}
        confirmLabel="Change Role"
        variant="warning"
        loading={changeRoleLoading}
      />
    </div>
  );
}
