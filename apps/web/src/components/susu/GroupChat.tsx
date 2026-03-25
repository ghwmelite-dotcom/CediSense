import { useState, useEffect, useRef, useCallback, type ChangeEvent } from 'react';
import type { SusuMessage, TypingUser, PinnedMessage } from '@cedisense/shared';
import { api } from '../../lib/api';
import { ChatMessage } from './ChatMessage';
import { ChatSearchBar } from './ChatSearchBar';
import { ChatInput } from './ChatInput';
import { PinnedMessageBanner } from './PinnedMessageBanner';
import { VoiceRecorder } from './VoiceRecorder';

const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function formatTypingText(users: TypingUser[]): string {
  if (users.length === 0) return '';
  if (users.length === 1) return `${users[0].display_name} is typing`;
  if (users.length === 2) return `${users[0].display_name} and ${users[1].display_name} are typing`;
  return `${users[0].display_name} and ${users.length - 1} others are typing`;
}

const LIMIT = 50;

interface GroupChatProps {
  groupId: string;
  currentUserId: string;
  isCreator?: boolean;
  members?: Array<{ member_id: string; display_name: string; user_id: string }>;
}

export function GroupChat({ groupId, currentUserId, isCreator = false, members = [] }: GroupChatProps) {
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

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Pinned messages state
  const [pins, setPins] = useState<PinnedMessage[]>([]);

  // Unread separator
  const [lastReadId, setLastReadId] = useState<string | null>(null);

  // Presence: last active timestamp
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);

  // Voice recording state
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

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
      if (!mountedRef.current) return;
      setMessages(msgs);
      setHasOlder(msgs.length === LIMIT);
      if (msgs.length > 0) {
        oldestIdRef.current = msgs[0].id;
        newestIdRef.current = msgs[msgs.length - 1].id;
        // Save last-read ID for unread separator (before new messages arrive via poll)
        setLastReadId(msgs[msgs.length - 1].id);
        void markAsRead(msgs[msgs.length - 1].id);
      }
    } catch {
      if (!mountedRef.current) return;
      setError('Failed to load messages.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [groupId, markAsRead]);

  // ─── Long-poll loop ───────────────────────────────────────────────────────
  const pollLoop = useCallback(async () => {
    while (mountedRef.current) {
      const afterId = newestIdRef.current;
      if (!afterId) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!mountedRef.current) return;
        continue;
      }

      try {
        const result = await api.get<SusuMessage[]>(
          `/susu/groups/${groupId}/messages/poll?after=${afterId}&timeout=25`
        );
        if (!mountedRef.current) return;

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
        if (!mountedRef.current) return;
        await new Promise((r) => setTimeout(r, 5000));
        if (!mountedRef.current) return;
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
      if (!mountedRef.current) return;
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
      if (mountedRef.current) setLoadingOlder(false);
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

  // ─── Upload file ─────────────────────────────────────────────────────────
  const handleFileSelect = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, GIF, and PDF files are allowed.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File too large. Maximum size is 5 MB.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (content.trim()) {
        formData.append('content', content.trim());
      }

      const msg = await api.upload<SusuMessage>(
        `/susu/groups/${groupId}/messages/upload`,
        formData,
        (percent) => setUploadProgress(percent),
      );

      setMessages((prev) => {
        const merged = [...prev, msg];
        newestIdRef.current = msg.id;
        if (prev.length === 0) oldestIdRef.current = msg.id;
        return merged;
      });
      setContent('');
      void markAsRead(msg.id);
    } catch {
      setError('Failed to upload file.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [content, groupId, markAsRead]);

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
    if (now - lastTypingSentRef.current < 4000) return;
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
    }, 5000);

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

  // ─── Fetch pinned messages ──────────────────────────────────────────────
  useEffect(() => {
    api.get<PinnedMessage[]>(`/susu/groups/${groupId}/pins`)
      .then(setPins)
      .catch(() => {});
  }, [groupId]);

  // ─── Fetch presence (last active timestamp) ────────────────────────────
  useEffect(() => {
    api.get<{ last_active_at: string | null }>(`/susu/groups/${groupId}/presence`)
      .then((data) => setLastActiveAt(data.last_active_at))
      .catch(() => {});
  }, [groupId]);

  // ─── Pin / Unpin handlers ─────────────────────────────────────────────
  async function handlePin(messageId: string) {
    try {
      await api.post(`/susu/groups/${groupId}/pin`, { message_id: messageId });
      const updated = await api.get<PinnedMessage[]>(`/susu/groups/${groupId}/pins`);
      setPins(updated);
    } catch {
      setError('Failed to pin message.');
    }
  }

  async function handleUnpin(pinId: string) {
    try {
      await api.delete(`/susu/groups/${groupId}/pin/${pinId}`);
      setPins((prev) => prev.filter((p) => p.id !== pinId));
    } catch {
      setError('Failed to unpin message.');
    }
  }

  // ─── Voice recording handler ──────────────────────────────────────────
  async function handleVoiceRecordComplete(blob: Blob, duration: number) {
    setShowVoiceRecorder(false);
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('content', `Voice message (${duration}s)`);

    try {
      setUploading(true);
      const msg = await api.upload<SusuMessage>(
        `/susu/groups/${groupId}/messages/upload`,
        formData,
      );
      setMessages((prev) => {
        const merged = [...prev, msg];
        newestIdRef.current = msg.id;
        if (prev.length === 0) oldestIdRef.current = msg.id;
        return merged;
      });
      void markAsRead(msg.id);
    } catch {
      setError('Failed to send voice message.');
    } finally {
      setUploading(false);
    }
  }

  // Check if a message is within 15 min for editing
  function canEditMsg(msg: SusuMessage): boolean {
    if (msg.sender_user_id !== currentUserId || msg.is_deleted) return false;
    const created = new Date(msg.created_at.endsWith('Z') ? msg.created_at : msg.created_at + 'Z');
    return (Date.now() - created.getTime()) < 15 * 60 * 1000;
  }

  // Message grouping: same sender, within 2 min, previous not deleted
  function shouldGroup(msg: SusuMessage, prevMsg: SusuMessage | null): boolean {
    if (!prevMsg) return false;
    if (msg.sender_user_id !== prevMsg.sender_user_id) return false;
    if (prevMsg.is_deleted) return false;
    const diff = new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime();
    return diff < 2 * 60 * 1000;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-260px)] sm:h-[calc(100vh-220px)] md:h-[calc(100vh-180px)] min-h-[320px] rounded-2xl overflow-hidden border border-white/10 bg-ghana-surface">
      {/* Search bar */}
      <ChatSearchBar
        searchOpen={searchOpen}
        searchQuery={searchQuery}
        searchResults={searchResults}
        searching={searching}
        onSearchInput={handleSearchInput}
        onCloseSearch={closeSearch}
        onScrollToMessage={scrollToMessage}
      />

      {/* Pinned messages banner */}
      {pins.length > 0 && (
        <PinnedMessageBanner
          pins={pins}
          isCreator={isCreator}
          onUnpin={handleUnpin}
          onScrollTo={(messageId) => {
            const el = document.getElementById(`msg-${messageId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }}
        />
      )}

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-4 md:px-6 py-5 space-y-1 overscroll-contain"
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
          messages.map((msg, i) => {
            const isOwn = msg.sender_user_id === currentUserId;
            const prevMsg = messages[i - 1] ?? null;

            // Show "while you were away" separator at the boundary
            const showAwaySeparator = lastActiveAt && prevMsg
              && prevMsg.sender_user_id !== currentUserId
              && msg.sender_user_id !== currentUserId
              && new Date(prevMsg.created_at) <= new Date(lastActiveAt)
              && new Date(msg.created_at) > new Date(lastActiveAt);

            return (
              <div key={msg.id}>
                {/* While you were away separator */}
                {showAwaySeparator && (
                  <div className="flex items-center gap-3 py-3 px-4">
                    <div className="flex-1 h-px bg-gold/20" />
                    <span className="text-gold/60 text-[11px] font-medium whitespace-nowrap">While you were away</span>
                    <div className="flex-1 h-px bg-gold/20" />
                  </div>
                )}

                {/* Unread separator */}
                {lastReadId && prevMsg?.id === lastReadId && msg.id !== lastReadId && (
                  <div className="flex items-center gap-3 py-2 px-4">
                    <div className="flex-1 h-px bg-expense/30" />
                    <span className="text-expense text-[11px] font-medium">New messages</span>
                    <div className="flex-1 h-px bg-expense/30" />
                  </div>
                )}
                <ChatMessage
                  msg={msg}
                  isOwn={isOwn}
                  isGrouped={shouldGroup(msg, prevMsg)}
                  isCreator={isCreator}
                  onPin={handlePin}
                  isEditing={editingId === msg.id}
                  editContent={editContent}
                  onEditContentChange={setEditContent}
                  onSaveEdit={() => void saveEdit()}
                  onCancelEdit={cancelEdit}
                  onReply={(m) => {
                    setReplyTo(m);
                    inputRef.current?.focus();
                  }}
                  onToggleReaction={(id, emoji) => void toggleReaction(id, emoji)}
                  onStartEditing={startEditing}
                  onDeleteMessage={(id) => void deleteMessage(id)}
                  onOpenLightbox={setLightboxUrl}
                  canEdit={canEditMsg(msg)}
                  menuOpenId={menuOpenId}
                  reactionPickerId={reactionPickerId}
                  onSetMenuOpenId={setMenuOpenId}
                  onSetReactionPickerId={setReactionPickerId}
                />
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

      {/* Chat input / Voice recorder */}
      {showVoiceRecorder ? (
        <div className="border-t border-white/10 bg-ghana-surface/80 backdrop-blur-md px-4 py-3">
          <VoiceRecorder
            onRecordComplete={handleVoiceRecordComplete}
            onCancel={() => setShowVoiceRecorder(false)}
          />
        </div>
      ) : (
        <ChatInput
          content={content}
          sending={sending}
          uploading={uploading}
          uploadProgress={uploadProgress}
          replyTo={replyTo}
          searchOpen={searchOpen}
          onContentChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onSend={() => void sendMessage()}
          onFileSelect={handleFileSelect}
          onCancelReply={() => setReplyTo(null)}
          onToggleSearch={() => setSearchOpen(!searchOpen)}
          inputRef={inputRef}
          onVoicePress={() => setShowVoiceRecorder(true)}
          members={members}
        />
      )}

      {/* Image lightbox overlay */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            aria-label="Close image"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Full-size attachment"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
