import type { FuneralClaim, FuneralClaimStatus } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface FuneralClaimCardProps {
  claim: FuneralClaim;
  isCreator: boolean;
  isClaimant: boolean;
  onVote: (vote: 'approve' | 'deny') => void;
  onPay: () => void;
  voting?: boolean;
  paying?: boolean;
}

const statusConfig: Record<FuneralClaimStatus, { label: string; className: string }> = {
  pending: {
    label: 'Awaiting Votes',
    className: 'bg-amber-800/30 border-amber-700/50 text-amber-300',
  },
  approved: {
    label: 'Approved',
    className: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300',
  },
  denied: {
    label: 'Denied',
    className: 'bg-red-900/30 border-red-700/50 text-red-300',
  },
  paid: {
    label: 'Paid Out',
    className: 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300',
  },
};

export function FuneralClaimCard({
  claim,
  isCreator,
  isClaimant,
  onVote,
  onPay,
  voting = false,
  paying = false,
}: FuneralClaimCardProps) {
  const status = statusConfig[claim.status];
  const progress = claim.approval_threshold > 0
    ? Math.min((claim.approved_by_count / claim.approval_threshold) * 100, 100)
    : 0;

  const canVote = claim.status === 'pending' && !isClaimant && claim.my_vote === null;
  const canPay = claim.status === 'approved' && isCreator;

  return (
    <div className="bg-neutral-900/80 border border-neutral-700/50 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Candle icon — somber */}
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
            <h3 className="text-neutral-100 font-semibold text-sm">Bereavement Claim</h3>
          </div>
          <p className="text-neutral-400 text-xs">
            <span className="text-neutral-200 font-medium">{claim.claimant_name}</span>
            {' '}has submitted a claim
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${status.className}`}
        >
          {claim.status === 'paid' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status.label}
        </span>
      </div>

      {/* Deceased details */}
      <div className="bg-neutral-800/60 border border-neutral-700/30 rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-neutral-500 text-[11px] uppercase tracking-wide font-medium">Deceased</p>
            <p className="text-neutral-100 font-semibold text-sm">{claim.deceased_name}</p>
          </div>
          <div className="text-right space-y-0.5">
            <p className="text-neutral-500 text-[11px] uppercase tracking-wide font-medium">Relationship</p>
            <p className="text-neutral-200 text-sm">{claim.relationship}</p>
          </div>
        </div>
        {claim.description && (
          <p className="text-neutral-400 text-xs italic border-t border-neutral-700/30 pt-2">
            "{claim.description}"
          </p>
        )}
      </div>

      {/* Payout amount */}
      <div className="flex items-center justify-between bg-amber-900/15 border border-amber-800/30 rounded-lg px-4 py-3">
        <span className="text-amber-300/70 text-xs font-medium">Emergency Payout</span>
        <span className="text-amber-200 font-bold text-lg">{formatPesewas(claim.amount_pesewas)}</span>
      </div>

      {/* Vote progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-neutral-400 text-xs font-medium">Approval Progress</p>
          <p className="text-neutral-200 text-xs font-semibold">
            {claim.approved_by_count}/{claim.approval_threshold} needed
          </p>
        </div>
        <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500/80 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-neutral-500">
          <span>{claim.approved_by_count} approved</span>
          <span>{claim.denied_by_count} denied</span>
        </div>
      </div>

      {/* My vote indicator */}
      {claim.my_vote !== null && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
          claim.my_vote === 'approve'
            ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30'
            : 'bg-red-900/20 text-red-400 border border-red-800/30'
        }`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          You voted to {claim.my_vote === 'approve' ? 'approve' : 'deny'}
        </div>
      )}

      {/* Vote buttons */}
      {canVote && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onVote('approve')}
            disabled={voting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              bg-emerald-900/25 border border-emerald-700/40 text-emerald-300 font-semibold text-sm
              hover:bg-emerald-900/40 active:scale-95 transition-all min-h-[44px]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {voting ? 'Voting...' : 'Approve'}
          </button>
          <button
            type="button"
            onClick={() => onVote('deny')}
            disabled={voting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              bg-red-900/25 border border-red-700/40 text-red-300 font-semibold text-sm
              hover:bg-red-900/40 active:scale-95 transition-all min-h-[44px]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            {voting ? 'Voting...' : 'Deny'}
          </button>
        </div>
      )}

      {/* Pay Out button (creator only, approved only) */}
      {canPay && (
        <button
          type="button"
          onClick={onPay}
          disabled={paying}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            bg-amber-700 text-neutral-900 font-semibold text-sm hover:bg-amber-600
            active:scale-95 transition-all min-h-[44px]
            disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2
                 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          {paying ? 'Processing...' : `Pay Out ${formatPesewas(claim.amount_pesewas)}`}
        </button>
      )}
    </div>
  );
}
