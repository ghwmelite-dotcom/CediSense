import { useState, useEffect } from 'react';
import type { NotificationPreferences, SusuGroup } from '@cedisense/shared';
import { api } from '@/lib/api';

export function NotificationsSection() {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ push_enabled: false, muted_groups: [] });
  const [groups, setGroups] = useState<SusuGroup[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [fetchedPrefs, fetchedGroups] = await Promise.all([
          api.get<NotificationPreferences>('/notifications/preferences'),
          api.get<SusuGroup[]>('/susu/groups'),
        ]);
        setPrefs(fetchedPrefs);
        setGroups(fetchedGroups);
      } catch {
        // Defaults are fine — push off, no muted groups
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function togglePush() {
    const next = !prefs.push_enabled;
    setPrefs((p) => ({ ...p, push_enabled: next }));
    try {
      await api.put('/notifications/preferences', { push_enabled: next });
    } catch {
      // Revert on failure
      setPrefs((p) => ({ ...p, push_enabled: !next }));
    }
  }

  async function toggleGroupMute(groupId: string) {
    const isMuted = prefs.muted_groups.includes(groupId);
    const newMuted = isMuted
      ? prefs.muted_groups.filter((id) => id !== groupId)
      : [...prefs.muted_groups, groupId];

    setPrefs((p) => ({ ...p, muted_groups: newMuted }));
    try {
      await api.put('/notifications/preferences', { muted_groups: newMuted });
    } catch {
      // Revert on failure
      setPrefs((p) => ({
        ...p,
        muted_groups: isMuted
          ? [...p.muted_groups, groupId]
          : p.muted_groups.filter((id) => id !== groupId),
      }));
    }
  }

  return (
    <div className="bg-ghana-surface rounded-2xl overflow-hidden border border-white/5">
      {/* Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 text-left
          hover:bg-white/5 transition-colors focus:outline-none focus-visible:ring-2
          focus-visible:ring-gold/50"
        aria-expanded={expanded}
      >
        <span className="text-white font-semibold text-base">Notifications</span>
        <svg
          className={`w-5 h-5 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
              <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
              <div className="h-10 bg-white/[0.04] rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {/* Push notification master toggle */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-white text-sm font-medium">Push Notifications</p>
                  <p className="text-muted text-xs mt-0.5">Get alerts on your device</p>
                </div>
                <ToggleSwitch value={prefs.push_enabled} onToggle={togglePush} />
              </div>

              {/* Group notifications */}
              {groups.length > 0 && (
                <>
                  <div className="h-px bg-white/[0.06]" />
                  <p className="text-muted text-xs font-semibold uppercase tracking-wider">
                    Group Notifications
                  </p>
                  <div className="space-y-3">
                    {groups.map((group) => {
                      const isMuted = prefs.muted_groups.includes(group.id);
                      return (
                        <div key={group.id} className="flex items-center justify-between gap-3">
                          <span className="text-white text-sm truncate">{group.name}</span>
                          <ToggleSwitch
                            value={!isMuted}
                            onToggle={() => toggleGroupMute(group.id)}
                          />
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {groups.length === 0 && (
                <>
                  <div className="h-px bg-white/[0.06]" />
                  <p className="text-muted text-xs font-semibold uppercase tracking-wider">
                    Group Notifications
                  </p>
                  <p className="text-muted text-sm">No groups yet</p>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleSwitch({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={onToggle}
      className={`relative w-10 h-6 rounded-full transition-colors min-w-[40px] ${
        value ? 'bg-income' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
          value ? 'left-5' : 'left-1'
        }`}
      />
    </button>
  );
}
