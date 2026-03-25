import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { ApiRequestError } from '@/lib/api';

export function LoginPage() {
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const phoneRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => phoneRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = { phone: phone.replace(/\s|-/g, ''), pin };
      await login(payload);
      requestAnimationFrame(() => navigate('/'));
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ghana-dark px-4">
      <div className="bg-surface rounded-2xl p-8 w-full max-w-sm">
        {/* Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mb-4">
            <span className="text-gold text-2xl font-bold leading-none">₵</span>
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">CediSense</h1>
          <p className="text-muted text-sm mt-1">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="bg-expense/[0.08] text-expense text-sm px-4 py-3 rounded-xl motion-safe:animate-fade-in flex items-start gap-2.5">
              <svg
                className="w-4 h-4 mt-0.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="section-label block mb-2">Phone Number</label>
            <input
              ref={phoneRef}
              type="tel"
              placeholder="024 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-premium"
              required
            />
          </div>

          <div>
            <label className="section-label block mb-2">PIN</label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="----"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="input-premium text-center text-xl sm:text-2xl tracking-[0.4em] sm:tracking-[0.5em] placeholder:tracking-[0.3em]"
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
        </form>

        <p className="text-center text-muted-dim text-xs mt-6">
          Admin access only — contact your system administrator
        </p>
      </div>
    </div>
  );
}
