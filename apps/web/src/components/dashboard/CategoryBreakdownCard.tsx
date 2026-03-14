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
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <p className="text-sm text-muted uppercase tracking-wide mb-4">Spending by Category</p>
      {hasData ? (
        <div className="md:flex md:gap-6">
          <div className="flex-shrink-0 mb-4 md:mb-0">
            <CategoryDonut data={data} totalExpenses={totalExpenses} />
          </div>
          <div className="flex-1 min-w-0">
            <CategoryRankedList data={data} month={month} />
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-muted text-sm">No spending data</p>
        </div>
      )}
    </div>
  );
}
