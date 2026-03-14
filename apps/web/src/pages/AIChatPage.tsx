import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { streamChat } from '@/lib/streaming';
import type { ChatMessage } from '@cedisense/shared';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatBubble } from '@/components/chat/ChatBubble';
import { ChatInput } from '@/components/chat/ChatInput';
import { WelcomeMessage } from '@/components/chat/WelcomeMessage';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { UsageWarning } from '@/components/chat/UsageWarning';

export function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showUsageWarning, setShowUsageWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Load history on mount
  useEffect(() => {
    api.get<ChatMessage[]>('/ai/history?limit=50')
      .then((data) => {
        setMessages(data);
        setIsLoadingHistory(false);
        setTimeout(() => scrollToBottom('instant'), 50);
      })
      .catch(() => {
        setIsLoadingHistory(false);
      });
  }, [scrollToBottom]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Scroll on new messages or streaming
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  async function handleSend(text: string) {
    setError(null);

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStreamingContent('');

    const controller = new AbortController();
    abortRef.current = controller;

    let fullResponse = '';

    try {
      for await (const event of streamChat(text, controller.signal)) {
        switch (event.type) {
          case 'token':
            fullResponse += event.content;
            setStreamingContent(fullResponse);
            break;
          case 'meta':
            if (event.usage_warning) {
              setShowUsageWarning(true);
            }
            break;
          case 'done': {
            const assistantMsg: ChatMessage = {
              id: `temp-${Date.now()}-ai`,
              role: 'assistant',
              content: fullResponse,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, assistantMsg]);
            setStreamingContent('');
            break;
          }
          case 'error':
            setError(event.message);
            break;
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError('Failed to get response. Try again.');
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  async function handleClear() {
    try {
      await api.delete('/ai/history');
      setMessages([]);
      setStreamingContent('');
      setShowUsageWarning(false);
      setError(null);
    } catch {
      // Silent failure
    }
  }

  const showWelcome = !isLoadingHistory && messages.length === 0 && !isStreaming;

  return (
    <div className="flex flex-col h-full pb-36 md:pb-20">
      <ChatHeader onClear={handleClear} hasHistory={messages.length > 0} />

      {showUsageWarning && (
        <UsageWarning onDismiss={() => setShowUsageWarning(false)} />
      )}

      {/* Message area */}
      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-4 pt-4"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(212,168,67,0.02) 0%, transparent 70%), ' +
            'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(0,107,63,0.02) 0%, transparent 70%)',
        }}
      >
        {isLoadingHistory && (
          <div className="space-y-3 motion-safe:animate-fade-in">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={`h-12 rounded-2xl skeleton ${
                  i % 2 === 0 ? 'w-3/4' : 'w-2/3 ml-auto'
                }`}
              />
            ))}
          </div>
        )}

        {showWelcome && <WelcomeMessage onSuggestion={handleSend} />}

        {!isLoadingHistory && messages.length > 0 && (
          <div className="max-w-2xl mx-auto">
            {messages.map((msg, i) => {
              const prevRole = i > 0 ? messages[i - 1].role : null;
              const gap = prevRole === msg.role ? 'mt-2' : 'mt-5';
              return (
                <div key={msg.id} className={i === 0 ? '' : gap}>
                  <ChatBubble
                    role={msg.role}
                    content={msg.content}
                    timestamp={msg.created_at}
                  />
                </div>
              );
            })}

            {isStreaming && streamingContent && (
              <div className="mt-5">
                <ChatBubble
                  role="assistant"
                  content={streamingContent}
                  isStreaming
                />
              </div>
            )}

            {isStreaming && !streamingContent && (
              <div className="mt-5">
                <TypingIndicator />
              </div>
            )}

            {error && !isStreaming && (
              <div className="mt-5 flex justify-start motion-safe:animate-slide-up">
                <div className="bg-expense/[0.06] border border-expense/[0.1] rounded-2xl rounded-bl-md px-4 py-3 max-w-[85%]">
                  <p className="text-expense/90 text-sm">{error}</p>
                  <button
                    type="button"
                    onClick={() => {
                      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUserMsg) {
                        setMessages((prev) => prev.filter(m => m.id !== lastUserMsg.id));
                        handleSend(lastUserMsg.content);
                      }
                    }}
                    className="text-gold/70 text-xs mt-1.5 hover:text-gold transition-colors"
                  >
                    Tap to retry
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
