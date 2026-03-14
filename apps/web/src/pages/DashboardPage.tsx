import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import type { DashboardData, Category, RecurringWithStatus } from '@cedisense/shared';
import { MonthPicker } from '@/components/dashboard/MonthPicker';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { SummaryCard } from '@/components/dashboard/SummaryCard';
import { SpendingTrendChart } from '@/components/dashboard/SpendingTrendChart';
import { CategoryBreakdownCard } from '@/components/dashboard/CategoryBreakdownCard';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { UpcomingBillsCard } from '@/components/recurring/UpcomingBillsCard';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Staggered delay utility — returns inline style with animation-delay */
function stagger(index: number, baseMs = 80): React.CSSProperties {
  return { animationDelay: `${index * baseMs}ms`, animationFillMode: 'both' };
}

export function DashboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<DashboardData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<RecurringWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache: month → DashboardData
  const cache = useRef<Map<string, DashboardData>>(new Map());

  // Fetch categories and upcoming bills once
  useEffect(() => {
    api.get<Category[]>('/categories')
      .then(setCategories)
      .catch(() => {/* non-fatal */});
    api.get<RecurringWithStatus[]>('/recurring/upcoming?limit=5')
      .then(setUpcomingBills)
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

  const firstName = user?.name?.split(' ')[0] ?? '';

  return (
    <div className="pb-24">
      <MonthPicker month={month} onMonthChange={setMonth} />

      <div className="px-4 pt-6 space-y-5 max-w-screen-lg mx-auto">
        {/* Greeting — prominent hero text */}
        <div className="motion-safe:animate-fade-in" style={stagger(0, 60)}>
          <p className="text-xs text-muted uppercase tracking-widest font-medium">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1 tracking-tight">
            {firstName || 'Dashboard'}
          </h1>
        </div>

        {/* Loading skeleton with shimmer */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-32 rounded-2xl skeleton" />
              <div className="h-32 rounded-2xl skeleton" />
            </div>
            <div className="h-[220px] rounded-2xl skeleton" />
            <div className="h-64 rounded-2xl skeleton" />
            <div className="h-48 rounded-2xl skeleton" />
            <div className="h-40 rounded-2xl skeleton" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-expense/[0.08] flex items-center justify-center">
              <svg className="w-7 h-7 text-expense/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-muted text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard(month)}
              className="text-gold text-sm font-medium px-5 py-2.5 rounded-xl bg-gold/[0.06] hover:bg-gold/[0.1] transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Dashboard content with staggered slide-up animations */}
        {data && !loading && !error && (
          <>
            {/* Balance + Summary: side-by-side on desktop */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-4 motion-safe:animate-slide-up"
              style={stagger(1)}
            >
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

            <div className="motion-safe:animate-slide-up" style={stagger(2)}>
              <SpendingTrendChart data={data.daily_trend} />
            </div>

            <div className="motion-safe:animate-slide-up" style={stagger(3)}>
              <CategoryBreakdownCard
                data={data.category_breakdown}
                totalExpenses={data.summary.total_expenses_pesewas}
                month={month}
              />
            </div>

            <div className="motion-safe:animate-slide-up" style={stagger(4)}>
              <UpcomingBillsCard items={upcomingBills} />
            </div>

            <div className="motion-safe:animate-slide-up" style={stagger(5)}>
              <RecentTransactions
                transactions={data.recent_transactions}
                categories={categories}
              />
            </div>

            <div className="motion-safe:animate-fade-in" style={stagger(6)}>
              <Link
                to="/insights"
                className="block text-center text-gold/80 text-sm font-medium hover:text-gold transition-colors mt-2 py-3"
              >
                View Insights
                <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
