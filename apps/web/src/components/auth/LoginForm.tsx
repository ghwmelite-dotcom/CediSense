import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

type LoginMethod = 'phone' | 'email';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchMode: () => void;
}

export function LoginForm({ onSuccess, onSwitchMode }: LoginFormProps) {
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
            loginMethod === 'phone' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-text-primary'
          }`}
        >
          Phone
        </button>
        <button
          type="button"
          onClick={() => setLoginMethod('email')}
          className={`flex-1 py-2 rounded-md text-xs font-semibold transition-all duration-200 ${
            loginMethod === 'email' ? 'bg-white/10 text-white shadow-sm' : 'text-muted hover:text-text-primary'
          }`}
        >
          Email
        </button>
      </div>

      {loginMethod === 'phone' ? (
        <div>
          <label className="section-label block mb-2.5">Phone Number</label>
          <input ref={phoneRef} type="tel" placeholder="024 123 4567 or +44 7123 456789" value={phone} onChange={(e) => setPhone(e.target.value)} className="input-premium" required />
        </div>
      ) : (
        <div>
          <label className="section-label block mb-2.5">Email Address</label>
          <input ref={emailRef} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input-premium" required />
        </div>
      )}

      <div>
        <label className="section-label block mb-2.5">PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} placeholder="----" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} className="input-premium text-center text-2xl tracking-[0.5em] placeholder:tracking-[0.3em]" required />
      </div>

      <button type="submit" disabled={loading || pin.length < 4} className="btn-primary w-full mt-1">
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

      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px bg-white/[0.06]" />
        <span className="text-muted-dim text-xs uppercase tracking-wider">or</span>
        <div className="flex-1 h-px bg-white/[0.06]" />
      </div>

      <p className="text-center text-muted text-sm">
        Need an account?{' '}
        <button type="button" onClick={onSwitchMode} className="text-gold hover:text-gold-light font-medium transition-colors duration-200">
          Create one
        </button>
      </p>
    </form>
  );
}
