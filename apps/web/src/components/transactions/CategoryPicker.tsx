import type { Category, CategoryType } from '@cedisense/shared';

interface CategoryPickerProps {
  categories: Category[];
  value: string | null | undefined;
  onChange: (categoryId: string | null) => void;
  /** Optional filter — only show categories of this type */
  filterType?: CategoryType;
  className?: string;
  disabled?: boolean;
}

const TYPE_LABELS: Record<CategoryType, string> = {
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
};

const TYPE_ORDER: CategoryType[] = ['income', 'expense', 'transfer'];

export function CategoryPicker({
  categories,
  value,
  onChange,
  filterType,
  className = '',
  disabled = false,
}: CategoryPickerProps) {
  const filtered = filterType
    ? categories.filter((c) => c.type === filterType)
    : categories;

  const grouped = TYPE_ORDER.reduce<Record<CategoryType, Category[]>>(
    (acc, type) => {
      acc[type] = filtered.filter((c) => c.type === type);
      return acc;
    },
    { income: [], expense: [], transfer: [] }
  );

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className={`w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white text-sm
        focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
        disabled:opacity-50 disabled:cursor-not-allowed
        appearance-none ${className}`}
    >
      <option value="" className="bg-ghana-surface text-muted">
        — No category —
      </option>

      {TYPE_ORDER.map((type) => {
        const items = grouped[type];
        if (items.length === 0) return null;
        return (
          <optgroup
            key={type}
            label={TYPE_LABELS[type]}
            className="bg-ghana-surface text-muted text-xs"
          >
            {items.map((cat) => (
              <option
                key={cat.id}
                value={cat.id}
                className="bg-ghana-surface text-white"
              >
                {cat.icon ? `${cat.icon} ` : ''}
                {cat.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
