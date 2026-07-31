import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Account, Category, CategoryRule } from '@cedisense/shared';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
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
        <div className="w-0.5 h-4 rounded-full" style={{ background: 'var(--color-border-hover)' }} />
        <div className="h-4 rounded-lg w-1/3 animate-pulse" style={{ background: 'var(--color-border)' }} />
      </div>
      <div className="space-y-3">
        <div className="h-4 rounded-lg w-full animate-pulse" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 rounded-lg w-4/5 animate-pulse" style={{ background: 'var(--color-border)' }} />
        <div className="h-4 rounded-lg w-3/5 animate-pulse" style={{ background: 'var(--color-border)' }} />
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

function AppearanceSection() {
  const { theme, setTheme, resolved } = useTheme();

  const options: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode }[] = [
    {
      value: 'light',
      label: 'Light',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ),
    },
    {
      value: 'dark',
      label: 'Dark',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      ),
    },
    {
      value: 'system',
      label: 'System',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
        </svg>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Appearance</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const isActive = theme === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className="flex flex-col items-center gap-2 py-4 rounded-xl transition-all duration-200 min-h-[44px]"
              style={{
                background: isActive ? 'var(--color-primary)' : 'var(--color-elevated)',
                color: isActive ? '#fff' : 'var(--color-text-secondary)',
                border: isActive ? 'none' : '1px solid var(--color-border)',
                boxShadow: isActive ? '0 4px 12px rgba(255, 107, 53, 0.25)' : 'none',
              }}
            >
              {opt.icon}
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {theme === 'system' && (
        <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
          Currently using {resolved} mode based on your device settings.
        </p>
      )}
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

          {/* Appearance */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '60ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-flame">
              <AppearanceSection />
            </SettingsCard>
          </div>

          {/* Accounts */}
          <div
            className="motion-safe:animate-slide-up"
            style={{ animationDelay: '120ms', animationFillMode: 'both' }}
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
            style={{ animationDelay: '180ms', animationFillMode: 'both' }}
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
            style={{ animationDelay: '240ms', animationFillMode: 'both' }}
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
            style={{ animationDelay: '300ms', animationFillMode: 'both' }}
          >
            <SettingsCard accentColor="bg-info">
              <NotificationsSection />
            </SettingsCard>
          </div>

          {/* Sign out */}
          <div
            className="pt-4 motion-safe:animate-slide-up"
            style={{ animationDelay: '360ms', animationFillMode: 'both' }}
          >
            <div className="h-px mb-5" style={{ background: 'var(--color-border)' }} />
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
