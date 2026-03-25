import { useEffect, useCallback } from 'react';

export interface ConfirmModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4 text-white"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
}: ConfirmModalProps) {
  // Close on Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose();
    },
    [onClose, loading],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleKeyDown]);

  if (!open) return null;

  const confirmColors =
    variant === 'danger'
      ? 'bg-expense hover:bg-expense/80 focus-visible:ring-expense/50'
      : 'bg-gold hover:bg-gold/80 focus-visible:ring-gold/50';

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => {
        if (!loading) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-description"
    >
      {/* Card — stop propagation so clicks inside don't close */}
      <div
        className="bg-ghana-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          id="confirm-modal-title"
          className="text-lg font-semibold text-white mb-2"
        >
          {title}
        </h2>

        {/* Description */}
        <p id="confirm-modal-description" className="text-sm text-white/60 mb-6">
          {description}
        </p>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          {/* Cancel */}
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
          >
            Cancel
          </button>

          {/* Confirm */}
          <button
            onClick={onConfirm}
            disabled={loading}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors',
              'disabled:opacity-60 disabled:cursor-not-allowed',
              'focus-visible:outline-none focus-visible:ring-2',
              confirmColors,
            ].join(' ')}
          >
            {loading && <Spinner />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
