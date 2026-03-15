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
    <div className="bg-ghana-elevated rounded-xl px-4 py-3 shadow-card-hover">
      <p className="text-muted text-xs mb-1">{formatTooltipDate(label)}</p>
      <p className="text-text-primary text-sm font-extrabold tracking-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPesewas(payload[0].value)}</p>
    </div>
  );
}

/** Empty state — warm and encouraging like YNAB */
function ChartEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {/* Faded chart illustration */}
      <div className="relative w-48 h-20 mb-6 opacity-25">
        <svg viewBox="0 0 200 80" fill="none" className="w-full h-full">
          <line x1="20" y1="15" x2="180" y2="15" stroke="#8888A8" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="20" y1="35" x2="180" y2="35" stroke="#8888A8" strokeWidth="0.5" strokeDasharray="4 4" />
          <line x1="20" y1="55" x2="180" y2="55" stroke="#8888A8" strokeWidth="0.5" strokeDasharray="4 4" />
          <path
            d="M 20 50 Q 50 45, 70 35 T 120 25 T 180 15"
            stroke="#D4A843"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M 20 50 Q 50 45, 70 35 T 120 25 T 180 15 L 180 65 L 20 65 Z"
            fill="url(#emptyGradient)"
            opacity="0.3"
          />
          <defs>
            <linearGradient id="emptyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D4A843" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h3 className="text-text-primary font-semibold text-sm mb-1.5">Your spending story starts here</h3>
      <p className="text-muted text-xs text-center max-w-[240px] leading-relaxed">
        Add some transactions and watch your daily spending trends come to life.
      </p>
    </div>
  );
}

export function SpendingTrendChart({ data }: SpendingTrendChartProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const hasData = data.length > 0 && data.some((d) => d.total_pesewas > 0);

  return (
    <div className="relative premium-card rounded-2xl p-6 overflow-hidden motion-safe:animate-fade-in">
      {/* Subtle glow behind chart area */}
      {hasData && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-gold/[0.02] to-transparent rounded-b-2xl" />
      )}

      <p className="section-label mb-5">Daily Spending</p>

      {hasData ? (
        <div className="h-[200px] md:h-[260px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D4A843" stopOpacity={0.3} />
                  <stop offset="80%" stopColor="#D4A843" stopOpacity={0.03} />
                  <stop offset="100%" stopColor="#D4A843" stopOpacity={0} />
                </linearGradient>
                <filter id="goldLineShadow" x="-10%" y="-50%" width="120%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#D4A843" floodOpacity="0.35" />
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(136,136,168,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDay}
                tick={{ fill: '#5A5A72', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => formatPesewas(v)}
                tick={{ fill: '#5A5A72', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(212,168,67,0.12)', strokeWidth: 1, strokeDasharray: '4 4' }} />
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
      ) : (
        <ChartEmptyState />
      )}
    </div>
  );
}
