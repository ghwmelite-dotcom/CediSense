import { useState } from 'react';
import type { CollectorClient } from '@cedisense/shared';

interface ClientCardProps {
  client: CollectorClient & { deposited_today?: boolean };
  onRecordDeposit: (clientId: string, amount: number) => Promise<void>;
  onPayout: (clientId: string) => Promise<void>;
}

export function ClientCard({ client, onRecordDeposit, onPayout }: ClientCardProps) {
  const [loading, setLoading] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const depositedToday = client.deposited_today ?? false;
  const progressPercent = client.cycle_days > 0
    ? Math.min(100, Math.round((client.deposits_this_cycle / client.cycle_days) * 100))
    : 0;
  const cycleComplete = client.days_remaining === 0;

  async function handleDeposit() {
    setLoading(true);
    try {
      await onRecordDeposit(client.id, client.daily_amount_pesewas);
    } finally {
      setLoading(false);
    }
  }

  async function handlePayout() {
    setPayoutLoading(true);
    try {
      await onPayout(client.id);
    } finally {
      setPayoutLoading(false);
    }
  }

  const amountGHS = (client.daily_amount_pesewas / 100).toFixed(2);
  const totalGHS = (client.total_deposited_this_cycle_pesewas / 100).toFixed(2);

  return (
    <div className="bg-ghana-surface rounded-2xl border border-white/[0.06] p-4 transition-all duration-200 hover:border-white/[0.1] hover:shadow-lg hover:shadow-black/20">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Deposit status indicator */}
          <div className="flex-shrink-0">
            {depositedToday ? (
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full border-2 border-white/20 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white/20" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-text-primary font-semibold text-sm truncate">{client.client_name}</p>
            {client.client_phone && (
              <p className="text-muted text-xs">{client.client_phone}</p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-2">
          <p className="text-gold font-bold text-sm">{'\u20B5'}{amountGHS}</p>
          <p className="text-muted text-[11px]">daily</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted">
            {client.deposits_this_cycle}/{client.cycle_days} days
          </span>
          <span className="text-text-primary font-medium">{'\u20B5'}{totalGHS} saved</span>
        </div>
        <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              cycleComplete ? 'bg-gold' : 'bg-emerald-500/70'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        {client.days_remaining > 0 && (
          <p className="text-muted text-[11px] mt-1">{client.days_remaining} days remaining</p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {!depositedToday && (
          <button
            onClick={handleDeposit}
            disabled={loading}
            className="flex-1 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 font-semibold text-sm
                       hover:bg-emerald-500/25 active:scale-[0.97] transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Record Deposit
              </>
            )}
          </button>
        )}
        {depositedToday && !cycleComplete && (
          <div className="flex-1 h-12 rounded-xl bg-emerald-500/10 text-emerald-400/60 font-medium text-sm
                          flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Deposited Today
          </div>
        )}
        {cycleComplete && (
          <button
            onClick={handlePayout}
            disabled={payoutLoading}
            className="flex-1 h-12 rounded-xl bg-gold/15 text-gold font-semibold text-sm
                       hover:bg-gold/25 active:scale-[0.97] transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {payoutLoading ? (
              <div className="w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            ) : (
              <>Pay Out</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
