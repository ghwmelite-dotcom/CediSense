import { memo } from 'react';

interface KenteStripeProps {
  className?: string;
  height?: 2 | 3 | 4;
}

export const KenteStripe = memo(function KenteStripe({ className = '', height = 3 }: KenteStripeProps) {
  return (
    <div
      className={`w-full rounded-sm ${className}`}
      style={{
        height: `${height}px`,
        background:
          'linear-gradient(90deg, #FF6B35 20%, #D4A843 20%, #D4A843 40%, #00C896 40%, #00C896 60%, #FF6B35 60%, #FF6B35 80%, #D4A843 80%)',
      }}
      aria-hidden="true"
    />
  );
});
