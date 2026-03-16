import { useState, useEffect, useCallback } from 'react';
import type { CollectorDashboard, CollectorClient } from '@cedisense/shared';
import { api } from '@/lib/api';
import { ClientCard } from '@/components/collector/ClientCard';
import { AddClientModal } from '@/components/collector/AddClientModal';

type DashboardClient = CollectorClient & { deposited_today?: boolean };

interface CollectorDashboardData extends Omit<CollectorDashboard, 'clients'> {
  clients: DashboardClient[];
}

export function CollectorPage() {
  const [dashboard, setDashboard] = useState<CollectorDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Setup form state
  const [businessName, setBusinessName] = useState('');
  const [marketArea, setMarketArea] = useState('');
  const [commissionDays, setCommissionDays] = useState('1');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.get<CollectorDashboardData>('/collector/dashboard');
      setDashboard(data);
      setHasProfile(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'NOT_FOUND') {
        setHasProfile(false);
      }
    }
  }, []);

  useEffect(() => {
    async function init() {
      setLoading(true);
      await fetchDashboard();
      setLoading(false);
    }
    void init();
  }, [fetchDashboard]);

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setSetupError('');
    if (!businessName.trim()) { setSetupError('Business name is required'); return; }

    setSetupLoading(true);
    try {
      await api.post('/collector/profile', {
        business_name: businessName.trim(),
        market_area: marketArea.trim() || undefined,
        commission_days: parseInt(commissionDays, 10),
      });
      await fetchDashboard();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Setup failed';
      setSetupError(msg);
    } finally {
      setSetupLoading(false);
    }
  }

  async function handleAddClient(data: {
    client_name: string;
    client_phone?: string;
    daily_amount_pesewas: number;
    cycle_days: number;
  }) {
    await api.post('/collector/clients', data);
    setAddModalOpen(false);
    await fetchDashboard();
  }

  async function handleRecordDeposit(clientId: string, amount: number) {
    await api.post(`/collector/clients/${clientId}/deposit`, {
      amount_pesewas: amount,
    });
    await fetchDashboard();
  }

  async function handlePayout(clientId: string) {
    await api.post(`/collector/clients/${clientId}/payout`);
    await fetchDashboard();
  }

  // ─── Loading state ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/[0.04] rounded-lg w-48" />
          <div className="h-24 bg-white/[0.04] rounded-2xl" />
          <div className="h-32 bg-white/[0.04] rounded-2xl" />
          <div className="h-32 bg-white/[0.04] rounded-2xl" />
        </div>
      </div>
    );
  }

  // ─── Setup screen ────────────────────────────────────────────────────────

  if (hasProfile === false) {
    return (
      <div className="p-4 md:p-6 max-w-lg mx-auto">
        <div className="text-center mb-8 pt-8">
          <div className="w-16 h-16 rounded-2xl bg-gold/15 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏪</span>
          </div>
          <h1 className="text-text-primary font-bold text-2xl mb-2">Susu Nkr{'\u0254'}fo</h1>
          <p className="text-muted text-sm leading-relaxed max-w-sm mx-auto">
            Digitalize your susu collection. Track daily deposits from your market clients transparently.
            No more lost records.
          </p>
        </div>

        <form onSubmit={handleSetup} className="space-y-4">
          {setupError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
              {setupError}
            </div>
          )}

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Business Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g., Ama's Daily Savings"
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         placeholder:text-muted-dim focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20
                         transition-all"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Market Area (optional)</label>
            <input
              type="text"
              value={marketArea}
              onChange={(e) => setMarketArea(e.target.value)}
              placeholder="e.g., Makola Market, Kaneshie"
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         placeholder:text-muted-dim focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20
                         transition-all"
            />
          </div>

          <div>
            <label className="block text-muted text-xs font-medium mb-1.5 uppercase tracking-wider">Commission (days deducted per cycle)</label>
            <select
              value={commissionDays}
              onChange={(e) => setCommissionDays(e.target.value)}
              className="w-full h-12 px-4 bg-white/[0.04] border border-white/[0.08] rounded-xl text-text-primary text-sm
                         focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-all"
            >
              <option value="1">1 day (standard)</option>
              <option value="2">2 days</option>
              <option value="3">3 days</option>
              <option value="4">4 days</option>
              <option value="5">5 days</option>
            </select>
            <p className="text-muted-dim text-xs mt-1.5">
              Your commission is the equivalent of this many days' deposits per cycle.
            </p>
          </div>

          <button
            type="submit"
            disabled={setupLoading}
            className="w-full h-14 rounded-xl bg-gold text-[#0E0E1A] font-bold text-base
                       hover:bg-gold/90 active:scale-[0.98] transition-all
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 mt-6"
          >
            {setupLoading ? (
              <div className="w-5 h-5 border-2 border-[#0E0E1A]/30 border-t-[#0E0E1A] rounded-full animate-spin" />
            ) : (
              'Start Collecting'
            )}
          </button>
        </form>
      </div>
    );
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  if (!dashboard) return null;

  const { profile, clients, today_collections, today_amount_pesewas, cycle_total_pesewas } = dashboard;
  const todayAmountGHS = (today_amount_pesewas / 100).toFixed(2);
  const cycleTotalGHS = (cycle_total_pesewas / 100).toFixed(2);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-text-primary font-bold text-xl">{profile.business_name}</h1>
          <span className="text-muted text-xs bg-white/[0.04] px-2.5 py-1 rounded-lg">
            {profile.total_clients} client{profile.total_clients !== 1 ? 's' : ''}
          </span>
        </div>
        {profile.market_area && (
          <p className="text-muted text-sm">{profile.market_area}</p>
        )}
      </div>

      {/* Today's summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
          <p className="text-emerald-400/70 text-xs font-medium uppercase tracking-wider mb-1">Today</p>
          <p className="text-emerald-400 font-bold text-xl">{'\u20B5'}{todayAmountGHS}</p>
          <p className="text-emerald-400/60 text-xs mt-0.5">
            from {today_collections} client{today_collections !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="bg-gold/10 border border-gold/20 rounded-2xl p-4">
          <p className="text-gold/70 text-xs font-medium uppercase tracking-wider mb-1">Cycle Total</p>
          <p className="text-gold font-bold text-xl">{'\u20B5'}{cycleTotalGHS}</p>
          <p className="text-gold/60 text-xs mt-0.5">across all clients</p>
        </div>
      </div>

      {/* Client list header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-text-primary font-semibold text-base">Clients</h2>
        <button
          onClick={() => setAddModalOpen(true)}
          className="h-10 px-4 rounded-xl bg-gold/15 text-gold font-semibold text-sm
                     hover:bg-gold/25 active:scale-[0.97] transition-all
                     flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Client
        </button>
      </div>

      {/* Client cards */}
      {clients.length === 0 ? (
        <div className="bg-ghana-surface rounded-2xl border border-white/[0.06] p-8 text-center">
          <p className="text-muted text-sm mb-3">No clients yet. Add your first market client to begin.</p>
          <button
            onClick={() => setAddModalOpen(true)}
            className="h-12 px-6 rounded-xl bg-gold text-[#0E0E1A] font-semibold text-sm
                       hover:bg-gold/90 active:scale-[0.97] transition-all"
          >
            Add First Client
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onRecordDeposit={handleRecordDeposit}
              onPayout={handlePayout}
            />
          ))}
        </div>
      )}

      {/* Add Client Modal */}
      <AddClientModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddClient}
      />
    </div>
  );
}
