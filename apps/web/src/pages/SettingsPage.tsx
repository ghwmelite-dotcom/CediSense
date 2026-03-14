import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User, Account, Category, CategoryRule } from '@cedisense/shared';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { ProfileSection } from '@/components/settings/ProfileSection';
import { AccountsSection } from '@/components/settings/AccountsSection';
import { CategoriesSection } from '@/components/settings/CategoriesSection';
import { RulesSection } from '@/components/settings/RulesSection';

interface SettingsData {
  user: User;
  accounts: Account[];
  categories: Category[];
  rules: CategoryRule[];
}

function SkeletonCard() {
  return (
    <div className="bg-ghana-surface rounded-2xl border border-white/5 p-5 space-y-4 animate-pulse">
      <div className="h-5 bg-white/10 rounded-lg w-1/3" />
      <div className="space-y-3">
        <div className="h-4 bg-white/10 rounded-lg w-full" />
        <div className="h-4 bg-white/10 rounded-lg w-4/5" />
        <div className="h-4 bg-white/10 rounded-lg w-3/5" />
      </div>
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
    <div className="p-4 md:p-6 pb-24 max-w-2xl mx-auto">
      <h1 className="text-white text-xl font-bold mb-6">Settings</h1>

      {error && (
        <div className="mb-4 bg-expense/10 border border-expense/30 rounded-xl px-4 py-3">
          <p className="text-expense text-sm">{error}</p>
          <button
            onClick={() => { setLoading(true); void fetchAll(); }}
            className="text-expense text-sm font-medium underline mt-1"
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
          <ProfileSection
            user={data.user}
            onUpdate={fetchUser}
          />

          <AccountsSection
            accounts={data.accounts}
            onRefresh={fetchAccounts}
          />

          <CategoriesSection
            categories={data.categories}
            onRefresh={fetchCategories}
          />

          <RulesSection
            rules={data.rules}
            categories={data.categories}
            onRefresh={fetchRules}
          />

          <button
            onClick={handleLogout}
            className="bg-expense/10 text-expense rounded-xl py-3 w-full font-medium
              hover:bg-expense/20 transition-colors focus:outline-none
              focus-visible:ring-2 focus-visible:ring-expense/50"
          >
            Sign Out
          </button>
        </div>
      ) : null}
    </div>
  );
}
