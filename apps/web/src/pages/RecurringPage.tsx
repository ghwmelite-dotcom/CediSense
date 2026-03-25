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
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-ghana-dark/95 border-b border-white/[0.04] px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-0.5 h-5 rounded-full bg-[#FF6B35]/50" />
            <h1 className="text-white text-xl font-bold font-display tracking-tight">Recurring &amp; Bills</h1>
          </div>
          <button
            type="button"
            onClick={handleScan}
            disabled={scanning}
            className="btn-gold flex items-center gap-2 px-4 py-2.5 text-sm min-h-[44px]
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Scanning...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
                </svg>
                Scan for Patterns
              </>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 pt-5 space-y-6 max-w-screen-lg mx-auto">
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
            {/* Empty state */}
            {isEmpty && (
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center motion-safe:animate-slide-up">
                <div className="w-24 h-24 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-muted/40"
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
                </div>
                <div>
                  <h2 className="text-white font-semibold mb-1.5">No bills detected yet</h2>
                  <p className="text-muted text-sm max-w-[260px] sm:max-w-xs leading-relaxed">
                    Scan your transactions to find recurring bills and subscriptions automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={scanning}
                  className="btn-gold mt-1 px-6 py-3 text-sm min-h-[44px]
                    disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {scanning ? 'Scanning...' : 'Scan Now'}
                </button>
              </div>
            )}

            {/* Candidates section */}
            {candidates.length > 0 && (
              <section className="space-y-3 motion-safe:animate-slide-up">
                <div
                  className="rounded-2xl p-px"
                  style={{
                    background: 'linear-gradient(135deg, rgba(212,168,67,0.3) 0%, rgba(212,168,67,0.08) 50%, rgba(0,107,63,0.15) 100%)',
                  }}
                >
                  <div className="bg-ghana-surface rounded-2xl px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/15 flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="w-4 h-4 text-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-gold/90 font-semibold text-sm">
                          {candidates.length} possible recurring {candidates.length === 1 ? 'payment' : 'payments'} found
                        </p>
                        <p className="text-muted text-xs mt-0.5">
                          Confirm the ones you want to track for reminders
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {candidates.map((c, index) => (
                    <div
                      key={c.id}
                      className="motion-safe:animate-slide-up"
                      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
                    >
                      <CandidateCard
                        candidate={c}
                        onConfirm={handleConfirm}
                        onDismiss={handleDismiss}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Active recurring section */}
            {activeItems.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-0.5 h-3.5 rounded-full bg-income/40" />
                  <h2 className="text-muted text-xs font-semibold uppercase tracking-wider">
                    Active ({activeItems.length})
                  </h2>
                </div>
                <div className="space-y-3">
                  {activeItems.map((item, index) => (
                    <div
                      key={item.id}
                      className="motion-safe:animate-slide-up"
                      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
                    >
                      <RecurringCard
                        item={item}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Inactive / paused section */}
            {inactiveItems.length > 0 && (
              <section className="space-y-3">
                <button
                  type="button"
                  onClick={() => setInactiveExpanded((prev) => !prev)}
                  className="flex items-center gap-2.5 text-muted/70 text-xs font-semibold uppercase
                    tracking-wider w-full text-left hover:text-muted transition-colors group min-h-[44px]"
                  aria-expanded={inactiveExpanded}
                >
                  <div className="w-5 h-5 rounded-md bg-white/[0.04] border border-white/[0.06] flex items-center justify-center
                    group-hover:bg-white/[0.06] transition-colors">
                    <svg
                      className={`w-3 h-3 transition-transform duration-200 ${inactiveExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  Paused ({inactiveItems.length})
                </button>

                {inactiveExpanded && (
                  <div className="space-y-3 opacity-60 motion-safe:animate-slide-down">
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
