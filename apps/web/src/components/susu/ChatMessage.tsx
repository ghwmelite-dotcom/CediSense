import type { SusuMessage } from '@cedisense/shared';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

const QUICK_EMOJIS = ['\u{1F44D}', '\u2764\uFE0F', '\u{1F602}', '\u{1F62E}', '\u{1F622}', '\u{1F525}'];

interface ChatMessageProps {
  msg: SusuMessage;
  isOwn: boolean;
  isEditing: boolean;
  editContent: string;
  onEditContentChange: (value: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onReply: (msg: SusuMessage) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onStartEditing: (msg: SusuMessage) => void;
  onDeleteMessage: (messageId: string) => void;
  onOpenLightbox: (url: string) => void;
  canEdit: boolean;
  menuOpenId: string | null;
  reactionPickerId: string | null;
  onSetMenuOpenId: (id: string | null) => void;
  onSetReactionPickerId: (id: string | null) => void;
}

export function ChatMessage({
  msg,
  isOwn,
  isEditing,
  editContent,
  onEditContentChange,
  onSaveEdit,
  onCancelEdit,
  onReply,
  onToggleReaction,
  onStartEditing,
  onDeleteMessage,
  onOpenLightbox,
  canEdit,
  menuOpenId,
  reactionPickerId,
  onSetMenuOpenId,
  onSetReactionPickerId,
}: ChatMessageProps) {
  return (
    <div
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
              onChange={(e) => onEditContentChange(e.target.value)}
              maxLength={500}
              rows={2}
              autoFocus
              className="w-full resize-none rounded-xl bg-white/5 border border-gold/40 text-white text-sm px-3 py-2
                focus:outline-none focus:ring-1 focus:ring-gold/30 min-h-[44px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onSaveEdit();
                }
                if (e.key === 'Escape') onCancelEdit();
              }}
            />
            <div className="flex gap-1.5 justify-end">
              <button
                type="button"
                onClick={onCancelEdit}
                className="text-[11px] text-muted px-2 py-1 rounded-md hover:bg-white/5 min-h-[28px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSaveEdit}
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
            className={`text-sm leading-relaxed break-words overflow-hidden
              ${msg.is_deleted
                ? 'bg-white/5 text-muted italic rounded-2xl border border-white/[0.06] py-2 px-3'
                : isOwn
                  ? `bg-gold/15 text-white rounded-2xl rounded-br-md ${msg.attachment_url ? 'p-1' : 'py-2 px-3'}`
                  : `bg-[#1D1D30] text-white rounded-2xl rounded-bl-md border border-white/[0.08] ${msg.attachment_url ? 'p-1' : 'py-2 px-3'}`
              }`}
          >
            {msg.is_deleted ? (
              'This message was deleted'
            ) : (
              <>
                {/* Image attachment */}
                {msg.attachment_url && msg.attachment_type?.startsWith('image/') && (
                  <button
                    type="button"
                    onClick={() => onOpenLightbox(`/api/v1${msg.attachment_url}`)}
                    className="block w-full cursor-pointer"
                    aria-label={`View image: ${msg.attachment_name}`}
                  >
                    <img
                      src={`/api/v1${msg.attachment_url}`}
                      alt={msg.attachment_name ?? 'Attached image'}
                      className="max-w-[300px] w-full rounded-xl border border-white/[0.06] object-cover"
                      loading="lazy"
                    />
                  </button>
                )}
                {/* PDF attachment */}
                {msg.attachment_url && msg.attachment_type === 'application/pdf' && (
                  <a
                    href={`/api/v1${msg.attachment_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-[#1D1D30] rounded-xl p-3 border border-white/[0.06] hover:bg-white/5 transition-colors min-w-[200px]"
                  >
                    <svg className="w-8 h-8 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-white truncate">{msg.attachment_name ?? 'Document.pdf'}</p>
                      <p className="text-[10px] text-muted">{msg.attachment_size ? formatFileSize(msg.attachment_size) : 'PDF'}</p>
                    </div>
                    <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                )}
                {/* Text content */}
                {msg.content && (
                  <span className={msg.attachment_url ? 'block px-2 py-1.5 text-sm' : ''}>
                    {msg.content}
                  </span>
                )}
              </>
            )}
            {msg.edited_at && !msg.is_deleted && (
              <span className="text-[10px] text-muted/60 ml-1.5">(edited)</span>
            )}
          </div>
        )}

        {/* Action buttons (hover) */}
        {!msg.is_deleted && !isEditing && (
          <div className={`flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Reply button */}
            <button
              type="button"
              onClick={() => onReply(msg)}
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
                  onSetReactionPickerId(reactionPickerId === msg.id ? null : msg.id);
                  onSetMenuOpenId(null);
                }}
                className="p-1 text-muted hover:text-white transition-colors rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                aria-label="React"
                title="React"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

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
                      onClick={() => onToggleReaction(msg.id, emoji)}
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
                    onSetMenuOpenId(menuOpenId === msg.id ? null : msg.id);
                    onSetReactionPickerId(null);
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

                {menuOpenId === msg.id && (
                  <div
                    className="absolute z-20 bottom-full mb-1 right-0 bg-[#1D1D30] rounded-xl border border-white/10 shadow-lg overflow-hidden min-w-[120px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onStartEditing(msg)}
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
                      onClick={() => onDeleteMessage(msg.id)}
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
              onClick={() => onToggleReaction(msg.id, r.emoji)}
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
}
