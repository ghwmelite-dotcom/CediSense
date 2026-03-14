import { useState } from 'react';

interface SyncIndicatorProps {
  syncCount: number;
  isSyncing: boolean;
  onSync: () => void;
}

export function SyncIndicator({ syncCount, isSyncing, onSync }: SyncIndicatorProps) {
  const [dismissed, setDismissed] = useState(false);

  if ((syncCount === 0 && !isSyncing) || dismissed) return null;

  return (
    <div className="fixed bottom-24 md:bottom-6 right-4 z-40 motion-safe:animate-scale-in">
      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        className="group flex items-center gap-2 px-3 py-2 rounded-full
          bg-ghana-surface/90 backdrop-blur-sm border border-[#1F1F35]/60
          shadow-card hover:shadow-card-hover transition-all duration-200
          text-xs font-medium text-muted hover:text-text-primary"
      >
        {isSyncing ? (
          <>
            <span className="w-3 h-3 border-[1.5px] border-gold/40 border-t-gold rounded-full animate-spin" />
            <span className="text-gold/80">Syncing...</span>
          </>
        ) : (
          <>
            <span className="w-1.5 h-1.5 bg-gold/70 rounded-full" />
            <span>{syncCount} pending</span>
          </>
        )}
        {/* Dismiss button */}
        {!isSyncing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setDismissed(true);
            }}
            className="ml-1 w-4 h-4 flex items-center justify-center rounded-full
              text-muted-dim hover:text-muted hover:bg-white/[0.06] transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </button>
    </div>
  );
}
