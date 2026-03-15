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

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  momo: '#D4A843',
  bank: '#34D399',
  cash: '#8888A8',
  susu: '#60A5FA',
};

export function BalanceCard({ totalBalance, accounts }: BalanceCardProps) {
  return (
    <div className="relative premium-card rounded-2xl p-6 overflow-hidden motion-safe:animate-fade-in">
      {/* Decorative gradient sweep background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035] motion-safe:animate-gradient-sweep"
        style={{
          background: 'linear-gradient(135deg, transparent 0%, #D4A843 30%, transparent 60%, #006B3F 80%, transparent 100%)',
          backgroundSize: '200% 200%',
        }}
      />

      {/* Ambient gold glow — hero emphasis */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-80 h-44 bg-gold/[0.06] rounded-full blur-3xl" />

      {/* Subtle top highlight line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/[0.12] to-transparent" />

      <p className="section-label relative">Total Balance</p>
      <p
        className="text-4xl md:text-5xl font-extrabold text-text-primary mt-3 tracking-tight relative motion-safe:animate-breathe"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        <span className="text-gold/70 text-2xl md:text-3xl mr-0.5 align-baseline">GH₵</span>
        {formatPesewas(totalBalance).replace(/^GH₵\s*/, '').replace(/^₵\s*/, '')}
      </p>

      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-6 relative">
          {accounts.map((acc) => (
            <span
              key={acc.id}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg bg-white/[0.03] text-xs hover:bg-white/[0.06] transition-all duration-200 cursor-default"
              style={{ borderLeft: `3px solid ${ACCOUNT_TYPE_COLORS[acc.type]}` }}
            >
              <span className="text-text-primary font-medium">{acc.name}</span>
              <span className="text-muted-dim tabular-nums">{formatPesewas(acc.balance_pesewas)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
