import { memo } from 'react';

const SYMBOLS = {
  'gye-nyame': { text: '\u27E1 GYE NYAME \u27E1', meaning: 'Except God' },
  'sankofa': { text: '\u27E1 SANKOFA \u27E1', meaning: 'Go back and get it' },
  'dwennimmen': { text: '\u27E1 DWENNIMMEN \u27E1', meaning: 'Strength with humility' },
  'fawohodie': { text: '\u27E1 FAWOHODIE \u27E1', meaning: 'Independence' },
} as const;

interface AdinkraWhisperProps {
  symbol?: keyof typeof SYMBOLS;
  className?: string;
}

export const AdinkraWhisper = memo(function AdinkraWhisper({ symbol = 'gye-nyame', className = '' }: AdinkraWhisperProps) {
  const { text, meaning } = SYMBOLS[symbol];
  return (
    <div
      className={`text-center text-[9px] tracking-[3px] select-none ${className}`}
      style={{ color: 'rgba(212,168,67,0.2)' }}
      aria-hidden="true"
      title={meaning}
    >
      {text}
    </div>
  );
});
