import type { SusuMessage } from '@cedisense/shared';

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

interface ChatSearchBarProps {
  searchOpen: boolean;
  searchQuery: string;
  searchResults: SusuMessage[];
  searching: boolean;
  onSearchInput: (value: string) => void;
  onCloseSearch: () => void;
  onScrollToMessage: (messageId: string) => void;
}

export function ChatSearchBar({
  searchOpen,
  searchQuery,
  searchResults,
  searching,
  onSearchInput,
  onCloseSearch,
  onScrollToMessage,
}: ChatSearchBarProps) {
  if (!searchOpen) return null;

  return (
    <>
      <div className="px-4 py-2.5 border-b border-white/10 bg-ghana-surface/90 backdrop-blur-md flex items-center gap-2">
        <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchInput(e.target.value)}
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
          onClick={onCloseSearch}
          className="text-muted hover:text-white transition-colors p-1 min-h-[32px] min-w-[32px] flex items-center justify-center"
          aria-label="Close search"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Search results overlay */}
      {searchQuery.length >= 2 && (
        <div className="border-b border-white/10 bg-[#1D1D30]/95 backdrop-blur-md max-h-[260px] overflow-y-auto">
          {searchResults.length === 0 && !searching && (
            <p className="text-center text-muted text-xs py-4">No messages found</p>
          )}
          {searchResults.map((msg) => (
            <button
              key={msg.id}
              type="button"
              onClick={() => onScrollToMessage(msg.id)}
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
    </>
  );
}
