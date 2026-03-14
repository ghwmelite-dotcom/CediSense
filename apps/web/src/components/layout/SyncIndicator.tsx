interface SyncIndicatorProps {
  syncCount: number;
  isSyncing: boolean;
  onSync: () => void;
}

export function SyncIndicator({ syncCount, isSyncing, onSync }: SyncIndicatorProps) {
  if (syncCount === 0 && !isSyncing) return null;

  return (
    <button
      type="button"
      onClick={onSync}
      disabled={isSyncing}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 text-gold text-xs font-medium"
    >
      {isSyncing ? (
        <>
          <span className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <span className="w-2 h-2 bg-gold rounded-full" />
          {syncCount} pending
        </>
      )}
    </button>
  );
}
