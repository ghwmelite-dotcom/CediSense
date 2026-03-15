import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

export function RegisterPage() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    setLoading(true);

    try {
      await register({ phone: phone.replace(/\s|-/g, ''), name, pin });
      navigate('/onboarding');
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

  const pinsMatch = confirmPin.length === 4 && pin === confirmPin;
  const pinsMismatch = confirmPin.length === 4 && pin !== confirmPin;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-ghana-dark relative overflow-hidden">
      {/* Subtle ambient gradient */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% -10%, rgba(212,168,67,0.06) 0%, transparent 60%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10 motion-safe:animate-slide-up">
        {/* Logo / Brand Mark */}
        <div className="text-center mb-12">
          <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6">
            <div className="absolute inset-0 rounded-2xl bg-gold/8 blur-xl scale-150 motion-safe:animate-glow-pulse" />
            <div className="relative w-full h-full rounded-2xl bg-ghana-surface flex items-center justify-center shadow-card">
              <span className="text-gold font-extrabold text-3xl leading-none">₵</span>
            </div>
          </div>
          <h1 className="text-text-primary text-2xl font-extrabold tracking-[-0.02em]">Create Account</h1>
          <p className="text-muted text-sm mt-2.5 leading-relaxed">Start tracking your finances with CediSense</p>
        </div>

        {/* Form card */}
        <div className="glass-card rounded-2xl px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-expense/[0.06] text-expense text-sm px-4 py-3 rounded-xl motion-safe:animate-fade-in flex items-start gap-2.5">
                <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="section-label block mb-3">
                Full Name
              </label>
              <input
                type="text"
                placeholder="Kwame Asante"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-premium"
                required
              />
            </div>

            <div>
              <label className="section-label block mb-3">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="024 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="input-premium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="section-label block mb-3">
                  Create PIN
                </label>
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
                <label className="section-label block mb-3">
                  Confirm PIN
                </label>
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

            {/* PIN match feedback */}
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
              className="btn-primary mt-2"
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
          </form>
        </div>

        <p className="text-center text-muted text-sm mt-10">
          Already have an account?{' '}
          <Link
            to="/login"
            className="text-gold hover:text-gold-light font-medium transition-colors duration-200"
          >
            Sign in
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="mt-auto pt-10 pb-6 text-muted-dim/25 text-xs tracking-wider">
        Built by Hodges &amp; Co.
      </p>
    </div>
  );
}
