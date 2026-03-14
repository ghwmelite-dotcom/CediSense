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

  // Split into incomplete and completed
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
        setTimeout(() => setCelebration(null), 2000);
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
      <div className="sticky top-0 z-10 bg-ghana-dark/95 backdrop-blur border-b border-white/5 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <h1 className="text-white text-xl font-bold">Savings Goals</h1>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="bg-gold text-ghana-black text-sm font-semibold px-4 py-2
              rounded-xl hover:bg-gold/90 transition-colors active:scale-95"
          >
            + New Goal
          </button>
        </div>
      </div>

      {/* Goal reached celebration toast */}
      {celebration && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3
            bg-income/20 border border-income/40 rounded-xl text-income font-semibold
            text-sm shadow-lg backdrop-blur-sm animate-pulse"
          role="status"
        >
          🎉 Goal reached: {celebration}!
        </div>
      )}

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-ghana-surface animate-pulse" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-expense text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                fetchGoals();
              }}
              className="text-gold text-sm underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && goals.length === 0 && (
          <div className="text-center py-16 px-6">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-white text-lg font-semibold mb-2">
              Start saving towards your goals
            </h2>
            <p className="text-muted text-sm mb-8">
              Set a target, track your progress, and celebrate when you reach it.
            </p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="w-full max-w-xs mx-auto block py-3 rounded-xl bg-gold
                text-ghana-black font-semibold hover:bg-gold/90 transition-colors"
            >
              Create your first goal
            </button>
          </div>
        )}

        {/* Active goals list */}
        {!loading && !error && incomplete.length > 0 && (
          <div className="space-y-4">
            {incomplete.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onContribute={handleContribute}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Completed goals section */}
        {!loading && !error && completed.length > 0 && (
          <div className="pt-2">
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
