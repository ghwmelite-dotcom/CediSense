import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface InviteQRModalProps {
  open: boolean;
  onClose: () => void;
  groupName: string;
  inviteCode: string;
}

export function InviteQRModal({ open, onClose, groupName, inviteCode }: InviteQRModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);

  if (!open) return null;

  const inviteUrl = `https://cedisense.pages.dev/join?code=${encodeURIComponent(inviteCode)}`;

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = inviteUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join ${groupName} on CediSense`,
          text: `Join my susu group "${groupName}" on CediSense! Use invite code: ${inviteCode}`,
          url: inviteUrl,
        });
      } catch (err) {
        // User cancelled share — ignore AbortError
        if (err instanceof Error && err.name !== 'AbortError') {
          setShareError(true);
          setTimeout(() => setShareError(false), 2000);
        }
      }
    } else {
      // Fallback: copy link instead
      await handleCopyLink();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-qr-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-ghana-dark border border-white/10 rounded-2xl
        shadow-2xl shadow-black/40 p-6 space-y-5">

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-muted hover:text-white
            hover:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Group name */}
        <div className="text-center pr-8">
          <h2 id="invite-qr-title" className="text-white text-lg font-bold">
            {groupName}
          </h2>
          <p className="text-muted text-sm mt-1">
            Share this QR code to invite members
          </p>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="p-4 bg-white rounded-2xl">
            <QRCodeSVG
              value={inviteUrl}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Invite code text */}
        <div className="text-center">
          <p className="text-muted text-xs font-medium uppercase tracking-wide mb-1">
            Invite Code
          </p>
          <p className="text-gold font-mono font-bold text-lg tracking-widest">
            {inviteCode}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              bg-gold text-ghana-dark font-semibold text-sm hover:brightness-110
              active:scale-95 transition-all min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            {copied ? 'Copied!' : 'Copy Link'}
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl
              border border-gold/40 text-gold font-semibold text-sm
              hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            {shareError ? 'Failed' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
