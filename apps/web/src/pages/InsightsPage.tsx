import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { api, getAccessToken } from '@/lib/api';
import type { InsightsData, InsightsReport } from '@cedisense/shared';
import { MonthPicker } from '@/components/dashboard/MonthPicker';
import { ComparisonCard } from '@/components/insights/ComparisonCard';
import { TopChangesCard } from '@/components/insights/TopChangesCard';
import { AIReportSection } from '@/components/insights/AIReportSection';
import { AdinkraWhisper } from '@/components/shared/AdinkraWhisper';

const CategoryTrendsChart = lazy(() => import('@/components/insights/CategoryTrendsChart').then(m => ({ default: m.CategoryTrendsChart })));

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function InsightsPage() {
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<InsightsData>(`/insights?month=${m}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchInsights(month);
  }, [month, fetchInsights]);

  const isEmpty =
    data !== null &&
    data.current.total_income_pesewas === 0 &&
    data.current.total_expenses_pesewas === 0 &&
    data.previous.total_income_pesewas === 0 &&
    data.previous.total_expenses_pesewas === 0;

  async function handleGenerateReport(): Promise<string> {
    const result = await api.post<InsightsReport>('/insights/report', { month });
    return result.report;
  }

  return (
    <div className="pb-24">
      <MonthPicker month={month} onMonthChange={setMonth} />

      <div className="px-4 pt-5 space-y-5 max-w-screen-lg mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between motion-safe:animate-fade-in">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-5 rounded-full bg-[#FF6B35]/50" />
            <h1 className="text-white text-xl font-bold font-display tracking-tight">Insights</h1>
          </div>
          <button
            type="button"
            onClick={async () => {
              const token = getAccessToken();
              const res = await fetch(`/api/v1/export/report/html?month=${month}`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              });
              if (!res.ok) return;
              const html = await res.text();
              const blob = new Blob([html], { type: 'text/html' });
              const url = URL.createObjectURL(blob);
              window.open(url, '_blank');
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }}
            className="btn-gold flex items-center gap-1.5 px-4 py-2.5 text-sm no-print min-h-[44px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            <span className="hidden sm:inline">Export PDF</span>
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 motion-safe:animate-fade-in">
            <div className="h-48 rounded-2xl skeleton" />
            <div className="h-[300px] rounded-2xl skeleton" />
            <div className="h-48 rounded-2xl skeleton" />
            <div className="h-48 rounded-2xl skeleton" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-16 motion-safe:animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-expense/[0.06] flex items-center justify-center">
              <svg className="w-7 h-7 text-expense/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-muted text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void fetchInsights(month)}
              className="text-gold text-sm font-medium px-5 py-2.5 rounded-xl bg-gold/[0.06] hover:bg-gold/[0.1] transition-colors min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && isEmpty && (
          <div className="text-center py-20 motion-safe:animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-5">
              <svg className="w-8 h-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h2 className="text-white font-semibold mb-2">Not enough data yet</h2>
            <p className="text-muted text-sm max-w-xs mx-auto leading-relaxed">
              Add a few transactions to start seeing insights for this month.
            </p>
          </div>
        )}

        {/* Insights content */}
        {data && !loading && !error && !isEmpty && (
          <>
            <div
              className="motion-safe:animate-slide-up"
              style={{ animationDelay: '0ms', animationFillMode: 'both' }}
            >
              <ComparisonCard
                current={data.current}
                previous={data.previous}
                currentMonth={data.current_month}
                previousMonth={data.previous_month}
              />
            </div>

            <Suspense fallback={<div className="h-48 rounded-2xl skeleton" />}>
              <div
                className="motion-safe:animate-slide-up"
                style={{ animationDelay: '80ms', animationFillMode: 'both' }}
              >
                <CategoryTrendsChart trends={data.category_trends} />
              </div>
            </Suspense>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                className="motion-safe:animate-slide-up"
                style={{ animationDelay: '140ms', animationFillMode: 'both' }}
              >
                <TopChangesCard changes={data.top_changes} />
              </div>
              <div
                className="motion-safe:animate-slide-up"
                style={{ animationDelay: '200ms', animationFillMode: 'both' }}
              >
                <AIReportSection onGenerate={handleGenerateReport} />
              </div>
            </div>
          </>
        )}

        <AdinkraWhisper symbol="sankofa" className="mt-8 mb-4" />
      </div>
    </div>
  );
}
