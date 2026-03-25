import { useState, useEffect, useCallback } from 'react';
import type { BudgetWithSpending, Category } from '@cedisense/shared';
import { api } from '@/lib/api';
import { BudgetSummaryBar } from '@/components/budgets/BudgetSummaryBar';
import { BudgetCard } from '@/components/budgets/BudgetCard';
import { AddBudgetModal } from '@/components/budgets/AddBudgetModal';
import { AdinkraWhisper } from '@/components/shared/AdinkraWhisper';

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
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-ghana-dark/95 border-b border-[#1F1F35]/40 px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-5 rounded-full bg-[#FF6B35]/50" />
            <h1 className="text-text-primary text-xl font-bold font-display tracking-tight">Budgets</h1>
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
              /* Empty state -- UNIQUE: pie chart themed */
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center motion-safe:animate-slide-up">
                <div className="relative">
                  {/* Pie chart illustration */}
                  <div className="w-20 sm:w-24 md:w-28 h-20 sm:h-24 md:h-28 relative motion-safe:animate-float">
                    <svg viewBox="0 0 112 112" fill="none" className="w-full h-full">
                      {/* Outer ring segments */}
                      <circle cx="56" cy="56" r="42" stroke="#1F1F35" strokeWidth="12" />
                      <circle
                        cx="56" cy="56" r="42"
                        stroke="#D4A843" strokeWidth="12"
                        strokeDasharray="66 198"
                        strokeDashoffset="0"
                        strokeLinecap="round"
                        opacity="0.5"
                        className="motion-safe:animate-pulse-soft"
                      />
                      <circle
                        cx="56" cy="56" r="42"
                        stroke="#22C55E" strokeWidth="12"
                        strokeDasharray="44 220"
                        strokeDashoffset="-66"
                        strokeLinecap="round"
                        opacity="0.4"
                      />
                      <circle
                        cx="56" cy="56" r="42"
                        stroke="#8B8BA3" strokeWidth="12"
                        strokeDasharray="33 231"
                        strokeDashoffset="-110"
                        strokeLinecap="round"
                        opacity="0.25"
                      />
                      {/* Center circle */}
                      <circle cx="56" cy="56" r="24" fill="#0E0E18" />
                      <text x="56" y="60" textAnchor="middle" fill="#D4A843" fontSize="14" fontWeight="bold" opacity="0.6">₵</text>
                    </svg>
                    {/* Ambient glow */}
                    <div className="absolute inset-0 bg-gold/[0.04] blur-2xl rounded-full scale-150" />
                  </div>
                </div>
                <div>
                  <h2 className="text-text-primary font-semibold text-lg mb-1.5">Take control of your spending</h2>
                  <p className="text-muted text-sm max-w-xs leading-relaxed">
                    Set monthly limits for each category and watch your spending habits transform. Your wallet will thank you.
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

      <AdinkraWhisper symbol="dwennimmen" className="mt-8 mb-4" />

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
