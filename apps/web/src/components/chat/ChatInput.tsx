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
    <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-ghana-dark/95 backdrop-blur border-t border-white/5 px-4 py-3 z-10">
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
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm
              placeholder-muted focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
              disabled:opacity-50"
          />
          {value.length > 400 && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
              {value.length}/500
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSend}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
            canSend ? 'bg-gold text-ghana-black' : 'bg-white/20 text-muted'
          }`}
          aria-label="Send message"
        >
          ↑
        </button>
      </div>
    </div>
  );
}
