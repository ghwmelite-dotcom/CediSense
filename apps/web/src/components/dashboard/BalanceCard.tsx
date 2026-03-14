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
    <div className="bg-ghana-surface rounded-xl p-4 border border-white/10">
      <p className="text-sm text-muted uppercase tracking-wide">Total Balance</p>
      <p className="text-3xl font-bold text-white mt-1">{formatPesewas(totalBalance)}</p>
      {accounts.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {accounts.map((acc) => (
            <span
              key={acc.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-muted"
            >
              <span className="text-white font-medium">{acc.name}</span>
              <span>{formatPesewas(acc.balance_pesewas)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
