import { useState } from 'react';

interface ChatHeaderProps {
  onClear: () => void;
  hasHistory: boolean;
}

export function ChatHeader({ onClear, hasHistory }: ChatHeaderProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="sticky top-0 z-10 bg-ghana-dark/95 backdrop-blur flex items-center justify-between px-4 py-3 border-b border-white/5">
      <span className="text-white text-lg font-semibold font-display">CediSense AI</span>
      {hasHistory && !confirming && (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-muted text-sm hover:text-white transition-colors"
        >
          Clear
        </button>
      )}
      {confirming && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-muted text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onClear(); setConfirming(false); }}
            className="text-expense text-xs px-2 py-1 rounded bg-expense/10 hover:bg-expense/20"
          >
            Clear All
          </button>
        </div>
      )}
    </div>
  );
}
