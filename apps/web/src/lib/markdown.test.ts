import { describe, it, expect } from 'vitest';
import { renderMarkdown } from './markdown';

describe('renderMarkdown', () => {
  it('renders bold text', () => {
    expect(renderMarkdown('Hello **world**')).toContain('<strong class="font-semibold">world</strong>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('Use `formatGHS`')).toContain('<code class="bg-white/10 px-1 rounded text-xs">formatGHS</code>');
  });

  it('renders unordered list', () => {
    const result = renderMarkdown('Items:\n- Apple\n- Banana');
    expect(result).toContain('<ul class="list-disc pl-4 space-y-1">');
    expect(result).toContain('<li>Apple</li>');
    expect(result).toContain('<li>Banana</li>');
    expect(result).toContain('</ul>');
  });

  it('escapes HTML to prevent XSS', () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('handles malformed HTML in AI output', () => {
    const result = renderMarkdown('<img src=x onerror=alert(1)>');
    expect(result).not.toContain('<img');
    expect(result).toContain('&lt;img');
  });

  it('preserves ₵ currency symbols', () => {
    const result = renderMarkdown('You spent ₵1,234.56 on food');
    expect(result).toContain('₵1,234.56');
  });

  it('converts line breaks', () => {
    const result = renderMarkdown('Line 1\nLine 2');
    expect(result).toContain('<br />');
  });
});
