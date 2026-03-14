import { useState } from 'react';
import type { CategoryRule, Category, MatchField, MatchType } from '@cedisense/shared';
import { api } from '@/lib/api';

interface RulesSectionProps {
  rules: CategoryRule[];
  categories: Category[];
  onRefresh: () => void;
}

const MATCH_FIELDS: MatchField[] = ['counterparty', 'description', 'provider'];
const MATCH_TYPES: MatchType[] = ['contains', 'exact', 'regex'];

const FIELD_LABELS: Record<MatchField, string> = {
  counterparty: 'Counterparty',
  description: 'Description',
  provider: 'Provider',
};

const TYPE_LABELS: Record<MatchType, string> = {
  contains: 'contains',
  exact: 'exactly matches',
  regex: 'matches regex',
};

interface EditState {
  match_field: MatchField;
  match_type: MatchType;
  match_value: string;
  category_id: string;
}

interface AddFormState extends EditState {}

function getCategoryName(categories: Category[], id: string): string {
  return categories.find((c) => c.id === id)?.name ?? 'Unknown';
}

export function RulesSection({ rules, categories, onRefresh }: RulesSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const defaultCategory = categories[0]?.id ?? '';

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>({
    match_field: 'counterparty',
    match_type: 'contains',
    match_value: '',
    category_id: defaultCategory,
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function toggleRow(id: string, rule: CategoryRule) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setEditStates((prev) => ({
        ...prev,
        [id]: {
          match_field: rule.match_field,
          match_type: rule.match_type,
          match_value: rule.match_value,
          category_id: rule.category_id,
        },
      }));
      setConfirmDeleteId(null);
    }
  }

  async function handleSave(rule: CategoryRule) {
    const state = editStates[rule.id];
    if (!state) return;
    setSavingId(rule.id);
    setRowErrors((prev) => ({ ...prev, [rule.id]: '' }));
    try {
      await api.put(`/category-rules/${rule.id}`, state);
      setExpandedId(null);
      onRefresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [rule.id]: err instanceof Error ? err.message : 'Failed to save',
      }));
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    try {
      await api.delete(`/category-rules/${id}`);
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
    if (!addForm.match_value.trim() || !addForm.category_id) return;
    setAddSaving(true);
    setAddError(null);
    try {
      await api.post('/category-rules', addForm);
      setAddForm({
        match_field: 'counterparty',
        match_type: 'contains',
        match_value: '',
        category_id: defaultCategory,
      });
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add rule');
    } finally {
      setAddSaving(false);
    }
  }

  function renderRuleFields(
    state: EditState,
    onChange: (updated: Partial<EditState>) => void
  ) {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-muted text-xs uppercase tracking-wide">Field</label>
            <select
              value={state.match_field}
              onChange={(e) => onChange({ match_field: e.target.value as MatchField })}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold appearance-none"
            >
              {MATCH_FIELDS.map((f) => (
                <option key={f} value={f} className="bg-ghana-surface">{FIELD_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-muted text-xs uppercase tracking-wide">Match</label>
            <select
              value={state.match_type}
              onChange={(e) => onChange({ match_type: e.target.value as MatchType })}
              className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2.5
                text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
                focus:border-gold appearance-none"
            >
              {MATCH_TYPES.map((t) => (
                <option key={t} value={t} className="bg-ghana-surface capitalize">{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-muted text-xs uppercase tracking-wide">Value</label>
          <input
            type="text"
            value={state.match_value}
            onChange={(e) => onChange({ match_value: e.target.value })}
            placeholder="Match value"
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
              text-white placeholder-muted focus:outline-none focus:ring-2
              focus:ring-gold/50 focus:border-gold text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-muted text-xs uppercase tracking-wide">Category</label>
          <select
            value={state.category_id}
            onChange={(e) => onChange({ category_id: e.target.value })}
            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
              text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50
              focus:border-gold appearance-none"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id} className="bg-ghana-surface">
                {c.icon ? `${c.icon} ` : ''}{c.name}
              </option>
            ))}
          </select>
        </div>
      </>
    );
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
            Auto-Categorization Rules ({rules.length})
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
              <p className="text-muted text-xs uppercase tracking-wide font-medium">New Rule</p>
              {addError && (
                <p className="text-expense text-sm bg-expense/10 rounded-lg px-3 py-2">{addError}</p>
              )}
              {renderRuleFields(addForm, (updated) => setAddForm((p) => ({ ...p, ...updated })))}
              <button
                onClick={handleAdd}
                disabled={addSaving || !addForm.match_value.trim() || !addForm.category_id}
                className="w-full bg-gold text-ghana-black rounded-xl py-2.5 text-sm
                  font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50
                  disabled:cursor-not-allowed"
              >
                {addSaving ? 'Saving…' : 'Save Rule'}
              </button>
            </div>
          )}

          {/* Rule rows */}
          {rules.length === 0 ? (
            <p className="text-muted text-sm px-5 pb-2">No rules yet. Add one to auto-categorize transactions.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {rules.map((rule) => {
                const isOpen = expandedId === rule.id;
                const edit = editStates[rule.id] ?? {
                  match_field: rule.match_field,
                  match_type: rule.match_type,
                  match_value: rule.match_value,
                  category_id: rule.category_id,
                };
                const isSaving = savingId === rule.id;
                const isDeleting = deletingId === rule.id;
                const rowErr = rowErrors[rule.id];
                const catName = getCategoryName(categories, rule.category_id);

                return (
                  <li key={rule.id}>
                    <button
                      onClick={() => toggleRow(rule.id, rule)}
                      className="w-full flex items-start justify-between px-5 py-3.5 gap-3
                        hover:bg-white/5 transition-colors text-left focus:outline-none
                        focus-visible:ring-2 focus-visible:ring-gold/50"
                    >
                      <p className="text-white text-sm leading-relaxed flex-1 min-w-0">
                        <span className="text-muted">When </span>
                        <span className="text-gold">{FIELD_LABELS[rule.match_field]}</span>
                        <span className="text-muted"> {TYPE_LABELS[rule.match_type]} </span>
                        <span className="text-white font-medium">'{rule.match_value}'</span>
                        <span className="text-muted"> → </span>
                        <span className="text-income font-medium">{catName}</span>
                      </p>
                      <svg
                        className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 mt-0.5 ${isOpen ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 pt-2 space-y-3 bg-white/[0.03]">
                        {rowErr && (
                          <p className="text-expense text-sm bg-expense/10 rounded-lg px-3 py-2">{rowErr}</p>
                        )}

                        {renderRuleFields(edit, (updated) =>
                          setEditStates((prev) => ({
                            ...prev,
                            [rule.id]: { ...edit, ...updated },
                          }))
                        )}

                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleDelete(rule.id)}
                            disabled={isDeleting}
                            className={`flex-1 border rounded-xl py-2.5 text-sm font-medium
                              transition-colors focus:outline-none disabled:opacity-40
                              disabled:cursor-not-allowed
                              ${confirmDeleteId === rule.id
                                ? 'border-expense bg-expense/10 text-expense hover:bg-expense/20'
                                : 'border-white/10 text-muted hover:bg-white/5'}`}
                          >
                            {isDeleting
                              ? 'Deleting…'
                              : confirmDeleteId === rule.id
                                ? 'Confirm Delete'
                                : 'Delete'}
                          </button>
                          <button
                            onClick={() => handleSave(rule)}
                            disabled={isSaving || !edit.match_value.trim()}
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
