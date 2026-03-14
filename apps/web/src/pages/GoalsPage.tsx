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
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-ghana-dark/90 border-b border-white/8 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-gold" />
            <h1 className="text-white text-xl font-bold tracking-tight">Savings Goals</h1>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="bg-gold text-ghana-black text-sm font-semibold px-4 py-2
              rounded-xl hover:brightness-110 transition-all active:scale-95
              shadow-gold-glow min-h-[44px]"
          >
            + New Goal
          </button>
        </div>
      </div>

      {/* Goal reached celebration — premium toast */}
      {celebration && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 motion-safe:animate-slide-down"
          role="status"
          aria-live="polite"
        >
          <div
            className="flex items-center gap-3 px-5 py-3.5 rounded-2xl
              bg-ghana-surface border border-gold/40 shadow-gold-glow-lg
              backdrop-blur-xl"
          >
            {/* Confetti-feel badge */}
            <div className="w-10 h-10 rounded-full bg-gold/20 border border-gold/40 flex items-center justify-center shrink-0">
              <span className="text-xl" role="img" aria-hidden="true">🏆</span>
            </div>
            <div>
              <p className="text-gold font-semibold text-sm">Goal Reached!</p>
              <p className="text-white/80 text-xs">{celebration}</p>
            </div>
            {/* Sparkle dots */}
            <div className="flex gap-0.5 shrink-0">
              {['⭐', '✨', '🌟'].map((s, i) => (
                <span
                  key={i}
                  className="text-xs motion-safe:animate-pulse-soft"
                  style={{ animationDelay: `${i * 150}ms` }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4 motion-safe:animate-fade-in">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-2xl bg-ghana-surface animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12 motion-safe:animate-fade-in">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchGoals();
              }}
              className="text-gold text-sm font-medium px-4 py-2 rounded-xl bg-gold/10 hover:bg-gold/20 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && goals.length === 0 && (
          <div className="text-center py-16 px-6 motion-safe:animate-slide-up">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="w-24 h-24 rounded-full bg-ghana-surface border border-white/8 flex items-center justify-center shadow-card">
                <span className="text-4xl" role="img" aria-label="Goals">🎯</span>
              </div>
              {/* Orbit ring */}
              <div
                className="absolute inset-0 rounded-full border border-gold/20 motion-safe:animate-ping"
                style={{ animationDuration: '3s' }}
              />
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">
              Start saving towards your goals
            </h2>
            <p className="text-muted text-sm mb-8 max-w-xs mx-auto">
              Set a target, track your progress, and celebrate when you reach it.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full max-w-xs mx-auto block py-3 rounded-xl bg-gold
                text-ghana-black font-semibold hover:brightness-110 transition-all
                active:scale-[0.98] shadow-gold-glow"
            >
              Create your first goal
            </button>
          </div>
        )}

        {/* Active goals list — staggered */}
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
