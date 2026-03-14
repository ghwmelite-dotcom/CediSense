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
        {/* Page header with export action */}
        <div className="flex items-center justify-between">
          <h1 className="text-white text-xl font-bold">Insights</h1>
          <button
            type="button"
            onClick={() => window.open(`/print/report?month=${month}`, '_blank')}
            className="text-sm text-gold font-medium hover:text-gold/80 transition-colors no-print"
          >
            Export PDF
          </button>
        </div>
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-48 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-[300px] rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-48 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-48 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => void fetchInsights(month)}
              className="text-gold text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && isEmpty && (
          <div className="text-center py-16">
            <p className="text-muted text-sm">Not enough data for insights yet</p>
          </div>
        )}

        {/* Insights content */}
        {data && !loading && !error && !isEmpty && (
          <>
            <ComparisonCard
              current={data.current}
              previous={data.previous}
              currentMonth={data.current_month}
              previousMonth={data.previous_month}
            />

            <CategoryTrendsChart trends={data.category_trends} />

            {/* Desktop 2-col, mobile stacked */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TopChangesCard changes={data.top_changes} />
              <AIReportSection onGenerate={handleGenerateReport} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
