import { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatPesewas } from '@cedisense/shared';

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

interface DailyPoint {
  date: string;
  total_pesewas: number;
}

interface SpendingTrendChartProps {
  data: DailyPoint[];
}

function formatDay(date: string): string {
  return String(parseInt(date.split('-')[2], 10));
}

function formatTooltipDate(date: string): string {
  const d = new Date(date + 'T00:00:00');
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="bg-ghana-surface border border-white/10 rounded-lg px-3 py-2 shadow-lg">
      <p className="text-muted text-xs">{formatTooltipDate(label)}</p>
      <p className="text-white text-sm font-semibold">{formatPesewas(payload[0].value)}</p>
    </div>
  );
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <p className="text-sm text-muted uppercase tracking-wide mb-3">Daily Spending</p>
      <div className="h-[200px] md:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A843" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#D4A843" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fill: '#888888', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => formatPesewas(v)}
              tick={{ fill: '#888888', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="total_pesewas"
              stroke="#D4A843"
              strokeWidth={2}
              fill="url(#goldGradient)"
              isAnimationActive={!prefersReducedMotion}
              animationDuration={800}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
