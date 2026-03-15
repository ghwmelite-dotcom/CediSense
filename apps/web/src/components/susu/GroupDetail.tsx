import { useState } from 'react';
import type { SusuGroupWithDetails } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { InviteQRModal } from './InviteQRModal';

interface GroupDetailProps {
  group: SusuGroupWithDetails;
  onContribute: (memberId: string) => void;
  onPayout: () => void;
  onAdvanceRound: () => void;
  onLeave: () => void;
  /** Called when the user taps "View Receipt" for a member who has contributed */
  onViewReceipt?: (memberId: string) => void;
}

export function GroupDetail({
  group,
  onContribute,
  onPayout,
  onAdvanceRound,
  onLeave,
  onViewReceipt,
}: GroupDetailProps) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

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

  return (
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

      {/* Round indicator */}
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

      {/* Payout recipient */}
      {hasPayoutRecipient && (
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
                    <button
                      type="button"
                      onClick={() => onContribute(member.id)}
                      className="px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold
                        text-xs font-semibold hover:bg-gold/30 active:scale-95 transition-all min-h-[36px]"
                    >
                      Record
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Creator actions */}
      {group.is_creator && (
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
  );
}
