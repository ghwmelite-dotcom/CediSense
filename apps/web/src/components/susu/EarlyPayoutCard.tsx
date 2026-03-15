import type { EarlyPayoutRequest, EarlyPayoutStatus } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface EarlyPayoutCardProps {
  request: EarlyPayoutRequest;
  isCreator: boolean;
  isRequester: boolean;
  onVote: (vote: 'for' | 'against') => void;
  onPay: () => void;
  voting?: boolean;
  paying?: boolean;
}

const statusConfig: Record<EarlyPayoutStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending Votes',
    className: 'bg-gold/15 border-gold/40 text-gold',
  },
  approved: {
    label: 'Approved',
    className: 'bg-income/15 border-income/40 text-income',
  },
  denied: {
    label: 'Denied',
    className: 'bg-expense/15 border-expense/40 text-expense',
  },
  paid: {
    label: 'Paid Out',
    className: 'bg-income/15 border-income/40 text-income',
  },
};

export function EarlyPayoutCard({
  request,
  isCreator,
  isRequester,
  onVote,
  onPay,
  voting = false,
  paying = false,
}: EarlyPayoutCardProps) {
  const status = statusConfig[request.status];
  const progress = request.votes_needed > 0
    ? Math.min((request.votes_for / request.votes_needed) * 100, 100)
    : 0;

  const canVote = request.status === 'pending' && !isRequester && request.my_vote === null;
  const canPay = request.status === 'approved' && isCreator;

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-gold shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-white font-semibold text-sm">Early Payout Request</h3>
          </div>
          <p className="text-muted text-xs">
            <span className="text-white font-medium">{request.requester_name}</span>
            {' '}is requesting an early payout
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border shrink-0 ${status.className}`}
        >
          {request.status === 'paid' && (
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status.label}
        </span>
      </div>

      {/* Reason */}
      {request.reason && (
        <div className="bg-white/5 rounded-lg px-3 py-2">
          <p className="text-muted text-xs italic">"{request.reason}"</p>
        </div>
      )}

      {/* Amount details */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          <p className="text-muted text-[11px]">Payout Amount</p>
          <p className="text-white font-bold text-sm">{formatPesewas(request.amount_pesewas)}</p>
        </div>
        <div className="space-y-0.5">
          <p className="text-muted text-[11px]">Premium ({request.premium_percent}%)</p>
          <p className="text-gold font-bold text-sm">+{formatPesewas(request.premium_pesewas)}</p>
        </div>
      </div>

      {/* Vote progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-muted text-xs font-medium">
            Vote Progress
          </p>
          <p className="text-white text-xs font-semibold">
            {request.votes_for}/{request.votes_needed} needed
          </p>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>{request.votes_for} for</span>
          <span>{request.votes_against} against</span>
        </div>
      </div>

      {/* My vote indicator */}
      {request.my_vote !== null && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${
          request.my_vote === 'for'
            ? 'bg-income/10 text-income border border-income/20'
            : 'bg-expense/10 text-expense border border-expense/20'
        }`}>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          You voted {request.my_vote === 'for' ? 'in favor' : 'against'}
        </div>
      )}

      {/* Vote buttons */}
      {canVote && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onVote('for')}
            disabled={voting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              bg-income/15 border border-income/40 text-income font-semibold text-sm
              hover:bg-income/25 active:scale-95 transition-all min-h-[44px]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {voting ? 'Voting...' : 'Vote For'}
          </button>
          <button
            type="button"
            onClick={() => onVote('against')}
            disabled={voting}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              bg-expense/15 border border-expense/40 text-expense font-semibold text-sm
              hover:bg-expense/25 active:scale-95 transition-all min-h-[44px]
              disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            <svg className="w-4 h-4 rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
            </svg>
            {voting ? 'Voting...' : 'Vote Against'}
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
            bg-gold text-ghana-dark font-semibold text-sm hover:brightness-110
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
          {paying ? 'Processing...' : `Pay Out ${formatPesewas(request.amount_pesewas + request.premium_pesewas)}`}
        </button>
      )}
    </div>
  );
}
