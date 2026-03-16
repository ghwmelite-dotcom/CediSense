import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'register';
  onSuccess: () => void;
}

type AuthMode = 'signin' | 'register';

/* ================================================================ */
/*  SIGN IN FORM                                                      */
/* ================================================================ */
type LoginMethod = 'phone' | 'email';

function SignInForm({
  onSuccess,
  onSwitchMode,
}: {
  onSuccess: () => void;
  onSwitchMode: () => void;
}) {
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (loginMethod === 'phone') phoneRef.current?.focus();
      else emailRef.current?.focus();
    }, 100);
    return () => clearTimeout(t);
  }, [loginMethod]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = loginMethod === 'phone'
        ? { phone: phone.replace(/\s|-/g, ''), pin }
        : { email, pin };
      await login(payload);
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

      {/* Login method toggle */}
      <div className="flex rounded-lg bg-white/[0.04] p-0.5">
        <button
          type="button"
          onClick={() => setLoginMethod('phone')}
          className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
            loginMethod === 'phone'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-muted hover:text-text-primary'
          }`}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod('email')}
          className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
            loginMethod === 'email'
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-muted hover:text-text-primary'
          }`}
        >
          Email
        </button>
      </div>

      {loginMethod === 'phone' ? (
        <div>
          <label className="section-label block mb-2.5">Phone Number</label>
          <input
            ref={phoneRef}
            type="tel"
            placeholder="024 123 4567 or +44 7123 456789"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-premium"
            required
          />
        </div>
      ) : (
        <div>
          <label className="section-label block mb-2.5">Email Address</label>
          <input
            ref={emailRef}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-premium"
            required
          />
        </div>
      )}

      <div>
        <label className="section-label block mb-2.5">PIN</label>
        <input
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="----"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="input-premium text-center text-2xl tracking-[0.5em] placeholder:tracking-[0.3em]"
          required
        />
      </div>

      <button
        type="submit"
        disabled={loading || pin.length < 4}
        className="btn-primary w-full mt-1"
      >
        <span className="relative flex items-center justify-center gap-2">
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign In'
          )}
        </span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-muted-dim text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      <p className="text-center text-muted text-sm">
        Need an account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-gold hover:text-gold-light font-medium transition-colors duration-200"
        >
          Create one
        </button>
      </p>
    </form>
  );
}

/* ================================================================ */
/*  REGISTER FORM                                                     */
/* ================================================================ */
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

function RegisterForm({
  onSuccess,
  onSwitchMode,
}: {
  onSuccess: () => void;
  onSwitchMode: () => void;
}) {
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
        <label className="section-label block mb-2.5">Full Name</label>
        <input
          ref={nameRef}
          type="text"
          placeholder="Kwame Asante"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input-premium"
          required
        />
      </div>

      {/* Country code + Phone */}
      <div className="space-y-1.5">
        <label className="section-label block mb-2.5">Phone Number</label>
        <div className="flex gap-2">
          <select
            value={countryCode}
            onChange={(e) => setCountryCode(e.target.value)}
            className="w-[130px] bg-white/[0.06] border border-white/10 rounded-xl px-3 py-3 text-white
              text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold
              appearance-none cursor-pointer shrink-0"
            aria-label="Country code"
          >
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code} className="bg-[#14142A]">
                {cc.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            placeholder={isInternational ? '7123 456789' : '024 123 4567'}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-premium flex-1"
            required
          />
        </div>
        {isInternational && (
          <p className="text-muted text-xs px-1">
            International number detected. You can also add an email below.
          </p>
        )}
      </div>

      {/* Email (optional, shown prominently for international) */}
      <div>
        <label className="section-label block mb-2.5">
          Email {isInternational ? '' : <span className="text-muted/60">(optional)</span>}
        </label>
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-premium"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="section-label block mb-2.5">Create PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="----"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="input-premium text-center text-xl tracking-[0.4em] placeholder:tracking-[0.2em]"
            required
          />
        </div>
        <div>
          <label className="section-label block mb-2.5">Confirm PIN</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="----"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={`input-premium text-center text-xl tracking-[0.4em] placeholder:tracking-[0.2em] ${
              pinsMatch
                ? '!shadow-[0_0_0_2px_rgba(52,211,153,0.2)]'
                : pinsMismatch
                  ? '!shadow-[0_0_0_2px_rgba(239,68,68,0.2)]'
                  : ''
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

      <button
        type="submit"
        disabled={loading || pin.length < 4 || confirmPin.length < 4}
        className="btn-primary w-full mt-1"
      >
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

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-muted-dim text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      <p className="text-center text-muted text-sm">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-gold hover:text-gold-light font-medium transition-colors duration-200"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}

/* ================================================================ */
/*  AUTH MODAL                                                        */
/* ================================================================ */
export function AuthModal({ open, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [visible, setVisible] = useState(false);
  const [animatingOut, setAnimatingOut] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sync mode when initialMode prop changes
  useEffect(() => {
    if (open) setMode(initialMode);
  }, [initialMode, open]);

  // Handle open/close with animation
  useEffect(() => {
    if (open) {
      setVisible(true);
      setAnimatingOut(false);
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else if (visible) {
      // Animate out
      setAnimatingOut(true);
      const t = setTimeout(() => {
        setVisible(false);
        setAnimatingOut(false);
        document.body.style.overflow = '';
      }, 250);
      return () => clearTimeout(t);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Escape key
  useEffect(() => {
    if (!visible) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [visible, onClose]);

  // Focus trap
  useEffect(() => {
    if (!visible || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableSelector = 'input, button, [tabindex]:not([tabindex="-1"])';

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const focusable = modal.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    window.addEventListener('keydown', handleTab);
    return () => window.removeEventListener('keydown', handleTab);
  }, [visible, mode]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === backdropRef.current) onClose();
    },
    [onClose],
  );

  if (!visible) return null;

  const isIn = open && !animatingOut;

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signin' ? 'Sign in to CediSense' : 'Create a CediSense account'}
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      onClick={handleBackdropClick}
      style={{
        backdropFilter: isIn ? 'blur(12px)' : 'blur(0px)',
        WebkitBackdropFilter: isIn ? 'blur(12px)' : 'blur(0px)',
        backgroundColor: isIn ? 'rgba(0,0,0,0.60)' : 'rgba(0,0,0,0)',
        transition: 'background-color 200ms ease-out, backdrop-filter 200ms ease-out, -webkit-backdrop-filter 200ms ease-out',
      }}
    >
      {/* Modal card */}
      <div
        ref={modalRef}
        className="relative w-full max-w-md rounded-2xl overflow-hidden"
        style={{
          background: '#14142A',
          border: '1px solid rgba(212,168,67,0.08)',
          boxShadow: '0 0 80px rgba(212,168,67,0.08), 0 25px 60px rgba(0,0,0,0.5)',
          transform: isIn ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(16px)',
          opacity: isIn ? 1 : 0,
          transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease-out',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg text-muted-dim hover:text-text-primary hover:bg-white/[0.06] transition-all duration-200"
          aria-label="Close"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pt-8 pb-8 sm:px-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4">
              <div className="absolute inset-0 rounded-xl bg-gold/8 blur-xl scale-150 motion-safe:animate-glow-pulse" />
              <div className="relative w-full h-full rounded-xl bg-ghana-surface flex items-center justify-center shadow-card">
                <span className="text-gold font-extrabold text-2xl leading-none">&#x20B5;</span>
              </div>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('signin')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'signin'
                  ? 'bg-gold/15 text-gold shadow-sm'
                  : 'text-muted hover:text-text-primary'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                mode === 'register'
                  ? 'bg-gold/15 text-gold shadow-sm'
                  : 'text-muted hover:text-text-primary'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Forms with crossfade */}
          <div className="relative">
            <div
              key={mode}
              className="motion-safe:animate-fade-in"
            >
              {mode === 'signin' ? (
                <SignInForm onSuccess={onSuccess} onSwitchMode={() => setMode('register')} />
              ) : (
                <RegisterForm onSuccess={onSuccess} onSwitchMode={() => setMode('signin')} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
