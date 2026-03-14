import { getAccessToken } from './api';

const API_BASE = '/api/v1';

export interface SSETokenEvent {
  type: 'token';
  content: string;
}

export interface SSEMetaEvent {
  type: 'meta';
  usage_warning: boolean;
  daily_count: number;
}

export interface SSEDoneEvent {
  type: 'done';
}

export interface SSEErrorEvent {
  type: 'error';
  message: string;
}

export type SSEEvent = SSETokenEvent | SSEMetaEvent | SSEDoneEvent | SSEErrorEvent;

/**
 * Parse a chunk of SSE text into events.
 * Handles line buffering for chunks split across boundaries.
 * Returns [parsed events, remaining buffer].
 */
export function parseSSEChunk(buffer: string, chunk: string): [SSEEvent[], string] {
  const text = buffer + chunk;
  const events: SSEEvent[] = [];
  const lines = text.split('\n');

  // Last element may be incomplete — keep it as buffer
  const remaining = lines.pop() ?? '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data: ')) continue;

    const jsonStr = trimmed.slice(6);
    if (jsonStr === '[DONE]') continue;

    try {
      const event = JSON.parse(jsonStr) as SSEEvent;
      events.push(event);
    } catch {
      // Skip malformed
    }
  }

  return [events, remaining];
}

/**
 * Send a chat message and stream the response.
 * Returns an async generator of SSE events.
 */
export async function* streamChat(
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent, void, unknown> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE}/ai/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Request failed' } }));
    yield { type: 'error', message: (error as { error: { message: string } }).error.message };
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const [events, remaining] = parseSSEChunk(buffer, chunk);
      buffer = remaining;

      for (const event of events) {
        yield event;
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const [events] = parseSSEChunk('', buffer + '\n');
      for (const event of events) {
        yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
