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
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

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
    <div className="bg-ghana-surface border border-gold/25 rounded-xl px-4 py-2.5 shadow-gold-glow backdrop-blur-sm">
      <p className="text-muted text-xs mb-0.5">{formatTooltipDate(label)}</p>
      <p className="text-white text-sm font-bold tabular-nums">{formatPesewas(payload[0].value)}</p>
    </div>
  );
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative bg-ghana-surface rounded-xl p-5 border border-white/10 shadow-card overflow-hidden motion-safe:animate-fade-in">
      {/* Subtle glow behind chart area */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-gold/5 to-transparent rounded-b-xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/20 to-transparent" />

      <p className="text-xs text-muted uppercase tracking-widest font-medium mb-4">Daily Spending</p>

      <div className="h-[200px] md:h-[250px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A843" stopOpacity={0.35} />
                <stop offset="80%" stopColor="#D4A843" stopOpacity={0.04} />
                <stop offset="100%" stopColor="#D4A843" stopOpacity={0} />
              </linearGradient>
              <filter id="goldLineShadow" x="-10%" y="-50%" width="120%" height="200%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#D4A843" floodOpacity="0.4" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={{ fill: '#666666', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v: number) => formatPesewas(v)}
              tick={{ fill: '#666666', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={70}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(212,168,67,0.2)', strokeWidth: 1, strokeDasharray: '4 4' }} />
            <Area
              type="monotone"
              dataKey="total_pesewas"
              stroke="#D4A843"
              strokeWidth={2.5}
              fill="url(#goldGradient)"
              isAnimationActive={!prefersReducedMotion}
              animationDuration={800}
              filter="url(#goldLineShadow)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
