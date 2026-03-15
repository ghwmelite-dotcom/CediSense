import { useState, useEffect } from 'react';

interface MonthPickerProps {
  month: string; // "2026-03"
  onMonthChange: (month: string) => void;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number);
  const d = new Date(year, mon - 1, 1);
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(d);
}

export function MonthPicker({ month, onMonthChange }: MonthPickerProps) {
  const isCurrentMonth = month === getCurrentMonth();
  const [displayLabel, setDisplayLabel] = useState(formatMonthLabel(month));
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const newLabel = formatMonthLabel(month);
    if (newLabel !== displayLabel) {
      setAnimating(true);
      const timer = setTimeout(() => {
        setDisplayLabel(newLabel);
        setAnimating(false);
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [month, displayLabel]);

  return (
    <div
      className="sticky top-0 z-10 flex items-center justify-between px-4 py-3"
      style={{
        background: 'rgba(12, 12, 20, 0.75)',
        backdropFilter: 'blur(24px) saturate(1.2)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
      }}
    >
      <button
        type="button"
        onClick={() => onMonthChange(addMonths(month, -1))}
        className="w-10 h-10 flex items-center justify-center rounded-xl text-muted hover:text-gold hover:bg-white/[0.04] motion-safe:hover:scale-110 transition-all duration-200"
        aria-label="Previous month"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <span
        className={`text-white text-base font-semibold tracking-tight transition-all duration-200 ${
          animating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
        }`}
      >
        {displayLabel}
      </span>
      <button
        type="button"
        onClick={() => onMonthChange(addMonths(month, 1))}
        disabled={isCurrentMonth}
        className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
          isCurrentMonth ? 'text-white/15 cursor-not-allowed' : 'text-muted hover:text-gold hover:bg-white/[0.04] motion-safe:hover:scale-110'
        }`}
        aria-label="Next month"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
}
