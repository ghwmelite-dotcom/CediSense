import type { Notification, NotificationType } from '@cedisense/shared';

interface NotificationItemProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

// SVG icon paths (inline Lucide-style icons — no emoji in production UI)
const TYPE_CONFIG: Record<NotificationType, { iconPath: string; color: string }> = {
  susu_contribution: { iconPath: 'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6', color: 'text-income' },
  susu_payout: { iconPath: 'M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0-6C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z', color: 'text-ghana-gold' },
  susu_vote_opened: { iconPath: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11', color: 'text-info' },
  susu_vote_resolved: { iconPath: 'M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3', color: 'text-income' },
  susu_member_joined: { iconPath: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM20 8v6M23 11h-6', color: 'text-white/70' },
  susu_chat_message: { iconPath: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', color: 'text-white/70' },
  susu_claim_filed: { iconPath: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8', color: 'text-warning' },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type] ?? { iconPath: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0', color: 'text-white/50' };
  const isUnread = notification.is_read === 0;

  return (
    <button
      type="button"
      onClick={() => onPress(notification)}
      className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors duration-150
        ${isUnread ? 'bg-elevated/50' : 'bg-transparent'} hover:bg-elevated/80`}
    >
      {/* SVG Icon */}
      <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={config.iconPath} />
      </svg>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-tight ${isUnread ? 'text-white font-semibold' : 'text-white/80'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-white/50 mt-0.5 line-clamp-2 leading-relaxed">
          {notification.body}
        </p>
        <p className="text-[10px] text-white/30 mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>

      {/* Unread dot */}
      {isUnread && (
        <span className="w-2 h-2 rounded-full bg-info flex-shrink-0 mt-2" aria-label="Unread" />
      )}
    </button>
  );
}
