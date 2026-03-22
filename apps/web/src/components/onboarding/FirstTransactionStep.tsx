interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export function FirstTransactionStep({ onComplete, onSkip }: Props) {
  return (
    <div className="text-center">
      <div className="text-4xl mb-3">📝</div>
      <h2 className="text-xl font-semibold text-white">Add your first transaction</h2>
      <p className="text-muted text-sm mt-1">Choose how you'd like to get started</p>

      <div className="flex flex-col gap-3 mt-6 text-left">
        <button
          onClick={onComplete}
          className="flex items-center gap-3 p-4 rounded-xl border-2 border-gold bg-ghana-surface hover:bg-ghana-surface/80 transition-colors"
        >
          <span className="text-2xl">📲</span>
          <div>
            <div className="text-white font-semibold text-sm">Paste MoMo SMS</div>
            <div className="text-muted text-xs mt-0.5">
              Copy a transaction SMS from your messages and paste it here
            </div>
          </div>
        </button>

        <button
          onClick={onComplete}
          className="flex items-center gap-3 p-4 rounded-xl border border-ghana-surface bg-ghana-surface hover:border-muted/30 transition-colors"
        >
          <span className="text-2xl">✏️</span>
          <div>
            <div className="text-white font-semibold text-sm">Enter Manually</div>
            <div className="text-muted text-xs mt-0.5">
              Type in a recent transaction — amount, category, description
            </div>
          </div>
        </button>
      </div>

      <div className="bg-[#FF6B35]/10 border border-[#FF6B35] rounded-lg p-3 mt-4 text-left">
        <div className="text-[#FF6B35] text-xs font-semibold">Tip</div>
        <div className="text-muted text-xs mt-1">
          You can always import more transactions later from Settings → Import SMS
        </div>
      </div>

      <div className="mt-6">
        <button
          onClick={onSkip}
          className="text-muted text-sm hover:text-white transition-colors"
        >
          Skip — go to dashboard
        </button>
      </div>
    </div>
  );
}
