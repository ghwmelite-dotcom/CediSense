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
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} motion-safe:animate-fade-in`}>
      <div className={`${isUser ? 'max-w-[80%]' : 'max-w-[85%]'}`}>
        <div
          className={`px-4 py-3 text-sm leading-relaxed text-white ${
            isUser
              ? 'bg-gold/12 rounded-2xl rounded-br-md border border-gold/[0.08] shadow-[0_1px_8px_rgba(212,168,67,0.06)]'
              : 'bg-white/[0.04] rounded-2xl rounded-bl-md border border-white/[0.04] shadow-[0_1px_8px_rgba(0,0,0,0.2)]'
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
              className="inline-block w-[3px] h-[1em] bg-gold/70 rounded-sm ml-0.5 align-text-bottom
                animate-cursor-blink"
              aria-hidden="true"
            />
          )}
        </div>
        {timestamp && (
          <p
            className={`text-[11px] text-muted/50 mt-1.5 ${
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
