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
      navigate('/');
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-ghana-dark relative overflow-hidden">
      {/* Radial gold glow from top */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,168,67,0.12) 0%, transparent 70%)',
        }}
      />
      {/* Subtle green accent bottom-right */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 100% 110%, rgba(0,107,63,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="w-full max-w-sm relative z-10 motion-safe:animate-slide-up">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 shadow-gold-glow mb-4">
            <span className="text-gold font-extrabold text-3xl leading-none">₵</span>
          </div>
          <h1 className="text-white text-2xl font-bold mt-1 tracking-tight">Welcome back</h1>
          <p className="text-muted text-sm mt-1.5">Sign in to your CediSense account</p>
        </div>

        {/* Form card */}
        <div className="bg-ghana-surface/80 backdrop-blur-xl border border-white/5 rounded-2xl shadow-card px-6 py-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-expense/10 border border-expense/30 text-expense text-sm px-4 py-3 rounded-xl motion-safe:animate-fade-in">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted uppercase tracking-wide block mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="024 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-ghana-dark/60 border border-white/8 text-white rounded-xl px-4 py-3.5 text-base placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all duration-200"
                required
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted uppercase tracking-wide block mb-2">
                PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full bg-ghana-dark/60 border border-white/8 text-white rounded-xl px-4 py-3.5 text-center text-2xl tracking-[0.5em] placeholder:text-white/20 focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20 transition-all duration-200"
                required
              />
            </div>

            {/* Primary CTA with shimmer */}
            <button
              type="submit"
              disabled={loading || pin.length < 4}
              className="relative w-full overflow-hidden rounded-xl py-3.5 font-semibold text-white transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-ghana-green hover:bg-ghana-green/90 active:scale-[0.98] shadow-green-glow hover:shadow-green-glow"
              style={{ marginTop: '8px' }}
            >
              {/* Shimmer overlay on hover */}
              <span className="absolute inset-0 bg-gold-shimmer bg-[length:200%_100%] motion-safe:animate-shimmer opacity-0 hover:opacity-100 transition-opacity duration-300" />
              <span className="relative">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full motion-safe:animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </span>
            </button>
          </form>
        </div>

        <p className="text-center text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="text-gold hover:text-gold/80 font-medium transition-colors duration-150 hover:underline underline-offset-2"
          >
            Create one
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="absolute bottom-6 text-white/20 text-xs tracking-wide">
        Built by Hodges &amp; Co.
      </p>
    </div>
  );
}
