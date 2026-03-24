import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

const COUNTRY_CODES = [
  { code: '+233', label: 'Ghana (+233)', flag: 'GH' },
  { code: '+44', label: 'UK (+44)', flag: 'GB' },
  { code: '+1', label: 'US/CA (+1)', flag: 'US' },
  { code: '+49', label: 'Germany (+49)', flag: 'DE' },
  { code: '+31', label: 'Netherlands (+31)', flag: 'NL' },
  { code: '+39', label: 'Italy (+39)', flag: 'IT' },
  { code: '+34', label: 'Spain (+34)', flag: 'ES' },
  { code: '+61', label: 'Australia (+61)', flag: 'AU' },
  { code: '+27', label: 'South Africa (+27)', flag: 'ZA' },
  { code: '+234', label: 'Nigeria (+234)', flag: 'NG' },
];

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchMode: () => void;
}

export function RegisterForm({ onSuccess, onSwitchMode }: RegisterFormProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+233');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const nameRef = useRef<HTMLInputElement>(null);

  const isInternational = countryCode !== '+233';

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

    setLoading(true);

    try {
      const rawPhone = phone.replace(/\s|-/g, '');
      const fullPhone = isInternational
        ? (rawPhone.startsWith('+') ? rawPhone : countryCode + rawPhone)
        : rawPhone;

      await register({
        phone: fullPhone,
        name,
        pin,
        ...(email ? { email } : {}),
        ...(isInternational ? { country_code: countryCode } : {}),
      });
      onSuccess();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
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
        <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl motion-safe:animate-fade-in flex items-start gap-2.5">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="section-label block mb-2">Full Name</label>
        <input ref={nameRef} type="text" placeholder="Kwame Asante" value={name} onChange={(e) => setName(e.target.value)} className="input-premium" required />
      </div>

      <div className="space-y-1.5">
        <label className="section-label block mb-2">Phone Number</label>
        <div className="flex flex-col min-[400px]:flex-row gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-full min-[400px]:w-[120px] bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold appearance-none cursor-pointer shrink-0"
            aria-label="Country code"
          >
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code} className="bg-[#14142A]">{cc.label}</option>
            ))}
          </select>
          <input type="tel" placeholder={isInternational ? '7123 456789' : '024 123 4567'} value={phone} onChange={(e) => setPhone(e.target.value)} className="input-premium flex-1" required />
        </div>
      </div>

      {isInternational && (
        <div>
          <label className="section-label block mb-2">
            Email <span className="text-muted/60">(optional)</span>
          </label>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-premium" />
          <p className="text-muted text-xs mt-1.5 px-1">For account recovery only</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="section-label block mb-2">Create PIN</label>
          <input type="password" inputMode="numeric" maxLength={4} placeholder="----" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="input-premium text-center text-lg sm:text-xl tracking-[0.3em] sm:tracking-[0.4em] placeholder:tracking-[0.2em]" required />
        </div>
        <div>
          <label className="section-label block mb-2">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="----"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={`input-premium text-center text-lg sm:text-xl tracking-[0.3em] sm:tracking-[0.4em] placeholder:tracking-[0.2em] ${
              pinsMatch ? '!shadow-[0_0_0_2px_rgba(52,211,153,0.2)]' : pinsMismatch ? '!shadow-[0_0_0_2px_rgba(239,68,68,0.2)]' : ''
            }`}
            required
          />
        </div>
      </div>

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
