function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function truncateUrl(url: string, max: number): string {
  return url.length > max ? url.slice(0, max) + '...' : url;
}

interface LinkPreviewCardProps {
  url: string;
}

export function LinkPreviewCard({ url }: LinkPreviewCardProps) {
  const domain = extractDomain(url);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 flex items-center gap-2.5 rounded-lg bg-white/[0.04] border border-white/5 px-3 py-2 min-h-[44px] hover:bg-white/[0.07] transition-colors group no-underline"
      aria-label={`Open link to ${domain}`}
    >
      {/* Link icon */}
      <svg
        className="w-4 h-4 text-muted group-hover:text-gold transition-colors shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.102 1.101"
        />
      </svg>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-gold truncate">{domain}</p>
        <p className="text-[11px] text-muted truncate">{truncateUrl(url, 50)}</p>
      </div>

      {/* External arrow */}
      <svg
        className="w-3.5 h-3.5 text-muted group-hover:text-white transition-colors shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
      </svg>
    </a>
  );
}
