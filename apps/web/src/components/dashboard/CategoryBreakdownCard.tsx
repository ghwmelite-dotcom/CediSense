import type { CategoryBreakdownItem } from '@cedisense/shared';
import { CategoryDonut } from './CategoryDonut';
import { CategoryRankedList } from './CategoryRankedList';

interface CategoryBreakdownCardProps {
  data: CategoryBreakdownItem[];
  totalExpenses: number;
  month: string;
}

export function CategoryBreakdownCard({ data, totalExpenses, month }: CategoryBreakdownCardProps) {
  const hasData = data.length > 0 && totalExpenses > 0;

  return (
    <div className="relative bg-ghana-surface rounded-xl p-5 border border-white/10 shadow-card overflow-hidden motion-safe:animate-fade-in">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

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
        <div className="text-center py-10">
          <p className="text-muted text-sm">No spending data for this period</p>
        </div>
      )}
    </div>
  );
}
