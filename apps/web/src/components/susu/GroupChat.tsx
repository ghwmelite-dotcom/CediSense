import { useState, useEffect, useRef, useCallback } from 'react';
import type { SusuMessage, TypingUser } from '@cedisense/shared';
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

function formatTypingText(users: TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].display_name} is typing`;
  if (users.length === 2) return `${users[0].display_name} and ${users[1].display_name} are typing`;
  return `${users[0].display_name} and ${users.length - 1} others are typing`;
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
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const oldestIdRef = useRef<string | null>(null);
  const newestIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);

  // ─── Mark as read ─────────────────────────────────────────────────────────
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await api.post(`/susu/groups/${groupId}/messages/read`, {
        last_message_id: messageId,
      });
    } catch {
      // silent
    }
  }, [groupId]);

  // ─── Fetch initial messages ───────────────────────────────────────────────
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
        // Mark latest as read
        void markAsRead(msgs[msgs.length - 1].id);
      }
    } catch {
      setError('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  }, [groupId, markAsRead]);

  // ─── Long-poll loop ───────────────────────────────────────────────────────
  const pollLoop = useCallback(async () => {
    while (mountedRef.current) {
      const afterId = newestIdRef.current;
      if (!afterId) {
        // No messages yet — short delay then retry
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      try {
        const result = await api.get<SusuMessage[]>(
          `/susu/groups/${groupId}/messages/poll?after=${afterId}&timeout=25`
        );
        if (!mountedRef.current) break;

        if (result && result.length > 0) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newMsgs = result.filter((m: SusuMessage) => !existingIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            const merged = [...prev, ...newMsgs];
            newestIdRef.current = merged[merged.length - 1].id;
            return merged;
          });
          // Mark new messages as read
          const lastNew = result[result.length - 1];
          if (lastNew) {
            void markAsRead(lastNew.id);
          }
        }
      } catch {
        // On error wait a bit before retrying
        if (mountedRef.current) {
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }, [groupId, markAsRead]);

  // ─── Load older messages ──────────────────────────────────────────────────
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

  // ─── Send message ─────────────────────────────────────────────────────────
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
      // Mark as read
      void markAsRead(msg.id);
    } catch {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  }, [content, groupId, sending, markAsRead]);

  // ─── Typing indicator: send ───────────────────────────────────────────────
  const sendTypingIndicator = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentRef.current < 3000) return;
    lastTypingSentRef.current = now;
    api.post(`/susu/groups/${groupId}/typing`, {}).catch(() => {});
  }, [groupId]);

  // ─── Typing indicator: poll ───────────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!mountedRef.current) return;
      try {
        const users = await api.get<TypingUser[]>(
          `/susu/groups/${groupId}/typing`
        );
        if (mountedRef.current) {
          setTypingUsers(users ?? []);
        }
      } catch {
        // silent
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [groupId]);

  // ─── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    void fetchInitial();
    return () => {
      mountedRef.current = false;
      if (pollAbortRef.current) pollAbortRef.current.abort();
    };
  }, [fetchInitial]);

  // ─── Start long-poll after initial load ───────────────────────────────────
  useEffect(() => {
    if (!loading) {
      void pollLoop();
    }
  }, [loading, pollLoop]);

  // ─── Auto-scroll to bottom after initial load ─────────────────────────────
  useEffect(() => {
    if (!loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [loading]);

  // ─── Scroll to bottom after new messages ──────────────────────────────────
  const prevLengthRef = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.sender_user_id === currentUserId) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // If user is near bottom, auto-scroll for incoming messages too
        const el = listRef.current;
        if (el) {
          const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          if (nearBottom) {
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }
        }
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages, currentUserId]);

  // ─── Handle input ─────────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setContent(e.target.value);
    if (e.target.value.trim()) {
      sendTypingIndicator();
    }
  }

  // Clean up typing timer
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

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
              {loadingOlder ? 'Loading\u2026' : 'Load older messages'}
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
                className={`flex flex-col gap-0.5 animate-[fadeSlideIn_0.2s_ease-out] ${isOwn ? 'items-end' : 'items-start'}`}
              >
                {/* Sender name (others only) */}
                {!isOwn && (
                  <span className="text-[11px] text-muted font-medium px-1">
                    {msg.sender_name}
                  </span>
                )}

                {/* Reply preview */}
                {msg.reply_to_id && msg.reply_to_content && (
                  <div className={`max-w-[75%] text-[11px] text-muted/80 px-3 py-1 rounded-lg
                    ${isOwn ? 'bg-gold/8 border-l-2 border-gold/40' : 'bg-white/5 border-l-2 border-white/20'}`}>
                    <span className="font-medium">{msg.reply_to_sender}</span>
                    <p className="truncate">{msg.reply_to_content}</p>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`max-w-[75%] text-sm py-2 px-3 leading-relaxed break-words
                    ${msg.is_deleted
                      ? 'bg-white/5 text-muted italic rounded-2xl border border-white/[0.06]'
                      : isOwn
                        ? 'bg-gold/15 text-white rounded-2xl rounded-br-md'
                        : 'bg-[#1D1D30] text-white rounded-2xl rounded-bl-md border border-white/[0.08]'
                    }`}
                >
                  {msg.is_deleted ? 'This message was deleted' : msg.content}
                  {msg.edited_at && !msg.is_deleted && (
                    <span className="text-[10px] text-muted/60 ml-1.5">(edited)</span>
                  )}
                </div>

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex gap-1 px-1">
                    {msg.reactions.map((r) => (
                      <span
                        key={r.emoji}
                        className={`text-xs px-1.5 py-0.5 rounded-full border
                          ${r.reacted_by_me
                            ? 'bg-gold/15 border-gold/30 text-gold'
                            : 'bg-white/5 border-white/10 text-muted'
                          }`}
                      >
                        {r.emoji} {r.count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Timestamp + read receipt */}
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[10px] text-muted">
                    {formatRelativeTime(msg.created_at)}
                  </span>
                  {isOwn && msg.read_by_count > 0 && (
                    <span className="text-[10px] text-muted/60">
                      {'\u2713'} Seen by {msg.read_by_count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-1.5 border-t border-white/5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex gap-0.5">
              <span className="w-1 h-1 rounded-full bg-muted animate-[bounce_1.4s_infinite_0ms]" />
              <span className="w-1 h-1 rounded-full bg-muted animate-[bounce_1.4s_infinite_200ms]" />
              <span className="w-1 h-1 rounded-full bg-muted animate-[bounce_1.4s_infinite_400ms]" />
            </span>
            <span>{formatTypingText(typingUsers)}</span>
          </div>
        </div>
      )}

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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the group\u2026"
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
          {content.length}/500 {'\u00B7'} Enter to send
        </p>
      </div>
    </div>
  );
}
