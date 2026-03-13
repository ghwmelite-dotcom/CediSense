import { useState } from 'react';

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000];

interface Props {
  onComplete: (income: number) => void;
  onSkip: () => void;
}

export function IncomeStep({ onComplete, onSkip }: Props) {
  const [amount, setAmount] = useState('');

  return (
    <div className="text-center">
      <div className="text-4xl mb-3">💰</div>
      <h2 className="text-xl font-semibold text-white">What's your monthly income?</h2>
      <p className="text-muted text-sm mt-1">This helps us give you better budget advice</p>

      <div className="flex items-center justify-center gap-2 mt-6">
        <span className="text-gold text-2xl font-bold">₵</span>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
          className="bg-ghana-surface border-2 border-gold rounded-lg px-4 py-3 text-2xl text-white text-center w-44 focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            onClick={() => setAmount(String(a))}
            className="bg-ghana-surface border border-ghana-surface/50 rounded-full px-4 py-1.5 text-sm text-muted hover:border-gold hover:text-white transition-colors"
          >
            ₵{a.toLocaleString()}
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
          onClick={() => amount && onComplete(parseFloat(amount))}
          disabled={!amount || parseFloat(amount) <= 0}
          className="flex-[2] bg-ghana-green text-white font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
