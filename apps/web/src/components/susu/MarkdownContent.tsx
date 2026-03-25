interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Escape HTML entities to prevent XSS before markdown processing.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Render simple markdown to HTML.
 * Processing order: code (protect from further parsing), then bold, italic,
 * strikethrough, URLs, @mentions, and finally newlines.
 */
function renderMarkdown(raw: string): string {
  const escaped = escapeHtml(raw);

  // Preserve code spans — replace with placeholders to prevent inner parsing
  const codeBlocks: string[] = [];
  let text = escaped.replace(/`([^`]+)`/g, (_match, code: string) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<code class="px-1.5 py-0.5 rounded bg-white/10 text-[0.9em] font-mono">${code}</code>`,
    );
    return `\x00CODE${idx}\x00`;
  });

  // Bold: **text**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic: *text* (but not inside bold remnants)
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Strikethrough: ~text~
  text = text.replace(/~(.+?)~/g, '<s>$1</s>');

  // URLs: https://... or http://...
  text = text.replace(
    /(https?:\/\/[^\s<&]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-gold underline underline-offset-2 hover:text-gold/80 break-all">$1</a>',
  );

  // @mentions: @SomeName (word chars, dots, hyphens)
  text = text.replace(
    /@([\w.\-]+)/g,
    '<span class="text-gold font-semibold">@$1</span>',
  );

  // Newlines → <br />
  text = text.replace(/\n/g, '<br />');

  // Restore code blocks
  text = text.replace(/\x00CODE(\d+)\x00/g, (_match, idx: string) => codeBlocks[parseInt(idx, 10)]);

  return text;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
  const html = renderMarkdown(content);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
