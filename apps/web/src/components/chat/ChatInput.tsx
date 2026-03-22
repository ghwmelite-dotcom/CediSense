import { useState, useRef } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const canSend = value.trim().length > 0 && !disabled;

  function handleSubmit() {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  return (
    <div
      className="fixed bottom-20 md:bottom-0 left-0 right-0 z-10
        bg-ghana-dark/90 backdrop-blur-xl border-t border-white/[0.04]
        px-4 py-3"
    >
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances..."
            disabled={disabled}
            maxLength={500}
            className="w-full bg-white/[0.04] border border-transparent
              rounded-xl px-4 py-3 text-white text-sm placeholder:text-muted/50
              transition-all duration-200
              hover:border-white/[0.06]
              focus:outline-none focus:bg-white/[0.06] focus:border-[#FF6B35]/30
              focus:shadow-[0_0_0_3px_rgba(255,107,53,0.08)]
              disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {value.length > 400 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted/50 tabular-nums pointer-events-none">
              {value.length}/500
            </span>
          )}
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Send message"
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0
            transition-all duration-200 focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-[rgba(255,107,53,0.5)]
            ${
              canSend
                ? 'bg-gradient-to-br from-[#FF6B35] to-[#E85D2C] text-white shadow-[0_4px_15px_rgba(255,107,53,0.25)] hover:shadow-[0_6px_20px_rgba(255,107,53,0.35)] active:scale-90'
                : 'bg-white/[0.05] text-muted/40 cursor-not-allowed'
            }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
