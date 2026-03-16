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
import { NewUserWelcome, isWelcomeDismissed } from '@/components/dashboard/NewUserWelcome';

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/** Staggered delay utility -- returns inline style with animation-delay */
function stagger(index: number, baseMs = 80): React.CSSProperties {
  return { animationDelay: `${index * baseMs}ms`, animationFillMode: 'both' };
}

function formatTodayDate(): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
}

export function DashboardPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<DashboardData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<RecurringWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(isWelcomeDismissed);

  // Cache: month -> DashboardData
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

  // Fetch dashboard data with crossfade transition
  const fetchDashboard = useCallback(async (m: string) => {
    const isCurrent = m === getCurrentMonth();

    // Use cache for non-current months
    if (!isCurrent && cache.current.has(m)) {
      setTransitioning(true);
      setTimeout(() => {
        setData(cache.current.get(m)!);
        setLoading(false);
        setTransitioning(false);
      }, 150);
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
      setTransitioning(false);
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

  // Show new user welcome if no transactions and not dismissed
  const isNewUser = !loading && data !== null && data.summary.transaction_count === 0 && !welcomeDismissed;

  if (isNewUser) {
    return (
      <div className="pb-24 ambient-glow">
        <NewUserWelcome
          userName={user?.name ?? ''}
          onDismiss={() => setWelcomeDismissed(true)}
        />
      </div>
    );
  }

  return (
    <div className="pb-24 ambient-glow">
      <MonthPicker month={month} onMonthChange={setMonth} />

      <div className="px-6 pt-6 space-y-6 max-w-screen-lg mx-auto relative">
        {/* Greeting -- generous, clean, with date */}
        <div className="motion-safe:animate-fade-in" style={stagger(0, 60)}>
          <p className="section-label">{greeting}</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-text-primary mt-2 tracking-[-0.02em]">
            {firstName ? (
              <>
                {firstName}
                <span className="text-gold/50">.</span>
              </>
            ) : (
              'Dashboard'
            )}
          </h1>
          <p className="text-muted text-sm mt-1">{formatTodayDate()}</p>
        </div>

        {/* Loading skeleton with premium shimmer */}
        {loading && (
          <div className="space-y-6 motion-safe:animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-40 rounded-2xl skeleton" />
              <div className="h-40 rounded-2xl skeleton" />
            </div>
            <div className="h-[260px] rounded-2xl skeleton" style={{ animationDelay: '100ms' }} />
            <div className="h-64 rounded-2xl skeleton" style={{ animationDelay: '200ms' }} />
            <div className="h-48 rounded-2xl skeleton" style={{ animationDelay: '300ms' }} />
            <div className="h-40 rounded-2xl skeleton" style={{ animationDelay: '400ms' }} />
          </div>
        )}

        {/* Error state -- warm and encouraging */}
        {error && !loading && (
          <div className="text-center py-20">
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-expense/[0.06] flex items-center justify-center">
              <svg className="w-6 h-6 text-expense/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-muted text-sm mb-5">{error}</p>
            <button
              type="button"
              onClick={() => fetchDashboard(month)}
              className="text-gold text-sm font-medium px-6 py-2.5 rounded-xl bg-gold/[0.06] hover:bg-gold/[0.1] transition-colors duration-200"
            >
              Try again
            </button>
          </div>
        )}

        {/* Dashboard content with staggered slide-up animations and crossfade */}
        {data && !loading && !error && (
          <div
            className={`transition-opacity duration-200 ${transitioning ? 'opacity-0' : 'opacity-100'}`}
          >
            {/* Balance + Summary: side-by-side on desktop */}
            <div
              className="grid grid-cols-1 md:grid-cols-2 gap-6 motion-safe:animate-slide-up"
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

            <div className="mt-6 motion-safe:animate-slide-up" style={stagger(2)}>
              <SpendingTrendChart data={data.daily_trend} />
            </div>

            <div className="mt-6 motion-safe:animate-slide-up" style={stagger(3)}>
              <CategoryBreakdownCard
                data={data.category_breakdown}
                totalExpenses={data.summary.total_expenses_pesewas}
                month={month}
              />
            </div>

            <div className="mt-6 motion-safe:animate-slide-up" style={stagger(4)}>
              <UpcomingBillsCard items={upcomingBills} />
            </div>

            <div className="mt-6 motion-safe:animate-slide-up" style={stagger(5)}>
              <RecentTransactions
                transactions={data.recent_transactions}
                categories={categories}
              />
            </div>

            <div className="mt-6 motion-safe:animate-fade-in" style={stagger(6)}>
              <Link
                to="/insights"
                className="block text-center text-muted text-sm font-medium hover:text-text-primary transition-colors mt-2 py-4"
              >
                View Insights
                <svg className="inline-block w-3.5 h-3.5 ml-1.5 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
