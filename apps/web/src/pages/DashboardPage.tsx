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

      <div className="px-4 pt-5 space-y-4 max-w-screen-lg mx-auto">
        {/* Greeting — prominent hero text */}
        <div className="motion-safe:animate-fade-in" style={stagger(0, 60)}>
          <p className="text-xs text-muted uppercase tracking-widest font-medium">{greeting}</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-0.5">
            {firstName
              ? <><span>{firstName}</span> <span className="text-gold">👋</span></>
              : 'Dashboard'
            }
          </h1>
        </div>

        {/* Loading skeleton with shimmer */}
        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="h-28 rounded-xl skeleton" />
              <div className="h-28 rounded-xl skeleton" />
            </div>
            <div className="h-[220px] rounded-xl skeleton" />
            <div className="h-64 rounded-xl skeleton" />
            <div className="h-48 rounded-xl skeleton" />
            <div className="h-40 rounded-xl skeleton" />
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard(month)}
              className="text-gold text-sm font-medium underline underline-offset-2 hover:text-gold/80 transition-colors"
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
                className="block text-center text-gold text-sm font-semibold hover:text-gold/80 transition-colors mt-2 py-2"
              >
                View Insights →
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
