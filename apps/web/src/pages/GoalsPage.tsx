import { useState, useEffect, useCallback } from 'react';
import type { SavingsGoalWithProgress } from '@cedisense/shared';
import { api } from '@/lib/api';
import { GoalCard } from '@/components/goals/GoalCard';
import { AddGoalModal } from '@/components/goals/AddGoalModal';
import { CompletedSection } from '@/components/goals/CompletedSection';

export function GoalsPage() {
  const [goals, setGoals] = useState<SavingsGoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [celebration, setCelebration] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    try {
      const data = await api.get<SavingsGoalWithProgress[]>('/goals');
      setGoals(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const incomplete = goals.filter((g) => !g.is_complete);
  const completed = goals.filter((g) => g.is_complete);

  async function handleCreate(name: string, target: number, deadline?: string) {
    try {
      await api.post('/goals', {
        name,
        target_pesewas: target,
        deadline: deadline ?? null,
      });
      setModalOpen(false);
      setLoading(true);
      await fetchGoals();
    } catch {
      // Let the user retry via the form
    }
  }

  async function handleContribute(id: string, amount: number) {
    try {
      const result = await api.post<SavingsGoalWithProgress>(`/goals/${id}/contribute`, {
        amount_pesewas: amount,
      });
      if (result?.is_complete) {
        const goal = goals.find((g) => g.id === id);
        setCelebration(goal?.name ?? 'Goal');
        setTimeout(() => setCelebration(null), 3500);
      }
      await fetchGoals();
    } catch {
      // Non-fatal — user can try again
    }
  }

  async function handleUpdate(
    id: string,
    data: { name?: string; target_pesewas?: number; deadline?: string | null }
  ) {
    try {
      await api.put(`/goals/${id}`, data);
      await fetchGoals();
    } catch {
      // Non-fatal
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/goals/${id}`);
      setGoals((prev) => prev.filter((g) => g.id !== id));
    } catch {
      // Non-fatal
    }
  }

  return (
    <div className="pb-24">
      {/* Sticky page header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-ghana-dark/95 border-b border-white/[0.04] px-4 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-5 rounded-full bg-gold/50" />
            <h1 className="text-white text-xl font-bold tracking-tight">Savings Goals</h1>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-gold px-4 py-2.5 text-sm min-h-[44px]"
          >
            + New Goal
          </button>
        </div>
      </div>

      {/* Goal reached celebration toast */}
      {celebration && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 motion-safe:animate-slide-down"
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-3 px-5 py-4 rounded-2xl
              glass-card !border-gold/20 shadow-gold-glow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.52.587 6.023 6.023 0 01-2.52-.587" />
              </svg>
            </div>
            <div>
              <p className="text-gold font-semibold text-sm">Goal Reached!</p>
              <p className="text-white/70 text-xs">{celebration}</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-5 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 motion-safe:animate-fade-in">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl skeleton" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-16 motion-safe:animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-expense/[0.06] flex items-center justify-center">
              <svg className="w-7 h-7 text-expense/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <p className="text-muted text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchGoals();
              }}
              className="text-gold text-sm font-medium px-5 py-2.5 rounded-xl bg-gold/[0.06] hover:bg-gold/[0.1] transition-colors min-h-[44px]"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && goals.length === 0 && (
          <div className="text-center py-20 px-6 motion-safe:animate-slide-up">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <svg className="w-10 h-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5" />
                </svg>
              </div>
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">
              Start saving towards your goals
            </h2>
            <p className="text-muted text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Set a target, track your progress, and celebrate when you reach it.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="btn-gold w-full max-w-xs mx-auto block py-3 text-sm min-h-[44px]"
            >
              Create your first goal
            </button>
          </div>
        )}

        {/* Active goals list */}
        {!loading && !error && incomplete.length > 0 && (
          <div className="space-y-4">
            {incomplete.map((goal, index) => (
              <div
                key={goal.id}
                className="motion-safe:animate-slide-up"
                style={{ animationDelay: `${index * 70}ms`, animationFillMode: 'both' }}
              >
                <GoalCard
                  goal={goal}
                  onContribute={handleContribute}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              </div>
            ))}
          </div>
        )}

        {/* Completed goals section */}
        {!loading && !error && completed.length > 0 && (
          <div className="pt-2 motion-safe:animate-fade-in">
            <CompletedSection goals={completed} />
          </div>
        )}
      </div>

      {/* Add goal modal */}
      <AddGoalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
