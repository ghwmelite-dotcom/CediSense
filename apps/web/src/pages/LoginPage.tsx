import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ phone: phone.replace(/\s|-/g, ''), pin });
      navigate('/dashboard');
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
          <h1 className="text-text-primary text-2xl font-extrabold tracking-[-0.02em]">Welcome back</h1>
          <p className="text-muted text-sm mt-2.5 leading-relaxed">Sign in to your CediSense account</p>
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

            <div>
              <label className="section-label block mb-3">
                PIN
              </label>
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
              className="btn-primary mt-2"
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
          </form>
        </div>

        <p className="text-center text-muted text-sm mt-10">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="text-gold hover:text-gold-light font-medium transition-colors duration-200"
          >
            Create one
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
