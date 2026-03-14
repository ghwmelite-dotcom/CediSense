import { describe, it, expect } from 'vitest';
import { parseSSEChunk } from './streaming';

describe('parseSSEChunk', () => {
  it('parses a complete token event', () => {
    const [events, buffer] = parseSSEChunk('', 'data: {"type":"token","content":"Hello"}\n\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'token', content: 'Hello' });
    expect(buffer).toBe('');
  });

  it('parses multiple events in one chunk', () => {
    const chunk = 'data: {"type":"token","content":"Hi"}\ndata: {"type":"token","content":" there"}\n';
    const [events, buffer] = parseSSEChunk('', chunk);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ type: 'token', content: 'Hi' });
    expect(events[1]).toEqual({ type: 'token', content: ' there' });
    expect(buffer).toBe('');
  });

  it('buffers incomplete lines across chunks', () => {
    const [events1, buffer1] = parseSSEChunk('', 'data: {"type":"tok');
    expect(events1).toHaveLength(0);
    expect(buffer1).toBe('data: {"type":"tok');

    const [events2, buffer2] = parseSSEChunk(buffer1, 'en","content":"Hi"}\n');
    expect(events2).toHaveLength(1);
    expect(events2[0]).toEqual({ type: 'token', content: 'Hi' });
    expect(buffer2).toBe('');
  });

  it('parses meta event', () => {
    const [events] = parseSSEChunk('', 'data: {"type":"meta","usage_warning":true,"daily_count":41}\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'meta', usage_warning: true, daily_count: 41 });
  });

  it('parses done event', () => {
    const [events] = parseSSEChunk('', 'data: {"type":"done"}\n');
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'done' });
  });

  it('skips [DONE] marker', () => {
    const [events] = parseSSEChunk('', 'data: [DONE]\n');
    expect(events).toHaveLength(0);
  });

  it('skips malformed JSON', () => {
    const [events] = parseSSEChunk('', 'data: {broken json}\n');
    expect(events).toHaveLength(0);
  });

  it('ignores non-data lines', () => {
    const [events] = parseSSEChunk('', 'event: message\ndata: {"type":"token","content":"x"}\n');
    expect(events).toHaveLength(1);
  });
});
