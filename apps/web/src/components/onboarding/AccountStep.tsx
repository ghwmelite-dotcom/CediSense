import { useState } from 'react';
import { PROVIDERS } from '@cedisense/shared';

const ACCOUNT_OPTIONS = [
  ...PROVIDERS.momo.map((p) => ({ ...p, type: 'momo' as const, subtitle: 'Mobile Money' })),
  ...PROVIDERS.bank.slice(0, 4).map((p) => ({ ...p, type: 'bank' as const, subtitle: 'Bank Account' })),
  { id: 'cash', name: 'Cash', color: '#333', type: 'cash' as const, subtitle: 'Physical cash tracking' },
];

interface Props {
  onComplete: (account: { name: string; type: 'momo' | 'bank' | 'cash'; provider: string }) => void;
  onSkip: () => void;
}

export function AccountStep({ onComplete, onSkip }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const selectedOption = ACCOUNT_OPTIONS.find((o) => o.id === selected);

  return (
    <div className="text-center">
      <div className="text-4xl mb-3">📱</div>
      <h2 className="text-xl font-semibold text-white">Add your primary account</h2>
      <p className="text-muted text-sm mt-1">Which do you use most for daily transactions?</p>

      <div className="flex flex-col gap-2.5 mt-6 text-left">
        {ACCOUNT_OPTIONS.map((option) => (
          <button
            key={option.id}
            onClick={() => setSelected(option.id)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-colors ${
              selected === option.id
                ? 'border-gold bg-ghana-surface'
                : 'border-ghana-surface bg-ghana-surface hover:border-muted/30'
            }`}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
              style={{ backgroundColor: option.color }}
            >
              {option.id === 'cash' ? '💵' : option.name.slice(0, 3).toUpperCase()}
            </div>
            <div>
              <div className="text-white font-semibold text-sm">{option.name}</div>
              <div className="text-muted text-xs">{option.subtitle}</div>
            </div>
            {selected === option.id && <div className="ml-auto text-gold">✓</div>}
          </button>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <button
          onClick={onSkip}
          className="flex-1 py-3 text-muted text-sm hover:text-white transition-colors"
        >
          Skip
        </button>
        <button
          onClick={() =>
            selectedOption &&
            onComplete({
              name: selectedOption.name,
              type: selectedOption.type,
              provider: selectedOption.id,
            })
          }
          disabled={!selected}
          className="flex-[2] bg-ghana-green text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
