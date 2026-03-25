import { useEffect, useRef, useState } from 'react';
import { formatPesewas } from '@cedisense/shared';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface SummaryCardProps {
  income: number;
  expenses: number;
  fees: number;
}

function useCountUp(target: number, durationMs = 600): number {
  const prefersReduced = usePrefersReducedMotion();
  const [value, setValue] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (prefersReduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) {
        raf.current = requestAnimationFrame(tick);
      }
    }
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, durationMs, prefersReduced]);

  return value;
}

export function SummaryCard({ income, expenses, fees }: SummaryCardProps) {
  const net = income - expenses;
  const animatedNet = useCountUp(Math.abs(net), 700);

  return (
    <div
      className="rounded-[14px] p-4 card-interactive motion-safe:animate-fade-in"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}
    >
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Income column */}
        <div
          className="relative rounded-xl p-4 overflow-hidden"
          style={{
            background: 'rgba(0,200,150,0.08)',
            border: '1px solid rgba(0,200,150,0.12)',
          }}
        >
          {/* Subtle teal gradient in top-left corner */}
          <div className="pointer-events-none absolute -top-6 -left-6 w-20 h-20 bg-income/[0.08] rounded-full blur-2xl" />
          <p className="section-label relative">Income</p>
          <div className="flex items-center gap-1.5 mt-3 relative">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-income/15 text-income text-xs font-bold flex-shrink-0 motion-safe:animate-bounce-once">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
              </svg>
            </span>
            <span className="text-lg font-extrabold text-income tracking-tight tabular-nums">{formatPesewas(income)}</span>
          </div>
        </div>

        {/* Expenses column */}
        <div
          className="relative rounded-xl p-4 overflow-hidden"
          style={{
            background: 'rgba(255,107,138,0.08)',
            border: '1px solid rgba(255,107,138,0.12)',
          }}
        >
          {/* Subtle rose gradient in top-left corner */}
          <div className="pointer-events-none absolute -top-6 -left-6 w-20 h-20 bg-expense/[0.08] rounded-full blur-2xl" />
          <p className="section-label relative">Expenses</p>
          <div className="flex items-center gap-1.5 mt-3 relative">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-expense/15 text-expense text-xs font-bold flex-shrink-0 motion-safe:animate-bounce-once">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </span>
            <span className="text-lg font-extrabold text-expense tracking-tight tabular-nums">{formatPesewas(expenses)}</span>
          </div>
          {fees > 0 && (
            <p className="text-muted-dim text-xs mt-2 pl-6.5 tabular-nums relative">Fees: {formatPesewas(fees)}</p>
          )}
        </div>
      </div>

      {/* Net row — clean separator via background contrast */}
      <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(136, 136, 168, 0.08)' }}>
        <span className="section-label">Net</span>
        <span
          className={`text-base font-extrabold tracking-tight motion-safe:animate-count-up ${
            net >= 0 ? 'text-income' : 'text-expense'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {net >= 0 ? '+' : '-'}{formatPesewas(animatedNet)}
        </span>
      </div>
    </div>
  );
}
