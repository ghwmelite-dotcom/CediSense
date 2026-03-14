/**
 * HTML-entity-encode a string to prevent XSS.
 * Applied BEFORE markdown transforms.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Lightweight markdown-to-HTML renderer for AI assistant messages.
 * Supports: **bold**, `inline code`, line breaks, unordered lists (- / *).
 * Input is entity-encoded first to prevent XSS.
 */
export function renderMarkdown(raw: string): string {
  let html = escapeHtml(raw);

  // Bold **text**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Inline code `text`
  html = html.replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 rounded text-xs">$1</code>');

  // Process lines for lists and line breaks
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    const isListItem = /^[-*]\s/.test(trimmed);

    if (isListItem) {
      if (!inList) {
        result.push('<ul class="list-disc pl-4 space-y-1">');
        inList = true;
      }
      result.push(`<li>${trimmed.slice(2)}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      if (trimmed === '') {
        result.push('<br />');
      } else {
        result.push(line);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('<br />').replace(/(<br \/>){3,}/g, '<br /><br />');
}
