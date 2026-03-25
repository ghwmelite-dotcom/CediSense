import { useState } from 'react';

interface PinnedMessage {
  id: string;
  message_content: string;
  message_sender: string;
  pinned_at: string;
}

interface PinnedMessageBannerProps {
  pins: PinnedMessage[];
  onUnpin?: (pinId: string) => void;
  onScrollTo?: (messageId: string) => void;
  isCreator: boolean;
}

function formatPinDate(dateStr: string): string {
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

export function PinnedMessageBanner({ pins, onUnpin, onScrollTo, isCreator }: PinnedMessageBannerProps) {
  const [expanded, setExpanded] = useState(false);

  if (pins.length === 0) return null;

  return (
    <div className="border-b border-white/10 bg-[#14142A]/80 backdrop-blur-sm">
      {/* Collapsed header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-2 px-4 py-2.5 min-h-[44px] text-left transition-colors hover:bg-white/[0.04] cursor-pointer"
        aria-expanded={expanded}
        aria-label={`${pins.length} pinned message${pins.length > 1 ? 's' : ''}`}
      >
        <svg className="w-4 h-4 text-gold shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l0 4m-4 2a4 4 0 008 0V6H8v2zm-3 4l2 8h10l2-8M12 18v4" />
        </svg>
        <span className="text-sm font-medium text-gold">
          {pins.length} pinned message{pins.length > 1 ? 's' : ''}
        </span>
        <svg
          className={`w-4 h-4 text-muted ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded list */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: expanded ? `${pins.length * 72 + 8}px` : '0px', opacity: expanded ? 1 : 0 }}
      >
        <div className="px-4 pb-2 flex flex-col gap-1">
          {pins.map((pin) => (
            <div
              key={pin.id}
              className="flex items-start gap-3 rounded-lg bg-white/[0.04] px-3 py-2.5 group"
            >
              <button
                type="button"
                onClick={() => onScrollTo?.(pin.id)}
                className="flex-1 text-left min-w-0 cursor-pointer"
                aria-label={`Scroll to pinned message from ${pin.message_sender}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gold">{pin.message_sender}</span>
                  <span className="text-[10px] text-muted">{formatPinDate(pin.pinned_at)}</span>
                </div>
                <p className="text-xs text-muted mt-0.5 leading-relaxed">
                  {truncate(pin.message_content, 80)}
                </p>
              </button>

              {isCreator && onUnpin && (
                <button
                  type="button"
                  onClick={() => onUnpin(pin.id)}
                  className="shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-md text-muted hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Unpin message from ${pin.message_sender}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
