import { useNavigate } from 'react-router-dom';
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
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: 'rgba(30, 30, 56, 0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      <p className="text-muted text-xs mb-1">{formatTooltipDate(label)}</p>
      <p className="text-text-primary text-sm font-extrabold tracking-tight tabular-nums">{formatPesewas(payload[0].value)}</p>
    </div>
  );
}

/** Empty state -- warm, illustration-style, encouraging */
function ChartEmptyState() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4">
      {/* Faded chart illustration with gentle float */}
      <div className="relative w-56 h-24 mb-8 motion-safe:animate-float">
        <svg viewBox="0 0 224 96" fill="none" className="w-full h-full">
          {/* Grid lines */}
          <line x1="20" y1="16" x2="204" y2="16" stroke="#8888A8" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
          <line x1="20" y1="36" x2="204" y2="36" stroke="#8888A8" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
          <line x1="20" y1="56" x2="204" y2="56" stroke="#8888A8" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.3" />
          <line x1="20" y1="76" x2="204" y2="76" stroke="#8888A8" strokeWidth="0.5" opacity="0.2" />
          {/* Trend line */}
          <path
            d="M 20 60 Q 50 55, 70 42 T 120 30 T 180 18 L 204 14"
            stroke="#FF6B35"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.5"
          />
          {/* Gradient fill */}
          <path
            d="M 20 60 Q 50 55, 70 42 T 120 30 T 180 18 L 204 14 L 204 76 L 20 76 Z"
            fill="url(#emptyGradient)"
            opacity="0.25"
          />
          {/* Dot at end */}
          <circle cx="204" cy="14" r="4" fill="#FF6B35" opacity="0.4" />
          <circle cx="204" cy="14" r="2" fill="#FF6B35" opacity="0.7" />
          <defs>
            <linearGradient id="emptyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FF6B35" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#FF6B35" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h3 className="text-text-primary font-semibold text-sm mb-1.5">Your spending story starts here</h3>
      <p className="text-muted text-xs text-center max-w-[260px] leading-relaxed mb-5">
        Add some transactions and watch your daily spending trends come to life.
      </p>
      <button
        type="button"
        onClick={() => navigate('/transactions/add')}
        className="text-xs font-medium px-5 py-2 rounded-xl bg-flame/[0.08] text-flame hover:bg-flame/[0.14] transition-colors duration-200"
      >
        Add your first transaction
      </button>
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-flame/[0.02] to-transparent rounded-b-2xl" />
      )}

      {/* Top highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-flame/[0.08] to-transparent" />

      <p className="section-label mb-5">Daily Spending</p>

      {hasData ? (
        <div className="h-[200px] md:h-[260px] relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="flameGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FF6B35" stopOpacity={0.3} />
                  <stop offset="80%" stopColor="#FF6B35" stopOpacity={0.03} />
                  <stop offset="100%" stopColor="#FF6B35" stopOpacity={0} />
                </linearGradient>
                <filter id="flameLineShadow" x="-10%" y="-50%" width="120%" height="200%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#FF6B35" floodOpacity="0.3" />
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
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,107,53,0.12)', strokeWidth: 1, strokeDasharray: '4 4' }} />
              <Area
                type="monotone"
                dataKey="total_pesewas"
                stroke="#FF6B35"
                strokeWidth={2.5}
                fill="url(#flameGradient)"
                isAnimationActive={!prefersReducedMotion}
                animationDuration={1200}
                animationEasing="ease-out"
                filter="url(#flameLineShadow)"
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
