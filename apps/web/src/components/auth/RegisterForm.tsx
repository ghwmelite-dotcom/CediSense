import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

const WEAK_PINS = new Set([
  '0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999',
  '1234', '4321', '0123', '3210', '1212', '2580',
]);


interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchMode: () => void;
}

export function RegisterForm({ onSuccess, onSwitchMode }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nameRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  const pinsMatch = confirmPin.length === 4 && pin === confirmPin;
  const pinsMismatch = confirmPin.length === 4 && pin !== confirmPin;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (WEAK_PINS.has(pin)) {
      setError('PIN is too common. Choose a stronger PIN.');
      return;
    }

    setLoading(true);

    try {
      const rawPhone = phone.replace(/\s|-/g, '');

      await register({
        phone: rawPhone,
        name,
        pin,
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        // Surface specific field errors from validation
        if (err.code === 'VALIDATION_ERROR' && err.details?.fieldErrors) {
          const fieldErrors = err.details.fieldErrors as Record<string, string[]>;
          const messages = Object.values(fieldErrors).flat().filter(Boolean);
          setError(messages.length > 0 ? messages.join('. ') : err.message);
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div role="alert" className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl motion-safe:animate-fade-in flex items-start gap-2.5">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label htmlFor="register-name" className="section-label block mb-2">Full Name</label>
        <input id="register-name" ref={nameRef} type="text" autoComplete="name" placeholder="Kwame Asante" value={name} onChange={(e) => setName(e.target.value)} className="input-premium" required />
      </div>

      <div>
        <label htmlFor="register-phone" className="section-label block mb-2">Mobile Number</label>
        <input id="register-phone" type="tel" autoComplete="tel" placeholder="024 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-premium" required />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="register-pin" className="section-label block mb-2">Create PIN</label>
          <input id="register-pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={4} placeholder="----" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="input-premium text-center text-lg sm:text-xl tracking-[0.3em] sm:tracking-[0.4em] placeholder:tracking-[0.2em]" required />
        </div>
        <div>
          <label htmlFor="register-confirm-pin" className="section-label block mb-2">Confirm PIN</label>
          <input
            id="register-confirm-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            placeholder="----"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            aria-invalid={pinsMismatch}
            aria-describedby="register-pin-hint"
            className={`input-premium text-center text-lg sm:text-xl tracking-[0.3em] sm:tracking-[0.4em] placeholder:tracking-[0.2em] ${
              pinsMatch ? '!shadow-[0_0_0_2px_rgba(52,211,153,0.2)]' : pinsMismatch ? '!shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : ''
            }`}
            required
          />
        </div>
      </div>

      <div id="register-pin-hint" aria-live="polite">
      {pinsMatch && (
        <p className="text-income text-xs flex items-center gap-1.5 motion-safe:animate-fade-in -mt-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          PINs match
        </p>
      )}
      {pinsMismatch && (
        <p className="text-expense text-xs flex items-center gap-1.5 motion-safe:animate-fade-in -mt-2">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          PINs don&apos;t match
        </p>
      )}
      </div>

      <button type="submit" disabled={loading || pin.length < 4 || confirmPin.length < 4} className="btn-primary w-full mt-1">
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </span>
      </button>

      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-muted-dim text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      <p className="text-center text-muted text-sm">
        Already have an account?{' '}
        <button type="button" onClick={onSwitchMode} className="text-gold hover:text-gold-light font-medium transition-colors duration-200">
          Sign in
        </button>
      </p>
    </form>
  );
}
