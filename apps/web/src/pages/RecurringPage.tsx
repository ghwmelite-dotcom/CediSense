import { useState, useEffect, useCallback } from 'react';
import type { RecurringWithStatus, RecurringCandidate } from '@cedisense/shared';
import { api } from '@/lib/api';
import { CandidateCard } from '@/components/recurring/CandidateCard';
import { RecurringCard } from '@/components/recurring/RecurringCard';

export function RecurringPage() {
  const [recurring, setRecurring] = useState<RecurringWithStatus[]>([]);
  const [candidates, setCandidates] = useState<RecurringCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [inactiveExpanded, setInactiveExpanded] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [recurringData, candidatesData] = await Promise.all([
        api.get<RecurringWithStatus[]>('/recurring'),
        api.get<RecurringCandidate[]>('/recurring/candidates'),
      ]);
      setRecurring(recurringData);
      setCandidates(candidatesData);
    } catch {
      // non-fatal: keep existing state
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchAll();
      setLoading(false);
    }
    void init();
  }, [fetchAll]);

  async function handleScan() {
    setScanning(true);
    try {
      await api.post('/recurring/scan');
      await fetchAll();
    } finally {
      setScanning(false);
    }
  }

  async function handleConfirm(id: string, reminderDaysBefore: number) {
    await api.post(`/recurring/candidates/${id}/confirm`, {
      reminder_days_before: reminderDaysBefore,
    });
    await fetchAll();
  }

  async function handleDismiss(id: string) {
    await api.post(`/recurring/candidates/${id}/dismiss`);
    await fetchAll();
  }

  async function handleUpdate(id: string, data: Record<string, unknown>) {
    await api.put(`/recurring/${id}`, data);
    await fetchAll();
  }

  async function handleDelete(id: string) {
    await api.delete(`/recurring/${id}`);
    await fetchAll();
  }

  const activeItems = recurring.filter((r) => r.is_active);
  const inactiveItems = recurring.filter((r) => !r.is_active);
  const isEmpty = recurring.length === 0 && candidates.length === 0;

  return (
    <div className="pb-24">
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 bg-ghana-dark/95 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <h1 className="text-white text-xl font-bold">Recurring &amp; Bills</h1>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-ghana-dark font-semibold
              text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]
              disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <svg
                  className="w-4 h-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Scanning…
              </>
            ) : (
              'Scan for Patterns'
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-20 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {/* Loaded state */}
        {!loading && (
          <>
            {/* Empty state */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <svg
                  className="w-14 h-14 text-muted"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25
                       2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121
                       7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25
                       2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0
                       015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
                  />
                </svg>
                <p className="text-muted text-sm max-w-xs">
                  No recurring transactions detected yet. Scan your transactions to find bills and subscriptions.
                </p>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={scanning}
                  className="mt-2 px-6 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
                    hover:brightness-110 active:scale-95 transition-all min-h-[44px]
                    disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {scanning ? 'Scanning…' : 'Scan Now'}
                </button>
              </div>
            )}

            {/* Candidates section */}
            {candidates.length > 0 && (
              <section className="space-y-3">
                {/* Gold banner */}
                <div className="bg-gold/15 border border-gold/30 rounded-xl px-4 py-3">
                  <p className="text-gold font-semibold text-sm">
                    We found {candidates.length} possible recurring{' '}
                    {candidates.length === 1 ? 'payment' : 'payments'}
                  </p>
                  <p className="text-muted text-xs mt-0.5">
                    Confirm the ones you want to track for reminders
                  </p>
                </div>

                <div className="space-y-3">
                  {candidates.map((c) => (
                    <CandidateCard
                      key={c.id}
                      candidate={c}
                      onConfirm={handleConfirm}
                      onDismiss={handleDismiss}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Active recurring section */}
            {activeItems.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-white font-semibold text-sm uppercase tracking-wide">
                  Active ({activeItems.length})
                </h2>
                <div className="space-y-3">
                  {activeItems.map((item) => (
                    <RecurringCard
                      key={item.id}
                      item={item}
                      onUpdate={handleUpdate}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Inactive / paused section */}
            {inactiveItems.length > 0 && (
              <section className="space-y-3 opacity-75">
                {/* Collapsible header */}
                <button
                  type="button"
                  onClick={() => setInactiveExpanded((prev) => !prev)}
                  className="flex items-center gap-2 text-muted text-sm font-semibold uppercase
                    tracking-wide w-full text-left hover:text-white transition-colors"
                  aria-expanded={inactiveExpanded}
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${inactiveExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  Paused ({inactiveItems.length})
                </button>

                {inactiveExpanded && (
                  <div className="space-y-3">
                    {inactiveItems.map((item) => (
                      <RecurringCard
                        key={item.id}
                        item={item}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
