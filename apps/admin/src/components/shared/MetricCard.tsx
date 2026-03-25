import type { ReactNode } from 'react';

export interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
}

export function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <div className="relative bg-ghana-elevated rounded-xl p-5">
      {/* Optional icon — top-right */}
      {icon && (
        <div className="absolute top-4 right-4 text-white/20" aria-hidden="true">
          {icon}
        </div>
      )}

      {/* Value */}
      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>

      {/* Label */}
      <p className="text-sm text-white/50 mt-1">{label}</p>
    </div>
  );
}
