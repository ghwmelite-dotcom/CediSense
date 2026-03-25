import { useRef, useState, type ChangeEvent } from 'react';
import type { SusuMessage } from '@cedisense/shared';
import { MentionPopup } from './MentionPopup';

interface ChatInputProps {
  content: string;
  sending: boolean;
  uploading: boolean;
  uploadProgress: number;
  replyTo: SusuMessage | null;
  searchOpen: boolean;
  onContentChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onFileSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onCancelReply: () => void;
  onToggleSearch: () => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onVoicePress?: () => void;
  members?: Array<{ member_id: string; display_name: string; user_id: string }>;
}

export function ChatInput({
  content,
  sending,
  uploading,
  uploadProgress,
  replyTo,
  searchOpen,
  onContentChange,
  onKeyDown,
  onSend,
  onFileSelect,
  onCancelReply,
  onToggleSearch,
  inputRef,
  onVoicePress,
  members = [],
}: ChatInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPos, setMentionPos] = useState({ bottom: 0, left: 0 });

  function handleInputChangeWithMention(e: React.ChangeEvent<HTMLTextAreaElement>) {
    // Forward to parent handler
    onContentChange(e);

    // Detect @mention
    const value = e.target.value;
    const cursorPos = e.target.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      const rect = e.target.getBoundingClientRect();
      setMentionPos({ bottom: window.innerHeight - rect.top + 8, left: rect.left });
    } else {
      setMentionQuery(null);
    }
  }

  function handleMentionSelect(member: { display_name: string }) {
    const value = (inputRef as React.RefObject<HTMLTextAreaElement>).current?.value ?? '';
    const cursorPos = (inputRef as React.RefObject<HTMLTextAreaElement>).current?.selectionStart ?? value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const textAfterCursor = value.slice(cursorPos);
    const beforeMention = textBeforeCursor.replace(/@\w*$/, '');
    const newValue = `${beforeMention}@${member.display_name} ${textAfterCursor}`;

    // Create a synthetic event to update via parent handler
    const nativeEvent = new Event('input', { bubbles: true });
    const textarea = (inputRef as React.RefObject<HTMLTextAreaElement>).current;
    if (textarea) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeSetter?.call(textarea, newValue);
      textarea.dispatchEvent(nativeEvent);
    }

    setMentionQuery(null);
    (inputRef as React.RefObject<HTMLTextAreaElement>).current?.focus();
  }

  return (
    <>
      {/* Reply preview bar */}
      {replyTo && (
        <div className="px-4 md:px-5 py-3 border-t border-white/10 bg-ghana-surface/90 flex items-center gap-2">
          <div className="flex-1 border-l-2 border-gold/50 pl-2 min-w-0">
            <p className="text-[11px] text-gold font-medium">Replying to {replyTo.sender_name}</p>
            <p className="text-[11px] text-muted truncate">{replyTo.content}</p>
          </div>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-muted hover:text-white transition-colors p-1 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Cancel reply"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Upload progress bar */}
      {uploading && (
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-gold transition-all duration-300 ease-out"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}

      {/* Input bar */}
      <div className="sticky bottom-0 border-t border-white/10 bg-ghana-surface/80 backdrop-blur-md px-3 md:px-5 py-3 md:py-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,application/pdf"
          className="hidden"
          onChange={(e) => void onFileSelect(e)}
        />
        <div className="flex items-end gap-1.5 md:gap-2.5">
          {/* Search icon */}
          <button
            type="button"
            onClick={onToggleSearch}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-white hover:bg-white/5 transition-all shrink-0"
            aria-label="Search messages"
            title="Search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <textarea
            ref={inputRef}
            value={content}
            onChange={handleInputChangeWithMention}
            onKeyDown={onKeyDown}
            placeholder="Type a message"
            rows={2}
            maxLength={500}
            aria-label="Chat message"
            className="flex-1 resize-none rounded-2xl bg-white/5 border border-white/15 text-white
              placeholder:text-muted text-[15px] px-4 py-3 focus:outline-none focus:border-gold/50
              focus:ring-1 focus:ring-gold/30 transition-all min-h-[48px] max-h-[160px]"
          />
          {/* Paperclip / attach file button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Attach file"
            title="Attach image or PDF"
            className="w-11 h-11 md:w-12 md:h-12 flex items-center justify-center rounded-xl text-muted hover:text-gold
              hover:bg-white/5 active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            {uploading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            )}
          </button>
          {/* Voice recording button */}
          {onVoicePress && (
            <button
              type="button"
              onClick={onVoicePress}
              className="p-2 text-white/40 hover:text-white/70 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Record voice message"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={onSend}
            disabled={!content.trim() || sending}
            aria-label="Send message"
            className="w-12 h-12 flex items-center justify-center rounded-xl bg-gold text-ghana-dark
              font-bold hover:brightness-110 active:scale-95 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shrink-0"
          >
            {sending ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted mt-1 text-right">
          {content.length}/500 {'\u00B7'} Enter to send
        </p>
      </div>
      {/* Mention popup */}
      {mentionQuery !== null && members.length > 0 && (
        <MentionPopup
          query={mentionQuery}
          members={members}
          onSelect={handleMentionSelect}
          onClose={() => setMentionQuery(null)}
          position={mentionPos}
        />
      )}
    </>
  );
}
