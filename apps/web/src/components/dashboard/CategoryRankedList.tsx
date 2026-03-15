import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatPesewas } from '@cedisense/shared';
import type { CategoryBreakdownItem } from '@cedisense/shared';

interface CategoryRankedListProps {
  data: CategoryBreakdownItem[];
  month: string;
  onHoverIndex?: (index: number | null) => void;
}

export function CategoryRankedList({ data, month, onHoverIndex }: CategoryRankedListProps) {
  const navigate = useNavigate();
  const maxPercentage = data.length > 0 ? data[0].percentage : 100;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

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
    <div className="space-y-1">
      {data.map((cat, i) => (
        <button
          key={cat.category_id}
          type="button"
          onClick={() => handleCategoryTap(cat.category_id)}
          onMouseEnter={() => onHoverIndex?.(i)}
          onMouseLeave={() => onHoverIndex?.(null)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-left group motion-safe:animate-stagger-in ${
            cat.category_id === 'uncategorized'
              ? 'cursor-default'
              : 'cursor-pointer hover:bg-white/[0.06] hover:scale-[1.01] active:scale-100'
          }`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          {/* Icon */}
          <span className="text-lg flex-shrink-0 w-8 text-center leading-none">{cat.icon}</span>

          {/* Name + progress bar */}
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate leading-none mb-1.5">{cat.name}</p>
            <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: mounted ? `${maxPercentage > 0 ? (cat.percentage / maxPercentage) * 100 : 0}%` : '0%',
                  backgroundColor: cat.color,
                  boxShadow: `0 0 6px ${cat.color}60`,
                  transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
                  transitionDelay: `${i * 50 + 200}ms`,
                }}
              />
            </div>
          </div>

          {/* Amount + percentage */}
          <div className="text-right shrink-0 min-w-[72px]">
            <p className="text-white text-sm font-semibold tabular-nums leading-none">{formatPesewas(cat.total_pesewas)}</p>
            <p className="text-muted text-xs tabular-nums mt-1">{cat.percentage.toFixed(1)}%</p>
          </div>
        </button>
      ))}
    </div>
  );
}
