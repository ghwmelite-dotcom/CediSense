import { renderMarkdown } from '@/lib/markdown';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  isStreaming?: boolean;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function ChatBubble({ role, content, timestamp, isStreaming }: ChatBubbleProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div className={`${isUser ? 'max-w-[80%]' : 'max-w-[85%]'}`}>
        <div
          className={`px-4 py-2.5 text-sm leading-relaxed text-white transition-shadow duration-200 ${
            isUser
              ? 'bg-gold/20 rounded-2xl rounded-br-md shadow-[0_2px_12px_rgba(212,168,67,0.12)] border border-gold/15'
              : 'bg-ghana-surface rounded-2xl rounded-bl-md border border-white/10 shadow-[0_2px_12px_rgba(0,0,0,0.35)]'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <div
              className="prose-chat"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          )}
          {isStreaming && (
            <span
              className="inline-block w-[3px] h-[1em] bg-gold rounded-sm ml-0.5 align-text-bottom
                animate-cursor-blink"
              aria-hidden="true"
            />
          )}
        </div>
        {timestamp && (
          <p
            className={`text-xs text-muted mt-1 transition-opacity ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {formatRelativeTime(timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}
