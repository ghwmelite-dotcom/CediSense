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
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-ghana-dark/95 border-b border-white/[0.04] px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-5 rounded-full bg-gold/50" />
            <h1 className="text-white text-xl font-bold tracking-tight">Budgets</h1>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-gold px-4 py-2.5 text-sm min-h-[44px]"
          >
            + Add Budget
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 motion-safe:animate-fade-in">
            <div className="h-20 rounded-2xl skeleton" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl skeleton" />
            ))}
          </div>
        )}

        {/* Loaded state */}
        {!loading && (
          <>
            {/* Summary bar */}
            {budgets.length > 0 && <BudgetSummaryBar budgets={budgets} />}

            {/* Budget list */}
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
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center motion-safe:animate-slide-up">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                    <svg className="w-10 h-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                    </svg>
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <span className="text-gold text-xs font-bold">0</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-white font-semibold mb-1.5">No budgets yet</h2>
                  <p className="text-muted text-sm max-w-xs leading-relaxed">
                    Set spending limits for your categories to track where your money goes each month.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="btn-gold mt-1 px-6 py-3 text-sm min-h-[44px]"
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
