import { useState, useEffect, useCallback } from 'react';
import type { BudgetWithSpending, Category } from '@cedisense/shared';
import { api } from '@/lib/api';
import { BudgetSummaryBar } from '@/components/budgets/BudgetSummaryBar';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { AddBudgetModal } from '@/components/budgets/AddBudgetModal';

export function BudgetsPage() {
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchBudgets = useCallback(async () => {
    try {
      const data = await api.get<BudgetWithSpending[]>('/budgets');
      setBudgets(data);
    } catch {
      // non-fatal: leave existing state
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([
        fetchBudgets(),
        api.get<Category[]>('/categories').then(setCategories).catch(() => {/* non-fatal */}),
      ]);
      setLoading(false);
    }
    void init();
  }, [fetchBudgets]);

  async function handleCreate(categoryId: string, amountPesewas: number) {
    await api.post('/budgets', {
      category_id: categoryId,
      amount_pesewas: amountPesewas,
    });
    await fetchBudgets();
  }

  async function handleUpdate(id: string, amountPesewas: number) {
    await api.put(`/budgets/${id}`, { amount_pesewas: amountPesewas });
    await fetchBudgets();
  }

  async function handleDelete(id: string) {
    await api.delete(`/budgets/${id}`);
    await fetchBudgets();
  }

  const existingCategoryIds = budgets.map((b) => b.category_id);

  return (
    <div className="pb-24">
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-ghana-dark/90 border-b border-white/8 px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-gold" />
            <h1 className="text-white text-xl font-bold tracking-tight">Budgets</h1>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
              hover:brightness-110 active:scale-95 transition-all min-h-[44px] shadow-gold-glow"
          >
            + Add Budget
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 motion-safe:animate-fade-in">
            <div className="h-20 rounded-2xl bg-ghana-surface animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-ghana-surface animate-pulse" />
            ))}
          </div>
        )}

        {/* Loaded state */}
        {!loading && (
          <>
            {/* Summary bar */}
            {budgets.length > 0 && <BudgetSummaryBar budgets={budgets} />}

            {/* Budget list — staggered animations */}
            {budgets.length > 0 ? (
              <div className="space-y-4">
                {budgets.map((budget, index) => (
                  <div
                    key={budget.id}
                    className="motion-safe:animate-slide-up"
                    style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
                  >
                    <BudgetCard
                      budget={budget}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center motion-safe:animate-slide-up">
                {/* Animated illustration feel */}
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-ghana-surface border border-white/8 flex items-center justify-center shadow-card">
                    <span className="text-4xl" role="img" aria-label="Budgets">📊</span>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center">
                    <span className="text-gold text-xs font-bold">0</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-white font-semibold mb-1">No budgets yet</h2>
                  <p className="text-muted text-sm max-w-xs">
                    Set spending limits for your categories to track where your money goes each month.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-2 px-6 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
                    hover:brightness-110 active:scale-95 transition-all min-h-[44px] shadow-gold-glow"
                >
                  Create your first budget
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add budget modal */}
      <AddBudgetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        categories={categories}
        existingCategoryIds={existingCategoryIds}
      />
    </div>
  );
}
