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

  return (
    <div className="sticky top-0 z-10 bg-ghana-dark/95 backdrop-blur flex items-center justify-between px-4 py-3 border-b border-white/5">
      <button
        type="button"
        onClick={() => onMonthChange(addMonths(month, -1))}
        className="w-10 h-10 flex items-center justify-center rounded-lg text-gold hover:bg-white/10 transition-colors"
        aria-label="Previous month"
      >
        ←
      </button>
      <span className="text-white text-lg font-semibold">
        {formatMonthLabel(month)}
      </span>
      <button
        type="button"
        onClick={() => onMonthChange(addMonths(month, 1))}
        disabled={isCurrentMonth}
        className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors ${
          isCurrentMonth ? 'text-muted cursor-not-allowed' : 'text-gold hover:bg-white/10'
        }`}
        aria-label="Next month"
      >
        →
      </button>
    </div>
  );
}
