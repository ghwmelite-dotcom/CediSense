import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { CategoryTrend } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

interface CategoryTrendsChartProps {
  trends: CategoryTrend[];
}

interface TooltipPayloadItem {
  name: string;
  value: number;
  payload: ChartDataPoint;
}

interface ChartDataPoint {
  name: string;
  icon: string;
  color: string;
  current: number;
  previous: number;
  changePct: number | null;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;
  const changePct = point.changePct;

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-lg px-3 py-2.5 shadow-lg space-y-1 min-w-[160px]">
      <p className="text-white text-xs font-semibold">
        {point.icon} {point.name}
      </p>
      <div className="text-xs space-y-0.5">
        <p>
          <span className="text-muted">Current: </span>
          <span className="text-white font-medium">{formatPesewas(point.current)}</span>
        </p>
        <p>
          <span className="text-muted">Previous: </span>
          <span className="text-white/70">{formatPesewas(point.previous)}</span>
        </p>
        {changePct !== null && (
          <p>
            <span className="text-muted">Change: </span>
            <span className={changePct >= 0 ? 'text-expense font-medium' : 'text-income font-medium'}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

function computeChangePct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function CategoryTrendsChart({ trends }: CategoryTrendsChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Top 6 by current spend, descending
  const top6: ChartDataPoint[] = [...trends]
    .sort((a, b) => b.current_pesewas - a.current_pesewas)
    .slice(0, 6)
    .map((t) => ({
      name: t.name,
      icon: t.icon,
      color: t.color,
      current: t.current_pesewas,
      previous: t.previous_pesewas,
      changePct: computeChangePct(t.current_pesewas, t.previous_pesewas),
    }));

  if (top6.length === 0) {
    return (
      <div className="bg-ghana-surface border border-white/10 rounded-xl p-4">
        <p className="text-sm text-muted uppercase tracking-wide mb-4">Expense Category Trends</p>
        <p className="text-muted text-sm py-6 text-center">No category data available</p>
      </div>
    );
  }

  return (
    <div className="bg-ghana-surface border border-white/10 rounded-xl p-4">
      <p className="text-sm text-muted uppercase tracking-wide mb-4">Expense Category Trends</p>
      <div style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={top6}
            layout="vertical"
            margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
            barCategoryGap="25%"
            barGap={4}
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => formatPesewas(v)}
              tick={{ fill: '#888888', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#888888', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={80}
              tickFormatter={(name: string, index: number) => {
                const item = top6[index];
                return item ? `${item.icon} ${name}` : name;
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />

            {/* Previous bar — 40% opacity via fillOpacity */}
            <Bar
              dataKey="previous"
              name="Previous"
              radius={[0, 4, 4, 0]}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={600}
            >
              {top6.map((entry, index) => (
                <Cell key={`prev-${index}`} fill={entry.color} fillOpacity={0.4} />
              ))}
            </Bar>

            {/* Current bar — full opacity */}
            <Bar
              dataKey="current"
              name="Current"
              radius={[0, 4, 4, 0]}
              isAnimationActive={!prefersReducedMotion}
              animationDuration={600}
              animationBegin={100}
            >
              {top6.map((entry, index) => (
                <Cell key={`curr-${index}`} fill={entry.color} fillOpacity={1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
