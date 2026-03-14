import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatPesewas } from '@cedisense/shared';
import type { CategoryBreakdownItem } from '@cedisense/shared';

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return reduced;
}

interface CategoryDonutProps {
  data: CategoryBreakdownItem[];
  totalExpenses: number;
}

export function CategoryDonut({ data, totalExpenses }: CategoryDonutProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative w-[180px] h-[180px] md:w-[220px] md:h-[220px] mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total_pesewas"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="50%"
            outerRadius="80%"
            paddingAngle={1}
            isAnimationActive={!prefersReducedMotion}
            animationDuration={600}
          >
            {data.map((entry) => (
              <Cell key={entry.category_id} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-muted text-xs">Total</span>
        <span className="text-white text-sm font-bold">{formatPesewas(totalExpenses)}</span>
      </div>
    </div>
  );
}
