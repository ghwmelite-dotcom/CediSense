import type { SusuGroup, SusuFrequency, SusuVariant } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';

interface GroupCardProps {
  group: SusuGroup & { member_count: number; unread_count?: number };
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
    case 'school_fees':
      return { label: 'School Fees', className: 'bg-blue-600/15 text-blue-200 border-blue-600/30' };
    case 'diaspora':
      return { label: 'Diaspora', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
    case 'event_fund':
      return { label: 'Event Fund', className: 'bg-pink-500/15 text-pink-300 border-pink-500/30' };
    case 'funeral_fund':
      return { label: 'Funeral Fund', className: 'bg-neutral-700/30 text-amber-300 border-amber-700/40' };
    case 'bulk_purchase':
      return { label: 'Bulk Purchase', className: 'bg-orange-500/15 text-orange-300 border-orange-500/30' };
    case 'agricultural':
      return { label: 'Agricultural', className: 'bg-green-600/15 text-green-300 border-green-600/30' };
    case 'welfare':
      return { label: 'Welfare', className: 'bg-violet-500/15 text-violet-300 border-violet-500/30' };
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
      {/* Row 1: group name + role badge + unread badge */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-white font-semibold text-base truncate flex-1">{group.name}</p>
        <div className="flex items-center gap-2 shrink-0">
          {(group.unread_count ?? 0) > 0 && (
            <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-expense text-white text-[10px] font-bold px-1.5">
              {(group.unread_count ?? 0) > 99 ? '99+' : group.unread_count}
            </span>
          )}
          {isCreator ? (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gold/20 text-gold">
              Creator
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-white/10 text-muted">
              Member
            </span>
          )}
        </div>
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
        {/* Extra info badges for new variants */}
        {group.variant === 'school_fees' && group.school_name && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-200 border border-blue-600/20 truncate max-w-[140px]">
            {group.school_name}
          </span>
        )}
        {group.variant === 'school_fees' && group.target_term && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-600/10 text-blue-200 border border-blue-600/20">
            {group.target_term}
          </span>
        )}
        {group.variant === 'diaspora' && group.base_currency && group.base_currency !== 'GHS' && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            {group.base_currency}
          </span>
        )}
        {group.variant === 'event_fund' && group.event_name && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 truncate max-w-[140px]">
            {group.event_name}
          </span>
        )}
        {group.variant === 'event_fund' && group.event_date && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20">
            {new Date(group.event_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
        {group.variant === 'bulk_purchase' && group.item_description && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20 truncate max-w-[140px]">
            {group.item_description}
          </span>
        )}
        {group.variant === 'bulk_purchase' && group.estimated_savings_percent != null && group.estimated_savings_percent > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-income/10 text-income border border-income/20">
            Save {group.estimated_savings_percent}%
          </span>
        )}
        {group.variant === 'agricultural' && group.crop_type && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-600/10 text-green-300 border border-green-600/20 truncate max-w-[140px]">
            {group.crop_type}
          </span>
        )}
        {group.variant === 'welfare' && group.organization_type && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20">
            {group.organization_type === 'church' ? '\u26EA Church' : group.organization_type === 'mosque' ? '\uD83D\uDD4C Mosque' : group.organization_type === 'community' ? '\uD83C\uDFD8\uFE0F Community' : 'Other'}
          </span>
        )}
        {group.guarantee_percent > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
            {group.guarantee_percent}% Guarantee
          </span>
        )}
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
