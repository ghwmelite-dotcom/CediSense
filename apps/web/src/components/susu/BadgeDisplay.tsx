import type { SusuBadge, BadgeType } from '@cedisense/shared';

interface BadgeMeta {
  emoji: string;
  label: string;
}

const BADGE_META: Record<BadgeType, BadgeMeta> = {
  first_contribution: { emoji: '🎉', label: 'First Step' },
  first_payout:       { emoji: '💰', label: 'First Payout' },
  perfect_round:      { emoji: '⭐', label: 'Perfect Round' },
  streak_5:           { emoji: '🔥', label: '5 Streak' },
  streak_10:          { emoji: '🔥🔥', label: '10 Streak' },
  streak_20:          { emoji: '🏆', label: '20 Streak' },
  group_founder:      { emoji: '👑', label: 'Founder' },
  group_completed:    { emoji: '🎓', label: 'Completer' },
};

interface BadgeDisplayProps {
  badges: SusuBadge[];
  /** If true, shows a compact single-line version */
  compact?: boolean;
}

export function BadgeDisplay({ badges, compact = false }: BadgeDisplayProps) {
  if (badges.length === 0) {
    return (
      <p className="text-muted text-xs italic px-1">No badges earned yet</p>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {badges.map((badge) => {
          const meta = BADGE_META[badge.badge_type as BadgeType];
          return (
            <span
              key={badge.id}
              title={meta?.label ?? badge.badge_name}
              className="text-base leading-none"
              aria-label={meta?.label ?? badge.badge_name}
            >
              {meta?.emoji ?? '🏅'}
            </span>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
      role="list"
      aria-label="Earned badges"
    >
      {badges.map((badge) => {
        const meta = BADGE_META[badge.badge_type as BadgeType];
        return (
          <div
            key={badge.id}
            role="listitem"
            className="flex-shrink-0 flex flex-col items-center gap-1
              bg-white/5 border border-white/10 rounded-xl px-3 py-2
              min-w-[72px] hover:bg-white/10 transition-colors"
            title={new Date(badge.earned_at).toLocaleDateString()}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {meta?.emoji ?? '🏅'}
            </span>
            <span className="text-[10px] text-muted font-medium text-center leading-tight">
              {meta?.label ?? badge.badge_name}
            </span>
          </div>
        );
      })}
    </div>
  );
}
