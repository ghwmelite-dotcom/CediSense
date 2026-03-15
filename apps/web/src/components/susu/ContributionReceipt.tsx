import type { ContributionReceipt } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

export interface ContributionReceiptProps {
  receipt: ContributionReceipt;
  open: boolean;
  onClose: () => void;
}

function formatReceiptDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function buildShareText(receipt: ContributionReceipt): string {
  return [
    'CediSense - Susu Contribution Receipt',
    `Receipt No: ${receipt.receipt_number}`,
    `Date: ${formatReceiptDate(receipt.contributed_at)}`,
    `Group: ${receipt.group_name}`,
    `Member: ${receipt.member_name}`,
    `Round: ${receipt.round} of ${receipt.total_rounds}`,
    `Amount: ${formatPesewas(receipt.amount_pesewas)}`,
    'Status: Confirmed',
  ].join('\n');
}

export function ContributionReceipt({ receipt, open, onClose }: ContributionReceiptProps) {
  if (!open) return null;

  async function handleShare() {
    const text = buildShareText(receipt);
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CediSense Receipt ${receipt.receipt_number}`,
          text,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(text).catch(() => {});
        }
      }
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {/* Print-only styles injected via a style tag; media query scopes them */}
      <style>{`
        @media print {
          body > *:not(.receipt-print-root) { display: none !important; }
          .receipt-print-root {
            position: static !important;
            background: white !important;
            color: black !important;
          }
          .receipt-no-print { display: none !important; }
        }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 receipt-print-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-title"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm receipt-no-print"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Receipt card */}
        <div
          className="relative w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl shadow-black/50
            border border-white/10"
          style={{ background: '#1a1a2e' }}
        >
          {/* Gold accent bar at top */}
          <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #d4a017 0%, #f0c040 60%, #d4a017 100%)' }} />

          <div className="p-6 space-y-5">
            {/* Header */}
            <div className="text-center space-y-1">
              <p className="text-gold font-bold text-xl tracking-wide">₵ CediSense</p>
              <p className="text-white/70 text-sm font-medium">Susu Contribution Receipt</p>
            </div>

            {/* Dashed divider */}
            <div className="border-t border-dashed border-white/20" />

            {/* Receipt metadata */}
            <div className="space-y-3">
              <ReceiptRow label="Receipt" value={receipt.receipt_number} mono />
              <ReceiptRow label="Date" value={formatReceiptDate(receipt.contributed_at)} />
            </div>

            {/* Dashed divider */}
            <div className="border-t border-dashed border-white/20" />

            {/* Contribution details */}
            <div className="space-y-3">
              <ReceiptRow label="Group" value={receipt.group_name} />
              <ReceiptRow label="Member" value={receipt.member_name} />
              <ReceiptRow
                label="Round"
                value={`${receipt.round} of ${receipt.total_rounds}`}
              />
              <div className="flex items-center justify-between gap-4">
                <span className="text-white/60 text-sm font-medium shrink-0">Amount</span>
                <span className="text-gold font-bold text-lg font-mono">
                  {formatPesewas(receipt.amount_pesewas)}
                </span>
              </div>
            </div>

            {/* Dashed divider */}
            <div className="border-t border-dashed border-white/20" />

            {/* Status */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-white/60 text-sm font-medium">Status</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: '#4ade80' }}>
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Confirmed
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1 receipt-no-print" id="receipt-title">
              <button
                type="button"
                onClick={handleShare}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                  border border-gold/40 text-gold font-semibold text-sm
                  hover:bg-gold/10 active:scale-95 transition-all min-h-[44px]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                  border border-white/20 text-white/80 font-semibold text-sm
                  hover:bg-white/10 active:scale-95 transition-all min-h-[44px]"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl
                  bg-white/10 text-white font-semibold text-sm
                  hover:bg-white/20 active:scale-95 transition-all min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Internal helper ──────────────────────────────────────────────────────────

interface ReceiptRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function ReceiptRow({ label, value, mono = false }: ReceiptRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-white/60 text-sm font-medium shrink-0">{label}</span>
      <span
        className={`text-white text-sm text-right break-all ${
          mono ? 'font-mono font-bold tracking-wider text-gold' : 'font-medium'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
