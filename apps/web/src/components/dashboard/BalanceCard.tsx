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
    <div className="relative premium-card rounded-2xl p-6 overflow-hidden motion-safe:animate-fade-in">
      {/* Ambient gold glow — subtle */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-72 h-36 bg-gold/[0.04] rounded-full blur-3xl" />

      <p className="section-label relative">Total Balance</p>
      <p className="text-4xl md:text-5xl font-extrabold text-text-primary mt-3 tracking-tight relative" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span className="text-gold/70 text-3xl md:text-4xl mr-0.5">GH₵</span>
        {formatPesewas(totalBalance).replace(/^GH₵\s*/, '').replace(/^₵\s*/, '')}
      </p>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-6 relative">
          {accounts.map((acc) => (
            <span
              key={acc.id}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] text-xs hover:bg-white/[0.05] transition-all duration-200 cursor-default"
            >
              <span className="text-text-primary font-medium">{acc.name}</span>
              <span className="text-muted-dim" style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPesewas(acc.balance_pesewas)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
