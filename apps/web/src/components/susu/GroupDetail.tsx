import { useState } from 'react';
import type { SusuGroupWithDetails, EarlyPayoutRequest, SusuAnalytics, SusuBadge, LeaderboardEntry, WelfareClaimType } from '@cedisense/shared';
import { GroupAnalytics } from './GroupAnalytics';
import { Leaderboard } from './Leaderboard';
import { GroupChat } from './GroupChat';
import { GroupOverview } from './GroupOverview';

type GroupDetailTab = 'overview' | 'analytics' | 'leaderboard' | 'chat';

interface GroupDetailProps {
  group: SusuGroupWithDetails;
  currentUserId: string;
  earlyPayoutRequest: EarlyPayoutRequest | null;
  onContribute: (memberId: string, isLate: boolean) => void;
  onPayout: () => void;
  onAdvanceRound: () => void;
  onLeave: () => void;
  onRequestEarlyPayout: () => void;
  onVoteEarlyPayout: (vote: 'for' | 'against') => void;
  onPayEarlyPayout: () => void;
  onPlaceBid?: () => void;
  onSubmitFuneralClaim?: () => void;
  onVoteFuneralClaim?: (vote: 'approve' | 'deny') => void;
  onPayFuneralClaim?: () => void;
  funeralClaimVoting?: boolean;
  funeralClaimPaying?: boolean;
  earlyPayoutVoting?: boolean;
  earlyPayoutPaying?: boolean;
  onGuaranteeClaim?: (memberId: string) => void;
  onPaySupplier?: () => void;
  onSubmitWelfareClaim?: (data: { claim_type: WelfareClaimType; description: string; amount_requested_pesewas: number }) => void;
  onApproveWelfareClaim?: (claimId: string, amount?: number) => void;
  onDenyWelfareClaim?: (claimId: string) => void;
  onPayWelfareClaim?: (claimId: string) => void;
  onViewReceipt?: (memberId: string) => void;
  onReorderMembers?: (memberIds: string[]) => void;
  reorderSaving?: boolean;
  analytics?: SusuAnalytics | null;
  analyticsLoading?: boolean;
  onLoadAnalytics?: () => void;
  badges?: SusuBadge[];
  leaderboard?: LeaderboardEntry[];
  leaderboardLoading?: boolean;
  onLoadLeaderboard?: () => void;
  onTogglePrePaid?: (memberId: string, prePaid: boolean) => void;
}

export function GroupDetail({
  group,
  currentUserId,
  earlyPayoutRequest,
  onContribute,
  onPayout,
  onAdvanceRound,
  onLeave,
  onRequestEarlyPayout,
  onVoteEarlyPayout,
  onPayEarlyPayout,
  onPlaceBid,
  onSubmitFuneralClaim,
  onVoteFuneralClaim,
  onPayFuneralClaim,
  funeralClaimVoting = false,
  funeralClaimPaying = false,
  earlyPayoutVoting = false,
  earlyPayoutPaying = false,
  onViewReceipt,
  analytics,
  analyticsLoading = false,
  onLoadAnalytics,
  badges = [],
  leaderboard = [],
  leaderboardLoading = false,
  onLoadLeaderboard,
  onGuaranteeClaim,
  onPaySupplier,
  onSubmitWelfareClaim,
  onApproveWelfareClaim,
  onDenyWelfareClaim,
  onPayWelfareClaim,
  onReorderMembers,
  reorderSaving = false,
  onTogglePrePaid,
}: GroupDetailProps) {
  const [activeTab, setActiveTab] = useState<GroupDetailTab>('overview');

  function handleAnalyticsTab() {
    setActiveTab('analytics');
    if (!analytics && !analyticsLoading && onLoadAnalytics) {
      onLoadAnalytics();
    }
  }

  function handleLeaderboardTab() {
    setActiveTab('leaderboard');
    if (leaderboard.length === 0 && !leaderboardLoading && onLoadLeaderboard) {
      onLoadLeaderboard();
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex gap-1 bg-ghana-surface border border-white/10 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px]
            ${activeTab === 'overview' ? 'bg-gold text-ghana-dark shadow-sm' : 'text-muted hover:text-white'}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={handleLeaderboardTab}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px]
            ${activeTab === 'leaderboard' ? 'bg-gold text-ghana-dark shadow-sm' : 'text-muted hover:text-white'}`}
        >
          Leaderboard
        </button>
        <button
          type="button"
          onClick={handleAnalyticsTab}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px]
            ${activeTab === 'analytics' ? 'bg-gold text-ghana-dark shadow-sm' : 'text-muted hover:text-white'}`}
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px] relative
            ${activeTab === 'chat' ? 'bg-gold text-ghana-dark shadow-sm' : 'text-muted hover:text-white'}`}
        >
          Chat
          {(group.unread_count ?? 0) > 0 && activeTab !== 'chat' && (
            <span className="absolute top-1.5 right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-expense text-white text-[9px] font-bold px-1">
              {(group.unread_count ?? 0) > 99 ? '99+' : group.unread_count}
            </span>
          )}
        </button>
      </div>

      {/* Leaderboard tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
          {!leaderboardLoading && leaderboard.length === 0 && onLoadLeaderboard && (
            <div className="text-center">
              <button type="button" onClick={onLoadLeaderboard} className="px-4 py-2 rounded-xl border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]">
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytics tab */}
      {activeTab === 'analytics' && (
        <>
          {analyticsLoading && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="h-20 rounded-xl bg-ghana-surface animate-pulse" />
                <div className="h-20 rounded-xl bg-ghana-surface animate-pulse" />
                <div className="h-20 rounded-xl bg-ghana-surface animate-pulse" />
                <div className="h-20 rounded-xl bg-ghana-surface animate-pulse" />
              </div>
              <div className="h-40 rounded-xl bg-ghana-surface animate-pulse" />
            </div>
          )}
          {!analyticsLoading && analytics && <GroupAnalytics analytics={analytics} />}
          {!analyticsLoading && !analytics && (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted text-sm">No analytics data available yet.</p>
              {onLoadAnalytics && (
                <button type="button" onClick={onLoadAnalytics} className="px-4 py-2 rounded-xl border border-gold/40 text-gold text-sm font-semibold hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]">
                  Retry
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Chat tab */}
      {activeTab === 'chat' && (
        <GroupChat
          groupId={group.id}
          currentUserId={currentUserId}
          isCreator={group.is_creator}
          members={group.members.map((m) => ({
            member_id: m.id,
            display_name: m.display_name,
            user_id: m.user_id,
          }))}
        />
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <GroupOverview
          group={group}
          currentUserId={currentUserId}
          earlyPayoutRequest={earlyPayoutRequest}
          onContribute={onContribute}
          onPayout={onPayout}
          onAdvanceRound={onAdvanceRound}
          onLeave={onLeave}
          onRequestEarlyPayout={onRequestEarlyPayout}
          onVoteEarlyPayout={onVoteEarlyPayout}
          onPayEarlyPayout={onPayEarlyPayout}
          onPlaceBid={onPlaceBid}
          onSubmitFuneralClaim={onSubmitFuneralClaim}
          onVoteFuneralClaim={onVoteFuneralClaim}
          onPayFuneralClaim={onPayFuneralClaim}
          funeralClaimVoting={funeralClaimVoting}
          funeralClaimPaying={funeralClaimPaying}
          earlyPayoutVoting={earlyPayoutVoting}
          earlyPayoutPaying={earlyPayoutPaying}
          onGuaranteeClaim={onGuaranteeClaim}
          onPaySupplier={onPaySupplier}
          onSubmitWelfareClaim={onSubmitWelfareClaim}
          onApproveWelfareClaim={onApproveWelfareClaim}
          onDenyWelfareClaim={onDenyWelfareClaim}
          onPayWelfareClaim={onPayWelfareClaim}
          onViewReceipt={onViewReceipt}
          onReorderMembers={onReorderMembers}
          reorderSaving={reorderSaving}
          badges={badges}
          onTogglePrePaid={onTogglePrePaid}
        />
      )}
    </div>
  );
}
