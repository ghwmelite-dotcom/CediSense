import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Account, Category, CategoryRule } from '@cedisense/shared';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AccountsSection } from '@/components/settings/AccountsSection';
import { CategoriesSection } from '@/components/settings/CategoriesSection';
import { RulesSection } from '@/components/settings/RulesSection';
import { NotificationsSection } from '@/components/settings/NotificationsSection';

interface SettingsData {
  user: User;
  accounts: Account[];
  categories: Category[];
  rules: CategoryRule[];
}

function SkeletonCard() {
  return (
    <div className="premium-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-0.5 h-4 rounded-full bg-white/[0.08]" />
        <div className="h-4 bg-white/[0.06] rounded-lg w-1/3 animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-white/[0.04] rounded-lg w-full animate-pulse" />
        <div className="h-4 bg-white/[0.04] rounded-lg w-4/5 animate-pulse" />
        <div className="h-4 bg-white/[0.04] rounded-lg w-3/5 animate-pulse" />
      </div>
    </div>
  );
}

/** Wrapper that gives each settings section a premium card look */
function SettingsCard({
  children,
  accentColor = 'bg-gold',
}: {
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="premium-card rounded-2xl overflow-hidden card-interactive">
      {/* Subtle top accent line */}
      <div className={`h-px w-full ${accentColor} opacity-15`} />
      <div className="p-6">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [user, accounts, categories, rules] = await Promise.all([
        api.get<User>('/users/me'),
        api.get<Account[]>('/accounts'),
        api.get<Category[]>('/categories'),
        api.get<CategoryRule[]>('/category-rules'),
      ]);
      setData({ user, accounts, categories, rules });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      const user = await api.get<User>('/users/me');
      setData((prev) => (prev ? { ...prev, user } : prev));
    } catch {
      // ignore, stale data is acceptable
    }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const accounts = await api.get<Account[]>('/accounts');
      setData((prev) => (prev ? { ...prev, accounts } : prev));
    } catch {
      // ignore
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const categories = await api.get<Category[]>('/categories');
      setData((prev) => (prev ? { ...prev, categories } : prev));
    } catch {
      // ignore
    }
  }, []);

  const fetchRules = useCallback(async () => {
    try {
      const rules = await api.get<CategoryRule[]>('/category-rules');
      setData((prev) => (prev ? { ...prev, rules } : prev));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="p-4 md:p-6 pb-24 max-w-2xl mx-auto motion-safe:animate-fade-in">
      {/* Page header */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-0.5 h-5 rounded-full bg-[#FF6B35]/50" />
        <h1 className="text-text-primary text-xl font-bold font-display tracking-tight">Settings</h1>
      </div>

      {error && (
        <div className="mb-5 bg-expense/[0.06] border border-expense/[0.1] rounded-2xl px-5 py-3.5
          motion-safe:animate-slide-down">
          <p className="text-expense/90 text-sm">{error}</p>
          <button
            onClick={() => { setLoading(true); void fetchAll(); }}
            className="text-expense/70 text-sm font-medium mt-1 hover:text-expense transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Profile */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '0ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-gold">
              <ProfileSection
                user={data.user}
                onUpdate={fetchUser}
              />
            </SettingsCard>
          </div>

          {/* Accounts */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '60ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-income">
              <AccountsSection
                accounts={data.accounts}
                onRefresh={fetchAccounts}
              />
            </SettingsCard>
          </div>

          {/* Categories */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '120ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-gold">
              <CategoriesSection
                categories={data.categories}
                onRefresh={fetchCategories}
              />
            </SettingsCard>
          </div>

          {/* Rules */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-income">
              <RulesSection
                rules={data.rules}
                categories={data.categories}
                onRefresh={fetchRules}
              />
            </SettingsCard>
          </div>

          {/* Notifications */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '240ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-info">
              <NotificationsSection />
            </SettingsCard>
          </div>

          {/* Sign out */}
          <div
            className="pt-4 motion-safe:animate-slide-up"
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            <div className="h-px bg-[#1F1F35]/40 mb-5" />
            <button
              onClick={handleLogout}
              className="w-full py-3.5 rounded-2xl font-semibold text-sm
                bg-expense/[0.06] text-expense/90
                hover:bg-expense/[0.1]
                active:scale-[0.98] transition-all min-h-[44px]
                focus:outline-none focus-visible:ring-2 focus-visible:ring-expense/30"
            >
              Sign Out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
