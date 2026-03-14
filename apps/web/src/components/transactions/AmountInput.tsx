import { useState, useEffect } from 'react';
import { toGHS, toPesewas } from '@cedisense/shared';

interface AmountInputProps {
  /** Value stored and returned in pesewas (integer) */
  valuePesewas: number;
  onChange: (pesewas: number) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

export function AmountInput({
  valuePesewas,
  onChange,
  placeholder = '0.00',
  className = '',
  disabled = false,
  required = false,
  id,
}: AmountInputProps) {
  // Internal display state as a string so the user can type freely
  const [display, setDisplay] = useState<string>(
    valuePesewas > 0 ? toGHS(valuePesewas).toFixed(2) : ''
  );

  // Keep display in sync when external value changes programmatically
  useEffect(() => {
    const external = valuePesewas > 0 ? toGHS(valuePesewas).toFixed(2) : '';
    // Only override display if it doesn't already represent the same value
    const current = parseFloat(display) || 0;
    if (Math.round(current * 100) !== valuePesewas) {
      setDisplay(external);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valuePesewas]);

  function handleChange(raw: string) {
    // Allow only digits and a single decimal point
    const sanitized = raw.replace(/[^\d.]/g, '').replace(/^(\d*\.?\d*).*/, '$1');
    setDisplay(sanitized);

    const parsed = parseFloat(sanitized) || 0;
    onChange(toPesewas(parsed));
  }

  function handleBlur() {
    // Reformat on blur for visual consistency
    const parsed = parseFloat(display) || 0;
    if (parsed > 0) {
      setDisplay(parsed.toFixed(2));
    } else {
      setDisplay('');
    }
  }

  return (
    <div
      className={`flex items-center bg-white/10 border border-white/10 rounded-xl px-4 py-3
        focus-within:ring-2 focus-within:ring-gold/50 focus-within:border-gold ${className}`}
    >
      <span className="text-gold font-semibold text-lg mr-2 select-none">₵</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        className="flex-1 bg-transparent text-white text-lg font-semibold placeholder-muted
          focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Amount in Ghana Cedis"
      />
    </div>
  );
}
