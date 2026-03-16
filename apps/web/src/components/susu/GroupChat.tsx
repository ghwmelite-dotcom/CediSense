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
const QUICK_EMOJIS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

export function GroupChat({ groupId, currentUserId }: GroupChatProps) {
  const [messages, setMessages] = useState<SusuMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);

  // Reply state
  const [replyTo, setReplyTo] = useState<SusuMessage | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Message menu state
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  // Reaction picker state
  const [reactionPickerId, setReactionPickerId] = useState<string | null>(null);

  // Search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SusuMessage[]>([]);
  const [searching, setSearching] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const oldestIdRef = useRef<string | null>(null);
  const newestIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);
  const pollAbortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
          const lastNew = result[result.length - 1];
          if (lastNew) {
            void markAsRead(lastNew.id);
          }
        }
      } catch {
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
      const payload: { content: string; reply_to_id?: string } = { content: trimmed };
      if (replyTo) {
        payload.reply_to_id = replyTo.id;
      }
      const msg = await api.post<SusuMessage>(`/susu/groups/${groupId}/messages`, payload);
      setMessages((prev) => {
        const merged = [...prev, msg];
        newestIdRef.current = msg.id;
        if (prev.length === 0) oldestIdRef.current = msg.id;
        return merged;
      });
      setContent('');
      setReplyTo(null);
      void markAsRead(msg.id);
    } catch {
      setError('Failed to send message.');
    } finally {
      setSending(false);
    }
  }, [content, groupId, sending, markAsRead, replyTo]);

  // ─── React to message ────────────────────────────────────────────────────
  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const result = await api.post<{ message_id: string; reactions: SusuMessage['reactions'] }>(
        `/susu/groups/${groupId}/messages/${messageId}/react`,
        { emoji }
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === result.message_id ? { ...m, reactions: result.reactions } : m
        )
      );
    } catch {
      // silent
    }
    setReactionPickerId(null);
  }, [groupId]);

  // ─── Edit message ─────────────────────────────────────────────────────────
  const startEditing = useCallback((msg: SusuMessage) => {
    setEditingId(msg.id);
    setEditContent(msg.content);
    setMenuOpenId(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    try {
      const updated = await api.put<SusuMessage>(
        `/susu/groups/${groupId}/messages/${editingId}`,
        { content: editContent.trim() }
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m))
      );
    } catch {
      setError('Failed to edit message.');
    }
    setEditingId(null);
    setEditContent('');
  }, [editingId, editContent, groupId]);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
  }, []);

  // ─── Delete message ───────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (messageId: string) => {
    setMenuOpenId(null);
    if (!confirm('Delete this message?')) return;
    try {
      await api.delete(`/susu/groups/${groupId}/messages/${messageId}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId ? { ...m, content: '', is_deleted: true } : m
        )
      );
    } catch {
      setError('Failed to delete message.');
    }
  }, [groupId]);

  // ─── Search messages ──────────────────────────────────────────────────────
  const searchMessages = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.get<SusuMessage[]>(
        `/susu/groups/${groupId}/messages/search?q=${encodeURIComponent(q)}`
      );
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [groupId]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void searchMessages(value);
    }, 300);
  }, [searchMessages]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  // ─── Scroll to message (from search) ─────────────────────────────────────
  const scrollToMessage = useCallback((messageId: string) => {
    closeSearch();
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${messageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-gold/50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-gold/50'), 2000);
      }
    });
  }, [closeSearch]);

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

  // ─── Close menus on outside click ─────────────────────────────────────────
  useEffect(() => {
    function handleClick() {
      setMenuOpenId(null);
      setReactionPickerId(null);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

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

  // Clean up timers
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Check if a message is within 15 min for editing
  function canEdit(msg: SusuMessage): boolean {
    if (msg.sender_user_id !== currentUserId || msg.is_deleted) return false;
    const created = new Date(msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z');
    return (Date.now() - created.getTime()) < 15 * 60 * 1000;
  }

  return (
    <div className="flex flex-col h-[520px] rounded-2xl overflow-hidden border border-white/10 bg-ghana-surface">
      {/* Header area with search toggle */}
      {searchOpen && (
        <div className="px-4 py-2.5 border-b border-white/10 bg-ghana-surface/90 backdrop-blur-md flex items-center gap-2">
          <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            placeholder="Search messages..."
            autoFocus
            className="flex-1 bg-transparent text-sm text-white placeholder:text-muted outline-none"
          />
          {searching && (
            <svg className="w-4 h-4 text-muted animate-spin shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          )}
          <button
            type="button"
            onClick={closeSearch}
            className="text-muted hover:text-white transition-colors p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Close search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Search results overlay */}
      {searchOpen && searchQuery.length >= 2 && (
        <div className="border-b border-white/10 bg-[#1D1D30]/95 backdrop-blur-md max-h-[260px] overflow-y-auto">
          {searchResults.length === 0 && !searching && (
            <p className="text-center text-muted text-xs py-4">No messages found</p>
          )}
          {searchResults.map((msg) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => scrollToMessage(msg.id)}
              className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-medium text-gold">{msg.sender_name}</span>
                <span className="text-[10px] text-muted">{formatRelativeTime(msg.created_at)}</span>
              </div>
              <p className="text-xs text-white/80 truncate">{msg.content}</p>
            </button>
          ))}
        </div>
      )}

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
            const isEditing = editingId === msg.id;

            return (
              <div
                key={msg.id}
                id={`msg-${msg.id}`}
                className={`group/msg flex flex-col gap-0.5 animate-[fadeSlideIn_0.2s_ease-out] transition-all rounded-lg ${isOwn ? 'items-end' : 'items-start'}`}
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

                {/* Message bubble + action row */}
                <div className={`relative flex items-center gap-1 max-w-[85%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Message bubble */}
                  {isEditing ? (
                    <div className="flex flex-col gap-1.5 w-full max-w-[75%]">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        maxLength={500}
                        rows={2}
                        autoFocus
                        className="w-full resize-none rounded-xl bg-white/5 border border-gold/40 text-white text-sm px-3 py-2
                          focus:outline-none focus:ring-1 focus:ring-gold/30 min-h-[44px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            void saveEdit();
                          }
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-[11px] text-muted px-2 py-1 rounded-md hover:bg-white/5 min-h-[28px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => void saveEdit()}
                          disabled={!editContent.trim()}
                          className="text-[11px] text-gold font-semibold px-2 py-1 rounded-md hover:bg-gold/10
                            disabled:opacity-40 min-h-[28px]"
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`text-sm py-2 px-3 leading-relaxed break-words
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
                  )}

                  {/* Action buttons (hover) — only for non-deleted, non-editing */}
                  {!msg.is_deleted && !isEditing && (
                    <div className={`flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                      {/* Reply button */}
                      <button
                        type="button"
                        onClick={() => {
                          setReplyTo(msg);
                          inputRef.current?.focus();
                        }}
                        className="p-1 text-muted hover:text-white transition-colors rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                        aria-label="Reply"
                        title="Reply"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                      </button>

                      {/* Reaction button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReactionPickerId(reactionPickerId === msg.id ? null : msg.id);
                            setMenuOpenId(null);
                          }}
                          className="p-1 text-muted hover:text-white transition-colors rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                          aria-label="React"
                          title="React"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </button>

                        {/* Quick reaction picker */}
                        {reactionPickerId === msg.id && (
                          <div
                            className={`absolute z-20 bottom-full mb-1 flex items-center gap-0.5 bg-[#1D1D30] rounded-full p-1 border border-white/10 shadow-lg
                              ${isOwn ? 'right-0' : 'left-0'}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {QUICK_EMOJIS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => void toggleReaction(msg.id, emoji)}
                                className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-base"
                                aria-label={`React with ${emoji}`}
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* "..." menu for own messages */}
                      {isOwn && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === msg.id ? null : msg.id);
                              setReactionPickerId(null);
                            }}
                            className="p-1 text-muted hover:text-white transition-colors rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                            aria-label="Message options"
                            title="More"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="5" r="2" />
                              <circle cx="12" cy="12" r="2" />
                              <circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>

                          {/* Message menu popover */}
                          {menuOpenId === msg.id && (
                            <div
                              className="absolute z-20 bottom-full mb-1 right-0 bg-[#1D1D30] rounded-xl border border-white/10 shadow-lg overflow-hidden min-w-[120px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {canEdit(msg) && (
                                <button
                                  type="button"
                                  onClick={() => startEditing(msg)}
                                  className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 transition-colors flex items-center gap-2 min-h-[36px]"
                                >
                                  <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                  Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void deleteMessage(msg.id)}
                                className="w-full text-left px-3 py-2 text-xs text-expense hover:bg-expense/10 transition-colors flex items-center gap-2 min-h-[36px]"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Reactions */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1">
                    {msg.reactions.map((r) => (
                      <button
                        key={r.emoji}
                        type="button"
                        onClick={() => void toggleReaction(msg.id, r.emoji)}
                        className={`text-xs px-1.5 py-0.5 rounded-full border cursor-pointer transition-colors min-h-[24px]
                          ${r.reacted_by_me
                            ? 'bg-gold/15 border-gold/30 text-gold hover:bg-gold/25'
                            : 'bg-white/5 border-white/10 text-muted hover:bg-white/10'
                          }`}
                      >
                        {r.emoji} {r.count}
                      </button>
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

      {/* Reply preview bar */}
      {replyTo && (
        <div className="px-4 py-2 border-t border-white/10 bg-ghana-surface/90 flex items-center gap-2">
          <div className="flex-1 border-l-2 border-gold/50 pl-2 min-w-0">
            <p className="text-[11px] text-gold font-medium">Replying to {replyTo.sender_name}</p>
            <p className="text-[11px] text-muted truncate">{replyTo.content}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="text-muted hover:text-white transition-colors p-1 shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
            aria-label="Cancel reply"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="sticky bottom-0 border-t border-white/10 bg-ghana-surface/80 backdrop-blur-md px-4 py-3">
        <div className="flex items-end gap-2">
          {/* Search icon */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
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
