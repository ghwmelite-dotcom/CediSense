import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { chatMessageSchema, chatHistoryQuerySchema } from '@cedisense/shared';
import { generateId } from '../lib/db.js';
import { buildFinancialContext, buildSystemPrompt } from '../lib/ai-context.js';

const ai = new Hono<{ Bindings: Env; Variables: Variables }>();

const AI_MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
const MAX_CONTEXT_MESSAGES = 15;
const DAILY_LIMIT_WARN = 40;

// POST /chat — streaming SSE response
ai.post('/chat', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const parsed = chatMessageSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0]?.message ?? 'Invalid input' } },
      400
    );
  }

  const { message } = parsed.data;

  // Increment daily usage counter (read-then-write, not atomic — acceptable for soft limit)
  const today = new Date().toISOString().slice(0, 10);
  const kvKey = `ai-usage:${userId}:${today}`;
  const currentCount = parseInt(await c.env.KV.get(kvKey) ?? '0', 10);
  const newCount = currentCount + 1;
  // Use absolute expiration at midnight UTC to avoid TTL reset on every request
  const tomorrow = new Date();
  tomorrow.setUTCHours(24, 0, 0, 0);
  const expiration = Math.floor(tomorrow.getTime() / 1000);
  await c.env.KV.put(kvKey, String(newCount), { expiration });

  // Fetch recent messages + clean orphaned trailing user messages
  const historyResult = await c.env.DB.prepare(
    'SELECT id, role, content FROM chat_messages WHERE user_id = ? ORDER BY rowid DESC LIMIT ?'
  ).bind(userId, MAX_CONTEXT_MESSAGES + 5).all();

  let history = (historyResult.results ?? []).reverse() as Array<{ id: string; role: string; content: string }>;

  // Clean orphaned trailing user messages (no assistant reply after them)
  while (history.length > 0 && history[history.length - 1].role === 'user') {
    const orphan = history.pop()!;
    await c.env.DB.prepare('DELETE FROM chat_messages WHERE id = ?').bind(orphan.id).run();
  }

  // Trim to max context
  history = history.slice(-MAX_CONTEXT_MESSAGES);

  // Save user message
  const userMsgId = generateId();
  await c.env.DB.prepare(
    'INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)'
  ).bind(userMsgId, userId, 'user', message).run();

  // Build AI context
  const financialContext = await buildFinancialContext(c.env.DB, userId);
  const systemPrompt = buildSystemPrompt(financialContext);

  // Build messages array for AI
  const aiMessages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Call Workers AI with streaming
  let aiStream: ReadableStream;
  try {
    aiStream = await (c.env.AI.run as (model: string, input: Record<string, unknown>) => Promise<ReadableStream>)(
      AI_MODEL,
      { messages: aiMessages, stream: true, max_tokens: 1024 }
    );
  } catch {
    return c.json(
      { error: { code: 'AI_ERROR', message: 'Failed to generate response' } },
      500
    );
  }

  // Create SSE response stream
  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      let aiBuffer = ''; // Buffer for incomplete SSE lines across chunks

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const text = aiBuffer + chunk;

          // Workers AI SSE format: "data: {...}\n\n"
          const lines = text.split('\n');
          // Last element may be incomplete — keep as buffer
          aiBuffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsedChunk = JSON.parse(jsonStr);
              const token = parsedChunk.response ?? '';
              if (token) {
                fullResponse += token;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'token', content: token })}\n\n`)
                );
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Send meta event
        const usageWarning = newCount > DAILY_LIMIT_WARN;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'meta', usage_warning: usageWarning, daily_count: newCount })}\n\n`)
        );

        // Send done event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));

        // Save assistant response to D1
        if (fullResponse.trim()) {
          const assistantMsgId = generateId();
          await c.env.DB.prepare(
            'INSERT INTO chat_messages (id, user_id, role, content) VALUES (?, ?, ?, ?)'
          ).bind(assistantMsgId, userId, 'assistant', fullResponse.trim()).run();
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Stream interrupted' })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

// GET /history — conversation history
ai.get('/history', async (c) => {
  const userId = c.get('userId');
  const queryParams = {
    limit: c.req.query('limit'),
    before: c.req.query('before'),
  };

  const parsed = chatHistoryQuerySchema.safeParse(queryParams);
  if (!parsed.success) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters' } },
      400
    );
  }

  const { limit, before } = parsed.data;
  let result;

  if (before) {
    result = await c.env.DB.prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = ? AND rowid < (SELECT rowid FROM chat_messages WHERE id = ?)
       ORDER BY rowid DESC LIMIT ?`
    ).bind(userId, before, limit).all();
  } else {
    result = await c.env.DB.prepare(
      `SELECT id, role, content, created_at FROM chat_messages
       WHERE user_id = ? ORDER BY rowid DESC LIMIT ?`
    ).bind(userId, limit).all();
  }

  // Reverse to ASC order for display
  const messages = (result.results ?? []).reverse();

  return c.json({ data: messages });
});

// DELETE /history — clear all history
ai.delete('/history', async (c) => {
  const userId = c.get('userId');
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE user_id = ?').bind(userId).run();
  return c.body(null, 204);
});

export { ai };
