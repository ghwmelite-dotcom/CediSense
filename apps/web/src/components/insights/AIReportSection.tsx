import { useState } from 'react';
import { renderMarkdown } from '@/lib/markdown';

type ReportState = 'initial' | 'loading' | 'loaded' | 'error';

interface AIReportSectionProps {
  onGenerate: () => Promise<string>;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse" aria-label="Generating report…" role="status">
      <div className="h-3 bg-white/10 rounded w-3/4" />
      <div className="h-3 bg-white/10 rounded w-full" />
      <div className="h-3 bg-white/10 rounded w-5/6" />
      <div className="h-3 bg-white/10 rounded w-2/3" />
      <div className="h-3 bg-white/10 rounded w-full" />
      <div className="h-3 bg-white/10 rounded w-4/5" />
    </div>
  );
}

export function AIReportSection({ onGenerate }: AIReportSectionProps) {
  const [state, setState] = useState<ReportState>('initial');
  const [report, setReport] = useState<string>('');

  async function handleGenerate() {
    setState('loading');
    try {
      const text = await onGenerate();
      setReport(text);
      setState('loaded');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-4">
      <h2 className="text-sm text-muted uppercase tracking-wide">Monthly Summary</h2>

      {state === 'initial' && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            className="px-6 py-2.5 bg-gold text-ghana-dark font-semibold text-sm rounded-xl
              hover:brightness-110 active:scale-95 transition-all focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2
              focus-visible:ring-offset-ghana-surface"
          >
            Generate Report
          </button>
        </div>
      )}

      {state === 'loading' && <LoadingSkeleton />}

      {state === 'loaded' && (
        <div
          className="prose prose-invert prose-sm max-w-none text-white/90 leading-relaxed"
          // renderMarkdown escapes HTML before applying transforms — safe
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: renderMarkdown(report) }}
        />
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <p className="text-expense text-sm">Failed to generate report</p>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            className="px-5 py-2 bg-white/10 text-white text-sm font-medium rounded-xl
              hover:bg-white/20 active:scale-95 transition-all focus-visible:outline-none
              focus-visible:ring-2 focus-visible:ring-white/40"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
