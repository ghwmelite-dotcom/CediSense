import { useState, useEffect, useRef, useCallback } from 'react';
import type { SusuMessage } from '@cedisense/shared';
import { api } from '../../lib/api';

interface GroupChatProps {
  groupId: string;
  currentUserId: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return 'yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const LIMIT = 50;

export function GroupChat({ groupId, currentUserId }: GroupChatProps) {
  const [messages, setMessages] = useState<SusuMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oldestIdRef = useRef<string | null>(null);
  const newestIdRef = useRef<string | null>(null);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const msgs = await api.get<SusuMessage[]>(
        `/susu/groups/${groupId}/messages?limit=${LIMIT}`
      );
      setMessages(msgs);
      setHasOlder(msgs.length === LIMIT);
      if (msgs.length > 0) {
        oldestIdRef.current = msgs[0].id;
        newestIdRef.current = msgs[msgs.length - 1].id;
      }
    } catch {
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const pollForNew = useCallback(async () => {
    try {
      const fresh = await api.get<SusuMessage[]>(
        `/susu/groups/${groupId}/messages?limit=${LIMIT}`
      );
      if (fresh.length === 0) return;

      const currentNewest = newestIdRef.current;
      if (currentNewest === null || fresh[fresh.length - 1].id !== currentNewest) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = fresh.filter((m) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          const merged = [...prev, ...newMsgs];
          newestIdRef.current = merged[merged.length - 1].id;
          return merged;
        });
      }
    } catch {
      // silent fail on poll
    }
  }, [groupId]);

  const loadOlder = useCallback(async () => {
    if (!oldestIdRef.current || loadingOlder) return;
    setLoadingOlder(true);
    const scrollEl = listRef.current;
    const prevScrollHeight = scrollEl?.scrollHeight ?? 0;

    try {
      const older = await api.get<SusuMessage[]>(
        `/susu/groups/${groupId}/messages?limit=${LIMIT}&before=${oldestIdRef.current}`
      );
      if (older.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const filtered = older.filter((m) => !existingIds.has(m.id));
          const merged = [...filtered, ...prev];
          oldestIdRef.current = merged[0].id;
          return merged;
        });
        setHasOlder(older.length === LIMIT);
        requestAnimationFrame(() => {
          if (scrollEl) {
            scrollEl.scrollTop = scrollEl.scrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasOlder(false);
      }
    } catch {
      // silent fail
    } finally {
      setLoadingOlder(false);
    }
  }, [groupId, loadingOlder]);

  const sendMessage = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError(null);
    try {
      const msg = await api.post<SusuMessage>(`/susu/groups/${groupId}/messages`, {
        content: trimmed,
      });
      setMessages((prev) => {
        const merged = [...prev, msg];
        newestIdRef.current = msg.id;
        if (prev.length === 0) oldestIdRef.current = msg.id;
        return merged;
      });
      setContent('');
    } catch {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  }, [content, groupId, sending]);

  // Initial load
  useEffect(() => {
    void fetchInitial();
  }, [fetchInitial]);

  // Auto-scroll to bottom after initial load
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loading]);

  // Scroll to bottom after sending own message
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.sender_user_id === currentUserId) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages, currentUserId]);

  // Polling every 10 seconds
  useEffect(() => {
    pollRef.current = setInterval(() => { void pollForNew(); }, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [pollForNew]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-[520px] rounded-2xl overflow-hidden border border-white/10 bg-ghana-surface">
      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 overscroll-contain"
      >
        {/* Load older button */}
        {hasOlder && !loading && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={() => void loadOlder()}
              disabled={loadingOlder}
              className="text-xs text-gold font-semibold px-3 py-1.5 rounded-full border border-gold/30
                hover:bg-gold/10 active:scale-95 transition-all disabled:opacity-50 min-h-[36px]"
            >
              {loadingOlder ? 'Loading…' : 'Load older messages'}
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className="h-10 rounded-2xl bg-white/10 animate-pulse"
                  style={{ width: `${40 + (i % 3) * 20}%` }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 pt-16">
            <svg
              className="w-8 h-8 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-muted text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {/* Messages */}
        {!loading &&
          messages.map((msg) => {
            const isOwn = msg.sender_user_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {/* Sender name (others only) */}
                {!isOwn && (
                  <span className="text-[11px] text-muted font-medium px-1">
                    {msg.sender_name}
                  </span>
                )}
                <div
                  className={`max-w-[75%] text-sm py-2 px-3 leading-relaxed break-words
                    ${
                      isOwn
                        ? 'bg-gold/15 text-white rounded-2xl rounded-br-md'
                        : 'bg-[#1D1D30] text-white rounded-2xl rounded-bl-md border border-white/[0.08]'
                    }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-muted px-1">
                  {formatRelativeTime(msg.created_at)}
                </span>
              </div>
            );
          })}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 text-xs text-expense font-medium bg-expense/10 border-t border-expense/20">
          {error}
        </div>
      )}

      {/* Input bar */}
      <div className="sticky bottom-0 border-t border-white/10 bg-ghana-surface/80 backdrop-blur-md px-4 py-3">
        <div className="flex items-end gap-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message the group…"
            rows={1}
            maxLength={500}
            aria-label="Chat message"
            className="flex-1 resize-none rounded-xl bg-white/5 border border-white/15 text-white
              placeholder:text-muted text-sm px-3 py-2.5 focus:outline-none focus:border-gold/50
              focus:ring-1 focus:ring-gold/30 transition-all min-h-[44px] max-h-[120px]"
          />
          <button
            type="button"
            onClick={() => void sendMessage()}
            disabled={!content.trim() || sending}
            aria-label="Send message"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-gold text-ghana-dark
              font-bold hover:brightness-110 active:scale-95 transition-all
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 shrink-0"
          >
            {sending ? (
              <svg
                className="w-4 h-4 animate-spin"
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
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted mt-1 text-right">
          {content.length}/500 · Enter to send
        </p>
      </div>
    </div>
  );
}
