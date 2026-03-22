interface CreatorActionsProps {
  canAdvance: boolean;
  onPayout: () => void;
  onAdvanceRound: () => void;
}

export function CreatorActions({ canAdvance, onPayout, onAdvanceRound }: CreatorActionsProps) {
  return (
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
  );
}
