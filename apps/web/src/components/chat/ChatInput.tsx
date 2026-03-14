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
        bg-ghana-dark/80 backdrop-blur-xl border-t border-white/[0.07]
        px-4 py-3"
    >
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        {/* Glassmorphism input wrapper */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.slice(0, 500))}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your finances…"
            disabled={disabled}
            maxLength={500}
            className="w-full bg-white/[0.07] backdrop-blur-sm border border-white/[0.12]
              rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-muted
              transition-all duration-200
              focus:outline-none focus:bg-white/10 focus:border-gold/50
              focus:ring-2 focus:ring-gold/20 focus:shadow-[0_0_0_1px_rgba(212,168,67,0.15)]
              disabled:opacity-40 disabled:cursor-not-allowed"
          />
          {value.length > 400 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted tabular-nums pointer-events-none">
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
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0
            transition-all duration-200 focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-gold/60
            ${
              canSend
                ? 'bg-gold text-ghana-black shadow-[0_0_0_0_rgba(212,168,67,0)] hover:brightness-110 hover:shadow-[0_0_18px_rgba(212,168,67,0.45)] active:scale-90'
                : 'bg-white/10 text-muted cursor-not-allowed'
            }`}
        >
          {/* Up-arrow SVG for crispness */}
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
