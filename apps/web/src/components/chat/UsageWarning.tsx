interface UsageWarningProps {
  onDismiss: () => void;
}

export function UsageWarning({ onDismiss }: UsageWarningProps) {
  return (
    <div className="mx-4 mt-2 bg-gold/10 border border-gold/20 rounded-lg px-4 py-2 flex items-center justify-between">
      <p className="text-sm text-gold">You've used most of your daily AI chats</p>
      <button
        type="button"
        onClick={onDismiss}
        className="text-gold/60 hover:text-gold text-sm ml-2 shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
