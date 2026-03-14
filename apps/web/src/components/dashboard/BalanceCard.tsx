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
    <div className="relative bg-ghana-surface rounded-xl p-5 border border-gold/20 shadow-gold-glow shadow-card motion-safe:animate-fade-in overflow-hidden">
      {/* Subtle gold gradient overlay at top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent" />

      <p className="text-xs text-muted uppercase tracking-widest font-medium">Total Balance</p>
      <p className="text-4xl md:text-5xl font-bold text-white mt-2 tracking-tight tabular-nums">
        {formatPesewas(totalBalance)}
      </p>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {accounts.map((acc) => (
            <span
              key={acc.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted hover:bg-white/10 hover:border-gold/30 hover:text-white transition-all duration-200 cursor-default"
            >
              <span className="text-white font-semibold">{acc.name}</span>
              <span className="text-muted/80">{formatPesewas(acc.balance_pesewas)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
