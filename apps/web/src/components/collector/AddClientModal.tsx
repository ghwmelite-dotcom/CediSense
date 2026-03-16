import { useState } from 'react';

interface AddClientModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: {
    client_name: string;
    client_phone?: string;
    daily_amount_pesewas: number;
    cycle_days: number;
  }) => Promise<void>;
}

export function AddClientModal({ open, onClose, onSave }: AddClientModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dailyAmountGHS, setDailyAmountGHS] = useState('');
  const [cycleDays, setCycleDays] = useState('30');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amount = parseFloat(dailyAmountGHS);
    if (!name.trim()) { setError('Client name is required'); return; }
    if (isNaN(amount) || amount <= 0) { setError('Enter a valid daily amount'); return; }
    const days = parseInt(cycleDays, 10);
    if (isNaN(days) || days < 7 || days > 60) { setError('Cycle must be 7-60 days'); return; }

    setSaving(true);
    try {
      await onSave({
        client_name: name.trim(),
        client_phone: phone.trim() || undefined,
        daily_amount_pesewas: Math.round(amount * 100),
        cycle_days: days,
      });
      // Reset form
      setName('');
      setPhone('');
      setDailyAmountGHS('');
      setCycleDays('30');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add client';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-[#161625] rounded-2xl border border-white/[0.08] shadow-2xl
                      animate-in slide-in-from-bottom-4 duration-200 mb-4 sm:mb-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-text-primary font-semibold text-lg">Add New Client</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-white/[0.06] flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Client Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Ama Serwaa"
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         placeholder:text-muted-dim focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20
                         transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Phone (optional)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g., 0241234567"
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         placeholder:text-muted-dim focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20
                         transition-all"
            />
          </div>

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Daily Amount ({'\u20B5'})</label>
            <input
              type="number"
              value={dailyAmountGHS}
              onChange={(e) => setDailyAmountGHS(e.target.value)}
              placeholder="e.g., 5.00"
              step="0.01"
              min="0.01"
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         placeholder:text-muted-dim focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20
                         transition-all"
            />
          </div>

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Cycle Length (days)</label>
            <select
              value={cycleDays}
              onChange={(e) => setCycleDays(e.target.value)}
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
            >
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="21">21 days</option>
              <option value="30">30 days (standard)</option>
              <option value="45">45 days</option>
              <option value="60">60 days</option>
            </select>
          </div>

          {/* Action buttons - large touch targets */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 rounded-xl border border-white/[0.1] text-muted font-medium text-sm
                         hover:bg-white/[0.04] active:scale-[0.97] transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-gold text-[#0E0E1A] font-semibold text-sm
                         hover:bg-gold/90 active:scale-[0.97] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-[#0E0E1A]/30 border-t-[#0E0E1A] rounded-full animate-spin" />
              ) : (
                'Add Client'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
