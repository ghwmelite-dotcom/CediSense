import type { SusuGroup, SusuFrequency, SusuVariant } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface GroupCardProps {
  group: SusuGroup & { member_count: number };
  isCreator: boolean;
  onClick: () => void;
}

function frequencyLabel(freq: SusuFrequency): string {
  switch (freq) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'monthly': return 'Monthly';
  }
}

interface VariantBadgeConfig {
  label: string;
  className: string;
}

function variantBadge(variant: SusuVariant): VariantBadgeConfig {
  switch (variant) {
    case 'rotating':
      return { label: 'Rotating', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
    case 'accumulating':
      return { label: 'Accumulating', className: 'bg-income/15 text-income border-income/30' };
    case 'goal_based':
      return { label: 'Goal-based', className: 'bg-gold/15 text-gold border-gold/30' };
    case 'bidding':
      return { label: 'Bidding', className: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
    case 'funeral_fund':
      return { label: 'Funeral Fund', className: 'bg-neutral-700/30 text-amber-300 border-amber-700/40' };
  }
}

export function GroupCard({ group, isCreator, onClick }: GroupCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-ghana-surface border border-white/10 rounded-xl p-4 space-y-3
        hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5 active:scale-[0.99]
        transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
    >
      {/* Row 1: group name + role badge */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-white font-semibold text-base truncate flex-1">{group.name}</p>
        {isCreator ? (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/20 text-gold">
            Creator
          </span>
        ) : (
          <span className="shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-muted">
            Member
          </span>
        )}
      </div>

      {/* Row 2: contribution amount + member count + round */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-white font-bold">
          {formatPesewas(group.contribution_pesewas)}/{frequencyLabel(group.frequency).toLowerCase()}
        </span>
        <span className="text-muted">{group.member_count} member{group.member_count !== 1 ? 's' : ''}</span>
        <span className="text-muted">Round {group.current_round}</span>
      </div>

      {/* Row 3: frequency badge + variant badge + active/inactive status */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-muted">
          {frequencyLabel(group.frequency)}
        </span>
        {(() => {
          const badge = variantBadge(group.variant ?? 'rotating');
          return (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${badge.className}`}>
              {badge.label}
            </span>
          );
        })()}
        {group.is_active ? (
          <span className="flex items-center gap-1 text-xs font-medium text-income">
            <span className="w-1.5 h-1.5 rounded-full bg-income inline-block" aria-hidden="true" />
            Active
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs font-medium text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-muted inline-block" aria-hidden="true" />
            Inactive
          </span>
        )}
      </div>
    </button>
  );
}
