import { useState, useEffect, useCallback } from 'react';
import type { IOU, IOUDirection } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { api } from '@/lib/api';
import { IOUCard } from '@/components/splits/IOUCard';
import { AddIOUModal } from '@/components/splits/AddIOUModal';

// ─── Summary card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
  totalOwedToMe: number;
  totalIOwe: number;
}

function SummaryCard({ totalOwedToMe, totalIOwe }: SummaryCardProps) {
  const net = totalOwedToMe - totalIOwe;
  const isPositive = net >= 0;

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4 grid grid-cols-3 gap-2 sm:gap-3">
      <div className="space-y-0.5">
        <p className="text-muted text-xs">Owed to you</p>
        <p className="text-income font-bold text-lg sm:text-xl">{formatPesewas(totalOwedToMe)}</p>
      </div>
      <div className="space-y-0.5">
        <p className="text-muted text-xs">You owe</p>
        <p className="text-expense font-bold text-lg sm:text-xl">{formatPesewas(totalIOwe)}</p>
      </div>
      <div className="space-y-0.5 text-right">
        <p className="text-muted text-xs">Net</p>
        <p className={`font-bold text-lg sm:text-xl ${isPositive ? 'text-income' : 'text-expense'}`}>
          {isPositive ? '+' : ''}{formatPesewas(net)}
        </p>
      </div>
    </div>
  );
}

// ─── Person group ─────────────────────────────────────────────────────────────

interface PersonGroupProps {
  personName: string;
  ious: IOU[];
  onSettle: (id: string) => void;
  onDelete: (id: string) => void;
}

function PersonGroup({ personName, ious, onSettle, onDelete }: PersonGroupProps) {
  // Net for this person: owed_to_me is positive, i_owe is negative
  const net = ious.reduce((sum, iou) => {
    return sum + (iou.direction === 'owed_to_me' ? iou.amount_pesewas : -iou.amount_pesewas);
  }, 0);
  const isPositive = net >= 0;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-white font-semibold text-sm">{personName}</h2>
        <span
          className={`text-xs font-semibold ${isPositive ? 'text-income' : 'text-expense'}`}
        >
          {isPositive ? '+' : ''}{formatPesewas(net)}
        </span>
      </div>
      <div className="space-y-2">
        {ious.map((iou) => (
          <IOUCard key={iou.id} iou={iou} onSettle={onSettle} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

// ─── Settled section ──────────────────────────────────────────────────────────

interface SettledSectionProps {
  ious: IOU[];
  onDelete: (id: string) => void;
}

function SettledSection({ ious, onDelete }: SettledSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (ious.length === 0) return null;

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 text-muted text-sm font-semibold uppercase
          tracking-wide w-full text-left hover:text-white transition-colors"
        aria-expanded={expanded}
      >
        <svg
          className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        Settled ({ious.length})
      </button>

      {expanded && (
        <div className="space-y-2">
          {ious.map((iou) => (
            <IOUCard
              key={iou.id}
              iou={iou}
              onSettle={() => {}}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── SplitsPage ───────────────────────────────────────────────────────────────

export function SplitsPage() {
  const [ious, setIous] = useState<IOU[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const data = await api.get<IOU[]>('/ious');
      setIous(data);
    } catch {
      // Non-fatal: keep existing state
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

  async function handleCreate(data: {
    person_name: string;
    amount_pesewas: number;
    direction: IOUDirection;
    description?: string;
  }) {
    await api.post('/ious', data);
    setModalOpen(false);
    await fetchAll();
  }

  async function handleSettle(id: string) {
    await api.post(`/ious/${id}/settle`);
    await fetchAll();
  }

  async function handleDelete(id: string) {
    await api.delete(`/ious/${id}`);
    await fetchAll();
  }

  // Separate settled from unsettled
  const unsettled = ious.filter((iou) => !iou.is_settled);
  const settled = ious.filter((iou) => iou.is_settled);

  // Compute summary totals from unsettled IOUs
  const totalOwedToMe = unsettled
    .filter((iou) => iou.direction === 'owed_to_me')
    .reduce((sum, iou) => sum + iou.amount_pesewas, 0);

  const totalIOwe = unsettled
    .filter((iou) => iou.direction === 'i_owe')
    .reduce((sum, iou) => sum + iou.amount_pesewas, 0);

  // Group unsettled IOUs by person_name (case-insensitive, display with original casing)
  const groupMap = new Map<string, { displayName: string; ious: IOU[] }>();
  for (const iou of unsettled) {
    const key = iou.person_name.toLowerCase();
    if (!groupMap.has(key)) {
      groupMap.set(key, { displayName: iou.person_name, ious: [] });
    }
    groupMap.get(key)!.ious.push(iou);
  }
  const groups = Array.from(groupMap.values());

  // Unique existing names for autocomplete
  const existingNames = Array.from(
    new Set(ious.map((iou) => iou.person_name))
  ).sort();

  const isEmpty = !loading && ious.length === 0;

  return (
    <div className="pb-24">
      {/* Sticky page header */}
      <div className="sticky top-0 z-30 bg-ghana-dark/95 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between max-w-screen-lg mx-auto">
          <h1 className="text-white text-xl font-bold font-display">Shared Expenses</h1>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gold text-ghana-dark
              font-semibold text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-6 max-w-screen-lg mx-auto">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            <div className="h-20 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-24 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-24 rounded-xl bg-ghana-surface animate-pulse" />
            <div className="h-24 rounded-xl bg-ghana-surface animate-pulse" />
          </div>
        )}

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
                    d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337
                       0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15
                       19.128v-.003c0-1.113-.285-2.16-.786-3.07M15
                       19.128v.106A12.318 12.318 0 018.624 21c-2.331
                       0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375
                       0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75
                       0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625
                       0 11-5.25 0 2.625 2.625 0 015.25 0z"
                  />
                </svg>
                <div className="space-y-1">
                  <p className="text-white font-semibold">No IOUs yet</p>
                  <p className="text-muted text-sm max-w-xs">
                    Track money you lend or borrow with friends and family.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setModalOpen(true)}
                  className="mt-2 px-6 py-3 rounded-xl bg-gold text-ghana-dark font-semibold
                    text-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
                >
                  Add IOU
                </button>
              </div>
            )}

            {/* Summary card (only shown when there are unsettled IOUs) */}
            {unsettled.length > 0 && (
              <SummaryCard totalOwedToMe={totalOwedToMe} totalIOwe={totalIOwe} />
            )}

            {/* Grouped unsettled IOUs */}
            {groups.length > 0 && (
              <div className="space-y-5">
                {groups.map((group) => (
                  <PersonGroup
                    key={group.displayName.toLowerCase()}
                    personName={group.displayName}
                    ious={group.ious}
                    onSettle={handleSettle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {/* Settled section */}
            <SettledSection ious={settled} onDelete={handleDelete} />
          </>
        )}
      </div>

      {/* Add IOU modal */}
      <AddIOUModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        existingNames={existingNames}
      />
    </div>
  );
}
