import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="p-4 md:p-6">
      <h1 className="text-white text-xl font-bold mb-6">Settings</h1>

      <div className="bg-ghana-surface rounded-xl p-4 mb-4">
        <div className="text-muted text-xs uppercase mb-2">Account</div>
        <div className="text-white font-medium">{user?.name}</div>
        <div className="text-muted text-sm">{user?.phone}</div>
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-expense/10 text-expense font-medium py-3 rounded-xl hover:bg-expense/20 transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
