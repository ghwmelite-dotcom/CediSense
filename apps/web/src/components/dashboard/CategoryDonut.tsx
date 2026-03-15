import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { formatPesewas } from '@cedisense/shared';
import type { CategoryBreakdownItem } from '@cedisense/shared';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface CategoryDonutProps {
  data: CategoryBreakdownItem[];
  totalExpenses: number;
  highlightIndex?: number | null;
}

export function CategoryDonut({ data, totalExpenses, highlightIndex }: CategoryDonutProps) {
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
            paddingAngle={2}
            isAnimationActive={!prefersReducedMotion}
            animationBegin={100}
            animationDuration={800}
            animationEasing="ease-out"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((entry, i) => (
              <Cell
                key={entry.category_id}
                fill={entry.color}
                opacity={highlightIndex != null && highlightIndex !== i ? 0.35 : 1}
                stroke={highlightIndex === i ? entry.color : 'transparent'}
                strokeWidth={highlightIndex === i ? 3 : 0}
                style={{ transition: 'opacity 0.2s ease, stroke-width 0.2s ease' }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-muted text-xs">Total</span>
        <span className="text-white text-sm font-bold tabular-nums">{formatPesewas(totalExpenses)}</span>
      </div>
    </div>
  );
}
