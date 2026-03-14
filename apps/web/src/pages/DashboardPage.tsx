import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { DashboardData, Category } from '@cedisense/shared';
import { MonthPicker } from '@/components/dashboard/MonthPicker';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { SpendingTrendChart } from '@/components/dashboard/SpendingTrendChart';
import { CategoryBreakdownCard } from '@/components/dashboard/CategoryBreakdownCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<DashboardData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache: month → DashboardData
  const cache = useRef<Map<string, DashboardData>>(new Map());

  // Fetch categories once for TransactionRow
  useEffect(() => {
    api.get<Category[]>('/categories')
      .then(setCategories)
      .catch(() => {/* non-fatal */});
  }, []);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async (m: string) => {
    const isCurrent = m === getCurrentMonth();

    // Use cache for non-current months
    if (!isCurrent && cache.current.has(m)) {
      setData(cache.current.get(m)!);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await api.get<DashboardData>(`/dashboard?month=${m}`);
      cache.current.set(m, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard(month);
  }, [month, fetchDashboard]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="pb-24">
      <MonthPicker month={month} onMonthChange={setMonth} />

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Greeting */}
        <p className="text-muted text-sm">
          {greeting}, {user?.name?.split(' ')[0]}
        </p>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-36 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-[200px] rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-64 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-48 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard(month)}
              className="text-gold text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard content */}
        {data && !loading && !error && (
          <>
            {/* Balance + Summary: side-by-side on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <BalanceCard
                totalBalance={data.accounts.total_balance_pesewas}
                accounts={data.accounts.items}
              />
              <SummaryCard
                income={data.summary.total_income_pesewas}
                expenses={data.summary.total_expenses_pesewas}
                fees={data.summary.total_fees_pesewas}
              />
            </div>

            <SpendingTrendChart data={data.daily_trend} />

            <CategoryBreakdownCard
              data={data.category_breakdown}
              totalExpenses={data.summary.total_expenses_pesewas}
              month={month}
            />

            <RecentTransactions
              transactions={data.recent_transactions}
              categories={categories}
            />
          </>
        )}
      </div>
    </div>
  );
}
