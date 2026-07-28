import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface InviteQRModalProps {
  open: boolean;
  onClose: () => void;
  groupName: string;
  inviteCode: string;
  /** Optional rich details for the WhatsApp invite card. */
  amountLabel?: string;
  memberLabel?: string;
}

export function InviteQRModal({ open, onClose, groupName, inviteCode, amountLabel, memberLabel }: InviteQRModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState(false);

  if (!open || !inviteCode) return null;

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

  function handleWhatsApp() {
    const lines = [
      `🤝 Join my susu group "${groupName}" on CediSense!`,
      amountLabel ? `💰 ${amountLabel}` : null,
      memberLabel ? `👥 ${memberLabel}` : null,
      ``,
      `Tap to join: ${inviteUrl}`,
      `(or enter code ${inviteCode} in the app)`,
    ].filter((l) => l !== null);
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
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

        {/* WhatsApp — the dominant invite channel */}
        <button
          type="button"
          onClick={handleWhatsApp}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
            bg-[#25D366] text-ghana-dark font-semibold text-sm hover:brightness-110
            active:scale-95 transition-all min-h-[44px]"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.617-2.39-1.47-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Invite via WhatsApp
        </button>
      </div>
    </div>
  );
}
