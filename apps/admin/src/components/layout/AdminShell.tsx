import { Outlet, useLocation, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// --- SVG Icons (Lucide-style, 24x24 viewBox) ---

function HomeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" />
      <polyline points="9 21 9 12 15 12 15 21" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
      <circle cx="19" cy="7" r="2.5" />
      <path d="M23 21v-1.5a3 3 0 0 0-2-2.83" />
    </svg>
  );
}

function GroupsIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// --- Nav links config ---

const NAV_LINKS = [
  { label: 'Dashboard', to: '/', icon: HomeIcon, exact: true },
  { label: 'Users', to: '/users', icon: UsersIcon, exact: false },
  { label: 'Susu Groups', to: '/groups', icon: GroupsIcon, exact: false },
  { label: 'Audit Log', to: '/audit-log', icon: ClipboardIcon, exact: false },
];

// --- Role badge colours ---

const ROLE_BADGE: Record<string, string> = {
  superadmin: 'bg-gold/20 text-gold border border-gold/30',
  admin: 'bg-flame/15 text-flame border border-flame/25',
  user: 'bg-white/8 text-white/50 border border-white/10',
};

function roleBadgeClass(role?: string): string {
  return ROLE_BADGE[role ?? ''] ?? ROLE_BADGE['user'];
}

// --- Component ---

export function AdminShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-ghana-dark overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col h-screen bg-ghana-surface border-r border-white/5 overflow-y-auto"
        aria-label="Admin navigation"
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            {/* ₵ icon mark */}
            <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0 border border-gold/25">
              <span className="text-gold text-lg font-bold font-display leading-none">₵</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-display font-semibold text-sm leading-tight tracking-wide">
                CediSense
              </span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-label bg-flame/15 text-flame border border-flame/25 mt-0.5 w-fit">
                Admin
              </span>
            </div>
          </div>

          {/* Kente stripe */}
          <div className="mt-4 h-[2px] w-full rounded-full bg-gradient-to-r from-flame via-gold to-income opacity-60" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Main navigation">
          <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-label text-white/25">
            Navigation
          </p>
          {NAV_LINKS.map(({ label, to, icon: Icon, exact }) => {
            const isActive = exact
              ? location.pathname === to
              : location.pathname.startsWith(to) && (to !== '/' || location.pathname === '/');

            return (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={[
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-white/[0.06] text-gold'
                    : 'text-white/60 hover:text-white/90 hover:bg-white/[0.04]',
                ].join(' ')}
                aria-current={isActive ? 'page' : undefined}
              >
                <span
                  className={[
                    'flex-shrink-0 transition-colors',
                    isActive ? 'text-gold' : 'text-white/40',
                  ].join(' ')}
                >
                  <Icon />
                </span>
                {label}
                {isActive && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-gold flex-shrink-0"
                    aria-hidden="true"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/5" />

        {/* User info + logout */}
        <div className="px-4 py-4 flex flex-col gap-3">
          {/* User card */}
          <div className="flex items-center gap-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-gold/20 border border-gold/30 flex items-center justify-center flex-shrink-0">
              <span className="text-gold text-xs font-bold font-display leading-none">
                {user?.name?.charAt(0).toUpperCase() ?? '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-tight">
                {user?.name ?? 'Admin'}
              </p>
              {user?.role && (
                <span
                  className={[
                    'inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-label mt-0.5',
                    roleBadgeClass(user.role),
                  ].join(' ')}
                >
                  {user.role}
                </span>
              )}
            </div>
          </div>

          {/* Logout button */}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-white/50 text-xs font-medium
              hover:text-expense hover:bg-expense/10 transition-all duration-150 group"
            aria-label="Log out"
          >
            <span className="group-hover:text-expense transition-colors">
              <LogOutIcon />
            </span>
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 bg-ghana-dark overflow-y-auto" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
