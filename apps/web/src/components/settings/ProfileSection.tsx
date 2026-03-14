import { useState } from 'react';
import type { User } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { api } from '@/lib/api';
import { AmountInput } from '@/components/transactions/AmountInput';

interface ProfileSectionProps {
  user: User;
  onUpdate: () => void;
}

export function ProfileSection({ user, onUpdate }: ProfileSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [incomePesewas, setIncomePesewas] = useState<number>(
    user.monthly_income_ghs != null ? Math.round(user.monthly_income_ghs * 100) : 0
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await api.put('/users/me', {
        name,
        monthly_income_ghs: incomePesewas / 100,
      });
      setEditing(false);
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(user.name);
    setIncomePesewas(
      user.monthly_income_ghs != null ? Math.round(user.monthly_income_ghs * 100) : 0
    );
    setEditing(false);
    setError(null);
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
        <span className="text-white font-semibold text-base">Profile</span>
        <svg
          className={`w-5 h-5 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Display view */}
          {!editing ? (
            <>
              <div className="space-y-3">
                {/* Name */}
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm">Name</span>
                  <span className="text-white font-medium">{user.name}</span>
                </div>

                {/* Phone – read-only */}
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm flex items-center gap-1.5">
                    Phone
                    <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round"
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <span className="text-muted font-medium">{user.phone}</span>
                </div>

                {/* Monthly income */}
                <div className="flex justify-between items-center">
                  <span className="text-muted text-sm">Monthly Income</span>
                  <span className="text-white font-medium">
                    {user.monthly_income_ghs != null
                      ? formatPesewas(Math.round(user.monthly_income_ghs * 100))
                      : <span className="text-muted italic">Not set</span>}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="w-full border border-gold/40 text-gold rounded-xl py-2.5 text-sm
                  font-medium hover:bg-gold/10 transition-colors focus:outline-none
                  focus-visible:ring-2 focus-visible:ring-gold/50"
              >
                Edit Profile
              </button>
            </>
          ) : (
            /* Edit view */
            <div className="space-y-4">
              {error && (
                <p className="text-expense text-sm bg-expense/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="space-y-1.5">
                <label className="text-muted text-xs uppercase tracking-wide">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                    text-white placeholder-muted focus:outline-none focus:ring-2
                    focus:ring-gold/50 focus:border-gold"
                  placeholder="Your name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-muted text-xs uppercase tracking-wide">Monthly Income</label>
                <AmountInput
                  valuePesewas={incomePesewas}
                  onChange={setIncomePesewas}
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="flex-1 border border-white/10 text-muted rounded-xl py-2.5 text-sm
                    font-medium hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="flex-1 bg-gold text-ghana-black rounded-xl py-2.5 text-sm
                    font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50
                    disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
