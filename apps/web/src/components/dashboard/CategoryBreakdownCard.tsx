import type { CategoryBreakdownItem } from '@cedisense/shared';
import { CategoryDonut } from './CategoryDonut';
import { CategoryRankedList } from './CategoryRankedList';

interface CategoryBreakdownCardProps {
  data: CategoryBreakdownItem[];
  totalExpenses: number;
  month: string;
}

function CategoryEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      {/* Faded donut illustration */}
      <div className="relative w-20 h-20 mb-5 opacity-25">
        <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
          <circle cx="40" cy="40" r="30" stroke="#5A5A72" strokeWidth="8" strokeDasharray="20 10" />
          <circle cx="40" cy="40" r="12" fill="#171727" />
        </svg>
      </div>
      <h3 className="text-text-primary font-semibold text-sm mb-1">No categories to show</h3>
      <p className="text-muted text-xs text-center max-w-[200px] leading-relaxed">
        Start adding transactions to see how your spending breaks down by category.
      </p>
    </div>
  );
}

export function CategoryBreakdownCard({ data, totalExpenses, month }: CategoryBreakdownCardProps) {
  const hasData = data.length > 0 && totalExpenses > 0;

  return (
    <div className="relative premium-card rounded-2xl p-5 overflow-hidden motion-safe:animate-fade-in">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      {/* Section title with visual accent */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-1 h-4 rounded-full bg-gradient-to-b from-gold to-gold/40" />
        <p className="text-xs text-muted uppercase tracking-widest font-semibold">Spending by Category</p>
      </div>

      {hasData ? (
        <div className="md:flex md:gap-6">
          <div className="flex-shrink-0 mb-5 md:mb-0">
            <CategoryDonut data={data} totalExpenses={totalExpenses} />
          </div>
          <div className="flex-1 min-w-0">
            <CategoryRankedList data={data} month={month} />
          </div>
        </div>
      ) : (
        <CategoryEmptyState />
      )}
    </div>
  );
}
