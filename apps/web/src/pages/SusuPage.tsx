import { useState, useEffect, useCallback } from 'react';
import type { SusuGroup, SusuGroupWithDetails, SusuFrequency, ContributionReceipt, EarlyPayoutRequest } from '@cedisense/shared';
import { api } from '@/lib/api';
import { GroupCard } from '@/components/susu/GroupCard';
import { GroupDetail } from '@/components/susu/GroupDetail';
import { CreateGroupModal } from '@/components/susu/CreateGroupModal';
import { JoinGroupModal } from '@/components/susu/JoinGroupModal';
import { ContributionReceipt as ContributionReceiptModal } from '@/components/susu/ContributionReceipt';

type SusuGroupWithCount = SusuGroup & { member_count: number };

type JoinError = 'invalid' | 'full' | 'already_member' | null;

// ─── Empty state ───────────────────────────────────────────────────────────────

interface EmptyStateProps {
  onCreate: () => void;
  onJoin: () => void;
}

function EmptyState({ onCreate, onJoin }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-4">
      <svg
        className="w-14 h-14 text-muted"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944
             11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0
             0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971
             5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25
             0 11-4.5 0 2.25 2.25 0 014.5 0z"
        />
      </svg>
      <div className="space-y-1">
        <p className="text-white font-semibold text-base">No susu groups yet</p>
        <p className="text-muted text-sm max-w-xs">
          Start or join a susu group to contribute and receive rotating payouts with your community.
        </p>
      </div>
      <div className="flex gap-3 mt-2">
        <button
          type="button"
          onClick={onCreate}
          className="px-5 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
            hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
        >
          Create Group
        </button>
        <button
          type="button"
          onClick={onJoin}
          className="px-5 py-3 rounded-xl border border-gold/60 text-gold font-semibold text-sm
            hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
        >
          Join Group
        </button>
      </div>
    </div>
  );
}

// ─── SusuPage ──────────────────────────────────────────────────────────────────

export function SusuPage() {
  const [groups, setGroups] = useState<SusuGroupWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<SusuGroupWithDetails | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinError, setJoinError] = useState<JoinError>(null);

  // Receipt state
  const [activeReceipt, setActiveReceipt] = useState<ContributionReceipt | null>(null);

  // Early payout state
  const [earlyPayoutRequest, setEarlyPayoutRequest] = useState<EarlyPayoutRequest | null>(null);
  const [earlyPayoutVoting, setEarlyPayoutVoting] = useState(false);
  const [earlyPayoutPaying, setEarlyPayoutPaying] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const data = await api.get<SusuGroupWithCount[]>('/susu/groups');
      setGroups(data);
    } catch {
      // Non-fatal: keep existing state
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchGroups();
      setLoading(false);
    }
    void init();
  }, [fetchGroups]);

  async function fetchEarlyPayout(groupId: string) {
    try {
      const data = await api.get<EarlyPayoutRequest | null>(`/susu/groups/${groupId}/early-payout`);
      setEarlyPayoutRequest(data);
    } catch {
      setEarlyPayoutRequest(null);
    }
  }

  async function handleGroupClick(id: string) {
    setDetailLoading(true);
    try {
      const data = await api.get<SusuGroupWithDetails>(`/susu/groups/${id}`);
      setSelectedGroup(data);
      await fetchEarlyPayout(id);
    } catch {
      // Stay on list view
    } finally {
      setDetailLoading(false);
    }
  }

  function handleBack() {
    setSelectedGroup(null);
    setEarlyPayoutRequest(null);
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async function handleCreate(data: {
    name: string;
    contribution_pesewas: number;
    frequency: SusuFrequency;
    max_members: number;
  }) {
    await api.post('/susu/groups', data);
    setCreateOpen(false);
    await fetchGroups();
  }

  // ── Join ────────────────────────────────────────────────────────────────────

  async function handleJoin(inviteCode: string) {
    setJoinError(null);
    try {
      await api.post('/susu/groups/join', { invite_code: inviteCode });
      setJoinOpen(false);
      await fetchGroups();
    } catch (err) {
      // Map API error codes to UI error types
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('full')) {
        setJoinError('full');
      } else if (message.includes('already')) {
        setJoinError('already_member');
      } else {
        setJoinError('invalid');
      }
    }
  }

  // ── Contribute ──────────────────────────────────────────────────────────────

  async function handleContribute(memberId: string) {
    if (!selectedGroup) return;
    const contribution = await api.post<ContributionReceipt & { id: string; group_id: string; member_id: string; round: number }>(
      `/susu/groups/${selectedGroup.id}/contributions`,
      { member_id: memberId, amount_pesewas: selectedGroup.contribution_pesewas }
    );
    // Show the receipt immediately
    setActiveReceipt({
      receipt_number: contribution.receipt_number,
      group_name: contribution.group_name,
      member_name: contribution.member_name,
      round: contribution.round,
      total_rounds: contribution.total_rounds,
      amount_pesewas: contribution.amount_pesewas,
      contributed_at: contribution.contributed_at,
    });
    // Refresh detail view
    const updated = await api.get<SusuGroupWithDetails>(`/susu/groups/${selectedGroup.id}`);
    setSelectedGroup(updated);
    await fetchGroups();
  }

  // ── View receipt for an already-contributed member ───────────────────────

  async function handleViewReceipt(memberId: string) {
    if (!selectedGroup) return;
    // Find the contribution id from the history endpoint
    try {
      const history = await api.get<{
        contributions: Array<{ id: string; member_id: string; round: number; amount_pesewas: number; contributed_at: string }>;
        payouts: unknown[];
      }>(`/susu/groups/${selectedGroup.id}/history`);
      const contrib = history.contributions.find(
        (c) => c.member_id === memberId && c.round === selectedGroup.current_round
      );
      if (!contrib) return;
      const receiptData = await api.get<ContributionReceipt>(
        `/susu/groups/${selectedGroup.id}/contributions/${contrib.id}/receipt`
      );
      setActiveReceipt(receiptData);
    } catch {
      // Non-fatal: receipt view is convenience only
    }
  }

  // ── Payout ──────────────────────────────────────────────────────────────────

  async function handlePayout() {
    if (!selectedGroup) return;
    await api.post(`/susu/groups/${selectedGroup.id}/payout`);
    const updated = await api.get<SusuGroupWithDetails>(`/susu/groups/${selectedGroup.id}`);
    setSelectedGroup(updated);
    await fetchGroups();
  }

  // ── Advance round ───────────────────────────────────────────────────────────

  async function handleAdvanceRound() {
    if (!selectedGroup) return;
    await api.post(`/susu/groups/${selectedGroup.id}/advance`);
    const updated = await api.get<SusuGroupWithDetails>(`/susu/groups/${selectedGroup.id}`);
    setSelectedGroup(updated);
    await fetchGroups();
  }

  // ── Leave ───────────────────────────────────────────────────────────────────

  async function handleLeave() {
    if (!selectedGroup) return;
    await api.post(`/susu/groups/${selectedGroup.id}/leave`);
    setSelectedGroup(null);
    await fetchGroups();
  }

  // ── Early Payout ──────────────────────────────────────────────────────────

  async function handleRequestEarlyPayout() {
    if (!selectedGroup) return;
    const reason = prompt('Why do you need an early payout? (optional)');
    try {
      await api.post(`/susu/groups/${selectedGroup.id}/early-payout`, {
        reason: reason || undefined,
      });
      await fetchEarlyPayout(selectedGroup.id);
    } catch {
      // Non-fatal
    }
  }

  async function handleVoteEarlyPayout(vote: 'for' | 'against') {
    if (!selectedGroup || !earlyPayoutRequest) return;
    setEarlyPayoutVoting(true);
    try {
      await api.post(
        `/susu/groups/${selectedGroup.id}/early-payout/${earlyPayoutRequest.id}/vote`,
        { vote }
      );
      await fetchEarlyPayout(selectedGroup.id);
    } catch {
      // Non-fatal
    } finally {
      setEarlyPayoutVoting(false);
    }
  }

  async function handlePayEarlyPayout() {
    if (!selectedGroup || !earlyPayoutRequest) return;
    setEarlyPayoutPaying(true);
    try {
      await api.post(
        `/susu/groups/${selectedGroup.id}/early-payout/${earlyPayoutRequest.id}/pay`
      );
      await fetchEarlyPayout(selectedGroup.id);
      // Refresh group detail
      const updated = await api.get<SusuGroupWithDetails>(`/susu/groups/${selectedGroup.id}`);
      setSelectedGroup(updated);
      await fetchGroups();
    } catch {
      // Non-fatal
    } finally {
      setEarlyPayoutPaying(false);
    }
  }

  const isEmpty = !loading && groups.length === 0;

  // ── Detail view ─────────────────────────────────────────────────────────────

  if (selectedGroup) {
    return (
      <>
        <div className="pb-24">
          {/* Sticky header */}
          <div className="sticky top-0 z-30 bg-ghana-dark/95 backdrop-blur-md border-b border-white/10 px-4 py-4">
            <div className="flex items-center gap-3 max-w-screen-lg mx-auto">
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center justify-center w-9 h-9 rounded-xl border border-white/20
                  text-white hover:bg-white/10 active:scale-95 transition-all min-h-[44px] min-w-[44px]"
                aria-label="Back to susu groups"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-white text-xl font-bold flex-1 truncate">Group Detail</h1>
            </div>
          </div>

          <div className="px-4 pt-4 max-w-screen-lg mx-auto">
            <GroupDetail
              group={selectedGroup}
              earlyPayoutRequest={earlyPayoutRequest}
              onContribute={handleContribute}
              onPayout={handlePayout}
              onAdvanceRound={handleAdvanceRound}
              onLeave={handleLeave}
              onRequestEarlyPayout={handleRequestEarlyPayout}
              onVoteEarlyPayout={handleVoteEarlyPayout}
              onPayEarlyPayout={handlePayEarlyPayout}
              earlyPayoutVoting={earlyPayoutVoting}
              earlyPayoutPaying={earlyPayoutPaying}
              onViewReceipt={handleViewReceipt}
            />
          </div>
        </div>

        {/* Receipt modal — rendered above the page so it sits at z-50 */}
        {activeReceipt && (
          <ContributionReceiptModal
            receipt={activeReceipt}
            open={true}
            onClose={() => setActiveReceipt(null)}
          />
        )}
      </>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────

  return (
    <div className="pb-24">
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 bg-ghana-dark/95 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3 max-w-screen-lg mx-auto">
          <h1 className="text-white text-xl font-bold">Susu Groups</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setJoinOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gold/60
                text-gold font-semibold text-sm hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
            >
              Join
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-ghana-dark
                font-semibold text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {(loading || detailLoading) && (
          <div className="space-y-3">
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {!loading && !detailLoading && (
          <>
            {isEmpty && (
              <EmptyState onCreate={() => setCreateOpen(true)} onJoin={() => setJoinOpen(true)} />
            )}

            {!isEmpty && (
              <div className="space-y-3">
                {groups.map((group) => (
                  <GroupCard
                    key={group.id}
                    group={group}
                    isCreator={false /* determined server-side in detail, here we check creator_id later */}
                    onClick={() => handleGroupClick(group.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <CreateGroupModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSave={handleCreate}
      />

      <JoinGroupModal
        open={joinOpen}
        onClose={() => {
          setJoinOpen(false);
          setJoinError(null);
        }}
        onJoin={handleJoin}
        error={joinError}
      />
    </div>
  );
}
