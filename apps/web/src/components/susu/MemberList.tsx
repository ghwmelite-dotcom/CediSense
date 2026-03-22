import { useState, useRef, useCallback } from 'react';
import type { SusuGroupWithDetails } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

type Member = SusuGroupWithDetails['members'][number];

interface MemberListProps {
  members: Member[];
  myMemberId: string | null | undefined;
  isCreator: boolean;
  payoutRecipient: SusuGroupWithDetails['payout_recipient'];
  contributionPesewas: number;
  penaltyPercent: number;
  onContribute: (memberId: string, isLate: boolean) => void;
  onViewReceipt?: (memberId: string) => void;
  onReorderMembers?: (memberIds: string[]) => void;
  reorderSaving?: boolean;
}

export function MemberList({
  members,
  myMemberId,
  isCreator,
  payoutRecipient,
  contributionPesewas,
  penaltyPercent,
  onContribute,
  onViewReceipt,
  onReorderMembers,
  reorderSaving = false,
}: MemberListProps) {
  const [lateMembers, setLateMembers] = useState<Set<string>>(new Set());

  // ── Drag-to-reorder state ─────────────────────────────────────────────────
  const [reorderMode, setReorderMode] = useState(false);
  const [dragOrder, setDragOrder] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<HTMLDivElement | null>(null);
  const touchStartY = useRef(0);

  const sortedMembers = [...members].sort((a, b) => a.payout_order - b.payout_order);

  const enterReorderMode = useCallback(() => {
    const sorted = [...members].sort((a, b) => a.payout_order - b.payout_order);
    setDragOrder(sorted.map((m) => m.id));
    setReorderMode(true);
  }, [members]);

  const cancelReorderMode = useCallback(() => {
    setReorderMode(false);
    setDragOrder([]);
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const saveReorder = useCallback(() => {
    if (onReorderMembers && dragOrder.length > 0) {
      onReorderMembers(dragOrder);
    }
  }, [onReorderMembers, dragOrder]);

  const moveItem = useCallback((from: number, to: number) => {
    setDragOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleDragStart = useCallback((index: number) => {
    setDragIndex(index);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    setOverIndex(index);
    moveItem(dragIndex, index);
    setDragIndex(index);
  }, [dragIndex, moveItem]);

  const handleDragEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, index: number) => {
    touchStartY.current = e.touches[0].clientY;
    setDragIndex(index);
    dragItemRef.current = e.currentTarget as HTMLDivElement;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragIndex === null || !dragItemRef.current) return;
    e.preventDefault();
    const touch = e.touches[0];
    const elements = dragItemRef.current.parentElement?.children;
    if (!elements) return;

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom && i !== dragIndex) {
        moveItem(dragIndex, i);
        setDragIndex(i);
        setOverIndex(i);
        break;
      }
    }
  }, [dragIndex, moveItem]);

  const handleTouchEnd = useCallback(() => {
    setDragIndex(null);
    setOverIndex(null);
    dragItemRef.current = null;
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-muted text-xs font-semibold uppercase tracking-wide">
          Members ({members.length})
        </h3>
        {/* Reorder toggle — creator only */}
        {isCreator && onReorderMembers && !reorderMode && (
          <button
            type="button"
            onClick={enterReorderMode}
            className="flex items-center gap-1.5 text-xs text-gold font-medium
              hover:text-gold/80 active:scale-95 transition-all min-h-[36px] px-1"
            aria-label="Reorder payout positions"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
            Reorder
          </button>
        )}
        {reorderMode && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelReorderMode}
              className="text-xs text-muted font-medium hover:text-white
                active:scale-95 transition-all min-h-[36px] px-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                saveReorder();
                setReorderMode(false);
              }}
              disabled={reorderSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40
                text-gold text-xs font-semibold hover:bg-gold/30 active:scale-95 transition-all
                min-h-[36px] disabled:opacity-40"
            >
              {reorderSaving ? 'Saving...' : 'Save Order'}
            </button>
          </div>
        )}
      </div>

      {/* Reorder mode hint */}
      {reorderMode && (
        <p className="text-[11px] text-muted px-1">
          Drag members to set payout order. Position 1 gets paid first.
        </p>
      )}

      <div className="space-y-2">
        {reorderMode ? (
          /* ── Reorder mode: draggable list ──────────────────────────────── */
          dragOrder.map((memberId, index) => {
            const member = members.find((m) => m.id === memberId);
            if (!member) return null;
            const isMe = myMemberId === member.id;
            const isDragging = dragIndex === index;

            return (
              <div
                key={member.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, index)}
                onTouchMove={(e) => handleTouchMove(e)}
                onTouchEnd={handleTouchEnd}
                className={`flex items-center gap-3 rounded-xl p-3 border transition-all
                  select-none cursor-grab active:cursor-grabbing
                  ${isDragging
                    ? 'bg-gold/15 border-gold/40 scale-[1.02] shadow-lg shadow-gold/10'
                    : 'bg-ghana-surface border-white/10 hover:border-gold/20'
                  }`}
                role="listitem"
                aria-roledescription="Draggable member"
                aria-label={`Position ${index + 1}: ${member.display_name}. Drag to reorder.`}
              >
                {/* Drag handle */}
                <div className="flex flex-col items-center gap-0.5 shrink-0 text-muted touch-none w-6"
                  aria-hidden="true"
                >
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                    <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
                    <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
                    <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
                  </svg>
                </div>

                {/* Position number */}
                <span className="text-sm font-bold w-6 text-center shrink-0 text-gold">
                  {index + 1}
                </span>

                {/* Member info */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <p className="font-semibold text-sm text-white truncate">
                    {member.display_name}
                    {isMe && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                  </p>
                  <span
                    className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold shrink-0 border
                      ${member.trust_score >= 80
                        ? 'bg-income/15 border-income/40 text-income'
                        : member.trust_score >= 60
                          ? 'bg-gold/15 border-gold/40 text-gold'
                          : member.trust_score >= 40
                            ? 'bg-white/10 border-white/20 text-muted'
                            : 'bg-expense/15 border-expense/40 text-expense'
                      }`}
                    title={`Trust: ${member.trust_score} (${member.trust_label})`}
                  >
                    {member.trust_score}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          /* ── Normal mode: standard member list ─────────────────────────── */
          sortedMembers.map((member) => {
            const isRecipient = payoutRecipient?.id === member.id;
            const isMe = myMemberId === member.id;

            return (
              <div
                key={member.id}
                className={`flex items-center justify-between gap-3 rounded-xl p-3
                  border transition-colors
                  ${isRecipient
                    ? 'bg-gold/10 border-gold/30'
                    : 'bg-ghana-surface border-white/10'
                  }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {/* Payout order */}
                  <span
                    className={`text-xs font-bold w-5 text-center shrink-0
                      ${isRecipient ? 'text-gold' : 'text-muted'}`}
                  >
                    {member.payout_order}
                  </span>
                  <div className="min-w-0 flex items-center gap-2">
                    <p className={`font-semibold text-sm truncate
                      ${isRecipient ? 'text-gold' : 'text-white'}`}>
                      {member.display_name}
                      {isMe && (
                        <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>
                      )}
                    </p>
                    {/* Trust score badge */}
                    <span
                      className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-[10px] font-bold shrink-0 border
                        ${member.trust_score >= 80
                          ? 'bg-income/15 border-income/40 text-income'
                          : member.trust_score >= 60
                            ? 'bg-gold/15 border-gold/40 text-gold'
                            : member.trust_score >= 40
                              ? 'bg-white/10 border-white/20 text-muted'
                              : 'bg-expense/15 border-expense/40 text-expense'
                        }`}
                      title={`Trust: ${member.trust_score} (${member.trust_label})`}
                    >
                      {member.trust_score}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Contribution status */}
                  {member.has_contributed_this_round ? (
                    onViewReceipt ? (
                      <button
                        type="button"
                        onClick={() => onViewReceipt(member.id)}
                        className="flex items-center gap-1 text-xs text-income font-medium
                          hover:underline active:scale-95 transition-all min-h-[36px] px-1"
                        aria-label={`View receipt for ${member.display_name}`}
                        title="View receipt"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Paid
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-income font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Paid
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-muted font-medium">Pending</span>
                  )}

                  {/* Creator: record contribution button (only for unpaid members) */}
                  {isCreator && !member.has_contributed_this_round && (
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none" title="Mark as late contribution">
                        <input
                          type="checkbox"
                          checked={lateMembers.has(member.id)}
                          onChange={(e) => {
                            setLateMembers((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) { next.add(member.id); } else { next.delete(member.id); }
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5 accent-expense cursor-pointer"
                          aria-label={`Mark ${member.display_name} as late`}
                        />
                        <span className="text-[10px] text-expense font-medium">Late?</span>
                      </label>
                      {lateMembers.has(member.id) && (
                        <span className="text-[10px] text-expense font-mono">+{formatPesewas(Math.round(contributionPesewas * penaltyPercent / 100))}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const isLate = lateMembers.has(member.id);
                          onContribute(member.id, isLate);
                          setLateMembers((prev) => { const next = new Set(prev); next.delete(member.id); return next; });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gold/20 border border-gold/40 text-gold
                          text-xs font-semibold hover:bg-gold/30 active:scale-95 transition-all min-h-[36px]"
                      >
                        Record
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
