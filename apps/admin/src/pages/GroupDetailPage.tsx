import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { DataTable } from '@/components/shared/DataTable';
import type { Column } from '@/components/shared/DataTable';
import { api, ApiRequestError } from '@/lib/api';

// ─── API shapes ───────────────────────────────────────────────────────────────

interface AdminGroupDetail {
  id: string;
  name: string;
  variant: string;
  creator_name: string | null;
  invite_code: string;
  contribution_pesewas: number;
  frequency: string;
  current_round: number | null;
  total_rounds: number | null;
  is_active: 0 | 1;
  contribution_count: number;
  payout_count: number;
  members: AdminGroupMember[];
  recent_messages: AdminGroupMessage[];
  active_claims: AdminGroupClaim[];
}

interface AdminGroupMember extends Record<string, unknown> {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  payout_order: number | null;
  joined_at: string;
}

interface AdminGroupMessage extends Record<string, unknown> {
  id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface AdminGroupClaim extends Record<string, unknown> {
  id: string;
  type: string;
  claimant_name: string;
  amount_pesewas: number;
  status: string;
  created_at: string;
}

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = 'members' | 'contributions' | 'chat' | 'claims';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatGHS(pesewas: number): string {
  return `₵${(pesewas / 100).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVariant(variant: string): string {
  return variant.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatFrequency(freq: string): string {
  return freq.charAt(0).toUpperCase() + freq.slice(1).toLowerCase();
}

const CLAIM_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-income/10 text-income',
  rejected: 'bg-expense/10 text-expense',
  paid: 'bg-info/10 text-info',
};

function ClaimStatusBadge({ status }: { status: string }) {
  const className = CLAIM_STATUS_BADGE[status] ?? 'bg-white/5 text-white/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className} capitalize`}>
      {status}
    </span>
  );
}

// ─── InfoRow sub-component ────────────────────────────────────────────────────

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-white/[0.04] last:border-b-0">
      <span className="text-xs font-semibold uppercase tracking-widest text-white/40">{label}</span>
      <span className="text-sm text-white/80 text-right">{children}</span>
    </div>
  );
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 font-mono text-sm text-white/80 hover:text-white transition-colors group"
      aria-label="Copy invite code"
    >
      {value}
      <svg
        className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${copied ? 'text-income' : 'text-white/30 group-hover:text-white/60'}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </>
        )}
      </svg>
    </button>
  );
}

// ─── Columns ──────────────────────────────────────────────────────────────────

function buildMemberColumns(
  onRemove: (member: AdminGroupMember) => void
): Column<AdminGroupMember>[] {
  return [
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
      render: (row) => (
        <span className="font-mono text-sm text-white/70">{row.phone}</span>
      ),
    },
    {
      key: 'payout_order',
      header: 'Payout Order',
      render: (row) =>
        row.payout_order !== null ? (
          <span className="tabular-nums text-white/70">{row.payout_order}</span>
        ) : (
          <span className="text-white/30">—</span>
        ),
    },
    {
      key: 'joined_at',
      header: 'Joined',
      render: (row) => (
        <span className="text-white/50 text-xs">{formatDate(row.joined_at)}</span>
      ),
    },
    {
      key: '_actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(row);
          }}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-expense hover:bg-expense/10 transition-colors"
          aria-label={`Remove ${row.name} from group`}
        >
          Remove
        </button>
      ),
    },
  ];
}

const CLAIM_COLUMNS: Column<AdminGroupClaim>[] = [
  {
    key: 'type',
    header: 'Type',
    render: (row) => (
      <span className="capitalize text-white/70 text-xs">
        {(row.type as string).replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    key: 'claimant_name',
    header: 'Claimant',
    render: (row) => (
      <span className="font-medium text-white">{row.claimant_name || '—'}</span>
    ),
  },
  {
    key: 'amount_pesewas',
    header: 'Amount',
    render: (row) => (
      <span className="tabular-nums font-medium text-income">
        {formatGHS(row.amount_pesewas)}
      </span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <ClaimStatusBadge status={row.status as string} />,
  },
  {
    key: 'created_at',
    header: 'Date',
    render: (row) => (
      <span className="text-white/50 text-xs">{formatDate(row.created_at as string)}</span>
    ),
  },
];

// ─── Tab bar ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: 'members', label: 'Members' },
  { id: 'contributions', label: 'Contributions' },
  { id: 'chat', label: 'Chat' },
  { id: 'claims', label: 'Claims' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [group, setGroup] = useState<AdminGroupDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');

  // Active tab
  const [activeTab, setActiveTab] = useState<Tab>('members');

  // Deactivate modal
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Remove member modal
  const [memberToRemove, setMemberToRemove] = useState<AdminGroupMember | null>(null);
  const [removeMemberLoading, setRemoveMemberLoading] = useState(false);

  // Delete message modal
  const [messageToDelete, setMessageToDelete] = useState<AdminGroupMessage | null>(null);
  const [deleteMessageLoading, setDeleteMessageLoading] = useState(false);

  // Members list (local state so we can remove without refetch)
  const [members, setMembers] = useState<AdminGroupMember[]>([]);
  const [messages, setMessages] = useState<AdminGroupMessage[]>([]);

  const fetchGroup = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError('');
    try {
      const data = await api.get<AdminGroupDetail>(`/admin/groups/${id}`);
      setGroup(data);
      setMembers(data.members);
      setMessages(data.recent_messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load group.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  // ── Toggle active ─────────────────────────────────────────────────────────

  async function handleToggleActive() {
    if (!group) return;
    setDeactivateLoading(true);
    setActionError('');
    const endpoint = group.is_active === 1 ? 'deactivate' : 'reactivate';
    try {
      await api.patch(`/admin/groups/${group.id}/${endpoint}`);
      setShowDeactivate(false);
      await fetchGroup();
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

  // ── Remove member ─────────────────────────────────────────────────────────

  async function handleRemoveMember() {
    if (!group || !memberToRemove) return;
    setRemoveMemberLoading(true);
    setActionError('');
    try {
      await api.delete(`/admin/groups/${group.id}/members/${memberToRemove.user_id}`);
      setMembers((prev) => prev.filter((m) => m.user_id !== memberToRemove.user_id));
      setMemberToRemove(null);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to remove member. Please try again.');
      }
    } finally {
      setRemoveMemberLoading(false);
    }
  }

  // ── Delete message ────────────────────────────────────────────────────────

  async function handleDeleteMessage() {
    if (!group || !messageToDelete) return;
    setDeleteMessageLoading(true);
    setActionError('');
    try {
      await api.delete(`/admin/groups/${group.id}/messages/${messageToDelete.id}`);
      // Mark message as deleted in local state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageToDelete.id ? { ...m, content: '' } : m
        )
      );
      setMessageToDelete(null);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setActionError(err.message);
      } else {
        setActionError('Failed to delete message. Please try again.');
      }
    } finally {
      setDeleteMessageLoading(false);
    }
  }

  // ── Member columns (with remove handler) ─────────────────────────────────

  const memberColumns = buildMemberColumns((m) => setMemberToRemove(m));

  // ── Loading skeleton ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        <div className="h-8 w-48 rounded-lg bg-ghana-elevated/50 animate-pulse" />
        <div className="bg-ghana-surface rounded-2xl border border-white/5 p-6 space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-4 rounded bg-ghana-elevated/50 animate-pulse"
              style={{ width: `${60 + (i % 3) * 15}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="p-6 lg:p-8">
        <button
          onClick={() => navigate('/groups')}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Groups
        </button>
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl">
          {error || 'Group not found.'}
        </div>
      </div>
    );
  }

  const isActive = group.is_active === 1;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Back button */}
      <button
        onClick={() => navigate('/groups')}
        className="flex items-center gap-2 text-white/50 hover:text-white text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Groups
      </button>

      {/* Action error banner */}
      {actionError && (
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError('')}
            className="text-expense/60 hover:text-expense ml-4"
            aria-label="Dismiss error"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Group info card ─────────────────────────────────────────────── */}
        <div className="lg:col-span-2 bg-ghana-surface rounded-2xl border border-white/5 p-6">
          {/* Header */}
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-ghana-elevated flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-white/40">
                {group.name[0]?.toUpperCase() ?? 'G'}
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-white truncate">{group.name}</h1>
              <p className="text-white/50 text-sm mt-0.5 capitalize">
                {formatVariant(group.variant)}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
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
            <InfoRow label="Creator">
              {group.creator_name ?? <span className="text-white/30">—</span>}
            </InfoRow>
            <InfoRow label="Invite Code">
              <CopyButton value={group.invite_code} />
            </InfoRow>
            <InfoRow label="Contribution">
              <span className="font-medium text-income">
                {formatGHS(group.contribution_pesewas)}
              </span>
            </InfoRow>
            <InfoRow label="Frequency">{formatFrequency(group.frequency)}</InfoRow>
            <InfoRow label="Current Round">
              {group.current_round !== null && group.total_rounds !== null ? (
                <span className="tabular-nums">
                  {group.current_round} / {group.total_rounds}
                </span>
              ) : (
                <span className="text-white/30">—</span>
              )}
            </InfoRow>
            <InfoRow label="Members">{members.length}</InfoRow>
            <InfoRow label="Contributions">{group.contribution_count}</InfoRow>
            <InfoRow label="Payouts">{group.payout_count}</InfoRow>
          </div>
        </div>

        {/* ── Quick actions ───────────────────────────────────────────────── */}
        <div className="bg-ghana-surface rounded-2xl border border-white/5 p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-white/40 mb-4">
            Quick Actions
          </h2>

          {/* Deactivate / Reactivate */}
          <button
            type="button"
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
                Deactivate Group
              </>
            ) : (
              <>
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Reactivate Group
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Tabbed sections ──────────────────────────────────────────────────── */}
      <div className="bg-ghana-surface rounded-2xl border border-white/5 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-5 py-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
                activeTab === tab.id
                  ? 'text-gold border-b-2 border-gold -mb-px'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.label}
              {tab.id === 'members' && (
                <span className="ml-1.5 text-xs text-white/30 font-normal">({members.length})</span>
              )}
              {tab.id === 'chat' && (
                <span className="ml-1.5 text-xs text-white/30 font-normal">({messages.length})</span>
              )}
              {tab.id === 'claims' && (
                <span className="ml-1.5 text-xs text-white/30 font-normal">({group.active_claims.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="p-0" role="tabpanel">
          {/* Members tab */}
          {activeTab === 'members' && (
            <DataTable<AdminGroupMember>
              columns={memberColumns}
              data={members}
              emptyMessage="This group has no members."
            />
          )}

          {/* Contributions tab */}
          {activeTab === 'contributions' && (
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="bg-ghana-elevated rounded-xl p-4 flex-1 text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                    Total Contributions
                  </p>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {group.contribution_count}
                  </p>
                </div>
                <div className="bg-ghana-elevated rounded-xl p-4 flex-1 text-center">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                    Total Payouts
                  </p>
                  <p className="text-2xl font-bold text-white tabular-nums">
                    {group.payout_count}
                  </p>
                </div>
              </div>
              <p className="text-white/30 text-sm text-center py-4">
                Detailed contribution history coming soon.
              </p>
            </div>
          )}

          {/* Chat tab */}
          {activeTab === 'chat' && (
            <div>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center py-12 text-white/30 text-sm">
                  No messages in this group.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-ghana-elevated/10 transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-full bg-ghana-elevated flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-xs font-bold text-white/40">
                            {(msg.sender_name || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white/60 mb-0.5">
                            {msg.sender_name || 'Unknown'}
                          </p>
                          {msg.content ? (
                            <p className="text-sm text-white/80 break-words">{msg.content}</p>
                          ) : (
                            <p className="text-sm text-white/25 italic">[deleted]</p>
                          )}
                          <p className="text-xs text-white/30 mt-1">{formatDateTime(msg.created_at as string)}</p>
                        </div>
                      </div>

                      {/* Delete button — only show if not already deleted */}
                      {msg.content ? (
                        <button
                          type="button"
                          onClick={() => setMessageToDelete(msg)}
                          className="flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium text-expense hover:bg-expense/10 transition-colors"
                          aria-label="Delete message"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Claims tab */}
          {activeTab === 'claims' && (
            <DataTable<AdminGroupClaim>
              columns={CLAIM_COLUMNS}
              data={group.active_claims}
              emptyMessage="No active claims for this group."
            />
          )}
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Deactivate / Reactivate confirm */}
      <ConfirmModal
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        onConfirm={handleToggleActive}
        title={isActive ? 'Deactivate Group' : 'Reactivate Group'}
        description={
          isActive
            ? `Are you sure you want to deactivate "${group.name}"? Members will no longer be able to contribute or receive payouts.`
            : `Are you sure you want to reactivate "${group.name}"? The group will resume normal operations.`
        }
        confirmLabel={isActive ? 'Deactivate' : 'Reactivate'}
        variant={isActive ? 'danger' : 'warning'}
        loading={deactivateLoading}
      />

      {/* Remove member confirm */}
      <ConfirmModal
        open={memberToRemove !== null}
        onClose={() => setMemberToRemove(null)}
        onConfirm={handleRemoveMember}
        title="Remove Member"
        description={`Are you sure you want to remove ${memberToRemove?.name || memberToRemove?.phone || 'this member'} from "${group.name}"? This action cannot be undone.`}
        confirmLabel="Remove"
        variant="danger"
        loading={removeMemberLoading}
      />

      {/* Delete message confirm */}
      <ConfirmModal
        open={messageToDelete !== null}
        onClose={() => setMessageToDelete(null)}
        onConfirm={handleDeleteMessage}
        title="Delete Message"
        description="Are you sure you want to delete this message? It will be shown as [deleted] to all members."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMessageLoading}
      />
    </div>
  );
}
