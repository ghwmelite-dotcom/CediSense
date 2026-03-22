import { useState } from 'react';
import type { Account, AccountType } from '@cedisense/shared';
import { formatPesewas } from '@cedisense/shared';
import { api } from '@/lib/api';
import { AmountInput } from '@/components/transactions/AmountInput';

interface AccountsSectionProps {
  accounts: Account[];
  onRefresh: () => void;
}

const TYPE_LABELS: Record<AccountType, string> = {
  momo: 'MoMo',
  bank: 'Bank',
  cash: 'Cash',
  susu: 'Susu',
};

const TYPE_COLORS: Record<AccountType, string> = {
  momo: 'bg-gold/20 text-gold',
  bank: 'bg-[#FF6B35]/20 text-[#FF6B35]',
  cash: 'bg-white/10 text-muted',
  susu: 'bg-income/20 text-income',
};

const ACCOUNT_TYPES: AccountType[] = ['momo', 'bank', 'cash', 'susu'];

interface AddFormState {
  name: string;
  type: AccountType;
  provider: string;
  balancePesewas: number;
}

interface EditState {
  name: string;
  balancePesewas: number;
}

export function AccountsSection({ accounts, onRefresh }: AccountsSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>({
    name: '', type: 'momo', provider: '', balancePesewas: 0,
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function toggleRow(id: string, account: Account) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setEditStates((prev) => ({
        ...prev,
        [id]: { name: account.name, balancePesewas: account.balance_pesewas },
      }));
      setConfirmDeleteId(null);
    }
  }

  async function handleSave(account: Account) {
    const state = editStates[account.id];
    if (!state) return;
    setSavingId(account.id);
    setRowErrors((prev) => ({ ...prev, [account.id]: '' }));
    try {
      await api.put(`/accounts/${account.id}`, {
        name: state.name,
        balance_pesewas: state.balancePesewas,
      });
      setExpandedId(null);
      onRefresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [account.id]: err instanceof Error ? err.message : 'Failed to save',
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (accounts.length <= 1) return;
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    try {
      await api.delete(`/accounts/${id}`);
      setExpandedId(null);
      onRefresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [id]: err instanceof Error ? err.message : 'Failed to delete',
      }));
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await api.post('/accounts', {
        name: addForm.name,
        type: addForm.type,
        provider: addForm.provider || null,
        balance_pesewas: addForm.balancePesewas,
      });
      setAddForm({ name: '', type: 'momo', provider: '', balancePesewas: 0 });
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add account');
    } finally {
      setAddSaving(false);
    }
  }

  return (
    <div className="bg-ghana-surface rounded-2xl overflow-hidden border border-white/5">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity
            focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          aria-expanded={expanded}
        >
          <span className="text-white font-semibold text-base">
            Accounts ({accounts.length})
          </span>
          <svg
            className={`w-4 h-4 text-muted transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {expanded && (
          <button
            onClick={() => setShowAdd((prev) => !prev)}
            className="text-gold text-sm font-medium hover:text-gold/80 transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 rounded-lg px-2 py-1"
          >
            {showAdd ? 'Cancel' : '+ Add'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="pb-4">
          {/* Add form */}
          {showAdd && (
            <div className="mx-4 mb-3 bg-white/5 rounded-xl p-4 space-y-3 border border-white/10">
              <p className="text-muted text-xs uppercase tracking-wide font-medium">New Account</p>
              {addError && (
                <p className="text-expense text-sm bg-expense/10 rounded-lg px-3 py-2">{addError}</p>
              )}
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Account name"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white placeholder-muted focus:outline-none focus:ring-2
                  focus:ring-gold/50 focus:border-gold text-sm"
              />
              <select
                value={addForm.type}
                onChange={(e) => setAddForm((p) => ({ ...p, type: e.target.value as AccountType }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                  text-sm appearance-none"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-ghana-surface">{TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input
                type="text"
                value={addForm.provider}
                onChange={(e) => setAddForm((p) => ({ ...p, provider: e.target.value }))}
                placeholder="Provider (optional)"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white placeholder-muted focus:outline-none focus:ring-2
                  focus:ring-gold/50 focus:border-gold text-sm"
              />
              <AmountInput
                valuePesewas={addForm.balancePesewas}
                onChange={(v) => setAddForm((p) => ({ ...p, balancePesewas: v }))}
                placeholder="Opening balance"
              />
              <button
                onClick={handleAdd}
                disabled={addSaving || !addForm.name.trim()}
                className="w-full bg-gold text-ghana-black rounded-xl py-2.5 text-sm
                  font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50
                  disabled:cursor-not-allowed"
              >
                {addSaving ? 'Saving…' : 'Save Account'}
              </button>
            </div>
          )}

          {/* Account rows */}
          {accounts.length === 0 ? (
            <p className="text-muted text-sm px-5 pb-2">No accounts yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {accounts.map((account) => {
                const isOpen = expandedId === account.id;
                const edit = editStates[account.id] ?? { name: account.name, balancePesewas: account.balance_pesewas };
                const isSaving = savingId === account.id;
                const isDeleting = deletingId === account.id;
                const rowErr = rowErrors[account.id];

                return (
                  <li key={account.id}>
                    {/* Row summary */}
                    <button
                      onClick={() => toggleRow(account.id, account)}
                      className="w-full flex items-center justify-between px-5 py-3.5
                        hover:bg-white/5 transition-colors text-left focus:outline-none
                        focus-visible:ring-2 focus-visible:ring-gold/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[account.type]}`}>
                          {TYPE_LABELS[account.type]}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white text-sm font-medium truncate">{account.name}</p>
                          {account.provider && (
                            <p className="text-muted text-xs truncate">{account.provider}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-white text-sm font-semibold">
                          {formatPesewas(account.balance_pesewas)}
                        </span>
                        <svg
                          className={`w-4 h-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </button>

                    {/* Expanded edit form */}
                    {isOpen && (
                      <div className="px-5 pb-4 pt-2 space-y-3 bg-white/[0.03]">
                        {rowErr && (
                          <p className="text-expense text-sm bg-expense/10 rounded-lg px-3 py-2">{rowErr}</p>
                        )}

                        <div className="space-y-1.5">
                          <label className="text-muted text-xs uppercase tracking-wide">Name</label>
                          <input
                            type="text"
                            value={edit.name}
                            onChange={(e) =>
                              setEditStates((prev) => ({
                                ...prev,
                                [account.id]: { ...edit, name: e.target.value },
                              }))
                            }
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                              text-white placeholder-muted focus:outline-none focus:ring-2
                              focus:ring-gold/50 focus:border-gold text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-muted text-xs uppercase tracking-wide">Balance</label>
                          <AmountInput
                            valuePesewas={edit.balancePesewas}
                            onChange={(v) =>
                              setEditStates((prev) => ({
                                ...prev,
                                [account.id]: { ...edit, balancePesewas: v },
                              }))
                            }
                          />
                        </div>

                        {/* Read-only badges */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${TYPE_COLORS[account.type]}`}>
                            {TYPE_LABELS[account.type]}
                          </span>
                          {account.provider && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-white/10 text-muted">
                              {account.provider}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleDelete(account.id)}
                            disabled={isDeleting || accounts.length <= 1}
                            className={`flex-1 border rounded-xl py-2.5 text-sm font-medium
                              transition-colors focus:outline-none disabled:opacity-40
                              disabled:cursor-not-allowed
                              ${confirmDeleteId === account.id
                                ? 'border-expense bg-expense/10 text-expense hover:bg-expense/20'
                                : 'border-white/10 text-muted hover:bg-white/5'}`}
                            title={accounts.length <= 1 ? 'Cannot delete your only account' : undefined}
                          >
                            {isDeleting
                              ? 'Deleting…'
                              : confirmDeleteId === account.id
                                ? 'Confirm Delete'
                                : 'Delete'}
                          </button>
                          <button
                            onClick={() => handleSave(account)}
                            disabled={isSaving || !edit.name.trim()}
                            className="flex-1 bg-gold text-ghana-black rounded-xl py-2.5 text-sm
                              font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50
                              disabled:cursor-not-allowed"
                          >
                            {isSaving ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
