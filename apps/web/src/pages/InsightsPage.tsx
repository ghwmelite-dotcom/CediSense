import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { InsightsData, InsightsReport } from '@cedisense/shared';
import { MonthPicker } from '@/components/dashboard/MonthPicker';
import { ComparisonCard } from '@/components/insights/ComparisonCard';
import { CategoryTrendsChart } from '@/components/insights/CategoryTrendsChart';
import { TopChangesCard } from '@/components/insights/TopChangesCard';
import { AIReportSection } from '@/components/insights/AIReportSection';

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

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between motion-safe:animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-gold" />
            <h1 className="text-white text-xl font-bold tracking-tight">Insights</h1>
          </div>
          {/* Gold gradient Export button */}
          <button
            type="button"
            onClick={() => window.open(`/print/report?month=${month}`, '_blank')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-ghana-black
              bg-gradient-to-r from-gold to-yellow-400 hover:brightness-110
              active:scale-95 transition-all shadow-gold-glow no-print min-h-[40px]"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            </svg>
            Export PDF
          </button>
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 motion-safe:animate-fade-in">
            <div className="h-48 rounded-2xl bg-ghana-surface animate-pulse" />
            <div className="h-[300px] rounded-2xl bg-ghana-surface animate-pulse" />
            <div className="h-48 rounded-2xl bg-ghana-surface animate-pulse" />
            <div className="h-48 rounded-2xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12 motion-safe:animate-fade-in">
            <div className="text-4xl mb-3">📡</div>
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void fetchInsights(month)}
              className="text-gold text-sm font-medium px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && isEmpty && (
          <div className="text-center py-20 motion-safe:animate-slide-up">
            <div className="w-20 h-20 rounded-full bg-ghana-surface border border-white/8 flex items-center justify-center mx-auto mb-4 shadow-card">
              <span className="text-3xl" role="img" aria-label="No data">📈</span>
            </div>
            <h2 className="text-white font-semibold mb-2">Not enough data yet</h2>
            <p className="text-muted text-sm max-w-xs mx-auto">
              Add a few transactions to start seeing insights for this month.
            </p>
          </div>
        )}

        {/* Insights content — staggered cards */}
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

            <div
              className="motion-safe:animate-slide-up"
              style={{ animationDelay: '80ms', animationFillMode: 'both' }}
            >
              <CategoryTrendsChart trends={data.category_trends} />
            </div>

            {/* Desktop 2-col, mobile stacked */}
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
      </div>
    </div>
  );
}
