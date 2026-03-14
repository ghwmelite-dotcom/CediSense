import { useState, useEffect, useCallback } from 'react';
import type { InvestmentWithReturns, InvestmentSummary, InvestmentType } from '@cedisense/shared';
import { api } from '@/lib/api';
import { InvestmentSummaryCard } from '@/components/investments/InvestmentSummaryCard';
import { InvestmentCard } from '@/components/investments/InvestmentCard';
import type { AddInvestmentModalSaveData } from '@/components/investments/AddInvestmentModal';
import { AddInvestmentModal } from '@/components/investments/AddInvestmentModal';

type FilterTab = 'all' | InvestmentType;

const FILTER_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'tbill', label: 'T-Bills' },
  { value: 'mutual_fund', label: 'Mutual Funds' },
  { value: 'fixed_deposit', label: 'Fixed Deposits' },
  { value: 'other', label: 'Other' },
];

const EMPTY_SUMMARY: InvestmentSummary = {
  total_invested_pesewas: 0,
  total_current_value_pesewas: 0,
  total_returns_pesewas: 0,
  by_type: [],
};

export function InvestmentsPage() {
  const [investments, setInvestments] = useState<InvestmentWithReturns[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [invData, sumData] = await Promise.all([
        api.get<InvestmentWithReturns[]>('/investments'),
        api.get<InvestmentSummary>('/investments/summary'),
      ]);
      setInvestments(invData);
      setSummary(sumData);
    } catch {
      // non-fatal: leave existing state
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchData();
      setLoading(false);
    }
    void init();
  }, [fetchData]);

  const filtered =
    activeTab === 'all'
      ? investments
      : investments.filter((inv) => inv.type === activeTab);

  async function handleCreate(data: AddInvestmentModalSaveData) {
    await api.post('/investments', data);
    setModalOpen(false);
    await fetchData();
  }

  async function handleUpdate(
    id: string,
    data: Partial<{ current_value_pesewas: number; notes: string }>
  ) {
    await api.put(`/investments/${id}`, data);
    await fetchData();
  }

  async function handleMature(id: string) {
    await api.post(`/investments/${id}/mature`, {});
    await fetchData();
  }

  async function handleDelete(id: string) {
    await api.delete(`/investments/${id}`);
    setInvestments((prev) => prev.filter((inv) => inv.id !== id));
    await fetchData();
  }

  return (
    <div className="pb-24">
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 bg-ghana-dark/95 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <h1 className="text-white text-xl font-bold">Investments</h1>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
              hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
          >
            + Add
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-36 rounded-2xl bg-ghana-surface animate-pulse" />
            <div className="h-8 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-28 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

        {!loading && (
          <>
            {/* Summary card — only if there are investments */}
            {investments.length > 0 && <InvestmentSummaryCard summary={summary} />}

            {/* Filter tabs */}
            {investments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
                {FILTER_TABS.map((tab) => {
                  const count =
                    tab.value === 'all'
                      ? investments.length
                      : investments.filter((inv) => inv.type === tab.value).length;
                  if (count === 0 && tab.value !== 'all') return null;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium
                        transition-all min-h-[36px] border ${
                          activeTab === tab.value
                            ? 'bg-gold text-ghana-dark border-gold'
                            : 'bg-white/5 text-muted border-white/10 hover:bg-white/10'
                        }`}
                    >
                      {tab.label}
                      {count > 0 && (
                        <span
                          className={`ml-1.5 opacity-70 ${
                            activeTab === tab.value ? 'text-ghana-dark/70' : ''
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Investment list */}
            {filtered.length > 0 ? (
              <div className="space-y-4">
                {filtered.map((inv) => (
                  <InvestmentCard
                    key={inv.id}
                    investment={inv}
                    onUpdate={handleUpdate}
                    onMature={handleMature}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-14 h-14 text-muted/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
                <div>
                  <h2 className="text-white text-base font-semibold mb-1">
                    Track your investments
                  </h2>
                  <p className="text-muted text-sm max-w-xs">
                    Add T-Bills, mutual funds, and fixed deposits to see your portfolio performance
                    in one place.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-2 px-6 py-3 rounded-xl bg-gold text-ghana-dark font-semibold text-sm
                    hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
                >
                  Add Investment
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add investment modal */}
      <AddInvestmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
