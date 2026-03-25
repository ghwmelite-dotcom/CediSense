import { useState, useEffect, useCallback } from 'react';
import type { SavingsGoalWithProgress } from '@cedisense/shared';
import { api } from '@/lib/api';
import { GoalCard } from '@/components/goals/GoalCard';
import { AddGoalModal } from '@/components/goals/AddGoalModal';
import { CompletedSection } from '@/components/goals/CompletedSection';
import { AdinkraWhisper } from '@/components/shared/AdinkraWhisper';

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
      // Non-fatal -- user can try again
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
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-ghana-dark/95 border-b border-[#1F1F35]/40 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-5 rounded-full bg-[#FF6B35]/50" />
            <h1 className="text-text-primary text-xl font-bold font-display tracking-tight">Savings Goals</h1>
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
              premium-card !border-gold/20 shadow-gold-glow-lg"
          >
            <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0016.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.023 6.023 0 01-2.52.587 6.023 6.023 0 01-2.52-.587" />
              </svg>
            </div>
            <div>
              <p className="text-gold font-semibold text-sm">Goal Reached!</p>
              <p className="text-muted text-xs">{celebration}</p>
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-expense/[0.06] flex items-center justify-center">
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

        {/* Empty state -- UNIQUE: target/flag themed */}
        {!loading && !error && goals.length === 0 && (
          <div className="text-center py-20 px-6 motion-safe:animate-slide-up">
            <div className="relative inline-flex items-center justify-center mb-6">
              <div className="relative w-20 sm:w-24 md:w-28 h-20 sm:h-24 md:h-28 motion-safe:animate-float">
                <svg viewBox="0 0 112 112" fill="none" className="w-full h-full">
                  {/* Mountain/flag illustration */}
                  {/* Mountain */}
                  <path d="M16 90 L56 30 L96 90 Z" fill="#171727" stroke="#D4A843" strokeWidth="1" strokeOpacity="0.2" />
                  <path d="M36 90 L66 50 L96 90 Z" fill="#1D1D30" stroke="#D4A843" strokeWidth="0.5" strokeOpacity="0.15" />
                  {/* Flag pole */}
                  <line x1="56" y1="30" x2="56" y2="12" stroke="#D4A843" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
                  {/* Flag */}
                  <path d="M56 12 L76 18 L56 24 Z" fill="#D4A843" opacity="0.4" className="motion-safe:animate-pulse-soft" />
                  {/* Stars */}
                  <circle cx="30" cy="24" r="1.5" fill="#E8C873" opacity="0.3" />
                  <circle cx="82" cy="20" r="1" fill="#E8C873" opacity="0.25" />
                  <circle cx="44" cy="16" r="1.2" fill="#E8C873" opacity="0.2" />
                  {/* Base line */}
                  <line x1="8" y1="90" x2="104" y2="90" stroke="#5A5A72" strokeWidth="1" strokeOpacity="0.2" />
                </svg>
                {/* Ambient glow */}
                <div className="absolute inset-0 bg-gold/[0.04] blur-2xl rounded-full scale-150" />
              </div>
            </div>
            <h2 className="text-text-primary text-lg font-semibold mb-2">
              Dream it. Save it. Achieve it.
            </h2>
            <p className="text-muted text-sm mb-8 max-w-xs mx-auto leading-relaxed">
              Whether it is a new phone, a trip to Cape Coast, or an emergency fund -- set a target and watch your progress climb.
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

      <AdinkraWhisper symbol="fawohodie" className="mt-8 mb-4" />

      {/* Add goal modal */}
      <AddGoalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
