import { useState } from 'react';

interface JoinGroupModalProps {
  open: boolean;
  onClose: () => void;
  onJoin: (inviteCode: string) => void;
}

type JoinError = 'invalid' | 'full' | 'already_member' | null;

function errorMessage(error: JoinError): string {
  switch (error) {
    case 'invalid': return 'Invalid invite code. Please check and try again.';
    case 'full': return 'This susu group is already full.';
    case 'already_member': return 'You are already a member of this group.';
    default: return '';
  }
}

interface JoinGroupModalWithErrorProps extends JoinGroupModalProps {
  error?: JoinError;
}

export function JoinGroupModal({ open, onClose, onJoin, error }: JoinGroupModalWithErrorProps) {
  const [inviteCode, setInviteCode] = useState('');

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inviteCode.trim().toUpperCase();
    if (!trimmed) return;
    onJoin(trimmed);
  }

  function handleClose() {
    setInviteCode('');
    onClose();
  }

  function handleInput(value: string) {
    // Uppercase and allow only alphanumeric + hyphen
    setInviteCode(value.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
  }

  const isValid = inviteCode.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-group-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-ghana-dark border border-white/10 rounded-2xl
        shadow-2xl shadow-black/40 p-6 space-y-5">
        <div className="space-y-1">
          <h2 id="join-group-title" className="text-white text-lg font-bold">
            Join Susu Group
          </h2>
          <p className="text-muted text-sm">
            Enter the invite code shared by the group creator.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invite code input */}
          <div className="space-y-1.5">
            <label htmlFor="invite-code" className="text-muted text-sm font-medium">
              Invite Code
            </label>
            <input
              id="invite-code"
              type="text"
              value={inviteCode}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="SUSU-XXXXXXXX"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              required
              className={`w-full bg-white/10 border rounded-xl px-4 py-3 text-white font-mono
                font-semibold tracking-widest text-sm placeholder-muted placeholder-normal
                focus:outline-none focus:ring-2 focus:ring-gold/50
                ${error ? 'border-expense focus:border-expense' : 'border-white/10 focus:border-gold'}`}
            />

            {/* Error message */}
            {error && (
              <div className="flex items-start gap-2 mt-1">
                <svg
                  className="w-4 h-4 text-expense shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-expense text-xs">{errorMessage(error)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white font-semibold
                text-sm hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className="flex-1 px-4 py-3 rounded-xl bg-gold text-ghana-dark font-semibold
                text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]
                disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              Join
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
