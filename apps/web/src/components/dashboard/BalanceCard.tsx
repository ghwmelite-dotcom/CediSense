import { formatPesewas } from '@cedisense/shared';
import type { AccountType } from '@cedisense/shared';

interface AccountItem {
  id: string;
  name: string;
  type: AccountType;
  provider: string | null;
  balance_pesewas: number;
}

interface BalanceCardProps {
  totalBalance: number;
  accounts: AccountItem[];
}

export function BalanceCard({ totalBalance, accounts }: BalanceCardProps) {
  return (
    <div className="relative glass-card rounded-2xl p-6 overflow-hidden motion-safe:animate-fade-in">
      {/* Subtle gold gradient line at top */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      {/* Ambient gold glow */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-gold/[0.06] rounded-full blur-3xl" />

      <p className="text-xs text-muted uppercase tracking-widest font-medium relative">Total Balance</p>
      <p className="text-4xl md:text-5xl font-bold text-white mt-3 tracking-tight tabular-nums relative">
        {formatPesewas(totalBalance)}
      </p>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-5 relative">
          {accounts.map((acc) => (
            <span
              key={acc.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs text-muted hover:bg-white/[0.07] hover:text-white transition-all duration-200 cursor-default"
            >
              <span className="text-white font-medium">{acc.name}</span>
              <span className="text-muted/70">{formatPesewas(acc.balance_pesewas)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
