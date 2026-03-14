import { useState } from 'react';
import type { Category, CategoryType } from '@cedisense/shared';
import { api } from '@/lib/api';

interface CategoriesSectionProps {
  categories: Category[];
  onRefresh: () => void;
}

const TYPE_COLORS: Record<CategoryType, string> = {
  income: 'bg-income/20 text-income',
  expense: 'bg-expense/20 text-expense',
  transfer: 'bg-gold/20 text-gold',
};

const CATEGORY_TYPES: CategoryType[] = ['income', 'expense', 'transfer'];

interface EditState {
  icon: string;
  name: string;
}

interface AddFormState {
  icon: string;
  name: string;
  type: CategoryType;
  color: string;
}

export function CategoriesSection({ categories, onRefresh }: CategoriesSectionProps) {
  const userCategories = categories.filter((c) => c.user_id !== null);

  const [expanded, setExpanded] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editStates, setEditStates] = useState<Record<string, EditState>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});

  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<AddFormState>({
    icon: '', name: '', type: 'expense', color: '',
  });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  function toggleRow(id: string, cat: Category) {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      setEditStates((prev) => ({
        ...prev,
        [id]: { icon: cat.icon ?? '', name: cat.name },
      }));
      setConfirmDeleteId(null);
    }
  }

  async function handleSave(cat: Category) {
    const state = editStates[cat.id];
    if (!state) return;
    setSavingId(cat.id);
    setRowErrors((prev) => ({ ...prev, [cat.id]: '' }));
    try {
      await api.put(`/categories/${cat.id}`, {
        icon: state.icon || null,
        name: state.name,
      });
      setExpandedId(null);
      onRefresh();
    } catch (err) {
      setRowErrors((prev) => ({
        ...prev,
        [cat.id]: err instanceof Error ? err.message : 'Failed to save',
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
      await api.delete(`/categories/${id}`);
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
      await api.post('/categories', {
        icon: addForm.icon || null,
        name: addForm.name,
        type: addForm.type,
        color: addForm.color || null,
      });
      setAddForm({ icon: '', name: '', type: 'expense', color: '' });
      setShowAdd(false);
      onRefresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add category');
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
            Custom Categories ({userCategories.length})
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
              <p className="text-muted text-xs uppercase tracking-wide font-medium">New Category</p>
              {addError && (
                <p className="text-expense text-sm bg-expense/10 rounded-lg px-3 py-2">{addError}</p>
              )}
              <input
                type="text"
                value={addForm.icon}
                onChange={(e) => setAddForm((p) => ({ ...p, icon: e.target.value }))}
                placeholder="Icon emoji (e.g. 🍔)"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white placeholder-muted focus:outline-none focus:ring-2
                  focus:ring-gold/50 focus:border-gold text-sm"
              />
              <input
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Category name"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white placeholder-muted focus:outline-none focus:ring-2
                  focus:ring-gold/50 focus:border-gold text-sm"
              />
              <select
                value={addForm.type}
                onChange={(e) => setAddForm((p) => ({ ...p, type: e.target.value as CategoryType }))}
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
                  text-sm appearance-none"
              >
                {CATEGORY_TYPES.map((t) => (
                  <option key={t} value={t} className="bg-ghana-surface capitalize">{t}</option>
                ))}
              </select>
              <input
                type="text"
                value={addForm.color}
                onChange={(e) => setAddForm((p) => ({ ...p, color: e.target.value }))}
                placeholder="Color hex (optional, e.g. #4ADE80)"
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                  text-white placeholder-muted focus:outline-none focus:ring-2
                  focus:ring-gold/50 focus:border-gold text-sm"
              />
              <button
                onClick={handleAdd}
                disabled={addSaving || !addForm.name.trim()}
                className="w-full bg-gold text-ghana-black rounded-xl py-2.5 text-sm
                  font-semibold hover:bg-gold/90 transition-colors disabled:opacity-50
                  disabled:cursor-not-allowed"
              >
                {addSaving ? 'Saving…' : 'Save Category'}
              </button>
            </div>
          )}

          {/* Category rows */}
          {userCategories.length === 0 ? (
            <p className="text-muted text-sm px-5 pb-2">No custom categories yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {userCategories.map((cat) => {
                const isOpen = expandedId === cat.id;
                const edit = editStates[cat.id] ?? { icon: cat.icon ?? '', name: cat.name };
                const isSaving = savingId === cat.id;
                const isDeleting = deletingId === cat.id;
                const rowErr = rowErrors[cat.id];

                return (
                  <li key={cat.id}>
                    <button
                      onClick={() => toggleRow(cat.id, cat)}
                      className="w-full flex items-center justify-between px-5 py-3.5
                        hover:bg-white/5 transition-colors text-left focus:outline-none
                        focus-visible:ring-2 focus-visible:ring-gold/50"
                    >
                      <div className="flex items-center gap-3">
                        {cat.icon && (
                          <span className="text-xl w-7 text-center">{cat.icon}</span>
                        )}
                        <span className="text-white text-sm font-medium">{cat.name}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLORS[cat.type]}`}>
                          {cat.type}
                        </span>
                      </div>
                      <svg
                        className={`w-4 h-4 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
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

                        <div className="space-y-1.5">
                          <label className="text-muted text-xs uppercase tracking-wide">Icon</label>
                          <input
                            type="text"
                            value={edit.icon}
                            onChange={(e) =>
                              setEditStates((prev) => ({
                                ...prev,
                                [cat.id]: { ...edit, icon: e.target.value },
                              }))
                            }
                            placeholder="Emoji icon"
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                              text-white placeholder-muted focus:outline-none focus:ring-2
                              focus:ring-gold/50 focus:border-gold text-sm"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-muted text-xs uppercase tracking-wide">Name</label>
                          <input
                            type="text"
                            value={edit.name}
                            onChange={(e) =>
                              setEditStates((prev) => ({
                                ...prev,
                                [cat.id]: { ...edit, name: e.target.value },
                              }))
                            }
                            className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3
                              text-white placeholder-muted focus:outline-none focus:ring-2
                              focus:ring-gold/50 focus:border-gold text-sm"
                          />
                        </div>

                        <div className="flex gap-3 pt-1">
                          <button
                            onClick={() => handleDelete(cat.id)}
                            disabled={isDeleting}
                            className={`flex-1 border rounded-xl py-2.5 text-sm font-medium
                              transition-colors focus:outline-none disabled:opacity-40
                              disabled:cursor-not-allowed
                              ${confirmDeleteId === cat.id
                                ? 'border-expense bg-expense/10 text-expense hover:bg-expense/20'
                                : 'border-white/10 text-muted hover:bg-white/5'}`}
                          >
                            {isDeleting
                              ? 'Deleting…'
                              : confirmDeleteId === cat.id
                                ? 'Confirm Delete'
                                : 'Delete'}
                          </button>
                          <button
                            onClick={() => handleSave(cat)}
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
