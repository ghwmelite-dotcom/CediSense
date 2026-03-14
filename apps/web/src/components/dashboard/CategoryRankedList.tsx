import { useNavigate } from 'react-router-dom';
import { formatPesewas } from '@cedisense/shared';
import type { CategoryBreakdownItem } from '@cedisense/shared';

interface CategoryRankedListProps {
  data: CategoryBreakdownItem[];
  month: string;
}

export function CategoryRankedList({ data, month }: CategoryRankedListProps) {
  const navigate = useNavigate();
  const maxPercentage = data.length > 0 ? data[0].percentage : 100;

  function lastDayOfMonth(m: string): string {
    const [year, mon] = m.split('-').map(Number);
    const d = new Date(year, mon, 0);
    return `${year}-${String(mon).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function handleCategoryTap(categoryId: string) {
    if (categoryId === 'uncategorized') return;
    const from = `${month}-01`;
    const to = lastDayOfMonth(month);
    navigate(`/transactions?category_id=${categoryId}&from=${from}&to=${to}`);
  }

  return (
    <div className="space-y-2">
      {data.map((cat) => (
        <button
          key={cat.category_id}
          type="button"
          onClick={() => handleCategoryTap(cat.category_id)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left ${
            cat.category_id === 'uncategorized' ? 'cursor-default' : 'cursor-pointer'
          }`}
        >
          <span className="text-lg flex-shrink-0 w-8 text-center">{cat.icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm truncate">{cat.name}</p>
            <div className="h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${maxPercentage > 0 ? (cat.percentage / maxPercentage) * 100 : 0}%`,
                  backgroundColor: cat.color,
                }}
              />
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white text-sm font-medium">{formatPesewas(cat.total_pesewas)}</p>
            <p className="text-muted text-xs">{cat.percentage.toFixed(1)}%</p>
          </div>
        </button>
      ))}
    </div>
  );
}
