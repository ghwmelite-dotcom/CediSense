import { useState } from 'react';
import type { SusuGroupWithDetails, EarlyPayoutRequest, FuneralClaim, SusuVariant, SusuAnalytics, SusuBadge, LeaderboardEntry, GuaranteeClaim, WelfareClaim, WelfareClaimType } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { InviteQRModal } from './InviteQRModal';
import { EarlyPayoutCard } from './EarlyPayoutCard';
import { FuneralClaimCard } from './FuneralClaimCard';
import { GroupAnalytics } from './GroupAnalytics';
import { BadgeDisplay } from './BadgeDisplay';
import { Leaderboard } from './Leaderboard';
import { GroupChat } from './GroupChat';

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
  /** Funeral fund claim handlers */
  onSubmitFuneralClaim?: () => void;
  onVoteFuneralClaim?: (vote: 'approve' | 'deny') => void;
  onPayFuneralClaim?: () => void;
  funeralClaimVoting?: boolean;
  funeralClaimPaying?: boolean;
  earlyPayoutVoting?: boolean;
  earlyPayoutPaying?: boolean;
  /** Guarantee fund handlers */
  onGuaranteeClaim?: (memberId: string) => void;
  /** Bulk purchase handler */
  onPaySupplier?: () => void;
  /** Welfare handlers */
  onSubmitWelfareClaim?: (data: { claim_type: WelfareClaimType; description: string; amount_requested_pesewas: number }) => void;
  onApproveWelfareClaim?: (claimId: string, amount?: number) => void;
  onDenyWelfareClaim?: (claimId: string) => void;
  onPayWelfareClaim?: (claimId: string) => void;
  /** Called when the user taps "View Receipt" for a member who has contributed */
  onViewReceipt?: (memberId: string) => void;
  /** Analytics data — fetched lazily when Analytics tab is opened */
  analytics?: SusuAnalytics | null;
  analyticsLoading?: boolean;
  onLoadAnalytics?: () => void;
  /** Gamification */
  badges?: SusuBadge[];
  leaderboard?: LeaderboardEntry[];
  leaderboardLoading?: boolean;
  onLoadLeaderboard?: () => void;
}

const VARIANT_LABEL: Record<SusuVariant, string> = {
  rotating: 'Rotating',
  accumulating: 'Accumulating',
  goal_based: 'Goal-based',
  bidding: 'Bidding',
  funeral_fund: 'Funeral Fund',
  school_fees: 'School Fees',
  diaspora: 'Diaspora',
  event_fund: 'Event Fund',
  bulk_purchase: 'Bulk Purchase',
  agricultural: 'Agricultural',
  welfare: 'Welfare',
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  GHS: '\u20B5',
  GBP: '\u00A3',
  USD: '$',
  EUR: '\u20AC',
  CAD: 'CA$',
};

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
}: GroupDetailProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [lateMembers, setLateMembers] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<GroupDetailTab>('overview');
  // Welfare claim form state
  const [welfareFormOpen, setWelfareFormOpen] = useState(false);
  const [welfareClaimType, setWelfareClaimType] = useState<WelfareClaimType>('medical');
  const [welfareDescription, setWelfareDescription] = useState('');
  const [welfareAmount, setWelfareAmount] = useState(0);

  async function copyInviteCode() {
    await navigator.clipboard.writeText(group.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const allContributed = group.members.every((m) => m.has_contributed_this_round);
  const hasPayoutRecipient = group.payout_recipient !== null;

  // Advance round is enabled only when all have contributed AND payout is done
  // We can't know payout status purely from members, so the parent controls enabling
  // by showing the button; the creator taps it after both steps.
  const canAdvance = allContributed;

  const sortedMembers = [...group.members].sort((a, b) => a.payout_order - b.payout_order);

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
            ${activeTab === 'overview'
              ? 'bg-gold text-ghana-dark shadow-sm'
              : 'text-muted hover:text-white'
            }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={handleLeaderboardTab}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px]
            ${activeTab === 'leaderboard'
              ? 'bg-gold text-ghana-dark shadow-sm'
              : 'text-muted hover:text-white'
            }`}
        >
          Leaderboard
        </button>
        <button
          type="button"
          onClick={handleAnalyticsTab}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px]
            ${activeTab === 'analytics'
              ? 'bg-gold text-ghana-dark shadow-sm'
              : 'text-muted hover:text-white'
            }`}
        >
          Analytics
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('chat')}
          className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all min-h-[40px] relative
            ${activeTab === 'chat'
              ? 'bg-gold text-ghana-dark shadow-sm'
              : 'text-muted hover:text-white'
            }`}
        >
          Chat
          {(group.unread_count ?? 0) > 0 && activeTab !== 'chat' && (
            <span className="absolute top-1.5 right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-expense text-white text-[9px] font-bold px-1">
              {(group.unread_count ?? 0) > 99 ? '99+' : group.unread_count}
            </span>
          )}
        </button>
      </div>

      {/* Leaderboard tab content */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-4">
          <Leaderboard entries={leaderboard} loading={leaderboardLoading} />
          {!leaderboardLoading && leaderboard.length === 0 && onLoadLeaderboard && (
            <div className="text-center">
              <button
                type="button"
                onClick={onLoadLeaderboard}
                className="px-4 py-2 rounded-xl border border-gold/40 text-gold text-sm font-semibold
                  hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analytics tab content */}
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
          {!analyticsLoading && analytics && (
            <GroupAnalytics analytics={analytics} />
          )}
          {!analyticsLoading && !analytics && (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted text-sm">No analytics data available yet.</p>
              {onLoadAnalytics && (
                <button
                  type="button"
                  onClick={onLoadAnalytics}
                  className="px-4 py-2 rounded-xl border border-gold/40 text-gold text-sm font-semibold
                    hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Chat tab content */}
      {activeTab === 'chat' && (
        <GroupChat groupId={group.id} currentUserId={currentUserId} />
      )}

      {/* Overview tab content */}
      {activeTab === 'overview' && (
      <div className="space-y-6">

      {/* Header */}
      <div className="space-y-3">
        <h2 className="text-white text-xl font-bold">{group.name}</h2>

        {/* Invite code */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
          <span className="text-muted text-xs font-medium uppercase tracking-wide shrink-0">
            Invite Code
          </span>
          <span className="text-gold font-mono font-bold text-sm flex-1 truncate">
            {group.invite_code}
          </span>
          <button
            type="button"
            onClick={copyInviteCode}
            className="shrink-0 px-3 py-1.5 rounded-lg border border-gold/40 text-gold text-xs
              font-semibold hover:bg-gold/10 active:scale-95 transition-all min-h-[36px]"
            aria-label="Copy invite code"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Invite Members button */}
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            border border-gold/40 text-gold font-semibold text-sm
            hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
          Invite Members
        </button>

        {/* QR Code Modal */}
        <InviteQRModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          groupName={group.name}
          inviteCode={group.invite_code}
        />
      </div>

      {/* Round indicator (not for funeral_fund) */}
      {group.variant !== 'funeral_fund' && (
      <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <p className="text-muted text-xs">Current Round</p>
          <p className="text-white font-bold text-lg">
            Round {group.current_round} of {group.max_members}
          </p>
        </div>
        <div className="text-right space-y-0.5">
          <p className="text-muted text-xs">Pool per round</p>
          <p className="text-gold font-bold text-base">
            {formatPesewas(group.contribution_pesewas * group.member_count)}
          </p>
        </div>
      </div>
      )}

      {/* Penalty pool display */}
      {group.penalty_pool_pesewas > 0 && (
        <div className="bg-expense/10 border border-expense/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-expense shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-xs text-expense font-semibold">Penalty Pool</span>
          </div>
          <span className="text-expense font-bold text-sm">{formatPesewas(group.penalty_pool_pesewas)}</span>
        </div>
      )}

      {/* Guarantee Fund display */}
      {group.guarantee_percent > 0 && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-cyan-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="text-xs text-cyan-300 font-semibold">Guarantee Fund ({group.guarantee_percent}%)</span>
            </div>
            <span className="text-cyan-200 font-bold text-sm">{formatPesewas(group.guarantee_pool_pesewas)}</span>
          </div>
          {group.is_creator && onGuaranteeClaim && group.guarantee_pool_pesewas > 0 && (
            <div className="space-y-1.5">
              <p className="text-cyan-300/60 text-xs">Claim for a defaulting member:</p>
              <div className="flex flex-wrap gap-1.5">
                {group.members.filter(m => !m.has_contributed_this_round).map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onGuaranteeClaim(m.id)}
                    className="px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-200
                      text-xs font-semibold hover:bg-cyan-500/25 active:scale-95 transition-all min-h-[36px]"
                  >
                    Claim for {m.display_name}
                  </button>
                ))}
              </div>
            </div>
          )}
          {group.guarantee_claims && group.guarantee_claims.length > 0 && (
            <div className="space-y-1 mt-2">
              <p className="text-cyan-300/60 text-xs font-medium">Claims history:</p>
              {group.guarantee_claims.slice(0, 5).map((claim) => (
                <div key={claim.id} className="flex items-center justify-between text-xs bg-cyan-500/5 rounded-lg px-3 py-1.5">
                  <span className="text-cyan-100 truncate">{claim.defaulting_member_name} (Rd {claim.round})</span>
                  <span className="text-cyan-200 font-bold shrink-0">{formatPesewas(claim.covered_amount_pesewas)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accumulating info */}
      {group.variant === 'accumulating' && group.accumulating_info && (
        <div className="bg-income/10 border border-income/30 rounded-xl p-4 space-y-2">
          <p className="text-income text-xs font-semibold uppercase tracking-wide">
            {VARIANT_LABEL.accumulating} — Shared Pool
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-muted text-xs">Total Pool</p>
              <p className="text-white font-bold text-base">
                {formatPesewas(group.accumulating_info.total_pool_pesewas)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-muted text-xs">Your Share</p>
              <p className="text-income font-bold text-base">
                {formatPesewas(group.accumulating_info.your_share_pesewas)}
              </p>
            </div>
          </div>
          {group.current_round > group.max_members && (
            <p className="text-income text-xs font-medium">
              All rounds complete — ready for distribution
            </p>
          )}
        </div>
      )}

      {/* Goal-based progress */}
      {group.variant === 'goal_based' && group.goal_progress && (
        <div className="bg-gold/5 border border-gold/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-gold text-xs font-semibold uppercase tracking-wide">
              {VARIANT_LABEL.goal_based}
            </p>
            <span className="text-gold font-bold text-sm">
              {group.goal_progress.percentage}%
            </span>
          </div>
          {group.goal_progress.goal_description && (
            <p className="text-muted text-sm">{group.goal_progress.goal_description}</p>
          )}
          {/* Progress bar */}
          <div
            className="h-2.5 rounded-full bg-white/10 overflow-hidden"
            role="progressbar"
            aria-valuenow={group.goal_progress.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-gold transition-all duration-500"
              style={{ width: `${group.goal_progress.percentage}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">
              {formatPesewas(group.goal_progress.total_contributed_pesewas)} raised
            </span>
            <span className="text-gold font-medium">
              Goal: {formatPesewas(group.goal_progress.goal_amount_pesewas)}
            </span>
          </div>
          {group.goal_progress.is_complete && (
            <p className="text-income text-xs font-semibold">
              Goal reached — ready for distribution
            </p>
          )}
        </div>
      )}

      {/* Funeral Fund: pool display + claim UI */}
      {group.variant === 'funeral_fund' && group.funeral_fund_info && (
        <div className="bg-neutral-900/60 border border-neutral-700/40 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-amber-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 2C12 2 9 6 9 8.5C9 10.433 10.343 12 12 12C13.657 12 15 10.433 15 8.5C15 6 12 2 12 2Z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 12V22" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 22H15" />
            </svg>
            <p className="text-amber-300/80 text-xs font-semibold uppercase tracking-wide">
              {VARIANT_LABEL.funeral_fund} — Emergency Pool
            </p>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-neutral-500 text-xs">Available Fund</p>
              <p className="text-amber-200 font-bold text-xl">
                {formatPesewas(group.funeral_fund_info.available_pool_pesewas)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-neutral-500 text-xs">Total Contributed</p>
              <p className="text-neutral-300 font-semibold text-sm">
                {formatPesewas(group.funeral_fund_info.total_pool_pesewas)}
              </p>
            </div>
          </div>
          {group.funeral_fund_info.total_paid_out_pesewas > 0 && (
            <p className="text-neutral-500 text-xs">
              Previously paid out: {formatPesewas(group.funeral_fund_info.total_paid_out_pesewas)}
            </p>
          )}
        </div>
      )}

      {/* Funeral Fund: active claim */}
      {group.variant === 'funeral_fund' && group.funeral_claim && onVoteFuneralClaim && onPayFuneralClaim && (
        <FuneralClaimCard
          claim={group.funeral_claim}
          isCreator={group.is_creator}
          isClaimant={group.funeral_claim.claimant_member_id === group.my_member_id}
          onVote={onVoteFuneralClaim}
          onPay={onPayFuneralClaim}
          voting={funeralClaimVoting}
          paying={funeralClaimPaying}
        />
      )}

      {/* Funeral Fund: submit claim button (members only, no active claim) */}
      {group.variant === 'funeral_fund' && group.my_member_id && !group.funeral_claim && onSubmitFuneralClaim && (
        <button
          type="button"
          onClick={onSubmitFuneralClaim}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            bg-neutral-800/80 border border-amber-800/40 text-amber-300 font-semibold text-sm
            hover:bg-neutral-800 active:scale-95 transition-all min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Submit Bereavement Claim
        </button>
      )}

      {/* School Fees info */}
      {group.variant === 'school_fees' && group.school_fees_info && (
        <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342" />
            </svg>
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wide">
              {VARIANT_LABEL.school_fees} — {group.school_fees_info.target_term}
            </p>
          </div>
          {group.school_fees_info.school_name && (
            <p className="text-blue-100 text-sm font-medium">{group.school_fees_info.school_name}</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-blue-300/60 text-xs">Payout Date</p>
              <p className="text-blue-100 font-bold text-base">
                {new Date(group.school_fees_info.next_payout_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-blue-300/60 text-xs">Days Until Payout</p>
              <p className="text-blue-100 font-bold text-2xl">{group.school_fees_info.days_until_payout}</p>
            </div>
          </div>
          {group.school_fees_info.required_weekly_pesewas > 0 && (
            <div className="bg-blue-600/10 rounded-lg px-3 py-2 space-y-1">
              <p className="text-blue-300/60 text-xs">Required to hit target:</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-blue-100 font-semibold">
                  {formatPesewas(group.school_fees_info.required_weekly_pesewas)}/week
                </span>
                <span className="text-blue-300/40">or</span>
                <span className="text-blue-100 font-semibold">
                  {formatPesewas(group.school_fees_info.required_monthly_pesewas)}/month
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diaspora info */}
      {group.variant === 'diaspora' && group.diaspora_info && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
            <p className="text-emerald-200 text-xs font-semibold uppercase tracking-wide">
              {VARIANT_LABEL.diaspora} — Multi-Currency
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-emerald-300/60 text-xs">Base Currency:</span>
            <span className="text-emerald-100 font-bold text-sm">
              {CURRENCY_SYMBOLS[group.diaspora_info.base_currency] ?? ''} {group.diaspora_info.base_currency}
            </span>
          </div>
          {group.diaspora_info.contributions_with_currency.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-emerald-300/60 text-xs">Recent contributions (dual currency):</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {group.diaspora_info.contributions_with_currency.slice(0, 10).map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-emerald-500/5 rounded-lg px-3 py-2">
                    <span className="text-emerald-100 font-medium truncate">{c.member_name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted">
                        {CURRENCY_SYMBOLS[c.original_currency] ?? ''}{(c.original_amount / 100).toFixed(2)}
                      </span>
                      <span className="text-emerald-300/40">=</span>
                      <span className="text-emerald-100 font-semibold">
                        {formatPesewas(c.amount_pesewas)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event Fund info (Abotre) */}
      {group.variant === 'event_fund' && group.event_fund_info && (
        <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-pink-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
            </svg>
            <p className="text-pink-200 text-xs font-semibold uppercase tracking-wide">
              {group.event_fund_info.event_name}
            </p>
          </div>

          {/* Event countdown */}
          {group.event_fund_info.days_until_event !== null && (
            <div className="flex items-center justify-between">
              <span className="text-pink-300/60 text-xs">Event Date</span>
              <div className="text-right">
                <span className="text-pink-100 font-bold text-lg">{group.event_fund_info.days_until_event}</span>
                <span className="text-pink-300/60 text-xs ml-1">days away</span>
              </div>
            </div>
          )}

          {/* Progress bar toward target */}
          {group.event_fund_info.target_amount_pesewas > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-pink-300/60">
                  {formatPesewas(group.event_fund_info.total_contributed_pesewas)} raised
                </span>
                <span className="text-pink-200 font-semibold">
                  {group.event_fund_info.percentage}% of {formatPesewas(group.event_fund_info.target_amount_pesewas)}
                </span>
              </div>
              <div
                className="h-2.5 rounded-full bg-white/10 overflow-hidden"
                role="progressbar"
                aria-valuenow={group.event_fund_info.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full bg-pink-400 transition-all duration-500"
                  style={{ width: `${group.event_fund_info.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Contributor list (guest book) */}
          {group.event_fund_info.contributors.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-pink-300/60 text-xs font-medium">Contributors</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {group.event_fund_info.contributors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-pink-500/5 rounded-lg px-3 py-2">
                    <span className="text-pink-100 font-medium truncate">{c.member_name}</span>
                    <span className="text-pink-200 font-bold shrink-0">{formatPesewas(c.amount_pesewas)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bulk Purchase info */}
      {group.variant === 'bulk_purchase' && group.bulk_purchase_info && (
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-orange-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <p className="text-orange-200 text-xs font-semibold uppercase tracking-wide">
              {VARIANT_LABEL.bulk_purchase} — Trader Group
            </p>
          </div>

          {/* Supplier info */}
          <div className="bg-orange-500/5 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-300/60 text-xs">Supplier</span>
              <span className="text-orange-100 font-semibold">{group.bulk_purchase_info.supplier_name}</span>
            </div>
            {group.bulk_purchase_info.supplier_contact && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-300/60 text-xs">Contact</span>
                <span className="text-orange-100">{group.bulk_purchase_info.supplier_contact}</span>
              </div>
            )}
            {group.bulk_purchase_info.item_description && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-300/60 text-xs">Items</span>
                <span className="text-orange-100">{group.bulk_purchase_info.item_description}</span>
              </div>
            )}
            {group.bulk_purchase_info.estimated_savings_percent != null && group.bulk_purchase_info.estimated_savings_percent > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-300/60 text-xs">Est. Savings</span>
                <span className="text-income font-bold">{group.bulk_purchase_info.estimated_savings_percent}% off retail</span>
              </div>
            )}
          </div>

          {/* Pool progress */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-0.5">
              <p className="text-orange-300/60 text-xs">Total Pool</p>
              <p className="text-orange-100 font-bold text-lg">
                {formatPesewas(group.bulk_purchase_info.total_pool_pesewas)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-orange-300/60 text-xs">Your Share</p>
              <p className="text-orange-200 font-bold text-base">
                {formatPesewas(group.bulk_purchase_info.per_member_share_pesewas)}
              </p>
            </div>
          </div>

          {/* Pay Supplier button (creator only) */}
          {group.is_creator && onPaySupplier && group.bulk_purchase_info.total_pool_pesewas > 0 && (
            <button
              type="button"
              onClick={onPaySupplier}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                bg-orange-500 text-white font-semibold text-sm hover:brightness-110
                active:scale-95 transition-all min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2
                     2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Pay Supplier
            </button>
          )}
        </div>
      )}

      {/* Agricultural info */}
      {group.variant === 'agricultural' && group.agricultural_info && (
        <div className="bg-green-600/10 border border-green-600/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              {group.agricultural_info.current_phase === 'planting' ? '\uD83C\uDF31' : group.agricultural_info.current_phase === 'growing' ? '\uD83C\uDF3F' : '\uD83C\uDF3E'}
            </span>
            <p className="text-green-200 text-xs font-semibold uppercase tracking-wide">
              {VARIANT_LABEL.agricultural} &mdash; {group.agricultural_info.crop_type}
            </p>
          </div>

          {/* Current phase */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-green-300/60 text-xs">Current Phase</p>
              <p className="text-green-100 font-bold text-lg capitalize">
                {group.agricultural_info.current_phase === 'planting' ? '\uD83C\uDF31 Planting' : group.agricultural_info.current_phase === 'growing' ? '\uD83C\uDF3F Growing' : '\uD83C\uDF3E Harvest'}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-green-300/60 text-xs">Next Phase In</p>
              <p className="text-green-100 font-bold text-2xl">{group.agricultural_info.days_to_next_phase}</p>
              <p className="text-green-300/60 text-xs">days</p>
            </div>
          </div>

          {/* Season months */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-600/10 rounded-lg px-3 py-2 space-y-0.5">
              <p className="text-green-300/60 text-xs">Planting</p>
              <p className="text-green-100 font-semibold text-sm">
                {new Date(2024, group.agricultural_info.planting_month - 1).toLocaleString('en', { month: 'long' })}
              </p>
            </div>
            <div className="bg-green-600/10 rounded-lg px-3 py-2 space-y-0.5">
              <p className="text-green-300/60 text-xs">Harvest</p>
              <p className="text-green-100 font-semibold text-sm">
                {new Date(2024, group.agricultural_info.harvest_month - 1).toLocaleString('en', { month: 'long' })}
              </p>
            </div>
          </div>

          {/* Contribution schedule recommendation */}
          <div className="bg-green-600/10 rounded-lg px-3 py-2">
            <p className="text-green-300/60 text-xs">Schedule</p>
            <p className="text-green-100 text-sm font-medium">
              {group.agricultural_info.recommended_contribution_schedule}
            </p>
          </div>
        </div>
      )}

      {/* Welfare info */}
      {group.variant === 'welfare' && group.welfare_info && (
        <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden="true">
              {group.welfare_info.organization_type === 'church' ? '\u26EA' : group.welfare_info.organization_type === 'mosque' ? '\uD83D\uDD4C' : group.welfare_info.organization_type === 'community' ? '\uD83C\uDFD8\uFE0F' : '\uD83C\uDFE2'}
            </span>
            <p className="text-violet-200 text-xs font-semibold uppercase tracking-wide">
              {group.welfare_info.organization_name} &mdash; Welfare Fund
            </p>
          </div>

          {/* Pool display */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-violet-300/60 text-xs">Available Fund</p>
              <p className="text-violet-100 font-bold text-xl">
                {formatPesewas(group.welfare_info.available_pool_pesewas)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-violet-300/60 text-xs">Total Contributed</p>
              <p className="text-violet-200 font-semibold text-sm">
                {formatPesewas(group.welfare_info.total_pool_pesewas)}
              </p>
            </div>
          </div>
          {group.welfare_info.total_paid_out_pesewas > 0 && (
            <p className="text-violet-300/60 text-xs">
              Previously paid out: {formatPesewas(group.welfare_info.total_paid_out_pesewas)}
            </p>
          )}

          {/* Submit claim button */}
          {group.my_member_id && onSubmitWelfareClaim && (
            <button
              type="button"
              onClick={() => setWelfareFormOpen(!welfareFormOpen)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                bg-violet-500/20 border border-violet-500/40 text-violet-300 font-semibold text-sm
                hover:bg-violet-500/30 active:scale-95 transition-all min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {welfareFormOpen ? 'Cancel' : 'Submit Welfare Claim'}
            </button>
          )}

          {/* Claim form */}
          {welfareFormOpen && onSubmitWelfareClaim && (
            <div className="space-y-3 bg-violet-500/5 rounded-xl border border-violet-500/20 p-4">
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Claim Type</label>
                <select
                  value={welfareClaimType}
                  onChange={(e) => setWelfareClaimType(e.target.value as WelfareClaimType)}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50
                    focus:border-violet-500 appearance-none cursor-pointer"
                >
                  <option value="medical" className="bg-ghana-dark">Medical</option>
                  <option value="funeral" className="bg-ghana-dark">Funeral</option>
                  <option value="education" className="bg-ghana-dark">Education</option>
                  <option value="emergency" className="bg-ghana-dark">Emergency</option>
                  <option value="other" className="bg-ghana-dark">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Description</label>
                <textarea
                  value={welfareDescription}
                  onChange={(e) => setWelfareDescription(e.target.value)}
                  placeholder="Describe the reason for your claim..."
                  maxLength={500}
                  rows={3}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50
                    focus:border-violet-500 resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-muted text-sm font-medium">Amount Requested (GHS)</label>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={welfareAmount > 0 ? (welfareAmount / 100).toFixed(2) : ''}
                  onChange={(e) => setWelfareAmount(Math.round(parseFloat(e.target.value || '0') * 100))}
                  placeholder="0.00"
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white
                    placeholder-muted text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50
                    focus:border-violet-500"
                />
              </div>
              <button
                type="button"
                disabled={!welfareDescription.trim() || welfareAmount <= 0}
                onClick={() => {
                  onSubmitWelfareClaim({
                    claim_type: welfareClaimType,
                    description: welfareDescription.trim(),
                    amount_requested_pesewas: welfareAmount,
                  });
                  setWelfareFormOpen(false);
                  setWelfareClaimType('medical');
                  setWelfareDescription('');
                  setWelfareAmount(0);
                }}
                className="w-full px-4 py-3 rounded-xl bg-violet-500 text-white font-semibold
                  text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]
                  disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              >
                Submit Claim
              </button>
            </div>
          )}

          {/* Pending claims (creator sees approve/deny) */}
          {group.welfare_info.pending_claims.length > 0 && (
            <div className="space-y-2">
              <p className="text-violet-300/60 text-xs font-medium">Pending Claims</p>
              <div className="space-y-2">
                {group.welfare_info.pending_claims.map((claim) => (
                  <div key={claim.id} className="bg-violet-500/5 rounded-xl border border-violet-500/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 capitalize">
                          {claim.claim_type}
                        </span>
                        <span className="text-violet-100 text-sm font-medium">{claim.claimant_name}</span>
                      </div>
                      <span className="text-violet-200 font-bold text-sm">{formatPesewas(claim.amount_requested_pesewas)}</span>
                    </div>
                    <p className="text-violet-200/80 text-xs">{claim.description}</p>
                    {claim.status === 'approved' || claim.status === 'partially_approved' ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-income font-semibold">
                          Approved: {formatPesewas(claim.amount_approved_pesewas ?? claim.amount_requested_pesewas)}
                        </span>
                        {group.is_creator && onPayWelfareClaim && (
                          <button
                            type="button"
                            onClick={() => onPayWelfareClaim(claim.id)}
                            className="px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold
                              hover:brightness-110 active:scale-95 transition-all min-h-[36px]"
                          >
                            Pay Out
                          </button>
                        )}
                      </div>
                    ) : group.is_creator && onApproveWelfareClaim && onDenyWelfareClaim ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onApproveWelfareClaim(claim.id)}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-income/20 border border-income/40 text-income
                            text-xs font-semibold hover:bg-income/30 active:scale-95 transition-all min-h-[36px]"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onDenyWelfareClaim(claim.id)}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-expense/20 border border-expense/40 text-expense
                            text-xs font-semibold hover:bg-expense/30 active:scale-95 transition-all min-h-[36px]"
                        >
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted">Awaiting leader approval</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved claims history */}
          {group.welfare_info.resolved_claims.length > 0 && (
            <div className="space-y-2">
              <p className="text-violet-300/60 text-xs font-medium">Claim History</p>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {group.welfare_info.resolved_claims.map((claim) => (
                  <div key={claim.id} className="flex items-center justify-between text-xs bg-violet-500/5 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-semibold ${claim.status === 'paid' ? 'text-income' : 'text-expense'}`}>
                        {claim.status === 'paid' ? 'Paid' : 'Denied'}
                      </span>
                      <span className="text-violet-100 truncate">{claim.claimant_name}</span>
                      <span className="text-violet-300/60 capitalize">{claim.claim_type}</span>
                    </div>
                    <span className="text-violet-200 font-bold shrink-0">
                      {formatPesewas(claim.status === 'paid' ? (claim.amount_approved_pesewas ?? claim.amount_requested_pesewas) : claim.amount_requested_pesewas)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bidding: Place Bid button (members only) */}
      {group.variant === 'bidding' && group.my_member_id && onPlaceBid && (
        <button
          type="button"
          onClick={onPlaceBid}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            bg-purple-600/20 border border-purple-500/40 text-purple-300 font-semibold text-sm
            hover:bg-purple-600/30 active:scale-95 transition-all min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          Place Bid
        </button>
      )}

      {/* Payout recipient (not for funeral_fund) */}
      {hasPayoutRecipient && group.variant !== 'funeral_fund' && (
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/20 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11
                   0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21
                   12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-muted text-xs">This round's recipient</p>
            <p className="text-gold font-bold">{group.payout_recipient!.display_name}</p>
          </div>
        </div>
      )}

      {/* Early Payout Request */}
      {earlyPayoutRequest && (
        <EarlyPayoutCard
          request={earlyPayoutRequest}
          isCreator={group.is_creator}
          isRequester={earlyPayoutRequest.requester_member_id === group.my_member_id}
          onVote={onVoteEarlyPayout}
          onPay={onPayEarlyPayout}
          voting={earlyPayoutVoting}
          paying={earlyPayoutPaying}
        />
      )}

      {/* Request Early Payout button (members only, no pending request, not funeral_fund) */}
      {group.variant !== 'funeral_fund' && group.my_member_id && !earlyPayoutRequest && (
        <button
          type="button"
          onClick={onRequestEarlyPayout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            border border-gold/30 text-gold font-semibold text-sm
            hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Request Early Payout
        </button>
      )}

      {/* My badges */}
      <div className="space-y-2">
        <h3 className="text-muted text-xs font-semibold uppercase tracking-wide px-1">
          My Badges
        </h3>
        <BadgeDisplay badges={badges} />
      </div>

      {/* Member list */}
      <div className="space-y-2">
        <h3 className="text-muted text-xs font-semibold uppercase tracking-wide px-1">
          Members ({group.member_count})
        </h3>
        <div className="space-y-2">
          {sortedMembers.map((member) => {
            const isRecipient = group.payout_recipient?.id === member.id;
            const isMe = group.my_member_id === member.id;

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between gap-3 rounded-xl p-3
                  border transition-colors
                  ${isRecipient
                    ? 'bg-gold/10 border-gold/30'
                    : 'bg-ghana-surface border-white/10'
                  }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Payout order */}
                  <span
                    className={`text-xs font-bold w-5 text-center shrink-0
                      ${isRecipient ? 'text-gold' : 'text-muted'}`}
                  >
                    {member.payout_order}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <p className={`font-semibold text-sm truncate
                      ${isRecipient ? 'text-gold' : 'text-white'}`}>
                      {member.display_name}
                      {isMe && (
                        <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>
                      )}
                    </p>
                    {/* Trust score badge */}
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold shrink-0 border
                        ${member.trust_score >= 80
                          ? 'bg-income/15 border-income/40 text-income'
                          : member.trust_score >= 60
                            ? 'bg-gold/15 border-gold/40 text-gold'
                            : member.trust_score >= 40
                              ? 'bg-white/10 border-white/20 text-muted'
                              : 'bg-expense/15 border-expense/40 text-expense'
                        }`}
                      title={`Trust: ${member.trust_score} (${member.trust_label})`}
                    >
                      {member.trust_score}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Contribution status */}
                  {member.has_contributed_this_round ? (
                    onViewReceipt ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(member.id)}
                        className="flex items-center gap-1 text-xs text-income font-medium
                          hover:underline active:scale-95 transition-all min-h-[36px] px-1"
                        aria-label={`View receipt for ${member.display_name}`}
                        title="View receipt"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Paid
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-income font-medium">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Paid
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted font-medium">Pending</span>
                  )}

                  {/* Creator: record contribution button (only for unpaid members) */}
                  {group.is_creator && !member.has_contributed_this_round && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Mark as late contribution">
                        <input
                          type="checkbox"
                          checked={lateMembers.has(member.id)}
                          onChange={(e) => {
                            setLateMembers((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) { next.add(member.id); } else { next.delete(member.id); }
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 accent-expense cursor-pointer"
                          aria-label={`Mark ${member.display_name} as late`}
                        />
                        <span className="text-[10px] text-expense font-medium">Late?</span>
                      </label>
                      {lateMembers.has(member.id) && (
                        <span className="text-[10px] text-expense font-mono">+{formatPesewas(Math.round(group.contribution_pesewas * (group.penalty_percent ?? 2) / 100))}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const isLate = lateMembers.has(member.id);
                          onContribute(member.id, isLate);
                          setLateMembers((prev) => { const next = new Set(prev); next.delete(member.id); return next; });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold
                          text-xs font-semibold hover:bg-gold/30 active:scale-95 transition-all min-h-[36px]"
                      >
                        Record
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Creator actions (not for funeral_fund — payouts handled via claims) */}
      {group.is_creator && group.variant !== 'funeral_fund' && (
        <div className="space-y-3 pt-2">
          <h3 className="text-muted text-xs font-semibold uppercase tracking-wide px-1">
            Creator Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onPayout}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                bg-gold text-ghana-dark font-semibold text-sm hover:brightness-110
                active:scale-95 transition-all min-h-[44px]"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2
                     2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Record Payout
            </button>

            <button
              type="button"
              onClick={onAdvanceRound}
              disabled={!canAdvance}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                border border-white/20 text-white font-semibold text-sm
                hover:bg-white/10 active:scale-95 transition-all min-h-[44px]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
              title={canAdvance ? undefined : 'All members must contribute before advancing'}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Advance Round
            </button>
          </div>
        </div>
      )}

      {/* Member: leave group */}
      {!group.is_creator && group.my_member_id && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onLeave}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              border border-expense/40 text-expense font-semibold text-sm
              hover:bg-expense/10 active:scale-95 transition-all min-h-[44px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Leave Group
          </button>
        </div>
      )}
      </div>
      )}
    </div>
  );
}
