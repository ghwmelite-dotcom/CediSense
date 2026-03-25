import { useState, useEffect } from 'react';
import { MetricCard } from '@/components/shared/MetricCard';
import { api } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  total_users: number;
  total_groups: number;
  active_groups: number;
  total_contribution_volume_pesewas: number;
  new_signups_this_week: number;
}

interface ActivityItem {
  id: string;
  type: string;
  actor_name: string;
  description: string;
  timestamp: string;
}

interface ActivityResponse {
  items: ActivityItem[];
  cursor: string | null;
  has_more: boolean;
}

// ── SVG Icons ──────────────────────────────────────────────────────────────

function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="19" cy="7" r="2.5" />
      <path d="M23 21v-1.5a3 3 0 0 0-2-2.83" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function CediIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9.5a4.5 4.5 0 1 0 0 5" />
      <line x1="9" y1="12" x2="15" y2="12" />
    </svg>
  );
}

function TrendingUpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

// ── Activity badge config ──────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { label: string; className: string }> = {
  signup:        { label: 'Signup',         className: 'bg-income/15 text-income border border-income/25' },
  group_created: { label: 'Group Created',  className: 'bg-sky-400/15 text-sky-300 border border-sky-400/25' },
  contribution:  { label: 'Contribution',   className: 'bg-gold/15 text-gold border border-gold/25' },
  payout:        { label: 'Payout',         className: 'bg-purple-400/15 text-purple-300 border border-purple-400/25' },
  member_joined: { label: 'Member Joined',  className: 'bg-white/10 text-white/50 border border-white/10' },
  claim_filed:   { label: 'Claim Filed',    className: 'bg-flame/15 text-flame border border-flame/25' },
};

function typeBadge(type: string) {
  return TYPE_BADGE[type] ?? { label: type, className: 'bg-white/10 text-white/40 border border-white/10' };
}

// ── Relative time helper ───────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  if (isNaN(then)) return isoString;

  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60)   return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60)   return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24)    return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30)   return `${diffDay}d ago`;
  return new Date(isoString).toLocaleDateString();
}

// ── Skeleton helpers ───────────────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="bg-ghana-elevated rounded-xl p-5 animate-pulse">
      <div className="h-7 w-24 rounded bg-white/10 mb-2" />
      <div className="h-3.5 w-32 rounded bg-white/[0.06]" />
    </div>
  );
}

function ActivityRowSkeleton() {
  return (
    <tr>
      {[40, 28, 36, 80].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className={`h-4 rounded bg-ghana-elevated/70 animate-pulse`} style={{ width: `${w}%` }} />
        </td>
      ))}
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch metrics
  useEffect(() => {
    setMetricsLoading(true);
    api.get<DashboardMetrics>('/admin/dashboard')
      .then((data) => {
        setMetrics(data);
        setMetricsError(null);
      })
      .catch((err: unknown) => {
        setMetricsError(err instanceof Error ? err.message : 'Failed to load metrics');
      })
      .finally(() => setMetricsLoading(false));
  }, []);

  // Fetch initial activity
  useEffect(() => {
    setActivityLoading(true);
    api.get<ActivityResponse>('/admin/activity')
      .then((data) => {
        setActivities(data.items);
        setCursor(data.cursor);
        setHasMore(data.has_more);
        setActivityError(null);
      })
      .catch((err: unknown) => {
        setActivityError(err instanceof Error ? err.message : 'Failed to load activity');
      })
      .finally(() => setActivityLoading(false));
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const data = await api.get<ActivityResponse>(`/admin/activity?cursor=${encodeURIComponent(cursor)}`);
      setActivities((prev) => [...prev, ...data.items]);
      setCursor(data.cursor);
      setHasMore(data.has_more);
    } catch (err: unknown) {
      setActivityError(err instanceof Error ? err.message : 'Failed to load more activity');
    } finally {
      setLoadingMore(false);
    }
  }

  // Format contribution volume from pesewas to GHS
  const volumeDisplay = metrics
    ? `₵${(metrics.total_contribution_volume_pesewas / 100).toLocaleString()}`
    : '—';

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight font-display">Dashboard</h1>
        <p className="text-white/40 text-sm mt-1">Platform overview at a glance</p>
      </div>

      {/* Metrics grid */}
      <section aria-label="Key metrics">
        {metricsError ? (
          <div className="text-expense text-sm bg-expense/[0.08] border border-expense/20 rounded-xl px-4 py-3">
            {metricsError}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {metricsLoading ? (
              Array.from({ length: 5 }).map((_, i) => <MetricSkeleton key={i} />)
            ) : (
              <>
                <MetricCard
                  label="Total Users"
                  value={(metrics?.total_users ?? 0).toLocaleString()}
                  icon={<PeopleIcon />}
                />
                <MetricCard
                  label="Total Groups"
                  value={(metrics?.total_groups ?? 0).toLocaleString()}
                  icon={<GroupsIcon />}
                />
                <MetricCard
                  label="Active Groups"
                  value={(metrics?.active_groups ?? 0).toLocaleString()}
                  icon={<CheckCircleIcon />}
                />
                <MetricCard
                  label="Contribution Volume"
                  value={volumeDisplay}
                  icon={<CediIcon />}
                />
                <MetricCard
                  label="New Signups This Week"
                  value={(metrics?.new_signups_this_week ?? 0).toLocaleString()}
                  icon={<TrendingUpIcon />}
                />
              </>
            )}
          </div>
        )}
      </section>

      {/* Activity feed */}
      <section aria-label="Recent activity">
        <h2 className="text-base font-semibold text-white mb-4 tracking-tight">Recent Activity</h2>

        {activityError ? (
          <div className="text-expense text-sm bg-expense/[0.08] border border-expense/20 rounded-xl px-4 py-3">
            {activityError}
          </div>
        ) : (
          <div className="bg-ghana-surface rounded-xl border border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="bg-ghana-elevated/50">
                    {['Timestamp', 'Type', 'Actor', 'Description'].map((h) => (
                      <th key={h}
                        className="px-4 py-3 text-xs text-white/50 uppercase tracking-wider font-medium whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activityLoading && activities.length === 0
                    ? Array.from({ length: 6 }).map((_, i) => <ActivityRowSkeleton key={i} />)
                    : activities.map((item) => {
                        const badge = typeBadge(item.type);
                        return (
                          <tr key={item.id}
                            className="border-b border-white/5 last:border-b-0 hover:bg-ghana-elevated/10 transition-colors">
                            <td className="px-4 py-3 text-white/40 whitespace-nowrap tabular-nums text-xs">
                              {relativeTime(item.timestamp)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={[
                                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide',
                                badge.className,
                              ].join(' ')}>
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-white/80 whitespace-nowrap max-w-[160px] truncate">
                              {item.actor_name}
                            </td>
                            <td className="px-4 py-3 text-white/60 max-w-xs truncate">
                              {item.description}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {!activityLoading && activities.length === 0 && (
              <div className="flex items-center justify-center py-12 text-white/30 text-sm">
                No recent activity found.
              </div>
            )}

            {/* Load more */}
            {(hasMore || loadingMore) && (
              <div className="flex justify-center py-4 border-t border-white/5">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-5 py-2 rounded-lg text-sm text-white/60 hover:text-white bg-ghana-elevated/50 hover:bg-ghana-elevated transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                      Loading…
                    </span>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
