import { useState } from 'react';

interface OfflineBannerProps {
  syncCount: number;
}

export function OfflineBanner({ syncCount }: OfflineBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="bg-gold/10 border-b border-gold/20 px-4 py-2 flex items-center justify-between">
      <div>
        <p className="text-gold text-sm font-medium">You're offline</p>
        <p className="text-gold/70 text-xs">
          {syncCount > 0
            ? `${syncCount} change${syncCount > 1 ? 's' : ''} will sync when connected`
            : 'Changes will sync when connected'}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-gold/50 hover:text-gold text-sm ml-2"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
