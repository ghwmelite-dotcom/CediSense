import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { formatPesewas } from '@cedisense/shared';
import type { SusuGroup } from '@cedisense/shared';

type SusuGroupWithCount = SusuGroup & { member_count: number; unread_count?: number };

const FREQ_LABEL: Record<string, string> = {
  daily: 'day',
  weekly: 'week',
  biweekly: '2 weeks',
  monthly: 'month',
};

/**
 * One-tap access to the user's existing Susu groups, surfaced on the dashboard.
 * Renders nothing until loaded, and stays hidden for users with no groups.
 */
export function SusuQuickAccess() {
  const [groups, setGroups] = useState<SusuGroupWithCount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<SusuGroupWithCount[]>('/susu/groups')
      .then((data) => { if (!cancelled) setGroups(data); })
      .catch(() => { if (!cancelled) setGroups([]); });
    return () => { cancelled = true; };
  }, []);

  if (!groups || groups.length === 0) return null;

  const shown = groups.slice(0, 4);

  return (
    <div className="premium-card rounded-2xl p-5 my-6 motion-safe:animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center bg-gold/10 text-gold">
            <Users className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-text-primary tracking-[-0.01em]">Your Susu Groups</h2>
            <p className="text-muted text-xs">Jump straight back in</p>
          </div>
        </div>
        <Link
          to="/susu"
          className="text-gold text-xs font-semibold hover:text-gold/80 transition-colors inline-flex items-center gap-1 shrink-0"
        >
          View all
          <ArrowRight className="w-3.5 h-3.5" strokeWidth={2.5} aria-hidden="true" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {shown.map((g) => (
          <Link
            key={g.id}
            to={`/susu?group=${g.id}`}
            className="relative block rounded-xl p-4 border border-theme-border bg-theme-elevated hover:border-gold/30 hover:shadow-card-hover transition-all duration-200 active:scale-[0.99]"
          >
            {g.unread_count ? (
              <span className="absolute top-3 right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-flame text-white text-[10px] font-bold flex items-center justify-center">
                {g.unread_count > 99 ? '99+' : g.unread_count}
              </span>
            ) : null}
            <p className="font-semibold text-sm text-text-primary truncate pr-6">{g.name}</p>
            <p className="text-gold text-sm font-bold tabular-nums mt-1">
              {formatPesewas(g.contribution_pesewas)}
              <span className="text-muted font-normal text-xs"> / {FREQ_LABEL[g.frequency] ?? g.frequency}</span>
            </p>
            <p className="text-muted text-xs mt-1">
              {g.member_count} {g.member_count === 1 ? 'member' : 'members'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
